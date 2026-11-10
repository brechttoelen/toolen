// Truss vrij bouwen (trussbouwer): losse stukken H30V als bouwblokken, liggend of staand.
// Item (een truss-lijn): velden.truss = { stukken: [{ id, L, p: [x, y], z, r, op }] }
//   p, r ten opzichte van het eerste punt van de lijn (x-as langs het eerste stuk), r in graden
//   (richting van een liggend stuk), op = staand (van z naar z + L). Lengtes hart op hart.
// Hoekstukken komen vanzelf waar stukken in een hoek samenkomen, baseplates onder staande stukken.

export const isTrussBouw = (it) => Array.isArray(it?.velden?.truss?.stukken) && it.velden.truss.stukken.length > 0;
export const TRUSS_LENGTES = [4, 3, 2.5, 2, 1.5, 1, 0.5];
export const TRUSS_B = 0.29;

// ---------- Soorten truss en technische gegevens ----------
// Belastingstabellen van Prolyte (enkelvoudige overspanning, statisch, eigen gewicht inbegrepen):
// [overspanning m, gelijkmatig verdeeld kg/m, puntlast in het midden kg]. Gangbare equivalenten (Global Truss,
// Milos, Eurotruss) liggen in dezelfde orde; de leverancier en een rigger rekenen de echte belasting na.
export const TRUSS_TYPES = [
  { k: 'vierkant30', naam: 'Vierkant 29 cm (F34 / H30V)', kort: 'F34', B: 0.29, koorden: 4, kgm: 6.3, buis: 'koorden 48–50 mm, diagonalen 20 mm', bron: 'Prolyte H30V',
    tabel: [[3, 649, 1668], [4, 485, 1298], [5, 387, 1074], [6, 322, 914], [7, 256, 794], [8, 194, 701], [9, 152, 625], [10, 122, 563], [11, 100, 511], [12, 83, 467], [13, 70, 428], [14, 60, 394], [15, 51, 365], [16, 44, 338], [17, 39, 314], [18, 34, 292], [19, 30, 272], [20, 26, 254]] },
  { k: 'vierkant30licht', naam: 'Vierkant 29 cm licht (X30V)', kort: 'X30V', B: 0.29, koorden: 4, kgm: 5.1, buis: 'koorden 51 × 2 mm, diagonalen 16 mm', bron: 'Prolyte X30V',
    tabel: [[3, 650, 1215], [4, 486, 960], [5, 367, 791], [6, 254, 672], [7, 185, 582], [8, 141, 512], [9, 110, 456], [10, 88, 410], [11, 72, 371], [12, 60, 338], [13, 50, 310], [14, 43, 285], [15, 37, 263], [16, 32, 243], [17, 28, 225], [18, 24, 209], [19, 21, 194], [20, 19, 181]] },
  { k: 'vierkant40', naam: 'Vierkant 40 cm (F44 / H40V)', kort: 'F44', B: 0.40, koorden: 4, kgm: 6.9, buis: 'koorden 48–50 mm, diagonalen 20 mm', bron: 'Prolyte H40V',
    tabel: [[3, 835, 2199], [4, 625, 1712], [5, 499, 1436], [6, 415, 1234], [7, 355, 1081], [8, 278, 960], [9, 218, 862], [10, 175, 780], [11, 144, 712], [12, 120, 653], [13, 101, 602], [14, 86, 558], [15, 75, 518], [16, 65, 483], [17, 57, 451], [18, 50, 422], [19, 44, 396], [20, 39, 371]] },
  { k: 'driehoek30', naam: 'Driehoek 29 cm (F33 / X30D)', kort: 'F33', B: 0.29, koorden: 3, kgm: 3.6, buis: 'koorden 51 × 2 mm, diagonalen 16 mm', bron: 'Prolyte X30D',
    tabel: [[3, 444, 576], [4, 248, 445], [5, 158, 361], [6, 108, 302], [7, 79, 259], [8, 60, 225], [9, 46, 199], [10, 37, 177], [11, 30, 158], [12, 25, 142], [13, 20, 129], [14, 17, 117], [15, 15, 106], [16, 12, 96]] },
  { k: 'ladder30', naam: 'Ladder 30 cm (F32 / X30L)', kort: 'F32', B: 0.29, koorden: 2, kgm: 2.7, buis: 'koorden 51 × 2 mm', bron: 'Prolyte X30L (bovenkoord niet zijdelings gesteund)',
    tabel: [[1, 980, 980], [2, 345, 345], [3, 135, 203], [4, 64, 128], [5, 27, 67], [6, 12, 36]] },
];
export const trussTypeVan = (k) => TRUSS_TYPES.find((x) => x.k === k) || TRUSS_TYPES[0];
// Soort uit de opslag of uit de naam van het element (F34, H40V, X30D, ladder …).
export function trussTypeVoor(el, t = null) {
  if (t?.type && TRUSS_TYPES.some((x) => x.k === t.type)) return trussTypeVan(t.type);
  if (el?.eigenschappen?.truss_type && TRUSS_TYPES.some((x) => x.k === el.eigenschappen.truss_type)) return trussTypeVan(el.eigenschappen.truss_type);
  const n = `${el?.naam || ''} ${el?.eigenschappen?.familie || ''}`.toLowerCase();
  if (/h40|f44|f45|x40|40 ?cm/.test(n)) return trussTypeVan('vierkant40');
  if (/x30d|f33|f23|driehoek|triangle|3-punt|3 punt/.test(n)) return trussTypeVan('driehoek30');
  if (/x30l|f32|f22|ladder|2-punt|2 punt/.test(n)) return trussTypeVan('ladder30');
  if (/x30v/.test(n)) return trussTypeVan('vierkant30licht');
  return trussTypeVan('vierkant30');
}
// Grootste overspanning met nog ± 30 kg/m (een rij lampen of een doek); daarboven enkel met berekening.
export const maxOverspanning = (T) => { let m = T.tabel[0][0]; for (const [L, q] of T.tabel) if (q >= 30) m = L; return m; };
// Toelaatbare belasting bij een overspanning (lineair tussen de rijen van de tabel); null = buiten de tabel.
export function belastingBij(T, L) {
  const tb = T.tabel; if (L <= tb[0][0]) return { udl: tb[0][1], cpl: tb[0][2] };
  for (let i = 1; i < tb.length; i++) if (L <= tb[i][0]) { const f = (L - tb[i - 1][0]) / (tb[i][0] - tb[i - 1][0]); return { udl: Math.round(tb[i - 1][1] + (tb[i][1] - tb[i - 1][1]) * f), cpl: Math.round(tb[i - 1][2] + (tb[i][2] - tb[i - 1][2]) * f) }; }
  return null;
}
export const BLOK_KG = (T) => (T.B >= 0.39 ? 6.5 : 3.8); const VOET_KG = 15;
const r3 = (v) => Math.round(v * 1000) / 1000;
const rnd = (v) => Math.round(v * 100) / 100;

