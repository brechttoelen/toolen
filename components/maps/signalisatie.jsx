'use client';

// Signalisatie: punten op de kaart met een kijkrichting en een stapel losse
// panelen (bestemmingen). De pijl is geen deel van het paneel: het is een
// plakpijl die in de juiste richting gekleefd wordt.
//
// plan.instellingen.signalisatie = { bestemmingen: [{ id, naam, kleur, tekstkleur }], routes: [{ id, lijn_id, ppo_id, bestemming_id }], auto_ankers, reserve }
// item.velden.sign = { nr, richting, rijen: [{ bestemming_id, pijl }], kant, bevestiging, straat }

import * as turf from '@turf/turf';

export const PIJLEN = [
  ['rechtdoor', 'Rechtdoor'], ['schuin-rechts', 'Schuin rechts'], ['rechts', 'Rechts'],
  ['schuin-links', 'Schuin links'], ['links', 'Links'], ['terug', 'Terug'], ['u-bocht', 'U-bocht'], ['geen', 'Geen pijl'],
];
export const PIJL_HOEK = { rechtdoor: 0, 'schuin-rechts': 45, rechts: 90, terug: 180, links: -90, 'schuin-links': -45 };
export const KANTEN = [['rechts', 'Rechts'], ['links', 'Links'], ['midden', 'Middenberm']];
export const BEVESTIGING = [['heras', 'Heras'], ['paal', 'Paal'], ['schraag', 'Schraag'], ['nadar', 'Nadar'], ['andere', 'Andere']];
export const SJABLOONKLEUREN = [['#FACC15', '#1d1d1b'], ['#1d1d1b', '#ffffff'], ['#E11D48', '#ffffff'], ['#2563EB', '#ffffff'], ['#16865C', '#ffffff'], ['#ffffff', '#1d1d1b']];

export const isSign = (it) => !!it?.velden?.sign;

export function instSign(plan) {
  const s = plan?.instellingen?.signalisatie || {};
  const bestemmingen = s.bestemmingen || [];
  // Routes: lijn + PPO-punt + bestemming. Oudere plannen hadden één route per bestemming (route_id).
  const routes = s.routes || bestemmingen.filter((b) => b.route_id).map((b) => ({ id: `r-${b.id}`, lijn_id: b.route_id, ppo_id: null, bestemming_id: b.id }));
  return { bestemmingen, routes, auto_ankers: s.auto_ankers || [], reserve: s.reserve ?? 0.1, bord: s.bord === 'staand' ? 'staand' : 'strook', logo: s.logo !== false, formaat: s.formaat || 'A4' };
}

const M = { units: 'meters' };

// Richting van de route bij een punt: de rijrichting vlak vóór het punt en vlak erna.
export function routeHoeken(route, punt, afstand = 35) {
  if (!route || route.type !== 'LineString' || route.coordinates.length < 2) return null;
  const lijn = turf.lineString(route.coordinates);
  const dichtst = turf.nearestPointOnLine(lijn, turf.point(punt), M);
  if (dichtst.properties.dist > 60) return null; // te ver van de route
  const pos = dichtst.properties.location;
  const tot = turf.length(lijn, M);
  const voor = turf.along(lijn, Math.max(0, pos - afstand), M).geometry.coordinates;
  const na = turf.along(lijn, Math.min(tot, pos + afstand), M).geometry.coordinates;
  const hier = dichtst.geometry.coordinates;
  const inkomend = pos > 1 ? turf.bearing(voor, hier) : turf.bearing(hier, na);
  const uitgaand = pos < tot - 1 ? turf.bearing(hier, na) : inkomend;
  return { inkomend, uitgaand, afstand: dichtst.properties.dist };
}

export const norm = (h) => { let x = ((h + 180) % 360 + 360) % 360 - 180; if (x === -180) x = 180; return x; };

export function pijlUitHoek(draai) {
  const a = Math.abs(draai);
  if (a < 22) return 'rechtdoor';
  if (a < 67) return draai > 0 ? 'schuin-rechts' : 'schuin-links';
  if (a < 140) return draai > 0 ? 'rechts' : 'links';
  return 'terug';
}

// Kijkrichting (graden, 0 = noord) uit de route die het dichtst ligt.
export function richtingUitRoutes(punt, routes) {
  let best = null;
  for (const r of routes) {
    const h = routeHoeken(r, punt);
    if (h && (!best || h.afstand < best.afstand)) best = h;
  }
  return best ? ((best.inkomend % 360) + 360) % 360 : null;
}

// Pijlvoorstel per rij: draai tussen de kijkrichting en het vervolg van de route
// naar die bestemming.
export function pijlVoorstel(punt, richting, route) {
  const h = routeHoeken(route, punt);
  if (!h) return null;
  return pijlUitHoek(norm(h.uitgaand - (richting ?? h.inkomend)));
}

// Volgende vrije nummer binnen een laag.
export function volgendNr(items, laagId) {
  let max = 0;
  for (const it of items) if (isSign(it) && (laagId === undefined || it.laag_id === laagId)) max = Math.max(max, Number(it.velden.sign.nr) || 0);
  return max + 1;
}

// Pijlvorm als veelhoek in een vak van 1×1 (midden 0,0), naar boven = rechtdoor.
export function pijlVorm(pijl) {
  if (pijl === 'u-bocht') {
    // U-bocht: omhoog, bocht naar links, omlaag met punt.
    const pts = [];
    const r = 0.22;
    pts.push([0.3, 0.45], [0.3, -0.05]);
    for (let i = 0; i <= 12; i++) { const t = (Math.PI * i) / 12; pts.push([0.08 + r * Math.cos(t), -0.05 - r * Math.sin(t)]); }
    return { lijn: pts, punt: [[-0.32, 0.05], [-0.14, 0.05], [-0.23, 0.32]] };
  }
  const hoek = ((PIJL_HOEK[pijl] ?? 0) * Math.PI) / 180;
  const vorm = [[-0.12, 0.42], [0.12, 0.42], [0.12, -0.05], [0.3, -0.05], [0, -0.45], [-0.3, -0.05], [-0.12, -0.05]];
  return { vlak: vorm.map(([x, y]) => [x * Math.cos(hoek) - y * Math.sin(hoek), x * Math.sin(hoek) + y * Math.cos(hoek)]) };
}

