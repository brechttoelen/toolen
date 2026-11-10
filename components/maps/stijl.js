'use client';

// Stijlen, standaardlagen en de omzetting van items naar kaartlagen.
import { isLichtmast, lichtVlekken } from './licht';
import { tekeningFeatures, trapFeatures, plaatser } from './tekening';
import { isKabelcam, kabelcamFeatures } from './kabelcam';


// Maatlijnen rond een item (CAD-stijl): breedte en diepte bij een element of
// rechthoek op schaal, elke zijde bij een vrij vlak of lijn.
function matenFeatures(it, g, basis) {
  const uit = { vormen: [], labels: [] };
  const lijn = (c, dun = false) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: { ...basis, vorm: 'lijn', streep: 'vol', wit_rand: false, patroon: '', dikte_m: 0, dikte: dun ? 0.6 : 0.9, kleur: '#1d1d1b', dekking: 1 } });
  const label = (c, tekst) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: { id: it.id, soort: 'langs', label: tekst, kleur: '#1d1d1b', tekstgrootte: 11, opMaat: true } });
  const p = it.parameters || {};
  if (g.type === 'Polygon' && p.midden && p.breedte > 0 && p.diepte > 0) {
    const B = Number(p.breedte); const D = Number(p.diepte);
    const T = plaatser(p.midden, Number(p.rot) || 0);
    const off = Math.max(0.8, Math.min(B, D) * 0.12); const tik = Math.max(0.25, off * 0.35);
    // Breedte onder, diepte rechts
    const yb = -D / 2 - off; const xr = B / 2 + off;
    uit.vormen.push(lijn([T([-B / 2, yb]), T([B / 2, yb])]));
    for (const x of [-B / 2, B / 2]) { uit.vormen.push(lijn([T([x, -D / 2 - tik * 0.5]), T([x, yb - tik])], true)); uit.vormen.push(lijn([T([x - tik, yb - tik]), T([x + tik, yb + tik])])); }
    uit.vormen.push(lijn([T([xr, -D / 2]), T([xr, D / 2])]));
    for (const y of [-D / 2, D / 2]) { uit.vormen.push(lijn([T([B / 2 + tik * 0.5, y]), T([xr + tik, y])], true)); uit.vormen.push(lijn([T([xr - tik, y - tik]), T([xr + tik, y + tik])])); }
    uit.labels.push(label([T([-B / 2, yb]), T([B / 2, yb])], `${getal(B, 2)} m`));
    uit.labels.push(label([T([xr, -D / 2]), T([xr, D / 2])], `${getal(D, 2)} m`));
    return uit;
  }
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'LineString' ? g.coordinates : null;
  if (!ring || ring.length < 2 || ring.length > 80) return uit;
  // Oriëntatie van het vlak: maatlijnen aan de buitenkant.
  let opp = 0;
  for (let i = 0; i < ring.length - 1; i++) opp += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const kant = g.type === 'Polygon' ? (opp > 0 ? 90 : -90) : -90;
  const off = g.type === 'Polygon' ? 1.2 : 0.8;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]; const b = ring[i + 1];
    const L = turf.distance(a, b, { units: 'meters' });
    if (L < 0.3) continue;
    const r = turf.bearing(a, b) + kant;
    const a2 = turf.destination(a, off, r, { units: 'meters' }).geometry.coordinates;
    const b2 = turf.destination(b, off, r, { units: 'meters' }).geometry.coordinates;
    uit.vormen.push(lijn([a2, b2]));
    uit.vormen.push(lijn([a, turf.destination(a, off * 1.3, r, { units: 'meters' }).geometry.coordinates], true));
    uit.vormen.push(lijn([b, turf.destination(b, off * 1.3, r, { units: 'meters' }).geometry.coordinates], true));
    uit.labels.push(label([a2, b2], `${getal(L, 2)} m`));
  }
  return uit;
}

// Naden tussen de stukken van een vlakvullend element.
function naadFeatures(it, mod, basis) {
  const p = it.parameters;
  const T = plaatser(p.midden, Number(p.rot) || 0);
  const B = mod.nx * mod.mb; const D = mod.ny * mod.md;
  const lijn = (a, b) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [T(a), T(b)] }, properties: { ...basis, vorm: 'lijn', streep: 'vol', wit_rand: false, patroon: '', dikte_m: 0, dikte: Math.max(0.5, (basis.dikte || 1) * 0.45) } });
  const uit = [];
  if (mod.nx * mod.ny > 4000) return uit;
  // Rijen (lange naden)
  for (let j = 1; j < mod.ny; j++) { const y = -D / 2 + j * mod.md; uit.push(lijn([-B / 2, y], [B / 2, y])); }
  // Voegen binnen elke rij, eventueel verspringend
  for (let j = 0; j < mod.ny; j++) {
    const y0 = -D / 2 + j * mod.md; const y1 = y0 + mod.md;
    const off = p.verspringend && j % 2 === 1 ? mod.mb / 2 : 0;
    for (let i = 1; i < mod.nx + (off ? 1 : 0); i++) { const x = -B / 2 + i * mod.mb - off; if (x > -B / 2 + 1e-6 && x < B / 2 - 1e-6) uit.push(lijn([x, y0], [x, y1])); }
  }
  return uit;
}
import { elementVeelhoek, lengte, oppervlakte, middelpunt, getal, evenwijdig, vloeiend, richtingBij, puntenLangs, rondHoeken, buig, boogPunten } from './geo';
import * as turf from '@turf/turf';
import { rennersbrugTekening } from './rennersbrug';
import { zetIcoonInKaart } from './kaarticonen';

export const STANDAARD_LAGEN = [
  { naam: 'Parcours', kleur: '#E11D48', stijl: { dikte: 5 } },
  { naam: 'Afsluitingen en hekken', kleur: '#D97706' },
  { naam: 'Hospitality', kleur: '#2563EB' },
  { naam: 'Teams en parking', kleur: '#16865C' },
  { naam: 'TV-productie', kleur: '#7C3AED' },
  { naam: 'Veiligheid en EHBO', kleur: '#0F766E' },
  { naam: 'Elektriciteit', kleur: '#5B21B6' },
  { naam: 'Werfzones', kleur: '#B91C1C', stijl: { vulpatroon: 'arcering', streep: 'streep' } },
];

export const STANDAARD_FASEN = ['Opbouw D-1', 'Wedstrijddag', 'Afbraak'];

import { PALET_HEX } from './kleuren';
import { isWand, wandFrames, zijLengtes, wandStukken, naarMeterLijn, isVrij } from './framewand';
import { isTrussBouw, trussStukken, trussKnopen, knoopRichting, trussTypeVoor } from './trussbouw';
import { isStellingBouw, stellingAfgeleid, stellingAnker, stellingMaten, delenVan as stellingDelen, soortVan as stellingSoort, VAK as STELLING_VAK, RICHTING as STELLING_RICHTING, RAND as STELLING_RAND, AANLOOP as STELLING_AANLOOP, OPSTAP as STELLING_OPSTAP, cameraPlek, CAMERA_SECTOR } from './stellingbouw';
import { isCameraStelling, camStipTekst, CAMERA_ZOOM, CAMERA_MIN } from './tvcamera';
// Losse TV-camera (tekening met een kijkvlak, zie camerabeeld.jsx).
const isLosseCamera = (el) => !!el?.eigenschappen?.tekening?.vlakken?.some((v) => v.zicht);
export const KLEUREN = PALET_HEX;

export const STREPEN = {
  vol: null,
  streep: [4, 2.5],
  stip: [0.2, 2.2],
  streeppunt: [5, 2, 0.5, 2],
};

const BASIS = {
  kleur: '#2563EB', dikte: 3, dikte_eenheid: 'px', streep: 'vol', dekking: 1, wit_rand: false,
  vulkleur: null, vuldekking: 0.2, vulpatroon: 'effen', tekstgrootte: 12,
};

// Elementen (Heras, Nadar, tenten …) hebben een vaste opmaak uit de bibliotheek:
// een item mag enkel kiezen wat getoond wordt, niet hoe het eruitziet.
const ELEMENT_ITEM_SLEUTELS = ['label', 'maten', 'opp', 'tekening_tekst', 'zone_m', 'afronden', 'tekst_langs', 'tekstgrootte', 'tekst_rot', 'vet', 'cursief', 'achtergrond'];
export function effectieveStijl(item, laag, element) {
  const eigen = element && item?.soort === 'element'
    ? Object.fromEntries(Object.entries(item?.stijl || {}).filter(([k]) => ELEMENT_ITEM_SLEUTELS.includes(k)))
    : (item?.stijl || {});
  const s = { ...BASIS, kleur: laag?.kleur || BASIS.kleur, ...(laag?.stijl || {}), ...(element?.stijl || {}), ...eigen };
  if (!s.vulkleur) s.vulkleur = s.kleur;
  return s;
}

// Vlakvullend element (houten vloer, rijplaten): hoeveel stukken in het vak.
// Aantal stukken op één recht stuk lijn: een klein restje (≤ 15%) telt niet als extra stuk.
export const segN = (L, e) => Math.max(1, Math.ceil(L / e - 0.15));

// Paal en net e.d.: elke paal is een knikpunt (en elk knikpunt een paal), zodat je elke paal
// kan vastnemen om het net daar van richting te laten veranderen. Rechte stukken langer dan één
// net krijgen tussenpunten; gebogen stukken blijven zoals ze zijn. Geeft null als er niets verandert.
// Paal en koord: vakken (stukken tussen twee knikpunten) zonder net, enkel een koord.
// parameters.koordAlles = de hele lijn paal en koord (geen net); anders enkel de vakken in parameters.koord.
export const koordVan = (it) => {
  if (it?.parameters?.koordAlles && it.geometrie?.type === 'LineString') return new Set(Array.from({ length: Math.max(0, it.geometrie.coordinates.length - 1) }, (_, k) => k));
  return new Set((it?.parameters?.koord || []).map(Number));
};
// Gele vlaggen op een paal of hekeinde (bv. de kop van een materiaalpost): parameters.vlaggen = [[lng, lat], …]
// (vastgeklikt op een knooppunt), vlagBegin / vlagEind voor de uiteinden; een punt-item: parameters.vlag.
export function vlagPunten(it) {
  const g = it?.geometrie; if (!g) return [];
  if (g.type === 'Point') return it.parameters?.vlag ? [g.coordinates] : [];
  const c = g.type === 'LineString' ? g.coordinates : g.coordinates[0]; const p = it.parameters || {}; const uit = [];
  if (p.vlagBegin) uit.push(c[0]); if (p.vlagEind && g.type === 'LineString') uit.push(c[c.length - 1]);
  for (const q of p.vlaggen || []) {
    // Volgt het knooppunt als de lijn verschoven of bijgewerkt is (binnen 3 m), anders de bewaarde plek.
    let best = null; let bd = Infinity; for (const v of c) { const d = turf.distance(v, q, { units: 'meters' }); if (d < bd) { bd = d; best = v; } }
    uit.push(bd < 3 ? best : q);
  }
  return uit;
}
export const aantalVlaggen = (it) => vlagPunten(it).length;
function geleVlagFeatures(it, basis) {
  const uit = [];
  for (const q of vlagPunten(it)) {
    // Vaantje van 0,9 × 0,6 m aan de paal (naar het oosten), met een kleine paal-stip.
    const m = (dx, dy) => [q[0] + dx / (111320 * Math.cos((q[1] * Math.PI) / 180)), q[1] + dy / 110574];
    uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[m(0, 0.15), m(0.9, 0.45), m(0, 0.75), m(0, 0.15)]] }, properties: { ...basis, vorm: 'vlak', soort: 'vlag', vulkleur: '#FACC15', vuldekking: 1, vulpatroon: 'effen', kleur: '#1F2937', dekking: 1, dikte: 1.2, dikte_m: 0, streep: 'vol', wit_rand: false, patroon: '' } });
    uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [m(0, -0.05), m(0, 0.8)] }, properties: { ...basis, vorm: 'lijn', kleur: '#1F2937', dekking: 1, dikte: 2, dikte_m: 0, streep: 'vol', wit_rand: false, patroon: '' } });
  }
  return uit;
}
// Herschik de koord-vakken na een wijziging van de knikpunten: `oudNaarNieuw(k)` geeft de nieuwe vakken van oud vak k.
export function herschikKoord(it, oudNaarNieuw) {
  const ko = it?.parameters?.koord; if (!ko?.length) return it?.parameters;
  const n = [...new Set(ko.flatMap((k) => oudNaarNieuw(Number(k)) || []))].sort((a, b) => a - b);
  return { ...it.parameters, koord: n.length ? n : undefined };
}
// Meters en vakken koord van een lijn (voor de stuklijst).
export function koordMaat(it, el) {
  const ko = koordVan(it); if (!ko.size || it.geometrie?.type !== 'LineString') return { vakken: 0, meter: 0 };
  const c = it.geometrie.coordinates; const e = Number(el?.eenheid_m) || 1; let vakken = 0; let meter = 0;
  for (const k of ko) { if (k < 0 || k >= c.length - 1) continue; const L = turf.distance(c[k], c[k + 1], { units: 'meters' }); meter += L; vakken += paalPerPunt(el) ? 1 : segN(L, e); }
  return { vakken, meter };
}
export const paalPerPunt = (el) => el?.tekenwijze === 'lijn' && !!el.eigenschappen?.paal_naam && Number(el.eenheid_m) > 0;
export function paalVerdeling(g, el, bogen = null) {
  if (g?.type !== 'LineString' || !paalPerPunt(el)) return null;
  const e = Number(el.eenheid_m);
  const c = g.coordinates; const uit = [c[0]]; const nb = {}; const vakken = [];
  let veranderd = false;
  for (let k = 0; k < c.length - 1; k++) {
    const van = uit.length - 1;
    const h = Number(bogen?.[k]) || 0;
    if (h) { nb[uit.length - 1] = h; uit.push(c[k + 1]); vakken.push([van]); continue; }
    const L = turf.distance(c[k], c[k + 1], { units: 'meters' });
    const n = L < 0.01 ? 1 : segN(L, e);
    for (let i = 1; i < n; i++) { const t = i / n; uit.push([c[k][0] + (c[k + 1][0] - c[k][0]) * t, c[k][1] + (c[k + 1][1] - c[k][1]) * t]); veranderd = true; }
    uit.push(c[k + 1]);
    vakken.push(Array.from({ length: n }, (_, i) => van + i));
  }
  if (!veranderd) return null;
  return { geometrie: { type: 'LineString', coordinates: uit }, bogen: Object.keys(nb).length ? nb : null, vakken };
}

// ---------- Rijplaten (vlakvullend met overlap, in een vak of langs een lijn) ----------
// Overlap op de lange en op de korte zijde van een plaat (rijplaten schuiven over elkaar).
// Item: overlap_lang / overlap_kort (oud: overlap = beide); element: overlap_lang_m / overlap_kort_m (oud: overlap_m).
export function overlapKanten(item, el) {
  const p = item?.parameters || {}; const e = el?.eigenschappen || {};
  const g = (v) => Math.max(0, Number(v) || 0);
  const basis = p.overlap ?? null;
  return {
    lang: g(p.overlap_lang ?? basis ?? e.overlap_lang_m ?? e.overlap_m ?? 0),
    kort: g(p.overlap_kort ?? basis ?? e.overlap_kort_m ?? e.overlap_m ?? 0),
  };
}
// Overlap tussen twee platen die elkaar raken langs een rand van lengte `rand` (de andere maat: `ander`).
export const overlapLangs = (ok, rand, ander) => (rand >= ander ? ok.lang : ok.kort);
export const overlapVan = (item, el) => { const ok = overlapKanten(item, el); return Math.max(ok.lang, ok.kort); };
export const isRijpad = (item, el) => item?.soort === 'element' && !!el?.eigenschappen?.module && item.geometrie?.type === 'LineString';
// Maten van een rijpad: a = plaatmaat langs de lijn, w = dwars erop.
export function padMaat(item, el) {
  const p = item.parameters || {};
  const lang = Number(el.breedte_m) || 1; const kort = Number(el.diepte_m) || 1;
  const leg = p.leg || 'dwars';
  const [a, w] = leg === 'dwars' ? [kort, lang] : [lang, kort];
  const ok = overlapKanten(item, el);
  // Achter elkaar langs de lijn raken de platen elkaar met hun zijde w; naast elkaar met hun zijde a.
  const o = overlapLangs(ok, w, a); const ob = overlapLangs(ok, a, w);
  const rijen = leg === 'sporen' ? 2 : Math.max(1, Math.round(Number(p.rijen) || 1));
  const tussen = Math.max(0, Number(p.tussen ?? 1.2));
  const W = leg === 'sporen' ? 2 * w + tussen : rijen * w - (rijen - 1) * ob;
  // Middens van de rijen dwars op de lijn.
  const banen = leg === 'sporen' ? [-(tussen + w) / 2, (tussen + w) / 2] : Array.from({ length: rijen }, (_, r) => -W / 2 + w / 2 + r * (w - ob));
  return { a, w, o, ob, leg, rijen, tussen, W, banen };
}
const MAX_PLATEN = 4000;

