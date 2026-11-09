'use client';

// Kleine DXF-lezer voor onderleggers: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT, MTEXT.
// Coördinaten in Lambert 72, Lambert 2008 of RD New worden meteen omgezet naar
// WGS84 (vaste ligging). Anders blijft de tekening lokaal (in meter) en leg je ze
// zelf op de kaart, net als een PDF.
import proj4 from 'proj4';

proj4.defs('EPSG:31370', '+proj=lcc +lat_0=90 +lon_0=4.36748666666667 +lat_1=51.1666672333333 +lat_2=49.8333339 +x_0=150000.013 +y_0=5400088.438 +ellps=intl +towgs84=-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747 +units=m +no_defs');
proj4.defs('EPSG:3812', '+proj=lcc +lat_0=50.797815 +lon_0=4.35921583333333 +lat_1=49.8333333333333 +lat_2=51.1666666666667 +x_0=649328 +y_0=665262 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,1.9342,-1.6677,9.1019,4.0725 +units=m +no_defs');

export const STELSELS = [
  ['lokaal', 'Lokaal (zelf op de kaart leggen)'],
  ['EPSG:31370', 'Lambert 72 (België)'],
  ['EPSG:3812', 'Lambert 2008 (België)'],
  ['EPSG:28992', 'RD New (Nederland)'],
];

const EENHEID = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1, 14: 0.1 };

function paren(tekst) {
  const r = tekst.split(/\r?\n/);
  const uit = [];
  for (let i = 0; i + 1 < r.length; i += 2) uit.push([r[i].trim(), r[i + 1]]);
  return uit;
}

// Entiteiten lezen tot een eindcode; geeft een lijst { type, w: [[code, waarde]] }.
function entiteiten(p, i, stop) {
  const uit = [];
  while (i < p.length) {
    if (p[i][0] !== '0') { i++; continue; }
    const t = p[i][1].trim();
    if (stop.includes(t)) break;
    const e = { type: t, w: [] };
    i++;
    while (i < p.length && p[i][0] !== '0') { e.w.push(p[i]); i++; }
    uit.push(e);
  }
  return { lijst: uit, i };
}
const get = (e, c) => { const x = e.w.find(([k]) => k === c); return x ? x[1].trim() : null; };
const getN = (e, c, d = 0) => { const v = Number(get(e, c)); return Number.isFinite(v) && get(e, c) !== null ? v : d; };

// Entiteiten → lijnen en teksten, met een transformatie (voor blokken).
function verwerk(lijst, blokken, T, uitL, uitT, diepte = 0) {
  let poly = null;
  for (const e of lijst) {
    const laag = get(e, '8') || '0';
    if (e.type === 'LINE') uitL.push({ laag, c: [T([getN(e, '10'), getN(e, '20')]), T([getN(e, '11'), getN(e, '21')])] });
    else if (e.type === 'LWPOLYLINE') {
      const c = []; let x = null;
      for (const [k, v] of e.w) { if (k === '10') x = Number(v); else if (k === '20' && x != null) { c.push(T([x, Number(v)])); x = null; } }
      if ((getN(e, '70') & 1) && c.length > 2) c.push(c[0]);
      if (c.length > 1) uitL.push({ laag, c });
    } else if (e.type === 'POLYLINE') poly = { laag, c: [], dicht: (getN(e, '70') & 1) === 1 };
    else if (e.type === 'VERTEX' && poly) poly.c.push(T([getN(e, '10'), getN(e, '20')]));
    else if (e.type === 'SEQEND' && poly) { if (poly.dicht && poly.c.length > 2) poly.c.push(poly.c[0]); if (poly.c.length > 1) uitL.push({ laag: poly.laag, c: poly.c }); poly = null; }
    else if (e.type === 'CIRCLE' || e.type === 'ARC') {
      const cx = getN(e, '10'); const cy = getN(e, '20'); const r = getN(e, '40');
      let a0 = e.type === 'ARC' ? getN(e, '50') : 0; let a1 = e.type === 'ARC' ? getN(e, '51') : 360;
      if (a1 < a0) a1 += 360;
      const n = Math.max(8, Math.ceil((a1 - a0) / 10));
      const c = [];
      for (let k = 0; k <= n; k++) { const t = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180; c.push(T([cx + r * Math.cos(t), cy + r * Math.sin(t)])); }
      uitL.push({ laag, c });
    } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
      const t = (get(e, '1') || '').replace(/\\P/g, ' ').replace(/\{\\[^;]*;|\}/g, '').trim();
      if (t) {
        const p0 = [getN(e, '10'), getN(e, '20')];
        const p1 = T(p0); const p2 = T([p0[0] + Math.cos((getN(e, '50') * Math.PI) / 180), p0[1] + Math.sin((getN(e, '50') * Math.PI) / 180)]);
        uitT.push({ laag, p: p1, t: t.slice(0, 80), h: getN(e, '40', 1), rot: (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI });
      }
    } else if (e.type === 'INSERT' && diepte < 8) {
      const b = blokken.get(get(e, '2'));
      if (!b) continue;
      const sx = getN(e, '41', 1); const sy = getN(e, '42', 1);
      const rot = (getN(e, '50', 0) * Math.PI) / 180;
      const ix = getN(e, '10'); const iy = getN(e, '20');
      const kol = Math.max(1, getN(e, '70', 1)); const rij = Math.max(1, getN(e, '71', 1));
      const dk = getN(e, '44', 0); const dr = getN(e, '45', 0);
      for (let r = 0; r < rij; r++) {
        for (let k = 0; k < kol; k++) {
          const ox = k * dk; const oy = r * dr;
          const Tb = ([x, y]) => {
            const lx = (x - b.base[0]) * sx + ox; const ly = (y - b.base[1]) * sy + oy;
            return T([ix + lx * Math.cos(rot) - ly * Math.sin(rot), iy + lx * Math.sin(rot) + ly * Math.cos(rot)]);
          };
          verwerk(b.lijst, blokken, Tb, uitL, uitT, diepte + 1);
        }
      }
    }
  }
}

