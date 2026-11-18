// Bestelling per leverancier per site: regels (maps.bestelregels) tegenover wat er op de kaart staat.
// Een regel met kaart_sleutel (element en variant) is gekoppeld aan die regel in de materiaallijst van de leverancier;
// het geplaatste aantal wordt geteld, nooit bewaard. Zonder koppeling is het een vrije regel.
// Niet vastgezet: de bestelling loopt mee met de kaart (regels zonder aantal volgen de telling, materiaal
// zonder regel verschijnt vanzelf). Vastgezet: aantallen staan vast en het verschil is zichtbaar.
import { berekenStuklijst } from '../maps/Stuklijst';
import { datumVan, datumTekst, label, volgorde, canoniek, uurKort } from './dagen';

export const STATUS_LEV = [['nog_niets', 'Nog niets'], ['inschatting', 'Inschatting'], ['offerte_gevraagd', 'Offerte gevraagd'], ['offerte', 'Offerte ontvangen'], ['bevestigd', 'Besteld'], ['gefactureerd', 'Gefactureerd'], ['afgesloten', 'Afgesloten']];
export const EENHEDEN = [['st', 'st.'], ['m', 'm']];

// Materiaal per leverancier uit het plan, met dezelfde telling als het materiaalscherm (stuks en meter).
// Optioneel enkel voor een deel van de items (een laag, een levering).
export function materiaalVan(f, levId, deel = null) {
  const naam = (f.d.leveranciers.find((l) => l.id === levId)?.naam || '').trim().toLowerCase();
  if (!naam) return [];
  const els = new Map((f.elementen || []).map((e) => [e.id, e]));
  const lagen = new Map((f.lagen || []).map((l) => [l.id, l]));
  const std = f.plan?.instellingen?.leveranciers || {};
  const items = (deel || f.items).filter((i) => !i.vast);
  let s;
  try { s = berekenStuklijst(items, els, lagen, null, std); } catch { return []; }
  const per = new Map();
  for (const r of (s.elementen || [])) {
    if (String(r.leverancier || '').trim().toLowerCase() !== naam) continue;
    const k = r.bestel || `n:${r.naam}`;
    const m = per.get(k) || { sleutel: k, naam: r.naam, aantal: 0, meter: 0, ids: [] };
    m.aantal += r.aantal || 0; m.meter += r.meter || 0; m.ids.push(...(r.ids || []));
    per.set(k, m);
  }
  return [...per.values()].sort((a, b) => b.aantal - a.aantal);
}
// Leveranciers met materiaal op de kaart, met de telling van de materiaallijst (ook toebehoren).
const opKaartCache = new WeakMap();
export function leveranciersOpKaart(f) {
  if (opKaartCache.has(f.items)) return opKaartCache.get(f.items);
  const els = new Map((f.elementen || []).map((e) => [e.id, e]));
  const lagen = new Map((f.lagen || []).map((l) => [l.id, l]));
  let rijen = [];
  try { rijen = berekenStuklijst(f.items.filter((i) => !i.vast), els, lagen, null, f.plan?.instellingen?.leveranciers || {}).elementen || []; } catch { rijen = []; }
  const perNaam = new Map(); for (const r of rijen) { const n = String(r.leverancier || '').trim().toLowerCase(); if (n) perNaam.set(n, (perNaam.get(n) || 0) + (r.aantal || 0)); }
  const uit = new Map(); for (const l of f.d.leveranciers || []) { const n = perNaam.get(l.naam.trim().toLowerCase()); if (n) uit.set(l.id, n); }
  opKaartCache.set(f.items, uit);
  return uit;
}
// Een leverancier op de site is 'betrokken' als er meer is dan een automatische toevoeging.
export function betrokken(f, x, opKaart = leveranciersOpKaart(f)) {
  return opKaart.has(x.leverancier_id) || x.status !== 'nog_niets' || !!(x.wat || x.materiaal || x.opmerking || x.aanspreekpunt_id || x.vastgezet_op)
    || (f.d.bestelregels || []).some((l) => l.site_leverancier_id === x.id)
    || (f.d.leveringen || []).some((l) => l.site_leverancier_id === x.id) || (f.d.offertes || []).some((o) => o.site_leverancier_id === x.id)
    || (f.d.facturen || []).some((o) => o.site_leverancier_id === x.id) || (f.d.budgetposten || []).some((b) => b.site_leverancier_id === x.id)
    || (f.d.taken || []).some((t) => t.wie_leverancier_id === x.leverancier_id);
}
export const matTekst = (m) => m.map((r) => `${r.aantal} × ${r.naam}${r.meter ? ` (${Math.round(r.meter * 10) / 10} m)` : ''}`).join(', ');
// Items van een levering: gekozen items, anders gekozen lagen, anders alles.
export function itemsVanLevering(f, l) {
  if (l.item_ids?.length) { const s = new Set(l.item_ids); return f.items.filter((i) => s.has(i.id)); }
  if (l.laag_ids?.length) { const s = new Set(l.laag_ids); return f.items.filter((i) => s.has(i.laag_id)); }
  return null;
}
export const somVan = (lijst, veld = 'bedrag_excl') => lijst.reduce((a, x) => a + (Number(x[veld]) || 0), 0);

