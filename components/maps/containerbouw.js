// Containerbouwer: units die op het plan naast, achter of op elkaar staan, als één opstelling.
// Elke unit blijft een eigen item (stuklijst, leverancier, stroom en binnenplan per unit); de bouwer zoekt
// de units die elkaar raken (zelfde draaiing per 90°) en werkt met hun kaders in het assenstelsel van de eerste unit.
//   item.parameters: midden [lng, lat], breedte (langs x), diepte (langs y), rot (graden, met de klok mee)
//   item.velden.verdieping: 0 = op de grond, 1 = erbovenop, …
// Ramen en deuren liggen vast per unit (zoals de leverancier ze levert): de bouwer verandert er niets aan.
const M_LAT = 110574; const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const rad = (g) => (g * Math.PI) / 180;

export const isTrapEl = (el) => !!el && /trap/i.test(el.naam || '') && el.categorie === 'Units en containers';
export const isUnitEl = (el) => !!el && !isTrapEl(el) && (el.categorie === 'Units en containers' || (el.categorie === 'Catering' && /container/i.test(`${el.naam} ${el.eigenschappen?.subgroep || ''}`)) || (el.categorie === 'Toiletten' && /container|unit/i.test(el.naam || '')))
  && el.tekenwijze === 'schaal' && Number(el.breedte_m) > 1.5 && Number(el.diepte_m) > 1.5;
export const isContainerDeel = (el) => isUnitEl(el) || isTrapEl(el);

// Schakelunits (Warsco BU-06-CD / CE / CF): D = eindunit open aan de rechterkant (+x), E = midden (beide open),
// F = eindunit open aan de linkerkant (−x). Naast elkaar: D · E · E · F = één grote ruimte.
export function schakelVan(el) {
  const r = /(BU-\d+-C)([DEF])\b/.exec(String(el?.naam || '')); if (!r) return null;
  return { fam: `${el.leverancier || ''}|${r[1]}`, rol: r[2] };
}
export const openZijden = (rol) => (rol === 'D' ? ['R'] : rol === 'F' ? ['L'] : rol === 'E' ? ['L', 'R'] : []);

export const unitHoogte = (el) => Number(el?.hoogte_m) > 0 ? Number(el.hoogte_m) : 2.8;
export const stapelMax = (el) => Number(el?.eigenschappen?.stapelbaar) || 1;

// Assenstelsel van een item: lokale meters (x langs de breedte, y langs de diepte, oorsprong in een hoek).
export function unitAssen(it) {
  const p = it?.parameters || {}; if (!p.midden) return null;
  const L = Number(p.breedte) || 1; const B = Number(p.diepte) || 1;
  const r = rad(Number(p.rot) || 0); const c = Math.cos(r); const s = Math.sin(r); const ml = mLng(p.midden[1]);
  return {
    L, B, rot: Number(p.rot) || 0,
    naarGeo: ([x, y]) => { const xc = x - L / 2; const yc = y - B / 2; return [p.midden[0] + (xc * c + yc * s) / ml, p.midden[1] + (-xc * s + yc * c) / M_LAT]; },
    vanGeo: ([lng, lat]) => { const E = (lng - p.midden[0]) * ml; const N = (lat - p.midden[1]) * M_LAT; return [E * c - N * s + L / 2, E * s + N * c + B / 2]; },
  };
}