export function PijlSvg({ pijl, maat = 28, kleur = '#1d1d1b' }) {
  if (!pijl || pijl === 'geen') return null;
  const v = pijlVorm(pijl);
  const p = (pts) => pts.map(([x, y]) => `${(x + 0.5) * 100},${(y + 0.5) * 100}`).join(' ');
  return (
    <svg width={maat} height={maat} viewBox="0 0 100 100" aria-label={pijl} role="img">
      {v.vlak && <polygon points={p(v.vlak)} fill={kleur} />}
      {v.lijn && <polyline points={p(v.lijn)} fill="none" stroke={kleur} strokeWidth="18" strokeLinejoin="round" />}
      {v.punt && <polygon points={p(v.punt)} fill={kleur} />}
    </svg>
  );
}

// Bestellijst over alle punten.
export function bestellijst(items, bestemmingen, reserve = 0.1, bord = 'paneel') {
  const geprint = bord !== 'paneel';
  const perBest = new Map(geprint ? [] : bestemmingen.filter((b) => b.soort !== 'set').map((b) => [b.id, { ...b, stuks: 0 }]));
  const bMap = new Map(bestemmingen.map((b) => [b.id, b]));
  const NAAM = Object.fromEntries(PIJLEN);
  let pijlen = 0; let ubocht = 0;
  const bevest = new Map();
  let punten = 0;
  for (const it of items) {
    if (!isSign(it)) continue;
    punten += 1;
    const s = it.velden.sign;
    for (const r of s.rijen || []) {
      const bs = bMap.get(r.bestemming_id);
      if (bs?.soort === 'set') {
        // Bord uit de bibliotheek: telt per bord; de pijl is een plakpijl.
        if (!perBest.has(bs.id)) perBest.set(bs.id, { ...bs, stuks: 0 });
        perBest.get(bs.id).stuks += 1;
        if (bs.zone && r.pijl && r.pijl !== 'geen') { if (r.pijl === 'u-bocht') ubocht += 1; else pijlen += 1; }
        continue;
      }
      if (geprint) {
        const k = `${r.bestemming_id}|${r.pijl || 'geen'}`;
        const bb = bMap.get(r.bestemming_id);
        if (!bb) continue;
        if (!perBest.has(k)) perBest.set(k, { ...bb, id: k, naam: `${bb.naam}${r.pijl && r.pijl !== 'geen' ? ` · ${(NAAM[r.pijl] || r.pijl).toLowerCase()}` : ''}`, stuks: 0 });
        perBest.get(k).stuks += 1;
        continue;
      }
      const b = perBest.get(r.bestemming_id);
      if (b) b.stuks += 1;
      if (r.pijl === 'u-bocht') ubocht += 1;
      else if (r.pijl && r.pijl !== 'geen') pijlen += 1;
    }
    if (s.bevestiging) bevest.set(s.bevestiging, (bevest.get(s.bevestiging) || 0) + 1);
  }
  const mr = (n) => (n ? Math.ceil(n * (1 + reserve)) : 0);
  return {
    punten,
    panelen: [...perBest.values()].filter((b) => b.stuks),
    pijlen, pijlenBesteld: mr(pijlen), ubocht, ubochtBesteld: mr(ubocht),
    bevestiging: [...bevest.entries()].map(([k, n]) => ({ soort: BEVESTIGING.find(([x]) => x === k)?.[1] || k, n })),
  };
}

export function bestellijstCsv(b, reserve) {
  const r = [['Soort', 'Omschrijving', 'Nodig', 'Bestellen']];
  for (const p of b.panelen) r.push(['Paneel', p.naam, p.stuks, Math.ceil(p.stuks * (1 + reserve))]);
  if (b.pijlen) r.push(['Plakpijl', 'Pijl (in elke richting te kleven)', b.pijlen, b.pijlenBesteld]);
  if (b.ubocht) r.push(['Plakpijl', 'U-bocht', b.ubocht, b.ubochtBesteld]);
  for (const x of b.bevestiging) r.push(['Bevestiging', x.soort, x.n, x.n]);
  return r.map((rij) => rij.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

// Icoon voor de kijkrichting (wig) op de kaart.
export function zorgVoorKijkIcoon(map) {
  if (map.hasImage('fm-kijk')) return;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(225,29,72,0.9)';
  x.beginPath(); x.moveTo(32, 2); x.lineTo(50, 34); x.lineTo(32, 26); x.lineTo(14, 34); x.closePath(); x.fill();
  map.addImage('fm-kijk', x.getImageData(0, 0, 64, 64), { pixelRatio: 2 });
}

export function signGeojson(items, lagenMap, verborgenLagen) {
  const f = [];
  for (const it of items) {
    if (!isSign(it) || it.geometrie?.type !== 'Point' || it.verborgen) continue;
    if (it.laag_id && verborgenLagen?.has(it.laag_id)) continue;
    const s = it.velden.sign;
    f.push({ type: 'Feature', geometry: it.geometrie, properties: { id: it.id, nr: String(s.nr ?? ''), richting: Number(s.richting) || 0, heeftRichting: s.richting != null, rijen: (s.rijen || []).length } });
  }
  return { type: 'FeatureCollection', features: f };
}