// Ankerstelsel van de lijn (pts in meter).
function anker(pts) {
  const o = pts[0] || [0, 0]; const q = pts[1] || [o[0] + 1, o[1]]; const a0 = Math.atan2(q[1] - o[1], q[0] - o[0]);
  return {
    naarWereld: (p) => [o[0] + p[0] * Math.cos(a0) - p[1] * Math.sin(a0), o[1] + p[0] * Math.sin(a0) + p[1] * Math.cos(a0)],
    naarLokaal: (p) => { const d = [p[0] - o[0], p[1] - o[1]]; return [d[0] * Math.cos(a0) + d[1] * Math.sin(a0), -d[0] * Math.sin(a0) + d[1] * Math.cos(a0)]; },
    a0,
  };
}

// Stukken in het stelsel van pts: { i, id, L, a: [x, y, z] (begin), e: [x, y, z] (einde), r (rad), op }
export function trussStukken(pts, it) {
  const A = anker(pts);
  return (it?.velden?.truss?.stukken || []).map((s, i) => {
    const p = A.naarWereld(s.p || [0, 0]); const r = A.a0 + ((Number(s.r) || 0) * Math.PI) / 180; const z = Number(s.z) || 0; const L = Number(s.L) || 1;
    const a = [p[0], p[1], z];
    const e = s.op ? [p[0], p[1], z + L] : [p[0] + Math.cos(r) * L, p[1] + Math.sin(r) * L, z];
    return { i, id: s.id, L, a, e, r, op: !!s.op };
  });
}
export function naarTrussOpslag(pts, stukken) {
  const A = anker(pts);
  return stukken.map((s) => {
    const p = A.naarLokaal(s.a);
    const r = (((((s.r - A.a0) * 180) / Math.PI) % 360) + 360) % 360;
    return { id: s.id || Math.random().toString(36).slice(2, 9), L: s.L, p: [r3(p[0]), r3(p[1])], z: r3(s.a[2]), r: Math.round(r * 10) / 10, op: !!s.op };
  });
}

