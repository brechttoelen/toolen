'use client';
import TerugKnop from './TerugKnop';

// Tentbouwer: de vorm van een tent in 3D. Sleep een wand op een zijde (of klik), kies het dak per travee.
// Kadertent en booghal per travee, pagodes gekoppeld in een rij, vouwtent als losse module.
// Indicatieve weergave: de tentbouwer bepaalt de constructie, verankering en ballast.
import { useBouwerSchild, schildProps } from './bouwerschild';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { webglKan } from './StellingStudio';
import { TentFotoBeeld } from './TentDrieGL';
const TentDrieGL = dynamic(() => import('./TentDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });
import { TENTTYPES, WANDEN, wandSoort, DAKEN, dakSoort, ALU, tentMaten, tentSegmenten, dakHoogte, tentTelling, ZIJDEN, segGroep, TERRAS_H, isTentBouw, tentTypeVan, tentGroep, stukKleur, intergevels, binnenOpeningen, wandPanelen, standaardWandVan, isVrijeTent, doekHoogte, stretchMasten, stretchPalen, sailPieken, sailOmtrek, RAND_H, frameRuns, frameLeden, runVan, runBuren, bannerMaat, FRAME_Z0, FRAME_Z1, FRAME_RAND, FRAME_UIT } from './tentbouw';
import { publiekeUrl } from './db';
import { DoekUpload } from './doekupload';
import TentVloerPlan, { VloerPalet } from './TentVloerPlan';
import { StellingPlannen } from './stellingplannen';

const getal = (v, d = 2) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: d });
const rad = (g) => (g * Math.PI) / 180;
const P2 = (q) => q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const standaardWand = standaardWandVan;
// Licht: elk vlak krijgt een tint volgens zijn stand, zodat wit doek ook vorm heeft.
const LICHT = (() => { const v = [-0.45, -0.65, 0.62]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
function tint(hex, pts, zacht = false) {
  if (!hex || hex[0] !== '#' || pts.length < 3) return hex;
  // Normaal volgens Newell (ook goed bij dubbele punten).
  const nv = [0, 0, 0];
  pts.forEach((p, k) => { const q = pts[(k + 1) % pts.length]; nv[0] += (p[1] - q[1]) * (p[2] + q[2]); nv[1] += (p[2] - q[2]) * (p[0] + q[0]); nv[2] += (p[0] - q[0]) * (p[1] + q[1]); });
  const l = Math.hypot(...nv); if (!l) return hex;
  const f = (zacht ? 0.86 : 0.74) + (zacht ? 0.14 : 0.26) * Math.abs((nv[0] * LICHT[0] + nv[1] * LICHT[1] + nv[2] * LICHT[2]) / l);
  const n = parseInt(hex.slice(1), 16); const k = (x) => Math.round(x * f).toString(16).padStart(2, '0');
  return `#${k((n >> 16) & 255)}${k((n >> 8) & 255)}${k(n & 255)}`;
}
// Kijkrichtingen in Nakijken (hoek, kantel van de 3D-camera).
const KIJK_T = { vrij: [32, 24], V: [-90, 6], L: [0, 6], A: [90, 6], R: [180, 6], boven: [0, 85] };
// Vertrekpunten bij een nieuwe tent: wand per zijde (de voorgevel krijgt de ingang).
const START_TENT = [
  { k: 'dicht', naam: 'Gesloten', uitleg: 'PVC wit rondom, dubbele deur in de voorgevel', wand: 'wit', voor: 'deur2' },
  { k: 'ramen', naam: 'Met ramen', uitleg: 'Vensterstroken in de zijwanden, glazen dubbele deur voor', wand: 'venster', gevel: 'wit', voor: 'glasdeur' },
  { k: 'hout', naam: 'Hospitality', uitleg: 'Houtlook met ramen rondom, houten dubbele deur voor', wand: 'hotlook', voor: 'houtdeur2' },
  { k: 'open', naam: 'Open', uitleg: 'Alle zijden open (marktkraam, overkapping)', wand: 'open' },
];
// Wat je best nakijkt: geen ingang, geen nooduitgang, bedrukte doeken of frames zonder ontwerp.
export function tentMeldingen(m, t, segs, standaard) {
  const uit = []; const soort = (k, zijde) => t.wanden?.[k] || (zijde === 'I' ? 'wit' : standaard);
  const allePan = (k) => Object.values(t.panelen?.[k] || {});
  const buiten = segs.filter((sg) => sg.zijde !== 'I');
  const ingang = buiten.some((sg) => { const w = wandSoort(soort(sg.key, sg.zijde)); if (w.deur || w.rits || w.rol || !w.kleur) return true; return allePan(sg.key).some((x) => { const q = wandSoort(x); return q.deur || q.rits || !q.kleur; }); });
  if (!ingang) uit.push({ soort: 'fout', tekst: 'Geen deur, ritsdeur of open zijde: er is geen ingang.' });
  const nood = buiten.some((sg) => soort(sg.key, sg.zijde) === 'nood' || allePan(sg.key).includes('nood'));
  const opp = m.L * m.B;
  if (opp >= 100 && !nood && buiten.some((sg) => wandSoort(soort(sg.key, sg.zijde)).kleur)) uit.push({ soort: 'let', tekst: `Tent van ${Math.round(opp)} m² zonder nooduitgang. Vraag na hoeveel er nodig zijn.` });
  const zonderOntwerp = segs.filter((sg) => soort(sg.key, sg.zijde) === 'doek' && !t.doeken?.[sg.key]).length;
  if (zonderOntwerp) uit.push({ soort: 'let', tekst: `${zonderOntwerp} ${zonderOntwerp === 1 ? 'wand' : 'wanden'} met bedrukt doek zonder ontwerp.` });
  const frames = Object.values(t.frames || {}).filter((v) => !v).length;
  if (frames) uit.push({ soort: 'let', tekst: `${frames} signing ${frames === 1 ? 'frame' : 'frames'} zonder banner.` });
  return uit;
}
export const MELDING_TENT = 'Indicatieve weergave. Enkel de plannen van de tentbouwer zijn bindend.';

// ---------- 3D ----------
// kies(seg) / dakKies(i) = klik op een wand of een dakvlak; drop(seg, data) = iets op een wand gesleept.
// Alles op de grond (vloer, terras, vloerlijnen) ligt onder wanden en dak: altijd eerst tekenen. Anders kwam
// een grote vloer met zijn gemiddelde diepte vóór de verre dakvlakken (gaten in het dak bij het draaien).
const GROND_Z = 0.12; const GROND_D = 1e6;
const TentDrieSvg = memo(TentDrie0);
// Groot beeld: echte 3D (three.js) zoals de stellingbouwer. Klein voorbeeld: een foto van die 3D. Zonder WebGL: de 2D-tekening.
function TentDrie1(props) {
  const [gl, setGl] = useState(false);
  useEffect(() => { setGl(webglKan()); }, []);
  const { it, el, tent, groep, items, doekMap, vloer, mini, kies, dakKies, drop, gekozen, gekozenPan, gekozenDak = null, kiesLid, sleepInter, zicht = null } = props;
  const interactief = props.interactief ?? !mini;
  const prims = useMemo(() => (gl ? tentTeken({ it, el, tent, groep, items, doekMap, vloer, mini: false, kies, dakKies, drop, gekozen, gekozenPan, kiesLid }).prims : null), [gl, it, el, tent, groep, items, doekMap, vloer, gekozen, gekozenPan]); // eslint-disable-line react-hooks/exhaustive-deps
  const [over, setOver] = useState(null);
  if (!gl || !prims) return <TentDrieSvg {...props} />;
  if (mini || !interactief) {
    const sleutel = JSON.stringify([tent || it?.velden?.tent || {}, el?.id, it?.parameters, (groep || []).map((g) => g.it?.id), vloer ? 1 : 0]);
    return <TentFotoBeeld prims={prims} sleutel={sleutel} terugval={<TentDrieSvg {...props} />} />;
  }
  const m = tentMaten({ ...it, velden: { ...(it?.velden || {}), tent: tent || it?.velden?.tent || {} } }, el);
  const kiesGl = (d) => { if (!d) { kies?.(null); return; } if (d.lid != null && kiesLid) { kiesLid(Number(d.lid)); return; } if (d.seg && kies) { kies(d.seg, d.pan != null ? Number(d.pan) : null); return; } if (d.dak != null && dakKies) { dakKies(Number(d.dak)); return; } kies?.(null); };
  const label = !over ? null : over.inter != null ? `Intergevel naar spant ${Math.max(1, Math.min(m.n - 1, Math.round(over.inter / m.travee)))}` : over.frame && over.seg ? `Banner op het signing frame (${segNaam(over.seg, m)})` : over.seg ? `Op ${segNaam(over.seg, m)}${over.pan != null ? ` · paneel ${Number(over.pan) + 1}` : ''}` : over.dak != null ? `Dak travee ${Number(over.dak) + 1}` : null;
  const kz = gekozenDak != null ? { dak: String(gekozenDak) } : gekozen ? { seg: gekozen, pan: gekozenPan != null ? String(gekozenPan) : null } : null;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TentDrieGL prims={prims} kies={kies || dakKies || kiesLid ? kiesGl : null} drop={drop || null} sleepInter={sleepInter || null} gekozen={kz} onOver={setOver} hoek={zicht?.[0] ?? 32} kantel={zicht?.[1] ?? 24} />
      {label && <span className="fm-tb-over">{label}</span>}
    </div>
  );
}
export const TentDrie = memo(TentDrie1);
// Duimnagel voor de bibliotheek: een tent van één travee (of de standaardmaat) in 3D.
export function TentDuim({ el, maat = 40, terugval = null }) {
  const [gl, setGl] = useState(false);
  useEffect(() => { setGl(webglKan()); }, []);
  const prims = useMemo(() => (gl ? tentTeken({ it: { parameters: {}, velden: { tent: {} } }, el, mini: true }).prims : null), [gl, el]);
  if (!prims) return terugval;
  return <TentFotoBeeld prims={prims} sleutel={`duim|${el.id}|${el.updated_at || ''}`} maat={maat} terugval={terugval} />;
}
// De tent als lijst van tekenstukken: SVG-lagen (2D-weergave) en dezelfde stukken in wereldcoördinaten (3D).
export function tentTeken({ it, el, tent, groep = null, items = null, doekMap = new Map(), vloer = false, mini = false, kies, dakKies, drop, gekozen = null, gekozenPan = null, kiesLid = null }, { stand = [32, 24], zoom = 1, schuif = [0, 0], maat = { w: 600, h: 400 }, clipPre = 'tg', over = null } = {}) {
  const t0 = tent || it?.velden?.tent || {};
  // De groep: deze tent (met de tent uit de bouwer) en de tenten die er op het plan aan gekoppeld zijn.
  const leden = (groep || [{ it, el, T: (q) => q, open: new Set() }]).map((g, k) => {
    const t = k === 0 ? t0 : g.it?.velden?.tent || {};
    return { ...g, k, t, hoofd: k === 0, vl: k === 0 ? vloer : !!g.it?.velden?.vloer, m: tentMaten({ ...g.it, velden: { ...(g.it?.velden || {}), tent: t } }, g.el) };
  });
  const th = rad(stand[0]); const ph = rad(stand[1]);
  // Omhullende van de hele groep (met luifels en terrassen).
  const rand = (g) => { const { m, t } = g; const lf = t.luifel || {}; const tr = t.terras || {}; const tt = (k) => Number(tr[k]) || 0;
    let x0 = -Math.max(Number(lf.V) || 0, tt('V')); let x1 = m.L + Math.max(Number(lf.A) || 0, tt('A')); let y0 = -tt('L'); let y1 = m.B + tt('R');
    for (const s of t.stukken || []) { x0 = Math.min(x0, s.x - s.b / 2); x1 = Math.max(x1, s.x + s.b / 2); y0 = Math.min(y0, s.y - s.d / 2); y1 = Math.max(y1, s.y + s.d / 2); }
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(g.T); };
  const allePt = leden.flatMap(rand); const gx = allePt.map((p) => p[0]); const gy = allePt.map((p) => p[1]);
  const cx = (Math.min(...gx) + Math.max(...gx)) / 2; const cy = (Math.min(...gy) + Math.max(...gy)) / 2; const hMax = Math.max(...leden.map((g) => g.m.nok));
  const proj = ([x0, y0, z]) => { const x = x0 - cx; const y = y0 - cy; const xr = x * Math.cos(th) - y * Math.sin(th); const yr = x * Math.sin(th) + y * Math.cos(th); return [xr, -z * Math.cos(ph) - yr * Math.sin(ph), yr * Math.cos(ph) - z * Math.sin(ph)]; };
  const hoekpunten = allePt.flatMap(([x, y]) => [proj([x, y, 0]), proj([x, y, hMax])]);
  const xs = hoekpunten.map((p) => p[0]); const ys = hoekpunten.map((p) => p[1]);
  const pad = mini ? 10 : 50;
  const s = Math.min((maat.w - pad * 2) / Math.max(1, Math.max(...xs) - Math.min(...xs)), (maat.h - pad * 2) / Math.max(1, Math.max(...ys) - Math.min(...ys)), 140) * zoom;
  const ox = maat.w / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * s + schuif[0]; const oy = maat.h / 2 - ((Math.min(...ys) + Math.max(...ys)) / 2) * s + schuif[1];
  let lidNu = null; // gekoppelde tent die nu getekend wordt (klik = die tent bewerken)
  let Tf = (q) => q; // omzetting van de tent die nu getekend wordt naar de eerste tent
  const W3 = (q) => { const [x, y] = Tf([q[0], q[1]]); return [x, y, q[2]]; };
  const S = (q) => { const p = proj(W3(q)); return [p[0] * s + ox, p[1] * s + oy, p[2]]; };
  const lagen = []; const prims = [];
  const dataVan = (x = {}) => { const d = {}; for (const k of ['data-seg', 'data-pan', 'data-dak', 'data-lid', 'data-frame']) if (x[k] != null) d[k.slice(5)] = String(x[k]); return d; };
  let bias = 0; // dieptecorrectie (wanden onder een stretchdoek)
  let vast = null; // diepte van de wand waar details (deur, raam, lijnen) op liggen: altijd vóór die wand getekend
  const vlak = (pts, vul, rnd, extra = {}, dd = 0) => { const lid = lidNu; if (lid != null && kiesLid) extra = { ...extra, 'data-lid': lid, style: { cursor: 'pointer' } }; const q = pts.map(S); const w = pts.map(W3); prims.push({ k: 'vlak', w, vul, rand: rnd, op: extra.fillOpacity ?? 1, data: dataVan(extra) }); const z = rnd === 'vul'; lagen.push({ d: w.every((p) => p[2] <= GROND_Z) ? GROND_D + q.reduce((a, p) => a + p[2], 0) / q.length - (Number(dd) || 0) : dd === 'min' ? Math.min(...q.map((p) => p[2])) - 0.02 - bias : vast != null && dd > 0 ? vast - dd : q.reduce((a, p) => a + p[2], 0) / q.length - dd - bias, el: (k) => <polygon key={k} points={P2(q)} fill={vul ? tint(vul, w, z) : 'none'} stroke={z ? tint(vul, w, z) : rnd || 'none'} strokeWidth={0.8} strokeLinejoin="round" {...extra} /> }); };
  const lijn = (a, b, kl, w = 1, dd = 0, extra = {}) => { const p = S(a); const q = S(b); prims.push({ k: 'lijn', a: W3(a), b: W3(b), kl, w, data: dataVan(extra) }); lagen.push({ d: a[2] <= GROND_Z && b[2] <= GROND_Z ? GROND_D + (p[2] + q[2]) / 2 - (Number(dd) || 0) - 0.01 : dd === 'min' ? Math.min(p[2], q[2]) - 0.05 - bias : vast != null && dd > 0 ? vast - dd : (p[2] + q[2]) / 2 - dd - bias, el: (k) => <line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={kl} strokeWidth={w} strokeLinecap="round" {...extra} /> }); };
  // Beeld op een rechthoek (affiene projectie: een rechthoek wordt een parallellogram).
  const beeld = (lb, rb, lo, href, dd = 0) => { const A = S(lb); const B = S(rb); const C = S(lo); prims.push({ k: 'beeld', A: W3(lb), B: W3(rb), C: W3(lo), href }); const d = dd === 'min' ? Math.min(A[2], B[2], C[2], B[2] + C[2] - A[2]) - 0.03 - bias : (A[2] + B[2] + C[2]) / 3 - dd;
    lagen.push({ d, el: (k) => <image key={k} href={href} x={0} y={0} width={1} height={1} preserveAspectRatio="none" transform={`matrix(${B[0] - A[0]} ${B[1] - A[1]} ${C[0] - A[0]} ${C[1] - A[1]} ${A[0]} ${A[1]})`} style={{ pointerEvents: 'none' }} /> }); };
  // Beeld over een vlak met een eigen omtrek (bv. een doek over de hele gevel, met de spits).
  let clipN = 0;
  const beeldVorm = (lb, rb, lo, omtrek, href, dd = 0) => { const A = S(lb); const B = S(rb); const C = S(lo); const q = omtrek.map(S); prims.push({ k: 'beeld', A: W3(lb), B: W3(rb), C: W3(lo), omtrek: omtrek.map(W3), href }); const d = Math.min(...q.map((p) => p[2])) - dd; const id = `${clipPre}-${clipN++}`;
    lagen.push({ d, el: (k) => <g key={k} style={{ pointerEvents: 'none' }}><clipPath id={id}><polygon points={P2(q)} /></clipPath><g clipPath={`url(#${id})`}><image href={href} x={0} y={0} width={1} height={1} preserveAspectRatio="none" transform={`matrix(${B[0] - A[0]} ${B[1] - A[1]} ${C[0] - A[0]} ${C[1] - A[1]} ${A[0]} ${A[1]})`} /></g></g> }); };
  const lw = mini ? 0.6 : 1; const kolom = mini ? 1.4 : 2.6; const geen = { style: { pointerEvents: 'none' } };
  // Trap naar buiten: p0 → p1 is de voorkant van het bordes, n = naar buiten, h = hoogte.
  const trap = (p0, p1, n, h) => {
    const k = Math.max(1, Math.ceil(h / 0.18)); const tr = 0.3;
    for (let i = 0; i < k; i++) {
      const a = i * tr; const b = (i + 1) * tr; const ztop = (h * (k - i)) / (k + 1);
      const Q = (p, f) => [p[0] + n[0] * f, p[1] + n[1] * f];
      vlak([[...Q(p0, a), ztop], [...Q(p1, a), ztop], [...Q(p1, b), ztop], [...Q(p0, b), ztop]], '#B08B5A', '#6B4423', geen);
      vlak([[...Q(p0, b), 0], [...Q(p1, b), 0], [...Q(p1, b), ztop], [...Q(p0, b), ztop]], '#9A7448', '#6B4423', geen);
    }
  };
  // Leuning langs a → b op hoogte h (staanders om de 2 m).
  const leuning = (a, b, h) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.05) return; const n = Math.max(1, Math.ceil(l / 2));
    for (let i = 0; i <= n; i++) { const f = i / n; const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; lijn([...p, h], [...p, h + 1], '#4B5563', 1.4 * lw, 0.01); }
    lijn([...a, h + 1], [...b, h + 1], '#374151', 1.6 * lw, 0.01); lijn([...a, h + 0.5], [...b, h + 0.5], '#6B7280', 1 * lw, 0.01);
  };

  // Stretchtent en sailcloth tent: doek als vlakkennet, met masten, palen en spanbanden.
  const vrijeTent = (g) => {
    const { m, t, hoofd } = g; const dk = dakSoort(t.doek || t.dak || (m.type === 'sail' ? 'zeildoek' : 'wit'));
    const dakD = hoofd ? { 'data-dak': 0, style: { cursor: dakKies ? 'pointer' : undefined } } : geen;
    const hout = '#A47148'; const staal = '#6B7280';
    if (m.type === 'stretch') {
      const Z = (x, y) => doekHoogte(m, t, x, y);
      const nx = mini ? 12 : Math.min(40, Math.max(14, Math.round(m.L / 0.5))); const ny = mini ? 8 : Math.min(32, Math.max(10, Math.round(m.B / 0.5)));
      const X = (i) => (m.L * i) / nx; const Y = (j) => (m.B * j) / ny;
      const H = Array.from({ length: nx + 1 }, (_, i) => Array.from({ length: ny + 1 }, (_, j) => Z(X(i), Y(j))));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) vlak([[X(i), Y(j), H[i][j]], [X(i + 1), Y(j), H[i + 1][j]], [X(i + 1), Y(j + 1), H[i + 1][j + 1]], [X(i), Y(j + 1), H[i][j + 1]]], dk.kleur, 'vul', { fillOpacity: dk.dekking, strokeWidth: 0.6, ...dakD });
      // Zijde tot op de grond: het doek loopt verder naar buiten tot op de grond.
      const zij = { L: [[0, 0], [m.L, 0], [0, -1]], A: [[m.L, 0], [m.L, m.B], [1, 0]], R: [[m.L, m.B], [0, m.B], [0, 1]], V: [[0, m.B], [0, 0], [-1, 0]] };
      for (const [z, [a, b, n]] of Object.entries(zij)) if (t.grond?.[z]) {
        const k = mini ? 6 : 14; for (let i = 0; i < k; i++) { const p = (f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; const p0 = p(i / k); const p1 = p((i + 1) / k);
          vlak([[...p0, Z(...p0)], [...p1, Z(...p1)], [p1[0] + n[0] * 0.9, p1[1] + n[1] * 0.9, 0.02], [p0[0] + n[0] * 0.9, p0[1] + n[1] * 0.9, 0.02]], dk.kleur, 'vul', { fillOpacity: dk.dekking, strokeWidth: 0.6, ...dakD }); }
      }
      for (const ms of stretchMasten(m, t)) { lijn([ms.x, ms.y, 0], [ms.x, ms.y, ms.h + 0.2], staal, kolom * 1.1, 0.02); }
      for (const pl of stretchPalen(m, t)) {
        const z = Z(pl.x + pl.n[0] * 0.01, pl.y + pl.n[1] * 0.01); lijn([pl.x, pl.y, 0], [pl.x, pl.y, z + 0.15], staal, kolom * 0.8, 0.01);
        if (!mini) { const q = [pl.x + pl.n[0] * 1.6, pl.y + pl.n[1] * 1.6]; lijn([pl.x, pl.y, z + 0.1], [...q, 0], '#9CA3AF', 0.7 * lw, 0.01); }
      }
      return;
    }
    // Sailcloth: ringen van de middellijn naar de omtrek, hoogte uit sailHoogte.
    const pk = sailPieken(m, t); const R = m.B / 2; const x0 = pk[0][0]; const x1 = pk[pk.length - 1][0];
    const fijn = []; const stap = mini ? 1.2 : 0.5; const rx = Math.min(R, m.L / 2);
    const xs = [...new Set([...Array.from({ length: Math.max(1, Math.round((x1 - x0) / stap)) + 1 }, (_, k) => x0 + ((x1 - x0) * k) / Math.max(1, Math.round((x1 - x0) / stap))), ...pk.map((p) => p[0])])].sort((a, b) => a - b);
    if (x1 - x0 > 0.01) for (const x of xs.slice(0, -1)) fijn.push([x, 0]);
    const nb = Math.max(8, Math.round((Math.PI * R) / stap)); for (let k = 0; k < nb; k++) { const a = -Math.PI / 2 + (Math.PI * k) / nb; fijn.push([x1 + rx * Math.cos(a), R + R * Math.sin(a)]); }
    if (x1 - x0 > 0.01) for (const x of [...xs].reverse().slice(0, -1)) fijn.push([x, m.B]);
    for (let k = 0; k < nb; k++) { const a = Math.PI / 2 + (Math.PI * k) / nb; fijn.push([x0 + rx * Math.cos(a), R + R * Math.sin(a)]); }
    const J = mini ? 4 : 10; const kern = (b) => [Math.max(x0, Math.min(x1, b[0])), R];
    const pt = (b, j) => { const c = kern(b); const f = j / J; const x = c[0] + (b[0] - c[0]) * f; const y = c[1] + (b[1] - c[1]) * f; return [x, y, doekHoogte(m, t, x, y)]; };
    for (let k = 0; k < fijn.length; k++) { const b0 = fijn[k]; const b1 = fijn[(k + 1) % fijn.length];
      for (let j = 0; j < J; j++) vlak([pt(b0, j), pt(b1, j), pt(b1, j + 1), pt(b0, j + 1)], dk.kleur, 'vul', { fillOpacity: dk.dekking, strokeWidth: 0.6, ...dakD }); }
    // Volant aan de dakrand, middenmasten met piek, zijpalen met scheerlijnen.
    const om = sailOmtrek(m);
    for (let k = 0; k < fijn.length; k++) { const a = fijn[k]; const b = fijn[(k + 1) % fijn.length]; vlak([[...a, m.zijH], [...b, m.zijH], [...b, m.zijH - 0.3], [...a, m.zijH - 0.3]], dk.kleur, 'vul', { fillOpacity: Math.max(0.8, dk.dekking), strokeWidth: 0.5, ...geen }); }
    for (const p of pk) lijn([p[0], p[1], 0], [p[0], p[1], m.nok + 0.6], hout, kolom * 1.3, 0.02);
    for (let k = 0; k < om.length - 1; k++) {
      const p = om[k]; const vorige = om[(k - 1 + om.length - 1) % (om.length - 1)]; const volg = om[k + 1]; const dx = volg[0] - vorige[0]; const dy = volg[1] - vorige[1]; const l = Math.hypot(dx, dy) || 1;
      lijn([p[0], p[1], 0], [p[0], p[1], m.zijH + 0.15], hout, kolom * 0.8, 0.01);
      if (!mini) lijn([p[0], p[1], m.zijH + 0.1], [p[0] + (dy / l) * 1.8, p[1] - (dx / l) * 1.8, 0], '#9CA3AF', 0.7 * lw, 0.01);
    }
  };
  for (const g of leden) {
    Tf = g.T; lidNu = g.hoofd ? null : g.k; const { m, t } = g; const alu = ALU[t.kleur] || ALU.naturel; const hoofd = g.hoofd;
    const vh = Math.max(0, Number(t.vloerH) || 0);
    // Deuren en ramen die in het binnenplan van deze tent getekend zijn, per segment.
    const binnen = new Map(); for (const o of items ? binnenOpeningen({ ...g.it, velden: { ...(g.it?.velden || {}), tent: t } }, g.el, items) : []) binnen.set(o.key, [...(binnen.get(o.key) || []), o]);
    const lf = t.luifel || {}; const lV = Number(lf.V) || 0; const lA = Number(lf.A) || 0;
    // Vloer (verhoogd: met zijkant, zichtbaar door transparante wanden).
    if (g.vl || vh > 0) {
      const vkl = typeof g.vl === 'object' && g.vl ? stukKleur(g.vl) : '#C9A26B';
      const z = Math.max(0.06, vh); vlak((m.type === 'sail' ? sailOmtrek(m).slice(0, -1) : [[0, 0], [m.L, 0], [m.L, m.B], [0, m.B]]).map(([x, y]) => [x, y, z]), vkl, '#8A6A45', geen, -0.5);
      if (vh > 0.1) { const e = 0.06; const c = [[e, e], [m.L - e, e], [m.L - e, m.B - e], [e, m.B - e]]; for (let k = 0; k < 4; k++) { const p = c[k]; const q = c[(k + 1) % 4]; vlak([[...p, 0], [...q, 0], [...q, z], [...p, z]], '#A9844F', '#8A6A45', geen, 0.3); } }
    }

    // Wanden per segment (gekoppelde zijden zijn open, tenzij er bewust een wand op staat).
    const segs = tentSegmenten(m, t);
    for (const sg of segs) {
      const gekop = g.open.has(sg.key) && !t.wanden?.[sg.key];
      // Doek over de hele gevel (zijwand + spits): de wanden van die gevel worden dat doek.
      const gDoek = !gekop && (sg.zijde === 'V' || sg.zijde === 'A' || sg.zijde === 'I') && (m.type === 'kader' || m.type === 'boog') ? t.gevelDoek?.[sg.zijde === 'I' ? `I-${sg.sp}` : sg.zijde] || null : null;
      const w = gekop ? wandSoort('open') : gDoek ? wandSoort('doek') : wandSoort(t.wanden?.[sg.key] || (sg.zijde === 'I' ? 'wit' : standaardWand(m)));
      const [ax, ay] = sg.a; const [bx, by] = sg.b; const len = Math.hypot(bx - ax, by - ay);
      const P = (f, z) => [ax + (bx - ax) * f, ay + (by - ay) * f, z];
      const aan = hoofd && gekozen === sg.key;
      // Stretchtent: de wand loopt tot onder het doek (de bovenkant volgt het doek); anders de zijwandhoogte.
      const vrij = m.type === 'stretch'; const NB = vrij ? 6 : 0;
      const tops = vrij ? Array.from({ length: NB + 1 }, (_, k) => { const p = P(k / NB, 0); return [p[0], p[1], Math.max(1.8, doekHoogte(m, t, p[0], p[1]) - 0.05)]; }) : null;
      const zh = vrij ? Math.min(...tops.map((q) => q[2])) : m.zijH; bias = vrij ? -0.8 : 0;
      const data = hoofd ? { 'data-seg': sg.key, style: { cursor: kies || drop ? 'pointer' : undefined } } : geen;
      const top = (sg.zijde === 'V' || sg.zijde === 'A' || sg.zijde === 'I') && (m.type === 'kader' || m.type === 'boog');
      // Gevelvlak boven de zijwand: dicht (dakzeil) of transparant; een intergevel loopt door tot het dak.
      const gv = sg.zijde === 'I' ? 'dicht' : (t.gevelZ?.[sg.zijde] || t.gevel || 'dicht');
      if (top && !(gekop && sg.zijde !== 'I') && (gv !== 'open' || gDoek)) {
        const n = 10; const tp = Array.from({ length: n + 1 }, (_, k) => { const p = P(k / n, 0); return [p[0], p[1], dakHoogte(m, p[0], p[1])]; });
        const gdo = gDoek ? doekMap.get(gDoek) : null;
        const dk = gDoek ? { kleur: gdo?.eigenschappen?.kleur || '#0F766E', dekking: 0.97 } : gv === 'transparant' ? dakSoort('transparant') : dakSoort(t.dakPer?.[sg.zijde === 'V' ? 0 : sg.zijde === 'A' ? m.n - 1 : sg.sp] || t.dak);
        vlak([P(0, zh), ...tp, P(1, zh)], dk.kleur, '#9CA3AF', { fillOpacity: dk.dekking, ...data });
        if (gv === 'transparant' && !mini) for (const f of [1 / 3, 2 / 3]) { const p = P(f, 0); lijn([p[0], p[1], zh], [p[0], p[1], dakHoogte(m, p[0], p[1])], alu, kolom * 0.6, 0.01); }
      }
      if (gekop) { if (hoofd && !mini) lijn(P(0, zh), P(1, zh), '#0E7490', 3 * lw, 0.02); continue; }
      // Wand in panelen van ± 1 m: per paneel een soort (raam, paneel, deur …); een dubbele deur is 2 panelen breed.
      const panelen = gDoek ? [{ i: 0, n: 1, f0: 0, f1: 1, soort: 'doek', w: wandSoort('doek') }] : wandPanelen(m, t, sg, sg.zijde === 'I' ? 'wit' : standaardWand(m));
      const heelDoek = w.doek && panelen.length === 1 || (w.doek && panelen.every((x) => x.w.doek));
      for (const pn of panelen) {
        const pw = pn.w; const F = (u) => pn.f0 + (pn.f1 - pn.f0) * u; const Q = (u, z) => P(F(u), z); const pl = len * (pn.f1 - pn.f0);
        const pd = hoofd ? { 'data-seg': sg.key, 'data-pan': pn.i, style: { cursor: kies || drop ? 'pointer' : undefined } } : geen;
        const paan = aan && (gekozenPan == null || gekozenPan === pn.i);
        if (pw.rol) { lijn(Q(0, zh - 0.15), Q(1, zh - 0.15), '#E5E7EB', (mini ? 3 : 7) * lw, -0.01); lijn(Q(0, zh - 0.15), Q(1, zh - 0.15), '#9CA3AF', 0.8, -0.011); }
        if (pw.k === 'open' || pw.rol) {
          if (paan || (hoofd && kies)) vlak([Q(0, 0.02), Q(1, 0.02), Q(1, zh), Q(0, zh)], paan ? '#2563EB' : '#FFFFFF', paan ? '#2563EB' : 'none', { fillOpacity: paan ? 0.12 : 0.001, strokeDasharray: '5 4', ...pd }, -0.01);
          continue;
        }
        const ontwerp = pw.doek ? doekMap.get(gDoek || t.doeken?.[sg.key]) : null;
        const kl = pw.doek ? ontwerp?.eigenschappen?.kleur || pw.kleur : pw.kleur;
        const boven = vrij && panelen.length === 1 ? [...tops].reverse() : [Q(1, zh), Q(0, zh)];
        vast = null; vlak([Q(0, 0), Q(1, 0), ...boven], kl, paan ? '#2563EB' : '#B6BCC4', { fillOpacity: pw.dekking, strokeWidth: paan ? 2.5 : 0.7, ...pd });
        vast = lagen[lagen.length - 1].d;
        if (mini && !pw.deur && !pw.raster) continue;
        if (pw.strook) vlak([Q(0.05, 1.0), Q(0.95, 1.0), Q(0.95, 1.7), Q(0.05, 1.7)], '#BFDBFE', '#93C5FD', { fillOpacity: 0.6, ...geen }, 0.005);
        // Hotlook: ramen in een wit kader (onderaan en bovenaan dicht).
        if (pw.raster) {
          const kol = Math.max(1, Math.round(pl / 1.1)); const rij = 3; const z0 = Math.min(0.6, zh * 0.2); const z1 = zh - Math.min(0.45, zh * 0.14); const rv = 0.08; const rh = (z1 - z0) / rij;
          for (let c = 0; c < kol; c++) for (let r = 0; r < rij; r++) { const f0 = (c + rv) / kol; const f1 = (c + 1 - rv) / kol; vlak([Q(f0, z0 + r * rh + 0.05), Q(f1, z0 + r * rh + 0.05), Q(f1, z0 + (r + 1) * rh - 0.05), Q(f0, z0 + (r + 1) * rh - 0.05)], '#1F2937', mini ? 'none' : '#CBD5E1', { fillOpacity: 0.55, ...geen }, 0.005); }
        }
        // Houtlook: liggende planken van ± 15 cm.
        if (pw.hout && !mini) for (let z = 0.15; z < zh - 0.05; z += 0.15) lijn(Q(0, z), Q(1, z), '#7A4E2D', 0.45 * lw, 0.005);
        if (pw.vakken) for (const z of [0.6, zh - 0.45]) lijn(Q(0, z), Q(1, z), pw.hout ? '#5C3A21' : '#CBD5E1', 0.8 * lw, 0.006);
        if (pw.glas && !pw.deur) lijn(Q(0, 1.0), Q(1, 1.0), alu, 0.8 * lw, 0.006);
        if (pw.paneel) for (let z = 0.5; z < zh; z += 0.5) lijn(Q(0, z), Q(1, z), '#9CA3AF', 0.6 * lw, 0.006);
        if (pw.rits) lijn(Q(0.5, 0), Q(0.5, zh - 0.05), '#374151', 1.2 * lw, 0.006, { strokeDasharray: '3 2' });
        if (pw.deur) {
          // Deur: 0,9 m (enkel) of 1,8 m (dubbel) in zijn paneel(en), duidelijk getekend met kader en klinken.
          const db = Math.min(pl - 0.08, pn.n === 2 ? 1.8 : 0.9); const f0 = 0.5 - db / pl / 2; const f1 = 0.5 + db / pl / 2; const dh = Math.min(vh + 2.1, zh - 0.1);
          vlak([Q(f0, vh), Q(f1, vh), Q(f1, dh), Q(f0, dh)], pw.glas ? '#93C5FD' : pw.hout ? '#7A4E2D' : '#9CA3AF', pw.hout ? '#3F2615' : '#111827', { fillOpacity: pw.glas ? 0.75 : 0.95, strokeWidth: 1.8 * lw, ...pd }, 0.006);
          // Houtlook-deur: staande planken.
          if (pw.hout && !mini) { const nb = Math.max(3, Math.round(db / 0.15)); for (let k2 = 1; k2 < nb; k2++) { const u = f0 + ((f1 - f0) * k2) / nb; lijn(Q(u, vh + 0.03), Q(u, dh - 0.03), '#5C3A21', 0.5 * lw, 0.0065); } }
          const zk = vh + 1.05;
          if (pn.n === 2) { lijn(Q(0.5, vh), Q(0.5, dh), '#1F2937', 1.2 * lw, 0.007); if (!mini) for (const u of [0.5 - 0.06 / pl, 0.5 + 0.06 / pl]) lijn(Q(u, zk - 0.08), Q(u, zk + 0.08), '#111827', 2 * lw, 0.008); }
          else if (!mini) lijn(Q(f1 - 0.1 / pl, zk - 0.08), Q(f1 - 0.1 / pl, zk + 0.08), '#111827', 2 * lw, 0.008);
          if (pw.nood) vlak([Q(0.5 - 0.2 / pl, dh + 0.06), Q(0.5 + 0.2 / pl, dh + 0.06), Q(0.5 + 0.2 / pl, dh + 0.26), Q(0.5 - 0.2 / pl, dh + 0.26)], '#16A34A', '#166534', geen, 0.007);
          // Verhoogde vloer zonder terras aan die zijde: een trapje voor de deur.
          if (vh > 0.15 && sg.zijde !== 'I' && !(Number(t.terras?.[sg.zijde]) > 0)) { const nx = (by - ay) / len; const ny = -(bx - ax) / len; trap(Q(f0, 0), Q(f1, 0), [nx, ny], vh); }
        }
      }
      vast = null;
      // Bedrukt doek over de hele wand: het beeld over het segment.
      const ontwerpS = heelDoek && !gDoek ? doekMap.get(t.doeken?.[sg.key]) : null;
      if (ontwerpS?.eigenschappen?.beeld) beeld(P(0, zh), P(1, zh), P(0, 0), publiekeUrl(ontwerpS.eigenschappen.beeld), 0.005);
      vast = S(P(0.5, zh * 0.6))[2];
      for (const o of binnen.get(sg.key) || []) {
        const f0 = Math.max(0, o.f - o.b / len / 2); const f1 = Math.min(1, o.f + o.b / len / 2);
        if (o.type === 'raam') vlak([P(f0, vh + 1), P(f1, vh + 1), P(f1, Math.min(zh - 0.2, vh + 2)), P(f0, Math.min(zh - 0.2, vh + 2))], '#BFDBFE', '#475569', { fillOpacity: 0.8, ...geen }, 0.009);
        else { const dh = Math.min(vh + 2.1, zh - 0.1); vlak([P(f0, vh), P(f1, vh), P(f1, dh), P(f0, dh)], '#94A3B8', '#1F2937', { fillOpacity: 0.95, strokeWidth: 1.4 * lw, ...geen }, 0.009); if (o.dubbel) lijn(P((f0 + f1) / 2, vh), P((f0 + f1) / 2, dh), '#374151', lw, 0.01); }
      }
    }

    bias = 0; vast = null;
    // Doek over de hele gevel: één beeld over zijwand en spits.
    if (m.type === 'kader' || m.type === 'boog') for (const z of ['V', 'A', ...intergevels(m, t).map((sp) => `I-${sp}`)]) {
      const gd = t.gevelDoek?.[z] && doekMap.get(t.gevelDoek[z]); if (!gd?.eigenschappen?.beeld || g.open.has(`${z}-0`)) continue;
      // Intergevel: het beeld leesbaar vanaf de voorkant (zoals de voorgevel).
      const x = z === 'V' ? 0 : z === 'A' ? m.L : Number(z.split('-')[1]) * m.travee; const yl = z === 'A' ? 0 : m.B; const yr = z === 'A' ? m.B : 0; const n = 16;
      const omtrek = [[x, yl, 0], [x, yr, 0], ...Array.from({ length: n + 1 }, (_, k) => { const y = yr + ((yl - yr) * k) / n; return [x, y, dakHoogte(m, x, y)]; })];
      beeldVorm([x, yl, m.nok], [x, yr, m.nok], [x, yl, 0], omtrek, publiekeUrl(gd.eigenschappen.beeld), -0.03);
    }
    // Terrassen: bordes met leuning en een trap in het midden van de buitenrand.
    const th0 = Number(t.terrasH) > 0 ? Number(t.terrasH) : vh > 0 ? vh : TERRAS_H;
    for (const [z, d0] of Object.entries(t.terras || {})) {
      const d = Number(d0) || 0; if (d <= 0) continue;
      const kant = { V: [[0, m.B], [0, 0], [-1, 0]], A: [[m.L, 0], [m.L, m.B], [1, 0]], L: [[0, 0], [m.L, 0], [0, -1]], R: [[m.L, m.B], [0, m.B], [0, 1]] }[z]; if (!kant) continue;
      const [p0, p1, n] = kant; const O = (p, f) => [p[0] + n[0] * f, p[1] + n[1] * f]; const q0 = O(p0, d); const q1 = O(p1, d);
      vlak([[...p0, th0], [...p1, th0], [...q1, th0], [...q0, th0]], '#C9A26B', '#8A6A45', geen);
      for (const [a, b] of [[q0, q1], [p0, q0], [p1, q1]]) vlak([[...a, 0], [...b, 0], [...b, th0], [...a, th0]], '#A9844F', '#8A6A45', geen);
      const l = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]); const tb = Math.min(1.5, l - 0.5); const fm0 = 0.5 - tb / l / 2; const fm1 = 0.5 + tb / l / 2;
      const Lq = (f) => [q0[0] + (q1[0] - q0[0]) * f, q0[1] + (q1[1] - q0[1]) * f];
      if (th0 > 0.2) { leuning(q0, Lq(fm0), th0); leuning(Lq(fm1), q1, th0); trap(Lq(fm0), Lq(fm1), n, th0); } else leuning(q0, q1, th0);
      if (th0 > 0.2) { leuning(p0, q0, th0); leuning(p1, q1, th0); }
    }

    // Losse vloerstukken (terras, podium, rijplaten) zoals gelegd in "Vloer leggen".
    for (const s of t.stukken || []) {
      const hb = Number(s.b) / 2; const hd = Number(s.d) / 2; const x0 = Number(s.x) - hb; const x1 = Number(s.x) + hb; const y0 = Number(s.y) - hd; const y1 = Number(s.y) + hd;
      const z = Math.max(0.04, Number(s.h) || 0); const kl = s.kleur || '#C9A26B';
      vlak([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], kl, '#4B3A26', { ...geen, strokeWidth: 0.6 });
      for (const [a, b] of [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]]) vlak([[...a, 0], [...b, 0], [...b, z], [...a, z]], kl, '#4B3A26', { ...geen, fillOpacity: 0.85, strokeWidth: 0.5 });
    }

    if (isVrijeTent(m)) vrijeTent(g);
    else {
    // Dak
    // Dakvlakken op hun dichtste punt sorteren: lange vlakken vallen anders weg achter gevels en palen bij het draaien.
    const dakVlak = (pts, i, dk, extra = {}) => vlak(pts, dk.kleur, '#9CA3AF', { fillOpacity: dk.dekking, ...(hoofd ? { 'data-dak': i, style: { cursor: dakKies ? 'pointer' : undefined } } : geen), ...extra }, 'min');
    for (let i = 0; i < m.n; i++) {
      const x0 = i * m.travee; const x1 = (i + 1) * m.travee; const dk = dakSoort(t.dakPer?.[i] || t.dak);
      const banden = dk.streep && !mini ? 4 : 1;
      for (let bnd = 0; bnd < banden; bnd++) {
        const a = x0 + ((x1 - x0) * bnd) / banden; const b = x0 + ((x1 - x0) * (bnd + 1)) / banden; const kl = dk.streep && bnd % 2 ? { ...dk, kleur: dk.streep } : dk;
        if (m.type === 'kader') {
          dakVlak([[a, 0, m.zijH], [b, 0, m.zijH], [b, m.B / 2, m.nok], [a, m.B / 2, m.nok]], i, kl);
          dakVlak([[a, m.B, m.zijH], [b, m.B, m.zijH], [b, m.B / 2, m.nok], [a, m.B / 2, m.nok]], i, kl);
        } else if (m.type === 'boog') {
          const n = mini ? 6 : 12;
          for (let k = 0; k < n; k++) { const y0 = (m.B * k) / n; const y1 = (m.B * (k + 1)) / n; dakVlak([[a, y0, dakHoogte(m, a, y0)], [b, y0, dakHoogte(m, b, y0)], [b, y1, dakHoogte(m, b, y1)], [a, y1, dakHoogte(m, a, y1)]], i, kl); }
        }
      }
      if (m.type === 'pagode' || m.type === 'vouw') {
        const tp = [(x0 + x1) / 2, m.B / 2, m.nok]; const c = [[x0, 0], [x1, 0], [x1, m.B], [x0, m.B]];
        // Pagode: hol puntdak (vlak aan de rand, steil naar de piek); vouwtent: rechte vlakken.
        const nb = m.type === 'pagode' ? (mini ? 3 : 6) : 1; const zf = (f) => m.zijH + (m.nok - m.zijH) * (m.type === 'pagode' ? f ** 1.7 : f);
        const L2 = (a, f) => [a[0] + (tp[0] - a[0]) * f, a[1] + (tp[1] - a[1]) * f, zf(f)];
        for (let k = 0; k < 4; k++) {
          const p = c[k]; const q = c[(k + 1) % 4]; const kl = dk.streep && k % 2 ? { ...dk, kleur: dk.streep } : dk;
          for (let b = 0; b < nb; b++) { const f0 = b / nb; const f1 = (b + 1) / nb; dakVlak(b === nb - 1 ? [L2(p, f0), L2(q, f0), tp] : [L2(p, f0), L2(q, f0), L2(q, f1), L2(p, f1)], i, kl); }
        }
        for (let k = 0; k < 4; k++) { const p = c[k]; const q = c[(k + 1) % 4]; vlak([[p[0], p[1], m.zijH], [q[0], q[1], m.zijH], [q[0], q[1], m.zijH - 0.22], [p[0], p[1], m.zijH - 0.22]], dk.kleur, '#9CA3AF', { fillOpacity: Math.max(0.6, dk.dekking), ...geen }); }
        if (m.type === 'pagode') lijn(tp, [tp[0], tp[1], m.nok + 0.35], alu, 2 * lw, -0.01);
      }
    }

    // Constructie: staanders, dakliggers, gevelstaanders, dakrand.
    const spanten = Array.from({ length: m.n + 1 }, (_, k) => k * m.travee);
    for (const x of spanten) {
      for (const y of [0, m.B]) lijn([x, y, 0], [x, y, m.zijH], alu, kolom, 0.01);
      if (m.type === 'kader' || m.type === 'boog') { const n = m.type === 'kader' ? 2 : 12; for (let k = 0; k < n; k++) { const y0 = (m.B * k) / n; const y1 = (m.B * (k + 1)) / n; lijn([x, y0, dakHoogte(m, x, y0)], [x, y1, dakHoogte(m, x, y1)], alu, kolom * 0.85, 'min'); } }
    }
    for (const y of [0, m.B]) lijn([0, y, m.zijH], [m.L, y, m.zijH], alu, kolom * 0.7, 0.01);
    if (m.type === 'kader') lijn([0, m.B / 2, m.nok], [m.L, m.B / 2, m.nok], alu, kolom * 0.6, 'min');
    if (m.type === 'kader' || m.type === 'boog') for (const sg of segs.filter((x) => (x.zijde === 'V' || x.zijde === 'A' || x.zijde === 'I') && !t.gevelVrij?.[x.zijde])) { const [x, y] = sg.b; if (y > 0.01 && y < m.B - 0.01) lijn([x, y, 0], [x, y, dakHoogte(m, x, y)], alu, kolom * 0.8, 0.01); }
    if (m.type === 'pagode' || m.type === 'vouw') for (let i = 0; i < m.n; i++) {
      const x0 = i * m.travee; const x1 = x0 + m.travee; const tp = [(x0 + x1) / 2, m.B / 2, m.nok]; const nb = m.type === 'pagode' ? 6 : 1;
      for (const [x, y] of [[x0, 0], [x1, 0], [x1, m.B], [x0, m.B]]) for (let b = 0; b < nb; b++) { const P = (f) => [x + (tp[0] - x) * f, y + (tp[1] - y) * f, m.zijH + (m.nok - m.zijH) * (m.type === 'pagode' ? f ** 1.7 : f)]; lijn(P(b / nb), P((b + 1) / nb), alu, kolom * 0.5, 0.02); }
    }
    if (!mini) for (const x of spanten) for (const y of [0, m.B]) { const v = S([x, y, 0]); prims.push({ k: 'voet', p: W3([x, y, 0]) }); lagen.push({ d: v[2] + 0.05, el: (k) => <rect key={k} x={v[0] - 5} y={v[1] - 2.5} width={10} height={5} fill="#6B7280" /> }); }

    }
    // Luifel aan een gevel
    for (const [z, d] of [['V', lV], ['A', lA]]) if (d > 0) {
      const x = z === 'V' ? 0 : m.L; const xo = z === 'V' ? -d : m.L + d; const y0 = m.B * 0.15; const y1 = m.B * 0.85; const h0 = Math.min(m.zijH, 2.6) + 0.1; const h1 = h0 - 0.3;
      vlak([[x, y0, h0], [x, y1, h0], [xo, y1, h1], [xo, y0, h1]], dakSoort(t.dak).kleur, '#9CA3AF', { fillOpacity: 0.95, ...geen });
      for (const y of [y0, y1]) lijn([xo, y, 0], [xo, y, h1], alu, kolom * 0.7, 0.01);
    }
  }
  Tf = (q) => q; lidNu = null;

  // Signing frames: buizenkader boven de dakrand met een banner. Gekoppelde frames die op één lijn aansluiten (ook over
  // gekoppelde tenten heen) zijn één doorlopend kader met één banner: het beeld loopt over de hele lengte en wordt per
  // deel uitgeknipt. Elk deel sorteert op zijn eigen dichtste punt: vooraan vóór het dak, achteraan erachter.
  for (const r of frameRuns(leden)) {
    const u = [(r.B[0] - r.A[0]) / r.len, (r.B[1] - r.A[1]) / r.len]; const n = [u[1] * FRAME_UIT, -u[0] * FRAME_UIT];
    const zh = Math.max(...r.delen.map((d) => leden[d.k].m.zijH)); const z0 = zh + FRAME_Z0; const z1 = zh + FRAME_Z1;
    const Pw = (f, z) => [r.A[0] + u[0] * r.len * f + n[0], r.A[1] + u[1] * r.len * f + n[1], z];
    const bm = bannerMaat(r.len); const fi0 = bm.ins / r.len; const fi1 = 1 - fi0; const zb0 = z0 + FRAME_RAND; const zb1 = z1 - FRAME_RAND;
    const fo = doekMap.get(r.doek); const kl = fo?.eigenschappen?.kleur || '#3730A3'; const href = fo?.eigenschappen?.beeld ? publiekeUrl(fo.eigenschappen.beeld) : null;
    const fVan = (p) => ((p[0] - r.A[0]) * u[0] + (p[1] - r.A[1]) * u[1]) / r.len; const meer = r.delen.length > 1;
    r.delen.forEach((d, i) => {
      const g = leden[d.k]; lidNu = g.hoofd ? null : g.k; const eerste = i === 0; const laatste = i === r.delen.length - 1;
      const fa = fVan(d.A); const fb = fVan(d.B); const f0 = Math.max(fi0, fa); const f1 = Math.min(fi1, fb);
      const data = g.hoofd ? { 'data-seg': d.key, 'data-frame': '1', style: { cursor: kies || drop ? 'pointer' : undefined } } : { ...geen, 'data-frame': '1' };
      const q = [Pw(f0, zb0), Pw(f1, zb0), Pw(f1, zb1), Pw(f0, zb1)];
      vlak(q, kl, meer ? 'none' : '#1E1B4B', { ...data, fillOpacity: 0.97 }, 'min');
      if (href) beeldVorm(Pw(fi0, zb1), Pw(fi1, zb1), Pw(fi0, zb0), q, href, 0.03);
      // Rand van de banner zonder naad tussen de delen; buizen boven en onder; staanders aan de uiteinden en, tussen
      // twee delen, een tussenstaander achter de banner (enkel zichtbaar boven en onder het doek).
      if (meer) { for (const z of [zb0, zb1]) lijn(Pw(f0, z), Pw(f1, z), '#1E1B4B', 0.8, 'min'); if (eerste) lijn(Pw(f0, zb0), Pw(f0, zb1), '#1E1B4B', 0.8, 'min'); if (laatste) lijn(Pw(f1, zb0), Pw(f1, zb1), '#1E1B4B', 0.8, 'min'); }
      for (const z of [z0, z1]) lijn(Pw(fa, z), Pw(fb, z), '#9CA3AF', 1.6 * lw, 'min');
      if (eerste) lijn(Pw(fa, z0 - 0.1), Pw(fa, z1), '#9CA3AF', 1.8 * lw, 'min');
      if (laatste) lijn(Pw(fb, z0 - 0.1), Pw(fb, z1), '#9CA3AF', 1.8 * lw, 'min');
      else { lijn(Pw(fb, z0 - 0.1), Pw(fb, zb0), '#9CA3AF', 1.8 * lw, 'min'); lijn(Pw(fb, zb1), Pw(fb, z1), '#9CA3AF', 1.8 * lw, 'min'); }
    });
  }
  lidNu = null;

  lagen.sort((a, b) => b.d - a.d);
  const grond = [[Math.min(...gx) - 2, Math.min(...gy) - 2], [Math.max(...gx) + 2, Math.min(...gy) - 2], [Math.max(...gx) + 2, Math.max(...gy) + 2], [Math.min(...gx) - 2, Math.max(...gy) + 2]].map(([x, y]) => S([x, y, 0]));
  const m = leden[0].m;
  return { lagen, prims, grond, m, leden };
}

