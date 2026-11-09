'use client';

// Camerabeeld: wat een camera in het binnenplan echt ziet. Echte perspectief (CSS 3D, de browser rekent
// de projectie en de diepte), op ware maat in meter: de frame-wanden met hun doeken, truss met doeken,
// andere items als blokken op hun hoogte, renners op hun lengte, de tentwand en de vloer.
// Lens: Canon HJ14ex4.3B (4,3–60 mm, 2× extender) op een 2/3"-sensor van 9,6 × 5,4 mm (16:9).
import { useEffect, useMemo, useRef, useState } from 'react';
import { wandStukken, isVrij, isWand, wandInst } from './framewand';
import { trussStukken, isTrussBouw } from './trussbouw';
import { doekVlak } from './TrussStudio';
import { publiekeUrl } from './db';

export const LENS = { naam: 'Canon HJ14ex4.3B (14×)', fMin: 4.3, fMax: 60, extender: 2, sensorB: 9.6, sensorH: 5.4, mod: 0.3 };
export const CAMERA_STANDAARD = { h: 1.6, f: 12, ext: false, kantel: 0 };
export const RENNER_LENGTE = 1.87;
export const isCamera = (el) => !!el?.eigenschappen?.tekening?.vlakken?.some((v) => v.zicht);
export const cameraVan = (it) => ({ ...CAMERA_STANDAARD, ...(it?.velden?.camera || {}) });
export const brandpunt = (c) => (Number(c.f) || CAMERA_STANDAARD.f) * (c.ext ? LENS.extender : 1);
export const kijkhoek = (f) => ({ h: 2 * Math.atan(LENS.sensorB / (2 * f)), v: 2 * Math.atan(LENS.sensorH / (2 * f)) });
const graad = (r) => (r * 180) / Math.PI;
const draai = ([x, y], g) => { const a = (g * Math.PI) / 180; return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)]; };
// Kijkrichting van een camera-item in het plan (de tekening kijkt naar -y).
export const kijkRichting = (rot) => draai([0, -1], Number(rot) || 0);
export const rotNaar = (d) => graad(Math.atan2(-d[0], -d[1]));

const B2 = 0.145; // halve trussbreedte (H30V)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const kruis = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Een vlak: o = linksboven (zoals je ervoor staat), u = naar rechtsboven, v = naar linksonder (meter).
// stijl: { kleur, beeld: { src, TW, TH, ox, oy, wijze, start }, rand, dekking, twee (ook achterkant zichtbaar) }
const vlak = (o, u, v, stijl) => ({ o, u, v, ...stijl });
function blok(c, b, d, h, rot, kleur, extra = {}) {
  // Blok met onderkant op hoogte c[2], b langs de richting rot (graden in het plan, zoals de items), d diep.
  const ux = draai([1, 0], rot); const uy = draai([0, 1], rot);
  const X = [ux[0] * b, ux[1] * b, 0]; const Y = [uy[0] * d, uy[1] * d, 0]; const Z = [0, 0, h];
  const p0 = [c[0] - X[0] / 2 - Y[0] / 2, c[1] - X[1] / 2 - Y[1] / 2, c[2]];
  const P = (i, j, k) => add(add(add(p0, mul(X, i)), mul(Y, j)), mul(Z, k));
  const dk = (f) => ({ kleur: shade(kleur, f), ...extra });
  return [
    vlak(P(0, 0, 1), X, mul(Z, -1), dk(0.95)), // voor (-Y)
    vlak(P(1, 1, 1), mul(X, -1), mul(Z, -1), dk(0.85)), // achter
    vlak(P(0, 1, 1), mul(Y, -1), mul(Z, -1), dk(0.75)), // links
    vlak(P(1, 0, 1), Y, mul(Z, -1), dk(0.8)), // rechts
    vlak(P(0, 1, 1), X, mul(Y, -1), dk(1.05)), // boven
  ];
}
function shade(hex, f) {
  const s = String(hex || '#9CA3AF').replace('#', ''); const v = s.length === 3 ? s.split('').map((x) => x + x).join('') : s.padEnd(6, '0');
  const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(v.slice(i, i + 2), 16) * f))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Renner op ware lengte: een getekende figuur (vooraanzicht, renner in koerspak) die altijd naar de camera kijkt.
