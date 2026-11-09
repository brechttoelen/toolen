// Stellingbouwer (Gigant / Layher Allround): een constructie uit vakken van 2,07 × 2,07 m.
// Item (een stellinglijn): velden.stelling = {
//   vakken: { 'i,j': { soort: 'vloer'|'helling'|'trap'|'tribune', h, laag, r, doorgang } },
//   leuning: { 'i,j,k': 'buis'|'net'|'laag'|false }   per rand (k = 0 +x, 1 +y, 2 -x, 3 -y); true = buis
//   laag = lage leuning vooraan (camerastelling): de leuningen aan de zijkant lopen dan schuin af
//   doeken: [{ id, randen: ['i,j,k'], soort: 'leuning'|'zijkant', voor, achter }]
// }
// Per vak verder: grond (maaiveld onder het vak, m: treden van een dijk, verhoogde grond), ligger ('tralie' | 'staal'
// bij een vrije overspanning), portaal (hoogte van een portaal boven het dek, bv. voor een doek).
// Maten per kolom/rij zijn vrij (bv. een trapmodule van 1,57 m), standaard 2,07 m.
// Vak (i, j) ligt in het stelsel van de lijn: x langs de lijn, y links ervan, hoek (0, 0) = eerste punt.
// h = hoogte van het dek (bovenkant). Helling en trap: van `laag` naar `h`, stijgend in richting r.
// Staanders, liggers, leuningen, kantplanken, diagonalen en voetspindels volgen vanzelf.
//
// Standaardopbouw van een modulaire stelling (Allround / Gigant), van onder naar boven:
//   1. onderlegplank (kalvoet) op de grond, voetspindel met voetplaat (hoogte regelen, ± 0,1–0,5 m)
//   2. beginstuk (startring) op de spindel, daarop de staanders met rozetten om de 0,5 m
//   3. liggers tussen de staanders: een eerste laag net boven de grond (± 0,2 m), dan om de ± 2 m
//   4. verticale diagonalen in de buitenvelden (per verdieping om en om) voor de stabiliteit
//   5. U-liggers onder het dek, daarop de vloerdelen (2,07 × 1,04 m); horizontale diagonalen in grote dekken
//   6. aan open randen: leuning op 1 m, knieleuning op 0,5 m en een kantplank van 0,15 m
//   7. hellingen en trappen met trap- of hellingleuning; bij een doorgang blijven liggers en kruisen
//      onder het dek weg zodat je eronder kan lopen (vrije hoogte = dek − 0,15 m)

