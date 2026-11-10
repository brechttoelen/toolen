// Tentbouwer: de vorm van een tent in 3D (kadertent, booghal, pagode, vouwtent), wand per segment en dak per travee.
// Een tent is een element op schaal uit de categorie Tenten; het item geeft de maten (parameters.breedte × diepte).
// Item: velden.tent = {
//   type: 'kader' | 'boog' | 'pagode' | 'vouw'   (standaard uit het element)
//   zijH: zijwandhoogte (m), kleur: 'naturel' | 'wit' | 'zwart' (aluminium),
//   dak: standaard dakzeil, dakPer: { travee: soort }, nok: transparante nokstrook,
//   wanden: { 'L-0': soort, 'R-2': soort, 'V-0': soort, 'A-1': soort }, doeken: { 'L-0': ontwerpId },
//   luifel: { V: diepte, A: diepte }, gevel / gevelZ { V, A }: 'dicht' | 'transparant' | 'open' (spitszeil boven de zijwand),
//   inter: { spant: true } (intergevel op die spant, segmenten 'I-<spant>-<k>' met dezelfde wandkeuzes),
//   vloerH: hoogte van de vloer (m), terras: { V | A | L | R: diepte }, terrasH: hoogte van het terras
//   frames: { 'L-0': ontwerpId | '' } (signing frame boven de dakrand, met banner),
//   frameKoppel: { 'L-0': koppelId } (frames met dezelfde koppelId op één lijn vormen één lang frame met één banner;
//     de koppelId staat in elke tent apart, dus ook over gekoppelde tenten heen en als je één tent alleen bewerkt)
// }
// Tenten die op het plan tegen elkaar staan zijn gekoppeld: die zijde is standaard open (met een regengoot).
// Zijden: L = lange zijde links (y = 0), R = lange zijde rechts (y = B), V = voorgevel (x = 0), A = achtergevel (x = L).
// Een lange zijde heeft één segment per travee, een gevel één segment per ± 5 m (pagode: één per zijde).
// Dit is een visuele voorstelling: constructie, verankering en ballast bepaalt de tentbouwer (EN 13782).

export const TENTTYPES = [
  { k: 'kader', naam: 'Kadertent', uitleg: 'Zadeldak met rechte dakvlakken, per travee verlengbaar' },
  { k: 'boog', naam: 'Booghal', uitleg: 'Gebogen dak, grote vrije overspanning' },
  { k: 'pagode', naam: 'Pagode', uitleg: 'Vierkante module met een hoog puntdak' },
  { k: 'vouw', naam: 'Vouwtent', uitleg: 'Easy-up met een laag puntdak' },
  { k: 'stretch', naam: 'Stretchtent', uitleg: 'Vrije vorm: rekbaar doek over masten en randpalen' },
  { k: 'sail', naam: 'Sailcloth tent', uitleg: 'Zeildoek op houten masten, één of meer pieken' },
];
// Stretchtent: doek over masten (in een rij in de lengte) en randpalen; per zijde de randhoogte of tot op de grond.
//   velden.tent: mastN, mastH, mastHs: [h…], rand: { L|R|V|A: h }, grond: { L|R|V|A: true }, doek: kleur (DAKEN),
//   wandMaat: 2 | 3 (m per wandelement), wandAfstand: afstand van de wanden tot de rand (0 = aan de rand)
// Sailcloth tent: ronde of lange vorm (halve cirkels aan de uiteinden), pieken op de middellijn: pieken, nokH, zijH.
export const RAND_H = 2.2; export const PAAL_AFSTAND = 3;
export const standaardWandVan = (m) => (m.type === 'vouw' || m.type === 'stretch' ? 'open' : m.type === 'sail' ? 'opgerold' : 'wit');
export const isVrijeTent = (m) => m.type === 'stretch' || m.type === 'sail';

export const WANDEN = [
  { k: 'wit', naam: 'PVC wit', kleur: '#F8FAFC', dekking: 0.96 },
  { k: 'zwart', naam: 'PVC zwart', kleur: '#1F2937', dekking: 0.96 },
  { k: 'mokka', naam: 'PVC mokka', kleur: '#9C9285', dekking: 0.96 },
  { k: 'transparant', naam: 'PVC transparant', kleur: '#BFDBFE', dekking: 0.28 },
  { k: 'venster', naam: 'Met vensterstrook', kleur: '#F8FAFC', dekking: 0.96, strook: true },
  // Houtlook: wanden met houten bekleding (planken), ook met ramen.
  { k: 'hotlook', naam: 'Steigerhout met glas', kleur: '#8A7F72', dekking: 1, raster: true, hout: true },
  { k: 'hotpaneel', naam: 'Steigerhout dicht', kleur: '#8A7F72', dekking: 1, vakken: true, hout: true },
  { k: 'glas', naam: 'Glas', kleur: '#93C5FD', dekking: 0.22, glas: true },
  { k: 'abs', naam: 'Vast paneel (ABS)', kleur: '#E5E7EB', dekking: 1, paneel: true },
  { k: 'deur1', naam: 'Enkele deur', kleur: '#F8FAFC', dekking: 0.96, deur: 1 },
  { k: 'deur2', naam: 'Dubbele deur', kleur: '#F8FAFC', dekking: 0.96, deur: 2 },
  { k: 'houtdeur1', naam: 'Steigerhouten deur', kleur: '#8A7F72', dekking: 1, hout: true, deur: 1 },
  { k: 'houtdeur2', naam: 'Steigerhouten dubbele deur', kleur: '#8A7F72', dekking: 1, hout: true, deur: 2 },
  { k: 'glasdeur', naam: 'Glas met dubbele deur', kleur: '#93C5FD', dekking: 0.22, glas: true, deur: 2 },
  { k: 'rits', naam: 'Ritsdeur PVC', kleur: '#F8FAFC', dekking: 0.96, rits: true },
  { k: 'nood', naam: 'Nooduitgang', kleur: '#F8FAFC', dekking: 0.96, deur: 2, nood: true },
  { k: 'doek', naam: 'Bedrukt doek', kleur: '#0F766E', dekking: 0.95, doek: true },
  { k: 'opgerold', naam: 'Opgerold', kleur: null, dekking: 0, rol: true },
  { k: 'open', naam: 'Open', kleur: null, dekking: 0 },
];
export const wandSoort = (k) => WANDEN.find((w) => w.k === k) || WANDEN[0];
// Breedte in panelen van 1 m: een dubbele deur (ook glas of nooduitgang) neemt er twee.
export const paneelBreedte = (w) => (w?.deur === 2 ? 2 : 1);