// Tekening in centimeter voor 187 cm (8 hoofden), 64 cm breed; ze schaalt mee met de lengte.
const RENNER_B = 64;
const rennerSvg = (kleur, accent = '#15171C', helm = true, vrouw = false) => {
  const effen = accent.toLowerCase() === kleur.toLowerCase(); // effen pak: geen witte details
  // Vrouw: smallere schouders en romp, iets bredere heupen, smaller hoofd en lang haar in een staart.
  const romp = vrouw ? 'transform="translate(32 0) scale(0.88 1) translate(-32 0)"' : ''; const heup = vrouw ? 'transform="translate(32 0) scale(0.9 1) translate(-32 0)"' : '';
  const huid = '#D9A47E'; const huidD = '#C08A66'; const haar = '#3B2A20'; const zwart = '#15171C';
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 187" width="640" height="1870">
<defs><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
<!-- benen -->
<path d="M22.5 118 C21.5 132 22 146 23.2 160 C23.8 168 23.6 176 23.4 181 L28.6 181 C29 172 29.6 162 30.2 150 C30.6 140 31 128 31.4 118 Z" fill="${huid}"/>
<path d="M41.5 118 C42.5 132 42 146 40.8 160 C40.2 168 40.4 176 40.6 181 L35.4 181 C35 172 34.4 162 33.8 150 C33.4 140 33 128 32.6 118 Z" fill="${huid}"/>
<path d="M24 138 C25 140 27 141 29.5 140.5" stroke="${huidD}" stroke-width=".5" fill="none"/><path d="M40 138 C39 140 37 141 34.5 140.5" stroke="${huidD}" stroke-width=".5" fill="none"/>
<!-- schoenen -->
<path d="M21.6 180.5 C21.2 184 22 186.4 24.2 186.6 L29.6 186.6 C30 184 29.6 181.6 28.8 180.5 Z" fill="${zwart}"/>
<path d="M42.4 180.5 C42.8 184 42 186.4 39.8 186.6 L34.4 186.6 C34 184 34.4 181.6 35.2 180.5 Z" fill="${zwart}"/>
<g ${heup}>
<!-- broek (koersbroek tot boven de knie) -->
<path d="M19.6 86 L44.4 86 C45.6 98 45.2 110 43.2 123 L33.2 123 L32 102 L30.8 123 L20.8 123 C18.8 110 18.4 98 19.6 86 Z" fill="${zwart}"/>
</g>
<g ${romp}>
<!-- armen -->
<path d="M13.6 33.5 C10.6 36 9.6 44 9.4 54 C9.2 66 9.6 78 10.2 89 C10.4 93 10.6 97 11 100.5 L14.6 100.5 C14.8 96 15 92 15.4 88 C16.4 77 17 66 17.4 56 C17.6 48 17.6 40 16.8 34 Z" fill="${huid}"/>
<path d="M50.4 33.5 C53.4 36 54.4 44 54.6 54 C54.8 66 54.4 78 53.8 89 C53.6 93 53.4 97 53 100.5 L49.4 100.5 C49.2 96 49 92 48.6 88 C47.6 77 47 66 46.6 56 C46.4 48 46.4 40 47.2 34 Z" fill="${huid}"/>
<ellipse cx="12.8" cy="104" rx="2.6" ry="4.4" fill="${huid}"/><ellipse cx="51.2" cy="104" rx="2.6" ry="4.4" fill="${huid}"/>
<!-- trui met korte mouwen -->
<path d="M26 27.2 L38 27.2 C43 29 49 30.4 51.6 33.6 C53.6 36.6 54.6 42 54.8 48 L46.6 49.6 C46.6 56 46 64 45.6 72 C45.2 78 44.8 83 44.6 88 L19.4 88 C19.2 83 18.8 78 18.4 72 C18 64 17.4 56 17.4 49.6 L9.2 48 C9.4 42 10.4 36.6 12.4 33.6 C15 30.4 21 29 26 27.2 Z" fill="${kleur}"/>
<path d="M21.6 52 L42.4 52 L42 60.5 L22 60.5 Z" fill="${accent}"/>${effen ? '' : '<path d="M23.2 54.2 L40.8 54.2 L40.6 58.3 L23.4 58.3 Z" fill="#fff" opacity=".85"/>'}
<path d="M12.6 36 C14.4 34.4 16.4 33.6 18 33.6 L17.6 46 L10 44.6 C10.3 41 11.2 38 12.6 36 Z" fill="${accent}" opacity=".9"/><path d="M51.4 36 C49.6 34.4 47.6 33.6 46 33.6 L46.4 46 L54 44.6 C53.7 41 52.8 38 51.4 36 Z" fill="${accent}" opacity=".9"/>
${effen ? '' : '<path d="M26 40 L31 40 M33 40 L38 40" stroke="#fff" stroke-width="1" opacity=".55"/><path d="M24.4 72 L39.6 72" stroke="#fff" stroke-width=".8" opacity=".45"/>'}
<path d="M26 27.2 L32 33 L38 27.2" stroke="${effen ? '#3A3D44' : '#fff'}" stroke-width="1.1" fill="none" opacity=".85"/>
<path d="M9.2 48 L17.4 49.6 M54.8 48 L46.6 49.6" stroke="${effen ? '#3A3D44' : '#fff'}" stroke-width="1.2" opacity=".85"/>
<path d="M26 27.2 L38 27.2 C43 29 49 30.4 51.6 33.6 C53.6 36.6 54.6 42 54.8 48 L46.6 49.6 C46.6 56 46 64 45.6 72 C45.2 78 44.8 83 44.6 88 L19.4 88 C19.2 83 18.8 78 18.4 72 C18 64 17.4 56 17.4 49.6 L9.2 48 C9.4 42 10.4 36.6 12.4 33.6 C15 30.4 21 29 26 27.2 Z" fill="url(#t)"/>
</g>
${vrouw ? `<path d="M24.6 10 C23.6 18 24 25 25.6 30.5 C27 31.4 28.4 30.6 28.6 28 L35.4 28 C35.6 30.6 37 31.4 38.4 30.5 C40 25 40.4 18 39.4 10 Z" fill="${haar}"/>` : ''}
<!-- hals en hoofd -->
<path d="M28 21 L36 21 L36.6 28.4 C35 30 29 30 27.4 28.4 Z" fill="${huidD}"/>
<ellipse cx="32" cy="12.2" rx="${vrouw ? 7 : 7.6}" ry="${vrouw ? 10.1 : 10.6}" fill="${huid}"/>
<ellipse cx="24.6" cy="13.4" rx="1.3" ry="2.4" fill="${huidD}"/><ellipse cx="39.4" cy="13.4" rx="1.3" ry="2.4" fill="${huidD}"/>
<path d="M24.3 10.8 C24 4.4 27.6 1 32 1 C36.6 1 40.2 4.4 39.7 10.8 C38.6 7.4 36 5.8 32 5.8 C28 5.8 25.4 7.4 24.3 10.8 Z" fill="${haar}"/>
<ellipse cx="29.1" cy="12.2" rx="1.05" ry=".7" fill="#2A211C"/><ellipse cx="34.9" cy="12.2" rx="1.05" ry=".7" fill="#2A211C"/>
<path d="M27.6 10.4 L30.4 10 M33.6 10 L36.4 10.4" stroke="${haar}" stroke-width=".6"/>
<path d="M32 12.6 L31.4 16 L32.8 16.2" stroke="${huidD}" stroke-width=".5" fill="none"/>
${helm ? `<path d="M23 11.6 C22.4 3.6 27 -0.6 32 -0.6 C37 -0.6 41.6 3.6 41 11.6 C39.6 9.2 36.4 8 32 8 C27.6 8 24.4 9.2 23 11.6 Z" fill="#F4F5F7" stroke="#C9CDD3" stroke-width=".4"/><path d="M26.4 3.2 C28.4 2 30 1.7 31 1.7 L30.6 6.2 C28.8 6.4 27.2 7 25.6 7.8 Z M37.6 3.2 C35.6 2 34 1.7 33 1.7 L33.4 6.2 C35.2 6.4 36.8 7 38.4 7.8 Z" fill="#1F2937"/><path d="M23.6 11.4 C24.4 15 25.4 19 27.6 21.6 M40.4 11.4 C39.6 15 38.6 19 36.4 21.6" stroke="#1F2937" stroke-width=".55" fill="none"/>` : ''}
<path d="M30 18.6 C31.3 19.3 32.7 19.3 34 18.6" stroke="#9C5A4A" stroke-width=".6" fill="none"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
};
const rennerCache = new Map();
function renner(p, H, rechts, kit = {}, vrouw = false) {
  const kleur = kit.kleur || '#15171C'; const accent = kit.accent || '#15171C'; const sleutel = `${kleur}|${accent}|${kit.helm !== false}|${vrouw}`;
  if (!rennerCache.has(sleutel)) rennerCache.set(sleutel, rennerSvg(kleur, accent, kit.helm !== false, vrouw));
  const k = H / 1.87; const B = (RENNER_B / 100) * k; // breedte schaalt mee met de lengte
  const u = [rechts[0] * B, rechts[1] * B, 0]; const o = [p[0] - u[0] / 2, p[1] - u[1] / 2, H];
  const schaduw = vlak([p[0] - 0.35 * k, p[1] + 0.3 * k, 0.002], [0.7 * k, 0, 0], [0, -0.6 * k, 0], { kleur: 'transparent', schaduw: true, twee: true });
  return [schaduw, vlak(o, u, [0, 0, -H], { kleur: 'transparent', beeld: { src: rennerCache.get(sleutel), TW: B, TH: H, ox: 0, oy: 0, wijze: 'passend' }, renner: true, twee: true })];
}

