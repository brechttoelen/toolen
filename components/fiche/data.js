'use client';

// Gegevens van de projectfiche van één site (plan): laden en wijzigen.
// Alle tabellen staan in het schema maps; de rechten zitten in de databank (RLS).
import { useCallback, useEffect, useRef, useState } from 'react';
import { maps, foutTekst, wieBenIk, magSchrijven } from '../maps/db';

export const PLAN_TABELLEN = ['site_leveranciers', 'leveringen', 'offertes', 'facturen', 'budgetposten', 'taken', 'taak_dagen', 'taak_koppelingen',
  'programma', 'laadregels', 'cateringregels', 'catering_prijzen', 'notities', 'site_rollen', 'plan_vennootschappen'];
export const ORG_TABELLEN = ['leveranciers', 'personen', 'vennootschappen', 'laad_bronnen', 'laadpakketten'];
const VOLGORDE = { programma: 'uur_van', leveranciers: 'naam', personen: 'naam', vennootschappen: 'naam', laad_bronnen: 'volgorde', laadpakketten: 'naam', notities: 'created_at' };

// Alles in stukken van 1000 ophalen.
async function alles(maak) {
  const uit = [];
  for (let van = 0; ; van += 1000) {
    const r = await maak().range(van, van + 999);
    if (r.error) return r;
    uit.push(...(r.data || []));
    if (!r.data || r.data.length < 1000) break;
  }
  return { data: uit, error: null };
}

