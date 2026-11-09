'use client';

// Vloer leggen bij de tent: bovenaanzicht met raster, losse vloerelementen (vlonders, podiumelementen, rijplaten …)
// slepen en plaatsen. Stukken klikken vast aan het raster (0,5 m), aan de tent en aan elkaar.
// Stuk = { id, el, x, y, b, d, h, kleur } (midden in tent-lokale meters, b langs de lengte van de tent).
import { useEffect, useRef, useState } from 'react';
import { isVloerStuk, stukKleur, isTentBouw, tentTypeVan } from './tentbouw';

const RAND = 8; const RASTER = 0.5; const KLEEF = 0.35;
const getal = (v, d = 2) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: d });
const nieuwId = () => Math.random().toString(36).slice(2, 10);
const r2 = (x) => Math.round(x * 1000) / 1000;
const overlapt = (a, b) => Math.abs(a.x - b.x) < (a.b + b.b) / 2 - 0.01 && Math.abs(a.y - b.y) < (a.d + b.d) / 2 - 0.01;

// Midden zo leggen dat de randen aan iets kleven (tent, andere stukken), anders aan het raster.
function kleef(s, m, anderen, extra = [], afst = KLEEF) {
  const xs = [0, m.L]; const ys = [0, m.B];
  for (const [a0, b0, a1, b1] of extra) { xs.push(a0, a1); ys.push(b0, b1); }
  for (const o of anderen) { xs.push(o.x - o.b / 2, o.x + o.b / 2); ys.push(o.y - o.d / 2, o.y + o.d / 2); }
  const as = (c, half, lijst) => {
    let best = null;
    for (const v of lijst) for (const kant of [-1, 1]) { const rnd = c + kant * half; const dd = Math.abs(rnd - v); if (dd < afst && (!best || dd < best.dd)) best = { dd, c: v - kant * half }; }
    return best ? best.c : Math.round((c - half) / RASTER) * RASTER + half;
  };
  return { ...s, x: r2(as(s.x, s.b / 2, xs)), y: r2(as(s.y, s.d / 2, ys)) };
}

// Maat van een nieuwe tent als blok: lengte (in traveeën bij kader en booghal) × overspanning.
export const tentBlokMaat = (e, lengte) => {
  const t = tentTypeVan(e); const travee = Number(e?.breedte_m) || 5; const B = Number(e?.diepte_m) || 5;
  const modul = t === 'kader' || t === 'boog' || t === 'pagode';
  const L = modul ? Math.max(1, Math.round((Number(lengte) || travee) / travee)) * travee : travee;
  return { L, B, modul, travee };
};

