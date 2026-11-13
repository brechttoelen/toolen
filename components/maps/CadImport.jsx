'use client';

// CAD-plan van een leverancier (PDF uit AutoCAD/BricsCAD, of DXF) importeren als
// object in het plan: pagina kiezen, uitsnede, opschonen, schaal zetten.

import { useEffect, useMemo, useRef, useState } from 'react';
import Info from './info';
import { pdfVectoren, schoonOp, naarTekening } from './cadpdf';
import { leesDxf } from './dxf';
import { cadTekst, isCad } from './cad';

const PT_MM = 25.4 / 72; // 1 PDF-punt in mm op papier
// Het object wordt met al zijn lijnen in het plan bewaard en bij elke kaartbeweging hertekend: daarom een grens.
const MAX = 20000;
// De eenheid in de kop van een DXF of DWG klopt vaak niet met hoe er getekend is: daarom zelf te kiezen.
const EENHEDEN = [[0.001, 'Millimeter'], [0.01, 'Centimeter'], [0.1, 'Decimeter'], [1, 'Meter'], [0.0254, 'Inch'], [0.3048, 'Voet']];

async function pdfjsLaden() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjs;
}
const kaderVan = (paden) => {
  let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity;
  for (const p of paden) for (const [x, y] of p.pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
};
const getal = (v, n = 2) => String(Math.round(v * 10 ** n) / 10 ** n).replace('.', ',');

export default function CadImport({ onSluit, onKlaar, vervang = null }) {
  const [bron, setBron] = useState(null);         // { soort, naam, doc, paginas, eenheidM }
  const [pagina, setPagina] = useState(1);
  const [paden, setPaden] = useState([]);         // ruwe paden in broncoördinaten (y naar boven)
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const [uit, setUit] = useState(new Set());      // kleuren/lagen die weg zijn
  const [min, setMin] = useState(1.5);            // kleinste afmeting (bron-eenheden)
  const [kader, setKader] = useState(null);
  const [gewist, setGewist] = useState(new Set());
  const [tool, setTool] = useState('hand');
  const [meet, setMeet] = useState([]);           // 2 punten voor de schaal
  const [meetMm, setMeetMm] = useState('');
  const [mPerE, setMPerE] = useState(null);       // meter per bron-eenheid
  const [schaalN, setSchaalN] = useState('');
  const [kleur, setKleur] = useState('origineel');
  const [naam, setNaam] = useState(vervang?.naam || '');
  const [leverancier, setLeverancier] = useState(vervang?.leverancier || '');
  const canvasRef = useRef(null);
  const view = useRef({ s: 1, tx: 0, ty: 0 });
  const sleep = useRef(null);
  const [, herteken] = useState(0);

  // ---------- Bestand ----------
  const kiesBestand = async (f) => {
    if (!f) return;
    setFout(''); setBezig('Bestand lezen…'); setPaden([]); setKader(null); setGewist(new Set()); setUit(new Set()); setMeet([]);
    try {
      if (isCad(f.name)) {
        const d = leesDxf(await cadTekst(f));
        const p = d.lijnen.map((l) => ({ pts: l.c, k: l.laag, d: 0 }));
        // Zonder eenheid in het bestand: grote getallen zijn bijna altijd millimeter.
        const breed = Math.max(d.kader[2] - d.kader[0], d.kader[3] - d.kader[1]);
        const e = d.eenheid && d.eenheid !== 1 ? d.eenheid : breed > 2000 ? 0.001 : 1;
        setBron({ soort: 'dxf', naam: f.name, paginas: 1, eenheidM: e });
        setMPerE(e); setMin(0);
        if (!naam) setNaam(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60));
        setPaden(p);
      } else {
        const pdfjs = await pdfjsLaden();
        const doc = await pdfjs.getDocument({ data: await f.arrayBuffer(), disableFontFace: true }).promise;
        setBron({ soort: 'pdf', naam: f.name, doc, pdfjs, paginas: doc.numPages });
        setMPerE(null); setMin(1.5);
        if (!naam) setNaam(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60));
        await laadPagina(doc, pdfjs, 1);
      }
    } catch (e) { setFout(e?.message || String(e)); }
    setBezig('');
  };
  const laadPagina = async (doc, pdfjs, n) => {
    setBezig(`Pagina ${n} lezen…`); setKader(null); setGewist(new Set()); setMeet([]);
    const p = await doc.getPage(n);
    const v = await pdfVectoren(p, pdfjs);
    setPagina(n); setPaden(v);
    setBezig('');
  };

  const groepen = useMemo(() => {
    const m = new Map();
    for (const p of paden) m.set(p.k, (m.get(p.k) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [paden]);
  const zicht = useMemo(() => {
    const s = schoonOp(paden, { kader, uitKleuren: uit, minPt: min });
    return gewist.size ? s.filter((p) => !gewist.has(p)) : s;
  }, [paden, kader, uit, min, gewist]);

  // Beeld passend maken als er een nieuwe pagina is.
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !paden.length) return;
    const [a, b, c, d] = kaderVan(paden);
    const s = Math.min(cv.width / (c - a || 1), cv.height / (d - b || 1)) * 0.95;
    view.current = { s, tx: (cv.width - (c - a) * s) / 2 - a * s, ty: cv.height - (cv.height - (d - b) * s) / 2 + b * s };
    herteken((x) => x + 1);
  }, [paden]);

  // ---------- Tekenen ----------
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const { s, tx, ty } = view.current;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
    const X = (x) => tx + x * s; const Y = (y) => ty - y * s;
    // wat weg is, licht grijs
    ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1; ctx.beginPath();
    const zSet = new Set(zicht);
    let n = 0;
    for (const p of paden) { if (zSet.has(p)) continue; if (++n > 40000) break; p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); }
    ctx.stroke();
    ctx.lineWidth = 1;
    let huidig = null;
    for (const p of zicht) {
      const k = kleur === 'origineel' ? (bron?.soort === 'dxf' ? '#1d1d1b' : p.k === '#ffffff' ? '#1d1d1b' : p.k) : kleur === 'zwart' ? '#1d1d1b' : kleur;
      if (k !== huidig) { if (huidig) ctx.stroke(); ctx.strokeStyle = k; ctx.beginPath(); huidig = k; }
      p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      if (p.dicht) ctx.closePath();
    }
    if (huidig) ctx.stroke();
    if (kader) { ctx.strokeStyle = '#E11D48'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(X(kader[0]), Y(kader[3]), (kader[2] - kader[0]) * s, (kader[3] - kader[1]) * s); ctx.setLineDash([]); }
    const sl = sleep.current;
    if (sl?.rect) { ctx.strokeStyle = tool === 'gom' ? '#D97706' : '#E11D48'; ctx.lineWidth = 1.5; ctx.strokeRect(Math.min(sl.x0, sl.x1), Math.min(sl.y0, sl.y1), Math.abs(sl.x1 - sl.x0), Math.abs(sl.y1 - sl.y0)); }
    if (meet.length) {
      ctx.fillStyle = '#2563EB'; ctx.strokeStyle = '#2563EB'; ctx.lineWidth = 2;
      ctx.beginPath(); meet.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
      for (const [x, y] of meet) { ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, Math.PI * 2); ctx.fill(); }
    }
  });

  // ---------- Muis ----------
  const wereld = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) * canvasRef.current.width) / r.width; const sy = ((e.clientY - r.top) * canvasRef.current.height) / r.height;
    const { s, tx, ty } = view.current;
    return { sx, sy, x: (sx - tx) / s, y: (ty - sy) / s };
  };
  const snap = (x, y) => {
    // dichtste hoekpunt binnen 8 px
    const r = 8 / view.current.s; let best = null; let bd = r * r;
    for (const p of zicht) for (const [px, py] of p.pts) { const d2 = (px - x) ** 2 + (py - y) ** 2; if (d2 < bd) { bd = d2; best = [px, py]; } }
    return best || [x, y];
  };
  const neer = (e) => {
    const w = wereld(e);
    if (tool === 'meet') { const p = snap(w.x, w.y); setMeet((m) => (m.length >= 2 ? [p] : [...m, p])); return; }
    sleep.current = { ...w, x0: w.sx, y0: w.sy, x1: w.sx, y1: w.sy, tx: view.current.tx, ty: view.current.ty, rect: tool === 'kader' || tool === 'gom' };
  };
  const beweeg = (e) => {
    const sl = sleep.current; if (!sl) return;
    const w = wereld(e);
    if (tool === 'hand') { view.current = { ...view.current, tx: sl.tx + (w.sx - sl.x0), ty: sl.ty + (w.sy - sl.y0) }; }
    else { sl.x1 = w.sx; sl.y1 = w.sy; }
    herteken((x) => x + 1);
  };
  const op = (e) => {
    const sl = sleep.current; sleep.current = null; if (!sl) return;
    const w = wereld(e);
    if (sl.rect) {
      const klik = Math.abs(w.sx - sl.x0) < 4 && Math.abs(w.sy - sl.y0) < 4;
      const r = [Math.min(sl.x, w.x), Math.min(sl.y, w.y), Math.max(sl.x, w.x), Math.max(sl.y, w.y)];
      if (tool === 'kader' && !klik) setKader(r);
      if (tool === 'gom') {
        const n = new Set(gewist);
        if (klik) {
          // één lijn: de dichtste bij de klik
          let best = null; let bd = (10 / view.current.s) ** 2;
          for (const p of zicht) for (let i = 0; i < p.pts.length; i++) { const d2 = (p.pts[i][0] - w.x) ** 2 + (p.pts[i][1] - w.y) ** 2; if (d2 < bd) { bd = d2; best = p; } }
          if (best) n.add(best);
        } else for (const p of zicht) if (p.pts.every(([x, y]) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3])) n.add(p);
        setGewist(n);
      }
    }
    herteken((x) => x + 1);
  };
  const wiel = (e) => {
    e.preventDefault();
    const w = wereld(e); const f = e.deltaY < 0 ? 1.25 : 0.8;
    const { s, tx, ty } = view.current;
    view.current = { s: s * f, tx: w.sx - (w.sx - tx) * f, ty: w.sy - (w.sy - ty) * f };
    herteken((x) => x + 1);
  };
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    cv.addEventListener('wheel', wiel, { passive: false });
    return () => cv.removeEventListener('wheel', wiel);
  });

  // ---------- Schaal ----------
  const meetAfstand = meet.length === 2 ? Math.hypot(meet[1][0] - meet[0][0], meet[1][1] - meet[0][1]) : 0;
  const zetMeet = () => { const mm = Number(String(meetMm).replace(',', '.')); if (meetAfstand > 0 && mm > 0) { setMPerE(mm / 1000 / meetAfstand); setSchaalN(''); setTool('hand'); } };
  const zetSchaalN = (v) => { setSchaalN(v); const n = Number(String(v).replace(',', '.')); if (n > 0 && bron?.soort === 'pdf') setMPerE((n * PT_MM) / 1000); };
  const maat = useMemo(() => {
    if (!mPerE || !zicht.length) return null;
    const [a, b, c, d] = kaderVan(zicht);
    return [(c - a) * mPerE, (d - b) * mPerE];
  }, [zicht, mPerE]);
  const minEcht = mPerE ? min * mPerE * 100 : null; // cm

  const bewaar = () => {
    if (!mPerE || !zicht.length || !naam.trim()) return;
    const tk = naarTekening(zicht, mPerE, { kleur: kleur === 'origineel' ? (bron.soort === 'dxf' ? '#1d1d1b' : null) : kleur === 'zwart' ? '#1d1d1b' : kleur, max: MAX });
    delete tk.afgekapt;
    onKlaar({ naam: naam.trim(), leverancier: leverancier.trim() || null, tekening: tk, cad: { bestand: bron.naam, pagina: bron.soort === 'pdf' ? pagina : null, ingeladen: new Date().toISOString().slice(0, 10), lijnen: Math.min(zicht.length, MAX) } });
  };

  const te = zicht.length > MAX;
  return (
    <div className="fm-dialoog-achter">
      <section className="fm-dialoog fm" role="dialog" aria-label="CAD-plan importeren" style={{ width: 'min(1200px, 100%)' }}>
        <header><h2>{vervang ? `Nieuwe versie · ${vervang.naam}` : 'CAD-plan als object'}<Info>Een plan van een leverancier (stellingbouwer, podiumbouwer, VIP-tentenbouwer) als één object in je plan. Werkt met een PDF uit AutoCAD of BricsCAD (lijnen, geen scan) of een DXF. Kies de pagina met het bovenaanzicht, maak een uitsnede, gom weg wat je niet nodig hebt en zet de schaal met een gekende maat.</Info></h2><button className="fm-knop" onClick={onSluit}>Sluiten</button></header>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 270px', gap: 16, padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="fm-knop klein zwart" style={{ cursor: 'pointer' }}>{bron ? 'Ander bestand' : 'Kies PDF, DXF of DWG'}<input type="file" accept=".pdf,.dxf,.dwg,application/pdf" style={{ display: 'none' }} onChange={(e) => kiesBestand(e.target.files?.[0])} /></label>
              {bron?.soort === 'pdf' && bron.paginas > 1 && (
                <select value={pagina} onChange={(e) => laadPagina(bron.doc, bron.pdfjs, Number(e.target.value))} style={{ height: 26 }} aria-label="Pagina">
                  {Array.from({ length: bron.paginas }, (_, i) => <option key={i} value={i + 1}>Pagina {i + 1}</option>)}
                </select>
              )}
              {paden.length > 0 && (
                <div className="fm-segment">
                  {[['hand', 'Verschuiven'], ['kader', 'Uitsnede'], ['gom', 'Gom'], ['meet', 'Schaal meten']].map(([k, t]) => <button key={k} className={tool === k ? 'aan' : ''} onClick={() => setTool(k)}>{t}</button>)}
                </div>
              )}
              {bezig && <span className="fm-sub">{bezig}</span>}
            </div>
            <canvas ref={canvasRef} width={900} height={600} style={{ width: '100%', aspectRatio: '3 / 2', border: '1px solid #e8e8e6', background: '#fff', cursor: tool === 'hand' ? 'grab' : 'crosshair', touchAction: 'none' }}
              onMouseDown={neer} onMouseMove={beweeg} onMouseUp={op} onMouseLeave={() => { sleep.current = null; }} />
            <div className="fm-sub">
              {!paden.length ? 'Kies een bestand.' : {
                hand: 'Sleep om te verschuiven, scroll om te zoomen.',
                kader: 'Trek een kader rond het bovenaanzicht; alles erbuiten valt weg (titelblok, andere aanzichten).',
                gom: 'Klik op een lijn of trek een kader: wat er volledig in ligt, gaat weg (maatlijnen, teksten).',
                meet: 'Klik twee punten waarvan je de maat kent (bv. een maatlijn van 4144 mm) en vul die in.',
              }[tool]}
            </div>
            {fout && <div className="fm-melding fout">{fout}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paden.length > 0 && (
              <>
                <div className="fm-kop">Schaal{mPerE ? ' ✓' : ''}</div>
                {bron?.soort === 'dxf' && (
                  <label className="fm-veld">Eenheid in de tekening
                    <select value={EENHEDEN.some(([v]) => v === mPerE) ? mPerE : ''} onChange={(e) => { const v = Number(e.target.value); if (v > 0) setMPerE(v); }}>
                      {!EENHEDEN.some(([v]) => v === mPerE) && <option value="">Gemeten</option>}
                      {EENHEDEN.map(([v, t]) => <option key={v} value={v}>{t}{v === bron.eenheidM ? ' · volgens het bestand' : ''}</option>)}
                    </select>
                  </label>
                )}
                {bron?.soort === 'pdf' && (
                  <label className="fm-veld">Schaal van de tekening (1:…)<input value={schaalN} inputMode="decimal" placeholder="bv. 200" onChange={(e) => zetSchaalN(e.target.value)} /></label>
                )}
                {tool === 'meet' && meet.length === 2 && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'end' }}>
                    <label className="fm-veld" style={{ flex: 1 }}>Echte maat (mm)<input autoFocus value={meetMm} inputMode="decimal" onChange={(e) => setMeetMm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && zetMeet()} /></label>
                    <button className="fm-knop klein zwart" onClick={zetMeet}>Zet</button>
                  </div>
                )}
                {!mPerE && <div className="fm-sub" style={{ color: '#8A4D00' }}>Nog geen schaal: vul 1:… in (titelblok) of gebruik Schaal meten.</div>}
                {maat && <div className="fm-sub">Object: {getal(maat[0], 1)} × {getal(maat[1], 1)} m</div>}

                <div className="fm-kop">Opschonen</div>
                <label className="fm-veld">Kleine details weg{minEcht != null ? ` · kleiner dan ${getal(minEcht, 0)} cm` : ''}
                  <input type="range" min="0" max={bron?.soort === 'dxf' ? 500 : 8} step={bron?.soort === 'dxf' ? 10 : 0.25} value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ padding: 0, border: 0 }} />
                </label>
                {groepen.length > 1 && (
                  <details className="fm-meer" open={groepen.length < 12}>
                    <summary>{bron?.soort === 'dxf' ? 'Lagen' : 'Kleuren'} · {groepen.length - uit.size} aan</summary>
                    <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {groepen.map(([k, n]) => (
                        <label key={k} className="fm-vink" style={{ fontSize: 11.5 }}>
                          <input type="checkbox" checked={!uit.has(k)} onChange={() => { const s = new Set(uit); if (s.has(k)) s.delete(k); else s.add(k); setUit(s); }} />
                          {bron?.soort !== 'dxf' && <span style={{ width: 12, height: 12, background: k, border: '1px solid #ccc' }} />}
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span><span className="fm-sub">{n}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {kader && <button className="fm-knop klein" onClick={() => setKader(null)}>Uitsnede weg</button>}
                  {gewist.size > 0 && <button className="fm-knop klein" onClick={() => setGewist(new Set())}>Gom ongedaan ({gewist.size})</button>}
                </div>
                <label className="fm-veld">Kleur op de kaart
                  <select value={kleur} onChange={(e) => setKleur(e.target.value)}>
                    <option value="origineel">Zoals in het bestand</option>
                    <option value="zwart">Zwart</option>
                    <option value="#2563EB">Blauw</option>
                    <option value="#E11D48">Rood</option>
                    <option value="#7C3AED">Paars</option>
                  </select>
                </label>
                <div className="fm-sub" style={{ color: te ? '#B91C1C' : undefined }}>{zicht.length} lijnen{te ? ` · te veel, maximaal ${MAX}: maak een kleinere uitsnede of haal meer details weg` : ''}</div>

                <div className="fm-kop">Object</div>
                <label className="fm-veld">Naam<input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Podium Stageco RVV" /></label>
                <label className="fm-veld">Leverancier<input value={leverancier} onChange={(e) => setLeverancier(e.target.value)} placeholder="Stageco, Gigant, VSS…" /></label>
                <button className="fm-knop rood vol" disabled={!mPerE || !zicht.length || !naam.trim() || te} onClick={bewaar}>{vervang ? 'Versie vervangen' : 'In het plan zetten'}</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
