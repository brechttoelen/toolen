'use client';

// Trussbouwer met lijnen: je tekent enkel de vorm (poten en liggers op een stramien), de stukken, blokken en
// baseplates volgen eruit. Sleep vanaf een poot, ligger of blok in de richting waar je wil bouwen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import TerugKnop from './TerugKnop';
import { useBouwerSchild, schildProps } from './bouwerschild';
import { DoekKnop } from './doekkiezer';
import { PLAATSINGEN, STARTEN } from './doekbeeld';
import { wandPunten } from './WandStudio';
import { webglKan } from './StellingStudio';
import { StellingPlannen } from './stellingplannen';
import { Zicht, zetTrussType, trussPrims } from './TrussStudio';
import { anker, naarTrussOpslag, trussTelling, trussAnalyse, trussTypeVoor, trussTypeVan, TRUSS_TYPES, TRUSS_LENGTES, TRUSS_B, maxOverspanning } from './trussbouw';
import { AS, sleutel, uitSleutel, isRaster, leegRaster, rasterMaten, rasterStukken, rasterDoeken, puntVan, asTussen, asBuiten, voegLijn, ruimOp, haalWeg, zetMaat, vormToren, vormLigger, vormPortaal, vormWand, vormKubus } from './trussraster';
const DrieGL = dynamic(() => import('./TentDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });

const getal = (v) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 2 });
const r3 = (v) => Math.round(v * 1000) / 1000;
const nieuwId = () => Math.random().toString(36).slice(2, 9);
const eindVan = (s) => (s.op ? [s.a[0], s.a[1], s.a[2] + s.L] : [s.a[0] + Math.cos(s.r) * s.L, s.a[1] + Math.sin(s.r) * s.L, s.a[2]]);
const RICHT = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const ASNAAM = { x: 'Breedte', y: 'Diepte', z: 'Hoogte' };