// ---------- Afval: fracties per container ----------
// Eén element per maat; de fractie kies je per geplaatst stuk (dekselkleur + letter).
// In de tekening dragen vlakken/teksten met `fr: i` de kleur/letter van vak i.
export const FRACTIES = [
  // Vlaamse kleuren zoals bezoekers ze kennen: PMD blauw, rest grijs, GFT groen, papier geel (zoals in Brussel).
  { k: 'rest', naam: 'Restafval', kleur: '#5B6270', letter: 'R' },
  { k: 'pmd', naam: 'PMD', kleur: '#1F5FB4', letter: 'P' },
  { k: 'papier', naam: 'Papier en karton', kleur: '#F2C318', letter: 'K', donker: true },
  { k: 'glas', naam: 'Glas', kleur: '#9ED3D6', letter: 'G', donker: true },
  { k: 'gft', naam: 'GFT / etensresten', kleur: '#2E8B3E', letter: 'F' },
  { k: 'vertrouwelijk', naam: 'Vertrouwelijk papier', kleur: '#7C3AED', letter: 'V' },
  { k: 'hout', naam: 'Hout', kleur: '#8A6D3B', letter: 'H' },
  { k: 'bouw', naam: 'Bouw- en sloopafval', kleur: '#C2410C', letter: 'B' },
  { k: 'groen', naam: 'Groenafval', kleur: '#8DB84A', letter: 'Gr', donker: true },
  { k: 'schroot', naam: 'Schroot / metaal', kleur: '#1d1d1b', letter: 'M' },
  { k: 'folie', naam: 'Folie / kunststof', kleur: '#D9DEE4', letter: 'Fo', donker: true },
];
export const fractieVan = (k) => FRACTIES.find((f) => f.k === k) || FRACTIES[0];
export const heeftFracties = (el) => !!el?.eigenschappen?.fracties;
export const toegelatenFracties = (el) => (Array.isArray(el?.eigenschappen?.fracties) ? FRACTIES.filter((f) => el.eigenschappen.fracties.includes(f.k)) : FRACTIES);
// Fractie per vak: een afvaleiland heeft vaste vakken, een rij (naast elkaar) één vak per stuk.
export function fractiesVan(item, el) {
  const e = el?.eigenschappen || {};
  const st = Array.isArray(e.vakken_standaard) ? e.vakken_standaard : [];
  const n = st.length || Math.max(1, Math.round(Number(item?.parameters?.aantal) || 1));
  return Array.from({ length: n }, (_, i) => item?.velden?.fracties?.[i] || st[i] || e.fractie_standaard || 'rest');
}
// Tekening van één geplaatst stuk aanpassen: fractiekleuren, montage (bv. op standaard of
// met tentklem: delen met `alleen`), draaibare kop (delen met `draai` draaien rond tekening.kop
// over parameters.kop_rot graden, met de klok mee) en het stapelgetal (tekst met `stapel`).
export function pasTekeningAan(tek, item, el, i = null) {
  const e = el?.eigenschappen || {}; const p = item?.parameters || {}; const v = item?.velden || {};
  // Samengesteld element dat zijn tekening uit de instellingen opbouwt (bv. rennersbrug).
  if (e.generator === 'rennersbrug') tek = rennersbrugTekening(p);
  // Dubbele poort: twee vleugels tegen elkaar, scharnieren buiten, wielen in het midden.
  if (e.inzet === 'poort' && p.dubbel) tek = dubbelePoort(tek);
  if (!tek) return tek;
  let t = heeftFracties(el) ? metFracties(tek, i == null ? fractiesVan(item, el) : [fractiesVan(item, el)[i]]) : tek;
  const montage = v.montage || e.montages?.[0]?.[0] || null;
  const rijen = rijenVan(item, el);
  const kop = e.kop_draaibaar ? Number(p.kop_rot) || 0 : 0;
  const pv = t.kop || [0, 0];
  const r = (kop * Math.PI) / 180; const c = Math.cos(r); const s = Math.sin(r);
  const draai = ([x, y]) => { const dx = x - pv[0]; const dy = y - pv[1]; return [pv[0] + dx * c + dy * s, pv[1] - dx * s + dy * c]; };
  const ok = (x) => !x.alleen || x.alleen === montage;
  return {
    ...t,
    vlakken: (t.vlakken || []).filter(ok).map((x) => (x.draai && kop ? { ...x, r: x.r.map((ring) => ring.map(draai)) } : x)),
    lijnen: (t.lijnen || []).filter(ok).map((x) => (x.draai && kop ? { ...x, c: x.c.map(draai) } : x)),
    teksten: (t.teksten || []).filter(ok).filter((x) => !x.stapel || rijen > 1).map((x) => {
      let y = x.stapel ? { ...x, t: `×${rijen}` } : x;
      if (x.draai && kop) y = { ...y, p: draai(x.p) };
      return y;
    }),
  };
}
// Twee vleugels van een poort naast elkaar: de tekening (één vleugel, scharnier links) links,
// en gespiegeld rechts. Breedte verdubbelt.
const dubbelCache = new WeakMap();
export function dubbelePoort(tek) {
  if (!tek) return tek;
  if (dubbelCache.has(tek)) return dubbelCache.get(tek);
  const b = Number(tek.b) || 1; const s = b / 2;
  const links = ([x, y]) => [x - s, y]; const rechts = ([x, y]) => [-x + s, y];
  const beide = (lijst, f) => (lijst || []).flatMap((x) => [{ ...x, ...f(x, links) }, { ...x, ...f(x, rechts) }]);
  const uit = {
    ...tek, b: b * 2,
    vlakken: beide(tek.vlakken, (v, T) => ({ r: v.r.map((ring) => ring.map(T)) })),
    lijnen: beide(tek.lijnen, (l, T) => ({ c: l.c.map(T) })),
    teksten: beide(tek.teksten, (t, T) => ({ p: T(t.p) })),
  };
  dubbelCache.set(tek, uit);
  return uit;
}
// Stapelbaar (LCD's boven elkaar, LED-modules in rijen): hoeveel hoog.
export const rijenVan =(item, el) => (el?.eigenschappen?.stapelbaar ? Math.max(1, Math.round(Number(item?.parameters?.rijen) || Number(el.eigenschappen.rijen_standaard) || 1)) : 1);

export function metFracties(tekening, keys) {
  if (!tekening) return tekening;
  const f = (i) => fractieVan(keys[Math.min(keys.length - 1, Number(i) || 0)]);
  return {
    ...tekening,
    vlakken: (tekening.vlakken || []).map((v) => (v.fr != null ? { ...v, vul: f(v.fr).kleur } : v)),
    teksten: (tekening.teksten || []).map((t) => (t.fr != null ? { ...t, t: f(t.fr).letter, k: f(t.fr).donker ? '#1d1d1b' : '#ffffff' } : t)),
  };
}
// Kleine verspringing (bv. vlonders): elke tweede rij schuift een stukje op, platen worden niet gezaagd.
// 0 of leeg = klassiek halfsteens (halve platen aan de rand).
export const verspringVan = (item, el) => Math.max(0, Number(item?.parameters?.verspring ?? el?.eigenschappen?.verspring_m ?? 0) || 0);
// Vloerpad rechttrekken: elke knik wordt een haakse hoek (richting van het eerste stuk blijft).
export function haaks(g) {
  const c = g?.coordinates;
  if (!c || c.length < 3) return g;
  const lat0 = c[0][1]; const mLat = 110574; const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const L = c.map(([x, y]) => [(x - c[0][0]) * mLng, (y - c[0][1]) * mLat]);
  const uit = [[0, 0]];
  let basis = null;
  for (let k = 0; k < L.length - 1; k++) {
    const dx = L[k + 1][0] - L[k][0]; const dy = L[k + 1][1] - L[k][1]; const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    let a = Math.atan2(dy, dx);
    if (basis == null) basis = a;
    else a = basis + Math.round((a - basis) / (Math.PI / 2)) * (Math.PI / 2);
    const v = uit[uit.length - 1];
    uit.push([v[0] + Math.cos(a) * len, v[1] + Math.sin(a) * len]);
  }
  return { type: 'LineString', coordinates: uit.map(([x, y]) => [c[0][0] + x / mLng, c[0][1] + y / mLat]) };
}
// Elke plaat als ring (lengte/breedtegraad). Overlappende platen liggen over elkaar.
export function platen(item, el) {
  const p = item.parameters || {};
  const o = overlapVan(item, el);
  const ringen = [];
  if (isRijpad(item, el)) {
    const c = item.geometrie.coordinates;
    if (c.length < 2) return { ringen, stuks: 0 };
    const { a, w, W, banen, o: oPad } = padMaat(item, el);
    const lat0 = c[0][1]; const mLat = 110574; const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const L = c.map(([x, y]) => [(x - c[0][0]) * mLng, (y - c[0][1]) * mLat]);
    const W_ = (q) => [c[0][0] + q[0] / mLng, c[0][1] + q[1] / mLat];
    const segs = [];
    const stukken = [];
    let halve = 0;
    for (let k = 0; k < L.length - 1; k++) {
      const dx = L[k + 1][0] - L[k][0]; const dy = L[k + 1][1] - L[k][1]; const len = Math.hypot(dx, dy);
      if (len > 0.01) segs.push({ A: L[k], u: [dx / len, dy / len], len });
    }
    const hoek = (s1, s2) => (!s1 || !s2 ? 0 : Math.acos(Math.max(-1, Math.min(1, s1.u[0] * s2.u[0] + s1.u[1] * s2.u[1]))));
    // Rijplaten: in een bocht elk stuk iets doortrekken zodat de buitenkant bedekt blijft (platen schuiven over elkaar).
    // Vloeren (strak): haakse hoek. Het inkomende stuk loopt door tot de buitenkant en vult het hoekvak,
    // het volgende stuk begint pas daarna. Niets ligt over elkaar.
    const strak = !!el.eigenschappen?.strak;
    const ext = (s1, s2) => { const t = hoek(s1, s2); return t < 0.09 ? 0 : (W / 2) * Math.min(1.5, Math.tan(t / 2)); };
    segs.forEach((sg, k) => {
      const t0 = hoek(segs[k - 1], sg); const t1 = hoek(sg, segs[k + 1]);
      // Betonplaten kunnen niet over elkaar schuiven: in een bocht een haakse hoek zoals bij vloeren.
      const haaks = strak || el.eigenschappen?.materiaal === 'beton';
      const e0 = haaks ? (t0 < 0.09 ? 0 : -W / 2) : ext(segs[k - 1], sg);
      const e1 = haaks ? (t1 < 0.09 ? 0 : W / 2) : ext(sg, segs[k + 1]);
      const tot = sg.len + e0 + e1;
      const stap = Math.max(0.05, a - oPad);
      const n = Math.max(1, Math.ceil((tot - oPad) / stap - 0.03));
      const nrm = [-sg.u[1], sg.u[0]];
      const pt = (s, t) => W_([sg.A[0] + sg.u[0] * s + nrm[0] * t, sg.A[1] + sg.u[1] * s + nrm[1] * t]);
      // In verband (bv. Eurodal-betonplaten): elke tweede rij dwars over het pad schuift
      // zijwaarts op. Verspringing 0 = een halve plaat, met halve platen aan beide randen
      // (de zijkant van het pad blijft recht); anders steekt die rij opzij uit.
      const verband = (item.parameters?.verspringend ?? el.eigenschappen?.verspringend_standaard) && !strak && banen.length > 1;
      const vs = verband ? verspringVan(item, el) : 0;
      for (let i = 0; i < n && ringen.length < MAX_PLATEN; i++) {
        const s0 = -e0 + i * stap; const s1 = s0 + a;
        const oneven = verband && i % 2 === 1;
        if (oneven && !(vs > 0)) {
          for (let r = 0; r <= banen.length; r++) {
            const t0 = Math.max(-W / 2, -W / 2 - w / 2 + r * w); const t1 = Math.min(W / 2, -W / 2 + w / 2 + r * w);
            if (t1 - t0 < 0.05) continue;
            if (t1 - t0 < w - 0.05) halve += 1;
            ringen.push([pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1), pt(s0, t0)]);
          }
          continue;
        }
        const off = oneven ? vs : 0;
        for (const b of banen) {
          const t0 = b - w / 2 + off; const t1 = b + w / 2 + off; ringen.push([pt(s0, t0), pt(s1, t0), pt(s1, t1), pt(s0, t1), pt(s0, t0)]);
          // Elementen met een eigen tekening (tenten, stellingvloer) ook langs een getekende lijn.
          if (el.eigenschappen?.tekening) {
            const hoekGr = (Math.atan2(sg.u[1], sg.u[0]) * 180) / Math.PI;
            const dw = (item.parameters?.leg || 'dwars') === 'dwars';
            stukken.push({ midden: pt((s0 + s1) / 2, (t0 + t1) / 2), rot: -hoekGr + (dw ? 90 : 0), breedte: dw ? w : a, diepte: dw ? a : w });
          }
        }
      }
    });
    return { ringen, stuks: ringen.length, halve, stukken };
  }
  const mod = modules(item, el);
  if (!mod || mod.rij || !p.midden) return { ringen, stuks: mod?.stuks || 0 };
  const T = plaatser(p.midden, Number(p.rot) || 0);
  const B = Number(p.breedte); const D = Number(p.diepte);
  if (mod.banen) {
    // Per vak van 2,07 in de lengte; brede banen 2 dwarse elementen, middenbaan 1 in de lengte.
    // u = langs de lengte (pijl), v = dwars. Niet gedraaid: lengte langs x; kwartslag: langs y.
    const st2 = [];
    const L = mod.r90 ? D : B; const W = mod.r90 ? B : D;
    const P = (u, v) => (mod.r90 ? T([v, u]) : T([u, v]));
    const r0 = (Number(p.rot) || 0) + (mod.r90 ? 0 : 90);
    let v = -W / 2;
    for (const b of mod.banen) {
      const w = b * mod.half;
      for (let i = 0; i < mod.nLang; i++) {
        const u0 = -L / 2 + i * mod.vak;
        const delen = b === 2 ? [[u0, u0 + mod.vak / 2], [u0 + mod.vak / 2, u0 + mod.vak]] : [[u0, u0 + mod.vak]];
        for (const [a, c] of delen) {
          ringen.push([P(a, v), P(c, v), P(c, v + w), P(a, v + w), P(a, v)]);
          if (el.eigenschappen?.tekening) st2.push({ midden: P((a + c) / 2, v + w / 2), rot: r0, breedte: w, diepte: c - a });
        }
      }
      v += w;
    }
    // Eén grote pijl per buitenbaan (links en rechts) in de rij-/looprichting.
    const pijlen = [];
    const bandMid = []; { let vv = -W / 2; for (const b of mod.banen) { bandMid.push(vv + (b * mod.half) / 2); vv += b * mod.half; } }
    const kies = bandMid.length > 1 ? [bandMid[0], bandMid[bandMid.length - 1]] : bandMid;
    const u0 = -L / 2 + Math.min(1, L * 0.12); const u1 = L / 2 - Math.min(1, L * 0.12); const kop = Math.min(0.8, (u1 - u0) * 0.25);
    for (const vm of kies) {
      pijlen.push([P(u0, vm), P(u1, vm)]);
      pijlen.push([P(u1 - kop, vm - kop * 0.7), P(u1, vm), P(u1 - kop, vm + kop * 0.7)]);
    }
    return { ringen, stuks: ringen.length, stukken: st2, pijlen };
  }
  const sx = mod.mb - (mod.ox ?? o); const sy = mod.md - (mod.oy ?? o);
  const klein = p.verspringend && !el.eigenschappen?.strak ? verspringVan(item, el) : 0;
  // Per plaat ook het midden en de maat, voor modules met een eigen tekening (bv. stellingvakken).
  const stukken = [];
  const rot = (Number(p.rot) || 0) + (Number(p.module_rot) === 90 ? 90 : 0);
  const stuk = (x0, y0, x1, y1, i, j) => { if (el.eigenschappen?.tekening) stukken.push({ midden: T([(x0 + x1) / 2, (y0 + y1) / 2]), rot, breedte: Number(p.module_rot) === 90 ? y1 - y0 : x1 - x0, diepte: Number(p.module_rot) === 90 ? x1 - x0 : y1 - y0, vak: `${i},${j}` }); };
  for (let j = 0; j < mod.ny; j++) {
    const y0 = -D / 2 + j * sy; const y1 = Math.min(D / 2, y0 + mod.md);
    if (klein > 0) {
      const off = j % 2 === 1 ? klein : 0;
      for (let i = 0; i < mod.nx && ringen.length < MAX_PLATEN; i++) {
        const x0 = -B / 2 + i * sx + off; const x1 = x0 + mod.mb;
        ringen.push([T([x0, y0]), T([x1, y0]), T([x1, y1]), T([x0, y1]), T([x0, y0])]); stuk(x0, y0, x1, y1, i, j);
      }
      continue;
    }
    const off = p.verspringend && !el.eigenschappen?.strak && j % 2 === 1 ? sx / 2 : 0;
    for (let i = 0; i < mod.nx + (off ? 1 : 0) && ringen.length < MAX_PLATEN; i++) {
      const x0 = Math.max(-B / 2, -B / 2 + i * sx - off); const x1 = Math.min(B / 2, -B / 2 + i * sx - off + mod.mb);
      if (x1 - x0 < 0.05) continue;
      ringen.push([T([x0, y0]), T([x1, y0]), T([x1, y1]), T([x0, y1]), T([x0, y0])]); stuk(x0, y0, x1, y1, i, j);
    }
  }
  return { ringen, stuks: mod.stuks, stukken };
}

// Maat van één module in het vak: gedraaid (module_rot) en, bij een hellingbaan, in bovenaanzicht
// korter naargelang de hellingshoek. Een hellingelement ligt dwars: de pijl (omhoog) loopt langs
// de 1,04 m (diepte); op 15° beslaat het nog 1,00 m op de grond.
// De hoek volgt uit het hoogteverschil en de lengte van de helling in bovenaanzicht.
export function hellingVan(p, el) {
  if (!el?.eigenschappen?.helling) return 0;
  const h = Number(p?.hoogte) || 0;
  const L = Number(p?.module_rot) === 90 ? Number(p?.breedte) : Number(p?.diepte); // langs de lengte (pijl) van het vak
  if (h > 0 && L > 0) return Math.min(45, (Math.atan(h / L) * 180) / Math.PI);
  return Math.max(0, Math.min(45, Number(p?.helling) || 0));
}
export function moduleMaat(element, p = {}) {
  const mb = Number(element.breedte_m) || 1; const md = Number(element.diepte_m) || 1;
  if (inBanen(element)) {
    // Stellingelementen die dwars liggen (helling, trap) zoals bij de stellingbouwer: in de lengte
    // vakken van 2,07 m (bij een helling in bovenaanzicht korter naargelang de hoek), in de breedte
    // per 1,04 m. Standaard loopt de lengte (pijl) langs y, zoals het element zelf; kwartslag: langs x.
    const h = hellingVan(p, element);
    const vak = 2 * md * Math.cos((h * Math.PI) / 180);
    return Number(p.module_rot) === 90 ? [vak, md] : [md, vak];
  }
  return Number(p.module_rot) === 90 ? [md, mb] : [mb, md];
}
// Banen van een hellingbaan in de breedte: zoveel mogelijk banen van 2,07 m met dwarse
// elementen, bij een oneven aantal halve breedtes één baan van 1,04 m in het midden (in de lengte).
export const inBanen = (el) => !!(el?.eigenschappen?.helling || el?.eigenschappen?.banen);
export function hellingBanen(nHalf) {
  const n2 = Math.floor(nHalf / 2); const mid = nHalf % 2;
  const links = Math.ceil(n2 / 2); const rechts = n2 - links;
  return [...Array(links).fill(2), ...(mid ? [1] : []), ...Array(rechts).fill(2)];
}
export function modules(item, element) {
  const p = item.parameters || {};
  // Rij van hetzelfde element naast elkaar (bv. 3 toiletcabines): telt als zoveel stuks.
  if (!element?.eigenschappen?.module && Number(p.aantal) > 1 && element?.tekenwijze === 'schaal') {
    const nx = Math.round(Number(p.aantal));
    // tussen = vrije ruimte (m) tussen twee stukken in de rij.
    const tussen = Math.max(0, Number(p.tussen) || 0);
    return { mb: ((Number(p.breedte) || nx * (Number(element.breedte_m) || 1)) - (nx - 1) * tussen) / nx, md: Number(p.diepte) || Number(element.diepte_m) || 1, nx, ny: 1, stuks: nx, rij: true, tussen };
  }
  if (!element?.eigenschappen?.module || !(p.breedte > 0) || !(p.diepte > 0)) return null;
  const [mb, md] = moduleMaat(element, p);
  const ok = overlapKanten(item, element);
  // Naast elkaar in x raken de platen met hun zijde md, in y met hun zijde mb.
  const ox = overlapLangs(ok, md, mb); const oy = overlapLangs(ok, mb, md); const o = Math.max(ox, oy);
  const nx = Math.max(1, Math.round((p.breedte - ox) / Math.max(0.05, mb - ox))); const ny = Math.max(1, Math.round((p.diepte - oy) / Math.max(0.05, md - oy)));
  if (inBanen(element)) {
    const r90 = Number(p.module_rot) !== 90; // true = lengte langs y
    const nLang = r90 ? ny : nx; const nHalf = r90 ? nx : ny;
    const banen = hellingBanen(nHalf);
    return { mb, md, nx, ny, o: 0, banen, r90, nLang, nHalf, vak: r90 ? md : mb, half: r90 ? mb : md, stuks: banen.reduce((t, b) => t + (b === 2 ? 2 * nLang : nLang), 0) };
  }
  const extra = p.verspringend && !element.eigenschappen?.strak && !(verspringVan(item, element) > 0) ? Math.floor(ny / 2) : 0;
  // Elke verschoven rij: aan beide kanten een halve plaat (rechte rand).
  return { mb, md, nx, ny, o, ox, oy, stuks: nx * ny + extra, halve: 2 * extra };
}

