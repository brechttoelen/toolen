'use client';

// Conceptbouwer: een zone van het plan waarin je tenten, vloer, truss (met doeken) en containers samen plaatst,
// in 2D (bovenaanzicht) en 3D. Alles blijft gewoon een item op het plan; details stel je in met de bouwer van dat item.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import TerugKnop from './TerugKnop';
import { useBouwerSchild, schildProps } from './bouwerschild';
import { webglKan } from './StellingStudio';
import { isUnitEl, isAutoEl, isContainerDeel, unitGroep, containerPrims } from './containerbouw';
import { isTentBouw, tentGroep, tentAssen, stukKleur } from './tentbouw';
import { tentTeken } from './TentStudio';
import { isTrussBouw, trussStukken, trussTypeVoor, portaal, kubus, toren, naarTrussOpslag, TRUSS_LENGTES } from './trussbouw';
import { trussPrims, zetTrussType } from './TrussStudio';
import { wandPunten } from './WandStudio';
import { isWand, wandStukken } from './framewand';
import { publiekeUrl } from './db';

const DrieGL = dynamic(() => import('./TentDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });
const M_LAT = 110574; const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const KLEEF_PX = 12;
const TABS = [['unit', 'Containers'], ['tent', 'Tenten'], ['vloer', 'Vloer'], ['truss', 'Truss'], ['overig', 'Overig']];
const SOORT_NAAM = { unit: 'Container', tent: 'Tent', vloer: 'Vloer', truss: 'Truss', wand: 'B-matrix wand', overig: 'Element' };
const TEL_NAAM = { unit: 'containers', tent: 'tenten', vloer: 'vloer', truss: 'truss', wand: 'wanden', overig: 'overig' };
const LAAG = { vloer: 0, tent: 1, overig: 2, unit: 3, wand: 4, truss: 5 };
const KLEUR_2D = { unit: '#E5E7EB', tent: '#FDF2E9', vloer: '#D6C4A8', truss: '#CBD5E1', wand: '#BFDBFE', overig: '#EDE9FE' };
const isLijn = (o) => o.soort === 'truss' || o.soort === 'wand';

const isVloerEl = (el) => !!el?.eigenschappen?.vloer && el.tekenwijze === 'schaal';
export function soortVan(it, el) {
  if (!it) return null;
  if (isTrussBouw(it)) return 'truss';
  if (isWand(el) && it.geometrie?.type === 'LineString') return 'wand';
  if (!it.parameters?.midden || !el) return null;
  if (isContainerDeel(el)) return 'unit';
  if (isTentBouw(el)) return 'tent';
  if (isVloerEl(el)) return 'vloer';
  if (el.tekenwijze === 'schaal') return 'overig';
  return null;
}
const rondom = (mid, L, B, a) => { const c = Math.cos(a); const s = Math.sin(a); return [[-L / 2, -B / 2], [L / 2, -B / 2], [L / 2, B / 2], [-L / 2, B / 2]].map(([x, y]) => [mid[0] + x * c - y * s, mid[1] + x * s + y * c]); };
const opSeg = (p, a, b) => { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return [a[0] + t * dx, a[1] + t * dy]; };
const draai = (p, c, a) => { const x = p[0] - c[0]; const y = p[1] - c[1]; return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)]; };

