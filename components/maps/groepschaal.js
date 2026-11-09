// Selectie of groep groter of kleiner maken met grepen op de hoeken en zijden van een kader
// langs de lange as van het geheel. Lijnen en vrije vormen schalen mee (bv. evenwijdige hekken
// allemaal korter maken); elementen met een vaste maat (tenten, cabines) verschuiven enkel.
import * as geo from './geo';

const M_LAT = 110574;
const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

// Lokaal stelsel rond c (lng/lat) met u langs de richting B (graden, kompas) en v haaks erop (links).
export function stelsel(c, B) {
  const r = (B * Math.PI) / 180; const su = Math.sin(r); const cu = Math.cos(r); const kx = mLng(c[1]);
  const naar = (q) => { const x = (q[0] - c[0]) * kx; const y = (q[1] - c[1]) * M_LAT; return [x * su + y * cu, -x * cu + y * su]; };
  const van = ([u, v]) => { const x = u * su - v * cu; const y = u * cu + v * su; return [c[0] + x / kx, c[1] + y / M_LAT]; };
  return { naar, van };
}

const coords = (g) => (g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates.flat() : g.type === 'MultiPolygon' ? g.coordinates.flat(2) : []);

// extra(it) = bijkomende punten die het item op het plan inneemt (bv. de vakken van een stelling op zijn ankerlijn).
export function kaderVan(items, c, B, extra = null) {
  const S = stelsel(c, B); let u0 = Infinity; let u1 = -Infinity; let v0 = Infinity; let v1 = -Infinity;
  for (const it of items) for (const q of [...coords(it.geometrie), ...(extra ? extra(it) : [])]) { const [u, v] = S.naar(q); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return { u0, u1, v0, v1 };
}

const mapG = (g, f) => {
  if (g.type === 'Point') return { ...g, coordinates: f(g.coordinates) };
  if (g.type === 'LineString') return { ...g, coordinates: g.coordinates.map(f) };
  if (g.type === 'Polygon') return { ...g, coordinates: g.coordinates.map((r) => r.map(f)) };
  if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map((p) => p.map((r) => r.map(f))) };
  return g;
};

// f = [fu, fv], vast = [u, v] (blijft staan).
export function geschaald(it, c, B, vast, f) {
  const S = stelsel(c, B);
  const T = (q) => { const [u, v] = S.naar(q); return S.van([vast[0] + (u - vast[0]) * f[0], vast[1] + (v - vast[1]) * f[1]]); };
  const p = it.parameters || {};
  if (p.midden) {
    // Vaste maat: enkel het midden verschuift.
    const m2 = T(p.midden); const dx = m2[0] - p.midden[0]; const dy = m2[1] - p.midden[1];
    return { ...it, geometrie: geo.verschuifGraden(it.geometrie, dx, dy), parameters: { ...p, midden: m2 } };
  }
  return { ...it, geometrie: mapG(it.geometrie, T) };
}