// De opstelling rond een unit: alle units en trappen die (via elkaar) raken of op elkaar staan.
// Geeft [{ it, el, x0, y0, x1, y1, v, rot (verschil met de eerste unit: 0/90/180/270), H }] in het kader van de eerste unit.
export function unitGroep(it, el, items = [], elementenMap = new Map()) {
  const A = unitAssen(it); if (!A) return [];
  const leden = [];
  const kand = (items || []).filter((x) => x && !x.verborgen && x.parameters?.midden && isContainerDeel(elementenMap.get(x.element_id)));
  if (!kand.some((x) => x.id === it.id)) kand.unshift(it);
  const kader = (x) => {
    const e = x.id === it.id ? el : elementenMap.get(x.element_id); const B2 = unitAssen(x); if (!B2) return null;
    const d = ((((B2.rot - A.rot) % 360) + 360) % 360); const q = Math.round(d / 90) * 90 % 360; if (Math.abs(d - Math.round(d / 90) * 90) > 3) return null;
    const hk = [[0, 0], [B2.L, 0], [B2.L, B2.B], [0, B2.B]].map((h) => A.vanGeo(B2.naarGeo(h)));
    const xs = hk.map((h) => h[0]); const ys = hk.map((h) => h[1]);
    return { it: x, el: e, T: (q) => A.vanGeo(B2.naarGeo(q)), Lu: B2.L, Bu: B2.B, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), v: Number(x.velden?.verdieping) || 0, rot: q, H: unitHoogte(e), trap: isTrapEl(e) };
  };
  const alle = kand.map(kader).filter(Boolean);
  const eerste = alle.find((k) => k.it.id === it.id); if (!eerste) return [];
  const raak = (a, b) => {
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0); const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (a.v === b.v) return (ox > -0.15 && oy > 0.3) || (oy > -0.15 && ox > 0.3); // naast elkaar (gedeelde zijde)
    if (Math.abs(a.v - b.v) === 1) return ox > 0.3 && oy > 0.3; // op elkaar
    return false;
  };
  const groep = [eerste]; const in_ = new Set([eerste.it.id]);
  for (let k = 0; k < groep.length && groep.length < 40; k++) for (const c of alle) if (!in_.has(c.it.id) && raak(groep[k], c)) { groep.push(c); in_.add(c.it.id); }
  // Hoogte van elk lid: bovenop de hoogste unit eronder.
  const perV = [...groep].sort((a, b) => a.v - b.v);
  for (const g of perV) {
    if (!g.v) { g.z0 = 0; continue; }
    const onder = perV.filter((o) => o.v === g.v - 1 && !o.trap && Math.min(o.x1, g.x1) - Math.max(o.x0, g.x0) > 0.3 && Math.min(o.y1, g.y1) - Math.max(o.y0, g.y0) > 0.3);
    g.z0 = onder.length ? Math.max(...onder.map((o) => o.z0 + o.H)) : g.v * 2.8;
  }
  for (const g of groep) { if (leden.length < 40) leden.push(g); }
  return leden;
}

// Welke schakelunit hoort op welke plek: per rij (zelfde verdieping, zelfde diepte, naast elkaar langs x) D … E … F.
// Geeft [{ id, rol }] voor de units waarvan het type moet wisselen.
export function schakelPlan(groep) {
  const uit = [];
  const sch = groep.filter((g) => !g.trap && schakelVan(g.el) && (g.rot === 0 || g.rot === 180));
  const gezien = new Set();
  for (const g of sch) {
    if (gezien.has(g.it.id)) continue;
    const fam = schakelVan(g.el).fam;
    const rij = sch.filter((o) => o.v === g.v && schakelVan(o.el).fam === fam && Math.abs(o.y0 - g.y0) < 0.15 && Math.abs(o.y1 - g.y1) < 0.15).sort((a, b) => a.x0 - b.x0);
    // Aaneengesloten stukken in die rij.
    let stuk = [];
    const sluit = () => {
      if (stuk.length >= 2) stuk.forEach((o, k) => {
        const rolPlan = k === 0 ? 'D' : k === stuk.length - 1 ? 'F' : 'E';
        const rol = o.rot === 180 ? ({ D: 'F', F: 'D', E: 'E' })[rolPlan] : rolPlan; // gedraaid: links en rechts wisselen
        if (schakelVan(o.el).rol !== rol) uit.push({ id: o.it.id, rol, fam });
      });
      for (const o of stuk) gezien.add(o.it.id); stuk = [];
    };
    for (const o of rij) { if (stuk.length && o.x0 - stuk[stuk.length - 1].x1 > 0.15) sluit(); stuk.push(o); }
    sluit();
  }
  return uit;
}
export function schakelElement(elementen, fam, rol) {
  return (elementen || []).find((e) => e.actief !== false && !e.plan_id && schakelVan(e)?.fam === fam && schakelVan(e)?.rol === rol) || null;
}

// Open zijden van een lid in het kader van de groep (L = −x, R = +x).
export function openInGroep(g) {
  const s = schakelVan(g.el); if (!s) return [];
  const eigen = openZijden(s.rol);
  return g.rot === 180 ? eigen.map((z) => (z === 'L' ? 'R' : 'L')) : g.rot === 0 ? eigen : [];
}

