// Aan welke kant van een hekkenlijn ligt het parcours? Voor pootjes en steundriehoeken: die horen aan de
// buitenkant, weg van het parcours.
import * as turf from '@turf/turf';
import { bboxVan, mogelijkDichtbij } from './controle';

const M = { units: 'meters' };
export const isParcoursLaag = (l) => /parcours|route|wedstrijd|omloop|koers/i.test(l?.naam || '');

// 'links' of 'rechts' t.o.v. de tekenrichting van de lijn, of null als er geen parcourslijn in de buurt (60 m) ligt.
export function parcoursKant(it, items, lagen) {
  const g = it?.geometrie;
  if (g?.type !== 'LineString' || g.coordinates.length < 2) return null;
  const lagenIds = new Set((lagen || []).filter(isParcoursLaag).map((l) => l.id));
  const c = g.coordinates;
  // Midden van de lijn en de richting daar.
  const L = turf.length(turf.lineString(c), M);
  if (!(L > 0)) return null;
  const mid = turf.along(turf.lineString(c), L / 2, M).geometry.coordinates;
  const voor = turf.along(turf.lineString(c), Math.max(0, L / 2 - 0.5), M).geometry.coordinates;
  const na = turf.along(turf.lineString(c), Math.min(L, L / 2 + 0.5), M).geometry.coordinates;
  let best = null; let bestD = 60;
  for (const x of items || []) {
    if (x.id === it.id || x.verborgen || !lagenIds.has(x.laag_id) || x.geometrie?.type !== 'LineString') continue;
    if (!mogelijkDichtbij(g, x.geometrie, bestD)) continue;
    try {
      const np = turf.nearestPointOnLine(turf.lineString(x.geometrie.coordinates), mid, M);
      const d = np.properties.dist;
      if (d < bestD && d > 0.05) { bestD = d; best = np.geometry.coordinates; }
    } catch {}
  }
  if (!best) return null;
  const cos = Math.cos((mid[1] * Math.PI) / 180);
  const dx = (na[0] - voor[0]) * cos; const dy = na[1] - voor[1];
  const px = (best[0] - mid[0]) * cos; const py = best[1] - mid[1];
  const kruis = dx * py - dy * px; // > 0: punt links van de richting
  return kruis > 0 ? 'links' : 'rechts';
}
export const andereKant = (k) => (k === 'links' ? 'rechts' : 'links');
// Pootjes/voet van een gespiegeld hek staan rechts van de tekenrichting, anders links.
export const pootjesKant = (it) => (it?.velden?.spiegel ? 'rechts' : 'links');
export { bboxVan };
