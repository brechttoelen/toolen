// Signalisatievoorstel: uit de routes (PPO → parking) de punten halen waar een
// bord nodig is. De manoeuvres komen uit OSRM (autoprofiel): die weet wanneer
// een straatnaamwissel gewoon rechtdoor is ("new name") en wanneer je echt
// afslaat. Zonder verbinding valt het terug op de hoek in de lijn (te controleren).
//
// item.velden.sign.auto = { anker, richting, plek, rijen, eigen?, leeg?, controleren? }
//   anker = plaats van de manoeuvre (kruispunt), plek = waar het bord kwam,
//   rijen = de panelen die de tool voorstelde. Wijkt het punt daarvan af, dan is
//   het "aangepast" en blijft jouw versie staan.

import * as turf from '@turf/turf';
import { isSign, norm, pijlUitHoek, routeHoeken } from './signalisatie';

const M = { units: 'meters' };
const OSRM = 'https://routing.openstreetmap.de/routed-car';

const MOD = {
  uturn: 'u-bocht', 'sharp right': 'rechts', right: 'rechts', 'slight right': 'schuin-rechts',
  straight: 'rechtdoor', 'slight left': 'schuin-links', left: 'links', 'sharp left': 'links',
};
const ROTONDE = new Set(['roundabout', 'rotary', 'roundabout turn']);
const BORD_TYPES = new Set(['turn', 'end of road', 'fork', 'on ramp', 'off ramp', 'roundabout', 'rotary', 'roundabout turn', 'continue']);
const PIJL_VOLGORDE = ['rechtdoor', 'schuin-links', 'links', 'schuin-rechts', 'rechts', 'terug', 'u-bocht', 'geen'];

// Heeft deze manoeuvre een bord nodig?
function bordNodig(m) {
  if (!BORD_TYPES.has(m.type)) return false;
  // "continue" = je blijft op dezelfde weg die afbuigt: enkel bij een echte bocht.
  if (m.type === 'continue') return ['left', 'right', 'sharp left', 'sharp right', 'uturn'].includes(m.modifier);
  return true;
}

const afstand = (a, b) => turf.distance(a, b, M);
const hoekVerschil = (a, b) => (a == null || b == null ? 0 : Math.abs(norm(a - b)));

// Routelijn in rijrichting: begint bij het PPO-punt als dat dichter bij het einde ligt.
export function routeLijn(lijnItem, ppoItem) {
  const c = lijnItem?.geometrie?.type === 'LineString' ? [...lijnItem.geometrie.coordinates] : null;
  if (!c || c.length < 2) return null;
  const p = ppoItem?.geometrie?.type === 'Point' ? ppoItem.geometrie.coordinates : null;
  if (p && afstand(p, c[c.length - 1]) < afstand(p, c[0])) c.reverse();
  return c;
}

// Punten om de 50 m langs de lijn (plus begin en einde) voor OSRM match.
function staal(coords, stap = 50) {
  const lijn = turf.lineString(coords);
  const L = turf.length(lijn, M);
  const n = Math.max(1, Math.round(L / stap));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(turf.along(lijn, (L * i) / n, M).geometry.coordinates);
  return pts;
}

const fmt = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

// De gratis server remt af bij veel vragen kort na elkaar (429): even wachten en opnieuw.
// Elke vraag maximaal 12 s: blijft de server hangen, dan geen eindeloos wachten.
async function haalJson(url, stop) {
  for (let poging = 0; poging < 4; poging++) {
    if (stop?.gestopt) throw new Error('gestopt');
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    let r;
    try { r = await fetch(url, { signal: ac.signal }); } catch (e) { clearTimeout(t); if (stop?.gestopt) throw new Error('gestopt'); if (poging < 3) continue; throw e; }
    clearTimeout(t);
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500 * (poging + 1))); continue; }
    return r.json();
  }
  throw new Error('Routeplanner te druk');
}

