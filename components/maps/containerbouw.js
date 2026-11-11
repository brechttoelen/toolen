// Containerbouwer: units die op het plan naast, achter of op elkaar staan, als één opstelling.
// Elke unit blijft een eigen item (stuklijst, leverancier, stroom en binnenplan per unit); de bouwer zoekt
// de units die elkaar raken (zelfde draaiing per 90°) en werkt met hun kaders in het assenstelsel van de eerste unit.
//   item.parameters: midden [lng, lat], breedte (langs x), diepte (langs y), rot (graden, met de klok mee)
//   item.velden.verdieping: 0 = op de grond, 1 = erbovenop, …
// Ramen en deuren liggen vast per unit (zoals de leverancier ze levert): de bouwer verandert er niets aan.
const M_LAT = 110574; const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const rad = (g) => (g * Math.PI) / 180;
// Units staan op houten blokken (± 15 cm); de vloer ligt ± 20 cm boven de onderkant van de unit.
const OPLEG = 0.15; const VLOER = 0.2;

export const isTrapEl = (el) => !!el && /trap/i.test(el.naam || '') && el.categorie === 'Units en containers';
export const isUnitEl = (el) => !!el && !isTrapEl(el) && (el.categorie === 'Units en containers' || (el.categorie === 'Catering' && /container/i.test(`${el.naam} ${el.eigenschappen?.subgroep || ''}`)) || (el.categorie === 'Toiletten' && /container|unit/i.test(el.naam || '')))
  && el.tekenwijze === 'schaal' && Number(el.breedte_m) > 1.5 && Number(el.diepte_m) > 1.5;
export const isContainerDeel = (el) => isUnitEl(el) || isTrapEl(el);

