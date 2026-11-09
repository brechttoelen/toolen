// Draaien, maten en lokale assen van items (zuivere functies, geen React).
import { moduleMaat } from './stijl';
import * as geo from './geo';
import * as turf from '@turf/turf';

export function tdModusVoor(it) {
  const t = it.geometrie?.type;
  if (t === 'Point') return 'point';
  if (t === 'LineString') return 'linestring';
  if (it.soort === 'element' || it.soort === 'rechthoek') return 'element';
  if (['cirkel', 'veelhoek', 'ellips', 'sector'].includes(it.soort)) return 'cirkel';
  if (it.soort === 'rechthoek' && Number(it.parameters?.afronding) > 0) return 'cirkel';
  return 'polygon';
}

// Een item draaien rond zijn midden; parametrische vormen houden hun maten.
export function draaiItem(it, delta, elementen = []) {
  const p = it.parameters || {};
  const norm = (v) => geo.rond(((v % 360) + 360) % 360, 1);
  const el = it.element_id ? elementen.find((x) => x.id === it.element_id) : null;
  if (it.soort === 'element' && p.breedte && p.diepte && p.midden) { const rot = norm((Number(p.rot) || 0) + delta); return { ...it, parameters: { ...p, rot }, geometrie: geo.elementVeelhoek(p.midden, p.breedte, p.diepte, rot, el?.omtrek) }; }
  if (['rechthoek', 'veelhoek', 'ellips'].includes(it.soort) && p.midden) { const np = { ...p, rot: norm((Number(p.rot) || 0) + delta) }; const g = geo.parametrischeVorm(it.soort, np); if (g) return { ...it, parameters: np, geometrie: g }; }
  if (it.soort === 'sector' && p.midden) { const np = { ...p, richting: norm((Number(p.richting) || 0) + delta) }; return { ...it, parameters: np, geometrie: geo.parametrischeVorm('sector', np) }; }
  if (it.geometrie.type === 'Point') return it;
  return { ...it, geometrie: geo.draai(it.geometrie, delta, geo.middelpunt(it.geometrie)) };
}

// Maat van rechthoeken en ellipsen, om met grepen te verslepen.
export function maatVan(it, el = null) {
  const p = it.parameters || {};
  if (!p.midden) return null;
  if (it.soort === 'rechthoek' && p.breedte && p.diepte) return { b: Number(p.breedte), d: Number(p.diepte) };
  // Vlakvullende modules (stellingvloer, rijplaten in een vak …): grepen op hoeken en zijden,
  // met stappen van één module.
  if (it.soort === 'element' && el?.eigenschappen?.module && it.geometrie?.type === 'Polygon' && p.breedte && p.diepte) {
    const [sb, sd] = moduleMaat(el, p);
    return { b: Number(p.breedte), d: Number(p.diepte), sb, sd, el };
  }
  if (it.soort === 'ellips' && p.rx && p.ry) return { b: 2 * Number(p.rx), d: 2 * Number(p.ry) };
  return null;
}
export function metMaat(it, b, d, midden) {
  if (it.soort === 'element') {
    const np = { ...it.parameters, breedte: b, diepte: d, midden };
    return { ...it, parameters: np, geometrie: geo.elementVeelhoek(midden, b, d, Number(np.rot) || 0) };
  }
  const np = it.soort === 'ellips' ? { ...it.parameters, rx: b / 2, ry: d / 2, midden } : { ...it.parameters, breedte: b, diepte: d, midden };
  const g = geo.parametrischeVorm(it.soort, np);
  return g ? { ...it, parameters: np, geometrie: g } : it;
}
// Lokale meters (x langs de breedte, y langs de diepte, draaiing met de klok mee) ↔ kaart.
export function lokaalNaarKaart(midden, rot, x, y) {
  const r = (rot * Math.PI) / 180;
  const e = x * Math.cos(r) + y * Math.sin(r); const n = -x * Math.sin(r) + y * Math.cos(r);
  const afst = Math.hypot(e, n);
  if (afst < 1e-9) return midden;
  return turf.destination(midden, afst, (Math.atan2(e, n) * 180) / Math.PI, { units: 'meters' }).geometry.coordinates;
}
export function kaartNaarLokaal(midden, rot, p) {
  const afst = turf.distance(midden, p, { units: 'meters' }); const br = (turf.bearing(midden, p) * Math.PI) / 180;
  const e = afst * Math.sin(br); const n = afst * Math.cos(br);
  const r = (rot * Math.PI) / 180;
  return [e * Math.cos(r) - n * Math.sin(r), e * Math.sin(r) + n * Math.cos(r)];
}

// Draait een item rond een gemeenschappelijk middelpunt (groep of selectie):
// het item draait zelf mee én verschuift langs de cirkel.
export function draaiRond(it, delta, centrum, elementen = []) {
  const p = it.parameters || {};
  const g = it.geometrie;
  if (!g) return it;
  const c0 = g.type === 'Point' ? g.coordinates
    : (p.midden && ['element', 'rechthoek', 'veelhoek', 'ellips', 'sector'].includes(it.soort) ? p.midden : geo.middelpunt(g));
  let n = draaiItem(it, delta, elementen);
  if (g.type === 'Point' && p.rot != null) n = { ...n, parameters: { ...p, rot: geo.rond((((Number(p.rot) || 0) + delta) % 360 + 360) % 360, 1) } };
  const c1 = geo.draai({ type: 'Point', coordinates: c0 }, delta, centrum).coordinates;
  const dx = c1[0] - c0[0]; const dy = c1[1] - c0[1];
  return {
    ...n,
    geometrie: geo.verschuifGraden(n.geometrie, dx, dy),
    parameters: n.parameters?.midden ? { ...n.parameters, midden: [n.parameters.midden[0] + dx, n.parameters.midden[1] + dy] } : n.parameters,
  };
}