// Een wand bestaat uit panelen van ± 1 m. velden.tent.panelen = { '<segment>': { '<index>': soort } } wijkt af van de wand.
// Een wand met een deur als soort: wit (of glas) met de deur in het midden. Geeft [{ i, n, soort, w }] (n = aantal panelen breed).
export function wandPanelen(m, t, sg, standaard = 'wit') {
  const len = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]);
  const n = m.type === 'stretch' || m.type === 'sail' ? 1 : Math.max(1, Math.round(len));
  const basis = wandSoort(t.wanden?.[sg.key] || standaard);
  const rondDeur = (w) => (w.glas ? 'glas' : w.hout ? 'hotpaneel' : 'wit');
  const rij = Array(n).fill(basis.deur ? rondDeur(basis) : basis.k);
  if (basis.deur || basis.rits) { const b = Math.min(n, paneelBreedte(basis)); const i0 = Math.max(0, Math.floor((n - b) / 2)); rij[i0] = basis.k; if (b === 2) rij[i0 + 1] = '_'; }
  const vul = basis.deur ? rondDeur(basis) : basis.k;
  const vrij = (i) => { // paneel i losmaken: een deur die er (deels) op staat wordt gewone wand
    if (rij[i] === '_' && i > 0) { rij[i - 1] = vul; rij[i] = vul; return; }
    if (paneelBreedte(wandSoort(rij[i])) === 2 && rij[i + 1] === '_') rij[i + 1] = vul;
    rij[i] = vul;
  };
  if (n > 1) for (const [k, v] of Object.entries(t.panelen?.[sg.key] || {}).sort((x, y) => Number(x[0]) - Number(y[0]))) {
    const i = Number(k); if (!(i >= 0 && i < n) || !v) continue;
    const w = wandSoort(v); vrij(i);
    if (paneelBreedte(w) === 2) { if (i + 1 < n) { vrij(i + 1); rij[i] = v; rij[i + 1] = '_'; } else rij[i] = w.glas ? 'glas' : w.hout ? 'houtdeur1' : 'deur1'; } else rij[i] = v;
  }
  const uit = []; for (let i = 0; i < n; i++) { if (rij[i] === '_') continue; const w = wandSoort(rij[i]); const b = paneelBreedte(w) === 2 && rij[i + 1] === '_' ? 2 : 1; uit.push({ i, n: b, soort: w.k, w, f0: i / n, f1: (i + b) / n }); }
  return uit;
}

export const DAKEN = [
  { k: 'wit', naam: 'Wit', kleur: '#FFFFFF', dekking: 0.97 },
  { k: 'transparant', naam: 'Transparant', kleur: '#DBEAFE', dekking: 0.35 },
  { k: 'translucent', naam: 'Lichtdoorlatend', kleur: '#F1F5F9', dekking: 0.75 },
  { k: 'zwart', naam: 'Zwart', kleur: '#1F2937', dekking: 0.97 },
  { k: 'mokka', naam: 'Mokka', kleur: '#9C9285', dekking: 0.97 },
  { k: 'zand', naam: 'Zand', kleur: '#D9C7A3', dekking: 0.97 },
  { k: 'zeildoek', naam: 'Zeildoek (ivoor)', kleur: '#F7F1E1', dekking: 0.9 },
  { k: 'gestreept', naam: 'Gestreept', kleur: '#FFFFFF', dekking: 0.97, streep: '#DC2626' },
];
export const dakSoort = (k) => DAKEN.find((d) => d.k === k) || DAKEN[0];
export const ALU = { naturel: '#9CA3AF', wit: '#E5E7EB', zwart: '#374151' };

// Welke tent is het element? Uit de familie of de naam.
export function tentTypeVan(el) {
  const f = `${el?.eigenschappen?.familie || ''} ${el?.naam || ''}`.toLowerCase();
  if (/stretch/.test(f)) return 'stretch';
  if (/sailcloth|sperry|zeildoek/.test(f)) return 'sail';
  if (/boog|arcum|booghal/.test(f)) return 'boog';
  if (/pagode/.test(f)) return 'pagode';
  if (/flcs tent|vouwtent|easy/.test(f)) return 'vouw';
  if (/kader|alu-hal|feesttent/.test(f)) return 'kader';
  return null;
}
export const isTentBouw = (el) => (el?.categorie === 'Tenten en vloeren' || el?.categorie === 'Tenten') && !!tentTypeVan(el);