// Alles wat in het binnenplan staat als vlakken in 3D.
export function bouwScene({ inrichting, elementenMap, lokaalVan, hostRing, cameraId }) {
  const vl = []; const renners = []; const beelden = new Set();
  const ontwerp = (id) => { const d = id ? elementenMap.get(id) : null; return d ? { kleur: d.eigenschappen?.kleur || '#64748B', src: d.eigenschappen?.beeld ? publiekeUrl(d.eigenschappen.beeld) : null, verhouding: Number(d.eigenschappen?.verhouding) || null } : null; };
  for (const it of inrichting) {
    const el = it.element_id ? elementenMap.get(it.element_id) : null; const g = lokaalVan(it).geometrie; const lok = lokaalVan(it);
    if (it.velden?.punt) { if (it.velden.punt.type === 'renner') renners.push({ id: it.id, p: g.coordinates, H: Number(it.velden.punt.lengte) || RENNER_LENGTE, naam: it.naam || '', vrouw: !!it.velden.punt.vrouw }); continue; }
    if (!el) continue;
    if (isWand(el) && isVrij(it) && g.type === 'LineString') {
      const d = wandInst(el).diepte / 2;
      for (const f of wandStukken(g.coordinates, it, el)) {
        const u = [Math.cos(f.r), Math.sin(f.r), 0]; const n = [u[1], -u[0], 0]; const a = [f.a[0], f.a[1], 0]; const top = f.z0 + f.h;
        const Z = [0, 0, -f.h]; const U = mul(u, f.b);
        // profiel (in het midden, langs beide kanten zichtbaar)
        vl.push(vlak(add(a, [0, 0, top]), U, Z, { kleur: 'transparent', rand: '#B8BDC4', randB: 0.031, twee: true, frame: true }));
        for (const kant of ['voor', 'achter']) {
          const o = ontwerp(f[kant]); if (!o) continue;
          const ov = f[`${kant}Over`]; const W = f.b; const H = f.h;
          const TW = ov ? W / Math.max(0.0001, ov.u1 - ov.u0) : W; const TH = ov ? H / Math.max(0.0001, ov.v1 - ov.v0) : H;
          const bl = { src: o.src, TW, TH, ox: ov ? ov.u0 * TW : 0, oy: ov ? ov.v0 * TH : 0, wijze: f[`${kant}Pl`] || 'vullen', start: f[`${kant}St`] || 'rechts', verhouding: o.verhouding };
          if (o.src) beelden.add(o.src);
          if (kant === 'voor') vl.push(vlak(add(add(a, mul(n, d)), [0, 0, top]), U, Z, { kleur: o.kleur, beeld: o.src ? bl : null, doek: true }));
          else { const e = add(a, U); vl.push(vlak(add(add(e, mul(n, -d)), [0, 0, top]), mul(U, -1), Z, { kleur: o.kleur, beeld: o.src ? bl : null, doek: true })); }
        }
      }
      continue;
    }
    if (isTrussBouw(it) && g.type === 'LineString') {
      const st = trussStukken(g.coordinates, it); const zwart = /zwart/i.test(el.naam || '');
      const kl = zwart ? '#1F2937' : '#C0C4CA';
      for (const s of st) {
        if (s.op) vl.push(...blok([s.a[0], s.a[1], s.a[2]], 0.29, 0.29, s.L + 2 * B2, graad(-s.r) + 90, kl, { tralie: true }));
        else { const m = [(s.a[0] + s.e[0]) / 2, (s.a[1] + s.e[1]) / 2]; vl.push(...blok([m[0], m[1], s.a[2]], s.L, 0.29, 0.29, graad(-s.r), kl, { tralie: true })); }
      }
      for (const dk of it.velden?.truss?.doeken || []) {
        const V = doekVlak(dk, st); if (!V) continue;
        const { u, n, o, s0, s1, z0, z1, off } = V; const P = (sv, z) => [o[0] + u[0] * sv + n[0] * off, o[1] + u[1] * sv + n[1] * off, z + B2];
        for (const kant of ['voor', 'achter']) {
          const ow = ontwerp(dk[kant]); if (!ow) continue; if (ow.src) beelden.add(ow.src);
          const W = s1 - s0; const H = z1 - z0; const bl = ow.src ? { src: ow.src, TW: W, TH: H, ox: 0, oy: 0, wijze: dk.plaatsing || 'vullen', start: dk.start || 'rechts', verhouding: ow.verhouding } : null;
          const eps = kant === 'voor' ? 0.004 : -0.004; const nn = [n[0] * eps, n[1] * eps, 0];
          if (kant === 'voor') vl.push(vlak(add(P(s0, z1), nn), sub(P(s1, z1), P(s0, z1)), [0, 0, -H], { kleur: ow.kleur, beeld: bl, doek: true }));
          else vl.push(vlak(add(P(s1, z1), nn), sub(P(s0, z1), P(s1, z1)), [0, 0, -H], { kleur: ow.kleur, beeld: bl, doek: true }));
        }
      }
      continue;
    }
    const H = Number(el.hoogte_m) || 0;
    if (isCamera(el)) {
      if (it.id === cameraId) continue;
      const c = cameraVan(it); const p = lok.midden || g.coordinates?.[0]; if (!p) continue;
      vl.push(...blok([p[0], p[1], 0], 0.05, 0.05, c.h - 0.1, 0, '#374151'), ...blok([p[0], p[1], c.h - 0.12], 0.14, 0.32, 0.22, Number(lok.rot) || 0, '#111827'));
      continue;
    }
    if (!(H > 0)) continue;
    if (g.type === 'LineString') { // hek, paaltjes: een (half)doorzichtige wand op zijn hoogte
      const c = g.coordinates; for (let i = 0; i < c.length - 1; i++) { const a = [c[i][0], c[i][1], H]; const b = [c[i + 1][0], c[i + 1][1], H]; vl.push(vlak(a, sub(b, a), [0, 0, -H], { kleur: el.stijl?.kleur || '#6B7280', dekking: 0.35, twee: true, tralie: true })); }
    } else if (g.type === 'Polygon') { // blok op zijn voetafdruk
      const r = g.coordinates[0]; for (let i = 0; i < r.length - 1; i++) { const a = [r[i][0], r[i][1], H]; const b = [r[i + 1][0], r[i + 1][1], H]; vl.push(vlak(a, sub(b, a), [0, 0, -H], { kleur: shade(el.stijl?.kleur || '#9CA3AF', 0.9), twee: true })); }
    }
  }
  if (hostRing) for (let i = 0; i < hostRing.length - 1; i++) { const a = [hostRing[i][0], hostRing[i][1], 3]; const b = [hostRing[i + 1][0], hostRing[i + 1][1], 3]; vl.push(vlak(a, sub(b, a), [0, 0, -3], { kleur: '#F3F4F6', twee: true, wand: true })); }
  return { vlakken: vl, renners, beelden: [...beelden] };
}

