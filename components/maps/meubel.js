// Instelbaar meubilair voor het binnenplan: tafels met stoelen per zijde, stoelenblokken
// (theater, klas), podium en bar, en deuren en ramen die in een muur klikken.
// Alles in meter, rond het midden (x langs de breedte, y naar boven); een tekening zoals
// in tekeningen/*.json ({ b, h, vlakken, lijnen }).

const r3 = (v) => Math.round(v * 1000) / 1000;
export const STOEL = 0.45; // zitvlak
const AFSTAND = 0.12; // tafelrand → stoel
const PER_STOEL = 0.6; // tafelrand per stoel bij automatisch vullen
const BG = '#FAFAF8';
const TAFEL = { vul: '#F5F5F4', lijn: '#57534E', d: 0.02 };
const ZIT = { vul: '#D6CFC4', lijn: '#78716C', d: 0.01 };

const rh = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => [r3(x), r3(y)]);
const stoel = ([x, y], a = 0) => {
  const z = STOEL / 2; const k = Math.cos(a); const n = Math.sin(a);
  // zitvlak plus rugleuning aan de buitenkant (a = richting van de tafel naar de stoel)
  const p = (u, v) => [r3(x + u * k - v * n), r3(y + u * n + v * k)];
  return [
    { r: [[p(-z, -z), p(z, -z), p(z, z), p(-z, z), p(-z, -z)]], ...ZIT },
    { r: [[p(z - 0.07, -z), p(z, -z), p(z, z), p(z - 0.07, z), p(z - 0.07, -z)]], vul: '#A8A29E', lijn: '#78716C', d: 0.01 },
  ];
};
const ellips = (b, h, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return [r3((Math.cos(a) * b) / 2), r3((Math.sin(a) * h) / 2)]; });

// ---------- Tafels ----------
// m = { type: 'tafel', vorm: 'rond'|'ovaal'|'rechthoek'|'halfrond', b, d, stoelen }
// rond/ovaal/halfrond: stoelen = { n, kant: 'rondom'|'een' }   (een = enkel de onderste helft, naar het podium)
// rechthoek: stoelen = { boven, onder, links, rechts }
export function autoStoelen(m) {
  if (m.vorm === 'rechthoek') {
    const lang = m.b >= m.d; const L = Math.max(m.b, m.d); const K = Math.min(m.b, m.d);
    const nl = Math.max(0, Math.floor(L / PER_STOEL)); const nk = K >= 0.9 ? Math.max(0, Math.floor(K / PER_STOEL)) : 0;
    return lang ? { boven: nl, onder: nl, links: nk, rechts: nk } : { boven: nk, onder: nk, links: nl, rechts: nl };
  }
  const omtrek = Math.PI * ((m.b + m.d) / 2 + 2 * AFSTAND);
  const n = Math.max(0, Math.round(omtrek / (PER_STOEL + 0.05)));
  return { n: m.vorm === 'halfrond' ? Math.ceil(n / 2) : n, kant: m.vorm === 'halfrond' ? 'een' : 'rondom' };
}
export const zitMeubel = (m) => {
  if (!m) return 0;
  if (m.type === 'tafel') { const s = m.stoelen || {}; return m.vorm === 'rechthoek' ? (s.boven || 0) + (s.onder || 0) + (s.links || 0) + (s.rechts || 0) : s.n || 0; }
  if (m.type === 'stoel') return 1;
  if (m.type === 'rijen') return (m.rijen || 0) * (m.per_rij || 0);
  return 0;
};
export const stoelenMeubel = (m) => (m?.type === 'tafel' || m?.type === 'stoel' || m?.type === 'rijen' ? zitMeubel(m) : 0);