// Maten: L = lengte (langs x), B = breedte/overspanning (langs y), travee, zijwand- en nokhoogte.
export function tentMaten(it, el) {
  const t = it?.velden?.tent || {};
  const type = t.type || tentTypeVan(el) || 'kader';
  const p = it?.parameters || {};
  const pb = Number(p.breedte) || Number(el?.breedte_m) || 5; const pd = Number(p.diepte) || Number(el?.diepte_m) || 5;
  // Een kadertent of booghal ligt als vak in de lengte: breedte van het item = lengte, diepte = overspanning.
  const L = pb; const B = pd;
  // Kadertent / booghal: travees; pagodes koppelen in een rij (één puntdak per module).
  const modul = type === 'kader' || type === 'boog' || type === 'pagode';
  const travee = modul ? Number(el?.breedte_m) || 5 : L;
  const n = Math.max(1, Math.round(L / travee));
  const zijH = Number(t.zijH) > 0 ? Number(t.zijH) : type === 'stretch' ? RAND_H : type === 'sail' ? 2.4 : type === 'pagode' ? 2.4 : type === 'vouw' ? 2.1 : B >= 15 ? 4 : 3;
  // Nokhoogte volgt uit het type en de breedte (niet vrij in te stellen).
  const nok = type === 'stretch' ? (Number(t.mastH) > 0 ? Number(t.mastH) : Math.min(B, L) >= 10 ? 5 : 4.2)
    : type === 'sail' ? (Number(t.nokH) > 0 ? Number(t.nokH) : zijH + Math.min(B, L) * 0.33)
    : type === 'kader' ? zijH + (B / 2) * Math.tan(((B <= 5 ? 23 : B <= 7.5 ? 19.5 : B <= 10 ? 17.2 : B <= 12.5 ? 16.8 : B <= 15 ? 16.3 : 15.1) * Math.PI) / 180)
    : type === 'boog' ? zijH + B * 0.148
      : type === 'pagode' ? zijH + Math.min(B, L / n) * 0.48
        : zijH + Math.min(B, L) * 0.18;
  return { type, L, B, travee: L / n, n, zijH, nok: Math.round(nok * 100) / 100 };
}

// Wandsegmenten: [{ key, zijde, i, a: [x, y], b: [x, y] }] (a → b, met de buitenkant rechts).
export function tentSegmenten(m, t = {}) {
  const uit = [];
  if (m.type === 'stretch') {
    // Wandelementen van 2 of 3 m op een lijn binnen de rand (afstand instelbaar, 0 = aan de rand).
    const e = Math.max(0, Math.min(Math.min(m.L, m.B) / 2 - 1, Number(t.wandAfstand ?? 1) || 0)); const w = Number(t.wandMaat) === 2 ? 2 : 3;
    const zij = [['L', [e, e], [m.L - e, e]], ['A', [m.L - e, e], [m.L - e, m.B - e]], ['R', [m.L - e, m.B - e], [e, m.B - e]], ['V', [e, m.B - e], [e, e]]];
    for (const [z, a, b] of zij) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(l / w)); for (let i = 0; i < n; i++) uit.push({ key: `${z}-${i}`, zijde: z, i, a: [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n], b: [a[0] + ((b[0] - a[0]) * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n] }); }
    return uit;
  }
  if (m.type === 'sail') {
    // Zijwanden rondom: stukken van ± 3 m langs de omtrek (rechte stukken en halve cirkels).
    const om = sailOmtrek(m); let k = 0;
    for (let i = 0; i < om.length - 1; i++) { const a = om[i]; const b = om[i + 1]; uit.push({ key: `S-${k}`, zijde: 'S', i: k, a, b }); k += 1; }
    return uit;
  }
  for (let i = 0; i < m.n; i++) {
    uit.push({ key: `L-${i}`, zijde: 'L', i, a: [i * m.travee, 0], b: [(i + 1) * m.travee, 0] });
    uit.push({ key: `R-${i}`, zijde: 'R', i, a: [(i + 1) * m.travee, m.B], b: [i * m.travee, m.B] });
  }
  const g = m.type === 'pagode' || m.type === 'vouw' ? 1 : Math.max(1, Math.round(m.B / 5));
  // Een pagode heeft enkel een gevel aan de uiteinden van de rij; tussen gekoppelde pagodes is het open.
  for (let i = 0; i < g; i++) {
    uit.push({ key: `V-${i}`, zijde: 'V', i, a: [0, ((i + 1) * m.B) / g], b: [0, (i * m.B) / g] });
    uit.push({ key: `A-${i}`, zijde: 'A', i, a: [m.L, (i * m.B) / g], b: [m.L, ((i + 1) * m.B) / g] });
  }
  // Intergevels: een binnenwand op een spant, verdeeld zoals de gevel.
  for (const sp of intergevels(m, t)) for (let i = 0; i < g; i++) uit.push({ key: `I-${sp}-${i}`, zijde: 'I', sp, i, a: [sp * m.travee, (i * m.B) / g], b: [sp * m.travee, ((i + 1) * m.B) / g] });
  return uit;
}
export const ZIJDEN = { L: 'Linkerzijde', R: 'Rechterzijde', V: 'Voorgevel', A: 'Achtergevel', I: 'Intergevel', S: 'Zijwand' };

// ---------- Sailcloth tent ----------
// Middellijn (pieken) en omtrek: een rechthoek met halve cirkels aan de uiteinden (rond als lengte ≈ breedte).
export function sailPieken(m, t = {}) {
  const R = m.B / 2; const x0 = Math.min(R, m.L / 2); const x1 = Math.max(R, m.L - R); const lang = x1 - x0;
  const n = Number(t.pieken) > 0 ? Math.max(1, Math.min(4, Math.round(Number(t.pieken)))) : lang < 0.5 ? 1 : Math.max(2, Math.round(lang / (m.B * 0.75)) + 1);
  return n === 1 ? [[(x0 + x1) / 2, R]] : Array.from({ length: n }, (_, k) => [x0 + (lang * k) / (n - 1), R]);
}
export function sailOmtrek(m) {
  const R = m.B / 2; const x0 = Math.min(R, m.L / 2); const x1 = Math.max(R, m.L - R); const rx = Math.min(R, m.L / 2);
  const pts = []; const stap = (l) => Math.max(1, Math.round(l / PAAL_AFSTAND));
  // CCW: onderkant (+x), rechter halve cirkel, bovenkant (−x), linker halve cirkel; buitenkant rechts van de looprichting.
  const recht = (a, b) => { const n = stap(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i < n; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]); };
  const boog = (cx, a0) => { const n = stap(Math.PI * R); for (let i = 0; i < n; i++) { const a = a0 + (Math.PI * i) / n; pts.push([cx + rx * Math.cos(a), R + R * Math.sin(a)]); } };
  if (x1 - x0 > 0.01) recht([x0, 0], [x1, 0]);
  boog(x1, -Math.PI / 2);
  if (x1 - x0 > 0.01) recht([x1, m.B], [x0, m.B]);
  boog(x0, Math.PI / 2);
  pts.push(pts[0]);
  return pts;
}
// Hoogte van het zeildoek: hol naar elke piek, met een lagere rug tussen de pieken.
export function sailHoogte(m, t, x, y) {
  const pk = sailPieken(m, t); const R = m.B / 2; const H = m.nok - m.zijH;
  const x0 = pk[0][0]; const x1 = pk[pk.length - 1][0]; const cx = Math.max(x0, Math.min(x1, x)); const rho = Math.hypot(x - cx, y - R);
  const u = Math.min(1, rho / R); let f = 0.6 * (1 - u) ** 1.5;
  for (const p of pk) { const d = Math.min(1, Math.hypot(x - p[0], y - p[1]) / R); f = Math.max(f, (1 - d) ** 1.6); }
  return m.zijH + H * f;
}

