// Eén regel voor "wat zit er onder de muis", gedeeld door oplichten, selecteren en slepen,
// zodat wat oplicht ook is wat je selecteert (zoals in Figma).
// Tolerantie ±6 px. Voorrang: punten en teksten > deur/poort in een hekkenlijn > lijnen > kleinste vlak > vloeren; binnen een soort
// wint wat bovenaan getekend is.
import * as turf from '@turf/turf';

export const ITEMLAGEN = ['fm-sign', 'fm-punt', 'fm-punt-icoon', 'fm-tekst', 'fm-lijn-vol', 'fm-lijn-streep', 'fm-lijn-stip', 'fm-lijn-streeppunt', 'fm-stuk-vulling', 'fm-stuk-lijn-vol', 'fm-vulling', 'fm-patroon', 'fm-vloer', 'fm-vloer-lijn'];

const oppCache = new WeakMap();
const opp = (g) => {
  if (!g || g.type !== 'Polygon') return 0;
  let a = oppCache.get(g);
  if (a == null) { try { a = turf.area(g); } catch { a = 0; } oppCache.set(g, a); }
  return a;
};

// Vinger (gsm, tablet): eerst zoals met de muis, raak je niets dan een ruimere zone, zodat smalle
// dingen (truss, hekken, kabels) ook zonder ver in te zoomen te kiezen zijn.
const isVinger = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
export function hitOp(map, point, items, opt = {}) {
  const eerst = hitOp1(map, point, items, opt);
  if (eerst || opt.tol != null || !isVinger()) return eerst;
  return hitOp1(map, point, items, { ...opt, tol: 20 });
}
function hitOp1(map, point, items, { tol = 6, mag = null } = {}) {
  if (!map) return null;
  const lagen = ITEMLAGEN.filter((l) => map.getLayer(l));
  if (!lagen.length) return null;
  let f;
  try { f = map.queryRenderedFeatures([[point.x - tol, point.y - tol], [point.x + tol, point.y + tol]], { layers: lagen }); } catch { return null; }
  const gezien = new Map(); const kand = [];
  for (const x of f) {
    const id = x.properties?.id;
    if (!id) continue;
    const vloer = x.layer?.id === 'fm-vloer' || x.layer?.id === 'fm-vloer-lijn';
    if (gezien.has(id)) { if (!vloer) gezien.get(id).vloer = false; continue; }
    let it = items.find((y) => y.id === id);
    // Vloerstukken van een tent horen bij de tent: wie erop klikt, kiest (en versleept) de tent.
    if (it?.velden?.tentStuk?.tent) { const t = items.find((y) => y.id === it.velden.tentStuk.tent); if (t) { it = t; if (gezien.has(t.id)) continue; } }
    if (!it || (mag && !mag(it))) { gezien.set(id, {}); continue; }
    const k = { it, i: kand.length, vloer };
    gezien.set(id, k); if (it.id !== id) gezien.set(it.id, k); kand.push(k);
  }
  if (!kand.length) return null;
  // Vloeren (rijplaten, grondbescherming, stellingvloer …) liggen onder alles: wat erop staat wint.
  const rang = (it, k) => {
    if (k.vloer) return 3;
    const t = it.geometrie?.type;
    if (t === 'Point') return 0;
    // Een deur of poort ligt óp haar hekkenlijn: die moet je kunnen aanklikken zonder de lijn te raken.
    if (t === 'Polygon' && it.parameters?.inLijn) return 0.5;
    // Een gebouwde stelling (brug, podium, camerastelling) is een lijn als anker, maar op de kaart een vlak waar
    // mensen en camera's op staan: wat erop staat wint, de stelling komt net boven de vloeren.
    if (t === 'LineString' && it.velden?.stelling?.vakken && Object.keys(it.velden.stelling.vakken).length) return 2.9;
    if (t === 'LineString') return 1;
    return 2;
  };
  kand.sort((a, b) => rang(a.it, a) - rang(b.it, b) || (rang(a.it, a) >= 2 && rang(a.it, a) < 2.9 ? opp(a.it.geometrie) - opp(b.it.geometrie) : 0) || a.i - b.i);
  return kand[0].it;
}
