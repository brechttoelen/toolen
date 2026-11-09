// Verstevigen tussen twee (ongeveer) evenwijdige nadarlijnen: schuine dranghekken in de
// veiligheidszone ertussen. Elke `om` meter langs lijn A één schuin hek naar lijn B.
// patroon 'zigzag' wisselt de richting af (V-vorm), 'schuin' houdt dezelfde richting.
import * as turf from '@turf/turf';

export function schoorTussen(a, b, { om = 5, lengte = 2.5, patroon = 'zigzag' } = {}) {
  const A = turf.lineString(a); const B = turf.lineString(b);
  const LA = turf.length(A, { units: 'meters' }); const LB = turf.length(B, { units: 'meters' });
  const uit = []; let lang = 0; let k = 0;
  const stap = Math.max(1, Number(om) || 5);
  for (let s = stap / 2; s <= LA - 0.5; s += stap, k += 1) {
    const pA = turf.along(A, s, { units: 'meters' });
    const n = turf.nearestPointOnLine(B, pA, { units: 'meters' });
    const d = n.properties.dist; // tussenruimte
    if (d < 0.3) continue;
    if (d > lengte) lang += 1;
    const o = d < lengte ? Math.sqrt(lengte * lengte - d * d) : 0; // verschuiving langs B zodat het hek precies past
    const richting = patroon === 'zigzag' && k % 2 ? -1 : 1;
    const t = Math.min(LB, Math.max(0, n.properties.location + richting * o));
    const pB = turf.along(B, t, { units: 'meters' });
    uit.push([pA.geometry.coordinates, pB.geometry.coordinates]);
  }
  return { lijnen: uit, tebreed: lang };
}