// ---------- Stretchtent ----------
export function stretchMasten(m, t = {}) {
  const n = Number(t.mastN) > 0 ? Math.max(1, Math.min(8, Math.round(Number(t.mastN)))) : Math.max(1, Math.round(Math.max(m.L, m.B) / 7.5));
  const hs = t.mastHs || [];
  return Array.from({ length: n }, (_, k) => {
    const f = (k + 0.5) / n; const h = Number(hs[k]) > 0 ? Number(hs[k]) : m.nok;
    return m.L >= m.B ? { x: m.L * f, y: m.B / 2, h } : { x: m.L / 2, y: m.B * f, h };
  });
}
// Randpalen rondom (om de ± 3 m); geen palen aan een zijde die tot op de grond gaat.
export function stretchPalen(m, t = {}) {
  const uit = []; const rh = (z) => (Number(t.rand?.[z]) > 0 ? Number(t.rand[z]) : RAND_H);
  const zij = [['L', [0, 0], [m.L, 0]], ['A', [m.L, 0], [m.L, m.B]], ['R', [m.L, m.B], [0, m.B]], ['V', [0, m.B], [0, 0]]];
  for (const [z, a, b] of zij) {
    if (t.grond?.[z]) continue; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(l / PAAL_AFSTAND));
    for (let i = 0; i < n; i++) uit.push({ zijde: z, x: a[0] + ((b[0] - a[0]) * i) / n, y: a[1] + ((b[1] - a[1]) * i) / n, h: rh(z), n: [(b[1] - a[1]) / l, -(b[0] - a[0]) / l] });
  }
  return uit;
}
// Hoogte van het doek: de randen op hun hoogte (tot op de grond = 0,3 m), naar de masten toe opgetrokken.
export function stretchHoogte(m, t, x, y) {
  const rh = (z) => (t.grond?.[z] ? 0.3 : Number(t.rand?.[z]) > 0 ? Number(t.rand[z]) : RAND_H);
  const u = Math.max(0, Math.min(1, x / m.L)); const v = Math.max(0, Math.min(1, y / m.B));
  // Coons-vlak tussen de vier randen (hoeken = de laagste van de twee zijden).
  const hL = rh('L'); const hR = rh('R'); const hV = rh('V'); const hA = rh('A');
  const c00 = Math.min(hL, hV); const c10 = Math.min(hL, hA); const c01 = Math.min(hR, hV); const c11 = Math.min(hR, hA);
  const base = (1 - v) * hL + v * hR + (1 - u) * hV + u * hA - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c10 + (1 - u) * v * c01 + u * v * c11);
  // Masten trekken het doek op; meerdere masten vloeien zacht in elkaar over.
  let rest = 1; let hTop = base;
  for (const ms of stretchMasten(m, t)) {
    const dx = x - ms.x; const dy = y - ms.y; const dd = Math.hypot(dx, dy); hTop = Math.max(hTop, ms.h);
    if (dd < 1e-6) { rest = 0; continue; }
    const ux = dx / dd; const uy = dy / dd; const tx = ux > 1e-9 ? (m.L - ms.x) / ux : ux < -1e-9 ? -ms.x / ux : Infinity; const ty = uy > 1e-9 ? (m.B - ms.y) / uy : uy < -1e-9 ? -ms.y / uy : Infinity;
    const q = Math.min(1, dd / Math.min(tx, ty)); const f = ((ms.h - base) / Math.max(0.01, hTop - base)) * (1 - q) ** 1.5;
    rest *= 1 - Math.max(0, Math.min(1, f));
  }
  let z = base + (hTop - base) * (1 - rest);
  // Doek hangt licht door tussen de randpalen (enkel vlak bij de rand).
  const d = Math.min(y, m.B - y, x, m.L - x); if (d < 0.9) {
    const z0 = d === y ? 'L' : d === m.B - y ? 'R' : d === x ? 'V' : 'A';
    if (!t.grond?.[z0]) { const langs = z0 === 'L' || z0 === 'R' ? x : y; const lang = z0 === 'L' || z0 === 'R' ? m.L : m.B; const n = Math.max(1, Math.round(lang / PAAL_AFSTAND)); const f = (langs / (lang / n)) % 1; z -= 0.2 * Math.sin(Math.PI * f) * (1 - d / 0.9); }
  }
  return z;
}
// Hoogte van het dak boven een punt, voor elk type (wanden volgen dit bij stretch).
export const doekHoogte = (m, t, x, y) => (m.type === 'stretch' ? stretchHoogte(m, t, x, y) : m.type === 'sail' ? sailHoogte(m, t, x, y) : dakHoogte(m, x, y));
export const intergevels = (m, t = {}) => Object.keys(t.inter || {}).map(Number).filter((sp) => t.inter[sp] && sp > 0 && sp < m.n).sort((a, b) => a - b);
// Groep van een segment voor "over de hele zijde": L, R, V, A of één intergevel (I-<spant>).
export const segGroep = (key) => key.slice(0, key.lastIndexOf('-'));
export const TERRAS_H = 0.4;

