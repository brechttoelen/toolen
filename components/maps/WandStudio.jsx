'use client';

// B-matrix wandbouwer: losse frames als bouwblokken (zoals de configurator van B-matrix).
// Kies een frame uit de bibliotheek en zet het in beeld: aan het uiteinde van een frame trek je
// het in de richting van de muis verder (rechtdoor of in een hoek van 90°), boven een frame
// stapel je het erop, elders staat het los op de vloer. Klik frames aan (Shift/Ctrl = meer) om
// ze te verslepen, te draaien, te kopiëren of er een doek op te zetten.
// Parallelle projectie: elk doek past met een gewone matrix op zijn vlak.
import { useBouwerSchild, schildProps } from './bouwerschild';
import { DoekUpload } from './doekupload';
import { GridlabKnop } from './gridlabdoek';
import { DoekBeeld, PLAATSINGEN, STARTEN } from './doekbeeld';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as turf from '@turf/turf';
import { publiekeUrl } from './db';
import { doekOver, wandInst, wandTelling, wandStukken, naarVrij, isVrij, catalogus, mm } from './framewand';

const rad = (g) => (g * Math.PI) / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;
const nieuwId = () => Math.random().toString(36).slice(2, 9);
const PW = 0.031; // zichtbare breedte van het profiel
const ALU = '#BCC2C9'; const ALU_DONKER = '#8A929B'; const ALU_ZIJ = '#A3AAB2'; const ALU_TOP = '#D5D9DE';

// Punten van de wand in meter (binnen: lokaal; buiten: rond het eerste punt).
export function wandPunten(it) {
  const lok = it?.velden?.binnen?.lokaal?.geometrie;
  if (lok?.type === 'LineString') return lok.coordinates;
  const c = it?.geometrie?.coordinates || []; if (c.length < 2) return [];
  const o = c[0];
  return c.map((p) => {
    const x = turf.distance(o, [p[0], o[1]], { units: 'meters' }) * Math.sign(p[0] - o[0]);
    const y = turf.distance(o, [o[0], p[1]], { units: 'meters' }) * Math.sign(p[1] - o[1]);
    return [x, y];
  });
}

// Omgekeerd: punten in meter (zelfde stelsel als wandPunten) terug naar lng/lat rond het eerste punt van de lijn.
export function vanPunten(it, pts) {
  const c = it?.geometrie?.coordinates || []; if (!c.length) return null; const o = c[0];
  const kx = turf.distance(o, [o[0] + 1, o[1]], { units: 'meters' }); const ky = turf.distance(o, [o[0], o[1] + 1], { units: 'meters' });
  return { type: 'LineString', coordinates: pts.map(([x, y]) => [o[0] + x / kx, o[1] + y / ky]) };
}

