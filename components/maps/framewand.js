// B-matrix frame-wand: een lijn van textielframes (B62 e.d.) naast elkaar, met hoeken.
// Per zijde van de lijn een reeks frames (breedtes uit de beschikbare maten), één hoogte voor
// de hele wand en eventueel een plint (liggende smalle frames eronder). Elk frame heeft een
// voor- en een achterkant om te branden.
//
// Element:  eigenschappen.wand = { profiel, diepte, maten: { "<hoogte>": [breedtes] }, plint: { b, h }, voorraad: { "<b>x<h>": n } }
// Item:     velden.wand = { hoogte, plint, zijden: [{ rijen: [{ h, frames: [b…] | null }] } | [b…] (oud) | null], voor: [id per frame], achter: [id per frame] }
//           Rijen van onder naar boven; een rij met h kleiner dan de breedte = frames plat (bv. 1984 breed × 992 hoog).
//           frames null = automatisch: zo veel mogelijk brede frames, de rest opgevuld met smallere.

import * as turf from '@turf/turf';

export const isWand = (el) => !!el?.eigenschappen?.wand;

const r3 = (v) => Math.round(v * 1000) / 1000;
export const mm = (m) => String(Math.round(Number(m) * 1000));

export function wandInst(el) {
  const w = el?.eigenschappen?.wand || {};
  const maten = w.maten || { '1.984': [0.992, 0.248], '2.976': [0.992, 0.496] };
  const hoogtes = Object.keys(maten).map(Number).sort((a, b) => a - b);
  return { profiel: w.profiel || 'B62', diepte: Number(w.diepte) || 0.062, maten, hoogtes, plint: w.plint || { b: 1.984, h: 0.248 }, voorraad: w.voorraad || {} };
}

export function wandHoogte(it, el) {
  const I = wandInst(el); const h = Number(it?.velden?.wand?.hoogte);
  return I.hoogtes.includes(h) ? h : I.hoogtes[0];
}
export const breedtesVoor = (el, h) => [...(wandInst(el).maten[String(h)] || wandInst(el).maten[h.toFixed(3)] || [])].map(Number).sort((a, b) => b - a);

// Automatisch vullen: brede frames, dan de rest met smallere (tot 6 cm speling).
export function autoVul(L, breedtes) {
  const uit = []; let rest = L + 0.06;
  for (const b of breedtes) { while (rest >= b) { uit.push(b); rest -= b; } }
  if (!uit.length && breedtes.length) uit.push(breedtes[breedtes.length - 1]);
  return uit;
}

// Frames die er zijn, als [kort, lang] (rechtop = kort breed, lang hoog; plat = omgekeerd).
export function catalogus(el) {
  const I = wandInst(el); const m = new Map();
  const zet = (a, b) => { const k = [Math.min(a, b), Math.max(a, b)].map(r3); m.set(k.join('x'), k); };
  for (const [h, bs] of Object.entries(I.maten)) for (const b of bs) zet(Number(b), Number(h));
  zet(I.plint.b, I.plint.h);
  for (const s of Object.keys(I.voorraad)) { const [a, b] = s.split('x').map(Number); if (a > 0 && b > 0) zet(a, b); }
  return [...m.values()];
}
// Breedtes die in een rij van hoogte h passen (rechtop en plat), breedste eerst.
export function rijMaten(el, h) {
  const uit = new Set();
  for (const [a, L] of catalogus(el)) { if (Math.abs(L - h) < 0.002) uit.add(a); if (Math.abs(a - h) < 0.002) uit.add(L); }
  return [...uit].sort((x, y) => y - x);
}
// Mogelijke rijhoogtes: elke maat van een frame (rechtop of plat).
export const rijHoogtes = (el) => [...new Set(catalogus(el).flat())].sort((x, y) => y - x);
export const isPlat = (el, b, h) => b > h + 0.002;

