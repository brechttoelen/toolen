'use client';
import TerugKnop from './TerugKnop';

// Stellingbouwer: een stellingconstructie (brug, podium, camerastelling, tribune) uit vakken van 2,07 m.
// Twee standen: Kiezen (klik een vak, rand of hoek in het boven-, zij- of 3D-aanzicht; rechts de inspector met
// soort, hoogte, helling, doorgang, leuning, doek en hoek) en Tekenen (links een type opzetten of een blok kiezen
// en op het raster klikken, slepen of verven). Een helling over meerdere vakken slepen = de hoogte loopt vanzelf op.
// Het zijaanzicht is een langsaanzicht zoals een Gigant-tekening: dekhoogtes slepen per rozet, maten in mm.
// Staanders, liggers, leuningen, kantplanken, diagonalen en voetspindels komen er vanzelf bij.
import { useBouwerSchild, schildProps } from './bouwerschild';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { VAK, LEUNING_H, LADDER_BOVEN, SOORTEN, soortVan, RICHTING, HOEKEN, RAND, sleutel, uitSleutel, hoogteOp, stellingAfgeleid,  stellingKader, brugVakken, brugMaat, HELLINGEN, afwijking, stellingMaten, HALF, LEUNINGEN, leuningHoogte, delenVan, opCm, grondVan, grondHoek, PLATEN, AANLOOP, LIGGERS, liggerSoort, DOORGANG_FUNCTIES, functieNaam, TRAPMODULES, BORDES, OPSTAP, trapModule, hellingenVanzelf, brugDek, onderDek, WIEL_H, START_TYPES, cameraStelling, platform, tribune, voetgangersbrug, ROZET, schoorOpRand, horizontaleDiagonalen, liggerHoogtes, GEEN_STAANDER, doorgangWand, doorgangOpen, rozetVoet, DEK_ROZET, cameraPlek, cameraStandaard, CAMERA_OOG, CAMERA_SECTOR, isMetaal, metaalDelen, METAAL_OP, toren, randParen, paarSleutel, wandBoven, tussenVloeren, tussenOpen, vloerHoogtes, vloerRozet, vloerLoop, wandMaten, wandRozetten, wandLiggers, wandVloeren, wandVloerLeuning, schoorStukken, schoorStart } from './stellingbouw';
import { LENZEN, OPSTELLINGEN, tvCamTekst } from './tvcamera';
import { publiekeUrl } from './db';
import { DoekUpload } from './doekupload';

const getal = (v, d = 2) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: d });
const rad = (g) => (g * Math.PI) / 180;
const nieuwId = () => Math.random().toString(36).slice(2, 9);
const P2 = (q) => q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

import { bouwScene, zonderDoeken, DOEK_SOORTEN, stellingStuklijst, wandSchoren } from './stelling/scene';
import { grondToepassen, grondFunctie } from './stelling/grond';
import { stellingOpschonen } from './stelling/opschonen';
export { bouwScene, zonderDoeken };
// Zijden voor branding: standpunt van de camera (hoek rond, kantel omhoog) in graden.
const ZIJDEN = [['vrij', 'Vrij'], ['voor', 'Voorkant'], ['achter', 'Achterkant'], ['links', 'Links'], ['rechts', 'Rechts'], ['boven', 'Boven']];
const KIJK = { vrij: [35, 26], voor: [0, 8], achter: [180, 8], links: [-90, 8], rechts: [90, 8], boven: [0, 85] };