const blokkenVan = (it, el) => { const pts = wandPunten(it); return { pts, blokken: wandStukken(pts, it, el).map((f) => ({ ...f, vid: f.vid || `f${f.i}` })) }; };
const eind = (f) => [f.a[0] + Math.cos(f.r) * f.b, f.a[1] + Math.sin(f.r) * f.b];
const midden = (f) => [f.a[0] + (Math.cos(f.r) * f.b) / 2, f.a[1] + (Math.sin(f.r) * f.b) / 2];
const binnen = (p, q) => { let ok = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { if ((q[i][1] > p[1]) !== (q[j][1] > p[1]) && p[0] < ((q[j][0] - q[i][0]) * (p[1] - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) ok = !ok; } return ok; };

// Een groep frames verplaatsen zodat het anker (eerste) op plek p komt.
function verplaatsGroep(groep, p) {
  const A = groep[0]; const dr = p.r - A.r; const c = Math.cos(dr); const s = Math.sin(dr); const dz = p.z0 - A.z0;
  return groep.map((m) => { const d = [m.a[0] - A.a[0], m.a[1] - A.a[1]]; return { ...m, a: [p.a[0] + d[0] * c - d[1] * s, p.a[1] + d[0] * s + d[1] * c], r: m.r + dr, z0: Math.max(0, r3(m.z0 + dz)) }; });
}
const draaiGroep = (groep, graden) => {
  const ms = groep.map(midden); const c = [ms.reduce((a, p) => a + p[0], 0) / ms.length, ms.reduce((a, p) => a + p[1], 0) / ms.length];
  const dr = rad(graden); const co = Math.cos(dr); const si = Math.sin(dr);
  return groep.map((m) => { const d = [m.a[0] - c[0], m.a[1] - c[1]]; return { ...m, a: [c[0] + d[0] * co - d[1] * si, c[1] + d[0] * si + d[1] * co], r: m.r + dr }; });
};

function Zicht({ blokken, el, elementenMap, hoek = 35, kantel = 22, sel = [], mini = false, spook = null, zoom = 1, onKlik, onDraai, onSleepFrame, onDoek, onZoom, vast , passTik = 0}) {
  const ref = useRef(null); const [maat, setMaat] = useState({ w: 600, h: 400 });
  // Verschuiven (rechts of middelste muisknop slepen, twee vingers op de trackpad); Passend zet het terug.
  const [schuif, setSchuif] = useState([0, 0]); const schuifRef = useRef(schuif); schuifRef.current = schuif;
  useEffect(() => { setSchuif([0, 0]); }, [passTik]);
  const sleep = useRef(null);
  useEffect(() => {
    const e = ref.current; if (!e) return undefined;
    const ro = new ResizeObserver(() => setMaat({ w: e.clientWidth || 600, h: e.clientHeight || 400 }));
    ro.observe(e); return () => ro.disconnect();
  }, []);
  const d = wandInst(el).diepte / 2;
  const t = rad(hoek); const ph = rad(kantel);
  const proj = ([x, y], z) => { const xr = x * Math.cos(t) - y * Math.sin(t); const yr = x * Math.sin(t) + y * Math.cos(t); return [xr, -z * Math.cos(ph) - yr * Math.sin(ph), yr * Math.cos(ph) - z * Math.sin(ph)]; };
  const ziet = (n) => n[0] * Math.sin(t) + n[1] * Math.cos(t) < 0.0001;

  const kader = useMemo(() => {
    const alle = []; for (const f of blokken) for (const q of [f.a, eind(f)]) { alle.push(proj(q, f.z0)); alle.push(proj(q, f.z0 + f.h)); }
    if (!alle.length) for (const q of [[-2, -2], [2, 2], [-2, 2], [2, -2]]) { alle.push(proj(q, 0)); alle.push(proj(q, 2)); }
    const xs = alle.map((p) => p[0]); const ys = alle.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }, [blokken, hoek, kantel]); // eslint-disable-line react-hooks/exhaustive-deps
  // Camera zoals in andere 3D-programma's: draaien gebeurt rond het punt in het midden van het beeld,
  // de schaal blijft vast tijdens het draaien (pas Passend past opnieuw in). Kleine voorbeelden passen zich altijd in.
  const interactief = !mini || !!onDraai;
  const midden3 = useMemo(() => {
    if (!blokken.length) return [0, 0, 1];
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; let z1 = 0;
    for (const f of blokken) for (const q of [f.a, eind(f)]) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); z1 = Math.max(z1, f.z0 + f.h); }
    return [(x0 + x1) / 2, (y0 + y1) / 2, z1 / 2];
  }, [blokken]);
  const fitRef = useRef(null); const [doel, setDoel] = useState(null);
  if (!interactief || !fitRef.current || fitRef.current.tik !== passTik || (!blokken.length) !== fitRef.current.leeg) fitRef.current = { tik: passTik, k: kader, T: midden3, leeg: !blokken.length };
  useEffect(() => { setDoel(null); }, [passTik]);
  const vastRef0 = useRef(null); if (!vast) vastRef0.current = kader;
  const k0 = interactief ? fitRef.current.k : (vast && vastRef0.current) || kader;
  const pad = mini ? 10 : 80;
  const s = Math.min((maat.w - pad * 2) / Math.max(1, k0[2] - k0[0]), (maat.h - pad * 2) / Math.max(1, k0[3] - k0[1]), mini ? 400 : 240) * zoom;
  const T3 = doel || fitRef.current.T; const pT = proj([T3[0], T3[1]], T3[2]);
  const ox = interactief ? maat.w / 2 - pT[0] * s + schuif[0] : maat.w / 2 - ((k0[0] + k0[2]) / 2) * s; const oy = interactief ? maat.h / 2 - pT[1] * s + schuif[1] : maat.h / 2 - ((k0[1] + k0[3]) / 2) * s;
  const S = (q, z) => { const p = proj(q, z); return [p[0] * s + ox, p[1] * s + oy, p[2]]; };
  const opVlak = (sx, sy, z = 0) => { const xr = (sx - ox) / s; const Y = (sy - oy) / s; const yr = (-Y - z * Math.cos(ph)) / Math.max(0.05, Math.sin(ph)); return [xr * Math.cos(t) + yr * Math.sin(t), -xr * Math.sin(t) + yr * Math.cos(t)]; };
  const hulp = { opVlak, S };

  const spookIds = new Set((spook || []).map((x) => x.vid));
  const alle = [...blokken.filter((f) => !spookIds.has(f.vid)), ...(spook || []).map((x) => ({ ...x, spook: true }))];
  const selSet = new Set(sel);
  const beeld = (id) => { const x = id ? elementenMap.get(id) : null; return x ? { kleur: x.eigenschappen?.kleur || '#EA580C', src: x.eigenschappen?.beeld ? publiekeUrl(x.eigenschappen.beeld) : null, verhouding: x.eigenschappen?.verhouding || null } : null; };
  const P2 = (q) => q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  // Eén frame als B-matrix-profiel: kader in aluminium, zijkant en bovenkant met diepte, doek binnenin.
  const tekenFrame = (f) => {
    const u = [Math.cos(f.r), Math.sin(f.r)]; const n = [u[1], -u[0]]; // voorkant = rechts van de richting
    const P = (sv, o, z) => S([f.a[0] + u[0] * sv + n[0] * o, f.a[1] + u[1] * sv + n[1] * o], z);
    const z0 = f.z0; const z1 = f.z0 + f.h; const b = f.b;
    const kant = ziet(n) ? 'voor' : 'achter'; const o = kant === 'voor' ? d : -d;
    // l → r zoals je voor die kant staat
    const sL = kant === 'voor' ? 0 : b; const sR = kant === 'voor' ? b : 0; const sg = kant === 'voor' ? 1 : -1;
    const Q = (a1, a2, zz1, zz2) => [P(a1, o, zz2), P(a2, o, zz2), P(a2, o, zz1), P(a1, o, zz1)];
    const buiten = Q(sL, sR, z0, z1); const inw = Q(sL + sg * PW, sR - sg * PW, z0 + PW, z1 - PW);
    const id = f[kant]; const bl = f.spook ? null : beeld(id); const aan = selSet.has(f.i); const ov = f[`${kant}Over`];
    // Doek enkel aan de andere kant: je ziet de achterkant van dat doek (dicht, onbedrukt), niet door het frame.
    const rug = !bl && !f.spook ? beeld(f[kant === 'voor' ? 'achter' : 'voor']) : null;
    const top = [P(0, d, z1), P(b, d, z1), P(b, -d, z1), P(0, -d, z1)];
    const zij = [[0, [-u[0], -u[1]]], [b, u]].filter(([, nn]) => ziet(nn)).map(([sv]) => [P(sv, d, z1), P(sv, -d, z1), P(sv, -d, z0), P(sv, d, z0)]);
    // Het doek (SEG) wordt over het frame gespannen: het bedekt de hele voorkant, ook het profiel.
    const W = Math.max(0.01, b); const H = Math.max(0.01, f.h); const q = buiten;
    const m = `matrix(${(q[1][0] - q[0][0]) / W} ${(q[1][1] - q[0][1]) / W} ${(q[3][0] - q[0][0]) / H} ${(q[3][1] - q[0][1]) / H} ${q[0][0]} ${q[0][1]})`;
    const lw = Math.max(0.6, s * 0.006);
    const data = f.spook ? {} : { 'data-frame': f.i, 'data-kant': kant };
    return (
      <g key={f.vid} opacity={f.spook ? 0.7 : 1}>
        {zij.map((z, k) => <polygon key={k} points={P2(z)} fill={f.spook ? '#93C5FD' : ALU_ZIJ} stroke={ALU_DONKER} strokeWidth={lw} {...data} />)}
        <polygon points={P2(top)} fill={f.spook ? '#BFDBFE' : ALU_TOP} stroke={ALU_DONKER} strokeWidth={lw} {...data} />
        {/* binnenkant: doek, of open (je kijkt door het frame) */}
        <polygon points={P2(inw)} fill={f.spook ? 'rgba(147,197,253,.35)' : 'rgba(255,255,255,0.01)'} stroke="none" {...data} style={{ cursor: mini ? 'pointer' : 'grab' }} />
        {!bl && !rug && !f.spook && <polygon points={P2(Q(sL + sg * PW * 0.5, sR - sg * PW * 0.5, z0 + PW * 0.5, z1 - PW * 0.5))} fill="none" stroke="#4B5563" strokeWidth={Math.max(0.5, s * 0.004)} strokeDasharray={`${Math.max(2, s * 0.03)} ${Math.max(2, s * 0.025)}`} pointerEvents="none" />}
        {/* profiel */}
        <path d={`M${P2(buiten).replace(/ /g, 'L')}Z M${P2(inw).replace(/ /g, 'L')}Z`} fillRule="evenodd" fill={f.spook ? '#60A5FA' : ALU} stroke={ALU_DONKER} strokeWidth={lw} {...data} style={{ cursor: mini ? 'pointer' : 'grab' }} />
        {bl && <polygon points={P2(buiten)} fill={bl.kleur} stroke="none" {...data} style={{ cursor: mini ? 'pointer' : 'grab' }} />}
        {rug && <polygon points={P2(buiten)} fill="#C9CDD3" stroke="#000" strokeOpacity={0.15} strokeWidth={lw} {...data} style={{ cursor: mini ? 'pointer' : 'grab' }} />}
        {bl?.src && (() => {
          // Doek over meerdere frames: dit frame toont zijn stuk van het grote doek.
          const TW = ov ? W / Math.max(0.0001, ov.u1 - ov.u0) : W; const TH = ov ? H / Math.max(0.0001, ov.v1 - ov.v0) : H;
          return <DoekBeeld src={bl.src} W={W} H={H} TW={TW} TH={TH} ox={ov ? ov.u0 * TW : 0} oy={ov ? ov.v0 * TH : 0} wijze={f[`${kant}Pl`] || 'vullen'} start={f[`${kant}St`] || 'rechts'} verhouding={bl.verhouding} transform={m} />;
        })()}
        {bl && <polygon points={P2(buiten)} fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={lw} pointerEvents="none" />}
        {aan && <polygon points={P2(buiten)} fill="#2563EB" fillOpacity={0.12} stroke="#2563EB" strokeWidth={2.5} pointerEvents="none" />}
        {!mini && !bl && !rug && !f.spook && Math.abs(buiten[1][0] - buiten[0][0]) > 40 && Math.abs(buiten[3][1] - buiten[0][1]) > 30 && (() => { const c = buiten.reduce((a2, p) => [a2[0] + p[0] / 4, a2[1] + p[1] / 4], [0, 0]); return <text x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#6B7280" pointerEvents="none">{mm(f.b)}×{mm(f.h)}</text>; })()}
      </g>
    );
  };
  const diepte = (f) => { const c = midden(f); return S(c, f.z0 + f.h / 2)[2]; };
  // Tekenvolgorde (van ver naar dichtbij). Enkel op het midden sorteren gaat mis bij lange frames in een hoek of T:
  // per paar frames dat op het scherm overlapt bepalen we wie vooraan staat (aan de kant van de kijker van de lijn
  // van de ander), daarna een topologische sortering met de diepte als scheidsrechter.
  const volgorde = (lijst) => {
    const n = lijst.length; if (n < 2) return lijst;
    const dir = [Math.sin(t), Math.cos(t)]; // van de kijker weg, in het grondvlak
    const info = lijst.map((f) => { const a = f.a; const e = eind(f); const xa = S(a, 0)[0]; const xe = S(e, 0)[0]; return { f, a, e, x0: Math.min(xa, xe), x1: Math.max(xa, xe), z0: f.z0, z1: f.z0 + f.h, d: diepte(f) }; });
    const kant = (A, p) => (A.e[0] - A.a[0]) * (p[1] - A.a[1]) - (A.e[1] - A.a[1]) * (p[0] - A.a[0]);
    const voor = (A, B) => { // 1: B staat voor A, -1: A staat voor B, 0: onbekend
      const kijker = (A.e[0] - A.a[0]) * -dir[1] - (A.e[1] - A.a[1]) * -dir[0];
      if (Math.abs(kijker) < 1e-9) return 0;
      const eps = 1e-4; const sa = kant(A, B.a); const se = kant(A, B.e);
      const zelfde = (v) => Math.abs(v) < eps || Math.sign(v) === Math.sign(kijker);
      const ander = (v) => Math.abs(v) < eps || Math.sign(v) !== Math.sign(kijker);
      if (Math.abs(sa) < eps && Math.abs(se) < eps) return 0;
      if (zelfde(sa) && zelfde(se)) return 1;
      if (ander(sa) && ander(se)) return -1;
      return 0;
    };
    const na = Array.from({ length: n }, () => []); const inn = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = info[i]; const B = info[j];
      if (A.x1 < B.x0 - 1 || B.x1 < A.x0 - 1) continue; // overlappen niet op het scherm
      let r = voor(A, B); if (r === 0) r = -voor(B, A);
      if (r === 1) { na[i].push(j); inn[j] += 1; } else if (r === -1) { na[j].push(i); inn[i] += 1; }
    }
    const uit = []; const klaar = new Array(n).fill(false);
    for (let k = 0; k < n; k++) {
      let best = -1;
      for (let i = 0; i < n; i++) if (!klaar[i] && inn[i] === 0 && (best < 0 || info[i].d > info[best].d)) best = i;
      if (best < 0) { for (let i = 0; i < n; i++) if (!klaar[i] && (best < 0 || info[i].d > info[best].d)) best = i; } // kring: op diepte
      klaar[best] = true; uit.push(info[best].f); for (const j of na[best]) inn[j] -= 1;
    }
    return uit;
  };

  const vl = (() => {
    const xs = []; const ys = []; for (const f of alle) for (const q of [f.a, eind(f)]) { xs.push(q[0]); ys.push(q[1]); }
    if (!xs.length) { xs.push(-3, 3); ys.push(-3, 3); }
    return [Math.floor(Math.min(...xs)) - 4, Math.floor(Math.min(...ys)) - 4, Math.ceil(Math.max(...xs)) + 4, Math.ceil(Math.max(...ys)) + 4];
  })();
  const lijnen = [];
  if (!mini) { for (let x = vl[0]; x <= vl[2]; x += 1) lijnen.push([[x, vl[1]], [x, vl[3]]]); for (let y = vl[1]; y <= vl[3]; y += 1) lijnen.push([[vl[0], y], [vl[2], y]]); }

  const naarLokaal = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const start = (e) => {
    if ((e.button === 1 || e.button === 2) && !mini) { e.preventDefault(); sleep.current = { pan: true, x: e.clientX, y: e.clientY, s0: schuifRef.current }; e.currentTarget.setPointerCapture?.(e.pointerId); return; }
    if (e.button !== 0) return;
    // Na verschuiven: het punt in het midden van het beeld wordt het nieuwe draaipunt (beeld verspringt niet).
    if (interactief && (schuif[0] || schuif[1])) { { // punt op de kijklijn door het midden, op dezelfde diepte als het oude draaipunt
      const X = (maat.w / 2 - ox) / s; const Y = (maat.h / 2 - oy) / s; let D = pT[2]; { let bd = Infinity; for (const q of blokken.map((f) => S(midden(f), f.z0 + f.h / 2))) { const dd = Math.hypot(q[0] - maat.w / 2, q[1] - maat.h / 2); if (dd < bd) { bd = dd; D = q[2]; } } } /* diepte van wat het dichtst bij het midden staat */ const xr = X; const yr = -Y * Math.sin(ph) + D * Math.cos(ph); const zz = -Y * Math.cos(ph) - D * Math.sin(ph);
      setDoel([xr * Math.cos(t) + yr * Math.sin(t), -xr * Math.sin(t) + yr * Math.cos(t), zz]); setSchuif([0, 0]); } }
    const tg = e.target; const i = tg?.dataset?.frame;
    sleep.current = { x: e.clientX, y: e.clientY, h: hoek, k: kantel, weg: false, frame: i != null ? Number(i) : null, kant: tg?.dataset?.kant, meer: e.shiftKey || e.ctrlKey || e.metaKey };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const beweeg = (e) => {
    const g = sleep.current; if (g?.pan) { setSchuif([g.s0[0] + e.clientX - g.x, g.s0[1] + e.clientY - g.y]); return; } if (!g) { onSleepFrame?.('zweef', null, naarLokaal(e), hulp); return; }
    const dx = e.clientX - g.x; const dy = e.clientY - g.y; if (Math.abs(dx) + Math.abs(dy) > 4) g.weg = true;
    if (!g.weg) return;
    if (g.frame != null && onSleepFrame) { onSleepFrame('sleep', g.frame, naarLokaal(e), hulp); return; }
    onDraai?.(g.h - dx * 0.4, Math.max(5, Math.min(75, g.k + dy * 0.25)));
  };
  const los = (e) => {
    const g = sleep.current; sleep.current = null; if (!g || g.pan) return;
    if (g.weg && g.frame != null && onSleepFrame) { onSleepFrame('los', g.frame, naarLokaal(e), hulp); return; }
    if (!g.weg) onKlik?.(g.frame != null ? { i: g.frame, kant: g.kant } : null, naarLokaal(e), hulp, g.meer);
  };
  const drop = (e) => { const id = e.dataTransfer.getData('text/fm-doek'); const i = e.target?.dataset?.frame; if (id && i != null && onDoek) { e.preventDefault(); onDoek(Number(i), e.target.dataset.kant, id); } };

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
    <div ref={ref} className={`fm-wz${mini ? ' mini' : ''}${spook ? ' plaats' : ''}`} onPointerDown={mini && !onDraai ? undefined : start} onPointerMove={mini && !onDraai ? undefined : beweeg} onPointerUp={mini && !onDraai ? undefined : los}
      onDragOver={(e) => e.preventDefault()} onDrop={drop} onWheel={onZoom ? wiel : undefined} onContextMenu={(e) => e.preventDefault()}>
      <svg width={maat.w} height={maat.h}>
        {!mini && <path d={`M${[[vl[0], vl[1]], [vl[2], vl[1]], [vl[2], vl[3]], [vl[0], vl[3]]].map((q) => S(q, 0).slice(0, 2).join(',')).join('L')}Z`} fill="#C9CDD2" />}
        {lijnen.map(([a, b2], k) => { const p = S(a, 0); const q = S(b2, 0); return <line key={`g${k}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#E2E5E9" strokeWidth={1} />; })}
        {alle.filter((f) => f.z0 < 0.01).map((f) => { const a = S(f.a, 0); const b2 = S(eind(f), 0); return <line key={`s${f.vid}`} x1={a[0]} y1={a[1]} x2={b2[0]} y2={b2[1]} stroke="#1f2937" strokeOpacity={0.18} strokeWidth={Math.max(2, s * 0.14)} />; })}
        {volgorde(alle).map(tekenFrame)}
        {!mini && !blokken.length && !spook && <text x={maat.w / 2} y={maat.h / 2} textAnchor="middle" fill="#6B7280" fontSize={14}>Kies een frame in de bibliotheek en zet het hier neer</text>}
      </svg>
    </div>
  );
}

// Klein voorbeeld in het zijpaneel: kijkt vanaf de kant met de meeste doeken.
export function WandZicht({ it, el, elementenMap, groot = false }) {
  const { blokken } = blokkenVan(it, el);
  const n = (h) => { const t = rad(h); let k = 0; for (const f of blokken) { const nn = [Math.sin(f.r), -Math.cos(f.r)]; const voorZiet = nn[0] * Math.sin(t) + nn[1] * Math.cos(t) < 0; if (voorZiet ? f.voor : f.achter) k += 1; } return k; };
  const hoek0 = [35, 215, 125, 305].sort((a, b) => n(b) - n(a))[0];
  // Groot (bekijken over het hele scherm): slepen = draaien, rechts slepen = verschuiven, scrollen = zoomen.
  const [stand, setStand] = useState(null); const [zoom, setZoom] = useState(1);
  return <Zicht blokken={blokken} el={el} elementenMap={elementenMap} hoek={stand ? stand[0] : hoek0} kantel={stand ? stand[1] : 22} mini={!groot} vast={groot && !!stand} zoom={groot ? zoom : 1}
    onDraai={groot ? (a, b) => setStand([a, b]) : undefined} onZoom={groot ? (k) => setZoom((z) => Math.max(0.2, Math.min(8, z * k))) : undefined} />;
}

export default function WandStudio({ it, el, elementenMap, doeken = [], schrijven, onZet, onSluit, totaalTelling = null }) {
  const [hoek, setHoek] = useState(35); const [kantel, setKantel] = useState(24); const [zoom, setZoom] = useState(1); const [passTik, setPassTik] = useState(0);
  const [sel, setSel] = useState([]); const [kant, setKant] = useState('voor');
  const [tab, setTab] = useState('frames');
  const [zoek, setZoek] = useState('');
  const [plaats, setPlaats] = useState(null); // groep frames die je aan het plaatsen bent (nieuw of kopie)
  const [spook, setSpook] = useState(null); // voorlopige plek van de groep
  const [tip, setTip] = useState('');
  const I = wandInst(el); const w = it.velden?.wand || {};
  const { pts, blokken } = blokkenVan(it, el);
  const gekozen = blokken.filter((x) => sel.includes(x.i));
  const f = gekozen.length === 1 ? gekozen[0] : null;
  const telling = wandTelling(pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1])), it, el);
  const voorraad = totaalTelling || telling;
  const sleutels = [...new Set([...Object.keys(I.voorraad), ...Object.keys(voorraad)])].sort();
  // Terug en opnieuw binnen de wandbouwer: elke wijziging bewaart de vorige stand.
  const terugL = useRef([]); const vooruitL = useRef([]); const [, setTik] = useState(0);
  const P0 = pts.length >= 2 ? pts : [[0, 0], [1, 0]];
  const zetWand = (nw, np = P0) => { terugL.current = [...terugL.current.slice(-60), { w, pts: P0 }]; vooruitL.current = []; setTik((x) => x + 1); onZet(nw, np); };
  const terug = () => { const v = terugL.current.pop(); if (!v) return; vooruitL.current.push({ w, pts: P0 }); setTik((x) => x + 1); setSel([]); onZet(v.w, v.pts); };
  const opnieuw = () => { const v = vooruitL.current.pop(); if (!v) return; terugL.current.push({ w, pts: P0 }); setTik((x) => x + 1); setSel([]); onZet(v.w, v.pts); };
  // Ankerlijn onder de frames, zodat je de wand op de kaart en binnen kunt vastnemen en verslepen.
  const ankerVoor = (lijst) => {
    if (!lijst.length) return P0;
    const u = [P0[1][0] - P0[0][0], P0[1][1] - P0[0][1]]; const Lu = Math.hypot(u[0], u[1]) || 1; u[0] /= Lu; u[1] /= Lu; const n = [-u[1], u[0]]; const o = P0[0];
    let s0 = Infinity; let s1 = -Infinity; for (const f of lijst) for (const q of [f.a, eind(f)]) { const sv = (q[0] - o[0]) * u[0] + (q[1] - o[1]) * u[1]; s0 = Math.min(s0, sv); s1 = Math.max(s1, sv); }
    const w0 = (lijst[0].a[0] - o[0]) * n[0] + (lijst[0].a[1] - o[1]) * n[1]; if (s1 - s0 < 0.5) s1 = s0 + 0.5;
    const P = (sv) => [Math.round((o[0] + u[0] * sv + n[0] * w0) * 1000) / 1000, Math.round((o[1] + u[1] * sv + n[1] * w0) * 1000) / 1000];
    return [P(s0), P(s1)];
  };
  const bewaar = (lijst) => { const np = ankerVoor(lijst); zetWand({ ...w, vrij: naarVrij(np, lijst), zijden: null, plint: null, voor: null, achter: null }, np); };
  // Doek kiezen: hoort de hele selectie bij één doorlopend doek, dan krijgt dat doek het nieuwe ontwerp (alle frames ervan);
  // anders krijgt elk gekozen frame een eigen doek.
  const metDoek = (ids, k, id) => {
    const kk = `${k}Over`; const gs = new Set(blokken.filter((x) => ids.includes(x.i)).map((x) => x[kk]?.g || null));
    const groep = gs.size === 1 && [...gs][0] ? [...gs][0] : null;
    bewaar(blokken.map((x) => (groep && x[kk]?.g === groep ? { ...x, [k]: id || null, [kk]: id ? x[kk] : null } : ids.includes(x.i) ? { ...x, [k]: id || null, [kk]: null } : x)));
  };
  const overSel = (aan) => {
    const kk = `${kant}Over`;
    if (!aan) { const gs = new Set(gekozen.map((x) => x[kk]?.g).filter(Boolean)); bewaar(blokken.map((x) => (gs.has(x[kk]?.g) ? { ...x, [kk]: null } : x))); return; }
    const m = doekOver(gekozen, kant); if (!m) { setTip('Eén doek kan alleen over frames die in hetzelfde vlak staan.'); return; }
    const id = gekozen.find((x) => x[kant])?.[kant] || null;
    bewaar(blokken.map((x) => (m.has(x.i) ? { ...x, [kant]: id, [kk]: m.get(x.i) } : x)));
  };

  const bib = useMemo(() => {
    const l = [];
    for (const [a, L] of catalogus(el).sort((x, y) => y[1] * y[0] - x[1] * x[0])) { l.push({ b: a, h: L, plat: false }); if (Math.abs(a - L) > 0.002) l.push({ b: L, h: a, plat: true }); }
    return l;
  }, [el]);
  const sl = (b, h) => `${r3(Math.min(b, h))}x${r3(Math.max(b, h))}`;
  const basisR = blokken[0]?.r ?? (pts.length >= 2 ? Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) : 0);

  // Plek voor het anker (b × h) onder de muis.
  // 1. boven een frame: erop stapelen; 2. bij een uiteinde: verder in de richting van de muis
  // (rechtdoor of een hoek van 90°, ook als T aan een naad); 3. anders los op de vloer.
  const zoekPlek = (b, h, rVrij, muis, hulp, zonder) => {
    const ander = blokken.filter((x) => !zonder.has(x.vid));
    const bezet = (c) => ander.some((x) => Math.abs(x.z0 - c.z0) < 0.01 && Math.hypot(x.a[0] - c.a[0], x.a[1] - c.a[1]) < 0.03 && Math.cos(x.r - c.r) > 0.99);
    for (const F of [...ander].sort((x, y) => hulp.S(midden(y), y.z0)[2] - hulp.S(midden(x), x.z0)[2])) {
      const u = [Math.cos(F.r), Math.sin(F.r)]; const z = F.z0 + F.h;
      for (const a of Math.abs(F.b - b) > 0.01 ? [F.a, [eind(F)[0] - u[0] * b, eind(F)[1] - u[1] * b]] : [F.a]) {
        const c = { a, r: F.r, z0: z, soort: 'erop' }; if (bezet(c)) continue;
        const e = [a[0] + u[0] * b, a[1] + u[1] * b];
        const q = [hulp.S(a, z + h), hulp.S(e, z + h), hulp.S(e, z), hulp.S(a, z)];
        if (binnen(muis, q)) return c;
      }
    }
    // Aan elk uiteinde drie mogelijkheden (rechtdoor, hoek links, hoek rechts): de dichtste bij de muis op het scherm.
    let beste = null;
    for (const F of ander) {
      const u = [Math.cos(F.r), Math.sin(F.r)];
      for (const [E, eindpunt] of [[eind(F), true], [F.a, false]]) {
        const opties = [eindpunt ? { a: E, r: F.r, soort: 'ernaast' } : { a: [E[0] - u[0] * b, E[1] - u[1] * b], r: F.r, soort: 'ernaast' }];
        for (const kantR of [1, -1]) {
          const r = F.r + kantR * (Math.PI / 2); const ur = [Math.cos(r), Math.sin(r)];
          // Aan het einde loopt de wand verder (begint in E); aan het begin komt hij erin uit (eindigt in E).
          opties.push(eindpunt ? { a: E, r, soort: 'hoek' } : { a: [E[0] - ur[0] * b, E[1] - ur[1] * b], r, soort: 'hoek' });
        }
        for (const c of opties) {
          c.z0 = F.z0; if (bezet(c)) continue;
          const m = [c.a[0] + (Math.cos(c.r) * b) / 2, c.a[1] + (Math.sin(c.r) * b) / 2];
          const p = hulp.S(m, c.z0 + h / 2); const dd = Math.hypot(p[0] - muis[0], p[1] - muis[1]);
          const hp = Math.hypot(hulp.S(m, c.z0)[0] - hulp.S(m, c.z0 + h)[0], hulp.S(m, c.z0)[1] - hulp.S(m, c.z0 + h)[1]);
          if (dd < Math.max(70, hp * 0.75) && (!beste || dd < beste.dd)) beste = { ...c, dd };
        }
      }
    }
    if (beste) return beste;
    const v = hulp.opVlak(muis[0], muis[1], 0); const u = [Math.cos(rVrij), Math.sin(rVrij)]; const sn = (x) => Math.round(x * 20) / 20;
    return { a: [sn(v[0] - (u[0] * b) / 2), sn(v[1] - (u[1] * b) / 2)], r: rVrij, z0: 0, soort: 'vrij' };
  };
  const TIP = { ernaast: 'Ernaast', hoek: 'Hoek van 90°', erop: 'Erop gestapeld', vrij: 'Los op de vloer' };

  const stopPlaatsen = () => { setPlaats(null); setSpook(null); setTip(''); };
  const begin = (groep) => { setPlaats({ groep, rVrij: groep[0].r }); setSpook(null); setSel([]); };
  const nieuwFrame = (b, h) => begin([{ vid: '__n0', i: -1, b, h, a: [0, 0], r: basisR, z0: 0, voor: null, achter: null }]);
  const kopieer = () => { if (!gekozen.length) return; begin(gekozen.map((x, k) => ({ ...x, vid: `__n${k}`, i: -1 - k }))); };

  const onSleepFrame = (fase, i, muis, hulp) => {
    if (fase === 'zweef') {
      if (!plaats) return;
      const g = plaats.groep; const p = zoekPlek(g[0].b, g[0].h, plaats.rVrij, muis, hulp, new Set());
      setSpook(verplaatsGroep(g, p)); setTip(TIP[p.soort]);
      return;
    }
    if (!schrijven || plaats) return;
    const fr = blokken[i]; if (!fr) return;
    const groep = sel.includes(i) ? [fr, ...gekozen.filter((x) => x.i !== i)] : [fr];
    const p = zoekPlek(fr.b, fr.h, fr.r, muis, hulp, new Set(groep.map((x) => x.vid)));
    const nieuw = verplaatsGroep(groep, p);
    if (fase === 'sleep') { setSpook(nieuw); setTip(TIP[p.soort]); return; }
    setSpook(null); setTip('');
    const m = new Map(nieuw.map((x) => [x.vid, x])); bewaar(blokken.map((x) => m.get(x.vid) || x));
    if (!sel.includes(i)) setSel([i]);
  };
  const onKlik = (k, muis, hulp, meer) => {
    if (plaats && schrijven) {
      const g = plaats.groep; const p = zoekPlek(g[0].b, g[0].h, plaats.rVrij, muis, hulp, new Set());
      const nieuw = verplaatsGroep(g, p).map((x) => ({ ...x, vid: nieuwId(), spook: false }));
      bewaar([...blokken, ...nieuw]); setSpook(null);
      if (g.length > 1) { stopPlaatsen(); setSel(nieuw.map((_, j) => blokken.length + j)); }
      return; // één frame: blijft in plaatsmodus; Enter, Esc of rechtsklik stopt
    }
    if (!k) { if (!meer) setSel([]); return; }
    setKant(k.kant || 'voor');
    // Klik op een frame met een doorlopend doek: eerst het hele doek (alle frames ervan), nog eens klikken = enkel dit frame.
    const fk = blokken.find((x) => x.i === k.i); const g = fk?.[`${k.kant || 'voor'}Over`]?.g;
    const groep = g ? blokken.filter((x) => x[`${k.kant || 'voor'}Over`]?.g === g).map((x) => x.i) : null;
    setSel((s0) => (meer ? (s0.includes(k.i) ? s0.filter((x) => x !== k.i) : [...s0, k.i]) : groep && !(s0.length === groep.length && groep.every((x) => s0.includes(x))) ? groep : [k.i]));
  };
  const kantelFr = (x) => ({ ...x, b: x.h, h: x.b });
  const wijzigSel = (fn) => { if (!gekozen.length) return; const m = new Map(fn(gekozen).map((x) => [x.vid, x])); bewaar(blokken.map((x) => m.get(x.vid) || x)); };
  // Wissen: eerst het doek op de gekozen kant, pas daarna het frame zelf.
  const metDoekNu = gekozen.filter((x) => x[kant]);
  const doekWeg = () => { if (metDoekNu.length) metDoek(metDoekNu.map((x) => x.i), kant, null); };
  const frameWeg = () => { if (!gekozen.length) return; const ids = new Set(sel); bewaar(blokken.filter((x) => !ids.has(x.i))); setSel([]); };
  const weg = () => { if (metDoekNu.length) doekWeg(); else frameWeg(); };

  useEffect(() => {
    const t = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); if (plaats) stopPlaatsen(); else if (sel.length) setSel([]); else if (e.key === 'Escape') onSluit(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(blokken.map((x) => x.i)); return; }
      if (!schrijven) return;
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'c')) { e.preventDefault(); kopieer(); return; }
      if (e.key === 'r' || e.key === 'R') { const g = e.shiftKey ? -90 : 90; if (plaats) setPlaats((p) => ({ ...p, groep: draaiGroep(p.groep, g), rVrij: p.rVrij + rad(g) })); else wijzigSel((l) => draaiGroep(l, g)); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && gekozen.length && !plaats) { e.preventDefault(); weg(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) opnieuw(); else terug(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); opnieuw(); }
    };
    window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true);
  });
  const naarKant = (k) => { setHoek((x) => { const m = ((x % 360) + 360) % 360; const voorZicht = m > 270 || m < 90; return (k === 'voor') === voorZicht ? x : x + 180; }); };
  const lijst = doeken.filter((x) => !zoek || String(x.naam).toLowerCase().includes(zoek.toLowerCase()));
  const totH = Math.max(0, ...blokken.map((x) => x.z0 + x.h));
  const doekNu = gekozen.length && gekozen.every((x) => x[kant] === gekozen[0][kant]) ? gekozen[0][kant] || '' : '';

  useBouwerSchild();
  return createPortal(
    <div className="fm fm-ws" role="dialog" aria-label="Wandbouwer" {...schildProps} onContextMenu={(e) => { if (plaats) { e.preventDefault(); stopPlaatsen(); } }}>
      <div className="fm-ws-kop">
        <strong>Wandbouwer · {el.naam}</strong>
        <span className="fm-sub">{blokken.length} frames · {mm(totH)} mm hoog{isVrij(it) ? '' : ' · gevuld volgens de getekende lijn'}</span>
        <span style={{ flex: 1 }} />
        {schrijven && <button className="fm-knop klein" disabled={!terugL.current.length} title="Terug (Ctrl + Z)" aria-label="Terug" onClick={terug}>↶</button>}
        {schrijven && <button className="fm-knop klein" disabled={!vooruitL.current.length} title="Opnieuw (Ctrl + Shift + Z)" aria-label="Opnieuw" onClick={opnieuw}>↷</button>}
        {schrijven && blokken.length > 0 && <button className="fm-knop klein" onClick={() => { if (window.confirm('Alle frames weghalen?')) { bewaar([]); setSel([]); } }}>Alles leeg</button>}
        <button className="fm-knop klein zwart" onClick={onSluit}>Klaar</button>
      </div>
      <div className="fm-ws-lijf">
        <aside className="fm-ws-doeken">
          <div className="fm-segment fm-ws-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'frames'} className={tab === 'frames' ? 'aan' : ''} onClick={() => setTab('frames')}>Frames</button>
            <button role="tab" aria-selected={tab === 'doeken'} className={tab === 'doeken' ? 'aan' : ''} onClick={() => setTab('doeken')}>Doeken</button>
          </div>
          {tab === 'frames' ? (
            <>
              <div className="fm-sub">{plaats ? 'Klik om te plaatsen · R = draaien · Enter of Esc = stoppen' : 'Kies een frame en zet het neer. Bij het uiteinde van een frame bepaalt de muis de richting: rechtdoor of een hoek.'}</div>
              <div className="fm-ws-bib">
                {bib.map((x) => {
                  const aan = plaats?.groep.length === 1 && plaats.groep[0].vid === '__n0' && plaats.groep[0].b === x.b && plaats.groep[0].h === x.h;
                  const max = I.voorraad[sl(x.b, x.h)]; const n = voorraad[sl(x.b, x.h)] || 0;
                  const z = Math.max(x.b, x.h); const bw = (x.b / z) * 40; const bh = (x.h / z) * 40;
                  return (
                    <button key={`${x.b}x${x.h}`} className={`fm-ws-blok${aan ? ' aan' : ''}`} disabled={!schrijven} title={`${I.profiel} frame ${mm(x.b)} × ${mm(x.h)}${x.plat ? ' (plat)' : ''}`}
                      onClick={() => (aan ? stopPlaatsen() : nieuwFrame(x.b, x.h))}>
                      <svg width="48" height="48" aria-hidden="true">
                        <rect x={24 - bw / 2} y={45 - bh} width={bw} height={bh} fill="none" stroke={ALU_DONKER} strokeWidth="5" />
                        <rect x={24 - bw / 2} y={45 - bh} width={bw} height={bh} fill="none" stroke={ALU} strokeWidth="3" />
                      </svg>
                      <span>{mm(x.b)} × {mm(x.h)}</span>
                      <small className={max != null && n > max ? 'te' : ''}>{x.plat ? 'plat · ' : ''}{max != null ? `${n}/${max}` : `${n}`}</small>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <input type="search" placeholder="Zoek een doek" value={zoek} onChange={(e) => setZoek(e.target.value)} />
              <div className="fm-sub">{gekozen.length ? `Klik een doek voor de ${kant === 'achter' ? 'achterkant' : 'voorkant'} van ${gekozen.length === 1 ? `frame ${gekozen[0].i + 1}` : `${gekozen.length} frames`}, of sleep het op een frame.` : 'Sleep een doek op een frame.'}</div>
              <div className="fm-ws-doeklijst">
                {lijst.map((x) => {
                  const src = x.eigenschappen?.beeld ? publiekeUrl(x.eigenschappen.beeld) : null;
                  return (
                    <button key={x.id} draggable={schrijven} disabled={!schrijven} onDragStart={(e) => { e.dataTransfer.setData('text/fm-doek', x.id); e.dataTransfer.effectAllowed = 'copy'; }}
                      className={`fm-ws-doek${doekNu === x.id ? ' aan' : ''}`} title={x.naam} onClick={() => gekozen.length && metDoek(sel, kant, x.id)}>
                      <span className="fm-ws-doekbeeld" style={{ background: x.eigenschappen?.kleur || '#64748B' }}>{src && <img src={src} alt="" draggable={false} />}</span>
                      <span className="fm-afkap">{x.naam}</span>
                    </button>
                  );
                })}
                {!doeken.length && <div className="fm-sub">Nog geen frame-doeken: laad er hieronder een op.</div>}
              </div>
              {schrijven && <DoekUpload planId={it.plan_id} drager="frame" klein onNieuw={(d) => { if (gekozen.length) metDoek(sel, kant, d.id); }} />}
            </>
          )}
        </aside>
        <div className="fm-ws-zicht">
          <Zicht blokken={blokken} el={el} elementenMap={elementenMap} hoek={hoek} kantel={kantel} sel={sel} spook={spook} zoom={zoom} vast={!!spook}
            onKlik={onKlik} onSleepFrame={onSleepFrame} onDraai={(a, b) => { setHoek(a); setKantel(b); }} onZoom={(k) => setZoom((z) => Math.max(0.2, Math.min(8, z * k)))} passTik={passTik}
            onDoek={(i, k, id) => { if (schrijven) { metDoek([i], k, id); setSel([i]); setKant(k); } }} />
          <div className="fm-ws-hoeken" role="group" aria-label="Kijkhoek">
            <button onClick={() => { setHoek(0); setKantel(8); }}>Voor</button>
            <button onClick={() => { setHoek(35); setKantel(24); }}>Hoek</button>
            <button onClick={() => { setHoek(180); setKantel(8); }}>Achter</button>
            <button onClick={() => { setHoek(0); setKantel(75); }}>Boven</button>
            <button onClick={() => { setZoom(1); setPassTik((x) => x + 1); }} title="Alles in beeld">Passend</button>
          </div>
          <div className="fm-ws-tip fm-sub">{tip || 'Slepen = draaien · rechts slepen of twee vingers = verschuiven · scrollen = zoomen · Shift + klik = meer frames · Ctrl + A = alles'}</div>
        </div>
        <aside className="fm-ws-rechts">
          {gekozen.length ? (
            <>
              <div className="fm-ws-rkop"><strong>{f ? `Frame ${f.i + 1}` : `${gekozen.length} frames`}</strong><button className="fm-sluit" aria-label="Selectie opheffen" onClick={() => setSel([])}>×</button></div>
              {f && <div className="fm-sub">{I.profiel} · {mm(f.b)} × {mm(f.h)}{f.b > f.h ? ' · plat' : ''}{f.z0 > 0.01 ? ` · op ${mm(f.z0)} mm` : ''}</div>}
              {schrijven && (
                <div className="fm-ws-acties">
                  <button className="fm-knop klein" title="90° draaien (R)" onClick={() => wijzigSel((l) => draaiGroep(l, 90))}>↻ 90°</button>
                  <button className="fm-knop klein" title="De andere kant op (Shift + R)" onClick={() => wijzigSel((l) => draaiGroep(l, -90))}>↺ 90°</button>
                  {f && <button className="fm-knop klein" title="Rechtop of plat leggen" onClick={() => wijzigSel((l) => l.map(kantelFr))}>{f.b > f.h ? 'Rechtop' : 'Plat leggen'}</button>}
                  <button className="fm-knop klein" title="Kopie plaatsen (Ctrl + D)" onClick={kopieer}>Kopiëren</button>
                  {metDoekNu.length > 0 && <button className="fm-knop klein" title="Doek van deze kant halen (Delete)" onClick={doekWeg}>Doek weg</button>}
                  <button className="fm-knop klein" style={{ color: '#B4123A' }} title={metDoekNu.length ? 'Frame wissen' : 'Wissen (Delete)'} onClick={frameWeg}>Frame weg</button>
                </div>
              )}
              <div className="fm-kop">Doek</div>
              <div className="fm-segment fm-ws-tabs" role="group" aria-label="Kant">
                {[['voor', 'Voorkant'], ['achter', 'Achterkant']].map(([k, n]) => <button key={k} className={kant === k ? 'aan' : ''} onClick={() => { setKant(k); naarKant(k); }}>{n}</button>)}
              </div>
              {schrijven && (
                <>
                  <select value={doekNu} onChange={(e) => metDoek(sel, kant, e.target.value)}>
                    <option value="">{gekozen.length > 1 && !gekozen.every((x) => x[kant] === gekozen[0][kant]) ? 'Verschillend' : 'Geen doek'}</option>
                    {doeken.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
                  </select>
                  <GridlabKnop planId={it.plan_id} drager="frame" klein onNieuw={(d) => metDoek(sel, kant, d.id)} />
                  {blokken.length > gekozen.length && doekNu && <button className="fm-knop klein" title="Dit doek op dezelfde kant van alle frames" onClick={() => metDoek(blokken.map((x) => x.i), kant, doekNu)}>Op alle frames</button>}
                  {doekNu && (() => {
                    const kp = `${kant}Pl`; const kk = `${kant}Over`;
                    const gs = new Set(gekozen.map((x) => x[kk]?.g).filter(Boolean));
                    const ids = new Set([...gekozen.map((x) => x.i), ...blokken.filter((x) => gs.has(x[kk]?.g)).map((x) => x.i)]);
                    const nu = gekozen.every((x) => (x[kp] || 'vullen') === (gekozen[0][kp] || 'vullen')) ? gekozen[0][kp] || 'vullen' : null;
                    return (<>
                      <div className="fm-segment fm-ws-tabs" role="group" aria-label="Plaatsing van het ontwerp">
                        {PLAATSINGEN.map(([k, n, tip]) => <button key={k} title={tip} className={nu === k ? 'aan' : ''} onClick={() => bewaar(blokken.map((x) => (ids.has(x.i) ? { ...x, [kp]: k === 'vullen' ? null : k } : x)))}>{n}</button>)}
                      </div>
                      {nu === 'herhalen' && (
                        <div className="fm-segment fm-ws-tabs" role="group" aria-label="Herhaling begint">
                          {STARTEN.map(([k, n]) => <button key={k} title={`Herhaling begint ${n.toLowerCase()}`} className={(gekozen[0][`${kant}St`] || 'rechts') === k ? 'aan' : ''} onClick={() => bewaar(blokken.map((x) => (ids.has(x.i) ? { ...x, [`${kant}St`]: k === 'rechts' ? null : k } : x)))}>{n}</button>)}
                        </div>
                      )}
                    </>);
                  })()}
                  {gekozen.length > 1 && (() => {
                    const kk = `${kant}Over`; const g0 = gekozen[0][kk]?.g; const een = !!g0 && gekozen.every((x) => x[kk]?.g === g0);
                    const o = een ? gekozen[0][kk] : null;
                    return (
                      <>
                        <div className="fm-segment fm-ws-tabs" role="group" aria-label="Doek over de frames">
                          <button className={!een ? 'aan' : ''} title="Elk frame een eigen doek" onClick={() => een && overSel(false)}>Per frame</button>
                          <button className={een ? 'aan' : ''} title="Eén groot doek over alle gekozen frames" onClick={() => !een && overSel(true)}>Eén doek</button>
                        </div>
                        {een && o?.b && <div className="fm-sub">Doek van {mm(o.b)} × {mm(o.h)} mm over {gekozen.length} frames</div>}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          ) : (
            <>
              <div className="fm-ws-rkop"><strong>{plaats ? 'Plaatsen' : 'Wand'}</strong></div>
              <div className="fm-sub">{plaats ? (plaats.groep.length > 1 ? `${plaats.groep.length} frames plaatsen. Klik in beeld; Enter of Esc stopt.` : `Frame ${mm(plaats.groep[0].b)} × ${mm(plaats.groep[0].h)}: klik in beeld om te plaatsen. R = draaien, Enter of Esc = stoppen.`) : 'Klik een frame in beeld (Shift + klik = meer, Ctrl + A = alles), of kies een frame in de bibliotheek.'}</div>
            </>
          )}
          <span style={{ flex: 1 }} />
          <div className="fm-kop">Voorraad</div>
          <div className="fm-wand-voorraad">
            {sleutels.map((k) => {
              const [b, hh] = k.split('x').map(Number); const n = voorraad[k] || 0; const max = I.voorraad[k];
              return <span key={k} className={`fm-wand-chip${max != null && n > max ? ' te' : ''}${!n ? ' leeg' : ''}`} title={max != null ? `${n} nodig${totaalTelling ? ' in dit plan' : ''}, ${max} in voorraad` : `${n} nodig`}>{mm(b)}×{mm(hh)} <b>{n}{max != null ? `/${max}` : ''}</b></span>;
            })}
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