export default function TrussTeken({ it, el, schrijven, onZet, onSluit, doeken: ontwerpen = [], start = null }) {
  const t0 = it.velden?.truss || {}; const TY = trussTypeVoor(el, t0); zetTrussType(TY); const B = TY.B;
  const zwart = /zwart/i.test(el?.naam || '');
  const lengtes = el?.eigenschappen?.kabel_lengtes?.length ? el.eigenschappen.kabel_lengtes.map(Number).sort((a, b) => b - a) : TRUSS_LENGTES;
  const opgeslagen = isRaster(t0);
  const R = opgeslagen ? t0.raster : start?.R || leegRaster();
  const doekLijst = opgeslagen ? t0.doeken || [] : start?.doeken || [];
  const pts0 = wandPunten(it); const pts = pts0.length >= 2 ? pts0 : [[0, 0], [1, 0]]; const A = anker(pts);
  const M = rasterMaten(R, B);
  const naarW = (p, Rx = R) => { const w = A.naarWereld([Rx.o[0] + p[0], Rx.o[1] + p[1]]); return [w[0], w[1], p[2]]; };
  const richtW = (a) => (a === 'x' ? [Math.cos(A.a0), Math.sin(A.a0), 0] : a === 'y' ? [-Math.sin(A.a0), Math.cos(A.a0), 0] : [0, 0, 1]);
  const wereld = (Rx, Bx = B) => rasterStukken(Rx, Bx, lengtes).map((s, i) => ({ ...s, i, a: naarW(s.a, Rx), r: A.a0 + s.r }));
  const stukken = useMemo(() => wereld(R), [it, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const doekenNu = useMemo(() => rasterDoeken(R, doekLijst, B, lengtes), [it, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const [hoek, setHoek] = useState(35); const [kantel, setKantel] = useState(22); const [zoom, setZoom] = useState(1); const [passTik, setPassTik] = useState(0);
  const [sel, setSel] = useState([]); const [selDoek, setSelDoek] = useState(null); const [doekKant, setDoekKant] = useState('voor');
  const [spook, setSpook] = useState(null); const [tip, setTip] = useState('');
  const [maatP, setMaatP] = useState({ W: 4, H: 3, D: 3, n: 3, onder: false });
  const [beeld, setBeeld] = useState(false); const [gl, setGl] = useState(false); useEffect(() => { setGl(webglKan()); }, []);
  const [pdfBezig, setPdfBezig] = useState(false);
  const terugL = useRef([]); const vooruitL = useRef([]); const [, setTik] = useState(0);

  // De ankerlijn op de kaart ligt altijd onder de truss.
  const ankerVoor = (lijst) => {
    if (!lijst.length) return pts; const u = richtW('x'); const n = richtW('y'); const o = pts[0]; let s0 = Infinity; let s1 = -Infinity;
    for (const x of lijst) for (const q of [x.a, eindVan(x)]) { const sv = (q[0] - o[0]) * u[0] + (q[1] - o[1]) * u[1]; s0 = Math.min(s0, sv); s1 = Math.max(s1, sv); }
    const f = lijst.find((x) => !x.op) || lijst[0]; const w = (f.a[0] - o[0]) * n[0] + (f.a[1] - o[1]) * n[1]; if (s1 - s0 < 0.5) s1 = s0 + 0.5;
    const P = (sv) => [r3(o[0] + u[0] * sv + n[0] * w), r3(o[1] + u[1] * sv + n[1] * w)];
    return [P(s0), P(s1)];
  };
  const zetT = (nt, np) => { terugL.current = [...terugL.current.slice(-60), { t: t0, pts }]; vooruitL.current = []; setTik((x) => x + 1); onZet(nt, np); };
  const bewaar = (R2, dl = doekLijst, type = null) => {
    const Bx = type ? trussTypeVan(type).B : B; const W = wereld(R2, Bx); const np = ankerVoor(W); const o2 = anker(np).naarLokaal(A.naarWereld(R2.o));
    zetT({ ...t0, ...(type ? { type } : {}), raster: { ...R2, o: [r3(o2[0]), r3(o2[1])] }, stukken: naarTrussOpslag(np, W), doeken: rasterDoeken(R2, dl, Bx, lengtes) }, np);
  };
  const terug = () => { const v = terugL.current.pop(); if (!v) return; vooruitL.current.push({ t: t0, pts }); setTik((x) => x + 1); setSel([]); setSelDoek(null); onZet(v.t, v.pts); };
  const opnieuw = () => { const v = vooruitL.current.pop(); if (!v) return; terugL.current.push({ t: t0, pts }); setTik((x) => x + 1); setSel([]); setSelDoek(null); onZet(v.t, v.pts); };

  // ---------- Tekenen: slepen vanaf een punt ----------
  const sleep = useRef(null);
  const beginVan = (i, muis, hulp) => {
    const st = stukken[i]; if (!st) return null; const e = uitSleutel(st.lijn); const c = AS[e.a]; const L = R[e.a][e.q[c]]; const P = puntVan(M, e.q); const d = RICHT[e.a];
    const o0 = e.a === 'z' && e.q[2] === 0 && !M.vloer ? 0 : M.H; const q2 = [...e.q]; q2[c] += 1;
    const afst = (p) => { const s = hulp.S(naarW(p)); return Math.hypot(s[0] - muis[0], s[1] - muis[1]); };
    let best = null; for (const q of [e.q, q2]) { const p = puntVan(M, q); const dd = afst(p); if (!best || dd < best.dd) best = { q, dd, p }; }
    let mid = null; for (let t = 0.5; t < L - 0.25; t += 0.5) { const p = P.map((v, k) => v + d[k] * (o0 + t + M.H)); const dd = afst(p); if (!mid || dd < mid.dd) mid = { q: e.q, dd, p, tussen: { a: e.a, n: e.q[c], s1: t } }; }
    return mid && mid.dd + 12 < best.dd ? mid : best;
  };
  const doelLangs = (a, n0, sg, t) => {
    const pos = a === 'x' ? M.X : a === 'y' ? M.Y : M.Z; let best = null;
    for (let m = n0 + sg; m >= 0 && m < pos.length; m += sg) { const d = Math.abs(pos[m] - pos[n0]); if (!best || Math.abs(d - t) < Math.abs(best.d - t)) best = { soort: 'as', m, d, L: Math.abs(m - n0) === 1 ? R[a][Math.min(m, n0)] : null }; }
    if (a === 'z' && sg < 0) return best;
    const rand = sg > 0 ? pos.length - 1 : 0; const dr = Math.abs(pos[rand] - pos[n0]); const eerste = a === 'z' && pos.length === 1 && !M.vloer ? M.H : B;
    const L = Math.max(0.5, Math.round((t - dr - eerste) * 2) / 2); const d = dr + L + eerste;
    if (t > dr + 0.3 && (!best || Math.abs(d - t) < Math.abs(best.d - t))) best = { soort: 'nieuw', L, d, kant: sg > 0 ? 'na' : 'voor', over: dr > 0.01 };
    return best;
  };
  const kies = (g, muis, hulp) => {
    const dx = muis[0] - g.m0[0]; const dy = muis[1] - g.m0[1]; const W0 = naarW(g.p); let keuze = null; const kand = [];
    for (const a of ['x', 'y', 'z']) for (const sg of [1, -1]) {
      if (g.tussen && g.tussen.a === a) continue;
      const dW = richtW(a).map((v) => v * sg); const s1 = hulp.S([W0[0] + dW[0], W0[1] + dW[1], W0[2] + dW[2]]); const vx = s1[0] - g.m0[0]; const vy = s1[1] - g.m0[1]; const l2 = vx * vx + vy * vy;
      const t = (dx * vx + dy * vy) / (l2 || 1); kand.push({ a, sg, t, l2, err: Math.hypot(dx - vx * t, dy - vy * t), dW, W0 });
    }
    // Een as die bijna recht naar je toe wijst (kort op het scherm) doet niet mee: daar is niet op te mikken.
    const lmax = Math.max(...kand.map((x) => x.l2));
    for (const x of kand) { if (x.l2 < lmax * 0.2 || x.t < 0.25) continue; if (!keuze || x.err < keuze.err - 6 || (Math.abs(x.err - keuze.err) <= 6 && x.l2 > keuze.l2)) keuze = x; }
    if (!keuze) return null; const doel = doelLangs(keuze.a, g.q[AS[keuze.a]], keuze.sg, keuze.t); return doel ? { ...keuze, doel } : null;
  };
  const onSleep = (fase, i, muis, hulp) => {
    if (fase === 'zweef' || !schrijven) return;
    if (!sleep.current) { const b = beginVan(i, muis, hulp); if (!b) return; sleep.current = { ...b, m0: hulp.S(naarW(b.p)) }; }
    const g = sleep.current; const k = kies(g, muis, hulp);
    if (fase === 'sleep') {
      if (!k) { setSpook(null); setTip('Sleep langs een as: opzij, naar voor of achter, omhoog of omlaag'); return; }
      const lang = Math.max(0.5, k.doel.d - (k.doel.soort === 'as' ? B : M.H * 2)); const st0 = k.sg > 0 ? M.H : M.H + lang;
      setSpook([{ id: '__sp', L: lang, a: [k.W0[0] + k.dW[0] * st0, k.W0[1] + k.dW[1] * st0, k.W0[2] + k.dW[2] * st0], r: k.a === 'y' ? A.a0 + Math.PI / 2 : A.a0, op: k.a === 'z' }]);
      const wat = k.a === 'z' ? (k.sg > 0 ? 'Poot omhoog' : 'Poot omlaag') : 'Ligger';
      const hoe = k.doel.soort === 'nieuw' ? `nieuw stuk van ${getal(k.doel.L)} m` : `${k.doel.L ? `${getal(k.doel.L)} m, ` : ''}tot ${k.a === 'z' ? (k.doel.m === 0 ? 'de vloer' : 'het niveau daar') : 'de as daar'}`;
      setTip(`${wat}: ${hoe}${g.tussen ? ` · er komt een blok op ${getal(g.tussen.s1)} m, het geheel wordt ${Math.round(B * 100)} cm ${g.tussen.a === 'z' ? 'hoger' : 'langer'}` : ''}`);
      return;
    }
    sleep.current = null; setSpook(null); setTip(''); if (!k) return;
    let R2 = R; let dl = doekLijst; const q = [...g.q]; const c = AS[k.a]; let m;
    if (g.tussen) { ({ R: R2, doeken: dl } = asTussen(R2, g.tussen.a, g.tussen.n, g.tussen.s1, dl)); q[AS[g.tussen.a]] = g.tussen.n + 1; }
    if (k.doel.soort === 'nieuw') { ({ R: R2, doeken: dl } = asBuiten(R2, k.a, k.doel.kant, k.doel.L, dl, B)); if (k.doel.kant === 'voor') { q[c] += 1; m = 0; } else m = R2[k.a].length; } else m = k.doel.m;
    R2 = voegLijn(R2, k.a, q, m); ({ R: R2, doeken: dl } = ruimOp(R2, dl, B));
    setSel([]); setSelDoek(null); bewaar(R2, dl);
  };
  const onKlik = (i, _muis, _hulp, meer) => {
    sleep.current = null; setSpook(null); setSelDoek(null);
    if (i == null) { if (!meer) setSel([]); return; }
    const k = stukken[i]?.lijn; if (!k) return;
    setSel((s0) => (meer ? (s0.includes(k) ? s0.filter((x) => x !== k) : [...s0, k]) : [k]));
  };
  const weg = () => { if (!sel.length) return; const r = haalWeg(R, sel, doekLijst, B); setSel([]); bewaar(r.R, r.doeken); };
  const heleLijn = () => {
    const set = new Set(R.lijnen); const uit = new Set(sel);
    for (const k of sel) { const e = uitSleutel(k); const c = AS[e.a]; for (const sg of [1, -1]) for (let n = e.q[c] + sg; ; n += sg) { const q = [...e.q]; q[c] = n; const s = sleutel(e.a, q); if (!set.has(s)) break; uit.add(s); } }
    setSel([...uit]);
  };
  const begin = (V) => { if (R.lijnen.length && !window.confirm('De huidige truss vervangen door deze vorm?')) return; setSel([]); setSelDoek(null); bewaar({ ...V, o: R.lijnen.length ? R.o : [0, 0] }, []); setPassTik((x) => x + 1); };
  const zetDoeken = (l) => bewaar(R, l);

  useEffect(() => {
    const h = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); if (selDoek) setSelDoek(null); else if (sel.length) setSel([]); else if (e.key === 'Escape') onSluit(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel([...R.lijnen]); return; }
      if (!schrijven) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) opnieuw(); else terug(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); opnieuw(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selDoek) { e.preventDefault(); zetDoeken(doekLijst.filter((d) => d.id !== selDoek)); setSelDoek(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); weg(); }
    };
    window.addEventListener('keydown', h, true); return () => window.removeEventListener('keydown', h, true);
  });

  const metE = stukken.map((x) => ({ ...x, e: eindVan(x) }));
  const telling = trussTelling(metE, TY);
  const analyse = useMemo(() => trussAnalyse(metE, TY), [it, start, TY]); // eslint-disable-line react-hooks/exhaustive-deps
  const meldingen = analyse.meldingen.filter((m) => m.fix?.soort !== 'blok');
  const doekMap = useMemo(() => new Map(ontwerpen.map((d) => [d.id, d])), [ontwerpen]);
  const drieP = useMemo(() => (gl && beeld ? trussPrims(stukken, doekenNu, doekMap, zwart) : null), [gl, beeld, it, start, doekMap, zwart]); // eslint-disable-line react-hooks/exhaustive-deps
  const totH = Math.max(0, ...stukken.map((x) => eindVan(x)[2] + M.H)); const metr = stukken.reduce((a, x) => a + x.L, 0);
  // Kijkhoek ten opzichte van de truss zelf: Voor = recht op de breedte, hoe de lijn ook op de kaart ligt.
  const kw = Math.PI / 2; const hoekBij = ((stukken.some((x) => !x.op) ? ((A.a0 % kw) + kw) % kw : 0) - A.a0) * (180 / Math.PI);
  const selSet = new Set(sel); const selI = stukken.filter((x) => selSet.has(x.lijn)).map((x) => x.i);
  const dk = selDoek ? doekLijst.find((d) => d.id === selDoek) : null; const dkNu = selDoek ? doekenNu.find((d) => d.id === selDoek) : null;
  // Doek onder de gekozen liggers: ze moeten op één rij liggen.
  const rij = (() => {
    if (!sel.length) return null; const es = sel.map(uitSleutel); const a = es[0].a; if (a === 'z' || !es.every((e) => e.a === a && e.q[2] === es[0].q[2] && e.q[a === 'x' ? 1 : 0] === es[0].q[a === 'x' ? 1 : 0])) return null;
    const is = es.map((e) => e.q[AS[a]]).sort((p, q) => p - q); if (is.some((v, n) => n && v !== is[n - 1] + 1)) return null;
    if (es[0].q[2] === 0) return null;
    return { as: a, vast: es[0].q[a === 'x' ? 1 : 0], i0: is[0], i1: is[is.length - 1] + 1, k: es[0].q[2] };
  })();
  const nieuwDoek = (vak) => ({ id: nieuwId(), vak, wijze: 'in', voor: null, achter: null });
  const maakPdf = async () => {
    if (pdfBezig) return; setPdfBezig(true);
    try {
      const [{ bouwerPdf }, { tentGroep }] = await Promise.all([import('./bouwerPdf'), import('./TentDrieGL')]);
      const prims = trussPrims(stukken, doekenNu, doekMap, zwart); const lig = stukken.filter((x) => !x.op).map((x) => x.a[2] + TRUSS_B);
      await bouwerPdf({ soort: 'truss', titel: String(it.velden?.naam || it.naam || el?.naam || 'Truss'), sub: [el?.naam, el?.leverancier].filter(Boolean).join(' · '), maakGroep: (T) => tentGroep(T, prims),
        hoogtes: [...new Set(lig.map((z) => Math.round(z * 100) / 100))],
        kenmerken: [['Soort', TY.naam], ['Gewicht', `± ${telling.kg} kg`], ['Stukken', stukken.length], ['Truss', `${getal(metr)} m`], ['Hoogte', `${getal(totH)} m`], ['Hoekstukken', telling.hoek], ['Baseplates', telling.voet], ['Doeken', doekenNu.length], ...(el?.leverancier ? [['Leverancier', el.leverancier]] : [])] });
    } catch (e) { window.alert(`De PDF lukte niet: ${e?.message || e}`); } finally { setPdfBezig(false); }
  };
  const veld = (label, k, min = 0.5, stap = 0.5) => <label>{label} <input type="number" min={min} step={stap} value={maatP[k]} onChange={(e) => setMaatP((m) => ({ ...m, [k]: Math.max(min, Number(e.target.value) || min) }))} />{stap === 1 ? '' : ' m'}</label>;
  const buiten = [M.X[M.X.length - 1] + B, M.Y[M.Y.length - 1] + B];

  useBouwerSchild();
  return createPortal(
    <div className="fm fm-ws" role="dialog" aria-label="Trussbouwer" {...schildProps}>
      <div className="fm-ws-kop">
        <TerugKnop onClick={onSluit} />
        <strong>Trussbouwer · {el.naam}</strong>
        <span className="fm-sub">{stukken.length ? `${getal(buiten[0])} × ${getal(Math.max(B, buiten[1]))} × ${getal(totH)} m · ${getal(metr)} m truss` : 'Nog leeg'}</span>
        {gl && <div className="fm-segment" role="group" aria-label="Weergave"><button type="button" className={!beeld ? 'aan' : ''} onClick={() => setBeeld(false)}>Bouwen</button><button type="button" className={beeld ? 'aan' : ''} title="Echte 3D met licht en schaduw (bekijken)" onClick={() => setBeeld(true)}>3D-beeld</button></div>}
        <span style={{ flex: 1 }} />
        <button className="fm-knop klein" disabled={pdfBezig || !stukken.length} title="Eén PDF met de 3D-weergave, het grondplan en de vier aanzichten met maatlijnen" onClick={maakPdf}>{pdfBezig ? 'PDF maken…' : 'PDF'}</button>
        {schrijven && <button className="fm-knop klein" disabled={!terugL.current.length} title="Terug (Ctrl + Z)" aria-label="Terug" onClick={terug}>↶</button>}
        {schrijven && <button className="fm-knop klein" disabled={!vooruitL.current.length} title="Opnieuw (Ctrl + Shift + Z)" aria-label="Opnieuw" onClick={opnieuw}>↷</button>}
      </div>
      <div className="fm-ws-lijf">
        <aside className="fm-ws-doeken">
          <div className="fm-kop">Begin met een vorm</div>
          <div className="fm-ws-maat">{veld('Breedte', 'W')}{veld('Hoogte', 'H')}</div>
          <div className="fm-ws-maat">{veld('Diepte', 'D')}{veld('Vakken', 'n', 1, 1)}</div>
          <label className="fm-vink"><input type="checkbox" checked={maatP.onder} onChange={(e) => setMaatP((m) => ({ ...m, onder: e.target.checked }))} />Wand met ligger op de vloer</label>
          <div className="fm-ws-acties">
            <button className="fm-knop klein" disabled={!schrijven} title="Twee poten met een ligger erover" onClick={() => begin(vormPortaal(maatP.W, maatP.H))}>Portaal</button>
            <button className="fm-knop klein" disabled={!schrijven} title={`${maatP.n} vakken van ${getal(maatP.W)} m naast elkaar`} onClick={() => begin(vormWand(Math.max(1, Math.round(maatP.n)), maatP.W, maatP.H, maatP.onder))}>Wand</button>
            <button className="fm-knop klein" disabled={!schrijven} title="Vier poten, liggers boven en onder" onClick={() => begin(vormKubus(maatP.W, maatP.D, maatP.H))}>Kubus</button>
            <button className="fm-knop klein" disabled={!schrijven} title="Eén poot" onClick={() => begin(vormToren(maatP.H))}>Toren</button>
            <button className="fm-knop klein" disabled={!schrijven} title="Eén ligger op de vloer" onClick={() => begin(vormLigger(maatP.W))}>Ligger</button>
          </div>
          <div className="fm-sub">Maten = lengte truss per vak; de blokken ({Math.round(B * 100)} cm) komen erbij.</div>
          <div className="fm-kop">Verder tekenen</div>
          <div className="fm-sub">Sleep vanaf een poot, ligger of blok in de richting waar je wil bouwen: opzij, naar voor of achter, omhoog of omlaag. Je komt vanzelf uit op de volgende as of op de vloer; verder slepen maakt een nieuw vak per 0,5 m.</div>
          <div className="fm-sub">Halverwege een poot of ligger beginnen kan ook: daar komt dan een blok, in alle evenwijdige stukken tegelijk.</div>
          <div className="fm-sub">Klik = kiezen · Shift + klik = meer · Delete = weg. Stukken, blokken en baseplates rekent de bouwer zelf uit.</div>
          {start?.omgezet && !opgeslagen && <div className="fm-melding" style={{ marginTop: 8 }}>Deze truss komt uit de oude bouwer en is omgezet naar lijnen. Kijk na of alles klopt; pas bij je eerste wijziging wordt hij zo bewaard.</div>}
        </aside>
        <div className="fm-ws-zicht">
          {beeld && drieP && <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: '#EEF1F4' }}><DrieGL prims={drieP} /></div>}
          <Zicht stukken={stukken} doeken={doekenNu} doekMap={doekMap} selDoek={selDoek} onDoekKlik={(id, k) => { setSel([]); setSelDoek(id); setDoekKant(k || 'voor'); }} zwart={zwart} hoek={hoek + hoekBij} kantel={kantel} sel={selI} spook={spook} zoom={zoom} vast={!!spook} blokGrijp={schrijven}
            onKlik={onKlik} onSleep={onSleep} onDraai={(a, b) => { setHoek(a - hoekBij); setKantel(b); }} onZoom={(k) => setZoom((z) => Math.max(0.2, Math.min(8, z * k)))} passTik={passTik} />
          <div className="fm-ws-hoeken" role="group" aria-label="Kijkhoek">
            <button onClick={() => { setHoek(0); setKantel(8); }}>Voor</button>
            <button onClick={() => { setHoek(35); setKantel(22); }}>Hoek</button>
            <button onClick={() => { setHoek(90); setKantel(8); }}>Zij</button>
            <button onClick={() => { setHoek(0); setKantel(80); }}>Boven</button>
            <button onClick={() => { setZoom(1); setPassTik((x) => x + 1); }} title="Alles in beeld">Passend</button>
          </div>
          <div className="fm-ws-tip fm-sub">{tip || (stukken.length ? 'Sleep vanaf de truss = tekenen · naast de truss slepen = draaien · rechts slepen = verschuiven · scrollen = zoomen' : 'Kies links een vorm om te beginnen')}</div>
        </div>
        <aside className="fm-ws-rechts">
          {stukken.length > 0 && (
            <div className="fm-tr-maat">
              <div className="fm-kop">Maten</div>
              {['x', 'y', 'z'].flatMap((a) => R[a].map((L, n) => (
                <div key={`${a}${n}`} className="fm-tr-maatrij"><span>{ASNAAM[a]}{R[a].length > 1 ? ` ${n + 1}` : ''}</span>
                  <button type="button" className="fm-knop klein" disabled={!schrijven || L <= 0.5} onClick={() => bewaar(zetMaat(R, a, n, L - 0.5))} aria-label="0,5 m minder">−</button>
                  <input key={`${a}${n}${L}`} type="number" step="0.5" min="0.5" disabled={!schrijven} defaultValue={L} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={(e) => { const v = Number(String(e.target.value).replace(',', '.')); if (v >= 0.5 && Math.abs(v - L) > 0.01) bewaar(zetMaat(R, a, n, v)); }} />
                  <button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => bewaar(zetMaat(R, a, n, L + 0.5))} aria-label="0,5 m meer">+</button><span className="fm-sub">m</span>
                </div>
              )))}
              <div className="fm-sub">Lengte truss per vak (per 0,5 m). Alles wat op die as staat past zich mee aan.</div>
            </div>
          )}
          {schrijven && stukken.length > 0 && !sel.length && !selDoek && (
            <div className="fm-tr-maat">
              <div className="fm-kop">Doeken{doekLijst.length ? ` · ${doekLijst.length}` : ''}</div>
              <div className="fm-sub">Klik in <b>Bouwen</b> op een ligger (bv. de bovenligger), kies eventueel <b>Hele lijn</b>, en daarna <b>Doek eronder</b> of <b>Doek per vak</b>. Klik op een doek om er een ontwerp aan te geven.</div>
              {beeld && <button type="button" className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => setBeeld(false)}>Naar Bouwen</button>}
            </div>
          )}
          {sel.length > 0 && (
            <>
              <div className="fm-ws-rkop"><strong>{sel.length === 1 ? `${uitSleutel(sel[0]).a === 'z' ? 'Poot' : 'Ligger'} ${getal(R[uitSleutel(sel[0]).a][uitSleutel(sel[0]).q[AS[uitSleutel(sel[0]).a]]])} m` : `${sel.length} lijnen`}</strong><button className="fm-sluit" aria-label="Selectie opheffen" onClick={() => setSel([])}>×</button></div>
              {schrijven && (
                <div className="fm-ws-acties">
                  <button className="fm-knop klein" title="Alle stukken in het verlengde erbij kiezen" onClick={heleLijn}>Hele lijn</button>
                  {rij && <button className="fm-knop klein" title="Eén doek onder de gekozen ligger(s), tot de ligger eronder of de vloer" onClick={() => { const d = nieuwDoek(rij); zetDoeken([...doekLijst, d]); setSel([]); setSelDoek(d.id); }}>Doek eronder</button>}
                  {rij && rij.i1 - rij.i0 > 1 && <button className="fm-knop klein" title="Een doek per vak" onClick={() => { const l = []; for (let i = rij.i0; i < rij.i1; i++) l.push(nieuwDoek({ ...rij, i0: i, i1: i + 1 })); zetDoeken([...doekLijst, ...l]); setSel([]); setSelDoek(l[0].id); }}>Doek per vak ({rij.i1 - rij.i0})</button>}
                  <button className="fm-knop klein" style={{ color: '#B4123A' }} title="Wissen (Delete)" onClick={weg}>Weg</button>
                </div>
              )}
              {!rij && sel.some((k) => uitSleutel(k).a !== 'z') && <span className="fm-sub">Voor een doek: kies één of meer liggers op één rij (niet op de vloer).</span>}
            </>
          )}
          {dk && (() => {
            const zet = (patch) => zetDoeken(doekLijst.map((d) => (d.id === dk.id ? { ...d, ...patch } : d)));
            return (
              <>
                <div className="fm-ws-rkop"><strong>Doek{dkNu ? ` ${getal(dkNu.s1 - dkNu.s0)} × ${getal(dkNu.z1 - dkNu.z0)} m` : ''}</strong><button className="fm-sluit" aria-label="Sluiten" onClick={() => setSelDoek(null)}>×</button></div>
                <div className="fm-segment fm-ws-tabs" role="group" aria-label="Ophanging">
                  {[['in', 'In de truss'], ['op', 'Op de truss']].map(([k, n]) => <button key={k} disabled={!schrijven} className={(dk.wijze || 'in') === k ? 'aan' : ''} title={k === 'op' ? 'Voor de truss gehangen, tot op de buitenkant' : 'In het vak, tussen de poten en de liggers'} onClick={() => zet({ wijze: k })}>{n}</button>)}
                </div>
                {dk.wijze === 'op' && (
                  <div className="fm-segment fm-ws-tabs" role="group" aria-label="Aan welke kant">
                    {[['voor', 'Aan de voorkant'], ['achter', 'Aan de achterkant']].map(([k, n]) => <button key={k} disabled={!schrijven} className={(dk.zijde || 'voor') === k ? 'aan' : ''} onClick={() => zet({ zijde: k })}>{n}</button>)}
                  </div>
                )}
                <label className="fm-vink"><input type="checkbox" checked={!dk.h} disabled={!schrijven} onChange={(e) => zet({ h: e.target.checked ? null : Math.round((dkNu ? dkNu.z1 - dkNu.z0 : 1) * 100) / 100 })} />Tot de ligger eronder of de vloer</label>
                {!!dk.h && <label className="fm-ws-maat"><span>Hoogte</span> <input key={dk.h} type="number" min="0.2" step="0.1" defaultValue={dk.h} disabled={!schrijven} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={(e) => { const v = Number(String(e.target.value).replace(',', '.')); if (v >= 0.2) zet({ h: Math.round(v * 100) / 100 }); }} /> m</label>}
                <div className="fm-segment fm-ws-tabs" role="group" aria-label="Kant">
                  {[['voor', 'Voorkant'], ['achter', 'Achterkant']].map(([k, n]) => <button key={k} className={doekKant === k ? 'aan' : ''} onClick={() => setDoekKant(k)}>{n}</button>)}
                </div>
                <DoekKnop doeken={ontwerpen} waarde={dk[doekKant] || null} drager="truss" planId={it.plan_id} schrijven={schrijven} titel={`Ontwerp voor de ${doekKant === 'achter' ? 'achterkant' : 'voorkant'}`} geenLabel="Geen ontwerp" onKies={(id) => zet({ [doekKant]: id || null })} />
                <div className="fm-segment fm-ws-tabs" role="group" aria-label="Plaatsing van het ontwerp">
                  {PLAATSINGEN.map(([k, n, tp]) => <button key={k} disabled={!schrijven} title={tp} className={(dk.plaatsing || 'vullen') === k ? 'aan' : ''} onClick={() => zet({ plaatsing: k === 'vullen' ? null : k })}>{n}</button>)}
                </div>
                {dk.plaatsing === 'herhalen' && (
                  <div className="fm-segment fm-ws-tabs" role="group" aria-label="Herhaling begint">
                    {STARTEN.map(([k, n]) => <button key={k} disabled={!schrijven} title={`Herhaling begint ${n.toLowerCase()}`} className={(dk.start || 'rechts') === k ? 'aan' : ''} onClick={() => zet({ start: k })}>{n}</button>)}
                  </div>
                )}
                {schrijven && <div className="fm-ws-acties"><button className="fm-knop klein" onClick={() => zet({ voor: dk[doekKant], achter: dk[doekKant] })} disabled={!dk[doekKant]}>Op beide kanten</button><button className="fm-knop klein" style={{ color: '#B4123A' }} onClick={() => { zetDoeken(doekLijst.filter((d) => d.id !== dk.id)); setSelDoek(null); }}>Doek weg</button></div>}
              </>
            );
          })()}
          <div className="fm-tr-tech">
            <label className="fm-veld">Soort truss
              <select disabled={!schrijven} value={TY.k} onChange={(e) => bewaar(R, doekLijst, e.target.value)}>{TRUSS_TYPES.map((x) => <option key={x.k} value={x.k}>{x.naam}</option>)}</select>
            </label>
            <div className="fm-tr-feit"><span>Gewicht</span><b>{getal(TY.kgm)} kg/m</b></div>
            <div className="fm-tr-feit"><span>Max. overspanning</span><b>± {maxOverspanning(TY)} m</b></div>
            {analyse.overspanningen.map((o, k) => <div key={k} className={`fm-tr-span${o.L > analyse.max ? ' fout' : ''}`}><b>{getal(o.L)} m</b><span>{o.bel ? `max ${o.bel.udl} kg/m verdeeld of ${o.bel.cpl} kg in het midden` : 'buiten de tabel'}</span></div>)}
            {meldingen.map((m, k) => <button key={k} type="button" className={`fm-melding ${m.soort === 'fout' ? 'fout' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer', width: '100%', marginTop: 6 }} onClick={() => setSel([...new Set(stukken.filter((x) => m.ids.includes(x.id)).map((x) => x.lijn))])}>{m.tekst}</button>)}
            <div className="fm-sub" style={{ marginTop: 6 }}>Belasting volgens {TY.bron}, indicatief: de leverancier of een rigger rekent na.</div>
          </div>
          <span style={{ flex: 1 }} />
          <div className="fm-kop">Plannen van de leverancier</div>
          <StellingPlannen planId={it.plan_id} itemId={it.id} schrijven={schrijven} soort="trussplan" wie="trussleverancier" compact />
          <div className="fm-kop">Stuklijst</div>
          <div className="fm-ws-lijst">
            {Object.entries(telling.stukken).sort((a, b) => Number(b[0]) - Number(a[0])).map(([L, n]) => <div key={L}><span>Truss {getal(L)} m</span><b>{n}</b></div>)}
            {Object.entries(telling.hoeken).sort().map(([n, k]) => <div key={n}><span>{n} ({Math.round(B * 100)} cm)</span><b>{k}</b></div>)}
            {telling.voet > 0 && <div><span>Baseplate</span><b>{telling.voet}</b></div>}
            {doekenNu.length > 0 && <div><span>Doeken</span><b>{doekenNu.length}</b></div>}
            {!stukken.length && <span className="fm-sub">Nog niets gebouwd.</span>}
            {stukken.length > 0 && <div><span>Gewicht (± incl. blokken en baseplates)</span><b>{telling.kg} kg</b></div>}
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