export function VloerPalet({ elementen, schrijven, kies, setKies, hNieuw, setHNieuw, tentKies = null, setTentKies = null, tentLengte = 10, setTentLengte = null, dwars = false, setDwars = null, metTenten = false }) {
  const lijst = elementen.filter(isVloerStuk)
    .sort((a, b) => (a.eigenschappen?.materiaal || '').localeCompare(b.eigenschappen?.materiaal || '', 'nl') || (Number(a.breedte_m) * Number(a.diepte_m)) - (Number(b.breedte_m) * Number(b.diepte_m)));
  const tenten = metTenten ? elementen.filter(isTentBouw).sort((a, b) => a.naam.localeCompare(b.naam, 'nl')) : [];
  const tk = tentKies && tenten.find((e) => e.id === tentKies);
  return (
    <div className="fm-tv-palet">
      <div className="fm-sub" style={{ margin: '0 0 4px' }}>Sleep een vloer of een tent op het grondplan, of kies er een en klik. Alles klikt vast aan de tent en aan elkaar.</div>
      <div className="fm-tv-stukken">
        {lijst.map((e) => (
          <button key={e.id} type="button" draggable={schrijven} disabled={!schrijven} className={kies === e.id ? 'aan' : ''} title={`${e.naam}: sleep op het vloerplan`}
            onDragStart={(ev) => { ev.dataTransfer.setData('text/fm-tentvloer', e.id); ev.dataTransfer.effectAllowed = 'copy'; }} onClick={() => { setKies(kies === e.id ? null : e.id); setTentKies?.(null); }}>
            <span className="fm-tv-staal" style={{ background: stukKleur(e), width: Math.max(8, Math.min(40, Number(e.breedte_m) * 6)), height: Math.max(5, Math.min(22, Number(e.diepte_m) * 6)) }} />
            <span>{e.naam}</span>
          </button>
        ))}
        {!lijst.length && <div className="fm-sub">Geen vloerelementen gevonden.</div>}
      </div>
      <label className="fm-veld">Hoogte van nieuwe stukken (m, 0 = op de grond)<input type="number" step="0.05" min="0" max="2" disabled={!schrijven} value={hNieuw} onChange={(e) => setHNieuw(e.target.value)} /></label>
      {tenten.length > 0 && <>
        <div className="fm-kop" style={{ marginTop: 6 }}>Tenten</div>
        <div className="fm-sub">Een tent ernaast: sleep ze tegen een zijde. Ze komt op het plan en koppelt vanzelf.</div>
        <div className="fm-tv-stukken">
          {tenten.map((e) => { const mt = tentBlokMaat(e, tentLengte); return (
            <button key={e.id} type="button" draggable={schrijven} disabled={!schrijven} className={tentKies === e.id ? 'aan' : ''} title={`${e.naam}: sleep op het grondplan`}
              onDragStart={(ev) => { ev.dataTransfer.setData('text/fm-tentblok', e.id); ev.dataTransfer.effectAllowed = 'copy'; }} onClick={() => { setTentKies?.(tentKies === e.id ? null : e.id); setKies(null); }}>
              <span className="fm-tv-staal" style={{ background: '#F3F4F6', width: Math.max(10, Math.min(40, (dwars ? mt.B : mt.L) * 1.6)), height: Math.max(8, Math.min(22, (dwars ? mt.L : mt.B) * 1.6)) }} />
              <span>{e.naam}</span>
            </button>
          ); })}
        </div>
        <div className="fm-sb-rij">
          <label className="fm-veld" style={{ flex: 1 }}>Lengte (m){tk && tentBlokMaat(tk, tentLengte).modul ? `, per ${getal(tentBlokMaat(tk, tentLengte).travee)} m` : ''}<input type="number" step="1" min="3" max="100" disabled={!schrijven} value={tentLengte} onChange={(e) => setTentLengte?.(e.target.value)} /></label>
          <label className="fm-vink"><input type="checkbox" checked={dwars} onChange={(e) => setDwars?.(e.target.checked)} />Dwars</label>
        </div>
      </>}
    </div>
  );
}

