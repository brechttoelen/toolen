'use client';

// Klein voorbeeld van een plan als SVG (uit de items, zonder kaart).
import { useMemo } from 'react';

function coords(g, uit) {
  if (!g) return;
  if (g.type === 'Point') uit.push(g.coordinates);
  else if (g.type === 'LineString' || g.type === 'MultiPoint') g.coordinates.forEach((c) => uit.push(c));
  else if (g.type === 'Polygon' || g.type === 'MultiLineString') g.coordinates.forEach((r) => r.forEach((c) => uit.push(c)));
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.forEach((c) => uit.push(c))));
}
const kwantiel = (l, q) => l[Math.min(l.length - 1, Math.max(0, Math.floor(q * (l.length - 1))))];

export function PlanVoorbeeld({ items, kleur, hoogte = 168, label }) {
  const W = 360; const H = hoogte;
  const vormen = useMemo(() => {
    const alle = [];
    items.forEach((i) => coords(i.geometrie, alle));
    if (alle.length < 2) return null;
    // Uitschieters negeren: 3e tot 97e percentiel.
    const xs = alle.map((c) => c[0]).sort((a, b) => a - b); const ys = alle.map((c) => c[1]).sort((a, b) => a - b);
    let [x0, x1, y0, y1] = [kwantiel(xs, 0.03), kwantiel(xs, 0.97), kwantiel(ys, 0.03), kwantiel(ys, 0.97)];
    const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
    let bw = (x1 - x0) * kx; let bh = y1 - y0;
    if (bw < 1e-6 && bh < 1e-6) { bw = 0.0005; bh = 0.0005; }
    const marge = 0.12; const s = Math.min((W * (1 - 2 * marge)) / (bw || 1e-9), (H * (1 - 2 * marge)) / (bh || 1e-9));
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
    const p = (c) => `${(W / 2 + (c[0] - cx) * kx * s).toFixed(1)},${(H / 2 - (c[1] - cy) * s).toFixed(1)}`;
    const uit = [];
    items.forEach((i, k) => {
      const g = i.geometrie; if (!g) return;
      if (g.type === 'Polygon') uit.push(<path key={k} d={g.coordinates.map((r) => `M${r.map(p).join('L')}Z`).join('')} fill="#fff" stroke={kleur} strokeWidth="1.6" />);
      else if (g.type === 'MultiPolygon') uit.push(<path key={k} d={g.coordinates.map((pl) => pl.map((r) => `M${r.map(p).join('L')}Z`).join('')).join('')} fill="#fff" stroke={kleur} strokeWidth="1.6" />);
      else if (g.type === 'LineString') uit.push(<path key={k} d={`M${g.coordinates.map(p).join('L')}`} fill="none" stroke={i.velden?.stroom ? '#022056' : kleur} strokeWidth={i.velden?.stroom ? 1 : 2} strokeDasharray={i.soort === 'element' ? '4 3' : undefined} strokeLinecap="round" />);
      else if (g.type === 'Point') { const [x, y] = p(g.coordinates).split(','); uit.push(<circle key={k} cx={x} cy={y} r="2.6" fill="#022056" />); }
    });
    return uit;
  }, [items, kleur, H]);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} style={{ display: 'block', background: '#EDF0F4' }}>
      <defs><pattern id="tm-raster" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#E2E7EE" strokeWidth="1" /></pattern></defs>
      <rect width={W} height={H} fill="url(#tm-raster)" />
      {vormen || <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#6B7A90" fontFamily="IBM Plex Sans">Nog leeg</text>}
    </svg>
  );
}