// Schakelunits (Warsco BU-06-CD / CE / CF): D = eindunit open aan de rechterkant (+x), E = midden (beide open),
// F = eindunit open aan de linkerkant (−x). Naast elkaar: D · E · E · F = één grote ruimte.
export function schakelVan(el) {
  const n = String(el?.naam || '');
  const r = /(BU-\d+-C)([DEF])\b/.exec(n); if (r) return { fam: `${el.leverancier || ''}|${r[1]}`, rol: r[2] };
  // Rob Units: 6500 (eind, open rechts) · 6600 (midden) · 6550 (eind, open links).
  const rob = /\(Rob (6500|6600|6550)\)/.exec(n); if (rob) return { fam: 'Rob Units|65', rol: { 6500: 'D', 6600: 'E', 6550: 'F' }[rob[1]] };
  // Algeco Advance: 3 buitenwanden = eindunit (open rechts; de andere eindunit is dezelfde, gedraaid), 2 buitenwanden = midden.
  if (/algeco/i.test(el?.leverancier || '') && /advance/i.test(n)) { if (/3 buitenwanden/.test(n)) return { fam: 'Algeco|Advance', rol: 'D', draaibaar: true }; if (/2 buitenwanden/.test(n)) return { fam: 'Algeco|Advance', rol: 'E' }; }
  // Rob 6650 + 6700: koppel met gang (6 × 6 m), zonder middenstuk.
  const paar = /\(Rob (6650|6700)\)/.exec(n); if (paar) return { fam: 'Rob Units|66', rol: paar[1] === '6650' ? 'D' : 'F' };
  return null;
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
    if (!g.v) { g.z0 = g.trap ? 0 : OPLEG; continue; }
    const onder = perV.filter((o) => o.v === g.v - 1 && !o.trap && Math.min(o.x1, g.x1) - Math.max(o.x0, g.x0) > 0.3 && Math.min(o.y1, g.y1) - Math.max(o.y0, g.y0) > 0.3);
    g.z0 = onder.length ? Math.max(...onder.map((o) => o.z0 + o.H)) : g.v * 2.8;
  }
  // Trap: het bordes ligt op vloerhoogte van de unit(s) erboven die ertegen staan.
  for (const t of groep.filter((x) => x.trap)) {
    const boven = groep.filter((o) => !o.trap && o.v === t.v + 1 && Math.min(o.x1, t.x1) - Math.max(o.x0, t.x0) > 0.3 && Math.min(o.y1 + 0.3, t.y1) - Math.max(o.y0 - 0.3, t.y0) > 0);
    t.H = (boven.length ? Math.min(...boven.map((o) => o.z0)) : t.z0 + OPLEG + 3) + VLOER - t.z0;
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
  const l = (elementen || []).filter((e) => e.actief !== false && !e.plan_id && schakelVan(e)?.fam === fam);
  return l.find((e) => schakelVan(e).rol === rol) || null;
}
// Geen aparte eindunit voor de andere kant (Algeco): dezelfde eindunit, 180° gedraaid.
export function schakelGedraaid(elementen, fam, rol) {
  if (rol !== 'D' && rol !== 'F') return null;
  const ander = schakelElement(elementen, fam, rol === 'D' ? 'F' : 'D');
  return ander && schakelVan(ander).draaibaar ? ander : null;
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
// Uitzicht per leverancier: Rob Units = blauw kader en crème golfplaat, Warsco = antraciet kader en lichte sandwichpanelen.
export function unitStijl(el) {
  if (/algeco/i.test(el?.leverancier || '')) return { kader: '#AEB3B8', boven: '#C8102E', paneel: '#F0F1EF', naad: '#D3D6D9', naadAf: 1.0 };
  if (/rob/i.test(el?.leverancier || '')) return { kader: '#1F5FB8', paneel: '#ECE6D3', naad: '#D6CFB9', naadAf: 0.12 };
  return { kader: '#3A4046', paneel: '#E4E3DD', naad: '#C9C8C1', naadAf: 1.1 };
}
// opties: { weg: id dat verborgen is (wordt versleept), spook: { x0, y0, x1, y1, z0, H, ok } voorbeeld van de plek }
export function containerPrims(groep, gekozen = null, opties = {}) {
  const prims = [];
  const vlak = (w, vul, op = 1, data = null, rand = 'vul') => prims.push({ k: 'vlak', w, vul, op, rand, data });
  const balk = (a, b, d, kl, extra = {}) => prims.push({ k: 'balk', a, b, d, kl, ...extra });
  const KADER = '#3A4046'; const PANEEL = '#E4E3DD'; const NAAD = '#C9C8C1'; const DAK = '#8E9399'; const WIT = '#F4F5F3'; const GALVA = '#A9AEB2'; const ROOSTER = '#8D9398';
  const sp = opties.spook;
  if (sp) {
    const k = sp.ok ? '#3B82F6' : '#DC2626'; const z0 = sp.z0 || 0; const z1 = z0 + (sp.H || 2.8);
    const hk = [[sp.x0, sp.y0], [sp.x1, sp.y0], [sp.x1, sp.y1], [sp.x0, sp.y1]];
    for (let i = 0; i < 4; i++) { const a = hk[i]; const b = hk[(i + 1) % 4]; vlak([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], k, 0.35); }
    vlak(hk.map(([x, y]) => [x, y, z1]), k, 0.45); vlak(hk.map(([x, y]) => [x, y, Math.max(0.01, z0)]), k, 0.25);
  }
  for (const g of groep) {
    if (opties.weg && g.it.id === opties.weg) continue;
    const { x0, y0, x1, y1 } = g; const z0 = g.z0 || 0; const data = { unit: g.it.id, sleep: true }; const dataDak = { unit: g.it.id, sleep: true, boven: true };
    if (g.trap) {
      // De trap klimt langs de lange zijde, in de richting van de draaiing (0° = naar +x); andere richtingen via een spiegeling van de assen.
      const langY = y1 - y0 > x1 - x0; const terug = g.rot === 180 || g.rot === 270;
      const M = ([x, y, z]) => { let [u, w] = langY ? [y, x] : [x, y]; if (terug) u = (langY ? y0 + y1 : x0 + x1) - u; return langY ? [w, u, z] : [u, w, z]; };
      const g2 = langY ? { ...g, x0: y0, x1: y1, y0: x0, y1: x1 } : g;
      trapPrims(g2, { vlak: (w, ...r) => vlak(w.map(M), ...r), balk: (a, b, ...r) => balk(M(a), M(b), ...r), GALVA, ROOSTER, data, groep: langY ? groep.map((u) => ({ ...u, x0: u.y0, x1: u.y1, y0: u.x0, y1: u.x1 })) : groep });
      continue;
    }
    const H = g.H; const z1 = z0 + H; const aan = gekozen === g.it.id; const st = unitStijl(g.el);
    const pan = aan ? '#D3E2F5' : st.paneel; const KADER2 = st.kader;
    const open = new Set(openInGroep(g));
    const P = 0.16; const h = P / 2; // hoekstijl 16 × 16 cm
    const ONDER = 0.2; const BOVEN = 0.24; // onder- en bovenframe
    // Houten blokken onder de hoeken en in het midden van de lange zijden (enkel op de grond).
    if (!g.v) for (const [x, y] of [[x0 + 0.2, y0 + 0.2], [x1 - 0.2, y0 + 0.2], [x1 - 0.2, y1 - 0.2], [x0 + 0.2, y1 - 0.2], [(x0 + x1) / 2, y0 + 0.2], [(x0 + x1) / 2, y1 - 0.2]]) balk([x, y, 0], [x, y, z0], [0.3, 0.3], '#8B6E4E', { mat: 'hout' });
    // Hoekstijlen.
    for (const [x, y] of [[x0 + h, y0 + h], [x1 - h, y0 + h], [x1 - h, y1 - h], [x0 + h, y1 - h]]) balk([x, y, z0], [x, y, z1], [P, P], KADER2);
    // Onder- en bovenframe rondom (bij een open schakelzijde ook: het frame blijft).
    const rand = [[[x0, y0 + h], [x1, y0 + h], 'V'], [[x1 - h, y0], [x1 - h, y1], 'R'], [[x1, y1 - h], [x0, y1 - h], 'A'], [[x0 + h, y1], [x0 + h, y0], 'L']];
    for (const [a, b] of rand) { balk([a[0], a[1], z0 + ONDER / 2], [b[0], b[1], z0 + ONDER / 2], [P, ONDER], KADER2); balk([a[0], a[1], z1 - BOVEN / 2], [b[0], b[1], z1 - BOVEN / 2], [P, BOVEN], st.boven || KADER2); }
    // Dak: iets onder de bovenrand, met een lichte goot.
    vlak([[x0 + P, y0 + P, z1 - 0.06], [x1 - P, y0 + P, z1 - 0.06], [x1 - P, y1 - P, z1 - 0.06], [x0 + P, y1 - P, z1 - 0.06]], DAK, 1, dataDak);
    // Vloer binnen (zichtbaar bij open zijden).
    vlak([[x0 + P, y0 + P, z0 + ONDER], [x1 - P, y0 + P, z0 + ONDER], [x1 - P, y1 - P, z0 + ONDER], [x0 + P, y1 - P, z0 + ONDER]], '#7C7A73', 1, data);
    // Wandpanelen tussen de frames, met de verticale naden van de sandwichpanelen (± 1,1 m).
    const W = { V: [[x0 + P, y0], [x1 - P, y0], [0, -1]], R: [[x1, y0 + P], [x1, y1 - P], [1, 0]], A: [[x1 - P, y1], [x0 + P, y1], [0, 1]], L: [[x0, y1 - P], [x0, y0 + P], [-1, 0]] };
    const za = z0 + ONDER; const zb = z1 - BOVEN;
    for (const [z, [a0, b0, n]] of Object.entries(W)) {
      if (open.has(z)) continue;
      const a = [a0[0] - n[0] * 0.03, a0[1] - n[1] * 0.03]; const b = [b0[0] - n[0] * 0.03, b0[1] - n[1] * 0.03];
      vlak([[a[0], a[1], za], [b[0], b[1], za], [b[0], b[1], zb], [a[0], a[1], zb]], pan, 1, data);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const nr = Math.max(1, Math.round(l / st.naadAf));
      for (let k = 1; k < nr; k++) { const f = k / nr; const q = [a[0] + (b[0] - a[0]) * f + n[0] * 0.005, a[1] + (b[1] - a[1]) * f + n[1] * 0.005]; balk([q[0], q[1], za], [q[0], q[1], zb], [st.naadAf < 0.5 ? 0.035 : 0.02, st.naadAf < 0.5 ? 0.02 : 0.012], st.naad, { mat: 'mat' }); }
    }
    // Deuren en ramen (vast per unit, zoals de leverancier ze levert).
    if (g.T) for (const o of g.it?.velden?.gevel || g.el?.eigenschappen?.gevel || []) {
      const { a, e, n } = gevelLijn(o, g.Lu, g.Bu); const [onder, hoog] = gevelHoogte(o);
      const zo = za + (o.soort === 'raam' ? onder - VLOER : 0); const zt = Math.min(zb - 0.02, zo + hoog);
      const Q = (q, d) => g.T([q[0] + n[0] * d, q[1] + n[1] * d]);
      const lang = [e[0] - a[0], e[1] - a[1]]; const ll = Math.hypot(...lang) || 1; const u = [lang[0] / ll, lang[1] / ll];
      const L2 = (f, d) => Q([a[0] + u[0] * f, a[1] + u[1] * f], d);
      const K = 0.06; // kaderbreedte
      if (o.soort === 'raam') {
        // PVC-raam: wit kader, glas, middenstijl en een rolluikkast erboven.
        const g0 = L2(0, 0.0); const g1 = L2(ll, 0.0);
        vlak([[g0[0], g0[1], zo], [g1[0], g1[1], zo], [g1[0], g1[1], zt], [g0[0], g0[1], zt]], '#7F97A8', 0.9, data);
        const k0 = L2(0, 0.025); const k1 = L2(ll, 0.025); const m = L2(ll / 2, 0.025);
        balk([k0[0], k0[1], zo], [k0[0], k0[1], zt], [K, 0.05], WIT, { mat: 'mat' }); balk([k1[0], k1[1], zo], [k1[0], k1[1], zt], [K, 0.05], WIT, { mat: 'mat' }); balk([m[0], m[1], zo], [m[0], m[1], zt], [0.05, 0.05], WIT, { mat: 'mat' });
        balk([k0[0], k0[1], zo], [k1[0], k1[1], zo], [0.05, K], WIT, { mat: 'mat' }); balk([k0[0], k0[1], zt], [k1[0], k1[1], zt], [0.05, K], WIT, { mat: 'mat' });
        const r0 = L2(-0.04, 0.07); const r1 = L2(ll + 0.04, 0.07); balk([r0[0], r0[1], zt + 0.1], [r1[0], r1[1], zt + 0.1], [0.14, 0.18], '#9CA1A6', { mat: 'mat' });
        balk([L2(-0.03, 0.06)[0], L2(-0.03, 0.06)[1], zo - 0.02], [L2(ll + 0.03, 0.06)[0], L2(ll + 0.03, 0.06)[1], zo - 0.02], [0.1, 0.03], '#B9BDC1'); // vensterbank
      } else {
        // Stalen deur in een kader, met klink; dubbele deur met een middenstijl.
        const d0 = L2(0, 0.0); const d1 = L2(ll, 0.0);
        vlak([[d0[0], d0[1], zo], [d1[0], d1[1], zo], [d1[0], d1[1], zt], [d0[0], d0[1], zt]], '#D5D7D8', 1, data);
        const k0 = L2(0, 0.025); const k1 = L2(ll, 0.025);
        balk([k0[0], k0[1], zo], [k0[0], k0[1], zt + K], [K, 0.05], KADER2); balk([k1[0], k1[1], zo], [k1[0], k1[1], zt + K], [K, 0.05], KADER2); balk([k0[0], k0[1], zt + K / 2], [k1[0], k1[1], zt + K / 2], [0.05, K], KADER2);
        const vl = o.soort === 'deur2' ? [ll / 2 - 0.12, ll / 2 + 0.12] : [ll - 0.12];
        if (o.soort === 'deur2') { const m = L2(ll / 2, 0.02); balk([m[0], m[1], zo], [m[0], m[1], zt], [0.03, 0.03], '#9EA3A7'); }
        for (const f of vl) { const h0 = L2(f - 0.06, 0.06); const h1 = L2(f + 0.06, 0.06); balk([h0[0], h0[1], zo + 1.05], [h1[0], h1[1], zo + 1.05], [0.025, 0.025], '#2B2F33'); }
      }
    }
  }
  return prims;
}

// Buitentrap met bordes (gegalvaniseerd): trap langs x van x0 tot het bordes, bordes van 1,4 m tegen x1.
function trapPrims(g, { vlak, balk, GALVA, ROOSTER, data, groep = [] }) {
  const { x0, y0, x1, y1 } = g;
  // De kant tegen de units krijgt geen leuning.
  const tegen = (y, k) => groep.some((o) => !o.trap && Math.abs((k ? o.y0 : o.y1) - y) < 0.12 && Math.min(o.x1, x1) - Math.max(o.x0, x0) > 0.3); const z0 = g.z0 || 0; const H = Math.max(1, g.H || 3.2); const ztop = z0 + H;
  const bord = Math.min(1.4, (x1 - x0) * 0.3); const xs = x1 - bord; const yw = 0.06;
  const n = Math.max(8, Math.round(H / 0.18)); const run = xs - x0; const tr = run / n; const rise = H / n;
  // Twee trapbomen (U-profiel) van de grond tot het bordes.
  for (const y of [y0 + yw, y1 - yw]) balk([x0, y, z0 + 0.1], [xs, y, ztop - 0.1], [0.06, 0.2], GALVA);
  // Treden: roosters met een donkere voorrand.
  for (let k = 1; k < n; k++) {
    const x = x0 + tr * (k - 0.5); const z = z0 + rise * k;
    balk([x, y0 + 0.12, z], [x, y1 - 0.12, z], [Math.min(0.26, tr * 1.05), 0.035], ROOSTER, { data });
    balk([x + tr / 2 - 0.01, y0 + 0.12, z + 0.005], [x + tr / 2 - 0.01, y1 - 0.12, z + 0.005], [0.02, 0.035], '#5E6368');
  }
  // Bordes: rooster op een frame, vier poten met kruisverbanden.
  vlak([[xs, y0, ztop], [x1, y0, ztop], [x1, y1, ztop], [xs, y1, ztop]], ROOSTER, 1, data);
  for (const [a, b] of [[[xs, y0 + 0.04], [x1, y0 + 0.04]], [[xs, y1 - 0.04], [x1, y1 - 0.04]], [[xs + 0.04, y0], [xs + 0.04, y1]], [[x1 - 0.04, y0], [x1 - 0.04, y1]]]) balk([a[0], a[1], ztop - 0.07], [b[0], b[1], ztop - 0.07], [0.06, 0.14], GALVA);
  const poten = [[xs + 0.05, y0 + 0.05], [x1 - 0.05, y0 + 0.05], [x1 - 0.05, y1 - 0.05], [xs + 0.05, y1 - 0.05]];
  for (const [x, y] of poten) { balk([x, y, z0], [x, y, ztop - 0.14], [0.08, 0.08], GALVA); balk([x, y, z0 + 0.005], [x, y, z0 + 0.015], [0.25, 0.25], GALVA); }
  for (const [p1, p2] of [[poten[0], poten[1]], [poten[3], poten[2]], [poten[1], poten[2]]]) { balk([p1[0], p1[1], z0 + 0.3], [p2[0], p2[1], ztop - 0.3], [0.04, 0.04], GALVA); balk([p2[0], p2[1], z0 + 0.3], [p1[0], p1[1], ztop - 0.3], [0.04, 0.04], GALVA); }
  // Leuningen: palen, handregel op 1,1 m en een tussenregel, ook langs het bordes (niet aan de kant van de unit).
  const LH = 1.1;
  for (const y of [...(tegen(y0, false) ? [] : [y0 + 0.03]), ...(tegen(y1, true) ? [] : [y1 - 0.03])]) {
    const nP = Math.max(2, Math.round(run / 1.2));
    for (let k = 0; k <= nP; k++) { const f = k / nP; const x = x0 + 0.15 + (xs - x0 - 0.15) * f; const z = z0 + H * ((x - x0) / run); balk([x, y, z], [x, y, z + LH], [0.04, 0.04], GALVA); }
    balk([x0 + 0.15, y, z0 + (H * 0.15) / run + LH], [xs, y, ztop + LH], [0.045, 0.045], GALVA);
    balk([x0 + 0.15, y, z0 + (H * 0.15) / run + LH * 0.5], [xs, y, ztop + LH * 0.5], [0.03, 0.03], GALVA);
    balk([xs, y, ztop + LH], [x1, y, ztop + LH], [0.045, 0.045], GALVA); balk([xs, y, ztop + LH * 0.5], [x1, y, ztop + LH * 0.5], [0.03, 0.03], GALVA);
    balk([x1 - 0.03, y, ztop], [x1 - 0.03, y, ztop + LH], [0.04, 0.04], GALVA);
    balk([xs, y, ztop + 0.05], [x1, y, ztop + 0.05], [0.01, 0.1], GALVA); // schopplint
  }
}

// Maat van een element in het kader van de groep bij een draaiing van 0/90/180/270°.
export const maatBij = (el, q) => { const b = Number(el?.breedte_m) || 3; const d = Number(el?.diepte_m) || 6; return q % 180 ? [d, b] : [b, d]; };
const overlapt = (a, b, m = 0.05) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > m && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > m;
// Waar komt een unit (of trap) als je ze over de grond sleept: tegen een unit aan (kleeft), op een dak (erop), of vrij.
// grond = [x, y] onder de muis, hit = data onder de muis (een dak = erop). Geeft { x0, y0, x1, y1, L, B, v, z0, H, ok, soort }.
export function plekBijSlepen(groep, el, q, grond, hit, weg = null) {
  const [L, B] = maatBij(el, q); const H = unitHoogte(el); const trap = isTrapEl(el);
  const rest = groep.filter((o) => o.it.id !== weg);
  const uit = (x0, y0, v, soort, z0 = 0) => {
    const p = { x0, y0, x1: x0 + L, y1: y0 + B, L, B, v, H, soort };
    p.z0 = v ? Math.max(...rest.filter((o) => o.v === v - 1 && !o.trap && overlapt(o, p, 0.3)).map((o) => o.z0 + o.H), z0) : trap ? 0 : OPLEG;
    p.ok = !rest.some((o) => o.v === v && overlapt(o, p)) && (!v || rest.some((o) => o.v === v - 1 && !o.trap && overlapt(o, p, 0.3)));
    return p;
  };
  // Op een dak: erop, op dezelfde hoek (of gecentreerd als de maat verschilt).
  const dak = hit?.boven && rest.find((o) => o.it.id === hit.unit);
  if (dak && !trap) {
    const zelfde = Math.abs(dak.x1 - dak.x0 - L) < 0.05 && Math.abs(dak.y1 - dak.y0 - B) < 0.05;
    return uit(zelfde ? dak.x0 : Math.round(((dak.x0 + dak.x1) / 2 - L / 2) * 20) / 20, zelfde ? dak.y0 : Math.round(((dak.y0 + dak.y1) / 2 - B / 2) * 20) / 20, dak.v + 1, 'erop');
  }
  if (!grond) return null;
  const c = grond; let best = null;
  for (const o of rest.filter((x) => !x.trap)) {
    const v = trap ? Math.max(0, o.v) : o.v; if (o.v && !trap) continue; // op de grond: enkel tegen units op de grond
    const opties = [[o.x1, o.y0], [o.x1, o.y1 - B], [o.x0 - L, o.y0], [o.x0 - L, o.y1 - B], [o.x0, o.y1], [o.x1 - L, o.y1], [o.x0, o.y0 - B], [o.x1 - L, o.y0 - B]];
    for (const [x0, y0] of opties) { const d = Math.hypot(x0 + L / 2 - c[0], y0 + B / 2 - c[1]); if (d < Math.max(L, B) * 0.55 && (!best || d < best.d)) best = { x0, y0, d, v: trap ? 0 : v }; }
  }
  if (best) return uit(best.x0, best.y0, best.v, 'tegen');
  return uit(Math.round((c[0] - L / 2) * 10) / 10, Math.round((c[1] - B / 2) * 10) / 10, 0, 'vrij');
}
