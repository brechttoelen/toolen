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

const DrieGL = dynamic(() => import('./TentDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });
const M_LAT = 110574; const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const KLEEF_PX = 12;
const TABS = [['unit', 'Containers'], ['tent', 'Tenten'], ['vloer', 'Vloer'], ['truss', 'Truss'], ['overig', 'Overig']];
const SOORT_NAAM = { unit: 'Container', tent: 'Tent', vloer: 'Vloer', truss: 'Truss', overig: 'Element' };
const KLEUR_2D = { unit: '#E5E7EB', tent: '#FDF2E9', vloer: '#D6C4A8', truss: '#CBD5E1', overig: '#EDE9FE' };

const isVloerEl = (el) => !!el?.eigenschappen?.vloer && el.tekenwijze === 'schaal';
export function soortVan(it, el) {
  if (!it) return null;
  if (isTrussBouw(it)) return 'truss';
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
// Doos (vlakken) op een omtrek: voor vloerdelen en elementen zonder eigen 3D-vorm.
function doos(prims, ring, z0, h, kl, data) {
  const z1 = z0 + h; const op = (q, z) => [q[0], q[1], z];
  prims.push({ k: 'vlak', w: ring.map((q) => op(q, z1)), vul: kl, op: 1, rand: 'vul', data });
  for (let i = 0; i < ring.length; i++) { const a = ring[i]; const b = ring[(i + 1) % ring.length]; prims.push({ k: 'vlak', w: [op(a, z0), op(b, z0), op(b, z1), op(a, z1)], vul: kl, op: 1, rand: '#6B7280', data }); }
}

export default function ConceptStudio({ midden, items, elementen, elementenMap, schrijven, onSluit, onPlaats, onPlaatsTruss, onZet, onWeg, onBewerk }) {
  useBouwerSchild();
  const C = midden; const ml = mLng(C[1]);
  const naarM = ([lng, lat]) => [(lng - C[0]) * ml, (lat - C[1]) * M_LAT];
  const naarGeo = ([x, y]) => [C[0] + x / ml, C[1] + y / M_LAT];
  const [straal, setStraal] = useState(40);
  const [zicht, setZicht] = useState('beide');
  const [tab, setTab] = useState('tent');
  const [sel, setSel] = useState(null);
  const [zoek, setZoek] = useState('');
  const [melding, setMelding] = useState('');
  useEffect(() => { if (!melding) return undefined; const t = setTimeout(() => setMelding(''), 4000); return () => clearTimeout(t); }, [melding]);
  const [gl, setGl] = useState(false); useEffect(() => { setGl(webglKan()); }, []);
  const [trussMaat, setTrussMaat] = useState({ W: 6, H: 4, zwart: false });
  const lijstSleep = useRef(null);

  // Objecten in de zone, met hun omtrek in meter (oost, noord) rond het midden van de zone.
  const objs = useMemo(() => {
    const uit = [];
    for (const it of items) {
      if (!it || it.verborgen) continue;
      const el = elementenMap.get(it.element_id); const soort = soortVan(it, el); if (!soort) continue;
      if (soort === 'truss') {
        const c = it.geometrie?.coordinates; if (!c?.length) continue;
        const o = naarM(c[0]); if (Math.hypot(o[0], o[1]) > straal + 30) continue;
        const st = trussStukken(wandPunten(it), it); if (!st.length) continue;
        const xs = st.flatMap((s) => [s.a[0], s.e[0]]).map((x) => x + o[0]); const ys = st.flatMap((s) => [s.a[1], s.e[1]]).map((y) => y + o[1]);
        const r = [[Math.min(...xs) - 0.2, Math.min(...ys) - 0.2], [Math.max(...xs) + 0.2, Math.min(...ys) - 0.2], [Math.max(...xs) + 0.2, Math.max(...ys) + 0.2], [Math.min(...xs) - 0.2, Math.max(...ys) + 0.2]];
        uit.push({ id: it.id, it, el, soort, ring: r, mid: [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[2][1]) / 2], st, o, v: 0 });
        continue;
      }
      const p = it.parameters; const mid = naarM(p.midden); if (Math.hypot(mid[0], mid[1]) > straal) continue;
      const L = Number(p.breedte) || Number(el.breedte_m) || 1; const B = Number(p.diepte) || Number(el.diepte_m) || 1; const hoek = -((Number(p.rot) || 0) * Math.PI) / 180;
      uit.push({ id: it.id, it, el, soort, ring: rondom(mid, L, B, hoek), mid, L, B, hoek, v: Number(it.velden?.verdieping) || 0 });
    }
    return uit;
  }, [items, elementenMap, straal, C[0], C[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const objMap = useMemo(() => new Map(objs.map((o) => [o.id, o])), [objs]);
  const gekozen = sel ? objMap.get(sel) : null;

  // ---------- 3D: alles samen in één scène ----------
  const doeken = useMemo(() => [...elementenMap.values()].filter((x) => x.tekenwijze === 'doek'), [elementenMap]);
  const doekMap = useMemo(() => new Map(doeken.map((d) => [d.id, d])), [doeken]);
  const zoneItems = useMemo(() => objs.map((o) => o.it), [objs]);
  const prims = useMemo(() => {
    if (!gl) return null;
    const uit = []; const klaar = new Set();
    for (const o of objs) {
      if (klaar.has(o.id)) continue;
      try {
        if (o.soort === 'unit') {
          const groep = unitGroep(o.it, o.el, zoneItems, elementenMap, { midden: C, rot: 0, breedte: 2, diepte: 2 });
          for (const g of groep) klaar.add(g.it.id);
          uit.push(...zetPrims(containerPrims(groep, sel), ([x, y, z]) => [x - 1, y - 1, z]));
        } else if (o.soort === 'tent') {
          const groep = tentGroep(o.it, o.el, zoneItems, elementenMap);
          for (const g of groep) klaar.add(g.it.id);
          const A = tentAssen(o.it, o.el); if (!A) continue;
          const pr = tentTeken({ it: o.it, el: o.el, groep, items: zoneItems, doekMap, vloer: !!o.it.velden?.vloer }).prims;
          uit.push(...zetPrims(pr, ([x, y, z]) => { const [e, n] = naarM(A.naarGeo([x, y])); return [e, n, z || 0]; }));
        } else if (o.soort === 'truss') {
          klaar.add(o.id); zetTrussType(trussTypeVoor(o.el, o.it.velden?.truss));
          const pr = trussPrims(o.st, o.it.velden?.truss?.doeken || [], doekMap, /zwart/i.test(o.el?.naam || ''));
          uit.push(...zetPrims(pr, ([x, y, z]) => [x + o.o[0], y + o.o[1], z || 0]));
        } else if (o.soort === 'vloer') {
          klaar.add(o.id); doos(uit, o.ring, 0, Math.max(0.04, Number(o.el.hoogte_m) || 0.06), o.id === sel ? '#93C5FD' : stukKleur(o.el) || '#B08968', { unit: o.id });
        } else {
          klaar.add(o.id); doos(uit, o.ring, 0, Math.max(0.3, Number(o.el.hoogte_m) || 1), o.id === sel ? '#93C5FD' : '#C4B5FD', { unit: o.id });
        }
      } catch { /* één item dat niet lukt, mag de rest niet tegenhouden */ }
    }
    return uit;
  }, [gl, objs, zoneItems, elementenMap, doekMap, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- 2D ----------
  const svgRef = useRef(null); const [maat, setMaat] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = svgRef.current?.parentElement; if (!el) return undefined;
    const ro = new ResizeObserver(() => setMaat({ w: el.clientWidth || 800, h: el.clientHeight || 600 })); ro.observe(el);
    return () => ro.disconnect();
  }, [zicht]);
  const [beeld, setBeeld] = useState(null);
  useEffect(() => { if (!beeld && maat.w) setBeeld({ cx: 0, cy: 0, s: Math.min(maat.w, maat.h) / (2 * straal + 10) }); }, [maat.w, maat.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const Bv = beeld || { cx: 0, cy: 0, s: 8 };
  const naarS = ([x, y]) => [(x - Bv.cx) * Bv.s + maat.w / 2, (Bv.cy - y) * Bv.s + maat.h / 2];
  const naarW = (e) => { const r = svgRef.current.getBoundingClientRect(); return [Bv.cx + (e.clientX - r.left - maat.w / 2) / Bv.s, Bv.cy - (e.clientY - r.top - maat.h / 2) / Bv.s]; };
  const pad = (ring) => `M${ring.map((q) => naarS(q).join(',')).join('L')}Z`;

  // Wat samen beweegt: dezelfde groep op het plan (bv. een containeropstelling of gekoppelde tenten).
  const leden = (o) => (o.it.groep_id ? objs.filter((x) => x.it.groep_id === o.it.groep_id) : [o]);
  const kleef = (ringen, weg) => {
    const tol = KLEEF_PX / Bv.s; let best = null;
    for (const u of objs) {
      if (weg.has(u.id)) continue;
      for (const ring of ringen) for (const c of ring) {
        for (const h of u.ring) { const d = Math.hypot(h[0] - c[0], h[1] - c[1]); if (d < tol && (!best || d - tol * 0.5 < best.d)) best = { d: d - tol * 0.5, dx: h[0] - c[0], dy: h[1] - c[1] }; }
        for (let k = 0; k < u.ring.length; k++) { const q = opSeg(c, u.ring[k], u.ring[(k + 1) % u.ring.length]); const d = Math.hypot(q[0] - c[0], q[1] - c[1]); if (d < tol && (!best || d < best.d)) best = { d, dx: q[0] - c[0], dy: q[1] - c[1] }; }
      }
    }
    return best ? [best.dx, best.dy] : [0, 0];
  };

  const [sleep, setSleep] = useState(null); const sleepRef = useRef(null); sleepRef.current = sleep;
  const omlaag = (e, o) => {
    if (e.button !== 0) return; e.stopPropagation(); setSel(o.id);
    if (!schrijven) return;
    const grp = leden(o);
    setSleep({ soort: 'verplaats', ids: grp.map((x) => x.id), p0: naarW(e), d: [0, 0] });
  };
  const draaiStart = (e, o) => {
    e.stopPropagation(); if (!schrijven) return;
    const grp = leden(o).filter((x) => x.soort !== 'truss'); const c = o.mid;
    setSleep({ soort: 'draai', ids: grp.map((x) => x.id), c, a0: Math.atan2(naarW(e)[1] - c[1], naarW(e)[0] - c[0]), da: 0 });
  };
  const achtergrond = (e) => { if (e.button !== 0) return; setSel(null); setSleep({ soort: 'pan', x0: e.clientX, y0: e.clientY, c0: [Bv.cx, Bv.cy] }); };
  useEffect(() => {
    if (!sleep) return undefined;
    const beweeg = (e) => {
      const s = sleepRef.current; if (!s) return;
      if (s.soort === 'pan') { setBeeld({ ...Bv, cx: s.c0[0] - (e.clientX - s.x0) / Bv.s, cy: s.c0[1] + (e.clientY - s.y0) / Bv.s }); return; }
      const p = naarW(e);
      if (s.soort === 'verplaats') {
        let d = [p[0] - s.p0[0], p[1] - s.p0[1]];
        if (!e.altKey) { const weg = new Set(s.ids); const [kx, ky] = kleef(s.ids.map((id) => objMap.get(id).ring.map((q) => [q[0] + d[0], q[1] + d[1]])), weg); d = [d[0] + kx, d[1] + ky]; }
        setSleep({ ...s, d });
      } else if (s.soort === 'draai') {
        let da = Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.a0; if (e.shiftKey) da = Math.round(da / (Math.PI / 12)) * (Math.PI / 12);
        setSleep({ ...s, da });
      }
    };
    const los = () => {
      const s = sleepRef.current; setSleep(null); if (!s) return;
      if (s.soort === 'verplaats' && Math.hypot(s.d[0], s.d[1]) > 0.01) {
        for (const id of s.ids) { const o = objMap.get(id); if (o.soort === 'truss') onZet(id, { verschuif: [s.d[0], s.d[1]] }); else onZet(id, { midden: naarGeo([o.mid[0] + s.d[0], o.mid[1] + s.d[1]]), rot: -((o.hoek * 180) / Math.PI) }); }
      }
      if (s.soort === 'draai' && Math.abs(s.da) > 0.001) {
        for (const id of s.ids) { const o = objMap.get(id); const m = draai(o.mid, s.c, s.da); onZet(id, { midden: naarGeo(m), rot: Math.round(-(((o.hoek + s.da) * 180) / Math.PI) * 10) / 10 }); }
      }
    };
    window.addEventListener('pointermove', beweeg); window.addEventListener('pointerup', los);
    return () => { window.removeEventListener('pointermove', beweeg); window.removeEventListener('pointerup', los); };
  });
  const wiel = (e) => { const p = naarW(e); const f = Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0015); const s = Math.max(1, Math.min(200, Bv.s * f)); setBeeld({ s, cx: p[0] - (p[0] - Bv.cx) * (Bv.s / s), cy: p[1] - (p[1] - Bv.cy) * (Bv.s / s) }); };
  useEffect(() => { const el = svgRef.current; if (!el) return undefined; const h = (e) => { e.preventDefault(); wiel(e); }; el.addEventListener('wheel', h, { passive: false }); return () => el.removeEventListener('wheel', h); });
  // Omtrek zoals hij nu getekend wordt (tijdens slepen of draaien).
  const ringNu = (o) => {
    const s = sleep; if (!s || !s.ids?.includes(o.id)) return o.ring;
    if (s.soort === 'verplaats') return o.ring.map((q) => [q[0] + s.d[0], q[1] + s.d[1]]);
    if (s.soort === 'draai') return o.ring.map((q) => draai(q, s.c, s.da));
    return o.ring;
  };

  // Kleine verschuivingen met de pijltjes (ook als je naar de 3D kijkt): 10 cm, Shift = 1 m; Delete = weghalen.
  useEffect(() => {
    const toets = (e) => {
      if (!gekozen || !schrijven || /input|textarea|select/i.test(e.target?.tagName || '')) return;
      const st = e.shiftKey ? 1 : 0.1; const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
      if (d) { e.preventDefault(); for (const o of leden(gekozen)) { if (o.soort === 'truss') onZet(o.id, { verschuif: d }); else onZet(o.id, { midden: naarGeo([o.mid[0] + d[0], o.mid[1] + d[1]]), rot: -((o.hoek * 180) / Math.PI) }); } }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onWeg([gekozen.id]); setSel(null); }
    };
    window.addEventListener('keydown', toets); return () => window.removeEventListener('keydown', toets);
  });
  const draaiMet = (graden) => { if (!gekozen) return; const da = -(graden * Math.PI) / 180; for (const o of leden(gekozen).filter((x) => x.soort !== 'truss')) { const m = draai(o.mid, gekozen.mid, da); onZet(o.id, { midden: naarGeo(m), rot: Math.round(-(((o.hoek + da) * 180) / Math.PI) * 10) / 10 }); } };

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
  const neerzetten = (e) => {
    e.preventDefault(); const k = lijstSleep.current; lijstSleep.current = null; if (!k || !schrijven) return;
    const p = naarW(e);
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
    <button key={e.id} type="button" draggable={schrijven} className="fm-cb-kaart" title={`${e.naam} · sleep op het plan`}
      onDragStart={(ev) => { lijstSleep.current = { el: e }; ev.dataTransfer.setData('text/fm-concept', e.id); ev.dataTransfer.effectAllowed = 'copy'; }}>
      <svg width="76" height="40" aria-hidden="true"><rect x="4" y="4" width="68" height="32" rx="3" fill={KLEUR_2D[tab]} stroke="#6B7280" /></svg>
      <b>{e.naam}</b>
      <small>{Number(e.breedte_m) ? `${Number(e.breedte_m).toLocaleString('nl-BE')} × ${Number(e.diepte_m).toLocaleString('nl-BE')} m` : ''}</small>
    </button>
  );

  const telling = useMemo(() => { const m = {}; for (const o of objs) m[o.soort] = (m[o.soort] || 0) + 1; return m; }, [objs]);
  const plan2D = (
    <div className="fm-ws-zicht" style={{ position: 'relative', minWidth: 0 }} onDragOver={(e) => { if (schrijven) e.preventDefault(); }} onDrop={neerzetten}>
      <svg ref={svgRef} className="fm-cb-plan" width={maat.w} height={maat.h} onPointerDown={achtergrond} style={{ touchAction: 'none' }}>
        <circle cx={naarS([0, 0])[0]} cy={naarS([0, 0])[1]} r={straal * Bv.s} fill="none" stroke="#CBD5E1" strokeDasharray="6 6" />
        {[...objs].sort((a, b) => ({ vloer: 0, tent: 1, overig: 2, unit: 3, truss: 4 }[a.soort] - { vloer: 0, tent: 1, overig: 2, unit: 3, truss: 4 }[b.soort]) || a.v - b.v).map((o) => {
          const r = ringNu(o); const aan = o.id === sel; const [tx, ty] = naarS(r.reduce((a, q) => [a[0] + q[0] / r.length, a[1] + q[1] / r.length], [0, 0]));
          return (
            <g key={o.id} onPointerDown={(e) => omlaag(e, o)} style={{ cursor: schrijven ? 'move' : 'pointer' }} opacity={o.v > 0 ? 0.75 : 1}>
              <path d={pad(r)} fill={KLEUR_2D[o.soort]} stroke={aan ? '#2563EB' : '#374151'} strokeWidth={aan ? 2.5 : 1} strokeDasharray={o.soort === 'tent' ? '5 3' : undefined} />
              {o.soort === 'truss' && o.st.filter((s) => !s.op).map((s, k) => { const a = naarS([s.a[0] + o.o[0] + (sleep?.ids?.includes(o.id) && sleep.soort === 'verplaats' ? sleep.d[0] : 0), s.a[1] + o.o[1] + (sleep?.ids?.includes(o.id) && sleep.soort === 'verplaats' ? sleep.d[1] : 0)]); const b = naarS([s.e[0] + o.o[0] + (sleep?.ids?.includes(o.id) && sleep.soort === 'verplaats' ? sleep.d[0] : 0), s.e[1] + o.o[1] + (sleep?.ids?.includes(o.id) && sleep.soort === 'verplaats' ? sleep.d[1] : 0)]); return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#475569" strokeWidth={3} pointerEvents="none" />; })}
              {Bv.s > 6 && <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#1F2937" pointerEvents="none">{String(o.it.naam || o.el?.naam || '').slice(0, 28)}{o.v ? ` · V${o.v}` : ''}</text>}
            </g>
          );
        })}
        {schrijven && gekozen && gekozen.soort !== 'truss' && (() => {
          const r = ringNu(gekozen); const top = naarS([(r[2][0] + r[3][0]) / 2, (r[2][1] + r[3][1]) / 2]); const m = naarS(r.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]));
          const dx = top[0] - m[0]; const dy = top[1] - m[1]; const l = Math.hypot(dx, dy) || 1; const gx = top[0] + (dx / l) * 22; const gy = top[1] + (dy / l) * 22;
          return <g><line x1={top[0]} y1={top[1]} x2={gx} y2={gy} stroke="#2563EB" strokeDasharray="3 3" pointerEvents="none" /><circle cx={gx} cy={gy} r={7} fill="#fff" stroke="#2563EB" strokeWidth={2} style={{ cursor: 'grab' }} onPointerDown={(e) => draaiStart(e, gekozen)} /></g>;
        })()}
      </svg>
      {melding && <div className="fm-melding fout fm-cb-plan-melding">{melding}</div>}
      {schrijven && <div className="fm-ws-tip fm-sub" style={{ top: 'auto', bottom: 12 }}>Sleep uit de lijst op het plan · slepen = verschuiven (kleeft, Alt = vrij) · bolletje = draaien (Shift = per 15°) · pijltjes = 10 cm (Shift = 1 m) · Delete = weghalen · scrollen = zoomen</div>}
    </div>
  );
  const drie = prims ? <div className="fm-ws-zicht" style={{ position: 'relative', minWidth: 0 }}><DrieGL prims={prims} kies={(d) => { if (d?.unit) setSel(d.unit); }} /></div> : <div className="fm-ws-zicht fm-sub" style={{ padding: 20 }}>3D is niet beschikbaar in deze browser.</div>;

  return createPortal(
    <div className="fm fm-ws" role="dialog" aria-label="Conceptbouwer" {...schildProps}>
      <div className="fm-ws-kop">
        <TerugKnop onClick={onSluit} />
        <strong>Conceptbouwer</strong>
        <span className="fm-sub">{TABS.filter(([k]) => telling[k]).map(([k, n]) => `${telling[k]} ${n.toLowerCase()}`).join(' · ') || 'Nog leeg: sleep iets uit de lijst'}</span>
        <div className="fm-segment" role="group" aria-label="Weergave">
          {[['plan', 'Plan'], ['beide', 'Plan + 3D'], ['3d', '3D']].map(([k, n]) => <button key={k} type="button" className={zicht === k ? 'aan' : ''} disabled={k !== 'plan' && !gl} onClick={() => setZicht(k)}>{n}</button>)}
        </div>
        <label className="fm-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Zone <input type="range" min="15" max="150" step="5" value={straal} onChange={(e) => setStraal(Number(e.target.value))} /> {straal} m</label>
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
              <div className="fm-cb-gekozen"><div><b>{gekozen.it.naam || gekozen.el?.naam || 'Item'}</b><span className="fm-sub">{SOORT_NAAM[gekozen.soort]}{gekozen.v ? ` · verdieping ${gekozen.v}` : ''}{gekozen.it.groep_id && leden(gekozen).length > 1 ? ` · groep van ${leden(gekozen).length}` : ''}</span></div></div>
              {schrijven && <>
                {gekozen.soort !== 'truss' && <div className="fm-cb-zijden" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <button type="button" className="fm-knop klein" onClick={() => draaiMet(-15)}>−15°</button>
                  <button type="button" className="fm-knop klein" onClick={() => draaiMet(90)}>90°</button>
                  <button type="button" className="fm-knop klein" onClick={() => draaiMet(15)}>+15°</button>
                </div>}
                {['unit', 'tent', 'truss'].includes(gekozen.soort) && <button type="button" className="fm-knop zwart" style={{ width: '100%', margin: '8px 0' }} onClick={() => onBewerk(gekozen.id)}>
                  {gekozen.soort === 'unit' ? 'Stapelen, trappen, terras: containerbouwer' : gekozen.soort === 'tent' ? 'Wanden, doeken, vloer: tentbouwer' : 'Stukken en doeken: trussbouwer'}
                </button>}
                <button type="button" className="fm-knop klein" style={{ width: '100%' }} onClick={() => { onWeg([gekozen.id]); setSel(null); }}>Weghalen</button>
              </>}
              <p className="fm-sub" style={{ marginTop: 10 }}>Het item staat gewoon op het plan. Verschuif met slepen of de pijltjes, ook terwijl je naar de 3D kijkt.</p>
            </>
          ) : (
            <div className="fm-sub">
              <p><b>Conceptbouwer</b></p>
              <p>Sleep tenten, vloer, truss en containers uit de lijst op het plan. Je ziet alles samen in 3D.</p>
              <p>Klik een item aan om het te draaien, weg te halen of verder in te stellen in zijn eigen bouwer (stapelen en terrassen in de containerbouwer, doeken in de trussbouwer).</p>
              <p>De zone toont alles binnen {straal} m rond het punt waar je klikte.</p>
            </div>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  );
}