// Snel: één 'route'-aanvraag per ~6 km. De punten zijn tussenpunten (geen haltes) en
// krijgen de rijrichting van de lijn mee, dus geen keerbewegingen of omwegen.
async function routeStuk(pts, richtingen, stop) {
  const url = `${OSRM}/route/v1/driving/${pts.map(fmt).join(';')}?steps=true&geometries=geojson&overview=false&continue_straight=true`
    + `&waypoints=0;${pts.length - 1}&radiuses=${pts.map(() => 25).join(';')}&bearings=${richtingen.map((b) => `${((Math.round(b) % 360) + 360) % 360},60`).join(';')}`;
  const j = await haalJson(url, stop);
  if (j.code !== 'Ok' || !j.routes?.[0]) throw new Error(j.message || j.code || 'OSRM');
  return { steps: j.routes[0].legs.flatMap((l) => l.steps || []), afstand: j.routes[0].distance };
}

// Traag (max. 10 punten per aanvraag): enkel als terugval.
async function matchStuk(pts, stop) {
  const url = `${OSRM}/match/v1/driving/${pts.map(fmt).join(';')}?steps=true&geometries=geojson&overview=false&gaps=ignore&radiuses=${pts.map(() => 25).join(';')}&waypoints=0;${pts.length - 1}`;
  const j = await haalJson(url, stop);
  if (j.code !== 'Ok') throw new Error(j.message || j.code || 'OSRM');
  return { steps: (j.matchings || []).flatMap((m) => (m.legs || []).flatMap((l) => l.steps || [])) };
}

// Stukken met overlap; een rotonde die op de grens afgekapt is, komt uit het volgende stuk.
async function inStukken(pts, STUK, OVERLAP, vraag, voortgang) {
  const steps = [];
  const totaal = Math.max(1, Math.ceil((pts.length - 1) / (STUK - OVERLAP)));
  let k = 0;
  for (let s = 0; s < pts.length - 1; s += STUK - OVERLAP) {
    voortgang?.(k / totaal); k += 1;
    const idx = [s, Math.min(pts.length, s + STUK)];
    if (idx[1] - idx[0] < 2) break;
    const laatste = s + STUK >= pts.length;
    const { steps: st } = await vraag(...idx);
    const eind = st.length ? st[st.length - 1].geometry?.coordinates?.slice(-1)[0] : null;
    for (const x of st) {
      const g = x.geometry?.coordinates;
      if (!laatste && ROTONDE.has(x.maneuver?.type) && eind && g?.length && afstand(g[g.length - 1], eind) < 15) continue;
      steps.push(x);
    }
    if (laatste) break;
  }
  return steps;
}

