'use client';
import TerugKnop from './TerugKnop';

// Trussbouwer (zelfde stijl als de wandbouwer): losse stukken H30V als bouwblokken.
// Kies een stuk (liggend of staand) of een kant-en-klaar portaal of kubus en zet het in beeld.
// Aan het uiteinde van een stuk bepaalt de muis de richting: rechtdoor, een hoek, omhoog of
// omlaag. Hoekstukken en baseplates komen er vanzelf bij. Shift/Ctrl + klik = meer kiezen.
import { useBouwerSchild, schildProps } from './bouwerschild';
import { DoekUpload } from './doekupload';
import { DoekBeeld, PLAATSINGEN, STARTEN } from './doekbeeld';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { wandPunten } from './WandStudio';
import { trussStukken, naarTrussOpslag, trussKnopen, trussTelling, portaal, kubus, opdelen, TRUSS_B, TRUSS_LENGTES, trussKader, kaderMaat, schaalTruss } from './trussbouw';
import { publiekeUrl } from './db';
import dynamic from 'next/dynamic';
import { webglKan } from './StellingStudio';
import { TentFotoBeeld } from './TentDrieGL';
import { StellingPlannen } from './stellingplannen';
const DrieGL = dynamic(() => import('./TentDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });

const rad = (g) => (g * Math.PI) / 180;
const nieuwId = () => Math.random().toString(36).slice(2, 9);
const getal = (v) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 2 });
const B2 = TRUSS_B / 2;
const kleuren = (zwart) => (zwart ? { buis: '#2B2F35', fijn: '#4B5058', blok: '#1F2328', blokZij: '#373C43' } : { buis: '#9AA1A9', fijn: '#B7BDC4', blok: '#C5CAD0', blokZij: '#A9AFB6' });
const eindVan = (s) => (s.op ? [s.a[0], s.a[1], s.a[2] + s.L] : [s.a[0] + Math.cos(s.r) * s.L, s.a[1] + Math.sin(s.r) * s.L, s.a[2]]);
const middenVan = (s) => { const e = eindVan(s); return [(s.a[0] + e[0]) / 2, (s.a[1] + e[1]) / 2, (s.a[2] + e[2]) / 2]; };
const binnen = (p, q) => { let ok = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { if ((q[i][1] > p[1]) !== (q[j][1] > p[1]) && p[0] < ((q[j][0] - q[i][0]) * (p[1] - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) ok = !ok; } return ok; };
// Vlak van een doek over één of meer liggende stukken op één lijn (bv. de bovenligger van een frame).
// Hoogte 'auto' = tot de onderligger eronder (of de vloer). van/tot = één vak (tussen twee torens).
// Randen in het vlak van een liggend stuk F (om een getekend doek op te laten kleven):
// langs de lijn (s) de binnen- en buitenkanten van torens en de uiteinden van liggers, in de hoogte (z) de liggers en de vloer.
export function vlakRanden(F, stukken) {
  const u = [Math.cos(F.r), Math.sin(F.r)]; const n = [u[1], -u[0]]; const o = [F.a[0], F.a[1]];
  const t = (p) => (p[0] - o[0]) * u[0] + (p[1] - o[1]) * u[1]; const zij = (p) => (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1];
  const sv = new Set(); const zv = new Set([-B2]);
  for (const g of stukken) {
    if (Math.abs(zij(g.a)) > 0.05) continue;
    if (g.op) { const x = t(g.a); for (const d of [-B2, 0, B2]) sv.add(Math.round((x + d) * 1000) / 1000); for (const z of [g.a[2] + g.L]) for (const d of [-B2, B2]) zv.add(Math.round((z + d) * 1000) / 1000); continue; }
    if (Math.abs(Math.sin(g.r - F.r)) > 0.01) continue;
    for (const x of [t(g.a), t(eindVan(g))]) for (const d of [-B2, 0, B2]) sv.add(Math.round((x + d) * 1000) / 1000);
    for (const d of [-B2, B2]) zv.add(Math.round((g.a[2] + d) * 1000) / 1000); // boven- en onderkant van de ligger
  }
  return { u, n, o, s: [...sv].sort((a, b) => a - b), z: [...zv].sort((a, b) => a - b) };
}

export function doekVlak(dk, stukken) {
  if (dk.s0 != null) {
    // Getekend doek: een rechthoek in het vlak van een liggend stuk.
    const F = stukken.find((x) => x.id === dk.stuk); if (!F) return null;
    const u = [Math.cos(F.r), Math.sin(F.r)]; const n = [u[1], -u[0]]; const op = dk.wijze === 'op';
    return { u, n, o: [F.a[0], F.a[1]], s0: dk.s0, s1: dk.s1, z0: dk.z0, z1: dk.z1, op, off: op ? (dk.zijde === 'achter' ? -1 : 1) * (B2 + 0.02) : 0, getekend: true, fid: F.id };
  }
  const ids = dk.stukken || (dk.stuk ? [dk.stuk] : []);
  const ps = stukken.filter((x) => ids.includes(x.id) && !x.op); if (!ps.length) return null;
  const F = ps[0]; const u = [Math.cos(F.r), Math.sin(F.r)]; const n = [u[1], -u[0]]; const o = [F.a[0], F.a[1]];
  const t = (p) => (p[0] - o[0]) * u[0] + (p[1] - o[1]) * u[1]; const zij = (p) => (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1];
  let tmin = Infinity; let tmax = -Infinity; for (const x of ps) for (const p of [x.a, eindVan(x)]) { tmin = Math.min(tmin, t(p)); tmax = Math.max(tmax, t(p)); }
  const zTop = F.a[2];
  // Onderligger: liggend stuk op dezelfde lijn, lager, dat de overspanning raakt.
  let zb = null;
  for (const g of stukken) {
    if (g.op || ids.includes(g.id) || g.a[2] > zTop - 0.3 || Math.abs(Math.sin(g.r - F.r)) > 0.01 || Math.abs(zij(g.a)) > 0.05) continue;
    const a = t(g.a); const b = t(eindVan(g)); if (Math.max(a, b) < tmin + 0.1 || Math.min(a, b) > tmax - 0.1) continue;
    zb = zb == null ? g.a[2] : Math.max(zb, g.a[2]);
  }
  // Torens op de lijn (voor de vakken).
  const torens = [...new Set(stukken.filter((g) => g.op && Math.abs(zij(g.a)) < 0.05 && g.a[2] < zTop && g.a[2] + g.L > (zb ?? 0) + 0.1).map((g) => Math.round(t(g.a) * 1000) / 1000))].filter((x) => x > tmin - 0.01 && x < tmax + 0.01).sort((a, b) => a - b);
  const op = dk.wijze === 'op'; const off = op ? (dk.zijde === 'achter' ? -1 : 1) * (B2 + 0.02) : 0;
  const van = dk.van ?? tmin; const tot = dk.tot ?? tmax;
  const s0 = op ? van - (van <= tmin + 0.01 ? B2 : 0) : van + B2; const s1 = op ? tot + (tot >= tmax - 0.01 ? B2 : 0) : tot - B2;
  const z1 = op ? zTop + B2 : zTop - B2;
  const onder = zb != null ? (op ? zb - B2 : zb + B2) : -B2; // geen onderligger: tot de vloer
  const z0 = dk.h === 'auto' || dk.h == null ? Math.max(-B2, onder) : Math.max(-B2, z1 - (Number(dk.h) || 1));
  return { u, n, o, s0, s1, z0, z1, op, off, tmin, tmax, torens, zb, onder, fid: F.id };
}

// De truss als 3D-stukken (zelfde vorm als TentDrieGL leest): vier buizen per stuk met diagonalen, hoekstukken,
// baseplates en de doeken (voor- en achterkant met hun eigen ontwerp).
export function trussPrims(stukken, doeken = [], doekMap = new Map(), zwart = false) {
  const K = kleuren(zwart); const uit = [];
  const hk = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const st0 of stukken) {
    const st = st0.op && st0.a[2] < 0.01 ? { ...st0, a: [st0.a[0], st0.a[1], -B2 + 0.012], L: st0.L + B2 - 0.012 } : st0;
    const e = eindVan(st); const d = st.op ? [0, 0, 1] : [Math.cos(st.r), Math.sin(st.r), 0];
    const n1 = st.op ? [Math.cos(st.r), Math.sin(st.r), 0] : [-Math.sin(st.r), Math.cos(st.r), 0]; const n2 = st.op ? [-Math.sin(st.r), Math.cos(st.r), 0] : [0, 0, 1];
    // Hoogtes in de bouwer zijn hartlijnen: in 3D ligt de vloer op z = -B2, dus alles B2 hoger.
    const hoekP = (p, i, j) => [p[0] + n1[0] * i * B2 + n2[0] * j * B2, p[1] + n1[1] * i * B2 + n2[1] * j * B2, p[2] + n1[2] * i * B2 + n2[2] * j * B2 + B2];
    for (const [i, j] of hk) uit.push({ k: 'lijn', a: hoekP(st.a, i, j), b: hoekP(e, i, j), kl: K.buis, r: 0.024 });
    const zones = Math.max(1, Math.round(st.L / 0.5));
    for (let z = 0; z < 4; z++) {
      const [i1, j1] = hk[z]; const [i2, j2] = hk[(z + 1) % 4];
      for (let k = 0; k < zones; k++) {
        const t0 = (k / zones) * st.L; const t1 = ((k + 1) / zones) * st.L;
        const p0 = [st.a[0] + d[0] * t0, st.a[1] + d[1] * t0, st.a[2] + d[2] * t0]; const p1 = [st.a[0] + d[0] * t1, st.a[1] + d[1] * t1, st.a[2] + d[2] * t1];
        const [A, Bp] = k % 2 ? [hoekP(p0, i1, j1), hoekP(p1, i2, j2)] : [hoekP(p0, i2, j2), hoekP(p1, i1, j1)];
        uit.push({ k: 'lijn', a: A, b: Bp, kl: K.fijn, r: 0.009 });
      }
    }
  }
  for (const kn of trussKnopen(stukken.map((x, i) => ({ ...x, i, e: eindVan(x) })))) {
    if (kn.hoek) uit.push({ k: 'doos', p: [kn.p[0], kn.p[1], kn.p[2] + B2], s: [TRUSS_B + 0.02, TRUSS_B + 0.02, TRUSS_B + 0.02], kl: K.blok });
    if (kn.voet) uit.push({ k: 'doos', p: [kn.p[0], kn.p[1], 0.006], s: [0.6, 0.6, 0.012], kl: '#6B7280' });
  }
  for (const dk of doeken) {
    const V = doekVlak(dk, stukken); if (!V) continue;
    const { u, n, o, s0, s1, z0, z1, off } = V; if (z1 - z0 < 0.05 || s1 - s0 < 0.05) continue;
    for (const [kant, f] of [['voor', 1], ['achter', -1]]) {
      const P = (sv, zv) => [o[0] + u[0] * sv + n[0] * (off + f * 0.004), o[1] + u[1] * sv + n[1] * (off + f * 0.004), zv + B2];
      const ont = dk[kant] ? doekMap.get(dk[kant]) : null; const src = ont?.eigenschappen?.beeld ? publiekeUrl(ont.eigenschappen.beeld) : null;
      // Gezien van die kant: links boven, rechts boven, links onder.
      const [l, r] = f > 0 ? [s0, s1] : [s1, s0];
      uit.push({ k: 'vlak', w: [P(l, z1), P(r, z1), P(r, z0), P(l, z0)], vul: ont ? ont.eigenschappen?.kleur || '#0F766E' : '#F3F4F6', rand: null, op: 1, data: {} });
      if (src) uit.push({ k: 'beeld', A: P(l, z1), B: P(r, z1), C: P(l, z0), href: src });
    }
  }
  return uit;
}

// Convexe omhullende (voor het klikvlak van een stuk).
function omhul(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const kr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const x of p) { while (lo.length >= 2 && kr(lo[lo.length - 2], lo[lo.length - 1], x) <= 0) lo.pop(); lo.push(x); }
  const hi = []; for (const x of [...p].reverse()) { while (hi.length >= 2 && kr(hi[hi.length - 2], hi[hi.length - 1], x) <= 0) hi.pop(); hi.push(x); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
function verplaats(groep, p) {
  const A = groep[0]; const dr = p.r - A.r; const c = Math.cos(dr); const s = Math.sin(dr); const dz = p.z - A.a[2];
  return groep.map((m) => { const d = [m.a[0] - A.a[0], m.a[1] - A.a[1]]; return { ...m, a: [p.a[0] + d[0] * c - d[1] * s, p.a[1] + d[0] * s + d[1] * c, Math.max(0, Math.round((m.a[2] + dz) * 1000) / 1000)], r: m.r + dr }; });
}
function draaiGroep(groep, graden) {
  const ms = groep.map(middenVan); const c = [ms.reduce((a, p) => a + p[0], 0) / ms.length, ms.reduce((a, p) => a + p[1], 0) / ms.length];
  const dr = rad(graden); const co = Math.cos(dr); const si = Math.sin(dr);
  return groep.map((m) => { const d = [m.a[0] - c[0], m.a[1] - c[1]]; return { ...m, a: [c[0] + d[0] * co - d[1] * si, c[1] + d[0] * si + d[1] * co, m.a[2]], r: m.r + dr }; });
}

function Zicht({ stukken, doeken = [], doekMap = new Map(), selDoek = null, zwart, hoek, kantel, sel = [], spook = null, zoom = 1, mini = false, vast, onKlik, onDraai, onSleep, onZoom, onDoekKlik, tekenDoek = false, onTeken , passTik = 0, onDoekWijzig = null, maatK = null, onKader = null }) {
  const ref = useRef(null); const [maat, setMaat] = useState({ w: 600, h: 400 }); const sleep = useRef(null);
  // Verschuiven (rechts of middelste muisknop slepen, twee vingers op de trackpad); Passend zet het terug.
  const [schuif, setSchuif] = useState([0, 0]); const schuifRef = useRef(schuif); schuifRef.current = schuif;
  const [doekVb, setDoekVb] = useState(null); // { id, r: { s0, s1, z0, z1 } } doek dat versleept wordt
  useEffect(() => { setSchuif([0, 0]); }, [passTik]);
  useEffect(() => { const e = ref.current; if (!e) return undefined; const ro = new ResizeObserver(() => setMaat({ w: e.clientWidth || 600, h: e.clientHeight || 400 })); ro.observe(e); return () => ro.disconnect(); }, []);
  // Hoofdrichting van de truss (langste liggende stuk, per 90°): kijkhoek en vloerraster volgen die richting,
  // zodat een truss die schuin op het plan staat niet scheef over de tegels loopt.
  const a0 = useMemo(() => { let best = null; for (const st of stukken) if (!st.op && (!best || st.L > best.L)) best = st; if (!best) return 0; const q = Math.PI / 2; return ((best.r % q) + q) % q; }, [stukken]);
  const t = rad(hoek) - a0; const ph = rad(kantel);
  // Hoogtes zijn hartlijnen: een stuk op z = 0 ligt met zijn onderkant op de vloer (vloer = -B2).
  const proj = ([x, y, z0]) => { const z = z0 + B2; const xr = x * Math.cos(t) - y * Math.sin(t); const yr = x * Math.sin(t) + y * Math.cos(t); return [xr, -z * Math.cos(ph) - yr * Math.sin(ph), yr * Math.cos(ph) - z * Math.sin(ph)]; };
  const kader = useMemo(() => {
    const al = []; for (const s of stukken) { al.push(proj(s.a)); al.push(proj(eindVan(s))); }
    if (!al.length) for (const q of [[-2, -2, 0], [2, 2, 0], [-2, 2, 3], [2, -2, 3]]) al.push(proj(q));
    const xs = al.map((p) => p[0]); const ys = al.map((p) => p[1]); return [Math.min(...xs) - 0.5, Math.min(...ys) - 0.5, Math.max(...xs) + 0.5, Math.max(...ys) + 0.5];
  }, [stukken, hoek, kantel]); // eslint-disable-line react-hooks/exhaustive-deps
  // Camera zoals in andere 3D-programma's: draaien gebeurt rond het punt in het midden van het beeld,
  // de schaal blijft vast tijdens het draaien (pas Passend past opnieuw in). Kleine voorbeelden passen zich altijd in.
  const interactief = !mini || !!onDraai;
  const midden3 = useMemo(() => {
    if (!stukken.length) return [0, 0, 1];
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; let z1 = 0;
    for (const st of stukken) for (const q of [st.a, eindVan(st)]) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); z1 = Math.max(z1, q[2]); }
    return [(x0 + x1) / 2, (y0 + y1) / 2, z1 / 2];
  }, [stukken]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitRef = useRef(null); const [doel, setDoel] = useState(null);
  if (!interactief || !fitRef.current || fitRef.current.tik !== passTik || (!stukken.length) !== fitRef.current.leeg) fitRef.current = { tik: passTik, k: kader, T: midden3, leeg: !stukken.length };
  useEffect(() => { setDoel(null); }, [passTik]);
  const vastRef = useRef(null); if (!vast) vastRef.current = kader;
  const k0 = interactief ? fitRef.current.k : (vast && vastRef.current) || kader;
  const pad = mini ? 8 : 70;
  const s = Math.min((maat.w - pad * 2) / Math.max(1, k0[2] - k0[0]), (maat.h - pad * 2) / Math.max(1, k0[3] - k0[1]), mini ? 300 : 200) * zoom;
  const T3 = doel || fitRef.current.T; const pT = proj(T3);
  const ox = interactief ? maat.w / 2 - pT[0] * s + schuif[0] : maat.w / 2 - ((k0[0] + k0[2]) / 2) * s; const oy = interactief ? maat.h / 2 - pT[1] * s + schuif[1] : maat.h / 2 - ((k0[1] + k0[3]) / 2) * s;
  const S = (q) => { const p = proj(q); return [p[0] * s + ox, p[1] * s + oy, p[2]]; };
  const opVlak = (sx, sy, z0 = 0) => { const z = z0 + B2; const xr = (sx - ox) / s; const Y = (sy - oy) / s; const yr = (-Y - z * Math.cos(ph)) / Math.max(0.05, Math.sin(ph)); return [xr * Math.cos(t) + yr * Math.sin(t), -xr * Math.sin(t) + yr * Math.cos(t)]; };
  // Schermpunt → (s, z) in het verticale vlak door o met richting u.
  const opWand = (sx, sy, o, u) => {
    const A = S([o[0], o[1], 0]); const Bs = S([o[0] + u[0], o[1] + u[1], 0]); const Bz = S([o[0], o[1], 1]);
    const a = Bs[0] - A[0]; const b = Bz[0] - A[0]; const c = Bs[1] - A[1]; const d = Bz[1] - A[1]; const det = a * d - b * c || 1e-9;
    const x = sx - A[0]; const y = sy - A[1]; return [(x * d - b * y) / det, (a * y - c * x) / det];
  };
  const hulp = { S, opVlak, opWand };
  const K = kleuren(zwart);
  const spookIds = new Set((spook || []).map((x) => x.id));
  const alle = [...stukken.filter((x) => !spookIds.has(x.id)), ...(spook || []).map((x) => ({ ...x, spook: true }))];
  const knopen = trussKnopen(alle.map((x, i) => ({ ...x, i, e: eindVan(x) })));
  const selSet = new Set(sel);
  const P2 = (q) => q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const lw = (f) => Math.max(0.7, s * f);

  // Eén stuk: vier buizen op de hoeken van het vierkant (29 cm) en diagonalen op elke zijde.
  const tekenStuk = (st0) => {
    // Staand stuk op de vloer: tot op de baseplate tekenen.
    const st = st0.op && st0.a[2] < 0.01 ? { ...st0, a: [st0.a[0], st0.a[1], -B2], L: st0.L + B2 } : st0;
    const e = eindVan(st); const d = st.op ? [0, 0, 1] : [Math.cos(st.r), Math.sin(st.r), 0];
    const n1 = st.op ? [Math.cos(st.r), Math.sin(st.r), 0] : [-Math.sin(st.r), Math.cos(st.r), 0]; const n2 = st.op ? [-Math.sin(st.r), Math.cos(st.r), 0] : [0, 0, 1];
    const hoekP = (p, i, j) => [p[0] + n1[0] * i * B2 + n2[0] * j * B2, p[1] + n1[1] * i * B2 + n2[1] * j * B2, p[2] + n1[2] * i * B2 + n2[2] * j * B2];
    const hk = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const zones = Math.max(1, Math.round(st.L / 0.5));
    const kl = st.spook ? '#2563EB' : K.buis; const fijn = st.spook ? '#60A5FA' : K.fijn;
    const lijnen = [];
    for (let z = 0; z < 4; z++) {
      const [i1, j1] = hk[z]; const [i2, j2] = hk[(z + 1) % 4];
      for (let k = 0; k < zones; k++) {
        const t0 = (k / zones) * st.L; const t1 = ((k + 1) / zones) * st.L;
        const p0 = [st.a[0] + d[0] * t0, st.a[1] + d[1] * t0, st.a[2] + d[2] * t0]; const p1 = [st.a[0] + d[0] * t1, st.a[1] + d[1] * t1, st.a[2] + d[2] * t1];
        const [A, Bp] = k % 2 ? [hoekP(p0, i1, j1), hoekP(p1, i2, j2)] : [hoekP(p0, i2, j2), hoekP(p1, i1, j1)];
        lijnen.push([S(A), S(Bp)]);
      }
    }
    const buizen = hk.map(([i, j]) => [S(hoekP(st.a, i, j)), S(hoekP(e, i, j))]);
    const silhouet = omhul([...hk.map(([i, j]) => S(hoekP(st.a, i, j))), ...hk.map(([i, j]) => S(hoekP(e, i, j)))].map((p) => p.slice(0, 2)));
    const aan = selSet.has(st.i);
    return (
      <g key={st.id || `s${st.i}`} opacity={st.spook ? 0.75 : 1}>
        {aan && <polygon points={P2(silhouet)} fill="#2563EB" fillOpacity={0.14} stroke="#2563EB" strokeWidth={2} pointerEvents="none" />}
        {lijnen.map(([a, b], k) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={fijn} strokeWidth={lw(0.012)} pointerEvents="none" />)}
        {buizen.map(([a, b], k) => <line key={`b${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={kl} strokeWidth={lw(0.022)} strokeLinecap="round" pointerEvents="none" />)}
        {!st.spook && <polygon points={P2(silhouet)} fill="rgba(255,255,255,0.01)" data-stuk={st.i} style={{ cursor: mini ? 'pointer' : 'grab' }} />}
      </g>
    );
  };
  // Hoekstukken en baseplates staan recht op de truss: draaiing van de stukken in die knoop (anders de hoofdrichting).
  const knoopRicht = (k) => { let r = null; for (const i of k.stukken) { const g = alle[i]; if (g && !g.op) { r = g.r; break; } } if (r == null) for (const i of k.stukken) { const g = alle[i]; if (g) { r = g.r; break; } } if (r == null) r = a0; return [Math.cos(r), Math.sin(r)]; };
  const blok = (k, idx) => {
    const p = k.p; const [c, sn] = knoopRicht(k); const pts = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) { const u = x * B2 * 1.05; const v = y * B2 * 1.05; pts.push(S([p[0] + u * c - v * sn, p[1] + u * sn + v * c, p[2] + z * B2 * 1.05])); }
    return <polygon key={`k${idx}`} points={P2(omhul(pts.map((q) => q.slice(0, 2))))} fill={K.blok} stroke={K.blokZij} strokeWidth={lw(0.01)} pointerEvents="none" />;
  };
  const voet = (k, idx) => { const p = k.p; const [c, sn] = knoopRicht(k); const q = [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]].map(([x, y]) => S([p[0] + x * c - y * sn, p[1] + x * sn + y * c, -B2])); return <polygon key={`v${idx}`} points={P2(q)} fill={K.blokZij} stroke={K.buis} strokeWidth={lw(0.008)} pointerEvents="none" />; };
  // Doek onder een liggend stuk (banner of de opening van een portaal), voor = rechts van de richting.
  const ziet = (n) => n[0] * Math.sin(t) + n[1] * Math.cos(t) < 0.0001;
  const doekLagen = doeken.map((dk) => {
    // In de truss: tussen de torens en de liggers. Op de truss: van buitenkant tot buitenkant, ervoor gehangen.
    const V0 = doekVlak(dk, stukken); if (!V0) return null;
    const V = doekVb && doekVb.id === dk.id ? { ...V0, ...doekVb.r } : V0;
    const { u, n, o, s0, s1, z0, z1, op, off } = V; if (z1 - z0 < 0.05 || s1 - s0 < 0.05) return null;
    const P = (sv) => [o[0] + u[0] * sv + n[0] * off, o[1] + u[1] * sv + n[1] * off];
    const kant = ziet(n) ? 'voor' : 'achter';
    const [l, r] = kant === 'voor' ? [P(s0), P(s1)] : [P(s1), P(s0)]; const e = P(s1);
    const q = [S([l[0], l[1], z1]), S([r[0], r[1], z1]), S([r[0], r[1], z0]), S([l[0], l[1], z0])];
    const ont = dk[kant] ? doekMap.get(dk[kant]) : null; const src = ont?.eigenschappen?.beeld ? publiekeUrl(ont.eigenschappen.beeld) : null;
    const W = Math.max(0.05, s1 - s0); const H = z1 - z0;
    const m = `matrix(${(q[1][0] - q[0][0]) / W} ${(q[1][1] - q[0][1]) / W} ${(q[3][0] - q[0][0]) / H} ${(q[3][1] - q[0][1]) / H} ${q[0][0]} ${q[0][1]})`;
    const aan = selDoek === dk.id;
    // Op de truss: het doek hangt voor of achter de hele truss, dus helemaal vooraan of achteraan tekenen.
    const zij = dk.zijde === 'achter' ? 'achter' : 'voor';
    return {
      d: op ? (kant === zij ? -1e9 : 1e9) : S([(P(s0)[0] + e[0]) / 2, (P(s0)[1] + e[1]) / 2, (z0 + z1) / 2])[2] + 0.002,
      el: () => (
        <g key={`d${dk.id}`}>
          <polygon points={P2(q)} fill={ont ? ont.eigenschappen?.kleur || '#0F766E' : 'rgba(255,255,255,0.75)'} stroke={aan ? '#2563EB' : '#9CA3AF'} strokeWidth={aan ? 2.5 : 1} strokeDasharray={ont ? undefined : '5 4'} data-doek={dk.id} data-kant={kant} style={{ cursor: 'pointer' }} />
          {src && <DoekBeeld src={src} W={W} H={H} wijze={dk.plaatsing} start={dk.start || 'rechts'} verhouding={ont?.eigenschappen?.verhouding} transform={m} />}
          {aan && <polygon points={P2(q)} fill="#2563EB" fillOpacity={0.1} pointerEvents="none" />}
          {/* Grepen: hoeken en zijden slepen = groter of kleiner, het doek zelf slepen = verplaatsen. */}
          {aan && onDoekWijzig && [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]].map(([a, b]) => {
            const sv = [s0, (s0 + s1) / 2, s1][a]; const zv = [z0, (z0 + z1) / 2, z1][b]; const pp = P(sv); const sc = S([pp[0], pp[1], zv]);
            return <rect key={`g${a}${b}`} x={sc[0] - 5} y={sc[1] - 5} width={10} height={10} fill="#fff" stroke="#2563EB" strokeWidth={1.6} data-doekgreep={`${a - 1},${b - 1}`} data-doekid={dk.id} style={{ cursor: a === 1 ? 'ns-resize' : b === 1 ? 'ew-resize' : 'nwse-resize' }} />;
          })}
        </g>
      ),
    };
  }).filter(Boolean);
  const diepte = (st) => S(middenVan(st))[2];
  const ca = Math.cos(a0); const sa = Math.sin(a0);
  const naarRaster = (q) => [q[0] * ca + q[1] * sa, -q[0] * sa + q[1] * ca]; const uitRaster = ([u, v, z]) => [u * ca - v * sa, u * sa + v * ca, z];
  const vl = (() => { const xs = []; const ys = []; for (const st of alle) for (const q0 of [st.a, eindVan(st)]) { const q = naarRaster(q0); xs.push(q[0]); ys.push(q[1]); } if (!xs.length) { xs.push(-3, 3); ys.push(-3, 3); } return [Math.floor(Math.min(...xs)) - 4, Math.floor(Math.min(...ys)) - 4, Math.ceil(Math.max(...xs)) + 4, Math.ceil(Math.max(...ys)) + 4]; })();
  const raster = []; if (!mini) { for (let x = vl[0]; x <= vl[2]; x++) raster.push([uitRaster([x, vl[1], -B2]), uitRaster([x, vl[3], -B2])]); for (let y = vl[1]; y <= vl[3]; y++) raster.push([uitRaster([vl[0], y, -B2]), uitRaster([vl[2], y, -B2])]); }

  const lok = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // Doek slepen of van maat veranderen in zijn eigen vlak; kleeft aan de randen van de truss (binnen 10 px).
  const doekSleep = (D, muis) => {
    const { V, g, start: st0 } = D; const [sv, zv] = hulp.opWand(muis[0], muis[1], V.o, V.u);
    const F = stukken.find((x) => x.id === V.fid); const R = F ? vlakRanden(F, stukken) : { s: [], z: [] };
    const px = (a, b) => S([V.o[0] + V.u[0] * a, V.o[1] + V.u[1] * a, b]);
    const kleefS = (a, b) => { let best = null; const p0 = px(a, b); for (const x of R.s) { const q = px(x, b); const d = Math.hypot(q[0] - p0[0], q[1] - p0[1]); if (d < 10 && (!best || d < best.d)) best = { x, d }; } return best ? best.x : Math.round(a * 20) / 20; };
    const kleefZ = (a, b) => { let best = null; const p0 = px(a, b); for (const x of R.z) { const q = px(a, x); const d = Math.hypot(q[0] - p0[0], q[1] - p0[1]); if (d < 10 && (!best || d < best.d)) best = { x, d }; } return best ? best.x : Math.round(b * 20) / 20; };
    let { s0, s1, z0, z1 } = V;
    if (!g) {
      // Verplaatsen: maat blijft, de linker- of onderkant kleeft.
      const ds = sv - st0[0]; const dz = zv - st0[1]; const W = s1 - s0; const H = z1 - z0;
      const ns0 = kleefS(s0 + ds, z0 + dz); const nz0 = kleefZ(s0 + ds, z0 + dz); s0 = ns0; s1 = ns0 + W; z0 = nz0; z1 = nz0 + H;
    } else {
      if (g[0] < 0) s0 = Math.min(kleefS(sv, zv), s1 - 0.1); if (g[0] > 0) s1 = Math.max(kleefS(sv, zv), s0 + 0.1);
      if (g[1] < 0) z0 = Math.min(kleefZ(sv, zv), z1 - 0.1); if (g[1] > 0) z1 = Math.max(kleefZ(sv, zv), z0 + 0.1);
    }
    z0 = Math.max(-B2, z0);
    return { s0: Math.round(s0 * 1000) / 1000, s1: Math.round(s1 * 1000) / 1000, z0: Math.round(z0 * 1000) / 1000, z1: Math.round(z1 * 1000) / 1000 };
  };
  const start = (e) => { if ((e.button === 1 || e.button === 2) && !mini) { e.preventDefault(); sleep.current = { pan: true, x: e.clientX, y: e.clientY, s0: schuifRef.current }; e.currentTarget.setPointerCapture?.(e.pointerId); return; } if (e.button !== 0) return; if (interactief && (schuif[0] || schuif[1])) { { // punt op de kijklijn door het midden, op dezelfde diepte als het oude draaipunt
      const X = (maat.w / 2 - ox) / s; const Y = (maat.h / 2 - oy) / s; let D = pT[2]; { let bd = Infinity; for (const q of stukken.map((st) => S(middenVan(st)))) { const dd = Math.hypot(q[0] - maat.w / 2, q[1] - maat.h / 2); if (dd < bd) { bd = dd; D = q[2]; } } } /* diepte van wat het dichtst bij het midden staat */ const xr = X; const yr = -Y * Math.sin(ph) + D * Math.cos(ph); const zz = -Y * Math.cos(ph) - D * Math.sin(ph);
      setDoel([xr * Math.cos(t) + yr * Math.sin(t), -xr * Math.sin(t) + yr * Math.cos(t), zz - B2]); setSchuif([0, 0]); } } if (onKader && maatK && e.target?.dataset?.maatgreep) { const as = e.target.dataset.maatgreep; sleep.current = { maat: { as, x0: lok(e), E0: kaderMaat(maatK.K, as) } }; e.currentTarget.setPointerCapture?.(e.pointerId); return; } if (tekenDoek && onTeken) { const ok = onTeken('neer', lok(e), hulp, e.target?.dataset || {}); if (ok) { sleep.current = { teken: true }; e.currentTarget.setPointerCapture?.(e.pointerId); return; } } if (onDoekWijzig && (e.target?.dataset?.doekgreep || (e.target?.dataset?.doek && e.target.dataset.doek === selDoek))) {
      const id = e.target.dataset.doekid || e.target.dataset.doek; const dk = doeken.find((x) => x.id === id); const V = dk && doekVlak(dk, stukken);
      if (V) { const g = e.target.dataset.doekgreep ? e.target.dataset.doekgreep.split(',').map(Number) : null; sleep.current = { doek: { id, V, g, start: hulp.opWand(...lok(e), V.o, V.u) } }; e.currentTarget.setPointerCapture?.(e.pointerId); return; }
    }
    if (e.target?.dataset?.doek && onDoekKlik) { onDoekKlik(e.target.dataset.doek, e.target.dataset.kant); return; } const i = e.target?.dataset?.stuk; sleep.current = { x: e.clientX, y: e.clientY, h: hoek, k: kantel, weg: false, stuk: i != null ? Number(i) : null, meer: e.shiftKey || e.ctrlKey || e.metaKey }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const beweeg = (e) => {
    const g = sleep.current; if (g?.pan) { setSchuif([g.s0[0] + e.clientX - g.x, g.s0[1] + e.clientY - g.y]); return; }
    if (g?.maat) { onKader?.(g.maat.as, maatUitSleep(g.maat, lok(e)), false); return; }
    if (g?.doek) { const r2 = doekSleep(g.doek, lok(e)); if (r2) setDoekVb({ id: g.doek.id, r: r2 }); return; } if (g?.teken) { onTeken?.('trek', lok(e), hulp); return; } if (!g) { onSleep?.('zweef', null, lok(e), hulp); return; }
    const dx = e.clientX - g.x; const dy = e.clientY - g.y; if (Math.abs(dx) + Math.abs(dy) > 4) g.weg = true; if (!g.weg) return;
    if (g.stuk != null && onSleep) { onSleep('sleep', g.stuk, lok(e), hulp); return; }
    onDraai?.(g.h - dx * 0.4, Math.max(5, Math.min(80, g.k + dy * 0.25)));
  };
  const los = (e) => { const g = sleep.current; sleep.current = null; if (g?.maat) { onKader?.(g.maat.as, maatUitSleep(g.maat, lok(e)), true); return; } if (g?.doek) { const r2 = doekSleep(g.doek, lok(e)); setDoekVb(null); if (r2) onDoekWijzig?.(g.doek.id, { ...r2, stuk: g.doek.V.fid }); return; } if (!g || g.pan) return; if (g.teken) { onTeken?.('los', lok(e), hulp); return; } if (g.weg && g.stuk != null && onSleep) { onSleep('los', g.stuk, lok(e), hulp); return; } if (!g.weg) onKlik?.(g.stuk, lok(e), hulp, g.meer); };

  // Maatkader: de hele constructie (of de selectie) in een kader met grepen voor lengte, breedte en hoogte.
  const KP = maatK ? (sv, wv, zv) => [maatK.K.u[0] * sv + maatK.K.v[0] * wv, maatK.K.u[1] * sv + maatK.K.v[1] * wv, zv] : null;
  const grepen = maatK ? (() => { const K = maatK.K; const sm = (K.s0 + K.s1) / 2; const wm = (K.w0 + K.w1) / 2; const zm = (K.z0 + K.z1) / 2;
    return [['s', KP(K.s1, wm, zm), [K.u[0], K.u[1], 0]], ['w', KP(sm, K.w1, zm), [K.v[0], K.v[1], 0]], ['z', KP(sm, wm, K.z1), [0, 0, 1]]].filter(([as]) => kaderMaat(K, as) > 0.1 || as !== 'w'); })() : [];
  function maatUitSleep(M, muis) {
    const gp = grepen.find((x) => x[0] === M.as); if (!gp) return M.E0; const [, P0, d] = gp;
    const a = S(P0); const b = S([P0[0] + d[0], P0[1] + d[1], P0[2] + d[2]]); const vx = b[0] - a[0]; const vy = b[1] - a[1]; const l2 = vx * vx + vy * vy || 1;
    const dm = ((muis[0] - M.x0[0]) * vx + (muis[1] - M.x0[1]) * vy) / l2;
    return Math.max(0.5, Math.round((M.E0 + dm) / 0.5) * 0.5);
  }
  const kaderEl = maatK && !mini ? (() => {
    const K = maatK.K; const vb = maatK.vb; const E = (as) => (vb?.as === as ? vb.waarde : kaderMaat(K, as));
    const s1 = K.s0 + E('s'); const w1 = K.w0 + E('w'); const z1 = K.z0 + E('z');
    const hk = []; for (const sv of [K.s0, s1]) for (const wv of [K.w0, w1]) for (const zv of [K.z0, z1]) hk.push(KP(sv, wv, zv));
    const ribben = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    return (
      <g>
        {ribben.map(([a, b], k) => { const p = S(hk[a]); const q = S(hk[b]); return <line key={`kr${k}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#2563EB" strokeWidth={1.2} strokeDasharray="5 4" pointerEvents="none" />; })}
        {grepen.map(([as, P0]) => {
          const K2 = { s: [s1, (K.w0 + w1) / 2, (K.z0 + z1) / 2], w: [(K.s0 + s1) / 2, w1, (K.z0 + z1) / 2], z: [(K.s0 + s1) / 2, (K.w0 + w1) / 2, z1] }[as]; void P0;
          const q = S(KP(...K2)); const naam = { s: 'lengte', w: 'breedte', z: 'hoogte' }[as];
          return (
            <g key={`kg${as}`}>
              <circle cx={q[0]} cy={q[1]} r={9} fill="#2563EB" stroke="#fff" strokeWidth={2} data-maatgreep={as} style={{ cursor: 'grab' }}><title>{`Sleep om de ${naam} te wijzigen`}</title></circle>
              <text x={q[0] + 13} y={q[1] + 4} fontSize={12} fontWeight={700} fill="#1E3A8A" stroke="#fff" strokeWidth={3} paintOrder="stroke" pointerEvents="none">{`${String(E(as)).replace('.', ',')} m`}</text>
            </g>
          );
        })}
      </g>
    );
  })() : null;
  // Teken van ver naar dichtbij: stukken en hoekstukken samen.
  const lagen = [...alle.map((st, i) => ({ d: diepte(st), el: () => tekenStuk({ ...st, i: st.spook ? -1 : (st.i ?? i) }) })), ...knopen.filter((k) => k.hoek).map((k, i) => ({ d: S(k.p)[2] - 0.001, el: () => blok(k, i) })), ...doekLagen].sort((a, b) => b.d - a.d);
  // Muiswiel = zoomen rond de muis; trackpad met twee vingers = verschuiven, knijpen (Ctrl) = zoomen.
  const wiel = (e) => {
    const r0 = ref.current?.getBoundingClientRect(); if (!r0) return;
    const muisWiel = !e.ctrlKey && e.deltaMode === 1 || (!e.ctrlKey && e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
    if (!e.ctrlKey && !muisWiel) { setSchuif((q) => [q[0] - e.deltaX, q[1] - e.deltaY]); return; }
    const k = e.ctrlKey ? Math.exp(-e.deltaY * 0.01) : e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const px = e.clientX - r0.left - maat.w / 2; const py = e.clientY - r0.top - maat.h / 2;
    setSchuif((q) => [px - (px - q[0]) * k, py - (py - q[1]) * k]); onZoom(k);
  };
  return (
    <div ref={ref} className={`fm-wz${mini ? ' mini' : ''}${spook || tekenDoek ? ' plaats' : ''}`} onPointerDown={mini && !onDraai ? undefined : start} onPointerMove={mini && !onDraai ? undefined : beweeg} onPointerUp={mini && !onDraai ? undefined : los} onWheel={onZoom ? wiel : undefined} onContextMenu={(e) => e.preventDefault()}>
      <svg width={maat.w} height={maat.h}>
        {!mini && <path d={`M${[[vl[0], vl[1], -B2], [vl[2], vl[1], -B2], [vl[2], vl[3], -B2], [vl[0], vl[3], -B2]].map((q) => S(uitRaster(q)).slice(0, 2).join(',')).join('L')}Z`} fill="#C9CDD2" />}
        {raster.map(([a, b], k) => { const p = S(a); const q = S(b); return <line key={`g${k}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#E2E5E9" />; })}
        {knopen.filter((k) => k.voet).map(voet)}
        {alle.filter((st) => !st.op && st.a[2] < 0.01).map((st, k) => { const a = S([st.a[0], st.a[1], -B2]); const e2 = eindVan(st); const b = S([e2[0], e2[1], -B2]); return <line key={`sh${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1f2937" strokeOpacity={0.12} strokeWidth={Math.max(2, s * 0.25)} />; })}
        {lagen.map((l, k) => <g key={k}>{l.el()}</g>)}
        {kaderEl}
        {!mini && !stukken.length && !spook && <text x={maat.w / 2} y={maat.h / 2} textAnchor="middle" fill="#6B7280" fontSize={14}>Kies een stuk, portaal of kubus en zet het hier neer</text>}
      </svg>
    </div>
  );
}

export function TrussZicht({ it, el, doeken = [], groot = false }) {
  const pts = wandPunten(it); const st = trussStukken(pts, it);
  // Groot (bekijken over het hele scherm): slepen = draaien, rechts slepen = verschuiven, scrollen = zoomen.
  const [stand, setStand] = useState(null); const [zoom, setZoom] = useState(1);
  // Met WebGL: dezelfde echte 3D als de tent- en stellingbouwer (klein = een foto ervan).
  const [gl, setGl] = useState(false); useEffect(() => { setGl(webglKan()); }, []);
  const dm = useMemo(() => new Map(doeken.map((d) => [d.id, d])), [doeken]);
  const prims = useMemo(() => (gl ? trussPrims(st, it.velden?.truss?.doeken || [], dm, /zwart/i.test(el?.naam || '')) : null), [gl, it, el, dm]); // eslint-disable-line react-hooks/exhaustive-deps
  if (prims && st.length) {
    if (groot) return <DrieGL prims={prims} />;
    return <TentFotoBeeld prims={prims} sleutel={JSON.stringify([it.velden?.truss, el?.id])} terugval={<Zicht stukken={st} doeken={it.velden?.truss?.doeken || []} doekMap={dm} zwart={/zwart/i.test(el?.naam || '')} hoek={35} kantel={22} mini />} />;
  }
  return <Zicht stukken={st} doeken={it.velden?.truss?.doeken || []} doekMap={new Map(doeken.map((d) => [d.id, d]))} zwart={/zwart/i.test(el?.naam || '')} hoek={stand ? stand[0] : 35} kantel={stand ? stand[1] : 24} mini={!groot} vast={groot && !!stand} zoom={groot ? zoom : 1}
    onDraai={groot ? (a, b) => setStand([a, b]) : undefined} onZoom={groot ? (k) => setZoom((z) => Math.max(0.2, Math.min(8, z * k))) : undefined} />;
}

export default function TrussStudio({ it, el, schrijven, onZet, onSluit, doeken: ontwerpen = [] }) {
  const [selDoek, setSelDoek] = useState(null); const [doekKant, setDoekKant] = useState('voor');
  const [tekenD, setTekenD] = useState(false); const [trek, setTrek] = useState(null); // doek tekenen: { F, a: [s, z], b: [s, z] }
  const [hoek, setHoek] = useState(35); const [kantel, setKantel] = useState(22); const [zoom, setZoom] = useState(1); const [passTik, setPassTik] = useState(0);
  const [sel, setSel] = useState([]); const [plaats, setPlaats] = useState(null); const [spook, setSpook] = useState(null); const [tip, setTip] = useState('');
  const [staand, setStaand] = useState(false); const [maatP, setMaatP] = useState({ W: 4, H: 3 });
  // Bouwen = het tekenvlak; 3D-beeld = dezelfde echte 3D als de andere bouwers (enkel bekijken).
  const [beeld, setBeeld] = useState(false); const [gl, setGl] = useState(false); useEffect(() => { setGl(webglKan()); }, []);
  const [pdfBezig, setPdfBezig] = useState(false);
  const zwart = /zwart/i.test(el?.naam || '');
  const lengtes = el?.eigenschappen?.kabel_lengtes?.length ? el.eigenschappen.kabel_lengtes.map(Number).sort((a, b) => b - a) : TRUSS_LENGTES;
  const t0 = it.velden?.truss || {};
  const pts0 = wandPunten(it); const pts = pts0.length >= 2 ? pts0 : [[0, 0], [1, 0]];
  const stukken = trussStukken(pts, it);
  const basisR = pts.length >= 2 ? Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) : 0;
  const gekozen = stukken.filter((x) => sel.includes(x.i));
  const terugL = useRef([]); const vooruitL = useRef([]); const [, setTik] = useState(0);
  // Elke wijziging bewaart ook de ankerlijn: die ligt altijd onder de truss, zodat je hem op de kaart en binnen kunt vastnemen en verslepen.
  const zetT = (nt, np = pts) => { terugL.current = [...terugL.current.slice(-60), { t: t0, pts }]; vooruitL.current = []; setTik((x) => x + 1); onZet(nt, np); };
  const terug = () => { const v = terugL.current.pop(); if (!v) return; vooruitL.current.push({ t: t0, pts }); setTik((x) => x + 1); setSel([]); onZet(v.t, v.pts); };
  const opnieuw = () => { const v = vooruitL.current.pop(); if (!v) return; terugL.current.push({ t: t0, pts }); setTik((x) => x + 1); setSel([]); onZet(v.t, v.pts); };
  const doekLijst = t0.doeken || [];
  const doekMapT = useMemo(() => new Map(ontwerpen.map((d) => [d.id, d])), [ontwerpen]);
  const drieP = useMemo(() => (gl && beeld ? trussPrims(stukken, doekLijst, doekMapT, zwart) : null), [gl, beeld, it, doekMapT, zwart]); // eslint-disable-line react-hooks/exhaustive-deps
  const maakPdf = async () => {
    if (pdfBezig) return; setPdfBezig(true);
    try {
      const [{ bouwerPdf }, { tentGroep }] = await Promise.all([import('./bouwerPdf'), import('./TentDrieGL')]);
      const prims = trussPrims(stukken, doekLijst, doekMapT, zwart); const tel = trussTelling(stukken);
      const hoog = Math.max(0, ...stukken.map((x) => (x.op ? x.a[2] + x.L : x.a[2]) + B2)); const lig = stukken.filter((x) => !x.op).map((x) => x.a[2] + TRUSS_B);
      await bouwerPdf({ soort: 'truss', titel: String(it.velden?.naam || it.naam || el?.naam || 'Truss'), sub: [el?.naam, el?.leverancier].filter(Boolean).join(' · '), maakGroep: (T) => tentGroep(T, prims),
        hoogtes: [...new Set(lig.map((z) => Math.round(z * 100) / 100))],
        kenmerken: [['Stukken', stukken.length], ['Truss', `${getal(stukken.reduce((a, x) => a + x.L, 0))} m`], ['Hoogte', `${getal(hoog)} m`], ['Hoekstukken', tel.hoek], ['Baseplates', tel.voet], ['Doeken', doekLijst.length], ...(el?.leverancier ? [['Leverancier', el.leverancier]] : [])] });
    } catch (e) { window.alert(`De PDF lukte niet: ${e?.message || e}`); } finally { setPdfBezig(false); }
  };
  const ankerVoor = (lijst) => {
    if (!lijst.length) return pts;
    const u = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]; const Lu = Math.hypot(u[0], u[1]) || 1; u[0] /= Lu; u[1] /= Lu; const n = [-u[1], u[0]];
    const o = pts[0]; let s0 = Infinity; let s1 = -Infinity;
    for (const x of lijst) for (const q of [x.a, eindVan(x)]) { const sv = (q[0] - o[0]) * u[0] + (q[1] - o[1]) * u[1]; s0 = Math.min(s0, sv); s1 = Math.max(s1, sv); }
    const f = lijst.find((x) => !x.op) || lijst[0]; const w = (f.a[0] - o[0]) * n[0] + (f.a[1] - o[1]) * n[1];
    if (s1 - s0 < 0.5) s1 = s0 + 0.5;
    const P = (sv) => [Math.round((o[0] + u[0] * sv + n[0] * w) * 1000) / 1000, Math.round((o[1] + u[1] * sv + n[1] * w) * 1000) / 1000];
    return [P(s0), P(s1)];
  };
  // erbij: { oudId: [nieuwe ids] } — een opgedeeld stuk: doeken erop blijven over alle delen hangen.
  const bewaar = (lijst, erbij = {}, dl = doekLijst) => { const ids = new Set(lijst.map((x) => x.id)); const np = ankerVoor(lijst); zetT({ ...t0, stukken: naarTrussOpslag(np, lijst), doeken: dl.map((d) => { const l0 = d.stukken || [d.stuk]; const l1 = [...new Set(l0.flatMap((x) => [x, ...(erbij[x] || [])]))]; return { ...d, stukken: l1.filter((x) => ids.has(x)) }; }).filter((d) => d.stukken.length) }, np); };
  // Een stuk opdelen op afstand t van het begin (bv. 3 m → 1 m + 2 m) in te huren lengtes, zodat er daar iets op kan aansluiten.
  const deelOp = (lijst, F, t) => {
    const delen = [...opdelen(t), ...opdelen(F.L - t)]; const d = F.op ? [0, 0, 1] : [Math.cos(F.r), Math.sin(F.r), 0];
    let o = 0; const nieuw = delen.map((L, k) => { const a = [F.a[0] + d[0] * o, F.a[1] + d[1] * o, F.a[2] + d[2] * o]; o += L; return { ...F, id: k ? nieuwId() : F.id, L, a }; });
    return { lijst: lijst.flatMap((x) => (x.id === F.id ? nieuw : [x])), erbij: { [F.id]: nieuw.slice(1).map((x) => x.id) } };
  };
  const metOpdeling = (lijst, p) => (p?.deel ? deelOp(lijst, lijst.find((x) => x.id === p.deel.id) || p.deel, p.deel.t) : { lijst, erbij: {} });
  const zetDoeken = (l) => zetT({ ...t0, doeken: l });
  // Maat van de hele constructie (of de selectie): lengte, breedte, hoogte per 0,5 m; stukken worden herrekend.
  const hoofdU = [Math.cos(basisR), Math.sin(basisR)];
  const maatKader = stukken.length ? trussKader(gekozen.length ? gekozen : stukken, hoofdU) : null;
  const [maatVb, setMaatVb] = useState(null);
  const pasMaat = (as, nieuw) => {
    const res = schaalTruss(stukken, gekozen.length ? gekozen.map((x) => x.id) : null, hoofdU, as, nieuw, lengtes); if (!res) return;
    const nieuwOp = new Map(res.stukken.map((x) => [x.id, x]));
    // Getekende doeken schalen mee met hun vlak.
    const dl = doekLijst.map((d) => {
      if (d.s0 == null) return d; const F = stukken.find((x) => x.id === d.stuk); if (!F) return d;
      const nF = nieuwOp.get(d.stuk) || nieuwOp.get((res.erbij[d.stuk] || [])[0]); if (!nF) return d;
      const uF = [Math.cos(F.r), Math.sin(F.r)]; const P = (sv, zv) => res.zet([F.a[0] + uF[0] * sv, F.a[1] + uF[1] * sv, zv]);
      const a = P(d.s0, d.z0); const b = P(d.s1, d.z1); const uN = [Math.cos(nF.r), Math.sin(nF.r)]; const sv = (q) => (q[0] - nF.a[0]) * uN[0] + (q[1] - nF.a[1]) * uN[1];
      const r3 = (v) => Math.round(v * 1000) / 1000;
      return { ...d, stuk: nF.id, s0: r3(Math.min(sv(a), sv(b))), s1: r3(Math.max(sv(a), sv(b))), z0: r3(Math.min(a[2], b[2])), z1: r3(Math.max(a[2], b[2])) };
    });
    setSel((l) => l.flatMap((id) => (nieuwOp.has(id) ? [id, ...(res.erbij[id] || [])] : res.erbij[id] || [])).filter((id, k, l2) => l2.indexOf(id) === k));
    bewaar(res.stukken, res.erbij, dl);
  };
  const dk = selDoek ? doekLijst.find((d) => d.id === selDoek) : null;
  const doekMap = new Map(ontwerpen.map((d) => [d.id, d]));
  // Doek tekenen: druk op een stuk van het frame en sleep een rechthoek; kleeft aan de randen van de truss.
  const vlakVoor = (data) => {
    if (data.doek) { const d0 = doekLijst.find((d) => d.id === data.doek); const st = d0 && stukken.find((x) => x.id === (d0.stuk || d0.stukken?.[0])); if (st) return st; }
    const st = data.stuk != null ? stukken[Number(data.stuk)] : null; if (!st) return null;
    if (!st.op) return st;
    // Toren: het liggende stuk dat erop aansluit.
    const ok = (p) => Math.hypot(p[0] - st.a[0], p[1] - st.a[1]) < 0.05;
    return stukken.find((x) => !x.op && (ok(x.a) || ok(eindVan(x)))) || null;
  };
  const vang = (F, sz, hulp) => {
    const R = vlakRanden(F, stukken); const px = (sv, zv) => hulp.S([R.o[0] + R.u[0] * sv, R.o[1] + R.u[1] * sv, zv]);
    const mp = px(sz[0], sz[1]); let [sv, zv] = sz;
    let bs = null; for (const x of R.s) { const d = Math.abs(px(x, zv)[0] - mp[0]) + Math.abs(px(x, zv)[1] - mp[1]); if (d < 12 && (!bs || d < bs.d)) bs = { x, d }; }
    let bz = null; for (const x of R.z) { const d = Math.abs(px(sv, x)[0] - mp[0]) + Math.abs(px(sv, x)[1] - mp[1]); if (d < 12 && (!bz || d < bz.d)) bz = { x, d }; }
    return [bs ? bs.x : Math.round(sv * 20) / 20, bz ? bz.x : Math.round(zv * 20) / 20];
  };
  const onTeken = (fase, muis, hulp, data) => {
    if (fase === 'neer') {
      let F = vlakVoor(data || {});
      if (!F) {
        // Naast de buizen gedrukt (bv. midden in een vak): het frame-vlak waar de muis binnen valt.
        let best = null;
        for (const x of stukken) {
          if (x.op) continue; const R = vlakRanden(x, stukken); const [sv, zv] = hulp.opWand(muis[0], muis[1], R.o, R.u);
          if (sv < R.s[0] - 0.05 || sv > R.s[R.s.length - 1] + 0.05 || zv < R.z[0] - 0.05 || zv > R.z[R.z.length - 1] + 0.05) continue;
          const c = hulp.S(middenVan(x)); const d = c[2];
          if (!best || d < best.d) best = { x, d };
        }
        F = best?.x || null;
      }
      if (!F) return false;
      const u = [Math.cos(F.r), Math.sin(F.r)]; const sz = vang(F, hulp.opWand(muis[0], muis[1], [F.a[0], F.a[1]], u), hulp);
      setTrek({ F, a: sz, b: sz }); return true;
    }
    if (!trek) return false;
    const u = [Math.cos(trek.F.r), Math.sin(trek.F.r)]; const sz = vang(trek.F, hulp.opWand(muis[0], muis[1], [trek.F.a[0], trek.F.a[1]], u), hulp);
    if (fase === 'trek') { setTrek((t) => ({ ...t, b: sz })); return true; }
    const s0 = Math.min(trek.a[0], sz[0]); const s1 = Math.max(trek.a[0], sz[0]); const z0 = Math.min(trek.a[1], sz[1]); const z1 = Math.max(trek.a[1], sz[1]);
    setTrek(null);
    if (s1 - s0 < 0.1 || z1 - z0 < 0.1) return true;
    const d = { id: nieuwId(), stuk: trek.F.id, s0, s1, z0, z1, wijze: 'in', voor: null, achter: null };
    zetDoeken([...doekLijst, d]); setSelDoek(d.id); setTekenD(false); setSel([]);
    return true;
  };
  const voorlopigDoek = trek ? { id: '__trek', stuk: trek.F.id, s0: Math.min(trek.a[0], trek.b[0]), s1: Math.max(trek.a[0], trek.b[0]), z0: Math.min(trek.a[1], trek.b[1]), z1: Math.max(trek.a[1], trek.b[1]), wijze: 'in' } : null;
  const telling = trussTelling(stukken.map((x) => ({ ...x, e: eindVan(x) })));

  // Plek voor het anker (lengte L, staand of liggend) onder de muis.
  const zoekPlek = (L, op, rVrij, muis, hulp, zonder) => {
    const ander = stukken.filter((x) => !zonder.has(x.id));
    const bezet = (c) => ander.some((x) => Math.hypot(x.a[0] - c.a[0], x.a[1] - c.a[1], x.a[2] - c.z) < 0.03 && x.op === c.op && (c.op || Math.cos(x.r - c.r) > 0.99));
    let beste = null;
    for (const F of ander) {
      for (const [E, isEind] of [[eindVan(F), true], [F.a, false]]) {
        const opties = [];
        // Richtingen vanuit dit knooppunt: liggend in vier richtingen, omhoog en omlaag.
        for (let k = 0; k < 4; k++) { const r = F.r + (k * Math.PI) / 2; opties.push({ a: [E[0], E[1], E[2]], z: E[2], r, op: false, soort: 'liggend' }); }
        opties.push({ a: [E[0], E[1], E[2]], z: E[2], r: F.r, op: true, soort: 'omhoog' });
        if (E[2] - L > -0.001) opties.push({ a: [E[0], E[1], E[2] - L], z: E[2] - L, r: F.r, op: true, soort: 'omlaag' });
        for (const c of opties) {
          if (bezet(c)) continue;
          c.knoop = E;
          // niet terug in het stuk zelf
          const dir = c.op ? [0, 0, c.soort === 'omlaag' ? -1 : 1] : [Math.cos(c.r), Math.sin(c.r), 0];
          const Fd = F.op ? [0, 0, 1] : [Math.cos(F.r), Math.sin(F.r), 0]; const terugIn = isEind ? -1 : 1;
          if (Math.abs(dir[0] * Fd[0] + dir[1] * Fd[1] + dir[2] * Fd[2] - terugIn) < 0.01) continue;
          if (!c.op && !isEind && Math.abs(Math.cos(c.r - F.r) + 1) < 0.01) { /* verlengen naar achter: begin vóór het stuk */ }
          const e = c.op ? [c.a[0], c.a[1], c.a[2] + L] : [c.a[0] + Math.cos(c.r) * L, c.a[1] + Math.sin(c.r) * L, c.a[2]];
          const m = [(c.a[0] + e[0]) / 2, (c.a[1] + e[1]) / 2, (c.a[2] + e[2]) / 2];
          const p = hulp.S(m); const dd = Math.hypot(p[0] - muis[0], p[1] - muis[1]);
          const lp = Math.hypot(hulp.S(c.a)[0] - hulp.S(e)[0], hulp.S(c.a)[1] - hulp.S(e)[1]);
          if (dd < Math.max(60, lp * 0.6) && (!beste || dd < beste.dd)) beste = { ...c, dd };
        }
      }
    }
    // Halverwege een stuk (per 0,5 m): een dwarsstuk, omhoog of omlaag; het stuk wordt daar opgedeeld.
    for (const F of ander) {
      const d = F.op ? [0, 0, 1] : [Math.cos(F.r), Math.sin(F.r), 0];
      for (let t = 0.5; t < F.L - 0.25; t += 0.5) {
        const E = [F.a[0] + d[0] * t, F.a[1] + d[1] * t, F.a[2] + d[2] * t];
        const opties = [];
        if (F.op) { for (let k = 0; k < 4; k++) opties.push({ a: E, z: E[2], r: F.r + (k * Math.PI) / 2, op: false }); }
        else {
          for (const k of [1, 3]) opties.push({ a: E, z: E[2], r: F.r + (k * Math.PI) / 2, op: false });
          opties.push({ a: E, z: E[2], r: F.r, op: true, soort: 'omhoog' });
          if (E[2] - L > -0.001) opties.push({ a: [E[0], E[1], E[2] - L], z: E[2] - L, r: F.r, op: true, soort: 'omlaag' });
        }
        for (const c of opties) {
          if (bezet(c)) continue;
          const e = c.op ? [c.a[0], c.a[1], c.a[2] + L] : [c.a[0] + Math.cos(c.r) * L, c.a[1] + Math.sin(c.r) * L, c.a[2]];
          const m = [(c.a[0] + e[0]) / 2, (c.a[1] + e[1]) / 2, (c.a[2] + e[2]) / 2];
          const p = hulp.S(m); const dd = Math.hypot(p[0] - muis[0], p[1] - muis[1]);
          const lp = Math.hypot(hulp.S(c.a)[0] - hulp.S(e)[0], hulp.S(c.a)[1] - hulp.S(e)[1]);
          // Iets minder voorrang dan een uiteinde, zodat gewoon verder bouwen gewoon blijft werken.
          const dd2 = dd + 6;
          if (dd < Math.max(60, lp * 0.6) && (!beste || dd2 < beste.dd)) {
            const delen = [...opdelen(t), ...opdelen(F.L - t)];
            beste = { ...c, soort: c.soort || 'dwars', dd: dd2, deel: { id: F.id, t, ...F }, tip: `Op ${getal(t)} m van het ${F.op ? 'onderste' : 'begin'} van het stuk van ${getal(F.L)} m: dat wordt ${delen.map(getal).join(' m + ')} m` };
          }
        }
      }
    }
    if (beste) return beste;
    const v = hulp.opVlak(muis[0], muis[1], 0); const sn = (x) => Math.round(x * 10) / 10;
    if (op) return { a: [sn(v[0]), sn(v[1]), 0], z: 0, r: rVrij, op: true, soort: 'vrij' };
    return { a: [sn(v[0] - (Math.cos(rVrij) * L) / 2), sn(v[1] - (Math.sin(rVrij) * L) / 2), 0], z: 0, r: rVrij, op: false, soort: 'vrij' };
  };
  const TIP = { liggend: 'Verder liggend', omhoog: 'Omhoog', omlaag: 'Omlaag naar de vloer', vrij: 'Los op de vloer', dwars: 'Dwars' };
  const stop = () => { setPlaats(null); setSpook(null); setTip(''); };
  const begin = (groep) => { setPlaats({ groep, rVrij: groep[0].r }); setSpook(null); setSel([]); };
  const nieuwStuk = (L) => begin([{ id: '__n0', L, a: [0, 0, 0], r: basisR, op: staand }]);
  const nieuweVorm = (lijst) => begin(lijst.map((x, k) => ({ ...x, a: [x.a[0], x.a[1], x.a[2]], id: `__n${k}` })));
  const plaatsing = (groep, p) => { const A = groep[0]; const g2 = A.op === p.op ? groep : groep.map((x, k) => (k === 0 ? { ...x, op: p.op } : x)); return verplaats(g2, p); };

  const onSleep = (fase, i, muis, hulp) => {
    if (fase === 'zweef') { if (!plaats) return; const g = plaats.groep; const p = zoekPlek(g[0].L, g[0].op, plaats.rVrij, muis, hulp, new Set()); setSpook(plaatsing(g, g.length > 1 ? { ...p, op: g[0].op } : p)); setTip(p.tip || TIP[p.soort]); return; }
    if (!schrijven || plaats) return;
    const F = stukken[i]; if (!F) return;
    const groep = sel.includes(i) ? [F, ...gekozen.filter((x) => x.i !== i)] : [F];
    const p = zoekPlek(F.L, F.op, F.r, muis, hulp, new Set(groep.map((x) => x.id)));
    const nieuw = plaatsing(groep, groep.length > 1 ? { ...p, op: F.op } : p);
    if (fase === 'sleep') { setSpook(nieuw); setTip(p.tip || TIP[p.soort]); return; }
    setSpook(null); setTip(''); const m = new Map(nieuw.map((x) => [x.id, x])); const od = metOpdeling(stukken.map((x) => m.get(x.id) || x), p); bewaar(od.lijst, od.erbij); if (!sel.includes(i) && !p.deel) setSel([i]); else if (p.deel) setSel([]);
  };
  const onKlik = (i, muis, hulp, meer) => {
    if (plaats && schrijven) {
      const g = plaats.groep; const p = zoekPlek(g[0].L, g[0].op, plaats.rVrij, muis, hulp, new Set());
      const nieuw = plaatsing(g, g.length > 1 ? { ...p, op: g[0].op } : p).map((x) => ({ ...x, id: nieuwId(), spook: false }));
      const od = metOpdeling([...stukken, ...nieuw], p); bewaar(od.lijst, od.erbij); setSpook(null);
      if (g.length > 1) { stop(); setSel(nieuw.map((_, j) => stukken.length + j)); }
      return;
    }
    setSelDoek(null);
    if (i == null) { if (!meer) setSel([]); return; }
    setSel((s0) => (meer ? (s0.includes(i) ? s0.filter((x) => x !== i) : [...s0, i]) : [i]));
  };
  const wijzigSel = (fn) => { if (!gekozen.length) return; const m = new Map(fn(gekozen).map((x) => [x.id, x])); bewaar(stukken.map((x) => m.get(x.id) || x)); };
  const weg = () => { if (!gekozen.length) return; const ids = new Set(sel); bewaar(stukken.filter((x) => !ids.has(x.i))); setSel([]); };
  const kopieer = () => { if (gekozen.length) begin(gekozen.map((x, k) => ({ ...x, id: `__n${k}` }))); };

  useEffect(() => {
    const h = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); if (plaats) stop(); else if (tekenD) { setTekenD(false); setTrek(null); } else if (selDoek) setSelDoek(null); else if (sel.length) setSel([]); else if (e.key === 'Escape') onSluit(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(stukken.map((x) => x.i)); return; }
      if (!schrijven) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) opnieuw(); else terug(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); opnieuw(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'c')) { e.preventDefault(); kopieer(); return; }
      if (e.key === 'r' || e.key === 'R') { const g = e.shiftKey ? -90 : 90; if (plaats) setPlaats((p) => ({ ...p, groep: draaiGroep(p.groep, g), rVrij: p.rVrij + rad(g) })); else wijzigSel((l) => draaiGroep(l, g)); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selDoek && !plaats) { e.preventDefault(); zetDoeken(doekLijst.filter((d) => d.id !== selDoek)); setSelDoek(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && gekozen.length && !plaats) { e.preventDefault(); weg(); }
    };
    window.addEventListener('keydown', h, true); return () => window.removeEventListener('keydown', h, true);
  });
  const totH = Math.max(0, ...stukken.map((x) => eindVan(x)[2]));
  const metr = stukken.reduce((a, x) => a + x.L, 0);
  const st1 = gekozen.length === 1 ? gekozen[0] : null;

  useBouwerSchild();
  return createPortal(
    <div className="fm fm-ws" role="dialog" aria-label="Trussbouwer" {...schildProps}>
      <div className="fm-ws-kop">
        <TerugKnop onClick={onSluit} />
        <strong>Trussbouwer · {el.naam}</strong>
        <span className="fm-sub">{stukken.length} stukken · {getal(metr)} m truss · {getal(totH)} m hoog</span>
        {gl && <div className="fm-segment" role="group" aria-label="Weergave"><button type="button" className={!beeld ? 'aan' : ''} onClick={() => setBeeld(false)}>Bouwen</button><button type="button" className={beeld ? 'aan' : ''} title="Echte 3D met licht en schaduw (bekijken)" onClick={() => setBeeld(true)}>3D-beeld</button></div>}
        <span style={{ flex: 1 }} />
        <button className="fm-knop klein" disabled={pdfBezig || !stukken.length} title="Eén PDF met de 3D-weergave, het grondplan en de vier aanzichten met maatlijnen" onClick={maakPdf}>{pdfBezig ? 'PDF maken…' : 'PDF'}</button>
        {schrijven && <button className="fm-knop klein" disabled={!terugL.current.length} title="Terug (Ctrl + Z)" aria-label="Terug" onClick={terug}>↶</button>}
        {schrijven && <button className="fm-knop klein" disabled={!vooruitL.current.length} title="Opnieuw (Ctrl + Shift + Z)" aria-label="Opnieuw" onClick={opnieuw}>↷</button>}
        {schrijven && stukken.length > 0 && <button className="fm-knop klein" onClick={() => { if (window.confirm('Alle stukken weghalen?')) { bewaar([]); setSel([]); } }}>Alles leeg</button>}
      </div>
      <div className="fm-ws-lijf">
        <aside className="fm-ws-doeken">
          <div className="fm-kop">Stukken</div>
          <div className="fm-segment fm-ws-tabs" role="group" aria-label="Richting">
            <button className={!staand ? 'aan' : ''} onClick={() => setStaand(false)}>Liggend</button>
            <button className={staand ? 'aan' : ''} onClick={() => setStaand(true)}>Staand</button>
          </div>
          <div className="fm-ws-bib">
            {lengtes.map((L) => {
              const aan = plaats?.groep.length === 1 && plaats.groep[0].L === L; const n = telling.stukken[String(L)] || 0;
              return (
                <button key={L} className={`fm-ws-blok${aan ? ' aan' : ''}`} disabled={!schrijven} title={`Recht stuk ${getal(L)} m`} onClick={() => (aan ? stop() : nieuwStuk(L))}>
                  <svg width="48" height="48" aria-hidden="true">{staand ? <g><line x1="20" y1={44} x2="20" y2={44 - (L / 4) * 40} stroke="#8A929B" strokeWidth="2" /><line x1="28" y1={44} x2="28" y2={44 - (L / 4) * 40} stroke="#8A929B" strokeWidth="2" /></g> : <g><line x1={24 - (L / 4) * 20} y1="20" x2={24 + (L / 4) * 20} y2="20" stroke="#8A929B" strokeWidth="2" /><line x1={24 - (L / 4) * 20} y1="28" x2={24 + (L / 4) * 20} y2="28" stroke="#8A929B" strokeWidth="2" /></g>}</svg>
                  <span>{getal(L)} m</span><small>{n ? `${n} gebruikt` : ' '}</small>
                </button>
              );
            })}
          </div>
          <div className="fm-kop">Kant-en-klaar</div>
          <div className="fm-ws-maat">
            <label>Breedte <input type="number" min="1" step="0.5" value={maatP.W} onChange={(e) => setMaatP((m) => ({ ...m, W: Math.max(0.5, Number(e.target.value) || 1) }))} /> m</label>
            <label>Hoogte <input type="number" min="1" step="0.5" value={maatP.H} onChange={(e) => setMaatP((m) => ({ ...m, H: Math.max(0.5, Number(e.target.value) || 1) }))} /> m</label>
          </div>
          <div className="fm-ws-acties">
            <button className="fm-knop klein" disabled={!schrijven} title="Twee torens met een ligger erover" onClick={() => nieuweVorm(portaal(maatP.W, maatP.H, basisR, lengtes))}>Portaal (boog)</button>
            <button className="fm-knop klein" disabled={!schrijven} title="Vier poten, liggers boven en onder" onClick={() => nieuweVorm(kubus(maatP.W, maatP.H, basisR, lengtes))}>Kubus</button>
            <button className="fm-knop klein" disabled={!schrijven} title="Een toren" onClick={() => nieuweVorm(portaal(0, maatP.H, basisR, lengtes).filter((x) => x.op).slice(0, Math.max(1, Math.ceil(maatP.H / 4) + 2)).filter((x, k, l) => l.findIndex((y) => y.a[0] === x.a[0] && y.a[1] === x.a[1] && y.a[2] === x.a[2]) === k))}>Toren</button>
          </div>
          <div className="fm-sub">{plaats ? 'Klik om te plaatsen · R = draaien · Enter of Esc = stoppen' : 'Bij het uiteinde van een stuk bepaalt de muis de richting: verder, een hoek, omhoog of omlaag. Hoekstukken en baseplates komen er vanzelf bij.'}</div>
        </aside>
        <div className="fm-ws-zicht">
          {beeld && drieP && <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: '#EEF1F4' }}><DrieGL prims={drieP} /></div>}
          <Zicht maatK={schrijven && maatKader && !plaats && !tekenD ? { K: maatKader, vb: maatVb } : null} onKader={(as, w, klaar) => { if (!klaar) { setMaatVb({ as, waarde: w }); return; } setMaatVb(null); if (Math.abs(w - kaderMaat(maatKader, as)) > 0.01) pasMaat(as, w); }} stukken={stukken} doeken={voorlopigDoek ? [...doekLijst, voorlopigDoek] : doekLijst} doekMap={doekMap} onDoekWijzig={schrijven ? (id, r) => { zetDoeken(doekLijst.map((d) => { if (d.id !== id) return d; const { van, tot, h, ...rest } = d; return { ...rest, ...r, wijze: d.wijze === 'op' ? 'op' : 'in' }; })); setSelDoek(id); } : null} selDoek={trek ? '__trek' : selDoek} tekenDoek={tekenD && schrijven} onTeken={onTeken} onDoekKlik={(id, k) => { if (plaats) return; setSel([]); setSelDoek(id); setDoekKant(k || 'voor'); }} zwart={zwart} hoek={hoek} kantel={kantel} sel={sel} spook={spook} zoom={zoom} vast={!!spook}
            onKlik={onKlik} onSleep={onSleep} onDraai={(a, b) => { setHoek(a); setKantel(b); }} onZoom={(k) => setZoom((z) => Math.max(0.2, Math.min(8, z * k)))} passTik={passTik} />
          <div className="fm-ws-hoeken" role="group" aria-label="Kijkhoek">
            <button onClick={() => { setHoek(0); setKantel(8); }}>Voor</button>
            <button onClick={() => { setHoek(35); setKantel(22); }}>Hoek</button>
            <button onClick={() => { setHoek(90); setKantel(8); }}>Zij</button>
            <button onClick={() => { setHoek(0); setKantel(80); }}>Boven</button>
            <button onClick={() => { setZoom(1); setPassTik((x) => x + 1); }} title="Alles in beeld">Passend</button>
          </div>
          <div className="fm-ws-tip fm-sub">{tip || 'Slepen = draaien · rechts slepen of twee vingers = verschuiven · scrollen = zoomen · Shift + klik = meer stukken · Ctrl + A = alles'}</div>
        </div>
        <aside className="fm-ws-rechts">
          {maatKader && schrijven && (
            <div className="fm-tr-maat">
              <div className="fm-kop">Maat {gekozen.length ? 'van de selectie' : 'van de constructie'}</div>
              {[['s', 'Lengte'], ['w', 'Breedte'], ['z', 'Hoogte']].map(([as, n]) => { const E = kaderMaat(maatKader, as); const plat = as === 'w' && E < 0.1; return (
                <div key={as} className="fm-tr-maatrij"><span>{n}</span>
                  <button type="button" className="fm-knop klein" disabled={plat || E <= 0.5} onClick={() => pasMaat(as, E - 0.5)} aria-label={`${n} 0,5 m kleiner`}>−</button>
                  <input key={`${as}${E}`} type="number" step="0.5" min="0.5" disabled={plat} defaultValue={Math.round(E * 100) / 100} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && Math.abs(v - E) > 0.01) pasMaat(as, v); }} />
                  <button type="button" className="fm-knop klein" disabled={plat} onClick={() => pasMaat(as, E + 0.5)} aria-label={`${n} 0,5 m groter`}>+</button><span className="fm-sub">m</span>
                </div>
              ); })}
              <div className="fm-sub">Of sleep de blauwe bollen in de 3D. Maten per 0,5 m; de stukken worden opnieuw opgedeeld in te huren lengtes.</div>
            </div>
          )}
          {gekozen.length ? (
            <>
              <div className="fm-ws-rkop"><strong>{st1 ? `Stuk ${getal(st1.L)} m` : `${gekozen.length} stukken`}</strong><button className="fm-sluit" aria-label="Selectie opheffen" onClick={() => setSel([])}>×</button></div>
              {st1 && <div className="fm-sub">{st1.op ? 'Staand' : 'Liggend'}{st1.a[2] > 0.01 ? ` · op ${getal(st1.a[2])} m` : ''}</div>}
              {schrijven && (
                <>
                  {st1 && (
                    <div className="fm-segment fm-ws-tabs" role="group" aria-label="Lengte" style={{ flexWrap: 'wrap' }}>
                      {lengtes.map((L) => <button key={L} className={st1.L === L ? 'aan' : ''} onClick={() => wijzigSel((l) => l.map((x) => ({ ...x, L })))}>{getal(L)}</button>)}
                    </div>
                  )}
                  <div className="fm-ws-acties">
                    <button className="fm-knop klein" title="90° draaien (R)" onClick={() => wijzigSel((l) => draaiGroep(l, 90))}>↻ 90°</button>
                    <button className="fm-knop klein" title="De andere kant op (Shift + R)" onClick={() => wijzigSel((l) => draaiGroep(l, -90))}>↺ 90°</button>
                    {st1 && <button className="fm-knop klein" onClick={() => wijzigSel((l) => l.map((x) => ({ ...x, op: !x.op })))}>{st1.op ? 'Liggend' : 'Staand'}</button>}
                    <button className="fm-knop klein" title="Kopie plaatsen (Ctrl + D)" onClick={kopieer}>Kopiëren</button>
                    <button className="fm-knop klein" style={{ color: '#B4123A' }} title="Wissen (Delete)" onClick={weg}>Weg</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="fm-ws-rkop"><strong>{plaats ? 'Plaatsen' : 'Truss'}</strong></div>
              <div className="fm-sub">{plaats ? `${plaats.groep.length > 1 ? `${plaats.groep.length} stukken` : `Stuk ${getal(plaats.groep[0].L)} m`}: klik in beeld. R = draaien, Enter of Esc = stoppen.` : 'Klik een stuk in beeld (Shift + klik = meer, Ctrl + A = alles), of kies links een stuk of vorm.'}</div>
            </>
          )}
          {schrijven && stukken.length > 0 && (
            <button className={`fm-knop klein${tekenD ? ' zwart' : ''}`} title="Druk op het frame waar het doek moet komen en sleep een rechthoek; hij kleeft aan de randen van de truss" onClick={() => { setTekenD((x) => !x); setTrek(null); setPlaats(null); setSpook(null); }}>{tekenD ? 'Doek tekenen · aan' : 'Doek tekenen'}</button>
          )}
          {tekenD && <span className="fm-sub">Druk op het frame en sleep een rechthoek waar het doek moet komen. Het kleeft aan de randen van de truss. Esc = stoppen.</span>}
          {schrijven && (() => {
            // Doek op één of meer liggende stukken op één lijn (Shift + klik = de hele bovenligger kiezen).
            const lig = gekozen.filter((x) => !x.op); if (!lig.length || lig.length !== gekozen.length) return null;
            const F = lig[0]; const n = [Math.sin(F.r), -Math.cos(F.r)];
            const opLijn = lig.every((x) => Math.abs(Math.sin(x.r - F.r)) < 0.01 && Math.abs(x.a[2] - F.a[2]) < 0.01 && Math.abs((x.a[0] - F.a[0]) * n[0] + (x.a[1] - F.a[1]) * n[1]) < 0.05);
            if (!opLijn) return <span className="fm-sub">Kies liggende stukken op één lijn om er een doek aan te hangen.</span>;
            const ids = lig.map((x) => x.id); const V = doekVlak({ stukken: ids }, stukken);
            const nieuw = (extra) => { const W = doekVlak({ stukken: ids, h: 'auto', ...extra }, stukken); return { id: nieuwId(), stuk: ids[0], s0: W.s0, s1: W.s1, z0: W.z0, z1: W.z1, wijze: 'in', voor: null, achter: null }; };
            const vakken = []; if (V) { const g = [V.tmin, ...V.torens.filter((x) => x > V.tmin + 0.2 && x < V.tmax - 0.2), V.tmax]; for (let k = 0; k < g.length - 1; k++) vakken.push([g[k], g[k + 1]]); }
            return (
              <div className="fm-ws-acties">
                <button className="fm-knop klein" title={`Eén doek over ${lig.length > 1 ? 'de gekozen stukken' : 'dit stuk'}, tot ${V?.zb != null ? 'de onderligger' : 'de vloer'}`} onClick={() => { const d = nieuw({}); zetDoeken([...doekLijst, d]); setSel([]); setSelDoek(d.id); }}>Eén doek</button>
                {vakken.length > 1 && <button className="fm-knop klein" title="Een doek per vak tussen de torens" onClick={() => { const l = vakken.map(([v0, v1]) => nieuw({ van: v0, tot: v1 })); zetDoeken([...doekLijst, ...l]); setSel([]); setSelDoek(l[0].id); }}>Doek per vak ({vakken.length})</button>}
              </div>
            );
          })()}
          {dk && (() => {
            const V = doekVlak(dk, stukken); const max = V ? Math.max(0.2, V.z1) : 3; const auto = dk.h === 'auto' || dk.h == null;
            const zet = (patch) => zetDoeken(doekLijst.map((d) => (d.id === dk.id ? { ...d, ...patch } : d)));
            return (
              <>
                <div className="fm-ws-rkop"><strong>Doek</strong><button className="fm-sluit" aria-label="Sluiten" onClick={() => setSelDoek(null)}>×</button></div>
                <div className="fm-segment fm-ws-tabs" role="group" aria-label="Ophanging">
                  {[['in', 'In de truss'], ['op', 'Op de truss']].map(([k, n]) => <button key={k} disabled={!schrijven} className={(dk.wijze || 'in') === k ? 'aan' : ''} title={k === 'op' ? 'Voor de truss gehangen (op de buitenkant)' : 'In het vlak van de truss'} onClick={() => zet({ wijze: k })}>{n}</button>)}
                </div>
                {dk.wijze === 'op' && (
                  <div className="fm-segment fm-ws-tabs" role="group" aria-label="Aan welke kant">
                    {[['voor', 'Aan de voorkant'], ['achter', 'Aan de achterkant']].map(([k, n]) => <button key={k} disabled={!schrijven} className={(dk.zijde || 'voor') === k ? 'aan' : ''} onClick={() => zet({ zijde: k })}>{n}</button>)}
                  </div>
                )}
                {V?.getekend ? (() => {
                  const F = stukken.find((x) => x.id === dk.stuk); const R = F ? vlakRanden(F, stukken) : null; const links = R ? R.s[0] : 0; const vloer = -B2;
                  const veld = (label, waarde, zetW) => <label className="fm-ws-maat"><span style={{ minWidth: 64 }}>{label}</span><input key={`${label}${waarde}`} type="number" step="0.01" defaultValue={Math.round(waarde * 1000) / 1000} disabled={!schrijven} onBlur={(e) => { const v = Number(String(e.target.value).replace(',', '.')); if (Number.isFinite(v) && Math.abs(v - waarde) > 0.0005) zetW(v); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /> m</label>;
                  return (
                    <>
                      {veld('Breedte', dk.s1 - dk.s0, (v) => zet({ s1: dk.s0 + Math.max(0.1, v) }))}
                      {veld('Hoogte', dk.z1 - dk.z0, (v) => zet({ z0: dk.z1 - Math.max(0.1, v) }))}
                      {veld('Van links', dk.s0 - links, (v) => { const b = dk.s1 - dk.s0; zet({ s0: links + v, s1: links + v + b }); })}
                      {veld('Van onder', dk.z0 - vloer, (v) => { const h = dk.z1 - dk.z0; zet({ z0: vloer + Math.max(0, v), z1: vloer + Math.max(0, v) + h }); })}
                      <span className="fm-sub">Van links = vanaf de buitenkant van het frame, van onder = vanaf de vloer.</span>
                    </>
                  );
                })() : (<>
                <div className="fm-sub">{V ? `${getal(V.s1 - V.s0)} × ${getal(V.z1 - V.z0)} m` : ''}</div>
                <label className="fm-vink"><input type="checkbox" checked={auto} disabled={!schrijven} onChange={(e) => zet({ h: e.target.checked ? 'auto' : Math.round((V ? V.z1 - V.z0 : 1) * 100) / 100 })} />Tot de onderkant van het frame{V && V.zb == null ? ' (vloer)' : ''}</label>
                {!auto && <label className="fm-ws-maat"><span>Hoogte</span> <input type="number" min="0.2" max={max} step="0.1" value={dk.h} disabled={!schrijven} onChange={(e) => zet({ h: Math.max(0.2, Math.min(max, Number(e.target.value) || 1)) })} /> m</label>}
                </>)}
                <div className="fm-segment fm-ws-tabs" role="group" aria-label="Kant">
                  {[['voor', 'Voorkant'], ['achter', 'Achterkant']].map(([k, n]) => <button key={k} className={doekKant === k ? 'aan' : ''} onClick={() => setDoekKant(k)}>{n}</button>)}
                </div>
                <select value={dk[doekKant] || ''} disabled={!schrijven} onChange={(e) => zet({ [doekKant]: e.target.value || null })}>
                  <option value="">Geen ontwerp</option>
                  {ontwerpen.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}
                </select>
                {schrijven && <DoekUpload planId={it.plan_id} drager="truss" klein onNieuw={(d) => zet({ [doekKant]: d.id })} />}
                <div className="fm-segment fm-ws-tabs" role="group" aria-label="Plaatsing van het ontwerp">
                  {PLAATSINGEN.map(([k, n, tip]) => <button key={k} disabled={!schrijven} title={tip} className={(dk.plaatsing || 'vullen') === k ? 'aan' : ''} onClick={() => zet({ plaatsing: k === 'vullen' ? null : k })}>{n}</button>)}
                </div>
                {dk.plaatsing === 'herhalen' && (
                  <div className="fm-segment fm-ws-tabs" role="group" aria-label="Herhaling begint">
                    {STARTEN.map(([k, n]) => <button key={k} disabled={!schrijven} title={`Herhaling begint ${n.toLowerCase()}`} className={(dk.start || 'rechts') === k ? 'aan' : ''} onClick={() => zet({ start: k })}>{n}</button>)}
                  </div>
                )}
                {schrijven && <div className="fm-ws-acties"><button className="fm-knop klein" onClick={() => zet({ voor: dk[doekKant], achter: dk[doekKant] })} disabled={!dk[doekKant]}>Op beide kanten</button><button className="fm-knop klein" style={{ color: '#B4123A' }} onClick={() => { zetDoeken(doekLijst.filter((d) => d.id !== dk.id)); setSelDoek(null); }}>Doek weg</button></div>}
                {!ontwerpen.length && <span className="fm-sub">Nog geen truss-doeken: voeg ze toe in de werkruimte Branding (drager truss).</span>}
              </>
            );
          })()}
          <span style={{ flex: 1 }} />
          <div className="fm-kop">Plannen van de leverancier</div>
          <StellingPlannen planId={it.plan_id} itemId={it.id} schrijven={schrijven} soort="trussplan" wie="trussleverancier" compact />
          <div className="fm-kop">Stuklijst</div>
          <div className="fm-ws-lijst">
            {Object.entries(telling.stukken).sort((a, b) => Number(b[0]) - Number(a[0])).map(([L, n]) => <div key={L}><span>Truss {getal(L)} m</span><b>{n}</b></div>)}
            {telling.hoek > 0 && <div><span>{el.eigenschappen?.hoek_naam || 'Hoekstuk'}</span><b>{telling.hoek}</b></div>}
            {telling.voet > 0 && <div><span>Baseplate</span><b>{telling.voet}</b></div>}
            {doekLijst.length > 0 && <div><span>Doeken</span><b>{doekLijst.length}</b></div>}
            {!stukken.length && <span className="fm-sub">Nog niets gebouwd.</span>}
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
