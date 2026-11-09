// Truss vrij bouwen (trussbouwer): losse stukken H30V als bouwblokken, liggend of staand.
// Item (een truss-lijn): velden.truss = { stukken: [{ id, L, p: [x, y], z, r, op }] }
//   p, r ten opzichte van het eerste punt van de lijn (x-as langs het eerste stuk), r in graden
//   (richting van een liggend stuk), op = staand (van z naar z + L). Lengtes hart op hart.
// Hoekstukken komen vanzelf waar stukken in een hoek samenkomen, baseplates onder staande stukken.

export const isTrussBouw = (it) => Array.isArray(it?.velden?.truss?.stukken) && it.velden.truss.stukken.length > 0;
export const TRUSS_LENGTES = [4, 3, 2.5, 2, 1.5, 1, 0.5];
export const TRUSS_B = 0.29;
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
// Knopen: hoekstukken (stukken komen in een hoek samen) en baseplates (staand stuk op de vloer).
export function trussKnopen(stukken) {
  const m = new Map();
  const zet = (p, s, richting) => { const k = `${rnd(p[0])},${rnd(p[1])},${rnd(p[2])}`; const x = m.get(k) || { p, stukken: [], richtingen: [] }; x.stukken.push(s.i); x.richtingen.push(richting); m.set(k, x); };
  for (const s of stukken) {
    const d = s.op ? [0, 0, 1] : [Math.cos(s.r), Math.sin(s.r), 0];
    zet(s.a, s, d.map((v) => -v)); zet(s.e, s, d);
  }
  const uit = [];
  for (const k of m.values()) {
    const n = k.richtingen.length;
    // Twee stukken in elkaars verlengde: gewone koppeling, geen hoekstuk.
    const rechtdoor = n === 2 && Math.abs(k.richtingen[0][0] * k.richtingen[1][0] + k.richtingen[0][1] * k.richtingen[1][1] + k.richtingen[0][2] * k.richtingen[1][2] + 1) < 0.02;
    const hoek = n >= 2 && !rechtdoor;
    const voet = k.p[2] < 0.01 && k.stukken.some((i) => stukken[i].op && stukken[i].a[2] < 0.01);
    uit.push({ ...k, hoek, voet, armen: n });
  }
  return uit;
}

export function trussTelling(stukken) {
  const t = { stukken: {}, hoek: 0, voet: 0 };
  for (const s of stukken) { const k = String(s.L); t.stukken[k] = (t.stukken[k] || 0) + 1; }
  for (const k of trussKnopen(stukken)) { if (k.hoek) t.hoek += 1; if (k.voet) t.voet += 1; }
  return t;
}

// Lengte opdelen in te huren stukken (grootste eerst).
export function opdelen(L, lengtes = TRUSS_LENGTES) {
  const uit = []; let rest = Math.round(L * 100) / 100;
  for (const l of lengtes) while (rest >= l - 0.001) { uit.push(l); rest = Math.round((rest - l) * 100) / 100; }
  if (rest > 0.01) uit.push(lengtes[lengtes.length - 1]);
  return uit;
}

// Kant-en-klare vormen, in meter rond (0, 0), richting r (rad).
export function portaal(W, H, r = 0, lengtes = TRUSS_LENGTES) {
  const u = [Math.cos(r), Math.sin(r)]; const uit = [];
  for (const x of [0, W]) { let z = 0; for (const l of opdelen(H, lengtes)) { uit.push({ L: l, a: [u[0] * x, u[1] * x, z], r, op: true }); z += l; } }
  let x = 0; for (const l of opdelen(W, lengtes)) { uit.push({ L: l, a: [u[0] * x, u[1] * x, H], r, op: false }); x += l; }
  return uit;
}
export function kubus(W, H, r = 0, lengtes = TRUSS_LENGTES) {
  const u = [Math.cos(r), Math.sin(r)]; const v = [-u[1], u[0]]; const uit = [];
  const P = (x, y) => [u[0] * x + v[0] * y, u[1] * x + v[1] * y];
  for (const [x, y] of [[0, 0], [W, 0], [W, W], [0, W]]) { let z = 0; for (const l of opdelen(H, lengtes)) { const p = P(x, y); uit.push({ L: l, a: [p[0], p[1], z], r, op: true }); z += l; } }
  for (const z of [0, H]) {
    for (const [x0, y0, rr] of [[0, 0, r], [W, 0, r + Math.PI / 2], [W, W, r + Math.PI], [0, W, r - Math.PI / 2]]) {
      let d = 0; const ur = [Math.cos(rr), Math.sin(rr)];
      for (const l of opdelen(W, lengtes)) { const p = P(x0, y0); uit.push({ L: l, a: [p[0] + ur[0] * d, p[1] + ur[1] * d, z], r: rr, op: false }); d += l; }
    }
  }
  return uit;
}

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

