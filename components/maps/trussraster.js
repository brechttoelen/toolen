// Truss tekenen als lijnen op een stramien. Je tekent enkel de vorm; stukken, blokken en baseplates volgen eruit.
// velden.truss.raster = { o: [x, y], x: [..], y: [..], z: [..], lijnen: ['a,i,j,k', ..] }
//   x, y, z = de lengtes truss tussen twee opeenvolgende assen (per 0,5 m); tussen twee assen zit altijd een blok.
//   Een lijn 'a,i,j,k' loopt van stramienpunt (i, j, k) naar het volgende punt langs as a.
//   o = plaats van het eerste stramienpunt ten opzichte van de ankerlijn op de kaart.
// De afgeleide stukken worden mee bewaard in velden.truss.stukken (zelfde vorm als vroeger), zodat kaart, 3D,
// materiaallijst en PDF niets van het stramien hoeven te weten.
import { TRUSS_B, TRUSS_LENGTES, opdelen } from './trussbouw';

const r3 = (v) => Math.round(v * 1000) / 1000;
const half = (v) => Math.max(0.5, Math.round(v * 2) / 2);
export const AS = { x: 0, y: 1, z: 2 };
export const sleutel = (a, q) => `${a},${q[0]},${q[1]},${q[2]}`;
export const uitSleutel = (s) => { const [a, i, j, k] = s.split(','); return { a, q: [Number(i), Number(j), Number(k)] }; };
export const isRaster = (t) => !!t?.raster && Array.isArray(t.raster.lijnen);
export const leegRaster = () => ({ o: [0, 0], x: [], y: [], z: [], lijnen: [] });
const kopie = (R) => ({ o: [...(R.o || [0, 0])], x: [...R.x], y: [...R.y], z: [...R.z], lijnen: [...R.lijnen] });

// Plaats van de assen (hart van de blokken). Ligt er een ligger op de vloer, dan staan de poten op blokken.
export function rasterMaten(R, B = TRUSS_B) {
  const H = B / 2; const vloer = R.lijnen.some((s) => { const e = uitSleutel(s); return e.a !== 'z' && e.q[2] === 0; });
  const rij = (l) => { const p = [0]; for (const s of l) p.push(r3(p[p.length - 1] + s + B)); return p; };
  const Z = [vloer ? 0 : -H]; R.z.forEach((s, n) => Z.push(r3(Z[n] + s + (n === 0 && !vloer ? H : B))));
  return { X: rij(R.x), Y: rij(R.y), Z, vloer, H, B };
}
export const puntVan = (M, q) => [M.X[q[0]], M.Y[q[1]], M.Z[q[2]]];
const RICHT = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// De te huren stukken (in het stelsel van het stramien): { id, lijn, L, a, r, op }.
export function rasterStukken(R, B = TRUSS_B, lengtes = TRUSS_LENGTES) {
  const M = rasterMaten(R, B); const uit = [];
  for (const s of R.lijnen) {
    const e = uitSleutel(s); const P = puntVan(M, e.q); const d = RICHT[e.a]; const L = R[e.a][e.q[AS[e.a]]]; if (!L) continue;
    let o = e.a === 'z' && e.q[2] === 0 && !M.vloer ? 0 : M.H; // een poot zonder blok eronder staat op de vloer
    opdelen(L, lengtes).forEach((Li, n) => { uit.push({ id: `${s.replace(/,/g, '_')}_${n}`, lijn: s, L: Li, a: [r3(P[0] + d[0] * o), r3(P[1] + d[1] * o), r3(P[2] + d[2] * o)], r: e.a === 'y' ? Math.PI / 2 : 0, op: e.a === 'z' }); o += Li; });
  }
  return uit;
}
export const lijnVanStuk = (id) => String(id || '').split('_').slice(0, 4).join(',');

