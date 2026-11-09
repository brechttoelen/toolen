// Grond (maaiveld) uit gemeten punten: st.grondPunten = [{ i, j, h }] op hoeken van het raster (h in m, 0 = laagste
// punt of het referentiepunt). Daartussen een vlak door de punten (kleinste kwadraten) en de afwijking per punt
// zacht verdeeld (inverse afstand), zodat de grond precies door elk gemeten punt gaat.
// grondToepassen() schrijft per vak de grond op zijn vier hoeken (v.grondH = [g00, g10, g01, g11]); de rest van de
// stellingbouwer (staanders, spindels, schoren, 3D) leest die via grondHoek().
import { stellingMaten } from '../stellingbouw';

const r2 = (x) => Math.round(x * 100) / 100;

export function grondFunctie(st) {
  const P = (st?.grondPunten || []).filter((p) => Number.isFinite(Number(p.h)));
  if (!P.length) return null;
  const M = stellingMaten(st);
  const pts = P.map((p) => ({ x: M.x(p.i), y: M.y(p.j), h: Number(p.h) }));
  const klem = (z) => r2(Math.max(0, z));
  if (pts.length === 1) return () => klem(pts[0].h);
  const lijn = (a, b) => { const dx = b.x - a.x; const dy = b.y - a.y; const L2 = dx * dx + dy * dy || 1; return (x, y) => a.h + (b.h - a.h) * (((x - a.x) * dx + (y - a.y) * dy) / L2); };
  if (pts.length === 2) { const f = lijn(pts[0], pts[1]); return (x, y) => klem(f(x, y)); }
  // Vlak h = a + b·x + c·y (normaalvergelijkingen, 3×3).
  let n = 0; let sx = 0; let sy = 0; let sxx = 0; let syy = 0; let sxy = 0; let sh = 0; let sxh = 0; let syh = 0;
  for (const p of pts) { n++; sx += p.x; sy += p.y; sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y; sh += p.h; sxh += p.x * p.h; syh += p.y * p.h; }
  const A = [[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]]; const B = [sh, sxh, syh];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  let vlak;
  if (Math.abs(D) < 1e-6) { // alle punten op één lijn: helling langs die lijn
    let a = pts[0]; let b = pts[1]; let best = 0;
    for (const p of pts) for (const q of pts) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d > best) { best = d; a = p; b = q; } }
    vlak = lijn(a, b);
  } else {
    const kol = (k) => A.map((rij, i) => rij.map((w, j) => (j === k ? B[i] : w)));
    const c0 = det(kol(0)) / D; const c1 = det(kol(1)) / D; const c2 = det(kol(2)) / D;
    vlak = (x, y) => c0 + c1 * x + c2 * y;
  }
  const rest = pts.map((p) => ({ ...p, r: p.h - vlak(p.x, p.y) }));
  return (x, y) => {
    let sw = 0; let sr = 0;
    for (const p of rest) { const d2 = (p.x - x) ** 2 + (p.y - y) ** 2; if (d2 < 1e-6) return klem(p.h); const w = 1 / d2; sw += w; sr += w * p.r; }
    return klem(vlak(x, y) + (sw ? sr / sw : 0));
  };
}

// Grond op de hoeken van elk vak zetten (of weghalen als er geen punten meer zijn). Zelfde object als er niets verandert.
export function grondToepassen(st) {
  if (!st?.vakken) return st;
  const f = grondFunctie(st);
  const heeftH = Object.values(st.vakken).some((v) => v?.grondH);
  if (!f && !heeftH) return st;
  const M = stellingMaten(st); const g = (i, j) => (f ? f(M.x(i), M.y(j)) : 0);
  let veranderd = false; const v2 = {};
  for (const [s, v] of Object.entries(st.vakken)) {
    if (!f) { if (v.grondH) { const { grondH, ...rest } = v; v2[s] = rest; veranderd = true; } else v2[s] = v; continue; }
    const [i, j] = s.split(',').map(Number);
    const h = [g(i, j), g(i + 1, j), g(i, j + 1), g(i + 1, j + 1)];
    if (v.grondH && v.grondH.every((x, k) => Math.abs(x - h[k]) < 0.005)) { v2[s] = v; continue; }
    v2[s] = { ...v, grondH: h }; veranderd = true;
  }
  return veranderd ? { ...st, vakken: v2 } : st;
}