export function leesDxf(tekst) {
  const p = paren(tekst);
  let eenheid = 1;
  for (let i = 0; i < p.length - 2; i++) {
    if (p[i][0] === '9' && p[i][1].trim() === '$INSUNITS' && p[i + 1][0] === '70') { eenheid = EENHEID[Number(p[i + 1][1])] || 1; break; }
  }
  // Blokken
  const blokken = new Map();
  const bs = p.findIndex(([c, v], i) => c === '2' && v.trim() === 'BLOCKS' && p[i - 1]?.[1]?.trim() === 'SECTION');
  if (bs >= 0) {
    let i = bs + 1;
    while (i < p.length) {
      if (p[i][0] === '0' && p[i][1].trim() === 'ENDSEC') break;
      if (p[i][0] === '0' && p[i][1].trim() === 'BLOCK') {
        const kop = { type: 'BLOCK', w: [] };
        i++;
        while (i < p.length && p[i][0] !== '0') { kop.w.push(p[i]); i++; }
        const r = entiteiten(p, i, ['ENDBLK']);
        blokken.set(get(kop, '2'), { base: [getN(kop, '10'), getN(kop, '20')], lijst: r.lijst });
        i = r.i + 1;
      } else i++;
    }
  }
  const start = p.findIndex(([c, v], i) => c === '2' && v.trim() === 'ENTITIES' && p[i - 1]?.[1]?.trim() === 'SECTION');
  if (start < 0) throw new Error('Geen tekening (ENTITIES) gevonden in dit DXF-bestand.');
  const { lijst } = entiteiten(p, start + 1, ['ENDSEC']);
  const lijnen = [];
  const teksten = [];
  verwerk(lijst, blokken, (c) => c, lijnen, teksten);
  if (!lijnen.length && !teksten.length) throw new Error('Geen lijnen of teksten gevonden in dit DXF-bestand.');
  if (lijnen.length > 200000) throw new Error(`Deze tekening heeft ${lijnen.length} lijnen; dat is te zwaar voor de browser. Zet overbodige lagen uit in je CAD-programma.`);
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const l of lijnen) for (const [x, y] of l.c) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  for (const t of teksten) { const [x, y] = t.p; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return { lijnen, teksten, eenheid, kader: [minX, minY, maxX, maxY], lagen: [...new Set(lijnen.map((l) => l.laag))], blokken: blokken.size };
}

// Raad het stelsel uit de coördinaten.
export function raadStelsel(d) {
  const [x0, y0, x1, y1] = d.kader;
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  if (d.eenheid === 1 && cx > 20000 && cx < 300000 && cy > 140000 && cy < 250000) return 'EPSG:31370';
  if (d.eenheid === 1 && cx > 500000 && cx < 800000 && cy > 500000 && cy < 800000) return 'EPSG:3812';
  if (d.eenheid === 1 && cx > 0 && cx < 300000 && cy > 290000 && cy < 630000) return 'EPSG:28992';
  return 'lokaal';
}

// Naar een JSON om te bewaren: lijnen en teksten, in WGS84 (vast) of lokaal in meter rond het midden.
export function naarOnderlegger(d, stelsel) {
  const [x0, y0, x1, y1] = d.kader;
  if (stelsel !== 'lokaal') {
    const f = (c) => proj4(stelsel, 'EPSG:4326', c);
    return {
      vast: true,
      lijnen: d.lijnen.map((l) => ({ laag: l.laag, c: l.c.map(f).map(([a, b]) => [Math.round(a * 1e7) / 1e7, Math.round(b * 1e7) / 1e7]) })),
      teksten: d.teksten.map((t) => ({ ...t, p: f(t.p) })),
    };
  }
  const k = d.eenheid;
  const mx = (x0 + x1) / 2; const my = (y0 + y1) / 2;
  const f = ([x, y]) => [Math.round((x - mx) * k * 1000) / 1000, Math.round((y - my) * k * 1000) / 1000];
  return {
    vast: false,
    breedte: (x1 - x0) * k, hoogte: (y1 - y0) * k,
    lijnen: d.lijnen.map((l) => ({ laag: l.laag, c: l.c.map(f) })),
    teksten: d.teksten.map((t) => ({ ...t, p: f(t.p), h: t.h * k })),
  };
}