export const VAK = 2.072;
// Rozetten om de 0,5 m: dekken liggen op een rozet, een hellingdeel hangt van rozet naar rozet.
// Over één vak (2,07 m) stijgt een helling dus 0,5 m of 1 m: maar twee standaard hellingsgraden.
export const ROZET = 0.5;
// Het loopvlak ligt ± 0,2 m boven de rozet waarin zijn ligger hangt (U-ligger + plaat). Zo komen de leuningbuizen in de
// rozetten op ± 0,3 / 0,8 / 1,3 m boven de vloer (relinghoogte 1,30 m bij Gigant).
export const DEK_ROZET = 0.2;
// Hoogte boven het loopvlak die op een rozet valt (de rozetten lopen om de 0,5 m vanaf de rozet onder het dek).
export const opDekRozet = (z) => Math.max(ROZET - DEK_ROZET, Math.ceil((z + DEK_ROZET) / ROZET - 0.02) * ROZET - DEK_ROZET);
// Zwenkwiel onder een stelling (bv. een verrijdbare camerastelling): 200 mm met aluminium spindel en rem, 800 kg.
export const WIEL_NAAM = 'Zwenkwiel 200 mm met spindel en rem (800 kg)';
export const WIEL_H = 0.35;
// Lager dan dit (dek boven de grond) staat er geen staander met voet onder de plaat (voet van een helling).
export const GEEN_STAANDER = 0.4;
export const HELLINGEN = [
  { stap: 0.5, naam: '13,6°', uitleg: '0,5 m per vak · 24 %' },
  { stap: 1, naam: '25,8°', uitleg: '1 m per vak · 48 %' },
];
export const HALF = 1.036;
// Maten per kolom (i) en rij (j): standaard 2,07 m, een halve kolom of rij 1,04 m (st.maten = { x: { i: 1.036 }, y: { j: 1.036 } }).
// x(i) en y(j) geven de positie van de rand in meter, ook voor een deel van een vak (i = 3,5 = midden van kolom 3).
export function stellingMaten(st) {
  const mx = st?.maten?.x || {}; const my = st?.maten?.y || {};
  const bx = (i) => Number(mx[i]) || VAK; const by = (j) => Number(my[j]) || VAK;
  const pos = (b) => (t) => { const n = Math.floor(t); const f = t - n; let p = 0; if (n >= 0) for (let k = 0; k < n; k++) p += b(k); else for (let k = n; k < 0; k++) p -= b(k); return p + f * b(n); };
  return { bx, by, x: pos(bx), y: pos(by) };
}
export const opRozet = (h) => Math.round((Number(h) || 0) / ROZET) * ROZET;
// Hoogtes vrij per cm (de voetspindel regelt de rest).
export const opCm = (h) => Math.round((Number(h) || 0) * 100) / 100;
// Grond (maaiveld) onder een vak. Kleine verschillen (< 0,25 m) vangt de voetspindel op en tellen niet mee.
export const GROND_MIN = 0.25;
// Hellende grond onder een vak: v.grondS = { d, r } = de grond stijgt d m over het vak in richting r (0 +x, 1 +y, 2 -x, 3 -y).
// Zo staat een stelling op een talud: het dek blijft vlak, de staanders zijn aan de ene kant korter.
const helt = (v) => Number(v?.grondS?.d) > 0;
export const grondHoek = (v, u, w) => {
  // Gemeten grond (st.grondPunten → v.grondH op de vier hoeken): tussen de hoeken lineair.
  if (Array.isArray(v?.grondH)) { const [a, b, c, d] = v.grondH.map(Number); return a * (1 - u) * (1 - w) + b * u * (1 - w) + c * (1 - u) * w + d * u * w; }
  const g0 = helt(v) ? Number(v?.grond) || 0 : (Number(v?.grond) || 0) >= GROND_MIN ? Number(v.grond) : 0;
  if (!helt(v)) return g0;
  const r = Number(v.grondS.r) || 0; const t = r === 0 ? u : r === 1 ? w : r === 2 ? 1 - u : 1 - w;
  return g0 + Number(v.grondS.d) * t;
};
export const grondVan = (v) => Math.max(...HOEKEN_G.map(([u, w]) => grondHoek(v, u, w)));
const HOEKEN_G = [[0, 0], [1, 0], [1, 1], [0, 1]];
// Plaatkleur van het dek (zoals op de plannen van Gigant): bruin, rood, oranje.
// Metaal: stalen vloerdelen (geperforeerd, 0,32 m breed) die met haken in de U-liggers hangen.
export const PLATEN = [{ k: 'bruin', naam: 'Bruin', kleur: '#A0703F' }, { k: 'rood', naam: 'Rood', kleur: '#B5473A' }, { k: 'oranje', naam: 'Oranje', kleur: '#D9973B' }, { k: 'metaal', naam: 'Metaal', kleur: '#B7BEC5', metaal: true }];
export const METAAL_B = 0.32; // breedte van een stalen vloerdeel
// Een stalen vloerdeel hangt met zijn haken in de U-ligger: het loopvlak ligt ± 6 cm boven de rozet (hout: 0,2 m).
export const METAAL_OP = 0.06;
export const isMetaal = (v, st) => (v?.plaat || st?.plaat) === 'metaal';
// Aantal stalen vloerdelen naast elkaar in een vak van b m breed (2,07 → 6, 1,04 → 3).
export const metaalDelen = (b) => Math.max(1, Math.floor((b + 0.15) / METAAL_B));
// Trappen: renners (houten treden over het hele vak, stijging vrij) of voetgangers (metalen Gigant-trapmodule,
// 2,07 m breed, vaste lengte en stijging). Tussen twee voetgangerstrappen een doorloopbordes van 0,73 m.
export const TRAPMODULES = [
  { k: '1.03x0.33', l: 1.03, s: 0.33, naam: 'Opstap 1,03 × 0,33' },
  { k: '1.57x1.00', l: 1.57, s: 1.0, naam: 'Trap 1,57 × 1,00' },
  { k: '2.57x1.50', l: 2.57, s: 1.5, naam: 'Trap 2,57 × 1,50' },
  { k: '2.57x2.00', l: 2.57, s: 2.0, naam: 'Trap 2,57 × 2,00' },
];
export const BORDES = 0.73;
// Standaard vrije hoogte van een doorgang onder een vrije overspanning (doorrijhoogte voor de brandweer), tenzij anders ingegeven.
export const DOORGANG_H = 4.2;
// Waarvoor de doorgang dient (voor de brandweer en de hulpdiensten).
export const DOORGANG_FUNCTIES = [
  { k: 'wagens', naam: 'Wagens' }, { k: 'hulpdiensten', naam: 'Hulpdiensten' }, { k: 'tram', naam: 'Tram' }, { k: 'trein', naam: 'Trein' },
  { k: 'fietsers', naam: 'Fietsers' }, { k: 'voetgangers', naam: 'Voetgangers' }, { k: 'renners', naam: 'Renners (parcours)' }, { k: 'geen', naam: 'Geen doorgang (afgesloten)' },
];
export const functieNaam = (k) => DOORGANG_FUNCTIES.find((f) => f.k === k)?.naam || null;
// Opstaptrede (TRAPB 1,03 × 0,33) aan de voet van een voetgangerstrap: steekt ± 0,40 m voor het laagste bordes uit.
export const OPSTAP = 0.4;
export const trapModule = (v) => (v?.soort === 'trap' && v.trap === 'voetganger' ? TRAPMODULES.find((m) => m.k === v.module) || null : null);
export const AANLOOP = 1.0; // aanloopplaat aan de voet van een helling (van de onderlegplank naar de grond)
// Liggers voor een vrije overspanning (D = hoogte onder het dek).
export const LIGGERS = [
  { k: 'tralie', naam: 'Tralieligger', D: 0.3, uitleg: 'Tralieligger langs de buitenkant (2,07 tot 7,71 m)' },
  { k: 'rooster', naam: 'Roosterligger 0,19', D: 0.19, uitleg: 'Lage roosterligger onder het dek' },
  { k: 'ipe', naam: 'IPE 270-balk', D: 0.4, uitleg: 'Stalen overspanningsbalk onder elke staanderrij (bv. 6,21 m)' },
  { k: 'vakwerk', naam: 'Vakwerk (stelling)', D: 2, uitleg: 'Vakwerk van een volle verdieping uit liggers en schoren, de staanders hangen eraan (lange overspanning)' },
];
export const liggerSoort = (k) => (k === 'staal' ? 'rooster' : k);
// Niet te bouwen met standaardonderdelen: dek niet op een rozet, of een helling die niet 0,5 of 1 m per vak stijgt.
export function afwijking(v) {
  if (!v) return null;
  // De voetspindel (± 0,1–0,5 m) brengt het hele vak op hoogte: een dek hoeft dus niet op een rozet boven 0 te liggen.
  // Een helling hangt wel van rozet naar rozet: 0,5 of 1 m per vak.
  if (v.soort === 'helling') { const d = Math.abs((Number(v.h) || 0) - (Number(v.laag) || 0)); if (!HELLINGEN.some((x) => Math.abs(x.stap - d) < 0.02)) return 'Helling stijgt geen 0,5 of 1 m per vak'; return null; }
  if ((Number(v.h) || 0) < grondVan(v) - 0.001) return 'Dek lager dan de grond';
  return null;
}
// Gewone leuning (buis, ladder, hekje, camerastelling achteraan): twee rozetten boven het dek (0,3 en 0,8 m).
export const LEUNING_H = 0.8;
// Een ladder steekt ± 1 m boven het dek uit (om op en af te stappen).
export const LADDER_BOVEN = 1.0;
export const LADDER_VANAF = 2.0; // vanaf deze dekhoogte (en zonder trap) komt er vanzelf een ladder
export const LAAG_H = 0.3; // lage leuning vooraan een camerastelling (Gigant: 0,30 tot 0,50 m): de eerste rozet boven het dek
export const STELLING_H = 1.3; // stellingleuning van een rennersbrug (relinghoogte 1,30 m, drie buizen)
export const leuningHoogte = (soort) => (soort === 'stelling' ? STELLING_H : soort === 'laag' ? LAAG_H : LEUNING_H);
export const LEUNINGEN = [
  { k: 'buis', naam: 'Buisleuning', uitleg: 'Twee rozetten hoog: buizen op 0,3 en 0,8 m boven het dek' },
  { k: 'ladder', naam: 'Ladder', uitleg: 'Leuning met een ladder van de grond naar het dek (camera-toren)' },
  { k: 'stelling', naam: 'Stellingleuning 1,30', uitleg: 'Rennersbrug: drie stellingbuizen tot 1,30 m met kantplank' },
  { k: 'net', naam: 'Spijlenhekje', uitleg: 'Hekje met verticale spijlen als leuning (bv. tribune)' },
  { k: 'laag', naam: 'Laag vooraan', uitleg: 'Lage leuning (camera): de zijleuningen lopen schuin van hoog achteraan naar laag vooraan' },
  { k: 'geen', naam: 'Geen', uitleg: 'Geen leuning op deze rand' },
];
export const MIN_VAL = 0.5; // hoogteverschil vanaf waar een open rand een leuning krijgt
export const STAANDER_LENGTES = [4, 3, 2, 1, 0.5];
export const SOORTEN = [
  { k: 'vloer', naam: 'Vloer', kort: 'Vloer', kleur: '#CBB08A' },
  { k: 'helling', naam: 'Helling', kort: 'Helling', kleur: '#E2CFA9' },
  { k: 'trap', naam: 'Trap', kort: 'Trap', kleur: '#D6C3A0' },
  { k: 'bordes', naam: 'Bordes 0,73 m (tussen voetgangerstrappen)', kort: 'Bordes', kleur: '#B9C7C3' },
  { k: 'tribune', naam: 'Tribune (2 treden)', kort: 'Tribune', kleur: '#C9B48E' },
  { k: 'toren', naam: 'Toren (zonder dek)', kort: 'Toren', kleur: '#E5E7EB' },
  { k: 'trapblok', naam: 'Trapblok (losse houten treden op de grond)', kort: 'Trapblok', kleur: '#B08452' },
];
export const soortVan = (k) => SOORTEN.find((s) => s.k === k) || SOORTEN[0];
export const RICHTING = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// Tussenvloeren in een toren (v.vloeren = [rozethoogtes]): de liggers hangen in een rozet van de toren (0,3 / 0,8 /
// 1,3 …). Het loopvlak ligt daar net boven: een stalen vloerdeel ± 6 cm, een plaat op U-liggers 0,2 m (zoals een dek).
// Minstens 0,3 m boven de grond en 1 m onder de bovenste rozet (de leuning hangt in de twee rozetten erboven).
// Oudere waarden (loopvlak, bv. 1,5) schuiven naar de rozet eronder (1,3).
export const vloerRozet = (v, z) => { const t = (Number(v?.h) || 0) - DEK_ROZET; return Math.round((t - Math.round((t - Number(z)) / ROZET + 1e-6) * ROZET) * 100) / 100; };
export const vloerLoop = (v, st, z) => Math.round((z + (isMetaal(v, st) ? METAAL_OP : DEK_ROZET)) * 100) / 100;
export function vloerHoogtes(v) {
  const t = (Number(v?.h) || 0) - DEK_ROZET; const uit = [];
  for (let z = t - 1; z >= grondVan(v) + 0.3 - 1e-6; z -= ROZET) uit.unshift(Math.round(z * 100) / 100);
  return uit;
}
export function tussenVloeren(v) {
  if (v?.soort !== 'toren' || !Array.isArray(v.vloeren)) return [];
  const ok = new Set(vloerHoogtes(v));
  return [...new Set(v.vloeren.map((z) => vloerRozet(v, z)))].filter((z) => ok.has(z)).sort((a, b) => a - b);
}
// Zijden van een tussenvloer zonder vloer ernaast op dezelfde hoogte: daar komt een leuning.
export function tussenOpen(vakken, v, i, j, z) {
  if (v?.vloerLeuning === false) return [];
  const uit = [];
  for (let k = 0; k < 4; k++) {
    const nb = vakken?.[sleutel(i + RICHTING[k][0], j + RICHTING[k][1])];
    if (nb && (nb.soort === 'toren' ? tussenVloeren(nb).some((q) => Math.abs(q - z) < 0.01) : Math.abs((Number(nb.h) || 0) - DEK_ROZET - z) < 0.05)) continue;
    uit.push(k);
  }
  return uit;
}
export const isStellingEl = (el) => !!el?.eigenschappen?.stelling;
export const isStellingBouw = (it) => !!it?.velden?.stelling?.vakken && Object.keys(it.velden.stelling.vakken).length > 0;
export const sleutel = (i, j) => `${i},${j}`;
export const uitSleutel = (s) => s.split(',').map(Number);
const r3 = (v) => Math.round(v * 1000) / 1000;

// Hoogte van een vak op een punt (u, v in 0..1 binnen het vak).
export const KALVOET = 0.1;
export function hoogteOp(vak, u, v) {
  if (!vak) return 0;
  const h = Number(vak.h) || 0;
  if (vak.soort !== 'helling' && vak.soort !== 'trap' && vak.soort !== 'trapblok') return h;
  // De voet van een helling ligt op een onderlegplank (kalvoet): het dek komt daar niet lager dan 0,10 m boven
  // de grond, en de aanloopplaat loopt van daar schuin naar de grond.
  const laag0 = Number(vak.laag) || 0; const laag = vak.soort === 'helling' ? Math.max(laag0, grondVan(vak) + KALVOET) : laag0; const r = Number(vak.r) || 0;
  const t = r === 0 ? u : r === 1 ? v : r === 2 ? 1 - u : 1 - v;
  return laag + (h - laag) * t;
}
// Hoeken van een vak: [u, v] in de volgorde (0,0) (1,0) (1,1) (0,1).
export const HOEKEN = [[0, 0], [1, 0], [1, 1], [0, 1]];
// Rand k van een vak: de twee hoeken.
export const RAND = [[1, 2], [2, 3], [3, 0], [0, 1]];
const buur = (i, j, k) => [i + RICHTING[k][0], j + RICHTING[k][1]];
const tegen = (k) => (k + 2) % 4;