// ---------- Signing frames: aaneensluitende frames als één lang kader met één banner ----------
// Het kader staat FRAME_UIT buiten de wand, van zijwandhoogte + FRAME_Z0 tot + FRAME_Z1; de banner zit er FRAME_RAND in.
export const FRAME_Z0 = -0.25; export const FRAME_Z1 = 0.95; export const FRAME_RAND = 0.05; export const FRAME_UIT = 0.08;
// Maat van de banner (het doek om te bestellen) in een kader van lengte len: een kleine inzet aan beide uiteinden.
export const bannerMaat = (len) => { const ins = Math.min(0.1, 0.02 * len); return { ins, l: Math.max(0, len - 2 * ins), h: FRAME_Z1 - FRAME_Z0 - 2 * FRAME_RAND }; };
// Sluit u aan op s (u begint waar s eindigt, in dezelfde richting)? Enkel dan loopt één banner door.
export const sluitAan = (s, u) => {
  if (Math.hypot(s.B[0] - u.A[0], s.B[1] - u.A[1]) > 0.4 || s.len < 0.1 || u.len < 0.1) return false;
  return ((s.B[0] - s.A[0]) * (u.B[0] - u.A[0]) + (s.B[1] - s.A[1]) * (u.B[1] - u.A[1])) / (s.len * u.len) > 0.995;
};
// Leden voor frameRuns: de tent zelf (met zijn eigen, mogelijk nog niet bewaarde velden.tent) en de tenten die er op het
// plan aan gekoppeld zijn (tentGroep). T zet een punt om naar het assenstelsel van de eerste tent.
export function frameLeden(it, el, groep = null, open = null) {
  const hoofd = { k: 0, t: it?.velden?.tent || {}, m: tentMaten(it, el), T: (q) => q, open: open || groep?.[0]?.open || new Set() };
  return [hoofd, ...(groep || []).slice(1).map((g, i) => ({ k: i + 1, t: g.it?.velden?.tent || {}, m: g.m || tentMaten(g.it, g.el), T: g.T, open: g.open || new Set() }))];
}
// Alle frames van de leden als doorlopende kaders (runs). Frames met dezelfde koppelId die echt op één lijn aansluiten
// vormen één run met één banner; sluit een koppel niet meer aan (tent verschoven), dan valt het uiteen in aparte runs.
// Geeft [{ koppel, delen, A, B, len, doek }], delen = [{ k, key, A, B, len, doek }] in leesrichting (buitenkant rechts van A → B).
export function frameRuns(leden) {
  const alle = [];
  for (const g of leden) {
    const t = g.t || {}; if (!t.frames) continue;
    for (const sg of tentSegmenten(g.m, t)) {
      if (sg.zijde === 'I' || !(sg.key in t.frames) || (g.open?.has(sg.key) && !t.wanden?.[sg.key])) continue;
      const A = g.T(sg.a); const B = g.T(sg.b);
      alle.push({ k: g.k, key: sg.key, A, B, len: Math.hypot(B[0] - A[0], B[1] - A[1]), doek: t.frames[sg.key] || '', koppel: t.frameKoppel?.[sg.key] || null });
    }
  }
  const run = (delen, koppel = null) => { const A = delen[0].A; const B = delen[delen.length - 1].B; return { koppel, delen, A, B, len: Math.hypot(B[0] - A[0], B[1] - A[1]), doek: delen.find((d) => d.doek)?.doek || '' }; };
  const uit = []; const perKoppel = new Map();
  for (const s of alle) { if (!s.koppel) uit.push(run([s])); else perKoppel.set(s.koppel, [...(perKoppel.get(s.koppel) || []), s]); }
  for (const [id, lijst] of perKoppel) {
    const rest = new Set(lijst);
    while (rest.size) {
      // Begin van een ketting: een deel waar geen ander deel op aansluit; dan telkens het volgende deel.
      const r = [...rest]; let s = r.find((x) => !r.some((y) => y !== x && sluitAan(y, x))) || r[0];
      const ketting = [s]; rest.delete(s);
      for (;;) { const v = [...rest].find((y) => sluitAan(s, y)); if (!v) break; ketting.push(v); rest.delete(v); s = v; }
      uit.push(run(ketting, id));
    }
  }
  return uit;
}
// De run waar een deel (lid k, segment key) in zit, en de runs die er links (ervoor) en rechts (erna) op aansluiten.
export const runVan = (runs, key, k = 0) => runs.find((r) => r.delen.some((d) => d.k === k && d.key === key)) || null;
export const runBuren = (runs, r) => (r ? { links: runs.find((q) => q !== r && sluitAan(q, r)) || null, rechts: runs.find((q) => q !== r && sluitAan(r, q)) || null } : { links: null, rechts: null });

// Hoogte van het dak boven punt (x, y) voor de gevelvorm (kader / boog: dwars op de lengte).
export function dakHoogte(m, x, y) {
  if (m.type === 'kader') return m.zijH + (m.nok - m.zijH) * (1 - Math.abs(y - m.B / 2) / (m.B / 2));
  // Booghal: vlakke cirkelboog (pijl ± 15 % van de breedte), niet half rond.
  if (m.type === 'boog') {
    // Booghal: vanaf de dakrand een flauwe, bijna rechte helling (± 21°) die bovenaan overgaat in een ruime boog,
    // zoals de gebogen gevel van een curve-tent. De hoogte schaalt mee met de nokhoogte.
    const half = m.B / 2; const a = 0.44 * half; const al = (21 * Math.PI) / 180; const R = a / Math.sin(al);
    const hRuw = (half - a) * Math.tan(al) + R * (1 - Math.cos(al)); const k = (m.nok - m.zijH) / hRuw; const d = Math.abs(y - half);
    const f = d >= a ? (half - d) * Math.tan(al) : (half - a) * Math.tan(al) + (Math.sqrt(Math.max(0, R * R - d * d)) - R * Math.cos(al));
    return m.zijH + f * k;
  }
  const xl = m.type === 'pagode' ? x - Math.min(m.n - 1, Math.floor(x / m.travee)) * m.travee : x; const lx = m.type === 'pagode' ? m.travee : m.L;
  const t = Math.max(Math.abs(xl - lx / 2) / (lx / 2), Math.abs(y - m.B / 2) / (m.B / 2));
  return m.zijH + (m.nok - m.zijH) * (1 - t);
}