// Rijen per zijde, van onder naar boven: [{ h, frames: [b, …], eigen }].
// Opslag: zijden[k] = { rijen: [{ h, frames | null }] }; oud formaat (lijst breedtes + plint) wordt omgezet.
export function rijenVan(it, el, k, L) {
  const w = it?.velden?.wand || {}; const z = (w.zijden || [])[k]; const I = wandInst(el);
  let rijen;
  if (z && !Array.isArray(z) && Array.isArray(z.rijen) && z.rijen.length) rijen = z.rijen.map((r) => ({ h: Number(r.h), frames: Array.isArray(r.frames) && r.frames.length ? r.frames.map(Number) : null }));
  else {
    rijen = [];
    if (w.plint) rijen.push({ h: I.plint.h, frames: null, plint: true });
    rijen.push({ h: wandHoogte(it, el), frames: Array.isArray(z) && z.length ? z.map(Number) : null });
  }
  return rijen.map((r) => {
    const br = rijMaten(el, r.h);
    const eigen = r.frames ? r.frames.filter((b) => br.some((x) => Math.abs(x - b) < 0.002)) : null;
    return { h: r.h, frames: eigen && eigen.length ? eigen : autoVul(L, br), eigen: !!(eigen && eigen.length), plint: !!r.plint };
  });
}
// Opslagvorm van de rijen van één zijde.
export const rijenOpslag = (rijen) => ({ rijen: rijen.map((r) => ({ h: r.h, frames: r.eigen === false ? null : r.frames })) });

// Indeling per zijde (lengtes in meter): [[b, …], …] van de onderste volle rij (voor oude code).
export function wandIndeling(lengtes, it, el) {
  return lengtes.map((L, k) => { const r = rijenVan(it, el, k, L); return (r.find((x) => !x.plint) || r[0]).frames; });
}

// Alle frames op een rij: { i (volgnummer), zijde, rij, k (in de rij), b, h, z0, van, tot, voor, achter }
export const isVrij = (it) => Array.isArray(it?.velden?.wand?.vrij) && it.velden.wand.vrij.length > 0;