// Alles wat uit de vakken volgt.
// opt.verbonden: randen die aansluiten op een ander deel (knik): geen leuning, geen buitenrand.
// Hoogte van een zelf gekozen hoek (st.hoeken): laag 0,3 · midden 0,8 · hoog 1,3 m boven het dek.
export const HOEK_H = { midden: 0.8, hoog: 1.3 };
export function stellingAfgeleid(st, opt = {}) {
  const vakken = st?.vakken || {}; const handLeuning = st?.leuning || {}; const verbonden = opt.verbonden || new Set();
  const lijst = Object.entries(vakken).map(([s, v]) => { const [i, j] = uitSleutel(s); return { i, j, s, ...v, h: Number(v.h) || 0 }; });
  const bij = (i, j) => vakken[sleutel(i, j)];
  // Knooppunten (staanders): hoogste dek dat op die hoek rust.
  const knopen = new Map();
  for (const v of lijst) if (v.soort !== 'trapblok') HOEKEN.forEach(([u, w]) => {
    const k = sleutel(v.i + u, v.j + w); const hh = hoogteOp(v, u, w);
    const n = knopen.get(k) || { i: v.i + u, j: v.j + w, h: 0, g: 0, leuning: false, doorgang: true, vrij: true };
    // Voet van de staander: op de hoogste grond rond die hoek (de rand van een trede).
    n.h = Math.max(n.h, hh); n.g = Math.max(n.g, grondHoek(v, u, w)); n.schuin = (n.schuin ?? true) && (v.soort === 'helling' || v.soort === 'trap'); if (!v.doorgang) n.doorgang = false; if (!v.vrij) n.vrij = false; knopen.set(k, n);
  });
  // Zelf gekozen staanders (st.staanders, sleutel = hoek): true = toch een staander (bv. midden onder een overspanning),
  // false = weg (het dek rust daar op de liggers ernaast).
  for (const [k, w] of Object.entries(st.staanders || {})) { const n = knopen.get(k); if (!n) continue; if (w === true) { n.vrij = false; n.extra = true; } else if (w === false) { n.vrij = true; n.weg = true; } }
  // Randen: open (geen buur of buur lager) → leuning + kantplank als het dek hoog genoeg is.
  const randen = [];
  for (const v of lijst) for (let k = 0; k < 4; k++) {
    const [a, b] = RAND[k]; const ha = hoogteOp(v, ...HOEKEN[a]); const hb = hoogteOp(v, ...HOEKEN[b]);
    const [bi, bj] = buur(v.i, v.j, k); const nb0 = bij(bi, bj); const nb = nb0?.soort === 'toren' && v.soort !== 'toren' ? null : nb0;
    // Hoogteverschil per hoek met de buur (dezelfde plek, in het stelsel van de buur).
    const [dx, dy] = RICHTING[k];
    const verschil = (c) => { const [u, w] = HOEKEN[c]; return hoogteOp(v, u, w) - (nb ? hoogteOp(nb, u - dx, w - dy) : 0); };
    const val = Math.max(verschil(a), verschil(b));
    // Op- en afgang van een helling of trap (de lage kant en de hoge kant in de looprichting) blijft open.
    const ingang = (v.soort === 'helling' || v.soort === 'trap' || v.soort === 'trapblok') && (k === (Number(v.r) || 0) || k === tegen(Number(v.r) || 0));
    // Tussen twee tribunevakken (trede op trede) geen leuning.
    const tribune = v.soort === 'tribune' && nb?.soort === 'tribune';
    const s = `${v.i},${v.j},${k}`; const hand = handLeuning[s]; const vast = verbonden.has(s);
    // st.leuningVanaf: vanaf welke hoogte een open rand een leuning krijgt (camerastelling op 0,5 m: geen leuning).
    const minV = Number(st?.leuningVanaf) > 0 ? Number(st.leuningVanaf) : MIN_VAL;
    const auto = !vast && !ingang && !tribune && v.soort !== 'toren' && val >= minV && Math.max(ha, hb) >= minV;
    const leuning = hand == null ? auto : !!hand && hand !== 'geen';
    // 'frame' (leuningframe) bestaat niet meer: oude stellingen krijgen daar een gewone leuning (twee rozetten).
    const ls0 = !leuning ? null : typeof hand === 'string' && hand !== 'geen' ? hand : (st?.leuningStandaard || 'buis'); const lsoort = ls0 === 'frame' ? 'buis' : ls0;
    randen.push({ s, i: v.i, j: v.j, k, dgRicht: v.doorgang ? v.dgRicht || 'y' : (nb0?.doorgang ? nb0.dgRicht || 'y' : null), ha, hb, leuning: leuning && v.soort !== 'toren', lsoort, buiten: !nb0 && !vast, verbonden: vast, val, auto, doorgang: !!v.doorgang, vrij: !!v.vrij, soort: v.soort, voetganger: !!trapModule(v), binnen: !!nb0 && nb0.soort !== 'toren' && v.soort !== 'toren' && !vast });
  }
  // Hoek zonder leuning (st.hoeken[k] = 'geen'): geen staander boven het dek, de randen die hem raken blijven open.
  const geenHoek = new Set(Object.entries(st?.hoeken || {}).filter(([, v]) => v === 'geen').map(([k]) => k));
  if (geenHoek.size) for (const r of randen) if (r.leuning && RAND[r.k].some((c) => { const [u, w] = HOEKEN[c]; return geenHoek.has(sleutel(r.i + u, r.j + w)); })) { r.leuning = false; r.lsoort = null; }
  // Een dek hoger dan 1 m zonder trap, helling of trapblok krijgt vanzelf een ladder (st.geenLadder = uit):
  // op een rand met een volle leuning, bij voorkeur tegenover de lage camerakant.
  const toegang = lijst.some((v) => ['trap', 'helling', 'trapblok', 'bordes'].includes(v.soort));
  if (!st?.geenLadder && !toegang && !randen.some((r) => r.lsoort === 'ladder') && Math.max(0, ...lijst.filter((v) => v.soort !== 'toren').map((v) => v.h)) >= LADDER_VANAF - 0.001) {
    const laagK = randen.find((r) => r.lsoort === 'laag')?.k;
    const kand = randen.filter((r) => r.leuning && r.buiten && r.lsoort !== 'laag' && r.soort !== 'toren' && handLeuning[r.s] == null);
    const keuze = kand.find((r) => laagK != null && r.k === tegen(laagK)) || kand.find((r) => laagK == null || r.k !== laagK) || kand[0];
    if (keuze) { keuze.lsoort = 'ladder'; keuze.autoLadder = true; }
  }
  // Hoogte van de leuning aan elk uiteinde: een hoek die een lage leuning raakt is laag, zo lopen de zijkanten schuin.
  const laagHoek = new Set();
  for (const r of randen) if (r.lsoort === 'laag') for (const c of RAND[r.k]) { const [u, w] = HOEKEN[c]; laagHoek.add(sleutel(r.i + u, r.j + w)); }
  // Per hoek zelf gekozen (st.hoeken = { 'i,j': 'laag' | 'hoog' }): een korte staander (lage leuning) of een volle.
  // 'midden' = 0,8 m (twee rozetten, zoals een gewone leuning), 'hoog' = 1,3 m (stellingleuning).
  const handHoek = new Map();
  for (const [k, v] of Object.entries(st?.hoeken || {})) { if (v === 'laag') laagHoek.add(k); else if (HOEK_H[v]) { laagHoek.delete(k); handHoek.set(k, HOEK_H[v]); } }
  for (const r of randen) if (r.leuning) {
    const [a, b] = RAND[r.k]; const hg = (c) => { const [u, w] = HOEKEN[c]; const ks = sleutel(r.i + u, r.j + w); return laagHoek.has(ks) ? LAAG_H : handHoek.get(ks) || leuningHoogte(r.lsoort); };
    r.la = hg(a); r.lb = hg(b); r.schuin = Math.abs(r.la - r.lb) > 0.01;
    // Staander tot de bovenkant van de leuning (laag vooraan = korter).
    [[a, r.la], [b, r.lb]].forEach(([c, lh]) => { const [u, w] = HOEKEN[c]; const n = knopen.get(sleutel(r.i + u, r.j + w)); if (n) { n.lh = Math.max(n.lh || 0, opDekRozet(lh)); n.lt = Math.max(n.lt || 0, (c === a ? r.ha : r.hb) + opDekRozet(lh)); } }); // staander tot op een rozet
  }
  // Leuningbuizen hangen in de rozetten en lopen dus horizontaal: om de 0,5 m boven het dek, zo hoog als de
  // laagste van de twee staanders komt. Is één staander korter (lage leuning vooraan een camerastelling), dan komt
  // er een schuine legger (leuningdiagonaal) van de bovenste rozet van de hoge staander naar die van de lage.
  const opRoz = opDekRozet;
  for (const r of randen) if (r.leuning) {
    const [a, b] = RAND[r.k];
    const top = (c) => { const [u, w] = HOEKEN[c]; const n = knopen.get(sleutel(r.i + u, r.j + w)); return opRoz(n?.lh || leuningHoogte(r.lsoort)); };
    const ta = top(a); const tb = top(b); const t = Math.min(ta, tb);
    // Stellingleuning: drie buizen (0,3 / 0,8 / 1,3 m); gewone leuning: hand en knie (de twee bovenste rozetten).
    // Vanaf de eerste rozet van de staander boven het dek (ligt het dek niet op de reeks van de staander, bv. naast een
    // hogere toren, dan schuift de leuning mee naar de rozetten die er echt zijn).
    let z0 = ROZET - DEK_ROZET;
    if (Math.abs(r.ha - r.hb) < 0.01) { const n = [a, b].map((c) => knopen.get(sleutel(r.i + HOEKEN[c][0], r.j + HOEKEN[c][1]))).filter(Boolean).sort((x, y) => y.h - x.h)[0]; if (n) { const base = rozetVoet(n.g, n.h - DEK_ROZET); z0 = Math.round((base + Math.floor((r.ha + 0.05 - base) / ROZET + 1e-6) * ROZET + ROZET - r.ha) * 100) / 100; } }
    const alle = []; for (let z = z0; z <= t + (z0 - (ROZET - DEK_ROZET)) + 1e-6; z += ROZET) alle.push(Math.round(z * 100) / 100);
    // In elke rozet tot de laagste staander een horizontale legger (ook bij een gewone leuning).
    r.rails = alle;
    // Schuift de leuning op, dan komen de staanders mee tot de bovenste buis.
    if (alle.length && alle[alle.length - 1] > t + 0.01) for (const c of [a, b]) { const n = knopen.get(sleutel(r.i + HOEKEN[c][0], r.j + HOEKEN[c][1])); if (n) n.lt = Math.max(n.lt || 0, (c === a ? r.ha : r.hb) + alle[alle.length - 1]); }
    r.diag = Math.abs(ta - tb) > 0.01 ? [ta, tb] : null;
  }
  for (const r of randen) if (r.leuning) {
    for (const c of RAND[r.k]) { const [u, w] = HOEKEN[c]; const n = knopen.get(sleutel(r.i + u, r.j + w)); if (n) n.leuning = true; }
  }
  // Bovenkant van elke staander: tot de leuning van het dek waar die leuning op staat (niet bovenop een hogere
  // toren of buur op dezelfde hoek), anders tot de rozet onder het hoogste dek.
  for (const n of knopen.values()) n.top = Math.max(n.h - DEK_ROZET, n.leuning ? n.lt || n.h + (n.lh || LEUNING_H) : 0);
  // Vrije overspanning: geen staanders midden in de doorgang; aan de buitenkant draagt een tralieligger.
  const kn = [...knopen.values()].filter((n) => !n.vrij);
  // Ook boven een vrije overspanning staat er om de 2 m (op elke knoop) een leuningstaander op de ligger.
  const leuningPosten = [...knopen.values()].filter((n) => n.vrij && n.leuning);
  const spannen = [];
  const lijnen = new Map();
  for (const r of randen) if (r.vrij && r.buiten) { const key = `${r.k}|${r.k % 2 === 0 ? r.i : r.j}`; const l = lijnen.get(key) || []; l.push(r); lijnen.set(key, l); }
  for (const [key, l] of lijnen) {
    const k = Number(key.split('|')[0]); const pos = (r) => (k % 2 === 0 ? r.j : r.i);
    l.sort((a, b) => pos(a) - pos(b)); let cur = null;
    for (const r of l) { if (cur && pos(r) === cur.eind + 1) { cur.randen.push(r); cur.eind = pos(r); } else { cur = { k, randen: [r], begin: pos(r), eind: pos(r) }; spannen.push(cur); } }
  }
  // Hoogte van de ligger: zelf in te stellen (liggerH), anders stalen ligger 0,19 m, tralieligger 0,3 m
  // en boven 6,3 m overspanning een vakwerk over een hele stellingverdieping (± 2 m).
  const Mm = stellingMaten(st); const lijnD = new Map();
  // Doorgangen: aaneengesloten kolommen met een doorgang. Per doorgang een vrije breedte en hoogte (voor de brandweer).
  // Boven de vrije hoogte blijft de stelling staan; bij een vrije overspanning vult een vakwerk het stuk tot tegen het dek.
  const doorgangen = []; const dgVan = new Map();
  {
    // Richting: standaard loop je langs y (de kolommen i vormen de breedte); met dgRicht 'x' langs x (de rijen j
    // vormen de breedte), bv. de tweede arm van een hoekbrug. i0..i1 = de breedte (dwars), rijen = de looprichting.
    for (const richt of ['y', 'x']) {
      const dw = (v) => (richt === 'y' ? v.i : v.j); const lg = (v) => (richt === 'y' ? v.j : v.i);
      const dgV = lijst.filter((v) => v.doorgang && (v.dgRicht || 'y') === richt);
      const kol = [...new Set(dgV.map(dw))].sort((a, b) => a - b);
      // Aansluitende kolommen horen bij dezelfde doorgang, tenzij ze een andere maat of functie hebben (bv. weg naast spoor).
      const sleutelVan = (i) => { const v = dgV.find((x) => dw(x) === i) || {}; return `${v.vrijB || ''}|${v.vrijH || ''}|${v.vrijF || ''}`; };
      let run = null;
      for (const i of kol) { if (run && i === run.i1 + 1 && sleutelVan(i) === run.k) run.i1 = i; else { run = { i0: i, i1: i, k: sleutelVan(i), richt }; doorgangen.push(run); } }
      for (const d of doorgangen.filter((x) => x.richt === richt)) {
        d.vakken = dgV.filter((v) => dw(v) >= d.i0 && dw(v) <= d.i1);
        d.rijen = [...new Set(d.vakken.map(lg))].sort((a, b) => a - b);
        d.lengte = 0; for (let i = d.i0; i <= d.i1; i++) d.lengte += richt === 'y' ? Mm.bx(i) : Mm.by(i);
        d.diepte = d.rijen.reduce((a, j) => a + (richt === 'y' ? Mm.by(j) : Mm.bx(j)), 0);
      }
    }
    for (const d of doorgangen) {
      d.g = Math.max(0, ...d.vakken.map(grondVan)); d.vrij = d.vakken.some((v) => v.vrij);
      d.dek = Math.min(...d.vakken.map((v) => Math.min(...HOEKEN.map(([u, w]) => hoogteOp(v, u, w)))));
      const lh = d.vakken.map((v) => Number(v.liggerH)).find((x) => x > 0); const lk = d.vakken.map((v) => v.ligger).find(Boolean);
      const Dk = d.vrij ? (lh || (lk ? LIGGERS.find((x) => x.k === liggerSoort(lk))?.D : null)) : null;
      d.hMax = d.dek - d.g - (d.vrij ? Dk || LIGGERS[0].D : 0.15);
      const gevraagdH = d.vakken.map((v) => Number(v.vrijH)).find((x) => x > 0); const gevraagdB = d.vakken.map((v) => Number(v.vrijB)).find((x) => x > 0);
      d.bMax = Math.round((d.lengte - 0.05) * 100) / 100;
      d.H = Math.round((gevraagdH || d.hMax) * 100) / 100;
      d.B = gevraagdB || d.bMax; d.gevraagd = !!gevraagdH; d.functie = d.vakken.map((v) => v.vrijF).find(Boolean) || null;
      d.fout = d.H > d.hMax + 0.005 ? `Te hoog: max. ${d.hMax.toFixed(2).replace('.', ',')} m onder het dek` : d.B > d.bMax + 0.005 ? `Te breed: max. ${d.bMax.toFixed(2).replace('.', ',')} m tussen de staanders` : null;
      // Bij een vrije overspanning zonder vaste ligger (of met een gevraagde hoogte): het vakwerk vult van de vrije hoogte tot het dek.
      d.vulD = d.vrij && (Dk == null || (gevraagdH && lk !== 'ipe' && lk !== 'rooster' && lk !== 'staal')) ? Math.max(0.3, d.dek - 0.05 - d.g - Math.min(d.H, d.hMax)) : null;
      for (const v of d.vakken) dgVan.set(sleutel(v.i, v.j), d);
    }
  }
  for (const sp of spannen) {
    sp.lengte = sp.randen.reduce((a, r) => a + (r.k % 2 === 0 ? Mm.by(r.j) : Mm.bx(r.i)), 0);
    const gekozen = sp.randen.map((r) => bij(r.i, r.j)?.ligger).find(Boolean);
    sp.ligger = gekozen ? liggerSoort(gekozen) : sp.lengte > 7.8 ? 'vakwerk' : 'tralie';
    const eigen = sp.randen.map((r) => Number(bij(r.i, r.j)?.liggerH)).find((x) => x > 0);
    sp.D = eigen || LIGGERS.find((x) => x.k === sp.ligger)?.D || 0.3;
    const dg = dgVan.get(sleutel(sp.randen[0].i, sp.randen[0].j));
    if (dg?.vulD) { sp.D = dg.vulD; if (sp.D > 1.2 && sp.ligger !== 'ipe' && sp.ligger !== 'rooster') sp.ligger = 'vakwerk'; }
    // Aantal rijen in de overspanning (voor een balk onder elke staanderrij).
    sp.rijen = sp.k % 2 ? new Set(lijst.filter((v) => v.vrij && v.i === sp.randen[0].i).map((v) => v.j)).size : new Set(lijst.filter((v) => v.vrij && v.j === sp.randen[0].j).map((v) => v.i)).size;
    // Een ligger langs x (rand 1/3) draagt de vakken van die kolom, een ligger langs y (rand 0/2) die van die rij.
    for (const r of sp.randen) { const key = r.k % 2 ? `x${r.i}` : `y${r.j}`; lijnD.set(key, Math.max(lijnD.get(key) || 0, sp.D)); }
  }
  // Vrije hoogte onder een vak van een overspanning: tot de onderkant van de ligger (ook voor de vakken in het midden).
  const liggerD = (v) => Math.max(lijnD.get(`x${v.i}`) || 0, lijnD.get(`y${v.j}`) || 0) || 0.3;
  // Aanloopplaat: de lage kant van een helling die op de grond uitkomt en nergens op aansluit.
  const aanloop = [];
  // st.aanloop = lengte van de aanloopplaat (standaard 1,75 m, 0 = geen); st.uitloop = plaat aan de voet van een rennerstrap (standaard geen).
  const lAan = st?.aanloop != null ? Number(st.aanloop) || 0 : AANLOOP; const lUit = Number(st?.uitloop) || 0;
  for (const v of lijst) if (v.soort === 'helling' || (v.soort === 'trap' && !trapModule(v))) {
    const L = v.soort === 'helling' ? lAan : lUit; if (L <= 0) continue;
    const k = tegen(Number(v.r) || 0); const [bi, bj] = buur(v.i, v.j, k);
    if (!bij(bi, bj) && (Number(v.laag) || 0) - grondVan(v) < 0.3 && !verbonden.has(`${v.i},${v.j},${k}`)) aanloop.push({ i: v.i, j: v.j, k, z: v.soort === 'helling' ? Math.max(Number(v.laag) || 0, grondVan(v) + KALVOET) : Number(v.laag) || 0, g: grondVan(v), L, trap: v.soort === 'trap' });
  }
  // Opstap: een laag bordes/dek (tot 0,45 m) aan het einde van een voetgangerstrap, zonder buur aan de buitenkant.
  const opstap = [];
  for (const v of lijst) if ((v.soort === 'bordes' || v.soort === 'vloer') && v.h > 0.1 && v.h <= 0.45) for (let k = 0; k < 4; k++) {
    const voor = bij(...buur(v.i, v.j, tegen(k))); if (!voor || !trapModule(voor) || bij(...buur(v.i, v.j, k))) continue;
    opstap.push({ i: v.i, j: v.j, k, z: v.h, g: grondVan(v) });
  }
  // Portaal boven het dek: staanders op de buitenhoeken, liggers en kruisen langs de buitenranden en bovenop.
  const portaal = { vakken: lijst.filter((v) => Number(v.portaal) > 0), randen: [], knopen: new Map() };
  for (const v of portaal.vakken) for (let k = 0; k < 4; k++) {
    const nb = bij(...buur(v.i, v.j, k)); if (nb && Number(nb.portaal) > 0) continue;
    // Doorloop: aan deze zijde gaat het dek verder (een trap, bordes of helling): daar enkel de bovenste ligger,
    // geen schoor of tussenligger op hoofdhoogte.
    const T = v.h + Number(v.portaal); portaal.randen.push({ i: v.i, j: v.j, k, h: v.h, T, door: !!nb && nb.soort !== 'toren' });
    for (const c of RAND[k]) { const [u, w] = HOEKEN[c]; const s = sleutel(v.i + u, v.j + w); const p = portaal.knopen.get(s) || { i: v.i + u, j: v.j + w, h: v.h, T }; p.T = Math.max(p.T, T); portaal.knopen.set(s, p); }
  }
  // Kiesbaar: buitenranden, randen met een leuning en de naad tussen twee vakken (één keer, aan de +x/+y-kant,
  // tenzij de leuning aan de andere kant staat): daar kan een leuning tussen twee vloerdelen.
  const metL = new Set(randen.filter((r) => r.leuning).map((r) => r.s));
  for (const r of randen) {
    const tw = `${r.i + RICHTING[r.k][0]},${r.j + RICHTING[r.k][1]},${tegen(r.k)}`; r.tweeling = r.binnen ? tw : null;
    r.kiesbaar = r.buiten || r.leuning || (r.binnen && r.soort !== 'trapblok' && (r.k < 2 ? !metL.has(tw) : false));
  }
  const grondOp = (i, j) => knopen.get(sleutel(i, j))?.g || 0;
  // Dekken die niet in de rozetten van hun staanders hangen (de staander krijgt zijn reeks van het hoogste dek of de
  // toren op die hoek): met een voorstel voor de dichtste hoogte erboven die wel past.
  const scheef = [];
  for (const v of lijst) {
    if (['toren', 'helling', 'trap', 'trapblok'].includes(v.soort)) continue;
    const lig = v.h - DEK_ROZET;
    for (const [u, w] of HOEKEN) {
      const n = knopen.get(sleutel(v.i + u, v.j + w)); if (!n || n.h <= v.h + 0.01) continue;
      const base = rozetVoet(n.g, n.h - DEK_ROZET); const f = (lig - base) / ROZET;
      if (Math.abs(f - Math.round(f)) > 0.02) { scheef.push({ s: v.s, h: v.h, voorstel: Math.round((base + Math.ceil(f) * ROZET + DEK_ROZET) * 100) / 100 }); break; }
    }
  }
  return { scheef, lijst, knopen: kn, alleKnopen: [...knopen.values()], leuningPosten, randen, spannen, aanloop, opstap, portaal, grondOp, liggerD, doorgangen, dgVan: (i, j) => dgVan.get(sleutel(i, j)) || null };
}