// Groot beeld: echte 3D (three.js, pas geladen als nodig). Klein voorbeeld of geen WebGL: de SVG-tekening.
const StellingDrieGL = dynamic(() => import('./StellingDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });
let _gl = null;
export function webglKan() {
  if (_gl != null) return _gl;
  if (typeof window === 'undefined') return false;
  try { const c = document.createElement('canvas'); _gl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { _gl = false; }
  return _gl;
}
const StellingDrieSvg = memo(StellingDrie0);
// Klein voorbeeld (paneel, bibliotheek): een foto van de echte 3D, gemaakt in een verborgen renderer. Tot die klaar
// is (of zonder WebGL) de SVG-tekening.
function StellingFoto(props) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let weg = false;
    import('./StellingDrieGL').then((m) => m.fotoVan(props.st, props.doekMap)).then((u) => { if (!weg) setUrl(u || null); }).catch(() => {});
    return () => { weg = true; };
  }, [props.st, props.doekMap]);
  return url ? <div className="fm-wz mini fm-wz-foto"><img src={url} alt="3D-voorbeeld van de stelling" /></div> : <StellingDrieSvg {...props} />;
}
// Duimnagel voor lijsten (bibliotheek): een kleine foto van de 3D, met een eenvoudige tekening tot die klaar is.
export function StellingDuim({ st, maat = 40 }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let weg = false;
    if (!st || !webglKan()) return undefined;
    import('./StellingDrieGL').then((m) => m.fotoVan(st, new Map(), { b: 120, h: 120 })).then((u) => { if (!weg) setUrl(u || null); }).catch(() => {});
    return () => { weg = true; };
  }, [st]);
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" width={maat} height={maat} style={{ width: maat, height: maat, objectFit: 'cover', display: 'block' }} />;
  return (
    <svg width={maat} height={maat} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 30 L8 16 L22 11 L32 15 L32 28 M18 34 L18 20 L32 15 M8 16 L18 20 M8 30 L18 34 L32 28" fill="none" stroke="#8592A3" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 16 L22 11 L32 15 L18 20 Z" fill="#C8A26B" stroke="#8A6A45" strokeWidth="1.2" />
    </svg>
  );
}
export const StellingDrie = memo(function StellingDrie(props) {
  const [gl, setGl] = useState(false);
  useEffect(() => { setGl(webglKan()); }, []);
  if (!gl) return <StellingDrieSvg {...props} />;
  return props.mini ? <StellingFoto {...props} /> : <StellingDrieGL st={props.st} doekMap={props.doekMap} hoek={props.hoek} kantel={props.kantel} onKies={props.onKies} gekozen={props.gekozen} celKiezen={props.celKiezen} onSleep={props.onSleep} onDubbel={props.onDubbel} doekGekozen={props.doekGekozen} zweef={props.zweef} />;
});
function StellingDrie0({ st, doekMap = new Map(), mini = false, hoek: hoek0 = 35, kantel: kantel0 = 26, interactief = !mini }) {
  const ref = useRef(null); const [maat, setMaat] = useState({ w: 600, h: 400 });
  const [stand, setStand] = useState([hoek0, kantel0]); const [zoom, setZoom] = useState(1); const [schuif, setSchuif] = useState([0, 0]); const sleep = useRef(null);
  useEffect(() => { const e = ref.current; if (!e) return undefined; const ro = new ResizeObserver(() => setMaat({ w: e.clientWidth || 600, h: e.clientHeight || 400 })); ro.observe(e); return () => ro.disconnect(); }, []);
  const t = rad(stand[0]); const ph = rad(stand[1]);
  const proj = ([x, y, z]) => { const xr = x * Math.cos(t) - y * Math.sin(t); const yr = x * Math.sin(t) + y * Math.cos(t); return [xr, -z * Math.cos(ph) - yr * Math.sin(ph), yr * Math.cos(ph) - z * Math.sin(ph)]; };
  const delen = useMemo(() => delenVan(st), [st]);
  const afs = useMemo(() => delen.map((dl) => stellingAfgeleid(dl.d, { verbonden: dl.verbonden })), [delen]);
  const hoog = Math.max(1, ...afs.flatMap((af) => [...af.knopen.map((n) => n.h + (n.leuning ? LEUNING_H : 0)), ...[...af.portaal.knopen.values()].map((p) => p.T)]));
  const hoekpunten = []; const grondPt = [];
  delen.forEach((dl) => { const K = stellingKader(dl.d); const M = stellingMaten(dl.d); if (K.leeg) return; for (const x of [M.x(K.i0), M.x(K.i1)]) for (const y of [M.y(K.j0), M.y(K.j1)]) { const w = dl.T([x, y]); grondPt.push(w); for (const z of [0, hoog]) hoekpunten.push(proj([w[0], w[1], z])); } });
  if (!hoekpunten.length) for (const x of [0, VAK * 4]) for (const y of [0, VAK * 3]) for (const z of [0, 1]) hoekpunten.push(proj([x, y, z]));
  const xs = hoekpunten.map((p) => p[0]); const ys = hoekpunten.map((p) => p[1]);
  const pad = mini ? 8 : 50;
  const s = Math.min((maat.w - pad * 2) / Math.max(1, Math.max(...xs) - Math.min(...xs)), (maat.h - pad * 2) / Math.max(1, Math.max(...ys) - Math.min(...ys)), 120) * zoom;
  const ox = maat.w / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * s + schuif[0]; const oy = maat.h / 2 - ((Math.min(...ys) + Math.max(...ys)) / 2) * s + schuif[1];
  const S = (q) => { const p = proj(q); return [p[0] * s + ox, p[1] * s + oy, p[2]]; };
  const lagen = [];
  const quad = (pts, vul, rand, extra = {}) => { const q = pts.map(S); lagen.push({ d: q.reduce((a, p) => a + p[2], 0) / q.length, el: (k) => <polygon key={k} points={P2(q)} fill={vul} stroke={rand} strokeWidth={0.8} {...extra} /> }); };
  const voet = (p, o = {}) => { const v = S(p); const w2 = S([p[0], p[1], p[2] + 0.1]); lagen.push({ d: v[2] + 0.05, el: (k) => (o.wiel ? <circle key={k} cx={w2[0]} cy={w2[1]} r={3.2} fill="#EDE8DA" stroke="#6B7280" strokeWidth={0.8} /> : <rect key={k} x={v[0] - 4} y={v[1] - 2} width={8} height={4} fill="#8A6A45" />) }); };
  const rozet = (p) => { const v = S(p); lagen.push({ d: v[2] - 0.01, el: (k) => <circle key={k} cx={v[0]} cy={v[1]} r={1.6} fill="#5F6B78" /> }); };
  const beeld = ({ vorm, top, src, kl, id }) => {
    const zMax = Math.max(...vorm.map((q) => q[2])); const zMin = Math.min(...vorm.map((q) => q[2]));
    const P0 = S([top[0][0], top[0][1], zMax]); const P1 = S([top[top.length - 1][0], top[top.length - 1][1], zMax]); const P3 = S([top[0][0], top[0][1], zMin]);
    const qs = vorm.map(S);
    const m = `matrix(${P1[0] - P0[0]} ${P1[1] - P0[1]} ${P3[0] - P0[0]} ${P3[1] - P0[1]} ${P0[0]} ${P0[1]})`;
    lagen.push({ d: qs.reduce((x, p) => x + p[2], 0) / qs.length - 0.03, el: (k) => <g key={k}><clipPath id={id}><polygon points={P2(qs)} /></clipPath><polygon points={P2(qs)} fill={kl} /><image href={src} x={0} y={0} width={1} height={1} preserveAspectRatio="none" transform={m} clipPath={`url(#${id})`} /></g> });
  };
  const label = ({ vlakken, midden, B, H, kl, tekst, maat: mt }) => {
    // Het vlak dat het dichtst bij de kijker ligt; de maat pas tonen als dat groot genoeg in beeld is.
    const jv = S(midden[0])[2] <= S(midden[1])[2] ? 0 : 1;
    const m = S(midden[jv]); const fs = Math.max(11, Math.min(18, s * Math.min(B, H) * 0.09));
    const hk = vlakken[jv].map(S); const bw = Math.max(...hk.map((q) => q[0])) - Math.min(...hk.map((q) => q[0])); const bh = Math.max(...hk.map((q) => q[1])) - Math.min(...hk.map((q) => q[1]));
    if (bw >= fs * 3.6 && bh >= fs * 1.8) lagen.push({ d: -999, el: (k) => (
      <text key={k} x={m[0]} y={m[1]} textAnchor="middle" fontWeight={700} fill={kl} style={{ paintOrder: 'stroke' }} stroke="#fff" strokeWidth={3.5}>
        <tspan x={m[0]} dy={-fs * 0.2} fontSize={fs * 0.75}>{tekst}</tspan>
        <tspan x={m[0]} dy={fs * 1.05} fontSize={fs}>{mt}</tspan>
      </text>
    ) });
  };
  const lijn = (a, b, kl, w = 1, dd = 0) => { const p = S(a); const q = S(b); lagen.push({ d: (p[2] + q[2]) / 2 - dd, el: (k) => <line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={kl} strokeWidth={w} strokeLinecap="round" /> }); };
  bouwScene({ st, delen, afs, mini, doekMap }, { quad, lijn, voet, rozet, beeld, label });
  lagen.sort((a, b) => b.d - a.d);
  const gx = grondPt.length ? grondPt.map((p) => p[0]) : [0, VAK * 4]; const gy = grondPt.length ? grondPt.map((p) => p[1]) : [0, VAK * 3];
  const grond = [[Math.min(...gx) - 2, Math.min(...gy) - 2], [Math.max(...gx) + 2, Math.min(...gy) - 2], [Math.max(...gx) + 2, Math.max(...gy) + 2], [Math.min(...gx) - 2, Math.max(...gy) + 2]].map(([x, y]) => S([x, y, 0]));
  // Zoomen rond een punt (muis of het midden tussen twee vingers): dat punt blijft op zijn plaats.
  const vingers = useRef(new Map()); const [schuifModus, setSchuifModus] = useState(false);
  const zoomOm = (f, px, py) => {
    setZoom((z) => { const nz = Math.max(0.3, Math.min(20, z * f)); const k = nz / z; const cx = maat.w / 2; const cy = maat.h / 2;
      setSchuif(([sx, sy]) => [(px - cx) - ((px - cx) - sx) * k, (py - cy) - ((py - cy) - sy) * k]); return nz; });
  };
  const lokaal = (e) => { const b = ref.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const neer = (e) => {
    if (!interactief) return; vingers.current.set(e.pointerId, lokaal(e)); e.currentTarget.setPointerCapture?.(e.pointerId);
    if (vingers.current.size === 2) { const [a, b] = [...vingers.current.values()]; sleep.current = { knijp: Math.hypot(a[0] - b[0], a[1] - b[1]), hoek: Math.atan2(b[1] - a[1], b[0] - a[0]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], sc: schuif }; return; }
    sleep.current = { x: e.clientX, y: e.clientY, st: stand, sc: schuif, pan: schuifModus || e.button !== 0 || e.shiftKey };
  };
  const beweeg = (e) => {
    const g = sleep.current; if (!g) return;
    if (vingers.current.has(e.pointerId)) vingers.current.set(e.pointerId, lokaal(e));
    if (g.knijp != null && vingers.current.size === 2) {
      const [a, b] = [...vingers.current.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (d > 10) { zoomOm(d / g.knijp, mid[0], mid[1]); g.knijp = d; }
      // Twee vingers draaien = de stelling draaien.
      const hk = Math.atan2(b[1] - a[1], b[0] - a[0]); let dh = hk - g.hoek; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
      if (Math.abs(dh) > 0.002) { setStand(([h0, k0]) => [h0 - (dh * 180) / Math.PI, k0]); g.hoek = hk; }
      setSchuif(([sx, sy]) => [sx + mid[0] - g.mid[0], sy + mid[1] - g.mid[1]]); g.mid = mid; return;
    }
    const dx = e.clientX - g.x; const dy = e.clientY - g.y; if (g.pan) setSchuif([g.sc[0] + dx, g.sc[1] + dy]); else setStand([g.st[0] - dx * 0.4, Math.max(5, Math.min(85, g.st[1] + dy * 0.25))]);
  };
  const los = (e) => { vingers.current.delete(e.pointerId); if (vingers.current.size === 0) sleep.current = null; else if (vingers.current.size === 1) { const [p] = [...vingers.current.values()]; const b = ref.current.getBoundingClientRect(); sleep.current = { x: p[0] + b.left, y: p[1] + b.top, st: stand, sc: schuif, pan: false }; } };
  const wiel = (e) => { if (!interactief) return; e.preventDefault?.(); const [px, py] = lokaal(e); zoomOm(e.ctrlKey ? Math.exp(-e.deltaY * 0.01) : e.deltaY < 0 ? 1.15 : 1 / 1.15, px, py); };
  // De pagina mag niet mee scrollen terwijl je in de 3D zoomt.
  useEffect(() => { const el = ref.current; if (!el || !interactief) return undefined; const stop = (e) => e.preventDefault(); el.addEventListener('wheel', stop, { passive: false }); return () => el.removeEventListener('wheel', stop); }, [interactief]);
  return (
    <div ref={ref} className={`fm-wz${mini ? ' mini' : ''}`} style={interactief ? { touchAction: 'none' } : undefined} onPointerDown={neer} onPointerMove={beweeg} onPointerUp={los} onPointerCancel={los} onWheel={wiel} onContextMenu={(e) => e.preventDefault()}>
      {interactief && (
        <div className="fm-wz-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Inzoomen" onClick={() => zoomOm(1.4, maat.w / 2, maat.h / 2)}>+</button>
          <button type="button" aria-label="Uitzoomen" onClick={() => zoomOm(1 / 1.4, maat.w / 2, maat.h / 2)}>−</button>
          <button type="button" className={schuifModus ? 'aan' : ''} aria-pressed={schuifModus} title={schuifModus ? 'Slepen verschuift nu (klik om terug te draaien)' : 'Slepen = verschuiven (links, rechts, boven, onder)'} onClick={() => setSchuifModus((x) => !x)}>✥</button>
          <button type="button" aria-label="Terug naar het geheel" title="Terug naar het geheel" onClick={() => { setZoom(1); setSchuif([0, 0]); setStand([hoek0, kantel0]); }}>⟲</button>
        </div>
      )}
      <svg width={maat.w} height={maat.h}>
        <defs><pattern id="fm-sb-net" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#F3F4F6" fillOpacity="0.5" /><path d="M0 0L5 5M5 0L0 5" stroke="#6B7280" strokeWidth="0.5" /></pattern></defs>
        <polygon points={P2(grond)} fill="#C9CDD2" />
        {lagen.map((l, k) => l.el(k))}
        {!afs.some((a) => a.lijst.length) && !mini && <text x={maat.w / 2} y={maat.h / 2} textAnchor="middle" fill="#6B7280" fontSize={14}>Nog geen vakken: start links vanuit een type of teken vakken</text>}
      </svg>
    </div>
  );
}

// ---------- De bouwer ----------
// Twee standen: Kiezen (klik een vak, rand of hoek in boven, zij of 3D; rechts de inspector) en Tekenen (een blok
// uit het palet op het raster klikken, slepen of verven). Drie weergaven op dezelfde plek: Boven, Zij, 3D.
const UITLEG = {
  vloer: 'Dek: neemt de hoogte van het buurvak over', helling: 'Helling: sleep over meerdere vakken, loopt verder vanaf het buurvak',
  trap: 'Rennerstrap: houten treden over het hele vak (bv. 1 m per vak)', vtrap: 'Metalen voetgangerstrap van Gigant: vaste module, de kolom krijgt vanzelf de juiste lengte',
  overspanning: 'Overspanning: sleep over de vakken van de doorgang en geef de vrije hoogte; de hellingen ervoor en erna volgen vanzelf',
  bordes: 'Doorloopbordes van 0,73 m tussen twee voetgangerstrappen', trapblok: 'Trapblok: losse houten treden voor een laag dek (bv. 0,5 m)', tribune: 'Tribunevak met 2 treden', toren: 'Toren zonder dek: staanders, liggers en schoren tot de gekozen hoogte (los of als steuntoren naast een brug)',
  gom: 'Vakken weghalen (of rechtsklik op een vak)',
};
const BLOK_ICOON = { overspanning: '⊓', vloer: '▭', helling: '⟋', trap: '☰', vtrap: '⩨', bordes: '▬', tribune: '▙', toren: '▥', trapblok: '▟', gom: '⌫' };
const GEREEDSCHAP = [
  ...SOORTEN.filter((s) => s.k !== 'bordes').flatMap((s) => (s.k === 'trap' ? [{ k: 'trap', naam: 'Rennerstrap', uitleg: UITLEG.trap }, { k: 'vtrap', naam: 'Voetg.trap', uitleg: UITLEG.vtrap }, { k: 'bordes', naam: 'Bordes', uitleg: UITLEG.bordes }] : [{ k: s.k, naam: s.kort, uitleg: UITLEG[s.k] }])),
  { k: 'overspanning', naam: 'Overspanning', uitleg: UITLEG.overspanning },
  { k: 'gom', naam: 'Gom', uitleg: UITLEG.gom },
];
const HELLING_NAAM = { 0.5: 'Licht', 1: 'Steil' };
const hellingStapVan = (v) => (Math.abs((Number(v?.h) || 0) - (Number(v?.laag) || 0)) >= 0.75 ? 1 : 0.5);
const pijl = ['→', '↑', '←', '↓'];
// Leuningkeuzes met een klein icoon (automatisch + de LEUNINGEN uit stellingbouw).
const LEUNING_KEUZES = [{ k: 'auto', naam: 'Automatisch', uitleg: 'Zoals de stelling het zelf kiest (open aan de aanloop, leuning waar je kan vallen)' }, ...LEUNINGEN];
function LeuningIcoon({ k }) {
  const s = { stroke: '#1d1d1b', strokeWidth: 1.5, fill: 'none' };
  const d = { auto: null, stelling: 'M3 4H31M3 10H31M3 16H31M3 3V20M31 3V20', buis: 'M3 6H31M3 13H31M3 3V20M31 3V20', frame: 'M3 4H31V18H3ZM8 4V18M13 4V18M18 4V18M23 4V18M28 4V18', net: 'M3 5H31M6 5V19M10 5V19M14 5V19M18 5V19M22 5V19M26 5V19M30 5V19', ladder: 'M3 7H31M3 15H31M7 7V15M13 7V15M19 7V15M25 7V15', laag: 'M3 15H31M3 11V20M31 11V20', geen: 'M3 19H31' }[k];
  return <svg viewBox="0 0 34 22" width={34} height={22} aria-hidden="true">{d ? <path d={d} {...s} strokeDasharray={k === 'geen' ? '2 3' : undefined} /> : <text x="17" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#686D76">A</text>}</svg>;
}
function HoekIcoon({ k }) {
  return <svg viewBox="0 0 34 22" width={34} height={22} aria-hidden="true">{k === 'auto' ? <text x="17" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#686D76">A</text> : k === 'hoog' ? <><path d="M17 2V20" stroke="#1d1d1b" strokeWidth="2" /><circle cx="17" cy="3" r="2.5" fill="#1d1d1b" /></> : k === 'midden' ? <><path d="M17 8V20" stroke="#1d1d1b" strokeWidth="2" /><circle cx="17" cy="8" r="2.5" fill="#1d1d1b" /></> : k === 'geen' ? <><path d="M10 20H24" stroke="#1d1d1b" strokeWidth="2" /><path d="M12 6L22 16M22 6L12 16" stroke="#9AA3AD" strokeWidth="1.6" /></> : <><path d="M17 13V20" stroke="#1d1d1b" strokeWidth="2" /><circle cx="17" cy="13" r="2.5" fill="#E11D48" /></>}</svg>;
}
const DOEL_NAAM = { vak: ['vak', 'vakken'], ligger: ['ligger', 'liggers'], tvloer: ['tussenvloer', 'tussenvloeren'], eind: ['uiteinde', 'uiteinden'], rand: ['rand', 'randen'], hoek: ['hoek', 'hoeken'], camera: ['camera', 'camera'], hdiag: ['horizontale diagonaal', 'horizontale diagonalen'], staander: ['staander', 'staanders'], schoor: ['schoor', 'schoren'], rozet: ['rozet', 'rozetten'] };
// Afstand van een punt tot een lijnstuk (px).
const afstandTot = (p, A, B) => { const dx = B[0] - A[0]; const dy = B[1] - A[1]; const l2 = dx * dx + dy * dy || 1; const f = Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2)); return Math.hypot(A[0] + f * dx - p[0], A[1] + f * dy - p[1]); };
const snap05 = (v) => Math.round(v * 2) / 2;

// ---------- Zijaanzicht (langsaanzicht van het actieve deel, zoals een Gigant-tekening) ----------
// Tekent dezelfde scène als de 3D (bouwScene), geprojecteerd op het vlak langs de lengte van de stelling.
// Staanders met rozetten, liggers, dek, leuning; maatlijnen in mm; blauwe grepen om de dekhoogte per rozet te slepen;
// de maat onder een kolom wisselt 2,07 ↔ 1,04; de vrije hoogte onder een doorgang.
// Maattekening (alleen-lezen): het zijaanzicht van één zijde met maatlat en maatlijnen in mm.
function ZijAanzicht({ st, af, doekMap, zijde = null, svgRef = null }) {
  const ref = useRef(null); const [maat, setMaat] = useState({ w: 800, h: 420 });
  useEffect(() => { const e = ref.current; if (!e) return undefined; const ro = new ResizeObserver(() => setMaat({ w: e.clientWidth || 800, h: e.clientHeight || 420 })); ro.observe(e); return () => ro.disconnect(); }, []);
  const K0 = stellingKader(st, true); const K = K0.leeg ? stellingKader(st) : K0; const M = stellingMaten(st);
  // zijde: voor (van −y), achter (van +y, gespiegeld), links (van −x), rechts (van +x, gespiegeld). Zonder zijde: de lange kant.
  const langsX = zijde ? zijde === 'voor' || zijde === 'achter' : K.leeg || K.i1 - K.i0 >= K.j1 - K.j0;
  const spiegel = zijde === 'achter' || zijde === 'rechts';
  const n0 = langsX ? K.i0 : K.j0; const n1 = langsX ? K.i1 : K.j1;
  const pos = (n) => (langsX ? M.x(n) : M.y(n)); const br = (n) => (langsX ? M.bx(n) : M.by(n));
  const L = Math.max(1, pos(n1) - pos(n0));
  // Scène verzamelen (identieke projectie als de 3D, enkel dit deel, zonder knik).
  const scene = useMemo(() => {
    const segs = []; const vlakken = []; const voeten = []; const rozetten = [];
    const dl = { id: '0', d: st, T: (p) => p };
    try {
      bouwScene({ st, delen: [dl], afs: [af], mini: false, doekMap }, {
        quad: (pts, vul, rand, extra = {}) => vlakken.push({ pts, vul, rand, dek: !!extra.dek, op: extra.fillOpacity ?? 1, dash: extra.strokeDasharray }),
        lijn: (a, b, kl, w = 1) => segs.push({ a, b, kl, w }),
        voet: (p, o = {}) => voeten.push({ p, ...o }), rozet: (p) => rozetten.push(p),
        beeld: (b) => vlakken.push({ pts: b.vorm, vul: b.kl, rand: null, op: 0.45 }), label: () => {},
        vloerligger: (a, b, o = {}) => segs.push({ a, b, kl: o.helling || o.metaal ? '#AEB6BE' : '#B5652F', w: 3.2, u: true }),
        pen: () => {}, ladder: (l) => { for (const s of [l.s0, l.s1]) segs.push({ a: s[0], b: s[1], kl: '#B45309', w: 1.8 }); },
        doel: () => {},
      });
    } catch { /* een halve tekening is beter dan geen */ }
    return { segs, vlakken, voeten, rozetten };
  }, [st, af, doekMap]);
  const top = Math.max(1.5, ...af.knopen.map((n) => Math.max(n.h, n.top)), ...[...af.portaal.knopen.values()].map((p) => p.T)) + 0.3;
  const grondMin = Math.min(0, ...scene.voeten.map((v) => v.p[2]));
  const padL = 56; const padR = 36; const padT = 28; const onder = 108; // ruimte voor de maatlat en twee maatlijnen
  // Tijdens het slepen van een greep blijven schaal en nulpunt staan (anders schuift de tekening onder de muis weg).
  const s = Math.max(16, Math.min(90, (maat.w - padL - padR) / L, (maat.h - padT - onder) / (top - grondMin)));
  const W = Math.max(maat.w, L * s + padL + padR); const H = Math.max(maat.h, (top - grondMin) * s + padT + onder);
  // De tekening in het midden van het venster.
  const oX = Math.max(0, (maat.w - (L * s + padL + padR)) / 2); const oY = Math.max(0, (maat.h - ((top - grondMin) * s + padT + onder)) / 2);
  const oy = oY + padT + top * s;
  const U = (p) => (langsX ? p[0] : p[1]);
  const px = (u) => oX + padL + (spiegel ? pos(n1) - u : u - pos(n0)) * s; const kx = (n) => Math.min(px(pos(n)), px(pos(n + 1))); const py = (z) => oy - z * s;
  const P = (p) => [px(U(p)), py(p[2])];
  // Per kolom: hoogte aan het begin (a) en het einde (b), het hoogste vak van alle rijen (silhouet).
  const kolVakken = (n) => af.lijst.filter((v) => (langsX ? v.i : v.j) === n && v.soort !== 'toren');
  const eindH = (n, kant) => { const vs = kolVakken(n).filter((v) => v.soort !== 'trapblok'); if (!vs.length) return null; return Math.max(...vs.map((v) => (langsX ? hoogteOp(v, kant === 'a' ? 0 : 1, 0.5) : hoogteOp(v, 0.5, kant === 'a' ? 0 : 1)))); };
  const kolTop = (n) => { const vs = kolVakken(n); return vs.length ? Math.max(...vs.map((v) => v.h)) : 0; };
  // Voorste rij (dichtst bij de kijker): langs x kijken we van −y, langs y van −x.
  const voorRij = (n) => { const vs = kolVakken(n); if (!vs.length) return null; return vs.reduce((a, v) => ((langsX ? v.j < a.j : v.i < a.i) !== spiegel ? v : a), vs[0]); };
  const voorRand = (n) => { const v = voorRij(n); return v ? `${v.i},${v.j},${langsX ? 3 : 2}` : null; };
  // Maatlijnen: aaneengesloten kolommen van dezelfde soort (helling op / af, overspanning, trap, vlak).
  const groepen = [];
  for (let n = n0; n < n1; n++) {
    const v = voorRij(n); if (!v) { groepen.push(null); continue; }
    const k = v.soort === 'helling' ? `helling${(Number(v.r) || 0) % 2 === (langsX ? 0 : 1) ? (langsX ? (Number(v.r) === 0 ? '↑' : '↓') : (Number(v.r) === 1 ? '↑' : '↓')) : ''}` : v.doorgang ? 'doorgang' : v.soort === 'trap' || v.soort === 'bordes' ? 'trap' : v.soort;
    const g = groepen[groepen.length - 1]; if (g && g.k === k) g.e = n; else groepen.push({ k, b: n, e: n });
  }
  const mm = (a, b) => Math.round((pos(b) - pos(a)) * 1000);
  const maatlijn = (x0, x1, y, tekst, key) => (
    <g key={key} className="fm-zij-maat">
      <line x1={x0} y1={y} x2={x1} y2={y} /><line x1={x0} y1={y - 5} x2={x0} y2={y + 5} /><line x1={x1} y1={y - 5} x2={x1} y2={y + 5} />
      <line x1={x0 - 3} y1={y + 3} x2={x0 + 3} y2={y - 3} /><line x1={x1 - 3} y1={y + 3} x2={x1 + 3} y2={y - 3} />
      <text x={(x0 + x1) / 2} y={y - 4} textAnchor="middle">{tekst}</text>
    </g>
  );
  const vrijTekst = (d) => `${getal(d.B, 2)} × ${getal(d.H, 2)} m`;
  const leeg = K.leeg;
  return (
    <div ref={ref} className="fm-zij">
      <svg ref={svgRef} width={W} height={H} className="fm-zij-svg" xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="fm-zij-grond" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#9CA3AF" strokeWidth="0.8" /></pattern></defs>
        {/* gekozen kolommen */}
        {/* maaiveld */}
        <line x1={px(pos(n0)) - 30} y1={py(0)} x2={px(pos(n1)) + 30} y2={py(0)} stroke="#6B7280" strokeWidth="1.2" />
        <rect x={Math.min(px(pos(n0)), px(pos(n1))) - 30} y={py(0)} width={Math.abs(px(pos(n1)) - px(pos(n0))) + 60} height={7} fill="url(#fm-zij-grond)" />
        {/* vlakken (dek, treden, kantplanken, ballast, doorgangen) */}
        {scene.vlakken.map((v, k) => { const q = v.pts.map(P); if (Math.max(...q.map((p) => p[0])) - Math.min(...q.map((p) => p[0])) < 0.5 && Math.max(...q.map((p) => p[1])) - Math.min(...q.map((p) => p[1])) < 0.5) return null; return <polygon key={`v${k}`} points={P2(q)} fill={v.vul} fillOpacity={v.op < 1 ? v.op : v.dek ? 0.9 : 0.75} stroke={v.rand || 'none'} strokeWidth={v.dek ? 3 : 0.8} strokeDasharray={v.dash} strokeLinejoin="round" />; })}
        {/* buizen: staanders, liggers, schoren, leuning (lijnen dwars op het aanzicht vallen weg) */}
        {scene.segs.map((l, k) => { const a = P(l.a); const b = P(l.b); if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.6) return null; const grijs = ['#5F6B78', '#7B8591', '#9AA3AD', '#8FA9C4', '#6B7280'].includes(l.kl); return <line key={`l${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={l.kl === '#16A34A' || l.kl === '#15803D' ? '#15803D' : grijs ? (l.w >= 2 ? '#1d1d1b' : '#C2410C') : l.kl} strokeWidth={l.u ? 3.2 : l.w >= 2 ? 2 : l.w >= 1.3 ? 1.5 : 1.1} strokeOpacity={grijs && l.w < 2 ? 0.85 : 1} strokeDasharray={l.kl === '#16A34A' ? '4 3' : undefined} strokeLinecap="round" />; })}
        {/* voetplaten of wielen */}
        {scene.voeten.map((v, k) => { const p = P(v.p); if (v.blok) return <rect key={`f${k}`} x={p[0] - 5} y={py(v.h ?? v.p[2]) + 1} width={10} height={Math.max(2, p[1] - py(v.h ?? v.p[2]) - 1)} fill="#A9824F" />; return v.wiel ? <circle key={`f${k}`} cx={p[0]} cy={p[1] - 0.1 * s} r={Math.max(2, 0.1 * s)} fill="#EDE8DA" stroke="#4B5563" strokeWidth="1" /> : <rect key={`f${k}`} x={p[0] - 6} y={p[1] - 3} width={12} height={3} fill="#8A6A45" />; })}
        {/* rozetten */}
        {scene.rozetten.map((p, k) => { const q = P(p); return <circle key={`r${k}`} cx={q[0]} cy={q[1]} r={Math.max(1.6, 0.045 * s)} fill="#fff" stroke="#1d1d1b" strokeWidth="1" />; })}
        {/* vrije hoogte onder elke doorgang */}
        {af.doorgangen.map((d, k) => { const dwarsLangsX = (d.richt || 'y') === 'y'; const a = langsX === dwarsLangsX ? d.i0 : d.rijen[0]; const b = langsX === dwarsLangsX ? d.i1 + 1 : d.rijen[d.rijen.length - 1] + 1; const x0 = px(pos(a)); const x1 = px(pos(b)); const xm = (x0 + x1) / 2; const yb = py(d.g); const yt = py(d.g + d.H); const kl = d.fout ? '#DC2626' : '#15803D';
          return <g key={`dg${k}`}><line x1={xm} y1={yb} x2={xm} y2={yt} stroke={kl} strokeWidth="1" strokeDasharray="3 3" /><line x1={xm - 6} y1={yt} x2={xm + 6} y2={yt} stroke={kl} strokeWidth="1" /><text x={xm + 7} y={(yb + yt) / 2 + 4} fill={kl} fontSize="11" fontFamily="var(--font-mono, ui-monospace, monospace)" style={{ paintOrder: 'stroke' }} stroke="#fff" strokeWidth="3">vrij {getal(d.H, 2)} m{d.fout ? ' ⚠' : ''}</text><text x={xm} y={yb - 6} textAnchor="middle" fill={kl} fontSize="10" style={{ paintOrder: 'stroke' }} stroke="#fff" strokeWidth="3">{functieNaam(d.functie) || 'doorgang'} {vrijTekst(d)}</text></g>; })}
        {/* maatlat: breedte per kolom */}
        {!leeg && Array.from({ length: n1 - n0 }, (_, q) => n0 + q).map((n) => { const w = br(n); const half = Math.abs(w - HALF) < 0.001; const x0 = kx(n); const wd = w * s;
          return <g key={`m${n}`} className="fm-zij-kol uit"><title>{`${langsX ? 'Kolom' : 'Rij'} ${getal(w, 2)} m · klik: ${half ? 'vol vak 2,07 m' : 'half vak 1,04 m'}`}</title><rect x={x0 + 1} y={py(grondMin) + 12} width={Math.max(2, wd - 2)} height={18} /><text x={x0 + wd / 2} y={py(grondMin) + 25} textAnchor="middle">{wd > 26 ? getal(w, 2) : ''}</text></g>; })}
        {/* maatlijnen per groep en totaal, in mm */}
        {!leeg && groepen.filter(Boolean).map((g, k) => maatlijn(px(pos(g.b)), px(pos(g.e + 1)), py(grondMin) + 58, String(mm(g.b, g.e + 1)), `mg${k}`))}
        {!leeg && maatlijn(px(pos(n0)), px(pos(n1)), py(grondMin) + 90, `${mm(n0, n1)} mm`, 'mt')}
        {leeg && <text x={W / 2} y={H / 2} textAnchor="middle" fill="#6B7280" fontSize="13">Nog geen vakken. Start links vanuit een type of teken vakken.</text>}
              {/* doek tekenen: vangt het slepen over de hele tekening */}
</svg>
    </div>
  );
}

export default function StellingStudio({ it, el, schrijven, onZet, onSluit, doeken: ontwerpen = [] }) {
  const st00 = it.velden?.stelling || { vakken: {} };
  // Oude stellingen: de opstelling stond enkel bij de TV-camera; ook bij de camera op het dek zetten (voor de 3D).
  const st0 = st00.camera && !st00.camera.op && it.velden?.tvcamera?.opstelling ? { ...st00, camera: { ...st00.camera, op: it.velden.tvcamera.opstelling } } : st00;
  // Bij het openen opschonen: dekken op de rozetten, geen onmogelijke doeken (zie stelling/opschonen.js). Bewaard
  // bij de eerste wijziging of meteen als er iets rechtgezet werd (alleen met schrijfrechten).
  const [stAll, setStAll] = useState(() => (schrijven ? stellingOpschonen(st0) : st0));
  useEffect(() => { if (schrijven && stAll !== st0 && st0?.vakken && Object.keys(st0.vakken).length) onZet?.(stAll); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Lens en opstelling van de TV-camera: dezelfde bron als de camera-tab (velden.tvcamera), via onZet(stelling, { tvcamera }).
  const [tv, setTv] = useState(it.velden?.tvcamera || {});
  const zetTv = (patch) => {
    const n = Object.fromEntries(Object.entries({ ...tv, ...patch }).filter(([, v]) => v)); setTv(n);
    // De opstelling ook bij de camera op het dek (enkel voor de 3D-tekening: statief, handheld of kraan).
    if ('opstelling' in patch && stAll.camera) { const s2 = { ...stAll, camera: { ...stAll.camera, op: n.opstelling || undefined } }; terugL.current.push(stAll); vooruitL.current = []; setStAll(s2); onZet?.(s2, { tvcamera: n }); return; }
    onZet?.(stAll, { tvcamera: n });
  };
  // Een brug met een knik bestaat uit delen: elk deel zijn eigen raster. De bouwer bewerkt telkens één deel.
  const [actief, setActief] = useState('0');
  const st = actief === '0' ? stAll : (stAll.delen || []).find((d) => d.id === actief) || stAll;
  const metDeel = (n) => (actief === '0' ? { ...n, delen: stAll.delen } : { ...stAll, delen: (stAll.delen || []).map((d) => (d.id === actief ? { ...n, id: d.id, aan: d.aan, naam: d.naam } : d)) });
  const terugL = useRef([]); const vooruitL = useRef([]);
  const [, hertel] = useState(0);
  const zetAll = (n) => { terugL.current.push(stAll); vooruitL.current = []; setStAll(n); onZet?.(n); };
  // Hellingen vanzelf: na elke wijziging lopen de hellingen van de vaste dekken (overspanning) naar de grond.
  const [autoMelding, setAutoMelding] = useState('');
  const metAuto = (n) => { if (!n?.auto) return n; const r0 = hellingenVanzelf(n); setAutoMelding(r0.erbij ? `Helling verlengd met ${r0.erbij} ${r0.erbij === 1 ? 'vak' : 'vakken'} om tot op de grond te komen.` : r0.weg ? `${r0.weg} ${r0.weg === 1 ? 'vak' : 'vakken'} voorbij de grond weggelaten.` : ''); return r0.st; };
  const zet = (n) => zetAll(metDeel(metAuto(grondToepassen(n))));
  const voorAuto = (n) => (n?.auto ? hellingenVanzelf(n).st : n);
  const terug = () => { const p = terugL.current.pop(); if (!p) return; vooruitL.current.push(stAll); setStAll(p); onZet?.(p); hertel((x) => x + 1); };
  const opnieuw = () => { const p = vooruitL.current.pop(); if (!p) return; terugL.current.push(stAll); setStAll(p); onZet?.(p); hertel((x) => x + 1); };
  const [knikHoek, setKnikHoek] = useState(-20);
  const nieuwDeel = () => {
    if (typeof window !== 'undefined' && !window.confirm(`Een nieuw deel beginnen dat onder ${Number(knikHoek) || 0}° aansluit op het einde van ${actief === '0' ? (stAll.naam || 'Deel 1') : ((stAll.delen || []).find((d) => d.id === actief)?.naam || 'dit deel')}? Je bouwt daarna verder in het nieuwe deel.`)) return;
    const id = nieuwId(); const n = (stAll.delen || []).length + 2;
    zetAll({ ...stAll, delen: [...(stAll.delen || []), { id, naam: `Deel ${n}`, vakken: {}, maten: { x: {}, y: { ...(st.maten?.y || {}) } }, aan: { deel: actief, hoek: Number(knikHoek) || 0 } }] });
    setActief(id); setSel(null);
  };

  // ---------- Stand, weergave, selectie ----------
  const [stand, setStand] = useState('kies'); // 'kies' | 'teken' | 'grond'
  const [selGrond, setSelGrond] = useState(null); // gekozen grondpunt 'i,j' (stand grond)
  // Drie stappen, elk met één manier van werken: bouwen (raster + 3D), branding (doeken in 3D), nakijken.
  const [scherm, setScherm] = useState('bouwen'); // 'bouwen' | 'branding' | 'nakijken'
  const [weergave, setWeergave] = useState('boven'); // 'boven' | 'zij' | '3d' (volgt de stap)
  const [kijk, setKijk] = useState('vrij');
  // Indeling in Bouwen: raster en 3D naast elkaar, of één groot met de andere klein rechtsonder (wisselbaar).
  const [indeling, setIndeling0] = useState(() => { try { return localStorage.getItem('fm-sb-indeling') || 'naast'; } catch { return 'naast'; } });
  const setIndeling = (x) => { setIndeling0(x); try { localStorage.setItem('fm-sb-indeling', x); } catch { /* geen opslag */ } };
  const [rasZweef, setRasZweef] = useState(null); // wat onder de muis ligt in het raster (licht ook op in 3D)
  const [zijdeN, setZijdeN] = useState('voor'); const zijSvg = useRef(null);
  const [selDoek, setSelDoek] = useState(null); // gekozen doek in branding (id)
  useEffect(() => { setWeergave(scherm === 'bouwen' ? 'boven' : scherm === 'branding' ? '3d' : 'zij'); setSel(null); setSelDoek(null); }, [scherm]); // eslint-disable-line react-hooks/exhaustive-deps
  const [doekUit, setDoekUit] = useState(false); // oogje: doeken verbergen om de constructie te zien
  const [tab, setTab] = useState('selectie'); // 'selectie' | 'doorgangen' | 'stuklijst'
  const [sel, setSel] = useState(null); // { soort: 'vak' | 'rand' | 'hoek', keys: [] } in het actieve deel
  // De twee groepen links: starten open als de stelling nog leeg is, de blokken altijd (inklappen kan).
  const [startWeg, setStartWeg] = useState(false);
  const [startOpen, setStartOpen] = useState(!Object.keys(st0.vakken || {}).length); const [tekenOpen, setTekenOpen] = useState(true);
  const kies = (doel0, { shift = false } = {}) => { let doel = doel0;
    if (!doel) { if (!shift) setSel(null); return; }
    // Shift + een tweede rozet: een schoor (of op gelijke hoogte een ligger) tussen de twee rozetten.
    if (doel.soort === 'rozet' && shift && sel?.soort === 'rozet' && sel.keys.length === 1 && (doel.deel ?? '0') === actief && verbind(sel.keys[0], doel.s)) return;
    const keys = doel.keys || [doel.s];
    if (doel.deel && doel.deel !== actief) { setActief(doel.deel); setSel({ soort: doel.soort, keys }); setTab('selectie'); return; }
    setSel((s) => {
      if (!shift || !s || s.soort !== doel.soort) return { soort: doel.soort, keys };
      const alle = keys.every((k) => s.keys.includes(k)) ? s.keys.filter((k) => !keys.includes(k)) : [...new Set([...s.keys, ...keys])];
      return alle.length ? { ...s, keys: alle } : null;
    });
    setTab('selectie');
  };
  const [tool, setTool] = useState('vloer'); const [mod, setMod] = useState('2.57x2.00'); const [trapStap, setTrapStap] = useState(1); const [breedte, setBreedte] = useState(true);
  const [h, setH] = useState(1); const [van, setVan] = useState(0); const [stap, setStap] = useState(0.5); const [r, setR] = useState(0); const [doorgang, setDoorgang] = useState(false); const [vrijO, setVrijO] = useState(false); const [grondP, setGrondP] = useState(0); const [heleKolom, setHeleKolom] = useState(false);
  const [heleZijde, setHeleZijde] = useState(true);
  const [ovH, setOvH] = useState(2.81); const [ovLigger, setOvLigger] = useState('rooster');
  const [startType, setStartType] = useState('rennersbrug');
  const [vg, setVg] = useState({ doorgang: 3, hoogte: 2.75, breed: 3, ligger: 'tralie', portaal: 0 });
  const [cam, setCam] = useState({ breed: 1, diep: 1, hoogte: 2, voor: 'laag', achter: 'buis', wielen: false });
  const [plat, setPlat] = useState({ nx: 2, ny: 2, hoogte: 0.5, leuning: false });
  const [trib, setTrib] = useState({ rijen: 4, breed: 3, start: 0.5 });
  const [tor, setTor] = useState({ nx: 1, ny: 1, hoogte: 6, ballast: true, half: false });
  const [brug, setBrug] = useState({ breed: 2, doorgang: 3, hoogte: 2.81, op: 0.5, af: 0.5, ligger: 'rooster' });
  const doekMap = useMemo(() => new Map(ontwerpen.map((d) => [d.id, d])), [ontwerpen]);
  const verb = useMemo(() => delenVan(stAll).find((d) => d.id === actief)?.verbonden, [stAll, actief]);
  const af = useMemo(() => stellingAfgeleid(st, { verbonden: verb }), [st, verb]);
  const telling = useMemo(() => stellingStuklijst(stAll), [stAll]);
  // De TV-camera op het dek (één per stelling, in het stelsel van haar deel).
  const camPlek = useMemo(() => cameraPlek(stAll), [stAll]);
  const zetCamera = (c) => zetAll({ ...stAll, camera: c || undefined });
  // Camera erop: eerst lens en opstelling kiezen (statief, handheld of kraan), dan staat ze in één stap op het dek.
  const [camKeuze, setCamKeuze] = useState(null); // { lens, opstelling } terwijl je kiest
  const camErop = (keuze = null) => {
    const c = cameraStandaard(stAll, actief); if (!c) return;
    const k = keuze || { lens: tv.lens || '', opstelling: tv.opstelling || 'statief' };
    const s2 = { ...stAll, camera: { ...c, op: k.opstelling || undefined } };
    const n = Object.fromEntries(Object.entries({ ...tv, lens: k.lens, opstelling: k.opstelling }).filter(([, v]) => v));
    terugL.current.push(stAll); vooruitL.current = []; setStAll(s2); setTv(n); onZet?.(s2, { tvcamera: n });
    setCamKeuze(null); setSel({ soort: 'camera', keys: ['camera'] }); setTab('selectie');
  };
  const camWeg = () => { zetCamera(null); setSel(null); };
  const draaiCam = (d) => { if (!stAll.camera) return; zetCamera({ ...stAll.camera, rot: (((Number(stAll.camera.rot) || 0) + d) % 360 + 360) % 360 }); };
  // Tekenen kan enkel op het raster: de tekenstand zet het bovenaanzicht aan.
  const naarTeken = () => { setStand('teken'); setTekenOpen(true); if (weergave !== 'boven') setWeergave('boven'); };
  const kiesTool = (k) => { setTool(k); naarTeken(); };
  // Een keuze die niet meer bestaat (vak weg, leuning weg) valt uit de selectie.
  useEffect(() => {
    if (!sel) return;
    const ok = ['ligger', 'tvloer', 'eind', 'staander', 'schoor', 'rozet', 'hdiag'].includes(sel.soort) ? sel.keys : sel.soort === 'vak' ? sel.keys.filter((k) => st.vakken?.[k]) : sel.soort === 'rand' ? sel.keys.filter((k) => af.randen.some((x) => x.s === k)) : sel.soort === 'camera' ? (camPlek && camPlek.deel === actief ? sel.keys : []) : sel.keys.filter((k) => af.knopen.some((n) => `${n.i},${n.j}` === k));
    if (ok.length !== sel.keys.length) setSel(ok.length ? { ...sel, keys: ok } : null);
  }, [st, af, camPlek]); // eslint-disable-line react-hooks/exhaustive-deps

  // Raster: vakken + marge.
  const K = stellingKader(st);
  const i0 = (K.leeg ? 0 : K.i0) - 3; const j0 = (K.leeg ? 0 : K.j0) - 3; const i1 = Math.max((K.leeg ? 0 : K.i1) + 3, i0 + 14); const j1 = Math.max((K.leeg ? 0 : K.j1) + 3, j0 + 8);
  const rasRef = useRef(null); const [rasMaat, setRasMaat] = useState({ w: 600, h: 300 });
  useEffect(() => { const e = rasRef.current; if (!e) return undefined; const ro = new ResizeObserver(() => setRasMaat({ w: e.clientWidth, h: e.clientHeight })); ro.observe(e); return () => ro.disconnect(); }, [weergave]);
  const Mst = stellingMaten(st);
  // Schaal: px per meter (halve kolommen en rijen zijn ook op het raster half zo breed).
  const C = Math.max(18, Math.min(60, Math.min((rasMaat.w - 20) / ((Mst.x(i1) - Mst.x(i0)) / VAK), (rasMaat.h - 20) / ((Mst.y(j1) - Mst.y(j0)) / VAK))));
  // Het raster in het midden van het venster (de rest blijft leeg).
  const rOx = Math.max(10, (rasMaat.w - ((Mst.x(i1) - Mst.x(i0)) / VAK) * C) / 2); const rOy = Math.max(10, (rasMaat.h - ((Mst.y(j1) - Mst.y(j0)) / VAK) * C) / 2);
  const X = (i) => rOx + ((Mst.x(i) - Mst.x(i0)) / VAK) * C; const Y = (j) => rOy + ((Mst.y(j1) - Mst.y(j)) / VAK) * C; // y omhoog = links van de lijn
  const vakOp = (px, py) => { let i = i0; while (i < i1 + 20 && X(i + 1) <= px) i += 1; while (i > i0 - 20 && X(i) > px) i -= 1; let j = j1 - 1; while (j > j0 - 20 && Y(j) <= py) j -= 1; while (j < j1 + 20 && Y(j + 1) > py) j += 1; return [i, j]; };
  const randPunten = (rr) => { const [a, b] = RAND[rr.k]; return [[X(rr.i + HOEKEN[a][0]), Y(rr.j + HOEKEN[a][1])], [X(rr.i + HOEKEN[b][0]), Y(rr.j + HOEKEN[b][1])]]; };
  // Wat ligt er onder de muis op het raster: eerst een hoek, dan een rand, anders het vak.
  const doelOp = (px, py) => {
    let best = null;
    for (const n of af.knopen) if (n.leuning) { const d = Math.hypot(X(n.i) - px, Y(n.j) - py); if (d < 8 && (!best || d < best.d)) best = { d, doel: { soort: 'hoek', s: `${n.i},${n.j}` } }; }
    if (best) return best.doel;
    for (const rr of af.randen) { if (!rr.kiesbaar) continue; const [A, B] = randPunten(rr); const d = afstandTot([px, py], A, B); if (d < 7 && (!best || d < best.d)) best = { d, doel: { soort: 'rand', s: rr.s } }; }
    if (best) return best.doel;
    const [i, j] = vakOp(px, py); const s = sleutel(i, j); return st.vakken?.[s] ? { soort: 'vak', s } : null;
  };
  const knoopOp = (px, py) => { let best = null; for (let i = i0 - 1; i <= i1 + 1; i++) for (let j = j0 - 1; j <= j1 + 1; j++) { const d = Math.hypot(X(i) - px, Y(j) - py); if (d < 12 && (!best || d < best.d)) best = { d, k: `${i},${j}` }; } return best?.k || null; };
  const grondPunt = (k) => (st.grondPunten || []).find((q) => `${q.i},${q.j}` === k);
  const zetGrondPunt = (k, h) => { const lijst = (st.grondPunten || []).filter((q) => `${q.i},${q.j}` !== k); if (h != null) { const [i, j] = k.split(',').map(Number); lijst.push({ i, j, h: Math.max(0, Math.round(Number(h) * 100) / 100) }); } zet({ ...st, grondPunten: lijst.length ? lijst : undefined }); if (h == null) setSelGrond(null); };
  const randOp = (px, py) => {
    const [i, j] = vakOp(px, py); const fx = (px - X(i)) / (X(i + 1) - X(i)); const fy = 1 - (py - Y(j + 1)) / (Y(j) - Y(j + 1));
    const d = [1 - fx, 1 - fy, fx, fy]; const k = d.indexOf(Math.min(...d)); if (d[k] > 0.3) return null;
    if (st.vakken[sleutel(i, j)]) return `${i},${j},${k}`;
    const bi = i + RICHTING[k][0]; const bj = j + RICHTING[k][1];
    if (st.vakken[sleutel(bi, bj)]) return `${bi},${bj},${(k + 2) % 4}`;
    return null;
  };

  // ---------- Camera op het raster: klik = kiezen, slepen = verplaatsen over de vakken, de greep aan de kijkhoek draait ----------
  const camSleep = useRef(null);
  const camNeer = (e, modus) => {
    e.stopPropagation(); if (e.button === 2) return;
    kies({ soort: 'camera', s: 'camera' });
    if (!schrijven || !stAll.camera) return;
    const g = { modus, basis: stAll, laatste: stAll, bewogen: false, x0: e.clientX, y0: e.clientY, cx: X(camPlek.i + camPlek.u), cy: Y(camPlek.j + camPlek.v) };
    camSleep.current = g;
    const beweeg = (ev) => {
      if (camSleep.current !== g) return; const [px, py] = lok(ev);
      if (!g.bewogen && Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) < 3) return; g.bewogen = true;
      let c = g.basis.camera;
      if (g.modus === 'draai') { const rot = Math.round((Math.atan2(px - g.cx, -(py - g.cy)) * 180) / Math.PI / 5) * 5; c = { ...c, rot: ((rot % 360) + 360) % 360 }; }
      else {
        const [i, j] = vakOp(px, py); const v = st.vakken?.[sleutel(i, j)]; if (!v || v.soort === 'toren') return;
        const u = (px - X(i)) / (X(i + 1) - X(i)); const w = 1 - (py - Y(j + 1)) / (Y(j) - Y(j + 1));
        c = { ...c, deel: actief, vak: sleutel(i, j), u: Math.round(Math.max(0.05, Math.min(0.95, u)) * 100) / 100, v: Math.round(Math.max(0.05, Math.min(0.95, w)) * 100) / 100 };
      }
      g.laatste = { ...g.basis, camera: c }; setStAll(g.laatste);
    };
    const los = () => {
      if (camSleep.current === g) camSleep.current = null; window.removeEventListener('pointermove', beweeg, true); window.removeEventListener('pointerup', los, true);
      if (g.bewogen && g.laatste !== g.basis) { terugL.current.push(g.basis); vooruitL.current = []; onZet?.(g.laatste); }
    };
    // In de vangfase: het schild van de bouwer (schildProps) stopt pointerup in de bubbelfase vóór het window.
    window.addEventListener('pointermove', beweeg, true); window.addEventListener('pointerup', los, true);
  };

  // ---------- Tekenen: verven met slepen; helling: oplopend in de sleeprichting ----------
  const verf = useRef(null);
  const vakVoor = (soort0, extra = {}) => { const soort = soort0 === 'vtrap' ? 'trap' : soort0; return { soort, h: soort === 'helling' ? opCm(van) + stap : opCm(h), ...(soort === 'helling' || soort === 'trap' ? { laag: opCm(van), r } : {}), ...(doorgang ? { doorgang: true, ...(vrijO ? { vrij: true } : {}) } : {}), ...(Number(grondP) > 0 ? { grond: opCm(grondP) } : {}), ...(soort0 === 'vtrap' ? { trap: 'voetganger', module: mod, h: opCm(Number(van) + (TRAPMODULES.find((q) => q.k === mod)?.s || 1)) } : {}), ...extra }; };
  const pasVerfToe = (cellen, eind = false) => {
    const v = { ...st.vakken };
    if (tool === 'gom') { for (const c of cellen) delete v[c]; return { ...st, vakken: v }; }
    if (tool === 'helling' && cellen.length >= 1) {
      const ks = cellen.map(uitSleutel); const a = ks[0]; const b = ks[ks.length - 1];
      const dx = b[0] - a[0]; const dy = b[1] - a[1]; const langsX = Math.abs(dx) >= Math.abs(dy);
      const rr = langsX ? (dx >= 0 ? 0 : 2) : (dy >= 0 ? 1 : 3);
      const pos = (k) => (langsX ? (k[0] - a[0]) * Math.sign(dx || 1) : (k[1] - a[1]) * Math.sign(dy || 1));
      const e1 = slimVak('helling', a[0], a[1]); const daalt = cellen.length > 1 && e1.r !== rr && e1.h > stap - 0.001;
      for (const k of ks) {
        const p = pos(k); const x = daalt ? { laag: Math.max(0, e1.h - (p + 1) * stap), h: e1.h - p * stap, r: (rr + 2) % 4 } : { laag: (cellen.length > 1 ? (e1.r === rr ? e1.laag : opCm(van)) : e1.laag) + p * stap, h: 0, r: cellen.length > 1 ? rr : e1.r };
        if (!daalt) x.h = x.laag + stap;
        const nv = vakVoor(tool, { laag: Math.round(x.laag * 1000) / 1000, h: Math.round(x.h * 1000) / 1000, r: x.r });
        for (const [ii, jj] of breedteVakken(k[0], k[1], langsX ? 'kol' : 'rij', v)) if (magOp(v, sleutel(ii, jj))) v[sleutel(ii, jj)] = { ...nv };
      }
      if (eind && cellen.length > 1) setR(rr);
      return { ...st, vakken: v };
    }
    for (const c of cellen) { const [ci, cj] = uitSleutel(c); for (const [ii, jj] of cellen.length > 1 ? [[ci, cj]] : breedteVakken(ci, cj, null, v)) if (magOp(v, sleutel(ii, jj))) v[sleutel(ii, jj)] = slimVak(tool, ii, jj, v); }
    return { ...st, vakken: v };
  };
  const [voorlopig, setVoorlopig] = useState(null);
  const toon = voorlopig || st;
  // ---------- Verslepen in 3D (fase 1): ligger, vak, helling-uiteinde, tussenvloer; vastklikken op de rozetten ----------
  const r2 = (x) => Math.round(x * 100) / 100;
  const naSleep = (doel, z) => {
    if (z == null || !schrijven) return null;
    if (doel.soort === 'ligger') {
      const r = af.randen.find((x) => x.s === doel.rs); if (!r) return null;
      const wm = wandMaten(r, af.grondOp); const roz = wandRozetten(wm); const lig = wandLiggers(st, r, wm);
      const vrij = roz.filter((x) => x === doel.z || !lig.includes(x)); if (!vrij.length) return null;
      const zn = vrij.reduce((b, x) => (Math.abs(x - z) < Math.abs(b - z) ? x : b), vrij[0]);
      const vast = [...wandVloeren(st, r), ...wandVloerLeuning(st, r)];
      const nieuw = [...new Set(lig.map((x) => (x === doel.z ? zn : x)).filter((x) => !vast.includes(x)))].sort((x, y) => x - y);
      return { st: { ...st, liggers: { ...(st.liggers || {}), [doel.rs]: nieuw } }, sel: { soort: 'ligger', keys: [`${doel.rs}|${zn}`] } };
    }
    if (doel.soort === 'vak') {
      const v0 = st.vakken?.[doel.s]; if (!v0) return null;
      const keys = sel?.soort === 'vak' && sel.keys.includes(doel.s) ? sel.keys : [doel.s];
      const dh = Math.round((z - (Number(v0.h) || 0)) / ROZET) * ROZET; if (!dh) return { st, sel: { soort: 'vak', keys } };
      const v = { ...st.vakken };
      for (const k of keys) { const x = v[k]; if (!x) continue; const h = r2(Math.max(grondVan(x) + 0.3, (Number(x.h) || 0) + dh)); v[k] = { ...x, h, ...(x.laag != null ? { laag: r2(Math.max(0, (Number(x.laag) || 0) + (h - (Number(x.h) || 0)))) } : {}) }; }
      return { st: { ...st, vakken: v }, sel: { soort: 'vak', keys } };
    }
    if (doel.soort === 'eind') {
      const x = st.vakken?.[doel.vak]; if (!x) return null;
      const hoog = doel.kant === 'hoog'; const oud = hoog ? Number(x.h) || 0 : Number(x.laag) || 0;
      let n = r2(oud + Math.round((z - oud) / ROZET) * ROZET);
      if (hoog) n = Math.max(n, r2((Number(x.laag) || 0) + ROZET)); else n = Math.max(0, Math.min(n, r2((Number(x.h) || 0) - ROZET)));
      return { st: { ...st, vakken: { ...st.vakken, [doel.vak]: { ...x, [hoog ? 'h' : 'laag']: n } } }, sel: { soort: 'eind', keys: [doel.s] } };
    }
    if (doel.soort === 'tvloer') {
      const x = st.vakken?.[doel.vak]; if (!x) return null; const mog = vloerHoogtes(x); const echt = tussenVloeren(x);
      const vrij = mog.filter((q) => q === doel.zr || !echt.includes(q)); if (!vrij.length) return null;
      const zn = vrij.reduce((b, q) => (Math.abs(q - z) < Math.abs(b - z) ? q : b), vrij[0]);
      return { st: { ...st, vakken: { ...st.vakken, [doel.vak]: { ...x, vloeren: echt.map((q) => (q === doel.zr ? zn : q)) } } }, sel: { soort: 'tvloer', keys: [`${doel.vak}|${zn}`] } };
    }
    return null;
  };
  const opSleep = ({ doel, z, klaar }) => {
    if (doel.deel && doel.deel !== actief) return;
    // Een vlak dek bij een helling: het hele vlakke deel schuift samen en de hellingen volgen (zoals in het zijaanzicht).
    if (doel.soort === 'vak') {
      const v0 = st.vakken?.[doel.s]; const hel = Object.values(st.vakken || {}).find((x) => x.soort === 'helling' || x.soort === 'trap');
      if (v0 && hel && !['helling', 'trap', 'toren', 'trapblok'].includes(v0.soort)) {
        const lx = (Number(hel.r) || 0) % 2 === 0; const [i, j] = uitSleutel(doel.s);
        sleepHoogte(lx ? i : j, Number(v0.h) || 0, z, lx);
        if (klaar) { eindeSleep(true); setSel({ soort: 'vak', keys: [doel.s] }); }
        return;
      }
    }
    const uit = naSleep(doel, z);
    if (!klaar) { setVoorlopig(uit?.st || null); return; }
    setVoorlopig(null); if (!uit) return;
    if (uit.st !== st) zet(uit.st); setSel(uit.sel);
  };
  // Dubbelklik op een wandvak (tussen twee buizen): een ligger erbij in de rozet het dichtst bij de klik.
  const opDubbel = (cel, z) => {
    if (!schrijven || !cel?.rs || (cel.deel && cel.deel !== actief)) return;
    const r = af.randen.find((x) => x.s === cel.rs); if (!r) return; const pr = randParen(af.randen).get(paarSleutel(r)); const rh = pr?.hoofd || r;
    const wm = wandMaten(rh, af.grondOp); const lig = wandLiggers(st, rh, wm); const vrij = wandRozetten(wm).filter((x) => !lig.includes(x) && x > cel.z0 + 0.01 && x < cel.z1 - 0.01);
    if (!vrij.length) return; const zz = z ?? (cel.z0 + cel.z1) / 2; const zn = vrij.reduce((b, x) => (Math.abs(x - zz) < Math.abs(b - zz) ? x : b), vrij[0]);
    const vast = [...wandVloeren(st, rh), ...wandVloerLeuning(st, rh)];
    zet({ ...st, liggers: { ...(st.liggers || {}), [rh.s]: [...new Set([...lig.filter((x) => !vast.includes(x)), zn])].sort((x, y) => x - y) } });
    setSel({ soort: 'ligger', keys: [`${rh.s}|${zn}`] });
  };
  // Twee rozetten op naburige staanders van één wand verbinden: schuin = schoor, gelijk = ligger.
  const verbind = (k1, k2) => {
    if (!schrijven) return false;
    const [n1, z1s] = k1.split('|'); const [n2, z2s] = k2.split('|'); const z1 = Number(z1s); const z2 = Number(z2s); if (n1 === n2) return false;
    const paren = randParen(af.randen);
    const r0 = af.randen.find((r) => { const [a, b] = RAND[r.k]; const ka = `${r.i + HOEKEN[a][0]},${r.j + HOEKEN[a][1]}`; const kb = `${r.i + HOEKEN[b][0]},${r.j + HOEKEN[b][1]}`; return (ka === n1 && kb === n2) || (ka === n2 && kb === n1); });
    if (!r0) {
      // Schuin over een vak op dezelfde hoogte: een horizontale diagonaal.
      const [a1, b1] = n1.split(',').map(Number); const [a2, b2] = n2.split(',').map(Number);
      if (Math.abs(a1 - a2) !== 1 || Math.abs(b1 - b2) !== 1 || Math.abs(z1 - z2) > 0.01) return false;
      if (!st.vakken?.[sleutel(Math.min(a1, a2), Math.min(b1, b2))]) return false;
      const lijst = (st.hdiag || []).filter(([p, q, z]) => !(((p === n1 && q === n2) || (p === n2 && q === n1)) && Math.abs(z - z1) < 0.01));
      zet({ ...st, hdiag: [...lijst, [n1, n2, z1]] }); setSel({ soort: 'hdiag', keys: [`${n1}|${n2}|${z1}`] }); return true;
    }
    const r = paren.get(paarSleutel(r0))?.hoofd || r0;
    const [a] = RAND[r.k]; const ka = `${r.i + HOEKEN[a][0]},${r.j + HOEKEN[a][1]}`; const za = ka === n1 ? z1 : z2; const zb = ka === n1 ? z2 : z1;
    if (Math.abs(za - zb) < 0.01) { // ligger
      const wm = wandMaten(r, af.grondOp); const lig = wandLiggers(st, r, wm); const vast = [...wandVloeren(st, r), ...wandVloerLeuning(st, r)];
      zet({ ...st, liggers: { ...(st.liggers || {}), [r.s]: [...new Set([...lig.filter((x) => !vast.includes(x)), za])].sort((x, y) => x - y) } }); setSel({ soort: 'ligger', keys: [`${r.s}|${za}`] }); return true;
    }
    if (Math.abs(za - zb) < 0.3) return false;
    const nu = wandSchoren(stAll, actief, r.s).filter(([x, y]) => !(Math.abs(x - za) < 0.01 && Math.abs(y - zb) < 0.01));
    zet({ ...st, schoren: { ...(st.schoren || {}), [r.s]: [...nu, [za, zb]] } }); setSel({ soort: 'schoor', keys: [`${r.s}|${za}|${zb}`] }); return true;
  };
  const schoorWeg = () => {
    if (!schrijven || sel?.soort !== 'schoor') return; const m = { ...(st.schoren || {}) };
    for (const rs of new Set(sel.keys.map((k) => k.split('|')[0]))) { const weg = sel.keys.filter((k) => k.startsWith(`${rs}|`)).map((k) => k.split('|').slice(1).map(Number)); m[rs] = wandSchoren(stAll, actief, rs).filter(([x, y]) => !weg.some(([p, q]) => Math.abs(p - x) < 0.01 && Math.abs(q - y) < 0.01)); }
    zet({ ...st, schoren: m }); setSel(null);
  };
  // Weghalen (Delete): een ligger of een tussenvloer.
  const onderdeelWeg = () => {
    if (!schrijven || !sel) return false;
    if (sel.soort === 'ligger') {
      let n = { ...st, liggers: { ...(st.liggers || {}) } };
      for (const key of sel.keys) { const [rs, zs] = key.split('|'); const z = Number(zs); const r = af.randen.find((x) => x.s === rs); if (!r) continue; const wm = wandMaten(r, af.grondOp); const vast = [...wandVloeren(n, r), ...wandVloerLeuning(n, r)]; if (vast.includes(z)) continue; n.liggers[rs] = wandLiggers(n, r, wm).filter((x) => x !== z && !vast.includes(x)); }
      zet(n); setSel(null); return true;
    }
    if (sel.soort === 'tvloer') {
      const v = { ...st.vakken }; for (const key of sel.keys) { const [vk, zs] = key.split('|'); const x = v[vk]; if (!x) continue; const rest = tussenVloeren(x).filter((q) => q !== Number(zs)); v[vk] = { ...x, vloeren: rest.length ? rest : undefined }; }
      zet({ ...st, vakken: v }); setSel(null); return true;
    }
    return false;
  };
  const lok = (e) => { const b = rasRef.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const neer = (e) => {
    if (e.button === 2) return; const [px, py] = lok(e);
    if (stand === 'grond') { const k = knoopOp(px, py); if (!k) { setSelGrond(null); return; } const al = (st.grondPunten || []).find((q) => `${q.i},${q.j}` === k);
      if (!al && schrijven) { const [i, j] = k.split(',').map(Number); const f = grondFunctie(st); const Mg = stellingMaten(st); zet({ ...st, grondPunten: [...(st.grondPunten || []), { i, j, h: f ? f(Mg.x(i), Mg.y(j)) : 0 }] }); }
      setSelGrond(k); return; }
    // Kiezen: klik op een hoek, rand of vak. Shift + klik = meer kiezen (ook in de tekenstand).
    if (stand === 'kies' || !schrijven || e.shiftKey) { const d = doelOp(px, py); if (e.shiftKey && d && d.soort !== 'vak' && stand === 'teken') return; kies(d, { shift: e.shiftKey }); return; }
    const [i, j] = vakOp(px, py); const s = sleutel(i, j);
    verf.current = { cellen: [s], i, j }; setVoorlopig(voorAuto(pasVerfToe([s]))); e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const beweeg = (e) => {
    if (!verf.current && stand === 'kies') { const d = doelOp(...lok(e)); const k = d ? `${d.soort}|${d.keys?.[0] ?? d.s}` : ''; if (k !== (rasZweef ? `${rasZweef.soort}|${rasZweef.s}` : '')) setRasZweef(d ? { soort: d.soort, s: d.keys?.[0] ?? d.s, deel: actief } : null); }
    const g = verf.current; if (!g) return; const [i, j] = vakOp(...lok(e)); const s = sleutel(i, j);
    if (g.cellen.includes(s)) return;
    if (tool === 'helling') {
      const [a0, b0] = uitSleutel(g.cellen[0]); const dx = i - a0; const dy = j - b0; const n = Math.max(Math.abs(dx), Math.abs(dy));
      g.cellen = Array.from({ length: n + 1 }, (_, k) => (Math.abs(dx) >= Math.abs(dy) ? sleutel(a0 + Math.sign(dx) * k, b0) : sleutel(a0, b0 + Math.sign(dy) * k)));
    } else g.cellen.push(s);
    setVoorlopig(voorAuto(pasVerfToe(g.cellen)));
  };
  // Eén klik = slim plaatsen (hoogte en richting van de buur, over de hele breedte); slepen = verven.
  const los = () => { const g = verf.current; verf.current = null; if (!g) return; setVoorlopig(null); if (g.cellen.length === 1 && tool !== 'gom') plaats(tool, g.i, g.j); else zet(pasVerfToe(g.cellen, true)); };
  // Weghalen: rechtsklik op een vak (met "over de hele breedte" de hele kolom), of Delete op de gekozen vakken.
  const weghalen = (i, j) => { const v = { ...st.vakken }; let n = 0; for (const [ii, jj] of breedteVakken(i, j)) { const s2 = sleutel(ii, jj); if (v[s2]) { delete v[s2]; n += 1; } } if (!n) return; zet({ ...st, vakken: v }); };
  const rechtsklik = (e) => { e.preventDefault(); if (!schrijven || verf.current || stand === 'grond') return; const [i, j] = vakOp(...lok(e)); weghalen(i, j); };
  const rijenVan = (j, i = null) => {
    if (!breedte) return [j];
    const ks = Object.entries(st.vakken).filter(([, x]) => x.soort !== 'toren').map(([s2]) => uitSleutel(s2));
    const rij = new Set(ks.filter(([a]) => i == null || Math.abs(a - i) <= 1).map(([, b]) => b));
    if (!rij.has(j)) return [j];
    const uit = [j]; for (let y = j - 1; rij.has(y); y--) uit.push(y); for (let y = j + 1; rij.has(y); y++) uit.push(y);
    return uit;
  };
  // "Over de hele breedte": dwars op de loop van de brug op die plek (de korte aaneengesloten reeks door het vak).
  const breedteVakken = (i, j, as = null, vk = st.vakken) => {
    if (!breedte) return [[i, j]];
    const heeft = (a, b) => { const x = vk[sleutel(a, b)]; return !!x && x.soort !== 'toren'; };
    if (!heeft(i, j)) {
      // Een leeg vak naast de stelling neemt de breedte van zijn buur over (aan het einde van een brug komt zo de
      // hele kolom erbij). Buur links of rechts: diens kolom; buur voor of achter: diens rij. De kortste wint.
      const naast = (di, dj, ui, uj) => { if (!heeft(i + di, j + dj)) return null; const uit = [[i, j]]; for (let k = 1; heeft(i + di + ui * k, j + dj + uj * k); k++) uit.push([i + ui * k, j + uj * k]); for (let k = 1; heeft(i + di - ui * k, j + dj - uj * k); k++) uit.push([i - ui * k, j - uj * k]); return uit; };
      const kol = naast(-1, 0, 0, 1) || naast(1, 0, 0, 1); const rij = naast(0, -1, 1, 0) || naast(0, 1, 1, 0);
      const keuze = as === 'kol' ? kol || rij : as === 'rij' ? rij || kol : kol && rij ? (kol.length <= rij.length ? kol : rij) : kol || rij;
      return (keuze || [[i, j]]).filter(([a, b]) => (a === i && b === j) || !vk[sleutel(a, b)]);
    }
    const reeks = (di, dj) => { const uit = [[i, j]]; for (let k = 1; heeft(i - di * k, j - dj * k); k++) uit.push([i - di * k, j - dj * k]); for (let k = 1; heeft(i + di * k, j + dj * k); k++) uit.push([i + di * k, j + dj * k]); return uit; };
    const kol = reeks(0, 1); const rij = reeks(1, 0);
    const keuze = as === 'kol' ? kol : as === 'rij' ? rij : kol.length <= rij.length ? kol : rij;
    return keuze.filter(([a, b]) => (a === i && b === j) || (!vk[sleutel(a, b)]?.vast && !vk[sleutel(a, b)]?.doorgang));
  };
  const magOp = (v, key) => !v[key]?.vast || tool === 'overspanning' || tool === 'gom';
  const buurHoogte = (nb, k) => { const c = RAND[(k + 2) % 4].map((q) => HOEKEN[q]); return Math.max(...c.map(([u, w]) => hoogteOp(nb, u, w))); };
  const slimVak = (blok, i, j, vk = st.vakken) => {
    const soort = blok === 'vtrap' ? 'trap' : blok;
    const tm = blok === 'vtrap' ? TRAPMODULES.find((m) => m.k === mod) : null;
    const s0 = blok === 'helling' ? stap : blok === 'vtrap' ? tm.s : blok === 'trap' ? Number(trapStap) || 1 : 0;
    let nb = null; let k = -1;
    for (const kk of [2, 0, 3, 1]) { const x = vk[sleutel(i + RICHTING[kk][0], j + RICHTING[kk][1])]; if (x && x.soort !== 'toren') { nb = x; k = kk; break; } }
    const basis = { soort, ...(doorgang ? { doorgang: true, ...(vrijO ? { vrij: true } : {}) } : {}), ...(Number(grondP) > 0 ? { grond: opCm(grondP) } : nb?.grond ? { grond: nb.grond } : {}), ...(tm ? { trap: 'voetganger', module: tm.k } : {}) };
    if (blok === 'overspanning') { const lg = ovLigger || null; return { soort: 'vloer', h: brugDek(ovH, lg), vast: true, doorgang: true, vrijH: Number(ovH) > 0 ? Math.round(Number(ovH) * 100) / 100 : undefined, ...(lg ? { vrij: true, ligger: liggerSoort(lg) } : {}), ...(nb?.grond ? { grond: nb.grond } : {}) }; }
    if (blok === 'trapblok') return { ...basis, laag: 0, h: nb ? opCm(buurHoogte(nb, k)) : opCm(h), r: nb ? k : r };
    if (!s0) return { ...basis, h: nb ? opCm(buurHoogte(nb, k)) : opCm(h) };
    if (!nb) return { ...basis, laag: opCm(van), h: opCm(Number(van) + s0), r };
    const H = buurHoogte(nb, k); const weg = (k + 2) % 4; const schuin = nb.soort === 'helling' || nb.soort === 'trap';
    const op = schuin ? Number(nb.r) === weg : H - s0 < -0.001;
    return op ? { ...basis, laag: opCm(H), h: opCm(H + s0), r: weg } : { ...basis, laag: opCm(Math.max(0, H - s0)), h: opCm(H), r: k };
  };
  const plaats = (blok, i, j) => {
    const v = { ...st.vakken }; const m = { x: { ...(st.maten?.x || {}) }, y: { ...(st.maten?.y || {}) } };
    for (const [ii, jj] of breedteVakken(i, j)) if (!v[sleutel(ii, jj)]?.vast || blok === 'overspanning') v[sleutel(ii, jj)] = slimVak(blok, ii, jj, v);
    const x = v[sleutel(i, j)]; const lang = (Number(x.r) || 0) % 2 === 0;
    const L = blok === 'vtrap' ? TRAPMODULES.find((q) => q.k === mod).l : blok === 'bordes' ? BORDES : null;
    if (L) { if (lang) m.x[i] = L; else m.y[j] = L; } else if (blok !== 'toren' && blok !== 'gom') { if (Math.abs((m.x[i] || VAK) - VAK) > 0.001 && [TRAPMODULES.map((q) => q.l), BORDES].flat().includes(m.x[i])) delete m.x[i]; }
    zet({ ...st, vakken: v, maten: m });
  };
  // Alle randen aan dezelfde zijde die aansluiten op deze rand (voor een doek over de hele zijde).
  const zijdeVan = (rs, soort) => {
    const rr = af.randen.find((x) => x.s === rs); if (!rr) return [rs];
    const lijn = af.randen.filter((x) => x.k === rr.k && (rr.k % 2 ? x.j === rr.j : x.i === rr.i) && (x.buiten || x.leuning) === (rr.buiten || rr.leuning) && (soort !== 'doorgang' || x.doorgang));
    const pos = (x) => (rr.k % 2 ? x.i : x.j); const set = new Set(lijn.map(pos)); let a = pos(rr); let b = pos(rr);
    while (set.has(a - 1)) a -= 1; while (set.has(b + 1)) b += 1;
    return lijn.filter((x) => pos(x) >= a && pos(x) <= b).map((x) => x.s);
  };
  const randBij = (px, py) => {
    const rs = randOp(px, py); if (rs) return rs;
    const [i, j] = vakOp(px, py); const open = af.randen.filter((x) => x.i === i && x.j === j && (x.buiten || x.leuning)); if (!open.length) return null;
    const fx = (px - X(i)) / (X(i + 1) - X(i)); const fy = 1 - (py - Y(j + 1)) / (Y(j) - Y(j + 1)); const dd = [1 - fx, 1 - fy, fx, fy];
    return open.sort((p, q) => dd[p.k] - dd[q.k])[0].s;
  };
  // Doeken: per rand één doek. Een ontwerp op randen zetten haalt die randen uit andere doeken.
  const doekLijst = st.doeken || [];
  // Een nieuw doek verdringt op dezelfde randen de doeken aan dezelfde kant die in de hoogte overlappen
  // (een doek op de leuning of tot de grond telt als de hele hoogte). Aan de andere kant mag er wel een hangen.
  const bereik = (d) => (d.soort === 'vlak' && d.van != null && d.tot != null ? [Number(d.van), Number(d.tot)] : [-99, 99]);
  const verdring = (lijst0, randen, kant, rng) => { const weg = new Set(randen); return lijst0.map((d) => { if (d.soort === 'dak' || (d.kant || 'buiten') !== kant) return d; const b = bereik(d); if (b[1] <= rng[0] + 0.001 || b[0] >= rng[1] - 0.001) return d; return { ...d, randen: (d.randen || []).filter((x) => !weg.has(x)) }; }).filter((d) => d.soort === 'dak' || d.randen.length); };
  const zetDoek = (randen, voor, soort, kant = 'buiten') => {
    const lijst = verdring(doekLijst, randen, kant, [-99, 99]);
    // Op een toren (geen dek, geen leuning) hangt een doek standaard tussen de liggers, over de hele hoogte.
    const rs = randen.map((x) => af.randen.find((r) => r.s === x)).filter(Boolean);
    const soort2 = soort === 'leuning' && rs.length && rs.every((r) => r.soort === 'toren' || !r.leuning) ? 'vlak' : soort;
    if (voor !== null) lijst.push({ id: nieuwId(), soort: soort2, voor: voor || null, randen: [...randen], ...(kant === 'binnen' ? { kant } : {}) });
    zet({ ...st, doeken: lijst });
  };
  const [doekT, setDoekT] = useState(null); // penseel in branding: { voor, kant, gom }
  // Doek tekenen in 3D: een klik op een cel zet er een doek op (of haalt het weg). Aansluitende cellen met hetzelfde
  // ontwerp worden één doek: naast elkaar (zelfde hoogte) of boven elkaar (zelfde wand).
  // Langs een helling: een doek dat de schuine lijn volgt (onder het dek = 'zijkant', of op de leuning). Over vlakke
  // en schuine vakken samen gesleept wordt het één doorlopend doek van die soort; het ontwerp blijft rechtop en
  // wordt bijgesneden. Klik op zo'n doek = kiezen; slepen vanaf het gekozen doek = herschalen.
  const schuinDoek = (cellen, kant0, start) => {
    const soort = cellen.find((c) => c.doekSoort)?.doekSoort; const kant = kant0 || doekT.kant || 'buiten';
    const randen = [...new Set(cellen.map((c) => c.rs))];
    const vanSoort = (x) => x.soort === soort && (x.kant || 'buiten') === kant;
    if (cellen.length === 1 && !doekT.gom) { const al = doekLijst.find((x) => vanSoort(x) && (x.randen || []).includes(randen[0])); if (al) { setSelDoek(al.id); return; } }
    const oud = !doekT.gom && selDoek && start ? doekLijst.find((x) => x.id === selDoek && vanSoort(x) && (x.randen || []).includes(start.rs)) : null;
    let lijst = doekLijst.filter((x) => x !== oud).map((x) => (vanSoort(x) ? { ...x, randen: x.randen.filter((y) => !randen.includes(y)) } : x)).filter((x) => x.soort === 'dak' || x.randen.length);
    if (!doekT.gom) { const id = oud?.id || nieuwId(); setSelDoek(id); lijst = [...lijst, { ...(oud || {}), id, soort, voor: oud ? oud.voor || null : doekT.voor || null, randen, ...(kant === 'binnen' ? { kant } : {}) }]; }
    zet({ ...st, doeken: lijst });
  };
  const celKlik = (d) => {
    if (!d || d.soort !== 'cel' || !doekT || !schrijven) return;
    if (d.doekSoort) { schuinDoek([d], d.kant); return; }
    const { rs, z0, z1 } = d; const kant = d.kant || doekT.kant || 'buiten'; const r2 = (x) => Math.round(x * 100) / 100;
    // Grenzen van een doek op deze rand (zonder van/tot: de standaard tussen de liggers; altijd binnen grond en top).
    const rr = af.randen.find((x) => x.s === rs); const wm = rr ? wandMaten(rr, af.grondOp) : null;
    const bereikR = (x) => { const [b0, b1] = bereik(x); const v0 = x.soort === 'vlak' && x.van == null && wm ? wm.g0 + ROZET : b0; const v1 = x.soort === 'vlak' && x.tot == null && rr ? Math.min(rr.ha, rr.hb) - DEK_ROZET : b1; const kn = rr ? [RAND[rr.k][0], RAND[rr.k][1]].map((c) => af.knopen.find((n) => n.i === rr.i + HOEKEN[c][0] && n.j === rr.j + HOEKEN[c][1])).filter(Boolean) : []; const tp = kn.length ? Math.max(...kn.map((n) => n.top)) : rr ? Math.max(rr.ha, rr.hb) : v1; return [wm ? Math.max(wm.g, v0) : v0, Math.min(tp, v1)]; };
    const opKant = (x) => x.soort !== 'dak' && (x.kant || 'buiten') === kant && (x.randen || []).includes(rs);
    const dekt = doekLijst.find((x) => opKant(x) && bereikR(x)[0] <= z0 + 0.001 && bereikR(x)[1] >= z1 - 0.001);
    let lijst;
    // Klik op een doek = dat doek kiezen (ontwerp wisselen, Delete, opnieuw slepen om te herschalen).
    if (dekt && !doekT.gom) { setSelDoek(dekt.id); return; }
    if (doekT.gom) {
      if (!dekt) return;
      // Weghalen: enkel deze cel; wat erboven en eronder hing blijft (als apart doek op deze rand).
      lijst = doekLijst.map((x) => (x.id === dekt.id ? { ...x, randen: x.randen.filter((y) => y !== rs) } : x)).filter((x) => x.soort === 'dak' || x.randen.length);
      if (dekt.soort === 'vlak') { const [b0, b1] = bereikR(dekt); for (const [p0, p1] of [[b0, z0], [z1, b1]]) if (p1 - p0 > 0.2) lijst.push({ ...dekt, id: nieuwId(), randen: [rs], van: r2(p0), tot: r2(p1) }); }
    } else {
      lijst = verdring(doekLijst, [rs], kant, [z0, z1]);
      const [ri, rj, rk] = rs.split(',').map(Number);
      const buur = (y) => { const [i2, j2, k2] = y.split(',').map(Number); return k2 === rk && (rk % 2 ? j2 === rj && Math.abs(i2 - ri) === 1 : i2 === ri && Math.abs(j2 - rj) === 1); };
      const zelfde = (x) => x.soort === 'vlak' && (x.kant || 'buiten') === kant && (x.voor || '') === (doekT.voor || '');
      const naast = lijst.find((x) => zelfde(x) && Math.abs(bereik(x)[0] - z0) < 0.01 && Math.abs(bereik(x)[1] - z1) < 0.01 && x.randen.some(buur));
      const boven = lijst.find((x) => zelfde(x) && x.randen.length === 1 && x.randen[0] === rs && (Math.abs(bereik(x)[1] - z0) < 0.01 || Math.abs(bereik(x)[0] - z1) < 0.01));
      if (naast) { lijst = lijst.map((x) => (x.id === naast.id ? { ...x, randen: [...x.randen, rs] } : x)); setSelDoek(naast.id); }
      else if (boven) { lijst = lijst.map((x) => (x.id === boven.id ? { ...x, van: r2(Math.min(bereik(x)[0], z0)), tot: r2(Math.max(bereik(x)[1], z1)) } : x)); setSelDoek(boven.id); }
      else { const id = nieuwId(); setSelDoek(id); lijst.push({ id, soort: 'vlak', voor: doekT.voor || null, randen: [rs], van: z0, tot: z1, ...(kant === 'binnen' ? { kant } : {}) }); }
    }
    zet({ ...st, doeken: lijst });
  };
  // Slepen over meerdere cellen: één doek over al die vakken (of met de gom: daar weg).
  const celReeks = (cellen, kant0, start) => {
    if (!doekT || !schrijven || !cellen?.length) return;
    if (cellen.some((c) => c.doekSoort)) { schuinDoek(cellen, kant0, start); return; }
    const kant = kant0 || doekT.kant || 'buiten'; const r2 = (x) => Math.round(x * 100) / 100;
    // De rand waar je begon eerst: de kant van het doek geldt voor de eerste rand (bij herschalen die van het doek zelf).
    const alle = cellen.map((c) => c.rs);
    let randen = [...new Set([...(start?.rs ? [start.rs] : []), ...alle])]; const z0 = Math.min(...cellen.map((c) => c.z0)); const z1 = Math.max(...cellen.map((c) => c.z1));
    let lijst;
    if (doekT.gom) {
      // Uitknippen: per rand het stuk z0..z1 weg uit de doeken aan deze kant; wat erboven en eronder hangt blijft.
      lijst = [];
      for (const d of doekLijst) {
        if (d.soort === 'dak' || (d.kant || 'buiten') !== kant || !(d.randen || []).some((x) => randen.includes(x))) { lijst.push(d); continue; }
        const raak = d.randen.filter((x) => randen.includes(x)); const rest = d.randen.filter((x) => !randen.includes(x));
        if (rest.length) lijst.push({ ...d, randen: rest });
        if (d.soort !== 'vlak') continue;
        for (const rs of raak) { const rr = af.randen.find((x) => x.s === rs); const wm = rr ? wandMaten(rr, af.grondOp) : null; const b0 = Math.max(wm ? wm.g : -1, Number(d.van ?? (wm ? wm.g0 + ROZET : 0))); const b1 = Math.min(rr ? Math.max(rr.ha, rr.hb) + 1.5 : 99, Number(d.tot ?? (rr ? Math.min(rr.ha, rr.hb) - DEK_ROZET : 0)));
          for (const [p0, p1] of [[b0, Math.min(b1, z0)], [Math.max(b0, z1), b1]]) if (p1 - p0 > 0.2) lijst.push({ ...d, id: nieuwId(), randen: [rs], van: r2(p0), tot: r2(p1) }); }
      }
    } else {
      // Slepen vanaf het gekozen doek = dat doek herschalen naar de gesleepte cellen (zijn ontwerp blijft).
      const oud = selDoek && start ? doekLijst.find((x) => x.id === selDoek && x.soort === 'vlak' && (x.randen || []).includes(start.rs) && bereik(x)[0] <= start.z0 + 0.001 && bereik(x)[1] >= start.z1 - 0.001) : null;
      lijst = verdring(oud ? doekLijst.filter((x) => x !== oud) : doekLijst, randen, oud ? oud.kant || 'buiten' : kant, [z0, z1]);
      // Herschalen: de kant van het oude doek hoort bij zijn eerste rand; valt die weg en ligt de nieuwe eerste rand
      // aan het andere vak van dezelfde lijn (tegenovergestelde k), dan draait de kant mee.
      let kantN = oud ? oud.kant || 'buiten' : kant;
      if (oud && randen.includes(oud.randen[0])) randen = [oud.randen[0], ...randen.filter((x) => x !== oud.randen[0])];
      else if (oud) { const kR = Number(oud.randen[0].split(',')[2]); const kN = Number(randen[0].split(',')[2]); if ((kN + 2) % 4 === kR) kantN = kantN === 'binnen' ? 'buiten' : 'binnen'; }
      const id = oud?.id || nieuwId(); setSelDoek(id);
      const { kant: _k, ...oudZonder } = oud || {};
      lijst.push({ ...oudZonder, id, soort: 'vlak', voor: oud ? oud.voor || null : doekT.voor || null, randen, van: r2(z0), tot: r2(z1), ...(kantN === 'binnen' ? { kant: 'binnen' } : {}) });
    }
    zet({ ...st, doeken: lijst });
  };
  // In branding is tekenen altijd aan; het gekozen ontwerp is het penseel (en gaat naar het gekozen doek).
  useEffect(() => { if (scherm === 'branding') setDoekT((d) => d || { voor: '', kant: 'buiten' }); else setDoekT(null); }, [scherm]);
  // Doek bovenop: in branding met de zijde Boven een vak aanklikken (zelfde ontwerp = één doek).
  const dakKlik = (d) => {
    if (!doekT || !schrijven || kijk !== 'boven' || (d.deel && d.deel !== actief)) return;
    const al = doekLijst.find((x) => x.soort === 'dak' && (x.vakken || []).includes(d.s));
    if (al) { setSelDoek(al.id); return; }
    const zelfde = doekLijst.find((x) => x.soort === 'dak' && (x.voor || '') === (doekT.voor || ''));
    if (zelfde) { setSelDoek(zelfde.id); zet({ ...st, doeken: doekLijst.map((x) => (x === zelfde ? { ...x, vakken: [...x.vakken, d.s] } : x)) }); return; }
    const id = nieuwId(); setSelDoek(id); zet({ ...st, doeken: [...doekLijst, { id, soort: 'dak', voor: doekT.voor || null, randen: [], vakken: [d.s] }] });
  };
  // Maattekening van de gekozen zijde afdrukken (in een eigen venster, met de stijl van de tekening).
  const [pdfBezig, setPdfBezig] = useState(false);
  const maakPdf = async () => {
    if (pdfBezig) return; setPdfBezig(true);
    try {
      const [{ bouwerPdf }, { stellingGroep }] = await Promise.all([import('./bouwerPdf'), import('./StellingDrieGL')]);
      const naam = String(it.velden?.naam || it.naam || el?.naam || 'Stelling');
      const opp = af.lijst.reduce((a, v) => a + Mst.bx(v.i) * Mst.by(v.j), 0); const hMax = Math.max(0, ...af.lijst.map((v) => v.h));
      await bouwerPdf({ soort: 'stelling', titel: naam, sub: [el?.naam, el?.leverancier].filter(Boolean).join(' · '), maakGroep: (T) => stellingGroep(T, stAll, doekMap),
        hoogtes: [...new Set(af.lijst.map((v) => Math.round(v.h * 100) / 100))],
        kenmerken: [['Afmeting', `${getal(mmTotaal, 2)} × ${getal(Mst.y(K.j1) - Mst.y(K.j0), 2)} m`], ['Vakken', af.lijst.length], ['Oppervlakte', `${getal(opp, 1)} m²`], ['Dek tot', `${getal(hMax)} m`], ...(el?.leverancier ? [['Leverancier', el.leverancier]] : [])] });
    } catch (e) { window.alert(`De PDF lukte niet: ${e?.message || e}`); } finally { setPdfBezig(false); }
  };
  const drukZij = () => {
    const svg = zijSvg.current; if (!svg) return; const w = window.open('', '_blank'); if (!w) return;
    const naam = { voor: 'voorkant', achter: 'achterkant', links: 'linkerzijde', rechts: 'rechterzijde' }[zijdeN];
    const css = '.fm-zij-maat line{stroke:#1d1d1b;stroke-width:.8}.fm-zij-maat text{font-size:11px;fill:#1d1d1b;font-family:ui-monospace,Menlo,monospace}.fm-zij-kol rect{fill:#F8FAFC;stroke:#D6D9DE}.fm-zij-kol text{font-size:10.5px;fill:#4B5563}body{font-family:system-ui,sans-serif;margin:16px}svg{max-width:100%;height:auto}@page{size:A4 landscape;margin:10mm}';
    const t = `${String(it.velden?.naam || it.naam || 'Stelling').replace(/</g, '')} · ${naam}`;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${t}</title><style>${css}</style><h3>${t}</h3><p style="font-size:11px;color:#6B7280">Maattekening (indicatief) · maten in mm · enkel de plannen van de stellingbouwer zijn bindend</p>${svg.outerHTML.replace('<svg ', `<svg viewBox="0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}" `)}`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  // Het gekozen doek krijgt in 3D een blauwe rand.
  const metGekozen = (x) => {
    if (!selDoek) return x; const m = (l) => (l || []).map((d) => (d.id === selDoek ? { ...d, gekozen: true } : d));
    return { ...x, doeken: m(x.doeken), ...(x.delen ? { delen: x.delen.map((c) => ({ ...c, doeken: m(c.doeken) })) } : {}) };
  };
  const ontwerpKies = (id) => {
    setDoekT((d) => ({ ...(d || { kant: 'buiten' }), voor: id }));
    if (selDoek && schrijven) zet({ ...st, doeken: doekLijst.map((d) => (d.id === selDoek ? { ...d, voor: id || null } : d)) });
  };
  // Doek bovenop (dak) per vak.
  const zetDak = (vakKeys, voor) => {
    const weg = new Set(vakKeys); const lijst = doekLijst.map((d) => (d.soort === 'dak' ? { ...d, vakken: (d.vakken || []).filter((x) => !weg.has(x)) } : d)).filter((d) => d.soort !== 'dak' || d.vakken.length);
    if (voor !== null) lijst.push({ id: nieuwId(), soort: 'dak', voor: voor || null, randen: [], vakken: [...vakKeys] });
    zet({ ...st, doeken: lijst });
  };
  // Slepen vanuit het palet (drag-and-drop) op een vak.
  const drop = (e) => {
    e.preventDefault(); const k = e.dataTransfer.getData('text/fm-stelling'); if (!k || !schrijven) return;
    if (k.startsWith('doek:')) { const voor = k.slice(5); const rs = randBij(...lok(e)); if (!rs) return; zetDoek(heleZijde ? zijdeVan(rs, 'leuning') : [rs], voor, 'leuning'); kies({ soort: 'rand', s: rs }); return; }
    const [blok, m2] = k.split(':'); if (m2) setMod(m2); setTool(blok);
    const [i, j] = vakOp(...lok(e));
    if (m2) { const tm = TRAPMODULES.find((q) => q.k === m2); const v = { ...st.vakken }; const mt = { x: { ...(st.maten?.x || {}) }, y: { ...(st.maten?.y || {}) } }; const rows = rijenVan(j, i).filter((jj) => !v[sleutel(i, jj)]?.vast);
      for (const jj of rows) { let nb = null; let kk = -1; for (const q of [2, 0, 3, 1]) { const x = v[sleutel(i + RICHTING[q][0], jj + RICHTING[q][1])]; if (x && x.soort !== 'toren') { nb = x; kk = q; break; } }
        const H = nb ? buurHoogte(nb, kk) : 0; const weg = (kk + 2) % 4; const op = nb ? ((nb.soort === 'trap' || nb.soort === 'helling') ? Number(nb.r) === weg : H - tm.s < -0.001) : true;
        v[sleutel(i, jj)] = { soort: 'trap', trap: 'voetganger', module: tm.k, ...(op ? { laag: opCm(H), h: opCm(H + tm.s), r: nb ? weg : r } : { laag: opCm(Math.max(0, H - tm.s)), h: opCm(H), r: kk }), ...(nb?.grond ? { grond: nb.grond } : {}) };
        const rr = v[sleutel(i, jj)].r; if (rr % 2 === 0) mt.x[i] = tm.l; else mt.y[jj] = tm.l; }
      zet({ ...st, vakken: v, maten: mt }); return; }
    plaats(blok, i, j);
  };

  // ---------- Zijaanzicht: dekhoogte slepen ----------
  // Zet de hoogte h op kolomgrens n (alle rijen): de uiteinden die op h0 lagen schuiven mee. Een helling blijft
  // van rozet naar rozet (0,5 of 1 m per vak, nooit steiler); een vlak dek schuift in zijn geheel, met zijn hele
  // aaneengesloten vlakke deel. Een voetgangerstrap (vaste module) schuift mee als geheel.
  const sleepRef = useRef(null);
  const sleepHoogte = (n, h0, hGevraagd, langsX) => {
    const basis = sleepRef.current?.basis || st; sleepRef.current = { basis };
    const v = {}; for (const [s2, x] of Object.entries(basis.vakken)) v[s2] = { ...x };
    const as = (s2) => (langsX ? uitSleutel(s2)[0] : uitSleutel(s2)[1]);
    const eind = (x, kant) => (langsX ? hoogteOp(x, kant === 'a' ? 0 : 1, 0.5) : hoogteOp(x, 0.5, kant === 'a' ? 0 : 1));
    const langsAs = (x) => ((Number(x.r) || 0) % 2 === (langsX ? 0 : 1));
    const schuin = (x) => x.soort === 'helling' || x.soort === 'trap';
    const vast = (x) => x.soort === 'toren' || x.soort === 'trapblok';
    // Een helling (of rennerstrap) in de lengte: welk uiteinde ligt op deze kolomgrens en wat is het andere?
    const uiteinde = (x, kant) => { const naarB = langsX ? Number(x.r) === 0 : Number(x.r) === 1; const isLaag = (kant === 'a') === naarB; return { isLaag, andere: isLaag ? Number(x.h) || 0 : Number(x.laag) || 0, maxS: x.soort === 'helling' ? 1 : 2, minS: 0.5 }; };
    const schuif = (x, d) => { x.h = opCm(Math.max(grondVan(x), (Number(x.h) || 0) + d)); if (x.laag != null) x.laag = opCm(Math.max(0, (Number(x.laag) || 0) + d)); };
    const kolommen = (nn) => Object.keys(v).filter((s2) => as(s2) === nn);
    const vlak = (s2) => { const x = basis.vakken[s2]; return x && !schuin(x) && !vast(x) && Math.abs((Number(x.h) || 0) - h0) < 0.011; };
    // 1. Verzamelen: welke vlakke vakken schuiven mee en welke uiteinden (van een helling, trap of dwars vak) volgen.
    const vlakken = new Set(); const einden = new Map();
    const voeg = (s2, kant) => { if (!einden.has(s2)) einden.set(s2, kant); };
    const doe = (nn, kant) => { for (const s2 of kolommen(nn)) { const x = basis.vakken[s2]; if (vast(x) || Math.abs(eind(x, kant) - h0) > 0.011) continue; voeg(s2, kant); } };
    // Een vlak dek schuift in zijn geheel: ook de kolommen verderop op dezelfde hoogte, plus de helling die eraan hangt.
    const uitbreiden = (nn, richting) => { let m = nn; while (kolommen(m).length && kolommen(m).some(vlak)) { for (const s2 of kolommen(m)) if (vlak(s2)) vlakken.add(s2); m += richting; } const kant = richting > 0 ? 'a' : 'b'; for (const s2 of kolommen(m)) { const x = basis.vakken[s2]; if (schuin(x) && Math.abs(eind(x, kant) - h0) < 0.011) voeg(s2, kant); } };
    if (kolommen(n).some(vlak)) uitbreiden(n, 1); else doe(n, 'a');
    if (kolommen(n - 1).some(vlak)) uitbreiden(n - 1, -1); else doe(n - 1, 'b');
    // 2. Begrenzen: een helling blijft licht (0,5 m) of steil (1 m per vak), een rennerstrap hoogstens 2 m. Nooit steiler:
    //    het dek gaat niet verder dan de hellingen eraan toelaten (met "Hellingen vanzelf" lopen die wel mee).
    let lo = 0; let hi = Infinity;
    if (!basis.auto) for (const [s2, kant] of einden) { const x = basis.vakken[s2]; if (!schuin(x) || trapModule(x) || !langsAs(x)) continue; const u = uiteinde(x, kant); if (u.isLaag) { lo = Math.max(lo, u.andere - u.maxS); hi = Math.min(hi, u.andere - u.minS); } else { lo = Math.max(lo, u.andere + u.minS); hi = Math.min(hi, u.andere + u.maxS); } }
    let hNieuw = Math.max(0, snap05(hGevraagd)); hNieuw = hi < lo ? h0 : snap05(Math.min(hi, Math.max(lo, hNieuw)));
    // 3. Toepassen.
    for (const s2 of vlakken) schuif(v[s2], hNieuw - h0);
    for (const [s2, kant] of einden) { const x = v[s2]; if (!schuin(x) || trapModule(x) || !langsAs(x)) { schuif(x, hNieuw - eind(x, kant)); continue; } if (uiteinde(x, kant).isLaag) x.laag = opCm(hNieuw); else x.h = opCm(hNieuw); }
    const nst = voorAuto({ ...basis, vakken: v }); sleepRef.current.uit = nst; setVoorlopig(nst);
    return hNieuw;
  };
  const eindeSleep = (bewaar = true) => { const n = sleepRef.current?.uit || voorlopig; sleepRef.current = null; setVoorlopig(null); if (n && bewaar) zet(n); };
  const zetMaat = (as, idx, w) => { const m = { x: { ...(st.maten?.x || {}) }, y: { ...(st.maten?.y || {}) } }; if (w > 0.29 && Math.abs(w - VAK) > 0.001) m[as][idx] = Math.round(w * 1000) / 1000; else delete m[as][idx]; zet({ ...st, maten: m }); };

  // ---------- Toetsen ----------
  useEffect(() => {
    const kb = (e) => {
      const tag = e.target?.tagName; const k = e.key;
      if ((tag === 'INPUT' && !['checkbox', 'radio'].includes(e.target.type)) || tag === 'SELECT' || tag === 'TEXTAREA') { if (k === 'Escape') { e.stopPropagation(); e.target.blur?.(); } return; }
      if (k === 'Escape') { e.stopPropagation(); if (stand === 'grond' && selGrond) setSelGrond(null); else if (stand === 'teken' || stand === 'grond') setStand('kies'); else if (selDoek) setSelDoek(null); else if (sel) setSel(null); else onSluit(); return; }
      if ((k === 'Delete' || k === 'Backspace') && scherm === 'branding' && selDoek && schrijven) { e.preventDefault(); zet({ ...st, doeken: doekLijst.filter((x) => x.id !== selDoek) }); setSelDoek(null); return; }
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) opnieuw(); else terug(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'v' || k === 'V') setStand('kies');
      if ((k === 'b' || k === 'B') && schrijven) naarTeken();
      if ((k === 'g' || k === 'G') && scherm === 'bouwen') { setStand('grond'); setSel(null); }
      if (k === '1') setScherm('bouwen'); if (k === '2') setScherm('branding'); if (k === '3') setScherm('nakijken');
      if (k === 'r' || k === 'R') { if (sel?.soort === 'camera' && schrijven) draaiCam(e.shiftKey ? -15 : 15); else if (sel?.soort === 'vak' && kv?.r != null && schrijven) zetKies({ r: (Number(kv.r) + (e.shiftKey ? 3 : 1)) % 4 }); else setR((x) => (x + (e.shiftKey ? 3 : 1)) % 4); }
      if ((k === 'Delete' || k === 'Backspace') && sel?.soort === 'camera' && schrijven) { e.preventDefault(); camWeg(); }
      if ((k === 'Delete' || k === 'Backspace') && ['ligger', 'tvloer'].includes(sel?.soort)) { e.preventDefault(); onderdeelWeg(); }
      if ((k === 'Delete' || k === 'Backspace') && sel?.soort === 'rand' && schrijven && scherm === 'bouwen') { e.preventDefault(); zetRand('geen'); }
      if ((k === 'Delete' || k === 'Backspace') && stand === 'grond' && selGrond && schrijven) { e.preventDefault(); zetGrondPunt(selGrond, null); return; }
      if ((k === 'Delete' || k === 'Backspace') && sel?.soort === 'schoor' && scherm === 'bouwen') { e.preventDefault(); schoorWeg(); }
      if ((k === 'Delete' || k === 'Backspace') && sel?.soort === 'hdiag' && scherm === 'bouwen' && schrijven) { e.preventDefault(); zet({ ...st, hdiag: (st.hdiag || []).filter(([p, q, z]) => !selKeys.includes(`${p}|${q}|${z}`)) }); setSel(null); }
      if ((k === 'Delete' || k === 'Backspace') && sel?.soort === 'staander' && schrijven && scherm === 'bouwen') { e.preventDefault(); const z = st.staanders?.[selKeys[0]]; zetStaanders(z !== undefined ? undefined : false); }
      if ((k === 'Delete' || k === 'Backspace') && sel?.soort === 'vak' && schrijven) { e.preventDefault(); const v = { ...st.vakken }; for (const key of sel.keys) delete v[key]; setSel(null); zet({ ...st, vakken: v }); }
    };
    window.addEventListener('keydown', kb, true); return () => window.removeEventListener('keydown', kb, true);
  });

  // ---------- Inspector-hulpjes ----------
  const selKeys = sel?.keys || [];
  const kv = sel?.soort === 'vak' ? st.vakken[selKeys[0]] : null;
  const zetDoorgang = (d, patch) => { const v = { ...st.vakken }; for (const x of d.vakken) { const s2 = sleutel(x.i, x.j); v[s2] = Object.fromEntries(Object.entries({ ...v[s2], ...patch }).filter(([, w]) => w !== undefined)); } zet({ ...st, vakken: v }); };
  const zetKies = (patch) => {
    if (!kv) return; const kols = new Set(selKeys.map((k) => uitSleutel(k)[0])); const v = { ...st.vakken };
    for (const [s2, x] of Object.entries(v)) if (selKeys.includes(s2) || (heleKolom && kols.has(uitSleutel(s2)[0]))) v[s2] = Object.fromEntries(Object.entries({ ...x, ...(typeof patch === 'function' ? patch(x) : patch) }).filter(([, w]) => w !== undefined));
    zet({ ...st, vakken: v });
  };
  // Staanders zelf zetten (true), weghalen (false) of automatisch (undefined): op elke gekozen hoek.
  const zetStaanders = (w) => { const m = { ...(st.staanders || {}) }; for (const k of selKeys) { const n = (af.alleKnopen || []).find((x) => `${x.i},${x.j}` === k); if (!n || w === undefined || m[k] === !w) delete m[k]; else m[k] = w; } zet({ ...st, staanders: Object.keys(m).length ? m : undefined }); };
  const zetRand = (k) => { const l = { ...(st.leuning || {}) }; for (const s2 of selKeys) { if (k === 'auto') delete l[s2]; else l[s2] = k === 'geen' ? false : k; } zet({ ...st, leuning: l }); };
  const zetHoek = (k) => { const hk = { ...(st.hoeken || {}) }; for (const s2 of selKeys) { if (k === 'auto') delete hk[s2]; else hk[s2] = k; } zet({ ...st, hoeken: Object.keys(hk).length ? hk : undefined }); };
  const afT = useMemo(() => (toon === st ? af : stellingAfgeleid(toon, { verbonden: verb })), [toon, st, af, verb]);
  const deelLijst = [{ id: '0', naam: stAll.naam || 'Deel 1' }, ...(stAll.delen || [])];
  // De stelling voor de 3D: enkel opnieuw opbouwen als ze echt verandert (niet bij elke muisbeweging in het raster).
  // Tijdens het verven in het raster blijft de 3D staan tot je loslaat (elke cel opnieuw opbouwen is te zwaar).
  const drieBron = verf.current ? null : voorlopig;
  const drieSt = useMemo(() => (doekUit || scherm === 'bouwen' ? { ...zonderDoeken(drieBron ? metDeel(drieBron) : stAll), spook: scherm === 'bouwen' } : metGekozen(drieBron ? metDeel(drieBron) : stAll)), [doekUit, scherm, drieBron, stAll, actief, selDoek]); // eslint-disable-line react-hooks/exhaustive-deps
  const gekozen3d = useMemo(() => (sel ? sel.keys.map((s2) => ({ soort: sel.soort, deel: actief, s: s2 })) : []), [sel, actief]);
  const buitenRanden = () => af.randen.filter((x) => x.buiten && x.soort !== 'toren').map((x) => x.s);
  const voorRanden = () => { const js = af.lijst.filter((v) => v.soort !== 'toren').map((v) => v.j); if (!js.length) return []; const jm = Math.min(...js); return af.randen.filter((x) => x.k === 3 && x.j === jm && x.buiten).map((x) => x.s); };
  const statusTekst = sel?.soort === 'camera' ? 'Camera gekozen' : sel ? `${selKeys.length} ${DOEL_NAAM[sel.soort][selKeys.length === 1 ? 0 : 1]} gekozen` : stand === 'teken' ? `Tekenen: ${GEREEDSCHAP.find((g) => g.k === tool)?.naam || ''}` : 'Klik = kiezen · Shift = meer';
  const sStart = startType;
  const tabT = scherm === 'bouwen' ? 'selectie' : scherm === 'nakijken' ? (tab === 'doorgangen' ? 'doorgangen' : 'stuklijst') : 'branding';
  const mmTotaal = Mst.x(K.i1) - Mst.x(K.i0);

  useBouwerSchild();
  return createPortal(
    <div className="fm fm-ws fm-sb" role="dialog" aria-label="Stellingbouwer" {...schildProps}>
      <div className="fm-ws-kop">
        <TerugKnop onClick={onSluit} />
        <strong>Stellingbouwer · {el?.naam}</strong>
        <span className="fm-sub">{af.lijst.length} vakken · {getal(af.lijst.reduce((a, v) => a + Mst.bx(v.i) * Mst.by(v.j), 0), 1)} m² · tot {getal(Math.max(0, ...af.lijst.map((v) => v.h)))} m hoog</span>
        <div className="fm-segment fm-sb-stappen" role="tablist" aria-label="Stap">
          {[['bouwen', '1 Bouwen'], ['branding', '2 Branding'], ['nakijken', '3 Nakijken']].map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={scherm === k} className={scherm === k ? 'aan' : ''} onClick={() => setScherm(k)}>{t}</button>)}
        </div>
        {scherm === 'bouwen' && <div className="fm-segment fm-sb-stand" role="group" aria-label="Stand">
          <button type="button" className={stand === 'kies' ? 'aan' : ''} title="Kiezen: klik een vak, rand of hoek (V)" onClick={() => setStand('kies')}>Kiezen</button>
          <button type="button" className={stand === 'teken' ? 'aan' : ''} disabled={!schrijven} title="Vakken tekenen met een blok uit het palet (B)" onClick={naarTeken}>Tekenen</button>
          <button type="button" className={stand === 'grond' ? 'aan' : ''} title="Grond: gemeten hoogtes op het raster (G)" onClick={() => { setStand('grond'); setSel(null); if (indeling === '3d') setIndeling('naast'); }}>Grond</button>
        </div>}
        <span style={{ flex: 1 }} />
        <button className="fm-knop klein" disabled={pdfBezig || K.leeg} title="Eén PDF met de 3D-weergave, het grondplan en de vier aanzichten met maatlijnen" onClick={maakPdf}>{pdfBezig ? 'PDF maken…' : 'PDF'}</button>
        {schrijven && <button className="fm-knop klein" disabled={!terugL.current.length} title="Ongedaan (Ctrl + Z)" onClick={terug}>↶ Ongedaan</button>}
        {schrijven && <button className="fm-knop klein" disabled={!vooruitL.current.length} title="Opnieuw (Ctrl + Shift + Z)" onClick={opnieuw}>↷ Opnieuw</button>}
      </div>
      <div className="fm-ws-lijf">
        {/* ---------- Links: starten en tekenen ---------- */}
        {scherm === 'bouwen' && (
        <aside className="fm-ws-doeken fm-sb-palet">
          <details className="fm-sb-start" open={startOpen} onToggle={(e) => setStartOpen(e.currentTarget.open)}>
            <summary>Starten vanuit een type</summary>
            <div className="fm-sb-keuzes">{START_TYPES.map((t) => <button key={t.k} type="button" className={sStart === t.k ? 'aan' : ''} title={t.uitleg} onClick={() => setStartType(t.k)}>{t.naam}</button>)}</div>
            <div className="fm-sub">{START_TYPES.find((t) => t.k === sStart)?.uitleg}</div>
            <div className="fm-sb-brug">
              {sStart === 'rennersbrug' && (<>
                <label>Breedte <select value={brug.breed} onChange={(e) => setBrug((b) => ({ ...b, breed: Number(e.target.value) }))}><option value={0.5}>1,04 m (half vak)</option><option value={1}>2,07 m (1 vak)</option><option value={1.5}>3,11 m (2,07 + 1,04)</option><option value={2}>4,14 m (2 vakken)</option><option value={2.5}>5,18 m (2,07 + 1,04 + 2,07)</option><option value={3}>6,22 m (3 vakken)</option></select></label>
                <label>Doorgang <input type="number" min="1" max="10" value={brug.doorgang} onChange={(e) => setBrug((b) => ({ ...b, doorgang: Number(e.target.value) || 1 }))} /> vakken</label>
                <label>Vrije hoogte min. <input type="number" step="0.05" min="1.5" max="9" value={brug.hoogte} onChange={(e) => setBrug((b) => ({ ...b, hoogte: Number(e.target.value) || 2.81 }))} /> m</label>
                <label>Overspanning <select value={brug.ligger || ''} onChange={(e) => setBrug((b) => ({ ...b, ligger: e.target.value || null }))}>{LIGGERS.map((x) => <option key={x.k} value={x.k}>Vrij, {x.naam.toLowerCase()}</option>)}<option value="">Met staanders in de doorgang</option></select></label>
                <label>Op <select value={brug.op} onChange={(e) => setBrug((b) => ({ ...b, op: Number(e.target.value) }))}>{HELLINGEN.map((x) => <option key={x.stap} value={x.stap}>{HELLING_NAAM[x.stap]} {x.naam} ({x.uitleg})</option>)}</select></label>
                <label>Af <select value={brug.af} onChange={(e) => setBrug((b) => ({ ...b, af: Number(e.target.value) }))}>{HELLINGEN.map((x) => <option key={x.stap} value={x.stap}>{HELLING_NAAM[x.stap]} {x.naam} ({x.uitleg})</option>)}</select></label>
                {(() => { const m = brugMaat(brug); return <div className="fm-sub">Dek op {getal(m.H)} m · vrije hoogte {getal(m.vrij)} m · {m.nOp} + {brug.doorgang} + {m.nAf} vakken · {getal(m.lengte, 1)} m lang</div>; })()}
              </>)}
              {sStart === 'voetgangers' && (<>
                <label>Breedte <select value={vg.breed} onChange={(e) => setVg((b) => ({ ...b, breed: Number(e.target.value) }))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{getal(n * VAK, 2)} m ({n} {n === 1 ? 'vak' : 'vakken'})</option>)}</select></label>
                <label>Doorgang <input type="number" min="1" max="10" value={vg.doorgang} onChange={(e) => setVg((b) => ({ ...b, doorgang: Number(e.target.value) || 1 }))} /> vakken</label>
                <label>Vrije hoogte min. <input type="number" step="0.05" min="1.5" max="9" value={vg.hoogte} onChange={(e) => setVg((b) => ({ ...b, hoogte: Number(e.target.value) || 2.75 }))} /> m</label>
                <label>Overspanning <select value={vg.ligger} onChange={(e) => setVg((b) => ({ ...b, ligger: e.target.value }))}>{LIGGERS.map((x) => <option key={x.k} value={x.k}>{x.naam}</option>)}</select></label>
                <label>Portaal boven het dek <input type="number" step="0.1" min="0" max="5" value={vg.portaal} onChange={(e) => setVg((b) => ({ ...b, portaal: Number(e.target.value) || 0 }))} /> m</label>
              </>)}
              {sStart === 'camera' && (<>
                <label>Maat <select value={`${cam.breed}x${cam.diep}`} onChange={(e) => { const [b, d] = e.target.value.split('x').map(Number); setCam((c) => ({ ...c, breed: b, diep: d })); }}><option value="1x1">2,07 × 2,07 m</option><option value="0.5x1">1,04 × 2,07 m (half)</option><option value="1x0.5">2,07 × 1,04 m (half)</option></select></label>
                <label>Hoogte dek <select value={cam.hoogte} onChange={(e) => setCam((c) => ({ ...c, hoogte: Number(e.target.value) }))}>{[0.3, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((hh) => <option key={hh} value={hh}>{getal(hh, 2)} m</option>)}</select></label>
                <label>Vooraan <select value={cam.voor} onChange={(e) => setCam((c) => ({ ...c, voor: e.target.value }))}><option value="laag">Lage leuning (0,30 m)</option><option value="open">Open</option><option value="buis">Volle leuning</option></select></label>
                <label>Achteraan <select value={cam.achter} onChange={(e) => setCam((c) => ({ ...c, achter: e.target.value }))}><option value="buis">Buisleuning (2 rozetten)</option><option value="stelling">Stellingleuning 1,30</option><option value="ladder">Ladder</option></select></label>
                <label className="fm-vink"><input type="checkbox" checked={cam.wielen} onChange={(e) => setCam((c) => ({ ...c, wielen: e.target.checked }))} />Op wielen</label>
                <div className="fm-sub">Daarna: kies een rand of hoek om de bovenkant verder te zetten (frame, laag vooraan, schuine legger, ladder).</div>
              </>)}
              {sStart === 'platform' && (<>
                <label>Vakken <input type="number" min="1" max="20" value={plat.nx} onChange={(e) => setPlat((c) => ({ ...c, nx: Number(e.target.value) || 1 }))} style={{ width: 48 }} /> × <input type="number" min="1" max="20" value={plat.ny} onChange={(e) => setPlat((c) => ({ ...c, ny: Number(e.target.value) || 1 }))} style={{ width: 48 }} /></label>
                <label>Hoogte dek <input type="number" step="0.05" min="0.1" max="6" value={plat.hoogte} onChange={(e) => setPlat((c) => ({ ...c, hoogte: Number(e.target.value) || 0.5 }))} /> m</label>
                <label className="fm-vink"><input type="checkbox" checked={plat.leuning} onChange={(e) => setPlat((c) => ({ ...c, leuning: e.target.checked }))} />Leuning rondom</label>
              </>)}
              {sStart === 'tribune' && (<>
                <label>Rijen <input type="number" min="1" max="20" value={trib.rijen} onChange={(e) => setTrib((c) => ({ ...c, rijen: Number(e.target.value) || 1 }))} /></label>
                <label>Breedte <input type="number" min="1" max="20" value={trib.breed} onChange={(e) => setTrib((c) => ({ ...c, breed: Number(e.target.value) || 1 }))} /> vakken</label>
                <label>Eerste trede <input type="number" step="0.05" min="0.2" max="3" value={trib.start} onChange={(e) => setTrib((c) => ({ ...c, start: Number(e.target.value) || 0.5 }))} /> m</label>
              </>)}
              {sStart === 'toren' && (<>
                <label>Vakken <input type="number" min="1" max="10" value={tor.nx} onChange={(e) => setTor((c) => ({ ...c, nx: Number(e.target.value) || 1 }))} style={{ width: 48 }} /> × <input type="number" min="1" max="10" value={tor.ny} onChange={(e) => setTor((c) => ({ ...c, ny: Number(e.target.value) || 1 }))} style={{ width: 48 }} /></label>
                <label>Diepte <select value={tor.half ? 'half' : 'vol'} onChange={(e) => setTor((c) => ({ ...c, half: e.target.value === 'half' }))}><option value="vol">2,07 m</option><option value="half">1,04 m (half vak)</option></select></label>
                <label>Hoogte <input type="number" step="0.5" min="1" max="20" value={tor.hoogte} onChange={(e) => setTor((c) => ({ ...c, hoogte: Number(e.target.value) || 6 }))} /> m</label>
                <label className="fm-vink"><input type="checkbox" checked={tor.ballast} onChange={(e) => setTor((c) => ({ ...c, ballast: e.target.checked }))} />Ballast onderin</label>
              </>)}
              <button className="fm-knop klein zwart" disabled={!schrijven} onClick={() => {
                if (af.lijst.length && !window.confirm('De huidige vakken vervangen door dit type? (Ongedaan maken kan.)')) return;
                const n = sStart === 'rennersbrug' ? { ...brugVakken(brug), leuning: {} } : sStart === 'voetgangers' ? voetgangersbrug(vg) : sStart === 'camera' ? cameraStelling(cam) : sStart === 'platform' ? platform(plat) : sStart === 'toren' ? toren(tor) : tribune(trib);
                const { vakken, maten, camera, ...rest } = n;
                setSel(null);
                const nieuw = metDeel(metAuto({ naam: st.naam, aan: st.aan, id: st.id, vakken, maten, doeken: [], ...rest }));
                zetAll({ ...nieuw, camera: camera ? { ...camera, deel: actief } : nieuw.camera });
                setStand('kies'); setStartOpen(false);
              }}>Opzetten</button>
            </div>
          </details>
          <details className="fm-sb-teken" open={tekenOpen} onToggle={(e) => setTekenOpen(e.currentTarget.open)}>
            <summary>Vakken tekenen</summary>
            <div className="fm-sb-blokken">
              {GEREEDSCHAP.map((g) => (
                <button key={g.k} type="button" className={`fm-sb-blok${stand === 'teken' && tool === g.k ? ' aan' : ''}`} disabled={!schrijven} title={g.uitleg} draggable={SOORTEN.some((s) => s.k === g.k) || g.k === 'vtrap' || g.k === 'overspanning'}
                  onDragStart={(e) => { e.dataTransfer.setData('text/fm-stelling', g.k === 'vtrap' ? `vtrap:${mod}` : g.k); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => kiesTool(g.k)}>
                  <span className="fm-sb-staal" style={{ background: g.k === 'vtrap' ? '#8FB5A8' : g.k === 'overspanning' ? '#BBF7D0' : g.k === 'gom' ? '#fff' : SOORTEN.find((s) => s.k === g.k)?.kleur || '#fff' }}>{BLOK_ICOON[g.k] || ''}</span>
                  <span>{g.naam}</span>
                </button>
              ))}
            </div>
            <div className="fm-sub">{stand === 'teken' ? `${GEREEDSCHAP.find((g) => g.k === tool)?.uitleg || ''}. Klik of sleep over het raster; Esc = klaar.` : 'Kies een blok: je komt in de tekenstand. Slepen op het raster kan ook.'}</div>
            <label className="fm-vink" title="Een blok komt in alle rijen dwars op de loop van de brug"><input type="checkbox" checked={breedte} onChange={(e) => setBreedte(e.target.checked)} />Over de hele breedte</label>
            {(SOORTEN.some((s) => s.k === tool) || tool === 'vtrap') && (
              <div className="fm-sb-inst">
                {tool === 'vtrap' && (
                  <div className="fm-veld">Trapmodule
                    <div className="fm-sb-modules">{TRAPMODULES.map((m) => <button key={m.k} type="button" draggable className={mod === m.k ? 'aan' : ''} title={`${getal(m.l)} m lang, stijgt ${getal(m.s)} m, 2,07 m breed`} onDragStart={(e) => { e.dataTransfer.setData('text/fm-stelling', `vtrap:${m.k}`); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => setMod(m.k)}><span className="fm-sb-mod-staal" style={{ width: m.l * 14, height: Math.max(6, m.s * 14) }} />{m.naam}</button>)}</div>
                  </div>
                )}
                {tool === 'helling' && (
                  <div className="fm-veld">Helling
                    <div className="fm-segment">{HELLINGEN.map((x) => <button key={x.stap} type="button" className={stap === x.stap ? 'aan' : ''} title={`${x.naam} · ${x.uitleg}`} onClick={() => setStap(x.stap)}>{HELLING_NAAM[x.stap]} {x.naam}</button>)}</div>
                    <div className="fm-sub">Van rozet naar rozet: licht = 0,5 m per vak, steil = 1 m per vak. Nooit steiler.</div>
                  </div>
                )}
                {tool === 'trap' && <div className="fm-veld">Stijging per vak<div className="fm-segment">{[0.5, 1, 1.5, 2].map((x) => <button key={x} type="button" className={Number(trapStap) === x ? 'aan' : ''} onClick={() => setTrapStap(x)}>{getal(x)} m</button>)}</div></div>}
                {(tool === 'helling' || tool === 'trap' || tool === 'vtrap') && <label className="fm-veld">Beginhoogte zonder buurvak (m)<input type="number" step="0.05" min="0" value={van} onChange={(e) => setVan(e.target.value)} onBlur={() => setVan(opCm(van))} /></label>}
                {!['helling', 'trap', 'vtrap'].includes(tool) && <label className="fm-veld">Hoogte dek zonder buurvak (m)<input type="number" step="0.01" min="0" value={h} onChange={(e) => setH(e.target.value)} onBlur={() => setH(opCm(h))} /></label>}
                {!['helling', 'trap', 'vtrap'].includes(tool) && <div className="fm-segment">{[0.5, 1, 1.5, 2, 2.5, 3].map((x) => <button key={x} type="button" className={Number(h) === x ? 'aan' : ''} onClick={() => setH(x)}>{getal(x)}</button>)}</div>}
                {(tool === 'helling' || tool === 'trap' || tool === 'vtrap') && <div className="fm-sb-rij">Oplopend <div className="fm-segment">{pijl.map((p, k) => <button key={k} type="button" className={r === k ? 'aan' : ''} title="Richting zonder buurvak (R)" onClick={() => setR(k)}>{p}</button>)}</div></div>}
                <label className="fm-veld">Grond onder de vakken (m)<input type="number" step="0.05" min="0" value={grondP} onChange={(e) => setGrondP(e.target.value)} onBlur={() => setGrondP(opCm(grondP))} /></label>
                <label className="fm-vink"><input type="checkbox" checked={doorgang} onChange={(e) => setDoorgang(e.target.checked)} />Doorgang eronder</label>
                {doorgang && <label className="fm-vink"><input type="checkbox" checked={vrijO} onChange={(e) => setVrijO(e.target.checked)} />Vrije overspanning (geen staanders)</label>}
              </div>
            )}
            {tool === 'overspanning' && (
              <div className="fm-sb-inst">
                <label className="fm-veld">Vrije hoogte onder de overspanning (m)<input type="number" step="0.05" min="1.5" max="9" value={ovH} onChange={(e) => setOvH(e.target.value)} /></label>
                <label className="fm-veld">Ligger<select value={ovLigger || ''} onChange={(e) => setOvLigger(e.target.value || null)}>{LIGGERS.map((x) => <option key={x.k} value={x.k}>Vrij, {x.naam.toLowerCase()}</option>)}<option value="">Met staanders in de doorgang</option></select></label>
                <div className="fm-sub">Dek op {getal(brugDek(ovH, ovLigger || null))} m (rozet), {Math.round(brugDek(ovH, ovLigger || null) / (Number(st.hellingStap) || 0.5))} hellingvakken per kant ({HELLING_NAAM[Number(st.hellingStap) || 0.5].toLowerCase()}).</div>
                {!st.auto && <button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => zet({ ...st, auto: true })}>Hellingen vanzelf aanzetten</button>}
              </div>
            )}
          </details>
          <div className="fm-sb-snel">
            <div className="fm-kop">Snel kiezen</div>
            <div className="fm-sb-chips">
              <button type="button" className="fm-knop klein" disabled={!af.lijst.length} onClick={() => { const ks = buitenRanden(); if (ks.length) kies({ soort: 'rand', keys: ks }); }}>Alle buitenranden</button>
              <button type="button" className="fm-knop klein" disabled={!af.lijst.length} onClick={() => { const ks = voorRanden(); if (ks.length) kies({ soort: 'rand', keys: ks }); }}>Voorrand</button>
              <button type="button" className="fm-knop klein" disabled={!af.lijst.length} onClick={() => { const ks = af.lijst.filter((v) => v.soort === 'helling').map((v) => v.s); if (ks.length) kies({ soort: 'vak', keys: ks }); }}>Alle hellingen</button>
              <button type="button" className="fm-knop klein" disabled={!af.lijst.length} onClick={() => kies({ soort: 'vak', keys: af.lijst.map((v) => v.s) })}>Alle vakken</button>
              <button type="button" className="fm-knop klein" disabled={!sel} onClick={() => setSel(null)}>Niets</button>
            </div>
          </div>
        </aside>
        )}
        {scherm === 'branding' && (
          <aside className="fm-ws-doeken fm-sb-palet fm-sb-merk">
            <div className="fm-kop">Ontwerpen</div>
            <div className="fm-sub">Kies wat je tekent. Is er een doek gekozen, dan krijgt dat doek dit ontwerp.</div>
            <div className="fm-sb-tegels">
              {[{ id: '', naam: 'Wit canvas' }, ...ontwerpen].map((o) => <button key={o.id || 'wit'} type="button" disabled={!schrijven} className={(doekT?.voor || '') === o.id ? 'aan' : ''} title={o.naam} onClick={() => ontwerpKies(o.id)}>{o.eigenschappen?.beeld ? <img src={publiekeUrl(o.eigenschappen.beeld)} alt="" /> : <span style={{ background: o.id ? o.eigenschappen?.kleur || '#0F766E' : '#FFFFFF' }} />}<em>{o.naam}</em></button>)}
            </div>
            {schrijven && <DoekUpload planId={it.plan_id} drager="stelling" klein onNieuw={(d) => ontwerpKies(d.id)} />}
          </aside>
        )}


        {/* ---------- Midden: boven, zij, 3D ---------- */}
        <div className="fm-sb-midden">
          <div className="fm-sb-balk">
            {scherm === 'nakijken' && <span className="fm-segment fm-sb-zijde" role="group" aria-label="Zijde">{[['voor', 'Voorkant'], ['achter', 'Achterkant'], ['links', 'Links'], ['rechts', 'Rechts']].map(([k, t]) => <button key={k} type="button" className={zijdeN === k ? 'aan' : ''} onClick={() => setZijdeN(k)}>{t}</button>)}</span>}
            {scherm === 'nakijken' && <button type="button" className="fm-knop klein" onClick={drukZij}>Afdrukken</button>}
            {deelLijst.length > 1 && <div className="fm-segment" role="group" aria-label="Delen">{deelLijst.map((d) => <button key={d.id} type="button" className={actief === d.id ? 'aan' : ''} onClick={() => { setActief(d.id); setSel(null); }}>{d.naam}{d.aan ? ` · ${getal(d.aan.hoek, 0)}°` : ''}</button>)}</div>}
            {scherm !== 'nakijken' && <span className="fm-sub fm-sb-status">{statusTekst}</span>}
            <span style={{ flex: 1 }} />
            {scherm === 'branding' && <span className="fm-segment fm-sb-zijde" role="group" aria-label="Zijde">{ZIJDEN.map(([k, t]) => <button key={k} type="button" className={kijk === k ? 'aan' : ''} title={k === 'vrij' ? 'Vrij draaien' : `Recht voor de ${t.toLowerCase()}`} onClick={() => setKijk(k)}>{t}</button>)}</span>}
            {scherm === 'bouwen' && <span className="fm-segment" role="group" aria-label="Indeling">{[['naast', 'Naast elkaar'], ['raster', 'Raster'], ['3d', '3D']].map(([k, t]) => <button key={k} type="button" className={indeling === k ? 'aan' : ''} onClick={() => setIndeling(k)}>{t}</button>)}</span>}
            {scherm !== 'bouwen' && (stAll.doeken?.length > 0 || (stAll.delen || []).some((d) => d.doeken?.length)) && <button type="button" className={`fm-knop klein fm-sb-oog${doekUit ? ' uit' : ''}`} title={doekUit ? 'Doeken tonen' : 'Doeken verbergen (de constructie zien)'} aria-pressed={!doekUit} onClick={() => setDoekUit((x) => !x)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{doekUit && <path d="M3 3l18 18" />}</svg>Doeken</button>}
            {autoMelding && st.auto && <span className="fm-sub" style={{ color: '#166534' }}>{autoMelding}</span>}
            {!K.leeg && <span className="fm-sub">{getal(mmTotaal, 2)} × {getal(Mst.y(K.j1) - Mst.y(K.j0), 2)} m</span>}
          </div>
          {stand === 'teken' && <div className="fm-sb-banner"><span>Tekenen: <b>{GEREEDSCHAP.find((g) => g.k === tool)?.naam}</b> · klik of sleep over het raster · rechtsklik = weghalen</span><button type="button" onClick={() => setStand('kies')}>Klaar (Esc)</button></div>}
          <div className="fm-sb-zicht">
            {scherm === 'bouwen' && schrijven && K.leeg && !startWeg && (
              <div className="fm-sb-startscherm">
                <h2>Waar begin je mee?</h2>
                <div className="fm-sub">Kies een type: links stel je de maten in en zet je het op. Of teken zelf vakken op het raster.</div>
                <div className="fm-sb-startraster">
                  {START_TYPES.map((t) => <button key={t.k} type="button" onClick={() => { setStartType(t.k); setStartOpen(true); setStartWeg(true); }}><b>{t.naam}</b><span className="fm-sub">{t.uitleg}</span></button>)}
                  <button type="button" onClick={() => { setStartWeg(true); setStartOpen(false); }}><b>Zelf tekenen</b><span className="fm-sub">Leeg raster: kies links een blok en sleep over het raster.</span></button>
                </div>
              </div>
            )}
            {weergave === 'boven' && (
              <div className={`fm-sb-raster${stand === 'teken' ? ' teken' : ''}${scherm === 'bouwen' && indeling === '3d' ? ' klein' : ''}`} ref={rasRef} onPointerLeave={() => setRasZweef(null)} onPointerDown={neer} onPointerMove={beweeg} onPointerUp={los} onPointerCancel={los} onContextMenu={rechtsklik} onDragOver={(e) => e.preventDefault()} onDrop={drop}>
                {!K.leeg && schrijven && (() => {
                  const knop = (as, idx, w, stijl) => { const half = Math.abs(w - HALF) < 0.001; const vrij = !half && Math.abs(w - VAK) > 0.001;
                    return <button key={`${as}${idx}`} type="button" className={`fm-sb-maat${half ? ' half' : ''}${vrij ? ' vrij' : ''}`} style={stijl} title={`${as === 'x' ? 'Kolom' : 'Rij'} ${getal(w, 2)} m · klik: ${half || vrij ? 'vol vak 2,07 m' : 'half vak 1,04 m'}`}
                      onPointerDown={(e) => e.stopPropagation()} onClick={() => zetMaat(as, idx, half || vrij ? VAK : HALF)}>{getal(w, 2)}</button>; };
                  return (<>
                    {Array.from({ length: K.i1 - K.i0 }, (_, k) => K.i0 + k).map((i) => knop('x', i, Mst.bx(i), { left: X(i) + 1, top: Y(K.j1) - 20, width: X(i + 1) - X(i) - 2 }))}
                    {Array.from({ length: K.j1 - K.j0 }, (_, k) => K.j0 + k).map((j) => knop('y', j, Mst.by(j), { left: X(K.i0) - 37, top: Y(j + 1) + 1, height: Y(j) - Y(j + 1) - 2, width: 34 }))}
                  </>);
                })()}
                <svg width={rasMaat.w} height={rasMaat.h}>
                  {Array.from({ length: i1 - i0 + 1 }, (_, k) => <line key={`x${k}`} x1={X(i0 + k)} y1={Y(j1)} x2={X(i0 + k)} y2={Y(j0)} stroke="#E5E7EB" />)}
                  {Array.from({ length: j1 - j0 + 1 }, (_, k) => <line key={`y${k}`} x1={X(i0)} y1={Y(j0 + k)} x2={X(i1)} y2={Y(j0 + k)} stroke="#E5E7EB" />)}
                  {Object.entries(toon.vakken || {}).map(([s, v]) => {
                    const [i, j] = uitSleutel(s); const kl = soortVan(v.soort).kleur; const sch = v.soort === 'helling' || v.soort === 'trap'; const aan = sel?.soort === 'vak' && selKeys.includes(s);
                    return (
                      <g key={s}>
                        <rect x={X(i)} y={Y(j + 1)} width={X(i + 1) - X(i)} height={Y(j) - Y(j + 1)} fill={kl} stroke={aan ? '#2563EB' : afwijking(v) ? '#DC2626' : '#8A6A45'} strokeWidth={aan || afwijking(v) ? 2.5 : 1}><title>{afwijking(v) || `${soortVan(v.soort).naam} · ${getal(v.h, 2)} m`}</title></rect>
                        {aan && <rect x={X(i) + 1.5} y={Y(j + 1) + 1.5} width={X(i + 1) - X(i) - 3} height={Y(j) - Y(j + 1) - 3} fill="#2563EB" fillOpacity="0.15" style={{ pointerEvents: 'none' }} />}
                        {v.doorgang && <rect x={X(i) + 3} y={Y(j + 1) + 3} width={X(i + 1) - X(i) - 6} height={Y(j) - Y(j + 1) - 6} fill="#22C55E" fillOpacity={0.25} stroke="#15803D" strokeWidth={1.5} strokeDasharray="4 3" />}
                        {(() => { const smal = X(i + 1) - X(i) < C * 0.8; return <text x={(X(i) + X(i + 1)) / 2} y={(Y(j + 1) + Y(j)) / 2 + (sch ? -2 : 4)} textAnchor="middle" fontSize={smal ? Math.max(8, C / 6) : Math.max(9, C / 4.6)} fill="#3B2A1A" style={{ pointerEvents: 'none' }}>{sch && !smal ? `${getal(v.laag || 0, 1)}→${getal(v.h, 1)}` : getal(v.h, smal ? 1 : 2)}</text>; })()}
                        {sch && <text x={(X(i) + X(i + 1)) / 2} y={(Y(j + 1) + Y(j)) / 2 + C / 3.2} textAnchor="middle" fontSize={Math.max(10, C / 3.5)} fill="#6B4423" style={{ pointerEvents: 'none' }}>{pijl[Number(v.r) || 0]}</text>}
                      </g>
                    );
                  })}
                  {afT.randen.map((rr) => {
                    const [A, B] = randPunten(rr); const dk = doekLijst.find((d) => (d.randen || []).includes(rr.s)); const aan = sel?.soort === 'rand' && selKeys.includes(rr.s); const kiesbaar = rr.kiesbaar;
                    return (
                      <g key={rr.s}>
                        {rr.leuning && <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={rr.lsoort === 'laag' ? '#B45309' : rr.lsoort === 'net' ? '#64748B' : rr.lsoort === 'frame' ? '#2F6F68' : '#1F2937'} strokeWidth={rr.lsoort === 'net' ? 4 : rr.lsoort === 'frame' ? 5 : 3} strokeLinecap="round" strokeDasharray={rr.lsoort === 'net' ? '2 2' : st.leuning?.[rr.s] != null ? '6 3' : undefined} />}
                        {dk && <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="#0F766E" strokeWidth={6} strokeOpacity={0.6} />}
                        {aan && <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="#2563EB" strokeWidth={8} strokeOpacity={0.5} strokeLinecap="round" />}
                        {kiesbaar && stand === 'kies' && <line className="fm-sb-randhit" x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]}><title>{`${rr.leuning ? LEUNINGEN.find((x) => x.k === rr.lsoort)?.naam || 'Leuning' : rr.buiten ? 'Open rand' : 'Tussen twee vakken (leuning mogelijk)'}${rr.schuin ? ' · schuine legger' : ''}${dk ? ` · doek ${doekMap.get(dk.voor)?.naam || ''}` : ''} · klik = kiezen`}</title></line>}
                      </g>
                    );
                  })}
                  {stand === 'kies' && afT.knopen.filter((n) => n.leuning).map((n) => { const key = `${n.i},${n.j}`; const hk = st.hoeken?.[key]; const aan = sel?.soort === 'hoek' && selKeys.includes(key);
                    return <rect key={`hk${key}`} className={`fm-sb-hoek${aan ? ' aan' : ''}${hk ? ` ${hk}` : ''}`} x={X(n.i) - 4.5} y={Y(n.j) - 4.5} width={9} height={9}><title>{`Hoek · ${hk === 'hoog' ? 'Hoog 1,30' : hk === 'midden' ? 'Midden 0,80' : hk === 'geen' ? 'Geen leuning' : hk === 'laag' ? 'Laag 0,30' : 'Automatisch'} · klik = kiezen`}</title></rect>; })}
                  <line x1={X(0)} y1={Y(0)} x2={X(0) + C * 0.9} y2={Y(0)} stroke="#2563EB" strokeWidth={2} />
                  <circle cx={X(0)} cy={Y(0)} r={3.5} fill="#2563EB" />
                  {camPlek && camPlek.deel === actief && (() => {
                    // TV-camera op het dek: body met lens en de kijkhoek, zoals op de kaart. Vooruit = −y op het scherm (0° = naar boven).
                    const px = X(camPlek.i + camPlek.u); const py = Y(camPlek.j + camPlek.v); const m = C / VAK; const R = CAMERA_SECTOR.r * m; const aan = sel?.soort === 'camera';
                    const hk = CAMERA_SECTOR.hoek; const sec = [[0, 0]]; for (let k = 0; k <= 10; k++) { const a = ((-hk + (2 * hk * k) / 10) * Math.PI) / 180; sec.push([Math.sin(a) * R, -Math.cos(a) * R]); }
                    const rh = Math.max(12, 0.35 * m);
                    return (
                      <g className={`fm-sb-cam${aan ? ' aan' : ''}${stand === 'teken' ? ' uit' : ''}`} transform={`translate(${px},${py}) rotate(${camPlek.rot})`}>
                        <polygon points={P2(sec)} fill="#FDE68A" fillOpacity="0.55" stroke="#B45309" strokeWidth="1" />
                        {aan && <circle r={rh} fill="#2563EB" fillOpacity="0.18" stroke="#2563EB" strokeWidth="2" />}
                        <rect x={-0.22 * m} y={-0.1 * m} width={0.44 * m} height={0.3 * m} fill="#111827" stroke="#1d1d1b" />
                        <rect x={-0.08 * m} y={-0.25 * m} width={0.16 * m} height={0.15 * m} fill="#111827" stroke="#1d1d1b" />
                        <circle className="fm-sb-cam-hit" r={rh} onPointerDown={(e) => camNeer(e, 'verplaats')}><title>{`Camera${tv.lens ? ` ${tv.lens}` : ''} · dek op ${getal(camPlek.h, 2)} m · klik = kiezen · slepen = verplaatsen`}</title></circle>
                        {aan && stand === 'kies' && <><line y1={-rh} y2={-(R + 0.3 * m)} stroke="#2563EB" strokeWidth="1" strokeDasharray="3 3" /><circle className="fm-sb-cam-draai" cy={-(R + 0.3 * m)} r={7} onPointerDown={(e) => camNeer(e, 'draai')}><title>Slepen = kijkrichting draaien</title></circle></>}
                      </g>
                    );
                  })()}
                  {stand === 'grond' && (() => {
                    const f = grondFunctie(st); const Mg = stellingMaten(st); const gt = (x) => getal(x, 2);
                    const kn = new Set(af.knopen.map((n) => `${n.i},${n.j}`)); const uitL = [];
                    for (let i = i0 - 1; i <= i1 + 1; i++) for (let j = j0 - 1; j <= j1 + 1; j++) {
                      const k = `${i},${j}`; const gp = grondPunt(k); const x = X(i); const y = Y(j);
                      if (gp) uitL.push(<g key={`gp${k}`}><circle cx={x} cy={y} r={7} fill="#15803D" stroke={selGrond === k ? '#2563EB' : '#fff'} strokeWidth={selGrond === k ? 3 : 1.5} /><text x={x + 9} y={y - 7} fontSize="11" fontWeight="600" fill="#14532D" style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}>{gt(gp.h)}</text></g>);
                      else { uitL.push(<circle key={`gk${k}`} cx={x} cy={y} r={3} fill="#9CA3AF" />); if (f && kn.has(k)) uitL.push(<text key={`gw${k}`} x={x + 5} y={y + 12} fontSize="9.5" fill="#6B7280" style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}>{gt(f(Mg.x(i), Mg.y(j)))}</text>); }
                    }
                    return <g className="fm-sb-grondlaag">{uitL}</g>;
                  })()}
                </svg>
                <div className="fm-ws-tip fm-sub">{stand === 'grond' ? 'Grond: klik een hoek van het raster om een gemeten hoogte te zetten (0 = laagste punt) · grijs = berekend · Delete = punt weg' : stand === 'teken' ? 'Klik = plaatsen · slepen = verven · rechtsklik = weghalen · R = richting' : 'Klik een vak, rand of hoek · Shift = meer · maat onder een kolom = 2,07 ↔ 1,04'} · blauw punt = ankerpunt op het plan</div>
              </div>
            )}
            {weergave === 'zij' && <ZijAanzicht st={doekUit ? zonderDoeken({ ...toon, wielen: stAll.wielen }) : { ...toon, wielen: stAll.wielen }} af={afT} doekMap={doekMap} zijde={zijdeN} svgRef={zijSvg} />}
            {scherm === 'bouwen' && indeling === '3d' && <button type="button" className="fm-sb-drie-knop fm-sb-ras-knop" title="Raster groot" onClick={() => setIndeling('raster')}>Raster ↗</button>}
            <div className={`fm-sb-drie${weergave === '3d' ? ' groot' : scherm === 'bouwen' ? (indeling === '3d' ? ' groot' : indeling === 'raster' ? ' klein' : ' naast') : ' klein'}`}>
              {scherm === 'bouwen' && indeling === 'raster' ? <button type="button" className="fm-sb-drie-knop" title="3D groot" onClick={() => setIndeling('3d')}>3D ↗</button> : weergave === '3d' || scherm === 'bouwen' ? <span className="fm-sb-drie-melding">Indicatieve weergave · klik = kiezen · enkel de plannen van de stellingbouwer zijn bindend</span> : <button type="button" className="fm-sb-drie-knop" title="3D groot (3)" onClick={() => setWeergave('3d')}>3D ↗</button>}
              <StellingDrie st={drieSt} doekMap={doekMap} hoek={scherm === 'branding' ? KIJK[kijk][0] : undefined} kantel={scherm === 'branding' ? KIJK[kijk][1] : undefined} celKiezen={!!doekT && weergave === '3d'} zweef={scherm === 'bouwen' ? rasZweef : null} doekGekozen={scherm === 'branding' && selDoek ? doekLijst.find((x) => x.id === selDoek) || null : null} onSleep={doekT ? null : opSleep} onDubbel={doekT ? null : opDubbel} onKies={(d, o) => (doekT && weergave === '3d' ? (d?.soort === 'celreeks' ? celReeks(d.cellen, d.kant, d.start) : d?.soort === 'vak' ? dakKlik(d) : celKlik(d)) : kies(d, o))} gekozen={gekozen3d} />
            </div>
          </div>
        </div>

        {/* ---------- Rechts: selectie, doorgangen, stuklijst ---------- */}
        <aside className="fm-ws-rechts fm-sb-rechts">
          {scherm === 'nakijken' && <div className="fm-tabs" role="tablist">
            <button type="button" className={tabT === 'doorgangen' ? 'aan' : ''} onClick={() => setTab('doorgangen')}>Doorgangen{af.doorgangen.length ? ` (${af.doorgangen.length})` : ''}</button>
            <button type="button" className={tabT === 'stuklijst' ? 'aan' : ''} onClick={() => setTab('stuklijst')}>Stuklijst</button>
          </div>}
          {tabT === 'selectie' && stand === 'grond' && (() => {
            const P = st.grondPunten || []; const f = grondFunctie(st); const hs = Object.values(st.vakken || {}).flatMap((v) => v.grondH || []);
            return (
              <div className="fm-sb-insp">
                <div className="fm-ws-rkop"><strong>Grond</strong></div>
                <div className="fm-sub">Klik in het raster een hoek aan en vul de gemeten hoogte in (in m, 0 = het laagste punt of je referentiepunt). Eén punt = vlakke grond, twee = een helling langs die lijn, drie of meer = een vlak dat door elk punt gaat. De grijze getallen zijn berekend.</div>
                {P.length === 0 && <div className="fm-sub" style={{ marginTop: 8 }}>Nog geen punten: de grond volgt de instellingen per vak (Grond onder het vak).</div>}
                {P.map((q) => { const k = `${q.i},${q.j}`; return (
                  <div key={k} className={`fm-sb-grondrij${selGrond === k ? ' aan' : ''}`} onClick={() => setSelGrond(k)} role="button" tabIndex={0}>
                    <span>Hoek {k}</span>
                    <input type="number" step="0.05" min="0" disabled={!schrijven} aria-label={`Hoogte hoek ${k}`} defaultValue={q.h} key={`${k}-${q.h}`} onFocus={() => setSelGrond(k)} onBlur={(e) => { const w = Number(e.target.value); if (Number.isFinite(w) && Math.abs(w - q.h) > 0.001) zetGrondPunt(k, w); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /> m
                    {schrijven && <button type="button" className="fm-x" title="Punt weghalen" onClick={(e) => { e.stopPropagation(); zetGrondPunt(k, null); }}>×</button>}
                  </div>
                ); })}
                {f && hs.length > 0 && <div className="fm-sub" style={{ marginTop: 8 }}>Onder de stelling: grond van {getal(Math.min(...hs), 2)} tot {getal(Math.max(...hs), 2)} m ({getal(Math.max(...hs) - Math.min(...hs), 2)} m verschil). De voetspindels vangen tot 0,25 m op; meer = langere staanders of kalvoeten (zie de stuklijst).</div>}
                {schrijven && P.length > 0 && <div className="fm-sb-knoppen"><button type="button" className="fm-knop klein" onClick={() => { zet({ ...st, grondPunten: undefined }); setSelGrond(null); }}>Alle punten weg</button></div>}
              </div>
            );
          })()}
          {tabT === 'selectie' && !sel && stand !== 'grond' && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>{stAll.naam || 'Stelling'}{actief !== '0' ? ` · ${deelLijst.find((d) => d.id === actief)?.naam}` : ''}</strong></div>
              <div className="fm-sub">Niets gekozen. Klik een vak, rand of hoek in het raster of in 3D. Shift = meer kiezen.</div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">Stelling</div>
                <label className="fm-veld">Naam<input type="text" disabled={!schrijven} value={stAll.naam || ''} placeholder={el?.naam || 'Stelling'} onChange={(e) => zetAll({ ...stAll, naam: e.target.value || undefined })} /></label>
                <label className="fm-vink" title="Zwenkwielen van 200 mm met spindel en rem onder elke staander, in plaats van voetplaten"><input type="checkbox" disabled={!schrijven} checked={!!stAll.wielen} onChange={(e) => zetAll({ ...stAll, wielen: e.target.checked || undefined })} />Op wielen (+0,35 m)</label>
                <label className="fm-vink" title="Teken het grondplan en zet de overspanning op hoogte: de hellingen ervoor en erna volgen vanzelf, van rozet naar rozet"><input type="checkbox" disabled={!schrijven} checked={!!st.auto} onChange={(e) => zet({ ...st, auto: e.target.checked || undefined })} />Hellingen vanzelf</label>
                <div className="fm-sb-rij">Helling <div className="fm-segment">{HELLINGEN.map((x) => <button key={x.stap} type="button" disabled={!schrijven} title={`${x.naam} · ${x.uitleg}`} className={(Number(st.hellingStap) || 0.5) === x.stap ? 'aan' : ''} onClick={() => zet({ ...st, hellingStap: x.stap })}>{HELLING_NAAM[x.stap]} {x.naam}</button>)}</div></div>
                <label className="fm-veld">Leuning standaard<select disabled={!schrijven} value={st.leuningStandaard || 'buis'} onChange={(e) => zet({ ...st, leuningStandaard: e.target.value })}><option value="stelling">Stellingleuning 1,30 m (rennersbrug)</option><option value="buis">Buisleuning 1 m</option><option value="net">Spijlenhekje</option></select></label>
                <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={!st.geenLadder} onChange={(e) => zet({ ...st, geenLadder: e.target.checked ? undefined : true })} />Ladder vanzelf vanaf 2 m (zonder trap)</label>
                <div className="fm-sb-rij">Leuning vanaf <input type="number" step="0.05" min="0" disabled={!schrijven} value={st.leuningVanaf ?? 0.5} onChange={(e) => zet({ ...st, leuningVanaf: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} style={{ width: 64 }} /> m dek</div>
              </div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">TV-camera</div>
                {camPlek ? (<>
                  <div className="fm-sub">Camerastelling: {tv.lens ? `camera ${tv.lens}` : 'camera zonder type'}{tv.opstelling ? ` · ${(OPSTELLINGEN.find(([k]) => k === tv.opstelling)?.[1] || '').toLowerCase()}` : ''} · vak {camPlek.s}{camPlek.deel !== actief ? ` (${deelLijst.find((d) => d.id === camPlek.deel)?.naam || 'ander deel'})` : ''} · kijkt naar {camPlek.rot}°</div>
                  <div className="fm-sb-chips">
                    <button type="button" className="fm-knop klein" onClick={() => { if (camPlek.deel !== actief) setActief(camPlek.deel); setSel({ soort: 'camera', keys: ['camera'] }); }}>Camera kiezen</button>
                    {schrijven && <button type="button" className="fm-knop klein gevaar" onClick={camWeg}>Weghalen</button>}
                  </div>
                </>) : (<>
                  <div className="fm-sub">Geen camera. Een camera op het dek maakt er een camerastelling van: op de kaart met kijkhoek, uitgezoomd een bolletje met label.</div>
                  {!camKeuze ? <button type="button" className="fm-knop klein zwart" disabled={!schrijven || !af.lijst.length} onClick={() => setCamKeuze({ lens: tv.lens || '', opstelling: tv.opstelling || 'statief' })}>Camera toevoegen</button> : (<>
                    <label className="fm-veld">Lens<input list="fm-sb-lenzen" value={camKeuze.lens} placeholder="bv. 86x" onChange={(e) => setCamKeuze((k) => ({ ...k, lens: e.target.value.trim() }))} /></label>
                    <datalist id="fm-sb-lenzen">{LENZEN.map((l) => <option key={l} value={l} />)}</datalist>
                    <div className="fm-veld">Opstelling<div className="fm-segment">{OPSTELLINGEN.map(([k, n]) => <button key={k} type="button" className={camKeuze.opstelling === k ? 'aan' : ''} onClick={() => setCamKeuze((x) => ({ ...x, opstelling: k }))}>{n}</button>)}</div></div>
                    <div className="fm-sb-chips"><button type="button" className="fm-knop klein zwart" onClick={() => camErop(camKeuze)}>Op de stelling zetten</button><button type="button" className="fm-knop klein" onClick={() => setCamKeuze(null)}>Annuleer</button></div>
                  </>)}
                </>)}
              </div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">Platen aan de uiteinden</div>
                <div className="fm-sb-rij">Aanloop helling <input type="number" step="0.05" min="0" disabled={!schrijven} value={st.aanloop ?? AANLOOP} onChange={(e) => zet({ ...st, aanloop: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 64 }} /> m</div>
                <div className="fm-sb-rij">Uitloop rennerstrap <input type="number" step="0.05" min="0" disabled={!schrijven} value={st.uitloop ?? 0} onChange={(e) => zet({ ...st, uitloop: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 64 }} /> m</div>
              </div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">Delen met knik</div>
                {deelLijst.length > 1 && <div className="fm-sb-chips">{deelLijst.map((d) => <button key={d.id} type="button" className={`fm-knop klein${actief === d.id ? ' zwart' : ''}`} onClick={() => { setActief(d.id); setSel(null); }}>{d.naam}{d.aan ? ` · ${getal(d.aan.hoek, 0)}°` : ''}</button>)}</div>}
                {schrijven && actief !== '0' && (<>
                  <div className="fm-sb-rij">Knikhoek <input type="number" step="1" value={st.aan?.hoek ?? 0} onChange={(e) => zetAll({ ...stAll, delen: stAll.delen.map((d) => (d.id === actief ? { ...d, aan: { ...d.aan, hoek: Number(e.target.value) || 0 } } : d)) })} style={{ width: 56 }} />° <span className="fm-sub">negatief = naar rechts</span></div>
                  <div className="fm-sb-rij">Passtuk <input type="number" step="0.05" title="Lengte van het passtuk tussen de delen (m)" value={st.aan?.schuif?.[0] ?? 0} onChange={(e) => zetAll({ ...stAll, delen: stAll.delen.map((d) => (d.id === actief ? { ...d, aan: { ...d.aan, schuif: [Number(e.target.value) || 0, d.aan?.schuif?.[1] || 0] } } : d)) })} style={{ width: 56 }} /> m · opzij <input type="number" step="0.05" title="Verschuiving opzij (m)" value={st.aan?.schuif?.[1] ?? 0} onChange={(e) => zetAll({ ...stAll, delen: stAll.delen.map((d) => (d.id === actief ? { ...d, aan: { ...d.aan, schuif: [d.aan?.schuif?.[0] || 0, Number(e.target.value) || 0] } } : d)) })} style={{ width: 56 }} /> m</div>
                  <button type="button" className="fm-knop klein gevaar" onClick={() => { if (!window.confirm('Dit deel weghalen?')) return; const weg = new Set([actief]); let meer = true; while (meer) { meer = false; for (const d of stAll.delen) if (!weg.has(d.id) && weg.has(d.aan?.deel)) { weg.add(d.id); meer = true; } } zetAll({ ...stAll, delen: stAll.delen.filter((d) => !weg.has(d.id)) }); setActief('0'); setSel(null); }}>Dit deel weghalen</button>
                </>)}
                {schrijven && <div className="fm-sb-rij">Nieuw deel onder <input type="number" step="1" value={knikHoek} onChange={(e) => setKnikHoek(e.target.value)} style={{ width: 56 }} />° <button type="button" className="fm-knop klein" disabled={!Object.keys(st.vakken || {}).length} title="Een nieuw deel dat aansluit op het einde (rechts op het raster) van dit deel, onder een hoek. Negatief = naar rechts." onClick={nieuwDeel}>+ Deel</button></div>}
                {deelLijst.length === 1 && <div className="fm-sub">Eén deel. Een deel met knik sluit aan op het einde van dit deel; de wig ertussen is een passtuk.</div>}
              </div>
              {doekLijst.length > 0 && (
                <div className="fm-sb-kaart">
                  <div className="fm-kop">Doeken <span className="fm-sub">· klik = de wand tonen, × = weghalen</span></div>
                  {doekLijst.map((d) => <div key={d.id} className="fm-sb-doek"><button type="button" onClick={() => kies(d.soort === 'dak' ? { soort: 'vak', keys: d.vakken } : { soort: 'rand', keys: d.randen })}>{d.soort === 'dak' ? `Bovenop · ${d.vakken.length} ${d.vakken.length === 1 ? 'vak' : 'vakken'}` : `${DOEK_SOORTEN.find(([k]) => k === d.soort)?.[1] || 'Op de leuning'}${d.soort === 'vlak' && d.van != null && d.tot != null ? ` ${getal(Math.max(0, d.van), 2)}–${getal(Math.min(d.tot, 20), 2)} m` : ''}${d.kant === 'binnen' ? ' · binnenkant' : ''} · ${d.randen.length} ${d.randen.length === 1 ? 'rand' : 'randen'}`}{d.voor ? ` · ${doekMap.get(d.voor)?.naam || ''}` : ' · nog geen ontwerp'}</button><button type="button" aria-label="Doek weghalen" disabled={!schrijven} onClick={() => zet({ ...st, doeken: doekLijst.filter((x) => x.id !== d.id) })}>×</button></div>)}
                  {schrijven && doekLijst.length > 1 && <button type="button" className="fm-knop klein gevaar" onClick={() => { if (window.confirm(`Alle ${doekLijst.length} doeken van deze stelling weghalen? (Ongedaan maken kan.)`)) zet({ ...st, doeken: [] }); }}>Alle doeken weghalen</button>}
                </div>
              )}
              {af.scheef?.length > 0 && <div className="fm-sb-kaart">
                <div className="fm-melding">{af.scheef.length === 1 ? '1 vak hangt' : `${af.scheef.length} vakken hangen`} niet in de rozetten van de staander ernaast (bv. naast een toren): {[...new Set(af.scheef.map((x) => `dek ${getal(x.h, 2)} → ${getal(x.voorstel, 2)} m`))].join(', ')}.</div>
                {schrijven && <button type="button" className="fm-knop klein" onClick={() => { const v = { ...st.vakken }; for (const x of af.scheef) if (v[x.s]) v[x.s] = { ...v[x.s], h: x.voorstel }; zet({ ...st, vakken: v }); }}>Rechtzetten</button>}
              </div>}
              <div className="fm-sb-kaart">
                <div className="fm-kop">Samenvatting</div>
                <div className="fm-sub">{af.lijst.length} vakken · {getal(af.lijst.reduce((a, v) => a + Mst.bx(v.i) * Mst.by(v.j), 0), 1)} m² · hoogste dek {getal(Math.max(0, ...af.lijst.map((v) => v.h)))} m · {af.doorgangen.length} {af.doorgangen.length === 1 ? 'doorgang' : 'doorgangen'}{K.leeg ? '' : ` · ${getal(mmTotaal, 2)} × ${getal(Mst.y(K.j1) - Mst.y(K.j0), 2)} m`}</div>
                {schrijven && af.lijst.length > 0 && <button type="button" className="fm-knop klein gevaar" onClick={() => { if (window.confirm('Alle vakken van dit deel weghalen?')) { setSel(null); zet({ ...st, vakken: {}, doeken: [], leuning: {}, hoeken: undefined }); } }}>Alles leeg</button>}
              </div>
            </div>
          )}
          {tabT === 'selectie' && sel?.soort === 'vak' && kv && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>{selKeys.length > 1 ? `${selKeys.length} vakken` : `${soortVan(kv.soort).kort} ${selKeys[0]}`}</strong><button className="fm-sluit" aria-label="Selectie wissen" title="Selectie wissen (Esc)" onClick={() => setSel(null)}>×</button></div>
              {selKeys.length > 1 && <div className="fm-sub">Een wijziging geldt voor alle gekozen vakken.</div>}
              <div className="fm-sb-kaart">
                <div className="fm-kop">Soort</div>
                <div className="fm-sb-chips">{SOORTEN.map((s) => <button key={s.k} type="button" disabled={!schrijven} className={`fm-knop klein${kv.soort === s.k ? ' zwart' : ''}`} title={s.naam} onClick={() => zetKies({ soort: s.k })}>{s.kort}</button>)}</div>
                {afwijking(kv) && <div className="fm-melding fout">{afwijking(kv)}</div>}
              </div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">Hoogte</div>
                {(kv.soort === 'helling' || kv.soort === 'trap') && <div className="fm-sb-rij">Van <input type="number" step="0.05" min="0" disabled={!schrijven} value={kv.laag ?? 0} onChange={(e) => { const l = opCm(e.target.value); zetKies((x) => (x.soort === 'helling' ? { laag: l, h: opCm(l + hellingStapVan(x)) } : { laag: l })); }} style={{ width: 64 }} /> m{kv.soort === 'helling' ? <span className="fm-sub">tot {getal(kv.h, 2)} m</span> : null}</div>}
                {kv.soort === 'helling' && <div className="fm-sb-rij">Helling <div className="fm-segment">{HELLINGEN.map((x) => <button key={x.stap} type="button" disabled={!schrijven} title={`${x.naam} · ${x.uitleg}`} className={Math.abs(Math.abs(kv.h - (kv.laag || 0)) - x.stap) < 0.02 ? 'aan' : ''} onClick={() => zetKies((y) => ({ h: opCm((Number(y.laag) || 0) + x.stap) }))}>{HELLING_NAAM[x.stap]} {x.naam}</button>)}</div></div>}
                {kv.soort !== 'helling' && <div className="fm-sb-rij">{kv.soort === 'trap' ? 'Tot' : kv.soort === 'toren' ? 'Hoogte' : 'Dek op'} <input type="number" step="0.05" min="0" disabled={!schrijven || !!trapModule(kv)} value={kv.h} onChange={(e) => zetKies({ h: opCm(e.target.value) })} style={{ width: 64 }} /> m{kv.soort !== 'trap' && <div className="fm-segment">{(kv.soort === 'toren' ? [2, 4, 6, 8, 10] : [0.5, 1, 1.5, 2, 3]).map((x) => <button key={x} type="button" disabled={!schrijven} className={Math.abs(Number(kv.h) - x) < 0.005 ? 'aan' : ''} onClick={() => zetKies({ h: x })}>{getal(x)}</button>)}</div>}</div>}
                {(kv.soort === 'helling' || kv.soort === 'trap' || kv.soort === 'trapblok') && <div className="fm-sb-rij">Oplopend <div className="fm-segment">{pijl.map((p, k) => <button key={k} type="button" disabled={!schrijven} className={(Number(kv.r) || 0) === k ? 'aan' : ''} title="Richting (R)" onClick={() => zetKies({ r: k })}>{p}</button>)}</div></div>}
                {kv.soort === 'toren' && <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={kv.ballast !== false} onChange={(e) => zetKies({ ballast: e.target.checked ? undefined : false })} />Ballast onderin (Stelconplaat)</label>}
                {kv.soort === 'toren' && (() => { const vl = Array.isArray(kv.vloeren) ? [...new Set(kv.vloeren.map((z) => vloerRozet(kv, z)))] : []; const echt = tussenVloeren(kv); const zetVl = (n) => zetKies({ vloeren: n.length ? n : undefined }); return (<>
                  <div className="fm-sb-rij">Vloeren {vl.map((z, q) => <span key={q} className="fm-sb-vloer"><select disabled={!schrijven} value={String(z)} onChange={(e) => zetVl(vl.map((x, y) => (y === q ? Number(e.target.value) : x)))}>{[...new Set([...vloerHoogtes(kv), Number(z)])].sort((a, b) => a - b).map((x) => <option key={x} value={String(x)} disabled={!vloerHoogtes(kv).includes(x)}>rozet {getal(x, 2)} m</option>)}</select><button type="button" aria-label="Vloer weghalen" disabled={!schrijven} onClick={() => zetVl(vl.filter((_, y) => y !== q))}>×</button></span>)}
                    <button type="button" className="fm-knop klein" disabled={!schrijven || !vloerHoogtes(kv).length} onClick={() => { const op = vloerHoogtes(kv).filter((x) => !vl.includes(x)); if (op.length) zetVl([...vl, op[Math.floor(op.length / 2)]]); }}>+ Vloer</button></div>
                  {vl.length > 0 && <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={kv.vloerLeuning !== false} onChange={(e) => zetKies({ vloerLeuning: e.target.checked ? undefined : false })} />Leuning rond de vloeren</label>}
                  {vl.length > 0 && echt.length !== vl.length && <div className="fm-melding">Een vloer ligt op liggers in de rozetten van de toren, minstens 0,3 m boven de grond en 1 m onder de top.</div>}
                  <div className="fm-sub">Toren zonder dek: liggers om de 2 m en schoren aan de buitenkant, tot de gekozen hoogte.{echt.length ? ` Liggers in de rozet op ${echt.map((z) => getal(z, 2)).join(', ')} m, loopvlak op ${echt.map((z) => getal(vloerLoop(kv, st, z), 2)).join(', ')} m.` : ''}</div>
                </>); })()}
                {kv.soort === 'helling' && <div className="fm-sub">Licht = 0,5 m per vak (13,6°), steil = 1 m per vak (25,8°). In het zijaanzicht sleep je de hoogte per rozet.</div>}
                {kv.soort === 'trap' && (<>
                  <div className="fm-segment">{[['renner', 'Renners (hout)'], ['voetganger', 'Voetgangers (metaal)']].map(([k, t]) => <button key={k} type="button" disabled={!schrijven} className={(kv.trap || 'renner') === k ? 'aan' : ''} onClick={() => zetKies((x) => (k === 'renner' ? { trap: undefined, module: undefined } : { trap: 'voetganger', module: x.module || '2.57x2.00', h: opCm((Number(x.laag) || 0) + (TRAPMODULES.find((m) => m.k === (x.module || '2.57x2.00'))?.s || 2)) }))}>{t}</button>)}</div>
                  {kv.trap === 'voetganger' && <label className="fm-veld">Trapmodule<select disabled={!schrijven} value={kv.module || '2.57x2.00'} onChange={(e) => { const m = TRAPMODULES.find((q) => q.k === e.target.value); zetKies((x) => ({ module: m.k, h: opCm((Number(x.laag) || 0) + m.s) })); }}>{TRAPMODULES.map((m) => <option key={m.k} value={m.k}>{m.naam}</option>)}</select></label>}
                </>)}
              </div>
              {kv.soort !== 'toren' && <div className="fm-sb-kaart">
                <div className="fm-kop">Doorgang eronder</div>
                <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={!!kv.doorgang} onChange={(e) => zetKies({ doorgang: e.target.checked || undefined, ...(e.target.checked ? {} : { vrij: undefined }) })} />Doorgang (geen liggers of kruisen in de loop)</label>
                {kv.doorgang && <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={!!kv.vrij} onChange={(e) => zetKies({ vrij: e.target.checked || undefined })} />Vrije overspanning (geen staanders)</label>}
                {kv.vrij && <div className="fm-sb-chips">{LIGGERS.map((x) => <button key={x.k} type="button" disabled={!schrijven} title={x.uitleg} className={`fm-knop klein${liggerSoort(kv.ligger || '') === x.k ? ' zwart' : ''}`} onClick={() => zetKies({ ligger: x.k })}>{x.naam}</button>)}</div>}
                {kv.doorgang && (() => { const d = af.dgVan(...uitSleutel(selKeys[0])); if (!d) return null; return (<>
                  <div className="fm-sub"><strong>Doorgang {getal(d.B, 2)} × {getal(d.H, 2)} m</strong> · vrije maten en functie bij Nakijken</div>
                  <div className="fm-sb-rij">Je gaat erdoor <div className="fm-segment" role="group" aria-label="Richting van de doorgang">{[['y', '↕ op en neer'], ['x', '↔ links-rechts']].map(([k, t]) => <button key={k} type="button" disabled={!schrijven} title={k === 'y' ? 'In het raster van boven naar onder (dwars op de kolommen)' : 'In het raster van links naar rechts (dwars op de rijen), bv. de andere arm van een hoekbrug'} className={(d.richt || 'y') === k ? 'aan' : ''} onClick={() => { const v = { ...st.vakken }; const zelfde = (x) => x.doorgang && (x.dgRicht || 'y') === (d.richt || 'y'); const sleutels = d.vakken.map((x) => x.s); for (const s2 of sleutels) if (v[s2] && zelfde(v[s2])) v[s2] = { ...v[s2], dgRicht: k === 'y' ? undefined : 'x' }; zet({ ...st, vakken: v }); }}>{t}</button>)}</div></div>
                  <label className="fm-veld">Waarvoor<select disabled={!schrijven} value={d.functie || ''} onChange={(e) => zetDoorgang(d, { vrijF: e.target.value || undefined })}><option value="">Niet ingevuld</option>{DOORGANG_FUNCTIES.map((f) => <option key={f.k} value={f.k}>{f.naam}</option>)}</select></label>
                  {d.fout ? <div className="fm-melding fout">{d.fout}</div> : null}
                </>); })()}
              </div>}
              {kv.soort === 'toren' && <div className="fm-sub">Een doek bovenop de toren: stap 2 Branding, zijde Boven.</div>}
              <div className="fm-sb-kaart">
                <div className="fm-kop">Maat van kolom en rij</div>
                {(() => { const [ki, kj] = uitSleutel(selKeys[0]); return [['x', ki, 'Kolom', Mst.bx(ki)], ['y', kj, 'Rij', Mst.by(kj)]].map(([as, idx, t, w]) => (
                  <div key={as} className="fm-sb-rij">{t} <input type="number" step="0.01" min="0.3" disabled={!schrijven} value={Math.round(w * 1000) / 1000} onChange={(e) => zetMaat(as, idx, Number(e.target.value))} style={{ width: 64 }} /> m
                    <div className="fm-segment">{[[VAK, '2,07'], [HALF, '1,04']].map(([m, l]) => <button key={l} type="button" disabled={!schrijven} className={Math.abs(w - m) < 0.001 ? 'aan' : ''} onClick={() => zetMaat(as, idx, m)}>{l}</button>)}</div>
                  </div>
                )); })()}
              </div>
              <details className="fm-sb-meer">
                <summary>Grond, platen, portaal</summary>
                <div className="fm-sb-kaart">
                  {st.grondPunten?.length ? <div className="fm-sub">De grond volgt de gemeten punten (stand Grond, toets G).</div> : <>
                  <div className="fm-sb-rij">Grond onder het vak <input type="number" step="0.05" min="0" disabled={!schrijven} value={kv.grond ?? 0} onChange={(e) => zetKies({ grond: Number(e.target.value) > 0 ? opCm(e.target.value) : undefined })} style={{ width: 64 }} /> m</div>
                  <div className="fm-sb-rij">Grond helt <input type="number" step="0.05" min="0" disabled={!schrijven} value={kv.grondS?.d ?? 0} onChange={(e) => zetKies({ grondS: Number(e.target.value) > 0 ? { d: Math.round(Number(e.target.value) * 100) / 100, r: kv.grondS?.r ?? 0 } : undefined })} style={{ width: 56 }} /> m <div className="fm-segment">{pijl.map((p, k) => <button key={k} type="button" disabled={!schrijven || !kv.grondS} className={(kv.grondS?.r ?? 0) === k ? 'aan' : ''} title="Richting waarin de grond stijgt" onClick={() => zetKies({ grondS: { d: kv.grondS?.d || 0.5, r: k } })}>{p}</button>)}</div></div>
                  </>}
                  <div className="fm-sb-rij">Platen <div className="fm-segment">{[{ k: '', naam: 'Standaard' }, ...PLATEN].map((p) => <button key={p.k} type="button" disabled={!schrijven} className={(kv.plaat || '') === p.k ? 'aan' : ''} onClick={() => zetKies({ plaat: p.k || undefined })}>{p.naam}</button>)}</div></div>
                  {isMetaal(kv, st) && kv.soort === 'vloer' && <div className="fm-sub">Stalen vloer: de delen hangen in de rozet op {getal(kv.h - DEK_ROZET, 2)} m, het loopvlak ligt op {getal(kv.h - DEK_ROZET + METAAL_OP, 2)} m.</div>}
                  {kv.soort !== 'toren' && <div className="fm-sb-rij">Portaal boven het dek <input type="number" step="0.1" min="0" disabled={!schrijven} value={kv.portaal ?? 0} onChange={(e) => zetKies({ portaal: Number(e.target.value) > 0 ? Math.round(Number(e.target.value) * 100) / 100 : undefined })} style={{ width: 56 }} /> m</div>}
                </div>
              </details>
              <label className="fm-vink"><input type="checkbox" checked={heleKolom} onChange={(e) => setHeleKolom(e.target.checked)} />Aanpassing geldt voor de hele kolom</label>
              {schrijven && <button type="button" className="fm-knop klein gevaar" onClick={() => { const v = { ...st.vakken }; for (const k of selKeys) delete v[k]; setSel(null); zet({ ...st, vakken: v }); }}>{selKeys.length > 1 ? 'Vakken weghalen' : 'Vak weghalen'} (Delete)</button>}
            </div>
          )}
          {tabT === 'selectie' && sel?.soort === 'rand' && (() => {
            const rs = selKeys.map((s2) => af.randen.find((x) => x.s === s2)).filter(Boolean); const r0 = rs[0];
            const nu = new Set(selKeys.map((s2) => { const hnd = st.leuning?.[s2]; return hnd == null ? 'auto' : hnd === false ? 'geen' : hnd; })); const een = nu.size === 1 ? [...nu][0] : null;
            const dks = new Set(selKeys.map((s2) => doekLijst.find((d) => (d.randen || []).includes(s2))?.id || '')); const dk = dks.size === 1 ? doekLijst.find((d) => d.id === [...dks][0]) : null;
            const naam = (x) => (!x.buiten && x.binnen ? 'Tussen twee vakken' : x.k === 3 ? 'Voorrand' : x.k === 1 ? 'Achterrand' : x.k === 2 ? 'Beginrand' : 'Eindrand');
            const aanloop = rs.some((x) => af.aanloop.some((a) => a.i === x.i && a.j === x.j && a.k === x.k));
            return (
              <div className="fm-sb-insp">
                <div className="fm-ws-rkop"><strong>{rs.length > 1 ? `${rs.length} randen` : r0 ? `${naam(r0)} · vak ${r0.i},${r0.j}` : 'Rand'}</strong><button className="fm-sluit" aria-label="Selectie wissen" title="Selectie wissen (Esc)" onClick={() => setSel(null)}>×</button></div>
                <div className="fm-sub">{een === 'auto' && r0 ? `Nu automatisch: ${r0.leuning ? LEUNINGEN.find((x) => x.k === r0.lsoort)?.naam : 'open'}${r0.schuin ? ' · schuine legger' : ''}` : een ? '' : 'Verschillende leuningen gekozen'}</div>
                <div className="fm-sb-chips">
                  <button type="button" className="fm-knop klein" onClick={() => { const ks = buitenRanden(); if (ks.length) kies({ soort: 'rand', keys: ks }); }}>Alle buitenranden</button>
                  <button type="button" className="fm-knop klein" onClick={() => { const ks = voorRanden(); if (ks.length) kies({ soort: 'rand', keys: ks }); }}>Voorrand</button>
                  {r0 && <button type="button" className="fm-knop klein" title="Alle randen aan dezelfde zijde die aansluiten" onClick={() => kies({ soort: 'rand', keys: zijdeVan(r0.s, 'leuning') })}>Hele zijde</button>}
                </div>
                <div className="fm-sb-kaart">
                  <div className="fm-kop">Leuning</div>
                  <div className="fm-sb-keus">{LEUNING_KEUZES.map((x) => <button key={x.k} type="button" disabled={!schrijven} className={een === x.k ? 'aan' : ''} title={x.uitleg} onClick={() => zetRand(x.k)}><LeuningIcoon k={x.k} /><span><b>{x.naam}</b><small>{x.uitleg}</small></span></button>)}</div>
                  <div className="fm-sub">Waar een hoge en een lage staander elkaar raken, komt er vanzelf een schuine legger. Kies een hoek om de staander hoog of laag te zetten.</div>
                </div>
                {(() => {
                  // Schoren horen bij de wand (de rand van het hoogste vak van de twee): alle gekozen randen daarheen.
                  const paren = randParen(af.randen); const hoofden = [...new Set(selKeys.map((k) => { const rr = af.randen.find((x) => x.s === k); return rr ? paren.get(paarSleutel(rr))?.hoofd.s : null; }).filter(Boolean))];
                  const nu = new Set(hoofden.map((k) => (Array.isArray(st.schoren?.[k]) ? 'zelf' : st.schoren?.[k] === false ? 'weg' : st.schoren?.[k] === true ? 'altijd' : st.schoren?.[k] === 'onder' ? 'onder' : 'auto'))); const een = nu.size === 1 ? [...nu][0] : null;
                  const zetS = (k) => { const m = { ...(st.schoren || {}) }; for (const h of hoofden) { if (k === 'auto') delete m[h]; else m[h] = k === 'altijd' ? true : k === 'onder' ? 'onder' : false; } zet({ ...st, schoren: Object.keys(m).length ? m : undefined }); };
                  // Horizontale liggers van de (eerste) wand: op welke rozetten ze hangen.
                  const rh = af.randen.find((x) => x.s === hoofden[0]); const wm = rh ? wandMaten(rh, af.grondOp) : null; const roz = wm ? wandRozetten(wm) : [];
                  const lig = rh && wm ? wandLiggers(st, rh, wm) : []; const vastVl = rh ? wandVloeren(st, rh) : []; const vastL = rh ? [...vastVl, ...wandVloerLeuning(st, rh)] : []; const eigen = hoofden.some((h) => Array.isArray(st.liggers?.[h]));
                  const zetL = (lijst) => { const m = { ...(st.liggers || {}) }; for (const h of hoofden) { if (lijst == null) delete m[h]; else m[h] = lijst; } zet({ ...st, liggers: Object.keys(m).length ? m : undefined }); };
                  return (
                    <div className="fm-sb-kaart">
                      <div className="fm-kop">Schoren in deze wand</div>
                      <div className="fm-segment">{[['auto', 'Automatisch'], ['weg', 'Weg'], ['onder', 'Onderste'], ['altijd', 'Altijd']].map(([k, t]) => <button key={k} type="button" disabled={!schrijven} className={een === k ? 'aan' : ''} onClick={() => zetS(k)}>{t}</button>)}</div>
                      <div className="fm-sub">Klik in 3D op een schoor of ligger om zijn wand te kiezen. Automatisch = aan de buitenkant en waar de wand hoger dan 1,2 m boven een lager vak uitkomt. Schoren lopen van ligger naar ligger.</div>
                      {roz.length > 0 && (<>
                        <div className="fm-kop" style={{ marginTop: 8 }}>Horizontale liggers{eigen ? '' : ' (automatisch)'}</div>
                        <div className="fm-sb-rij">{lig.map((z, q) => vastL.includes(z) ? <span key={q} className="fm-sb-vloer" title={vastVl.includes(z) ? 'Drager van de tussenvloer: blijft altijd' : 'Leuning van de tussenvloer (uit te zetten bij het torenvak)'}>{getal(z, 2)} m ({vastVl.includes(z) ? 'vloer' : 'leuning'})</span> : <span key={q} className="fm-sb-vloer"><select disabled={!schrijven} value={String(z)} onChange={(e) => zetL(lig.map((x, y) => (y === q ? Number(e.target.value) : x)).filter((x) => !vastL.includes(x)))}>{roz.map((x) => <option key={x} value={String(x)} disabled={x !== z && lig.includes(x)}>{getal(x, 2)} m</option>)}</select><button type="button" aria-label="Ligger weghalen" disabled={!schrijven} onClick={() => zetL(lig.filter((_, y) => y !== q && !vastL.includes(lig[y])))}>×</button></span>)}
                          <button type="button" className="fm-knop klein" disabled={!schrijven || roz.every((x) => lig.includes(x))} onClick={() => { const vrij = roz.filter((x) => !lig.includes(x)); zetL([...lig.filter((x) => !vastL.includes(x)), vrij[Math.floor(vrij.length / 2)]].sort((x, y) => x - y)); }}>+ Ligger</button>
                          {eigen && <button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => zetL(null)}>Automatisch</button>}</div>
                        <div className="fm-sub">Hoogte van de rozet boven de grond. De ligger onder het dek blijft altijd.</div>
                      </>)}
                    </div>
                  );
                })()}
                {doekLijst.some((d) => (d.randen || []).some((x) => selKeys.includes(x))) && <div className="fm-sub">Op deze rand hangt een doek: aanpassen in stap 2 Branding.</div>}
                {aanloop && <div className="fm-sb-kaart"><div className="fm-kop">Aanloop</div><div className="fm-sb-rij">Aanloopplaat <input type="number" step="0.05" min="0" disabled={!schrijven} value={st.aanloop ?? AANLOOP} onChange={(e) => zet({ ...st, aanloop: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 64 }} /> m <span className="fm-sub">(0 = geen)</span></div></div>}
              </div>
            );
          })()}
          {tabT === 'selectie' && sel?.soort === 'ligger' && (() => {
            const [rs, zs] = selKeys[0].split('|'); const z = Number(zs); const r = af.randen.find((x) => x.s === rs);
            const dekL = r ? Math.abs(Math.min(r.ha, r.hb) - DEK_ROZET - z) < 0.01 : false;
            const vast = dekL || (r ? [...wandVloeren(st, r), ...wandVloerLeuning(st, r)].includes(z) : false);
            return (
              <div className="fm-sb-insp">
                <div className="fm-ws-rkop"><strong>{selKeys.length > 1 ? `${selKeys.length} liggers` : `Ligger op ${getal(z, 2)} m`}</strong><button className="fm-sluit" aria-label="Selectie wissen" title="Selectie wissen (Esc)" onClick={() => setSel(null)}>×</button></div>
                <div className="fm-sub">{dekL ? 'Bovenste ligger: draagt het dek (of sluit de toren af). Hij gaat mee als je het vak hoger of lager sleept.' : vast ? 'Hoort bij de tussenvloer (drager of leuning): verplaats of haal de vloer weg.' : 'Sleep de ligger in 3D omhoog of omlaag: hij klikt vast op de rozetten. Delete = weghalen. Dubbelklik in een leeg wandvak = een ligger erbij.'}</div>
                <div className="fm-sb-chips">
                  {!vast && schrijven && <button type="button" className="fm-knop klein gevaar" onClick={onderdeelWeg}>Weghalen (Delete)</button>}
                  {r && <button type="button" className="fm-knop klein" onClick={() => setSel({ soort: 'rand', keys: [rs] })}>Hele wand</button>}
                </div>
              </div>
            );
          })()}
          {tabT === 'selectie' && sel?.soort === 'tvloer' && (() => {
            const [vk, zs] = selKeys[0].split('|'); const x = st.vakken?.[vk];
            return (
              <div className="fm-sb-insp">
                <div className="fm-ws-rkop"><strong>Tussenvloer op rozet {getal(Number(zs), 2)} m</strong><button className="fm-sluit" aria-label="Selectie wissen" title="Selectie wissen (Esc)" onClick={() => setSel(null)}>×</button></div>
                <div className="fm-sub">Loopvlak op {getal(x ? vloerLoop(x, st, Number(zs)) : Number(zs), 2)} m. Sleep de vloer in 3D omhoog of omlaag (per rozet). Delete = weghalen.</div>
                <div className="fm-sb-chips">
                  {schrijven && <button type="button" className="fm-knop klein gevaar" onClick={onderdeelWeg}>Weghalen (Delete)</button>}
                  <button type="button" className="fm-knop klein" onClick={() => setSel({ soort: 'vak', keys: [vk] })}>Torenvak</button>
                </div>
              </div>
            );
          })()}
          {tabT === 'selectie' && sel?.soort === 'schoor' && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>{selKeys.length === 1 ? 'Schoor' : `${selKeys.length} schoren`}</strong></div>
              {selKeys.length === 1 && (() => { const [rs, za, zb] = selKeys[0].split('|'); return <div className="fm-sub">Wand {rs} · van de rozet op {getal(Number(za), 2)} m naar die op {getal(Number(zb), 2)} m.</div>; })()}
              {schrijven && <div className="fm-sb-knoppen"><button type="button" className="fm-knop klein" onClick={schoorWeg}>Weghalen</button><button type="button" className="fm-knop klein" onClick={() => setSel({ soort: 'rand', keys: [selKeys[0].split('|')[0]] })}>Wand kiezen</button></div>}
              <div className="fm-sub">Delete = weghalen. Een schoor erbij: klik een rozet en Shift + klik een rozet op de staander ernaast.</div>
            </div>
          )}
          {tabT === 'selectie' && sel?.soort === 'hdiag' && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>Horizontale diagonaal</strong></div>
              <div className="fm-sub">Schuin over het vak op {getal(Number(selKeys[0].split('|')[2]), 2)} m. Delete = weghalen.</div>
              {schrijven && <div className="fm-sb-knoppen"><button type="button" className="fm-knop klein" onClick={() => { zet({ ...st, hdiag: (st.hdiag || []).filter(([p, q, z]) => !selKeys.includes(`${p}|${q}|${z}`)) }); setSel(null); }}>Weghalen</button></div>}
            </div>
          )}
          {tabT === 'selectie' && sel?.soort === 'rozet' && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>Rozet {selKeys.map((k) => `${getal(Number(k.split('|')[1]), 2)} m`).join(' · ')}</strong></div>
              <div className="fm-sub">Shift + klik een rozet op de staander ernaast: schuin = een schoor ertussen, even hoog = een ligger. Even hoog op de overstaande hoek van een vak = een horizontale diagonaal.</div>{selKeys.length === 2 && <div className="fm-melding">Deze twee rozetten kan ik niet verbinden: kies twee rozetten op staanders van hetzelfde vak (naast elkaar of schuin over het vak op dezelfde hoogte).</div>}
            </div>
          )}
          {tabT === 'selectie' && sel?.soort === 'staander' && (() => {
            const n = (af.alleKnopen || []).find((x) => `${x.i},${x.j}` === selKeys[0]); const zelf = st.staanders?.[selKeys[0]];
            return (
              <div className="fm-sb-insp">
                <div className="fm-ws-rkop"><strong>{n?.vrij ? 'Geen staander' : 'Staander'} op hoek {selKeys.join(' · ')}</strong></div>
                {n?.vrij ? <div className="fm-sub">{zelf === false ? 'Zelf weggehaald.' : 'Hier draagt de overspanning het dek.'}</div> : <div className="fm-sub">Van {getal(n?.g || 0, 2)} tot {getal(n?.top || 0, 2)} m{zelf === true ? ' · zelf toegevoegd' : ''}.</div>}
                {zelf === false && <div className="fm-melding">Zonder deze staander rust het dek op de liggers ernaast. Laat de stellingbouwer dat nakijken.</div>}
                {schrijven && <div className="fm-sb-knoppen">
                  {n?.vrij ? <button type="button" className="fm-knop klein" onClick={() => zetStaanders(true)}>Staander plaatsen</button> : <button type="button" className="fm-knop klein" onClick={() => zetStaanders(false)}>Staander weghalen</button>}
                  {zelf !== undefined && <button type="button" className="fm-knop klein" onClick={() => zetStaanders(undefined)}>Automatisch</button>}
                </div>}
                <div className="fm-sub">Delete = weghalen of terug automatisch.</div>
              </div>
            );
          })()}
          {tabT === 'selectie' && sel?.soort === 'eind' && (() => {
            const [vk, kant] = selKeys[0].split('|'); const x = st.vakken?.[vk];
            return (
              <div className="fm-sb-insp">
                <div className="fm-ws-rkop"><strong>{kant === 'hoog' ? 'Hoge' : 'Lage'} kant van de helling · {getal(Number(kant === 'hoog' ? x?.h : x?.laag) || 0, 2)} m</strong><button className="fm-sluit" aria-label="Selectie wissen" title="Selectie wissen (Esc)" onClick={() => setSel(null)}>×</button></div>
                <div className="fm-sub">Sleep het bolletje in 3D omhoog of omlaag (per 0,5 m).{x && afwijking(x) ? ` ${afwijking(x)}.` : ''}</div>
                <button type="button" className="fm-knop klein" onClick={() => setSel({ soort: 'vak', keys: [vk] })}>Hellingvak</button>
              </div>
            );
          })()}
          {tabT === 'selectie' && sel?.soort === 'hoek' && (() => {
            const nu = new Set(selKeys.map((s2) => st.hoeken?.[s2] || 'auto')); const een = nu.size === 1 ? [...nu][0] : null;
            return (
              <div className="fm-sb-insp">
                <div className="fm-ws-rkop"><strong>{selKeys.length > 1 ? `${selKeys.length} hoeken` : `Hoek ${selKeys[0]}`}</strong><button className="fm-sluit" aria-label="Selectie wissen" title="Selectie wissen (Esc)" onClick={() => setSel(null)}>×</button></div>
                <div className="fm-sub">Hoe hoog de staander boven het dek uitkomt. Verschillen de twee hoeken van één rand, dan wordt de bovenste buis een schuine legger.</div>
                <div className="fm-sb-keus">{[['auto', 'Automatisch', 'Volgt de leuning van de randen'], ['hoog', 'Hoog 1,30', 'Leuning tot 1,30 m boven het dek'], ['midden', 'Midden 0,80', 'Leuning tot 0,80 m (twee rozetten)'], ['laag', 'Laag 0,30', 'Vrij zicht, bv. vooraan voor de camera'], ['geen', 'Geen leuning', 'Geen staander boven het dek; de randen hier blijven open']].map(([k, n, u]) => <button key={k} type="button" disabled={!schrijven} className={een === k ? 'aan' : ''} onClick={() => zetHoek(k)}><HoekIcoon k={k} /><span><b>{n}</b><small>{u}</small></span></button>)}</div>
                <div className="fm-sub">Zo bouw je elke camerastelling-bovenkant: frame achteraan, laag vooraan, schuine legger opzij, of rondom hoog met een ladder.</div>
              </div>
            );
          })()}
          {tabT === 'selectie' && sel?.soort === 'camera' && camPlek && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>Camera op het dek</strong><button className="fm-sluit" aria-label="Selectie wissen" title="Selectie wissen (Esc)" onClick={() => setSel(null)}>×</button></div>
              <div className="fm-sub">Vak {camPlek.s} · dek op {getal(camPlek.h, 2)} m · camera op {getal(camPlek.h + CAMERA_OOG, 2)} m. Sleep de camera over het raster; de greep aan de kijkhoek draait ze.</div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">Camera</div>
                <label className="fm-veld">Type camera (lens)<input list="fm-sb-lenzen" disabled={!schrijven} value={tv.lens || ''} placeholder="bv. 86x" onChange={(e) => zetTv({ lens: e.target.value.trim() })} /></label>
                <datalist id="fm-sb-lenzen">{LENZEN.map((l) => <option key={l} value={l} />)}</datalist>
                <div className="fm-veld">Opstelling<div className="fm-segment" title="Nog eens klikken = niet ingevuld">{OPSTELLINGEN.map(([k, n]) => <button key={k} type="button" disabled={!schrijven} className={tv.opstelling === k ? 'aan' : ''} onClick={() => zetTv({ opstelling: tv.opstelling === k ? '' : k })}>{n}</button>)}</div></div>
              </div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">Kijkrichting</div>
                <div className="fm-sb-rij"><input type="number" step="5" disabled={!schrijven} aria-label="Kijkrichting in graden" value={camPlek.rot} onChange={(e) => zetCamera({ ...stAll.camera, rot: Number(e.target.value) || 0 })} style={{ width: 64 }} />° <div className="fm-segment">{[[0, '↑'], [90, '→'], [180, '↓'], [270, '←']].map(([g2, p2]) => <button key={g2} type="button" disabled={!schrijven} className={camPlek.rot === g2 ? 'aan' : ''} title={`${g2}°`} onClick={() => zetCamera({ ...stAll.camera, rot: g2 })}>{p2}</button>)}</div></div>
                <div className="fm-sb-chips"><button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => draaiCam(-15)}>⟲ 15°</button><button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => draaiCam(15)}>⟳ 15°</button></div>
                <div className="fm-sub">0° = naar de voorkant (boven op het raster), met de klok mee. R = 15° draaien.</div>
              </div>
              <div className="fm-sb-kaart">
                <div className="fm-kop">Plaats</div>
                <div className="fm-sb-chips"><button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => zetCamera({ ...stAll.camera, u: 0.5, v: 0.5 })}>Midden van het vak</button></div>
                <div className="fm-sub">Op de kaart en in de pop-up: {it.naam || el?.naam || 'Stelling'} · {tvCamTekst({ ...it, velden: { ...(it.velden || {}), stelling: stAll, tvcamera: tv } }, el)}</div>
              </div>
              {schrijven && <button type="button" className="fm-knop klein gevaar" onClick={camWeg}>Camera weghalen (Delete)</button>}
            </div>
          )}
          {tabT === 'branding' && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>Doeken</strong></div>
              <div className="fm-sub">Kies bovenaan de zijde waar je naar kijkt en sleep over de vakken: het doek hangt aan die kant. Klik een doek om het te kiezen; een ontwerp links gaat dan naar dat doek. Slepen vanaf het gekozen doek = herschalen. Delete = weghalen. Zijde Boven: klik een vak voor een doek bovenop.</div>
              {doekLijst.map((d, k) => {
                const n = d.soort === 'dak' ? (d.vakken || []).length : (d.randen || []).length;
                const o = d.voor ? doekMap.get(d.voor) : null;
                return (
                  <div key={d.id || k} className={`fm-sb-doekrij${selDoek === d.id ? ' aan' : ''}`} onClick={() => setSelDoek(d.id)} role="button" tabIndex={0}>
                    <span className="fm-sb-doekstaal" style={o?.eigenschappen?.beeld ? { backgroundImage: `url(${publiekeUrl(o.eigenschappen.beeld)})` } : { background: o ? o.eigenschappen?.kleur || '#0F766E' : '#FFFFFF' }} />
                    <span><b>{d.soort === 'dak' ? 'Dak' : 'Wand'} · {n} {n === 1 ? 'vak' : 'vakken'}</b><br /><span className="fm-sub">{o ? o.naam : 'Wit canvas'}{d.soort === 'vlak' ? ` · ${String(d.van).replace('.', ',')}–${String(d.tot).replace('.', ',')} m` : ''}</span></span>
                    {schrijven && <button type="button" className="fm-x" title="Doek weghalen" onClick={(e) => { e.stopPropagation(); zet({ ...st, doeken: doekLijst.filter((x) => x !== d) }); if (selDoek === d.id) setSelDoek(null); }}>×</button>}
                  </div>
                );
              })}
            </div>
          )}
          {tabT === 'doorgangen' && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>Doorgangen</strong></div>
              <div className="fm-sub">Vrije breedte × hoogte per doorgang (voor de brandweer en de hulpdiensten). Vul de maten van het plan van de stellingbouwer in; leeg = de maximale maat volgens de bouwer.</div>
              {af.doorgangen.map((d, n) => (
                <div key={`${d.richt}${d.i0}`} className={`fm-sb-kaart${d.fout ? ' fout' : ''}`}>
                  <div className="fm-sb-rij"><button type="button" className="fm-sb-dg-naam" title="Kies de vakken van deze doorgang" onClick={() => kies({ soort: 'vak', keys: d.vakken.map((x) => x.s) })}>Doorgang {n + 1}</button><span className="fm-sub">kolom {d.i0 + 1}{d.i1 > d.i0 ? `–${d.i1 + 1}` : ''} · {d.vrij ? 'vrije overspanning' : 'met staanders'}</span></div>
                  <div className="fm-sb-rij">Breedte <input type="number" step="0.01" min="0" disabled={!schrijven} aria-label="Vrije breedte" value={d.vakken.find((x) => x.vrijB)?.vrijB ?? ''} placeholder={getal(d.bMax, 2)} onChange={(e) => zetDoorgang(d, { vrijB: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} style={{ width: 64 }} /> m <span className="fm-sub">max. {getal(d.bMax, 2)}</span></div>
                  <div className="fm-sb-rij">Vrije hoogte <input type="number" step="0.01" min="0" disabled={!schrijven} aria-label="Vrije hoogte" value={d.vakken.find((x) => x.vrijH)?.vrijH ?? ''} placeholder={getal(d.H, 2)} onChange={(e) => zetDoorgang(d, { vrijH: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} style={{ width: 64 }} /> m <span className="fm-sub">max. {getal(d.hMax, 2)}</span></div>
                  <label className="fm-veld">Waarvoor<select disabled={!schrijven} value={d.functie || ''} onChange={(e) => zetDoorgang(d, { vrijF: e.target.value || undefined })}><option value="">Niet ingevuld</option>{DOORGANG_FUNCTIES.map((f) => <option key={f.k} value={f.k}>{f.naam}</option>)}</select></label>
                  {d.vrij && <div className="fm-sb-chips">{LIGGERS.map((x) => <button key={x.k} type="button" disabled={!schrijven} title={x.uitleg} className={`fm-knop klein${liggerSoort(d.vakken[0]?.ligger || '') === x.k ? ' zwart' : ''}`} onClick={() => zetDoorgang(d, { ligger: x.k })}>{x.naam}</button>)}</div>}
                  {d.fout ? <div className="fm-melding fout">{d.fout}</div> : <div className="fm-sub">Boven de vrije hoogte blijft de stelling staan{d.vrij ? '; een ligger overspant de doorgang' : ''}.</div>}
                </div>
              ))}
              {!af.doorgangen.length && <div className="fm-sub">Geen doorgangen in dit deel. Kies een vak en vink "Doorgang" aan, of teken een overspanning.</div>}
            </div>
          )}
          {tabT === 'stuklijst' && (
            <div className="fm-sb-insp">
              <div className="fm-ws-rkop"><strong>Stuklijst</strong></div>
              <table className="fm-tabel"><tbody>{telling.map((x) => <tr key={x.naam}><td>{x.naam}</td><td className="getal">{x.aantal}</td></tr>)}</tbody></table>
              {!telling.length && <div className="fm-sub">Nog leeg.</div>}
              <div className="fm-sub">Een schatting om mee te plannen, voor alle delen samen. De stellingbouwer maakt de berekening en het definitieve plan.</div>
            </div>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  );
}