// Wat er bij een item als meting of telling hoort (label, pop-up, stuklijst).
export function maten(item, element) {
  const g = item.parameters?.bogen ? buig(item.geometrie, item.parameters.bogen) : item.geometrie;
  const uit = {};
  if (g?.type === 'LineString') {
    uit.lengte = lengte(g);
    if (element?.tekenwijze === 'lijn' && element.eenheid_m > 0) {
      const e = Number(element.eenheid_m);
      if (element.eigenschappen?.tekening || (element.eigenschappen?.doek && element.eigenschappen.doek !== 'geen')) {
        // Zoals getekend: per recht stuk een heel aantal stukken.
        uit.stuks = Math.max(0, nadenVan(item.geometrie, element, item.parameters?.bogen, item.parameters?.openingen).length - 1);
      } else uit.stuks = Math.ceil(uit.lengte / e - 1e-6);
      if (Number(item.stijl?.dubbel) > 0) uit.stuks *= 2;
    }
    if (element?.eigenschappen?.fietsen_per_stuk > 0 && uit.stuks != null) uit.fietsen = uit.stuks * Number(element.eigenschappen.fietsen_per_stuk);
    if (element?.eigenschappen?.stapelbaar && uit.stuks != null) { const rj = rijenVan(item, element); if (rj > 1) { uit.stuks *= rj; uit.rijen = rj; } }
    if (isRijpad(item, element)) {
      const pl = platen(item, element);
      uit.stuks = pl.stuks;
      if (pl.halve) uit.halve = pl.halve;
      uit.breedte_pad = padMaat(item, element).W;
    }
  }
  if (g?.type === 'Polygon') {
    uit.oppervlakte = oppervlakte(g);
    uit.omtrek = lengte(g);
    if (item.parameters?.breedte && item.parameters?.diepte) {
      uit.breedte = item.parameters.breedte;
      uit.diepte = item.parameters.diepte;
    }
    if (item.parameters?.straal && item.soort === 'cirkel') uit.straal = item.parameters.straal;
    const mod = modules(item, element);
    if (mod && mod.stuks > 1) { uit.stuks = mod.stuks; uit.raster = `${mod.nx} × ${mod.ny}`; if (mod.halve) uit.halve = mod.halve; }
    if (element?.eigenschappen?.stapelbaar) { const rj = rijenVan(item, element); if (rj > 1) { uit.stuks = (uit.stuks ?? 1) * rj; uit.rijen = rj; } }
    const dichtheid = Number(item.velden?.dichtheid);
    if (dichtheid > 0) uit.capaciteit = Math.floor(uit.oppervlakte * dichtheid);
  }
  return uit;
}

export function matenTekst(m) {
  const d = [];
  if (m.breedte && m.diepte) d.push(`${getal(m.breedte)} × ${getal(m.diepte)} m`);
  else if (m.straal) d.push(`r ${getal(m.straal)} m`);
  if (m.lengte != null) d.push(`${getal(m.lengte)} m`);
  if (m.raster) d.push(`${m.raster} stukken`);
  if (m.stuks != null) d.push(`${m.stuks} st.`);
  if (m.fietsen != null) d.push(`${m.fietsen.toLocaleString('nl-BE')} fietsen`);
  if (m.oppervlakte != null && !m.breedte) d.push(`${getal(m.oppervlakte, 0)} m²`);
  if (m.capaciteit != null) d.push(`${m.capaciteit.toLocaleString('nl-BE')} p`);
  return d.join(' · ');
}

// Vulpatronen: arcering/raster in de kleur van het item; texturen in vaste kleuren.
export const VULLINGEN = [
  ['effen', 'Effen'], ['arcering', 'Arcering'], ['raster', 'Raster'], ['geen', 'Geen'],
  ['trap', 'Trap (treden + pijl)'], ['hout', 'Houten vloer'], ['gras', 'Gras'], ['asfalt', 'Asfalt'], ['kasseien', 'Kasseien'], ['zand', 'Zand'],
];
const TEXTUREN = { hout: ['#C08A5A', '#8B5A2B'], gras: ['#6FA35A', '#3F7A34'], asfalt: ['#6E7074', '#4B4D51'], kasseien: ['#9A958C', '#5F5B55'], zand: ['#E6D3A3', '#C9B07A'] };
export const TEXTUUR_KLEUR = Object.fromEntries(Object.entries(TEXTUREN).map(([k, v]) => [k, v[0]]));

function patroonNaam(s) {
  const k = String(s.kleur).replace('#', '');
  if (s.vulpatroon === 'arcering') return `arc-${k}`;
  if (s.vulpatroon === 'raster') return `ras-${k}`;
  if (TEXTUREN[s.vulpatroon]) return `tex-${s.vulpatroon}`;
  return '';
}

// Items → GeoJSON: vormen (vlakken, lijnen, punten) en symbolen (labels, pijlpunten,
// iconen, maatlijnteksten, patroonsymbolen). Ook de PDF tekent hieruit.
// ---------- Toebehoren van hekken (klemmen, schoren, wielen) ----------
// Hoe een toebehoren op de kaart staat en geteld wordt.
export const TB_SOORTEN = {
  klem: { naam: 'Op de naad (klem)', uitleg: 'op elke naad tussen twee stukken' },
  schoor: { naam: 'Opzij (schoor)', uitleg: 'schuin naar achter, links of rechts' },
  driehoek: { naam: 'Steundriehoek (2 hekken)', uitleg: 'twee hekken in een driehoek tegen de lijn' },
  wiel: { naam: 'Rond (wiel)', uitleg: 'rondje op de voet' },
  blok: { naam: 'Blok (gewicht, zandzak)', uitleg: 'blokje naast de voet' },
  vlag: { naam: 'Gele vlag', uitleg: 'gele vlag op de staander (naad)' },
  geen: { naam: 'Enkel tellen', uitleg: 'niet op de kaart' },
};
// Standaard voor lijnelementen zonder eigen lijst.
export const TOEBEHOREN = [
  { k: 'klem', naam: 'Klemmen', soort: 'klem' },
  { k: 'schoor', naam: 'Schoren', soort: 'schoor' },
  { k: 'driehoek', naam: 'Steundriehoeken', soort: 'driehoek' },
  { k: 'wiel', naam: 'Wielen', soort: 'wiel' },
];
// Een gele vlag kan op elk hek of elke paal (een toebehoren zoals een wiel: kies waar).
const GELE_VLAG = { k: 'vlag', naam: 'Gele vlag', soort: 'vlag' };
export function toebehorenVan(element) {
  const l = element?.eigenschappen?.toebehoren;
  const basis = Array.isArray(l) ? l.filter((x) => x?.naam) : TOEBEHOREN;
  return basis.some((x) => x.soort === 'vlag') ? basis : [...basis, GELE_VLAG];
}
// Instelling van één toebehoren op een lijn: eigen keuze, anders de standaard van het element.
function tbInst(item, acc) {
  let eigen = item.velden?.toebehoren?.[acc.k];
  // Oud: steundriehoeken "zelf kiezen" was om = 0; nu zoals de rest: waar = 'gekozen'.
  if (eigen && acc.soort === 'driehoek' && eigen.om !== undefined && !Number(eigen.om)) eigen = { ...eigen, om: acc.om || 5, waar: 'gekozen' };
  return { aan: !!acc.standaard_aan, om: acc.om || (acc.soort === 'schoor' ? 2 : acc.soort === 'driehoek' ? 5 : 1), per: acc.per || 1, kant: 'rechts', ...(acc.soort === 'paal' ? { lengte: acc.lengte || 1.6 } : {}), ...(eigen || {}) };
}
export function toebehorenInst(item, element) {
  return Object.fromEntries(toebehorenVan(element).map((a) => [a.k, tbInst(item, a)]));
}

// Openingen in een hekkenlijn (deur, poort): parameters.openingen = [{ id, k, d, b }] — het item `id`
// (de deur of poort) zit in stuk k van de lijn, op d meter van het begin van dat stuk, b meter breed.
// Daar staan geen hekken; de hekken ervoor en erna krijgen elk een heel aantal stukken.
export const openingenVan = (par) => (Array.isArray(par?.openingen) ? par.openingen.filter((o) => o && Number(o.b) > 0 && Number(o.k) >= 0) : []);
// De delen van stuk k van de lijn waar wél hekken staan: [{ run, van, tot, open }], met `open` de opening
// die na dat deel komt (of null). In een bocht komt geen opening.
export function hekDelen(c, k, bogen = null, openingen = null) {
  const h = Number(bogen?.[k]) || 0;
  const run = { type: 'LineString', coordinates: boogPunten(c[k], c[k + 1], h) };
  const L = lengte(run);
  const op = h ? [] : (openingen || []).filter((o) => Number(o.k) === k).map((o) => ({ ...o, d: Math.max(0, Number(o.d) || 0), b: Number(o.b) })).sort((a, b) => a.d - b.d);
  if (!op.length) return [{ run, van: 0, tot: L, open: null, L }];
  const M = { units: 'meters' }; const uit = []; let van = 0;
  const deel = (a, b2, open) => {
    if (b2 - a < 0.01) {
      // Geen hekken tussen twee openingen (of vóór de eerste): de openingen vormen samen één gat.
      const v = uit[uit.length - 1];
      if (v && open) v.open = v.open ? { ...open, van: v.open.van, b: open.tot - v.open.van } : open;
      else if (!v && open) uit.push({ run: null, van: a, tot: a, open, L: 0 });
      return;
    }
    const r = a <= 0.001 && b2 >= L - 0.001 ? run : turf.lineSliceAlong(run, a, b2, M).geometry;
    uit.push({ run: r, van: a, tot: b2, open, L: b2 - a });
  };
  for (const o of op) {
    const d0 = Math.min(Math.max(van, o.d), L); const d1 = Math.min(L, d0 + o.b);
    deel(van, d0, { ...o, van: d0, tot: d1 });
    van = d1;
  }
  deel(van, L, null);
  return uit;
}
// Naden van een lijnelement: per recht stuk een heel aantal stukken (zoals getekend).
// Bij een opening: de naad ervóór krijgt `q` (waar de hekken erna weer beginnen) en `open` (de opening);
// hek i loopt dan van naden[i].q tot naden[i+1].p (zie hekBegin en hekStuk). naden.runs[r] heeft
// `seg` (stuk van de lijn), `d0` (begin in dat stuk, m) en `van` (begin langs de hele lijn, m).
export function nadenVan(g, element, bogen = null, openingen = null) {
  const e = Number(element?.eenheid_m);
  if (g?.type !== 'LineString' || !(e > 0)) return [];
  const c = g.coordinates; const uit = []; uit.runs = [];
  const M = { units: 'meters' };
  const op = openingenVan({ openingen });
  let langs = 0;
  for (let k = 0; k < c.length - 1; k++) {
    const h = Number(bogen?.[k]) || 0;
    const heel = { type: 'LineString', coordinates: boogPunten(c[k], c[k + 1], h) };
    const segL = lengte(heel);
    const delen = op.some((o) => Number(o.k) === k) && !h ? hekDelen(c, k, bogen, op) : [{ run: heel, van: 0, open: null }];
    for (const dl of delen) {
      const run = dl.run;
      const L = run ? lengte(run) : 0;
      if (run && L >= 0.01) {
        const ri = uit.runs.length; run.seg = k; run.d0 = dl.van; run.van = langs + dl.van; uit.runs.push(run);
        // Paal en net: elk stuk tussen twee knikpunten is één net (de palen staan op de knikpunten,
        // ook als je ze zelf verder dan één net uit elkaar zet).
        const n = paalPerPunt(element) ? 1 : segN(L, e);
        const rc = run.coordinates;
        // Na een opening begint het eerste hek bij q: die naad hoort bij de naad vóór de opening.
        const vorige = uit.length ? uit[uit.length - 1] : null;
        if (vorige?.open && !vorige.q) vorige.q = rc[0];
        for (let i = uit.length ? 1 : 0; i <= n; i++) {
          const d = (i * L) / n;
          const p = i === 0 ? rc[0] : i === n ? rc[rc.length - 1] : turf.along(run, d, M).geometry.coordinates;
          const r = h ? turf.bearing(turf.along(run, Math.max(0, d - 0.3), M).geometry.coordinates, turf.along(run, Math.min(L, d + 0.3), M).geometry.coordinates) : turf.bearing(c[k], c[k + 1]);
          uit.push({ p, r, run: ri, d, L });
        }
      }
      if (dl.open && uit.length) { const n0 = uit[uit.length - 1]; n0.open = { id: dl.open.id, b: dl.open.b, k, d: dl.open.van, tot: dl.open.tot }; n0.q = null; }
    }
    langs += segL;
  }
  // Opening op het einde van de lijn: de naad erna bestaat niet.
  const laatste = uit[uit.length - 1]; if (laatste?.open && !laatste.q) { delete laatste.open; delete laatste.q; }
  return uit;
}
// Waar hek i begint: na een opening bij q, anders op de naad zelf.
export const hekBegin = (naden, i) => (naden[i]?.q || naden[i]?.p);
// Het stuk lijn tussen twee naden, ook in een bocht.
export function hekStuk(naden, i) {
  const a = naden[i]; const b = naden[i + 1];
  if (!a || !b) return null;
  const M = { units: 'meters' };
  try {
    if (b.run === a.run) return turf.lineSliceAlong(naden.runs[a.run], a.d, b.d, M).geometry;
    return turf.lineSliceAlong(naden.runs[b.run], 0, b.d, M).geometry;
  } catch { return { type: 'LineString', coordinates: [a.p, b.p] }; }
}
// Naam van een regel uit toebehorenTelling (paal: met de lengte erbij).
export function toebehorenNaam(element, sleutel) {
  const [k, lengte] = String(sleutel).split('@');
  const n = toebehorenVan(element).find((x) => x.k === k)?.naam || k;
  return lengte ? `${n} ${String(Number(lengte).toFixed(2)).replace('.', ',')} m` : n;
}
export function toebehorenTelling(item, element) {
  if (element?.tekenwijze !== 'lijn') return null;
  const lijst = toebehorenVan(element);
  if (!lijst.length) return null;
  const naden = nadenVan(item.geometrie, element, item.parameters?.bogen, item.parameters?.openingen);
  if (naden.length < 2) return null;
  const uit = {};
  for (const a of lijst) {
    const t = tbInst(item, a);
    if (!t.aan) continue;
    const per = Math.max(1, Number(t.per) || 1);
    if (a.soort === 'klem') { uit[a.k] = (gekozen(t) ? klemNaden(t, naden).length : Math.max(0, naden.length - 2)) * per; continue; }
    if (a.soort === 'driehoek') { uit[a.k] = hekPlekken(t, naden).reduce((s2, [, z]) => s2 + telZijde(z), 0); continue; }
    const pl = naadPlekken(t, naden);
    const n = a.soort === 'wiel' || a.soort === 'vlag' || a.soort === 'geen' ? pl.length : pl.reduce((s2, [, z]) => s2 + telZijde(z), 0);
    if (a.soort === 'paal') uit[`${a.k}@${Number(t.lengte) || 1.6}`] = n * per; // lengte in de sleutel: aparte regel per lengte
    else uit[a.k] = n * per;
  }
  return Object.keys(uit).length ? uit : null;
}
const telZijde = (z) => (z === 'beide' ? 2 : 1);
const gekozen = (t) => t?.waar === 'gekozen';
// Kant op een gekozen hek: wat je aanklikte, anders de kant van de lijn.
const hekZijde = (t, i) => (gekozen(t) && t.zijden?.[i]) || t.kant || 'rechts';
// Waar komt een toebehoren op de naden: [[naadIndex, kant], ...].
// Hele lijn: om de N naden. Gekozen hekken: per aaneengesloten reeks begin, einde en om de N ertussen.
export function naadPlekken(t, naden) {
  const om = Math.max(1, Number(t.om) || 1);
  if (!gekozen(t)) return naden.map((_, i) => i).filter((i) => i % om === 0).map((i) => [i, t.kant || 'rechts']);
  const hek = [...new Set((t.plekken || []).map(Number))].filter((i) => i >= 0 && i < naden.length - 1).sort((a, b) => a - b);
  const uit = new Map();
  for (let k = 0; k < hek.length;) {
    let e = k; while (e + 1 < hek.length && hek[e + 1] === hek[e] + 1) e++;
    const s0 = hek[k]; const s1 = hek[e] + 1; // eerste en laatste naad van de reeks
    for (let j = s0; j <= s1; j++) if (j === s0 || j === s1 || (j - s0) % om === 0) {
      const z = (j < s1 && t.zijden?.[j]) || (j > s0 && t.zijden?.[j - 1]) || t.kant || 'rechts';
      uit.set(j, z);
    }
    k = e + 1;
  }
  return [...uit.entries()];
}
// Klemmen op gekozen hekken: elke naad van die hekken, behalve de uiteinden van de lijn.
const klemNaden = (t, naden) => naadPlekken({ ...t, om: 1 }, naden).map(([i]) => i).filter((i) => i > 0 && i < naden.length - 1);
// Waar komen steundriehoeken: [[hekIndex, kant], ...].
export function hekPlekken(t, naden) {
  return driehoekPlekken(naden, Number(t.om) || 5, gekozen(t) ? (t.plekken || []) : null).map((i) => [i, hekZijde(t, i)]);
}
// Steundriehoeken: op een hek van de lijn (om de zoveel hekken) twee extra hekken in een
// driehoek ertegen. Geeft de index van het hek (tussen naad i en i+1) terug.
export function driehoekPlekken(naden, om, plekken = null) {
  // Gekozen hekken: precies die, zolang ze nog op de lijn liggen.
  if (Array.isArray(plekken)) return plekken.map(Number).filter((i) => i >= 0 && i < naden.length - 1 && naden[i].run === naden[i + 1].run).sort((a, b) => a - b);
  om = Math.max(1, om || 1);
  const uit = [];
  for (let i = 0; i < naden.length - 1; i++) {
    if (naden[i].run !== naden[i + 1].run) continue;
    if ((i + Math.floor(om / 2)) % om === 0) uit.push(i);
  }
  return uit;
}
function toebehorenFeatures(it, el, basis) {
  const lijst = toebehorenVan(el).map((a) => ({ a, t: tbInst(it, a) })).filter((x) => x.t.aan && x.a.soort !== 'geen');
  if (!lijst.length) return [];
  const naden = nadenVan(it.geometrie, el, it.parameters?.bogen, it.parameters?.openingen); if (naden.length < 2 || naden.length > 1500) return [];
  const M = { units: 'meters' }; const uit = [];
  const d = (p, afst, r) => turf.destination(p, afst, r, M).geometry.coordinates;
  const prop = (extra) => ({ ...basis, stuk: true, kleur: '#1d1d1b', streep: 'vol', wit_rand: false, patroon: '', dekking: 1, tekening: true, ...extra });
  const vierkant = (c, r, z, vul) => { const a = d(d(c, z / 2, r), z / 2, r + 90); const b = d(a, z, r + 180); const e = d(b, z, r - 90); const f = d(e, z, r); return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[a, b, e, f, a]] }, properties: prop({ vorm: 'vlak', vulkleur: vul, vuldekking: 1, vulpatroon: 'effen', dikte_m: 0.02, dikte: 1 }) }; };
  for (const { a, t } of lijst) {
    if (a.soort !== 'driehoek') continue;
    const L = Number(el.eenheid_m) || 3.5;
    // Nadardriehoek (a.hek): de twee benen zijn zelf dranghekken, getekend met de tekening van het hek.
    // Herasdriehoek (standaard): stalen schoren met een voetplaat.
    const hekTek = a.hek && el.eigenschappen?.tekening ? metMontage(el.eigenschappen.tekening, it, el) : null;
    for (const [i, z] of hekPlekken(t, naden)) {
      const kanten = z === 'beide' ? [90, -90] : [z === 'links' ? -90 : 90];
      const p = hekBegin(naden, i); const q = naden[i + 1].p;
      const r = turf.bearing(p, q); const m = turf.midpoint(p, q).geometry.coordinates;
      const b = turf.distance(p, q, M);
      const hgt = Math.sqrt(Math.max(0.25, L * L - (b / 2) * (b / 2)));
      for (const k of kanten) {
        const top = d(m, hgt, r + k);
        if (hekTek) {
          for (const v of [p, q]) {
            const been = turf.distance(v, top, M); const rb = turf.bearing(v, top);
            uit.push(...tekeningFeatures(hekTek, { id: it.id, parameters: { midden: turf.midpoint(v, top).geometry.coordinates, rot: rb - 90, breedte: been, diepte: hekTek.h, spiegel_y: hekGespiegeld(it) } }, { breedte_m: hekTek.b, diepte_m: hekTek.h }, { ...basis, stuk: true }).vormen);
          }
          continue;
        }
        for (const v of [p, q]) uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [v, top] }, properties: prop({ vorm: 'lijn', dikte_m: 0.06, dikte: 1 }) });
        uit.push(vierkant(top, r, 0.3, '#1d1d1b'));
      }
    }
  }
  for (const { a, t } of lijst) {
    if (a.soort === 'driehoek') continue;
    if (a.soort === 'klem') { for (const i of gekozen(t) ? klemNaden(t, naden) : naden.map((_, j) => j).filter((j) => j > 0 && j < naden.length - 1)) uit.push(vierkant(naden[i].p, naden[i].r, 0.24, '#1d1d1b')); continue; }
    for (const [i, z] of naadPlekken(t, naden)) {
      const n = naden[i];
      const kanten = z === 'beide' ? [90, -90] : [z === 'links' ? -90 : 90];
      if (a.soort === 'schoor') {
        for (const k of kanten) {
          const eind = d(n.p, 1.2, n.r + k);
          uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [n.p, eind] }, properties: prop({ vorm: 'lijn', dikte_m: 0.08, dikte: 1 }) });
          uit.push(vierkant(eind, n.r, 0.3, '#1d1d1b'));
        }
      } else if (a.soort === 'wiel') {
        const ring = []; for (let j = 0; j <= 16; j++) ring.push(d(n.p, 0.22, (360 * j) / 16));
        uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: prop({ vorm: 'vlak', vulkleur: '#ffffff', vuldekking: 1, vulpatroon: 'effen', dikte_m: 0.06, dikte: 1 }) });
      } else if (a.soort === 'vlag') {
        // Gele vlag: driehoekje dat van de staander wegwaait (in de tekenrichting).
        const top = d(n.p, 0.9, n.r); const pnt = d(d(n.p, 0.45, n.r), 0.55, n.r + 90);
        uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[n.p, top, pnt, n.p]] }, properties: prop({ vorm: 'vlak', vulkleur: '#FACC15', vuldekking: 1, vulpatroon: 'effen', kleur: '#A16207', dikte_m: 0.03, dikte: 1 }) });
      } else if (a.soort === 'paal') {
        // Paal tegen het hek om het te verstevigen (in de grond geslagen), op de naad.
        for (const k of kanten) {
          const ring = []; for (let j = 0; j <= 12; j++) ring.push(d(d(n.p, 0.12, n.r + k), 0.06, (360 * j) / 12));
          uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: prop({ vorm: 'vlak', vulkleur: '#78350F', vuldekking: 1, vulpatroon: 'effen', dikte_m: 0.015, dikte: 1 }) });
        }
      } else if (a.soort === 'blok') {
        for (const k of kanten) uit.push(vierkant(d(n.p, 0.45, n.r + k), n.r, 0.4, '#8A6D3B'));
      }
    }
  }
  return uit;
}