// Wat je best nakijkt in de opstelling.
export function containerMeldingen(groep) {
  const uit = [];
  const units = groep.filter((g) => !g.trap); const traps = groep.filter((g) => g.trap);
  const naam = (g) => g.it.naam || (/\(([^)]*[A-Z]{2,}[^)]*\d[^)]*)\)\s*$/.exec(g.el?.naam || '') || [])[1] || g.el?.naam || 'Unit';
  const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.3 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.3;
  for (const g of units) {
    if (g.v > 0) {
      const onder = units.filter((o) => o.v === g.v - 1 && overlap(o, g));
      const opp = (g.x1 - g.x0) * (g.y1 - g.y0); const gedekt = onder.reduce((a, o) => a + Math.max(0, Math.min(o.x1, g.x1) - Math.max(o.x0, g.x0)) * Math.max(0, Math.min(o.y1, g.y1) - Math.max(o.y0, g.y0)), 0);
      if (gedekt < opp * 0.97) uit.push({ soort: 'fout', ids: [g.it.id], tekst: `${naam(g)}: staat niet volledig op de units eronder.` });
      const max = Math.min(stapelMax(g.el), ...onder.map((o) => stapelMax(o.el)));
      if (g.v + 1 > max) uit.push({ soort: 'fout', ids: [g.it.id, ...onder.map((o) => o.it.id)], tekst: `${naam(g)}: ${g.v + 1} hoog, maximaal ${max}.` });
    }
    const s = schakelVan(g.el);
    if (s) for (const z of openInGroep(g)) {
      const buur = units.some((o) => o !== g && o.v === g.v && schakelVan(o.el) && Math.abs(o.y0 - g.y0) < 0.15 && (z === 'R' ? Math.abs(o.x0 - g.x1) < 0.15 : Math.abs(o.x1 - g.x0) < 0.15));
      if (!buur) uit.push({ soort: 'fout', ids: [g.it.id], tekst: `${naam(g)}: open aan de ${z === 'R' ? 'rechter' : 'linker'}kant zonder buur.` });
    }
  }
  // Elke bovenverdieping heeft een trap nodig (een trap op verdieping v reikt tot verdieping v + 1).
  const hoogsteV = Math.max(0, ...units.map((g) => g.v));
  for (let v = 1; v <= hoogsteV; v++) {
    const boven = units.filter((g) => g.v === v); if (!boven.length) continue;
    const ok = traps.some((t) => t.v === v - 1 && boven.some((g) => Math.min(t.x1, g.x1 + 0.2) - Math.max(t.x0, g.x0 - 0.2) > 0.3 && Math.min(t.y1, g.y1 + 0.2) - Math.max(t.y0, g.y0 - 0.2) > 0.05 && !overlap(t, g)));
    if (!ok) uit.push({ soort: 'fout', ids: boven.map((g) => g.it.id), tekst: `Verdieping ${v}: geen trap.` });
  }
  if (traps.length && !hoogsteV) uit.push({ soort: 'let-op', ids: traps.map((t) => t.it.id), tekst: 'Trap zonder unit erboven.' });
  return uit;
}

// Nieuwe plek naast een lid (in het kader van de groep), even diep of even breed als de nieuwe unit.
// zijde: L (−x), R (+x), V (−y), A (+y), O (erbovenop). Geeft { x0, y0, L, B, v } (L langs x, B langs y).
export function plekNaast(g, el2, zijde, rot = 0) {
  const b = Number(el2.breedte_m) || 3; const d = Number(el2.diepte_m) || 6;
  const [L, B] = rot === 90 || rot === 270 ? [d, b] : [b, d];
  if (zijde === 'O') return { x0: g.x0, y0: g.y0, L, B, v: g.v + 1 };
  if (zijde === 'R') return { x0: g.x1, y0: g.y0, L, B, v: g.v };
  if (zijde === 'L') return { x0: g.x0 - L, y0: g.y0, L, B, v: g.v };
  if (zijde === 'A') return { x0: g.x0, y0: g.y1, L, B, v: g.v };
  return { x0: g.x0, y0: g.y0 - B, L, B, v: g.v };
}
// Trap tegen een bovenste unit: op de verdieping eronder, langs de lange zijde (V of A), tegen het linker- of rechtereinde.
export function plekTrap(g, trapEl, zijde = 'V', kant = 'L') {
  const lang = Number(trapEl.breedte_m) || 5.6; const diep = Number(trapEl.diepte_m) || 1.4;
  const x0 = kant === 'L' ? g.x0 : g.x1 - lang;
  return { x0, y0: zijde === 'V' ? g.y0 - diep : g.y1, L: lang, B: diep, v: Math.max(0, g.v - 1) };
}