const cache = new Map();
function useVerhoudingen(srcs) {
  const [, setTik] = useState(0);
  useEffect(() => {
    let weg = false;
    for (const s of srcs) { if (cache.has(s)) continue; cache.set(s, null); const i = new Image(); i.onload = () => { cache.set(s, i.naturalWidth / Math.max(1, i.naturalHeight)); if (!weg) setTik((x) => x + 1); }; i.src = s; }
    return () => { weg = true; };
  }, [srcs.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (s, gegeven) => Number(gegeven) || cache.get(s) || null;
}

// CSS-achtergrond van een doek (of een stuk ervan: x0, y0 in meter vanaf linksboven van het vlak).
function achtergrond(bl, r, K) {
  if (!bl?.src) return {};
  const { TW, TH, ox, oy, wijze } = bl;
  if (wijze === 'herhalen' && r) {
    const stuk = TH * r; const n = Math.max(1, Math.ceil(TW / stuk - 1e-6));
    const x0 = bl.start === 'links' ? 0 : bl.start === 'midden' ? (TW - n * stuk) / 2 : TW - n * stuk;
    return { backgroundImage: `url("${bl.src}")`, backgroundSize: `${stuk * K}px ${TH * K}px`, backgroundRepeat: 'repeat-x', backgroundPosition: `${(x0 - ox) * K}px ${-oy * K}px` };
  }
  let bw = TW; let bh = TH;
  if (r) { const slice = wijze !== 'passend' && wijze !== 'herhalen'; if ((TW / TH > r) === slice) { bw = TW; bh = TW / r; } else { bh = TH; bw = TH * r; } }
  return { backgroundImage: `url("${bl.src}")`, backgroundSize: `${bw * K}px ${bh * K}px`, backgroundRepeat: 'no-repeat', backgroundPosition: `${((TW - bw) / 2 - ox) * K}px ${((TH - bh) / 2 - oy) * K}px` };
}

// px per meter in de 3D-scène. Elk vlak wordt een beeldlaag in het geheugen van de browser: op een gsm
// (scherm met hoge pixeldichtheid, weinig geheugen) dus laag houden, anders sluit Safari de pagina.
const K = 100; // schaal van de scène zelf (geen beeldlaag)
const KLEIN = typeof window !== 'undefined' && ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth < 820);
const KMIN = 12; const KMAX = KLEIN ? 170 : 320; // resolutie per vlak (px per meter), volgens hoe groot het op het scherm staat
const NABIJ = 0.08; // meter: wat dichter bij de lens is, wordt niet getekend

export function CameraZicht({ scene, cam, breed, hoog, kit }) {
  // cam: { p: [x, y, z], yaw (rad, kijkrichting in het plan), pitch (rad, + = omhoog), f (mm) }
  const ratio = useVerhoudingen(scene.beelden);
  const fwd = [Math.cos(cam.pitch) * cam.dir[0], Math.cos(cam.pitch) * cam.dir[1], Math.sin(cam.pitch)];
  const rechts = norm(kruis(fwd, [0, 0, 1])); const omlaag = norm(kruis(fwd, rechts));
  const P = (hoog / 2) * (cam.f / (LENS.sensorH / 2)); // perspectiefafstand in px: verticale kijkhoek past op de hoogte
  const diepte = (q) => dot(sub(q, cam.p), fwd);
  // Wereld (m) → CSS (px): x = rechts, y = omlaag, z = P − diepte
  const M = [rechts[0] * K, omlaag[0] * K, -fwd[0] * K, 0, rechts[1] * K, omlaag[1] * K, -fwd[1] * K, 0, rechts[2] * K, omlaag[2] * K, -fwd[2] * K, 0,
    -dot(rechts, cam.p) * K, -dot(omlaag, cam.p) * K, P + dot(fwd, cam.p) * K, 1];

  const alle = [...scene.vlakken];
  // Renners kijken naar de camera (de figuur staat haaks op de kijklijn).
  for (const r of scene.renners) { const d = norm([r.p[0] - cam.p[0], r.p[1] - cam.p[1], 0]); alle.push(...renner(r.p, r.H, [d[1], -d[0]], kit, r.vrouw)); }
  // Vloer: tegels van 1 m rond de camera, in de kijkrichting.
  const vloer = [];
  // Tegels van 2 m tot 20 m ver (minder lagen = minder geheugen).
  const cx = Math.round(cam.p[0] / 2) * 2; const cy = Math.round(cam.p[1] / 2) * 2;
  for (let i = -10; i < 10; i++) for (let j = -10; j < 10; j++) { const o = [cx + i * 2, cy + j * 2 + 2, 0]; if (dot(sub([o[0] + 1, o[1] - 1, 0], cam.p), fwd) < -1) continue; vloer.push(vlak(o, [2, 0, 0], [0, -2, 0], { kleur: (i + j) % 2 ? '#D9DCE1' : '#D3D6DB', vloer: true, twee: true })); }

  const divs = [];
  const zet = (q, key) => {
    // Delen die (deels) achter de lens liggen in stroken knippen, zodat alles wat getekend wordt voor de camera ligt.
    const hoeken = [q.o, add(q.o, q.u), add(add(q.o, q.u), q.v), add(q.o, q.v)];
    const ds = hoeken.map(diepte); if (Math.max(...ds) < NABIJ) return;
    // Buiten beeld (alle hoeken aan dezelfde kant van het beeld): overslaan.
    const sx = hoeken.map((h0, i) => (ds[i] > NABIJ ? (P * dot(rechts, sub(h0, cam.p))) / ds[i] : null)); const sy = hoeken.map((h0, i) => (ds[i] > NABIJ ? (P * dot(omlaag, sub(h0, cam.p))) / ds[i] : null));
    if (ds.every((x) => x > NABIJ)) { const mx = breed / 2 + 2; const my = hoog / 2 + 2; if (sx.every((x) => x > mx) || sx.every((x) => x < -mx) || sy.every((y) => y > my) || sy.every((y) => y < -my)) return; }
    const W = len(q.u); const H = len(q.v); if (W < 1e-4 || H < 1e-4) return;
    // In stukken van hoogstens 2 m (0,5 m als het vlak achter de lens doorloopt). Elk stuk krijgt de
    // resolutie die het op het scherm nodig heeft: dichtbij scherp, veraf weinig geheugen.
    const stukken = [];
    const deels = Math.min(...ds) < NABIJ; const maxS = deels ? 0.5 : 2;
    const nu = Math.min(deels ? 16 : 12, Math.max(1, Math.ceil(W / maxS))); const nv = Math.min(deels ? 12 : 8, Math.max(1, Math.ceil(H / maxS)));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i / nu; const b = (i + 1) / nu; const c = j / nv; const e = (j + 1) / nv;
      const dm = Math.min(...[[a, c], [b, c], [b, e], [a, e]].map(([s, t]) => diepte(add(add(q.o, mul(q.u, s)), mul(q.v, t)))));
      if (dm >= NABIJ) stukken.push([a, c, b - a, e - c, Math.max(KMIN, Math.min(KMAX, Math.round(P / Math.max(0.3, dm))))]);
    }
    const ux = norm(q.u); const vy = norm(q.v); const nz = norm(kruis(ux, vy));
    const r = q.beeld ? ratio(q.beeld.src, q.beeld.verhouding) : null;
    for (const [s0, t0, ds0, dt0, ke] of stukken) {
      const o = add(add(q.o, mul(q.u, s0)), mul(q.v, t0)); const w = W * ds0; const h = H * dt0;
      const m = [ux[0] / ke, ux[1] / ke, ux[2] / ke, 0, vy[0] / ke, vy[1] / ke, vy[2] / ke, 0, nz[0] / ke, nz[1] / ke, nz[2] / ke, 0, o[0], o[1], o[2], 1];
      const bg = q.beeld ? achtergrond(q.beeld, r, ke) : {};
      if (bg.backgroundPosition) { const [bx, by] = bg.backgroundPosition.split(' ').map(parseFloat); bg.backgroundPosition = `${bx - s0 * W * ke}px ${by - t0 * H * ke}px`; }
      divs.push(
        <div key={`${key}-${s0}-${t0}`} style={{
          position: 'absolute', left: 0, top: 0, width: w * ke, height: h * ke, transformOrigin: '0 0', transform: `matrix3d(${m.join(',')})`,
          background: q.kleur, ...bg, opacity: q.dekking ?? 1,
          boxSizing: 'border-box', borderRadius: q.rond ? '38%' : undefined,
          ...(q.schaduw ? { background: 'radial-gradient(closest-side, rgba(0,0,0,.28), rgba(0,0,0,0))' } : {}), border: q.rand ? `${(q.randB || 0.03) * ke}px solid ${q.rand}` : q.vloer ? `${Math.max(1, 0.006 * ke)}px solid rgba(255,255,255,.55)` : undefined,
          ...(q.tralie && !q.beeld ? { background: `repeating-linear-gradient(45deg, ${q.kleur} 0 ${0.012 * ke}px, transparent ${0.012 * ke}px ${0.08 * ke}px), repeating-linear-gradient(-45deg, ${q.kleur} 0 ${0.012 * ke}px, transparent ${0.012 * ke}px ${0.08 * ke}px)`, borderTop: `${0.016 * ke}px solid ${q.kleur}`, borderBottom: `${0.016 * ke}px solid ${q.kleur}` } : {}),
        }} />,
      );
    }
  };
  vloer.forEach((q, i) => zet(q, `v${i}`));
  alle.forEach((q, i) => zet(q, `q${i}`));
  return (
    <div style={{ position: 'relative', width: breed, height: hoog, overflow: 'hidden', background: '#EEF0F3', perspective: `${P}px`, perspectiveOrigin: '50% 50%' }}>
      <div style={{ position: 'absolute', left: breed / 2, top: hoog / 2, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `matrix3d(${M.join(',')})` }}>
        <div style={{ position: 'absolute', transformStyle: 'preserve-3d' }}>{divs}</div>
      </div>
    </div>
  );
}

