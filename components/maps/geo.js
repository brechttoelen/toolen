'use client';

// Geometrie in echte maten. Alles in WGS84 (lng, lat); afstanden in meter.
import * as turf from '@turf/turf';

const M = { units: 'meters' };

export function rond(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function getal(n, d = 1) {
  if (n == null || Number.isNaN(n)) return '–';
  return rond(n, d).toLocaleString('nl-BE', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

// Een rechthoek (of eigen omtrek) van breedte × diepte meter, gedraaid met de
// klok mee over `rot` graden, rond `midden`. Breedte ligt bij rot 0 oost-west.
export function elementVeelhoek(midden, breedte, diepte, rot = 0, omtrek = null) {
  const pts = omtrek && omtrek.length >= 3
    ? omtrek
    : [[-breedte / 2, -diepte / 2], [breedte / 2, -diepte / 2], [breedte / 2, diepte / 2], [-breedte / 2, diepte / 2]];
  const r = (rot * Math.PI) / 180;
  const ring = pts.map(([x, y]) => {
    const xr = x * Math.cos(r) + y * Math.sin(r);
    const yr = -x * Math.sin(r) + y * Math.cos(r);
    const afst = Math.hypot(xr, yr);
    if (afst < 1e-9) return midden;
    const richting = (Math.atan2(xr, yr) * 180) / Math.PI;
    return turf.destination(midden, afst, richting, M).geometry.coordinates;
  });
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

// Draaiing en midden terugrekenen uit een verschoven of gedraaide rechthoek.
export function leesElement(geom) {
  const ring = geom?.coordinates?.[0];
  if (!ring || ring.length < 4) return null;
  const midden = turf.centroid(geom).geometry.coordinates;
  const rot = turf.bearing(ring[0], ring[1]) - 90;
  return { midden, rot: ((rot % 360) + 360) % 360 };
}

export function cirkel(midden, straal) {
  return turf.circle(midden, Math.max(straal, 0.1), { ...M, steps: 72 }).geometry;
}

export function lengte(geom) {
  if (!geom) return 0;
  if (geom.type === 'LineString') return turf.length(turf.feature(geom), M);
  if (geom.type === 'Polygon') return turf.length(turf.polygonToLine(turf.feature(geom)), M);
  return 0;
}

export function oppervlakte(geom) {
  if (!geom || geom.type !== 'Polygon') return 0;
  return turf.area(turf.feature(geom));
}

export function middelpunt(geom) {
  if (!geom) return null;
  if (geom.type === 'Point') return geom.coordinates;
  return turf.centroid(turf.feature(geom)).geometry.coordinates;
}

export function verschuif(geom, oost, noord) {
  const afst = Math.hypot(oost, noord);
  if (afst < 1e-9) return geom;
  const richting = (Math.atan2(oost, noord) * 180) / Math.PI;
  return turf.transformTranslate(turf.feature(geom), afst, richting, M).geometry;
}

export function draai(geom, graden, rond_ = null) {
  return turf.transformRotate(turf.feature(geom), graden, { pivot: rond_ || middelpunt(geom) }).geometry;
}

// Punten om de `interval` meter langs een lijn (begin inbegrepen).
export function puntenLangs(lijn, interval) {
  const tot = lengte(lijn);
  const uit = [];
  if (!interval || interval <= 0) return uit;
  for (let d = 0; d <= tot + 1e-6; d += interval) {
    const p = turf.along(turf.feature(lijn), d, M).geometry.coordinates;
    const verder = turf.along(turf.feature(lijn), Math.min(d + 0.5, tot), M).geometry.coordinates;
    uit.push({ punt: p, richting: turf.bearing(p, verder) });
  }
  return uit;
}

// Lengte van het laatste segment van een lijn aanpassen, in dezelfde richting.
export function zetLaatsteSegment(lijn, meter) {
  const c = lijn.coordinates;
  if (c.length < 2) return lijn;
  const a = c[c.length - 2];
  const b = c[c.length - 1];
  const r = turf.bearing(a, b);
  const nieuw = turf.destination(a, meter, r, M).geometry.coordinates;
  return { type: 'LineString', coordinates: [...c.slice(0, -1), nieuw] };
}

export function laatsteSegment(lijn) {
  const c = lijn?.coordinates || [];
  if (c.length < 2) return { lengte: 0, hoek: 0 };
  const a = c[c.length - 2];
  const b = c[c.length - 1];
  return { lengte: turf.distance(a, b, M), hoek: ((turf.bearing(a, b) % 360) + 360) % 360 };
}

export function kader(geoms) {
  const fc = turf.featureCollection(geoms.filter(Boolean).map((g) => turf.feature(g)));
  if (!fc.features.length) return null;
  return turf.bbox(fc);
}

// Meter per pixel in MapLibre (512-tegels) op breedtegraad `lat`.
export function meterPerPixel(zoom, lat) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

export function zoomVoorMeterPerPixel(mpp, lat) {
  return Math.log2((40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * mpp));
}

// Verschil tussen twee punten in meter: [oost, noord].
export function offsetMeter(van, naar) {
  const x = turf.distance(van, [naar[0], van[1]], M) * Math.sign(naar[0] - van[0]);
  const y = turf.distance(van, [van[0], naar[1]], M) * Math.sign(naar[1] - van[1]);
  return [x, y];
}

export function regioVan([lng, lat]) {
  if (lng >= 2.52 && lng <= 5.95 && lat >= 50.67 && lat <= 51.51) return 'Vlaanderen';
  if (lng >= 2.8 && lng <= 6.45 && lat >= 49.45 && lat <= 50.85) return 'Wallonië';
  if (lng >= 3.2 && lng <= 7.25 && lat >= 50.72 && lat <= 53.6) return 'Nederland';
  return 'Elders';
}

// ---------- Extra vormen (parametrisch bewaard) ----------
const punt = (midden, afst, richting) => (afst < 1e-9 ? midden : turf.destination(midden, afst, richting, M).geometry.coordinates);

// Regelmatige veelhoek met n zijden (driehoek = 3), straal tot de hoekpunten.
export function regelmatigeVeelhoek(midden, straal, n = 3, rot = 0) {
  const k = Math.max(3, Math.min(24, Math.round(n)));
  const ring = [];
  for (let i = 0; i < k; i++) ring.push(punt(midden, straal, rot + (360 * i) / k));
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

// Ellips met halve assen rx (oost-west bij rot 0) en ry.
export function ellips(midden, rx, ry, rot = 0) {
  const ring = [];
  const r = (rot * Math.PI) / 180;
  for (let i = 0; i < 72; i++) {
    const t = (2 * Math.PI * i) / 72;
    const x = rx * Math.cos(t); const y = ry * Math.sin(t);
    const xr = x * Math.cos(r) + y * Math.sin(r);
    const yr = -x * Math.sin(r) + y * Math.cos(r);
    ring.push(punt(midden, Math.hypot(xr, yr), (Math.atan2(xr, yr) * 180) / Math.PI));
  }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

// Sector (kijkveld, bereik): middelpunt, straal, richting (0 = noord) en openingshoek.
export function sector(midden, straal, richting = 0, hoek = 60) {
  const h = Math.max(1, Math.min(359.9, hoek));
  const stappen = Math.max(6, Math.ceil(h / 4));
  const ring = [midden];
  for (let i = 0; i <= stappen; i++) ring.push(punt(midden, straal, richting - h / 2 + (h * i) / stappen));
  ring.push(midden);
  return { type: 'Polygon', coordinates: [ring] };
}

// Rechthoek met afgeronde hoeken (straal a), gedraaid.
export function afgerondeRechthoek(midden, b, d, rot = 0, a = 0) {
  const r = Math.max(0, Math.min(a, b / 2, d / 2));
  if (r < 0.01) return elementVeelhoek(midden, b, d, rot);
  const pts = [];
  const hoeken = [[b / 2 - r, d / 2 - r, 90], [b / 2 - r, -d / 2 + r, 0], [-b / 2 + r, -d / 2 + r, 270], [-b / 2 + r, d / 2 - r, 180]];
  for (const [cx, cy, start] of hoeken) {
    for (let i = 0; i <= 6; i++) {
      const t = ((start - (90 * i) / 6) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
  }
  return elementVeelhoek(midden, b, d, rot, pts);
}

export function parametrischeVorm(soort, p) {
  if (!p?.midden) return null;
  if (soort === 'veelhoek') return regelmatigeVeelhoek(p.midden, Number(p.straal) || 5, Number(p.zijden) || 3, Number(p.rot) || 0);
  if (soort === 'ellips') return ellips(p.midden, Number(p.rx) || 5, Number(p.ry) || 3, Number(p.rot) || 0);
  if (soort === 'sector') return sector(p.midden, Number(p.straal) || 20, Number(p.richting) || 0, Number(p.hoek) || 60);
  if (soort === 'cirkel') return cirkel(p.midden, Number(p.straal) || 5);
  if (soort === 'rechthoek' && p.breedte && p.diepte) return afgerondeRechthoek(p.midden, Number(p.breedte), Number(p.diepte), Number(p.rot) || 0, Number(p.afronding) || 0);
  return null;
}

// Spiegelen rond het middelpunt: as 'x' (links-rechts) of 'y' (boven-onder).
export function spiegel(geom, as = 'x') {
  const m = middelpunt(geom);
  const f = ([x, y]) => (as === 'x' ? [2 * m[0] - x, y] : [x, 2 * m[1] - y]);
  if (geom.type === 'Point') return geom;
  if (geom.type === 'LineString') return { type: 'LineString', coordinates: geom.coordinates.map(f) };
  return { type: 'Polygon', coordinates: geom.coordinates.map((r) => r.map(f).reverse()) };
}

export function schaal(geom, factor) {
  return turf.transformScale(turf.feature(geom), factor, { origin: middelpunt(geom) }).geometry;
}

// Verschuiving in graden (voor groepen en kabels).
export function verschuifGraden(geom, dx, dy) {
  const f = ([x, y]) => [x + dx, y + dy];
  if (geom.type === 'Point') return { type: 'Point', coordinates: f(geom.coordinates) };
  if (geom.type === 'LineString') return { type: 'LineString', coordinates: geom.coordinates.map(f) };
  return { type: 'Polygon', coordinates: geom.coordinates.map((r) => r.map(f)) };
}

export function eersteCoord(geom) {
  if (!geom) return null;
  if (geom.type === 'Point') return geom.coordinates;
  if (geom.type === 'LineString') return geom.coordinates[0];
  return geom.coordinates[0][0];
}

export function buffer(geom, meter) {
  const b = turf.buffer(turf.feature(geom), meter, { ...M, steps: 16 });
  const g = b?.geometry;
  if (!g) return null;
  if (g.type === 'MultiPolygon') return { type: 'Polygon', coordinates: g.coordinates[0] };
  return g;
}

// Pathfinder: samenvoegen, aftrekken, snijden. Geeft een Polygon (grootste deel) of null.
export function pathfinder(a, b, bewerking) {
  const fc = turf.featureCollection([turf.feature(a), turf.feature(b)]);
  let r = null;
  if (bewerking === 'samenvoegen') r = turf.union(fc);
  else if (bewerking === 'aftrekken') r = turf.difference(fc);
  else if (bewerking === 'snijden') r = turf.intersect(fc);
  const g = r?.geometry;
  if (!g) return null;
  if (g.type === 'MultiPolygon') {
    let best = null; let max = -1;
    for (const c of g.coordinates) { const ar = turf.area(turf.polygon(c)); if (ar > max) { max = ar; best = c; } }
    return { type: 'Polygon', coordinates: best };
  }
  return g;
}

// Evenwijdige lijn op `meter` (positief = rechts van de tekenrichting, zoals turf.lineOffset).
// In meter gerekend rond de lijn: turf.lineOffset rekent in graden en geeft in Vlaanderen
// zo'n 5 à 35 % te weinig afstand, naargelang de richting.
export function evenwijdig(lijn, meter) {
  try {
    const c = lijn?.coordinates;
    if (!c || c.length < 2 || !meter) return lijn || null;
    const lat0 = c.reduce((a, p) => a + p[1], 0) / c.length; const lng0 = c[0][0];
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180); const ky = 110574;
    const pts = c.map((p) => [(p[0] - lng0) * kx, (p[1] - lat0) * ky]).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6);
    if (pts.length < 2) return null;
    // Normaal naar rechts per stuk.
    const n = []; for (let i = 0; i < pts.length - 1; i++) { const dx = pts[i + 1][0] - pts[i][0]; const dy = pts[i + 1][1] - pts[i][1]; const l = Math.hypot(dx, dy); n.push([dy / l, -dx / l]); }
    const uit = [];
    for (let i = 0; i < pts.length; i++) {
      const a = n[Math.max(0, i - 1)]; const b = n[Math.min(n.length - 1, i)];
      let mx = a[0] + b[0]; let my = a[1] + b[1]; const ml = Math.hypot(mx, my);
      if (ml < 1e-9) { mx = b[0]; my = b[1]; } else { mx /= ml; my /= ml; }
      // Verstek: zo ver dat beide stukken op exact `meter` liggen (begrensd bij scherpe hoeken).
      const cos = mx * b[0] + my * b[1];
      const f = Math.min(4, 1 / Math.max(0.25, cos));
      uit.push([pts[i][0] + mx * meter * f, pts[i][1] + my * meter * f]);
    }
    return { type: 'LineString', coordinates: uit.map(([x, y]) => [lng0 + x / kx, lat0 + y / ky]) };
  } catch { return null; }
}

export function vloeiend(lijn) {
  if (lijn.coordinates.length < 3) return lijn;
  try { return turf.bezierSpline(turf.feature(lijn), { resolution: 10000, sharpness: 0.85 }).geometry; } catch { return lijn; }
}

export function richtingBij(lijn, eind = true) {
  const c = lijn.coordinates;
  if (c.length < 2) return 0;
  const [a, b] = eind ? [c[c.length - 2], c[c.length - 1]] : [c[1], c[0]];
  return turf.bearing(a, b);
}

// Terra Draw weigert coördinaten met meer dan 9 decimalen (± 0,1 mm).
export function rondGeom(g, d = 9) {
  if (!g) return g;
  const f = 10 ** d;
  const r = (c) => [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f];
  if (g.type === 'Point') return { type: 'Point', coordinates: r(g.coordinates) };
  if (g.type === 'LineString') return { type: 'LineString', coordinates: g.coordinates.map(r) };
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map((ring) => ring.map(r)) };
  return g;
}

// Scherpe hoeken van een lijn of vlak afronden met straal r (meter).
// Elke hoek krijgt een boogje; de straal wordt kleiner als een stuk te kort is.
export function rondHoeken(geom, r) {
  if (!geom || !(r > 0)) return geom;
  const rond1 = (pts, dicht) => {
    if (pts.length < 3) return pts;
    const o = pts[0];
    const kx = 111320 * Math.cos((o[1] * Math.PI) / 180); const ky = 110574;
    const naar = ([x, y]) => [(x - o[0]) * kx, (y - o[1]) * ky];
    const terug = ([x, y]) => [o[0] + x / kx, o[1] + y / ky];
    let p = pts.map(naar);
    if (dicht) p = p.slice(0, -1);
    const n = p.length;
    const uit = [];
    for (let i = 0; i < n; i++) {
      const b = p[i];
      if (!dicht && (i === 0 || i === n - 1)) { uit.push(b); continue; }
      const a = p[(i - 1 + n) % n]; const c = p[(i + 1) % n];
      const la = Math.hypot(a[0] - b[0], a[1] - b[1]); const lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (la < 1e-6 || lc < 1e-6) { uit.push(b); continue; }
      const ua = [(a[0] - b[0]) / la, (a[1] - b[1]) / la]; const uc = [(c[0] - b[0]) / lc, (c[1] - b[1]) / lc];
      const cos = Math.max(-1, Math.min(1, ua[0] * uc[0] + ua[1] * uc[1]));
      const hoek = Math.acos(cos);
      if (hoek > Math.PI - 0.02) { uit.push(b); continue; } // bijna recht door
      // Afstand vanaf de hoek tot waar de boog begint.
      let t = r / Math.tan(hoek / 2);
      t = Math.min(t, la / 2, lc / 2);
      const p1 = [b[0] + ua[0] * t, b[1] + ua[1] * t];
      const p2 = [b[0] + uc[0] * t, b[1] + uc[1] * t];
      const stappen = Math.max(3, Math.min(16, Math.ceil(((Math.PI - hoek) / Math.PI) * 16)));
      for (let k = 0; k <= stappen; k++) {
        const s = k / stappen; const u = 1 - s;
        uit.push([u * u * p1[0] + 2 * u * s * b[0] + s * s * p2[0], u * u * p1[1] + 2 * u * s * b[1] + s * s * p2[1]]);
      }
    }
    if (dicht) uit.push(uit[0]);
    return uit.map(terug);
  };
  if (geom.type === 'LineString') return { type: 'LineString', coordinates: rond1(geom.coordinates, false) };
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map((r_) => rond1(r_, true)) };
  return geom;
}

// ---------- Zijden van een lijn of vlak exact maken ----------
// Lengte en richting (kompas, 0 = noord, met de klok mee) per zijde.
function lokaal(o) {
  const kx = 111320 * Math.cos((o[1] * Math.PI) / 180); const ky = 110574;
  return { naar: ([x, y]) => [(x - o[0]) * kx, (y - o[1]) * ky], terug: ([x, y]) => [o[0] + x / kx, o[1] + y / ky] };
}
function hoekpunten(geom) {
  if (geom?.type === 'LineString') return { pts: geom.coordinates.slice(), dicht: false };
  if (geom?.type === 'Polygon') return { pts: geom.coordinates[0].slice(0, -1), dicht: true };
  return null;
}
export function zijden(geom) {
  const h = hoekpunten(geom);
  if (!h) return [];
  const L = lokaal(h.pts[0]);
  const p = h.pts.map(L.naar);
  const n = h.dicht ? p.length : p.length - 1;
  const uit = [];
  for (let i = 0; i < n; i++) {
    const a = p[i]; const b = p[(i + 1) % p.length];
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    uit.push({ lengte: Math.hypot(dx, dy), richting: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360, sluit: h.dicht && i === n - 1 });
  }
  return uit;
}
// Zet zijde i op een nieuwe lengte en/of richting; alles wat erna komt schuift
// of draait mee (de laatste, sluitende zijde van een vlak past zich aan).
export function zetZijde(geom, i, { lengte: nl, richting: nr } = {}) {
  const h = hoekpunten(geom);
  if (!h) return geom;
  const L = lokaal(h.pts[0]);
  const p = h.pts.map(L.naar);
  // Vlak + enkel lengte: oprekken, zodat haakse vormen (L, U) haaks blijven.
  if (h.dicht && nl != null && nr == null) {
    const a = p[i]; const b = p[(i + 1) % p.length];
    const dx = b[0] - a[0]; const dy = b[1] - a[1]; const len = Math.hypot(dx, dy);
    if (len < 1e-9) return geom;
    const ux = dx / len; const uy = dy / len; const d = nl - len;
    const mid = ((a[0] + b[0]) / 2) * ux + ((a[1] + b[1]) / 2) * uy;
    const q = p.map((pt) => (pt[0] * ux + pt[1] * uy > mid + 1e-9 ? [pt[0] + ux * d, pt[1] + uy * d] : pt)).map(L.terug);
    return { type: 'Polygon', coordinates: [[...q, q[0]]] };
  }
  if (i + 1 >= p.length) return geom;
  const a = p[i]; const b = p[i + 1];
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const oudL = Math.hypot(dx, dy);
  const oudR = Math.atan2(dx, dy);
  const R = nr != null ? (nr * Math.PI) / 180 : oudR;
  const Ln = nl != null ? nl : oudL;
  const delta = R - oudR;
  const nb = [a[0] + Ln * Math.sin(R), a[1] + Ln * Math.cos(R)];
  // Punten na b: eerst rond a draaien (met de klok mee = -delta in wiskundige zin), dan verschuiven.
  const cos = Math.cos(-delta); const sin = Math.sin(-delta);
  const rond = ([x, y]) => { const rx = x - a[0]; const ry = y - a[1]; return [a[0] + rx * cos - ry * sin, a[1] + rx * sin + ry * cos]; };
  const bRot = rond(b);
  const verschuif = [nb[0] - bRot[0], nb[1] - bRot[1]];
  const q = p.map((pt, j) => (j <= i ? pt : (() => { const r = rond(pt); return [r[0] + verschuif[0], r[1] + verschuif[1]]; })()));
  const terug = q.map(L.terug);
  if (h.dicht) return { type: 'Polygon', coordinates: [[...terug, terug[0]]] };
  return { type: 'LineString', coordinates: terug };
}

// Lijnelement (hekken) op een veelvoud van één stuk brengen door het laatste
// stuk van de lijn te verlengen of in te korten.
//  modus 'zacht': enkel als je er dicht bij zit (15 % van een stuk, max 0,5 m)
//  modus 'vol':   altijd naar het dichtste aantal volledige stukken (min. 1)
export function snapLijnLengte(lijn, eenheid, modus = 'zacht') {
  if (!lijn || lijn.type !== 'LineString' || !(eenheid > 0) || modus === 'uit') return { geometrie: lijn, gesnapt: false };
  const L = lengte(lijn);
  const n = Math.max(1, Math.round(L / eenheid));
  const doel = n * eenheid;
  const marge = Math.min(0.5, eenheid * 0.15);
  if (Math.abs(doel - L) < 0.005) return { geometrie: lijn, gesnapt: true, stuks: n };
  if (modus !== 'vol' && Math.abs(doel - L) > marge) return { geometrie: lijn, gesnapt: false, stuks: Math.ceil(L / eenheid - 1e-6) };
  const seg = laatsteSegment(lijn);
  const nieuw = seg.lengte + (doel - L);
  if (nieuw < 0.05) return { geometrie: lijn, gesnapt: false };
  return { geometrie: zetLaatsteSegment(lijn, nieuw), gesnapt: true, stuks: n };
}

// ---------- Bochten (zoals in Illustrator: een stuk tussen twee punten krom trekken) ----------
// h = uitbuiging in meter op het midden van het stuk, positief = links van de richting a→b.
function boogSchaal(a, b) {
  const lat = (a[1] + b[1]) / 2;
  return { kx: 111320 * Math.cos((lat * Math.PI) / 180), ky: 110574 };
}
export function boogPunten(a, b, h, n = 20) {
  if (!h) return [a, b];
  const { kx, ky } = boogSchaal(a, b);
  const bx = (b[0] - a[0]) * kx; const by = (b[1] - a[1]) * ky; const L = Math.hypot(bx, by) || 1;
  const nx = -by / L; const ny = bx / L;
  const cx = bx / 2 + 2 * h * nx; const cy = by / 2 + 2 * h * ny;
  const uit = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const u = 1 - t;
    const x = 2 * u * t * cx + t * t * bx; const y = 2 * u * t * cy + t * t * by;
    uit.push(i === 0 ? a : i === n ? b : [a[0] + x / kx, a[1] + y / ky]);
  }
  return uit;
}
// Top van de bocht (het punt op het midden van de kromme).
export function boogTop(a, b, h) {
  const { kx, ky } = boogSchaal(a, b);
  const bx = (b[0] - a[0]) * kx; const by = (b[1] - a[1]) * ky; const L = Math.hypot(bx, by) || 1;
  return [a[0] + (bx / 2 - (by / L) * h) / kx, a[1] + (by / 2 + (bx / L) * h) / ky];
}
// Uitbuiging die bij een punt p hoort (afstand loodrecht op het stuk, links positief).
export function boogH(a, b, p) {
  const { kx, ky } = boogSchaal(a, b);
  const bx = (b[0] - a[0]) * kx; const by = (b[1] - a[1]) * ky; const L = Math.hypot(bx, by) || 1;
  const px = (p[0] - a[0]) * kx; const py = (p[1] - a[1]) * ky;
  return (bx * py - by * px) / L;
}
// Een bocht splitsen op parameter t (0..1): het punt op de kromme en de bocht van beide helften, zodat de vorm
// precies dezelfde blijft (de Casteljau op de kwadratische kromme).
export function splitsBoog(a, b, h, t) {
  const { kx, ky } = boogSchaal(a, b);
  const bx = (b[0] - a[0]) * kx; const by = (b[1] - a[1]) * ky; const L = Math.hypot(bx, by) || 1;
  const cx = bx / 2 + 2 * h * (-by / L); const cy = by / 2 + 2 * h * (bx / L);
  const u = 1 - t;
  const px = 2 * u * t * cx + t * t * bx; const py = 2 * u * t * cy + t * t * by;
  const q0 = [t * cx, t * cy]; const q1 = [cx + t * (bx - cx), cy + t * (by - cy)];
  const naarGeo = (x, y) => [a[0] + x / kx, a[1] + y / ky];
  const p = naarGeo(px, py);
  // Bocht van een helft = de helft van de afstand van zijn controlepunt tot zijn koorde (links positief).
  const zij = (ax, ay, ex, ey, qx, qy) => { const dx = ex - ax; const dy = ey - ay; const l = Math.hypot(dx, dy) || 1; return ((dx * (qy - ay) - dy * (qx - ax)) / l) / 2; };
  return { punt: p, h1: zij(0, 0, px, py, q0[0], q0[1]), h2: zij(px, py, bx, by, q1[0], q1[1]) };
}
export function buig(geom, bogen) {
  if (!geom || !bogen || !Object.keys(bogen).some((k) => Number(bogen[k]))) return geom;
  const ring = (c) => { const uit = [c[0]]; for (let k = 0; k < c.length - 1; k++) uit.push(...boogPunten(c[k], c[k + 1], Number(bogen[k]) || 0).slice(1)); return uit; };
  if (geom.type === 'LineString') return { type: 'LineString', coordinates: ring(geom.coordinates) };
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: [ring(geom.coordinates[0]), ...geom.coordinates.slice(1)] };
  return geom;
}
// Bochten meenemen als er punten bij komen of weg gaan: een stuk houdt zijn bocht
// zolang zijn begin- en eindpunt hetzelfde blijven.
export function herschikBogen(oudG, nieuwG, bogen) {
  if (!bogen || !oudG || !nieuwG || oudG.type !== nieuwG.type) return bogen;
  const c0 = oudG.type === 'Polygon' ? oudG.coordinates[0] : oudG.coordinates;
  const c1 = nieuwG.type === 'Polygon' ? nieuwG.coordinates[0] : nieuwG.coordinates;
  if (!c0 || !c1) return bogen;
  if (c0.length === c1.length) return bogen;
  const sl = (p, q) => `${p[0].toFixed(7)},${p[1].toFixed(7)}|${q[0].toFixed(7)},${q[1].toFixed(7)}`;
  const oud = new Map();
  for (let k = 0; k < c0.length - 1; k++) if (Number(bogen[k])) oud.set(sl(c0[k], c0[k + 1]), Number(bogen[k]));
  const uit = {};
  for (let k = 0; k < c1.length - 1; k++) { const h = oud.get(sl(c1[k], c1[k + 1])); if (h) uit[k] = h; }
  return uit;
}