function tafelTekening(m) {
  const b = Number(m.b) || 1; const d = m.vorm === 'rond' ? b : Number(m.d) || b;
  const s = m.stoelen || {};
  const vl = [];
  if (m.vorm === 'rechthoek') {
    const zijde = (n, van, tot, vast, as, a) => { for (let i = 0; i < n; i++) { const t = van + ((tot - van) * (i + 0.5)) / n; vl.push(...stoel(as === 'x' ? [t, vast] : [vast, t], a)); } };
    const o = AFSTAND + STOEL / 2;
    zijde(s.boven || 0, -b / 2, b / 2, d / 2 + o, 'x', Math.PI / 2);
    zijde(s.onder || 0, -b / 2, b / 2, -d / 2 - o, 'x', -Math.PI / 2);
    zijde(s.links || 0, -d / 2, d / 2, -b / 2 - o, 'y', Math.PI);
    zijde(s.rechts || 0, -d / 2, d / 2, b / 2 + o, 'y', 0);
    vl.push({ r: [rh(-b / 2, -d / 2, b / 2, d / 2)], ...TAFEL });
  } else {
    const n = s.n || 0;
    const halfrond = m.vorm === 'halfrond';
    // Eén kant: stoelen enkel op de onderste helft (de kant naar het podium blijft vrij... of omgekeerd: de open kant is boven).
    const een = s.kant === 'een' || halfrond;
    for (let i = 0; i < n; i++) {
      // eén kant: halfronde tafel over 180°, ronde tafel over 240° (de open kant naar boven, naar het podium)
      const boog = halfrond ? Math.PI : (Math.PI * 4) / 3; const start = -Math.PI / 2 - boog / 2;
      const a = een ? start + (boog * (i + 0.5)) / n : (i / n) * Math.PI * 2 - Math.PI / 2;
      const rx = b / 2 + AFSTAND + STOEL / 2; const ry = d / 2 + AFSTAND + STOEL / 2;
      vl.push(...stoel([Math.cos(a) * rx, Math.sin(a) * ry], Math.atan2(Math.sin(a) * rx, Math.cos(a) * ry)));
    }
    const vorm = halfrond ? [...Array.from({ length: 21 }, (_, i) => { const a = Math.PI + (Math.PI * i) / 20; return [r3((Math.cos(a) * b) / 2), r3((Math.sin(a) * d) / 2)]; }), [r3(-b / 2), 0]] : ellips(b, d);
    vl.push({ r: [vorm], ...TAFEL });
  }
  return vl;
}

// ---------- Stoelenblok (theater / klas) ----------
// m = { type: 'rijen', rijen, per_rij, stoelb (0.5), rijafstand (0.9), gang_na (0 = geen), gang (1.2), tafels: bool, tafeld (0.5) }
function rijenTekening(m) {
  const vl = []; const pos = rijenPosities(m);
  for (const p of pos.stoelen) vl.push(...stoel(p, -Math.PI / 2));
  for (const t of pos.tafels) vl.push({ r: [rh(t[0], t[1], t[2], t[3])], ...TAFEL });
  return vl;
}
function rijenPosities(m) {
  const sb = Number(m.stoelb) || 0.5; const ra = Number(m.rijafstand) || (m.tafels ? 1.2 : 0.9);
  const per = Math.max(1, m.per_rij || 1); const rijen = Math.max(1, m.rijen || 1);
  const gn = Math.max(0, m.gang_na || 0); const g = Number(m.gang) || 1.2;
  const xs = []; let x = 0;
  for (let i = 0; i < per; i++) { if (i && gn && i % gn === 0) x += g - sb; xs.push(x); x += sb; }
  const W = x; const H = (rijen - 1) * ra + STOEL + (m.tafels ? (Number(m.tafeld) || 0.5) + 0.05 : 0);
  const stoelen = []; const tafels = [];
  for (let j = 0; j < rijen; j++) {
    const y = H / 2 - STOEL / 2 - j * ra - (m.tafels ? (Number(m.tafeld) || 0.5) + 0.05 : 0);
    for (const xi of xs) stoelen.push([r3(xi + sb / 2 - W / 2), r3(y)]);
    if (m.tafels) {
      // tafels vóór elke rij (naar boven = naar het podium), per groep tussen de gangen
      const td = Number(m.tafeld) || 0.5; let start = xs[0];
      for (let i = 1; i <= xs.length; i++) {
        if (i === xs.length || (gn && i % gn === 0)) { tafels.push([start - W / 2, y + STOEL / 2 + 0.05, xs[i - 1] + sb - W / 2, y + STOEL / 2 + 0.05 + td]); start = xs[i]; }
      }
    }
  }
  return { W: r3(W), H: r3(H), stoelen, tafels };
}