// ---------- Verbanden (zoals op de plannen van Gigant) ----------
// Schoren (verticale diagonalen) aan de buitenkant: aan de kopse kanten altijd, langs de lange zijden om het
// andere vak; enkel waar de stelling hoger is dan 1,2 m (lager houden de liggers en spindels het).
// Schoren (verticale diagonalen) aan de buitenkant, in elk vak, zoals op de plannen van Gigant; enkel waar de
// stelling hoger is dan 1,2 m (lager houden de liggers en spindels het).
// Een rand tussen een doorgang en een gewoon vak (de toren naast de doorgang) is een wand: die krijgt liggers en
// schoren vanaf de grond, ook al is het geen buitenrand. Open blijft enkel een rand waar je door de doorgang loopt.
export function doorgangWand(vakken, r) {
  const nb = vakken?.[sleutel(r.i + RICHTING[r.k][0], r.j + RICHTING[r.k][1])];
  return !!nb && !!r.doorgang !== !!nb.doorgang;
}
// Een doorgang loopt dwars door de brug (langs y: de kolommen i vormen de breedte). Je loopt of rijdt dus door de
// randen langs x (k oneven): die blijven open. De randen langs y (k even), tussen de staanders in de looprichting,
// krijgen gewoon hun liggers vanaf de eerste rozet (anders staan de staanders in de doorgang los tot aan het dek).
// Met dgRicht 'x' (zelf gedraaid) loop je langs x: dan zijn de randen langs y (k even) open.
export function doorgangOpen(r) {
  return (r.dgRicht || 'y') === 'x' ? r.k % 2 === 0 : r.k % 2 === 1;
}
// Twee vakken delen een rand: één tekent de liggers en schoren (het hoogste), het lagere enkel zijn dekligger.
// Geeft per rand-lijn { hoofd, tw }: tw = het andere (lagere) vak, of null.
export const paarSleutel = (r) => { const [a, b] = RAND[r.k]; return [HOEKEN[a], HOEKEN[b]].map(([u, w]) => `${r.i + u},${r.j + w}`).sort().join('|'); };
export function randParen(randen) {
  const m = new Map();
  for (const r of randen) {
    const k = paarSleutel(r); const x = m.get(k);
    if (!x) m.set(k, { hoofd: r, tw: null });
    else if (Math.min(r.ha, r.hb) > Math.min(x.hoofd.ha, x.hoofd.hb) + 0.001) { x.tw = x.hoofd; x.hoofd = r; } else x.tw = r;
  }
  return m;
}
// Hoogte vanaf waar een wand naast een lager vak schoren krijgt (null = geen wand): het dek van de lagere buur.
export function wandBoven(paar) {
  const { hoofd: r, tw } = paar || {}; if (!r || r.buiten || !tw || r.soort === 'trapblok') return null;
  if (r.doorgang || tw.doorgang) return null;
  const onder = tw.soort === 'toren' || tw.soort === 'trapblok' ? 0 : Math.max(tw.ha, tw.hb);
  return Math.min(r.ha, r.hb) - onder > 1.2 ? onder : null;
}
// ---------- Liggers en schoren per wand (zelf aan te passen) ----------
// st.liggers[rand] = [z, …]: de horizontale liggers van die wand op zelf gekozen rozetten (absolute hoogte);
// st.schoren[rand] = false (weg) | true (altijd) | 'onder' (enkel de onderste). rand = de rand van het hoogste vak.
// Maten van een wand: nulpunt van de rozetten (g0), rozet van de dekligger (ra/rb) en de hoogste rozet eronder (hm).
export function wandMaten(r, grondOp) {
  const [a, b] = RAND[r.k]; const g = Math.max(...[HOEKEN[a], HOEKEN[b]].map(([u, w]) => grondOp(r.i + u, r.j + w)));
  const ra = r.ha - DEK_ROZET; const rb = r.hb - DEK_ROZET; const g0 = rozetVoet(g, Math.min(r.ha, r.hb) - DEK_ROZET);
  const hm = g0 + Math.floor((Math.min(ra, rb) - g0) / ROZET + 1e-6) * ROZET;
  return { g, g0, ra, rb, hm };
}
// Rozetten waar een tussenligger kan hangen (boven de eerste rozet, onder de dekligger).
export function wandRozetten(m) { const uit = []; for (let z = m.g0 + ROZET; z < m.hm - 0.05; z += ROZET) uit.push(Math.round(z * 100) / 100); return uit; }
// Rozetten van een tussenvloer langs deze wand (in het vak zelf of in het torenvak ernaast): daar hangt altijd een ligger
// (de drager van de vloer); die hoort bij de wand en is niet weg te halen.
export function wandVloeren(st, r) {
  const v1 = st?.vakken?.[sleutel(r.i, r.j)]; const v2 = st?.vakken?.[sleutel(r.i + RICHTING[r.k][0], r.j + RICHTING[r.k][1])];
  return [...new Set([...tussenVloeren(v1), ...tussenVloeren(v2)])];
}
// Leuning van een tussenvloer langs deze wand: de buizen in de twee rozetten boven de vloer zijn liggers van de wand.
export function wandVloerLeuning(st, r) {
  const i2 = r.i + RICHTING[r.k][0]; const j2 = r.j + RICHTING[r.k][1];
  const v1 = st?.vakken?.[sleutel(r.i, r.j)]; const v2 = st?.vakken?.[sleutel(i2, j2)]; const uit = new Set();
  for (const [v, i, j, k] of [[v1, r.i, r.j, r.k], [v2, i2, j2, (r.k + 2) % 4]]) for (const z of tussenVloeren(v)) if (tussenOpen(st.vakken, v, i, j, z).includes(k)) { uit.add(Math.round((z + ROZET) * 100) / 100); uit.add(Math.round((z + 2 * ROZET) * 100) / 100); }
  return [...uit];
}
export function wandLiggers(st, r, m) {
  const c = st?.liggers?.[r.s]; const vast = [...wandVloeren(st, r), ...wandVloerLeuning(st, r)];
  const basis = Array.isArray(c) ? c.map((z) => Math.round(Number(z) * 100) / 100) : liggerHoogtes(m.g0, m.ra, m.rb).map((z) => Math.round(z * 100) / 100);
  return [...new Set([...basis, ...vast])].filter((z) => z > m.g0 + 0.1 && z < m.hm - 0.05).sort((x, y) => x - y);
}
// Schoren van een wand: van ligger naar ligger, vanaf `start` tot de dekligger (stukken korter dan 0,4 m niet).
export function schoorStukken(niveaus, start, hm, modus) {
  const pts = [...new Set([start, ...niveaus.filter((z) => z > start + 0.01 && z < hm - 0.01), hm].map((z) => Math.round(z * 100) / 100))].sort((x, y) => x - y);
  const uit = []; for (let k = 0; k < pts.length - 1; k++) if (pts[k + 1] - pts[k] >= 0.4 - 1e-6) uit.push([pts[k], pts[k + 1]]);
  return modus === 'onder' ? uit.slice(0, 1) : uit;
}
// Vanaf waar de schoren van een wand beginnen (null = geen schoren).
export function schoorStart(st, r, paar, m, wand) {
  const hand = st?.schoren?.[r.s]; if (hand === false) return null;
  const rozOp = (z) => m.g0 + Math.round((z - m.g0) / ROZET) * ROZET;
  const auto = schoorOpRand(wand ? { ...r, buiten: true } : r, Math.min(r.ha, r.hb) - m.g0) ? m.g0 : wandBoven(paar) != null ? rozOp(wandBoven(paar) - DEK_ROZET) - ROZET : null;
  const z = hand === true || hand === 'onder' ? (auto ?? m.g0) : auto;
  // Nooit onder de eerste rozet boven de voetspindel (anders steekt de schoor de grond in).
  return z == null ? null : Math.round(Math.max(z + ROZET, m.g0 + ROZET) * 100) / 100;
}
export function schoorOpRand(r, hoogte) {
  return !!r.buiten && hoogte > 1.2;
}
// Horizontale liggers tussen twee staanders (zonder de ligger onder het dek): in de eerste rozet (0,5 m) en dan om de
// 2 m; onder een helling (de dekligger loopt schuin) ook één op de hoogte van het lage einde, net onder het dek.
// De rozetten liggen om de 0,5 m en het dek ligt op een rozet; de spindel onderaan vangt het verschil met de grond
// op. rozetVoet geeft het (denkbeeldige) nulpunt van die reeks: de eerste rozet zit 0,5 m hoger, minstens 0,25 m boven de grond.
export function rozetVoet(g, h) {
  return h - Math.ceil((h - g - 0.25) / ROZET - 1e-6) * ROZET;
}
export function liggerHoogtes(g0, ha, hb) {
  const onder = (z) => g0 + Math.floor((z - g0) / ROZET + 1e-6) * ROZET;
  const hm = onder(Math.min(ha, hb)); const uit = [];
  for (let z = g0 + ROZET; z < hm - 0.4; z += 2) uit.push(z);
  if (Math.abs(ha - hb) > 0.01 && hm - (uit.length ? uit[uit.length - 1] : g0) > 0.4) uit.push(hm);
  return uit;
}
// Horizontale diagonalen in het vlak van de onderste liggers (0,5 m): in ± 1 op 4 vakken die hoger zijn dan 1,2 m,
// zodat de stelling ook in het grondvlak niet kan scheefgetrokken worden.
export function horizontaleDiagonalen(lijst) {
  const hoog = lijst.filter((v) => v.soort !== 'trapblok' && v.soort !== 'toren' && !v.doorgang && Number(v.h) - grondVan(v) > 1.2).sort((a, b) => a.i - b.i || a.j - b.j);
  return hoog.filter((_, k) => k % 4 === 0);
}