export default function TentVloerPlan({ m, stukken = [], elementen = [], schrijven, onZet, kiesEl = null, hNieuw = 0, buren = [], tentEl = null, tentLengte = 10, dwars = false, onTent = null, maat = null, onMaat = null, onBuur = null }) {
  const svg = useRef(null); const [sel, setSel] = useState([]); const [sleep, setSleep] = useState(null); const [kader, setKader] = useState(null);
  const elOp = (id) => elementen.find((e) => e.id === id);
  const lijst0 = sleep?.pos ? stukken.map((s) => (sleep.pos[s.id] ? { ...s, ...sleep.pos[s.id] } : s)) : stukken;
  // Andere tenten van de groep (in de assen van deze tent) en hun omhullende om aan te kleven.
  const burenBox = buren.map((h) => { const xs = h.map((p) => p[0]); const ys = h.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
  const ax = [0, m.L, ...burenBox.flatMap((b) => [b[0], b[2]])]; const ay = [0, m.B, ...burenBox.flatMap((b) => [b[1], b[3]])];
  // Raster ruim rond de tent (om vloer en tenten ernaast te leggen); het zicht past eerst op tent + 8 m en zoomt met het wiel.
  const ruim = Math.max(20, Math.max(m.L, m.B));
  const x0 = Math.min(...ax) - ruim; const y0 = Math.min(...ay) - ruim; const W = Math.max(...ax) + ruim - x0; const H = Math.max(...ay) + ruim - y0;
  const pas0 = [Math.min(...ax) - RAND, Math.min(...ay) - RAND, Math.max(...ax) - Math.min(...ax) + 2 * RAND, Math.max(...ay) - Math.min(...ay) + 2 * RAND];
  const [zicht, setZicht] = useState(null); const vb = zicht || pas0; const panRef = useRef(null);
  useEffect(() => {
    const el = svg.current; if (!el) return undefined;
    const wiel = (e) => {
      e.preventDefault(); const p = naarM(e); const [vx, vy, vw, vh] = zicht || pas0;
      const muiswiel = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || e.metaKey || muiswiel) {
        // Zoomen rond de muis (knijpen op het trackpad = ctrl + wiel).
        const f = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * (e.ctrlKey ? 0.01 : e.deltaMode === 1 ? 0.05 : 0.002)))); const nw = Math.max(4, Math.min(W * 1.2, vw * f)); const k = nw / vw;
        setZicht([p[0] - (p[0] - vx) * k, p[1] - (p[1] - vy) * k, nw, vh * k]);
      } else { const sc = vw / el.clientWidth; setZicht([vx + e.deltaX * sc, vy + e.deltaY * sc, vw, vh]); }
    };
    el.addEventListener('wheel', wiel, { passive: false }); return () => el.removeEventListener('wheel', wiel);
  });
  const [spook, setSpook] = useState(null);
  const tentBlok = (elId, [x, y]) => { const e = elOp(elId); if (!e) return null; const mt = tentBlokMaat(e, tentLengte); const b = dwars ? mt.B : mt.L; const d = dwars ? mt.L : mt.B;
    return { ...kleef({ x, y, b, d }, m, [], burenBox, 1.5), el: e.id, L: mt.L, B: mt.B, dwars }; };
  const zetTent = (blok) => { if (!blok || !onTent) return; const vrij = ![...burenBox, [0, 0, m.L, m.B]].some((q) => blok.x - blok.b / 2 < q[2] - 0.05 && blok.x + blok.b / 2 > q[0] + 0.05 && blok.y - blok.d / 2 < q[3] - 0.05 && blok.y + blok.d / 2 > q[1] + 0.05);
    if (!vrij && !window.confirm('Deze tent overlapt een andere tent. Toch plaatsen?')) return; onTent(blok); };
  const naarM = (e) => { const p = svg.current.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.current.getScreenCTM().inverse()); return [q.x, q.y]; };
  const opStuk = ([x, y]) => [...lijst].reverse().find((s) => Math.abs(x - s.x) <= s.b / 2 && Math.abs(y - s.y) <= s.d / 2);
  const nieuwStuk = (elId, [x, y]) => {
    const e = elOp(elId); if (!e) return null; const b = Number(e.breedte_m) || 2; const d = Number(e.diepte_m) || 1;
    return kleef({ id: nieuwId(), el: e.id, x, y, b, d, h: Math.max(0, Number(hNieuw) || 0), kleur: stukKleur(e) }, m, stukken, burenBox);
  };
  const leg = (s) => { onZet([...stukken, s]); setSel([s.id]); };
  const pas = (id, patch) => onZet(stukken.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const pasAlle = (ids, patch) => onZet(stukken.map((s) => (ids.includes(s.id) ? { ...s, ...patch } : s)));
  const weg = (ids) => { onZet(stukken.filter((s) => !ids.includes(s.id))); setSel((x) => x.filter((id) => !ids.includes(id))); };
  // Draaien: één stuk om zijn midden; een selectie als geheel om het midden van de selectie.
  const draai = (ids) => {
    const ss = stukken.filter((x) => ids.includes(x.id)); if (!ss.length) return;
    if (ss.length === 1) { const s0 = ss[0]; pas(s0.id, kleef({ ...s0, b: s0.d, d: s0.b }, m, stukken.filter((x) => x.id !== s0.id))); return; }
    const bx = [Math.min(...ss.map((q) => q.x - q.b / 2)), Math.min(...ss.map((q) => q.y - q.d / 2)), Math.max(...ss.map((q) => q.x + q.b / 2)), Math.max(...ss.map((q) => q.y + q.d / 2))];
    const cx = (bx[0] + bx[2]) / 2; const cy = (bx[1] + bx[3]) / 2; const cxn = Math.round((cx - (bx[3] - bx[1]) / 2) / RASTER) * RASTER + (bx[3] - bx[1]) / 2;
    const nieuw = new Map(ss.map((q) => [q.id, { b: q.d, d: q.b, x: r2(cxn - (q.y - cy)), y: r2(cy + (q.x - cx)) }]));
    onZet(stukken.map((q) => (nieuw.has(q.id) ? { ...q, ...nieuw.get(q.id) } : q)));
  };
  // Een kopie ernaast (richting = [dx, dy]); bij een selectie schuift de hele groep mee.
  const ernaast = (ids, [dx, dy]) => {
    const ss = stukken.filter((x) => ids.includes(x.id)); if (!ss.length) return;
    const bw = Math.max(...ss.map((q) => q.x + q.b / 2)) - Math.min(...ss.map((q) => q.x - q.b / 2)); const bh = Math.max(...ss.map((q) => q.y + q.d / 2)) - Math.min(...ss.map((q) => q.y - q.d / 2));
    const n = ss.map((q) => ({ ...q, id: nieuwId(), x: r2(q.x + dx * bw), y: r2(q.y + dy * bh) })); onZet([...stukken, ...n]); setSel(n.map((q) => q.id));
  };
  // Zone tekenen met een gekozen vloer: enkel hele elementen, in de stand die het minst afval geeft.
  const [zone, setZone] = useState(null); const [rek, setRek] = useState(null);
  const zoneStukken = (z) => {
    const e = elOp(z.el); if (!e) return [];
    const a0 = Math.min(z.a[0], z.b[0]); const a1 = Math.max(z.a[0], z.b[0]); const b0 = Math.min(z.a[1], z.b[1]); const b1 = Math.max(z.a[1], z.b[1]);
    const w = a1 - a0; const h = b1 - b0; const B0 = Number(e.breedte_m) || 2; const D0 = Number(e.diepte_m) || 1;
    const stand = (b, d) => { const nx = Math.max(1, Math.round(w / b)); const ny = Math.max(1, Math.round(h / d)); return { b, d, nx, ny, fout: Math.abs(nx * b - w) + Math.abs(ny * d - h) }; };
    const st0 = [stand(B0, D0), stand(D0, B0)].sort((x, y) => x.fout - y.fout)[0];
    // Hoek waar je begon kleeft aan de tent of aan een stuk; daar vandaan wordt gevuld.
    const sx = z.b[0] >= z.a[0] ? 1 : -1; const sy = z.b[1] >= z.a[1] ? 1 : -1;
    const hoek = kleef({ x: z.a[0] + sx * st0.b / 2, y: z.a[1] + sy * st0.d / 2, b: st0.b, d: st0.d }, m, stukken, burenBox);
    const uit = [];
    for (let i = 0; i < st0.nx; i++) for (let j = 0; j < st0.ny; j++) {
      const c = { id: nieuwId(), el: e.id, x: r2(hoek.x + sx * i * st0.b), y: r2(hoek.y + sy * j * st0.d), b: st0.b, d: st0.d, h: Math.max(0, Number(hNieuw) || 0), kleur: stukKleur(e) };
      if (!stukken.some((o) => overlapt(o, c))) uit.push(c);
    }
    return uit;
  };
  // Tent groter of kleiner: lengte per travee, breedte enkel in de maten die er bestaan.
  const rekMaat = (k, p) => {
    if (!maat) return null; let L = m.L; let B = m.B; let x0 = 0; let y0 = 0; let el = null;
    if (k === 'A' || k === 'V') { const raw = k === 'A' ? p[0] : m.L - p[0]; L = Math.max(maat.travee, Math.round(raw / maat.travee) * maat.travee); if (maat.vastL) L = m.L; x0 = k === 'V' ? m.L - L : 0; }
    else { const raw = k === 'R' ? p[1] : m.B - p[1]; const keuze = [...maat.breedtes].sort((a, b) => Math.abs(a.B - raw) - Math.abs(b.B - raw))[0]; if (keuze) { B = keuze.B; el = keuze.el; } y0 = k === 'L' ? m.B - B : 0; }
    return { k, L, B, x0, y0, el };
  };
  // Hoekjes van een selectie (één soort stuk): groter of kleiner slepen, altijd in hele elementen.
  const [hoekSleep, setHoekSleep] = useState(null);
  const selStukken = stukken.filter((q) => sel.includes(q.id));
  const gelijk1 = selStukken.length > 0 && selStukken.every((q) => q.el === selStukken[0].el && q.b === selStukken[0].b && q.d === selStukken[0].d);
  const selBox = selStukken.length ? [Math.min(...selStukken.map((q) => q.x - q.b / 2)), Math.min(...selStukken.map((q) => q.y - q.d / 2)), Math.max(...selStukken.map((q) => q.x + q.b / 2)), Math.max(...selStukken.map((q) => q.y + q.d / 2))] : null;
  const hoekRaster = (vast, p) => {
    const s0 = selStukken[0]; const sx = p[0] >= vast[0] ? 1 : -1; const sy = p[1] >= vast[1] ? 1 : -1;
    const nx = Math.max(1, Math.round(Math.abs(p[0] - vast[0]) / s0.b)); const ny = Math.max(1, Math.round(Math.abs(p[1] - vast[1]) / s0.d));
    const anderen = stukken.filter((q) => !sel.includes(q.id)); const uit = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const c = { ...s0, id: nieuwId(), x: r2(vast[0] + sx * (i + 0.5) * s0.b), y: r2(vast[1] + sy * (j + 0.5) * s0.d) };
      if (!anderen.some((o) => overlapt(o, c))) uit.push(c);
    }
    return uit;
  };
  const hoekNeer = (vast) => (e) => { if (e.button !== 0 || !schrijven) return; e.stopPropagation(); setHoekSleep({ vast, lijst: hoekRaster(vast, naarM(e)) }); svg.current.setPointerCapture?.(e.pointerId); };
  const lijst = hoekSleep ? [...lijst0.filter((q) => !sel.includes(q.id)), ...hoekSleep.lijst] : lijst0;
  // Alt + klik: vullen van het gekozen stuk tot hier, in rijen en kolommen van dat stuk.
  const vul = (id, [x, y]) => {
    const s = stukken.find((q) => q.id === id); if (!s) return;
    const ni = Math.round((x - s.x) / s.b); const nj = Math.round((y - s.y) / s.d); const nieuw = [];
    for (let i = Math.min(0, ni); i <= Math.max(0, ni); i++) for (let j = Math.min(0, nj); j <= Math.max(0, nj); j++) {
      if (!i && !j) continue; const c = { ...s, id: nieuwId(), x: r2(s.x + i * s.b), y: r2(s.y + j * s.d) };
      if (![...stukken, ...nieuw].some((o) => overlapt(o, c))) nieuw.push(c);
    }
    if (nieuw.length) onZet([...stukken, ...nieuw]);
  };

  // Shift + klik = stuk bij de selectie (of eruit); Shift + slepen op een lege plek = kader om meerdere te kiezen.
  const neer = (e) => {
    if (e.button === 1) { e.preventDefault(); panRef.current = { x: e.clientX, y: e.clientY, vb }; svg.current.setPointerCapture?.(e.pointerId); return; }
    if (e.button === 2) return; const p = naarM(e); const s = opStuk(p);
    if (s && e.shiftKey) { setSel((x) => (x.includes(s.id) ? x.filter((id) => id !== s.id) : [...x, s.id])); return; }
    if (s) {
      const groep = sel.includes(s.id) ? sel : [s.id]; setSel(groep);
      if (schrijven) { setSleep({ id: s.id, groep, dx: p[0] - s.x, dy: p[1] - s.y, beweegd: false }); svg.current.setPointerCapture?.(e.pointerId); }
      return;
    }
    if (e.shiftKey) { setKader({ a: p, b: p, bij: sel }); svg.current.setPointerCapture?.(e.pointerId); return; }
    if (!schrijven) { setSel([]); return; }
    if (e.altKey && sel.length === 1) { vul(sel[0], p); return; }
    if (tentEl) { zetTent(tentBlok(tentEl, p)); setSpook(null); return; }
    if (kiesEl) { setZone({ el: kiesEl, a: p, b: p }); svg.current.setPointerCapture?.(e.pointerId); return; }
    setSel([]);
  };
  const rekNeer = (k) => (e) => { if (e.button !== 0 || !schrijven) return; e.stopPropagation(); setRek(rekMaat(k, naarM(e))); svg.current.setPointerCapture?.(e.pointerId); };
  const inKader = (k) => { const [a0, a1] = [Math.min(k.a[0], k.b[0]), Math.max(k.a[0], k.b[0])]; const [b0, b1] = [Math.min(k.a[1], k.b[1]), Math.max(k.a[1], k.b[1])];
    return stukken.filter((q) => q.x + q.b / 2 > a0 && q.x - q.b / 2 < a1 && q.y + q.d / 2 > b0 && q.y - q.d / 2 < b1).map((q) => q.id); };
  const beweeg = (e) => {
    if (panRef.current) { const g = panRef.current; const sc = g.vb[2] / svg.current.clientWidth; setZicht([g.vb[0] - (e.clientX - g.x) * sc, g.vb[1] - (e.clientY - g.y) * sc, g.vb[2], g.vb[3]]); return; }
    if (hoekSleep) { setHoekSleep({ ...hoekSleep, lijst: hoekRaster(hoekSleep.vast, naarM(e)) }); return; }
    if (rek) { setRek(rekMaat(rek.k, naarM(e))); return; }
    if (zone) { setZone({ ...zone, b: naarM(e) }); return; }
    if (kader) { const k = { ...kader, b: naarM(e) }; setKader(k); setSel([...new Set([...k.bij, ...inKader(k)])]); return; }
    if (!sleep && tentEl && schrijven) { setSpook(tentBlok(tentEl, naarM(e))); return; }
    if (!sleep) return; const p = naarM(e); const o = stukken.find((q) => q.id === sleep.id); if (!o) return;
    // Het gegrepen stuk kleeft; de rest van de selectie schuift evenveel mee.
    const s0 = kleef({ ...o, x: p[0] - sleep.dx, y: p[1] - sleep.dy }, m, stukken.filter((q) => !sleep.groep.includes(q.id)), burenBox);
    const dx = s0.x - o.x; const dy = s0.y - o.y; const pos = {};
    for (const q of stukken) if (sleep.groep.includes(q.id)) pos[q.id] = { x: r2(q.x + dx), y: r2(q.y + dy) };
    setSleep({ ...sleep, pos, beweegd: true });
  };
  const los = () => {
    if (panRef.current) { panRef.current = null; return; }
    if (hoekSleep) { const g = hoekSleep; setHoekSleep(null); const rest = stukken.filter((q) => !sel.includes(q.id)); onZet([...rest, ...g.lijst]); setSel(g.lijst.map((q) => q.id)); return; }
    if (rek) { const g = rek; setRek(null); if (g.L !== m.L || g.B !== m.B) onMaat?.(g); return; }
    if (zone) {
      const z = zone; setZone(null);
      if (Math.hypot(z.b[0] - z.a[0], z.b[1] - z.a[1]) < 0.4) { const n = nieuwStuk(z.el, z.a); if (n) leg(n); return; }
      const n = zoneStukken(z); if (n.length) { onZet([...stukken, ...n]); setSel(n.map((q) => q.id)); }
      return;
    }
    if (kader) { setKader(null); return; }
    if (!sleep) return; const g = sleep; setSleep(null); if (!g.beweegd) { setSel([g.id]); return; } if (g.pos) onZet(stukken.map((q) => (g.pos[q.id] ? { ...q, ...g.pos[q.id] } : q)));
  };
  const rechts = (e) => { e.preventDefault(); if (!schrijven) return; const s = opStuk(naarM(e)); if (s) weg(sel.includes(s.id) ? sel : [s.id]); };
  const drop = (e) => { e.preventDefault(); if (!schrijven) return; const tb = e.dataTransfer.getData('text/fm-tentblok'); if (tb) { zetTent(tentBlok(tb, naarM(e))); return; } const id = e.dataTransfer.getData('text/fm-tentvloer'); if (!id) return; const n = nieuwStuk(id, naarM(e)); if (n) leg(n); };

  useEffect(() => {
    const kb = (e) => {
      if (!schrijven || e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); e.stopPropagation(); setSel(stukken.map((q) => q.id)); return; }
      if (!sel.length) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); weg(sel); }
      if (e.key === 'r' || e.key === 'R') { e.stopPropagation(); draai(sel); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); e.stopPropagation(); ernaast(sel, [1, 0]); }
      // Pijltjes: de selectie per 0,5 m verschuiven.
      const pijl = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (pijl) { e.preventDefault(); e.stopPropagation(); onZet(stukken.map((q) => (sel.includes(q.id) ? { ...q, x: r2(q.x + pijl[0] * RASTER), y: r2(q.y + pijl[1] * RASTER) } : q))); }
    };
    window.addEventListener('keydown', kb, true); return () => window.removeEventListener('keydown', kb, true);
  });

  const gs = stukken.filter((q) => sel.includes(q.id)); const g = gs.length === 1 ? gs[0] : null; const ge = g ? elOp(g.el) : null;
  const lijnen = [];
  for (let x = Math.ceil(x0 / RASTER) * RASTER; x <= x0 + W + 1e-6; x += RASTER) lijnen.push(<line key={`x${x}`} x1={x} y1={y0} x2={x} y2={y0 + H} stroke={Math.abs(x % 1) < 1e-6 ? '#D1D5DB' : '#EEF0F2'} strokeWidth={0.03} />);
  for (let y = Math.ceil(y0 / RASTER) * RASTER; y <= y0 + H + 1e-6; y += RASTER) lijnen.push(<line key={`y${y}`} x1={x0} y1={y} x2={x0 + W} y2={y} stroke={Math.abs(y % 1) < 1e-6 ? '#D1D5DB' : '#EEF0F2'} strokeWidth={0.03} />);
  const fs = Math.max(0.28, Math.min(0.5, Math.max(W, H) / 60));
  const totaal = lijst.reduce((a, s) => a + s.b * s.d, 0);
  return (
    <div className="fm-tv">
      <div className="fm-tv-vlak"><svg ref={svg} viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid meet" onPointerDown={neer} onPointerMove={beweeg} onPointerUp={los} onPointerCancel={los} onContextMenu={rechts} onDragOver={(e) => e.preventDefault()} onDrop={drop} onPointerLeave={() => setSpook(null)} style={{ touchAction: 'none', cursor: kiesEl || tentEl ? 'copy' : 'default' }}>
        <rect x={x0} y={y0} width={W} height={H} fill="#FAFAF9" />
        {lijnen}
        {buren.map((h, k) => <polygon key={k} points={h.map((p) => p.join(',')).join(' ')} fill="#F3F4F6" stroke="#6B7280" strokeWidth={0.06} strokeDasharray="0.3 0.2" style={{ cursor: onBuur ? 'pointer' : undefined }} onPointerDown={onBuur && !tentEl && !kiesEl ? (e) => { if (e.button === 0 && !e.shiftKey) { e.stopPropagation(); onBuur(k); } } : undefined}><title>Gekoppelde tent: klik om ze te bewerken (en groter te maken)</title></polygon>)}
        <rect x={0} y={0} width={m.L} height={m.B} fill="#E5E7EB" stroke="#374151" strokeWidth={0.08} />
        <text x={m.L / 2} y={m.B / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 1.3} fill="#6B7280" style={{ pointerEvents: 'none' }}>Tent {getal(m.L)} × {getal(m.B)} m</text>
        {[['Voor', -0.6, m.B / 2, -90], ['Achter', m.L + 0.6, m.B / 2, 90], ['Links', m.L / 2, -0.4, 0], ['Rechts', m.L / 2, m.B + 0.75, 0]].map(([n, x, y, a]) => <text key={n} x={x} y={y} textAnchor="middle" fontSize={fs} fill="#9CA3AF" transform={`rotate(${a} ${x} ${y})`} style={{ pointerEvents: 'none' }}>{n}</text>)}
        {lijst.map((s) => {
          const fout = lijst.some((o) => o.id !== s.id && overlapt(o, s)); const aan = sel.includes(s.id);
          return (
            <g key={s.id} style={{ cursor: schrijven ? 'move' : 'pointer' }}>
              <rect x={s.x - s.b / 2} y={s.y - s.d / 2} width={s.b} height={s.d} fill={s.kleur || '#C9A26B'} fillOpacity={0.85} stroke={fout ? '#DC2626' : aan ? '#2563EB' : '#4B3A26'} strokeWidth={aan || fout ? 0.1 : 0.04} />
              {Math.min(s.b, s.d) > 0.6 && Number(s.h) > 0 && <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(fs, s.d * 0.4)} fill="#FFF" style={{ pointerEvents: 'none' }}>{getal(s.h)} m</text>}
            </g>
          );
        })}
        {zone && (() => { const n = zoneStukken(zone); return <g style={{ pointerEvents: 'none' }}>
          {n.map((q) => <rect key={q.id} x={q.x - q.b / 2} y={q.y - q.d / 2} width={q.b} height={q.d} fill={q.kleur} fillOpacity={0.45} stroke="#2563EB" strokeWidth={0.04} />)}
          <rect x={Math.min(zone.a[0], zone.b[0])} y={Math.min(zone.a[1], zone.b[1])} width={Math.abs(zone.b[0] - zone.a[0])} height={Math.abs(zone.b[1] - zone.a[1])} fill="none" stroke="#2563EB" strokeWidth={0.05} strokeDasharray="0.3 0.2" />
          <text x={zone.b[0]} y={zone.b[1] - 0.3} fontSize={fs * 1.1} fill="#1D4ED8">{n.length} stuks</text></g>; })()}
        {rek && <g style={{ pointerEvents: 'none' }}><rect x={rek.x0} y={rek.y0} width={rek.L} height={rek.B} fill="#2563EB" fillOpacity={0.06} stroke="#2563EB" strokeWidth={0.1} strokeDasharray="0.4 0.25" /><text x={rek.x0 + rek.L / 2} y={rek.y0 - 0.4} textAnchor="middle" fontSize={fs * 1.2} fill="#1D4ED8">{getal(rek.L)} × {getal(rek.B)} m</text></g>}
        {maat && schrijven && !rek && [['V', 0, m.B / 2], ['A', m.L, m.B / 2], ['L', m.L / 2, 0], ['R', m.L / 2, m.B]].filter(([k]) => (k === 'V' || k === 'A' ? !maat.vastL : maat.breedtes.length > 1)).map(([k, x, y]) => (
          <rect key={k} x={x - 0.35} y={y - 0.35} width={0.7} height={0.7} rx={0.12} fill="#FFFFFF" stroke="#2563EB" strokeWidth={0.08} style={{ cursor: k === 'V' || k === 'A' ? 'ew-resize' : 'ns-resize' }} onPointerDown={rekNeer(k)}><title>{k === 'V' || k === 'A' ? `Langer of korter (per ${getal(maat.travee)} m)` : 'Breder of smaller (bestaande maten)'}</title></rect>
        ))}
        {schrijven && gelijk1 && selBox && !sleep && !hoekSleep && [[selBox[0], selBox[1], selBox[2], selBox[3]], [selBox[2], selBox[1], selBox[0], selBox[3]], [selBox[2], selBox[3], selBox[0], selBox[1]], [selBox[0], selBox[3], selBox[2], selBox[1]]].map(([hx, hy, vx, vy]) => (
          <rect key={`${hx},${hy}`} x={hx - 0.25} y={hy - 0.25} width={0.5} height={0.5} fill="#2563EB" stroke="#FFF" strokeWidth={0.06} style={{ cursor: 'nwse-resize' }} onPointerDown={hoekNeer([vx, vy])}><title>Sleep: vloer groter of kleiner (hele elementen)</title></rect>
        ))}
        {hoekSleep && <text x={hoekSleep.vast[0]} y={hoekSleep.vast[1] - 0.3} fontSize={fs * 1.1} fill="#1D4ED8" style={{ pointerEvents: 'none' }}>{hoekSleep.lijst.length} stuks</text>}
        {kader && <rect x={Math.min(kader.a[0], kader.b[0])} y={Math.min(kader.a[1], kader.b[1])} width={Math.abs(kader.b[0] - kader.a[0])} height={Math.abs(kader.b[1] - kader.a[1])} fill="#2563EB" fillOpacity={0.06} stroke="#2563EB" strokeWidth={0.05} strokeDasharray="0.3 0.2" style={{ pointerEvents: 'none' }} />}
        {spook && <g style={{ pointerEvents: 'none' }}><rect x={spook.x - spook.b / 2} y={spook.y - spook.d / 2} width={spook.b} height={spook.d} fill="#2563EB" fillOpacity={0.08} stroke="#2563EB" strokeWidth={0.08} strokeDasharray="0.4 0.25" /><text x={spook.x} y={spook.y} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 1.1} fill="#1D4ED8">{getal(spook.L)} × {getal(spook.B)} m</text></g>}
      </svg></div>
      <div className="fm-tv-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Inzoomen" onClick={() => { const [vx, vy, vw, vh] = vb; setZicht([vx + vw * 0.15, vy + vh * 0.15, vw * 0.7, vh * 0.7]); }}>+</button>
        <button type="button" aria-label="Uitzoomen" onClick={() => { const [vx, vy, vw, vh] = vb; setZicht([vx - vw * 0.2, vy - vh * 0.2, vw * 1.4, vh * 1.4]); }}>−</button>
        <button type="button" title="Passend" onClick={() => setZicht(null)}>⤢</button>
      </div>
      <div className="fm-tv-info fm-sub">{lijst.length} {lijst.length === 1 ? 'stuk' : 'stukken'} · {getal(totaal, 1)} m² · Wiel = zoomen, twee vingers of middelste knop = schuiven · Vloer gekozen: slepen = zone vullen · blauwe hendels = tent groter · Shift + klik of Shift + slepen = meer kiezen · Ctrl + A = alles · pijltjes = schuiven · R = draaien · Delete = weg · Alt + klik = vullen tot daar</div>
      {gs.length > 0 && (
        <div className="fm-tv-keuze">
          <strong>{g ? ge?.naam || 'Vloerstuk' : `${gs.length} stukken`}</strong>
          <span className="fm-sub">{g ? `${getal(g.b)} × ${getal(g.d)} m` : `${getal(gs.reduce((a, q) => a + q.b * q.d, 0), 1)} m²`}</span>
          <label>Hoogte <input type="number" step="0.05" min="0" max="2" disabled={!schrijven} value={gs[0].h ?? 0} onChange={(e) => pasAlle(sel, { h: Math.max(0, Number(e.target.value) || 0) })} /> m</label>
          {schrijven && <>
            <button type="button" className="fm-knop klein" title="Draaien (R)" onClick={() => draai(sel)}>Draaien</button>
            <span className="fm-tv-pijlen" title="Een kopie ernaast">{[['←', [-1, 0]], ['↑', [0, -1]], ['↓', [0, 1]], ['→', [1, 0]]].map(([p, r]) => <button key={p} type="button" className="fm-knop klein" onClick={() => ernaast(sel, r)}>{p}</button>)}</span>
            {g && <button type="button" className="fm-knop klein" title="Alle stukken op deze hoogte" onClick={() => onZet(stukken.map((s) => ({ ...s, h: g.h })))}>Hoogte voor alle</button>}
            <button type="button" className="fm-knop klein rood" onClick={() => weg(sel)}>Weg</button>
          </>}
        </div>
      )}
    </div>
  );
}