// Draaiing (rad) van een knoop: hoekstukken en baseplates staan recht op de stukken die er samenkomen.
export function knoopRichting(k, stukken) {
  const by = new Map(stukken.map((s, i) => [s.i ?? i, s]));
  for (const i of k.stukken) { const g = by.get(i); if (g && !g.op) return g.r; }
  for (const i of k.stukken) { const g = by.get(i); if (g) return g.r; }
  return 0;
}
// Knopen. Een hoekblok (kubus van de breedte van de truss) zit tussen de stukken die er in een hoek op aansluiten:
// de uiteinden liggen dan een halve blok van het midden. Oudere constructies (hart op hart: uiteinden in het midden
// van de hoek) worden ook herkend. Twee stukken in elkaars verlengde zijn een gewone koppeling (geen blok).
// Baseplates: onder een staand stuk op de vloer en onder een hoekblok op de vloer.
export function trussKnopen(stukken, B = TRUSS_B) {
  const H = B / 2; const ends = [];
  for (const s of stukken) {
    const d = s.op ? [0, 0, 1] : [Math.cos(s.r), Math.sin(s.r), 0]; const e = s.e || (s.op ? [s.a[0], s.a[1], s.a[2] + s.L] : [s.a[0] + d[0] * s.L, s.a[1] + d[1] * s.L, s.a[2]]);
    ends.push({ s, p: s.a, uit: d.map((v) => -v), gebruikt: false }, { s, p: e, uit: d, gebruikt: false });
  }
  const dicht = (p, q, tol) => Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol && Math.abs(p[2] - q[2]) < tol;
  const groepeer = (lijst, sleutel, tol) => { const g = []; for (const x of lijst) { const q = sleutel(x); const h = g.find((y) => dicht(y.p, q, tol)); if (h) h.leden.push(x); else g.push({ p: q, leden: [x] }); } return g; };
  const uit = [];
  // 1. Uiteinden op dezelfde plek: koppeling (2 in elkaars verlengde) of een oud hart-op-hart hoekpunt.
  for (const g of groepeer(ends, (x) => x.p, 0.02)) {
    if (g.leden.length < 2) continue;
    const [a, b] = g.leden; const recht = g.leden.length === 2 && Math.abs(a.uit[0] * b.uit[0] + a.uit[1] * b.uit[1] + a.uit[2] * b.uit[2] + 1) < 0.02;
    for (const x of g.leden) x.gebruikt = true;
    if (recht) continue;
    uit.push({ p: g.p, stukken: g.leden.map((x) => x.s.i), richtingen: g.leden.map((x) => x.uit), hoek: true, oud: true });
  }
  // 2. Hoekblokken: het punt een halve blok voorbij het uiteinde valt samen.
  for (const g of groepeer(ends.filter((x) => !x.gebruikt), (x) => x.p.map((v, k) => v + x.uit[k] * H), 0.03)) {
    if (g.leden.length < 2) continue;
    uit.push({ p: g.p, stukken: g.leden.map((x) => x.s.i), richtingen: g.leden.map((x) => x.uit), hoek: true });
  }
  for (const k of uit) { k.armen = k.richtingen.length; k.soort = hoekSoort(k.richtingen); k.voet = k.p[2] < H + 0.01 && k.richtingen.some((r) => r[2] < -0.5) && !k.richtingen.some((r) => r[2] > 0.5); } // blok op de vloer met een poot erop // geen stuk onder het blok (dat stuk wijst met zijn uiteinde omhoog)
  // Baseplates onder staande stukken op de vloer (ook als er geen hoek is).
  for (const s of stukken) if (s.op && s.a[2] < 0.01 && !uit.some((k) => k.voet && Math.hypot(k.p[0] - s.a[0], k.p[1] - s.a[1]) < 0.05)) uit.push({ p: [s.a[0], s.a[1], s.a[2]], stukken: [s.i], richtingen: [[0, 0, -1]], hoek: false, voet: true, armen: 1 });
  return uit;
}
// Naam van een hoekblok uit de richtingen van de stukken (zoals de verhuurders ze noemen).
export function hoekSoort(rs) {
  const n = rs.length; const vert = rs.filter((r) => Math.abs(r[2]) > 0.5).length;
  const tegen = rs.some((a, i) => rs.some((b, j) => j > i && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < -0.98));
  if (n === 2) { const c = rs[0][0] * rs[1][0] + rs[0][1] * rs[1][1] + rs[0][2] * rs[1][2]; const g = Math.round((Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI); return Math.abs(g - 90) < 3 ? 'Hoekblok 2-weg 90°' : `Hoekblok 2-weg ${g}°`; }
  if (n === 3) return tegen && !vert ? 'T-blok 3-weg' : tegen ? 'T-blok 3-weg (met poot)' : 'Hoekblok 3-weg';
  if (n === 4) return !vert ? 'Kruisblok 4-weg' : 'Hoekblok 4-weg';
  return `Hoekblok ${n}-weg`;
}

export function trussTelling(stukken, T = TRUSS_TYPES[0]) {
  const t = { stukken: {}, hoek: 0, voet: 0, hoeken: {}, kg: 0, meter: 0 };
  for (const s of stukken) { const k = String(s.L); t.stukken[k] = (t.stukken[k] || 0) + 1; t.meter += s.L; }
  for (const k of trussKnopen(stukken, T.B)) { if (k.hoek) { t.hoek += 1; t.hoeken[k.soort] = (t.hoeken[k.soort] || 0) + 1; } if (k.voet) t.voet += 1; }
  t.kg = Math.round(t.meter * T.kgm + t.hoek * BLOK_KG(T) + t.voet * VOET_KG);
  return t;
}

// Lengte opdelen in te huren stukken (grootste eerst).
export function opdelen(L, lengtes = TRUSS_LENGTES) {
  const uit = []; let rest = Math.round(L * 100) / 100;
  for (const l of lengtes) while (rest >= l - 0.001) { uit.push(l); rest = Math.round((rest - l) * 100) / 100; }
  if (rest > 0.01) uit.push(lengtes[lengtes.length - 1]);
  return uit;
}

// Kant-en-klare vormen met hoekblokken, in meter rond (0, 0), richting r (rad). W en H zijn de lengtes truss
// (per 0,5 m, zoals te huur); de hoekblokken komen erbij: hart op hart = W + B, buitenmaat = W + 2 × B.
// Een staand stuk op de vloer begint op z = -B/2 (de vloer), liggende stukken liggen met hun hartlijn op z.
export function portaal(W, H, r = 0, lengtes = TRUSS_LENGTES, B = TRUSS_B) {
  const h = B / 2; const u = [Math.cos(r), Math.sin(r)]; const uit = []; const Wt = opdelen(W, lengtes).reduce((a, x) => a + x, 0); const pos = W > 0 ? [0, Wt + B] : [0];
  const torens = opdelen(H, lengtes); const Ht = torens.reduce((a, x) => a + x, 0);
  for (const x of pos) { let z = -h; for (const l of torens) { uit.push({ L: l, a: [u[0] * x, u[1] * x, r3(z)], r, op: true }); z += l; } }
  if (W > 0) { let x = h; for (const l of opdelen(W, lengtes)) { uit.push({ L: l, a: [u[0] * x, u[1] * x, r3(-h + Ht + h)], r, op: false }); x += l; } }
  return uit;
}
export function kubus(W, H, r = 0, lengtes = TRUSS_LENGTES, B = TRUSS_B) {
  const h = B / 2; const u = [Math.cos(r), Math.sin(r)]; const v = [-u[1], u[0]]; const uit = [];
  const Wt = opdelen(W, lengtes).reduce((a, x) => a + x, 0); const S = Wt + B; const torens = opdelen(H, lengtes); const Ht = torens.reduce((a, x) => a + x, 0);
  const P = (x, y) => [u[0] * x + v[0] * y, u[1] * x + v[1] * y];
  // Hoekblokken onderaan (op de vloer) en bovenaan; poten ertussen; liggers tussen de blokken.
  for (const [x, y] of [[0, 0], [S, 0], [S, S], [0, S]]) { let z = h; for (const l of torens) { const p = P(x, y); uit.push({ L: l, a: [p[0], p[1], r3(z)], r, op: true }); z += l; } }
  for (const z of [0, Ht + B]) {
    for (const [x0, y0, rr] of [[0, 0, r], [S, 0, r + Math.PI / 2], [S, S, r + Math.PI], [0, S, r - Math.PI / 2]]) {
      let d = h; const ur = [Math.cos(rr), Math.sin(rr)];
      for (const l of opdelen(W, lengtes)) { const p = P(x0, y0); uit.push({ L: l, a: [r3(p[0] + ur[0] * d), r3(p[1] + ur[1] * d), r3(z)], r: rr, op: false }); d += l; }
    }
  }
  return uit;
}
export function toren(H, r = 0, lengtes = TRUSS_LENGTES, B = TRUSS_B) { return portaal(0, H, r, lengtes, B); }

// ---------- Constructie van maat veranderen ----------
// u = hoofdrichting [ux, uy]; v staat er haaks op. Kader over de stukken (of enkel de gekozen stukken).
const eindPt = (s) => (s.op ? [s.a[0], s.a[1], s.a[2] + s.L] : [s.a[0] + Math.cos(s.r) * s.L, s.a[1] + Math.sin(s.r) * s.L, s.a[2]]);
export function trussKader(stukken, u) {
  if (!stukken.length) return null; const v = [-u[1], u[0]]; const S = []; const W = []; const Z = [];
  for (const s of stukken) for (const p of [s.a, eindPt(s)]) { S.push(p[0] * u[0] + p[1] * u[1]); W.push(p[0] * v[0] + p[1] * v[1]); Z.push(p[2]); }
  return { u, v, s0: Math.min(...S), s1: Math.max(...S), w0: Math.min(...W), w1: Math.max(...W), z0: Math.min(...Z), z1: Math.max(...Z) };
}
export const kaderMaat = (K, as) => (as === 's' ? K.s1 - K.s0 : as === 'w' ? K.w1 - K.w0 : K.z1 - K.z0);
const STAP = 0.5; // kleinste te huren stuk: alle maten springen per 0,5 m

// Eén maat van de constructie wijzigen (as 's' = lengte, 'w' = breedte, 'z' = hoogte), per 0,5 m: alles voorbij het
// midden schuift mee (kant 'max', of het deel ervoor bij 'min'), de stukken die het midden kruisen worden langer of
// korter en opnieuw opgedeeld in te huren lengtes. Hoekblokken blijven zo op hun plaats tegen de stukken.
// Geeft { stukken, erbij } (erbij: oud id → nieuwe ids, zodat doeken blijven hangen) en de omzetting van een punt.
export function schaalTruss(alle, ids, u, as, nieuw, lengtes = TRUSS_LENGTES, kant = 'max') {
  const kies = ids && ids.length ? alle.filter((s) => ids.includes(s.id)) : alle;
  const K = trussKader(kies, u); if (!K) return null;
  const v = K.v; const m0 = as === 's' ? K.s0 : as === 'w' ? K.w0 : K.z0; const m1 = as === 's' ? K.s1 : as === 'w' ? K.w1 : K.z1;
  const E0 = m1 - m0; const D = Math.round((nieuw - E0) / STAP) * STAP;
  if (E0 < 0.01 || Math.abs(D) < 0.001) return null;
  const mid = (m0 + m1) / 2; const teken = kant === 'min' ? -1 : 1;
  const coord = (p) => (as === 's' ? p[0] * u[0] + p[1] * u[1] : as === 'w' ? p[0] * v[0] + p[1] * v[1] : p[2]);
  const verder = (p) => (kant === 'min' ? coord(p) < mid - 0.001 : coord(p) > mid + 0.001);
  const dv = as === 's' ? [u[0], u[1], 0] : as === 'w' ? [v[0], v[1], 0] : [0, 0, 1];
  const zet = (p) => (verder(p) ? [r3(p[0] + dv[0] * D * teken), r3(p[1] + dv[1] * D * teken), r3(p[2] + dv[2] * D * teken)] : p);
  const nieuwId = () => Math.random().toString(36).slice(2, 9);
  const uit = []; const erbij = {};
  for (const s of alle) {
    if (!kies.includes(s)) { uit.push(s); continue; }
    const e = eindPt(s); const va = verder(s.a); const ve = verder(e);
    if (va && ve) { uit.push({ ...s, a: zet(s.a) }); continue; }
    if (!va && !ve) { uit.push(s); continue; }
    // Kruist het midden: langer of korter in de richting van de as.
    const A = zet(s.a); const Bp = zet(e); const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]);
    if (L < STAP - 0.001) return { fout: 'Zo kort kan niet: een stuk zou verdwijnen. Haal eerst een stuk weg.' };
    const d = [(Bp[0] - A[0]) / L, (Bp[1] - A[1]) / L, (Bp[2] - A[2]) / L]; let o = 0;
    const delen = opdelen(L, lengtes).map((Li, i) => { const p = [A[0] + d[0] * o, A[1] + d[1] * o, A[2] + d[2] * o].map(r3); o += Li; return { ...s, id: i === 0 ? s.id : nieuwId(), L: Li, a: p }; });
    uit.push(...delen); erbij[s.id] = delen.slice(1).map((x) => x.id);
  }
  return { stukken: uit, erbij, zet, E0, E1: E0 + D };
}

