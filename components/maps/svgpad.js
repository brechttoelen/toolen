// SVG-pad lezen zonder plug-in: alles naar absolute M, L, H, V, C, Q en Z.
// S en T worden C en Q, bogen (A) worden kubische bezierkrommen (methode van de SVG-specificatie, F.6).
// Gebruikt door tekening.js; getoetst tegen svgpath (zelfde vorm tot op 0,01 eenheid).

const AANTAL = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokens(d) {
  const uit = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) uit.push(m[1] || Number(m[2]));
  return uit;
}

// Boog als kubische krommen (elk stuk hoogstens 90°).
function boogNaarKubisch(x1, y1, rx, ry, hoek, grootBoog, zin, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [[x1, y1, x2, y2, x2, y2]];
  const phi = (hoek * Math.PI) / 180; const cp = Math.cos(phi); const sp = Math.sin(phi);
  const dx = (x1 - x2) / 2; const dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy; const y1p = -sp * dx + cp * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }
  const teller = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const noemer = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let k = Math.sqrt(Math.max(0, teller / noemer));
  if (!!grootBoog === !!zin) k = -k;
  const cxp = (k * rx * y1p) / ry; const cyp = (-k * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2; const cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const hoekTussen = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const th1 = hoekTussen(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = hoekTussen((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!zin && dth > 0) dth -= 2 * Math.PI;
  if (zin && dth < 0) dth += 2 * Math.PI;
  const stukken = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9));
  const delta = dth / stukken;
  const t = (4 / 3) * Math.tan(delta / 4);
  const punt = (th) => [cx + rx * Math.cos(th) * cp - ry * Math.sin(th) * sp, cy + rx * Math.cos(th) * sp + ry * Math.sin(th) * cp];
  const afgeleide = (th) => [-rx * Math.sin(th) * cp - ry * Math.cos(th) * sp, -rx * Math.sin(th) * sp + ry * Math.cos(th) * cp];
  const uit = [];
  let th = th1;
  for (let i = 0; i < stukken; i++) {
    const a = punt(th); const b = punt(th + delta); const da = afgeleide(th); const db = afgeleide(th + delta);
    const eind = i === stukken - 1 ? [x2, y2] : b;
    uit.push([a[0] + t * da[0], a[1] + t * da[1], b[0] - t * db[0], b[1] - t * db[1], eind[0], eind[1]]);
    th += delta;
  }
  return uit;
}

// Segmenten als [opdracht, ...getallen], absoluut, zonder S, T en A.
export function padSegmenten(d) {
  const t = tokens(String(d || ''));
  const uit = [];
  let i = 0; let cmd = null;
  let x = 0; let y = 0; let sx = 0; let sy = 0;
  let vorigC = null; let vorigQ = null; // laatste controlepunt voor S en T
  while (i < t.length) {
    if (typeof t[i] === 'string') { cmd = t[i]; i++; } else if (!cmd) { i++; continue; }
    const C = cmd.toUpperCase(); const rel = cmd !== C; const n = AANTAL[C];
    if (C === 'Z') { uit.push(['Z']); x = sx; y = sy; vorigC = vorigQ = null; continue; }
    const a = t.slice(i, i + n);
    if (a.length < n || a.some((v) => typeof v !== 'number')) break;
    i += n;
    const ox = rel ? x : 0; const oy = rel ? y : 0;
    let nc = null; let nq = null;
    if (C === 'M') {
      x = a[0] + ox; y = a[1] + oy; sx = x; sy = y; uit.push(['M', x, y]);
      cmd = rel ? 'l' : 'L'; // volgende paren zijn lijnen
    } else if (C === 'L') { x = a[0] + ox; y = a[1] + oy; uit.push(['L', x, y]); }
    else if (C === 'H') { x = a[0] + (rel ? x : 0); uit.push(['H', x]); }
    else if (C === 'V') { y = a[0] + (rel ? y : 0); uit.push(['V', y]); }
    else if (C === 'C') {
      const s = [a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy, a[4] + ox, a[5] + oy];
      uit.push(['C', ...s]); nc = [s[2], s[3]]; x = s[4]; y = s[5];
    } else if (C === 'S') {
      const p1 = vorigC ? [2 * x - vorigC[0], 2 * y - vorigC[1]] : [x, y];
      const s = [p1[0], p1[1], a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy];
      uit.push(['C', ...s]); nc = [s[2], s[3]]; x = s[4]; y = s[5];
    } else if (C === 'Q') {
      const s = [a[0] + ox, a[1] + oy, a[2] + ox, a[3] + oy];
      uit.push(['Q', ...s]); nq = [s[0], s[1]]; x = s[2]; y = s[3];
    } else if (C === 'T') {
      const p1 = vorigQ ? [2 * x - vorigQ[0], 2 * y - vorigQ[1]] : [x, y];
      const s = [p1[0], p1[1], a[0] + ox, a[1] + oy];
      uit.push(['Q', ...s]); nq = p1; x = s[2]; y = s[3];
    } else if (C === 'A') {
      const ex = a[5] + ox; const ey = a[6] + oy;
      for (const k of boogNaarKubisch(x, y, a[0], a[1], a[2], a[3], a[4], ex, ey)) uit.push(['C', ...k]);
      x = ex; y = ey;
    }
    vorigC = nc; vorigQ = nq;
  }
  return uit;
}