const rond = (n) => Math.round(n * 10) / 10;
const waarde = (m, eenheid) => (!m ? 0 : eenheid === 'm' ? rond(m.meter || 0) : (m.aantal || 0));
const num = (x) => (x == null || x === '' ? null : Number(x));
export const regelsVan = (f, slId) => (f.d.bestelregels || []).filter((r) => r.site_leverancier_id === slId)
  .sort((a, b) => ((a.volgorde || 0) - (b.volgorde || 0)) || String(a.created_at || '').localeCompare(String(b.created_at || '')));

// De bestelling van één leverancier op de site: bewaarde regels met hun telling, plus (zolang ze meeloopt)
// het materiaal van de kaart dat nog geen regel heeft.
//   rij = { id, r, vrij, virtueel, besteld, geplaatst, volgt, weg }
//   besteld: het aantal van de regel; zonder aantal volgt een gekoppelde regel de kaart.
export function bestelRijen(f, sl) {
  const levId = sl.leverancier_id;
  const lijst = materiaalVan(f, levId);
  const mat = new Map(lijst.map((m) => [m.sleutel, m]));
  const opNaam = new Map(lijst.map((m) => [m.naam, m]));
  // Een regel hangt aan de kaart via de sleutel (element en variant). Regels van vóór de sleutel, of regels
  // waarvan de sleutel niet meer bestaat, vallen terug op de naam.
  const sleutelVan = (r) => (r.kaart_sleutel && mat.has(r.kaart_sleutel) ? r.kaart_sleutel : r.kaart_naam && opNaam.has(r.kaart_naam) ? opNaam.get(r.kaart_naam).sleutel : r.kaart_sleutel || (r.kaart_naam ? `n:${r.kaart_naam}` : null));
  const regels = regelsVan(f, sl.id).map((r) => ({ r, k: sleutelVan(r) }));
  const vast = !!sl.vastgezet_op;
  const perLaag = new Map();
  const inLaag = (laagId) => {
    if (!perLaag.has(laagId)) perLaag.set(laagId, new Map(materiaalVan(f, levId, f.items.filter((i) => i.laag_id === laagId)).map((m) => [m.sleutel, m])));
    return perLaag.get(laagId);
  };
  // Wat niet in een laag van een andere regel ligt, verdelen over de regels zonder locatie (in volgorde).
  const rest = new Map();
  const restVan = (x) => {
    const k = `${x.k}|${x.r.eenheid}`;
    if (!rest.has(k)) {
      let g = waarde(mat.get(x.k), x.r.eenheid);
      const lagen = new Set(regels.filter((y) => y.k === x.k && y.r.locatie_laag_id).map((y) => y.r.locatie_laag_id));
      for (const l of lagen) g -= waarde(inLaag(l).get(x.k), x.r.eenheid);
      rest.set(k, Math.max(0, rond(g)));
    }
    return k;
  };
  const rijen = regels.map((x, i) => {
    const r = x.r;
    if (!x.k) return { id: r.id, r, vrij: true, besteld: num(r.aantal), geplaatst: null, volgt: false };
    let g;
    if (r.locatie_laag_id) g = waarde(inLaag(r.locatie_laag_id).get(x.k), r.eenheid);
    else {
      const k = restVan(x); const over = rest.get(k);
      const laatste = !regels.some((y, j) => j > i && y.k === x.k && y.r.eenheid === r.eenheid && !y.r.locatie_laag_id);
      g = laatste || r.aantal == null ? over : Math.min(over, Number(r.aantal));
      rest.set(k, rond(over - g));
    }
    const volgt = r.aantal == null;
    const m = mat.get(x.k);
    return { id: r.id, r, k: x.k, vrij: false, besteld: volgt ? (vast ? null : g) : Number(r.aantal), geplaatst: g, volgt, weg: !m, kaartNaam: m?.naam || r.kaart_naam };
  });
  const gekoppeld = new Set(regels.map((x) => x.k).filter(Boolean));
  const los = lijst.filter((m) => !gekoppeld.has(m.sleutel));
  const virtueel = vast ? [] : los.map((m) => ({
    id: `kaart:${m.sleutel}`, k: m.sleutel, virtueel: true, vrij: false, volgt: true, besteld: m.aantal, geplaatst: m.aantal, kaartNaam: m.naam,
    r: { id: null, site_leverancier_id: sl.id, wat: m.naam, kaart_naam: m.naam, kaart_sleutel: m.sleutel, eenheid: 'st', aantal: null },
  }));
  return { rijen: [...rijen, ...virtueel], nietBesteld: vast ? los : [], los, vast, mat };
}
// 'weinig' | 'veel' | 'klaar' | null (vrije regel of niets te vergelijken).
export function stand(rij) {
  if (rij.vrij || rij.besteld == null || rij.geplaatst == null) return null;
  return rij.geplaatst < rij.besteld ? 'weinig' : rij.geplaatst > rij.besteld ? 'veel' : 'klaar';
}