// Materiaalstaat (benadering): segmenten per wandsoort, dakzeilen, staanders, oppervlakte.
// Met de groep (tentGroep) telt een signing frame dat over gekoppelde tenten doorloopt als één kader met één banner
// van de hele lengte (bij de tent waar het begint, zodat het niet dubbel telt).
export function tentTelling(it, el, open = new Set(), groep = null) {
  const m = tentMaten(it, el); const t = it?.velden?.tent || {}; const tel = new Map(); const bij = (n, k = 1) => tel.set(n, (tel.get(n) || 0) + k);
  const r2 = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
  bij(`${TENTTYPES.find((x) => x.k === m.type)?.naam || 'Tent'} ${r2(m.B)} × ${r2(m.L)} m (${r2(m.L * m.B)} m²)`);
  if (m.type === 'kader' || m.type === 'boog') { bij('Spant', m.n + 1); bij(`Dakzeil travee ${r2(m.travee)} m`, m.n); }
  if (m.type === 'kader' || m.type === 'boog') { const nv = ['V', 'A'].filter((z) => t.gevelVrij?.[z]).length; if (nv) bij('Gevelspant zonder tussenpalen (versterkt)', nv); }
  else if (m.type === 'stretch') { bij(`Mast ${r2(m.nok)} m`, stretchMasten(m, t).length); const pl = stretchPalen(m, t).length; bij('Randpaal', pl); bij('Spanband + grondanker', pl + stretchMasten(m, t).length * 2 + Object.values(t.grond || {}).filter(Boolean).length * Math.round(m.L / PAAL_AFSTAND)); }
  else if (m.type === 'sail') { bij(`Houten middenmast ${r2(m.nok)} m`, sailPieken(m, t).length); const n = sailOmtrek(m).length - 1; bij(`Houten zijpaal ${r2(m.zijH)} m`, n); bij('Scheerlijn + haring', n); }
  else if (m.type === 'pagode') { bij(`Pagode ${r2(m.travee)} × ${r2(m.B)} m`, m.n); bij('Staander', 2 * (m.n + 1)); if (m.n > 1) bij('Regengoot tussen pagodes', m.n - 1); }
  else bij('Staander', 4);
  for (const s of tentSegmenten(m, t)) {
    if (open.has(s.key) && !t.wanden?.[s.key]) { bij('Koppeling met regengoot'); continue; }
    for (const p of wandPanelen(m, t, s, s.zijde === 'I' ? 'wit' : standaardWandVan(m))) {
      if (p.w.k === 'open' || p.w.rol) continue; const nm = /^[A-Z]{3}/.test(p.w.naam) ? p.w.naam : p.w.naam[0].toLowerCase() + p.w.naam.slice(1);
      bij(m.type === 'stretch' || m.type === 'sail' ? `Wand ${nm} (${ZIJDEN[s.zijde].toLowerCase()})` : p.w.deur || p.w.rits ? `${p.w.naam} (${p.n} m)` : `Paneel ${nm} 1 m`);
    }
  }
  if (intergevels(m, t).length) bij('Intergevel', intergevels(m, t).length);
  for (const r of frameRuns(frameLeden(it, el, groep, open))) {
    if (r.delen[0].k !== 0) continue; // begint in een andere tent: telt daar
    const nt = new Set(r.delen.map((d) => d.k)).size; const bm = bannerMaat(r.len); const over = nt > 1 ? ` (over ${nt} tenten)` : '';
    bij(`Signing frame ${r2(r.len)} m${r.delen.length > 1 ? ` (${r.delen.length} delen gekoppeld)` : ''}${over}`); bij(`Banner ${r2(bm.l)} × ${r2(bm.h)} m${over}`);
  }
  if (Number(t.vloerH) > 0) bij(`Verhoogde vloer ${r2(Number(t.vloerH))} m (${r2(m.L * m.B)} m²)`);
  for (const [z, d] of Object.entries(t.terras || {})) if (Number(d) > 0) {
    const lang = z === 'L' || z === 'R' ? m.L : m.B; bij(`Terras ${ZIJDEN[z].toLowerCase()} ${r2(Number(d))} × ${r2(lang)} m (${r2(Number(d) * lang)} m²)`);
    bij('Leuning terras (m)', Math.round(lang + 2 * Number(d) - 1.5)); bij('Trap terras', 1);
  }
  for (const [z, d] of Object.entries(t.luifel || {})) if (Number(d) > 0) bij(`Luifel ${r2(Number(d))} m (${ZIJDEN[z].toLowerCase()})`);
  return [...tel.entries()].map(([naam, aantal]) => ({ naam, aantal }));
}