// ---------- Delen (een brug met een knik) ----------
// st.delen = [{ id, naam, vakken, maten, leuning, doeken, aan: { deel, hoek } }]: elk deel heeft zijn eigen raster
// en sluit aan op het einde (+x) van het deel `aan.deel` ('0' = het hoofddeel), gedraaid over `hoek` graden
// (positief = naar links). Het draaipunt is de binnenhoek van de knik; de wig ertussen is een passtuk.
export function delenVan(st) {
  const uit = [{ id: '0', naam: st?.naam || 'Deel 1', d: st || {}, ox: 0, oy: 0, a: 0 }];
  const T = (p, [x, y]) => [p.ox + x * Math.cos(p.a) - y * Math.sin(p.a), p.oy + x * Math.sin(p.a) + y * Math.cos(p.a)];
  for (const c of st?.delen || []) {
    const p = uit.find((x) => x.id === (c.aan?.deel || '0')); if (!p) continue;
    // Het dek bepaalt de knik, niet de steuntorens ernaast.
    const Mp = stellingMaten(p.d); const Kp = stellingKader(p.d, true); if (Kp.leeg) continue;
    const hoek = Number(c.aan?.hoek) || 0; const rechts = hoek < 0;
    const Mc = stellingMaten(c); const Kc = stellingKader(c, true);
    const jp = rechts ? Kp.j0 : Kp.j1; const jc = Kc.leeg ? jp : (rechts ? Kc.j0 : Kc.j1);
    const pivot = T(p, [Mp.x(Kp.i1), Mp.y(jp)]); const a = p.a + (hoek * Math.PI) / 180;
    const off = [-Mc.y(jc) * Math.sin(a), Mc.y(jc) * Math.cos(a)];
    // aan.schuif = [langs, opzij] in m, in het stelsel van dit deel: een passtuk van die lengte tussen de delen (zoals op de werktekening).
    const [sx, sy] = (c.aan?.schuif || [0, 0]).map(Number);
    const d = { id: c.id, naam: c.naam || `Deel ${uit.length + 1}`, d: { leuningStandaard: st.leuningStandaard, ...c }, ox: pivot[0] - off[0] + (sx || 0) * Math.cos(a) - (sy || 0) * Math.sin(a), oy: pivot[1] - off[1] + (sx || 0) * Math.sin(a) + (sy || 0) * Math.cos(a), a, ouder: p.id, hoek, pivot };
    // Wig (passtuk): draaipunt, de andere hoek van het einde van het ouderdeel en van het begin van dit deel.
    const andereP = T(p, [Mp.x(Kp.i1), Mp.y(rechts ? Kp.j1 : Kp.j0)]);
    const jc2 = Kc.leeg ? (rechts ? Kp.j1 : Kp.j0) : (rechts ? Kc.j1 : Kc.j0); const andereC = T(d, [0, Mc.y(jc2)]);
    let hEind = 0; for (const [s2, v] of Object.entries(p.d.vakken || {})) { const [i] = uitSleutel(s2); if (i === Kp.i1 - 1) hEind = Math.max(hEind, hoogteOp(v, 1, 0)); }
    const beginC = T(d, [0, Mc.y(jc)]);
    const vierkant = Math.hypot(beginC[0] - pivot[0], beginC[1] - pivot[1]) > 0.02;
    d.wig = { punten: vierkant ? [pivot, andereP, andereC, beginC] : [pivot, andereP, andereC], h: hEind, breedte: Mp.y(Kp.j1) - Mp.y(Kp.j0) };
    // Open randen van het passtuk (de buitenbocht en, bij een passtuk, de binnenkant) krijgen de leuning van de brug.
    d.wig.randen = [[andereP, andereC], ...(vierkant ? [[beginC, pivot]] : [])].filter(([p1, p2]) => Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 0.05);
    d.wig.lsoort = st.leuningStandaard || 'buis';
    uit.push(d);
  }
  // Aansluitende randen: het einde van een ouder en het begin van een kind.
  for (const d of uit) {
    d.verbonden = new Set(); const K = stellingKader(d.d);
    if (d.ouder) for (const [s2] of Object.entries(d.d.vakken || {})) { const [i, j] = uitSleutel(s2); if (i === 0) d.verbonden.add(`${i},${j},2`); }
    if (uit.some((x) => x.ouder === d.id)) for (const [s2] of Object.entries(d.d.vakken || {})) { const [i, j] = uitSleutel(s2); if (i === K.i1 - 1) d.verbonden.add(`${i},${j},0`); }
  }
  for (const d of uit) d.T = (q) => T(d, q);
  return uit;
}