// Deuren en ramen liggen vast per unit (eigenschappen.gevel), zoals de leverancier ze levert:
//   [{ zijde: V|A|L|R, soort: deur|deur2|raam, van: m vanaf de linkerhoek (van buiten bekeken), breedte, hoogte, onder }]
// V = voorkant (y = 0), A = achterkant (y = diepte), L = links (x = 0), R = rechts (x = breedte).
export const GEVEL_SOORTEN = { deur: { naam: 'Deur', b: 0.9, h: 2.0, o: 0 }, deur2: { naam: 'Dubbele deur', b: 1.8, h: 2.0, o: 0 }, raam: { naam: 'Raam', b: 1.2, h: 1.0, o: 1.0 } };
export const gevelZijdeLengte = (z, L, B) => (z === 'V' || z === 'A' ? L : B);
// Van een opening: begin- en eindpunt op de wand (unit-lokaal) en de normaal naar buiten.
export function gevelLijn(o, L, B) {
  const S = GEVEL_SOORTEN[o.soort] || GEVEL_SOORTEN.raam; const b = Number(o.breedte) > 0 ? Number(o.breedte) : S.b; const v = Math.max(0, Number(o.van) || 0);
  if (o.zijde === 'A') return { a: [L - v, B], e: [L - v - b, B], n: [0, 1] };
  if (o.zijde === 'L') return { a: [0, B - v], e: [0, B - v - b], n: [-1, 0] };
  if (o.zijde === 'R') return { a: [L, v], e: [L, v + b], n: [1, 0] };
  return { a: [v, 0], e: [v + b, 0], n: [0, -1] };
}
export const gevelHoogte = (o) => { const S = GEVEL_SOORTEN[o.soort] || GEVEL_SOORTEN.raam; return [Number(o.onder) >= 0 && o.onder !== '' && o.onder != null ? Number(o.onder) : S.o, Number(o.hoogte) > 0 ? Number(o.hoogte) : S.h]; };