// Alle manoeuvres langs de route uit OSRM, in volgorde, met hun positie op de lijn.
// voortgang(fractie 0..1, tekst); stop = { gestopt } om af te breken.
export async function osrmManoeuvres(coords, { voortgang, stop } = {}) {
  const lijnL = turf.length(turf.lineString(coords), M);
  let steps;
  try {
    // Om de 75 m een tussenpunt met de rijrichting van de lijn; 90 punten per aanvraag.
    const pts = staal(coords, 75);
    const richt = pts.map((p, i) => turf.bearing(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]));
    let totaal = 0; let n = 0;
    steps = await inStukken(pts, 90, 4, async (a, b) => { const r = await routeStuk(pts.slice(a, b), richt.slice(a, b), stop); totaal += r.afstand; n += 1; return r; }, (f) => voortgang?.(f, 'route'));
    // Wijkt de route duidelijk af van de getekende lijn (omweg), dan de trage, precieze manier.
    // (De overlap tussen stukken telt dubbel: ~300 m per bijkomend stuk.)
    if (totaal > lijnL * 1.3 + 300 * n) throw new Error('omweg');
  } catch (e) {
    if (stop?.gestopt) throw e;
    // De FOSSGIS-server aanvaardt maximaal 10 punten per match-aanvraag (groter = TooBig).
    const pts = staal(coords, 50);
    steps = await inStukken(pts, 10, 4, (a, b) => matchStuk(pts.slice(a, b), stop), (f) => voortgang?.(f, 'precies'));
  }
  const lijn = turf.lineString(coords);
  const L = turf.length(lijn, M);
  const uit = [];
  for (const st of steps) {
    const m = st.maneuver || {};
    const loc = m.location;
    if (!loc) continue;
    const pos = turf.nearestPointOnLine(lijn, turf.point(loc), M).properties.location;
    let naar = m.bearing_after;
    if (ROTONDE.has(m.type) && st.geometry?.coordinates?.length > 1) {
      // Richting waarin je de rotonde verlaat: einde van dit stuk.
      const g = turf.lineString(st.geometry.coordinates);
      const gl = turf.length(g, M);
      naar = turf.bearing(turf.along(g, Math.max(0, gl - 25), M).geometry.coordinates, st.geometry.coordinates[st.geometry.coordinates.length - 1]);
    }
    // Rotonde: waar je ze verlaat, en in welke richting je daar rijdt (langs de rotonde).
    let rot = {};
    if (ROTONDE.has(m.type) && st.geometry?.coordinates?.length > 1) {
      const g = turf.lineString(st.geometry.coordinates);
      const gl = turf.length(g, M);
      const uitP = st.geometry.coordinates[st.geometry.coordinates.length - 1];
      // Het punt waar de route de rotonde verlaat: einde van het stuk óp de rotonde.
      // OSRM geeft de geometrie tot aan de uitrit; neem ~6 m ervoor als rijrichting op de rotonde.
      const voorUit = turf.along(g, Math.max(0, gl - 6), M).geometry.coordinates;
      rot = { uit: uitP, uitPos: turf.nearestPointOnLine(lijn, turf.point(uitP), M).properties.location, uitVoor: turf.bearing(turf.along(g, Math.max(0, gl - 14), M).geometry.coordinates, voorUit) };
    }
    uit.push({ type: m.type, modifier: m.modifier, exit: m.exit, loc, pos, voor: m.bearing_before, na: naar, naam: st.name || '', ref: st.ref || '', ...rot });
  }
  // Ontdubbelen (overlap tussen de stukken) en tussenliggende vertrek/aankomst weg.
  uit.sort((a, b) => a.pos - b.pos);
  const schoon = [];
  for (const m of uit) {
    if (m.type === 'depart' && m.pos > 30) continue;
    if (m.type === 'arrive' && m.pos < L - 30) continue;
    if (schoon.some((x) => x.type === m.type && Math.abs(x.pos - m.pos) < 20)) continue;
    schoon.push(m);
  }
  return { manoeuvres: schoon, lengte: L };
}

// Terugval zonder OSRM: knikken in de lijn zelf.
export function knikken(coords) {
  const lijn = turf.lineString(coords);
  const L = turf.length(lijn, M);
  const uit = [{ type: 'depart', pos: 0, loc: coords[0], voor: turf.bearing(coords[0], turf.along(lijn, Math.min(L, 30), M).geometry.coordinates), naam: '' }];
  const meet = [];
  for (let d = 30; d < L - 30; d += 5) {
    const a = turf.along(lijn, d - 30, M).geometry.coordinates;
    const h = turf.along(lijn, d, M).geometry.coordinates;
    const b = turf.along(lijn, d + 30, M).geometry.coordinates;
    const voor = turf.bearing(a, h); const na = turf.bearing(h, b);
    meet.push({ d, h, voor, na, draai: norm(na - voor) });
  }
  // Enkel de top van elke knik (anders wordt een haakse bocht "schuin").
  for (let i = 0; i < meet.length; i++) {
    const m = meet[i];
    if (Math.abs(m.draai) <= 40) continue;
    const buren = meet.filter((x) => Math.abs(x.d - m.d) <= 30);
    if (buren.some((x) => Math.abs(x.draai) > Math.abs(m.draai) || (Math.abs(x.draai) === Math.abs(m.draai) && x.d < m.d))) continue;
    uit.push({ type: 'turn', modifier: null, pijl: pijlUitHoek(m.draai), loc: m.h, pos: m.d, voor: m.voor, na: m.na, naam: '', controleren: true });
  }
  uit.push({ type: 'arrive', pos: L, loc: coords[coords.length - 1], voor: turf.bearing(turf.along(lijn, Math.max(0, L - 30), M).geometry.coordinates, coords[coords.length - 1]), naam: '' });
  return { manoeuvres: uit, lengte: L, terugval: true };
}