// Alle doorgangen van de constructie (alle delen): [{ deel, nr, B, H, fout }] voor het zijpaneel en de deellink.
export function stellingDoorgangen(st) {
  const uit = [];
  for (const d of delenVan(st)) for (const g of stellingAfgeleid(d.d, { verbonden: d.verbonden }).doorgangen) uit.push({ deel: d.naam, nr: uit.length + 1, B: g.B, H: g.H, fout: g.fout, functie: g.functie });
  return uit;
}

// Staander van lengte L opdelen in standaardlengtes.
export function opdelen(L) {
  const uit = []; let rest = Math.round(L * 100) / 100;
  for (const l of STAANDER_LENGTES) while (rest >= l - 0.05) { uit.push(l); rest = Math.round((rest - l) * 100) / 100; }
  if (rest > 0.05) uit.push(STAANDER_LENGTES[STAANDER_LENGTES.length - 1]);
  return uit;
}

// De stuklijst komt uit de scène zelf (stelling/scene.js: stellingStuklijst): wat getekend wordt, wordt besteld.

// Ankerstelsel van de lijn (pts in meter, zoals wandPunten).
export function stellingAnker(pts) {
  const o = pts[0] || [0, 0]; const q = pts[1] || [o[0] + 1, o[1]]; const a0 = Math.atan2(q[1] - o[1], q[0] - o[0]);
  return { o, a0, naarWereld: ([x, y]) => [o[0] + x * Math.cos(a0) - y * Math.sin(a0), o[1] + x * Math.sin(a0) + y * Math.cos(a0)] };
}

