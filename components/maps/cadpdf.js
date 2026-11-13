// Vectoren uit een CAD-PDF halen (AutoCAD, BricsCAD, …) voor import als object.
// Werkt op een pdf.js-pagina: volgt de transformaties en geeft elke getekende
// lijn of vorm terug in paginacoördinaten (punt, y naar boven).

const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const pt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const hex = (a) => {
  if (typeof a?.[0] === 'string') return a[0];
  const [r, g, b] = (a || []).map((v) => Math.round(Number(v) > 1 ? v : Number(v) * 255));
  return '#' + [r, g, b].map((v) => (Number(v) || 0).toString(16).padStart(2, '0')).join('');
};

export async function pdfVectoren(page, pdfjs) {
  const OPS = pdfjs.OPS;
  const ol = await page.getOperatorList();
  let m = [1, 0, 0, 1, 0, 0]; const stapel = [];
  let lijn = '#000000'; let vul = '#000000'; let breedte = 1;
  let huidig = [];
  const uit = [];
  const bouw = (ops, c) => {
    let i = 0; let sub = null; let start = null;
    const neem = () => { const p = pt(m, c[i], c[i + 1]); i += 2; return p; };
    for (const op of ops) {
      if (op === OPS.moveTo) { if (sub && sub.pts.length > 1) huidig.push(sub); const p = neem(); sub = { pts: [p], dicht: false }; start = p; }
      else if (op === OPS.lineTo) { const p = neem(); (sub ||= { pts: [start || p], dicht: false }).pts.push(p); }
      else if (op === OPS.curveTo || op === OPS.curveTo2 || op === OPS.curveTo3) {
        const n = op === OPS.curveTo ? 3 : 2;
        const ps = []; for (let k = 0; k < n; k++) ps.push(neem());
        const p0 = sub?.pts[sub.pts.length - 1] || ps[0];
        const [c1, c2, p3] = op === OPS.curveTo ? ps : op === OPS.curveTo2 ? [p0, ps[0], ps[1]] : [ps[0], ps[1], ps[1]];
        sub ||= { pts: [p0], dicht: false };
        for (let t = 0.25; t <= 1.001; t += 0.25) {
          const u = 1 - t;
          sub.pts.push([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]);
        }
      } else if (op === OPS.closePath) { if (sub) { sub.dicht = true; huidig.push(sub); start = sub.pts[0]; sub = null; } }
      else if (op === OPS.rectangle) {
        const x = c[i]; const y = c[i + 1]; const w = c[i + 2]; const h = c[i + 3]; i += 4;
        if (sub && sub.pts.length > 1) huidig.push(sub);
        huidig.push({ pts: [pt(m, x, y), pt(m, x + w, y), pt(m, x + w, y + h), pt(m, x, y + h)], dicht: true }); sub = null;
      }
    }
    if (sub && sub.pts.length > 1) huidig.push(sub);
  };
  // pdf.js 5 en later: één constructPath met de verfbewerking en een vlakke lijst (DrawOPS:
  // 0 moveTo x y, 1 lineTo x y, 2 curveTo x1 y1 x2 y2 x y, 3 quadraticCurveTo x1 y1 x y, 4 closePath).
  const bouwVlak = (d) => {
    let sub = null; let start = null;
    const p0 = () => sub?.pts[sub.pts.length - 1] || start || [0, 0];
    const bocht = (a0, c1, c2, p3) => { for (let t = 0.25; t <= 1.001; t += 0.25) { const u = 1 - t; sub.pts.push([u * u * u * a0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0], u * u * u * a0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]); } };
    for (let i = 0; i < (d?.length || 0);) {
      const op = d[i++];
      if (op === 0) { if (sub && sub.pts.length > 1) huidig.push(sub); const p = pt(m, d[i], d[i + 1]); i += 2; sub = { pts: [p], dicht: false }; start = p; }
      else if (op === 1) { const p = pt(m, d[i], d[i + 1]); i += 2; (sub ||= { pts: [start || p], dicht: false }).pts.push(p); }
      else if (op === 2) { const a0 = p0(); const c1 = pt(m, d[i], d[i + 1]); const c2 = pt(m, d[i + 2], d[i + 3]); const p3 = pt(m, d[i + 4], d[i + 5]); i += 6; sub ||= { pts: [a0], dicht: false }; bocht(a0, c1, c2, p3); }
      else if (op === 3) { const a0 = p0(); const q = pt(m, d[i], d[i + 1]); const p3 = pt(m, d[i + 2], d[i + 3]); i += 4; sub ||= { pts: [a0], dicht: false };
        bocht(a0, [a0[0] + (2 / 3) * (q[0] - a0[0]), a0[1] + (2 / 3) * (q[1] - a0[1])], [p3[0] + (2 / 3) * (q[0] - p3[0]), p3[1] + (2 / 3) * (q[1] - p3[1])], p3); }
      else if (op === 4) { if (sub) { sub.dicht = true; huidig.push(sub); start = sub.pts[0]; sub = null; } }
      else break;
    }
    if (sub && sub.pts.length > 1) huidig.push(sub);
  };
  const schaal = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  const verf = (streep, vullen) => {
    for (const s of huidig) uit.push({ pts: s.pts, dicht: s.dicht || vullen, k: streep ? lijn : vul, vul: vullen ? vul : null, d: streep ? breedte * schaal() : 0 });
    huidig = [];
  };
  for (let n = 0; n < ol.fnArray.length; n++) {
    const fn = ol.fnArray[n]; const a = ol.argsArray[n];
    switch (fn) {
      case OPS.save: stapel.push([m, lijn, vul, breedte]); break;
      case OPS.restore: if (stapel.length) [m, lijn, vul, breedte] = stapel.pop(); break;
      case OPS.transform: m = mul(m, a); break;
      case OPS.paintFormXObjectBegin: stapel.push([m, lijn, vul, breedte]); if (Array.isArray(a?.[0]) && a[0].length === 6) m = mul(m, a[0]); break;
      case OPS.paintFormXObjectEnd: if (stapel.length) [m, lijn, vul, breedte] = stapel.pop(); break;
      case OPS.setLineWidth: breedte = Number(a[0]) || 0; break;
      case OPS.setStrokeRGBColor: case OPS.setStrokeColor: case OPS.setStrokeGray: case OPS.setStrokeCMYKColor: lijn = hex(a); break;
      case OPS.setFillRGBColor: case OPS.setFillColor: case OPS.setFillGray: case OPS.setFillCMYKColor: vul = hex(a); break;
      case OPS.constructPath:
        if (typeof a?.[0] === 'number') { // pdf.js 5+: [verfbewerking, [pad], grenzen]
          const pad = a[1]?.[0];
          bouwVlak(pad ? Array.from(pad) : []);
          const v = a[0];
          if (v === OPS.stroke || v === OPS.closeStroke) verf(true, false);
          else if (v === OPS.fill || v === OPS.eoFill) verf(false, true);
          else if (v === OPS.fillStroke || v === OPS.eoFillStroke || v === OPS.closeFillStroke || v === OPS.closeEOFillStroke) verf(true, true);
          else if (v === OPS.endPath) huidig = [];
        } else bouw(a[0], a[1]);
        break;
      case OPS.stroke: case OPS.closeStroke: verf(true, false); break;
      case OPS.fill: case OPS.eoFill: verf(false, true); break;
      case OPS.fillStroke: case OPS.eoFillStroke: case OPS.closeFillStroke: case OPS.closeEOFillStroke: verf(true, true); break;
      case OPS.endPath: huidig = []; break;
      default: break;
    }
  }
  return uit;
}

