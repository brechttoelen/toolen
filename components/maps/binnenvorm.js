// Binnenruimte van een element met een eigen tekening (truck met uitschuifdelen, unit, container):
// de grote vlakken van de tekening samen, zonder zones (gestreept, bv. de plek voor de trekker),
// trappen of kleine onderdelen. Zo tekent het binnenplan in de echte ruimte en niet in het
// omhullende kader. Een tekening kan het ook zelf aangeven met `binnen: true` op de vlakken.
import * as turf from '@turf/turf';
import { plaatser } from './tekening';
import { pasTekeningAan } from './stijl';

const opp = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a) / 2; };
const sluit = (r) => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r);

export function binnenVorm(it, el) {
  const tek0 = el?.eigenschappen?.tekening; const p = it?.parameters || {};
  if (!tek0 || !p.midden) return null;
  const tk = pasTekeningAan(tek0, it, el) || tek0;
  const vl = (tk.vlakken || []).filter((v) => Array.isArray(v.r?.[0]) && v.r[0].length >= 3);
  let kies = vl.filter((v) => v.binnen);
  if (!kies.length) {
    const tot = (Number(tk.b) || Number(el.breedte_m) || 1) * (Number(tk.h) || Number(el.diepte_m) || 1);
    kies = vl.filter((v) => (!v.s || v.s === 'vol') && opp(v.r[0]) >= 0.15 * tot);
  }
  if (!kies.length) return null;
  let ring;
  if (kies.length === 1) ring = sluit(kies[0].r[0]);
  else {
    try {
      const u = turf.union(turf.featureCollection(kies.map((v) => turf.polygon([sluit(v.r[0])]))));
      const g = u?.geometry; if (!g) return null;
      const delen = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      ring = delen.map((d) => d[0]).sort((a, b) => opp(b) - opp(a))[0];
    } catch { return null; }
  }
  const sx = (el?.breedte_m && p.breedte ? p.breedte / el.breedte_m : 1) * (p.spiegel_x ? -1 : 1);
  const sy = (el?.diepte_m && p.diepte ? p.diepte / el.diepte_m : 1) * (p.spiegel_y ? -1 : 1);
  const T = plaatser(p.midden, Number(p.rot) || 0, sx, sy);
  return { type: 'Polygon', coordinates: [ring.map(T)] };
}