// Kader van de vakken (in vakken).
export function stellingKader(st, zonderTorens = false) {
  const ks = Object.entries(st?.vakken || {}).filter(([, v]) => !zonderTorens || v.soort !== 'toren').map(([s2]) => uitSleutel(s2));
  if (!ks.length) return { i0: 0, j0: 0, i1: 0, j1: 0, leeg: true };
  return { i0: Math.min(...ks.map((k) => k[0])), j0: Math.min(...ks.map((k) => k[1])), i1: Math.max(...ks.map((k) => k[0])) + 1, j1: Math.max(...ks.map((k) => k[1])) + 1 };
}

// Rennersbrug als vertrekpunt: aanloop – helling – doorgang – helling – aanloop.
// Dekhoogte: de vrije hoogte + 15 cm dek, naar boven op een rozet. op/af = stijging per vak (0,5 of 1 m).
// Met een vrije overspanning telt de ligger mee (zie LIGGERS).
export const onderDek = (ligger) => (ligger ? LIGGERS.find((x) => x.k === liggerSoort(ligger))?.D || 0.3 : 0.15);
export const brugDek = (hoogte, ligger) => Math.ceil(((Number(hoogte) || 0) + onderDek(ligger) - 0.01) / ROZET) * ROZET;
export function brugMaat({ doorgang = 3, hoogte = 2.81, op = 0.5, af = 0.5, ligger = null } = {}) {
  const H = brugDek(hoogte, ligger); const nOp = Math.round(H / op); const nAf = Math.round(H / af);
  return { H, nOp, nAf, vrij: r3(H - onderDek(ligger)), lengte: (nOp + doorgang + nAf) * VAK };
}
// breed in vakken: 0.5 (1,04 m), 1 (2,07 m), 1.5 (3,11 m = 2,07 + 1,04), 2 (4,14 m), 2.5 (5,18 m = 2,07 + 1,04 + 2,07) of 3 (6,22 m). Geeft { vakken, maten }.
// ligger: null (staanders in de doorgang), 'tralie' of 'staal' (vrije overspanning).
export function brugVakken({ breed = 2, doorgang = 3, hoogte = 2.81, op = 0.5, af = 0.5, ligger = null } = {}) {
  const { H, nOp, nAf } = brugMaat({ doorgang, hoogte, op, af, ligger });
  const vakken = {}; let i = 0; const rijen = breed === 2.5 ? 3 : Math.ceil(breed);
  const zet = (v) => { for (let j = 0; j < rijen; j++) vakken[sleutel(i, j)] = { ...v }; i += 1; };
  for (let k = 0; k < nOp; k++) zet({ soort: 'helling', laag: r3(k * op), h: r3((k + 1) * op), r: 0 });
  for (let k = 0; k < doorgang; k++) zet({ soort: 'vloer', h: H, doorgang: true, vast: true, ...(ligger ? { vrij: true, ligger: liggerSoort(ligger) } : {}) });
  for (let k = 0; k < nAf; k++) zet({ soort: 'helling', laag: r3(H - (k + 1) * af), h: r3(H - k * af), r: 2 });
  // Een halve rij (1,04 m): bij 1,04 m de enige rij, bij 3,11 m de tweede, bij 5,18 m de middelste.
  const half = breed === 0.5 ? 0 : breed === 1.5 || breed === 2.5 ? 1 : null;
  return { vakken, maten: { x: {}, y: half == null ? {} : { [half]: HALF } } };
}

// ---------- Hellingen vanzelf ----------
// Je tekent het grondplan (vakken) en zet de overspanning op hoogte (vaste dekken: v.vast). De vloer- en hellingvakken
// ervoor en erna worden hellingen van rozet naar rozet (stap per vak, standaard 0,5 m = 13,6°) die aflopen tot op de grond.
// Is het getekende stuk te kort voor die hoogte, dan wordt de helling verlengd (vakken erbij aan het uiteinde);
// is het te lang, dan vallen de vakken voorbij de grond weg. Werkt per rij langs de lengte (x).
export function hellingenVanzelf(st, stap0 = null) {
  const stap = Number(stap0 || st.hellingStap) || 0.5;
  const v = { ...(st.vakken || {}) }; const vrijV = (x) => x && !x.vast && (x.soort === 'vloer' || x.soort === 'helling');
  const rijen = new Map();
  for (const s of Object.keys(v)) { const [i, j] = uitSleutel(s); if (!rijen.has(j)) rijen.set(j, []); rijen.get(j).push(i); }
  let erbij = 0; let weg = 0;
  for (const [j, is] of rijen) {
    is.sort((a, b) => a - b);
    // Lopen: aaneengesloten vakken in deze rij.
    const lopen = []; for (const i of is) { const l = lopen[lopen.length - 1]; if (l && i === l[l.length - 1] + 1) l.push(i); else lopen.push([i]); }
    for (const loop of lopen) {
      const vast = loop.filter((i) => v[sleutel(i, j)].vast);
      if (!vast.length) continue;
      const hoog = (i) => Number(v[sleutel(i, j)].h) || 0;
      const zetVrij = (i) => {
        // Dichtste vaste dek links en rechts: de hoogste helling wint.
        let best = null;
        for (const f of vast) { const d = Math.abs(i - f); const top = hoog(f) - (d - 1) * stap; if (!best || top > best.top + 1e-6 || (Math.abs(top - best.top) < 1e-6 && d < best.d)) best = { f, d, top }; }
        if (!best || best.top <= 0.001) { delete v[sleutel(i, j)]; weg += 1; return; }
        const laag = Math.max(0, best.top - stap); const oud = v[sleutel(i, j)] || {};
        v[sleutel(i, j)] = { ...oud, soort: 'helling', laag: r3(laag), h: r3(best.top), r: best.f > i ? 0 : 2, vast: undefined, doorgang: oud.doorgang };
      };
      for (const i of loop) if (vrijV(v[sleutel(i, j)])) zetVrij(i);
      // Verlengen: loopt de helling aan een uiteinde niet tot op de grond, dan komen er vakken bij.
      for (const [rand, richting] of [[loop[0], -1], [loop[loop.length - 1], 1]]) {
        let i = rand; let x = v[sleutel(i, j)]; let n = 0;
        while (x && n < 40) {
          const onder = x.soort === 'helling' ? Number(x.laag) || 0 : x.vast ? Number(x.h) || 0 : 0;
          const daalt = x.vast || (x.soort === 'helling' && Number(x.r) === (richting > 0 ? 2 : 0));
          if (!daalt || onder <= 0.001) break;
          i += richting; if (v[sleutel(i, j)]) break;
          const top = onder; const laag = Math.max(0, top - stap);
          v[sleutel(i, j)] = { soort: 'helling', laag: r3(laag), h: r3(top), r: richting > 0 ? 2 : 0 }; erbij += 1; n += 1; x = v[sleutel(i, j)];
        }
      }
    }
  }
  return { st: { ...st, vakken: v }, erbij, weg };
}

// ---------- Starten vanuit een type (zoals de standaardopstellingen van Gigant) ----------
// Elke functie geeft een volledige stelling (vakken, maten, leuning per zijde …) die de bouwer daarna verder aanpast.
// Zijden van een vak: k = 0 (+x), 1 (+y, "voor"), 2 (−x), 3 (−y, "achter").
export const START_TYPES = [
  { k: 'rennersbrug', naam: 'Rennersbrug', uitleg: 'Aanloop · helling · doorgang · helling · aanloop' },
  { k: 'voetgangers', naam: 'Voetgangers', uitleg: 'Voetgangersbrug: trappen met bordessen, doorgang met tralieligger, spijlenhek' },
  { k: 'camera', naam: 'Camera', uitleg: 'Camerastelling: toren van 2,07 × 2,07 (of half), lage leuning vooraan, gewone leuning (twee rozetten) achteraan' },
  { k: 'platform', naam: 'Platform', uitleg: 'Platform of podium: vlak dek (crane-dek, tentdeck, podium)' },
  { k: 'tribune', naam: 'Tribune', uitleg: 'Treden van 0,5 m die oplopen' },
  { k: 'toren', naam: 'Toren', uitleg: 'Toren zonder dek: staanders, liggers om de 2 m en schoren tot de gekozen hoogte (scherm, doek, steuntoren)' },
];
export function toren({ nx = 1, ny = 1, hoogte = 6, ballast = true, half = false } = {}) {
  const vakken = {}; const h = r3s(Number(hoogte) || 0);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) vakken[sleutel(i, j)] = { soort: 'toren', h, ...(ballast ? {} : { ballast: false }) };
  return { vakken, maten: { x: {}, y: half ? { 0: HALF } : {} }, leuning: {}, geenLadder: true };
}
const r3s = (x) => Math.round(x * 1000) / 1000;
const OPSTAP_H = 0.33; // bordes vooraan een voetgangerstrap (opstap)