const bbox = (pts) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; for (const [x, y] of pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };

// Kleuren tellen (in CAD-PDF's staat elke laag meestal in een eigen kleur).
export function kleurenVan(paden) {
  const m = new Map();
  for (const p of paden) m.set(p.k, (m.get(p.k) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

// Opschonen: uitsnede, kleuren weg, kleine details (tekst, arcering) weg, dubbels weg.
// kader = [x0, y0, x1, y1] in punten; minPt = kleinste afmeting in punten die blijft.
export function schoonOp(paden, { kader = null, uitKleuren = new Set(), minPt = 0, vullingen = false } = {}) {
  const gezien = new Set(); const uit = [];
  for (const p of paden) {
    if (uitKleuren.has(p.k)) continue;
    if (p.vul && !vullingen && !p.d) continue;
    const [a, b, c, d] = bbox(p.pts);
    if (kader && (c < kader[0] || a > kader[2] || d < kader[1] || b > kader[3])) continue;
    if (Math.max(c - a, d - b) < minPt) continue;
    const sl = p.pts.map(([x, y]) => `${Math.round(x * 10)},${Math.round(y * 10)}`).join(';');
    if (gezien.has(sl)) continue; gezien.add(sl);
    uit.push(p);
  }
  return uit;
}

// Naar een tekening (meter, gecentreerd) zoals de bibliotheek die gebruikt.
// mPerPt: meter op de grond per PDF-punt (schaal 1:N → N × 0,0003528).
export function naarTekening(paden, mPerPt, { kleur = null, max = 8000 } = {}) {
  let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity;
  for (const p of paden) { const [x0, y0, x1, y1] = bbox(p.pts); a = Math.min(a, x0); b = Math.min(b, y0); c = Math.max(c, x1); d = Math.max(d, y1); }
  const mx = (a + c) / 2; const my = (b + d) / 2;
  const r = (v) => Math.round(v * 1000) / 1000;
  const lijnen = []; const vlakken = [];
  for (const p of paden.slice(0, max)) {
    const pts = p.pts.map(([x, y]) => [r((x - mx) * mPerPt), r((y - my) * mPerPt)]);
    const k = kleur || (p.k === '#ffffff' ? '#1d1d1b' : p.k);
    if (p.vul && !p.d) vlakken.push({ r: [[...pts, pts[0]]], vul: kleur || p.vul, lijn: kleur || p.vul, d: 0, op: 0.35 });
    else lijnen.push({ c: p.dicht ? [...pts, pts[0]] : pts, k, d: r(Math.max(0.015, Math.min(0.08, (p.d || 0.5) * mPerPt))) });
  }
  return { b: r((c - a) * mPerPt), h: r((d - b) * mPerPt), lijnen, vlakken, teksten: [], afgekapt: paden.length > max };
}

// Witte achtergrond binnen de omtrek van een CAD-tekening (lokale meters): de vorm rond alle lijnen, met de
// vakken ertussen dicht. Zo blijft het plan leesbaar op een luchtfoto en dekt het wat eronder ligt af.
// Werkt op een raster: lijnen inkleuren, openingen dichten (verdikken, gaten vullen, weer verdunnen) en de
// rand van wat overblijft als veelhoek teruggeven. Geeft vlakken voor de tekening ([] als er geen vorm is).
export function achtergrondVlakken(lijnen, { vul = '#ffffff' } = {}) {
  let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity;
  for (const l of lijnen) for (const [x, y] of l.c) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  if (!Number.isFinite(a)) return [];
  const groot = Math.max(c - a, d - b); if (!(groot > 0)) return [];
  // Openingen kleiner dan dit gaan dicht (vakken van een stelling of podium); grotere inhammen blijven open.
  const rand = Math.max(1.5, Math.min(6, groot / 12));
  const cel = Math.max(groot / 420, 0.05);
  const R = Math.max(1, Math.ceil(rand / 2 / cel));
  const M = R + 2; // marge rond de tekening
  const W = Math.ceil((c - a) / cel) + 1 + 2 * M; const H = Math.ceil((d - b) / cel) + 1 + 2 * M;
  const ix = (x) => Math.round((x - a) / cel) + M; const iy = (y) => Math.round((y - b) / cel) + M;
  let g = new Uint8Array(W * H);
  for (const l of lijnen) for (let i = 0; i < l.c.length; i++) {
    const [x0, y0] = l.c[i]; g[iy(y0) * W + ix(x0)] = 1;
    if (i + 1 < l.c.length) { const [x1, y1] = l.c[i + 1]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (cel * 0.7)); for (let k = 1; k < n; k++) g[iy(y0 + ((y1 - y0) * k) / n) * W + ix(x0 + ((x1 - x0) * k) / n)] = 1; }
  }
  // Verdikken of verdunnen met een vierkant van R cellen: eerst per rij, dan per kolom.
  const schuif = (bron, zoek) => {
    const tus = new Uint8Array(W * H); const uit = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { let laatst = -1e9; const rij = y * W;
      for (let x = 0; x < W; x++) { if (bron[rij + x] === zoek) laatst = x; if (x - laatst <= R) tus[rij + x] = 1; }
      laatst = 1e9; for (let x = W - 1; x >= 0; x--) { if (bron[rij + x] === zoek) laatst = x; if (laatst - x <= R) tus[rij + x] = 1; } }
    for (let x = 0; x < W; x++) { let laatst = -1e9;
      for (let y = 0; y < H; y++) { if (tus[y * W + x]) laatst = y; if (y - laatst <= R) uit[y * W + x] = 1; }
      laatst = 1e9; for (let y = H - 1; y >= 0; y--) { if (tus[y * W + x]) laatst = y; if (laatst - y <= R) uit[y * W + x] = 1; } }
    return uit; // 1 = binnen R cellen van een cel met waarde 'zoek'
  };
  g = schuif(g, 1);
  // Gaten vullen: alles wat van buitenaf niet bereikbaar is, hoort bij de vorm.
  const buiten = new Uint8Array(W * H); const rij = [0]; buiten[0] = 1;
  while (rij.length) { const k = rij.pop(); const x = k % W; const y = (k - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx; const ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nk = ny * W + nx; if (!buiten[nk] && !g[nk]) { buiten[nk] = 1; rij.push(nk); } } }
  // Weer verdunnen: wat binnen R cellen van 'buiten' ligt, valt weg.
  const weg = schuif(buiten, 1);
  const vol = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !weg[y * W + x];
  // Rand volgen: per gevulde cel de zijden naast een lege cel, met de klok mee, en die aan elkaar rijgen.
  const randen = new Map(); const sleutel = (x, y) => y * (W + 1) + x;
  const voeg = (x0, y0, x1, y1) => { const k = sleutel(x0, y0); const l = randen.get(k); if (l) l.push([x1, y1]); else randen.set(k, [[x1, y1]]); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!vol(x, y)) continue;
    if (!vol(x, y - 1)) voeg(x + 1, y, x, y); if (!vol(x + 1, y)) voeg(x + 1, y + 1, x + 1, y); if (!vol(x, y + 1)) voeg(x, y + 1, x + 1, y + 1); if (!vol(x - 1, y)) voeg(x, y, x, y + 1); }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const uit = [];
  for (const [start] of randen) {
    while (randen.get(start)?.length) {
      const lus = []; let k = start; let stop = 0;
      while (randen.get(k)?.length && stop++ < 4 * W * H) { const x = k % (W + 1); const y = (k - x) / (W + 1); lus.push([x, y]); const [nx, ny] = randen.get(k).pop(); k = sleutel(nx, ny); if (k === start) break; }
      if (lus.length < 4) continue;
      // Rechte stukken samennemen, dan vereenvoudigen tot op één cel.
      const m = lus.map(([x, y]) => [a + (x - M - 0.5) * cel, b + (y - M - 0.5) * cel]);
      const eenv = vereenvoudig([...m, m[0]], cel * 1.2);
      if (eenv.length > 3) uit.push({ r: [eenv.map(([x, y]) => [r3(x), r3(y)])], vul, lijn: null, d: 0, op: 1, achtergrond: true });
    }
  }
  return uit;
}
// Douglas-Peucker op een gesloten ring (eerste punt = laatste punt).
function vereenvoudig(ring, tol) {
  const n = ring.length; if (n < 5) return ring;
  // Splitsen op het verste punt van het begin, zodat beide helften een open lijn zijn.
  let ver = 0; let vd = -1; for (let i = 1; i < n - 1; i++) { const dd = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2; if (dd > vd) { vd = dd; ver = i; } }
  const dp = (pts) => {
    const hou = new Uint8Array(pts.length); hou[0] = 1; hou[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) { const [i0, i1] = st.pop(); const [x0, y0] = pts[i0]; const [x1, y1] = pts[i1]; const dx = x1 - x0; const dy = y1 - y0; const l = Math.hypot(dx, dy) || 1; let best = -1; let bd = tol;
      for (let i = i0 + 1; i < i1; i++) { const dd = Math.abs((pts[i][0] - x0) * dy - (pts[i][1] - y0) * dx) / l; if (dd > bd) { bd = dd; best = i; } }
      if (best > 0) { hou[best] = 1; st.push([i0, best], [best, i1]); } }
    return pts.filter((_, i) => hou[i]);
  };
  const h1 = dp(ring.slice(0, ver + 1)); const h2 = dp(ring.slice(ver));
  return [...h1, ...h2.slice(1)];
}