// Kadrering volgens de gangbare benamingen, op basis van hoeveel van de renner in beeld is.
export function kadrering(beeldHoogte, H) {
  const x = beeldHoogte / H;
  if (x >= 1.15) return 'Totaal (volledig in beeld)';
  if (x >= 0.75) return 'Halftotaal (knie en hoger)';
  if (x >= 0.5) return 'Medium shot (heup en hoger)';
  if (x >= 0.3) return 'Medium close-up (borst en hoger)';
  if (x >= 0.17) return 'Close-up (hoofd en schouders)';
  return 'Extreme close-up';
}

// Eerste vlak dat de lijn van c in richting r raakt (meter), met een filter.
export function straal(vlakken, c, r, filter = () => true, min = 0.05) {
  let best = null;
  for (const q of vlakken) {
    if (!filter(q)) continue;
    const n = kruis(q.u, q.v); const den = dot(r, n); if (Math.abs(den) < 1e-9) continue;
    const t = dot(sub(q.o, c), n) / den; if (t < min || (best && t >= best.t)) continue;
    const p = add(c, mul(r, t)); const w = sub(p, q.o); const a = dot(w, q.u) / dot(q.u, q.u); const b = dot(w, q.v) / dot(q.v, q.v);
    if (a >= 0 && a <= 1 && b >= 0 && b <= 1) best = { t, q };
  }
  return best;
}