// ---------- Deur en raam ----------
// m = { type: 'deur', b, t (muurdikte), scharnier: 'l'|'r', open: 'in'|'uit', dubbel }
function deurTekening(m) {
  const b = Number(m.b) || 0.9; const t = Number(m.t) || 0.2;
  const vl = [{ r: [rh(-b / 2, -t / 2, b / 2, t / 2)], vul: BG, lijn: 'none', d: 0 }];
  const ln = [{ c: [[-b / 2, -t / 2], [-b / 2, t / 2]].map((p) => p.map(r3)), k: '#1d1d1b', d: 0.03 }, { c: [[b / 2, -t / 2], [b / 2, t / 2]].map((p) => p.map(r3)), k: '#1d1d1b', d: 0.03 }];
  const zy = m.open === 'uit' ? -1 : 1; const y0 = (zy * t) / 2;
  const blad = (hx, w, dir) => {
    // scharnier op hx, blad loodrecht op de muur, boog naar het andere eind
    ln.push({ c: [[hx, y0], [hx, y0 + zy * w]].map((p) => p.map(r3)), k: '#1d1d1b', d: 0.035 });
    const boog = Array.from({ length: 17 }, (_, i) => { const a = (Math.PI / 2) * (i / 16); return [r3(hx + dir * w * Math.sin(a)), r3(y0 + zy * w * Math.cos(a))]; });
    ln.push({ c: boog, k: '#6B7280', d: 0.01, s: 'streep' });
  };
  if (m.dubbel) { blad(-b / 2, b / 2, 1); blad(b / 2, b / 2, -1); } else if (m.scharnier === 'r') blad(b / 2, b, -1); else blad(-b / 2, b, 1);
  return { vl, ln };
}
function raamTekening(m) {
  const b = Number(m.b) || 1.2; const t = Number(m.t) || 0.2;
  return {
    vl: [{ r: [rh(-b / 2, -t / 2, b / 2, t / 2)], vul: '#FFFFFF', lijn: '#1d1d1b', d: 0.02 }],
    ln: [{ c: [[-b / 2, 0], [b / 2, 0]].map((p) => p.map(r3)), k: '#2563EB', d: 0.015 }, { c: [[-b / 2, -t / 6], [b / 2, -t / 6]].map((p) => p.map(r3)), k: '#93C5FD', d: 0.01 }, { c: [[-b / 2, t / 6], [b / 2, t / 6]].map((p) => p.map(r3)), k: '#93C5FD', d: 0.01 }],
  };
}

// Maat van het hele meubel (met stoelen), voor de omtrek op de kaart en het selecteren.
export function maatMeubel(m) {
  if (m.type === 'tafel') {
    const b = Number(m.b) || 1; const d = m.vorm === 'rond' ? b : Number(m.d) || b; const s = m.stoelen || {}; const e = AFSTAND + STOEL;
    if (m.vorm === 'rechthoek') return { b: r3(b + (s.links ? e : 0) + (s.rechts ? e : 0)), h: r3(d + (s.boven ? e : 0) + (s.onder ? e : 0)), dx: r3(((s.rechts ? e : 0) - (s.links ? e : 0)) / 2), dy: r3(((s.boven ? e : 0) - (s.onder ? e : 0)) / 2) };
    const een = s.kant === 'een' || m.vorm === 'halfrond';
    if (!s.n) return { b, h: m.vorm === 'halfrond' ? d / 2 : d, dx: 0, dy: m.vorm === 'halfrond' ? -d / 4 : 0 };
    if (een && m.vorm === 'halfrond') { const hh = d / 2 + e; return { b: r3(b + 2 * e), h: r3(hh), dx: 0, dy: r3(-hh / 2) }; }
    return { b: r3(b + 2 * e), h: r3(d + 2 * e), dx: 0, dy: 0 };
  }
  if (m.type === 'rijen') { const p = rijenPosities(m); return { b: p.W, h: p.H, dx: 0, dy: 0 }; }
  if (m.type === 'stoel') return { b: STOEL, h: STOEL, dx: 0, dy: 0 };
  if (m.type === 'deur' || m.type === 'raam') return { b: Number(m.b) || 0.9, h: Number(m.t) || 0.2, dx: 0, dy: 0 };
  return { b: Number(m.b) || 1, h: Number(m.d) || 1, dx: 0, dy: 0 };
}

export function meubelTekening(m) {
  let vl = []; let ln = [];
  if (m.type === 'tafel') vl = tafelTekening(m);
  else if (m.type === 'rijen') vl = rijenTekening(m);
  else if (m.type === 'stoel') vl = stoel([0, 0], -Math.PI / 2);
  else if (m.type === 'deur') ({ vl, ln } = deurTekening(m));
  else if (m.type === 'raam') ({ vl, ln } = raamTekening(m));
  else {
    const b = Number(m.b) || 1; const d = Number(m.d) || 1;
    const st = { podium: { vul: '#E7E5E4', lijn: '#292524', d: 0.03 }, bar: { vul: '#E0E7FF', lijn: '#3730A3', d: 0.03 }, buffet: { vul: '#FEF3C7', lijn: '#92400E', d: 0.02 } }[m.type] || TAFEL;
    vl = [{ r: [rh(-b / 2, -d / 2, b / 2, d / 2)], ...st }];
  }
  const mt = maatMeubel(m);
  return { b: mt.b, h: mt.h, vlakken: vl, lijnen: ln, teksten: [] };
}