// Eén maat van de constructie wijzigen (as 's' = lengte, 'w' = breedte, 'z' = hoogte); de kant 'max' (standaard) of 'min' schuift.
// Liggers en staanders in elkaars verlengde worden samen herrekend en opnieuw opgedeeld in te huren stukken.
// Geeft { stukken, erbij } (erbij: oud id → nieuwe ids, zodat doeken blijven hangen) en de omzetting van een punt.
export function schaalTruss(alle, ids, u, as, nieuw, lengtes = TRUSS_LENGTES, kant = 'max') {
  const kies = ids && ids.length ? alle.filter((s) => ids.includes(s.id)) : alle;
  const K = trussKader(kies, u); if (!K) return null;
  const v = K.v; const m0 = as === 's' ? K.s0 : as === 'w' ? K.w0 : K.z0; const m1 = as === 's' ? K.s1 : as === 'w' ? K.w1 : K.z1;
  const E0 = m1 - m0; const E1 = Math.max(STAP, Math.round(nieuw / STAP) * STAP);
  if (E0 < 0.01 || Math.abs(E1 - E0) < 0.001) return null;
  const k = E1 / E0; const vast = kant === 'min' ? m1 : m0;
  const f1 = (c) => vast + Math.round(((c - vast) * k) / STAP) * STAP;
  const zet = (p) => {
    const sV = p[0] * u[0] + p[1] * u[1]; const wV = p[0] * v[0] + p[1] * v[1]; let z = p[2];
    let s2 = sV; let w2 = wV; if (as === 's') s2 = f1(sV); else if (as === 'w') w2 = f1(wV); else z = Math.max(0, f1(z));
    return [r3(u[0] * s2 + v[0] * w2), r3(u[1] * s2 + v[1] * w2), r3(z)];
  };
  // Lopen: stukken op één lijn die op elkaar aansluiten.
  const sleutel = (s) => {
    if (s.op) return `op|${rnd(s.a[0])}|${rnd(s.a[1])}`;
    let a = ((s.r % Math.PI) + Math.PI) % Math.PI; if (Math.PI - a < 0.001) a = 0; const d = [Math.cos(a), Math.sin(a)];
    return `h|${Math.round(a * 1000)}|${rnd(-s.a[0] * d[1] + s.a[1] * d[0])}|${rnd(s.a[2])}`;
  };
  const groepen = new Map(); for (const s of kies) { const g = sleutel(s); if (!groepen.has(g)) groepen.set(g, []); groepen.get(g).push(s); }
  const nieuwId = () => Math.random().toString(36).slice(2, 9);
  const uit = alle.filter((s) => !kies.includes(s)); const erbij = {};
  for (const lijst of groepen.values()) {
    const s0 = lijst[0]; const d = s0.op ? [0, 0, 1] : (() => { let a = ((s0.r % Math.PI) + Math.PI) % Math.PI; if (Math.PI - a < 0.001) a = 0; return [Math.cos(a), Math.sin(a), 0]; })();
    const t = (p) => p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
    const delen = lijst.map((s) => { const a = s.a; const e = eindPt(s); return t(a) <= t(e) ? { s, a, e, ta: t(a), te: t(e) } : { s, a: e, e: a, ta: t(e), te: t(a) }; }).sort((x, y) => x.ta - y.ta);
    const lopen = []; for (const x of delen) { const l = lopen[lopen.length - 1]; if (l && x.ta <= l.te + 0.02) { l.st.push(x.s); if (x.te > l.te) { l.te = x.te; l.e = x.e; } } else lopen.push({ st: [x.s], a: x.a, e: x.e, ta: x.ta, te: x.te }); }
    for (const l of lopen) {
      const A = zet(l.a); const B = zet(l.e); const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
      const oud = l.st.map((x) => x.id);
      if (L < STAP / 2) { for (const o of oud) erbij[o] = []; continue; } // valt weg (bv. te kort geworden)
      const r = s0.op ? s0.r : Math.atan2(B[1] - A[1], B[0] - A[0]);
      let o = 0; const nieuwS = opdelen(L, lengtes).map((Li, i) => {
        const p = [A[0] + ((B[0] - A[0]) * o) / L, A[1] + ((B[1] - A[1]) * o) / L, A[2] + ((B[2] - A[2]) * o) / L]; o += Li;
        return { ...l.st[0], id: i === 0 ? l.st[0].id : nieuwId(), L: Li, a: p.map(r3), r, op: !!s0.op };
      });
      uit.push(...nieuwS); const nids = nieuwS.map((x) => x.id); for (const id of oud) erbij[id] = nids.filter((x) => x !== id);
    }
  }
  return { stukken: uit, erbij, zet, E0, E1 };
}