// Het venster: groot camerabeeld met de instellingen van de camera ernaast.
export function CameraVenster({ it, naam, scene: sceneIn, lok, schrijven, onCamera, onStand, onRenner, onSluit, onDeel, beginBeeld = null }) {
  // beginBeeld: startbeeld uit een link ({ c, m, rot, r }): plaats, richting, lens en renners zoals de afzender ze zag.
  const [deelLink, setDeelLink] = useState(''); const [deelBezig, setDeelBezig] = useState(false);
  // Renner aanpassen (man/vrouw, lengte): meteen zichtbaar, ook in een deellink; wie mag bewerken, bewaart het ook in het plan.
  const [rennerLokaal, setRennerLokaal] = useState(() => beginBeeld?.r || {});
  const scene = useMemo(() => ({ ...sceneIn, renners: sceneIn.renners.map((x) => ({ ...x, ...(rennerLokaal[x.id] || {}) })) }), [sceneIn, rennerLokaal]);
  const zetRenner = (id, patch) => { setRennerLokaal((x) => ({ ...x, [id]: { ...(x[id] || {}), ...(patch.lengte != null ? { H: patch.lengte } : {}), ...('vrouw' in patch ? { vrouw: !!patch.vrouw } : {}) } })); if (schrijven) onRenner?.(id, patch); };
  const [c, setC] = useState(() => ({ ...cameraVan(it), ...(beginBeeld?.c || {}) }));
  // Plaats en richting van het statief (midden in het plan, rot in graden); bewaard na het navigeren.
  const [stand, setStand] = useState(() => (beginBeeld?.m ? { m: beginBeeld.m, rot: Number(beginBeeld.rot) || 0 } : { m: lok.midden || [0, 0], rot: Number(lok.rot) || 0 }));
  const rot = stand.rot;
  const [lijnen, setLijnen] = useState(true);
  const vak = useRef(null); const [maat, setMaat] = useState({ w: 960, h: 540 });
  useEffect(() => { const e = vak.current; if (!e) return undefined; const ro = new ResizeObserver(() => { const w = e.clientWidth; const h = e.clientHeight; const b = Math.min(w, (h * 16) / 9); setMaat({ w: Math.round(b), h: Math.round((b * 9) / 16) }); }); ro.observe(e); return () => ro.disconnect(); }, []);
  // Bewaren (even wachten tot je klaar bent met schuiven).
  const eerste = useRef(true);
  useEffect(() => { if (eerste.current) { eerste.current = false; return undefined; } if (!schrijven) return undefined; const t = setTimeout(() => onCamera?.(c), 400); return () => clearTimeout(t); }, [c]); // eslint-disable-line react-hooks/exhaustive-deps
  const eersteStand = useRef(true);
  useEffect(() => { if (eersteStand.current) { eersteStand.current = false; return undefined; } if (!schrijven) return undefined; const t = setTimeout(() => onStand?.(stand.m, stand.rot), 350); return () => clearTimeout(t); }, [stand]); // eslint-disable-line react-hooks/exhaustive-deps
  // Verplaatsen in de kijkrichting (vooruit, opzij) in meter.
  const verplaats = (vooruit, opzij) => setStand((x) => { const d = kijkRichting(x.rot); const re = [d[1], -d[0]]; return { ...x, m: [Math.round((x.m[0] + d[0] * vooruit + re[0] * opzij) * 1000) / 1000, Math.round((x.m[1] + d[1] * vooruit + re[1] * opzij) * 1000) / 1000] }; });
  useEffect(() => {
    const t = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onSluit(); return; }
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      const st = e.shiftKey ? 0.25 : 0.05;
      const m = { ArrowUp: [st, 0], ArrowDown: [-st, 0], ArrowLeft: [0, -st], ArrowRight: [0, st] }[e.key];
      if (m) { e.preventDefault(); e.stopPropagation(); verplaats(m[0], m[1]); }
    };
    window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true);
  }, [onSluit, schrijven]); // eslint-disable-line react-hooks/exhaustive-deps

  const dir = kijkRichting(rot); const m0 = stand.m; const p0 = [m0[0] + dir[0] * 0.25, m0[1] + dir[1] * 0.25]; /* de lens zit 25 cm voor het midden van het statief */ const f = brandpunt(c); const kh = kijkhoek(f);
  // Renner waar de camera op gericht is: dichtst bij de kijklijn, binnen de kijkhoek.
  const doel = useMemo(() => {
    let best = null;
    for (const r of scene.renners) {
      const d = [r.p[0] - p0[0], r.p[1] - p0[1]]; const D = Math.hypot(d[0], d[1]); if (D < 0.2 || D > 25) continue;
      const hoek = Math.acos(Math.max(-1, Math.min(1, (d[0] * dir[0] + d[1] * dir[1]) / D)));
      if (hoek > Math.max(kh.h / 2, 0.35) + 0.15) continue;
      if (!best || hoek < best.hoek) best = { ...r, D, hoek };
    }
    return best;
  }, [scene, p0[0], p0[1], dir[0], dir[1], kh.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const gezicht = doel ? doel.H * 0.93 : 1.7;
  const pitch = c.kantel != null ? (c.kantel * Math.PI) / 180 : Math.atan2(gezicht - c.h, doel ? doel.D : 3);
  const cam = { p: [p0[0], p0[1], c.h], dir, pitch, f };
  const fwd = [Math.cos(pitch) * dir[0], Math.cos(pitch) * dir[1], Math.sin(pitch)];
  const Dr = doel ? doel.D / Math.max(0.2, Math.cos(pitch)) : null; // afstand langs de kijklijn
  const bw = Dr ? 2 * Dr * Math.tan(kh.h / 2) : null; const bh = bw ? (bw * 9) / 16 : null;
  const achter = straal(scene.vlakken, cam.p, fwd, (q) => q.doek || q.frame || q.wand, doel ? doel.D * 0.9 : 0.3);
  const aw = achter ? 2 * achter.t * Math.tan(kh.h / 2) : null;
  const zetZoom = (v) => setC((x) => ({ ...x, f: Math.round(v * 10) / 10 }));
  const logF = (v) => Math.exp(Math.log(LENS.fMin) + (Math.log(LENS.fMax) - Math.log(LENS.fMin)) * v);
  const vanF = (fm) => (Math.log(fm) - Math.log(LENS.fMin)) / (Math.log(LENS.fMax) - Math.log(LENS.fMin));
  const draaiNaar = (nr) => { const r0 = Math.round((((nr % 360) + 360) % 360) * 10) / 10; setStand((x) => ({ ...x, rot: r0 })); };
  // Navigeren met de muis in het beeld: slepen = draaien en kantelen (het beeld volgt de muis),
  // rechts slepen of Shift + slepen = de camera verplaatsen over de vloer, Alt + scrollen = vooruit en achteruit,
  // scrollen of knijpen = zoomen (camera blijft op het statief).
  const sleep = useRef(null); const wijzers = useRef(new Map()); const twee = useRef(null);
  // Twee vingers (gsm, tablet): knijpen = zoomen, samen schuiven = de camera verplaatsen.
  const tweeStart = () => { const [a, b] = [...wijzers.current.values()]; twee.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, f: Number(c.f) || 12, m: stand.m, rot }; sleep.current = null; };
  const neer = (e) => {
    if (e.target.closest?.('button, input')) return;
    e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId);
    wijzers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (wijzers.current.size === 2) { tweeStart(); return; }
    if (wijzers.current.size > 2) return;
    const schuif = e.button === 2 || e.button === 1 || e.shiftKey;
    sleep.current = { x: e.clientX, y: e.clientY, rot, kantel: graad(pitch), m: stand.m, schuif };
    if (!schuif && c.kantel == null) setC((x) => ({ ...x, kantel: Math.round(graad(pitch) * 10) / 10 }));
  };
  const sleepBeweeg = (e) => {
    if (wijzers.current.has(e.pointerId)) wijzers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const t2 = twee.current;
    if (t2 && wijzers.current.size === 2) {
      const [a, b] = [...wijzers.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zetZoom(Math.max(LENS.fMin, Math.min(LENS.fMax, t2.f * (d / t2.d))));
      {
        const opMeter = (2 * Math.max(1, doel ? doel.D : 3) * Math.tan(kh.h / 2)) / maat.w; const dd = kijkRichting(t2.rot); const re = [dd[1], -dd[0]];
        const vooruit = ((a.y + b.y) / 2 - t2.my) * opMeter; const opzij = -((a.x + b.x) / 2 - t2.mx) * opMeter;
        setStand((x) => ({ ...x, m: [Math.round((t2.m[0] + dd[0] * vooruit + re[0] * opzij) * 1000) / 1000, Math.round((t2.m[1] + dd[1] * vooruit + re[1] * opzij) * 1000) / 1000] }));
      }
      return;
    }
    const g = sleep.current; if (!g) return;
    const dx = e.clientX - g.x; const dy = e.clientY - g.y;
    if (g.schuif) {
      const opMeter = (2 * Math.max(1, doel ? doel.D : 3) * Math.tan(kh.h / 2)) / maat.w; // meter per pixel op de afstand van de renner
      const d = kijkRichting(g.rot); const re = [d[1], -d[0]];
      const vooruit = dy * opMeter; const opzij = -dx * opMeter;
      setStand((x) => ({ ...x, m: [Math.round((g.m[0] + d[0] * vooruit + re[0] * opzij) * 1000) / 1000, Math.round((g.m[1] + d[1] * vooruit + re[1] * opzij) * 1000) / 1000] }));
      return;
    }
    const perPxH = graad(kh.h) / maat.w; const perPxV = graad(kh.v) / maat.h;
    draaiNaar(g.rot - dx * perPxH);
    setC((x) => ({ ...x, kantel: Math.max(-45, Math.min(45, Math.round((g.kantel + dy * perPxV) * 10) / 10)) }));
  };
  const los = (e) => { wijzers.current.delete(e?.pointerId); if (wijzers.current.size < 2) twee.current = null; sleep.current = null; };
  const wiel = (e) => {
    e.preventDefault();
    /* Alt + scrollen = de camera zelf vooruit/achteruit (van het statief af) */
    if (e.altKey) { verplaats(Math.max(-0.5, Math.min(0.5, -e.deltaY * 0.0025)), Math.max(-0.5, Math.min(0.5, e.deltaX * 0.0025))); return; }
    /* gewoon scrollen of knijpen = de lens zoomen, de camera blijft op het statief */
    if (!e.deltaY) return;
    const knijp = e.ctrlKey && !e.metaKey;
    const k = Math.abs(e.deltaY) < 40 ? Math.exp(-e.deltaY * (knijp ? 0.02 : 0.006)) : e.deltaY < 0 ? 1.08 : 1 / 1.08;
    zetZoom(Math.max(LENS.fMin, Math.min(LENS.fMax, (Number(c.f) || 12) * k)));
  };
  const getal = (v, d = 2) => (v == null ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('nl-BE'));
  return (
    <div className="fm-3d-groot fm-cam" role="dialog" aria-label={`Camerabeeld ${naam}`}>
      <div className="fm-3d-kop"><strong>Camerabeeld · {naam}</strong><span className="fm-sub">Slepen = draaien en kantelen · rechts slepen = camera verplaatsen · scrollen = zoomen · Alt + scrollen = vooruit/achteruit · pijltjes = verplaatsen</span><span style={{ flex: 1 }} /><button className="fm-knop" onClick={onSluit}>Sluiten</button></div>
      <div className="fm-cam-lijf">
        <div className="fm-cam-vak" ref={vak} onWheel={wiel} onPointerDown={neer} onPointerMove={sleepBeweeg} onPointerUp={los} onPointerCancel={los} onContextMenu={(e) => e.preventDefault()}>
          <div className="fm-cam-beeld" style={{ width: maat.w, height: maat.h }}>
            <CameraZicht scene={scene} cam={cam} breed={maat.w} hoog={maat.h} kit={c.renner || {}} />
            {lijnen && (
              <svg className="fm-cam-raster" width={maat.w} height={maat.h} aria-hidden="true">
                {/* derdenlijnen, kruis in het midden, veilige zones (actie 93 %, titel 90 %) zoals in een zoeker */}
                {[[maat.w / 3, 0, maat.w / 3, maat.h], [(maat.w * 2) / 3, 0, (maat.w * 2) / 3, maat.h], [0, maat.h / 3, maat.w, maat.h / 3], [0, (maat.h * 2) / 3, maat.w, (maat.h * 2) / 3]].map(([x1, y1, x2, y2], k) => (
                  <g key={k}><line x1={x1} y1={y1} x2={x2} y2={y2} className="d" /><line x1={x1} y1={y1} x2={x2} y2={y2} className="l" /></g>
                ))}
                {[[0.035, 'actie'], [0.05, 'titel']].map(([m, k]) => <g key={k}><rect x={maat.w * m} y={maat.h * m} width={maat.w * (1 - 2 * m)} height={maat.h * (1 - 2 * m)} className="d" /><rect x={maat.w * m} y={maat.h * m} width={maat.w * (1 - 2 * m)} height={maat.h * (1 - 2 * m)} className={`l ${k}`} /></g>)}
                <g transform={`translate(${maat.w / 2} ${maat.h / 2})`}><path d="M-14 0H-4M4 0H14M0 -14V-4M0 4V14" className="d" /><path d="M-14 0H-4M4 0H14M0 -14V-4M0 4V14" className="l kruis" /></g>
              </svg>
            )}
            <div className="fm-cam-osd">{getal(f, 1)} mm · {getal((kh.h * 180) / Math.PI, 1)}°</div>
          </div>
        </div>
        <aside className="fm-cam-rechts">
          {onDeel && (
            <div className="fm-cam-deel">
              <button className="fm-knop klein" disabled={deelBezig} onClick={async () => { setDeelBezig(true); try { const u0 = await onDeel(); const u = u0 ? metBeeld(u0, { c, m: stand.m, rot: stand.rot, r: rennerLokaal }) : null; if (u) { setDeelLink(u); try { await navigator.clipboard.writeText(u); } catch {} } } finally { setDeelBezig(false); } }}>{deelBezig ? 'Link maken…' : 'Link naar dit camerabeeld'}</button>
              {deelLink && <><input readOnly value={deelLink} onFocus={(e) => e.target.select()} aria-label="Link naar het camerabeeld" /><span className="fm-sub">Gekopieerd. Wie de link opent, ziet meteen dit camerabeeld zoals jij het nu ziet (plaats, richting, zoom en renner), ook op gsm en zonder account.</span></>}
            </div>
          )}
          <label className="fm-vink"><input type="checkbox" checked={lijnen} onChange={(e) => setLijnen(e.target.checked)} />Hulplijnen (derden, midden, veilige zones)</label>
          <div className="fm-kop">Lens</div>
          <label className="fm-cam-veld"><span>Zoom</span><input type="range" min={0} max={1} step={0.001} value={vanF(Number(c.f) || 12)} onChange={(e) => zetZoom(logF(Number(e.target.value)))} /><b>{getal(Number(c.f) || 12, 1)} mm</b></label>
          <div className="fm-segment fm-cam-seg">{[[LENS.fMin, 'Groothoek'], [12, '12 mm'], [25, '25 mm'], [LENS.fMax, 'Tele']].map(([v, t]) => <button key={t} className={Math.abs((Number(c.f) || 12) - v) < 0.05 ? 'aan' : ''} onClick={() => zetZoom(v)}>{t}</button>)}</div>
          <label className="fm-vink"><input type="checkbox" checked={!!c.ext} onChange={(e) => setC((x) => ({ ...x, ext: e.target.checked }))} />Extender 2× ({getal(LENS.fMin * 2, 1)}–{LENS.fMax * 2} mm)</label>
          <div className="fm-sub">Kijkhoek {getal(graad(kh.h), 1)}° × {getal(graad(kh.v), 1)}° · brandpunt {getal(f, 1)} mm</div>
          <div className="fm-kop">Camera</div>
          <label className="fm-cam-veld"><span>Lenshoogte</span><input type="range" min={0.4} max={2.6} step={0.01} value={c.h} onChange={(e) => setC((x) => ({ ...x, h: Number(e.target.value) }))} /><b>{getal(c.h)} m</b></label>
          <div className="fm-segment fm-cam-seg"><button className={c.kantel == null ? 'aan' : ''} title="Kantelen zodat het gezicht van de renner in het midden staat" onClick={() => setC((x) => ({ ...x, kantel: null }))}>Op gezicht</button><button className={c.kantel != null ? 'aan' : ''} onClick={() => setC((x) => ({ ...x, kantel: Math.round(graad(pitch) * 10) / 10 }))}>Zelf kantelen</button></div>
          {c.kantel != null && <label className="fm-cam-veld"><span>Kantelen</span><input type="range" min={-35} max={35} step={0.1} value={c.kantel} onChange={(e) => setC((x) => ({ ...x, kantel: Number(e.target.value) }))} /><b>{getal(c.kantel, 1)}°</b></label>}
          <div className="fm-cam-veld"><span>Richting</span>
            <div className="fm-segment fm-cam-seg">{[[-5, '◀ 5°'], [-1, '◀ 1°'], [1, '1° ▶'], [5, '5° ▶']].map(([d, t]) => <button key={t} title={`Camera ${Math.abs(d)}° naar ${d < 0 ? 'links' : 'rechts'} draaien (pannen)`} onClick={() => draaiNaar(rot + d)}>{t}</button>)}</div>
          </div>
          {doel && <button className="fm-knop klein" onClick={() => draaiNaar(rotNaar([doel.p[0] - p0[0], doel.p[1] - p0[1]]))}>Recht op de renner richten</button>}
          <div className="fm-kop">Renner</div>
          <div className="fm-cam-kit">
            <label title="Kleur van de trui">Trui<input type="color" value={c.renner?.kleur || '#15171C'} onChange={(e) => setC((x) => ({ ...x, renner: { ...(x.renner || {}), kleur: e.target.value } }))} /></label>
            <label title="Accentkleur (borst en schouders)">Accent<input type="color" value={c.renner?.accent || '#15171C'} onChange={(e) => setC((x) => ({ ...x, renner: { ...(x.renner || {}), accent: e.target.value } }))} /></label>
            <label className="fm-vink"><input type="checkbox" checked={c.renner?.helm !== false} onChange={(e) => setC((x) => ({ ...x, renner: { ...(x.renner || {}), helm: e.target.checked } }))} />Helm</label>
          </div>
          <div className="fm-kop">In beeld</div>
          {doel ? (
            <div className="fm-cam-cijfers">
              <div><span>Renner</span><b>{doel.naam || 'renner'} · {<input type="number" step="0.01" min="1" max="2.3" defaultValue={doel.H} key={`${doel.id}${doel.H}`} onBlur={(e) => { const v = Number(e.target.value); if (v > 1 && v < 2.4 && v !== doel.H) zetRenner(doel.id, { lengte: v }); }} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />} m</b></div>
              <div><span>Figuur</span><b><span className="fm-segment fm-cam-seg" style={{ display: 'inline-flex' }}>{[[false, 'Man'], [true, 'Vrouw']].map(([v, t]) => <button key={t} className={!!doel.vrouw === v ? 'aan' : ''} onClick={() => zetRenner(doel.id, { vrouw: v || null })}>{t}</button>)}</span></b></div>
              <div><span>Afstand tot de renner</span><b>{getal(doel.D)} m{doel.D < LENS.mod + 0.2 ? ' · te dichtbij om scherp te stellen' : ''}</b></div>
              <div><span>Beeld op de renner</span><b>{getal(bw)} × {getal(bh)} m</b></div>
              <div><span>Kadrering</span><b>{kadrering(bh, doel.H)}</b></div>
              {achter && <div><span>Achtergrond in beeld</span><b>{getal(aw)} × {getal((aw * 9) / 16)} m op {getal(achter.t)} m</b></div>}
              <div><span>Kantelhoek</span><b>{getal(graad(pitch), 1)}°</b></div>
            </div>
          ) : <div className="fm-sub">Geen renner voor deze camera. Zet een renner (punt) in de kijkhoek, of draai de camera.</div>}
          {!schrijven && <div className="fm-sub">Draaien, verplaatsen en zoomen blijft op jouw scherm; het plan zelf verandert niet.</div>}
          <div className="fm-sub fm-cam-noot">Kadrering op ware maat met de echte kijkhoek van de lens. Niet gesimuleerd: vertekening aan de randen in groothoek, scherptediepte en licht. De renner is een figuur op lengte (standaard 1,87 m).</div>
        </aside>
      </div>
    </div>
  );
}

// Startbeeld in de link (?v=...): compact en leesbaar in de adresbalk.
export function metBeeld(url, b) {
  try {
    const u = new URL(url); const kort = { c: { h: b.c.h, f: b.c.f, ext: b.c.ext ? 1 : 0, kantel: b.c.kantel, renner: b.c.renner }, m: b.m.map((x) => Math.round(x * 1000) / 1000), rot: Math.round(b.rot * 10) / 10, r: b.r && Object.keys(b.r).length ? b.r : undefined };
    u.searchParams.set('v', btoa(unescape(encodeURIComponent(JSON.stringify(kort)))).replace(/=+$/, ''));
    return u.href;
  } catch { return url; }
}
export function leesBeeld(v) {
  if (!v) return null;
  try { const b = JSON.parse(decodeURIComponent(escape(atob(v)))); if (b?.c) b.c.ext = !!b.c.ext; return b && Array.isArray(b.m) ? b : null; } catch { return null; }
}