// Stuklijst van de opstelling: per element het aantal, stroom per unit.
export function containerTelling(groep) {
  const m = new Map();
  for (const g of groep) { const k = g.el?.id || g.it.id; const r = m.get(k) || { naam: g.el?.naam || 'Unit', leverancier: g.el?.leverancier || '', aantal: 0, kw: 0, aans: 0 }; r.aantal += 1; for (const a of g.el?.eigenschappen?.aansluitingen || []) { r.kw += Number(a.kw) || 0; r.aans += 1; } m.set(k, r); }
  return [...m.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

// 3D: elke unit een doos met hoekstijlen en een dak; open zijden van schakelunits zonder wand; trappen met bordes.
export function containerPrims(groep, gekozen = null) {
  const prims = []; const vlak = (w, vul, op = 1, data = null) => prims.push({ k: 'vlak', w, vul, op, rand: '#6B7280', data });
  const lijn = (a, b, kl, r) => prims.push({ k: 'lijn', a, b, kl, r });
  for (const g of groep) {
    const { x0, y0, x1, y1 } = g; const z0 = g.z0 || 0; const data = { unit: g.it.id };
    if (g.trap) {
      // Trap langs x: van x0 (grond) naar x1 − bordes (boven), met een bordes van ± 1,4 m aan het einde.
      const H = g.H; const lang = x1 - x0; const bord = Math.min(1.4, lang * 0.3); const xs = x1 - bord;
      const n = Math.max(6, Math.round(H / 0.18));
      for (let k = 0; k < n; k++) { const xa = x0 + ((xs - x0) * k) / n; const xb = x0 + ((xs - x0) * (k + 1)) / n; const z = z0 + (H * (k + 1)) / n; vlak([[xa, y0 + 0.05, z], [xb, y0 + 0.05, z], [xb, y1 - 0.05, z], [xa, y1 - 0.05, z]], '#9CA3AF', 1, data); }
      vlak([[xs, y0, z0 + H], [x1, y0, z0 + H], [x1, y1, z0 + H], [xs, y1, z0 + H]], '#9CA3AF', 1, data);
      for (const y of [y0 + 0.03, y1 - 0.03]) { lijn([x0, y, z0], [xs, y, z0 + H], '#6B7280', 0.03); lijn([x0, y, z0 + 1], [xs, y, z0 + H + 1], '#A3A9B0', 0.02); lijn([xs, y, z0 + H + 1], [x1, y, z0 + H + 1], '#A3A9B0', 0.02); }
      for (const [x, y] of [[xs, y0], [x1, y0], [xs, y1], [x1, y1]]) lijn([x, y, z0], [x, y, z0 + H + 1], '#6B7280', 0.035);
      continue;
    }
    const H = g.H; const z1 = z0 + H; const aan = gekozen === g.it.id;
    const wand = aan ? '#BFDBFE' : '#E9ECEF'; const dak = aan ? '#93C5FD' : '#D1D5DB';
    const open = new Set(openInGroep(g));
    // Vloer en dak.
    vlak([[x0, y0, z0 + 0.02], [x1, y0, z0 + 0.02], [x1, y1, z0 + 0.02], [x0, y1, z0 + 0.02]], '#B8BDC3', 1, data);
    vlak([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], dak, 1, data);
    // Wanden (L = −x, R = +x, V = −y, A = +y).
    const W = { V: [[x0, y0], [x1, y0]], R: [[x1, y0], [x1, y1]], A: [[x1, y1], [x0, y1]], L: [[x0, y1], [x0, y0]] };
    for (const [z, [a, b]] of Object.entries(W)) {
      if (open.has(z)) continue;
      vlak([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], wand, 1, data);
      // Golfplaat: een paar verticale ribben.
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const nr = Math.floor(l / 0.6);
      for (let k = 1; k < nr; k++) { const f = k / nr; const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; lijn([p[0], p[1], z0 + 0.15], [p[0], p[1], z1 - 0.15], '#CBD0D5'); }
    }
    // Kader: hoekstijlen, onder- en bovenregels.
    const hk = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (const [x, y] of hk) lijn([x, y, z0], [x, y, z1], '#4B5563', 0.06);
    for (let k = 0; k < 4; k++) { const a = hk[k]; const b = hk[(k + 1) % 4]; lijn([a[0], a[1], z0 + 0.05], [b[0], b[1], z0 + 0.05], '#4B5563', 0.05); lijn([a[0], a[1], z1 - 0.05], [b[0], b[1], z1 - 0.05], '#4B5563', 0.05); }
    // Deuren en ramen (vast per unit), net voor de wand.
    if (g.T) for (const op of g.el?.eigenschappen?.gevel || []) {
      const { a, e, n } = gevelLijn(op, g.Lu, g.Bu); const [onder, hoog] = gevelHoogte(op); const za = z0 + onder; const zb = Math.min(z1 - 0.08, za + hoog);
      const P = (q, d = 0.03) => { const r = g.T([q[0] + n[0] * d, q[1] + n[1] * d]); return r; };
      const A2 = P(a); const E2 = P(e); const deur = op.soort !== 'raam';
      vlak([[A2[0], A2[1], za], [E2[0], E2[1], za], [E2[0], E2[1], zb], [A2[0], A2[1], zb]], deur ? '#5B6470' : '#9DB8CC', deur ? 1 : 0.85, data);
      const K = (p1, p2) => lijn([p1[0], p1[1], p1[2]], [p2[0], p2[1], p2[2]], '#2F363E', 0.025);
      const A3 = P(a, 0.05); const E3 = P(e, 0.05);
      K([A3[0], A3[1], za], [A3[0], A3[1], zb]); K([E3[0], E3[1], za], [E3[0], E3[1], zb]); K([A3[0], A3[1], zb], [E3[0], E3[1], zb]); if (!deur) K([A3[0], A3[1], za], [E3[0], E3[1], za]);
      if (op.soort === 'deur2') { const M = P([(a[0] + e[0]) / 2, (a[1] + e[1]) / 2], 0.05); K([M[0], M[1], za], [M[0], M[1], zb]); }
      if (!deur) { const M = P([(a[0] + e[0]) / 2, (a[1] + e[1]) / 2], 0.05); K([M[0], M[1], za], [M[0], M[1], zb]); }
    }
  }
  return prims;
}