export function useFiche(planId) {
  const [st, setSt] = useState({ laden: true, fout: '', plan: null, event: null, items: [], lagen: [], elementen: [], d: {}, profiel: null, financieel: false, planLev: [] });
  const [melding, setMelding] = useState('');
  const meldTimer = useRef(null);
  const meld = useCallback((t) => { setMelding(t); clearTimeout(meldTimer.current); meldTimer.current = setTimeout(() => setMelding(''), 4000); }, []);

  const laad = useCallback(async () => {
    const p = await maps().from('plannen').select('*').eq('id', planId).maybeSingle();
    if (p.error || !p.data) { setSt((s) => ({ ...s, laden: false, fout: p.error ? foutTekst(p.error) : 'Dit plan bestaat niet of je hebt er geen toegang toe.' })); return; }
    const plan = p.data;
    const vragen = [
      plan.event_id ? maps().from('events').select('*').eq('id', plan.event_id).maybeSingle() : Promise.resolve({ data: null }),
      alles(() => maps().from('items').select('*').eq('plan_id', planId)),
      plan.plek_id ? alles(() => maps().from('items').select('*').eq('plek_id', plan.plek_id).is('plan_id', null)) : Promise.resolve({ data: [] }),
      maps().from('lagen').select('*').eq('plan_id', planId).order('volgorde'),
      wieBenIk(),
      maps().rpc('mag_financieel', { p_org: plan.organisatie_id }),
      maps().rpc('plan_leveranciers', { p_plan: planId }),
      ...PLAN_TABELLEN.map((t) => alles(() => maps().from(t).select('*').eq('plan_id', planId).order(VOLGORDE[t] || 'created_at', { ascending: true }))),
      ...ORG_TABELLEN.map((t) => alles(() => maps().from(t).select('*').eq('organisatie_id', plan.organisatie_id).order(VOLGORDE[t] || 'naam'))),
    ];
    const r = await Promise.all(vragen);
    const [ev, it, plek, lg, wie, fin, pl] = r;
    const elIds = [...new Set([...(it.data || []), ...(plek.data || [])].map((x) => x.element_id).filter(Boolean))];
    const bib = [];
    for (let k = 0; k < elIds.length; k += 200) {
      const b = await maps().from('bibliotheek').select('*').in('id', elIds.slice(k, k + 200));
      if (!b.error) bib.push(...(b.data || []));
    }
    const d = {};
    const fouten = [];
    [...PLAN_TABELLEN, ...ORG_TABELLEN].forEach((t, i) => { const x = r[7 + i]; if (x.error) fouten.push(`${t}: ${foutTekst(x.error)}`); d[t] = x.data || []; });
    setSt({
      laden: false, fout: fouten.length ? fouten.join(' · ') : '', plan, event: ev.data || null,
      items: [...(it.data || []), ...(plek.data || []).map((x) => ({ ...x, vast: true }))].filter((x) => !x.verborgen),
      lagen: lg.data || [], elementen: bib, d, profiel: wie, financieel: !!fin.data, planLev: pl.data || [],
    });
  }, [planId]);
  useEffect(() => { laad(); }, [laad]);
  // Terug naar dit tabblad (bv. na het materiaalscherm of de kaart in een ander tabblad): opnieuw laden,
  // zodat wijzigingen aan items, leveranciers en standaarden meteen in de fiche staan.
  useEffect(() => {
    let laatst = Date.now();
    const terug = () => { if (document.visibilityState === 'visible' && Date.now() - laatst > 5000) { laatst = Date.now(); laad(); } };
    document.addEventListener('visibilitychange', terug); window.addEventListener('focus', terug);
    return () => { document.removeEventListener('visibilitychange', terug); window.removeEventListener('focus', terug); };
  }, [laad]);

  const zet = (t, f) => setSt((s) => ({ ...s, d: { ...s.d, [t]: f(s.d[t] || []) } }));

  const voegToe = useCallback(async (t, rij) => {
    const lijst = Array.isArray(rij) ? rij : [rij];
    if (!lijst.length) return [];
    const metPlan = PLAN_TABELLEN.includes(t) ? lijst.map((x) => ({ plan_id: planId, ...x })) : lijst;
    const r = await maps().from(t).insert(metPlan).select();
    if (r.error) { meld(foutTekst(r.error)); return null; }
    zet(t, (l) => [...l, ...(r.data || [])]);
    return Array.isArray(rij) ? r.data : r.data?.[0];
  }, [planId, meld]);

  const wijzig = useCallback(async (t, id, patch) => {
    const ids = Array.isArray(id) ? id : [id];
    zet(t, (l) => l.map((x) => (ids.includes(x.id) ? { ...x, ...patch } : x)));
    const r = await maps().from(t).update(patch).in('id', ids).select();
    if (r.error) { meld(foutTekst(r.error)); laad(); return false; }
    if (r.data) zet(t, (l) => l.map((x) => r.data.find((y) => y.id === x.id) || x));
    return true;
  }, [meld, laad]);

  const wis = useCallback(async (t, id) => {
    const ids = Array.isArray(id) ? id : [id];
    zet(t, (l) => l.filter((x) => !ids.includes(x.id)));
    const r = await maps().from(t).delete().in('id', ids);
    if (r.error) { meld(foutTekst(r.error)); laad(); return false; }
    return true;
  }, [meld, laad]);

  const planWijzig = useCallback(async (patch) => {
    setSt((s) => ({ ...s, plan: { ...s.plan, ...patch } }));
    const r = await maps().from('plannen').update(patch).eq('id', planId).select().single();
    if (r.error) { meld(foutTekst(r.error)); laad(); return false; }
    setSt((s) => ({ ...s, plan: r.data }));
    return true;
  }, [planId, meld, laad]);

  // Een item wijzigen (velden of leverancier), via de bestaande tabel items.
  const itemWijzig = useCallback(async (id, patch) => {
    setSt((s) => ({ ...s, items: s.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    const r = await maps().from('items').update(patch).eq('id', id);
    if (r.error) { meld(foutTekst(r.error)); laad(); return false; }
    return true;
  }, [meld, laad]);

  const rpc = useCallback(async (naam, args) => {
    const r = await maps().rpc(naam, args);
    if (r.error) { meld(foutTekst(r.error)); return null; }
    return r.data;
  }, [meld]);

  return { ...st, schrijven: magSchrijven(st.profiel), melding, meld, herlaad: laad, voegToe, wijzig, wis, planWijzig, itemWijzig, rpc };
}

// Hulp: lijst → map op id.
export const opId = (l) => new Map((l || []).map((x) => [x.id, x]));
export const euro = (n) => (n == null || n === '' || !Number.isFinite(Number(n)) ? '–' : new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(Number(n)));
export const getal = (s) => { if (s === '' || s == null) return null; let t = String(s).trim().replace(/[€\s]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return t !== '' && Number.isFinite(n) ? n : null; };
export const getalTekst = (n) => (n == null ? '' : String(Number(n)).replace('.', ','));

// Leverancier van een item: overschrijving > herkomst > leverancier van het element > standaard van het plan
// per categorie (zoals het materiaalscherm).
export function itemLeverancier(item, elementen, leveranciers, std = null) {
  if (item.leverancier_id) return item.leverancier_id;
  const el = elementen.get ? elementen.get(item.element_id) : null;
  const naam = String(String(item.velden?.herkomst || '').trim() || el?.leverancier || (std && el?.categorie ? std[el.categorie] || '' : '')).trim().toLowerCase();
  if (!naam) return null;
  return leveranciers.find((l) => l.naam.trim().toLowerCase() === naam)?.id || null;
}
