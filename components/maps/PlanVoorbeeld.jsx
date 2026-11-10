'use client';

// Klein voorbeeld van een plan: de luchtfoto van de plek (Vlaanderen) met de items erop,
// zoals in de editor. Buiten Vlaanderen of zonder kaart: enkel de items op een rustig vlak.
import { useMemo } from 'react';

function coords(g, uit) {
  if (!g) return;
  if (g.type === 'Point') uit.push(g.coordinates);
  else if (g.type === 'LineString' || g.type === 'MultiPoint') g.coordinates.forEach((c) => uit.push(c));
  else if (g.type === 'Polygon' || g.type === 'MultiLineString') g.coordinates.forEach((r) => r.forEach((c) => uit.push(c)));
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.forEach((c) => uit.push(c))));
}
const kwantiel = (l, q) => l[Math.min(l.length - 1, Math.max(0, Math.floor(q * (l.length - 1))))];

// Web Mercator in pixels op zoom 0 (tegels van 256).
const mx = (lon) => (256 * (lon + 180)) / 360;
const my = (lat) => { const f = (lat * Math.PI) / 180; return (256 * (1 - Math.log(Math.tan(f) + 1 / Math.cos(f)) / Math.PI)) / 2; };
const VLAANDEREN = [2.52, 50.67, 5.95, 51.51];
const LUCHTFOTO = (z, x, y) => `https://geo.api.vlaanderen.be/OMWRGBMRVL/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=omwrgbmrvl&STYLE=&FORMAT=image/png&TILEMATRIXSET=GoogleMapsVL&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;

export function PlanVoorbeeld({ items, hoogte = 168, label, kaart = true }) {
  const W = 360; const H = hoogte;
  const beeld = useMemo(() => {
    const alle = [];
    items.forEach((i) => coords(i.geometrie, alle));
    if (alle.length < 2) return null;
    // Uitschieters negeren: 3e tot 97e percentiel.
    const xs = alle.map((c) => c[0]).sort((a, b) => a - b); const ys = alle.map((c) => c[1]).sort((a, b) => a - b);
    const [lo0, lo1, la0, la1] = [kwantiel(xs, 0.03), kwantiel(xs, 0.97), kwantiel(ys, 0.03), kwantiel(ys, 0.97)];
    const marge = 0.14;
    const bw = Math.max(mx(lo1) - mx(lo0), 1e-7); const bh = Math.max(my(la0) - my(la1), 1e-7);
    const zf = Math.min(19.5, Math.log2(Math.min((W * (1 - 2 * marge)) / bw, (H * (1 - 2 * marge)) / bh)));
    const s = 2 ** zf;
    const cx = ((mx(lo0) + mx(lo1)) / 2) * s; const cy = ((my(la0) + my(la1)) / 2) * s;
    const pt = (c) => [W / 2 + mx(c[0]) * s - cx, H / 2 + my(c[1]) * s - cy];
    const p = (c) => pt(c).map((v) => v.toFixed(1)).join(',');

    // Luchtfoto: tegels op een zoom hoger dan nodig (scherp op retina), enkel in Vlaanderen.
    const tegels = [];
    const inVl = lo0 > VLAANDEREN[0] && lo1 < VLAANDEREN[2] && la0 > VLAANDEREN[1] && la1 < VLAANDEREN[3];
    if (kaart && inVl) {
      const zt = Math.max(1, Math.min(20, Math.ceil(zf + 1)));
      const k = 2 ** (zf - zt); const t = 256 * k; // grootte van een tegel in het voorbeeld
      const cxt = cx / k; const cyt = cy / k;
      const x0 = Math.floor((cxt - W / 2 / k) / 256); const x1 = Math.floor((cxt + W / 2 / k) / 256);
      const y0 = Math.floor((cyt - H / 2 / k) / 256); const y1 = Math.floor((cyt + H / 2 / k) / 256);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 16) {
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
          tegels.push(<image key={`${x}-${y}`} href={LUCHTFOTO(zt, x, y)} x={(W / 2 + x * t - cx).toFixed(2)} y={(H / 2 + y * t - cy).toFixed(2)} width={t + 0.5} height={t + 0.5} preserveAspectRatio="none" />);
        }
      }
    }
    const opFoto = tegels.length > 0;
    const lijn = opFoto ? '#FFFFFF' : '#022056';
    const vul = opFoto ? 'rgba(255,255,255,.22)' : 'rgba(2,32,86,.07)';
    const vormen = [];
    items.forEach((i, n) => {
      const g = i.geometrie; if (!g) return;
      if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
        const ringen = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        vormen.push(<path key={n} d={ringen.map((pl) => pl.map((r) => `M${r.map(p).join('L')}Z`).join('')).join('')} fill={vul} stroke={lijn} strokeWidth="1.3" strokeLinejoin="round" />);
      } else if (g.type === 'LineString') {
        vormen.push(<path key={n} d={`M${g.coordinates.map(p).join('L')}`} fill="none" stroke={lijn} strokeOpacity={i.velden?.stroom ? 0.6 : 0.95} strokeWidth={i.velden?.stroom ? 1 : 1.6} strokeLinecap="round" strokeLinejoin="round" />);
      } else if (g.type === 'Point') {
        const [x, y] = pt(g.coordinates);
        vormen.push(<circle key={n} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.4" fill={opFoto ? '#fff' : '#022056'} stroke={opFoto ? '#022056' : '#fff'} strokeWidth="1" />);
      }
    });
    return { tegels, vormen, opFoto };
  }, [items, H, kaart]);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} style={{ display: 'block', background: '#E9EDF2' }}>
      {beeld?.tegels}
      {beeld?.opFoto && <rect width={W} height={H} fill="#022056" opacity=".22" />}
      {beeld?.vormen || <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fontSize="13" fill="#6B7A90" fontFamily="IBM Plex Sans">Nog leeg</text>}
    </svg>
  );
}
