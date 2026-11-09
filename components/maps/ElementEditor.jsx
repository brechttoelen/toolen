'use client';

// Elementeditor: een bibliotheekelement gedetailleerd tekenen op een raster in
// meter (zoals een kleine CAD). Het resultaat wordt een "tekening" die op de
// kaart op ware grootte verschijnt en meedraait met het element.
import { metTekening } from './tekeningen';
import { bevestig, AppDialogen } from './dialoog';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './maps.css';
import { maps, foutTekst, wieBenIk, magBibliotheek } from './db';
import { Icoon } from './iconen';
import { KLEUREN } from './stijl';

const TOOLS = [
  ['selecteer', 'Selectie', 'selecteer', 'V'],
  ['rechthoek', 'Rechthoek', 'rechthoek', 'R'],
  ['vlak', 'Vorm (punten)', 'vlak', 'P'],
  ['lijn', 'Lijn', 'lijn', 'L'],
  ['cirkel', 'Cirkel', 'cirkel', 'C'],
  ['tekst', 'Tekst', 'tekst', 'T'],
  ['meten', 'Meten', 'meten', 'M'],
  ['trap', 'Trap', 'trap'],
];
const UITLEG = {
  selecteer: 'Klik een vorm · Shift-klik of Shift-slepen voor meer · Alt-slepen = kopie · pijltjes schuiven · sleep een leeg vlak om te schuiven · scroll om te zoomen',
  rechthoek: 'Sleep een rechthoek (Shift = vierkant) · maten pas je rechts exact aan',
  trap: 'Sleep de trap · looprichting en treden pas je rechts aan',
  cirkel: 'Sleep vanuit het midden',
  vlak: 'Klik de hoekpunten · typ een lengte + Enter voor een exact stuk · Shift = per 15° · klik het eerste punt om te sluiten',
  lijn: 'Klik de punten · typ een lengte + Enter · Shift = per 15° · klik het eerste punt om er een vorm van te maken · dubbelklik of Klaar om te stoppen',
  pijl: 'Klik de punten van de pijl · typ een lengte + Enter · Shift = per 15° · dubbelklik of Enter = klaar',
  tekst: 'Klik waar de tekst moet komen',
  meten: 'Klik punten om te meten · Shift = per 15° · dubbelklik, Enter of Esc om af te sluiten · opnieuw klikken = nieuwe meting',
};
const id = () => Math.random().toString(36).slice(2, 10);
const r3 = (v) => Math.round(v * 1000) / 1000;
const getal = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('nl-BE');
const naarGetal = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// ---------- Geometrie in meter (x rechts, y boven, draaiing met de klok mee) ----------
const draaiPunt = ([x, y], [cx, cy], graden) => {
  const r = (-graden * Math.PI) / 180; const c = Math.cos(r); const s = Math.sin(r);
  const dx = x - cx; const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};
const rechthoekPunten = (v) => {
  const { x, y, b, h, rot = 0 } = v;
  return [[x - b / 2, y - h / 2], [x + b / 2, y - h / 2], [x + b / 2, y + h / 2], [x - b / 2, y + h / 2]].map((p) => draaiPunt(p, [x, y], rot));
};
const cirkelPunten = (v, n = 48) => Array.from({ length: n }, (_, i) => [v.x + v.r * Math.cos((2 * Math.PI * i) / n), v.y + v.r * Math.sin((2 * Math.PI * i) / n)]);
function trapLijnen(v) {
  const { x, y, b, h, rot = 0 } = v;
  const richting = v.richting || 'x'; const trede = v.trede || 0.3;
  const langsX = richting === 'x' || richting === '-x';
  const lang = langsX ? b : h; const dwars = langsX ? h : b;
  const n = Math.min(200, Math.max(1, Math.floor(lang / trede)));
  const stap = lang / n;
  const pt = (a, c) => draaiPunt(langsX ? [x + a, y + c] : [x + c, y + a], [x, y], rot);
  const uit = [];
  for (let i = 1; i < n; i++) { const a = -lang / 2 + i * stap; uit.push([pt(a, -dwars / 2), pt(a, dwars / 2)]); }
  const t = richting.startsWith('-') ? -1 : 1;
  const a0 = -t * lang * 0.42; const a1 = t * lang * 0.42; const kop = Math.min(dwars * 0.25, lang * 0.12);
  uit.push([pt(a0, 0), pt(a1, 0)]);
  uit.push([pt(a1 - t * kop, kop * 0.6), pt(a1, 0), pt(a1 - t * kop, -kop * 0.6)]);
  return uit;
}
const middenVan = (v) => {
  if (v.soort === 'rechthoek' || v.soort === 'trap' || v.soort === 'cirkel' || v.soort === 'tekst') return [v.x, v.y];
  const xs = v.pts.map((p) => p[0]); const ys = v.pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};
// Bochten (zoals in Illustrator): stuk i tussen punt i en i+1 krom trekken.
// h = uitbuiging in meter op het midden, positief = links van de richting.
function boogL(a, b, h, n = 20) {
  if (!h) return [a, b];
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1;
  const cx = a[0] + dx / 2 + 2 * h * (-dy / L); const cy = a[1] + dy / 2 + 2 * h * (dx / L);
  const uit = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const u = 1 - t; uit.push([r3(u * u * a[0] + 2 * u * t * cx + t * t * b[0]), r3(u * u * a[1] + 2 * u * t * cy + t * t * b[1])]); }
  return uit;
}
const boogTopL = (a, b, h) => { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; return [a[0] + dx / 2 - (dy / L) * h, a[1] + dy / 2 + (dx / L) * h]; };
const boogHL = (a, b, p) => { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; return (dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / L; };
function gebogen(pts, bogen, dicht) {
  if (!bogen || !Object.keys(bogen).some((k) => Number(bogen[k]))) return pts;
  const n = dicht ? pts.length : pts.length - 1; const uit = [pts[0]];
  for (let k = 0; k < n; k++) uit.push(...boogL(pts[k], pts[(k + 1) % pts.length], Number(bogen[k]) || 0).slice(1));
  if (dicht) uit.pop();
  return uit;
}
// Bochten verschuiven als er een punt bij komt (na i) of weg gaat (punt j).
const bogenNaInvoegen = (b, i) => (b ? Object.fromEntries(Object.entries(b).filter(([k]) => Number(k) !== i).map(([k, h]) => [Number(k) > i ? Number(k) + 1 : Number(k), h])) : b);
const bogenNaWissen = (b, j) => (b ? Object.fromEntries(Object.entries(b).filter(([k]) => Number(k) !== j && Number(k) !== j - 1).map(([k, h]) => [Number(k) > j ? Number(k) - 1 : Number(k), h])) : b);
function puntenVan(v) {
  if (v.soort === 'rechthoek' || v.soort === 'trap') return rechthoekPunten(v);
  if (v.soort === 'cirkel') return cirkelPunten(v, 24);
  if (v.soort === 'tekst') return [[v.x, v.y]];
  return gebogen(v.pts, v.bogen, v.soort === 'vlak');
}
export function verschuif(v, dx, dy) {
  if (v.pts) return { ...v, pts: v.pts.map(([x, y]) => [r3(x + dx), r3(y + dy)]) };
  return { ...v, x: r3(v.x + dx), y: r3(v.y + dy) };
}
function draaiVorm(v, graden) {
  if (v.pts) { const m = middenVan(v); return { ...v, pts: v.pts.map((p) => draaiPunt(p, m, graden).map(r3)) }; }
  return { ...v, rot: (((v.rot || 0) + graden) % 360 + 360) % 360 };
}
// Zijden (lengte + richting, 0 = boven, 90 = rechts)
function zijdenVan(pts, dicht) {
  const n = dicht ? pts.length : pts.length - 1;
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    return { lengte: Math.hypot(dx, dy), richting: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360, sluit: dicht && i === n - 1 };
  });
}
// Vlak: een lengte wijzigen rekt de vorm op (alles voorbij het midden van die
// zijde schuift mee), zodat een L-vorm haaks blijft. Lijn: alles erna schuift mee.
function rek(pts, i, lengte) {
  const a = pts[i]; const b = pts[(i + 1) % pts.length];
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = Math.hypot(dx, dy);
  if (L < 1e-9) return pts;
  const ux = dx / L; const uy = dy / L; const delta = lengte - L;
  const mid = ((a[0] + b[0]) / 2) * ux + ((a[1] + b[1]) / 2) * uy;
  return pts.map((p) => (p[0] * ux + p[1] * uy > mid + 1e-9 ? [r3(p[0] + ux * delta), r3(p[1] + uy * delta)] : p));
}
function zetZijde(pts, i, { lengte, richting }, dicht = false) {
  if (dicht && lengte != null && richting == null) return rek(pts, i, lengte);
  if (i + 1 >= pts.length) return pts;
  const a = pts[i]; const b = pts[i + 1];
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const oudR = Math.atan2(dx, dy); const R = richting != null ? (richting * Math.PI) / 180 : oudR;
  const L = lengte != null ? lengte : Math.hypot(dx, dy);
  const delta = ((R - oudR) * 180) / Math.PI;
  const nb = [a[0] + L * Math.sin(R), a[1] + L * Math.cos(R)];
  const bRot = draaiPunt(b, a, delta);
  const sx = nb[0] - bRot[0]; const sy = nb[1] - bRot[1];
  return pts.map((p, j) => { if (j <= i) return p; const q = draaiPunt(p, a, delta); return [r3(q[0] + sx), r3(q[1] + sy)]; });
}

// ---------- Tekening (opslag) ↔ vormen (bewerkbaar) ----------
// Punten van een vorm (cirkel als veelhoek, bogen uitgerekend), in meter.
export const vormPunten = (v) => (v.soort === 'cirkel' ? cirkelPunten(v) : puntenVan(v));