// ---------- Bewerkingen (geven { R, doeken }) ----------
const doekMee = (doeken, a, f) => doeken.map((d) => {
  if (!d.vak) return d; const v = { ...d.vak };
  if (a === 'z') v.k = f(v.k); else if (a === v.as) { v.i0 = f(v.i0); v.i1 = f(v.i1); } else v.vast = f(v.vast);
  return { ...d, vak: v };
});
// Een as erbij binnen vak n (tussen as n en n + 1), op s1 van as n: er komt daar een blok, het geheel wordt een blok langer.
export function asTussen(R, a, n, s1, doeken = []) {
  const N = kopie(R); const s = N[a][n]; N[a].splice(n, 1, s1, Math.round((s - s1) * 100) / 100); const c = AS[a]; const uit = [];
  for (const k of R.lijnen) {
    const e = uitSleutel(k); const q = [...e.q];
    if (e.a === a && q[c] === n) { uit.push(k); q[c] = n + 1; uit.push(sleutel(a, q)); continue; }
    if (q[c] > n) q[c] += 1; uit.push(sleutel(e.a, q));
  }
  N.lijnen = uit; return { R: N, doeken: doekMee(doeken, a, (i) => (i > n ? i + 1 : i)) };
}
// Een as erbij voorbij de laatste ('na') of voor de eerste ('voor').
export function asBuiten(R, a, kant, L, doeken = [], B = TRUSS_B) {
  const N = kopie(R); if (kant === 'na') { N[a].push(L); return { R: N, doeken }; }
  const c = AS[a]; N[a].unshift(L); if (c < 2) N.o[c] = r3(N.o[c] - L - B); // de oorsprong schuift mee terug
  N.lijnen = R.lijnen.map((k) => { const e = uitSleutel(k); const q = [...e.q]; q[c] += 1; return sleutel(e.a, q); });
  return { R: N, doeken: doekMee(doeken, a, (i) => i + 1) };
}
// Lijnen tussen stramienpunt q en as m langs a.
export function voegLijn(R, a, q, m) {
  const N = kopie(R); const c = AS[a]; const set = new Set(N.lijnen);
  for (let n = Math.min(q[c], m); n < Math.max(q[c], m); n++) { const p = [...q]; p[c] = n; set.add(sleutel(a, p)); }
  N.lijnen = [...set]; return N;
}
// Assen die niets meer doen (geen hoek, geen aansluiting, geen uiteinde) verdwijnen: de vakken ernaast worden één stuk.
export function ruimOp(R0, doeken0 = [], B = TRUSS_B) {
  let R = kopie(R0); let doeken = doeken0;
  for (let ronde = 0; ronde < 200; ronde++) {
    const knoop = new Map(); const zet = (q, a, kant) => { const k = q.join(','); if (!knoop.has(k)) knoop.set(k, { q, l: [] }); knoop.get(k).l.push([a, kant]); };
    for (const s of R.lijnen) { const e = uitSleutel(s); zet(e.q, e.a, 1); const q2 = [...e.q]; q2[AS[e.a]] += 1; zet(q2, e.a, -1); }
    let weg = null;
    for (const a of ['x', 'y', 'z']) {
      const c = AS[a]; const aantal = R[a].length + 1; if (aantal < 2) continue;
      for (let n = 0; n < aantal && !weg; n++) {
        if (a === 'z' && n === 0) continue; // de vloer blijft
        let nodig = false; let gebruikt = false;
        for (const { q, l } of knoop.values()) { if (q[c] !== n) continue; gebruikt = true; const langs = l.filter((x) => x[0] === a); if (langs.length !== l.length || langs.length !== 2) { nodig = true; break; } }
        if (nodig) continue;
        if (!gebruikt && n > 0 && n < aantal - 1) continue; // lege as middenin: laat staan tot hij aan de rand komt
        weg = { a, n, gebruikt, aantal };
      }
      if (weg) break;
    }
    if (!weg) break;
    const { a, n, aantal } = weg; const c = AS[a]; const N = kopie(R);
    if (n === 0) { const s0 = N[a].shift(); if (c < 2) N.o[c] = r3(N.o[c] + s0 + B); }
    else if (n === aantal - 1) N[a].pop();
    else N[a].splice(n - 1, 2, Math.round((N[a][n - 1] + N[a][n]) * 100) / 100);
    N.lijnen = [...new Set(R.lijnen.flatMap((k) => {
      const e = uitSleutel(k); const q = [...e.q];
      if (n === aantal - 1) return [k];
      if (n === 0) { q[c] -= 1; return q[c] < 0 ? [] : [sleutel(e.a, q)]; }
      if (e.a === a && q[c] === n) return []; // tweede helft van een doorlopende lijn
      if (q[c] > n) q[c] -= 1; return [sleutel(e.a, q)];
    }))];
    doeken = doekMee(doeken, a, (i) => (n === aantal - 1 ? i : i > n || n === 0 ? Math.max(0, i - 1) : i)); R = N;
  }
  if (!R.lijnen.length) return { R: { ...leegRaster(), o: R.o }, doeken: [] };
  return { R, doeken };
}
export function haalWeg(R, sleutels, doeken = [], B = TRUSS_B) {
  const N = kopie(R); const weg = new Set(sleutels); N.lijnen = N.lijnen.filter((k) => !weg.has(k)); return ruimOp(N, doeken, B);
}
export function zetMaat(R, a, n, L) { const N = kopie(R); N[a][n] = half(L); return N; }

