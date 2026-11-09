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
      case OPS.constructPath: bouw(a[0], a[1]); break;
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
