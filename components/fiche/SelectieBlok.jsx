'use client';

// Taken voor een selectie van items op de kaart: een nieuwe taak die aan al die items hangt, of de items
// koppelen aan een bestaande taak. Toont ook welke taken al over deze items gaan.
import { useEffect, useMemo, useState } from 'react';
import { maps, foutTekst } from '../maps/db';
import { dagLijst, dagNaam, label, uitSleutel, uurKort, leesUur } from './dagen';

export default function FicheSelectieBlok({ items, plan, schrijven, titelStandaard = '', elementenMap = null }) {
  const ids = useMemo(() => items.map((x) => x.id), [items]);
  const planId = plan?.id || items[0]?.plan_id;
  const [taken, setTaken] = useState([]);
  const [gekoppeld, setGekoppeld] = useState([]);
  const [titel, setTitel] = useState('');
  const [dagK, setDagK] = useState('start:-1');
  const [uur, setUur] = useState('');
  const [bestaand, setBestaand] = useState('');
  const [melding, setMelding] = useState('');
  const [levs, setLevs] = useState([]);
  const [lev, setLev] = useState({ id: '', soort: 'levering', k: 'start:-2', uur: '' });
  useEffect(() => { maps().from('leveranciers').select('id, naam').order('naam').then((r) => setLevs(r.data || [])); }, []);
  // Leveranciers van de geselecteerde items (zoals het materiaalscherm: herkomst, element, standaard van het plan).
  const std = plan?.instellingen?.leveranciers || {};
  const levNaam = (i) => { const el = elementenMap?.get?.(i.element_id); return String(String(i.velden?.herkomst || '').trim() || el?.leverancier || (el?.categorie ? std[el.categorie] || '' : '')).trim(); };
  const perLev = new Map(); for (const i of items) { const n = levNaam(i); if (n) perLev.set(n, (perLev.get(n) || 0) + 1); }
  const levKeuze = [...perLev.entries()].map(([n, a]) => ({ l: levs.find((x) => x.naam.trim().toLowerCase() === n.toLowerCase()), n, a })).filter((x) => x.l);
  const sleutel = ids.join(',');

  const laad = async () => {
    if (!planId) return;
    const [t, k] = await Promise.all([
      maps().from('taken').select('id, titel, voorbereiding').eq('plan_id', planId).order('titel'),
      ids.length ? maps().from('taak_koppelingen').select('taak_id, item_id').in('item_id', ids) : Promise.resolve({ data: [] }),
    ]);
    setTaken((t.data || []).filter((x) => !x.voorbereiding));
    const per = new Map(); for (const x of k.data || []) per.set(x.taak_id, (per.get(x.taak_id) || 0) + 1);
    const tIds = [...per.keys()];
    if (!tIds.length) { setGekoppeld([]); return; }
    const d = await maps().from('taak_dagen').select('taak_id, anker, dag, uur_van, status').in('taak_id', tIds);
    setGekoppeld(tIds.map((id) => ({ id, titel: (t.data || []).find((x) => x.id === id)?.titel || 'Taak', n: per.get(id), dagen: (d.data || []).filter((x) => x.taak_id === id) })));
  };
  useEffect(() => { laad(); }, [sleutel, planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lijst = useMemo(() => dagLijst(plan || {}, [{ anker: 'start', dag: -10 }, { anker: 'einde', dag: 5 }]), [plan]);
  const koppelRijen = (taakId) => items.map((i) => ({ taak_id: taakId, soort: 'item', item_id: i.id, label: i.naam || null }));
  const maak = async () => {
    const t = titel.trim() || titelStandaard || `Plaatsen ${items.length} items`;
    const u = leesUur(uur); if (uur && !u) return setMelding('Uur niet herkend, bv. 07:30');
    const n = await maps().from('taken').insert({ plan_id: planId, titel: t }).select().single();
    if (n.error) return setMelding(foutTekst(n.error));
    const [a, b] = await Promise.all([
      maps().from('taak_dagen').insert({ taak_id: n.data.id, ...uitSleutel(dagK), uur_van: u }),
      maps().from('taak_koppelingen').insert(koppelRijen(n.data.id)),
    ]);
    if (a.error || b.error) return setMelding(foutTekst(a.error || b.error));
    setTitel(''); setUur(''); setMelding(`Taak "${t}" gemaakt voor ${items.length} items.`); laad();
  };
  const koppel = async () => {
    if (!bestaand) return;
    const al = await maps().from('taak_koppelingen').select('item_id').eq('taak_id', bestaand).in('item_id', ids);
    const heeft = new Set((al.data || []).map((x) => x.item_id));
    const rijen = koppelRijen(bestaand).filter((r) => !heeft.has(r.item_id));
    if (rijen.length) { const r = await maps().from('taak_koppelingen').insert(rijen); if (r.error) return setMelding(foutTekst(r.error)); }
    setMelding(`${rijen.length} items gekoppeld.`); setBestaand(''); laad();
  };

  const maakLevering = async () => {
    const keuze = levKeuze.find((x) => x.l.id === lev.id) || levKeuze[0]; if (!keuze) return;
    const u = leesUur(lev.uur); if (lev.uur && !u) return setMelding('Uur niet herkend, bv. 08:00');
    let sl = await maps().from('site_leveranciers').select('id').eq('plan_id', planId).eq('leverancier_id', keuze.l.id).maybeSingle();
    if (!sl.data) sl = await maps().from('site_leveranciers').insert({ plan_id: planId, leverancier_id: keuze.l.id }).select('id').single();
    if (sl.error) return setMelding(foutTekst(sl.error));
    const mijn = items.filter((i) => levNaam(i).toLowerCase() === keuze.n.toLowerCase()).map((i) => i.id);
    const r = await maps().from('leveringen').insert({ site_leverancier_id: sl.data.id, soort: lev.soort, ...uitSleutel(lev.k), uur_van: u, item_ids: mijn });
    if (r.error) return setMelding(foutTekst(r.error));
    setMelding(`${lev.soort === 'ophaling' ? 'Ophaling' : 'Levering'} van ${keuze.l.naam} voor ${mijn.length} items op ${dagNaam(plan || {}, uitSleutel(lev.k).anker, uitSleutel(lev.k).dag)}.`);
  };
  if (!planId) return null;
  return (
    <div className="fm-sectie" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="fm-mat-lab">Taken in de fiche</div>
      {gekoppeld.map((t) => (
        <a key={t.id} className="fm-sub" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }} href={`/maps/${planId}/fiche?tab=planning`}>
          <b style={{ fontWeight: 600, color: 'var(--t-tekst)' }}>{t.titel}</b> · {t.n === items.length ? 'alle' : `${t.n} van ${items.length}`} items
          <span style={{ display: 'block' }}>{t.dagen.map((d) => `${label(plan || {}, d.anker, d.dag)}${d.uur_van ? ` ${uurKort(d.uur_van)}` : ''}${d.status === 'klaar' ? ' ✓' : ''}`).join(', ')}</span>
        </a>
      ))}
      {schrijven && <>
        <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={titelStandaard || `Plaatsen ${items.length} items`} aria-label="Nieuwe taak" />
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={dagK} onChange={(e) => setDagK(e.target.value)} aria-label="Dag" style={{ flex: 1, minWidth: 0 }}>{lijst.map((x) => <option key={x.k} value={x.k}>{dagNaam(plan || {}, x.anker, x.dag)}</option>)}</select>
          <input value={uur} onChange={(e) => setUur(e.target.value)} placeholder="uur" aria-label="Uur" style={{ width: 60 }} />
        </div>
        <button className="fm-knop klein" onClick={maak}>Taak maken voor {items.length} {items.length === 1 ? 'item' : 'items'}</button>
        {taken.length > 0 && <div style={{ display: 'flex', gap: 6 }}>
          <select value={bestaand} onChange={(e) => setBestaand(e.target.value)} aria-label="Bestaande taak" style={{ flex: 1, minWidth: 0 }}><option value="">Of koppelen aan een bestaande taak…</option>{taken.map((t) => <option key={t.id} value={t.id}>{t.titel}</option>)}</select>
          <button className="fm-knop klein" disabled={!bestaand} onClick={koppel}>Koppelen</button>
        </div>}
      </>}
      {schrijven && levKeuze.length > 0 && <>
        <div className="fm-mat-lab" style={{ marginTop: 6 }}>Levering of ophaling van deze items</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={lev.id || levKeuze[0].l.id} onChange={(e) => setLev({ ...lev, id: e.target.value })} aria-label="Leverancier" style={{ flex: 1, minWidth: 0 }}>{levKeuze.map((x) => <option key={x.l.id} value={x.l.id}>{x.l.naam} · {x.a} items</option>)}</select>
          <select value={lev.soort} onChange={(e) => setLev({ ...lev, soort: e.target.value })} aria-label="Soort"><option value="levering">Levering</option><option value="ophaling">Ophaling</option></select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={lev.k} onChange={(e) => setLev({ ...lev, k: e.target.value })} aria-label="Dag" style={{ flex: 1, minWidth: 0 }}>{lijst.map((x) => <option key={x.k} value={x.k}>{dagNaam(plan || {}, x.anker, x.dag)}</option>)}</select>
          <input value={lev.uur} onChange={(e) => setLev({ ...lev, uur: e.target.value })} placeholder="uur" aria-label="Uur" style={{ width: 60 }} />
        </div>
        <button className="fm-knop klein" onClick={maakLevering}>{lev.soort === 'ophaling' ? 'Ophaling' : 'Levering'} maken</button>
      </>}
      {melding && <div className="fm-sub">{melding}</div>}
    </div>
  );
}
