'use client';

// Tekenscherm: een groep items precies op een raster in meter tekenen (zoals de
// elementeditor), met lijnen, vormen, tekst en bestaande elementen uit de bibliotheek.
// Bij Klaar komt alles als groep terug op de kaart (zelfde plek en draaiing bij een
// bestaande groep). Werkt in het sjabloonformaat: coördinaten in meter t.o.v. het midden
// (x = oost, y = noord), draaiing met de klok mee.
import { useEffect, useMemo, useRef, useState } from 'react';
import { metTekening } from './tekeningen';

const TOOLS = [
  ['selecteer', 'Selectie', 'V'],
  ['lijn', 'Lijn', 'L'],
  ['rechthoek', 'Rechthoek', 'R'],
  ['cirkel', 'Cirkel', 'C'],
  ['tekst', 'Tekst', 'T'],
  ['element', 'Element', 'E'],
];
const UITLEG = {
  selecteer: 'Klik een onderdeel · Shift-klik voor meer · sleep om te verschuiven · Q/W draaien 90° · pijltjes schuiven · Delete wist · Ctrl D kopie · sleep leeg vlak om te schuiven, scroll om te zoomen',
  lijn: 'Klik de punten (rastersprong) · dubbelklik of Enter om af te sluiten · Esc annuleert',
  rechthoek: 'Sleep een rechthoek · maten pas je rechts exact aan',
  cirkel: 'Sleep vanuit het midden',
  tekst: 'Klik waar de tekst moet komen',
  element: 'Kies rechts een element en klik waar het moet komen · Q/W draait vóór het plaatsen',
};
const r3 = (v) => Math.round(v * 1000) / 1000;
const getal = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('nl-BE');
const naarGetal = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const nid = () => Math.random().toString(36).slice(2, 10);
// Draaien met de klok mee (graden) rond c, in een assenstelsel met y naar het noorden.
const draai = ([x, y], g, [cx, cy] = [0, 0]) => {
  const a = (g * Math.PI) / 180; const dx = x - cx; const dy = y - cy;
  return [cx + dx * Math.cos(a) + dy * Math.sin(a), cy - dx * Math.sin(a) + dy * Math.cos(a)];
};
const rechthoek = ([mx, my], b, d, rot) => {
  const r = [[-b / 2, -d / 2], [b / 2, -d / 2], [b / 2, d / 2], [-b / 2, d / 2]].map((p) => draai(p, rot)).map(([x, y]) => [r3(mx + x), r3(my + y)]);
  return [...r, r[0]];
};
const cirkelRing = ([mx, my], s) => { const r = []; for (let i = 0; i <= 48; i++) { const a = (2 * Math.PI * i) / 48; r.push([r3(mx + s * Math.cos(a)), r3(my + s * Math.sin(a))]); } return r; };
const punten = (g) => (!g ? [] : g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates[0]);
const mapG = (g, f) => (g.type === 'Point' ? { type: 'Point', coordinates: f(g.coordinates) } : g.type === 'LineString' ? { type: 'LineString', coordinates: g.coordinates.map(f) } : { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(f)) });
const kaderVan = (lijst) => {
  let k = null;
  for (const o of lijst) for (const [x, y] of punten(o.geometrie)) k = k ? [Math.min(k[0], x), Math.min(k[1], y), Math.max(k[2], x), Math.max(k[3], y)] : [x, y, x, y];
  return k;
};
// Onderdeel herberekenen na een wijziging van midden, maat of draaiing.
function herbereken(o) {
  const p = o.parameters || {};
  if ((o.soort === 'element' || o.soort === 'rechthoek') && p.midden && p.breedte && p.diepte && o.geometrie?.type === 'Polygon') return { ...o, geometrie: { type: 'Polygon', coordinates: [rechthoek(p.midden, p.breedte, p.diepte, Number(p.rot) || 0)] } };
  if (o.soort === 'cirkel' && p.midden && p.straal) return { ...o, geometrie: { type: 'Polygon', coordinates: [cirkelRing(p.midden, p.straal)] } };
  return o;
}
function verschoven(o, dx, dy) {
  const p = o.parameters || {};
  return { ...o, geometrie: mapG(o.geometrie, ([x, y]) => [r3(x + dx), r3(y + dy)]), parameters: p.midden ? { ...p, midden: [r3(p.midden[0] + dx), r3(p.midden[1] + dy)] } : p };
}
function gedraaid(o, g, c) {
  const p = o.parameters || {};
  const n = { ...o, geometrie: mapG(o.geometrie, (q) => draai(q, g, c).map(r3)), parameters: { ...p } };
  if (p.midden) n.parameters.midden = draai(p.midden, g, c).map(r3);
  if (o.soort === 'element' || o.soort === 'rechthoek' || p.rot != null) n.parameters.rot = ((((Number(p.rot) || 0) + g) % 360) + 360) % 360;
  return herbereken(n);
}

