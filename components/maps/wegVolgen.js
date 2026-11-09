// Een bestaande lijn (bv. geïmporteerd uit My Maps) netjes over de weg leggen.
// Route (OSRM van FOSSGIS) langs de knikpunten van de lijn: die liggen meestal al
// op de weg, de route vult de bochten ertussen in.
import * as turf from '@turf/turf';

const M = { units: 'meters' };
const BASIS = (prof) => `https://routing.openstreetmap.de/routed-${prof}`;
const fmt = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

// Eén aanvraag per (max.) 90 knikpunten: de route langs de weg van punt naar punt.
// Per stuk (leg) apart, zodat een stuk dat een grote omweg zou maken (eenrichting,
// voetweg voor de auto) gewoon blijft zoals getekend.
async function routeStukken(prof, pts) {
  const url = `${BASIS(prof)}/route/v1/driving/${pts.map(fmt).join(';')}?overview=false&steps=true&geometries=geojson&continue_straight=false`;
  const r = await fetch(url);
  if (r.status === 429) throw new Error('druk');
  const j = await r.json();
  if (j.code !== 'Ok' || !j.routes?.[0]) throw new Error(j.message || j.code || 'geen route');
  return j.routes[0].legs.map((leg) => ({ afstand: leg.distance, coords: leg.steps.flatMap((st) => st.geometry.coordinates) }));
}

// Geeft { coords, L0, L1, behouden, punten } terug; gooit een fout als niets lukt.
export async function legLangsWeg(coords, prof = 'car') {
  const pts = coords.filter((p, k) => k === 0 || turf.distance(coords[k - 1], p, M) > 1);
  if (pts.length < 2) throw new Error('te kort');
  const L0 = turf.length(turf.lineString(pts), M);
  const STUK = 90;
  const uit = [];
  let behouden = 0;
  for (let i = 0; i < pts.length - 1; i += STUK - 1) {
    const stuk = pts.slice(i, i + STUK);
    const legs = await routeStukken(prof, stuk);
    legs.forEach((leg, k) => {
      const a = stuk[k]; const b = stuk[k + 1];
      const recht = turf.distance(a, b, M);
      const omweg = leg.afstand > recht * 1.6 + 80;
      if (omweg) behouden += 1;
      uit.push(...(omweg || leg.coords.length < 2 ? [a, b] : leg.coords));
    });
  }
  // Ontdubbelen van opeenvolgende (bijna) gelijke punten.
  const schoon = uit.filter((p, k) => k === 0 || Math.abs(p[0] - uit[k - 1][0]) > 1e-7 || Math.abs(p[1] - uit[k - 1][1]) > 1e-7);
  if (schoon.length < 2) throw new Error('geen weg gevonden');
  const L1 = turf.length(turf.lineString(schoon), M);
  return { coords: schoon, L0, L1, behouden, punten: pts };
}