// Losse voet/paal aan één uiteinde van een getekend lijnstuk (bv. de voet van een
// heraspaneel). Die komt ook aan het andere uiteinde van de hele lijn, anders
// mist het laatste paneel zijn voet.
// Delen met `alleen` tonen alleen bij de gekozen montage (bv. kleur, voet). Ook voor lijnelementen.
function metMontage(tek, it, el) {
  if (!tek) return null;
  const m = it?.velden?.montage || el?.eigenschappen?.montages?.[0]?.[0] || null;
  const ok = (x) => !x.alleen || x.alleen === m;
  if (![...(tek.vlakken || []), ...(tek.lijnen || []), ...(tek.teksten || [])].some((x) => x.alleen)) return tek;
  return { ...tek, vlakken: (tek.vlakken || []).filter(ok), lijnen: (tek.lijnen || []).filter(ok), teksten: (tek.teksten || []).filter(ok) };
}
const voetCache = new WeakMap();
function voetVan(tek) {
  if (voetCache.has(tek)) return voetCache.get(tek);
  const b = tek.b || 1; const rand = b * 0.2;
  const xs = (pts) => pts.map((p) => p[0]);
  const kies = (test) => ({
    vlakken: (tek.vlakken || []).filter((v) => xs(v.r[0]).every(test)),
    lijnen: (tek.lijnen || []).filter((l) => xs(l.c).every(test)),
  });
  let uit = null;
  const links = kies((x) => x <= -b / 2 + rand);
  const rechts = kies((x) => x >= b / 2 - rand);
  const n = (k) => k.vlakken.length + k.lijnen.length;
  const schuif = (k, d) => ({ b, h: tek.h, vlakken: k.vlakken.map((v) => ({ ...v, r: v.r.map((r) => r.map(([x, y]) => [x + d, y])) })), lijnen: k.lijnen.map((l) => ({ ...l, c: l.c.map(([x, y]) => [x + d, y]) })), teksten: [] });
  if (n(links) && !n(rechts)) uit = { tek: schuif(links, b), plek: 'einde' };
  else if (n(rechts) && !n(links)) uit = { tek: schuif(rechts, -b), plek: 'begin' };
  voetCache.set(tek, uit);
  return uit;
}

// ---------- Doek op hekken (wit, zwart, bedrukt) ----------
export const DOEKEN = { geen: 'Geen', wit: 'Wit', zwart: 'Zwart', bedrukt: 'Bedrukt' };
// Opbouwtekst per lijn: "1–2: Sponsor A · 3: Sponsor B · 4: geen".
// Doeken per hek, even lang als het aantal hekken op de lijn zoals ze nu getekend is.
export function doekenPerHek(item, element) {
  const l = item.velden?.doeken; if (!Array.isArray(l)) return [];
  const n = element ? Math.max(0, nadenVan(item.geometrie, element, item.parameters?.bogen, item.parameters?.openingen).length - 1) : l.length;
  return Array.from({ length: n }, (_, i) => l[i] || null);
}
export function doekRuns(item, elementenMap) {
  const el = elementenMap.get(item.element_id);
  const l = el && item.geometrie ? doekenPerHek(item, el) : item.velden?.doeken; if (!Array.isArray(l) || !l.length) return [];
  const uit = [];
  l.forEach((id, i) => {
    const naam = id ? (elementenMap.get(id)?.naam || '?') : 'geen doek';
    const laatste = uit[uit.length - 1];
    if (laatste && laatste.naam === naam && laatste.tot === i) laatste.tot = i + 1; else uit.push({ van: i + 1, tot: i + 1, naam, id });
  });
  return uit;
}
// ---------- Infototem: per zijde een bedrukt paneel ----------
// Zijde 1 = voorkant (onderkant bij draaiing 0), dan met de klok mee.
export const TOTEM_ZIJDEN = ['Voorkant', 'Rechts', 'Achterkant', 'Links'];
export const isTotem = (el) => !!el?.eigenschappen?.totem;
// Hekken en afsluitingen (Heras, nadar, Boplan, paal en net, crash barrier …).
export const isHekElement = (el) => el?.tekenwijze === 'lijn' && /hek|afsluit|barrier/i.test(`${el.categorie || ''}`);
// Heeft de tekening van een lijnelement een kant (pootjes, voetplaat, grondplaat aan één zijde)? Dan kan je ze spiegelen.
const zijdigCache = new WeakMap();
export function tekeningZijdig(el) {
  const tek = el?.eigenschappen?.tekening;
  if (!tek) return false;
  if (zijdigCache.has(tek)) return zijdigCache.get(tek);
  let lo = Infinity; let hi = -Infinity;
  const zie = (y) => { if (y < lo) lo = y; if (y > hi) hi = y; };
  for (const v of tek.vlakken || []) for (const r of v.r || []) for (const q of r) zie(q[1]);
  for (const l of tek.lijnen || []) for (const q of l.c || []) zie(q[1]);
  const z = Number.isFinite(lo) && Math.abs(hi + lo) > 0.08;
  zijdigCache.set(tek, z);
  return z;
}
// Gespiegeld (pootjes aan de andere kant): velden.spiegel op het item.
export const hekGespiegeld = (it) => !!it?.velden?.spiegel;
// Truss met doeken: 'kubus' (vier zijden, zoals een totem) of 'boog' (de overspanning, twee kanten).
export const trussDoek = (el) => (el?.eigenschappen?.truss_doek === 'kubus' || el?.eigenschappen?.truss_doek === 'boog' ? el.eigenschappen.truss_doek : null);
export const BOOG_KANTEN = ['Kant 1 (links van de tekenrichting)', 'Kant 2 (rechts)'];
// Textielframe (B-matrix e.d.): voor- en achterkant met een doek.
export const isFrame = (el) => !!el?.eigenschappen?.frame;
export const FRAME_ZIJDEN = ['Voorkant', 'Achterkant'];
// Pipe & drape: lijn van secties (eenheid_m), per sectie een gordijn of bedrukt doek.
export const isDrape = (el) => !!el?.eigenschappen?.drape;
export const zijdenVan = (el) => (trussDoek(el) === 'boog' ? BOOG_KANTEN : isFrame(el) ? (Number(el.eigenschappen.frame?.zijden) === 1 ? FRAME_ZIJDEN.slice(0, 1) : FRAME_ZIJDEN) : TOTEM_ZIJDEN);
export const heeftZijden = (el) => isTotem(el) || !!trussDoek(el) || isFrame(el);
export const isPaneel = (d) => d?.eigenschappen?.drager === 'totem';
export const isVlag = (el) => !!el?.eigenschappen?.vlag;
// Wie levert dit item op dit event (gemeente, FLCS, Delrue …): per item in te stellen, anders de leverancier van het element.
// Geleverd door: eigen keuze op het item, anders de vaste leverancier van het element, anders de standaardleverancier
// van het plan voor die categorie (plan.instellingen.leveranciers = { categorie: leverancier }).
export const herkomstVan = (it, el, std = null) => String(it?.velden?.herkomst || '').trim() || el?.leverancier || (std && el?.categorie ? std[el.categorie] || '' : '');
// Heras waarin een beachvlag aan een staander geklemd kan worden (90 % van de vlaggen).
export const isVlagHek = (el) => el?.tekenwijze === 'lijn' && !el?.eigenschappen?.drape && Number(el.eenheid_m) > 0 && (!!el.eigenschappen?.doek || !!el.eigenschappen?.vlaghouder || /heras|bouwhek|werfhek/i.test(el.naam || ''));
// Vlaggen in een hekkenlijn: velden.vlaggen[i] = ontwerp aan de eerste staander van hek i.
function hekVlagFeatures(it, el, elementenMap, basis) {
  const l = it.velden?.vlaggen; if (!Array.isArray(l) || !l.some(Boolean)) return [];
  const naden = nadenVan(it.geometrie, el, it.parameters?.bogen, it.parameters?.openingen);
  const uit = [];
  l.forEach((id, i) => {
    if (!id || !naden[i]) return;
    const o = elementenMap.get(id);
    const p = hekBegin(naden, i); const r = naden[i].r;
    // Schuin van het hek weg, zodat de vlag ook op een gezeild hek zichtbaar blijft.
    const eind = turf.destination(p, 1, r - 45, { units: 'meters' }).geometry.coordinates;
    const kleur = o?.eigenschappen?.kleur || '#2563EB';
    const g = { type: 'LineString', coordinates: [p, eind] };
    uit.push({ type: 'Feature', geometry: g, properties: { ...basis, vorm: 'lijn', kleur: '#1d1d1b', dekking: 1, dikte: 9, dikte_m: 0.28, streep: 'vol', wit_rand: false, patroon: '', doekband: true } });
    uit.push({ type: 'Feature', geometry: g, properties: { ...basis, vorm: 'lijn', kleur, dekking: 1, dikte: 7, dikte_m: 0.2, streep: 'vol', wit_rand: false, patroon: '', doekband: true } });
  });
  return uit;
}
export const totemPanelen = (item, el = null) => (el ? zijdenVan(el) : TOTEM_ZIJDEN).map((_, k) => item?.velden?.[`paneel_${k + 1}`] || null);
// Trussboog: per kant een doek, als band naast de overspanning.
function boogFeatures(it, el, elementenMap, basis, nummers) {
  const g = it.geometrie; const c = g?.coordinates;
  if (g?.type !== 'LineString' || !c || c.length < 2) return { vormen: [], labels: [] };
  const lat0 = c[0][1]; const mLat = 110574; const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const L = c.map(([x, y]) => [(x - c[0][0]) * mLng, (y - c[0][1]) * mLat]);
  const W_ = (q) => [c[0][0] + q[0] / mLng, c[0][1] + q[1] / mLat];
  const vormen = []; const labels = [];
  totemPanelen(it, el).forEach((id, k) => {
    const pn = id ? elementenMap.get(id) : null;
    const t = k === 0 ? 0.32 : -0.32; // links (+) of rechts (−) van de tekenrichting
    const lijn = [];
    for (let i = 0; i < L.length; i++) {
      const a = L[Math.max(0, i - 1)]; const b = L[Math.min(L.length - 1, i + 1)];
      const dx = b[0] - a[0]; const dy = b[1] - a[1]; const n = Math.hypot(dx, dy) || 1;
      lijn.push(W_([L[i][0] - (dy / n) * t, L[i][1] + (dx / n) * t]));
    }
    const kleur = pn ? pn.eigenschappen?.kleur || '#7C3AED' : '#B9BCC1';
    const lg = { type: 'LineString', coordinates: lijn };
    vormen.push({ type: 'Feature', geometry: lg, properties: { ...basis, vorm: 'lijn', kleur, dekking: pn ? 0.9 : 0.6, dikte: pn ? 6 : 2, dikte_m: pn ? 0.18 : 0.04, streep: 'vol', wit_rand: false, patroon: '', doekband: true } });
    if (nummers) labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: turf.along(lg, turf.length(lg) / 2).geometry.coordinates }, properties: { id: it.id, soort: 'heknr', label: String(k + 1), kleur: pn ? kleur : '#686D76' } });
  });
  return { vormen, labels };
}
function totemFeatures(it, el, elementenMap, basis, nummers) {
  const p = it.parameters || {};
  if (!p.midden) return { vormen: [], labels: [] };
  const b = Number(p.breedte) || Number(el.breedte_m) || 1; const d = Number(p.diepte) || Number(el.diepte_m) || 1;
  const ring = elementVeelhoek(p.midden, b, d, Number(p.rot) || 0).coordinates[0];
  const vormen = []; const labels = [];
  totemPanelen(it, el).forEach((id, k) => {
    const pn = id ? elementenMap.get(id) : null;
    const g = { type: 'LineString', coordinates: [ring[k], ring[k + 1]] };
    const kleur = pn ? pn.eigenschappen?.kleur || '#16A34A' : '#B9BCC1';
    vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, vorm: 'lijn', kleur, dekking: pn ? 0.9 : 0.6, dikte: pn ? 6 : 2, dikte_m: pn ? 0.14 : 0.04, streep: 'vol', wit_rand: false, patroon: '', doekband: true } });
    if (nummers) labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: turf.midpoint(ring[k], ring[k + 1]).geometry.coordinates }, properties: { id: it.id, soort: 'heknr', label: String(k + 1), kleur: pn ? kleur : '#686D76' } });
  });
  return { vormen, labels };
}
// Beachvlag: het doek als korte dikke streep vanaf de mast, in de kleur van het ontwerp.
function vlagFeatures(it, el, elementenMap, basis) {
  const p = it.parameters || {};
  if (!p.midden) return [];
  const id = it.velden?.ontwerp; const o = id ? elementenMap.get(id) : null;
  const lang = Number(el.eigenschappen?.vlag?.breedte_m) || 0.8;
  const eind = turf.destination(p.midden, lang, (Number(p.rot) || 0) + 90, { units: 'meters' }).geometry.coordinates;
  const g = { type: 'LineString', coordinates: [p.midden, eind] };
  const kleur = o ? o.eigenschappen?.kleur || '#2563EB' : '#ffffff';
  const uit = [];
  if (!o) uit.push({ type: 'Feature', geometry: g, properties: { ...basis, vorm: 'lijn', kleur: '#B9BCC1', dekking: 1, dikte: 7, dikte_m: 0.2, streep: 'vol', wit_rand: false, patroon: '', doekband: true } });
  uit.push({ type: 'Feature', geometry: g, properties: { ...basis, vorm: 'lijn', kleur, dekking: 1, dikte: o ? 7 : 5, dikte_m: o ? 0.2 : 0.14, streep: 'vol', wit_rand: false, patroon: '', doekband: true } });
  return uit;
}
// Wit of zwart gezeild zonder doek-instelling: uit de naam (enkel voor hekken zonder eigen doek in een lijn met doeken per hek).
function zeilVanNaam(el) {
  const n = el?.naam || '';
  if (/wit\s*(gezeild|zeil)/i.test(n)) return { soort: 'wit', kleur: '#ffffff', rand: '#B9BCC1', dekking: 1 };
  if (/zwart\s*(gezeild|zeil)/i.test(n)) return { soort: 'zwart', kleur: '#1d1d1b', dekking: 0.8 };
  return null;
}
export function doekVan(element) {
  const d = element?.eigenschappen?.doek;
  if (!d || d === 'geen') return null;
  if (d === 'wit') return { soort: 'wit', kleur: '#ffffff', rand: '#B9BCC1', dekking: 1 };
  if (d === 'zwart') return { soort: 'zwart', kleur: '#1d1d1b', dekking: 0.8 };
  return { soort: 'bedrukt', kleur: element.eigenschappen?.doek_kleur || '#E11D48', dekking: 0.6 };
}
// B-matrix frame-wand op de kaart: elk frame een strookje langs de lijn, voorkant links en achterkant
// rechts van de tekenrichting in de kleur van het doek (licht grijs zonder doek), met een naad ertussen.
function trussFeatures(it, el, basis) {
  const c = it.geometrie?.coordinates || []; if (c.length < 2) return [];
  const { pts, terug } = naarMeterLijn(c);
  const st = trussStukken(pts, it).map((x) => ({ ...x }));
  const zwart = /zwart/i.test(el?.naam || '');
  const vlak = (ring, vul, dekking) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...ring.map(terug), terug(ring[0])]] }, properties: { ...basis, vorm: 'vlak', vulkleur: vul, vuldekking: dekking, kleur: zwart ? '#111827' : '#6B7280', dekking: 1, dikte: 1, dikte_m: 0, vulpatroon: 'effen', streep: 'vol', wit_rand: false, patroon: '' } });
  // Recht op de truss gedraaid (r in rad), niet op noord.
  const vierkant = (p, h, r = 0) => { const c = Math.cos(r); const s = Math.sin(r); return [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => [p[0] + x * c - y * s, p[1] + x * s + y * c]); };
  const uit = [];
  const TB = trussTypeVoor(el, it.velden?.truss).B;
  for (const k of trussKnopen(st, TB)) if (k.voet) uit.push(vlak(vierkant(k.p, 0.3, knoopRichting(k, st)), '#9CA3AF', 0.5));
  for (const s2 of [...st].sort((a, b) => a.a[2] - b.a[2])) {
    if (uit.length > 3000) break;
    if (s2.op) { uit.push(vlak(vierkant(s2.a, 0.145, s2.r), zwart ? '#374151' : '#D1D5DB', 0.9)); continue; }
    const u = [Math.cos(s2.r), Math.sin(s2.r)]; const n = [-u[1] * 0.145, u[0] * 0.145];
    uit.push(vlak([[s2.a[0] + n[0], s2.a[1] + n[1]], [s2.e[0] + n[0], s2.e[1] + n[1]], [s2.e[0] - n[0], s2.e[1] - n[1]], [s2.a[0] - n[0], s2.a[1] - n[1]]], zwart ? '#374151' : '#E5E7EB', 0.75));
  }
  for (const k of trussKnopen(st, TB)) if (k.hoek) uit.push(vlak(vierkant(k.p, TB / 2 + 0.01, knoopRichting(k, st)), zwart ? '#1F2937' : '#9CA3AF', 1));
  return uit;
}