export function vormenNaarTekening(vormen) {
  const vlakken = []; const lijnen = []; const teksten = [];
  for (const v of vormen) {
    const lijn = v.lijn || null; const vul = v.vul || null; const d = v.d ?? 0.04;
    const s = v.streep && v.streep !== 'vol' ? { s: v.streep } : {};
    if (v.soort === 'lijn') { if (v.pts.length > 1) lijnen.push({ c: puntenVan(v), k: lijn || '#1d1d1b', d, ...s }); continue; }
    if (v.soort === 'tekst') { teksten.push({ p: [v.x, v.y], t: v.tekst || '', h: v.h || 0.5, rot: v.rot || 0, k: v.kleur || '#1d1d1b', ...(v.cursief ? { i: true } : {}), ...(v.vet === false ? { b: false } : {}) }); continue; }
    const pts = v.soort === 'cirkel' ? cirkelPunten(v) : puntenVan(v);
    if (pts.length >= 3) vlakken.push({ r: [[...pts, pts[0]]], vul, lijn, d, ...s });
    if (v.soort === 'trap') for (const c of trapLijnen(v)) lijnen.push({ c, k: lijn || '#1d1d1b', d: Math.max(0.01, d * 0.5) });
  }
  // Rond het midden zetten en maten bepalen.
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const meet = ([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  vlakken.forEach((v) => v.r[0].forEach(meet)); lijnen.forEach((l) => l.c.forEach(meet));
  if (!Number.isFinite(x0)) teksten.forEach((t) => meet(t.p));
  if (!Number.isFinite(x0)) return null;
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const f = ([x, y]) => [r3(x - cx), r3(y - cy)];
  return {
    tekening: {
      b: r3(Math.max(x1 - x0, 0.01)), h: r3(Math.max(y1 - y0, 0.01)),
      vlakken: vlakken.map((v) => ({ ...v, r: v.r.map((r) => r.map(f)) })),
      lijnen: lijnen.map((l) => ({ ...l, c: l.c.map(f) })),
      teksten: teksten.map((t) => ({ ...t, p: f(t.p) })),
    },
    verschuiving: [cx, cy],
  };
}
function tekeningNaarVormen(t) {
  const uit = [];
  for (const v of t?.vlakken || []) uit.push({ id: id(), soort: 'vlak', pts: v.r[0].slice(0, -1), vul: v.vul, lijn: v.lijn, d: v.d || 0.04, streep: v.s });
  for (const l of t?.lijnen || []) uit.push({ id: id(), soort: 'lijn', pts: l.c, lijn: l.k, d: l.d || 0.02, streep: l.s });
  for (const x of t?.teksten || []) uit.push({ id: id(), soort: 'tekst', x: x.p[0], y: x.p[1], tekst: x.t, h: x.h, rot: x.rot || 0, kleur: x.k, cursief: !!x.i, vet: x.b !== false });
  return uit;
}

// ---------- Bewerkingen op vormen ----------
const kaderVan = (lijst) => {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const v of lijst) {
    const pts = v.soort === 'cirkel' ? [[v.x - v.r, v.y - v.r], [v.x + v.r, v.y + v.r]] : puntenVan(v);
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
};
function draaiRond(v, graden, c) {
  const m = middenVan(v); const n = draaiVorm(v, graden); const m2 = draaiPunt(m, c, graden);
  return verschuif(n, m2[0] - m[0], m2[1] - m[1]);
}
// Spiegelen rond een verticale (as 'x': links ↔ rechts) of horizontale as.
function spiegel(v, as, c) {
  const f = ([x, y]) => (as === 'x' ? [r3(2 * c[0] - x), y] : [x, r3(2 * c[1] - y)]);
  if (v.pts) return { ...v, pts: v.pts.map(f), ...(v.bogen ? { bogen: Object.fromEntries(Object.entries(v.bogen).map(([k, h]) => [k, -h])) } : {}) };
  const [x, y] = f([v.x, v.y]);
  const n = { ...v, x, y };
  if (v.soort === 'rechthoek' || v.soort === 'trap' || v.soort === 'tekst') n.rot = (360 - (v.rot || 0)) % 360;
  if (v.soort === 'trap') { const r = v.richting || 'x'; n.richting = as === 'x' ? ({ x: '-x', '-x': 'x' }[r] || r) : ({ y: '-y', '-y': 'y' }[r] || r); }
  return n;
}
// Losse lijnen die op elkaar aansluiten samenvoegen tot één lijn, of tot een vorm als ze rondgaan.
function voegLijnenSamen(lijnen, tol = 0.02) {
  const gelijk = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
  const rest = lijnen.map((l) => [...l.pts]);
  let ketting = rest.shift();
  let gevonden = true;
  while (rest.length && gevonden) {
    gevonden = false;
    for (let i = 0; i < rest.length; i++) {
      const r = rest[i]; const kop = ketting[0]; const staart = ketting[ketting.length - 1];
      if (gelijk(staart, r[0])) ketting = [...ketting, ...r.slice(1)];
      else if (gelijk(staart, r[r.length - 1])) ketting = [...ketting, ...[...r].reverse().slice(1)];
      else if (gelijk(kop, r[r.length - 1])) ketting = [...r.slice(0, -1), ...ketting];
      else if (gelijk(kop, r[0])) ketting = [...[...r].reverse().slice(0, -1), ...ketting];
      else continue;
      rest.splice(i, 1); gevonden = true; break;
    }
  }
  if (rest.length) return null;
  const dicht = ketting.length >= 4 && gelijk(ketting[0], ketting[ketting.length - 1]);
  return { pts: dicht ? ketting.slice(0, -1) : ketting, dicht };
}
const STREEP_SVG = (naam, w) => ({ streep: `${w * 4} ${w * 2.5}`, stip: `0.1 ${w * 2.2}`, streeppunt: `${w * 5} ${w * 2} ${w * 0.5} ${w * 2}` }[naam] || undefined);
const KLEMBORD = 'fm-ee-klembord';

// ---------- Component ----------
// De tekenaar zelf (raster in meter, vangen, maten typen, hoekpunten, bogen, …), herbruikbaar:
// de elementeditor van de bibliotheek en het tekenen in een binnenplan gebruiken dezelfde.
//   begin       vormen om mee te starten
//   onWijzig    (vormen, { bezig }) bij elke wijziging; de ouder bewaart
//   onBewaar    Ctrl S
//   kop/rechts  inhoud links en rechts in de bovenbalk
//   achtergrond ({ W, z, pad }) → SVG onder de tekening (niet aanklikbaar), bv. een grondplan
//   vangExtra   extra vangpunten [[x, y], …] in meter
export function Tekenaar({ beginTool = 'selecteer', begin = [], schrijven = true, onWijzig, onBewaar, kop = null, rechts = null, achtergrond = null, vangExtra = null, beginZicht = null, lijnStuk = false, fout: foutBuiten = '', onFoutWeg, standaardVul = '#ffffff', standaardLijn = '#1d1d1b', ingebed = false, beginSel = null, pijlen = false }) {
  const [vormen, setVormen] = useState(begin);
  const [sel, setSel] = useState(beginSel || []);
  const [tool, setTool] = useState(beginTool);
  const tools = pijlen ? TOOLS.flatMap((t) => (t[0] === 'lijn' ? [t, ['pijl', 'Pijl', 'lijn', 'A']] : t[0] === 'trap' ? [] : [t])) : TOOLS;
  const [zicht, setZicht] = useState(beginZicht || { cx: 0, cy: 0, z: 60 }); // z = pixels per meter
  const [maat, setMaat] = useState({ w: 800, h: 600 });
  const [bezig, setBezig] = useState(null); // tekenen of slepen
  const [raster, setRaster] = useState(0.1);
  const [muis, setMuis] = useState(null);
  const [vangPunt, setVangPunt] = useState(null);
  const [getypt, setGetypt] = useState('');
  const [meting, setMeting] = useState(null); // { pts, af }
  const [melding, setMelding] = useState('');
  const [gewijzigd, setGewijzigd] = useState(false);
  const fout = foutBuiten;
  const setFout = () => onFoutWeg?.();
  const svgRef = useRef(null);
  const hist = useRef({ terug: [], vooruit: [] });
  const vormenRef = useRef(vormen); vormenRef.current = vormen;
  const muisRuw = useRef(null);
  const laatsteKlik = useRef(null);
  const bewaar = () => onBewaar?.();
  useEffect(() => { if (gewijzigd) onWijzig?.(vormen, { bezig: !!bezig && bezig.soort !== 'punten' && bezig.soort !== 'pan' }); }, [vormen, bezig, gewijzigd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grootte van het tekenvlak
  useEffect(() => {
    const s = svgRef.current?.parentElement;
    if (!s) return;
    const ro = new ResizeObserver(() => setMaat({ w: s.clientWidth, h: s.clientHeight }));
    ro.observe(s);
    return () => ro.disconnect();
  }, []);

  const W = (x, y) => [(x - zicht.cx) * zicht.z + maat.w / 2, maat.h / 2 - (y - zicht.cy) * zicht.z];
  const vanScherm = (sx, sy) => [(sx - maat.w / 2) / zicht.z + zicht.cx, (maat.h / 2 - sy) / zicht.z + zicht.cy];
  const snap = (p) => (raster > 0 ? p.map((v) => r3(Math.round(v / raster) * raster)) : p.map(r3));
  const puntUit = (e) => { const r = svgRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // Vangen: hoekpunten en middens van zijden van andere vormen gaan voor het raster.
  const vangDoelen = (uitsluit, extra = []) => {
    const uit = [...extra, ...(vangExtra || [])];
    for (const x of vormenRef.current) {
      if (uitsluit?.has(x.id) || x.soort === 'tekst') continue;
      if (x.soort === 'cirkel') { uit.push([x.x, x.y]); continue; }
      const pts = puntenVan(x); const dicht = x.soort !== 'lijn';
      uit.push(...pts);
      for (let i = 0; i < pts.length - (dicht ? 0 : 1); i++) { const a = pts[i]; const b = pts[(i + 1) % pts.length]; uit.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
    }
    return uit;
  };
  const vang = (w, uitsluit, extra = []) => {
    const tol = 9 / zicht.z; let best = null;
    for (const q of vangDoelen(uitsluit, extra)) { const d = Math.hypot(q[0] - w[0], q[1] - w[1]); if (d < tol && (!best || d < best.d)) best = { d, q }; }
    return best ? { p: best.q.map(r3), vast: true } : { p: snap(w), vast: false };
  };
  // Shift: per 15° vanaf het vorige punt.
  const hoekVast = (ref, w) => {
    let d = Math.hypot(w[0] - ref[0], w[1] - ref[1]);
    if (raster > 0) d = Math.round(d / raster) * raster;
    const a = Math.round(Math.atan2(w[1] - ref[1], w[0] - ref[0]) / (Math.PI / 12)) * (Math.PI / 12);
    return [r3(ref[0] + d * Math.cos(a)), r3(ref[1] + d * Math.sin(a))];
  };

  const zet = useCallback((nieuw, { geschiedenis = true } = {}) => {
    if (geschiedenis) { hist.current.terug.push(vormenRef.current); hist.current.vooruit = []; if (hist.current.terug.length > 200) hist.current.terug.shift(); }
    setVormen(nieuw); setGewijzigd(true);
  }, []);
  const ongedaan = (opnieuw) => {
    const h = hist.current;
    const van = opnieuw ? h.vooruit : h.terug; const naar = opnieuw ? h.terug : h.vooruit;
    if (!van.length) return;
    naar.push(vormenRef.current); setVormen(van.pop()); setGewijzigd(true);
  };
  const wijzig = (vid, patch) => zet(vormen.map((v) => (v.id === vid ? { ...v, ...patch } : v)));
  const gekozenVormen = vormen.filter((x) => sel.includes(x.id));
  const v = sel.length === 1 ? gekozenVormen[0] || null : null;

  // Acties op de selectie (één of meer vormen)
  const selKader = kaderVan(gekozenVormen);
  const selMidden = selKader ? [(selKader[0] + selKader[2]) / 2, (selKader[1] + selKader[3]) / 2] : [0, 0];
  const opSel = (f) => zet(vormen.map((x) => (sel.includes(x.id) ? f(x) : x)));
  const acties = {
    dupliceer: () => { const st = raster || 0.5; const n = gekozenVormen.map((x) => ({ ...verschuif(x, st, -st), id: id() })); zet([...vormen, ...n]); setSel(n.map((x) => x.id)); },
    verwijder: () => { zet(vormen.filter((x) => !sel.includes(x.id))); setSel([]); },
    voor: () => zet([...vormen.filter((x) => !sel.includes(x.id)), ...gekozenVormen]),
    achter: () => zet([...gekozenVormen, ...vormen.filter((x) => !sel.includes(x.id))]),
    draai: (g) => opSel((x) => (sel.length > 1 ? draaiRond(x, g, selMidden) : draaiVorm(x, g))),
    spiegel: (as) => opSel((x) => spiegel(x, as, selMidden)),
    stijl: (patch) => opSel((x) => (x.soort === 'tekst' ? (patch.lijn !== undefined ? { ...x, kleur: patch.lijn || x.kleur } : x) : { ...x, ...patch, ...(x.soort === 'lijn' ? { vul: undefined } : {}) })),
    samenvoegen: () => {
      const r = voegLijnenSamen(gekozenVormen);
      if (!r) { setMelding('Deze lijnen sluiten niet op elkaar aan. Laat de uiteinden op elkaar vallen (ze vangen vanzelf).'); return; }
      const eerste = gekozenVormen[0];
      const n = r.dicht ? { id: id(), soort: 'vlak', pts: r.pts, vul: null, lijn: eerste.lijn || '#1d1d1b', d: eerste.d, streep: eerste.streep } : { ...eerste, id: id(), pts: r.pts };
      zet([...vormen.filter((x) => !sel.includes(x.id)), n]); setSel([n.id]);
      setMelding(r.dicht ? 'Samengevoegd tot een gesloten vorm: kies rechts een vulling.' : 'Samengevoegd tot één lijn.');
    },
  };
  const verwijderHoekpunt = (i) => {
    if (!v?.pts) return;
    if (v.pts.length <= (v.soort === 'vlak' ? 3 : 2)) return;
    wijzig(v.id, { pts: v.pts.filter((_, j) => j !== i), bogen: bogenNaWissen(v.bogen, i) });
  };

  // ---------- Muis ----------
  const omlaag = (e) => {
    if (e.button === 1 || e.button === 2) { setBezig({ soort: 'pan', start: puntUit(e), zicht }); return; }
    const s = puntUit(e); const w = vanScherm(...s);
    // Dubbelklik zelf herkennen: bij pointer-events is e.detail altijd 0.
    const nu = Date.now(); const vk = laatsteKlik.current;
    const dubbel = !!vk && nu - vk.t < 380 && Math.hypot(vk.s[0] - s[0], vk.s[1] - s[1]) < 6;
    laatsteKlik.current = dubbel ? null : { t: nu, s };
    const doel = e.target.closest?.('[data-id], [data-v], [data-m], [data-g]');
    svgRef.current.setPointerCapture?.(e.pointerId);
    if (tool === 'selecteer') {
      if (doel?.dataset.g && v) {
        const [gx, gy] = doel.dataset.g.split(',').map(Number);
        setBezig({ soort: 'maat', vid: v.id, gx, gy, v0: v, orig: vormen });
        return;
      }
      if (doel?.dataset.m != null && v?.pts) {
        const i = Number(doel.dataset.m); const a = v.pts[i]; const b = v.pts[(i + 1) % v.pts.length];
        if (e.altKey) { const bg = { ...(v.bogen || {}) }; delete bg[i]; wijzig(v.id, { bogen: bg }); return; }
        if (dubbel) {
          // Dubbelklik: een extra punt op het midden van dit stuk.
          const pts = [...v.pts.slice(0, i + 1), boogTopL(a, b, Number(v.bogen?.[i]) || 0).map(r3), ...v.pts.slice(i + 1)];
          zet(vormen.map((x) => (x.id === v.id ? { ...x, pts, bogen: bogenNaInvoegen(x.bogen, i) } : x)));
          return;
        }
        // Slepen: dit stuk buigen.
        setBezig({ soort: 'bocht', vid: v.id, i, orig: vormen });
        return;
      }
      if (doel?.dataset.v != null && v) {
        if (dubbel) { verwijderHoekpunt(Number(doel.dataset.v)); return; }
        setBezig({ soort: 'hoekpunt', vid: v.id, i: Number(doel.dataset.v), orig: vormen }); return;
      }
      if (doel?.dataset.id) {
        const did = doel.dataset.id;
        if (e.shiftKey) { setSel((s0) => (s0.includes(did) ? s0.filter((x) => x !== did) : [...s0, did])); return; }
        const ids = sel.includes(did) ? sel : [did];
        if (!sel.includes(did)) setSel([did]);
        setBezig({ soort: 'verplaats', ids, start: w, orig: vormen, kopie: e.altKey });
        return;
      }
      if (e.shiftKey) { setBezig({ soort: 'kader', start: s, nu: s, extra: sel }); return; }
      setSel([]);
      setBezig({ soort: 'pan', start: s, zicht });
      return;
    }
    const lopend = bezig?.soort === 'punten' ? bezig.pts : [];
    let p = vang(w, null, lopend).p;
    if (e.shiftKey && lopend.length) p = hoekVast(lopend[lopend.length - 1], w);
    if (tool === 'meten') {
      const mp = vang(w, null, meting && !meting.af ? meting.pts : []).p;
      const q = e.shiftKey && meting && !meting.af && meting.pts.length ? hoekVast(meting.pts[meting.pts.length - 1], w) : mp;
      if (!meting || meting.af) { setMeting({ pts: [q], af: false }); return; }
      if (dubbel) { setMeting({ ...meting, af: true }); return; }
      setMeting({ ...meting, pts: [...meting.pts, q] });
      return;
    }
    if (['rechthoek', 'trap', 'cirkel'].includes(tool)) { setBezig({ soort: 'sleep-nieuw', start: p, nu: p }); return; }
    if (tool === 'tekst') {
      const n = { id: id(), soort: 'tekst', x: p[0], y: p[1], tekst: 'Tekst', h: 0.5, rot: 0, kleur: '#1d1d1b' };
      zet([...vormen, n]); setSel([n.id]); setTool('selecteer');
      setTimeout(() => document.querySelector('.fm-ee-tekst input')?.select(), 50);
      return;
    }
    if (tool === 'vlak' || tool === 'lijn' || tool === 'pijl') {
      // Klik op het eerste punt sluit de vorm (ook bij een lijn: die wordt dan een vorm).
      if (lopend.length >= 3) {
        const [fx, fy] = W(...lopend[0]);
        if (Math.hypot(fx - s[0], fy - s[1]) < 10) { rondAf(lopend, true); return; }
      }
      if (dubbel && lopend.length >= 2) { rondAf(lopend); return; }
      setBezig({ soort: 'punten', pts: [...lopend, p] }); setGetypt('');
    }
  };
  const rondAf = (pts, dicht = false) => {
    const schoon = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
    const vlak = tool === 'vlak' || dicht;
    if ((vlak && schoon.length >= 3) || (!vlak && schoon.length >= 2)) {
      const n = vlak
        ? { id: id(), soort: 'vlak', pts: schoon, vul: tool === 'vlak' ? standaardVul : null, lijn: standaardLijn, d: tool === 'vlak' ? 0.05 : 0.03 }
        : { id: id(), soort: 'lijn', pts: schoon, lijn: standaardLijn, d: 0.03, ...(tool === 'pijl' ? { pijl: 'eind', d: 0.045 } : {}) };
      zet([...vormen, n]); setSel([n.id]);
    }
    setBezig(null); setTool('selecteer'); setGetypt('');
  };
  const beweeg = (e) => {
    const s = puntUit(e); const w = vanScherm(...s);
    muisRuw.current = { w, shift: e.shiftKey };
    let p; let vast = false;
    if (bezig?.soort === 'punten' && e.shiftKey && bezig.pts.length) p = hoekVast(bezig.pts[bezig.pts.length - 1], w);
    else if (bezig?.soort === 'hoekpunt') {
      const x = vormen.find((q) => q.id === bezig.vid);
      const andere = (x?.pts || []).filter((_, j) => j !== bezig.i);
      const vorige = x?.pts?.[bezig.i - 1] || x?.pts?.[x.pts.length - 1];
      if (e.shiftKey && vorige) p = hoekVast(vorige, w); else ({ p, vast } = vang(w, new Set([bezig.vid]), andere));
    } else if (bezig?.soort === 'maat') ({ p, vast } = vang(w, new Set([bezig.vid])));
    else if (bezig?.soort !== 'verplaats' && bezig?.soort !== 'pan' && bezig?.soort !== 'kader') ({ p, vast } = vang(w, null, bezig?.soort === 'punten' ? bezig.pts : []));
    else p = snap(w);
    setMuis(p); setVangPunt(vast ? p : null);
    if (!bezig) return;
    if (bezig.soort === 'pan') {
      const z = bezig.zicht;
      setZicht({ ...z, cx: z.cx - (s[0] - bezig.start[0]) / z.z, cy: z.cy + (s[1] - bezig.start[1]) / z.z });
    } else if (bezig.soort === 'kader') {
      setBezig({ ...bezig, nu: s });
    } else if (bezig.soort === 'verplaats') {
      let dx = w[0] - bezig.start[0]; let dy = w[1] - bezig.start[1];
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      // Een hoekpunt van wat je sleept vangt op een hoekpunt van iets anders; anders op het raster.
      const ids = new Set(bezig.ids);
      const doelen = vangDoelen(ids);
      const tol = 9 / zicht.z; let best = null;
      for (const x of bezig.orig) {
        if (!ids.has(x.id) || x.soort === 'tekst') continue;
        for (const q of x.soort === 'cirkel' ? [[x.x, x.y]] : puntenVan(x)) {
          const m = [q[0] + dx, q[1] + dy];
          for (const t of doelen) { const d = Math.hypot(t[0] - m[0], t[1] - m[1]); if (d < tol && (!best || d < best.d)) best = { d, s: [t[0] - m[0], t[1] - m[1]], t }; }
        }
      }
      if (best) { dx += best.s[0]; dy += best.s[1]; setVangPunt(best.t); }
      else if (raster > 0) { dx = Math.round(dx / raster) * raster; dy = Math.round(dy / raster) * raster; }
      setVormen(bezig.orig.map((x) => (ids.has(x.id) ? verschuif(x, dx, dy) : x)));
      setBezig({ ...bezig, d: [dx, dy], kopie: bezig.kopie || e.altKey });
    } else if (bezig.soort === 'bocht') {
      const x0 = bezig.orig.find((q) => q.id === bezig.vid);
      const a = x0.pts[bezig.i]; const b = x0.pts[(bezig.i + 1) % x0.pts.length];
      let h = boogHL(a, b, w);
      if (Math.abs(h) * zicht.z < 6) h = 0;
      if (raster > 0 && !e.altKey) h = Math.round(h / raster) * raster;
      setVormen(bezig.orig.map((x) => { if (x.id !== bezig.vid) return x; const bg = { ...(x.bogen || {}) }; if (h) bg[bezig.i] = r3(h); else delete bg[bezig.i]; return { ...x, bogen: bg }; }));
    } else if (bezig.soort === 'maat') {
      const v0 = bezig.v0; const { gx, gy } = bezig;
      if (v0.soort === 'cirkel') {
        const r = Math.max(0.05, r3(Math.hypot(p[0] - v0.x, p[1] - v0.y)));
        setVormen(bezig.orig.map((x) => (x.id === v0.id ? { ...x, r } : x)));
      } else {
        // Muis in het eigen assenstelsel van de rechthoek.
        const [lx, ly] = draaiPunt(p, [v0.x, v0.y], -(v0.rot || 0)).map((q, i) => q - (i ? v0.y : v0.x));
        let b = v0.b; let h = v0.h; let cx = 0; let cy = 0;
        const rond = (q) => Math.max(0.02, r3(q));
        if (e.altKey) { if (gx) b = rond(2 * Math.abs(lx)); if (gy) h = rond(2 * Math.abs(ly)); }
        else {
          if (gx) { const vast = (-gx * v0.b) / 2; b = rond(Math.abs(lx - vast)); cx = vast + (gx * b) / 2; }
          if (gy) { const vast = (-gy * v0.h) / 2; h = rond(Math.abs(ly - vast)); cy = vast + (gy * h) / 2; }
        }
        if (e.shiftKey && gx && gy) {
          const f = Math.max(b / v0.b, h / v0.h); b = rond(v0.b * f); h = rond(v0.h * f);
          if (!e.altKey) { cx = (-gx * v0.b) / 2 + (gx * b) / 2; cy = (-gy * v0.h) / 2 + (gy * h) / 2; }
        }
        const [nx, ny] = draaiPunt([v0.x + cx, v0.y + cy], [v0.x, v0.y], v0.rot || 0);
        setVormen(bezig.orig.map((x) => (x.id === v0.id ? { ...x, b, h, x: r3(nx), y: r3(ny) } : x)));
      }
    } else if (bezig.soort === 'hoekpunt') {
      setVormen((l) => l.map((x) => (x.id === bezig.vid ? { ...x, pts: x.pts.map((q, i) => (i === bezig.i ? p : q)) } : x)));
    } else if (bezig.soort === 'sleep-nieuw') {
      let nu = p;
      if (e.shiftKey && tool !== 'cirkel') { const [ax, ay] = bezig.start; const z = Math.max(Math.abs(p[0] - ax), Math.abs(p[1] - ay)); nu = [ax + Math.sign(p[0] - ax || 1) * z, ay + Math.sign(p[1] - ay || 1) * z]; }
      setBezig({ ...bezig, nu });
    }
  };
  const omhoog = () => {
    if (!bezig) return;
    if (bezig.soort === 'verplaats') {
      const bewogen = bezig.d && (bezig.d[0] || bezig.d[1]);
      if (bewogen && bezig.kopie) {
        // Alt + slepen: kopie op de nieuwe plek, het origineel blijft staan.
        const ids = new Set(bezig.ids);
        const kopie = bezig.orig.filter((x) => ids.has(x.id)).map((x) => ({ ...verschuif(x, bezig.d[0], bezig.d[1]), id: id() }));
        hist.current.terug.push(bezig.orig); hist.current.vooruit = [];
        setVormen([...bezig.orig, ...kopie]); setSel(kopie.map((x) => x.id)); setGewijzigd(true);
      } else if (bewogen) { hist.current.terug.push(bezig.orig); hist.current.vooruit = []; setGewijzigd(true); }
      setBezig(null); return;
    }
    if (bezig.soort === 'hoekpunt' || bezig.soort === 'maat' || bezig.soort === 'bocht') {
      if (vormenRef.current !== bezig.orig) { hist.current.terug.push(bezig.orig); hist.current.vooruit = []; setGewijzigd(true); }
      setBezig(null); return;
    }
    if (bezig.soort === 'kader') {
      const a = vanScherm(...bezig.start); const b = vanScherm(...bezig.nu);
      const x0 = Math.min(a[0], b[0]); const x1 = Math.max(a[0], b[0]); const y0 = Math.min(a[1], b[1]); const y1 = Math.max(a[1], b[1]);
      const binnen = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
      const raak = vormen.filter((x) => (x.soort === 'tekst' || x.soort === 'cirkel' ? binnen([x.x, x.y]) : puntenVan(x).some(binnen))).map((x) => x.id);
      setSel([...new Set([...(bezig.extra || []), ...raak])]);
      setBezig(null); return;
    }
    if (bezig.soort === 'sleep-nieuw') {
      const [ax, ay] = bezig.start; const [bx, by] = bezig.nu;
      let n;
      if (tool === 'cirkel') {
        const r = Math.max(Math.hypot(bx - ax, by - ay), 0.5);
        n = { id: id(), soort: 'cirkel', x: ax, y: ay, r: r3(r), vul: standaardVul, lijn: standaardLijn, d: 0.05 };
      } else {
        let b = Math.abs(bx - ax); let h = Math.abs(by - ay);
        let x = (ax + bx) / 2; let y = (ay + by) / 2;
        if (b < 0.05 || h < 0.05) { b = tool === 'trap' ? 2 : 3; h = tool === 'trap' ? 1 : 2; x = ax; y = ay; }
        n = { id: id(), soort: tool, x: r3(x), y: r3(y), b: r3(b), h: r3(h), rot: 0, vul: standaardVul, lijn: standaardLijn, d: 0.05, ...(tool === 'trap' ? { richting: 'x', trede: 0.3 } : {}) };
      }
      zet([...vormen, n]); setSel([n.id]); setTool('selecteer');
    }
    if (bezig.soort !== 'punten') setBezig(null);
  };
  const wiel = (e) => {
    const s = puntUit(e); const w = vanScherm(...s);
    const z = Math.max(4, Math.min(800, zicht.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    // Zoom rond de muis
    setZicht({ z, cx: w[0] - (s[0] - maat.w / 2) / z, cy: w[1] + (s[1] - maat.h / 2) / z });
  };
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const f = (e) => { e.preventDefault(); wiel(e); };
    svg.addEventListener('wheel', f, { passive: false });
    return () => svg.removeEventListener('wheel', f);
  });

  // Getypte lengte tijdens het tekenen: een stuk van precies zoveel meter richting de muis.
  const getypteLengte = () => {
    const L = naarGetal(getypt);
    if (!(L > 0) || bezig?.soort !== 'punten' || !bezig.pts.length) return false;
    const a = bezig.pts[bezig.pts.length - 1];
    const m = muisRuw.current?.w || [a[0] + 1, a[1]];
    let ang = Math.atan2(m[1] - a[1], m[0] - a[0]);
    if (muisRuw.current?.shift) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
    setBezig({ ...bezig, pts: [...bezig.pts, [r3(a[0] + L * Math.cos(ang)), r3(a[1] + L * Math.sin(ang))]] });
    setGetypt('');
    return true;
  };

  useEffect(() => {
    const toets = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
      if (mod && k === 's') { e.preventDefault(); bewaar(); return; }
      if (mod && (k === 'z' || k === 'y')) { e.preventDefault(); ongedaan(e.shiftKey || k === 'y'); return; }
      if (mod && k === 'a') { e.preventDefault(); setSel(vormen.map((x) => x.id)); return; }
      if (mod && k === 'c' && sel.length) { try { localStorage.setItem(KLEMBORD, JSON.stringify(gekozenVormen)); } catch {} setMelding(`${sel.length} ${sel.length === 1 ? 'vorm' : 'vormen'} gekopieerd. Plakken kan ook in een ander element.`); return; }
      if (mod && k === 'v') {
        let l = []; try { l = JSON.parse(localStorage.getItem(KLEMBORD) || '[]'); } catch {}
        if (l.length) { e.preventDefault(); const st = raster || 0.5; const n = l.map((x) => ({ ...verschuif(x, st, -st), id: id() })); zet([...vormen, ...n]); setSel(n.map((x) => x.id)); try { localStorage.setItem(KLEMBORD, JSON.stringify(n)); } catch {} }
        return;
      }
      if (mod && k === 'd' && sel.length) { e.preventDefault(); acties.dupliceer(); return; }
      if (bezig?.soort === 'punten') {
        if (/^[0-9]$/.test(e.key) || e.key === ',' || e.key === '.') { e.preventDefault(); setGetypt((t) => t + (e.key === '.' ? ',' : e.key)); return; }
        if (e.key === 'Backspace' && getypt) { e.preventDefault(); setGetypt((t) => t.slice(0, -1)); return; }
        if (e.key === 'Backspace') { e.preventDefault(); const pts = bezig.pts.slice(0, -1); setBezig(pts.length ? { ...bezig, pts } : null); return; }
        if (e.key === 'Enter') { e.preventDefault(); if (!getypteLengte()) rondAf(bezig.pts); return; }
        if (e.key === 'Escape') { if (getypt) setGetypt(''); else rondAf(bezig.pts); return; }
      }
      if (meting && !meting.af && (e.key === 'Enter' || e.key === 'Escape')) { setMeting({ ...meting, af: true }); return; }
      if (e.key === 'Escape') { setSel([]); setTool('selecteer'); setBezig(null); setMeting(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); acties.verwijder(); return; }
      if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault();
        const st = (raster || 0.1) * (e.shiftKey ? 10 : 1);
        const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
        opSel((x) => verschuif(x, d[0], d[1]));
        return;
      }
      if (!mod && !e.altKey && schrijven) {
        const t = { v: 'selecteer', r: 'rechthoek', p: 'vlak', l: 'lijn', c: 'cirkel', t: 'tekst', m: 'meten', ...(pijlen ? { a: 'pijl' } : {}) }[k];
        if (t) { if (bezig?.soort === 'punten') rondAf(bezig.pts); setTool(t); }
      }
    };
    window.addEventListener('keydown', toets);
    return () => window.removeEventListener('keydown', toets);
  });

  // ---------- Tekenen ----------
  const kader = useMemo(() => {
    const r = vormenNaarTekening(vormen);
    return r ? { b: r.tekening.b, h: r.tekening.h, c: r.verschuiving } : null;
  }, [vormen]);

  const rasterLijnen = [];
  {
    const stap = zicht.z >= 120 ? 0.1 : zicht.z >= 30 ? 0.5 : zicht.z >= 8 ? 1 : 5;
    const [x0, y1] = vanScherm(0, 0); const [x1, y0] = vanScherm(maat.w, maat.h);
    for (let x = Math.floor(x0 / stap) * stap; x <= x1; x += stap) {
      const sx = W(x, 0)[0]; const zwaar = Math.abs(x - Math.round(x)) < 1e-6;
      rasterLijnen.push(<line key={`x${x.toFixed(2)}`} x1={sx} y1={0} x2={sx} y2={maat.h} stroke={Math.abs(x) < 1e-6 ? '#c9ccd2' : zwaar ? '#e3e5e9' : '#f1f2f4'} strokeWidth={1} />);
    }
    for (let y = Math.floor(y0 / stap) * stap; y <= y1; y += stap) {
      const sy = W(0, y)[1]; const zwaar = Math.abs(y - Math.round(y)) < 1e-6;
      rasterLijnen.push(<line key={`y${y.toFixed(2)}`} x1={0} y1={sy} x2={maat.w} y2={sy} stroke={Math.abs(y) < 1e-6 ? '#c9ccd2' : zwaar ? '#e3e5e9' : '#f1f2f4'} strokeWidth={1} />);
    }
  }
  const pad = (pts, dicht) => pts.map((p, i) => `${i ? 'L' : 'M'}${W(...p).join(' ')}`).join('') + (dicht ? 'Z' : '');
  const sw = (d) => Math.max(1, (d || 0.03) * zicht.z);
  const tekenVorm = (x) => {
    const gekozen = sel.includes(x.id);
    const gemeen = { 'data-id': x.id, style: { cursor: tool === 'selecteer' ? 'move' : 'crosshair' } };
    if (x.soort === 'tekst') {
      const [sx, sy] = W(x.x, x.y);
      return (
        <g key={x.id}>
          <text {...gemeen} x={sx} y={sy} fontSize={Math.max(4, (x.h || 0.5) * zicht.z / 0.72)} fill={x.kleur || '#1d1d1b'} textAnchor="middle" dominantBaseline="central" fontWeight={x.vet === false ? 400 : 700} fontStyle={x.cursief ? 'italic' : 'normal'}
            transform={x.rot ? `rotate(${x.rot} ${sx} ${sy})` : undefined} style={{ ...gemeen.style, userSelect: 'none' }}>{x.tekst}</text>
          {gekozen && <circle cx={sx} cy={sy} r={4} fill="#2563EB" pointerEvents="none" />}
        </g>
      );
    }
    const dicht = x.soort !== 'lijn';
    const pts = x.soort === 'cirkel' ? cirkelPunten(x) : puntenVan(x);
    const enkel = gekozen && sel.length === 1;
    return (
      <g key={x.id}>
        <path {...gemeen} d={pad(pts, dicht)} fill={dicht ? (x.vul || 'none') : 'none'} stroke={x.lijn || (dicht ? 'none' : '#1d1d1b')} strokeWidth={sw(x.d)} strokeDasharray={STREEP_SVG(x.streep, sw(x.d))} strokeLinecap={x.streep === 'stip' ? 'round' : 'butt'}
          pointerEvents={dicht && !x.vul ? 'visibleStroke' : 'visiblePainted'} strokeLinejoin="round" />
        {x.soort === 'trap' && trapLijnen(x).map((c, i) => <path key={i} d={pad(c, false)} fill="none" stroke={x.lijn || '#1d1d1b'} strokeWidth={Math.max(1, sw(x.d) * 0.5)} pointerEvents="none" />)}
        {/* Breder onzichtbaar pad om dunne lijnen en randen te kunnen aanklikken */}
        {(!dicht || !x.vul) && <path data-id={x.id} d={pad(pts, dicht)} fill="none" stroke="transparent" strokeWidth={12} style={gemeen.style} />}
        {!dicht && (x.pijl || x.maat) && pts.length >= 2 && (() => {
          // Pijlpunten en maat (lengte) bij een lijn.
          const kl = x.lijn || '#1d1d1b'; const w0 = sw(x.d); const L = 8 + w0 * 2.2; const B2 = 4 + w0 * 1.2; const n = pts.length;
          const kop = (a, b) => { const [x1, y1] = W(...a); const [x2, y2] = W(...b); const d = Math.hypot(x2 - x1, y2 - y1) || 1; const ux = (x2 - x1) / d; const uy = (y2 - y1) / d; return `${x2},${y2} ${x2 - ux * L - uy * B2},${y2 - uy * L + ux * B2} ${x2 - ux * L + uy * B2},${y2 - uy * L - ux * B2}`; };
          const tot = pts.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
          const [ax, ay] = W(...pts[0]); const [bx, by] = W(...pts[n - 1]); let hk = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI; if (hk > 90) hk -= 180; if (hk < -90) hk += 180;
          return (
            <g pointerEvents="none">
              {(x.pijl === 'eind' || x.pijl === 'beide') && <polygon points={kop(pts[n - 2], pts[n - 1])} fill={kl} />}
              {(x.pijl === 'begin' || x.pijl === 'beide') && <polygon points={kop(pts[1], pts[0])} fill={kl} />}
              {x.maat && <text x={(ax + bx) / 2} y={(ay + by) / 2 - 7} transform={`rotate(${hk} ${(ax + bx) / 2} ${(ay + by) / 2})`} textAnchor="middle" fontSize={12} fontWeight={600} fill={kl} stroke="#fff" strokeWidth={3} paintOrder="stroke">{getal(tot)} m</text>}
            </g>
          );
        })()}
        {gekozen && <path d={pad(pts, dicht)} fill="none" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="5 3" pointerEvents="none" />}
        {enkel && tool === 'selecteer' && x.pts && x.pts.map((p, i) => {
          if (!dicht && i === x.pts.length - 1) return null;
          const q = x.pts[(i + 1) % x.pts.length]; const h = Number(x.bogen?.[i]) || 0;
          const [sx, sy] = W(...boogTopL(p, q, h));
          return <circle key={`m${i}`} data-m={i} cx={sx} cy={sy} r={4.5} fill={h ? '#7C3AED' : '#fff'} stroke="#7C3AED" strokeWidth={1.5} style={{ cursor: 'grab' }}><title>Sleep om dit stuk te buigen · dubbelklik voor een extra punt · Alt-klik maakt het weer recht</title></circle>;
        })}
        {enkel && tool === 'selecteer' && (x.soort === 'rechthoek' || x.soort === 'trap') && [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]].map(([gx, gy]) => {
          const [sx, sy] = W(...draaiPunt([x.x + (gx * x.b) / 2, x.y + (gy * x.h) / 2], [x.x, x.y], x.rot || 0));
          return <rect key={`g${gx}${gy}`} data-g={`${gx},${gy}`} x={sx - 4.5} y={sy - 4.5} width={9} height={9} fill="#fff" stroke="#2563EB" strokeWidth={1.5} style={{ cursor: gx && gy ? 'nwse-resize' : gx ? 'ew-resize' : 'ns-resize' }}><title>Sleep om de maat aan te passen · Shift: verhouding · Alt: vanuit het midden</title></rect>;
        })}
        {enkel && tool === 'selecteer' && x.soort === 'cirkel' && [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([gx, gy]) => {
          const [sx, sy] = W(x.x + gx * x.r, x.y + gy * x.r);
          return <rect key={`g${gx}${gy}`} data-g={`${gx},${gy}`} x={sx - 4.5} y={sy - 4.5} width={9} height={9} fill="#fff" stroke="#2563EB" strokeWidth={1.5} style={{ cursor: 'ew-resize' }}><title>Sleep om de straal aan te passen</title></rect>;
        })}
        {enkel && x.pts && x.pts.map((p, i) => { const [sx, sy] = W(...p); return <rect key={i} data-v={i} x={sx - 5} y={sy - 5} width={10} height={10} fill="#fff" stroke="#2563EB" strokeWidth={1.5} style={{ cursor: 'grab' }}><title>Sleep · dubbelklik om te wissen</title></rect>; })}
      </g>
    );
  };

  // Voorvertoning tijdens het tekenen
  let voorbeeld = null;
  if (bezig?.soort === 'sleep-nieuw') {
    const [ax, ay] = bezig.start; const [bx, by] = bezig.nu;
    if (tool === 'cirkel') {
      const r = Math.hypot(bx - ax, by - ay);
      voorbeeld = <><path d={pad(cirkelPunten({ x: ax, y: ay, r }), true)} fill="#2563EB14" stroke="#2563EB" strokeDasharray="4 3" /><text x={W(bx, by)[0] + 8} y={W(bx, by)[1]} fontSize={11} fill="#2563EB">r {getal(r)} m</text></>;
    } else {
      const b = Math.abs(bx - ax); const h = Math.abs(by - ay);
      voorbeeld = <><path d={pad([[ax, ay], [bx, ay], [bx, by], [ax, by]], true)} fill="#2563EB14" stroke="#2563EB" strokeDasharray="4 3" /><text x={W(bx, by)[0] + 8} y={W(bx, by)[1]} fontSize={11} fill="#2563EB">{getal(b)} × {getal(h)} m</text></>;
    }
  } else if (bezig?.soort === 'punten' && muis) {
    const pts = [...bezig.pts, muis];
    const laatste = bezig.pts[bezig.pts.length - 1];
    const l = laatste ? Math.hypot(muis[0] - laatste[0], muis[1] - laatste[1]) : 0;
    const sluit = bezig.pts.length >= 3 && Math.hypot(...W(...bezig.pts[0]).map((c, i) => c - W(...muis)[i])) < 10;
    voorbeeld = <>
      <path d={pad(pts, false)} fill="none" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="4 3" />
      {bezig.pts.map((p, i) => <circle key={i} cx={W(...p)[0]} cy={W(...p)[1]} r={i === 0 && bezig.pts.length >= 3 ? 6 : 3.5} fill={i === 0 && sluit ? '#2563EB' : '#fff'} stroke="#2563EB" />)}
      {laatste && <text x={W(...muis)[0] + 10} y={W(...muis)[1] - 8} fontSize={11} fill="#2563EB" fontWeight={getypt ? 700 : 400}>{getypt ? `${getypt} m ↵` : `${getal(l)} m`}{sluit ? ' · sluiten' : ''}</text>}
    </>;
  } else if (bezig?.soort === 'kader') {
    const [a, b] = [bezig.start, bezig.nu];
    voorbeeld = <rect x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(a[0] - b[0])} height={Math.abs(a[1] - b[1])} fill="#2563EB14" stroke="#2563EB" strokeDasharray="4 3" />;
  }

  const lijnenSel = gekozenVormen.length > 1 && gekozenVormen.every((x) => x.soort === 'lijn');

  return (
    <div className={`fm fm-editor${ingebed ? ' ingebed' : ''}`} style={{ position: ingebed ? 'absolute' : 'fixed', inset: 0, display: 'flex', flexDirection: 'column', zIndex: ingebed ? 5 : undefined }}>
      {!ingebed && <AppDialogen />}
      <header className="fm-topbalk">
        {kop}
        <div className="fm-ongedaan">
          <button className="fm-knop" title="Ongedaan maken (Ctrl Z)" aria-label="Ongedaan maken" onClick={() => ongedaan(false)}><Icoon naam="ongedaan" maat={16} /></button>
          <button className="fm-knop" title="Opnieuw (Ctrl Shift Z)" aria-label="Opnieuw" onClick={() => ongedaan(true)}><Icoon naam="opnieuw" maat={16} /></button>
        </div>
        <label className="fm-veld" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>Raster
          <select value={raster} onChange={(e) => setRaster(Number(e.target.value))} style={{ width: 90 }}>
            <option value={0}>Vrij</option><option value={0.01}>1 cm</option><option value={0.05}>5 cm</option><option value={0.1}>10 cm</option><option value={0.25}>25 cm</option><option value={0.5}>50 cm</option><option value={1}>1 m</option>
          </select>
        </label>
        <span className="fm-tag">{kader ? `${getal(kader.b)} × ${getal(kader.h)} m${lijnStuk ? ' per stuk' : ''}` : 'leeg'}</span>
        {rechts}
      </header>
      {(fout || melding) && <div style={{ padding: '6px 12px', background: '#fff', borderBottom: '1px solid #e8e8e6', display: 'flex', gap: 8, alignItems: 'center' }}>{fout && <span style={{ color: '#B4123A' }}>{fout}</span>}{melding && <span className="fm-sub">{melding}</span>}<button className="fm-sluit" style={{ marginLeft: 'auto' }} aria-label="Sluiten" onClick={() => { setFout(''); setMelding(''); }}>×</button></div>}
      <div className="fm-romp">
        <nav className="fm-gereedschap" aria-label="Gereedschap">
          {tools.map(([t, naam, ic, sneltoets]) => (
            <button key={t} className={tool === t ? 'aan' : ''} disabled={!schrijven && t !== 'selecteer'} onClick={() => { if (bezig?.soort === 'punten') rondAf(bezig.pts); setTool(t); }} title={`${naam}${sneltoets ? ` (${sneltoets})` : ''}`}>
              <Icoon naam={ic === 'trap' ? 'lijstje' : ic} maat={18} /><span>{naam.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
        <div className="fm-kaartvak" style={{ background: '#fff', '--fm-r': sel.length ? '272px' : '0px' }}>
          <svg ref={svgRef} width={maat.w} height={maat.h} style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: tool === 'selecteer' ? 'default' : 'crosshair' }}
            onPointerDown={omlaag} onPointerMove={beweeg} onPointerUp={omhoog} onContextMenu={(e) => e.preventDefault()}>
            {rasterLijnen}
            {achtergrond && <g pointerEvents="none">{achtergrond({ W, z: zicht.z, pad, tf: `matrix(${zicht.z} 0 0 ${-zicht.z} ${maat.w / 2 - zicht.cx * zicht.z} ${maat.h / 2 + zicht.cy * zicht.z})` })}</g>}
            {vormen.map(tekenVorm)}
            {voorbeeld}
            {meting && (() => {
              const pts = meting.af || !muis || tool !== 'meten' ? meting.pts : [...meting.pts, muis];
              let tot = 0;
              const stukken = pts.slice(1).map((q, i) => { const a = pts[i]; const l = Math.hypot(q[0] - a[0], q[1] - a[1]); tot += l; const [mx, my] = W((a[0] + q[0]) / 2, (a[1] + q[1]) / 2); return { l, mx, my }; });
              const laatste = W(...pts[pts.length - 1]);
              return (
                <g pointerEvents="none">
                  <path d={pad(pts, false)} fill="none" stroke="#E11D48" strokeWidth={2} strokeDasharray="6 4" />
                  {pts.map((q, i) => <circle key={i} cx={W(...q)[0]} cy={W(...q)[1]} r={3.5} fill="#fff" stroke="#E11D48" strokeWidth={1.5} />)}
                  {stukken.length > 1 && stukken.map((x, i) => <text key={i} x={x.mx} y={x.my - 8} fontSize={11} textAnchor="middle" fill="#E11D48" fontWeight={600} stroke="#fff" strokeWidth={3} paintOrder="stroke">{getal(x.l)} m</text>)}
                  {stukken.length > 0 && <text x={laatste[0] + 10} y={laatste[1] - 10} fontSize={13} fill="#ffffff" fontWeight={700} stroke="#E11D48" strokeWidth={5} paintOrder="stroke">{getal(tot)} m{stukken.length > 1 ? ' totaal' : ''}</text>}
                </g>
              );
            })()}
            {vangPunt && (tool !== 'selecteer' || bezig) && <rect x={W(...vangPunt)[0] - 6} y={W(...vangPunt)[1] - 6} width={12} height={12} fill="none" stroke="#E11D48" strokeWidth={1.5} pointerEvents="none" />}
          </svg>
          {bezig?.soort === 'punten' && (
            <div className="fm-melding-kaart" style={{ pointerEvents: 'auto' }}>
              {UITLEG[tool]}
              <span className="fm-melding-draai"><button style={{ width: 'auto', padding: '0 8px' }} onClick={() => rondAf(bezig.pts)}>Klaar</button></span>
            </div>
          )}
          {!bezig && <div className="fm-melding-kaart" style={{ opacity: 0.85 }}>{UITLEG[tool]}</div>}
          <div className="fm-ee-zoom">
            <button title="Inzoomen" onClick={() => setZicht((z) => ({ ...z, z: Math.min(800, z.z * 1.3) }))}>+</button>
            <button title="Uitzoomen" onClick={() => setZicht((z) => ({ ...z, z: Math.max(4, z.z / 1.3) }))}>−</button>
            <button title="Alles tonen" onClick={() => { if (kader) setZicht({ cx: kader.c[0], cy: kader.c[1], z: Math.max(4, Math.min(400, Math.min((maat.w - 120) / kader.b, (maat.h - 120) / kader.h))) }); }}><Icoon naam="scherm" maat={14} /></button>
          </div>
          {muis && <div style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11, color: '#686D76', background: '#fff', padding: '2px 6px' }}>x {getal(muis[0])} · y {getal(muis[1])} m</div>}
        </div>
        {sel.length > 0 && (
          <aside className="fm-eigenschappen">
            <div className="fm-paneelkop"><span>{v ? { rechthoek: 'Rechthoek', trap: 'Trap', vlak: 'Vorm', lijn: 'Lijn', cirkel: 'Cirkel', tekst: 'Tekst' }[v.soort] : `${sel.length} vormen`}</span><button className="fm-sluit" aria-label="Sluiten" onClick={() => setSel([])}>×</button></div>
            {v
              ? <VormEigenschappen v={v} wijzig={(p) => wijzig(v.id, p)} schrijven={schrijven} acties={acties} pijlen={pijlen} />
              : (
                <div>
                  <div className="fm-sectie">
                    {schrijven && <Actieknoppen acties={acties} />}
                    {lijnenSel && <button className="fm-knop zwart" style={{ alignSelf: 'flex-start' }} onClick={acties.samenvoegen}>Lijnen samenvoegen{voegLijnenSamen(gekozenVormen)?.dicht ? ' tot vorm' : ''}</button>}
                    <div className="fm-sub">Shift-klik: toevoegen of weghalen · Shift-slepen: kader</div>
                  </div>
                  <div className="fm-sectie">
                    <Kleurkeuze label="Lijn (alle)" waarde={gekozenVormen[0]?.lijn} onZet={(k) => acties.stijl({ lijn: k })} />
                    <Kleurkeuze label="Vulling (alle vormen)" waarde={gekozenVormen.find((x) => x.soort !== 'lijn')?.vul} onZet={(k) => opSel((x) => (x.soort === 'lijn' || x.soort === 'tekst' ? x : { ...x, vul: k }))} />
                    <Getal label="Lijndikte (alle)" eenheid="cm" waarde={Math.round((gekozenVormen[0]?.d ?? 0.04) * 1000) / 10} min={0.1} onZet={(n) => acties.stijl({ d: n / 100 })} />
                  </div>
                </div>
              )}
          </aside>
        )}
      </div>
    </div>
  );
}

// Elementeditor van de bibliotheek: laden en automatisch bewaren rond de tekenaar.
export default function ElementEditor({ elementId }) {
  const [profiel, setProfiel] = useState(null);
  const [el, setEl] = useState(null);
  const [begin, setBegin] = useState(null);
  const [beginZicht, setBeginZicht] = useState(null);
  const [fout, setFout] = useState('');
  const [gewijzigd, setGewijzigd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [status, setStatus] = useState({ s: 'bewaard', t: null });
  const [tik, setTik] = useState(0);
  const vormenRef = useRef([]);
  const elRef = useRef(el); elRef.current = el;
  const bewaarRef = useRef({ bezig: false, opnieuw: false });

  useEffect(() => {
    (async () => {
      const wie = await wieBenIk(); setProfiel(wie);
      if (elementId === 'nieuw') { setEl({ naam: 'Nieuw element', categorie: 'Eigen', tekenwijze: 'schaal', stijl: { vuldekking: 0 }, eigenschappen: {} }); setBegin([]); return; }
      let { data, error } = await maps().from('bibliotheek').select('*').eq('id', elementId).single();
      if (error) { setFout(foutTekst(error)); return; }
      data = metTekening(data);
      setEl(data);
      const e = data.eigenschappen || {};
      let v = e.bron?.length ? e.bron : tekeningNaarVormen(e.tekening);
      if (!v.length && data.tekenwijze === 'lijn' && Number(data.eenheid_m) > 0) {
        // Eén stuk van een lijnelement: lengte per stuk × breedte op de grond.
        v = [{ id: id(), soort: 'rechthoek', x: 0, y: 0, b: Number(data.eenheid_m), h: Number(data.diepte_m) || 0.5, rot: 0, vul: '#ffffff', lijn: '#1d1d1b', d: 0.03 }];
      } else if (!v.length && data.breedte_m && data.diepte_m) {
        v = data.omtrek?.length >= 3
          ? [{ id: id(), soort: 'vlak', pts: data.omtrek, vul: '#ffffff', lijn: '#1d1d1b', d: 0.05 }]
          : [{ id: id(), soort: 'rechthoek', x: 0, y: 0, b: Number(data.breedte_m), h: Number(data.diepte_m), rot: 0, vul: '#ffffff', lijn: '#1d1d1b', d: 0.05 }];
      }
      vormenRef.current = v;
      setStatus({ s: 'bewaard', t: data.updated_at ? new Date(data.updated_at) : null });
      const b = Number(data.tekenwijze === 'lijn' ? data.eenheid_m : data.breedte_m) || 6; const h = Number(data.diepte_m) || 4;
      setBeginZicht({ cx: 0, cy: 0, z: Math.max(8, Math.min(400, Math.min(700 / b, 450 / h))) });
      setBegin(v);
    })();
  }, [elementId]);

  const schrijven = magBibliotheek(profiel, el);
  const bewaar = async () => {
    if (!schrijven || !elRef.current) return;
    const b = bewaarRef.current;
    if (b.bezig) { b.opnieuw = true; return; }
    const huidig = vormenRef.current; const e0 = elRef.current;
    const r = vormenNaarTekening(huidig);
    if (!r) { setStatus({ s: 'leeg', t: null }); return; }
    b.bezig = true; setStatus((s) => ({ ...s, s: 'bezig' })); setFout('');
    // Bron mee bewaren, rond hetzelfde midden als de tekening.
    const [cx, cy] = r.verschuiving;
    const bron = huidig.map((x) => verschuif(x, -cx, -cy));
    const lijnEl = e0.tekenwijze === 'lijn';
    const rij = {
      naam: e0.naam?.trim() || 'Nieuw element', categorie: e0.categorie || 'Eigen', tekenwijze: lijnEl ? 'lijn' : 'schaal',
      ...(lijnEl ? { eenheid_m: r.tekening.b, diepte_m: r.tekening.h } : { breedte_m: r.tekening.b, diepte_m: r.tekening.h }), omtrek: null,
      stijl: { ...(e0.stijl || {}), vuldekking: 0 },
      eigenschappen: { ...(e0.eigenschappen || {}), tekening: r.tekening, bron },
    };
    const res = e0.id
      ? await maps().from('bibliotheek').update(rij).eq('id', e0.id).select().single()
      : await maps().from('bibliotheek').insert({ ...rij, actief: true }).select().single();
    b.bezig = false;
    if (res.error) { setFout(`Niet bewaard: ${foutTekst(res.error)}`); setStatus({ s: 'fout', t: null }); return; }
    setEl((x) => ({ ...res.data, naam: x?.naam ?? res.data.naam }));
    if (!e0.id && typeof window !== 'undefined') window.history.replaceState(null, '', `/maps/bibliotheek/teken/${res.data.id}`);
    if (vormenRef.current === huidig && (elRef.current?.naam === e0.naam)) setGewijzigd(false);
    setStatus({ s: 'bewaard', t: new Date() });
    if (b.opnieuw) { b.opnieuw = false; setTimeout(bewaar, 0); }
  };
  // Automatisch bewaren, kort nadat je stopt met tekenen.
  useEffect(() => {
    if (!gewijzigd || !schrijven || bezig) return undefined;
    setStatus((s) => (s.s === 'bezig' ? s : { ...s, s: 'wacht' }));
    const t = setTimeout(bewaar, 900);
    return () => clearTimeout(t);
  }, [tik, el?.naam, gewijzigd, bezig, schrijven]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const weg = (e) => { if (gewijzigd || bewaarRef.current.bezig) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', weg);
    return () => window.removeEventListener('beforeunload', weg);
  }, [gewijzigd]);

  if (!el || !begin) return <div className="fm" style={{ padding: 32 }}>{fout || 'Laden…'}</div>;
  const statusTekst = {
    bewaard: status.t ? `Bewaard ${status.t.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}` : 'Bewaard',
    wacht: 'Wijzigingen…', bezig: 'Bewaren…', fout: 'Niet bewaard · opnieuw', leeg: 'Leeg',
  }[status.s];
  return (
    <Tekenaar begin={begin} beginZicht={beginZicht} schrijven={schrijven} lijnStuk={el.tekenwijze === 'lijn'} fout={fout} onFoutWeg={() => setFout('')}
      onWijzig={(v, { bezig: b }) => { vormenRef.current = v; setBezig(b); setGewijzigd(true); setTik((t) => t + 1); }}
      onBewaar={bewaar}
      kop={<>
        <a className="fm-terug" href="/maps/bibliotheek" aria-label="Terug naar de bibliotheek" onClick={async (e) => { if (!gewijzigd && !bewaarRef.current.bezig) return; e.preventDefault(); await bewaar(); window.location.href = '/maps/bibliotheek'; }}><Icoon naam="terug" /></a>
        <div className="fm-titel">
          <small>Elementeditor · {el.categorie || 'Eigen'}{el.tekenwijze === 'lijn' ? ' · één stuk, wordt herhaald langs de lijn' : ''}</small>
          <input aria-label="Naam van het element" value={el.naam || ''} disabled={!schrijven} onChange={(e) => { setEl({ ...el, naam: e.target.value }); setGewijzigd(true); }}
            style={{ border: 0, padding: 0, height: 20, fontWeight: 600, fontSize: 13, background: 'transparent', minWidth: 0 }} />
        </div>
      </>}
      rechts={schrijven && (
        <button className={`fm-bewaarstatus ${status.s}`} onClick={bewaar} title="Alles wordt automatisch bewaard. Klik (of Ctrl S) om meteen te bewaren.">
          <span className="stip" />{statusTekst}
        </button>
      )} />
  );
}

function Actieknoppen({ acties }) {
  return (
    <div className="fm-vinkrij" style={{ gap: 4 }}>
      <button className="fm-knop klein" onClick={() => acties.draai(-15)} title="15° linksom"><Icoon naam="draailinks" maat={14} />15°</button>
      <button className="fm-knop klein" onClick={() => acties.draai(15)} title="15° rechtsom"><Icoon naam="draairechts" maat={14} />15°</button>
      <button className="fm-knop klein" onClick={() => acties.draai(90)} title="90° rechtsom">90°</button>
      <button className="fm-knop klein" onClick={() => acties.spiegel('x')} title="Spiegelen links ↔ rechts">⇋ Spiegel</button>
      <button className="fm-knop klein" onClick={() => acties.spiegel('y')} title="Spiegelen boven ↕ onder">⇵ Spiegel</button>
      <button className="fm-knop klein" onClick={acties.dupliceer} title="Ctrl D">Dupliceren</button>
      <button className="fm-knop klein" onClick={acties.voor} title="Naar voren">Voor</button>
      <button className="fm-knop klein" onClick={acties.achter} title="Naar achteren">Achter</button>
      <button className="fm-knop klein gevaar" onClick={acties.verwijder} title="Delete">Verwijderen</button>
    </div>
  );
}

function Getal({ label, waarde, onZet, eenheid, min }) {
  const [w, setW] = useState(String(waarde ?? ''));
  const timer = useRef(null);
  const focus = useRef(false);
  useEffect(() => { if (!focus.current) setW(String(waarde ?? '')); }, [waarde]);
  const pas = (t) => { const n = naarGetal(t); if (n != null && (min == null || n >= min)) onZet(n); };
  return (
    <label className="fm-veld">{label}{eenheid ? ` (${eenheid})` : ''}
      <input value={w} inputMode="decimal" onFocus={() => { focus.current = true; }}
        onBlur={() => { focus.current = false; clearTimeout(timer.current); pas(w); setW(String(waarde ?? '')); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onChange={(e) => { setW(e.target.value); clearTimeout(timer.current); const t = e.target.value; timer.current = setTimeout(() => pas(t), 450); }} />
    </label>
  );
}

function Kleurkeuze({ label, waarde, onZet, geen = true }) {
  return (
    <div>
      <div className="fm-sub" style={{ marginBottom: 4 }}>{label}</div>
      <div className="fm-kleuren">
        {geen && <button className={!waarde ? 'aan' : ''} onClick={() => onZet(null)} aria-label="Geen" title="Geen" style={{ background: 'linear-gradient(135deg,#fff 45%,#E11D48 45%,#E11D48 55%,#fff 55%)' }} />}
        {KLEUREN.map((k) => <button key={k} className={(waarde || '').toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} aria-label={k} onClick={() => onZet(k)} />)}
        <input type="color" value={waarde || '#1d1d1b'} onChange={(e) => onZet(e.target.value)} aria-label="Eigen kleur" style={{ padding: 0, border: '1px solid #DADDE3' }} />
      </div>
    </div>
  );
}

function VormEigenschappen({ v, wijzig, schrijven, acties, pijlen = false }) {
  const rh = v.soort === 'rechthoek' || v.soort === 'trap';
  return (
    <div>
      <div className="fm-sectie">
        {schrijven && <Actieknoppen acties={acties} />}
        {v.soort === 'tekst' && (
          <>
            <label className="fm-veld fm-ee-tekst">Tekst<input value={v.tekst || ''} onChange={(e) => wijzig({ tekst: e.target.value })} /></label>
            <div className="fm-raster2">
              <Getal label="Hoogte letters" eenheid="m" waarde={v.h} min={0.02} onZet={(n) => wijzig({ h: n })} />
              <Getal label="Draaiing" eenheid="°" waarde={v.rot || 0} onZet={(n) => wijzig({ rot: ((n % 360) + 360) % 360 })} />
            </div>
            <div className="fm-vinkrij">
              <label className="fm-vink"><input type="checkbox" checked={v.vet !== false} onChange={(e) => wijzig({ vet: e.target.checked })} />Vet</label>
              <label className="fm-vink"><input type="checkbox" checked={!!v.cursief} onChange={(e) => wijzig({ cursief: e.target.checked })} />Cursief</label>
            </div>
          </>
        )}
        {rh && (
          <div className="fm-raster2">
            <Getal label="Breedte" eenheid="m" waarde={v.b} min={0.01} onZet={(n) => wijzig({ b: n })} />
            <Getal label="Diepte" eenheid="m" waarde={v.h} min={0.01} onZet={(n) => wijzig({ h: n })} />
          </div>
        )}
        {v.soort === 'cirkel' && <Getal label="Straal" eenheid="m" waarde={v.r} min={0.01} onZet={(n) => wijzig({ r: n })} />}
        {v.x != null && (
          <div className="fm-raster3">
            <Getal label="Midden x" eenheid="m" waarde={v.x} onZet={(n) => wijzig({ x: n })} />
            <Getal label="Midden y" eenheid="m" waarde={v.y} onZet={(n) => wijzig({ y: n })} />
            {rh && <Getal label="Draaiing" eenheid="°" waarde={v.rot || 0} onZet={(n) => wijzig({ rot: ((n % 360) + 360) % 360 })} />}
          </div>
        )}
        {v.soort === 'trap' && (
          <div className="fm-raster2">
            <div className="fm-veld">Looprichting
              <div className="fm-segment">{[['x', '→'], ['-x', '←'], ['y', '↑'], ['-y', '↓']].map(([k, t]) => <button key={k} className={(v.richting || 'x') === k ? 'aan' : ''} onClick={() => wijzig({ richting: k })}>{t}</button>)}</div>
            </div>
            <Getal label="Trede" eenheid="m" waarde={v.trede || 0.3} min={0.1} onZet={(n) => wijzig({ trede: n })} />
          </div>
        )}
        {v.pts && (
          <details className="fm-meer" open={v.pts.length <= 10}><summary>Zijden exact · {zijdenVan(v.pts, v.soort === 'vlak').length}</summary>
            <div className="fm-sub">Richting: 0 = boven, 90 = rechts. {v.soort === 'vlak' ? 'Een lengte rekt de vorm op en houdt de hoeken; een richting draait wat erna komt.' : 'Wat erna komt schuift mee.'}</div>
            <div className="fm-zijden">
              <span className="kop">#</span><span className="kop">Lengte (m)</span><span className="kop">Richting (°)</span>
              {zijdenVan(v.pts, v.soort === 'vlak').map((z, i) => (
                <Fragment key={i}>
                  <span className="nr">{i + 1}</span>
                  {z.sluit && v.soort !== 'vlak' ? <span className="sluit">{getal(z.lengte)}</span> : <Getal label="" waarde={r3(z.lengte)} min={0.001} onZet={(n) => wijzig({ pts: zetZijde(v.pts, i, { lengte: n }, v.soort === 'vlak') })} />}
                  {z.sluit ? <span className="sluit">{getal(z.richting, 1)}</span> : <Getal label="" waarde={Math.round(z.richting * 10) / 10} onZet={(n) => wijzig({ pts: zetZijde(v.pts, i, { richting: ((n % 360) + 360) % 360 }) })} />}
                </Fragment>
              ))}
            </div>
          </details>
        )}
      </div>
      <div className="fm-sectie">
        {v.soort === 'tekst'
          ? <Kleurkeuze label="Kleur" waarde={v.kleur} geen={false} onZet={(k) => wijzig({ kleur: k })} />
          : (
            <>
              <Kleurkeuze label="Lijn" waarde={v.lijn} onZet={(k) => wijzig({ lijn: k })} geen={v.soort !== 'lijn'} />
              <div className="fm-raster2">
                <Getal label="Lijndikte" eenheid="cm" waarde={Math.round((v.d ?? 0.04) * 1000) / 10} min={0.1} onZet={(n) => wijzig({ d: n / 100 })} />
                <div className="fm-veld">Soort lijn
                  <div className="fm-segment">{[['vol', '—'], ['streep', '- -'], ['stip', '···'], ['streeppunt', '-·-']].map(([k, t]) => <button key={k} title={k} className={(v.streep || 'vol') === k ? 'aan' : ''} onClick={() => wijzig({ streep: k === 'vol' ? undefined : k })}>{t}</button>)}</div>
                </div>
              </div>
              {pijlen && v.soort === 'lijn' && (
                <div className="fm-raster2">
                  <div className="fm-veld">Pijl
                    <div className="fm-segment">{[[null, 'Geen'], ['eind', '→'], ['begin', '←'], ['beide', '↔']].map(([k, t]) => <button key={String(k)} title={k || 'geen'} className={(v.pijl || null) === k ? 'aan' : ''} onClick={() => wijzig({ pijl: k })}>{t}</button>)}</div>
                  </div>
                  <label className="fm-vink" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!v.maat} onChange={(e) => wijzig({ maat: e.target.checked || null })} />Lengte tonen</label>
                </div>
              )}
              {v.soort !== 'lijn' && <Kleurkeuze label="Vulling" waarde={v.vul} onZet={(k) => wijzig({ vul: k })} />}
              {v.soort === 'lijn' && v.pts.length >= 3 && (
                <Kleurkeuze label="Vulling · maakt van de lijn een gesloten vorm" waarde={null} geen={false}
                  onZet={(k) => { const p0 = v.pts[0]; const pn = v.pts[v.pts.length - 1]; const pts = Math.hypot(p0[0] - pn[0], p0[1] - pn[1]) < 0.02 ? v.pts.slice(0, -1) : v.pts; wijzig({ soort: 'vlak', pts, vul: k }); }} />
              )}
            </>
          )}
      </div>
    </div>
  );
}