function TentDrie0({ it, el, tent, groep = null, items = null, doekMap = new Map(), vloer = false, mini = false, interactief = !mini, kies, dakKies, drop, gekozen = null, gekozenPan = null, kiesLid = null }) {
  const ref = useRef(null); const [maat, setMaat] = useState({ w: 600, h: 400 });
  const [stand, setStand] = useState([32, 24]); const [zoom, setZoom] = useState(1); const [schuif, setSchuif] = useState([0, 0]); const sleep = useRef(null);
  useEffect(() => { const e = ref.current; if (!e) return undefined; const ro = new ResizeObserver(() => setMaat({ w: e.clientWidth || 600, h: e.clientHeight || 400 })); ro.observe(e); return () => ro.disconnect(); }, []);
  const [over, setOver] = useState(null);
  const clipPre = useMemo(() => `tg${Math.random().toString(36).slice(2, 8)}`, []);
  const { lagen, grond, m } = tentTeken({ it, el, tent, groep, items, doekMap, vloer, mini, kies, dakKies, drop, gekozen, gekozenPan, kiesLid }, { stand, zoom, schuif, maat, clipPre, over });

  // Draaien, zoomen, verschuiven (zoals de stellingbouwer).
  const vingers = useRef(new Map()); const [schuifModus, setSchuifModus] = useState(false);
  const zoomOm = (f, px, py) => { setZoom((z0) => { const nz = Math.max(0.3, Math.min(20, z0 * f)); const k = nz / z0; const cx = maat.w / 2; const cy = maat.h / 2; setSchuif(([sx, sy]) => [(px - cx) - ((px - cx) - sx) * k, (py - cy) - ((py - cy) - sy) * k]); return nz; }); };
  const lokaal = (e) => { const b = ref.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const onder = (e) => { const n = document.elementFromPoint(e.clientX, e.clientY); const pan = n?.getAttribute?.('data-pan'); return { lid: n?.getAttribute?.('data-lid') ?? null, seg: n?.getAttribute?.('data-seg') || null, pan: pan != null ? Number(pan) : null, dak: n?.getAttribute?.('data-dak') ?? null, frame: !!n?.getAttribute?.('data-frame') }; };
  const neer = (e) => {
    if (!interactief) return; vingers.current.set(e.pointerId, lokaal(e)); e.currentTarget.setPointerCapture?.(e.pointerId);
    if (vingers.current.size === 2) { const [a, b] = [...vingers.current.values()]; sleep.current = { knijp: Math.hypot(a[0] - b[0], a[1] - b[1]), hoek: Math.atan2(b[1] - a[1], b[0] - a[0]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; return; }
    sleep.current = { x: e.clientX, y: e.clientY, st: stand, sc: schuif, pan: schuifModus || e.button !== 0 || e.shiftKey, klik: onder(e), ver: 0 };
  };
  const beweeg = (e) => {
    const g = sleep.current; if (!g) return;
    if (vingers.current.has(e.pointerId)) vingers.current.set(e.pointerId, lokaal(e));
    if (g.knijp != null && vingers.current.size === 2) {
      const [a, b] = [...vingers.current.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (d > 10) { zoomOm(d / g.knijp, mid[0], mid[1]); g.knijp = d; }
      const hk = Math.atan2(b[1] - a[1], b[0] - a[0]); let dh = hk - g.hoek; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
      if (Math.abs(dh) > 0.002) { setStand(([h0, k0]) => [h0 - (dh * 180) / Math.PI, k0]); g.hoek = hk; }
      setSchuif(([sx, sy]) => [sx + mid[0] - g.mid[0], sy + mid[1] - g.mid[1]]); g.mid = mid; return;
    }
    const dx = e.clientX - g.x; const dy = e.clientY - g.y; g.ver = Math.max(g.ver, Math.hypot(dx, dy));
    if (g.ver < 4) return;
    if (g.pan) setSchuif([g.sc[0] + dx, g.sc[1] + dy]); else setStand([g.st[0] - dx * 0.4, Math.max(5, Math.min(85, g.st[1] + dy * 0.25))]);
  };
  const los = (e) => {
    const g = sleep.current; vingers.current.delete(e.pointerId);
    // Een klik (zonder slepen) op een wand of dak = kiezen.
    if (g && g.knijp == null && g.ver < 4 && vingers.current.size === 0) { if (g.klik.lid != null && kiesLid) kiesLid(Number(g.klik.lid)); else if (g.klik.seg && kies) kies(g.klik.seg, g.klik.pan); else if (g.klik.dak != null && dakKies) dakKies(Number(g.klik.dak)); else if (kies) kies(null); }
    if (vingers.current.size === 0) sleep.current = null; else if (vingers.current.size === 1) { const [p] = [...vingers.current.values()]; const b = ref.current.getBoundingClientRect(); sleep.current = { x: p[0] + b.left, y: p[1] + b.top, st: stand, sc: schuif, pan: false, klik: {}, ver: 99 }; }
  };
  const wiel = (e) => { if (!interactief) return; const [px, py] = lokaal(e); zoomOm(e.ctrlKey ? Math.exp(-e.deltaY * 0.01) : e.deltaY < 0 ? 1.15 : 1 / 1.15, px, py); };
  useEffect(() => { const n = ref.current; if (!n || !interactief) return undefined; const stop = (e) => e.preventDefault(); n.addEventListener('wheel', stop, { passive: false }); return () => n.removeEventListener('wheel', stop); }, [interactief]);
  return (
    <div ref={ref} className={`fm-wz${mini ? ' mini' : ''}`} style={interactief ? { touchAction: 'none' } : undefined} onPointerDown={neer} onPointerMove={beweeg} onPointerUp={los} onPointerCancel={los} onWheel={wiel} onContextMenu={(e) => e.preventDefault()}
      onDragOver={drop ? (e) => { e.preventDefault(); const o = onder(e); setOver(o.seg ? `${o.frame ? 'frame' : 'seg'}:${o.seg}${o.pan != null ? `:${o.pan}` : ''}` : o.dak != null ? `dak:${o.dak}` : null); } : undefined}
      onDragLeave={drop ? () => setOver(null) : undefined}
      onDrop={drop ? (e) => { e.preventDefault(); setOver(null); const o = onder(e); drop(o, e.dataTransfer.getData('text/fm-tent')); } : undefined}>
      {interactief && (
        <div className="fm-wz-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Inzoomen" onClick={() => zoomOm(1.4, maat.w / 2, maat.h / 2)}>+</button>
          <button type="button" aria-label="Uitzoomen" onClick={() => zoomOm(1 / 1.4, maat.w / 2, maat.h / 2)}>−</button>
          <button type="button" className={schuifModus ? 'aan' : ''} aria-pressed={schuifModus} title={schuifModus ? 'Slepen verschuift nu (klik om terug te draaien)' : 'Slepen = verschuiven'} onClick={() => setSchuifModus((x) => !x)}>✥</button>
          <button type="button" aria-label="Terug naar het geheel" title="Terug naar het geheel" onClick={() => { setZoom(1); setSchuif([0, 0]); setStand([32, 24]); }}>⟲</button>
        </div>
      )}
      <svg width={maat.w} height={maat.h}>
        <polygon points={P2(grond)} fill="#D4D8CF" />
        {lagen.map((l, k) => l.el(k))}
      </svg>
      {over && <span className="fm-tb-over">{over.startsWith('frame:') ? `Banner op het signing frame (${segNaam(over.slice(6), m)})` : over.startsWith('seg:') ? (() => { const [k, pn] = over.slice(4).split(':'); return `Op ${segNaam(k, m)}${pn != null ? ` · paneel ${Number(pn) + 1}` : ''}`; })() : `Dak travee ${Number(over.slice(4)) + 1}`}</span>}
    </div>
  );
}

export function segNaam(key, m) {
  const d = key.split('-'); const z = d[0]; const g = m.type === 'pagode' || m.type === 'vouw' ? 1 : Math.max(1, Math.round(m.B / 5));
  if (z === 'I') return `intergevel spant ${Number(d[1]) + 1}${g > 1 ? ` deel ${Number(d[2]) + 1}` : ''}`;
  const n = z === 'L' || z === 'R' ? m.n : g;
  return n > 1 ? `${ZIJDEN[z].toLowerCase()} ${Number(d[1]) + 1}` : ZIJDEN[z].toLowerCase();
}

// ---------- Bovenaanzicht: alle zijden aanklikbaar (ook de achterkant) ----------
function TentSchema({ m, t, gekozen, onKies, onDrop, open = new Set(), onInter }) {
  const tr = t.terras || {}; const d = (k) => Number(tr[k]) || 0;
  const W = 260; const sc = Math.min((W - 40) / (m.L + d('V') + d('A')), 150 / (m.B + d('L') + d('R'))); const H = (m.B + d('L') + d('R')) * sc + 40; const X = (x) => 20 + (x + d('V')) * sc; const Y = (y) => 20 + (y + d('L')) * sc;
  return (
    <svg className="fm-tb-schema" width={W} height={H} onDragOver={(e) => e.preventDefault()}>
      {[['V', -d('V'), 0, d('V'), m.B], ['A', m.L, 0, d('A'), m.B], ['L', 0, -d('L'), m.L, d('L')], ['R', 0, m.B, m.L, d('R')]].filter((q) => d(q[0]) > 0).map(([k, x, y, w, h]) => <rect key={k} x={X(x)} y={Y(y)} width={w * sc} height={h * sc} fill="#E7D3B0" stroke="#A9844F" />)}
      {m.type === 'sail' ? <polygon points={sailOmtrek(m).map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill="#F9FAFB" stroke="#D1D5DB" /> : <rect x={X(0)} y={Y(0)} width={m.L * sc} height={m.B * sc} fill="#F9FAFB" stroke={m.type === 'stretch' ? '#9CA3AF' : '#D1D5DB'} strokeDasharray={m.type === 'stretch' ? '4 3' : undefined} />}
      {m.type === 'stretch' && stretchMasten(m, t).map((ms, k) => <circle key={`m${k}`} cx={X(ms.x)} cy={Y(ms.y)} r={3.5} fill="#6B7280" />)}
      {m.type === 'sail' && sailPieken(m, t).map((p, k) => <circle key={`p${k}`} cx={X(p[0])} cy={Y(p[1])} r={3.5} fill="#A47148" />)}
      {Array.from({ length: m.n - 1 }, (_, k) => (
        <g key={k} style={{ cursor: onInter ? 'pointer' : undefined }} onClick={() => onInter?.(k + 1)}>
          <title>{t.inter?.[k + 1] ? 'Intergevel weghalen' : 'Intergevel plaatsen op deze spant'}</title>
          <line x1={X((k + 1) * m.travee)} y1={Y(0)} x2={X((k + 1) * m.travee)} y2={Y(m.B)} stroke="transparent" strokeWidth={12} />
          {!t.inter?.[k + 1] && <line x1={X((k + 1) * m.travee)} y1={Y(0)} x2={X((k + 1) * m.travee)} y2={Y(m.B)} stroke="#D1D5DB" strokeDasharray="3 3" />}
        </g>
      ))}
      {tentSegmenten(m, t).map((sg) => {
        const gekop = open.has(sg.key) && !t.wanden?.[sg.key];
        const w = gekop ? wandSoort('open') : wandSoort(t.wanden?.[sg.key] || (sg.zijde === 'I' ? 'wit' : standaardWand(m))); const aan = gekozen === sg.key;
        return (
          <g key={sg.key} style={{ cursor: 'pointer' }} onClick={() => onKies(sg.key)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop({ seg: sg.key }, e.dataTransfer.getData('text/fm-tent')); }}>
            <line x1={X(sg.a[0])} y1={Y(sg.a[1])} x2={X(sg.b[0])} y2={Y(sg.b[1])} stroke="transparent" strokeWidth={16} />
            <line x1={X(sg.a[0])} y1={Y(sg.a[1])} x2={X(sg.b[0])} y2={Y(sg.b[1])} stroke={aan ? '#2563EB' : gekop ? '#0E7490' : w.k === 'open' ? '#D1D5DB' : w.kleur === '#F8FAFC' ? '#6B7280' : w.kleur} strokeWidth={aan ? 6 : 4} strokeDasharray={w.k === 'open' || gekop ? '4 4' : w.deur ? '10 3' : undefined} strokeLinecap="round" />
            {t.frames && sg.key in t.frames && <line x1={X(sg.a[0])} y1={Y(sg.a[1])} x2={X(sg.b[0])} y2={Y(sg.b[1])} stroke="#3730A3" strokeWidth={t.frameKoppel?.[sg.key] ? 3.5 : 2} transform={`translate(${(sg.b[1] - sg.a[1]) / Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]) * 5} ${-(sg.b[0] - sg.a[0]) / Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]) * 5})`} />}
          </g>
        );
      })}
      <text x={X(m.L / 2)} y={Y(0) - 6} textAnchor="middle" fontSize={10} fill="#6B7280">Linkerzijde · {getal(m.L)} m</text>
      <text x={X(m.L / 2)} y={Y(m.B) + 14} textAnchor="middle" fontSize={10} fill="#6B7280">Rechterzijde</text>
      <text x={X(0) - 6} y={Y(m.B / 2)} textAnchor="middle" fontSize={10} fill="#6B7280" transform={`rotate(-90 ${X(0) - 6} ${Y(m.B / 2)})`}>Voor · {getal(m.B)} m</text>
      <text x={X(m.L) + 12} y={Y(m.B / 2)} textAnchor="middle" fontSize={10} fill="#6B7280" transform={`rotate(-90 ${X(m.L) + 12} ${Y(m.B / 2)})`}>Achter</text>
    </svg>
  );
}

// ---------- De bouwer ----------
const r3 = (x) => Math.round(x * 1000) / 1000;
// De bouwer bewerkt één tent tegelijk; gekoppelde tenten bewerk je in dezelfde bouwer (klik erop in 3D of kies ze bovenaan).
export default function TentStudio(props) {
  const { it, el, groep, items, elementen = [], onActie, onZet, vloer, onVloer } = props;
  const [lid, setLid] = useState(null); const [zicht, setZicht] = useState('3d');
  const elMap = useMemo(() => new Map(elementen.map((e) => [e.id, e])), [elementen]);
  const it2 = lid ? (items || []).find((x) => x.id === lid) : null; const el2 = it2 ? elMap.get(it2.element_id) : null;
  const groep2 = useMemo(() => (it2 && el2 ? tentGroep(it2, el2, items || [], elMap) : null), [it2, el2, items, elMap]);
  const ledenLijst = (groep || []).map((g) => ({ id: g.it.id, naam: g.it.naam || g.el?.naam || 'Tent' }));
  const kiesLid = (id) => setLid(!id || id === it.id ? null : id);
  if (lid && it2 && el2) {
    return <TentStudioLid key={lid} {...props} it={it2} el={el2} groep={groep2} vloer={it2.velden?.vloer ? elMap.get(it2.velden.vloer) || true : false} onVloer={null}
      onZet={(tent) => onActie?.('tent-lid', { _it: lid, tent })} onActie={onActie ? (s, a) => onActie(s, { _it: lid, ...(a || {}) }) : null}
      leden={ledenLijst} actiefLid={lid} kiesLid={kiesLid} zicht={zicht} setZicht={setZicht} />;
  }
  return <TentStudioLid key="hoofd" {...props} onZet={onZet} vloer={vloer} onVloer={onVloer} leden={ledenLijst} actiefLid={it.id} kiesLid={kiesLid} zicht={zicht} setZicht={setZicht} />;
}

function TentStudioLid({ it, el, schrijven, onZet, onSluit, doeken: ontwerpen = [], vloer = false, groep = null, items = null, elementen = [], onVloer = null, onActie = null, leden = [], actiefLid = null, kiesLid = null, zicht = '3d', setZicht = () => {} }) {
  const [t, setT] = useState(it.velden?.tent || {});
  const terugL = useRef([]); const vooruitL = useRef([]);
  const zet = (n) => { terugL.current.push(t); vooruitL.current = []; setT(n); onZet?.(n); };
  const terug = () => { const p = terugL.current.pop(); if (!p) return; vooruitL.current.push(t); setT(p); onZet?.(p); };
  const opnieuw = () => { const p = vooruitL.current.pop(); if (!p) return; terugL.current.push(t); setT(p); onZet?.(p); };
  const m = tentMaten({ ...it, velden: { ...(it.velden || {}), tent: t } }, el);
  const [wand, setWand] = useState(null); /* null = kiezen */ const [bereik, setBereik] = useState('paneel'); const heleZijde = bereik === 'zijde'; const [gekozenPan, setGekozenPan] = useState(null); const [ontwerp, setOntwerp] = useState('');
  const [gekozen, setGekozen0] = useState(null);
  // Gekozen dakvlak (travee); een wand kiezen wist het dak en omgekeerd.
  const [gekozenDak, setGekozenDak] = useState(null);
  // Stappen zoals de stellingbouwer: Bouwen, Branding, Nakijken.
  const [scherm, setScherm0] = useState('bouwen'); const [kijk, setKijk] = useState('vrij');
  const [startWeg, setStartWeg] = useState(() => Object.keys(it.velden?.tent || {}).length > 0);
  const setGekozen = (k) => { setGekozen0(k); if (k != null) setGekozenDak(null); };
  const [kiesStuk, setKiesStuk] = useState(null); const [hNieuw, setHNieuw] = useState(0);
  const [tentKies, setTentKies] = useState(null); const [tentLengte, setTentLengte] = useState(10); const [dwars, setDwars] = useState(false);
  const doekMap = useMemo(() => new Map(ontwerpen.map((d) => [d.id, d])), [ontwerpen]);
  const open = groep?.[0]?.open || new Set();
  const telling = useMemo(() => tentTelling({ ...it, velden: { ...(it.velden || {}), tent: t } }, el, open, groep), [it, el, t, open, groep]);
  const segs = tentSegmenten(m, t);
  const meldingen = useMemo(() => tentMeldingen(m, t, segs, standaardWand(m)), [t, m.L, m.B, m.n, m.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const setScherm = (k) => { setScherm0(k); if (k !== 'bouwen') setZicht('3d'); if (k === 'branding') setWand((w) => (w === 'doek' || w === 'frame' ? w : 'doek')); else if (k === 'bouwen') setWand((w) => (w === 'doek' || w === 'frame' ? null : w)); };
  const startMet = (pr) => { const wanden = {}; for (const sg of segs) if (sg.zijde !== 'I') wanden[sg.key] = (sg.zijde === 'V' || sg.zijde === 'A') && pr.gevel ? pr.gevel : pr.wand; if (pr.voor) { const v = segs.filter((sg) => sg.zijde === 'V'); const mid = v[Math.floor(v.length / 2)] || segs[0]; if (mid) wanden[mid.key] = pr.voor; } zet({ ...t, wanden, panelen: {} }); setStartWeg(true); };
  const modulair = m.type === 'kader' || m.type === 'boog'; const vrij = isVrijeTent(m);
  const zetMastH = (k, v) => { const hs = [...(t.mastHs || [])]; hs[k] = Number(v) > 0 ? Number(v) : undefined; zet({ ...t, mastHs: hs }); };
  // Intergevel naar een ander spant slepen: wand, doek en panelen gaan mee.
  const verplaatsInter = (seg, x) => {
    if (!schrijven || !seg?.startsWith('I-') || !(m.n > 1)) return;
    const sp = Number(seg.split('-')[1]); const nsp = Math.max(1, Math.min(m.n - 1, Math.round(x / m.travee)));
    if (nsp === sp || t.inter?.[nsp]) return;
    const inter = { ...(t.inter || {}) }; delete inter[sp]; inter[nsp] = true;
    const her = (o) => { if (!o) return o; const n = {}; for (const [k, v] of Object.entries(o)) { const d = k.split('-'); n[d[0] === 'I' && Number(d[1]) === sp ? `I-${nsp}-${d[2]}` : k] = v; } return n; };
    zet({ ...t, inter, wanden: her(t.wanden), doeken: her(t.doeken), panelen: her(t.panelen), frames: her(t.frames) });
    if (gekozen?.startsWith(`I-${sp}-`)) setGekozen(`I-${nsp}-${gekozen.split('-')[2]}`);
  };
  const zetInter = (sp) => { if (!schrijven) return; const inter = { ...(t.inter || {}) }; if (inter[sp]) delete inter[sp]; else inter[sp] = true; zet({ ...t, inter }); };
  // Signing frames: t.frames per tent; frames met dezelfde t.frameKoppel-id die op één lijn aansluiten zijn één kader met
  // één banner, ook over de gekoppelde tenten van de groep heen (runs). Een wijziging aan een andere tent gaat via het plan.
  const frLeden = useMemo(() => frameLeden({ ...it, velden: { ...(it.velden || {}), tent: t } }, el, groep, open), [it, el, t, groep, open]);
  const runs = useMemo(() => frameRuns(frLeden), [frLeden]);
  // Delen (uit runs) aanpassen: banner (doek) en/of koppel-id (null = weg). basis0 = de eigen tent om van te vertrekken.
  const zetDelen = (delen, { doek, koppel } = {}, basis0 = null) => {
    let eigen = basis0;
    frLeden.forEach((g, k) => {
      const mijn = delen.filter((d) => d.k === k); if (!mijn.length) return;
      const tk = k === 0 && basis0 ? basis0 : g.t; const fr = { ...(tk.frames || {}) }; const fk = { ...(tk.frameKoppel || {}) };
      for (const d of mijn) { if (!(d.key in fr)) continue; if (doek !== undefined) fr[d.key] = doek; if (koppel === null) delete fk[d.key]; else if (koppel) fk[d.key] = koppel; }
      const n = { ...tk, frames: fr, frameKoppel: Object.keys(fk).length ? fk : undefined };
      if (k === 0) eigen = n; else if (onActie && groep?.[k]?.it?.id) onActie('tent-lid', { _it: groep[k].it.id, tent: n });
    });
    if (eigen) zet(eigen);
  };
  // Frame plaatsen of weghalen (id null = wisselen; '' = plaatsen; ontwerp-id = plaatsen met banner, over het hele gekoppelde kader).
  const zetFrame = (key, id) => { if (!schrijven || !key || key.startsWith('I-')) return; const fr = { ...(t.frames || {}) }; const fk = { ...(t.frameKoppel || {}) }; const keys = heleZijde ? segs.filter((x) => segGroep(x.key) === segGroep(key)).map((x) => x.key) : [key];
    const weg = id == null && key in fr; for (const k of keys) { if (weg) { delete fr[k]; delete fk[k]; } else fr[k] = id || fr[k] || ''; }
    const basis = { ...t, frames: fr, frameKoppel: Object.keys(fk).length ? fk : undefined }; const r = id ? runVan(runs, key) : null;
    if (r && r.delen.length > 1) zetDelen(r.delen, { doek: id }, basis); else zet(basis); setGekozen(key); };
  const zetBanner = (key, id) => { const r = runVan(runs, key); if (!schrijven || !r) return; zetDelen(r.delen, { doek: id }, t); };
  // Twee aansluitende kaders worden één (zelfde koppel-id, één banner); ontkoppelen = weer aparte frames met elk hun banner.
  const koppelRuns = (r, q) => { if (!schrijven || !r || !q) return; zetDelen([...r.delen, ...q.delen], { koppel: r.koppel || q.koppel || `fk${Math.random().toString(36).slice(2, 8)}`, doek: r.doek || q.doek || undefined }, t); };
  const ontkoppelRun = (r) => { if (!schrijven || !r) return; zetDelen(r.delen, { koppel: null }, t); };
  const zetTerras = (z, v) => zet({ ...t, terras: { ...(t.terras || {}), [z]: Math.max(0, Math.round((Number(v) || 0) * 100) / 100) } });

  // Een wandsoort op een segment (of de hele zijde) zetten; een ontwerp = bedrukt doek.
  const zetWand = (key, soort, ontwerpId = null, enkel = false) => {
    if (!schrijven || !key) return;
    const keys = heleZijde && !enkel ? segs.filter((s) => segGroep(s.key) === segGroep(key)).map((s) => s.key) : [key];
    const wanden = { ...(t.wanden || {}) }; const dk = { ...(t.doeken || {}) };
    const pan = { ...(t.panelen || {}) };
    for (const k of keys) { wanden[k] = soort; delete pan[k]; if (soort === 'doek' && ontwerpId) dk[k] = ontwerpId; else delete dk[k]; }
    zet({ ...t, wanden, doeken: dk, panelen: pan }); setGekozen(key); setGekozenPan(null);
  };
  // Eén paneel van 1 m (raam, paneel, deur …); een dubbele deur neemt dit en het volgende paneel.
  const perPaneel = (soort) => !vrij && soort !== 'doek';
  const zetPaneel = (key, i, soort) => {
    if (!schrijven || key == null || i == null) return;
    const sg = segs.find((x) => x.key === key); if (!sg) return;
    const n = wandPanelen(m, t, sg, sg.zijde === 'I' ? 'wit' : standaardWand(m)); const max = n.length ? n[n.length - 1].i + n[n.length - 1].n : 1;
    let j = i; if (wandSoort(soort).deur === 2 && j >= max - 1) j = Math.max(0, max - 2);
    const pan = { ...(t.panelen || {}) }; const rij = { ...(pan[key] || {}) };
    rij[j] = soort; if (wandSoort(soort).deur === 2) delete rij[j + 1];
    pan[key] = rij; zet({ ...t, panelen: pan }); setGekozen(key); setGekozenPan(j);
  };
  const zetWandOfPaneel = (key, pan, soort, ontwerpId = null) => {
    if (bereik === 'paneel' && pan != null && perPaneel(soort)) zetPaneel(key, pan, soort); else zetWand(key, soort, ontwerpId);
  };
  const zetDak = (i, soort) => { if (!schrijven) return; zet({ ...t, dakPer: { ...(t.dakPer || {}), [i]: soort } }); };
  const drop = (o, data) => {
    if (!data) return;
    if (data.startsWith('wand:') && o.seg) zetWandOfPaneel(o.seg, o.pan, data.slice(5));
    else if (data.startsWith('doek:') && o.seg) { if (wand === 'frame' || o.frame) zetFrame(o.seg, data.slice(5)); else zetWand(o.seg, 'doek', data.slice(5)); }
    else if (data === 'frame' && o.seg) zetFrame(o.seg, '');
    else if (data.startsWith('dak:') && o.dak != null) zetDak(o.dak, data.slice(4));
    else if (data.startsWith('dak:') && o.seg) zet({ ...t, dak: data.slice(4), dakPer: {} });
  };
  const klik = (key, pan = null) => { if (!key) { setGekozen(null); setGekozenPan(null); return; } if (schrijven && wand === 'frame') zetFrame(key, null); else if (schrijven && wand) zetWandOfPaneel(key, pan, wand === 'doek' ? 'doek' : wand, wand === 'doek' ? ontwerp || null : null); else { setGekozen(key); setGekozenPan(pan); } };

  const [pdfBezig, setPdfBezig] = useState(false);
  const maakPdf = async () => {
    if (pdfBezig) return; setPdfBezig(true);
    try {
      const [{ bouwerPdf }, { tentGroep }] = await Promise.all([import('./bouwerPdf'), import('./TentDrieGL')]);
      const { prims } = tentTeken({ it, el, tent: t, groep, items, doekMap, vloer });
      const naam = String(it.velden?.naam || it.naam || el?.naam || 'Tent');
      const tp = TENTTYPES.find((x) => x.k === m.type)?.naam || 'Tent';
      await bouwerPdf({ soort: 'tent', titel: naam, sub: [el?.naam, el?.leverancier].filter(Boolean).join(' · '), maakGroep: (T) => tentGroep(T, prims), hoogtes: [m.zijH, m.nok], snede: Math.min(1.2, m.zijH * 0.5),
        namen: { voor: 'Linkerzijde', achter: 'Rechterzijde', links: 'Voorgevel', rechts: 'Achtergevel' },
        kenmerken: [['Type', tp], ['Afmeting', `${getal(m.L)} × ${getal(m.B)} m`], ['Oppervlakte', `${getal(m.L * m.B, 1)} m²`], ['Zijwand', `${getal(m.zijH)} m`], ['Nok', `${getal(m.nok)} m`], ...(m.n > 1 ? [['Traveeën', `${m.n} × ${getal(m.travee)} m`]] : []), ...(el?.leverancier ? [['Leverancier', el.leverancier]] : [])] });
    } catch (e) { window.alert(`De PDF lukte niet: ${e?.message || e}`); } finally { setPdfBezig(false); }
  };
  useEffect(() => {
    const kb = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return;
      if (e.key === 'Escape') { e.stopPropagation(); if (gekozen || gekozenDak != null) { setGekozen(null); setGekozenDak(null); } else if (wand) setWand(null); else onSluit(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) opnieuw(); else terug(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['1', '2', '3'].includes(e.key)) { setScherm(['bouwen', 'branding', 'nakijken'][Number(e.key) - 1]); return; }
      if (e.key.toLowerCase() === 'v') { setWand(null); return; }
      // Delete: de gekozen wand terug naar de standaard, het gekozen dakvlak terug naar het hele dak.
      if ((e.key === 'Delete' || e.key === 'Backspace') && schrijven) {
        if (gekozen) { e.preventDefault(); const w = { ...(t.wanden || {}) }; delete w[gekozen]; const pn = { ...(t.panelen || {}) }; delete pn[gekozen]; zet({ ...t, wanden: w, panelen: pn }); }
        else if (gekozenDak != null) { e.preventDefault(); const d = { ...(t.dakPer || {}) }; delete d[gekozenDak]; zet({ ...t, dakPer: d }); }
      }
    };
    window.addEventListener('keydown', kb, true); return () => window.removeEventListener('keydown', kb, true);
  });

  const gw = gekozen ? wandSoort(t.wanden?.[gekozen] || (open.has(gekozen) ? 'open' : gekozen.startsWith('I-') ? 'wit' : standaardWand(m))) : null;
  const buren = (groep || []).slice(1);
  useBouwerSchild();
  return createPortal(
    <div className="fm fm-ws" role="dialog" aria-label="Tentbouwer" {...schildProps}>
      <div className="fm-ws-kop">
        <TerugKnop onClick={onSluit} />
        <strong>Tentbouwer · {el?.naam}</strong>
        <span className="fm-sub">{getal(m.B)} × {getal(m.L)} m · {getal(m.L * m.B, 1)} m² · zijwand {getal(m.zijH)} m · nok {getal(m.nok)} m</span>
        <div className="fm-segment fm-sb-stappen" role="tablist" aria-label="Stap">
          {[['bouwen', '1 Bouwen'], ['branding', '2 Branding'], ['nakijken', '3 Nakijken']].map(([k, n]) => <button key={k} type="button" role="tab" aria-selected={scherm === k} className={scherm === k ? 'aan' : ''} title={`${n.slice(2)} (toets ${n[0]})`} onClick={() => setScherm(k)}>{n}{k === 'nakijken' && meldingen.length > 0 && <i className="fm-badge">{meldingen.length}</i>}</button>)}
        </div>
        <span style={{ flex: 1 }} />
        {leden.length > 1 && <div className="fm-segment fm-tb-leden" title="Gekoppelde tenten: kies welke je bewerkt (of klik erop in 3D)">{leden.map((l) => <button key={l.id} type="button" className={actiefLid === l.id ? 'aan' : ''} onClick={() => kiesLid?.(l.id)}>{l.naam}</button>)}</div>}
        {scherm === 'bouwen' && <div className="fm-segment">{[['3d', '3D'], ['vloer', 'Grondplan']].map(([k, n]) => <button key={k} type="button" className={zicht === k ? 'aan' : ''} title={k === 'vloer' ? 'Terras, podium of rijplaten met losse elementen leggen: slepen en plaatsen' : undefined} onClick={() => setZicht(k)}>{n}</button>)}</div>}
        <button className="fm-knop klein" disabled={pdfBezig} title="Eén PDF met de 3D-weergave, het grondplan en de vier aanzichten met maatlijnen" onClick={maakPdf}>{pdfBezig ? 'PDF maken…' : 'PDF'}</button>
        {schrijven && <button className="fm-knop klein" disabled={!terugL.current.length} title="Terug (Ctrl + Z)" onClick={terug}>↶</button>}
        {schrijven && <button className="fm-knop klein" disabled={!vooruitL.current.length} title="Opnieuw (Ctrl + Shift + Z)" onClick={opnieuw}>↷</button>}
      </div>
      <div className="fm-ws-lijf">
        <aside className="fm-ws-doeken fm-sb-palet">
          {scherm === 'bouwen' && zicht === 'vloer' && <>
            <div className="fm-kop">Vloerelementen</div>
            <VloerPalet elementen={elementen} schrijven={schrijven} kies={kiesStuk} setKies={setKiesStuk} hNieuw={hNieuw} setHNieuw={setHNieuw} metTenten={!!onActie} tentKies={tentKies} setTentKies={setTentKies} tentLengte={tentLengte} setTentLengte={setTentLengte} dwars={dwars} setDwars={setDwars} />
            {!onActie && <div className="fm-sub">De stukken staan enkel in de tentbouwer (niet op het plan).</div>}
            {(t.stukken || []).length > 0 && schrijven && <button type="button" className="fm-knop klein" onClick={() => { if (window.confirm('Alle vloerstukken van deze tent weghalen?')) zet({ ...t, stukken: undefined }); }}>Alle stukken weg</button>}
          </>}
          {scherm === 'bouwen' && zicht !== 'vloer' && <>
          <div className="fm-kop">Wanden</div>
          <div className="fm-sub" style={{ margin: '0 0 4px' }}>Sleep een wand op een zijde van de tent, of kies er een en klik op de zijden. Draaien = slepen naast de tent.</div>
          {!vrij && <div className="fm-segment fm-tb-bereik">{[['paneel', 'Per paneel (1 m)'], ['wand', 'Hele wand'], ['zijde', 'Hele zijde']].map(([k, n]) => <button key={k} type="button" className={bereik === k ? 'aan' : ''} onClick={() => setBereik(k)}>{n}</button>)}</div>}
          {vrij && <label className="fm-vink"><input type="checkbox" checked={heleZijde} onChange={(e) => setBereik(e.target.checked ? 'zijde' : 'wand')} />Over de hele zijde</label>}
          <div className="fm-tb-wanden">
            <button type="button" className={!wand ? 'aan' : ''} title="Klik op een zijde om ze te kiezen" onClick={() => setWand(null)}><span className="fm-tb-staal kies">⌖</span><span>Kiezen</span></button>
            {WANDEN.filter((w) => w.k !== 'doek').map((w) => (
              <button key={w.k} type="button" draggable={schrijven} disabled={!schrijven} className={wand === w.k ? 'aan' : ''} title={w.naam} onDragStart={(e) => { e.dataTransfer.setData('text/fm-tent', `wand:${w.k}`); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => setWand(w.k)}>
                <WandStaal w={w} /><span>{w.naam}</span>
              </button>
            ))}
          </div>
          <div className="fm-kop" style={{ marginTop: 6 }}>Dak</div>
          <div className="fm-sub" style={{ margin: '0 0 4px' }}>{vrij ? 'Kleur van het doek.' : 'Klik = het hele dak. Sleep op een travee voor enkel die travee.'}</div>
          <div className="fm-tb-daken">
            {DAKEN.filter((d) => !vrij || ['wit', 'zand', 'mokka', 'zwart', 'zeildoek', 'translucent'].includes(d.k)).map((d) => (
              <button key={d.k} type="button" draggable={schrijven} disabled={!schrijven} className={(t.dak || (m.type === 'sail' ? 'zeildoek' : 'wit')) === d.k && !Object.keys(t.dakPer || {}).length ? 'aan' : ''} title={d.naam} onDragStart={(e) => { e.dataTransfer.setData('text/fm-tent', `dak:${d.k}`); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => zet({ ...t, dak: d.k, dakPer: {} })}>
                <span className="fm-tb-staal" style={{ background: d.streep ? `repeating-linear-gradient(90deg, ${d.kleur} 0 6px, ${d.streep} 6px 12px)` : d.kleur, opacity: Math.max(0.5, d.dekking) }} /><span>{d.naam}</span>
              </button>
            ))}
          </div>
          <div className="fm-kop" style={{ marginTop: 6 }}>Vorm</div>
          {modulair && <div className="fm-segment">{TENTTYPES.filter((x) => x.k === 'kader' || x.k === 'boog').map((x) => <button key={x.k} disabled={!schrijven} title={x.uitleg} className={m.type === x.k ? 'aan' : ''} onClick={() => zet({ ...t, type: x.k })}>{x.naam}</button>)}</div>}
          {!modulair && <div className="fm-sub">{TENTTYPES.find((x) => x.k === m.type)?.naam}: {TENTTYPES.find((x) => x.k === m.type)?.uitleg.toLowerCase()}{m.type === 'pagode' && m.n > 1 ? ` · ${m.n} gekoppeld` : ''}.</div>}
          {m.type === 'stretch' && <div className="fm-sb-inst">
            <div className="fm-sb-rij">Masten <div className="fm-segment">{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} disabled={!schrijven} className={stretchMasten(m, t).length === n ? 'aan' : ''} onClick={() => zet({ ...t, mastN: n, mastHs: [] })}>{n}</button>)}</div></div>
            <label className="fm-veld">Masthoogte (m)<input type="number" step="0.1" min="2.5" max="10" disabled={!schrijven} value={t.mastH ?? m.nok} onChange={(e) => zet({ ...t, mastH: Number(e.target.value) > 0 ? Number(e.target.value) : undefined, mastHs: [] })} /></label>
            {stretchMasten(m, t).length > 1 && <div className="fm-tb-terras">{stretchMasten(m, t).map((ms, k) => <label key={k}>Mast {k + 1}<input type="number" step="0.1" min="2.5" max="10" disabled={!schrijven} value={t.mastHs?.[k] ?? ms.h} onChange={(e) => zetMastH(k, e.target.value)} /></label>)}</div>}
            <div className="fm-sub">Rand per zijde: hoogte van de randpalen (m), of het doek tot op de grond.</div>
            <div className="fm-tb-terras">{[['L', 'Links'], ['R', 'Rechts'], ['V', 'Voor'], ['A', 'Achter']].map(([z, n]) => (
              <label key={z}>{n}<input type="number" step="0.1" min="1" max="5" disabled={!schrijven || !!t.grond?.[z]} value={t.rand?.[z] ?? RAND_H} onChange={(e) => zet({ ...t, rand: { ...(t.rand || {}), [z]: Number(e.target.value) > 0 ? Number(e.target.value) : undefined } })} />
                <span className="fm-tb-grond"><input type="checkbox" disabled={!schrijven} checked={!!t.grond?.[z]} onChange={(e) => zet({ ...t, grond: { ...(t.grond || {}), [z]: e.target.checked || undefined } })} />grond</span></label>
            ))}</div>
            <div className="fm-sb-rij">Wandelement <div className="fm-segment">{[2, 3].map((w) => <button key={w} disabled={!schrijven} className={(Number(t.wandMaat) === 2 ? 2 : 3) === w ? 'aan' : ''} onClick={() => zet({ ...t, wandMaat: w })}>{w} m</button>)}</div></div>
            <label className="fm-veld">Wanden vanaf de rand (m, 0 = aan de rand)<input type="number" step="0.25" min="0" max="3" disabled={!schrijven} value={t.wandAfstand ?? 1} onChange={(e) => zet({ ...t, wandAfstand: Math.max(0, Number(e.target.value) || 0) })} /></label>
          </div>}
          {m.type === 'sail' && <div className="fm-sb-inst">
            <div className="fm-sb-rij">Pieken <div className="fm-segment">{[1, 2, 3, 4].map((n) => <button key={n} disabled={!schrijven} className={sailPieken(m, t).length === n ? 'aan' : ''} onClick={() => zet({ ...t, pieken: n })}>{n}</button>)}</div></div>
            <label className="fm-veld">Nokhoogte (m)<input type="number" step="0.1" min="3" max="12" disabled={!schrijven} value={t.nokH ?? m.nok} onChange={(e) => zet({ ...t, nokH: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} /></label>
          </div>}
          {m.type !== 'stretch' && <label className="fm-veld">Zijwandhoogte (m)<input type="number" step="0.1" min="2" max="8" disabled={!schrijven} value={t.zijH ?? m.zijH} onChange={(e) => zet({ ...t, zijH: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} /></label>}
          {!vrij && <div className="fm-sub">Nokhoogte volgt vanzelf: {getal(m.nok)} m. Lengte en breedte pas je aan op het plan{modulair ? ` (per travee van ${getal(m.travee)} m)` : ''}.</div>}
          {modulair && <div className="fm-veld">Spitszeil boven de zijwand
            {[['V', 'Voor'], ['A', 'Achter']].map(([z, zn]) => (
              <div key={z} className="fm-sb-rij" style={{ flexWrap: 'wrap' }}><span style={{ width: 46 }}>{zn}</span><div className="fm-segment">{[['dicht', 'Dicht'], ['transparant', 'Transparant'], ['open', 'Open']].map(([k, n]) => <button key={k} disabled={!schrijven} title={k === 'open' ? 'Spitszeil eruit: open tussen zijwand en dak' : undefined} className={(t.gevelZ?.[z] || t.gevel || 'dicht') === k ? 'aan' : ''} onClick={() => { const gz = { V: t.gevelZ?.V || t.gevel || 'dicht', A: t.gevelZ?.A || t.gevel || 'dicht', [z]: k }; zet({ ...t, gevel: undefined, gevelZ: gz }); }}>{n}</button>)}</div>
                <label className="fm-vink" title="Overspanning zonder tussenpalen in de gevel: enkel de hoekstaanders (versterkt gevelspant)"><input type="checkbox" disabled={!schrijven} checked={!!t.gevelVrij?.[z]} onChange={(e) => zet({ ...t, gevelVrij: { ...(t.gevelVrij || {}), [z]: e.target.checked || undefined } })} />Zonder tussenpalen</label>
                <select disabled={!schrijven} value={t.gevelDoek?.[z] || ''} title="Eén bedrukt doek over de hele gevel, ook over de spits" onChange={(e) => zet({ ...t, gevelDoek: { ...(t.gevelDoek || {}), [z]: e.target.value || undefined } })} style={{ maxWidth: '100%' }}><option value="">Geen doek over de hele gevel</option>{ontwerpen.map((o) => <option key={o.id} value={o.id}>Doek: {o.naam}</option>)}</select></div>
            ))}
          </div>}
          {!vrij && <label className="fm-veld">Kleur aluminium<select disabled={!schrijven} value={t.kleur || 'naturel'} onChange={(e) => zet({ ...t, kleur: e.target.value === 'naturel' ? undefined : e.target.value })}><option value="naturel">Naturel</option><option value="wit">Wit</option><option value="zwart">Zwart</option></select></label>}
          <div className="fm-kop" style={{ marginTop: 6 }}>Vloer en terras</div>
          {(() => {
            const vloeren = elementen.filter((e) => e.eigenschappen?.vloer && ['vlonder', 'cassette', 'zwaarlastvloer'].includes(e.eigenschappen?.materiaal));
            const vId = typeof vloer === 'object' ? vloer?.id : null;
            return <>
              {onVloer && <label className="fm-veld">Vloer in de tent<select disabled={!schrijven} value={vId || ''} onChange={(e) => onVloer(e.target.value || null)}><option value="">Geen vloer</option>{vloeren.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</select></label>}
              {onActie && <label className="fm-veld">Vloer van het terras<select disabled={!schrijven} value={t.terrasVloer || ''} onChange={(e) => zet({ ...t, terrasVloer: e.target.value || undefined })}><option value="">Enkel in 3D</option>{vloeren.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</select></label>}
            </>;
          })()}
          <label className="fm-veld">Verhoogde vloer (m, 0 = op de grond)<input type="number" step="0.05" min="0" max="2" disabled={!schrijven} value={t.vloerH ?? 0} onChange={(e) => zet({ ...t, vloerH: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} /></label>
          <div className="fm-sub">Terras: diepte per zijde (m). Leuning en trap komen er vanzelf bij.</div>
          <div className="fm-tb-terras">{[['V', 'Voor'], ['A', 'Achter'], ['L', 'Links'], ['R', 'Rechts']].map(([z, n]) => <label key={z}>{n}<input type="number" step="0.5" min="0" max="10" disabled={!schrijven} value={t.terras?.[z] ?? 0} onChange={(e) => zetTerras(z, e.target.value)} /></label>)}</div>
          <label className="fm-veld">Hoogte terras (m)<input type="number" step="0.05" min="0" max="2" disabled={!schrijven} value={t.terrasH ?? (Number(t.vloerH) > 0 ? t.vloerH : TERRAS_H)} onChange={(e) => zet({ ...t, terrasH: Number(e.target.value) >= 0 ? Number(e.target.value) : undefined })} /></label>
          {onActie && schrijven && <button type="button" className="fm-knop klein" disabled={!t.terrasVloer || !Object.values(t.terras || {}).some((d) => Number(d) > 0)} title={t.terrasVloer ? 'Het terras als echte vloer (vlonders …) op het plan: telt mee in de stuklijst' : 'Kies eerst de vloer van het terras'} onClick={() => { for (const [z, d] of Object.entries(t.terras || {})) if (Number(d) > 0) onActie('tent-terras', { zijde: z, diepte: Number(d), el: t.terrasVloer }); }}>Terras op het plan zetten</button>}
          {onActie && schrijven && <TentErnaast el={el} elementen={elementen} onZet={(zijde, elId) => onActie('tent-ernaast', { zijde, el: elId })} />}
          {modulair && <div className="fm-sb-rij">Luifel voor <input type="number" step="0.5" min="0" max="5" disabled={!schrijven} value={t.luifel?.V ?? 0} onChange={(e) => zet({ ...t, luifel: { ...(t.luifel || {}), V: Math.max(0, Number(e.target.value) || 0) } })} style={{ width: 52 }} /> achter <input type="number" step="0.5" min="0" max="5" disabled={!schrijven} value={t.luifel?.A ?? 0} onChange={(e) => zet({ ...t, luifel: { ...(t.luifel || {}), A: Math.max(0, Number(e.target.value) || 0) } })} style={{ width: 52 }} /> m</div>}
          </>}
          {scherm === 'branding' && <>
            <div className="fm-kop">Branding</div>
            <div className="fm-sub" style={{ margin: '0 0 6px' }}>Kies wat je plaatst en klik op een zijde (in 3D of in het bovenaanzicht), of sleep een ontwerp erop.</div>
            <div className="fm-tb-wanden">
              <button type="button" className={wand === 'doek' ? 'aan' : ''} disabled={!schrijven} draggable={schrijven} onDragStart={(e) => { e.dataTransfer.setData('text/fm-tent', 'wand:doek'); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => setWand('doek')}><WandStaal w={wandSoort('doek')} /><span>Bedrukt doek</span></button>
              <button type="button" className={!wand ? 'aan' : ''} onClick={() => setWand(null)}><span className="fm-tb-staal kies">⌖</span><span>Kiezen</span></button>
            </div>
          {!vrij && <button type="button" className={`fm-tb-frame${wand === 'frame' ? ' aan' : ''}`} draggable={schrijven} disabled={!schrijven} title="Buizenkader met banner boven de dakrand (signing frame)" onDragStart={(e) => { e.dataTransfer.setData('text/fm-tent', 'frame'); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => setWand('frame')}><span className="fm-tb-staal" style={{ background: '#3730A3' }} /><span>Signing frame</span></button>}
          {(wand === 'doek' || wand === 'frame') && (
            <div className="fm-sb-inst">
              <div className="fm-sub">{wand === 'frame' ? 'Klik een zijde = frame plaatsen of weghalen. Sleep een ontwerp op een frame voor de banner. Kies een frame (Kiezen) om het met zijn buur te koppelen: één lange banner.' : 'Sleep een ontwerp op een zijde. Het doek vult de zijwand van dat segment.'}</div>
              {ontwerpen.length > 0 && <div className="fm-sb-ontwerpen">{ontwerpen.map((o) => <button key={o.id} type="button" draggable title={`${o.naam}: sleep op een zijde`} className={ontwerp === o.id ? 'aan' : ''} onDragStart={(e) => { e.dataTransfer.setData('text/fm-tent', `doek:${o.id}`); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => setOntwerp(o.id)}>{o.eigenschappen?.beeld ? <img src={publiekeUrl(o.eigenschappen.beeld)} alt="" /> : <span style={{ background: o.eigenschappen?.kleur || '#0F766E' }} />}<em>{o.naam}</em></button>)}</div>}
              {schrijven && <DoekUpload planId={it.plan_id} drager="hek" klein onNieuw={(d) => setOntwerp(d.id)} />}
            </div>
          )}
            {modulair && <label className="fm-veld" style={{ marginTop: 8 }}>Doek over de hele gevel
              {[['V', 'Voorgevel'], ['A', 'Achtergevel']].map(([z, zn]) => <select key={z} aria-label={zn} disabled={!schrijven} value={t.gevelDoek?.[z] || ''} onChange={(e) => zet({ ...t, gevelDoek: { ...(t.gevelDoek || {}), [z]: e.target.value || undefined } })}><option value="">{zn}: geen doek</option>{ontwerpen.map((d) => <option key={d.id} value={d.id}>{zn}: {d.naam}</option>)}</select>)}
            </label>}
          </>}
          {scherm === 'nakijken' && <>
            <div className="fm-kop">Bekijken vanaf</div>
            <div className="fm-tb-kijk">{[['vrij', 'Vrij'], ['V', 'Voorgevel'], ['L', 'Linkerzijde'], ['A', 'Achtergevel'], ['R', 'Rechterzijde'], ['boven', 'Boven']].map(([k, n]) => <button key={k} type="button" className={kijk === k ? 'aan' : ''} onClick={() => setKijk(k)}>{n}</button>)}</div>
            <div className="fm-kop" style={{ marginTop: 12 }}>Nakijken</div>
            {meldingen.length ? meldingen.map((x, k) => <div key={k} className={`fm-melding ${x.soort === 'fout' ? 'fout' : 'let-op'}`} style={{ marginBottom: 6 }}>{x.tekst}</div>) : <div className="fm-melding ok">Niets op te merken.</div>}
            <div className="fm-kop" style={{ marginTop: 12 }}>Afdrukken</div>
            <button type="button" className="fm-knop vol" disabled={pdfBezig} onClick={maakPdf}>{pdfBezig ? 'PDF maken…' : 'PDF met 3D, grondplan en aanzichten'}</button>
            <div className="fm-kop" style={{ marginTop: 12 }}>Plannen van de tentbouwer</div>
            <StellingPlannen planId={it.plan_id} itemId={it.id} schrijven={schrijven} soort="tentplan" wie="tentbouwer" compact />
          </>}
        </aside>
        <div className="fm-sb-midden">
          {zicht === 'vloer' && <TentVloerPlan m={m} stukken={t.stukken || []} elementen={elementen} schrijven={schrijven} kiesEl={kiesStuk} hNieuw={hNieuw} buren={(groep || []).slice(1).map((g) => [[0, 0], [g.m.L, 0], [g.m.L, g.m.B], [0, g.m.B]].map(g.T))} tentEl={tentKies} tentLengte={tentLengte} dwars={dwars} onTent={onActie ? (b) => onActie('tent-plaats', b) : null} onBuur={kiesLid ? (k) => kiesLid(groep?.[k + 1]?.it?.id) : null}
            maat={onActie && !vrij ? { travee: modulair ? m.travee : m.L, vastL: !modulair, breedtes: modulair ? [...new Map(elementen.filter((e) => isTentBouw(e) && tentTypeVan(e) === tentTypeVan(el) && (Number(e.breedte_m) || 0) === (Number(el?.breedte_m) || 0)).map((e) => [Number(e.diepte_m), { B: Number(e.diepte_m), el: e.id }])).values()] : [] } : null}
            onMaat={(g) => { const n = { ...t, stukken: (t.stukken || []).map((q) => ({ ...q, x: r3(q.x - g.x0), y: r3(q.y - g.y0) })) }; if (!n.stukken.length) delete n.stukken; terugL.current.push(t); setT(n); onActie('tent-maat', { ...g, tent: n }); }}
            onZet={(l) => zet({ ...t, stukken: l.length ? l : undefined })} />}
          <div className={`fm-sb-drie fm-tb-drie${zicht === 'vloer' ? ' klein' : ''}`}>
            <span className="fm-sb-drie-melding">{MELDING_TENT}</span>
            {scherm === 'bouwen' && schrijven && !startWeg && (
              <div className="fm-sb-startscherm">
                <h2>Waar begin je mee?</h2>
                <div className="fm-sub">Kies hoe de tent er rondom uitziet. Daarna pas je per wand of per paneel aan.</div>
                <div className="fm-sb-startraster">
                  {START_TENT.map((pr) => <button key={pr.k} type="button" onClick={() => startMet(pr)}><b>{pr.naam}</b><span className="fm-sub">{pr.uitleg}</span></button>)}
                  <button type="button" onClick={() => setStartWeg(true)}><b>Zelf kiezen</b><span className="fm-sub">Begin met de standaardwanden van dit type.</span></button>
                </div>
              </div>
            )}
            <TentDrie it={it} el={el} tent={t} groep={groep} items={items} doekMap={doekMap} vloer={vloer} gekozen={gekozen} gekozenPan={gekozenPan} kies={klik} dakKies={scherm === 'bouwen' ? (i) => { setGekozen(null); setGekozenPan(null); setGekozenDak(i); } : () => setGekozen(null)} zicht={scherm === 'nakijken' ? KIJK_T[kijk] : null} gekozenDak={gekozenDak} sleepInter={schrijven && m.n > 1 && modulair ? verplaatsInter : null} drop={schrijven ? drop : undefined} kiesLid={kiesLid ? (k) => kiesLid(groep?.[k]?.it?.id) : null} />
          </div>
        </div>
        <aside className="fm-ws-rechts">
          {scherm !== 'nakijken' && <>
          <div className="fm-kop">Bovenaanzicht</div>
          <div className="fm-sub">Klik op een zijde (ook de achterkant) om er de gekozen wand op te zetten.</div>
          <TentSchema m={m} t={t} gekozen={gekozen} onKies={klik} onDrop={drop} open={open} onInter={m.n > 1 && m.type !== 'vouw' ? zetInter : null} />
          {buren.length > 0 && <div className="fm-sub fm-tb-koppel">Gekoppeld op het plan aan {buren.map((b) => b.it.naam || b.el?.naam).join(', ')}.{vrij ? ' De doeken sluiten op elkaar aan en worden samen getoond.' : ' De gedeelde zijden zijn open met een regengoot; zet er een wand op voor een tussenwand.'}</div>}
          </>}
          {scherm === 'bouwen' && m.n > 1 && m.type !== 'vouw' && !vrij && <>
            <div className="fm-kop" style={{ marginTop: 6 }}>Intergevels</div>
            <div className="fm-sub">Een binnenwand op een spant deelt de tent op. Kies daarna per deel de wand, net als een buitenwand.</div>
            <div className="fm-tb-inter">{Array.from({ length: m.n - 1 }, (_, k) => <label key={k} className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={!!t.inter?.[k + 1]} onChange={() => zetInter(k + 1)} />Na {m.type === 'pagode' ? 'pagode' : 'travee'} {k + 1}</label>)}</div>
            {(m.type === 'kader' || m.type === 'boog') && Object.keys(t.inter || {}).filter((sp) => t.inter[sp]).map((sp) => (
              <label key={sp} className="fm-veld">Doek over intergevel na travee {sp} (ook de spits)
                <select disabled={!schrijven} value={t.gevelDoek?.[`I-${sp}`] || ''} onChange={(e) => zet({ ...t, gevelDoek: { ...(t.gevelDoek || {}), [`I-${sp}`]: e.target.value || undefined } })}><option value="">Geen doek</option>{ontwerpen.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}</select>
              </label>
            ))}
          </>}
          {scherm !== 'nakijken' && gekozen && gw && (
            <div className="fm-sb-inst">
              <strong style={{ textTransform: 'capitalize' }}>{segNaam(gekozen, m)}</strong>
              <label className="fm-veld">Hele wand<select disabled={!schrijven} value={gw.k} onChange={(e) => zetWand(gekozen, e.target.value, e.target.value === 'doek' ? t.doeken?.[gekozen] || ontwerp || null : null, true)}>{WANDEN.map((w) => <option key={w.k} value={w.k}>{w.naam}</option>)}</select></label>
              {!vrij && (() => {
                const sg = segs.find((x) => x.key === gekozen); if (!sg) return null;
                const pl = wandPanelen(m, t, sg, sg.zijde === 'I' ? 'wit' : standaardWand(m)); const pk = pl.find((x) => x.i === gekozenPan || (gekozenPan != null && gekozenPan > x.i && gekozenPan < x.i + x.n));
                return (
                  <div className="fm-veld">Panelen van 1 m (klik een paneel)
                    <div className="fm-tb-panelen">{pl.map((p) => <button key={p.i} type="button" style={{ flex: p.n }} className={pk?.i === p.i ? 'aan' : ''} title={`Paneel ${p.i + 1}${p.n > 1 ? `–${p.i + p.n}` : ''}: ${p.w.naam}`} onClick={() => setGekozenPan(p.i)}><WandStaal w={p.w} /></button>)}</div>
                    {pk && <label className="fm-veld">Paneel {pk.i + 1}{pk.n > 1 ? `–${pk.i + pk.n}` : ''}<select disabled={!schrijven} value={pk.soort} onChange={(e) => zetPaneel(gekozen, pk.i, e.target.value)}>{WANDEN.filter((w) => w.k !== 'doek').map((w) => <option key={w.k} value={w.k}>{w.naam}{w.deur === 2 ? ' (2 m)' : ''}</option>)}</select></label>}
                  </div>
                );
              })()}
              {!gekozen.startsWith('I-') && !vrij && <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={!!t.frames && gekozen in t.frames} onChange={() => zetFrame(gekozen, null)} />Signing frame boven de dakrand</label>}
              {t.frames && gekozen in t.frames && (() => {
                const r = runVan(runs, gekozen); if (!r) return null; const { links, rechts } = runBuren(runs, r); const bm = bannerMaat(r.len); const nt = new Set(r.delen.map((d) => d.k)).size;
                return <>
                  <label className="fm-veld">Banner<select disabled={!schrijven} value={r.doek || ''} onChange={(e) => zetBanner(gekozen, e.target.value)}><option value="">Nog geen ontwerp</option>{ontwerpen.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}</select></label>
                  <div className="fm-sub">Banner {getal(bm.l)} × {getal(bm.h)} m{r.delen.length > 1 ? ` · één doek over ${r.delen.length} frames${nt > 1 ? ` in ${nt} tenten` : ''}` : ''}.</div>
                  {schrijven && (links || rechts) && <div className="fm-sb-rij fm-tb-koppelrij">Eén banner met <div className="fm-segment">
                    {links && <button type="button" title="Koppel met het frame links ervan (gezien van buiten): één lang kader met één banner" onClick={() => koppelRuns(links, r)}>← Links</button>}
                    {rechts && <button type="button" title="Koppel met het frame rechts ervan (gezien van buiten): één lang kader met één banner" onClick={() => koppelRuns(r, rechts)}>Rechts →</button>}
                  </div></div>}
                  {schrijven && r.delen.length > 1 && <button type="button" className="fm-knop klein" title="Weer aparte frames, elk met zijn eigen banner" onClick={() => ontkoppelRun(r)}>Ontkoppelen</button>}
                </>;
              })()}
              {gw.doek && <label className="fm-veld">Ontwerp<select disabled={!schrijven} value={t.doeken?.[gekozen] || ''} onChange={(e) => zet({ ...t, doeken: { ...(t.doeken || {}), [gekozen]: e.target.value || undefined } })}><option value="">Nog geen ontwerp</option>{ontwerpen.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}</select></label>}
            </div>
          )}
          {scherm === 'bouwen' && gekozenDak != null && (
            <div className="fm-sectie fm-tb-dakkaart">
              <div className="fm-kop">Dak{modulair && m.n > 1 ? ` · travee ${gekozenDak + 1}` : ''}<button type="button" className="fm-x" aria-label="Dak loslaten" onClick={() => setGekozenDak(null)}>×</button></div>
              <div className="fm-tb-daken">
                {DAKEN.map((d) => { const nu = (modulair && m.n > 1 ? t.dakPer?.[gekozenDak] : null) || t.dak || (m.type === 'sail' ? 'zeildoek' : 'wit'); return (
                  <button key={d.k} type="button" disabled={!schrijven} className={nu === d.k ? 'aan' : ''} onClick={() => (modulair && m.n > 1 ? zetDak(gekozenDak, d.k) : zet({ ...t, dak: d.k, dakPer: {} }))}>
                    <span className="fm-tb-staal" style={{ background: d.kleur, opacity: Math.max(0.35, d.dekking ?? 1) }} />{d.naam}
                  </button>); })}
              </div>
              {modulair && m.n > 1 && schrijven && <button type="button" className="fm-knop klein" onClick={() => zet({ ...t, dak: t.dakPer?.[gekozenDak] || t.dak, dakPer: {} })}>Dit dak voor alle traveeën</button>}
            </div>
          )}
          {scherm === 'bouwen' && modulair && m.n > 1 && <>
            <div className="fm-kop" style={{ marginTop: 12 }}>Dak per travee</div>
            {Array.from({ length: m.n }, (_, i) => (
              <div key={i} className="fm-sb-rij fm-tb-travee"><span>Travee {i + 1}</span><select disabled={!schrijven} value={t.dakPer?.[i] || t.dak || 'wit'} onChange={(e) => zetDak(i, e.target.value)}>{DAKEN.map((d) => <option key={d.k} value={d.k}>{d.naam}</option>)}</select></div>
            ))}
          </>}
          {scherm === 'nakijken' && <>
          <div className="fm-kop">Materiaalstaat</div>
          <table className="fm-tabel"><tbody>{[...telling, ...Object.values((t.stukken || []).reduce((acc, x) => { const e = elementen.find((q) => q.id === x.el); const n = e?.naam || 'Vloerstuk'; acc[n] = { naam: n, aantal: (acc[n]?.aantal || 0) + 1 }; return acc; }, {}))].map((x) => <tr key={x.naam}><td>{x.naam}</td><td className="getal">{x.aantal}</td></tr>)}</tbody></table>
          <div className="fm-sub" style={{ marginTop: 8 }}>Een schatting om mee te plannen. De tentbouwer bepaalt de constructie, de verankering en de ballast.</div>
          </>}
        </aside>
      </div>
    </div>,
    document.body,
  );
}

function WandStaal({ w }) {
  if (w.k === 'open') return <span className="fm-tb-staal open" />;
  return (
    <span className="fm-tb-staal" style={{ background: w.kleur, opacity: Math.max(0.45, w.dekking) }}>
      {w.strook && <i className="strook" />}{w.glas && <i className="glas" />}{w.deur && <i className={`deur d${w.deur}${w.hout ? ' hout' : ''}`} />}{w.rits && <i className="rits" />}{w.nood && <i className="nood" />}{w.paneel && <i className="paneel" />}{w.raster && <i className="raster" />}{w.vakken && <i className="vakken" />}
    </span>
  );
}

// Een tweede tent tegen een zijde: kies de zijde en de tent; op het plan koppelen ze vanzelf (en dus ook hier in 3D).
function TentErnaast({ el, elementen, onZet }) {
  const lijst = elementen.filter((e) => e.actief !== false && (e.categorie === 'Tenten en vloeren' || e.categorie === 'Tenten')).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const [zijde, setZijde] = useState('R'); const [elId, setElId] = useState(el?.id || '');
  return (
    <div className="fm-sb-inst">
      <div className="fm-kop">Tent ernaast</div>
      <div className="fm-segment">{[['L', 'Links'], ['R', 'Rechts'], ['V', 'Voor'], ['A', 'Achter']].map(([z, n]) => <button key={z} type="button" className={zijde === z ? 'aan' : ''} onClick={() => setZijde(z)}>{n}</button>)}</div>
      <select value={elId} onChange={(e) => setElId(e.target.value)} aria-label="Welke tent">{lijst.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</select>
      <button type="button" className="fm-knop klein" disabled={!elId} onClick={() => onZet(zijde, elId)}>Tent ernaast zetten</button>
      <div className="fm-sub">Komt op het plan tegen deze zijde en wordt gekoppeld: de gedeelde zijde is open met een regengoot.</div>
    </div>
  );
}