// Hoekpunten van wat een stelling op het plan inneemt (vakken, aanloopplaten): voor het selectiekader.
const _stellingPunten = new WeakMap();
export function stellingPunten(it) {
  if (_stellingPunten.has(it)) return _stellingPunten.get(it);
  const uit0 = stellingPunten0(it); _stellingPunten.set(it, uit0); return uit0;
}
function stellingPunten0(it) {
  try {
    const uit = [];
    for (const f of stellingFeatures(it, {})) if (f.geometry.type === 'Polygon') for (const q of f.geometry.coordinates[0]) uit.push(q);
    return uit;
  } catch { return []; }
}

// Waar de camera van een gebouwde stelling op de kaart staat (lng, lat), of null.
function stellingCameraPunt(it) {
  const c = it.geometrie?.coordinates || []; const cp = c.length >= 2 ? cameraPlek(it.velden?.stelling) : null; if (!cp) return null;
  const { pts, terug } = naarMeterLijn(c); return terug(stellingAnker(pts).naarWereld(cp.W));
}
function stellingFeatures(it, basis) {
  const c = it.geometrie?.coordinates || []; if (c.length < 2) return [];
  const { pts, terug } = naarMeterLijn(c); const A = stellingAnker(pts); const uit = [];
  const gem = { ...basis, wit_rand: false, patroon: '', streep: 'vol', dikte_m: 0 };
  for (const dl of stellingDelen(it.velden.stelling)) {
    const st = dl.d; const af = stellingAfgeleid(st, { verbonden: dl.verbonden }); const M = stellingMaten(st);
    const W = (i, j) => terug(A.naarWereld(dl.T([M.x(i), M.y(j)])));
    for (const v of af.lijst) {
      const ring = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]].map(([u, w]) => W(v.i + u, v.j + w));
      uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { ...gem, vorm: 'vlak', vulkleur: stellingSoort(v.soort).kleur, vuldekking: v.soort === 'toren' ? 0.5 : 0.9, kleur: '#6B4423', dekking: 0.9, dikte: 0.8, vulpatroon: 'effen', streep: v.soort === 'toren' ? 'streep' : 'vol' } });
      // Naad tussen de twee vloerplaten van een vak (platen liggen in de looprichting).
      const langs = v.soort === 'helling' ? (Number(v.r) || 0) % 2 === 0 : true;
      if (['vloer', 'helling'].includes(v.soort) && (langs ? M.by(v.j) : M.bx(v.i)) > 1.5) {
        const nd = langs ? [W(v.i, v.j + 0.5), W(v.i + 1, v.j + 0.5)] : [W(v.i + 0.5, v.j), W(v.i + 0.5, v.j + 1)];
        uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: nd }, properties: { ...gem, vorm: 'lijn', kleur: '#8A6A45', dekking: 0.8, dikte: 0.6 } });
      }
      // Doorgang: gestippelde rand, zodat je ziet waar je onderdoor kan.
      if (v.doorgang) uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring }, properties: { ...gem, vorm: 'lijn', kleur: '#15803D', dekking: 0.9, dikte: 1.4, streep: 'streep' } });
      if (v.soort === 'helling' || v.soort === 'trap') {
        const r = Number(v.r) || 0; const [dx, dy] = STELLING_RICHTING[r];
        const m = [v.i + 0.5, v.j + 0.5]; const a = W(m[0] - dx * 0.38, m[1] - dy * 0.38); const b = W(m[0] + dx * 0.38, m[1] + dy * 0.38);
        const l1 = W(m[0] + dx * 0.16 - dy * 0.16, m[1] + dy * 0.16 + dx * 0.16); const l2 = W(m[0] + dx * 0.16 + dy * 0.16, m[1] + dy * 0.16 - dx * 0.16);
        uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: { ...gem, vorm: 'lijn', kleur: '#5B3A1E', dekking: 1, dikte: 2 } });
        uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [l1, b, l2] }, properties: { ...gem, vorm: 'lijn', kleur: '#5B3A1E', dekking: 1, dikte: 2 } });
      }
    }
    const Wm = (x, y) => terug(A.naarWereld(dl.T([x, y])));
    // Staanders (knooppunten op de grond): een stipje op elke hoek die draagt.
    for (const n of af.knopen) {
      const [x, y] = [M.x(n.i), M.y(n.j)]; const e = 0.09;
      const ring = [[x - e, y - e], [x + e, y - e], [x + e, y + e], [x - e, y + e], [x - e, y - e]].map(([a, b]) => Wm(a, b));
      uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { ...gem, vorm: 'vlak', vulkleur: '#1F2937', vuldekking: 1, kleur: '#1F2937', dekking: 1, dikte: 0.5, vulpatroon: 'effen' } });
    }
    // Aanloopplaten aan de voet van een helling horen bij de grondslag.
    for (const a2 of af.aanloop) {
      const hk = [[0, 0], [1, 0], [1, 1], [0, 1]]; const [c0, c1] = STELLING_RAND[a2.k];
      const P0 = [M.x(a2.i + hk[c0][0]), M.y(a2.j + hk[c0][1])]; const P1 = [M.x(a2.i + hk[c1][0]), M.y(a2.j + hk[c1][1])];
      const [dx, dy] = STELLING_RICHTING[a2.k]; const L = a2.L || STELLING_AANLOOP;
      const ring = [P0, P1, [P1[0] + dx * L, P1[1] + dy * L], [P0[0] + dx * L, P0[1] + dy * L], P0].map(([x, y]) => Wm(x, y));
      uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { ...gem, vorm: 'vlak', vulkleur: '#B98B5E', vuldekking: 0.9, kleur: '#6B4423', dekking: 0.9, dikte: 0.8, vulpatroon: 'effen' } });
    }
    for (const o of af.opstap) {
      const hk = [[0, 0], [1, 0], [1, 1], [0, 1]]; const [c0, c1] = STELLING_RAND[o.k];
      const P0 = [M.x(o.i + hk[c0][0]), M.y(o.j + hk[c0][1])]; const P1 = [M.x(o.i + hk[c1][0]), M.y(o.j + hk[c1][1])];
      const [dx, dy] = STELLING_RICHTING[o.k]; const L = STELLING_OPSTAP;
      const ring = [P0, P1, [P1[0] + dx * L, P1[1] + dy * L], [P0[0] + dx * L, P0[1] + dy * L], P0].map(([x, y]) => Wm(x, y));
      uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { ...gem, vorm: 'vlak', vulkleur: '#8FB5A8', vuldekking: 0.9, kleur: '#4F7F70', dekking: 0.9, dikte: 0.8, vulpatroon: 'effen' } });
    }
    const doekRand = new Set((st.doeken || []).flatMap((d) => d.randen || []));
    for (const r of af.randen) {
      if (!r.leuning && !doekRand.has(r.s)) continue;
      const [a, b] = STELLING_RAND[r.k]; const hk = [[0, 0], [1, 0], [1, 1], [0, 1]];
      const p = W(r.i + hk[a][0], r.j + hk[a][1]); const q = W(r.i + hk[b][0], r.j + hk[b][1]);
      uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [p, q] }, properties: { ...gem, vorm: 'lijn', kleur: doekRand.has(r.s) ? '#0F766E' : '#1F2937', dekking: 1, dikte: doekRand.has(r.s) ? 3 : 1.6 } });
    }
    if (dl.wig) for (const [p1, p2] of dl.wig.randen || []) uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [p1, p2].map((q) => terug(A.naarWereld(q))) }, properties: { ...gem, vorm: 'lijn', kleur: '#1F2937', dekking: 1, dikte: 1.6 } });
    if (dl.wig) { const ring = [...dl.wig.punten, dl.wig.punten[0]].map((q) => terug(A.naarWereld(q))); uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { ...gem, vorm: 'vlak', vulkleur: '#C8A36F', vuldekking: 0.9, kleur: '#6B4423', dekking: 0.9, dikte: 0.8, vulpatroon: 'effen' } }); }
  }
  // TV-camera op het dek: kijkhoek, body en lens, zoals de bibliotheektekening van een camerastelling.
  const cp = cameraPlek(it.velden.stelling);
  if (cp) {
    const [dx, dy] = cp.dW; const rx = dy; const ry = -dx;
    const P = (l, v) => terug(A.naarWereld([cp.W[0] + rx * l + dx * v, cp.W[1] + ry * l + dy * v]));
    const sec = [P(0, 0)]; const n = 12;
    for (let k = 0; k <= n; k++) { const a = ((-CAMERA_SECTOR.hoek + (2 * CAMERA_SECTOR.hoek * k) / n) * Math.PI) / 180; sec.push(P(Math.sin(a) * CAMERA_SECTOR.r, Math.cos(a) * CAMERA_SECTOR.r)); }
    sec.push(sec[0]);
    uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [sec] }, properties: { ...gem, vorm: 'vlak', vulkleur: '#FDE68A', vuldekking: 0.55, kleur: '#B45309', dekking: 1, dikte: 1, vulpatroon: 'effen' } });
    const rechthoek = (l0, l1, v0, v1) => [P(l0, v0), P(l1, v0), P(l1, v1), P(l0, v1), P(l0, v0)];
    for (const r of [rechthoek(-0.22, 0.22, -0.2, 0.1), rechthoek(-0.08, 0.08, 0.1, 0.25)]) uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [r] }, properties: { ...gem, vorm: 'vlak', vulkleur: '#111827', vuldekking: 1, kleur: '#1d1d1b', dekking: 1, dikte: 0.6, vulpatroon: 'effen' } });
  }
  return uit;
}

function wandFeatures(it, el, elementenMap, basis) {
  const c = it.geometrie?.coordinates || []; if (c.length < 2) return [];
  const { pts, terug } = naarMeterLijn(c);
  const uit = [];
  // Hoogste frames eerst niet nodig: van onder naar boven, zodat de bovenste rij er bovenop ligt.
  const fr = wandStukken(pts, it, el).sort((x, y) => x.z0 - y.z0);
  for (const f of fr) {
    if (uit.length > 3000) break;
    const u = [Math.cos(f.r), Math.sin(f.r)]; const n = [u[1], -u[0]]; // voorkant = rechts van de richting
    const p = (s2, o) => terug([f.a[0] + u[0] * s2 + n[0] * o, f.a[1] + u[1] * s2 + n[1] * o]);
    const v = 0.02; const t = Math.max(v, f.b - 0.02);
    for (const [kant, id] of [[0.07, f.voor], [-0.07, f.achter]]) {
      const d = id ? elementenMap.get(id) : null;
      uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [p(v, kant), p(t, kant)] }, properties: { ...basis, kleur: d ? d.eigenschappen?.kleur || '#EA580C' : '#D1D5DB', dekking: d ? 0.9 : 1, streep: 'vol', wit_rand: false, patroon: '', dikte: (basis.dikte || 1) + 2, dikte_m: 0.12, doekband: true } });
    }
    if (f.lok) uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [p(0, 0), p(f.b, 0)] }, properties: { ...basis, kleur: '#1d1d1b', dekking: 1, streep: 'vol', wit_rand: false, patroon: '', dikte: Math.max(2, basis.dikte || 2), dikte_m: 0.062, doekband: true } });
  }
  return uit;
}

function doekBand(g, d, basis) {
  const m = basis.dikte_m > 0;
  const band = (kleur, extraPx, extraM, dekking) => ({ type: 'Feature', geometry: g, properties: { ...basis, kleur, dekking, streep: 'vol', wit_rand: false, patroon: '', dikte: (basis.dikte || 1) + extraPx, dikte_m: m ? basis.dikte_m + extraM : 0, doekband: true } });
  if (d.soort === 'wit') return [band(d.rand, 8, 0.7, 1), band('#ffffff', 5, 0.5, 1)];
  return [band(d.kleur, 8, 0.7, d.dekking)];
}

// Vloer in een tent (velden.vloer = vloerelement: cassette, vlonder, zwaarlastvloer …):
// het raster van de vloer binnen de tent, boven de witte tentvulling en onder de tentlijnen.
export const tentVloerItem = (it, vloerEl) => {
  const p = it.parameters || {};
  if (!vloerEl || !p.midden || !(p.breedte > 0) || !(p.diepte > 0)) return null;
  return { ...it, element_id: vloerEl.id, geometrie: it.geometrie, parameters: { midden: p.midden, breedte: Number(p.breedte), diepte: Number(p.diepte), rot: Number(p.rot) || 0, ...(vloerEl.eigenschappen?.verspringend_standaard ? { verspringend: true } : {}) } };
};
function vloerInTent(it, elementenMap, basis) {
  const vloerEl = it.velden?.vloer ? elementenMap.get(it.velden.vloer) : null;
  const vi = tentVloerItem(it, vloerEl);
  if (!vi) return [];
  const vs = vloerEl.stijl || {};
  const props = { ...basis, vorm: 'vlak', vulkleur: vs.vulkleur || '#D2A86E', vuldekking: 0.45, kleur: vs.kleur || '#6E5434', dekking: 0.35, dikte: 0.5, dikte_m: 0, streep: 'vol', wit_rand: false, patroon: '', vulpatroon: 'effen' };
  return platen(vi, vloerEl).ringen.map((r) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [r] }, properties: props }));
}
// Hulplijnen: stippellijnen evenwijdig met een lijn (bv. parcours), links en rechts op elke afstand.
// Standaardkleur per hulplijn (volgorde van de afstanden); per afstand aan te passen.
export const HULP_KLEUREN = ['#2563EB', '#F97316', '#16A34A', '#DB2777', '#7C3AED', '#0891B2', '#CA8A04', '#DC2626'];
export const hulpKleur = (it, d, i) => it.parameters?.hulpkleuren?.[String(d)] || HULP_KLEUREN[i % HULP_KLEUREN.length];
export function hulplijnenVan(it) {
  const af = (it.parameters?.hulplijnen || []).map(Number).filter((x) => x > 0);
  if (!af.length || it.geometrie?.type !== 'LineString') return [];
  const g = it.parameters?.bogen ? buig(it.geometrie, it.parameters.bogen) : it.geometrie;
  const uit = [];
  af.forEach((d, i) => { const kleur = hulpKleur(it, d, i); for (const k of [1, -1]) { const h = evenwijdig(g, k * d); if (h?.coordinates?.length >= 2) uit.push({ afstand: d, kleur, geometrie: h }); } });
  return uit;
}

