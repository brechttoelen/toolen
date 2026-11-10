'use client';

// Gedetailleerde tekening van een bibliotheekelement (uit SVG of DXF).
// Alles in meter rond het midden van het element: x naar rechts (oost bij
// draaiing 0), y naar boven (noord). Op de kaart wordt de tekening mee
// verschoven, gedraaid en geschaald met het item.
//
// tekening = {
//   b, h,                                   breedte en hoogte in meter
//   vlakken: [{ r: [ring, …], vul, lijn, d }],   ring = [[x,y],…], d = lijndikte in m
//   lijnen:  [{ c: [[x,y],…], k, d }],
//   teksten: [{ p: [x,y], t, h, rot, k }],       h = teksthoogte in m
// }
import { padSegmenten } from './svgpad';

const MAX_PUNTEN = 40000;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// ---------- SVG ----------

function kleurHex(c) {
  if (!c || c === 'none' || c === 'transparent') return null;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a] = m[1].split(',').map((x) => parseFloat(x));
    if (a === 0) return null;
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  }
  if (c.startsWith('#')) return c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c.slice(0, 7);
  return null;
}

// Pad-tekst → lijst van subpaden (punten in de eigen eenheden van het element).
function padNaarSubpaden(d) {
  const uit = [];
  let huidig = null;
  let start = null;
  const kubisch = (p0, p1, p2, p3) => {
    const lang = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
    const n = Math.max(4, Math.min(24, Math.ceil(lang / 4)));
    for (let i = 1; i <= n; i++) {
      const t = i / n; const u = 1 - t;
      huidig.c.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
  };
  let pos = [0, 0];
  padSegmenten(d).forEach((seg) => {
    const [cmd, ...a] = seg;
    if (cmd === 'M') { huidig = { c: [[a[0], a[1]]], dicht: false }; uit.push(huidig); pos = [a[0], a[1]]; start = pos; return; }
    if (!huidig) { huidig = { c: [pos], dicht: false }; uit.push(huidig); }
    if (cmd === 'L') { pos = [a[0], a[1]]; huidig.c.push(pos); }
    else if (cmd === 'H') { pos = [a[0], pos[1]]; huidig.c.push(pos); }
    else if (cmd === 'V') { pos = [pos[0], a[0]]; huidig.c.push(pos); }
    else if (cmd === 'C') { kubisch(pos, [a[0], a[1]], [a[2], a[3]], [a[4], a[5]]); pos = [a[4], a[5]]; }
    else if (cmd === 'Q') { const p1 = [a[0], a[1]]; const p2 = [a[2], a[3]]; kubisch(pos, [pos[0] + (2 / 3) * (p1[0] - pos[0]), pos[1] + (2 / 3) * (p1[1] - pos[1])], [p2[0] + (2 / 3) * (p1[0] - p2[0]), p2[1] + (2 / 3) * (p1[1] - p2[1])], p2); pos = p2; }
    else if (cmd === 'Z') { huidig.dicht = true; if (start) { huidig.c.push(start); pos = start; } huidig = null; }
  });
  return uit.filter((s) => s.c.length > 1);
}

function vormNaarPad(el) {
  const n = (a) => parseFloat(el.getAttribute(a)) || 0;
  switch (el.tagName.toLowerCase()) {
    case 'path': return el.getAttribute('d') || '';
    case 'rect': { const x = n('x'); const y = n('y'); const w = n('width'); const h = n('height'); return w && h ? `M${x} ${y}H${x + w}V${y + h}H${x}Z` : ''; }
    case 'line': return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    case 'polyline': case 'polygon': {
      const p = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      if (p.length < 4) return '';
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return el.tagName.toLowerCase() === 'polygon' ? `${d}Z` : d;
    }
    case 'circle': case 'ellipse': {
      const cx = n('cx'); const cy = n('cy');
      const rx = el.tagName.toLowerCase() === 'circle' ? n('r') : n('rx');
      const ry = el.tagName.toLowerCase() === 'circle' ? n('r') : n('ry');
      if (!rx || !ry) return '';
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    default: return '';
  }
}

// Leest een SVG-bestand. `breedteM` = echte breedte van de hele tekening in meter.
export function leesSvg(tekst, breedteM) {
  if (typeof document === 'undefined') throw new Error('SVG lezen kan enkel in de browser.');
  const doc = new DOMParser().parseFromString(tekst, 'image/svg+xml');
  const bron = doc.querySelector('svg');
  if (!bron || doc.querySelector('parsererror')) throw new Error('Dit is geen geldig SVG-bestand.');
  // Tijdelijk in de pagina zetten: dan kloppen transformaties en CSS-stijlen.
  const houder = document.createElement('div');
  houder.style.cssText = 'position:absolute;left:-10000px;top:0;width:2000px;height:2000px;opacity:0;pointer-events:none';
  const svg = document.importNode(bron, true);
  houder.appendChild(svg);
  document.body.appendChild(houder);
  try {
    const ruw = { vlakken: [], lijnen: [], teksten: [] };
    let punten = 0;
    const toep = (m, [x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
    const schaalVan = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
    for (const el of svg.querySelectorAll('path, rect, line, polyline, polygon, circle, ellipse, text')) {
      if (el.closest('defs, clipPath, mask, symbol, pattern, marker')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const m = el.getCTM?.();
      if (!m) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === 'text') {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        let bb; try { bb = el.getBBox(); } catch { continue; }
        const midden = toep(m, [bb.x + bb.width / 2, bb.y + bb.height / 2]);
        const grootte = (parseFloat(cs.fontSize) || 12) * schaalVan(m);
        ruw.teksten.push({ p: midden, t: t.slice(0, 120), h: grootte * 0.72, rot: (Math.atan2(m.b, m.a) * 180) / Math.PI, k: kleurHex(cs.fill) || '#1d1d1b', i: /italic|oblique/.test(cs.fontStyle), b: (parseInt(cs.fontWeight, 10) || 400) >= 600 });
        continue;
      }
      const d = vormNaarPad(el);
      if (!d) continue;
      let subpaden;
      try { subpaden = padNaarSubpaden(d); } catch { continue; }
      const vul = parseFloat(cs.fillOpacity) === 0 ? null : kleurHex(cs.fill);
      const lijn = parseFloat(cs.strokeOpacity) === 0 ? null : kleurHex(cs.stroke);
      const dikte = lijn ? (parseFloat(cs.strokeWidth) || 1) * schaalVan(m) : 0;
      const omgezet = subpaden.map((s) => ({ c: s.c.map((p) => toep(m, p)), dicht: s.dicht }));
      for (const s of omgezet) punten += s.c.length;
      if (punten > MAX_PUNTEN) throw new Error('Deze tekening is te gedetailleerd (te veel punten). Vereenvoudig ze in je tekenprogramma.');
      if (vul && !['line', 'polyline'].includes(tag)) {
        const ringen = omgezet.filter((s) => s.c.length >= 3).map((s) => {
          const c = s.c.slice();
          const [a, z] = [c[0], c[c.length - 1]];
          if (a[0] !== z[0] || a[1] !== z[1]) c.push(a);
          return c;
        });
        if (ringen.length) ruw.vlakken.push({ r: ringen, vul, lijn, d: dikte });
        // Open subpaden met een lijn apart tekenen.
        if (lijn) for (const s of omgezet) if (!s.dicht) ruw.lijnen.push({ c: s.c, k: lijn, d: dikte });
      } else if (lijn) {
        for (const s of omgezet) ruw.lijnen.push({ c: s.c, k: lijn, d: dikte });
      }
    }
    return normaliseer(ruw, breedteM, true);
  } finally {
    houder.remove();
  }
}

// ---------- DXF ----------
// d = resultaat van leesDxf; lagen = lijst met laagnamen om mee te nemen (of null).
export function dxfTekening(d, { breedteM = null, lagen = null } = {}) {
  const k = d.eenheid || 1;
  const ruw = { vlakken: [], lijnen: [], teksten: [] };
  for (const l of d.lijnen) {
    if (lagen && !lagen.includes(l.laag)) continue;
    ruw.lijnen.push({ c: l.c.map(([x, y]) => [x * k, y * k]), k: '#1d1d1b', d: 0 });
  }
  for (const t of d.teksten) {
    if (lagen && !lagen.includes(t.laag)) continue;
    ruw.teksten.push({ p: [t.p[0] * k, t.p[1] * k], t: t.t, h: (t.h || 1) * k, rot: t.rot || 0, k: '#1d1d1b', links: true });
  }
  const pts = ruw.lijnen.reduce((s, l) => s + l.c.length, 0);
  if (pts > MAX_PUNTEN) throw new Error('Deze tekening is te gedetailleerd (te veel punten). Zet overbodige lagen uit.');
  return normaliseer(ruw, breedteM, false);
}

// Centreert rond het midden, zet om naar meter en (SVG) draait de y-as om.
function normaliseer(ruw, breedteM, yOmlaag) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const meet = ([x, y]) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  ruw.vlakken.forEach((v) => v.r.forEach((r) => r.forEach(meet)));
  ruw.lijnen.forEach((l) => l.c.forEach(meet));
  if (!Number.isFinite(x0)) ruw.teksten.forEach((t) => meet(t.p));
  if (!Number.isFinite(x0) || x1 - x0 <= 0) throw new Error('Geen vormen gevonden in deze tekening.');
  const w = x1 - x0; const h = Math.max(y1 - y0, 1e-9);
  const k = breedteM > 0 ? breedteM / w : 1;
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const f = ([x, y]) => [r4((x - cx) * k), r4((yOmlaag ? cy - y : y - cy) * k)];
  return {
    b: r4(w * k), h: r4(h * k),
    vlakken: ruw.vlakken.map((v) => ({ r: v.r.map((r) => r.map(f)), vul: v.vul, lijn: v.lijn, d: r4(v.d * k) })),
    lijnen: ruw.lijnen.map((l) => ({ c: l.c.map(f), k: l.k, d: r4(l.d * k) })),
    teksten: ruw.teksten.map((t) => ({ p: f(t.p), t: t.t, h: r4(t.h * k), rot: yOmlaag ? t.rot : -t.rot, k: t.k, ...(t.i ? { i: true } : {}), ...(t.b === false ? { b: false } : {}) })),
  };
}

// ---------- Op de kaart ----------
// Lokale meters → lengte/breedtegraad, met schaal en draaiing van het item.
export function plaatser(midden, rot = 0, sx = 1, sy = 1) {
  const r = (rot * Math.PI) / 180;
  const cos = Math.cos(r); const sin = Math.sin(r);
  const mLat = 110574;
  const mLng = 111320 * Math.cos((midden[1] * Math.PI) / 180);
  return ([x, y]) => {
    const xs = x * sx; const ys = y * sy;
    // Met de klok mee draaien (zoals elementVeelhoek).
    const xr = xs * cos + ys * sin;
    const yr = -xs * sin + ys * cos;
    return [midden[0] + xr / mLng, midden[1] + yr / mLat];
  };
}

// Features voor naarGeojson.
// Tekst nooit op zijn kop: tussen 90° en 270° een halve slag terug.
const leesbaar = (r) => { const a = ((r % 360) + 360) % 360; return a > 90 && a <= 270 ? a - 180 : a; };
export function tekeningFeatures(tekening, item, el, basis) {
  const p = item.parameters || {};
  if (!tekening || !p.midden) return { vormen: [], labels: [] };
  // spiegel_x / spiegel_y: de tekening omklappen (bv. de draairichting van een deur).
  const sx = (el?.breedte_m && p.breedte ? p.breedte / el.breedte_m : 1) * (p.spiegel_x ? -1 : 1);
  const sy = (el?.diepte_m && p.diepte ? p.diepte / el.diepte_m : 1) * (p.spiegel_y ? -1 : 1);
  const T = plaatser(p.midden, Number(p.rot) || 0, sx, sy);
  const sm = Math.sqrt(Math.abs(sx * sy)) || 1;
  const vormen = [];
  const labels = [];
  const gem = { ...basis, wit_rand: false, patroon: '', streep: 'vol', dekking: basis.dekking ?? 1, tekening: true };
  for (const v of tekening.vlakken || []) {
    vormen.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: v.r.map((r) => r.map(T)) },
      properties: { ...gem, streep: v.s || 'vol', vorm: 'vlak', vulkleur: v.vul || '#ffffff', vuldekking: v.vul ? (v.op ?? 1) : 0, kleur: v.lijn || '#000000', dekking: v.lijn ? (basis.dekking ?? 1) : 0, dikte_m: v.lijn ? Math.max(0.01, (v.d || 0.02) * sm) : 0, dikte: 1, vulpatroon: 'effen' } });
  }
  for (const l of tekening.lijnen || []) {
    vormen.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.c.map(T) },
      properties: { ...gem, streep: l.s || 'vol', vorm: 'lijn', kleur: l.k || '#1d1d1b', dikte_m: l.d > 0 ? Math.max(0.01, l.d * sm) : 0, dikte: 1 } });
  }
  for (const t of tekening.teksten || []) {
    labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: T(t.p) },
      properties: { id: item.id, soort: 'tekening-tekst', label: t.t === '{naam}' ? (item.naam || el?.naam || '') : t.t, kleur: t.k || '#1d1d1b', tekst_m: Math.max(0.05, (t.h || 0.5) * sm), tekst_rot: leesbaar((Number(p.rot) || 0) + (Number(t.rot) || 0)), vet: t.b !== false, cursief: !!t.i } });
  }
  return { vormen, labels };
}