export function naamMeubel(m) {
  const g = (v) => String(r3(v)).replace('.', ',');
  if (m.type === 'tafel') {
    const z = zitMeubel(m);
    if (m.statafel) return m.vorm === 'rond' ? `Statafel Ø ${g(m.b)} m` : `Statafel ${g(m.b)} × ${g(m.d)} m`;
    const vorm = m.vorm === 'rond' ? `Ronde tafel Ø ${g(m.b)} m` : m.vorm === 'ovaal' ? `Ovale tafel ${g(m.b)} × ${g(m.d)} m` : m.vorm === 'halfrond' ? `Halfronde tafel ${g(m.b)} m` : `Tafel ${g(m.b)} × ${g(m.d)} m`;
    return z ? `${vorm} · ${z} stoelen` : vorm;
  }
  if (m.type === 'rijen') return `${m.tafels ? 'Klasopstelling' : 'Stoelenrijen'} ${m.rijen} × ${m.per_rij}`;
  return { stoel: 'Stoel', podium: `Podium ${g(m.b)} × ${g(m.d)} m`, bar: `Bar ${g(m.b)} × ${g(m.d)} m`, buffet: `Buffet ${g(m.b)} × ${g(m.d)} m`, deur: m.dubbel ? `Dubbele deur ${g(m.b)} m` : `Deur ${g(m.b)} m`, raam: `Raam ${g(m.b)} m` }[m.type] || 'Meubel';
}

// Voorinstellingen in het paneel Inrichten.
const T = (vorm, b, d, extra = {}) => { const m = { type: 'tafel', vorm, b, d: d ?? b, ...extra }; if (!m.stoelen) m.stoelen = autoStoelen(m); return m; };
export const MEUBEL_GROEPEN = [
  { naam: 'Tafels', items: [
    T('rond', 1.5), T('rond', 1.8), T('rond', 0.8, 0.8, { stoelen: { n: 0, kant: 'rondom' }, statafel: true }),
    T('rechthoek', 1.8, 0.8), T('rechthoek', 2.0, 1.0), T('rechthoek', 1.2, 0.6, { stoelen: { boven: 0, onder: 2, links: 0, rechts: 0 } }),
    T('ovaal', 2.4, 1.2), T('halfrond', 1.5),
  ] },
  { naam: 'Stoelen', items: [
    { type: 'stoel' },
    { type: 'rijen', rijen: 6, per_rij: 12, stoelb: 0.5, rijafstand: 0.9, gang_na: 6, gang: 1.2 },
    { type: 'rijen', rijen: 4, per_rij: 8, stoelb: 0.6, rijafstand: 1.2, gang_na: 4, gang: 1.2, tafels: true, tafeld: 0.5 },
  ] },
  { naam: 'Podium en bar', items: [{ type: 'podium', b: 6, d: 4 }, { type: 'podium', b: 4, d: 2 }, { type: 'bar', b: 3, d: 0.8 }, { type: 'buffet', b: 2.4, d: 0.8 }] },
  { naam: 'Deuren en ramen', items: [{ type: 'deur', b: 0.9, t: 0.2, scharnier: 'l', open: 'in' }, { type: 'deur', b: 1.8, t: 0.2, dubbel: true, open: 'in' }, { type: 'raam', b: 1.2, t: 0.2 }] },
];
export const naarMuur = (m) => m.type === 'deur' || m.type === 'raam';

// Korte titel en maat voor de tegels in het paneel Inrichten.
export function tegelMeubel(m) {
  const g = (v) => String(r3(v)).replace('.', ',');
  if (m.type === 'tafel') {
    if (m.statafel) return ['Statafel', `Ø ${g(m.b)} m`];
    return { rond: ['Rond', `Ø ${g(m.b)} m`], ovaal: ['Ovaal', `${g(m.b)} × ${g(m.d)}`], halfrond: ['Halfrond', `${g(m.b)} m`], rechthoek: ['Rechthoek', `${g(m.b)} × ${g(m.d)}`] }[m.vorm];
  }
  if (m.type === 'rijen') return [m.tafels ? 'Klas' : 'Theater', `${m.rijen} × ${m.per_rij}`];
  if (m.type === 'stoel') return ['Stoel', '45 cm'];
  if (m.type === 'deur') return [m.dubbel ? 'Dubbel' : 'Deur', `${g(m.b)} m`];
  if (m.type === 'raam') return ['Raam', `${g(m.b)} m`];
  return [{ podium: 'Podium', bar: 'Bar', buffet: 'Buffet' }[m.type] || 'Meubel', `${g(m.b)} × ${g(m.d)}`];
}