// ---------- Tekening per item, met cache ----------
// Wat een item van bovenaf is (zijn features) hangt enkel af van het item zelf, zijn laag, zijn element en een paar
// tekenopties. Items zijn onveranderlijk (elke wijziging maakt een nieuw object), dus de tekening wordt per
// item-object onthouden: na een wijziging wordt alleen dát item opnieuw getekend, de rest komt uit de cache.
// Zo blijft een plan met honderden hekken, tenten en stellingen vlot bij elke verplaatsing.
// Let op: features uit de cache worden gedeeld tussen aanroepen — nooit ter plekke aanpassen, altijd kopiëren.
// Een paar caches naast elkaar (editor, pdf-voorbeeld, deellink hebben elk hun eigen lagen/elementen-maps),
// zodat ze elkaars cache niet telkens leegmaken.
// De laag wordt per item gecontroleerd (c.laag), zodat een laag aan- of uitzetten enkel die laag raakt.
const tekenCaches = [];
function cacheVoor(elementenMap, sleutel) {
  const i = tekenCaches.findIndex((c) => c.elementenMap === elementenMap && c.sleutel === sleutel);
  if (i >= 0) { const c = tekenCaches[i]; if (i > 0) { tekenCaches.splice(i, 1); tekenCaches.unshift(c); } return c.per; }
  const c = { elementenMap, sleutel, per: new WeakMap() };
  tekenCaches.unshift(c);
  if (tekenCaches.length > 4) tekenCaches.pop();
  return c.per;
}
// Features van één item met dezelfde stijl samenvoegen tot één MultiLineString/MultiPolygon: een hek van 100 stukken
// is dan een handvol features in plaats van duizenden, wat de kaart (tegels bouwen, tekenen, aanklikken) veel
// lichter maakt. Elke feature krijgt een eigen id (item-id + volgnummer), zodat de kaartbron per item bijgewerkt kan
// worden in plaats van helemaal opnieuw (zie updateData in Editor).
function samengevoegd(fs, itemId, teller) {
  const uit = []; const groep = new Map(); const n = new Map();
  let vorigeProps = null; let vorigeSleutel = '';
  for (const f of fs) {
    const g = f.geometry; const t = g?.type;
    if (t !== 'LineString' && t !== 'Polygon') { uit.push({ ...f, id: `${itemId}#${teller.n++}` }); continue; }
    if (f.properties !== vorigeProps) { vorigeProps = f.properties; vorigeSleutel = JSON.stringify(f.properties); }
    const k = t + vorigeSleutel;
    let e = groep.get(k);
    if (!e) { e = { type: 'Feature', id: `${itemId}#${teller.n++}`, geometry: { type: t, coordinates: g.coordinates }, properties: f.properties }; groep.set(k, e); n.set(e, 1); uit.push(e); }
    else if (n.get(e) === 1) { e.geometry = { type: `Multi${t}`, coordinates: [e.geometry.coordinates, g.coordinates] }; n.set(e, 2); }
    else e.geometry.coordinates.push(g.coordinates);
  }
  return uit;
}
const dimCache = new WeakMap(); // feature -> gedimde kopie
const metId = (fs, itemId, teller) => fs.map((f) => ({ ...f, id: `${itemId}#${teller.n++}` }));
// Samengevoegde features weer los (voor wie per lijn of vlak tekent, zoals de pdf).
export function losseFeatures(features) {
  const uit = [];
  for (const f of features) {
    const g = f.geometry;
    if (g?.type === 'MultiLineString') for (const c of g.coordinates) uit.push({ ...f, geometry: { type: 'LineString', coordinates: c } });
    else if (g?.type === 'MultiPolygon') for (const c of g.coordinates) uit.push({ ...f, geometry: { type: 'Polygon', coordinates: c } });
    else uit.push(f);
  }
  return uit;
}

export function naarGeojson(items, lagenMap, elementenMap, { verborgenLagen = new Set(), actieveFase = null, verbergElementen = [], doek = true, toebehoren = true, doeknaam = true, heknummers = true, verdieping = null, focus = null, hulplijnen = false } = {}) {
  const verbergEl = new Set(verbergElementen || []);
  let vormen = [];
  let labels = [];
  const naVormen = []; // panelen van infototems: boven op hun totem
  const onderVormen = []; // lichtvlekken: onder alles
  // Gestapelde units: hogere verdiepingen worden boven de lagere getekend.
  const verdVan = (x) => Number(x.velden?.verdieping) || 0;
  const lijst = [...items].sort((a, b) => verdVan(a) - verdVan(b) || (Number(a.volgorde) || 0) - (Number(b.volgorde) || 0));
  const cache = cacheVoor(elementenMap, [doek, toebehoren, doeknaam, heknummers, hulplijnen].join());
  const ctx = { lagenMap, elementenMap, doek, toebehoren, doeknaam, heknummers, hulplijnen };
  const getoond = [];
  for (const it of lijst) {
    if (it.verborgen) continue;
    if (it.element_id && verbergEl.has(it.element_id)) continue;
    if (it.laag_id && verborgenLagen.has(it.laag_id)) continue;
    if (actieveFase && it.fase_ids?.length && !it.fase_ids.includes(actieveFase)) continue;
    if (!it.geometrie) continue;
    getoond.push(it);
    const laag = lagenMap.get(it.laag_id);
    let c = cache.get(it);
    if (c && c.laag !== laag) c = null;
    if (!c) {
      const t = { vormen: [], labels: [], naVormen: [] };
      tekenItem(it, ctx, t);
      const t2 = { vormen: [], labels: [], naVormen: [] };
      tekenItemExtra(it, ctx, t2);
      const el = it.element_id ? elementenMap.get(it.element_id) : null;
      const teller = { n: 0 };
      c = {
        laag,
        vormen: samengevoegd(t.vormen, it.id, teller), labels: metId(t.labels, it.id, teller), naVormen: samengevoegd(t.naVormen, it.id, teller),
        vormen2: samengevoegd(t2.vormen, it.id, teller), labels2: metId(t2.labels, it.id, teller), naVormen2: samengevoegd(t2.naVormen, it.id, teller),
        onder: it.velden?.licht?.aan && isLichtmast(el) ? metId(lichtVlekken(it, el), it.id, teller) : [],
      };
      cache.set(it, c);
    }
    for (const f of c.vormen) vormen.push(f);
    for (const f of c.labels) labels.push(f);
    for (const f of c.naVormen) naVormen.push(f);
  }
  // Maatlijnen, zones, oppervlakte en gele vlaggen in een tweede ronde, boven alles.
  for (const it of getoond) {
    const c = cache.get(it);
    for (const f of c.vormen2) vormen.push(f);
    for (const f of c.labels2) labels.push(f);
    for (const f of c.naVormen2) naVormen.push(f);
    for (const f of c.onder) onderVormen.push(f);
  }
  // Lichtmasten die aan staan: lichtvlek onder alles (zie licht.js).
  if (onderVormen.length) vormen = [...onderVormen, ...vormen];
  // Verdiepingen: label "+1" op gestapelde units; bij een filter wordt de rest gedimd.
  const verd = new Map(lijst.filter((x) => verdVan(x) > 0).map((x) => [x.id, verdVan(x)]));
  for (const it of lijst) {
    const v = verd.get(it.id);
    if (!v || it.verborgen || !it.geometrie || it.geometrie.type === 'Point' || (verdieping != null && v !== verdieping)) continue;
    try { labels.push({ type: 'Feature', id: `${it.id}#verd`, geometry: turf.centroid(it.geometrie).geometry, properties: { id: it.id, soort: 'verdieping', label: `+${v}` } }); } catch {}
  }
  vormen.push(...naVormen);
  if (verdieping != null || focus) {
    // Gedimd: kopieën (gecachet per feature, zodat ook die stabiel blijven voor de kaartbron); de cache zelf blijft onaangeroerd.
    const dim = (f) => {
      const id = f.properties?.id; if (!id) return f;
      if (focus ? focus.has(id) && (verdieping == null || (verd.get(id) || 0) === verdieping) : (verd.get(id) || 0) === verdieping) return f;
      let g = dimCache.get(f);
      if (g) return g;
      const p = { ...f.properties };
      if (typeof p.dekking === 'number') p.dekking *= 0.2; else p.dekking = 0.2;
      if (typeof p.vuldekking === 'number') p.vuldekking *= 0.2;
      if (p.soort !== 'verdieping') p.gedimd = true;
      g = { ...f, properties: p };
      dimCache.set(f, g);
      return g;
    };
    vormen = vormen.map(dim); labels = labels.map(dim);
  }
  return { vormen: { type: 'FeatureCollection', features: vormen }, labels: { type: 'FeatureCollection', features: labels } };
}