export function wandFrames(lengtes, it, el) {
  const w = it?.velden?.wand || {};
  // Vrij gebouwd (wandbouwer): elk frame met eigen plek, richting en hoogte boven de vloer.
  if (isVrij(it)) return w.vrij.map((v, i) => ({ i, zijde: 0, rij: Math.round((Number(v.z) || 0) * 100), k: i, b: Number(v.b), h: Number(v.h), z0: Number(v.z) || 0, van: 0, tot: Number(v.b), vid: v.id, lok: v, voor: v.voor || null, achter: v.achter || null, voorOver: v.voorOver || null, achterOver: v.achterOver || null, voorPl: v.voorPl || null, achterPl: v.achterPl || null, voorSt: v.voorSt || null, achterSt: v.achterSt || null }));
  const uit = []; let i = 0;
  lengtes.forEach((L, zijde) => {
    let z0 = 0;
    rijenVan(it, el, zijde, L).forEach((r, rij) => {
      let d = 0;
      r.frames.forEach((b, k) => { const f = { i, zijde, rij, k, b, h: r.h, z0, van: d, tot: d + b }; f.voor = doekOp(w, 'voor', f); f.achter = doekOp(w, 'achter', f); uit.push(f); d += b; i += 1; });
      z0 += r.h;
    });
  });
  return uit;
}
// Doeken per plek (zijde.rij.k), zodat ze op hun frame blijven als je frames toevoegt of rijen wijzigt.
// Oud formaat: lijst per volgnummer.
export const plekSleutel = (f) => `${f.zijde}.${f.rij}.${f.k}`;
export function doekOp(w, kant, f) {
  const v = w?.[kant]; if (!v) return null;
  return (Array.isArray(v) ? v[f.i] : v[plekSleutel(f)]) || null;
}
// Nieuwe wand-velden met de doeken van alle frames (f.voor / f.achter) als plek-tabel, plus een wijziging.
export function doekenOpslag(frames, wijzig = () => null) {
  const uit = { voor: {}, achter: {} };
  for (const f of frames) for (const kant of ['voor', 'achter']) { const x = wijzig(f, kant); const id = x === undefined || x === null ? f[kant] : x || null; if (id) uit[kant][plekSleutel(f)] = id; }
  return uit;
}
// Lengte van de wand: per zijde de langste rij.
export const wandLengte = (frames) => { if (frames[0]?.lok) return frames.filter((f) => f.z0 < 0.01).reduce((a, f) => a + f.b, 0); const m = new Map(); for (const f of frames) { const k = `${f.zijde}.${f.rij}`; m.set(k, (m.get(k) || 0) + f.b); } const z = new Map(); for (const [k, v] of m) { const zi = k.split('.')[0]; z.set(zi, Math.max(z.get(zi) || 0, v)); } return [...z.values()].reduce((a, b) => a + b, 0); };
// Frames met hun twee voetpunten (a → b, in meter) in het stelsel van de punten `pts` van de lijn.
// Vrij gebouwd: plekken ten opzichte van het eerste punt, x-as langs het eerste stuk.
export function wandStukken(pts, it, el) {
  const L = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]));
  const fr = wandFrames(L, it, el);
  if (isVrij(it)) {
    const o = pts[0] || [0, 0]; const q = pts[1] || [o[0] + 1, o[1]]; const a0 = Math.atan2(q[1] - o[1], q[0] - o[0]);
    return fr.map((f) => {
      const v = f.lok; const p = v.p || [0, 0]; const r = a0 + ((Number(v.r) || 0) * Math.PI) / 180;
      const a = [o[0] + p[0] * Math.cos(a0) - p[1] * Math.sin(a0), o[1] + p[0] * Math.sin(a0) + p[1] * Math.cos(a0)];
      return { ...f, a, e: [a[0] + Math.cos(r) * f.b, a[1] + Math.sin(r) * f.b], r };
    });
  }
  return fr.map((f) => {
    const A = pts[f.zijde]; const B = pts[f.zijde + 1]; const Lz = L[f.zijde] || 1; const u = [(B[0] - A[0]) / Lz, (B[1] - A[1]) / Lz];
    return { ...f, a: [A[0] + u[0] * f.van, A[1] + u[1] * f.van], e: [A[0] + u[0] * f.tot, A[1] + u[1] * f.tot], r: Math.atan2(u[1], u[0]) };
  });
}
// Omgekeerd: frames (a, r in het stelsel van pts) naar de opslag van een vrij gebouwde wand.
export function naarVrij(pts, stukken) {
  const o = pts[0] || [0, 0]; const q = pts[1] || [o[0] + 1, o[1]]; const a0 = Math.atan2(q[1] - o[1], q[0] - o[0]);
  return stukken.map((f) => {
    const d = [f.a[0] - o[0], f.a[1] - o[1]];
    const r = (((((f.r - a0) * 180) / Math.PI) % 360) + 360) % 360;
    return { id: f.vid || Math.random().toString(36).slice(2, 9), b: r3(f.b), h: r3(f.h), z: r3(f.z0 || 0), p: [r3(d[0] * Math.cos(a0) + d[1] * Math.sin(a0)), r3(-d[0] * Math.sin(a0) + d[1] * Math.cos(a0))], r: Math.round(r * 10) / 10, voor: f.voor || null, achter: f.achter || null, ...(f.voor && f.voorOver ? { voorOver: f.voorOver } : {}), ...(f.achter && f.achterOver ? { achterOver: f.achterOver } : {}), ...(f.voor && f.voorPl ? { voorPl: f.voorPl } : {}), ...(f.achter && f.achterPl ? { achterPl: f.achterPl } : {}), ...(f.voor && f.voorSt ? { voorSt: f.voorSt } : {}), ...(f.achter && f.achterSt ? { achterSt: f.achterSt } : {}) };
  });
}
// Lijn in lng/lat ↔ meter rond het eerste punt (voor de kaart).
export function naarMeterLijn(c) {
  const o = c[0]; const kx = 111320 * Math.cos((o[1] * Math.PI) / 180); const ky = 110574;
  return { pts: c.map((p) => [(p[0] - o[0]) * kx, (p[1] - o[1]) * ky]), terug: ([x, y]) => [o[0] + x / kx, o[1] + y / ky] };
}
export const wandTotaalHoogte = (lengtes, it, el) => (isVrij(it) ? Math.max(0, ...wandFrames(lengtes, it, el).map((f) => f.z0 + f.h)) : Math.max(0, ...lengtes.map((L, k) => rijenVan(it, el, k, L).reduce((a, r) => a + r.h, 0))));

// Plint: wordt nu als gewone rij geteld.
export const plintStuks = () => 0;

export const frameSleutel = (b, h) => `${r3(b)}x${r3(h)}`;
export const frameNaam = (b, h, el) => `${wandInst(el).profiel} frame ${mm(Math.min(b, h))} × ${mm(Math.max(b, h))} mm`;

// Telling per maat voor één wand: { "<b>x<h>": n }
export function wandTelling(lengtes, it, el) {
  const t = {};
  for (const f of wandFrames(lengtes, it, el)) { const s = frameSleutel(Math.min(f.b, f.h), Math.max(f.b, f.h)); t[s] = (t[s] || 0) + 1; }
  return t;
}

// Lengtes van de zijden van een lijn in meter (lokale punten of lng/lat met een meetfunctie).
export const zijLengtes = (pts, meet = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])) => pts.slice(1).map((p, k) => meet(pts[k], p));