// ---------- Doeken in een vak ----------
// d.vak = { as: 'x' | 'y', vast, i0, i1, k }: onder de ligger(s) op niveau k tussen as i0 en i1. d.h = hoogte in m (leeg =
// tot de ligger eronder of de vloer). Geeft de doeken met de berekende maten (stuk, s0, s1, z0, z1) of laat ze vallen.
export function rasterDoeken(R, doeken, B = TRUSS_B, lengtes = TRUSS_LENGTES) {
  const M = rasterMaten(R, B); const H = M.H; const set = new Set(R.lijnen); const st = rasterStukken(R, B, lengtes);
  const uit = [];
  for (const d of doeken || []) {
    if (!d.vak) continue; const { as, vast, i0, i1, k } = d.vak; if (!(i1 > i0) || k < 0) continue;
    const q = (i, kk) => (as === 'x' ? [i, vast, kk] : [vast, i, kk]); const rij = (kk) => { const l = []; for (let i = i0; i < i1; i++) l.push(sleutel(as, q(i, kk))); return l; };
    const boven = rij(k); if (!boven.every((s) => set.has(s))) continue;
    const P = as === 'x' ? M.X : M.Y; if (P[i1] == null || M.Z[k] == null) continue;
    let kb = null; for (let kk = k - 1; kk >= 0; kk--) if (rij(kk).every((s) => set.has(s))) { kb = kk; break; }
    const op = d.wijze === 'op'; const z1 = M.Z[k] + (op ? H : -H);
    const onder = kb != null ? M.Z[kb] + (op ? -H : H) : -H;
    const z0 = d.h ? Math.max(-H, z1 - Number(d.h)) : Math.max(-H, onder);
    const F = st.find((x) => x.lijn === boven[0]); if (!F || z1 - z0 < 0.05) continue;
    const begin = P[i0] + H; // waar het eerste stuk begint
    uit.push({ ...d, stuk: F.id, stukken: boven.map((s) => st.find((x) => x.lijn === s)?.id).filter(Boolean), s0: r3((op ? P[i0] - H : P[i0] + H) - begin), s1: r3((op ? P[i1] + H : P[i1] - H) - begin), z0: r3(z0), z1: r3(z1) });
  }
  return uit;
}

// ---------- Kant-en-klare vormen ----------
const vorm = (x, y, z, lijnen) => ({ o: [0, 0], x, y, z, lijnen });
export const vormToren = (H) => vorm([], [], [half(H)], ['z,0,0,0']);
export const vormLigger = (W) => vorm([half(W)], [], [], ['x,0,0,0']);
export const vormPortaal = (W, H) => vorm([half(W)], [], [half(H)], ['z,0,0,0', 'z,1,0,0', 'x,0,0,1']);
export function vormWand(n, W, H, onder = false) {
  const l = []; for (let i = 0; i <= n; i++) l.push(`z,${i},0,0`); for (let i = 0; i < n; i++) { l.push(`x,${i},0,1`); if (onder) l.push(`x,${i},0,0`); }
  return vorm(Array.from({ length: n }, () => half(W)), [], [half(H)], l);
}
export function vormKubus(W, D, H) {
  const l = []; for (const i of [0, 1]) for (const j of [0, 1]) l.push(`z,${i},${j},0`);
  for (const k of [0, 1]) { for (const j of [0, 1]) l.push(`x,0,${j},${k}`); for (const i of [0, 1]) l.push(`y,${i},0,${k}`); }
  return vorm([half(W)], [half(D)], [half(H)], l);
}