// Eén item tekenen (eerste ronde): alle vormen en labels van bovenaf.
function tekenItem(it, { lagenMap, elementenMap, doek, toebehoren, doeknaam, heknummers, hulplijnen }, { vormen, labels, naVormen }) {
  {
    const laag = lagenMap.get(it.laag_id);
    const el = it.element_id ? elementenMap.get(it.element_id) : null;
    const s = effectieveStijl(it, laag, el);
    let g = it.geometrie;
    if (!g) return;
    if (it.parameters?.bogen && g.type !== 'Point') g = buig(g, it.parameters.bogen);
    const vorm = g.type === 'Point' ? 'punt' : g.type === 'LineString' ? 'lijn' : 'vlak';
    if (Number(s.afronden) > 0 && vorm !== 'punt' && !['rechthoek', 'cirkel', 'ellips'].includes(it.soort) && !(it.soort === 'element' && vorm !== 'lijn')) g = rondHoeken(g, Number(s.afronden));
    const basis = {
      id: it.id, vorm, soort: it.soort, kleur: s.kleur, dikte: Number(s.dikte) || 1,
      dikte_m: s.dikte_eenheid === 'm' ? Number(s.dikte) || 1 : 0,
      streep: s.streep || 'vol', dekking: s.dekking ?? 1, wit_rand: !!s.wit_rand,
      vulkleur: s.vulkleur, vuldekking: s.vulpatroon === 'geen' ? 0 : (s.vuldekking ?? 0.2), vulpatroon: s.vulpatroon || 'effen',
      patroon: patroonNaam(s),
      tekst: it.soort === 'tekst' ? (it.naam || 'Tekst') : '',
      tekstgrootte: Number(s.tekstgrootte) || 12, tekst_rot: Number(s.tekst_rot) || 0, vet: it.soort === 'tekst' ? s.vet !== false : !!s.vet, cursief: !!s.cursief, achtergrond: !!s.achtergrond,
      vanaf_zoom: Number(s.vanaf_zoom) || 0,
      icoon: vorm === 'punt' && s.icoon ? s.icoon : '', icoon_m: vorm === 'punt' && Number(s.icoon_m) > 0 ? Number(s.icoon_m) : 0, nr: vorm === 'punt' && it.velden?.nr != null ? String(it.velden.nr) : '',
    };
    if (hulplijnen && vorm === 'lijn' && it.parameters?.hulplijnen?.length) {
      // Niet aanklikbaar (geen id), enkel op het scherm.
      for (const h of hulplijnenVan(it)) {
        vormen.push({ type: 'Feature', geometry: h.geometrie, properties: { ...basis, kleur: h.kleur, id: '', hulp: true, dikte: 1.2, dikte_m: 0, streep: 'streep', dekking: 0.75, wit_rand: false, patroon: '' } });
        labels.push({ type: 'Feature', geometry: h.geometrie, properties: { id: '', soort: 'hulpmaat', label: `${getal(h.afstand)} m`, kleur: h.kleur } });
      }
    }
    if (it.soort === 'element' && vorm === 'vlak' && (isTotem(el) || trussDoek(el) === 'kubus') && doek) {
      const t = totemFeatures(it, el, elementenMap, basis, heknummers);
      naVormen.push(...t.vormen); labels.push(...t.labels);
    }
    if (it.soort === 'element' && isVlag(el) && doek) naVormen.push(...vlagFeatures(it, el, elementenMap, basis));
    if (it.soort === 'notitie' && g.type === 'LineString' && g.coordinates.length >= 2) {
      const c = g.coordinates;
      const nd = it.stijl?.dikte ? basis.dikte : 1.2;
      vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, dikte: nd, dikte_m: 0 } });
      labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c[0] }, properties: { id: it.id, soort: 'pijl', kleur: s.kleur, rot: richtingBij(g, false), dikte: Math.max(1.6, nd), wit_rand: !!s.wit_rand } });
      labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c[c.length - 1] }, properties: { id: it.id, soort: 'label', punt: false, label: it.naam || 'Notitie', kleur: s.kleur, tekstgrootte: Number(s.tekstgrootte) || 12, tekst_rot: 0, vet: !!s.vet, cursief: !!s.cursief, achtergrond: true, notitie: true } });
      return;
    }
    const plaatItem = it.soort === 'element' && el?.eigenschappen?.module && (vorm === 'lijn' || (vorm === 'vlak' && it.parameters?.midden && it.parameters?.breedte && !modules(it, el)?.rij));
    if (plaatItem) {
      // Rijplaten: elke plaat apart, zodat de overlap zichtbaar is (dubbel gekleurd).
      const pl = platen(it, el);
      // Grondbescherming (rijplaten, betonplaten, vloeren) ligt op de grond: altijd onder de rest
      // getekend, zodat trucks en tenten erop niet doorschijnend lijken.
      const onder = !!el.eigenschappen?.vloer;
      if (vorm === 'vlak') vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, onder, vuldekking: 0.01, dekking: pl.ringen.length ? 0 : 1 } });
      else vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, onder, dekking: 0.5, dikte: 1, dikte_m: 0, streep: 'streep', wit_rand: false, patroon: '' } });
      const dun = { ...basis, onder, vorm: 'vlak', dikte: Math.max(0.5, basis.dikte * 0.6), dikte_m: 0, streep: 'vol', wit_rand: false, patroon: '', vulpatroon: 'effen' };
      const vakTek = pl.stukken?.length ? el.eigenschappen.tekening : null;
      if (vakTek) {
        // Modules met een eigen tekening (stellingvakken, tribunevakken): elk vak zijn tekening.
        let tk = pasTekeningAan(vakTek, it, el);
        // Trap/helling in banen: geen pijltje per element, wel één grote pijl per buitenbaan.
        if (pl.pijlen) tk = { ...tk, lijnen: (tk.lijnen || []).filter((l) => String(l.k).toLowerCase() !== '#ffffff') };
        // Per vak een ander element van hetzelfde formaat (bv. een trap of helling in een stellingvloer).
        // Een groter element (bv. een tribunevak) kan meerdere vakken beslaan: { id, w, h } op het
        // eerste vak, { in: 'i,j' } op de andere.
        const ander = it.parameters?.vakken || {};
        const perVak = new Map(pl.stukken.filter((x) => x.vak).map((x) => [x.vak, x]));
        const r90 = Number(it.parameters?.module_rot) === 90;
        // Tent met vloer: eerst de vloer, daarover het tentdak licht doorschijnend en de tentlijnen.
        const tentVl = vorm === 'vlak' ? vloerInTent(it, elementenMap, basis) : [];
        if (tentVl.length) vormen.push(...tentVl);
        const dakOver = (fs) => (tentVl.length ? fs.map((f) => (f.properties?.vorm === 'vlak' && Number(f.properties.vuldekking) > 0.8 ? { ...f, properties: { ...f.properties, vuldekking: 0.8 } } : f)) : fs);
        for (const st of pl.stukken) {
          const v = st.vak ? ander[st.vak] : null;
          if (v?.in) continue;
          const ovId = typeof v === 'string' ? v : v?.id;
          const ov = ovId ? elementenMap.get(ovId) : null;
          const t2 = ov?.eigenschappen?.tekening ? pasTekeningAan(ov.eigenschappen.tekening, it, ov) : tk;
          const ref = ov?.eigenschappen?.tekening || vakTek;
          let par = st;
          if (v?.id && (v.w > 1 || v.h > 1)) {
            const [i0, j0] = st.vak.split(',').map(Number);
            const ver = perVak.get(`${i0 + v.w - 1},${j0 + v.h - 1}`) || st;
            par = { ...st, midden: [(st.midden[0] + ver.midden[0]) / 2, (st.midden[1] + ver.midden[1]) / 2], breedte: st.breedte * (r90 ? v.h : v.w), diepte: st.diepte * (r90 ? v.w : v.h) };
          }
          vormen.push(...dakOver(tekeningFeatures(t2, { id: it.id, parameters: par }, { breedte_m: ref.b, diepte_m: ref.h }, basis).vormen));
        }
        for (const c of pl.pijlen || []) vormen.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: { ...basis, vorm: 'lijn', kleur: '#ffffff', dekking: 1, dikte: 3, dikte_m: 0.14, streep: 'vol', wit_rand: false, patroon: '', tekening: true } });
      } else {
        // Stalen rijplaten: donker en roestig, elke plaat een iets andere tint (tenzij het item een eigen kleur heeft).
        const roest = el.eigenschappen?.materiaal === 'staal' && !it.stijl?.vulkleur ? ['#3E2619', '#4F2E1A', '#33201A', '#5A3420'] : null;
        pl.ringen.forEach((r, i) => vormen.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [r] }, properties: roest ? { ...dun, vulkleur: roest[(i * 7 + (i >> 2)) % roest.length] } : dun }));
      }
    } else if (vorm === 'lijn' && it.soort === 'element' && el?.tekenwijze === 'lijn' && isStellingBouw(it)) {
      // Stellingconstructie (stellingbouwer): de vakken van bovenaf, met leuningen en doeken.
      vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, dekking: 0.01, wit_rand: false } });
      vormen.push(...stellingFeatures(it, basis));
    } else if (vorm === 'lijn' && it.soort === 'element' && el?.tekenwijze === 'lijn' && isTrussBouw(it)) {
      // Vrij gebouwde truss (trussbouwer): de stukken van bovenaf, met hoekstukken en baseplates.
      vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, dekking: 0.01, wit_rand: false } });
      vormen.push(...trussFeatures(it, el, basis));
    } else if (vorm === 'lijn') {
      if (s.vloeiend) g = vloeiend(g);
      const afst = Number(s.dubbel) || 0;
      const lijnEl = it.soort === 'element' && el?.tekenwijze === 'lijn' ? el : null;
      // Hekken zonder eigen tekening: minstens 3 px dik.
      if (isHekElement(lijnEl) && !(basis.dikte_m > 0)) basis.dikte = Math.max(3, basis.dikte);
      const dk = doek && lijnEl ? doekVan(lijnEl) : null;
      // Doek per hek: op een hek "bedrukt doek", maar ook op elk ander Heras (een sponsordoek over wit of zwart gezeild).
      const perHek = !!lijnEl && doek && Array.isArray(it.velden?.doeken) && Number(lijnEl.eenheid_m) > 0 && (dk?.soort === 'bedrukt' || ((isVlagHek(lijnEl) || isDrape(lijnEl)) && it.velden.doeken.some(Boolean)));
      const zonderDoek = dk?.soort === 'bedrukt' ? { soort: 'wit', kleur: '#ffffff', rand: '#B9BCC1' } : (dk || zeilVanNaam(lijnEl));
      if (lijnEl && isWand(lijnEl)) vormen.push(...wandFeatures(it, lijnEl, elementenMap, basis));
      else if (perHek) {
        // Elk hek zijn eigen doek uit de doekenbibliotheek.
        const naden = nadenVan(it.geometrie, lijnEl, it.parameters?.bogen, it.parameters?.openingen);
        for (let i = 0; i < naden.length - 1 && i < 1500; i++) {
          const seg = hekStuk(naden, i) || { type: 'LineString', coordinates: [hekBegin(naden, i), naden[i + 1].p] };
          const dId = it.velden.doeken[i];
          const dEl = dId ? elementenMap.get(dId) : null;
          const band = dEl ? { soort: 'bedrukt', kleur: dEl.eigenschappen?.kleur || '#E11D48', dekking: 0.7 } : zonderDoek;
          if (band) vormen.push(...doekBand(seg, band, basis));
          if (heknummers) labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: turf.midpoint(hekBegin(naden, i), naden[i + 1].p).geometry.coordinates }, properties: { id: it.id, soort: 'heknr', label: String(i + 1), kleur: dEl?.eigenschappen?.kleur || '#686D76' } });
        }
      } else if (dk) {
        vormen.push(...doekBand(g, dk, basis));
        if (doeknaam && dk.soort === 'bedrukt' && it.velden?.doek_naam) labels.push({ type: 'Feature', geometry: g, properties: { id: it.id, soort: 'doeknaam', label: it.velden.doek_naam, kleur: dk.kleur, tekstgrootte: 11 } });
      }
      if (lijnEl && doek && isVlagHek(lijnEl)) naVormen.push(...hekVlagFeatures(it, lijnEl, elementenMap, basis));
      if (lijnEl && doek && trussDoek(lijnEl) === 'boog') { const t = boogFeatures(it, lijnEl, elementenMap, basis, heknummers); naVormen.push(...t.vormen); labels.push(...t.labels); }
      const stukTek = lijnEl?.eigenschappen?.tekening && Number(lijnEl.eenheid_m) > 0 ? metMontage(lijnEl.eigenschappen.tekening, it, lijnEl) : null;
      if (stukTek && g.coordinates.length >= 2) {
        // Gedetailleerd lijnelement (bv. Boplan): de tekening van één stuk
        // herhaald langs de lijn. De lijn zelf blijft aanklikbaar.
        vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, dekking: 0.01, dikte: 8, dikte_m: 0, wit_rand: false } });
        // Hekken: een zichtlijn in de kleur van het hek, zodat ze ook uitgezoomd goed zichtbaar zijn
        // (de tekening op ware grootte is dan maar een haarlijn). Ver ingezoomd vervaagt ze.
        const koord = koordVan(it);
        // Stukken (de tekening per hek, toebehoren, koord) staan in eigen kaartlagen die pas vanaf zoom 16,5
        // tekenen (property 'stuk'): uitgezoomd zijn het haarlijntjes die enkel de kaart zwaar maken. Tot daar
        // toont de zichtlijn het element; bij andere lijnelementen dan hekken enkel tot de stukken verschijnen.
        const stukBasis = { ...basis, stuk: true };
        const openingen = openingenVan(it.parameters);
        {
          const hek = isHekElement(lijnEl);
          const zicht = { ...basis, dekking: 0.9, dikte: hek ? 3.5 : 2.5, dikte_m: 0, wit_rand: false, streep: 'vol', patroon: '', zicht: hek ? true : 'laag' };
          if (!koord.size && !openingen.length) vormen.push({ type: 'Feature', geometry: g, properties: zicht });
          else { const cc = it.geometrie.coordinates; for (let k = 0; k < cc.length - 1; k++) if (!koord.has(k)) for (const dl of hekDelen(cc, k, it.parameters?.bogen, openingen)) if (dl.run) vormen.push({ type: 'Feature', geometry: dl.run, properties: zicht }); }
        }
        // Per recht stuk van de lijn, zodat elk stuk evenwijdig blijft en de hoeken netjes aansluiten.
        // Een stuk met een opening (deur, poort) valt uiteen in de delen ervoor en erna.
        const e = Number(lijnEl.eenheid_m); const d = Number(lijnEl.diepte_m) || stukTek.h;
        const spiegel = hekGespiegeld(it); // pootjes/voet aan de andere kant
        const opt = { units: 'meters' };
        const c = it.geometrie.coordinates; const bg = it.parameters?.bogen;
        let totaal = 0; let eerste = null; let laatste = null;
        for (let k = 0; k < c.length - 1 && totaal < 600; k++) for (const seg of (openingen.some((o) => Number(o.k) === k) ? hekDelen(c, k, bg, openingen).map((x) => x.run).filter(Boolean) : [{ type: 'LineString', coordinates: boogPunten(c[k], c[k + 1], Number(bg?.[k]) || 0) }])) {
          const L = lengte(seg);
          if (L < 0.01) continue;
          if (koord.has(k)) {
            // Paal en koord: geen net, een dun koord tussen de palen.
            vormen.push({ type: 'Feature', geometry: seg, properties: { ...stukBasis, kleur: '#854D0E', dekking: 1, dikte: 3.2, dikte_m: 0.06, streep: 'vol', wit_rand: true, patroon: '', tekening: true } });
            if (stukTek.naad) { const r0 = turf.bearing(c[k], c[k + 1]) - 90; vormen.push(...tekeningFeatures(stukTek.naad, { id: it.id, parameters: { midden: c[k], rot: r0, breedte: stukTek.naad.b, diepte: stukTek.naad.h, spiegel_y: spiegel } }, { breedte_m: stukTek.naad.b, diepte_m: stukTek.naad.h }, stukBasis).vormen); }
            totaal += 1;
            continue;
          }
          const n = Math.min(600 - totaal, paalPerPunt(lijnEl) ? 1 : segN(L, e));
          const stap = L / n;
          for (let i = 0; i < n; i++) {
            const midden = turf.along(seg, (i + 0.5) * stap, opt).geometry.coordinates;
            const rot = turf.bearing(turf.along(seg, i * stap, opt).geometry.coordinates, turf.along(seg, (i + 1) * stap, opt).geometry.coordinates) - 90;
            const par = { midden, rot, breedte: stap, diepte: d, spiegel_y: spiegel };
            if (!eerste) eerste = par; laatste = par;
            const t = tekeningFeatures(stukTek, { id: it.id, parameters: par }, { breedte_m: stukTek.b, diepte_m: stukTek.h }, stukBasis);
            vormen.push(...t.vormen);
            // Naad (bv. een paal tussen twee netten): op het begin van elk stuk, niet mee uitgerekt.
            if (stukTek.naad) vormen.push(...tekeningFeatures(stukTek.naad, { id: it.id, parameters: { midden: turf.along(seg, i * stap, opt).geometry.coordinates, rot, breedte: stukTek.naad.b, diepte: stukTek.naad.h, spiegel_y: spiegel } }, { breedte_m: stukTek.naad.b, diepte_m: stukTek.naad.h }, stukBasis).vormen);
            if (s.tekening_tekst !== false) labels.push(...t.labels);
          }
          totaal += n;
        }
        const voet = voetVan(stukTek);
        const par = voet && (voet.plek === 'einde' ? laatste : eerste);
        if (par) vormen.push(...tekeningFeatures(voet.tek, { id: it.id, parameters: par }, { breedte_m: stukTek.b, diepte_m: stukTek.h }, stukBasis).vormen);
        // Truss e.d.: een eigen tekening op elk uiteinde (toren, voet) en in elke hoek (hoekstuk).
        const zet = (tk, punt, rot) => { if (tk) vormen.push(...tekeningFeatures(tk, { id: it.id, parameters: { midden: punt, rot, breedte: tk.b, diepte: tk.h, spiegel_y: spiegel } }, { breedte_m: tk.b, diepte_m: tk.h }, stukBasis).vormen); };
        const brg = (a, b) => turf.bearing(a, b) - 90;
        if (c.length >= 2) {
          const hk = metMontage(stukTek.hoek, it, lijnEl);
          for (let k = 1; k < c.length - 1; k++) zet(hk, c[k], brg(c[k - 1], c[k]));
          const ei = metMontage(stukTek.einde, it, lijnEl);
          if (ei) { zet(ei, c[0], brg(c[0], c[1])); zet(ei, c[c.length - 1], brg(c[c.length - 2], c[c.length - 1])); }
        }
      } else if (lijnEl && Number(lijnEl.diepte_m) >= 0.05) {
        // Lijnelement met een echte breedte op de grond.
        vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, dikte_m: Number(lijnEl.diepte_m), dikte: Number(lijnEl.diepte_m) } });
      } else if (afst > 0) {
        for (const kant of [afst / 2, -afst / 2]) { const o = evenwijdig(g, kant); if (o) vormen.push({ type: 'Feature', geometry: o, properties: basis }); }
      } else vormen.push({ type: 'Feature', geometry: g, properties: lijnEl && isWand(lijnEl) && isVrij(it) ? { ...basis, dekking: 0.01, wit_rand: false } : basis }); // vrij gebouwde wand: de lijn is enkel nog het ankerpunt
      if (toebehoren && lijnEl && Number(lijnEl.eenheid_m) > 0) vormen.push(...toebehorenFeatures(it, lijnEl, basis));
      // Pijlpunten
      if (s.pijl && s.pijl !== 'geen' && g.coordinates.length >= 2) {
        const c = g.coordinates;
        if (s.pijl === 'einde' || s.pijl === 'beide') labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c[c.length - 1] }, properties: { id: it.id, soort: 'pijl', kleur: s.kleur, rot: richtingBij(g, true), dikte: basis.dikte, wit_rand: basis.wit_rand } });
        if (s.pijl === 'begin' || s.pijl === 'beide') labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c[0] }, properties: { id: it.id, soort: 'pijl', kleur: s.kleur, rot: richtingBij(g, false), dikte: basis.dikte, wit_rand: basis.wit_rand } });
      }
      // Maatlijn: streepjes aan de uiteinden en de lengte langs de lijn.
      if (s.maatlijn && g.coordinates.length >= 2) {
        const c = g.coordinates;
        for (const [p, q] of [[c[0], c[1]], [c[c.length - 1], c[c.length - 2]]]) {
          const r = turf.bearing(p, q);
          const a = turf.destination(p, 1.2, r + 90, { units: 'meters' }).geometry.coordinates;
          const b = turf.destination(p, 1.2, r - 90, { units: 'meters' }).geometry.coordinates;
          vormen.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: { ...basis, streep: 'vol', wit_rand: false } });
        }
        labels.push({ type: 'Feature', geometry: g, properties: { id: it.id, soort: 'langs', label: `${getal(lengte(g))} m`, kleur: s.kleur, tekstgrootte: Number(s.tekstgrootte) || 12 } });
      }
      // Patroonlijn: een symbool om de x meter.
      if ((s.patroon_icoon || s.patroon_tekst) && Number(s.patroon_interval) > 0) {
        const n = lengte(g) / Number(s.patroon_interval);
        if (n <= 2000) {
          for (const { punt, richting } of puntenLangs(g, Number(s.patroon_interval))) {
            labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: punt }, properties: { id: it.id, soort: 'patroon', icoon: s.patroon_icoon || '', label: s.patroon_tekst || '', kleur: s.kleur, rot: richting - 90, tekstgrootte: Number(s.tekstgrootte) || 12 } });
          }
        }
      }
    } else if (vorm === 'vlak' && it.soort === 'element' && el?.eigenschappen?.tekening) {
      // Gedetailleerde tekening: de omtrek blijft (bijna) onzichtbaar maar aanklikbaar.
      vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, vuldekking: 0.01, vulkleur: '#ffffff', patroon: '', dekking: 0 } });
      const n = Number(it.parameters?.aantal) > 1 && it.parameters?.midden ? Math.round(Number(it.parameters.aantal)) : 1;
      if (n > 1) {
        // Rij: dezelfde tekening n keer naast elkaar.
        const p0 = it.parameters; const tus = Math.max(0, Number(p0.tussen) || 0); const stuk = (Number(p0.breedte) - (n - 1) * tus) / n;
        const T = plaatser(p0.midden, Number(p0.rot) || 0);
        for (let i = 0; i < n && i < 200; i++) {
          const tk = pasTekeningAan(el.eigenschappen.tekening, it, el, i);
          const t = tekeningFeatures(tk, { id: it.id, parameters: { ...p0, midden: T([-Number(p0.breedte) / 2 + i * (stuk + tus) + stuk / 2, 0]), breedte: stuk } }, el, basis);
          vormen.push(...t.vormen);
          if (s.tekening_tekst !== false) labels.push(...t.labels);
        }
      } else {
        const tk = pasTekeningAan(el.eigenschappen.tekening, it, el);
        // Opgebouwde tekening: in ware maat, niet herschalen naar de standaardmaat van het element.
        // tekening_rekken: één tekening voor elementen van verschillende maat (bv. zones in een TV-compound).
        const t = tekeningFeatures(tk, it, el.eigenschappen.generator || el.eigenschappen.tekening_rekken || el.eigenschappen.inzet === 'poort' ? { ...el, breedte_m: tk.b, diepte_m: tk.h } : el, basis);
        // Vloer in de tent: eerst de vloer, dan het tentdak er licht doorschijnend over en de tentlijnen (spanten, nok, palen)
        // bovenaan, zodat je een tent met een vloer ziet en niet enkel een vloer.
        const vl = vloerInTent(it, elementenMap, basis);
        if (vl.length) { vormen.push(...vl); vormen.push(...t.vormen.map((f) => (f.properties?.vorm === 'vlak' && Number(f.properties.vuldekking) > 0.8 ? { ...f, properties: { ...f.properties, vuldekking: 0.8 } } : f))); } else vormen.push(...t.vormen);
        if (s.tekening_tekst !== false) labels.push(...t.labels);
      }
    } else {
      const mod = it.soort === 'element' ? modules(it, el) : null;
      if (mod?.rij && mod.tussen > 0 && it.parameters?.midden) {
        // Rij met tussenruimte: elk stuk apart, de omtrek blijft (bijna) onzichtbaar maar aanklikbaar.
        vormen.push({ type: 'Feature', geometry: g, properties: { ...basis, vuldekking: 0.01, dekking: 0 } });
        const p0 = it.parameters; const T = plaatser(p0.midden, Number(p0.rot) || 0); const B = Number(p0.breedte); const D = mod.md;
        for (let i = 0; i < mod.nx && i < 500; i++) {
          const x0 = -B / 2 + i * (mod.mb + mod.tussen); const x1 = x0 + mod.mb;
          const ring = [[x0, -D / 2], [x1, -D / 2], [x1, D / 2], [x0, D / 2], [x0, -D / 2]].map(T);
          vormen.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: basis });
        }
      } else {
        vormen.push({ type: 'Feature', geometry: g, properties: basis });
        if (mod && mod.stuks > 1) vormen.push(...naadFeatures(it, mod, basis));
      }
      if (vorm === 'vlak' && s.vulpatroon === 'trap') vormen.push(...trapFeatures(it, basis, s.trap_richting || 'x', Number(s.trede) || 0.3));
    }
    if (it.soort !== 'tekst' && s.label === true && (it.naam || el)) {
      const m = maten(it, el);
      const naam = it.naam || el?.naam || '';
      const extra = (el?.tekenwijze === 'lijn' || isRijpad(it, el)) && m.stuks != null ? `${getal(m.lengte)} m · ${m.stuks} st.${m.fietsen != null ? ` · ${m.fietsen} fietsen` : ''}` : '';
      const maat = m.breedte && m.diepte ? `${getal(m.breedte)} × ${getal(m.diepte)} m` : '';
      if (vorm === 'lijn' && s.tekst_langs) {
        labels.push({ type: 'Feature', geometry: g, properties: { id: it.id, soort: 'langs', label: naam, kleur: s.kleur, tekstgrootte: Number(s.tekstgrootte) || 12 } });
      } else {
        const p = middelpunt(g);
        const oppT = s.opp && vorm === 'vlak' ? `${getal(oppervlakte(g), 0)} m²` : '';
        if (p) labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { id: it.id, soort: 'label', punt: vorm === 'punt', label: [naam, extra, oppT].filter(Boolean).join('\n'), maat, kleur: s.kleur, tekstgrootte: Number(s.tekstgrootte) || 12, tekst_rot: vorm === 'vlak' ? Number(s.tekst_rot) || 0 : 0, vet: !!s.vet, cursief: !!s.cursief, achtergrond: !!s.achtergrond } });
      }
    }
    // Kabelcam: verreikers aan de uiteinden, de camera op de kabel met haar kijkhoek.
    if (it.soort === 'element' && vorm === 'lijn' && isKabelcam(el)) { const kc = kabelcamFeatures(it, el, elementenMap, basis); vormen.push(...kc.vormen); labels.push(...kc.labels); }
    // Camerastelling (bibliotheek of gebouwd) of een losse TV-camera: uitgezoomd (tot CAMERA_ZOOM) een paars bolletje
    // met label zoals een camerapunt ("CAM4 86x op 1,5 m"); van daar af de eigen tekening. minz/maxz = zoomvenster per feature.
    if (it.soort === 'element' && vorm !== 'punt' && (isCameraStelling(el, it) || isLosseCamera(el))) {
      for (const lijst of [vormen, labels, naVormen]) for (let k = 0; k < lijst.length; k++) lijst[k] = { ...lijst[k], properties: { ...lijst[k].properties, minz: CAMERA_ZOOM } };
      const p = it.velden?.stelling?.camera ? stellingCameraPunt(it) : middelpunt(g);
      if (p) {
        vormen.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { ...basis, vorm: 'punt', soort: 'camstip', kleur: '#7C3AED', dekking: 0.85, icoon: '', icoon_m: 0, nr: '', minz: CAMERA_MIN, maxz: CAMERA_ZOOM } });
        labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { id: it.id, soort: 'label', punt: true, label: camStipTekst(it, el), maat: '', kleur: '#7C3AED', tekstgrootte: 11, tekst_rot: 0, vet: true, cursief: false, achtergrond: false, minz: CAMERA_MIN, maxz: CAMERA_ZOOM } });
      }
    }
  }
}

// Tweede ronde per item: maatlijnen, zone, oppervlakte en gele vlaggen, boven alles.
function tekenItemExtra(it, { lagenMap, elementenMap }, { vormen, labels, naVormen }) {
  {
    const s2 = effectieveStijl(it, lagenMap.get(it.laag_id), it.element_id ? elementenMap.get(it.element_id) : null);
    if (it.parameters?.vlag || it.parameters?.vlagBegin || it.parameters?.vlagEind || it.parameters?.vlaggen?.length) naVormen.push(...geleVlagFeatures(it, { id: it.id, soort: 'vlag', tekst: '', tekstgrootte: 12, icoon: '', icoon_m: 0, nr: '' }));
    if (Number(s2.zone_m) > 0) {
      try {
        const z = turf.buffer(turf.feature(it.parameters?.bogen ? buig(it.geometrie, it.parameters.bogen) : it.geometrie), Number(s2.zone_m), { units: 'meters', steps: 16 });
        if (z?.geometry) vormen.push({ type: 'Feature', geometry: z.geometry, properties: { id: it.id, vorm: 'vlak', soort: 'zone', kleur: s2.kleur, dikte: 1, dikte_m: 0, streep: 'streep', dekking: 0.9, wit_rand: false, vulkleur: s2.kleur, vuldekking: 0.06, vulpatroon: 'effen', patroon: '', tekst: '', tekstgrootte: 11, icoon: '', icoon_m: 0, nr: '' } });
      } catch {}
    }
    if (s2.maten && it.geometrie.type !== 'Point') {
      const m = matenFeatures(it, it.geometrie, { id: it.id, soort: 'maat', vulkleur: '#000', vuldekking: 0, vulpatroon: 'effen', tekstgrootte: 11, icoon: '', icoon_m: 0, nr: '' });
      vormen.push(...m.vormen); labels.push(...m.labels);
    }
    const naamGetoond = it.soort !== 'tekst' && (it.naam || it.element_id) && s2.label === true;
    if (s2.opp && it.geometrie.type === 'Polygon' && !naamGetoond) {
      const mp = middelpunt(it.geometrie);
      if (mp) labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: mp }, properties: { id: it.id, soort: 'label', punt: false, label: `${getal(oppervlakte(it.geometrie), 0)} m²`, kleur: '#1d1d1b', tekstgrootte: 11, tekst_rot: 0, vet: false, cursief: false, achtergrond: true, opp: true } });
    }
  }
}