// Alle punten van 3D-stukken omzetten (vlakken, lijnen, balken, meshes, doeken).
function zetPrims(prims, f) {
  const P = (q) => (Array.isArray(q) && q.length >= 2 && typeof q[0] === 'number' ? f(q) : q);
  return prims.map((p) => {
    const q = { ...p };
    for (const k of ['a', 'b', 'p', 'A', 'B', 'C']) if (q[k]) q[k] = P(q[k]);
    for (const k of ['w', 'pos', 'omtrek']) if (Array.isArray(q[k])) q[k] = q[k].map(P);
    return q;
  });
}
// Doos (vlakken) op een omtrek: voor elementen zonder eigen 3D-vorm.
function doos(prims, ring, z0, h, kl, data) {
  const z1 = z0 + h; const op = (q, z) => [q[0], q[1], z];
  prims.push({ k: 'vlak', w: ring.map((q) => op(q, z1)), vul: kl, op: 1, rand: 'vul', data });
  for (let i = 0; i < ring.length; i++) { const a = ring[i]; const b = ring[(i + 1) % ring.length]; prims.push({ k: 'vlak', w: [op(a, z0), op(b, z0), op(b, z1), op(a, z1)], vul: kl, op: 1, rand: '#6B7280', data }); }
}
const tint = (hex, f) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; const n = parseInt(m[1], 16); const k = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => k(v).toString(16).padStart(2, '0')).join('')}`; };
// Vloer: dikte per soort, naden tussen de platen (maat van het element) en de tekening van het materiaal
// (planken bij een vlonder, kruisnaden bij cassettes, antislipribbels bij zwaarlastplaten).
export function vloerNaden(o) {
  const el = o.el; const mat = String(el.eigenschappen?.materiaal || ''); const L = o.L; const B = o.B;
  const pl = Math.max(0.2, Number(el.breedte_m) || L); const pd = Math.max(0.2, Number(el.diepte_m) || B);
  const naden = []; const fijn = [];
  for (let x = pl; x < L - 0.02; x += pl) naden.push([x, 0, x, B]);
  for (let y = pd; y < B - 0.02; y += pd) naden.push([0, y, L, y]);
  const langsX = pl >= pd; // de lange zijde van een plaat
  if (mat === 'vlonder') { const st = 0.125; if (langsX) for (let y = st; y < B - 0.02; y += st) { if (Math.abs(y / pd - Math.round(y / pd)) > 0.01) fijn.push([0, y, L, y]); } else for (let x = st; x < L - 0.02; x += st) { if (Math.abs(x / pl - Math.round(x / pl)) > 0.01) fijn.push([x, 0, x, B]); } }
  else if (mat === 'cassette') { for (let x = pl / 2; x < L; x += pl) fijn.push([x, 0, x, B]); for (let y = pd / 2; y < B; y += pd) fijn.push([0, y, L, y]); }
  else { const st = 0.25; if (langsX) for (let x = st; x < L - 0.02; x += st) fijn.push([x, 0.06, x, B - 0.06]); else for (let y = st; y < B - 0.02; y += st) fijn.push([0.06, y, L - 0.06, y]); }
  const dun = (lijst, max) => { if (lijst.length <= max) return lijst; const k = Math.ceil(lijst.length / max); return lijst.filter((_, i) => i % k === 0); };
  return { naden: dun(naden, 300), fijn: dun(fijn, 400), mat };
}
function vloerPrims(uit, o, kleur, data) {
  const el = o.el; const { naden, fijn, mat } = vloerNaden(o);
  const dik = Number(el.hoogte_m) > 0 ? Number(el.hoogte_m) : mat === 'vlonder' ? 0.12 : mat === 'cassette' ? 0.1 : 0.05;
  const c = Math.cos(o.hoek); const s = Math.sin(o.hoek);
  const W = (x, y, z) => [o.mid[0] + (x - o.L / 2) * c - (y - o.B / 2) * s, o.mid[1] + (x - o.L / 2) * s + (y - o.B / 2) * c, z];
  const h = [[0, 0], [o.L, 0], [o.L, o.B], [0, o.B]];
  uit.push({ k: 'vlak', w: h.map(([x, y]) => W(x, y, dik)), vul: kleur, op: 1, rand: 'vul', data });
  for (let i = 0; i < 4; i++) { const a = h[i]; const b = h[(i + 1) % 4]; uit.push({ k: 'vlak', w: [W(a[0], a[1], 0), W(b[0], b[1], 0), W(b[0], b[1], dik), W(a[0], a[1], dik)], vul: tint(kleur, 0.62), op: 1, rand: 'vul', data }); }
  const z = dik + 0.004;
  for (const [x0, y0, x1, y1] of naden) uit.push({ k: 'lijn', a: W(x0, y0, z), b: W(x1, y1, z), kl: tint(kleur, 0.45), w: 1, data: {} });
  for (const [x0, y0, x1, y1] of fijn) uit.push({ k: 'lijn', a: W(x0, y0, z), b: W(x1, y1, z), kl: tint(kleur, mat === 'vlonder' ? 0.72 : 0.82), w: 1, data: {} });
}
// B-matrix wand: elk frame als paneel met het doek van de voor- en achterkant.
function wandPrims(uit, o, doekMap, data) {
  for (const f of o.fr) {
    const a = [f.a[0] + o.o[0], f.a[1] + o.o[1]]; const e = [f.e[0] + o.o[0], f.e[1] + o.o[1]]; const n = [Math.sin(f.r), -Math.cos(f.r)]; const z0 = f.z0 || 0; const z1 = z0 + (f.h || 2.5);
    uit.push({ k: 'balk', a: [a[0], a[1], z0], b: [a[0], a[1], z1], d: [0.05, 0.05], kl: '#9CA3AF', data }); uit.push({ k: 'balk', a: [e[0], e[1], z0], b: [e[0], e[1], z1], d: [0.05, 0.05], kl: '#9CA3AF', data });
    for (const [kant, sg] of [['voor', 1], ['achter', -1]]) {
      const ont = f[kant] ? doekMap.get(f[kant]) : null; const d = sg * 0.03; const P = (q, zz, d2 = d) => [q[0] + n[0] * d2, q[1] + n[1] * d2, zz];
      const [l, rr] = sg > 0 ? [a, e] : [e, a];
      uit.push({ k: 'vlak', w: [P(l, z1), P(rr, z1), P(rr, z0), P(l, z0)], vul: ont ? ont.eigenschappen?.kleur || '#0F766E' : '#F3F4F6', op: 1, rand: null, data });
      const src = ont?.eigenschappen?.beeld ? publiekeUrl(ont.eigenschappen.beeld) : null;
      if (src) uit.push({ k: 'beeld', A: P(l, z1, d + sg * 0.004), B: P(rr, z1, d + sg * 0.004), C: P(l, z0, d + sg * 0.004), href: src });
    }
  }
}
// Alle stukken van één item aanklikbaar en versleepbaar maken in de 3D.
const merk = (prims, id) => prims.map((p) => (p.k === 'beeld' ? p : { ...p, data: { unit: id, sleep: true } }));

export default function ConceptStudio({ midden, items, elementen, elementenMap, schrijven, onSluit, onPlaats, onPlaatsTruss, onZet, onWeg, onBewerk }) {
  useBouwerSchild();
  const C = midden; const ml = mLng(C[1]);
  const naarM = ([lng, lat]) => [(lng - C[0]) * ml, (lat - C[1]) * M_LAT];
  const naarGeo = ([x, y]) => [C[0] + x / ml, C[1] + y / M_LAT];
  const [zone, setZone] = useState({ x0: -15, y0: -10, x1: 15, y1: 10 }); // de zone die je in 3D ziet (meter rond het klikpunt)
  const [uitgezet, setUitgezet] = useState(() => new Set()); // items in de zone die je niet in 3D wil zien
  const [zicht, setZicht] = useState('beide');
  const [tab, setTab] = useState('tent');
  const [sel, setSel] = useState(null);
  const [zoek, setZoek] = useState('');
  const [melding, setMelding] = useState('');
  useEffect(() => { if (!melding) return undefined; const t = setTimeout(() => setMelding(''), 4000); return () => clearTimeout(t); }, [melding]);
  const [gl, setGl] = useState(false); useEffect(() => { setGl(webglKan()); }, []);
  const [trussMaat, setTrussMaat] = useState({ W: 6, H: 4, zwart: false });
  const lijstSleep = useRef(null);

  // Objecten in en rond de zone, met hun omtrek in meter (oost, noord) rond het klikpunt.
  const objs = useMemo(() => {
    const uit = []; const R = 30;
    const bij = (m) => m[0] > zone.x0 - R && m[0] < zone.x1 + R && m[1] > zone.y0 - R && m[1] < zone.y1 + R;
    const inZ = (m) => m[0] >= zone.x0 && m[0] <= zone.x1 && m[1] >= zone.y0 && m[1] <= zone.y1;
    for (const it of items) {
      if (!it || it.verborgen) continue;
      const el = elementenMap.get(it.element_id); const soort = soortVan(it, el); if (!soort) continue;
      if (soort === 'truss' || soort === 'wand') {
        const c = it.geometrie?.coordinates; if (!c?.length) continue;
        const o = naarM(c[0]); if (!bij(o)) continue;
        const pts = wandPunten(it); let st = null; let fr = null; let seg;
        if (soort === 'truss') { st = trussStukken(pts, it); if (!st.length) continue; seg = st.map((s) => [s.a, s.e]); } else { fr = wandStukken(pts, it, el); if (!fr.length) continue; seg = fr.map((f) => [f.a, f.e]); }
        const xs = seg.flatMap((s) => [s[0][0], s[1][0]]).map((x) => x + o[0]); const ys = seg.flatMap((s) => [s[0][1], s[1][1]]).map((y) => y + o[1]);
        const m = 0.7; const r = [[Math.min(...xs) - m, Math.min(...ys) - m], [Math.max(...xs) + m, Math.min(...ys) - m], [Math.max(...xs) + m, Math.max(...ys) + m], [Math.min(...xs) - m, Math.max(...ys) + m]]; // ruim genoeg om aan te klikken
        const mid = [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[2][1]) / 2];
        uit.push({ id: it.id, it, el, soort, ring: r, mid, st, fr, seg: seg.map(([a, b]) => [[a[0] + o[0], a[1] + o[1]], [b[0] + o[0], b[1] + o[1]], !!(st && Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01)]), o, v: 0, inZone: inZ(mid) });
        continue;
      }
      const p = it.parameters; const mid = naarM(p.midden); if (!bij(mid)) continue;
      const L = Number(p.breedte) || Number(el.breedte_m) || 1; const B = Number(p.diepte) || Number(el.diepte_m) || 1; const hoek = -((Number(p.rot) || 0) * Math.PI) / 180;
      uit.push({ id: it.id, it, el, soort, ring: rondom(mid, L, B, hoek), mid, L, B, hoek, v: Number(it.velden?.verdieping) || 0, inZone: inZ(mid) });
    }
    return uit;
  }, [items, elementenMap, zone, C[0], C[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const objMap = useMemo(() => new Map(objs.map((o) => [o.id, o])), [objs]);
  const gekozen = sel ? objMap.get(sel) : null;

  // ---------- 3D: alles samen in één scène ----------
  const doeken = useMemo(() => [...elementenMap.values()].filter((x) => x.tekenwijze === 'doek'), [elementenMap]);
  const doekMap = useMemo(() => new Map(doeken.map((d) => [d.id, d])), [doeken]);
  const in3D = useMemo(() => objs.filter((o) => o.inZone && !uitgezet.has(o.id)), [objs, uitgezet]);
  const zoneItems = useMemo(() => in3D.map((o) => o.it), [in3D]);
  const prims = useMemo(() => {
    if (!gl) return null;
    const uit = []; const klaar = new Set();
    for (const o of in3D) {
      if (klaar.has(o.id)) continue;
      const data = { unit: o.id, sleep: true };
      try {
        if (o.soort === 'unit') {
          const groep = unitGroep(o.it, o.el, zoneItems, elementenMap, { midden: C, rot: 0, breedte: 2, diepte: 2 });
          for (const g of groep) klaar.add(g.it.id);
          uit.push(...zetPrims(containerPrims(groep, null, { doekMap, url: publiekeUrl }), ([x, y, z]) => [x - 1, y - 1, z]));
        } else if (o.soort === 'tent') {
          const groep = tentGroep(o.it, o.el, zoneItems, elementenMap);
          for (const g of groep) klaar.add(g.it.id);
          const A = tentAssen(o.it, o.el); if (!A) continue;
          const pr = tentTeken({ it: o.it, el: o.el, groep, items: zoneItems, doekMap, vloer: !!o.it.velden?.vloer }).prims;
          uit.push(...merk(zetPrims(pr, ([x, y, z]) => { const [e, n] = naarM(A.naarGeo([x, y])); return [e, n, z || 0]; }), o.id));
        } else if (o.soort === 'truss') {
          klaar.add(o.id); zetTrussType(trussTypeVoor(o.el, o.it.velden?.truss));
          const pr = trussPrims(o.st, o.it.velden?.truss?.doeken || [], doekMap, /zwart/i.test(o.el?.naam || ''));
          uit.push(...merk(zetPrims(pr, ([x, y, z]) => [x + o.o[0], y + o.o[1], z || 0]), o.id));
        } else if (o.soort === 'wand') {
          klaar.add(o.id); wandPrims(uit, o, doekMap, data);
        } else if (o.soort === 'vloer') {
          klaar.add(o.id); vloerPrims(uit, o, stukKleur(o.el) || '#B08968', data);
        } else {
          klaar.add(o.id); doos(uit, o.ring, 0, Math.max(0.3, Number(o.el.hoogte_m) || 1), '#C4B5FD', data);
        }
      } catch { /* één item dat niet lukt, mag de rest niet tegenhouden */ }
    }
    return uit;
  }, [gl, in3D, zoneItems, elementenMap, doekMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- 2D ----------
  const svgRef = useRef(null); const [maat, setMaat] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = svgRef.current?.parentElement; if (!el) return undefined;
    const ro = new ResizeObserver(() => setMaat({ w: el.clientWidth || 800, h: el.clientHeight || 600 })); ro.observe(el);
    return () => ro.disconnect();
  }, [zicht]);
  const [beeld, setBeeld] = useState(null);
  useEffect(() => { if (!beeld && maat.w) setBeeld({ cx: 0, cy: 0, s: Math.min(maat.w / 50, maat.h / 40) }); }, [maat.w, maat.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const Bv = beeld || { cx: 0, cy: 0, s: 8 };
  const naarS = ([x, y]) => [(x - Bv.cx) * Bv.s + maat.w / 2, (Bv.cy - y) * Bv.s + maat.h / 2];
  const naarW = (e) => { const r = svgRef.current.getBoundingClientRect(); return [Bv.cx + (e.clientX - r.left - maat.w / 2) / Bv.s, Bv.cy - (e.clientY - r.top - maat.h / 2) / Bv.s]; };
  const pad = (ring) => `M${ring.map((q) => naarS(q).join(',')).join('L')}Z`;

  // Wat samen beweegt: dezelfde groep op het plan (bv. een containeropstelling of gekoppelde tenten).
  const leden = (o) => (o.it.groep_id ? objs.filter((x) => x.it.groep_id === o.it.groep_id) : [o]);
  const kleef = (ringen, weg) => {
    const tol = KLEEF_PX / Bv.s; let best = null;
    for (const u of objs) {
      if (weg.has(u.id) || isLijn(u)) continue;
      for (const ring of ringen) for (const c of ring) {
        for (const h of u.ring) { const d = Math.hypot(h[0] - c[0], h[1] - c[1]); if (d < tol && (!best || d - tol * 0.5 < best.d)) best = { d: d - tol * 0.5, dx: h[0] - c[0], dy: h[1] - c[1] }; }
        for (let k = 0; k < u.ring.length; k++) { const q = opSeg(c, u.ring[k], u.ring[(k + 1) % u.ring.length]); const d = Math.hypot(q[0] - c[0], q[1] - c[1]); if (d < tol && (!best || d < best.d)) best = { d, dx: q[0] - c[0], dy: q[1] - c[1] }; }
      }
    }
    return best ? [best.dx, best.dy] : [0, 0];
  };
  // De zone groeit mee als je iets (dat in de zone stond) erbuiten zet of er iets naast plaatst.
  const rekZone = (punten) => setZone((z) => { const n = { ...z }; for (const [x, y] of punten) { n.x0 = Math.min(n.x0, x - 1); n.x1 = Math.max(n.x1, x + 1); n.y0 = Math.min(n.y0, y - 1); n.y1 = Math.max(n.y1, y + 1); } return n.x0 === z.x0 && n.x1 === z.x1 && n.y0 === z.y0 && n.y1 === z.y1 ? z : n; });
  // Wijzigingen naar het plan.
  const verzet = (ids, d) => {
    const nieuw = [];
    for (const id of ids) { const o = objMap.get(id); if (!o) continue; if (isLijn(o)) onZet(id, { verschuif: d }); else onZet(id, { midden: naarGeo([o.mid[0] + d[0], o.mid[1] + d[1]]), rot: -((o.hoek * 180) / Math.PI) }); if (o.inZone) nieuw.push([o.mid[0] + d[0], o.mid[1] + d[1]]); }
    if (nieuw.length) rekZone(nieuw);
  };
  const verdraai = (ids, c, da) => {
    for (const id of ids) { const o = objMap.get(id); if (!o) continue; if (isLijn(o)) onZet(id, { draaiOm: naarGeo(c), hoek: da }); else onZet(id, { midden: naarGeo(draai(o.mid, c, da)), rot: Math.round(-(((o.hoek + da) * 180) / Math.PI) * 10) / 10 }); }
  };

  const [sleep, setSleep] = useState(null); const sleepRef = useRef(null); sleepRef.current = sleep;
  const omlaag = (e, o) => {
    if (e.button !== 0) return; e.stopPropagation(); setSel(o.id);
    if (!schrijven) return;
    setSleep({ soort: 'verplaats', ids: leden(o).map((x) => x.id), p0: naarW(e), d: [0, 0] });
  };
  const draaiStart = (e, o) => {
    e.stopPropagation(); if (!schrijven) return;
    const c = o.mid; const p = naarW(e);
    setSleep({ soort: 'draai', ids: leden(o).map((x) => x.id), c, a0: Math.atan2(p[1] - c[1], p[0] - c[0]), da: 0 });
  };
  const achtergrond = (e) => { if (e.button !== 0) return; setSel(null); setSleep({ soort: 'pan', x0: e.clientX, y0: e.clientY, c0: [Bv.cx, Bv.cy] }); };
  useEffect(() => {
    if (!sleep || sleep.drie) return undefined;
    const beweeg = (e) => {
      const s = sleepRef.current; if (!s || !svgRef.current) return;
      if (s.soort === 'pan') { setBeeld({ ...Bv, cx: s.c0[0] - (e.clientX - s.x0) / Bv.s, cy: s.c0[1] + (e.clientY - s.y0) / Bv.s }); return; }
      const p = naarW(e);
      if (s.soort === 'zone') {
        const z = { ...s.z0 }; const [kx, ky] = s.hoek;
        z[kx] = Math.round(p[0] * 2) / 2; z[ky] = Math.round(p[1] * 2) / 2;
        if (z.x1 - z.x0 >= 4 && z.y1 - z.y0 >= 4) setZone(z);
      } else if (s.soort === 'verplaats') {
        let d = [p[0] - s.p0[0], p[1] - s.p0[1]];
        if (!e.altKey) { const weg = new Set(s.ids); const [kx, ky] = kleef(s.ids.map((id) => objMap.get(id)).filter((o) => o && !isLijn(o)).map((o) => o.ring.map((q) => [q[0] + d[0], q[1] + d[1]])), weg); d = [d[0] + kx, d[1] + ky]; }
        setSleep({ ...s, d });
      } else if (s.soort === 'draai') {
        let da = Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.a0; if (e.shiftKey) da = Math.round(da / (Math.PI / 12)) * (Math.PI / 12);
        setSleep({ ...s, da });
      }
    };
    const los = () => {
      const s = sleepRef.current; setSleep(null); if (!s) return;
      if (s.soort === 'verplaats' && Math.hypot(s.d[0], s.d[1]) > 0.01) verzet(s.ids, s.d);
      if (s.soort === 'draai' && Math.abs(s.da) > 0.001) verdraai(s.ids, s.c, s.da);
    };
    window.addEventListener('pointermove', beweeg); window.addEventListener('pointerup', los);
    return () => { window.removeEventListener('pointermove', beweeg); window.removeEventListener('pointerup', los); };
  });
  const wiel = (e) => { const p = naarW(e); const f = Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0015); const s = Math.max(1, Math.min(200, Bv.s * f)); setBeeld({ s, cx: p[0] - (p[0] - Bv.cx) * (Bv.s / s), cy: p[1] - (p[1] - Bv.cy) * (Bv.s / s) }); };
  useEffect(() => { const el = svgRef.current; if (!el) return undefined; const h = (e) => { e.preventDefault(); wiel(e); }; el.addEventListener('wheel', h, { passive: false }); return () => el.removeEventListener('wheel', h); });
  // Een punt zoals het nu getekend wordt (tijdens slepen of draaien).
  const nu = (o) => {
    const s = sleep; if (!s || !s.ids?.includes(o.id)) return (q) => q;
    if (s.soort === 'verplaats') return (q) => [q[0] + s.d[0], q[1] + s.d[1]];
    if (s.soort === 'draai') return (q) => draai(q, s.c, s.da);
    return (q) => q;
  };

  // Slepen in de 3D zelf: een item over de grond verschuiven (los = op het plan zetten).
  const drie3 = useRef(null);
  const sleep3D = (fase, data, grond) => {
    if (!schrijven || !data?.unit) return;
    const o = objMap.get(data.unit); if (!o) return;
    if (!drie3.current || drie3.current.id !== o.id) { if (!grond) return; drie3.current = { id: o.id, g0: grond, ids: leden(o).map((x) => x.id), d: [0, 0] }; setSel(o.id); }
    const D = drie3.current;
    if (grond) D.d = [Math.round((grond[0] - D.g0[0]) * 4) / 4, Math.round((grond[1] - D.g0[1]) * 4) / 4]; // per 25 cm
    if (fase === 'beweeg') { const s = sleepRef.current; if (!s || s.d[0] !== D.d[0] || s.d[1] !== D.d[1]) setSleep({ soort: 'verplaats', drie: true, ids: D.ids, d: D.d }); return; }
    drie3.current = null; setSleep(null);
    if (Math.hypot(D.d[0], D.d[1]) > 0.01) verzet(D.ids, D.d);
  };
  // Tijdens het slepen in 3D: de nieuwe plek als blauwe schim.
  const primsToon = useMemo(() => {
    if (!prims || !sleep?.drie) return prims;
    const schim = [];
    for (const id of sleep.ids) { const o = objMap.get(id); if (o) doos(schim, o.ring.map((q) => [q[0] + sleep.d[0], q[1] + sleep.d[1]]), 0.02, isLijn(o) ? 0.3 : 2.4, '#3B82F6', {}); }
    return [...prims, ...schim.map((x) => ({ ...x, op: 0.3, rand: 'vul' }))];
  }, [prims, sleep, objMap]);

  // Kleine verschuivingen met de pijltjes (ook als je naar de 3D kijkt): 10 cm, Shift = 1 m; Delete = weghalen.
  useEffect(() => {
    const toets = (e) => {
      if (!gekozen || !schrijven || /input|textarea|select/i.test(e.target?.tagName || '')) return;
      const st = e.shiftKey ? 1 : 0.1; const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
      if (d) { e.preventDefault(); verzet(leden(gekozen).map((x) => x.id), d); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onWeg([gekozen.id]); setSel(null); }
    };
    window.addEventListener('keydown', toets); return () => window.removeEventListener('keydown', toets);
  });
  const draaiMet = (graden) => { if (gekozen) verdraai(leden(gekozen).map((x) => x.id), gekozen.mid, -(graden * Math.PI) / 180); };

  // ---------- bibliotheek ----------
  const lijst = useMemo(() => {
    const act = elementen.filter((e) => e.actief !== false && !e.plan_id);
    const z = zoek.trim().toLowerCase(); const past = (e) => !z || `${e.naam} ${(e.eigenschappen?.tags || []).join(' ')}`.toLowerCase().includes(z);
    const per = {
      unit: act.filter((e) => isUnitEl(e) || isAutoEl(e)),
      tent: act.filter((e) => isTentBouw(e)),
      vloer: act.filter((e) => isVloerEl(e)),
      truss: act.filter((e) => e.categorie === 'Truss' && e.tekenwijze === 'lijn' && !/boog/i.test(e.naam)),
      overig: act.filter((e) => e.tekenwijze === 'schaal' && !isContainerDeel(e) && !isTentBouw(e) && !isVloerEl(e)),
    };
    return Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.filter(past).sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).slice(0, 120)]));
  }, [elementen, zoek]);
  const trussEl = useMemo(() => lijst.truss.find((e) => /zwart/i.test(e.naam) === trussMaat.zwart) || lijst.truss[0] || null, [lijst, trussMaat.zwart]);
  const plaatsOp = (p) => {
    const k = lijstSleep.current; lijstSleep.current = null; if (!k || !schrijven || !p) return;
    rekZone([p]);
    if (k.truss) {
      if (!trussEl) { setMelding('Geen truss in de bibliotheek.'); return; }
      const T = trussTypeVoor(trussEl); const { W, H } = trussMaat;
      const st = k.truss === 'portaal' ? portaal(W, H, 0, TRUSS_LENGTES, T.B) : k.truss === 'kubus' ? kubus(W, H, 0, TRUSS_LENGTES, T.B) : toren(H, 0, TRUSS_LENGTES, T.B);
      const xs = st.map((s) => s.a[0]); const ys = st.map((s) => s.a[1]);
      const o = [p[0] - (Math.min(...xs) + Math.max(...xs)) / 2, p[1] - (Math.min(...ys) + Math.max(...ys)) / 2]; // de vorm gecentreerd op de muis
      onPlaatsTruss(trussEl, naarTrussOpslag([[0, 0], [1, 0]], st), naarGeo(o));
      return;
    }
    onPlaats(k.el, naarGeo(p), 0);
  };
  const kaart = (e) => (
    <button key={e.id} type="button" draggable={schrijven} className="fm-cb-kaart" title={`${e.naam} · sleep op het plan of in de 3D`}
      onDragStart={(ev) => { lijstSleep.current = { el: e }; ev.dataTransfer.setData('text/fm-concept', e.id); ev.dataTransfer.effectAllowed = 'copy'; }}>
      <svg width="76" height="40" aria-hidden="true"><rect x="4" y="4" width="68" height="32" rx="3" fill={KLEUR_2D[tab]} stroke="#6B7280" /></svg>
      <b>{e.naam}</b>
      <small>{Number(e.breedte_m) ? `${Number(e.breedte_m).toLocaleString('nl-BE')} × ${Number(e.diepte_m).toLocaleString('nl-BE')} m` : ''}</small>
    </button>
  );

  const telling = useMemo(() => { const m = {}; for (const o of in3D) m[o.soort] = (m[o.soort] || 0) + 1; return m; }, [in3D]);
  const zoneRing = [[zone.x0, zone.y0], [zone.x1, zone.y0], [zone.x1, zone.y1], [zone.x0, zone.y1]];
  const plan2D = (
    <div className="fm-ws-zicht" style={{ position: 'relative', minWidth: 0 }} onDragOver={(e) => { if (schrijven) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); plaatsOp(naarW(e)); }}>
      <svg ref={svgRef} className="fm-cb-plan" width={maat.w} height={maat.h} onPointerDown={achtergrond} style={{ touchAction: 'none' }}>
        <path d={pad(zoneRing)} fill="#fff" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="8 5" pointerEvents="none" />
        {[...objs].sort((a, b) => LAAG[a.soort] - LAAG[b.soort] || a.v - b.v).map((o) => {
          const f = nu(o); const r = o.ring.map(f); const aan = o.id === sel; const mee = o.inZone && !uitgezet.has(o.id);
          const [tx, ty] = naarS(r.reduce((a, q) => [a[0] + q[0] / r.length, a[1] + q[1] / r.length], [0, 0]));
          const nd = o.soort === 'vloer' && Bv.s > 5 ? vloerNaden(o).naden.slice(0, 80) : [];
          const c = Math.cos(o.hoek || 0); const sn = Math.sin(o.hoek || 0); const W = (x, y) => f([o.mid[0] + (x - o.L / 2) * c - (y - o.B / 2) * sn, o.mid[1] + (x - o.L / 2) * sn + (y - o.B / 2) * c]);
          return (
            <g key={o.id} onPointerDown={(e) => omlaag(e, o)} style={{ cursor: schrijven ? 'move' : 'pointer' }} opacity={mee ? (o.v > 0 ? 0.8 : 1) : 0.3}>
              <path d={pad(r)} fill={isLijn(o) ? 'rgba(203,213,225,0.25)' : KLEUR_2D[o.soort]} stroke={aan ? '#2563EB' : isLijn(o) ? '#94A3B8' : '#374151'} strokeWidth={aan ? 2.5 : 1} strokeDasharray={o.soort === 'tent' || isLijn(o) ? '5 3' : undefined} />
              {nd.map(([x0, y0, x1, y1], k) => { const a = naarS(W(x0, y0)); const b = naarS(W(x1, y1)); return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#8B7355" strokeWidth={0.6} pointerEvents="none" />; })}
              {isLijn(o) && o.seg.map(([a0, b0, punt], k) => { const a = naarS(f(a0)); const b = naarS(f(b0)); return punt ? <rect key={k} x={a[0] - 3} y={a[1] - 3} width={6} height={6} fill="#475569" pointerEvents="none" /> : <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={o.soort === 'wand' ? '#1D4ED8' : '#475569'} strokeWidth={3} pointerEvents="none" />; })}
              {Bv.s > 6 && <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#1F2937" pointerEvents="none">{String(o.it.naam || o.el?.naam || '').slice(0, 28)}{o.v ? ` · V${o.v}` : ''}</text>}
            </g>
          );
        })}
        {/* Hoeken van de zone: slepen = de zone groter of kleiner maken. */}
        {[['x0', 'y0'], ['x1', 'y0'], ['x1', 'y1'], ['x0', 'y1']].map((h, k) => { const [x, y] = naarS([zone[h[0]], zone[h[1]]]); return <rect key={k} x={x - 6} y={y - 6} width={12} height={12} rx={2} fill="#2563EB" stroke="#fff" strokeWidth={1.5} style={{ cursor: k % 2 ? 'nesw-resize' : 'nwse-resize' }} onPointerDown={(e) => { e.stopPropagation(); setSleep({ soort: 'zone', hoek: h, z0: zone }); }} />; })}
        {(() => { const [x, y] = naarS([zone.x0, zone.y1]); return <text x={x + 4} y={y - 6} fontSize="11" fill="#2563EB" pointerEvents="none">Zone in 3D · {(zone.x1 - zone.x0).toLocaleString('nl-BE')} × {(zone.y1 - zone.y0).toLocaleString('nl-BE')} m</text>; })()}
        {schrijven && gekozen && (() => {
          const r = gekozen.ring.map(nu(gekozen)); const top = naarS([(r[2][0] + r[3][0]) / 2, (r[2][1] + r[3][1]) / 2]); const m = naarS(r.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]));
          const dx = top[0] - m[0]; const dy = top[1] - m[1]; const l = Math.hypot(dx, dy) || 1; const gx = top[0] + (dx / l) * 22; const gy = top[1] + (dy / l) * 22;
          return <g><line x1={top[0]} y1={top[1]} x2={gx} y2={gy} stroke="#2563EB" strokeDasharray="3 3" pointerEvents="none" /><circle cx={gx} cy={gy} r={7} fill="#fff" stroke="#2563EB" strokeWidth={2} style={{ cursor: 'grab' }} onPointerDown={(e) => draaiStart(e, gekozen)} /></g>;
        })()}
      </svg>
      {melding && <div className="fm-melding fout fm-cb-plan-melding">{melding}</div>}
      {schrijven && <div className="fm-ws-tip fm-sub" style={{ top: 'auto', bottom: 12 }}>Blauw kader = wat je in 3D ziet (sleep de hoeken) · sleep uit de lijst op het plan · slepen = verschuiven (kleeft, Alt = vrij) · bolletje = draaien (Shift = per 15°) · pijltjes = 10 cm · Delete = weghalen</div>}
    </div>
  );
  const drie = primsToon ? (
    <div className="fm-ws-zicht" style={{ position: 'relative', minWidth: 0 }}>
      <DrieGL prims={primsToon} gekozen={sel ? { unit: sel } : null} bevries={!!sleep?.drie} kies={(d) => setSel(d?.unit || null)} sleepVrij={schrijven ? sleep3D : null}
        dropVrij={schrijven ? (fase, grond) => { if (fase === 'los') plaatsOp(grond); } : null} />
      {!in3D.length && <div className="fm-sub" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>De zone is nog leeg: sleep iets uit de lijst.</div>}
    </div>
  ) : <div className="fm-ws-zicht fm-sub" style={{ padding: 20 }}>3D is niet beschikbaar in deze browser.</div>;
  const plaat = gekozen?.soort === 'vloer' ? [Math.max(0.1, Number(gekozen.el.breedte_m) || 1), Math.max(0.1, Number(gekozen.el.diepte_m) || 1)] : null;
  const zetMaat = (b, d) => onZet(gekozen.id, { midden: naarGeo(gekozen.mid), rot: -((gekozen.hoek * 180) / Math.PI), breedte: Math.max(plaat[0], b), diepte: Math.max(plaat[1], d) });

  return createPortal(
    <div className="fm fm-ws" role="dialog" aria-label="Conceptbouwer" {...schildProps}>
      <div className="fm-ws-kop">
        <TerugKnop onClick={onSluit} />
        <strong>Conceptbouwer</strong>
        <span className="fm-sub">{Object.keys(TEL_NAAM).filter((k) => telling[k]).map((k) => `${telling[k]} ${TEL_NAAM[k]}`).join(' · ') || 'Zone nog leeg'}</span>
        <div className="fm-segment" role="group" aria-label="Weergave">
          {[['plan', 'Plan'], ['beide', 'Plan + 3D'], ['3d', '3D']].map(([k, n]) => <button key={k} type="button" className={zicht === k ? 'aan' : ''} disabled={k !== 'plan' && !gl} onClick={() => setZicht(k)}>{n}</button>)}
        </div>
      </div>
      <div className="fm-ws-lijf">
        <aside className="fm-ws-doeken fm-cb-links">
          <div className="fm-segment" role="tablist" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            {TABS.map(([k, n]) => <button key={k} type="button" className={tab === k ? 'aan' : ''} onClick={() => setTab(k)}>{n}</button>)}
          </div>
          {tab === 'truss' ? (
            <div>
              <div className="fm-sub" style={{ margin: '4px 0 8px' }}>Kies de maat en sleep een vorm op het plan; doeken en details zet je in de trussbouwer.</div>
              <label className="fm-sub" style={{ display: 'block' }}>Breedte <input type="number" min="1" max="20" step="0.5" value={trussMaat.W} onChange={(e) => setTrussMaat({ ...trussMaat, W: Number(e.target.value) || 6 })} style={{ width: 60 }} /> m</label>
              <label className="fm-sub" style={{ display: 'block' }}>Hoogte <input type="number" min="1" max="10" step="0.5" value={trussMaat.H} onChange={(e) => setTrussMaat({ ...trussMaat, H: Number(e.target.value) || 4 })} style={{ width: 60 }} /> m</label>
              <label className="fm-sub" style={{ display: 'block', margin: '4px 0 8px' }}><input type="checkbox" checked={trussMaat.zwart} onChange={(e) => setTrussMaat({ ...trussMaat, zwart: e.target.checked })} /> Zwart gelakt</label>
              <div className="fm-cb-lijst">
                {[['portaal', 'Portaal', 'twee torens met een ligger'], ['kubus', 'Kubus', 'vier poten, liggers boven en onder'], ['toren', 'Toren', 'één toren']].map(([k, n, u]) => (
                  <button key={k} type="button" draggable={schrijven} className="fm-cb-kaart" title={`${n}: ${u} · sleep op het plan`} onDragStart={(ev) => { lijstSleep.current = { truss: k }; ev.dataTransfer.setData('text/fm-concept', k); ev.dataTransfer.effectAllowed = 'copy'; }}>
                    <svg width="76" height="40" aria-hidden="true"><rect x="4" y="4" width="68" height="32" rx="3" fill={KLEUR_2D.truss} stroke="#6B7280" /></svg>
                    <b>{n}</b><small>{k === 'toren' ? `${trussMaat.H} m hoog` : `${trussMaat.W} × ${trussMaat.H} m`}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <input className="fm-in" placeholder="Zoeken…" value={zoek} onChange={(e) => setZoek(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
              <div className="fm-cb-lijst">{lijst[tab].map(kaart)}</div>
              {!lijst[tab].length && <div className="fm-sub">Niets gevonden.</div>}
            </>
          )}
        </aside>
        {zicht === 'plan' ? plan2D : zicht === '3d' ? drie : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minWidth: 0, gap: 1, background: '#E5E7EB' }}>{plan2D}{drie}</div>}
        <aside className="fm-ws-rechts">
          {gekozen ? (
            <>
              <div className="fm-cb-gekozen"><div><b>{gekozen.it.naam || gekozen.el?.naam || 'Item'}</b><span className="fm-sub">{SOORT_NAAM[gekozen.soort]}{gekozen.v ? ` · verdieping ${gekozen.v}` : ''}{gekozen.it.groep_id && leden(gekozen).length > 1 ? ` · groep van ${leden(gekozen).length}` : ''}{gekozen.inZone ? '' : ' · buiten de zone'}</span></div></div>
              {gekozen.inZone && <label className="fm-check" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}><input type="checkbox" checked={!uitgezet.has(gekozen.id)} onChange={(e) => setUitgezet((u) => { const n = new Set(u); if (e.target.checked) n.delete(gekozen.id); else n.add(gekozen.id); return n; })} /> Tonen in 3D</label>}
              {schrijven && <>
                <div className="fm-cb-zijden" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <button type="button" className="fm-knop klein" onClick={() => draaiMet(-15)}>−15°</button>
                  <button type="button" className="fm-knop klein" onClick={() => draaiMet(90)}>90°</button>
                  <button type="button" className="fm-knop klein" onClick={() => draaiMet(15)}>+15°</button>
                </div>
                {plaat && <div style={{ margin: '8px 0' }}>
                  <div className="fm-kop">Vloer leggen</div>
                  <label className="fm-sub" style={{ display: 'block' }}>Lengte <input type="number" min={plaat[0]} step={plaat[0]} value={Math.round(gekozen.L * 100) / 100} onChange={(e) => zetMaat(Number(e.target.value) || plaat[0], gekozen.B)} style={{ width: 70 }} /> m</label>
                  <label className="fm-sub" style={{ display: 'block' }}>Breedte <input type="number" min={plaat[1]} step={plaat[1]} value={Math.round(gekozen.B * 100) / 100} onChange={(e) => zetMaat(gekozen.L, Number(e.target.value) || plaat[1])} style={{ width: 70 }} /> m</label>
                  <div className="fm-sub">{Math.round(gekozen.L / plaat[0])} × {Math.round(gekozen.B / plaat[1])} = {Math.round(gekozen.L / plaat[0]) * Math.round(gekozen.B / plaat[1])} platen van {plaat[0].toLocaleString('nl-BE')} × {plaat[1].toLocaleString('nl-BE')} m · {(gekozen.L * gekozen.B).toLocaleString('nl-BE', { maximumFractionDigits: 1 })} m²</div>
                </div>}
                {['unit', 'tent', 'truss', 'wand'].includes(gekozen.soort) && <button type="button" className="fm-knop zwart" style={{ width: '100%', margin: '8px 0' }} onClick={() => onBewerk(gekozen.id)}>
                  {gekozen.soort === 'unit' ? 'Stapelen, trappen, branding: containerbouwer' : gekozen.soort === 'tent' ? 'Wanden, doeken, vloer: tentbouwer' : gekozen.soort === 'wand' ? 'Frames en doeken: wandbouwer' : 'Stukken en doeken: trussbouwer'}
                </button>}
                <button type="button" className="fm-knop klein" style={{ width: '100%' }} onClick={() => { onWeg([gekozen.id]); setSel(null); }}>Weghalen</button>
              </>}
              <p className="fm-sub" style={{ marginTop: 10 }}>Het item staat gewoon op het plan. Verschuif met slepen (op het plan of in de 3D) of met de pijltjes.</p>
            </>
          ) : (
            <div className="fm-sub">
              <p><b>Conceptbouwer</b></p>
              <p>Het blauwe kader op het plan is de zone die je in 3D ziet. Sleep de hoeken om ze groter of kleiner te maken; wat erbuiten staat, is op het plan vaag en zit niet in de 3D.</p>
              <p>Sleep tenten, vloer, truss en containers uit de lijst op het plan of in de 3D.</p>
              <p>Klik een item aan om het te draaien, te verbergen in 3D, weg te halen of verder in te stellen in zijn eigen bouwer.</p>
            </div>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  );
}