export function cameraStelling({ breed = 1, diep = 1, hoogte = 2, voor = 'laag', achter = 'buis', ladder = true, wielen = false } = {}) {
  const h = r3s(Number(hoogte) || 0);
  const vakken = { '0,0': { soort: 'vloer', h } };
  const maten = { x: breed === 0.5 ? { 0: HALF } : {}, y: diep === 0.5 ? { 0: HALF } : {} };
  const leuning = {};
  if (voor !== 'auto') leuning['0,0,1'] = voor === 'open' ? false : voor;
  if (achter !== 'auto') leuning['0,0,3'] = achter === 'open' ? false : achter;
  // Met een camera op het dek, kijkend naar de voorkant (+y, de lage leuning).
  return { vakken, maten, leuning, camera: { deel: '0', vak: '0,0', u: 0.5, v: 0.5, rot: 0 }, ...(h < 1 ? { leuningVanaf: 1.01 } : {}), ...(ladder ? {} : { geenLadder: true }), ...(wielen ? { wielen: true } : {}) };
}

export function platform({ nx = 2, ny = 2, hoogte = 0.5, leuning = false } = {}) {
  const vakken = {}; const h = r3s(Number(hoogte) || 0);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) vakken[sleutel(i, j)] = { soort: 'vloer', h };
  return { vakken, maten: { x: {}, y: {} }, leuning: {}, ...(leuning ? {} : { leuningVanaf: 99 }), geenLadder: true };
}

export function tribune({ rijen = 4, breed = 3, start = 0.5, stap = 0.5 } = {}) {
  const vakken = {};
  for (let i = 0; i < rijen; i++) for (let j = 0; j < breed; j++) vakken[sleutel(i, j)] = { soort: 'tribune', h: r3s(start + i * stap), r: 0 };
  return { vakken, maten: { x: {}, y: {} }, leuning: {} };
}

// Trap van de grond naar het dek met voetgangersmodules en bordessen van 0,73 m ertussen (zoals Brug 7 van Gigant):
// zo veel mogelijk 2,57 × 2,00, dan 1,57 × 1,00 en een opstap; geeft de kolommen van laag naar hoog.
function trapKolommen(H) {
  const uit = []; let rest = r3s(H);
  const M2 = TRAPMODULES.find((m) => m.k === '2.57x2.00'); const M1 = TRAPMODULES.find((m) => m.k === '1.57x1.00');
  while (rest > 0.45 + 1e-6) {
    const m = rest >= M2.s + 0.3 - 1e-6 ? M2 : M1; const laag = r3s(Math.max(0, rest - m.s));
    uit.unshift({ soort: 'trap', trap: 'voetganger', module: m.k, laag, h: rest, b: m.l });
    rest = laag;
    if (rest > 1e-6) uit.unshift({ soort: 'bordes', h: rest, b: BORDES });
  }
  return uit;
}
export function voetgangersbrug({ doorgang = 3, hoogte = 2.75, breed = 3, ligger = 'tralie', portaal = 0 } = {}) {
  // Dekhoogte zodat de trappen precies passen: modules van 2 en 1 m en een opstap van 0,33 m (bv. 3,33 m bij Brug 7).
  const nodig = (Number(hoogte) || 0) + (LIGGERS.find((x) => x.k === liggerSoort(ligger))?.D || 0.3);
  const H = r3s(OPSTAP_H + Math.ceil(nodig - OPSTAP_H - 1e-6)); const trap = trapKolommen(H);
  const kol = [...trap.map((t) => ({ ...t, r: 0 })), ...Array.from({ length: doorgang }, () => ({ soort: 'vloer', h: H, doorgang: true, vrij: true, ligger: liggerSoort(ligger), vrijH: hoogte, ...(portaal > 0 ? { portaal } : {}) })), ...[...trap].reverse().map((t) => ({ ...t, r: 2 }))];
  const vakken = {}; const mx = {};
  kol.forEach((c, i) => { const { b, ...v } = c; if (b && Math.abs(b - VAK) > 0.001) mx[i] = b; for (let j = 0; j < breed; j++) vakken[sleutel(i, j)] = { ...v }; });
  return { vakken, maten: { x: mx, y: {} }, leuning: {}, leuningStandaard: 'net' };
}

// ---------- TV-camera op het dek ----------
// st.camera = { deel: '0', vak: 'i,j', u, v, rot }: een camera op statief op het dek van een vak. u en v zijn de
// plaats in het vak (0..1, langs x en y), rot de kijkrichting in graden, met de klok mee vanaf +y (de voorkant van
// een camerastelling, zoals kop_rot bij de bibliotheekstellingen). Lens en opstelling staan in velden.tvcamera
// (zie tvcamera.js): één bron voor de camera-tab, de pop-up en de bouwer.
export const CAMERA_OOG = 1.5; // hoogte van de camera (op statief) boven het dek
export const CAMERA_SECTOR = { r: 1.4, hoek: 25 }; // kijkhoek op de kaart en op het dek: straal in m, halve hoek in graden
const klem01 = (v, d = 0.5) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0.05, Math.min(0.95, n)) : d; };
// Waar de camera staat: in het stelsel van het deel (x, y, h), in dat van de lijn (W, dW) en de kijkrichting d (eenheidsvector).
// Staat ze op een vak dat niet (meer) bestaat, dan op het eerste vak van het deel.
export function cameraPlek(st) {
  const c = st?.camera; if (!c) return null;
  const delen = delenVan(st); const dl = delen.find((d) => d.id === (c.deel || '0')) || delen[0];
  const vakken = dl.d.vakken || {}; let s = c.vak; let v = vakken[s];
  if (!v || v.soort === 'toren') { s = Object.keys(vakken).find((k) => vakken[k].soort !== 'toren'); v = s ? vakken[s] : null; }
  if (!v) return null;
  const [i, j] = uitSleutel(s); const u = klem01(c.u); const w = klem01(c.v); const M = stellingMaten(dl.d);
  const x = M.x(i + u); const y = M.y(j + w); const h = hoogteOp(v, u, w); const rot = ((Number(c.rot) || 0) % 360 + 360) % 360;
  const r = (rot * Math.PI) / 180; const d = [Math.sin(r), Math.cos(r)];
  const W = dl.T([x, y]); const dW = [d[0] * Math.cos(dl.a) - d[1] * Math.sin(dl.a), d[0] * Math.sin(dl.a) + d[1] * Math.cos(dl.a)];
  return { deel: dl.id, s, i, j, u, v: w, rot, h, x, y, d, W, dW, a: dl.a, vak: v };
}
// Standaardplaats van een nieuwe camera: midden op het eerste vak, kijkend naar de lage leuning (anders naar +y).
export function cameraStandaard(st, deel = '0') {
  const d = deel === '0' ? st : (st?.delen || []).find((x) => x.id === deel) || st;
  const vakken = d?.vakken || {}; const vak = Object.keys(vakken).find((k) => vakken[k].soort !== 'toren'); if (!vak) return null;
  const laag = Object.entries(d.leuning || {}).find(([, l]) => l === 'laag')?.[0];
  const k = laag ? Number(laag.split(',')[2]) : 1; const rot = { 0: 90, 1: 0, 2: 270, 3: 180 }[k] ?? 0;
  const dek = vakken[vak];
  // Op een helling of trap iets naar de hoge kant, anders midden op het vak.
  const r = Number(dek.r) || 0; const hoog = dek.soort === 'helling' || dek.soort === 'trap';
  return { deel, vak, u: hoog && r % 2 === 0 ? (r === 0 ? 0.7 : 0.3) : 0.5, v: hoog && r % 2 === 1 ? (r === 1 ? 0.7 : 0.3) : 0.5, rot };
}

// Korte omschrijving van een stelling voor het materiaaloverzicht: maat, dekhoogte en wat er bijzonder aan is.
// Geen onderdelen: die verschillen per leverancier en per constructie (de leverancier rekent ze zelf uit).
export function stellingOmschrijving(st) {
  const g = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('nl-BE', { maximumFractionDigits: d });
  const alleVk = delenVan(st).flatMap((d) => Object.values(d.d.vakken || {}));
  if (alleVk.length && alleVk.every((v) => v.soort === 'toren')) {
    const t = delenVan(st).filter((d) => !stellingKader(d.d).leeg).map((d) => { const K = stellingKader(d.d); const M = stellingMaten(d.d); const a = M.x(K.i1) - M.x(K.i0); const b = M.y(K.j1) - M.y(K.j0); return `${g(Math.max(a, b))} × ${g(Math.min(a, b))} m`; });
    return [`Stellingtoren ${t.join(' + ')}`, `${g(Math.max(0, ...alleVk.map((v) => Number(v.h) || 0)), 2)} m hoog`, ...(st?.wielen ? ['op wielen'] : [])].join(' · ');
  }
  const delen = delenVan(st).filter((d) => !stellingKader(d.d, true).leeg);
  if (!delen.length) return 'Stelling (leeg)';
  const maat = delen.map((d) => { const K = stellingKader(d.d, true); const M = stellingMaten(d.d); const a = M.x(K.i1) - M.x(K.i0); const b = M.y(K.j1) - M.y(K.j0); return `${g(Math.max(a, b))} × ${g(Math.min(a, b))} m`; });
  const vk = delen.flatMap((d) => Object.values(d.d.vakken || {}));
  const h = Math.max(0, ...vk.filter((v) => v.soort !== 'toren').map((v) => Number(v.h) || 0));
  const n = (s) => vk.filter((v) => v.soort === s).length;
  const extra = [n('helling') ? 'met helling' : '', n('trap') || n('trapblok') ? 'met trap' : '', n('tribune') ? 'met tribune' : '', n('toren') ? 'met steuntorens' : '', vk.some((v) => v.doorgang) ? 'met doorgang' : '', st?.wielen ? 'op wielen' : ''].filter(Boolean);
  return [`Stelling ${maat.join(' + ')}`, `dek ${g(h, 2)} m`, ...extra].join(' · ');
}