// ---------- Analyse: overspanningen, uitkragingen, losse torens ----------
// Een ligger rust op een steunpunt waar een staand stuk eronder aansluit (een toren, via een hoekblok of rechtstreeks).
// Tussen twee steunpunten = overspanning; voorbij het laatste = uitkraging. Liggers op de vloer tellen niet.
export function trussAnalyse(stukken, T = TRUSS_TYPES[0]) {
  const H = T.B / 2; const st = stukken.map((s, i) => ({ ...s, i: s.i ?? i, e: s.e || eindPt(s) }));
  const knopen = trussKnopen(st, T.B); const max = maxOverspanning(T);
  const lig = st.filter((s) => !s.op && s.a[2] > H + 0.05);
  // Lijnen: liggende stukken op één rechte (zelfde richting, zelfde hoogte, op elkaar aansluitend, ook door een blok).
  const lijnen = []; const gezien = new Set();
  const opLijn = (a, b) => Math.abs(Math.sin(a.r - b.r)) < 0.01 && Math.abs(a.a[2] - b.a[2]) < 0.02 && Math.abs((b.a[0] - a.a[0]) * -Math.sin(a.r) + (b.a[1] - a.a[1]) * Math.cos(a.r)) < 0.02;
  for (const s of lig) {
    if (gezien.has(s.i)) continue; const lijn = lig.filter((x) => opLijn(s, x)); lijn.forEach((x) => gezien.add(x.i));
    const u = [Math.cos(s.r), Math.sin(s.r)]; const t = (p) => (p[0] - s.a[0]) * u[0] + (p[1] - s.a[1]) * u[1];
    // aaneengesloten stukken (gaten groter dan een blok = aparte lijnen)
    const iv = lijn.map((x) => [Math.min(t(x.a), t(x.e)), Math.max(t(x.a), t(x.e))]).sort((a, b) => a[0] - b[0]); const delen = [];
    for (const [a, b] of iv) { const l = delen[delen.length - 1]; if (l && a <= l[1] + T.B + 0.02) l[1] = Math.max(l[1], b); else delen.push([a, b]); }
    for (const [a, b] of delen) lijnen.push({ s, u, t, a, b, z: s.a[2] });
  }
  const steunOp = (L) => {
    const pts = [];
    for (const k of knopen) { if (!k.hoek) continue; const tk = L.t(k.p); if (tk < L.a - H - 0.02 || tk > L.b + H + 0.02) continue; if (Math.abs(k.p[2] - L.z) > 0.03) continue; const af = Math.abs((k.p[0] - L.s.a[0]) * -L.u[1] + (k.p[1] - L.s.a[1]) * L.u[0]); if (af > 0.03) continue; if (k.richtingen.some((r) => r[2] > 0.5)) pts.push(tk); }
    for (const s of st) if (s.op) { const top = s.e; if (Math.abs(top[2] - L.z) < 0.03 || Math.abs(top[2] + H - L.z) < 0.03) { const tk = L.t(top); const af = Math.abs((top[0] - L.s.a[0]) * -L.u[1] + (top[1] - L.s.a[1]) * L.u[0]); if (af < 0.03 && tk >= L.a - H - 0.02 && tk <= L.b + H + 0.02 && !pts.some((x) => Math.abs(x - tk) < 0.05)) pts.push(tk); } }
    return [...new Set(pts.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
  };
  const overspanningen = []; const meldingen = [];
  for (const L of lijnen) {
    const sp = steunOp(L); const lengte = L.b - L.a;
    if (!sp.length) { meldingen.push({ soort: 'let', tekst: `Ligger van ${fmt(lengte)} m op ${fmt(L.z + H)} m zonder steun eronder. Hangt hij aan motoren, dan gelden de afstanden tussen de ophangpunten.`, ids: [L.s.id] }); continue; }
    for (let i = 0; i < sp.length - 1; i++) {
      const Lsp = sp[i + 1] - sp[i]; if (Lsp < 0.5) continue; const bel = belastingBij(T, Lsp);
      overspanningen.push({ L: Lsp, hoogte: L.z + H, bel, ids: [L.s.id] });
      if (Lsp > max + 0.01) meldingen.push({ soort: 'fout', tekst: `Overspanning van ${fmt(Lsp)} m: te lang voor ${T.kort} (± ${max} m bij ${belastingBij(T, max)?.udl ?? '?'} kg/m). Kies een zwaardere truss of zet er een toren tussen.`, ids: [L.s.id] });
    }
    const voor = sp[0] - L.a; const na = L.b - sp[sp.length - 1];
    for (const u of [voor, na]) if (u > 1.0 + H) meldingen.push({ soort: 'let', tekst: `Uitkraging van ${fmt(u - H)} m: hou het zonder berekening bij ± 1 m.`, ids: [L.s.id] });
  }
  // Losse torens: staand vanaf de vloer, zonder ligger bovenaan.
  const torensOp = st.filter((s) => s.op && s.a[2] < 0.01);
  for (const tw of torensOp) {
    let top = tw; for (let k = 0; k < 20; k++) { const n = st.find((x) => x.op && Math.hypot(x.a[0] - top.e[0], x.a[1] - top.e[1]) < 0.02 && Math.abs(x.a[2] - top.e[2]) < 0.02); if (!n) break; top = n; }
    const h = top.e[2] + H; const bovenaan = knopen.some((k) => k.hoek && Math.hypot(k.p[0] - top.e[0], k.p[1] - top.e[1]) < 0.03 && Math.abs(k.p[2] - (top.e[2] + H)) < 0.05) || st.some((x) => !x.op && Math.abs(x.a[2] - top.e[2]) < 0.03 && (Math.hypot(x.a[0] - top.e[0], x.a[1] - top.e[1]) < 0.03 || Math.hypot(x.e[0] - top.e[0], x.e[1] - top.e[1]) < 0.03));
    if (!bovenaan && h > 3.5) meldingen.push({ soort: 'let', tekst: `Losse toren van ${fmt(h)} m: voorzie ballast op de baseplate of verankering (tuien).`, ids: [tw.id] });
  }
  return { overspanningen, meldingen, max };
}
const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('nl-BE');