// Moment (levering of ophaling) kort: "za 23 jan 08:00" of "D-8 08:00" zonder wedstrijddag.
export function momentKort(plan, l) {
  if (!l) return '';
  const d = datumVan(plan, l.anker, l.dag);
  const u = uurKort(l.uur_van);
  return `${d ? datumTekst(d) : label(plan, l.anker, l.dag)}${u ? ` ${u}` : ''}${l.uur_tot ? `–${uurKort(l.uur_tot)}` : ''}`;
}
export const locatieTekst = (f, r) => (r.locatie_laag_id && (f.lagen || []).find((l) => l.id === r.locatie_laag_id)?.naam) || r.locatie_tekst || '';

// Eén lijn in de lijst van leveranciers.
export function samenvatting(f, sl) {
  const b = bestelRijen(f, sl);
  const lv = (f.d.leveringen || []).filter((l) => l.site_leverancier_id === sl.id);
  const opVolgorde = (soort) => lv.filter((l) => l.soort === soort).sort((x, y) => volgorde(f.plan, x, y));
  const lev = opVolgorde('levering'); const oph = opVolgorde('ophaling');
  const telbaar = b.rijen.filter((x) => !x.vrij && x.besteld != null);
  const besteld = rond(telbaar.reduce((a, x) => a + x.besteld, 0));
  const geplaatst = rond(telbaar.reduce((a, x) => a + x.geplaatst, 0));
  const punten = [];
  if (b.vast) {
    const weinig = rond(telbaar.reduce((a, x) => a + Math.max(0, x.besteld - x.geplaatst), 0));
    const veel = rond(telbaar.reduce((a, x) => a + Math.max(0, x.geplaatst - x.besteld), 0));
    if (weinig) punten.push({ t: `nog ${weinig} te plaatsen`, k: 'let-op' });
    if (veel) punten.push({ t: `${veel} meer geplaatst dan besteld`, k: 'fout' });
    if (b.nietBesteld.length) punten.push({ t: `${b.nietBesteld.length} op de kaart maar niet besteld`, k: 'let-op' });
  }
  const echt = b.rijen.filter((x) => !x.virtueel);
  if (b.vast || ['bevestigd', 'gefactureerd'].includes(sl.status)) {
    const zonderLev = b.rijen.filter((x) => !x.r.levering_id).length;
    if (zonderLev) punten.push({ t: `${zonderLev} ${zonderLev === 1 ? 'regel' : 'regels'} zonder levering`, k: 'let-op' });
    const zonderOph = echt.filter((x) => !x.vrij && x.r.levering_id && !x.r.ophaling_id).length;
    if (zonderOph) punten.push({ t: `${zonderOph} ${zonderOph === 1 ? 'regel' : 'regels'} zonder ophaling`, k: 'let-op' });
  }
  return { ...b, regels: b.rijen.length, telbaar: telbaar.length, besteld, geplaatst, punten, lev, oph, eerste: lev[0] || null, laatste: oph[oph.length - 1] || null, meer: Math.max(0, lev.length - 1) + Math.max(0, oph.length - 1) };
}

// ---- Wijzigen (via f: voegToe, wijzig, wis) ----