// ---------- Trap ----------
// Treden en een looprichtingspijl in een rechthoek (midden, breedte, diepte, rot).
// richting: 'x' (naar rechts), '-x', 'y' (naar boven), '-y'. trede = diepte van een trede in m.
export function trapFeatures(item, basis, richting = 'x', trede = 0.3) {
  const p = item.parameters || {};
  if (!p.midden || !(p.breedte > 0) || !(p.diepte > 0)) return [];
  const T = plaatser(p.midden, Number(p.rot) || 0);
  const b = Number(p.breedte); const d = Number(p.diepte);
  const langsX = richting === 'x' || richting === '-x';
  const lang = langsX ? b : d; const dwars = langsX ? d : b;
  const n = Math.min(200, Math.max(1, Math.floor(lang / trede)));
  const stap = lang / n;
  const pt = (a, c) => (langsX ? [a, c] : [c, a]);
  const lijn = (c, extra = {}) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c.map(T) }, properties: { ...basis, vorm: 'lijn', streep: 'vol', wit_rand: false, patroon: '', dikte_m: 0, dikte: Math.max(0.5, (basis.dikte || 1) * 0.6), ...extra } });
  const uit = [];
  for (let i = 1; i < n; i++) { const a = -lang / 2 + i * stap; uit.push(lijn([pt(a, -dwars / 2), pt(a, dwars / 2)])); }
  // Pijl
  const teken = richting.startsWith('-') ? -1 : 1;
  const a0 = -teken * lang * 0.42; const a1 = teken * lang * 0.42;
  const kop = Math.min(dwars * 0.25, lang * 0.12);
  uit.push(lijn([pt(a0, 0), pt(a1, 0)], { dikte: basis.dikte || 1 }));
  uit.push(lijn([pt(a1 - teken * kop, kop * 0.6), pt(a1, 0), pt(a1 - teken * kop, -kop * 0.6)], { dikte: basis.dikte || 1 }));
  return uit;
}
