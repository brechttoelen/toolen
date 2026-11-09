// Een tent groter of kleiner maken terwijl ze al ingericht is (binnenplan):
// - de ruimte die de maten van de tent overnam, groeit mee met de tent;
// - deuren en ramen op de tentwand schuiven mee met hun wand (zelfde verhouding langs die wand);
// - de rest van de inrichting blijft op zijn plaats staan (enkel de plaats in het binnenplan wordt herrekend).
import { isTentBouw, tentAssen } from './tentbouw';
import { planTransform } from './onderlegger';

const r3 = (v) => Math.round(v * 1000) / 1000;
const mapG = (g, f) => (g.type === 'Point' ? { type: 'Point', coordinates: f(g.coordinates) } : g.type === 'LineString' ? { type: 'LineString', coordinates: g.coordinates.map(f) } : { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(f)) });
const gelijk = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.001;

// Patches [{ id, patch }] voor de items in het binnenplan van de tent, of [] als er niets te doen is.
export function binnenNaTentMaat(voor, na, el, items, onderleggers = []) {
  if (!voor || !na || !isTentBouw(el) || !voor.parameters?.midden || !na.parameters?.midden) return [];
  const p0 = voor.parameters; const p1 = na.parameters;
  if (gelijk(p0.breedte, p1.breedte) && gelijk(p0.diepte, p1.diepte)) return []; // verplaatsen of draaien: daar zorgt het binnenplan zelf voor
  if (onderleggers.some((o) => o?.binnen?.host === na.id)) return []; // binnenplan op een eigen grondplan: dat beweegt niet mee
  const A0 = tentAssen(voor, el); const A1 = tentAssen(na, el); if (!A0 || !A1) return [];
  const rot0 = voor.velden?.binnenplan?.rot ?? (Number(p0.rot) || 0); const rot1 = na.velden?.binnenplan?.rot ?? (Number(p1.rot) || 0);
  const T1 = planTransform(null, null, p1.midden, rot1);
  const lok = (g) => mapG(g, (c) => T1.naarPlan(c).map(r3));
  const { m: m0 } = A0; const { m: m1 } = A1; const uit = [];
  // Plaats op de wand van de oude tent: zijde + verhouding langs die zijde, of null als het niet op de wand ligt.
  const opWand = ([x, y], tol) => {
    const d = [['L', y], ['R', m0.B - y], ['V', x], ['A', m0.L - x]].sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
    if (Math.abs(d[1]) > tol || x < -tol || y < -tol || x > m0.L + tol || y > m0.B + tol) return null;
    return { z: d[0], f: d[0] === 'L' || d[0] === 'R' ? x / m0.L : y / m0.B };
  };
  const nieuwOpWand = ({ z, f }) => (z === 'L' ? [f * m1.L, 0] : z === 'R' ? [f * m1.L, m1.B] : z === 'V' ? [0, f * m1.B] : [m1.L, f * m1.B]);
  const oudOpWand = ({ z, f }) => (z === 'L' ? [f * m0.L, 0] : z === 'R' ? [f * m0.L, m0.B] : z === 'V' ? [0, f * m0.B] : [m0.L, f * m0.B]);
  for (const x of items || []) {
    if (x?.velden?.binnen?.host !== na.id || !x.geometrie) continue;
    const bin = x.velden.binnen;
    // 1. Ruimte die de hele tent beslaat → de nieuwe omtrek.
    if (x.velden.ruimte && x.geometrie.type === 'Polygon') {
      const ring = x.geometrie.coordinates[0].map((c) => A0.vanGeo(c));
      const xs = ring.map((q) => q[0]); const ys = ring.map((q) => q[1]);
      const heel = ring.every((q) => opWand(q, 0.35)) && Math.min(...xs) < 0.35 && Math.max(...xs) > m0.L - 0.35 && Math.min(...ys) < 0.35 && Math.max(...ys) > m0.B - 0.35;
      if (heel) {
        const g = { type: 'Polygon', coordinates: [[[0, 0], [m1.L, 0], [m1.L, m1.B], [0, m1.B], [0, 0]].map((q) => A1.naarGeo(q))] };
        uit.push({ id: x.id, patch: { geometrie: g, velden: { ...x.velden, binnen: { ...bin, lokaal: { geometrie: lok(g), midden: null, rot: null } } } } });
        continue;
      }
    }
    // 2. Deur of raam op de tentwand → schuift mee met de wand.
    const mb = x.velden.meubel;
    if (mb && (mb.type === 'deur' || mb.type === 'raam') && x.geometrie.type === 'Polygon') {
      const ring = x.geometrie.coordinates[0]; const n = ring.length - 1 || 1;
      const mid = [ring.slice(0, n).reduce((a, q) => a + q[0], 0) / n, ring.slice(0, n).reduce((a, q) => a + q[1], 0) / n];
      const w = opWand(A0.vanGeo(mid), 0.6);
      if (w) {
        const o = oudOpWand(w); const nw = nieuwOpWand(w); const d = [nw[0] - o[0], nw[1] - o[1]];
        const zet = (c) => { const q = A0.vanGeo(c); return A1.naarGeo([q[0] + d[0], q[1] + d[1]]); };
        const g = mapG(x.geometrie, zet); const mi = x.parameters?.midden ? zet(x.parameters.midden) : null;
        const rot = x.parameters?.rot != null ? (((Number(x.parameters.rot) + (Number(p1.rot) || 0) - (Number(p0.rot) || 0)) % 360) + 360) % 360 : x.parameters?.rot;
        const lr = bin.lokaal?.rot != null ? ((((rot ?? 0) - rot1) % 360) + 360) % 360 : bin.lokaal?.rot ?? null;
        uit.push({ id: x.id, patch: { geometrie: g, parameters: { ...(x.parameters || {}), ...(mi ? { midden: mi } : {}), ...(rot != null ? { rot } : {}) }, velden: { ...x.velden, binnen: { ...bin, lokaal: { geometrie: lok(g), midden: mi ? T1.naarPlan(mi).map(r3) : null, rot: lr } } } } });
        continue;
      }
    }
    // 3. De rest blijft staan: enkel de plaats in het binnenplan (het midden van de tent kan verschoven zijn).
    if (bin.lokaal?.geometrie && (Math.abs(p0.midden[0] - p1.midden[0]) > 1e-9 || Math.abs(p0.midden[1] - p1.midden[1]) > 1e-9 || !gelijk(rot0, rot1))) {
      const mi = x.parameters?.midden || null;
      const lr = x.parameters?.rot != null ? ((((Number(x.parameters.rot) || 0) - rot1) % 360) + 360) % 360 : bin.lokaal.rot ?? null;
      uit.push({ id: x.id, patch: { velden: { ...x.velden, binnen: { ...bin, lokaal: { geometrie: lok(x.geometrie), midden: mi ? T1.naarPlan(mi).map(r3) : null, rot: lr } } } } });
    }
  }
  return uit;
}