const breedte = (lat, extra = 0) => {
  // Lijndikte in meter omzetten naar pixels, over alle zoomniveaus.
  // 'extra' (px) zit binnen de stops: zoom mag enkel bovenaan in interpolate staan.
  const mpp0 = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 512;
  const stop = (mpp) => {
    const w = ['case', ['>', ['get', 'dikte_m'], 0], ['/', ['get', 'dikte_m'], mpp], ['get', 'dikte']];
    return extra ? ['+', w, extra] : w;
  };
  return ['interpolate', ['exponential', 2], ['zoom'], 0, stop(mpp0), 24, stop(mpp0 / 2 ** 24)];
};

// Lettertype per tekst: cursief, vet of normaal (OpenFreeMap levert Noto Sans).
const FONT = ['case', ['==', ['get', 'cursief'], true], ['literal', ['Noto Sans Italic']], ['==', ['get', 'vet'], true], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]];
const FONT_LABEL = ['case', ['==', ['get', 'cursief'], true], ['literal', ['Noto Sans Italic']], ['literal', ['Noto Sans Bold']]];

// Vanaf dit zoomniveau tekenen de stukken van lijnelementen (hekken per stuk, toebehoren).
export const STUK_ZOOM = 16.5;
export function kaartLagen(lat = 51) {
  const lijnVormen = ['any', ['==', ['get', 'vorm'], 'lijn'], ['==', ['get', 'vorm'], 'vlak']];
  const nietOnder = ['!=', ['get', 'onder'], true];
  const isStuk = ['==', ['get', 'stuk'], true]; const nietStuk = ['!=', ['get', 'stuk'], true];
  const lagen = [
    // Licht van lichtmasten: helemaal onderaan, warmgeel, naar buiten toe zwakker.
    { id: 'fm-lichtvlek', type: 'fill', source: 'fm-vormen', filter: ['==', ['get', 'soort'], 'lichtvlek'], paint: { 'fill-color': '#FACC15', 'fill-opacity': ['get', 'vuldekking'], 'fill-antialias': false } },
    { id: 'fm-lichtrand', type: 'line', source: 'fm-vormen', filter: ['==', ['get', 'soort'], 'lichtrand'], paint: { 'line-color': '#CA8A04', 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': 0.8 } },
    { id: 'fm-lichtrand-tx', type: 'symbol', source: 'fm-vormen', minzoom: 15, filter: ['==', ['get', 'soort'], 'lichtrand'],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 400, 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-keep-upright': true },
      paint: { 'text-color': '#854D0E', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } },
    // Grondbescherming eerst (onderaan): vulling en randen van de platen.
    { id: 'fm-vloer', type: 'fill', source: 'fm-vormen', filter: ['all', ['==', ['get', 'vorm'], 'vlak'], ['==', ['get', 'onder'], true]],
      paint: { 'fill-color': ['get', 'vulkleur'], 'fill-opacity': ['get', 'vuldekking'] } },
    { id: 'fm-vloer-lijn', type: 'line', source: 'fm-vormen', filter: ['all', lijnVormen, ['==', ['get', 'onder'], true]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': ['get', 'kleur'], 'line-width': breedte(lat), 'line-opacity': ['get', 'dekking'] } },
    { id: 'fm-vulling', type: 'fill', source: 'fm-vormen', filter: ['all', ['==', ['get', 'vorm'], 'vlak'], ['==', ['get', 'patroon'], ''], nietOnder, nietStuk],
      paint: { 'fill-color': ['get', 'vulkleur'], 'fill-opacity': ['get', 'vuldekking'] } },
    { id: 'fm-patroon', type: 'fill', source: 'fm-vormen', filter: ['all', ['==', ['get', 'vorm'], 'vlak'], ['!=', ['get', 'patroon'], ''], nietOnder],
      paint: { 'fill-pattern': ['get', 'patroon'], 'fill-opacity': ['case', ['==', ['get', 'gedimd'], true], 0.15, ['max', 0.6, ['get', 'vuldekking']]] } },
    { id: 'fm-witrand', type: 'line', source: 'fm-vormen', filter: ['all', lijnVormen, ['get', 'wit_rand'], nietOnder, nietStuk],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': breedte(lat, 4) } },
  ];
  // Zichtlijnen onder hekken vervagen pas ver ingezoomd, waar de tekening zelf leesbaar is; de zichtlijn van
  // andere lijnelementen (zicht 'laag') verdwijnt zodra de stukken tekenen (STUK_ZOOM).
  const zichtLaag = ['==', ['get', 'zicht'], 'laag'];
  const dekkingLijn = ['interpolate', ['linear'], ['zoom'], STUK_ZOOM - 0.01, ['get', 'dekking'], STUK_ZOOM, ['case', zichtLaag, 0, ['get', 'dekking']], 20, ['case', zichtLaag, 0, ['get', 'dekking']], 22.5, ['case', zichtLaag, 0, ['==', ['get', 'zicht'], true], ['*', ['get', 'dekking'], 0.25], ['get', 'dekking']]];
  for (const [naam, streep] of Object.entries(STREPEN)) {
    const laag = {
      id: `fm-lijn-${naam}`, type: 'line', source: 'fm-vormen',
      filter: ['all', lijnVormen, ['==', ['get', 'streep'], naam], nietOnder, nietStuk],
      layout: { 'line-cap': naam === 'stip' ? 'round' : 'butt', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'kleur'], 'line-width': breedte(lat), 'line-opacity': dekkingLijn },
    };
    if (streep) laag.paint['line-dasharray'] = streep;
    lagen.push(laag);
  }
  // Stukken van lijnelementen (tekening per hek, toebehoren, koord): pas vanaf STUK_ZOOM.
  lagen.push({ id: 'fm-stuk-vulling', type: 'fill', source: 'fm-vormen', minzoom: STUK_ZOOM, filter: ['all', ['==', ['get', 'vorm'], 'vlak'], isStuk],
    paint: { 'fill-color': ['get', 'vulkleur'], 'fill-opacity': ['get', 'vuldekking'] } });
  lagen.push({ id: 'fm-stuk-witrand', type: 'line', source: 'fm-vormen', minzoom: STUK_ZOOM, filter: ['all', lijnVormen, ['get', 'wit_rand'], isStuk],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': breedte(lat, 4) } });
  for (const [naam, streep] of Object.entries(STREPEN)) {
    const laag = {
      id: `fm-stuk-lijn-${naam}`, type: 'line', source: 'fm-vormen', minzoom: STUK_ZOOM,
      filter: ['all', lijnVormen, ['==', ['get', 'streep'], naam], isStuk],
      layout: { 'line-cap': naam === 'stip' ? 'round' : 'butt', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'kleur'], 'line-width': breedte(lat), 'line-opacity': ['get', 'dekking'] },
    };
    if (streep) laag.paint['line-dasharray'] = streep;
    lagen.push(laag);
  }
  const heeftIcoon = ['!=', ['get', 'icoon'], ''];
  const heeftNr = ['!=', ['get', 'nr'], ''];
  // Punten en iconen op ware grootte (diameter in meter) of vast in pixels.
  const mpp0 = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 512;
  const opZoom = (fn) => ['interpolate', ['exponential', 2], ['zoom'], 0, fn(mpp0), 24, fn(mpp0 / 2 ** 24)];
  const straal = opZoom((mpp) => ['case', ['>', ['get', 'icoon_m'], 0], ['/', ['/', ['get', 'icoon_m'], 2], mpp], ['case', ['any', heeftIcoon, heeftNr], 11, 7]]);
  const icoonMaat = opZoom((mpp) => ['case', ['>', ['get', 'icoon_m'], 0], ['/', ['/', ['*', ['get', 'icoon_m'], 0.6], mpp], 48], 0.32]);
  lagen.push(
    { id: 'fm-punt', type: 'circle', source: 'fm-vormen', filter: ['all', ['==', ['get', 'vorm'], 'punt'], ['!=', ['get', 'soort'], 'tekst']],
      paint: { 'circle-radius': straal, 'circle-color': ['get', 'kleur'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-opacity': ['get', 'dekking'] } },
    { id: 'fm-punt-icoon', type: 'symbol', source: 'fm-vormen', filter: ['all', ['==', ['get', 'vorm'], 'punt'], heeftIcoon],
      layout: { 'icon-image': ['concat', 'ic-', ['get', 'icoon']], 'icon-size': icoonMaat, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#ffffff' } },
    { id: 'fm-punt-nr', type: 'symbol', source: 'fm-vormen', filter: ['all', ['==', ['get', 'vorm'], 'punt'], heeftNr],
      // Met icoon: het nummer als badgeje rechtsboven, het icoon blijft zichtbaar.
      layout: { 'text-field': ['get', 'nr'], 'text-size': ['case', heeftIcoon, 10, 11], 'text-offset': ['case', heeftIcoon, ['literal', [1.15, -1.1]], ['literal', [0, 0]]], 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': ['case', heeftIcoon, '#1d1d1b', 'rgba(0,0,0,0)'], 'text-halo-width': ['case', heeftIcoon, 2.5, 0] } },
    // Tekst kan pas vanaf een zoomniveau verschijnen (stijl.vanaf_zoom), bv. boxnummers in een pit area.
    { id: 'fm-tekst', type: 'symbol', source: 'fm-vormen', filter: ['all', ['==', ['get', 'soort'], 'tekst'], ['>=', ['zoom'], ['coalesce', ['get', 'vanaf_zoom'], 0]]],
      layout: { 'text-field': ['get', 'tekst'], 'text-size': ['get', 'tekstgrootte'], 'text-font': FONT, 'text-allow-overlap': true, 'text-rotate': ['get', 'tekst_rot'], 'text-rotation-alignment': 'map' },
      paint: { 'text-color': ['get', 'kleur'], 'text-halo-color': '#ffffff', 'text-halo-width': ['case', ['get', 'achtergrond'], 4, 1.5] } },
    { id: 'fm-pijlkop', type: 'symbol', source: 'fm-labels', filter: ['==', ['get', 'soort'], 'pijl'],
      layout: { 'icon-image': 'fm-pijlkop', 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['get', 'dikte'], 1, 0.35, 10, 0.9] },
      paint: { 'icon-color': ['get', 'kleur'], 'icon-halo-color': '#ffffff', 'icon-halo-width': ['case', ['to-boolean', ['get', 'wit_rand']], 2, 0] } },
    { id: 'fm-patroon-ic', type: 'symbol', source: 'fm-labels', minzoom: 14, filter: ['all', ['==', ['get', 'soort'], 'patroon'], ['!=', ['get', 'icoon'], '']],
      layout: { 'icon-image': ['concat', 'ic-', ['get', 'icoon']], 'icon-size': 0.3, 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true },
      paint: { 'icon-color': ['get', 'kleur'] } },
    { id: 'fm-patroon-tx', type: 'symbol', source: 'fm-labels', minzoom: 15, filter: ['all', ['==', ['get', 'soort'], 'patroon'], ['!=', ['get', 'label'], '']],
      layout: { 'text-field': ['get', 'label'], 'text-size': ['get', 'tekstgrootte'], 'text-font': ['Noto Sans Bold'], 'text-rotate': ['get', 'rot'], 'text-rotation-alignment': 'map', 'text-allow-overlap': true },
      paint: { 'text-color': ['get', 'kleur'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } },
    { id: 'fm-label-heknr', type: 'symbol', source: 'fm-labels', minzoom: 18.5, filter: ['==', ['get', 'soort'], 'heknr'],
      layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': ['get', 'kleur'], 'text-halo-width': 2.4 } },
    { id: 'fm-label-doek', type: 'symbol', source: 'fm-labels', minzoom: 18, filter: ['==', ['get', 'soort'], 'doeknaam'],
      layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-size': ['get', 'tekstgrootte'], 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.1], 'text-allow-overlap': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': ['get', 'kleur'], 'text-halo-width': 2.2 } },
    { id: 'fm-label-verd', type: 'symbol', source: 'fm-labels', minzoom: 15, filter: ['==', ['get', 'soort'], 'verdieping'],
      layout: { 'text-field': ['get', 'label'], 'text-size': 13, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#1D4ED8', 'text-halo-width': 3 } },
    // Afstand op de hulplijnen: regelmatig langs de lijn, hoe verder ingezoomd hoe vaker.
    { id: 'fm-label-hulp', type: 'symbol', source: 'fm-labels', minzoom: 20.5, filter: ['==', ['get', 'soort'], 'hulpmaat'],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 220, 'text-field': ['get', 'label'], 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-keep-upright': true, 'text-padding': 4 },
      paint: { 'text-color': ['get', 'kleur'], 'text-halo-color': '#ffffff', 'text-halo-width': 2 } },
    { id: 'fm-label-langs', type: 'symbol', source: 'fm-labels', minzoom: 14, filter: ['==', ['get', 'soort'], 'langs'],
      layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-size': ['get', 'tekstgrootte'], 'text-font': ['Noto Sans Bold'], 'text-offset': [0, -0.9], 'text-allow-overlap': true },
      paint: { 'text-color': '#1d1d1b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } },
    // Teksten uit een gedetailleerde tekening: hoogte in meter, schaalt mee met de kaart.
    { id: 'fm-label-m', type: 'symbol', source: 'fm-labels', minzoom: 14, filter: ['==', ['get', 'soort'], 'tekening-tekst'],
      layout: { 'text-field': ['get', 'label'], 'text-size': opZoom((mpp) => ['min', 400, ['/', ['get', 'tekst_m'], mpp]]), 'text-font': FONT, 'text-rotate': ['get', 'tekst_rot'], 'text-rotation-alignment': 'map', 'text-allow-overlap': true, 'text-ignore-placement': true, 'text-max-width': 100 },
      paint: { 'text-color': ['get', 'kleur'], 'text-opacity': ['case', ['==', ['get', 'gedimd'], true], 0.25, 1] } },
    { id: 'fm-label', type: 'symbol', source: 'fm-labels', minzoom: 15, filter: ['==', ['get', 'soort'], 'label'],
      layout: { 'text-field': ['get', 'label'], 'text-size': ['get', 'tekstgrootte'], 'text-font': FONT_LABEL, 'text-offset': ['case', ['get', 'punt'], ['literal', [0, 1.7]], ['literal', [0, 0]]], 'text-max-width': 14, 'text-rotate': ['get', 'tekst_rot'], 'text-rotation-alignment': 'map' },
      paint: { 'text-color': '#1d1d1b', 'text-halo-color': '#ffffff', 'text-halo-width': ['case', ['get', 'achtergrond'], 4, 1.6] } },
  );
  // Zoomvenster per feature (minz tot maxz): een camerastelling is uitgezoomd een bolletje, ingezoomd de tekening.
  const inVenster = ['all', ['>=', ['zoom'], ['coalesce', ['get', 'minz'], 0]], ['<', ['zoom'], ['coalesce', ['get', 'maxz'], 99]]];
  return lagen.map((l) => ({ ...l, filter: l.filter ? ['all', inVenster, l.filter] : inVenster }));
}

// Patronen, texturen, pijlpunten en iconen als afbeelding in de kaart.
export function zorgVoorPatronen(map, features, symbolen = []) {
  if (!map.hasImage('fm-pijlkop')) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const x = c.getContext('2d'); x.fillStyle = '#fff';
    x.beginPath(); x.moveTo(24, 4); x.lineTo(42, 40); x.lineTo(24, 32); x.lineTo(6, 40); x.closePath(); x.fill();
    map.addImage('fm-pijlkop', x.getImageData(0, 0, 48, 48), { sdf: true });
  }
  const iconen = new Set();
  for (const f of [...features, ...symbolen]) if (f.properties.icoon) iconen.add(f.properties.icoon);
  for (const ic of iconen) zetIcoonInKaart(map, ic, 48);
  for (const f of features) {
    const naam = f.properties.patroon;
    if (!naam || map.hasImage(naam)) continue;
    if (naam.startsWith('tex-')) {
      const [a, b] = TEXTUREN[naam.slice(4)] || ['#999', '#666'];
      const n = 32;
      const c = document.createElement('canvas'); c.width = n; c.height = n;
      const x = c.getContext('2d');
      x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.fillStyle = b; x.lineWidth = 1.5;
      const t = naam.slice(4);
      if (t === 'hout') { for (let y = 0; y < n; y += 8) { x.beginPath(); x.moveTo(0, y); x.lineTo(n, y); x.stroke(); x.beginPath(); x.moveTo(((y / 8) % 2) * 16 + 8, y); x.lineTo(((y / 8) % 2) * 16 + 8, y + 8); x.stroke(); } }
      else if (t === 'gras') { for (let i = 0; i < 14; i++) { const px = (i * 37) % n; const py = (i * 53) % n; x.beginPath(); x.moveTo(px, py + 4); x.lineTo(px + 2, py); x.stroke(); } }
      else if (t === 'kasseien') { for (let y = 0; y < n; y += 8) for (let k = 0; k < n; k += 8) x.strokeRect(k + ((y / 8) % 2) * 4, y, 8, 8); }
      else { for (let i = 0; i < 24; i++) { x.fillRect((i * 29) % n, (i * 41) % n, 1.5, 1.5); } }
      map.addImage(naam, x.getImageData(0, 0, n, n));
      continue;
    }
    const kleur = '#' + naam.split('-')[1];
    const n = 16;
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = kleur;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (naam.startsWith('arc-')) {
      ctx.moveTo(0, n); ctx.lineTo(n, 0);
      ctx.moveTo(-n / 2, n / 2); ctx.lineTo(n / 2, -n / 2);
      ctx.moveTo(n / 2, n + n / 2); ctx.lineTo(n + n / 2, n / 2);
    } else {
      ctx.moveTo(n / 2, 0); ctx.lineTo(n / 2, n);
      ctx.moveTo(0, n / 2); ctx.lineTo(n, n / 2);
    }
    ctx.stroke();
    map.addImage(naam, ctx.getImageData(0, 0, n, n));
  }
}