export const wandHoogteTekst = (it, el) => `${mm(wandHoogte(it, el))}${it?.velden?.wand?.plint ? ` + ${mm(wandInst(el).plint.h)} plint` : ''} mm`;

// Lengtes van de zijden van een wand-item: binnen in meter (lokaal), buiten op de kaart.
export function lengtesVanItem(x) {
  const lok = x?.velden?.binnen?.lokaal?.geometrie;
  if (lok?.type === 'LineString') return lok.coordinates.slice(1).map((p, k) => Math.hypot(p[0] - lok.coordinates[k][0], p[1] - lok.coordinates[k][1]));
  if (x?.geometrie?.type !== 'LineString') return null;
  const c = x.geometrie.coordinates; return c.slice(1).map((p, k) => turf.distance(c[k], p, { units: 'meters' }));
}
// Plekken om te branden: per frame voor- en achterkant (plek = 2 × frame + kant).
export const wandPlekken = (it, el) => wandFrames(lengtesVanItem(it) || [], it, el).flatMap((f) => [f.voor, f.achter]);
export function zetWandPlek(it, el, plek, id) {
  const fr = wandFrames(lengtesVanItem(it) || [], it, el);
  const w = it.velden?.wand || {}; const kant = plek % 2 ? 'achter' : 'voor'; const i = Math.floor(plek / 2);
  if (!fr[i] || (fr[i][kant] || null) === (id || null)) return it;
  if (isVrij(it)) return { ...it, velden: { ...(it.velden || {}), wand: { ...w, vrij: w.vrij.map((v, j) => (j === i ? { ...v, [kant]: id || null } : v)) } } };
  const d = doekenOpslag(fr, (f, k) => (f.i === i && k === kant ? id || '' : null));
  return { ...it, velden: { ...(it.velden || {}), wand: { ...w, ...d } } };
}
export const wandPlekNaam = (plek) => `frame ${Math.floor(plek / 2) + 1} (${plek % 2 ? 'achterkant' : 'voorkant'})`;

// Eén doek over meerdere frames: elk frame krijgt { g, u0, u1, v0, v1 } = welk stuk van het beeld erop valt
// (u van links naar rechts zoals je voor die kant staat, v van boven naar onder). null = frames niet in één vlak.
export function doekOver(frames, kant) {
  if (frames.length < 2) return null;
  const A = frames[0]; const u = [Math.cos(A.r), Math.sin(A.r)]; const n = [u[1], -u[0]];
  const vlak = A.a[0] * n[0] + A.a[1] * n[1];
  for (const f of frames) {
    const dr = Math.abs(((((f.r - A.r) * 180) / Math.PI) % 360 + 360) % 360);
    if (Math.min(dr, 360 - dr) > 1 || Math.abs(f.a[0] * n[0] + f.a[1] * n[1] - vlak) > 0.05) return null;
  }
  const sg = kant === 'voor' ? 1 : -1;
  const reeks = frames.map((f) => { const s0 = f.a[0] * u[0] + f.a[1] * u[1]; const x0 = sg > 0 ? s0 : -(s0 + f.b); return { f, x0, x1: x0 + f.b, z0: f.z0, z1: f.z0 + f.h }; });
  const X0 = Math.min(...reeks.map((x) => x.x0)); const X1 = Math.max(...reeks.map((x) => x.x1));
  const Z0 = Math.min(...reeks.map((x) => x.z0)); const Z1 = Math.max(...reeks.map((x) => x.z1));
  const W = X1 - X0 || 1; const H = Z1 - Z0 || 1; const g = Math.random().toString(36).slice(2, 8);
  const k4 = (v) => Math.round(v * 10000) / 10000;
  return new Map(reeks.map((x) => [x.f.i, { g, u0: k4((x.x0 - X0) / W), u1: k4((x.x1 - X0) / W), v0: k4((Z1 - x.z1) / H), v1: k4((Z1 - x.z0) / H), b: Math.round(W * 1000) / 1000, h: Math.round(H * 1000) / 1000 }]));
}
// Ontwerpen op een wand om te tellen: een doek over meerdere frames telt één keer.
export function wandOntwerpen(it, el) {
  const uit = []; const gezien = new Set();
  for (const f of wandFrames(lengtesVanItem(it) || [], it, el)) for (const kant of ['voor', 'achter']) {
    const o = f[`${kant}Over`]; const id = f[kant];
    if (id && o?.g) { const k = `${kant}.${o.g}`; if (gezien.has(k)) continue; gezien.add(k); }
    uit.push(id || null);
  }
  return uit;
}