export default function Tekenscherm({ start, elementen, elementenMap, onKlaar, onSluit }) {
  const [delen, setDelen] = useState(() => (start?.items || []).map((o) => ({ ...o, _id: nid() })));
  const [gereedschap, setGereedschap] = useState('selecteer');
  const [sel, setSel] = useState([]);
  const [raster, setRaster] = useState(0.5);
  const [zoek, setZoek] = useState('');
  const [kiesEl, setKiesEl] = useState(null);
  const [elRot, setElRot] = useState(0);
  const [bezig, setBezig] = useState(null); // tekenen: { soort, a, b, pts }
  const [muis, setMuis] = useState(null);
  const svgRef = useRef(null);
  const [maat, setMaat] = useState({ w: 800, h: 600 });
  const [beeld, setBeeld] = useState({ cx: 0, cy: 0, s: 40 }); // s = px per meter
  const sleep = useRef(null);
  const geschiedenis = useRef([]);

  const wijzig = (fn) => setDelen((d) => { geschiedenis.current.push(d); if (geschiedenis.current.length > 100) geschiedenis.current.shift(); return fn(d); });
  const terug = () => { const v = geschiedenis.current.pop(); if (v) { setDelen(v); setSel([]); } };

  useEffect(() => {
    const el = svgRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setMaat({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setMaat({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  // Beginbeeld: alles passend, of 20 × 15 m rond het midden.
  const passend = () => {
    const k = kaderVan(delen) || [-10, -7.5, 10, 7.5];
    const b = Math.max(4, k[2] - k[0]) * 1.25; const h = Math.max(3, k[3] - k[1]) * 1.25;
    setBeeld({ cx: (k[0] + k[2]) / 2, cy: (k[1] + k[3]) / 2, s: Math.min(maat.w / b, maat.h / h) });
  };
  useEffect(() => { passend(); }, [maat.w > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const naarScherm = ([x, y]) => [(x - beeld.cx) * beeld.s + maat.w / 2, (beeld.cy - y) * beeld.s + maat.h / 2];
  const naarWereld = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return [beeld.cx + (e.clientX - r.left - maat.w / 2) / beeld.s, beeld.cy - (e.clientY - r.top - maat.h / 2) / beeld.s];
  };
  const snap = ([x, y]) => (raster ? [r3(Math.round(x / raster) * raster), r3(Math.round(y / raster) * raster)] : [r3(x), r3(y)]);

  const elementenLijst = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return elementen.filter((e) => e.actief !== false && ['schaal', 'lijn'].includes(e.tekenwijze) && (!z || `${e.naam} ${e.categorie || ''}`.toLowerCase().includes(z))).slice(0, 60);
  }, [elementen, zoek]);

  const raak = (w) => {
    // Bovenste onderdeel onder de muis: punten/teksten, dan lijnen, dan het kleinste vlak.
    const tol = 8 / beeld.s; let beste = null;
    for (const o of delen) {
      const g = o.geometrie; let d = Infinity; let rang = 2;
      if (g.type === 'Point') { d = Math.hypot(g.coordinates[0] - w[0], g.coordinates[1] - w[1]); rang = 0; }
      else {
        const c = punten(g);
        for (let i = 0; i < c.length - 1; i++) {
          const [ax, ay] = c[i]; const [bx, by] = c[i + 1]; const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((w[0] - ax) * dx + (w[1] - ay) * dy) / l2));
          d = Math.min(d, Math.hypot(ax + t * dx - w[0], ay + t * dy - w[1]));
        }
        if (g.type === 'LineString') rang = 1;
        else {
          let binnen = false;
          for (let i = 0, j = c.length - 1; i < c.length; j = i++) { const [xi, yi] = c[i]; const [xj, yj] = c[j]; if ((yi > w[1]) !== (yj > w[1]) && w[0] < ((xj - xi) * (w[1] - yi)) / (yj - yi) + xi) binnen = !binnen; }
          if (binnen) d = 0;
        }
      }
      if (d > tol) continue;
      const k = kaderVan([o]); const opp = (k[2] - k[0]) * (k[3] - k[1]);
      if (!beste || rang < beste.rang || (rang === beste.rang && opp < beste.opp)) beste = { o, rang, opp };
    }
    return beste?.o || null;
  };

  const nieuwElement = (el, m) => {
    if (el.tekenwijze === 'lijn') return null;
    const b = Number(el.breedte_m) || 1; const d = Number(el.diepte_m) || 1;
    return { _id: nid(), soort: 'element', element_id: el.id, naam: null, laag: null, parameters: { midden: m, breedte: b, diepte: d, rot: elRot }, geometrie: { type: 'Polygon', coordinates: [rechthoek(m, b, d, elRot)] } };
  };

  const omlaag = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey && gereedschap !== 'selecteer')) { sleep.current = { pan: true, x: e.clientX, y: e.clientY, b: beeld }; return; }
    if (e.button !== 0) return;
    const w = naarWereld(e); const p = snap(w);
    if (gereedschap === 'selecteer') {
      const o = raak(w);
      if (!o) { if (!e.shiftKey) setSel([]); sleep.current = { pan: true, x: e.clientX, y: e.clientY, b: beeld }; return; }
      const ids = e.shiftKey ? (sel.includes(o._id) ? sel.filter((x) => x !== o._id) : [...sel, o._id]) : (sel.includes(o._id) ? sel : [o._id]);
      setSel(ids);
      sleep.current = { ids, van: p, orig: delen, alt: e.altKey, bewogen: false };
      return;
    }
    if (gereedschap === 'rechthoek' || gereedschap === 'cirkel') { setBezig({ soort: gereedschap, a: p, b: p }); return; }
    if (gereedschap === 'lijn' || (gereedschap === 'element' && kiesEl?.tekenwijze === 'lijn')) {
      if (e.detail >= 2) { rondLijnAf(); return; }
      setBezig((b) => (b?.soort === 'lijn' ? { ...b, pts: [...b.pts, p] } : { soort: 'lijn', pts: [p], el: gereedschap === 'element' ? kiesEl : null }));
      return;
    }
    if (gereedschap === 'tekst') {
      const t = window.prompt('Tekst', 'Tekst');
      if (t) wijzig((d) => [...d, { _id: nid(), soort: 'tekst', naam: t, laag: null, parameters: {}, geometrie: { type: 'Point', coordinates: p } }]);
      return;
    }
    if (gereedschap === 'element' && kiesEl) {
      const o = nieuwElement(kiesEl, p);
      if (o) { wijzig((d) => [...d, o]); setSel([o._id]); }
    }
  };
  const beweeg = (e) => {
    const w = naarWereld(e); const p = snap(w); setMuis(p);
    const s = sleep.current;
    if (s?.pan) { setBeeld({ ...s.b, cx: s.b.cx - (e.clientX - s.x) / s.b.s, cy: s.b.cy + (e.clientY - s.y) / s.b.s }); return; }
    if (s?.ids) {
      const dx = p[0] - s.van[0]; const dy = p[1] - s.van[1];
      if (!s.bewogen && !dx && !dy) return;
      if (!s.bewogen) { geschiedenis.current.push(s.orig); s.bewogen = true; }
      setDelen(() => {
        const basis = s.orig.map((o) => (s.ids.includes(o._id) ? verschoven(o, dx, dy) : o));
        return s.alt ? [...s.orig, ...s.orig.filter((o) => s.ids.includes(o._id)).map((o) => ({ ...verschoven(o, dx, dy), _id: `${o._id}k` }))] : basis;
      });
      return;
    }
    if (bezig?.soort === 'rechthoek' || bezig?.soort === 'cirkel') setBezig({ ...bezig, b: p });
  };
  const omhoog = () => {
    const s = sleep.current; sleep.current = null;
    if (s?.alt && s.bewogen) setDelen((d) => d.map((o) => (o._id.endsWith('k') ? { ...o, _id: nid() } : o)));
    if (bezig?.soort === 'rechthoek') {
      const [x0, y0] = bezig.a; const [x1, y1] = bezig.b; const b = Math.abs(x1 - x0); const d = Math.abs(y1 - y0);
      if (b > 0.01 && d > 0.01) { const m = [r3((x0 + x1) / 2), r3((y0 + y1) / 2)]; const o = { _id: nid(), soort: 'rechthoek', laag: null, parameters: { midden: m, breedte: r3(b), diepte: r3(d), rot: 0 }, geometrie: { type: 'Polygon', coordinates: [rechthoek(m, b, d, 0)] } }; wijzig((l) => [...l, o]); setSel([o._id]); }
      setBezig(null);
    } else if (bezig?.soort === 'cirkel') {
      const s2 = Math.hypot(bezig.b[0] - bezig.a[0], bezig.b[1] - bezig.a[1]);
      if (s2 > 0.01) { const o = { _id: nid(), soort: 'cirkel', laag: null, parameters: { midden: bezig.a, straal: r3(s2) }, geometrie: { type: 'Polygon', coordinates: [cirkelRing(bezig.a, s2)] } }; wijzig((l) => [...l, o]); setSel([o._id]); }
      setBezig(null);
    }
  };
  const rondLijnAf = () => {
    setBezig((b) => {
      if (b?.soort !== 'lijn') return b;
      const pts = b.pts.filter((q, i) => i === 0 || q[0] !== b.pts[i - 1][0] || q[1] !== b.pts[i - 1][1]);
      if (pts.length >= 2) {
        const o = b.el ? { _id: nid(), soort: 'element', element_id: b.el.id, laag: null, parameters: {}, geometrie: { type: 'LineString', coordinates: pts } } : { _id: nid(), soort: 'lijn', laag: null, parameters: {}, stijl: {}, geometrie: { type: 'LineString', coordinates: pts } };
        wijzig((l) => [...l, o]); setSel([o._id]);
      }
      return null;
    });
  };
  const wiel = (e) => {
    const w = naarWereld(e); const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setBeeld((b) => { const s = Math.min(800, Math.max(2, b.s * f)); return { s, cx: w[0] - (w[0] - b.cx) * (b.s / s), cy: w[1] - (w[1] - b.cy) * (b.s / s) }; });
  };
  useEffect(() => {
    const el = svgRef.current; if (!el) return undefined;
    const h = (e) => { e.preventDefault(); wiel(e); };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  });

  const draaiSel = (g) => {
    if (gereedschap === 'element' && !sel.length) { setElRot((r) => (((r + g) % 360) + 360) % 360); return; }
    const lijst = delen.filter((o) => sel.includes(o._id)); if (!lijst.length) return;
    const k = kaderVan(lijst); const c = snap([(k[0] + k[2]) / 2, (k[1] + k[3]) / 2]);
    wijzig((d) => d.map((o) => (sel.includes(o._id) ? gedraaid(o, g, c) : o)));
  };
  useEffect(() => {
    const t = (e) => {
      // Het plan erachter krijgt geen toetsen (anders wist Delete of Ctrl Z daar iets).
      e.stopPropagation();
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
      if (mod && k === 'z') { e.preventDefault(); terug(); return; }
      if (mod && k === 'd') { e.preventDefault(); const n = delen.filter((o) => sel.includes(o._id)).map((o) => ({ ...verschoven(o, raster || 0.5, -(raster || 0.5)), _id: nid() })); wijzig((d) => [...d, ...n]); setSel(n.map((o) => o._id)); return; }
      if (e.key === 'Escape') { e.stopPropagation(); if (bezig) setBezig(null); else if (gereedschap !== 'selecteer') setGereedschap('selecteer'); else if (sel.length) setSel([]); return; }
      if (e.key === 'Enter') { e.stopPropagation(); if (bezig?.soort === 'lijn') rondLijnAf(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); wijzig((d) => d.filter((o) => !sel.includes(o._id))); setSel([]); return; }
      if (k === 'q' || k === 'w') { draaiSel(k === 'w' ? 90 : -90); return; }
      if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault(); const st = e.shiftKey ? 1 : raster || 0.1;
        const [dx, dy] = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
        wijzig((d) => d.map((o) => (sel.includes(o._id) ? verschoven(o, dx, dy) : o))); return;
      }
      const tl = TOOLS.find((x) => x[2].toLowerCase() === k);
      if (tl && !mod) { setGereedschap(tl[0]); setBezig(null); }
    };
    window.addEventListener('keydown', t, true);
    return () => window.removeEventListener('keydown', t, true);
  });

  // ---------- Tekenen ----------
  const pad = (pts, dicht) => pts.map((q, i) => `${i ? 'L' : 'M'}${naarScherm(q).map((v) => v.toFixed(1)).join(' ')}`).join(' ') + (dicht ? ' Z' : '');
  const rasterLijnen = () => {
    const st = raster || 1; let stap = st; while (stap * beeld.s < 8) stap *= 2;
    const x0 = beeld.cx - maat.w / 2 / beeld.s; const x1 = beeld.cx + maat.w / 2 / beeld.s;
    const y0 = beeld.cy - maat.h / 2 / beeld.s; const y1 = beeld.cy + maat.h / 2 / beeld.s;
    const uit = [];
    for (let x = Math.ceil(x0 / stap) * stap; x <= x1; x += stap) { const [sx] = naarScherm([x, 0]); const dik = Math.abs(x % 5) < 1e-6 || Math.abs((x % 5) - 5) < 1e-6; uit.push(<line key={`x${x}`} x1={sx} x2={sx} y1={0} y2={maat.h} stroke={Math.abs(x) < 1e-6 ? '#94A3B8' : dik ? '#E2E8F0' : '#F1F5F9'} strokeWidth={1} />); }
    for (let y = Math.ceil(y0 / stap) * stap; y <= y1; y += stap) { const [, sy] = naarScherm([0, y]); const dik = Math.abs(y % 5) < 1e-6 || Math.abs((y % 5) - 5) < 1e-6; uit.push(<line key={`y${y}`} y1={sy} y2={sy} x1={0} x2={maat.w} stroke={Math.abs(y) < 1e-6 ? '#94A3B8' : dik ? '#E2E8F0' : '#F1F5F9'} strokeWidth={1} />); }
    return uit;
  };
  const tekeningVan = (o) => {
    const el = elementenMap.get(o.element_id); const tk = el ? metTekening(el).eigenschappen?.tekening : null;
    const p = o.parameters || {};
    if (!tk || !p.midden) return null;
    const sx = (p.breedte || tk.b) / tk.b; const sy = (p.diepte || tk.h) / tk.h; const rot = Number(p.rot) || 0;
    const w = ([x, y]) => { const q = draai([x * sx, y * sy], rot); return [p.midden[0] + q[0], p.midden[1] + q[1]]; };
    return (
      <g pointerEvents="none">
        {(tk.vlakken || []).map((v, i) => <path key={`v${i}`} d={pad(v.r[0].map(w), true)} fill={v.vul || 'none'} fillOpacity={v.vul ? 1 : 0} stroke={v.lijn || 'none'} strokeWidth={Math.max(0.5, (v.d || 0.02) * beeld.s)} />)}
        {(tk.lijnen || []).map((l, i) => <path key={`l${i}`} d={pad(l.c.map(w))} fill="none" stroke={l.k || '#1d1d1b'} strokeWidth={Math.max(0.5, (l.d || 0.02) * beeld.s)} strokeDasharray={l.s === 'streep' ? '4 3' : undefined} />)}
      </g>
    );
  };
  const tekenDeel = (o) => {
    const g = o.geometrie; const aan = sel.includes(o._id);
    const el = o.element_id ? elementenMap.get(o.element_id) : null;
    const kleur = el?.stijl?.kleur || o.stijl?.kleur || '#1d1d1b';
    if (g.type === 'Point') {
      const [x, y] = naarScherm(g.coordinates);
      return <text key={o._id} x={x} y={y} fontSize={13} textAnchor="middle" dominantBaseline="middle" fill={aan ? '#2563EB' : '#1d1d1b'} fontWeight={600}>{o.naam || '•'}</text>;
    }
    const pts = punten(g);
    return (
      <g key={o._id}>
        {o.soort === 'element' && g.type === 'Polygon' && tekeningVan(o)}
        <path d={pad(pts, g.type === 'Polygon')} fill={g.type === 'Polygon' && !(o.soort === 'element' && tekeningVan(o)) ? '#F8FAFC' : 'none'} fillOpacity={0.7} stroke={aan ? '#2563EB' : kleur} strokeWidth={aan ? 2.5 : el?.tekenwijze === 'lijn' ? 4 : 1.5} strokeDasharray={o.soort === 'element' && g.type === 'Polygon' && tekeningVan(o) && !aan ? '3 3' : undefined} />
        {el && g.type === 'Polygon' && beeld.s * (o.parameters?.breedte || 1) > 70 && (() => { const [x, y] = naarScherm(o.parameters.midden); return <text x={x} y={y + beeld.s * (o.parameters.diepte || 1) / 2 + 12} fontSize={10} textAnchor="middle" fill="#64748B">{el.naam.slice(0, 32)}</text>; })()}
      </g>
    );
  };

  const een = sel.length === 1 ? delen.find((o) => o._id === sel[0]) : null;
  const zetDeel = (patch) => wijzig((d) => d.map((o) => (o._id === een._id ? herbereken({ ...o, ...patch, parameters: { ...o.parameters, ...(patch.parameters || {}) } }) : o)));
  const lengte = (g) => { const c = punten(g); let s = 0; for (let i = 1; i < c.length; i++) s += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]); return s; };
  const veld = (label, waarde, zet) => (
    <label className="fm-veld" key={label}>{label}<input defaultValue={getal(waarde, 3)} key={`${een?._id}-${label}-${waarde}`} inputMode="decimal" onBlur={(e) => { const v = naarGetal(e.target.value); if (v != null) zet(v); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
  );

  return (
    <div className="fm fm-tekenscherm" role="dialog" aria-label="Tekenscherm">
      <div className="fm-ts-kop">
        <strong>Tekenscherm</strong>
        <span className="fm-sub">{delen.length} {delen.length === 1 ? 'onderdeel' : 'onderdelen'} · komt als groep op de kaart</span>
        <span style={{ flex: 1 }} />
        <label className="fm-sub">Raster <select value={String(raster)} onChange={(e) => setRaster(Number(e.target.value))}>{[0, 0.05, 0.1, 0.25, 0.5, 1].map((v) => <option key={v} value={String(v)}>{v ? `${String(v).replace('.', ',')} m` : 'uit'}</option>)}</select></label>
        <button className="fm-knop klein" onClick={passend}>Passend</button>
        <button className="fm-knop klein" onClick={terug} disabled={!geschiedenis.current.length}>Ongedaan</button>
        <button className="fm-knop" onClick={onSluit}>Annuleren</button>
        <button className="fm-knop rood" disabled={!delen.length} onClick={() => onKlaar(delen.map(({ _id, ...o }) => o))}>Klaar</button>
      </div>
      <div className="fm-ts-lijf">
        <div className="fm-ts-tools">
          {TOOLS.map(([k, n, t]) => <button key={k} className={gereedschap === k ? 'aan' : ''} title={`${n} (${t})`} onClick={() => { setGereedschap(k); setBezig(null); }}>{n}<small>{t}</small></button>)}
        </div>
        <svg ref={svgRef} className="fm-ts-doek" onMouseDown={omlaag} onMouseMove={beweeg} onMouseUp={omhoog} onMouseLeave={() => { omhoog(); setMuis(null); }} onDoubleClick={() => bezig?.soort === 'lijn' && rondLijnAf()} style={{ cursor: gereedschap === 'selecteer' ? 'default' : 'crosshair' }}>
          {rasterLijnen()}
          {delen.map(tekenDeel)}
          {bezig?.soort === 'rechthoek' && <path d={pad(rechthoek([(bezig.a[0] + bezig.b[0]) / 2, (bezig.a[1] + bezig.b[1]) / 2], Math.abs(bezig.b[0] - bezig.a[0]), Math.abs(bezig.b[1] - bezig.a[1]), 0), true)} fill="#DBEAFE" fillOpacity={0.5} stroke="#2563EB" />}
          {bezig?.soort === 'cirkel' && <path d={pad(cirkelRing(bezig.a, Math.hypot(bezig.b[0] - bezig.a[0], bezig.b[1] - bezig.a[1])), true)} fill="#DBEAFE" fillOpacity={0.5} stroke="#2563EB" />}
          {bezig?.soort === 'lijn' && <path d={pad(muis ? [...bezig.pts, muis] : bezig.pts)} fill="none" stroke="#2563EB" strokeWidth={2} />}
          {gereedschap === 'element' && kiesEl && kiesEl.tekenwijze !== 'lijn' && muis && (() => { const o = nieuwElement(kiesEl, muis); return o ? <path d={pad(o.geometrie.coordinates[0], true)} fill="#16A34A" fillOpacity={0.15} stroke="#16A34A" strokeDasharray="4 3" /> : null; })()}
          {muis && gereedschap !== 'selecteer' && (() => { const [x, y] = naarScherm(muis); return <circle cx={x} cy={y} r={3} fill="#2563EB" />; })()}
        </svg>
        <div className="fm-ts-paneel">
          {gereedschap === 'element' && (
            <>
              <div className="fm-kop">Element kiezen</div>
              <input placeholder="Zoek: tafel, truss, scherm…" value={zoek} onChange={(e) => setZoek(e.target.value)} autoFocus />
              <div className="fm-ts-lijst">
                {elementenLijst.map((e) => <button key={e.id} className={kiesEl?.id === e.id ? 'aan' : ''} onClick={() => setKiesEl(e)}>{e.naam}<small>{e.tekenwijze === 'lijn' ? 'lijn' : `${getal(Number(e.breedte_m) || 0)} × ${getal(Number(e.diepte_m) || 0)} m`}</small></button>)}
              </div>
              {kiesEl && kiesEl.tekenwijze !== 'lijn' && <div className="fm-sub">Draaiing bij plaatsen: {elRot}° (Q/W)</div>}
            </>
          )}
          {gereedschap !== 'element' && een && (
            <>
              <div className="fm-kop">{een.element_id ? elementenMap.get(een.element_id)?.naam || 'Element' : { lijn: 'Lijn', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst' }[een.soort] || 'Onderdeel'}</div>
              {een.parameters?.midden && (een.soort === 'element' || een.soort === 'rechthoek') && een.geometrie.type === 'Polygon' && (
                <>
                  <div className="fm-ts-rij">{veld('X (m)', een.parameters.midden[0], (v) => zetDeel({ parameters: { midden: [v, een.parameters.midden[1]] } }))}{veld('Y (m)', een.parameters.midden[1], (v) => zetDeel({ parameters: { midden: [een.parameters.midden[0], v] } }))}</div>
                  <div className="fm-ts-rij">{veld('Breedte (m)', een.parameters.breedte, (v) => v > 0 && zetDeel({ parameters: { breedte: v } }))}{veld('Diepte (m)', een.parameters.diepte, (v) => v > 0 && zetDeel({ parameters: { diepte: v } }))}</div>
                  {veld('Draaiing (°)', Number(een.parameters.rot) || 0, (v) => zetDeel({ parameters: { rot: ((v % 360) + 360) % 360 } }))}
                </>
              )}
              {een.soort === 'cirkel' && (
                <div className="fm-ts-rij">{veld('Straal (m)', een.parameters.straal, (v) => v > 0 && zetDeel({ parameters: { straal: v } }))}</div>
              )}
              {een.geometrie.type === 'LineString' && <div className="fm-sub">Lengte {getal(lengte(een.geometrie))} m · {een.geometrie.coordinates.length} punten</div>}
              {een.soort === 'tekst' && <label className="fm-veld">Tekst<input defaultValue={een.naam || ''} key={een._id} onBlur={(e) => zetDeel({ naam: e.target.value })} /></label>}
              <div className="fm-vinkrij" style={{ gap: 6 }}>
                <button className="fm-knop klein" onClick={() => draaiSel(-90)}>↺ 90°</button>
                <button className="fm-knop klein" onClick={() => draaiSel(90)}>↻ 90°</button>
                <button className="fm-knop klein gevaar" onClick={() => { wijzig((d) => d.filter((o) => !sel.includes(o._id))); setSel([]); }}>Wissen</button>
              </div>
            </>
          )}
          {gereedschap !== 'element' && sel.length > 1 && (
            <>
              <div className="fm-kop">{sel.length} onderdelen</div>
              <div className="fm-vinkrij" style={{ gap: 6 }}>
                <button className="fm-knop klein" onClick={() => draaiSel(-90)}>↺ 90°</button>
                <button className="fm-knop klein" onClick={() => draaiSel(90)}>↻ 90°</button>
                <button className="fm-knop klein gevaar" onClick={() => { wijzig((d) => d.filter((o) => !sel.includes(o._id))); setSel([]); }}>Wissen</button>
              </div>
            </>
          )}
          {gereedschap !== 'element' && !sel.length && <div className="fm-sub">Kies links een gereedschap. Met Element zet je tafels, truss, schermen … uit de bibliotheek op het raster. Bij Klaar komt alles als groep op de kaart.</div>}
          {muis && <div className="fm-sub fm-ts-muis">x {getal(muis[0])} · y {getal(muis[1])} m</div>}
        </div>
      </div>
      <div className="fm-ts-voet">{UITLEG[gereedschap]}</div>
    </div>
  );
}