function pijlVan(m) {
  if (m.pijl) return m.pijl;
  if (ROTONDE.has(m.type)) return m.na != null && m.voor != null ? pijlUitHoek(norm(m.na - m.voor)) : 'rechtdoor';
  if (m.type === 'depart') return 'rechtdoor';
  return MOD[m.modifier] || (m.na != null && m.voor != null ? pijlUitHoek(norm(m.na - m.voor)) : 'rechtdoor');
}

// Kandidaat-bordpunten voor één route.
export function kandidatenVoorRoute(route, coords, res) {
  const lijn = turf.lineString(coords);
  const uit = [];
  for (const m of res.manoeuvres) {
    const isBegin = m.type === 'depart'; const isEinde = m.type === 'arrive';
    if (!isBegin && !isEinde && !(m.pijl || bordNodig(m))) continue;
    // Rotonde: het bord hangt óp de rotonde, net voor de uitrit die je neemt, en wijst naar rechts.
    const opRotonde = ROTONDE.has(m.type) && m.uit;
    const terug = isBegin ? 0 : ROTONDE.has(m.type) ? 50 : 30;
    const p = Math.max(0, m.pos - terug);
    let plek = turf.along(lijn, p, M).geometry.coordinates;
    if (opRotonde) {
      // Naast de rotonde aan de uitrit: wie rondrijdt ziet het bord voor zich, de pijl
      // wijst de uitrit in. Vanaf het punt waar de route de rotonde verlaat 12 m de
      // uitvalsweg op en 4 m naar links (het middeneiland/de hoek van de uitrit).
      const L = turf.length(lijn, M);
      const a = turf.along(lijn, Math.min(L, m.uitPos), M).geometry.coordinates;
      const b = turf.along(lijn, Math.min(L, m.uitPos + 15), M).geometry.coordinates;
      const weg = afstand(a, b) > 1 ? turf.bearing(a, b) : m.uitVoor;
      const vooruit = turf.destination(turf.point(m.uit), 0.012, weg, { units: 'kilometers' });
      plek = turf.destination(vooruit, 0.004, weg - 90, { units: 'kilometers' }).geometry.coordinates;
    }
    const richting = opRotonde ? m.uitVoor : isBegin ? m.voor ?? m.na : m.voor;
    uit.push({
      route_id: route.id, bestemming_id: route.bestemming_id, laag_id: route.laag_id,
      anker: opRotonde ? m.uit : m.loc, plek, richting: richting != null ? ((Math.round(richting) % 360) + 360) % 360 : null,
      pijl: isBegin ? 'rechtdoor' : opRotonde ? 'rechts' : pijlVan(m), afslag: ROTONDE.has(m.type) && !opRotonde ? m.exit || null : null,
      soort: isBegin ? 'start' : isEinde ? 'aankomst' : ROTONDE.has(m.type) ? 'rotonde' : 'afslag',
      pos: opRotonde ? m.uitPos : m.pos, controleren: !!m.controleren,
    });
  }
  return uit;
}

const rijSleutel = (r) => `${r.bestemming_id}|${r.pijl}|${r.afslag || ''}`;
const rijenGelijk = (a = [], b = []) => a.map(rijSleutel).join(',') === b.map(rijSleutel).join(',');
const sorteerRijen = (rijen) => [...rijen].sort((a, b) => PIJL_VOLGORDE.indexOf(a.pijl) - PIJL_VOLGORDE.indexOf(b.pijl));