// ---------- Koppelen op het plan ----------
// Tenten die met een zijde tegen elkaar staan horen bij één groep. T zet een punt van een tent om naar het assenstelsel van de eerste.
const M_LAT = 110574; const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
function naarPlan(it, el) {
  const m = tentMaten(it, el); const p = it.parameters; const r = ((Number(p.rot) || 0) * Math.PI) / 180; const c = Math.cos(r); const s = Math.sin(r);
  return { m, mid: p.midden, c, s, naar: ([x, y]) => { const xc = x - m.L / 2; const yc = y - m.B / 2; return [xc * c + yc * s, -xc * s + yc * c]; }, van: ([E, N]) => [E * c - N * s + m.L / 2, E * s + N * c + m.B / 2] };
}
export function tentGroep(it, el, items = [], elementenMap = new Map()) {
  const hoofd = { it, el, T: (q) => q, open: new Set() };
  if (!it?.parameters?.midden || !items?.length) return [hoofd];
  const A = naarPlan(it, el); const lat = A.mid[1];
  const rel = (P) => (q) => { const [E, N] = P.naar(q); return A.van([E + (P.mid[0] - A.mid[0]) * mLng(lat), N + (P.mid[1] - A.mid[1]) * M_LAT]); };
  const kand = items.filter((x) => x && x.id !== it.id && !x.verborgen && x.parameters?.midden && isTentBouw(elementenMap.get(x.element_id))).map((x) => {
    const e = elementenMap.get(x.element_id); const P = naarPlan(x, e); return { it: x, el: e, T: rel(P), m: P.m, open: new Set() };
  });
  const groep = [{ ...hoofd, m: A.m }];
  const segsVan = (g) => tentSegmenten(g.m, g.it.velden?.tent || {}).filter((s) => s.zijde !== 'I').map((s) => ({ ...s, A: g.T(s.a), B: g.T(s.b) }));
  const raakt = (s, u) => {
    const dx = s.B[0] - s.A[0]; const dy = s.B[1] - s.A[1]; const l = Math.hypot(dx, dy); if (l < 0.1) return false;
    const ux = dx / l; const uy = dy / l; const afst = (p) => Math.abs((p[0] - s.A[0]) * uy - (p[1] - s.A[1]) * ux);
    if (afst(u.A) > 0.35 || afst(u.B) > 0.35) return false;
    const t1 = (u.A[0] - s.A[0]) * ux + (u.A[1] - s.A[1]) * uy; const t2 = (u.B[0] - s.A[0]) * ux + (u.B[1] - s.A[1]) * uy;
    return Math.min(l, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > 0.5;
  };
  // Breedte-eerst: elke tent die een zijde deelt met een tent in de groep komt erbij.
  for (let k = 0; k < groep.length && groep.length < 12; k++) {
    const g = groep[k]; const gs = segsVan(g);
    for (const c of kand) {
      if (c === g) continue;
      const cs = segsVan(c); let hit = false;
      if (g.m.type === 'stretch' || c.m.type === 'stretch' || g.m.type === 'sail' || c.m.type === 'sail') {
        // Stretch- en sailcloth tenten: gekoppeld als de vormen elkaar raken of overlappen (doeken over elkaar, gedeelde mast).
        const ka = [[0, 0], [g.m.L, 0], [g.m.L, g.m.B], [0, g.m.B]].map(g.T); const kb = [[0, 0], [c.m.L, 0], [c.m.L, c.m.B], [0, c.m.B]].map(c.T);
        const bx = (k) => [Math.min(...k.map((p) => p[0])), Math.min(...k.map((p) => p[1])), Math.max(...k.map((p) => p[0])), Math.max(...k.map((p) => p[1]))];
        const A1 = bx(ka); const B1 = bx(kb); hit = A1[0] <= B1[2] + 0.3 && B1[0] <= A1[2] + 0.3 && A1[1] <= B1[3] + 0.3 && B1[1] <= A1[3] + 0.3;
      } else for (const s of gs) for (const u of cs) if (raakt(s, u)) { g.open.add(s.key); c.open.add(u.key); hit = true; }
      if (hit && !groep.includes(c)) groep.push(c);
    }
  }
  return groep;
}

// ---------- Binnenplan: wanden van de tent ↔ deuren en ramen die binnen getekend zijn ----------
// Van tentmaten (x, y in m) naar lengte/breedte op de kaart en terug.
export function tentAssen(it, el) {
  const m = tentMaten(it, el); const p = it?.parameters || {}; if (!p.midden) return null;
  const r = ((Number(p.rot) || 0) * Math.PI) / 180; const c = Math.cos(r); const s = Math.sin(r); const ml = mLng(p.midden[1]);
  return {
    m,
    naarGeo: ([x, y]) => { const xc = x - m.L / 2; const yc = y - m.B / 2; return [p.midden[0] + (xc * c + yc * s) / ml, p.midden[1] + (-xc * s + yc * c) / M_LAT]; },
    vanGeo: ([lng, lat]) => { const E = (lng - p.midden[0]) * ml; const N = (lat - p.midden[1]) * M_LAT; return [E * c - N * s + m.L / 2, E * s + N * c + m.B / 2]; },
  };
}
// Openingen in de tentwanden (voor het binnenplan): deur = de deurbreedte in het midden, open = het hele segment,
// raam = een wand met ramen of uit glas / transparant.
export function tentOpeningen(it, el, open = new Set()) {
  const A = tentAssen(it, el); if (!A) return []; const { m } = A; const t = it.velden?.tent || {}; const uit = [];
  for (const sg of tentSegmenten(m, t)) {
    const gekop = open.has(sg.key) && !t.wanden?.[sg.key];
    const P = (f) => A.naarGeo([sg.a[0] + (sg.b[0] - sg.a[0]) * f, sg.a[1] + (sg.b[1] - sg.a[1]) * f]);
    if (gekop) { uit.push({ key: sg.key, soort: 'koppeling', a: P(0), b: P(1) }); continue; }
    for (const p of wandPanelen(m, t, sg, sg.zijde === 'I' ? 'wit' : standaardWandVan(m))) {
      const w = p.w; const d = (p.f1 - p.f0) * 0.05; const a = P(p.f0 + d); const b = P(p.f1 - d);
      if (w.k === 'open' || w.rol) uit.push({ key: sg.key, soort: 'open', a: P(p.f0), b: P(p.f1) });
      else if (w.deur || w.rits) uit.push({ key: sg.key, soort: w.nood ? 'nood' : 'deur', a, b, naam: w.naam });
      else if (w.glas || w.strook || w.raster || w.k === 'transparant') uit.push({ key: sg.key, soort: 'raam', a, b, naam: w.naam });
    }
  }
  return uit;
}
// Deuren en ramen uit het binnenplan van deze tent, op het dichtste wandsegment: { key, f (0–1 langs het segment), b, type, dubbel }.
export function binnenOpeningen(it, el, items = []) {
  const A = tentAssen(it, el); if (!A || !it?.id) return []; const segs = tentSegmenten(A.m, it.velden?.tent || {}); const uit = [];
  for (const x of items || []) {
    const mb = x?.velden?.meubel; if (x?.velden?.binnen?.host !== it.id || !mb || (mb.type !== 'deur' && mb.type !== 'raam')) continue;
    const ring = x.geometrie?.type === 'Polygon' ? x.geometrie.coordinates[0] : null; if (!ring?.length) continue;
    const n = ring.length - 1 || 1; const mid = [ring.slice(0, n).reduce((a, q) => a + q[0], 0) / n, ring.slice(0, n).reduce((a, q) => a + q[1], 0) / n];
    const [px, py] = A.vanGeo(mid); let best = null;
    for (const sg of segs) {
      const dx = sg.b[0] - sg.a[0]; const dy = sg.b[1] - sg.a[1]; const l2 = dx * dx + dy * dy; const f = Math.max(0, Math.min(1, ((px - sg.a[0]) * dx + (py - sg.a[1]) * dy) / l2));
      const d = Math.hypot(sg.a[0] + dx * f - px, sg.a[1] + dy * f - py); if (d < 0.75 && (!best || d < best.d)) best = { d, key: sg.key, f, len: Math.sqrt(l2) };
    }
    if (best) uit.push({ id: x.id, key: best.key, f: best.f, b: Math.min(best.len, Number(mb.b) || 0.9), type: mb.type, dubbel: !!mb.dubbel });
  }
  return uit;
}

// ---------- Uitbreiden vanuit de tentbouwer: een tent of terrasvloer tegen een zijde ----------
// Rechthoek tegen zijde z van de tent: 'langs' = maat langs die zijde, 'diep' = maat naar buiten.
// Geeft { midden, rot, breedte, diepte } in de assen van het plan (breedte langs de lengte van de tent, zoals een tentitem).
export function naastTent(it, el, z, langs, diep) {
  const A = tentAssen(it, el); if (!A) return null; const { m } = A; const rot = Number(it.parameters?.rot) || 0;
  if (z === 'L') return { midden: A.naarGeo([m.L / 2, -diep / 2]), rot, breedte: langs, diepte: diep };
  if (z === 'R') return { midden: A.naarGeo([m.L / 2, m.B + diep / 2]), rot, breedte: langs, diepte: diep };
  if (z === 'V') return { midden: A.naarGeo([-diep / 2, m.B / 2]), rot, breedte: diep, diepte: langs };
  return { midden: A.naarGeo([m.L + diep / 2, m.B / 2]), rot, breedte: diep, diepte: langs };
}
// Maten van een nieuwe tent tegen zijde z: langs de lange zijde even lang (in traveeën), tegen een gevel in het verlengde.
export function tentErnaast(it, el, el2, z) {
  const m = tentMaten(it, el); const t2 = tentTypeVan(el2); const travee = Number(el2?.breedte_m) || 5; const diep2 = Number(el2?.diepte_m) || 5;
  const modul = t2 === 'kader' || t2 === 'boog' || t2 === 'pagode';
  if (z === 'L' || z === 'R') { const L2 = modul ? Math.max(1, Math.round(m.L / travee)) * travee : travee; return { ...naastTent(it, el, z, L2, diep2), breedte: L2, diepte: diep2 }; }
  // Gevel: de nieuwe tent ligt in het verlengde (zijn lengte langs x), even breed als zijn eigen overspanning.
  const L2 = modul ? 2 * travee : travee; const n = naastTent(it, el, z, diep2, L2);
  return { ...n, breedte: L2, diepte: diep2 };
}

// ---------- Vloer leggen bij de tent (terras, podium, rijplaten): losse elementen, slepen en plaatsen ----------
// velden.tent.stukken = [{ id, el, x, y, rot: 0 | 90, h }]: midden in tent-lokale meters (x langs de lengte, y langs de breedte),
// h = hoogte van de vloer (podium). Elk stuk staat ook als echt item op het plan (velden.tentStuk { tent, stuk }) en telt mee in de stuklijst.
export const isVloerStuk = (e) => {
  if (!e || !(Number(e.breedte_m) > 0) || !(Number(e.diepte_m) > 0) || Number(e.breedte_m) > 12) return false;
  // Enkel de vloersystemen die we bij tenten gebruiken: zwaarlastvloer, vloercassettes en vlonders.
  return ['zwaarlastvloer', 'cassette', 'vlonder'].includes(e.eigenschappen?.materiaal);
};
export const stukMaat = (s, e) => (Number(s?.b) > 0 && Number(s?.d) > 0 ? { b: Number(s.b), d: Number(s.d) } : { b: Number(e?.breedte_m) || 2, d: Number(e?.diepte_m) || 1 });
export function stukOpPlan(it, el, s, e) {
  const A = tentAssen(it, el); if (!A) return null; const { b, d } = stukMaat(s, e);
  return { midden: A.naarGeo([Number(s.x) || 0, Number(s.y) || 0]), rot: Number(it.parameters?.rot) || 0, breedte: b, diepte: d };
}
// Kleur van een vloerstuk in de bouwer en in 3D.
export const stukKleur = (e) => { const x = e?.eigenschappen || {}; const mt = x.materiaal || ''; return e?.stijl?.vulkleur || x.kleur || (mt === 'vlonder' ? '#C9A26B' : mt === 'beton' ? '#B8B8B0' : mt === 'staal' ? '#8B9096' : mt === 'kunststof' ? '#3F3F46' : mt === 'cassette' ? '#6B7280' : mt === 'zwaarlastvloer' ? '#9CA3AF' : '#1F2937'); };