// Een regel die nog enkel uit de kaart komt, bewaren zodat ze velden kan krijgen.
export async function maakEcht(f, rij, extra = {}) {
  if (!rij.virtueel) return rij.r;
  const n = regelsVan(f, rij.r.site_leverancier_id).length;
  return f.voegToe('bestelregels', { site_leverancier_id: rij.r.site_leverancier_id, wat: rij.r.wat, kaart_naam: rij.r.kaart_naam, kaart_sleutel: rij.r.kaart_sleutel, eenheid: rij.r.eenheid, volgorde: n, ...extra });
}
const zelfdeUur = (a, b) => uurKort(a) === uurKort(b);
// Levering of ophaling van regels instellen: zoekt het moment van die leverancier of maakt het,
// en ruimt een moment op dat daarna nergens meer voor dient. m = { anker, dag, uur_van, uur_tot } of null.
export async function zetMoment(f, sl, regels, soort, m) {
  const veld = soort === 'ophaling' ? 'ophaling_id' : 'levering_id';
  let id = null;
  if (m) {
    const c = canoniek(f.plan, m.anker, m.dag);
    const bestaand = (f.d.leveringen || []).find((l) => l.site_leverancier_id === sl.id && l.soort === soort && zelfdeUur(l.uur_van, m.uur_van) && zelfdeUur(l.uur_tot, m.uur_tot)
      && (() => { const x = canoniek(f.plan, l.anker, l.dag); return x.anker === c.anker && x.dag === c.dag; })());
    const lev = bestaand || await f.voegToe('leveringen', { site_leverancier_id: sl.id, soort, anker: c.anker, dag: c.dag, uur_van: m.uur_van || null, uur_tot: m.uur_tot || null });
    if (!lev) return false;
    id = lev.id;
  }
  const ids = regels.map((r) => r.id);
  const oud = [...new Set(regels.map((r) => r[veld]).filter((x) => x && x !== id))];
  if (!(await f.wijzig('bestelregels', ids, { [veld]: id }))) return false;
  const nogGebruikt = (lid) => (f.d.bestelregels || []).some((r) => !ids.includes(r.id) && (r.levering_id === lid || r.ophaling_id === lid))
    || (f.d.taken || []).some((t) => t.levering_id === lid);
  const weg = oud.filter((lid) => { const l = (f.d.leveringen || []).find((x) => x.id === lid); return l && !nogGebruikt(lid) && !l.wat && !l.item_ids?.length && !l.laag_ids?.length && (l.status || 'open') === 'open'; });
  if (weg.length) await f.wis('leveringen', weg);
  return true;
}
// Vastzetten: elke regel krijgt het aantal dat nu op de kaart staat; daarna toont de fiche het verschil.
export async function zetVast(f, sl, aan) {
  if (!aan) return f.wijzig('site_leveranciers', sl.id, { vastgezet_op: null });
  const b = bestelRijen(f, sl);
  const n = regelsVan(f, sl.id).length;
  const nieuw = b.rijen.filter((x) => x.virtueel).map((x, i) => ({ site_leverancier_id: sl.id, wat: x.r.wat, kaart_naam: x.r.kaart_naam, kaart_sleutel: x.r.kaart_sleutel, eenheid: 'st', aantal: x.geplaatst, volgorde: n + i }));
  if (nieuw.length && !(await f.voegToe('bestelregels', nieuw))) return false;
  for (const x of b.rijen.filter((y) => !y.virtueel && !y.vrij && y.volgt)) await f.wijzig('bestelregels', x.r.id, { aantal: x.geplaatst });
  return f.wijzig('site_leveranciers', sl.id, { vastgezet_op: new Date().toISOString(), ...(['nog_niets', 'inschatting', 'offerte_gevraagd', 'offerte'].includes(sl.status) ? { status: 'bevestigd' } : {}) });
}
// Een gekoppelde regel zonder locatie opsplitsen in één regel per laag waar dat materiaal ligt.
export async function splitsPerLocatie(f, sl, rij) {
  const r = rij.r; if (rij.vrij || !rij.k || r.locatie_laag_id) return 0;
  const delen = (f.lagen || []).map((lg) => ({ lg, m: materiaalVan(f, sl.leverancier_id, f.items.filter((i) => i.laag_id === lg.id)).find((x) => x.sleutel === rij.k) })).filter((x) => x.m && waarde(x.m, r.eenheid) > 0);
  if (delen.length < 2) return 0;
  const basis = regelsVan(f, sl.id).length;
  const nieuw = delen.map((x, i) => ({ site_leverancier_id: sl.id, wat: r.wat, kaart_naam: rij.kaartNaam || r.kaart_naam, kaart_sleutel: rij.k, eenheid: r.eenheid || 'st', groep: r.groep || null, opmerking: r.opmerking || null,
    levering_id: r.levering_id || null, ophaling_id: r.ophaling_id || null, locatie_laag_id: x.lg.id, aantal: sl.vastgezet_op ? waarde(x.m, r.eenheid) : null, volgorde: basis + i }));
  if (!(await f.voegToe('bestelregels', nieuw))) return 0;
  if (r.id) await f.wis('bestelregels', r.id);
  return nieuw.length;
}