// Kandidaten van alle routes samenvoegen: zelfde kruispunt en zelfde naderingsrichting
// = één punt. Routes die er rechtdoor passeren krijgen er ook hun paneel bij:
// routes die samen lopen hangen altijd samen onder elkaar.
export function clusters(kand, routes) {
  const groepen = [];
  for (const k of kand) {
    const g = groepen.find((x) => !x.leden.some((l) => l.route_id === k.route_id) && afstand(x.anker, k.anker) < 30 && hoekVerschil(x.richting, k.richting) < 50);
    if (g) g.leden.push(k); else groepen.push({ anker: k.anker, richting: k.richting, plek: k.plek, laag_id: k.laag_id, leden: [k] });
  }
  for (const g of groepen) {
    const rijen = [];
    const zet = (r) => { if (!rijen.some((x) => x.bestemming_id === r.bestemming_id)) rijen.push(r); };
    for (const k of g.leden) zet({ bestemming_id: k.bestemming_id, pijl: k.pijl, ...(k.afslag ? { afslag: k.afslag } : {}) });
    const inGroep = new Set(g.leden.map((k) => k.route_id));
    for (const r of routes) {
      if (inGroep.has(r.id) || !r.coords) continue;
      const h = routeHoeken({ type: 'LineString', coordinates: r.coords }, g.anker, 35);
      if (!h || h.afstand > 15 || hoekVerschil(h.inkomend, g.richting) > 50) continue;
      zet({ bestemming_id: r.bestemming_id, pijl: pijlUitHoek(norm(h.uitgaand - h.inkomend)) });
      inGroep.add(r.id);
    }
    g.rijen = sorteerRijen(rijen);
    g.route_ids = [...inGroep];
    g.controleren = g.leden.some((k) => k.controleren);
    g.soort = g.leden.find((k) => k.soort === 'rotonde')?.soort || g.leden[0].soort;
    // Volgorde voor de nummering: eerste route, afstand langs die route.
    const eerste = g.leden.reduce((a, b) => (routes.findIndex((r) => r.id === a.route_id) <= routes.findIndex((r) => r.id === b.route_id) ? a : b));
    g.volg = [routes.findIndex((r) => r.id === eerste.route_id), eerste.pos];
  }
  return groepen;
}

// Status van een bestaand bordpunt.
export function signStatus(it) {
  const a = it?.velden?.sign?.auto;
  if (!a || a.eigen) return 'eigen';
  const p = it.geometrie?.coordinates;
  if (a.plek && p && afstand(a.plek, p) > 1) return 'aangepast';
  if (!rijenGelijk(it.velden.sign.rijen || [], a.rijen || [])) return 'aangepast';
  return 'voorstel';
}

// Vergelijk het nieuwe voorstel met wat er al staat. Geeft een lijst acties terug.
export function plannen(groepen, items, ankers) {
  const bestaand = items.filter(isSign);
  const gebruikt = new Set();
  const acties = { nieuw: [], bijwerken: [], vervalt: [], leeg: [], genegeerd: 0, ankers: [] };
  const vindAnker = (a, r) => ankers.find((x) => afstand(x.anker, a) < 25 && hoekVerschil(x.richting, r) < 50);
  for (const g of groepen) {
    let m = bestaand.find((it) => !gebruikt.has(it.id) && it.velden.sign.auto?.anker && afstand(it.velden.sign.auto.anker, g.anker) < 30 && hoekVerschil(it.velden.sign.auto.richting, g.richting) < 50);
    if (!m) m = bestaand.find((it) => !gebruikt.has(it.id) && !it.velden.sign.auto?.anker && it.geometrie?.coordinates && afstand(it.geometrie.coordinates, g.plek) < 40 && hoekVerschil(it.velden.sign.richting, g.richting) < 50);
    const auto = { anker: g.anker, richting: g.richting, plek: g.plek, rijen: g.rijen, ...(g.controleren ? { controleren: true } : {}) };
    if (!m) {
      if (vindAnker(g.anker, g.richting)) { acties.genegeerd += 1; acties.ankers.push({ anker: g.anker, richting: g.richting }); continue; }
      acties.nieuw.push({ groep: g, auto });
      acties.ankers.push({ anker: g.anker, richting: g.richting });
      continue;
    }
    gebruikt.add(m.id);
    acties.ankers.push({ anker: g.anker, richting: g.richting });
    const s = m.velden.sign;
    const status = signStatus(m);
    if (status === 'voorstel') {
      if (!rijenGelijk(s.rijen, g.rijen) || afstand(s.auto.plek, g.plek) > 1) {
        acties.bijwerken.push({ id: m.id, geometrie: { type: 'Point', coordinates: g.plek }, sign: { ...s, richting: g.richting, rijen: g.rijen, auto } });
      }
      continue;
    }
    // Aangepast of eigen punt: jouw panelen blijven; alleen wat de tool vroeger
    // voorstelde en nu niet meer, gaat weg, en nieuwe bestemmingen komen erbij.
    const oud = new Set((s.auto?.rijen || []).map((r) => r.bestemming_id));
    const nieuw = new Set(g.rijen.map((r) => r.bestemming_id));
    let rijen = (s.rijen || []).filter((r) => !(oud.has(r.bestemming_id) && !nieuw.has(r.bestemming_id)));
    for (const r of g.rijen) if (!rijen.some((x) => x.bestemming_id === r.bestemming_id)) rijen.push(r);
    rijen = rijen.length !== (s.rijen || []).length || !rijenGelijk(rijen, s.rijen) ? rijen : s.rijen;
    const nAuto = { ...auto, plek: s.auto?.plek || null, ...(status === 'eigen' ? { eigen: true } : {}) };
    if (rijen !== s.rijen || !rijenGelijk(s.auto?.rijen, g.rijen)) acties.bijwerken.push({ id: m.id, sign: { ...s, rijen, auto: nAuto } });
  }
  for (const it of bestaand) {
    if (gebruikt.has(it.id) || !it.velden.sign.auto) continue;
    const s = it.velden.sign;
    const status = signStatus(it);
    if (status === 'voorstel') { acties.vervalt.push(it.id); continue; }
    const oud = new Set((s.auto.rijen || []).map((r) => r.bestemming_id));
    if (!oud.size) continue;
    const rijen = (s.rijen || []).filter((r) => !oud.has(r.bestemming_id));
    const sign = { ...s, rijen, auto: { ...s.auto, rijen: [], anker: null, ...(rijen.length ? {} : { leeg: true }) } };
    if (!rijen.length) acties.leeg.push({ id: it.id, sign }); else acties.bijwerken.push({ id: it.id, sign });
  }
  return acties;
}