// ---------- Een truss uit de oude bouwer (losse stukken) omzetten ----------
// Lukt als alle stukken recht (per 90°) staan. Geeft { R, vlakken } of null. vlakken helpt om oude doeken terug te vinden.
export function rasterUitOud(stukken, B = TRUSS_B) {
  const H = B / 2; if (!stukken?.length) return null; const st = [];
  for (const s of stukken) {
    const L = Number(s.L) || 0; const p = s.p || [0, 0]; let z = Number(s.z) || 0; if (L < 0.5) return null;
    if (s.op) { if (Math.abs(z) < 0.01) z = -H; st.push({ a: 'z', van: [p[0], p[1], z], L }); continue; }
    const g = (((Number(s.r) || 0) % 360) + 360) % 360; const kw = Math.round(g / 90) % 4; if (Math.abs(g - Math.round(g / 90) * 90) > 2) return null;
    const d = [[1, 0], [0, 1], [-1, 0], [0, -1]][kw]; const van = d[0] + d[1] < 0 ? [p[0] + d[0] * L, p[1] + d[1] * L, z] : [p[0], p[1], z];
    st.push({ a: kw % 2 ? 'y' : 'x', van, L });
  }
  const assen = {}; const vloer = st.some((s) => s.a !== 'z' && s.van[2] < 0.2);
  for (const a of ['x', 'y', 'z']) {
    const c = AS[a]; const w = []; // [waarde, gewicht]: een dwarsstuk weegt zwaarder dan een los uiteinde
    for (const s of st) if (s.a !== a) w.push([s.van[c], 3]);
    for (const s of st) if (s.a === a) for (const [v, uitw] of [[s.van[c], -1], [s.van[c] + s.L, 1]]) { if (a === 'z' && uitw < 0 && v < -H + 0.2) { w.push([vloer ? 0 : -H, 9]); continue; } if (st.some((g) => g !== s && g.a === a && [0, 1, 2].every((k) => k === c || Math.abs(g.van[k] - s.van[k]) < 0.03) && (Math.abs(g.van[c] - v) < 0.03 || Math.abs(g.van[c] + g.L - v) < 0.03))) continue; /* koppeling */ if (!w.some((x) => x[1] >= 3 && Math.abs(x[0] - v) < B + 0.06)) w.push([v + uitw * H, 1]); }
    if (a === 'z') w.push([vloer ? 0 : -H, 9]);
    w.sort((p, q) => p[0] - q[0]); const groepen = [];
    for (const x of w) { const g = groepen[groepen.length - 1]; if (g && x[0] - g.l[g.l.length - 1] < 0.22) { g.l.push(x[0]); g.n += x[1]; } else groepen.push({ l: [x[0]], n: x[1] }); }
    let P = groepen.map((g) => ({ v: g.l.reduce((p, q) => p + q, 0) / g.l.length, n: g.n }));
    // Assen die te dicht op elkaar staan (rommel uit de oude bouwer): de lichtste valt weg.
    for (let n = 0; n < P.length - 1;) { if (P[n + 1].v - P[n].v < 0.5 + (a === 'z' && n === 0 && !vloer ? H : B) - 0.2) { P.splice(P[n + 1].n > P[n].n && !(a === 'z' && n === 0) ? n : n + 1, 1); n = Math.max(0, n - 1); } else n++; }
    assen[a] = P.map((x) => x.v);
  }
  const R = leegRaster(); R.o = [r3(assen.x[0] ?? 0), r3(assen.y[0] ?? 0)];
  for (const a of ['x', 'y', 'z']) {
    const P = assen[a];
    for (let n = 0; n < P.length - 1; n++) {
      const d = P[n + 1] - P[n]; const k1 = a === 'z' && n === 0 && !vloer ? d - H : d - B; const k2 = d; const fout = (v) => Math.abs(v - Math.round(v * 2) / 2);
      const L = Math.round((fout(k1) <= fout(k2) + 0.02 ? k1 : k2) * 2) / 2; if (L < 0.5) return null; R[a].push(L);
    }
  }
  const dichtst = (P, v) => { let b = 0; for (let n = 1; n < P.length; n++) if (Math.abs(P[n] - v) < Math.abs(P[b] - v)) b = n; return b; };
  const set = new Set();
  for (const s of st) {
    const c = AS[s.a]; const q = [dichtst(assen.x, s.van[0]), dichtst(assen.y, s.van[1]), dichtst(assen.z, s.van[2])];
    const n0 = dichtst(assen[s.a], s.van[c]); const n1 = dichtst(assen[s.a], s.van[c] + s.L); if (n1 <= n0) continue;
    for (let n = n0; n < n1; n++) { const p = [...q]; p[c] = n; set.add(sleutel(s.a, p)); }
  }
  R.lijnen = [...set]; if (!R.lijnen.length) return null;
  return { R, assen };
}