// Routebeschrijving in gewone taal (voor de parkingkaart).
const MOD_TEKST = {
  'sharp right': 'scherp rechtsaf', right: 'rechtsaf', 'slight right': 'flauw rechtsaf', straight: 'rechtdoor',
  'slight left': 'flauw linksaf', left: 'linksaf', 'sharp left': 'scherp linksaf', uturn: 'keer om',
};
const rond = (m) => (m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(Math.round(m / 100) / 10).toString().replace('.', ',')} km`);
export function routebeschrijving(res, bestemmingNaam) {
  if (res.terugval) return [];
  const regels = [];
  let vorige = 0;
  for (const m of res.manoeuvres) {
    const weg = m.naam ? (m.ref && !m.naam.includes(m.ref) ? `${m.naam} (${m.ref})` : m.naam) : m.ref;
    const na = m.pos - vorige;
    const aanloop = na > 40 ? `Na ${rond(na)} ` : '';
    let t = null;
    if (m.type === 'depart') t = `Vertrek${weg ? ` via ${weg}` : ''}.`;
    else if (m.type === 'arrive') t = `${aanloop ? `${aanloop}bereik` : 'Bereik'} je ${bestemmingNaam || 'de bestemming'}${m.modifier === 'left' ? ' (links)' : m.modifier === 'right' ? ' (rechts)' : ''}.`;
    else if (ROTONDE.has(m.type)) t = `${aanloop}aan de rotonde de ${m.exit || '?'}e afslag${weg ? ` naar ${weg}` : ''}.`;
    else if (bordNodig(m)) {
      const d = MOD_TEKST[m.modifier] || 'verder';
      const ww = m.type === 'end of road' ? `aan het einde van de weg ${d}` : m.type === 'fork' ? `aan de splitsing ${d.replace('flauw ', '')}` : m.type === 'off ramp' ? `neem de afrit ${d.replace('flauw ', '')}` : m.type === 'on ramp' ? `neem de oprit ${d.replace('flauw ', '')}` : d;
      t = `${aanloop}${ww}${weg ? ` ${m.type === 'continue' ? 'op' : 'de'} ${weg}${m.type === 'continue' ? '' : ' in'}` : ''}.`;
    }
    if (!t) continue;
    regels.push(t.charAt(0).toUpperCase() + t.slice(1));
    vorige = m.pos;
  }
  return regels;
}
