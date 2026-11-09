// Scène van een stelling: elk onderdeel als tekenopdracht (3D, SVG, zijaanzicht). Los van React.
// Wordt gebruikt door de 3D (StellingDrieGL), het SVG-voorbeeld, het zijaanzicht en (fase 0) de onderdelenlijst.
import { VAK, LEUNING_H, LADDER_BOVEN, SOORTEN, soortVan, RICHTING, HOEKEN, RAND, sleutel, uitSleutel, hoogteOp, stellingAfgeleid, stellingKader, brugVakken, brugMaat, HELLINGEN, afwijking, stellingMaten, HALF, LEUNINGEN, leuningHoogte, delenVan, opCm, grondVan, grondHoek, PLATEN, AANLOOP, LIGGERS, liggerSoort, DOORGANG_FUNCTIES, functieNaam, TRAPMODULES, BORDES, OPSTAP, trapModule, hellingenVanzelf, brugDek, onderDek, WIEL_H, START_TYPES, cameraStelling, platform, tribune, voetgangersbrug, ROZET, schoorOpRand, horizontaleDiagonalen, liggerHoogtes, GEEN_STAANDER, doorgangWand, doorgangOpen, rozetVoet, DEK_ROZET, cameraPlek, cameraStandaard, CAMERA_OOG, CAMERA_SECTOR, isMetaal, metaalDelen, METAAL_OP, toren, randParen, paarSleutel, wandBoven, tussenVloeren, tussenOpen, vloerHoogtes, vloerRozet, vloerLoop, wandMaten, wandRozetten, wandLiggers, wandVloeren, wandVloerLeuning, schoorStukken, schoorStart } from '../stellingbouw';
import { publiekeUrl } from '../db';
import { grondFunctie } from './grond';
import { opdelen, WIEL_NAAM, delenVan as delenVan2, stellingAfgeleid as afgeleid2 } from '../stellingbouw';

// Maat in de stuklijst: 2,07 / 1,04 / 3 (komma, hoogstens 2 decimalen).
const m2 = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
const m2h = (v) => (Math.round(v * 2) / 2).toFixed(2).replace('.', ','); // hoogte van een schoor: 0,50 / 1,00 / 2,00
const getal = (v, d = 2) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: d });

// Randen van een doek in doorlopende stukken (zelfde zijde, aansluitend), in volgorde.
export function doekStukken(d, af) {
  const rs = (d.randen || []).map((x) => af.randen.find((r) => r.s === x)).filter(Boolean);
  const groep = new Map();
  // Per rasterlijn (een wand kan halverwege van het ene vak naar het buurvak overgaan: andere k, zelfde lijn).
  const lijnVan = (r) => { const [dx, dy] = RICHTING[r.k]; return dx ? { key: `v|${r.i + (dx > 0 ? 1 : 0)}`, p: r.j } : { key: `h|${r.j + (dy > 0 ? 1 : 0)}`, p: r.i }; };
  for (const r of rs) { const key = lijnVan(r).key; const l = groep.get(key) || []; l.push(r); groep.set(key, l); }
  const uit = [];
  for (const l of groep.values()) {
    const pos = (r) => lijnVan(r).p; const richting = () => 1; // de leesrichting legt de scène vast
    l.sort((a, b) => (pos(a) - pos(b)) * richting(l[0])); let cur = null;
    for (const r of l) { if (cur && Math.abs(pos(r) - pos(cur[cur.length - 1])) === 1) cur.push(r); else { cur = [r]; uit.push(cur); } }
  }
  return uit;
}
// Alle doeken weg (oogje: de constructie zien).
export const zonderDoeken = (s) => (s ? { ...s, doeken: [], delen: s.delen?.map((d) => ({ ...d, doeken: [] })) } : s);
// Doeksoorten op een stelling.
export const DOEK_SOORTEN = [['vlak', 'Tussen liggers'], ['leuning', 'Op de leuning'], ['zijkant', 'Zijkant tot de grond'], ['onder', 'Onderste 2 m'], ['band', 'Band onder het dek'], ['doorgang', 'Boven een doorgang']];

// ---------- 3D (axonometrisch, zoals de trussbouwer) ----------
// Stalen vloerdelen: losse delen van ± 0,32 m die met hun haken in de U-liggers hangen (langs x, aan j en j+1).
// Het loopvlak ligt gelijk met de bovenkant van de U-ligger; de delen liggen ertussen, niet erover.
export function metaalDek(quad, Wp, bx, n, mini) {
  if (mini) { quad([Wp(0, 0), Wp(1, 0), Wp(1, 1), Wp(0, 1)], '#B7BEC5', '#5F676F', { dek: true, metaal: true }); return; }
  const e = 0.035; const g = 0.006 / Math.max(0.3, bx);
  for (let q = 0; q < n; q++) { const u0 = q / n + g; const u1 = (q + 1) / n - g; quad([Wp(u0, e), Wp(u1, e), Wp(u1, 1 - e), Wp(u0, 1 - e)], '#B7BEC5', '#5F676F', { dek: true, metaal: true }); }
}
// ---------- Scène van een stelling (los van hoe ze getekend wordt) ----------
// Roept per onderdeel een tekenfunctie aan in wereldcoördinaten (meter, z omhoog): quad (vlak), lijn (buis of
// hulplijn), voet (voetplaat/spindel of zwenkwiel), rozet, beeld (doek met ontwerp) en label (maat van een doorgang).
// De SVG-weergave (klein voorbeeld) en de 3D-weergave (three.js) tekenen allebei uit deze ene scène.
export function bouwScene({ st: stAlles, delen, afs, mini = false, doekMap = new Map() }, uit) {
  const { quad, lijn } = uit;
  // Stuklijst: elk onderdeel dat getekend wordt, meldt zich hier (naam zoals in de bestelling). Zo telt de stuklijst
  // precies wat de 3D toont. Onafhankelijk van mini (het kleine voorbeeld tekent minder, maar telt hetzelfde).
  const stuk = (naam, n = 1) => { if (n > 0 && uit.stuk) uit.stuk(naam, n); };
  // Liggers en kruisen hangen in de rozetten (om de 0,5 m vanaf de voet): daar zitten de bevestigingspunten.
  const rozOp = (g, z) => g + Math.round((z - g) / ROZET) * ROZET;
  const rozOnder = (g, z) => g + Math.floor((z - g) / ROZET + 1e-6) * ROZET;
  const rozBoven = (g, z) => g + Math.ceil((z - g) / ROZET - 1e-6) * ROZET;
  delen.forEach((dl, di) => {
  const st = { ...dl.d, wielen: stAlles.wielen }; const af = afs[di]; const M = stellingMaten(st);
  const W = (i, j) => dl.T([M.x(i), M.y(j)]);
  const G = (i, j) => af.grondOp(i, j);
  const randL = (r) => (r.k % 2 === 0 ? M.by(r.j) : M.bx(r.i));
  // Gemeten grond (st.grondPunten): het terrein als een doorlopend vlak, een rand van één vak rond de stelling.
  const fG = grondFunctie(st);
  if (fG) {
    const K = stellingKader(st); const ia = (K.leeg ? 0 : K.i0) - 1; const ib = (K.leeg ? 1 : K.i1) + 1; const ja = (K.leeg ? 0 : K.j0) - 1; const jb = (K.leeg ? 1 : K.j1) + 1;
    const gz = (i, j) => fG(M.x(i), M.y(j)) + 0.004;
    for (let i = ia; i < ib; i++) for (let j = ja; j < jb; j++) { const c = HOEKEN.map(([u, w]) => { const [x, y] = W(i + u, j + w); return [x, y, gz(i + u, j + w)]; }); if (c.every((q) => q[2] < 0.01)) continue; quad(c, '#CFC7AE', '#B5AA8A', { grond: true }); }
  }
  // Verhoogde grond onder een vak (treden, dijk): een blok tot het maaiveld.
  for (const v of af.lijst) {
    if (fG) break;
    const g = grondVan(v); if (g <= 0.01) continue;
    const c = HOEKEN.map(([u, w]) => W(v.i + u, v.j + w)); const gh = HOEKEN.map(([u, w]) => grondHoek(v, u, w));
    quad(c.map(([x, y], q) => [x, y, gh[q]]), '#D9CBA3', '#A8956A');
    for (let k = 0; k < 4; k++) {
      const [a, b] = RAND[k]; const nb = st.vakken?.[sleutel(v.i + RICHTING[k][0], v.j + RICHTING[k][1])];
      const [dx, dy] = RICHTING[k]; const gb = (q) => (nb ? grondHoek(nb, HOEKEN[q][0] - dx, HOEKEN[q][1] - dy) : 0);
      if (gb(a) >= gh[a] - 0.01 && gb(b) >= gh[b] - 0.01) continue;
      quad([[...c[a], gh[a]], [...c[b], gh[b]], [...c[b], gb(b)], [...c[a], gb(a)]], '#C2B183', '#A8956A');
    }
  }
  // Dekken
  for (const v of af.lijst) {
    const c = HOEKEN.map(([u, w]) => { const [x, y] = W(v.i + u, v.j + w); return [x, y, hoogteOp(v, u, w)]; });
    const kl = v.plaat ? PLATEN.find((p) => p.k === v.plaat)?.kleur || soortVan(v.soort).kleur : st.plaat ? PLATEN.find((p) => p.k === st.plaat)?.kleur || soortVan(v.soort).kleur : soortVan(v.soort).kleur;
    if (v.soort !== 'toren') {
      // Wat er op het vak ligt (de U-liggers eronder tellen bij de randen, waar ze getekend worden).
      const tm = trapModule(v); const breed = m2(Number(v.r) % 2 === 0 ? M.by(v.j) : M.bx(v.i));
      const n = Math.max(1, Math.round((M.bx(v.i) * M.by(v.j)) / (VAK * HALF))); const lang = m2(Math.max(M.bx(v.i), M.by(v.j)));
      if (tm) { stuk(`TRAPB ${m2(tm.l)} × ${m2(tm.s)} m (metaal, ${breed} m breed)`); stuk(`Trapleuning ${m2(tm.l)} × ${m2(tm.s)} m`); }
      else if (v.soort === 'bordes') stuk(`Doorloopbordes ${m2(Math.max(M.bx(v.i), M.by(v.j)))} × ${m2(Math.min(M.bx(v.i), M.by(v.j)))} m`);
      else if (v.soort === 'vloer' && isMetaal(v, st)) stuk(`Stalen vloerdeel ${m2(M.by(v.j))} × 0,32 m (geperforeerd)`, metaalDelen(M.bx(v.i)));
      else if (v.soort === 'vloer') stuk(`Plaat ${lang} × 1,03 m`, n);
      else if (v.soort === 'helling') stuk(`Hellingdeel ${lang} × 1,04 m`, n);
      else if (v.soort === 'trap') stuk(`Rennerstrap (houten treden) ${breed} m breed`);
      else if (v.soort === 'trapblok') stuk(`Trapblok ${Math.max(1, Math.round((Number(v.h) - grondVan(v)) / 0.25))} treden (${m2(Math.min(M.bx(v.i), M.by(v.j)))} m)`);
      else if (v.soort === 'tribune') stuk(n > 1 ? 'Tribunevak 2 treden 2,07 × 2,07 m' : 'Tribunevak 2 treden 1,04 × 2,07 m');
    }
    if (v.soort === 'trapblok') {
      // Trapblok: losse houten treden van ± 0,25 m op de grond, oplopend in richting r.
      const r = Number(v.r) || 0; const g = grondVan(v); const n = Math.max(1, Math.round((Number(v.h) - g) / 0.25));
      const pt = (t, q) => (r % 2 === 0 ? [r === 0 ? t : 1 - t, q] : [q, r === 1 ? t : 1 - t]);
      const Wp = (t, q, z) => { const [u, w] = pt(t, q); const [x, y] = W(v.i + u, v.j + w); return [x, y, z]; };
      for (let k = 0; k < n; k++) {
        const t0 = k / n; const z1 = g + ((Number(v.h) - g) * (k + 1)) / n;
        quad([Wp(t0, 0, z1), Wp(1, 0, z1), Wp(1, 1, z1), Wp(t0, 1, z1)], '#C89A63', '#6B4423');
        quad([Wp(t0, 0, g), Wp(t0, 1, g), Wp(t0, 1, z1), Wp(t0, 0, z1)], '#A8794A', '#6B4423');
        for (const q of [0, 1]) quad([Wp(t0, q, g), Wp(1, q, g), Wp(1, q, z1), Wp(t0, q, z1)], '#9A6C40', '#6B4423');
      }
    } else if (v.soort === 'trap') {
      // Treden: renners = houten treden met stootbord over het hele vak; voetgangers = metalen trapmodule met twee trapbomen.
      const r = Number(v.r) || 0; const lo = Number(v.laag) || 0; const hi = Number(v.h) || 0; const voet = !!trapModule(v);
      const n = Math.max(2, Math.round(Math.abs(hi - lo) / (voet ? 0.2 : 0.18)));
      const pt = (t, q) => (r % 2 === 0 ? [r === 0 ? t : 1 - t, q] : [q, r === 1 ? t : 1 - t]);
      const Wp = (t, q, z) => { const [u, w] = pt(t, q); const [x, y] = W(v.i + u, v.j + w); return [x, y, z]; };
      const q0 = voet ? 0.04 : 0; const q1 = voet ? 0.96 : 1;
      for (let k = 0; k < n; k++) {
        const t0 = k / n; const t1 = (k + 1) / n; const z0 = lo + ((hi - lo) * k) / n; const z1 = lo + ((hi - lo) * (k + 1)) / n;
        quad([Wp(t0, q0, z1), Wp(t1, q0, z1), Wp(t1, q1, z1), Wp(t0, q1, z1)], voet ? '#8FB5A8' : kl, voet ? '#4F7F70' : '#6B4423');
        if (!voet) quad([Wp(t0, 0, z0), Wp(t0, 1, z0), Wp(t0, 1, z1), Wp(t0, 0, z1)], '#B89A70', '#6B4423');
      }
      if (voet) for (const q of [0.02, 0.98]) lijn(Wp(0, q, lo - 0.05), Wp(1, q, hi - 0.05), '#3F6F60', mini ? 1.2 : 2.6, -0.01);
    } else if (v.soort !== 'toren') {
      const metaal = v.soort === 'vloer' && isMetaal(v, st);
      if (metaal) metaalDek(quad, (u, w) => { const [x, y] = W(v.i + u, v.j + w); return [x, y, hoogteOp(v, u, w) - DEK_ROZET + METAAL_OP]; }, M.bx(v.i), metaalDelen(M.bx(v.i)), mini);
      else quad(c, v.soort === 'bordes' ? '#A9BDB6' : kl, '#6B4423', { dek: true });
      if (metaal) { /* naden: de delen liggen los naast elkaar */ } else
      // Naad tussen de twee platen van 2,07 × 1,03 m (dwars op de lange kant van het vak).
      if (!mini && (v.soort === 'vloer' || v.soort === 'helling') && Math.max(M.bx(v.i), M.by(v.j)) > 1.5 && Math.min(M.bx(v.i), M.by(v.j)) > 1.5) {
        const [p0, p1] = [[0.5, 0], [0.5, 1]]; const a = W(v.i + p0[0], v.j + p0[1]); const b = W(v.i + p1[0], v.j + p1[1]);
        lijn([a[0], a[1], hoogteOp(v, ...p0) + 0.005], [b[0], b[1], hoogteOp(v, ...p1) + 0.005], '#5B3A1A', 0.8, 0.005);
      }
    }
    if (v.soort === 'tribune') {
      // treden: lijnen dwars op de looprichting
      const n = 2;
      const r = Number(v.r) || 0;
      for (let k = 1; k < n; k++) {
        const f = k / n; const a = r % 2 === 0 ? [r === 0 ? f : 1 - f, 0] : [0, r === 1 ? f : 1 - f]; const b = r % 2 === 0 ? [a[0], 1] : [1, a[1]];
        const pa = W(v.i + a[0], v.j + a[1]); const pb = W(v.i + b[0], v.j + b[1]);
        lijn([pa[0], pa[1], hoogteOp(v, ...a) + 0.01], [pb[0], pb[1], hoogteOp(v, ...b) + 0.01], '#8A6A45', 0.8, 0.01);
      }
    }
  }
  // Staanders
  for (const n of af.knopen) {
    // Zonder leuning stopt de staander in de rozet onder het dek (± 0,2 m onder het loopvlak).
    const [x, y] = W(n.i, n.j); const top = n.top; const g = n.g || 0;
    // Aan de voet van een helling ligt het dek (bijna) op de grond: daar geen staander of voet onder de plaat.
    if (!n.leuning && n.h - g < GEEN_STAANDER && n.schuin) { stuk('Onderlegplank (kalvoet)', 2); if (!mini) uit.voet([x, y, g], { blok: true, h: n.h }); continue; } // gestapelde planken onder het einde
    if (st.wielen) stuk(WIEL_NAAM); else { stuk('WP+SP+VTST 0,2 m (voetplaat, spindel, voetstuk)'); stuk('Onderlegplank (kalvoet)'); }
    { const L = Math.floor((top - g - (st.wielen ? WIEL_H : 0.1)) * 2) / 2; if (L >= 0.5) for (const l of opdelen(L)) stuk(`Staander ${m2(l)} m`); }
    // De staander begint boven de spindel (of het wiel); die tekent de voet zelf.
    if (top > g + (mini ? 0 : st.wielen ? WIEL_H : 0.2) + 0.05) lijn([x, y, g + (mini ? 0 : st.wielen ? WIEL_H : 0.2)], [x, y, top], '#5F6B78', mini ? 1.1 : 2.2);
    // voetplaat
    if (!mini) uit.voet([x, y, g], { h: n.h, wiel: !!st.wielen });
    // Veiligheidsdop bovenaan: enkel waar de staander boven het dek uitkomt (leuning). Onder een dek stopt hij eronder.
    if (!mini && n.leuning) uit.pen?.([x, y, top]);
    // rozetten om de 0,5 m (zoals Allround)
    if (!mini) for (let z = rozetVoet(g, n.h - DEK_ROZET) + ROZET; z <= top + 0.01; z += ROZET) { uit.rozet([x, y, z]); if (uit.doel) { const zr = Math.round(z * 100) / 100; uit.doel({ soort: 'rozet', deel: dl.id, s: `${n.i},${n.j}|${zr}`, kn: `${n.i},${n.j}`, z: zr, p: [x, y, z] }); } }
  }
  // Horizontale diagonalen in het vlak van de onderste liggers (eerste rozet boven de grond).
  stuk('Horizontale diagonaal 2,07 m', horizontaleDiagonalen(af.lijst).length);
  if (!mini) horizontaleDiagonalen(af.lijst).forEach((v, k) => {
    // In de eerste rozet van de reeks, dezelfde waar de onderste liggers in hangen (niet vast op 0,5 m van de grond).
    const hv = v.laag != null ? Math.min(Number(v.laag), Number(v.h)) : Number(v.h); const g = rozetVoet(grondVan(v), hv - DEK_ROZET) + ROZET; const [p, q] = k % 2 ? [W(v.i, v.j + 1), W(v.i + 1, v.j)] : [W(v.i, v.j), W(v.i + 1, v.j + 1)];
    lijn([p[0], p[1], g], [q[0], q[1], g], '#9AA3AD', 1.1);
  });
  // Zelf gezette horizontale diagonalen (st.hdiag = [[hoek1, hoek2, z]]): schuin over een vak, van rozet naar rozet.
  for (const [k1, k2, z] of st.hdiag || []) {
    const [i1, j1] = k1.split(',').map(Number); const [i2, j2] = k2.split(',').map(Number); const p = W(i1, j1); const q = W(i2, j2);
    stuk(`Horizontale diagonaal ${m2(Math.hypot(M.x(i2) - M.x(i1), M.y(j2) - M.y(j1)))} m`);
    lijn([p[0], p[1], z], [q[0], q[1], z], '#9AA3AD', mini ? 0.7 : 1.1);
    if (!mini && uit.doel) uit.doel({ soort: 'hdiag', deel: dl.id, s: `${k1}|${k2}|${z}`, a: [p[0], p[1], z], b: [q[0], q[1], z] });
  }
  // Ballast (Stelcon-platen) onderin elke steuntoren.
  for (const v of af.lijst) if (v.soort === 'toren' && v.ballast !== false) stuk('Stelconplaat 1.360 kg (ballast)');
  if (!mini) for (const v of af.lijst) if (v.soort === 'toren' && v.ballast !== false) {
    const g = grondVan(v); const c = [[0.15, 0.15], [0.85, 0.15], [0.85, 0.85], [0.15, 0.85]].map(([u, w2]) => W(v.i + u, v.j + w2)); const zt = g + 0.45;
    for (let k = 0; k < 4; k++) { const a = c[k]; const b = c[(k + 1) % 4]; quad([[...a, g + 0.05], [...b, g + 0.05], [...b, zt], [...a, zt]], '#7F93A8', '#4B5D73'); }
    quad(c.map(([x, y]) => [x, y, zt]), '#A9B8C8', '#4B5D73');
  }
  // Tussenvloeren in een toren: dek, U-liggers in de lengte, buizen dwars, leuning waar geen vloer naast ligt.
  for (const v of af.lijst) for (const zr of tussenVloeren(v)) {
    // zr = rozet waarin de liggers hangen, z = loopvlak.
    const z = vloerLoop(v, st, zr);
    const c = HOEKEN.map(([u, w]) => { const [x, y] = W(v.i + u, v.j + w); return [x, y, z]; });
    if (!mini && uit.doel) uit.doel({ soort: 'tvloer', deel: dl.id, s: `${v.s}|${zr}`, vak: v.s, zr, c });
    const metaal = isMetaal(v, st); const kl = PLATEN.find((p) => p.k === (v.plaat || st.plaat))?.kleur || soortVan('vloer').kleur;
    stuk(`U-ligger ${m2(M.bx(v.i))} m (tussenvloer)`, 2);
    if (metaal) stuk(`Stalen vloerdeel ${m2(M.by(v.j))} × 0,32 m (geperforeerd)`, metaalDelen(M.bx(v.i))); else stuk(`Plaat ${m2(Math.max(M.bx(v.i), M.by(v.j)))} × 1,03 m`, Math.max(1, Math.round((M.bx(v.i) * M.by(v.j)) / (VAK * HALF))));
    if (metaal) metaalDek(quad, (u, w) => { const [x, y] = W(v.i + u, v.j + w); return [x, y, z]; }, M.bx(v.i), metaalDelen(M.bx(v.i)), mini);
    else quad(c, kl, '#6B4423', { dek: true });
        for (let k = 0; k < 4; k++) {
      const [a, b] = RAND[k]; const A = c[a]; const B = c[b];
      if (k % 2 === 1) { if (uit.vloerligger) uit.vloerligger([A[0], A[1], zr], [B[0], B[1], zr], { metaal, laag: metaal }); else lijn([A[0], A[1], zr], [B[0], B[1], zr], '#7B8591', mini ? 1 : 1.6); } // dwars: de ligger van de wand
      // De leuning (rozetten 0,5 en 1 m boven de vloer) tekent de wand: het zijn liggers van die wand (wandVloerLeuning).
    }
  }
  // Leuningstaanders boven een vrije overspanning (op de ligger, om de 2 m).
  for (const n of af.leuningPosten || []) { stuk(`Staander ${m2(Math.max(0.5, Math.round((n.lh || LEUNING_H) * 2) / 2))} m (leuning boven overspanning)`); const [x, y] = W(n.i, n.j); lijn([x, y, n.h - 0.05], [x, y, n.h + (n.lh || LEUNING_H)], '#5F6B78', mini ? 1.1 : 2.2); if (!mini) uit.pen?.([x, y, n.h + (n.lh || LEUNING_H)]); }
  // Doorgangen: de vrije ruimte eronder zichtbaar (groen op de grond, met de vrije hoogte).
  for (const v of af.lijst) if (v.doorgang) {
    const g = grondVan(v);
    const c = HOEKEN.map(([u, w]) => { const [x, y] = W(v.i + u, v.j + w); return [x, y, g + 0.01]; });
    quad(c, '#22C55E', '#15803D', { fillOpacity: 0.28, strokeDasharray: '4 3' });
  }
  // Per doorgang: de vrije ruimte als stippelkader (breedte × hoogte), met de maten voor de brandweer.
  for (const d of af.doorgangen) {
    const j0 = d.rijen[0]; const j1 = d.rijen[d.rijen.length - 1] + 1; const z0 = d.g + 0.02; const z1 = d.g + d.H;
    // De vrije breedte ligt in het midden van de kolommen.
    // Gedraaide doorgang (langs x): de breedte ligt over de rijen, je loopt langs x.
    const dwarsP = (i) => (d.richt === 'x' ? M.y(i) : M.x(i));
    const mid = (dwarsP(d.i0) + dwarsP(d.i1 + 1)) / 2; const xa = mid - d.B / 2; const xb = mid + d.B / 2;
    const P = (x, j, z) => { const [px, py] = dl.T(d.richt === 'x' ? [M.x(j), x] : [x, M.y(j)]); return [px, py, z]; };
    const kl = d.fout ? '#DC2626' : '#15803D'; const w = mini ? 0.8 : 1.4;
    for (const x of [xa, xb]) for (const j of [j0, j1]) lijn(P(x, j, z0), P(x, j, z1), kl, w, -0.05);
    for (const j of [j0, j1]) lijn(P(xa, j, z1), P(xb, j, z1), kl, w, -0.05);
    for (const x of [xa, xb]) lijn(P(x, j0, z1), P(x, j1, z1), kl, w, -0.05);
    // De opening als transparant vlak aan beide kanten; de maat staat centraal in het vlak dat het dichtst bij de kijker ligt.
    const vlak = (j) => [P(xa, j, z0), P(xb, j, z0), P(xb, j, z1), P(xa, j, z1)];
    for (const j of [j0, j1]) quad(vlak(j), d.fout ? '#FCA5A5' : '#86EFAC', kl, { fillOpacity: 0.22, strokeOpacity: 0.9 });
    if (!mini) uit.label({ vlakken: [vlak(j0), vlak(j1)], midden: [P(mid, j0, (z0 + z1) / 2), P(mid, j1, (z0 + z1) / 2)], B: d.B, H: d.H, kl, tekst: `${functieNaam(d.functie) || 'doorgang'}${d.fout ? ' ⚠' : ''}`, maat: `${getal(d.B, 2)} × ${getal(d.H, 2)} m` });
  }
  // Liggers, leuningen, kantplanken, diagonalen per rand
  const paren = randParen(af.randen);
  // Kiesdoelen voor de 3D (klik op een rand of een hoek om de leuning of de staander te kiezen).
  if (!mini && uit.doel) {
    for (const v of af.lijst) { const zt = v.soort === 'toren' ? grondVan(v) + 0.45 : null; uit.doel({ soort: 'vak', deel: dl.id, s: v.s, c: HOEKEN.map(([u, w]) => { const [x, y] = W(v.i + u, v.j + w); return [x, y, zt ?? hoogteOp(v, u, w)]; }) }); }
    // Grepen op de uiteinden van een helling: elk uiteinde apart omhoog of omlaag slepen.
    for (const v of af.lijst) if (v.soort === 'helling') { const r = Number(v.r) || 0; const hoog = [[1, 0.5], [0.5, 1], [0, 0.5], [0.5, 0]][r]; const laag = [1 - hoog[0], 1 - hoog[1]];
      for (const [kant, [u, w]] of [['hoog', hoog], ['laag', laag]]) { const [x, y] = W(v.i + u, v.j + w); uit.doel({ soort: 'eind', deel: dl.id, s: `${v.s}|${kant}`, vak: v.s, kant, p: [x, y, hoogteOp(v, u, w)] }); } }
    for (const r of af.randen) { if (!r.kiesbaar) continue; const [a, b] = RAND[r.k]; const A = W(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]); const B = W(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1]); uit.doel({ soort: 'rand', deel: dl.id, s: r.s, a: [A[0], A[1], r.ha], b: [B[0], B[1], r.hb], lsoort: r.lsoort, leuning: r.leuning }); }
    // Staanders: elke hoek, ook waar er (door een overspanning of zelf weggehaald) geen staat — die is aan te klikken
    // om er toch een te zetten (in Bouwen als dunne stippellijn getekend).
    for (const n of af.alleKnopen || []) { const [x, y] = W(n.i, n.j); const g0 = n.g + 0.2; const t0 = n.vrij ? n.h - 0.15 : n.top; if (t0 - g0 < 0.2) continue;
      uit.doel({ soort: 'staander', deel: dl.id, s: `${n.i},${n.j}`, a: [x, y, g0], b: [x, y, t0], weg: !!n.vrij, extra: !!n.extra });
      if (n.vrij && stAlles.spook) for (let z = g0; z < t0 - 0.1; z += 0.3) lijn([x, y, z], [x, y, Math.min(t0, z + 0.15)], '#94A3B8', 1); }
    for (const n of af.knopen) { const [x, y] = W(n.i, n.j); if (n.leuning) uit.doel({ soort: 'hoek', deel: dl.id, s: `${n.i},${n.j}`, p: [x, y, n.top + 0.12] }); /* op de dop, net boven de bovenste rozet */ }
    // Cellen om een doek op te tekenen: per wand de vakken tussen twee horizontale buizen (grond, liggers, dekligger,
    // leuning). Enkel vlakke wanden (geen helling).
    const parenC = randParen(af.randen);
    for (const r of af.randen) {
      if (r.soort === 'trapblok') continue;
      // Langs een helling: twee banden die de schuine lijn volgen — onder het dek (grond tot dekrand) en de leuning.
      if (Math.abs(r.ha - r.hb) > 0.01) {
        const pr = parenC.get(paarSleutel(r)); if (pr.hoofd !== r) continue;
        const wm = wandMaten(r, af.grondOp); const g = wm.g; const [a, b] = RAND[r.k];
        const A = W(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]); const B = W(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1]);
        const gL = Math.max(g, Math.round((wm.g0 + ROZET) * 100) / 100); // niet over de voetspindels: vanaf de onderste ligger
        const ta = r.ha - DEK_ROZET; const tb = r.hb - DEK_ROZET; // bovenaan: de rozet van de schuine ligger onder het dek
        if (Math.max(ta, tb) - gL > 0.25) uit.doel({ soort: 'cel', deel: dl.id, s: `${r.s}|zijkant`, rs: r.s, doekSoort: 'zijkant', z0: gL, z1: Math.max(gL, Math.min(ta, tb)), c: [[A[0], A[1], gL], [B[0], B[1], gL], [B[0], B[1], Math.max(gL, tb)], [A[0], A[1], Math.max(gL, ta)]] });
        if (r.leuning) uit.doel({ soort: 'cel', deel: dl.id, s: `${r.s}|leuning`, rs: r.s, doekSoort: 'leuning', z0: Math.max(r.ha, r.hb), z1: Math.max(r.ha, r.hb) + LEUNING_H, c: [[A[0], A[1], r.ha + 0.1], [B[0], B[1], r.hb + 0.1], [B[0], B[1], r.hb + LEUNING_H], [A[0], A[1], r.ha + LEUNING_H]] });
        continue;
      }
      const pr = parenC.get(paarSleutel(r)); if (pr.hoofd !== r && !(pr.tw === r && r.leuning)) continue;
      const wm = wandMaten(r, af.grondOp); const top = r.soort === 'toren' ? r.ha - DEK_ROZET : r.ha;
      const L = pr.hoofd === r ? [wm.g0 + ROZET, ...wandLiggers(st, r, wm), r.ha - DEK_ROZET, top, ...(r.leuning ? (r.rails || []).map((z) => r.ha + z) : [])] : [r.ha, ...(r.rails || []).map((z) => r.ha + z)];
      const lv = [...new Set(L.map((z) => Math.round(z * 100) / 100))].sort((x, y) => x - y);
      const [a, b] = RAND[r.k]; const A = W(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]); const B = W(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1]);
      // Geen wand waar geen staanders staan (midden in een vrije overspanning), en in de opening van een doorgang
      // enkel boven de vrije hoogte: anders ligt er een onzichtbaar vlak voor de binnenkant van de doorgang.
      const knS = new Set(af.knopen.map((n) => `${n.i},${n.j}`));
      if (pr.hoofd === r && ![a, b].every((c) => knS.has(`${r.i + HOEKEN[c][0]},${r.j + HOEKEN[c][1]}`))) continue;
      const dgR = r.doorgang && doorgangOpen(r) ? af.dgVan(r.i, r.j) : null; const vrijTot = dgR ? wm.g + dgR.H : -1;
      for (let q = 0; q < lv.length - 1; q++) { const z0 = lv[q]; const z1 = lv[q + 1]; if (z1 - z0 < 0.25 || z0 < vrijTot - 0.01) continue; uit.doel({ soort: 'cel', deel: dl.id, s: `${r.s}|${z0}|${z1}`, rs: r.s, z0, z1, c: [[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1]] }); }
    }
  }
  for (const r of af.randen) {
    if (r.soort === 'trapblok') continue;
    const [a, b] = RAND[r.k]; const ha = r.ha; const hb = r.hb;
    const ra = ha - DEK_ROZET; const rb = hb - DEK_ROZET; // rozet van de ligger onder het dek
    const A = W(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]); const B = W(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1]);
    const paar = paren.get(paarSleutel(r));
    // Schoren in deze wand zelf aan of uit (st.schoren[rand] = false | true); een klik op een schoor in 3D kiest de wand.
    const handS = st.schoren?.[r.s];
    let nSchoor = 0;
    // Elke schoor kent zijn rozet op staander A (hoek a van de rand) en op staander B: za, zb.
    const opA = (p) => Math.hypot(p[0] - A[0], p[1] - A[1]) < Math.hypot(p[0] - B[0], p[1] - B[1]);
    const schoor = (p, q) => { lijn(p, q, '#9AA3AD', mini ? 0.7 : 1.1); nSchoor++; if (!mini && uit.doel) { const za = Math.round((opA(p) ? p[2] : q[2]) * 100) / 100; const zb = Math.round((opA(p) ? q[2] : p[2]) * 100) / 100; uit.doel({ soort: 'schoor', deel: dl.id, s: `${r.s}|${za}|${zb}`, rs: r.s, za, zb, a: p, b: q }); } };
    // Zelf gezette schoren (st.schoren[rand] = [[za, zb], …]): precies die, van rozet naar rozet.
    const zelfS = Array.isArray(handS) && paar.hoofd === r;
    if (zelfS) for (const [za, zb] of handS) { if (Math.abs(za - zb) < 0.3) continue; stuk(`Schoor ${m2(randL(r))} × ${m2h(Math.abs(zb - za))} m`); schoor([A[0], A[1], za], [B[0], B[1], zb]); }
    if (paar.hoofd === r) {
      // Lager buurvak (bv. een laag podium naast een hoge toren): zijn eigen dekligger op zijn rozet.
      const tw = paar.tw;
      if (tw && tw.soort !== 'toren' && tw.soort !== 'trapblok' && Math.min(ha, hb) - Math.max(tw.ha, tw.hb) > 0.3 && !wandLiggers(st, r, wandMaten(r, af.grondOp)).some((z) => Math.abs(z - (Math.max(tw.ha, tw.hb) - DEK_ROZET)) < 0.05)) {
        const za = tw.hb - DEK_ROZET; const zb = tw.ha - DEK_ROZET; // de tweeling loopt in de andere richting
        stuk(r.k % 2 === 1 ? `U-ligger ${m2(randL(r))} m (onder de vloerdelen)` : `Ligger ${m2(randL(r))} m`);
        if (uit.vloerligger && r.k % 2 === 1) uit.vloerligger([A[0], A[1], za], [B[0], B[1], zb], { helling: Math.abs(za - zb) > 0.01, metaal: isMetaal(st.vakken?.[sleutel(tw.i, tw.j)], st), laag: isMetaal(st.vakken?.[sleutel(tw.i, tw.j)], st) });
        else lijn([A[0], A[1], za], [B[0], B[1], zb], '#7B8591', mini ? 1 : 1.6);
      }
      // Ligger onder het dek, in de rozet op dekhoogte: onder de platen een U-ligger (vloerdrager), anders een buis.
      // In 3D tekent vloerligger() de U-ligger met zijn uitsparingen; het SVG-voorbeeld toont een lijn met een rand.
      // De platen (2,07 × 1,04) liggen dwars en rusten op de liggers in de lengte (randen langs x, k oneven):
      // daar een U-ligger, dwars een gewone buis (zoals op de plannen van Gigant).
      const metL = r.soort === 'vloer' && (isMetaal(st.vakken?.[sleutel(r.i, r.j)], st) || isMetaal(paar.tw && Math.abs(Math.max(paar.tw.ha, paar.tw.hb) - Math.max(ha, hb)) < 0.01 ? st.vakken?.[sleutel(paar.tw.i, paar.tw.j)] : null, st));
      // Geen dekligger waar een tralie- of stalen ligger draagt (vrije overspanning) of waar hij in de grond zou zitten.
      const gR = Math.max(G(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]), G(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1]));
      const dekL = !(r.vrij && r.buiten) && Math.max(ra, rb) > gR - 0.01;
      const alsU = r.soort !== 'toren' && r.soort !== 'tribune' && !r.voetganger && r.k % 2 === 1; // onder de platen een U-ligger (tribune en trapmodule dragen zichzelf)
      if (dekL) stuk(alsU ? (Math.abs(ha - hb) > 0.01 ? `Hellingligger ${m2(randL(r))} m` : `U-ligger ${m2(randL(r))} m (onder de vloerdelen)`) : `Ligger ${m2(randL(r))} m`);
      if (dekL && uit.vloerligger && alsU) uit.vloerligger([A[0], A[1], ra], [B[0], B[1], rb], { helling: Math.abs(ha - hb) > 0.01, metaal: metL, laag: metL });
      else if (dekL) {
        lijn([A[0], A[1], ra], [B[0], B[1], rb], '#7B8591', mini ? 1 : 1.6);
        if (r.buiten && !mini && r.soort !== 'toren' && !(r.soort === 'vloer' && isMetaal(st.vakken?.[sleutel(r.i, r.j)], st))) quad([[A[0], A[1], ha], [B[0], B[1], hb], [B[0], B[1], hb - 0.12], [A[0], A[1], ha - 0.12]], '#B5652F', '#7A3E17');
      }
      // De bovenste ligger (onder het dek of bovenaan een toren) is ook aan te klikken; hij hoort bij het dek.
      if (dekL && !mini && uit.doel) { const zr = Math.round(Math.min(ra, rb) * 100) / 100; uit.doel({ soort: 'ligger', deel: dl.id, s: `${r.s}|${zr}`, rs: r.s, z: zr, vast: true, dek: true, a: [A[0], A[1], ra], b: [B[0], B[1], rb] }); }
      // Een rand die enkel aan een doorgang grenst: open, geen tussenliggers of kruisen (daar loop je door).
      // Enkel de randen dwars op de doorgang (langs x, k oneven) zijn open: daar loop of rij je door. De randen in
      // de looprichting (langs y, tussen de staanders ín de doorgang) krijgen wel hun liggers vanaf de eerste rozet,
      // anders staan die staanders los tot aan het dek.
      const [bi, bj] = [r.i + RICHTING[r.k][0], r.j + RICHTING[r.k][1]]; const nb = st?.vakken?.[sleutel(bi, bj)];
      const wand = doorgangWand(st?.vakken, r); // toren naast de doorgang: binnenkant ook verstevigd
      const open = (r.doorgang || !!nb?.doorgang) && !wand && doorgangOpen(r);
      // Nulpunt van de rozettenreeks (het dek ligt op een rozet; de spindel vangt de rest op).
      const g0 = rozetVoet(Math.max(G(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]), G(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1])), Math.min(ha, hb) - DEK_ROZET);
      const kn = new Set(af.knopen.map((n) => `${n.i},${n.j}`));
      const metStaanders = [a, b].every((c) => kn.has(`${r.i + HOEKEN[c][0]},${r.j + HOEKEN[c][1]}`));
      const dg = open ? (af.dgVan(r.i, r.j) || af.dgVan(bi, bj)) : null;
      if (open && dg && metStaanders && Math.min(ha, hb) - (g0 + dg.H) > 0.4) {
        // Boven de doorgang: gewone stelling vanaf de vrije hoogte (onderste ligger = bovenkant doorgang).
        const hm = rozOnder(g0, Math.min(ra, rb)); const zb = rozBoven(g0, g0 + dg.H);
        for (let z = zb; z < hm - 0.4; z += 2) { stuk(`Ligger ${m2(randL(r))} m`); lijn([A[0], A[1], z], [B[0], B[1], z], '#9AA3AD', mini ? 0.7 : 1.1); }
        if (!zelfS && handS !== false && (handS === true || schoorOpRand(r, hm - zb + 0.4))) { let k2 = 0; for (let z = zb; z < hm - 0.4; z += 2, k2++) { const z2 = Math.min(hm, z + 2); stuk(`Schoor ${m2(randL(r))} × ${m2h(z2 - z)} m`); const [P, Q] = k2 % 2 ? [A, B] : [B, A]; schoor([P[0], P[1], z], [Q[0], Q[1], z2]); } }
      }
      if (!open && metStaanders) {
        // Onderste ligger in de eerste rozet (0,5 m), daarna om de 2 m; de bovenste hangt onder het dek.
        // Enkel tussen twee staanders: midden in een vrije overspanning hangt er niets onder het dek.
        const hm = rozOnder(g0, Math.min(ra, rb)); const z0 = g0 + ROZET;
        const wm = { g0, ra, rb, hm }; const niveaus = wandLiggers(st, r, wm);
        // Een klik op een tussenligger in 3D kiest de wand (zoals een schoor).
        // Op de rozet van een tussenvloer hangt langs x de U-ligger van die vloer (tekent de vloer zelf); kiezen kan wel.
        const vlU = r.k % 2 === 1 ? new Set(wandVloeren(st, r)) : new Set();
        // Elke tussenligger is een eigen onderdeel: aanklikken, verslepen naar een andere rozet, weghalen (Delete).
        // Op de rozet van een tussenvloer hangt langs x de U-ligger van die vloer (vast: hoort bij de vloer).
        for (const z of niveaus) {
          if (!vlU.has(z)) { stuk(`Ligger ${m2(randL(r))} m`); lijn([A[0], A[1], z], [B[0], B[1], z], '#9AA3AD', mini ? 0.7 : 1.1); }
          if (!mini && uit.doel) uit.doel({ soort: 'ligger', deel: dl.id, s: `${r.s}|${z}`, rs: r.s, z, vast: vlU.has(z) || wandVloeren(st, r).includes(z) || wandVloerLeuning(st, r).includes(z), a: [A[0], A[1], z], b: [B[0], B[1], z] });
        }
        // Diagonalen aan de buitenkant, per verdieping van ± 2 m, om en om: van rozet naar rozet.
        // Een wand die hoger dan 1,2 m boven een lager buurvak uitsteekt, krijgt schoren vanaf het dek van die buur.
        // Van ligger naar ligger, om en om (zelf te kiezen: weg, enkel de onderste, altijd).
        const z0s = schoorStart(st, r, paar, wm, wand);
        if (!zelfS && z0s != null) schoorStukken(niveaus, z0s, hm, handS).forEach(([z, z2], k2) => { stuk(`Schoor ${m2(randL(r))} × ${m2h(z2 - z)} m`); const [P, Q] = k2 % 2 ? [A, B] : [B, A]; schoor([P[0], P[1], z], [Q[0], Q[1], z2]); });
      } else if (open && !mini) {
        // Doorgang: de opening aangeven met een stippellijn op de grond (het maaiveld, niet het nulpunt van de rozetten).
        const gz = Math.max(G(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]), G(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1])) + 0.02;
        lijn([A[0], A[1], gz], [B[0], B[1], gz], '#16A34A', 1.4);
      }
    }
    // Leuning langs een helling (of trap): schuine buizen die de helling volgen en horizontale liggers ertussen.
    const hellingLeuning = (T, kl) => {
      const laag = ha <= hb; const [L0, L1, z0, z1] = laag ? [A, B, ha, hb] : [B, A, hb, ha];
      // Schuine buizen evenwijdig met de helling op elke rozet (0,5 / 1 / … m boven het dek), van rozet naar rozet.
      for (let z = ROZET - DEK_ROZET; z <= T + 0.01; z += ROZET) lijn([L0[0], L0[1], z0 + z], [L1[0], L1[1], z1 + z], kl, 1.4, 0.02);
      // Daartussen horizontale liggers op elke rozet die beide staanders delen (zoals op de plannen van Gigant).
      for (let zh = z1 - DEK_ROZET + ROZET; zh <= z0 + T + 0.01; zh += ROZET) if (zh - z0 > ROZET - DEK_ROZET - 0.01) lijn([L0[0], L0[1], zh], [L1[0], L1[1], zh], kl, 1.4, 0.02);
    };
    const schuin = Math.abs(ha - hb) > 0.01;
    if (r.leuning && !(r.soort === 'trap' && r.voetganger)) {
      // Stuklijst van de leuning (de leuning van een voetgangerstrap zit bij de trapmodule; geen kantplank).
      const L = m2(randL(r));
      if (r.lsoort === 'net') stuk(Math.abs(randL(r) - VAK) < 0.01 ? 'Hek 2,07 m verstelbaar (spijlen)' : `Hek ${L} m rooster (spijlen)`);
      else if (r.soort === 'trap' || r.soort === 'helling') stuk(`Trap- of hellingleuning ${L} m`);
      else if (r.lsoort === 'ladder') { stuk(`Ladder ${m2(Math.ceil((Math.max(r.ha, r.hb) + LADDER_BOVEN) * 2) / 2)} m`); stuk(`Leuning dubbel ${L} m (hand + knie)`); }
      else if (r.lsoort === 'frame') { stuk(`Leuningframe ${L} m`); stuk(`Ligger ${L} m (leuning)`); }
      else if (r.lsoort === 'stelling') stuk(`Ligger ${L} m (leuning)`, (r.rails || [0, 0, 0]).length);
      else { const rails = r.rails || [ROZET, 2 * ROZET]; if (rails.length >= 2 && !r.diag) stuk(`Leuning dubbel ${L} m (hand + knie)`); else stuk(`Ligger ${L} m (leuning)`, rails.length); if (r.diag) stuk(`Leuningdiagonaal ${L} m (schuine legger)`); }
    }
    if (r.leuning) {
      const la = r.la ?? LEUNING_H; const lb = r.lb ?? LEUNING_H;
      if (r.lsoort === 'ladder') {
        // Een gewone leuning (hand + knie + kantplank) met een ladder die er van buiten tegen staat, van de grond
        // tot 1 m boven het dek en licht schuin. De leuning loopt gewoon door (de ladder staat er enkel tegen).
        for (const z of r.rails || [la / 2, la]) lijn([A[0], A[1], ha + z], [B[0], B[1], hb + z], '#4B5563', 1.4, 0.02);
        if (r.diag) lijn([A[0], A[1], ha + r.diag[0]], [B[0], B[1], hb + r.diag[1]], '#4B5563', 1.4, 0.02);
        const P = (f, z) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, z];
        const nx = RICHTING[r.k][0]; const ny = RICHTING[r.k][1]; const g = G(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]); const top = ha + LADDER_BOVEN; const uit2 = 0.25 * (top - g) / 3;
        const stijl = (f) => { const p = P(f, 0); return [[p[0] + nx * uit2, p[1] + ny * uit2, g], [p[0] + nx * 0.08, p[1] + ny * 0.08, top]]; };
        const s0 = stijl(0.38); const s1 = stijl(0.62);
        if (uit.ladder) { if (!mini) uit.ladder({ s0, s1, n: [nx, ny] }); }
        else {
          // In stukjes: een lange lijn sorteert slecht en tekent dan dwars over het dek.
          // In het kleine voorbeeld (zweefkaartje) geen ladder: die tekent er enkel streepjes dwars over het dek.
          if (!mini) for (const sl of [s0, s1]) { const n = 8; for (let q = 0; q < n; q++) { const m = (t) => [sl[0][0] + (sl[1][0] - sl[0][0]) * t, sl[0][1] + (sl[1][1] - sl[0][1]) * t, sl[0][2] + (sl[1][2] - sl[0][2]) * t]; lijn(m(q / n), m((q + 1) / n), '#B45309', 1.8, -0.02); } }
          if (!mini) for (let z = 0.3; z < top - g; z += 0.3) { const t = z / (top - g); const m = (sl) => [sl[0][0] + (sl[1][0] - sl[0][0]) * t, sl[0][1] + (sl[1][1] - sl[0][1]) * t, g + z]; lijn(m(s0), m(s1), '#B45309', 1, -0.02); }
        }
      } else if (r.lsoort === 'frame') {
        // Leuningframe: een kader van ± 0,3 m hoog bovenaan, met daaronder de knieligger in de rozet.
        const rails = r.rails || [0.8, 1.3]; const top = Math.max(...rails);
        for (const z of rails.slice(0, -1)) lijn([A[0], A[1], ha + z], [B[0], B[1], hb + z], '#4B5563', 1.4, 0.02);
        const d = 0.12; const P = (f, z) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, (ha + (hb - ha) * f) + z];
        for (const z of [top, top - 0.3]) lijn(P(d / 2.07, z), P(1 - d / 2.07, z), '#7FB3D5', 1.4, 0.02);
        for (const f of [d / 2.07, 1 - d / 2.07]) lijn(P(f, top - 0.3), P(f, top), '#7FB3D5', 1.2, 0.02);
        lijn(A.concat(ha + top), P(d / 2.07, top), '#7FB3D5', 1.2, 0.02); lijn(P(1 - d / 2.07, top), B.concat(hb + top), '#7FB3D5', 1.2, 0.02);
      } else if (r.lsoort === 'stelling') {
        // Stellingleuning van een rennersbrug: drie buizen, horizontaal in de rozetten (0,5 / 1 / 1,5 m boven het dek);
        // langs een helling loopt enkel de bovenste schuin mee.
        if (schuin) hellingLeuning(Math.max(...(r.rails || [1.5])), '#4B5563');
        else for (const z of r.rails || [0.5, 1, 1.5]) lijn([A[0], A[1], ha + z], [B[0], B[1], hb + z], '#4B5563', 1.4, 0.02);
      } else if (r.lsoort === 'net') {
        // Hekje met spijlen: boven- en onderbuis met verticale spijlen om de ± 12 cm.
        lijn([A[0], A[1], ha + la], [B[0], B[1], hb + lb], '#2F6F68', 1.6, 0.02);
        lijn([A[0], A[1], ha + 0.1], [B[0], B[1], hb + 0.1], '#2F6F68', 1.2, 0.02);
        const Lr = Math.hypot(B[0] - A[0], B[1] - A[1]); const n = mini ? Math.round(Lr / 0.4) : Math.round(Lr / 0.12);
        for (let q = 1; q < n; q++) { const f = q / n; const px = A[0] + (B[0] - A[0]) * f; const py = A[1] + (B[1] - A[1]) * f; const z0 = ha + (hb - ha) * f; lijn([px, py, z0 + 0.1], [px, py, z0 + la + (lb - la) * f], '#3F5F7A', mini ? 0.5 : 0.7, 0.02); }
      } else {
        // Horizontaal in de rozetten (0,5 m en 1 m boven het dek); bij een korte staander een schuine legger.
        const kl = r.lsoort === 'laag' ? '#B45309' : '#4B5563';
        if (schuin && !r.diag) hellingLeuning(Math.max(...(r.rails || [la])), kl);
        else for (const z of r.rails || [la / 2, la]) lijn([A[0], A[1], ha + z], [B[0], B[1], hb + z], kl, 1.4, 0.02);
        if (r.diag) lijn([A[0], A[1], ha + r.diag[0]], [B[0], B[1], hb + r.diag[1]], kl, 1.4, 0.02);
      }
    }
  }
  // Doeken: per doorlopend stuk (zelfde zijde) één doek, met het ontwerp over de hele lengte.
  // Een zijkant of band volgt de helling (schuine kant), een doek op een doorgang hangt van de vrije hoogte tot het dek.
  for (const d of st?.doeken || []) {
    const ont = d.voor ? doekMap.get(d.voor) : null; const kl = ont?.eigenschappen?.kleur || d.kleur || '#FFFFFF'; // zonder ontwerp: wit canvas
    if (d.soort === 'dak') {
      // Doek bovenop een toren: horizontaal op de bovenste liggers, per vak.
      for (const key of d.vakken || []) { const v = st.vakken?.[key]; if (!v) continue; const [i, j] = uitSleutel(key); stuk(`Doek bovenop ${m2(M.bx(i))} × ${m2(M.by(j))} m`); const z = (v.soort === 'toren' ? Number(v.h) - DEK_ROZET : Number(v.h) + LEUNING_H) + 0.03;
        const c = HOEKEN.map(([u, w]) => { const [x, y] = W(i + u, j + w); return [x, y, z]; });
        quad(c, kl, '#9CA3AF', { fillOpacity: ont ? 0.85 : 1 }); }
      continue;
    }
    const src = ont?.eigenschappen?.beeld ? publiekeUrl(ont.eigenschappen.beeld) : null;
    for (const rs of d.randen || []) { const rr = af.randen.find((x) => x.s === rs); if (rr) stuk(`Doek ${{ zijkant: 'zijkant', band: 'band onder het dek', onder: 'onderste 2 m', doorgang: 'boven doorgang', vlak: 'tussen liggers' }[d.soort] || 'leuning'} ${m2(randL(rr))} m${Math.abs(rr.ha - rr.hb) > 0.01 ? ' (schuin gesneden)' : ''}`); }
    // Eén ontwerp over alle aansluitende vakken van het doek.
    for (const stuk of doekStukken(d, af)) {
      // Tussen liggers: begrensd tot wat er op die wand kan (van de grond tot de bovenkant van de staanders).
      const zz = (r, hh) => { if (d.soort === 'vlak') { const wm = wandMaten(r, af.grondOp); const kn = [RAND[r.k][0], RAND[r.k][1]].map((c) => af.knopen.find((n) => n.i === r.i + HOEKEN[c][0] && n.j === r.j + HOEKEN[c][1])).filter(Boolean); const tp = kn.length ? Math.max(...kn.map((n) => n.top)) : hh; return [Math.max(wm.g0 + ROZET, Number(d.van ?? wm.g0 + ROZET)), Math.min(tp, Number(d.tot ?? hh - DEK_ROZET))]; } const gz = grondVan(st.vakken?.[sleutel(r.i, r.j)]); const dg = af.dgVan(r.i, r.j);
        // Een zijkant of onderste doek laat de opening van een doorgang vrij.
        // Nooit over de voetspindels: een doek begint op de onderste ligger (eerste rozet).
        const gL = Math.max(gz, wandMaten(r, af.grondOp).g0 + ROZET);
        const vrijTot = dg && r.doorgang ? gz + dg.H : gL;
        return d.soort === 'zijkant' ? [vrijTot, Math.max(vrijTot, hh - DEK_ROZET)] : d.soort === 'band' ? [Math.max(vrijTot, hh - 1), hh] : d.soort === 'onder' ? (dg && r.doorgang ? [hh, hh] : [gL, Math.min(hh, gL + 2)]) : d.soort === 'doorgang' ? [Math.min(hh - 0.1, gz + (dg ? dg.H : 0)), hh - 0.05] : [hh + 0.1, hh + LEUNING_H]; };
      // Het doek leest van links naar rechts voor wie aan zijn kant staat (buiten = de kant van de rand, binnen = de
      // andere): per rand de hoeken in die richting en de randen op volgorde van links naar rechts.
      const kz = d.kant === 'binnen' ? -1 : 1;
      // De kant geldt voor de eerste rand van het doek; een rand verderop op dezelfde lijn die bij het buurvak hoort
      // (andere k), krijgt dezelfde kant (anders hing dat stuk aan de andere zijde).
      const nVan = (r) => { const [a0, b0] = RAND[r.k]; const C0 = W(r.i + (HOEKEN[a0][0] + HOEKEN[b0][0]) / 2, r.j + (HOEKEN[a0][1] + HOEKEN[b0][1]) / 2); const C1 = W(r.i + (HOEKEN[a0][0] + HOEKEN[b0][0]) / 2 + RICHTING[r.k][0] * 0.1, r.j + (HOEKEN[a0][1] + HOEKEN[b0][1]) / 2 + RICHTING[r.k][1] * 0.1); const nl = Math.hypot(C1[0] - C0[0], C1[1] - C0[1]) || 1; return [((C1[0] - C0[0]) / nl) * kz, ((C1[1] - C0[1]) / nl) * kz]; };
      const ref = af.randen.find((x) => x.s === (d.randen || [])[0]); const nRef = ref ? nVan(ref) : null;
      const delen2 = stuk.map((r) => {
        const [a0, b0] = RAND[r.k]; let A = W(r.i + HOEKEN[a0][0], r.j + HOEKEN[a0][1]); let B = W(r.i + HOEKEN[b0][0], r.j + HOEKEN[b0][1]); let ha = r.ha; let hb = r.hb;
        let n = nVan(r); if (nRef && n[0] * nRef[0] + n[1] * nRef[1] < -0.5) n = [-n[0], -n[1]];
        const rechts = [-n[1], n[0]]; // wie naar de wand kijkt (van kant n), heeft rechts deze richting
        if ((B[0] - A[0]) * rechts[0] + (B[1] - A[1]) * rechts[1] < 0) { [A, B] = [B, A]; [ha, hb] = [hb, ha]; }
        return { r, A, B, ha, hb, n, rechts, p: ((A[0] + B[0]) / 2) * rechts[0] + ((A[1] + B[1]) / 2) * rechts[1] };
      }).sort((x, y) => x.p - y.p);
      const top = []; const bot = [];
      delen2.forEach(({ r, A, B, ha, hb, n: nv }, q) => {
        const nx = nv[0] * 0.03; const ny = nv[1] * 0.03; // buiten- of binnenkant van de leuning
        const [z0a, z1a] = zz(r, ha); const [z0b, z1b] = zz(r, hb);
        if (q === 0) { top.push([A[0] + nx, A[1] + ny, z1a]); bot.push([A[0] + nx, A[1] + ny, z0a]); }
        top.push([B[0] + nx, B[1] + ny, z1b]); bot.push([B[0] + nx, B[1] + ny, z0b]);
      });
      const vorm = [...top, ...bot.reverse()];
      if (src) uit.beeld({ vorm, top, bot: vorm.slice(top.length).reverse(), src, kl, n: delen2[0]?.n, id: `fm-dk-${d.id}-${stuk[0].s.replace(/[^0-9a-z-]/gi, '_')}` });
      else quad(vorm, kl, ont ? '#0B4F4A' : '#9CA3AF', { fillOpacity: ont ? 0.85 : 1 });
      // Gekozen doek (branding): blauwe rand er net voor.
      if (d.gekozen) { const nv = delen2[0]?.n || [0, 0]; const o = (q) => [q[0] + nv[0] * 0.03, q[1] + nv[1] * 0.03, q[2]]; for (let q = 0; q < vorm.length; q++) lijn(o(vorm[q]), o(vorm[(q + 1) % vorm.length]), '#2563EB', 3); }
    }
  }
  // Vrije overspanning, per liggersoort.
  for (const sp of af.spannen) {
    const r0 = sp.randen[0]; const r1 = sp.randen[sp.randen.length - 1];
    // De randen liggen op oplopende i of j, maar RAND[1] en RAND[2] lopen van hoog naar laag: daar begint de ligger
    // in hoek b van de eerste rand en eindigt hij in hoek a van de laatste (anders mist het eerste en laatste stuk).
    const keer = sp.k === 1 || sp.k === 2;
    const c0 = RAND[r0.k][keer ? 1 : 0]; const c1 = RAND[r1.k][keer ? 0 : 1];
    const A = W(r0.i + HOEKEN[c0][0], r0.j + HOEKEN[c0][1]); const B = W(r1.i + HOEKEN[c1][0], r1.j + HOEKEN[c1][1]);
    const h0 = keer ? r0.hb : r0.ha; const h1 = keer ? r1.ha : r1.hb; const D = sp.D; const w = mini ? 0.6 : 1;
    const P = (f, z, Q0 = A, Q1 = B) => [Q0[0] + (Q1[0] - Q0[0]) * f, Q0[1] + (Q1[1] - Q0[1]) * f, z + (h0 + (h1 - h0) * f)];
    if (sp.ligger === 'ipe') {
      // IPE 270 onder elke staanderrij: enkel aan de lage kant tekenen we alle rijen (anders dubbel).
      if (sp.k !== 3 && sp.k !== 2) continue;
      stuk(`IPE 270-overspanningsbalk ${m2(sp.lengte)} m`, sp.rijen + 1);
      for (let t = 0; t <= sp.rijen; t++) {
        const Q0 = sp.k === 3 ? W(r0.i, r0.j + t) : W(r0.i + t, r0.j); const Q1 = sp.k === 3 ? W(r1.i + 1, r1.j + t) : W(r1.i + t, r1.j + 1);
        quad([P(0, -0.12, Q0, Q1), P(1, -0.12, Q0, Q1), P(1, -D, Q0, Q1), P(0, -D, Q0, Q1)], '#3E4C5E', '#1F2937');
      }
      continue;
    }
    if (sp.ligger === 'rooster') { stuk(`Roosterligger 0,19 m · ${m2(sp.lengte)} m`); quad([P(0, -0.05), P(1, -0.05), P(1, -D), P(0, -D)], '#9AA3AD', '#5F6B78', { fillOpacity: 0.85 }); continue; }
    if (sp.ligger === 'vakwerk') {
      // Vakwerk uit stellingdelen: boven- en onderligger, hangende staanders op elke knoop en een schoor per vak.
      lijn(P(0, -0.05), P(1, -0.05), '#7B8591', mini ? 1 : 1.6, 0.01); lijn(P(0, -D), P(1, -D), '#7B8591', mini ? 1 : 1.6, 0.01);
      let acc = 0; const L = sp.lengte || 1;
      const nl = Math.max(1, Math.round(D / 2)); const dz = (D - 0.05) / nl;
      { const hz = m2(Math.round((sp.D / nl) * 2) / 2); for (const r of sp.randen) { stuk(`Ligger ${m2(randL(r))} m (vakwerk)`, nl + 1); stuk(`Schoor ${m2(randL(r))} × ${hz} m (vakwerk)`, nl); }
        for (let q = 0; q <= sp.randen.length; q++) for (const l of opdelen(Math.max(0.5, Math.round(sp.D * 2) / 2))) stuk(`Staander ${m2(l)} m (hangend, vakwerk)`); }
      for (let t = 1; t < nl; t++) lijn(P(0, -0.05 - t * dz), P(1, -0.05 - t * dz), '#7B8591', mini ? 0.8 : 1.3, 0.01);
      sp.randen.forEach((r, q) => {
        const l = r.k % 2 === 0 ? M.by(r.j) : M.bx(r.i); const f0 = acc / L; const f1 = (acc + l) / L; acc += l;
        lijn(P(f1, -0.05), P(f1, -D), '#5F6B78', mini ? 0.8 : 1.8, 0.01);
        for (let t = 0; t < nl; t++) { const za = -0.05 - t * dz; const zb = za - dz; lijn(P((q + t) % 2 ? f0 : f1, za), P((q + t) % 2 ? f1 : f0, zb), '#9AA3AD', w * 1.1, 0.01); }
      });
      lijn(P(0, -0.05), P(0, -D), '#5F6B78', mini ? 0.8 : 1.8, 0.01);
      continue;
    }
    stuk(`Tralieligger ${m2(sp.lengte)} m (vrije overspanning)`);
    lijn(P(0, -0.05), P(1, -0.05), '#8FA9C4', mini ? 1 : 1.8, 0.01); lijn(P(0, -D), P(1, -D), '#8FA9C4', mini ? 1 : 1.8, 0.01);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]); const n = Math.max(2, Math.round(L / Math.max(0.5, D * 1.1)));
    for (let q = 0; q < n; q++) lijn(P(q / n, q % 2 ? -D : -0.05), P((q + 1) / n, q % 2 ? -0.05 : -D), '#8FA9C4', w, 0.01);
  }
  // Aanloopplaat: van de voet van de helling schuin naar de grond.
  for (const a of af.aanloop) {
    const [c0, c1] = RAND[a.k]; const P = W(a.i + HOEKEN[c0][0], a.j + HOEKEN[c0][1]); const Q = W(a.i + HOEKEN[c1][0], a.j + HOEKEN[c1][1]);
    const dx = RICHTING[a.k][0]; const dy = RICHTING[a.k][1]; const L = a.L || AANLOOP;
    stuk(`${a.trap ? 'Uitloopplaat trap' : 'Aanloopplaat'} ${m2(a.L)} m × ${m2(a.k % 2 === 0 ? M.by(a.j) : M.bx(a.i))} m breed`);
    const E = (p) => { const b = W(a.i + 0.5 + dx * 0.5, a.j + 0.5 + dy * 0.5); const m = W(a.i + 0.5, a.j + 0.5); const ux = b[0] - m[0]; const uy = b[1] - m[1]; const n = Math.hypot(ux, uy) || 1; return [p[0] + (ux / n) * L, p[1] + (uy / n) * L]; };
    const P2_ = E(P); const Q2 = E(Q);
    quad([[P[0], P[1], a.z], [Q[0], Q[1], a.z], [Q2[0], Q2[1], a.g + 0.02], [P2_[0], P2_[1], a.g + 0.02]], '#B98B5E', '#6B4423');
  }
  // Opstaptrede voor het laagste bordes van een voetgangerstrap.
  for (const o of af.opstap) {
    const [c0, c1] = RAND[o.k]; const P = W(o.i + HOEKEN[c0][0], o.j + HOEKEN[c0][1]); const Q = W(o.i + HOEKEN[c1][0], o.j + HOEKEN[c1][1]);
    const m = W(o.i + 0.5, o.j + 0.5); const b = W(o.i + 0.5 + RICHTING[o.k][0] * 0.5, o.j + 0.5 + RICHTING[o.k][1] * 0.5); const n = Math.hypot(b[0] - m[0], b[1] - m[1]) || 1;
    const E = (p, f) => [p[0] + ((b[0] - m[0]) / n) * OPSTAP * f, p[1] + ((b[1] - m[1]) / n) * OPSTAP * f];
    const zt = o.g + (o.z - o.g) / 2;
    stuk(`TRAPB 1,03 × 0,33 m (opstap, ${m2(o.k % 2 === 0 ? M.by(o.j) : M.bx(o.i))} m breed)`);
    quad([[...E(P, 0), zt], [...E(Q, 0), zt], [...E(Q, 1), zt], [...E(P, 1), zt]], '#8FB5A8', '#4F7F70');
    quad([[...E(P, 1), o.g], [...E(Q, 1), o.g], [...E(Q, 1), zt], [...E(P, 1), zt]], '#7FA597', '#4F7F70');
  }
  // Portaal boven het dek.
  {
    const P = af.portaal;
    for (const p of P.knopen.values()) { for (const l of opdelen(Math.max(0.5, Math.round((p.T - p.h) * 2) / 2))) stuk(`Staander ${m2(l)} m (portaal)`); const [x, y] = W(p.i, p.j); lijn([x, y, p.h], [x, y, p.T], '#5F6B78', mini ? 1.1 : 2); if (!mini) uit.pen?.([x, y, p.T]); }
    for (const r of P.randen) {
      const [a, b] = RAND[r.k]; const A = W(r.i + HOEKEN[a][0], r.j + HOEKEN[a][1]); const B = W(r.i + HOEKEN[b][0], r.j + HOEKEN[b][1]);
      // Portaal: liggers in de rozetten (bovenaan en halverwege) en één schoor per zijde, om en om (zoals Gigant),
      // van de rozet boven de leuning (± 1,5 m boven het dek) naar de bovenste rozet. Waar het dek verder loopt
      // (bv. de trap op): enkel de bovenste ligger, anders lopen mensen met hun hoofd tegen de schoor.
      { const L = m2(randL(r)); stuk(`Ligger ${L} m (portaal)`, r.door ? 1 : 2); if (!r.door) stuk(`Schoor ${L} × 2,00 m (portaal)`); }
      const Tz = rozOnder(r.h - DEK_ROZET, r.T); const zm = rozOp(r.h - DEK_ROZET, r.h + (Tz - r.h) / 2); const z0 = r.h + 1.3;
      lijn([A[0], A[1], Tz], [B[0], B[1], Tz], '#7B8591', mini ? 1 : 1.6); if (!r.door && zm < Tz - 0.4 && zm > r.h + 0.4) lijn([A[0], A[1], zm], [B[0], B[1], zm], '#9AA3AD', mini ? 0.7 : 1.1);
      if (!r.door && Tz - z0 > 0.4) { const [P0, Q0] = (r.i + r.j) % 2 ? [A, B] : [B, A]; lijn([P0[0], P0[1], z0], [Q0[0], Q0[1], Tz], '#9AA3AD', mini ? 0.6 : 1); }
    }
    // Bovenaan één horizontale diagonaal per vak, om en om.
    stuk('Horizontale diagonaal 2,07 m (portaal)', P.vakken.length);
    for (const v of P.vakken) { const T = rozOnder(v.h - DEK_ROZET, v.h + Number(v.portaal)); const c = HOEKEN.map(([u, w]) => W(v.i + u, v.j + w)); const [p0, q0] = (v.i + v.j) % 2 ? [c[0], c[2]] : [c[1], c[3]]; lijn([...p0, T], [...q0, T], '#9AA3AD', mini ? 0.6 : 1); }
  }
  });
  // TV-camera op statief op het dek (st.camera): drie poten, kolom, camerabody met lens, en de kijkhoek als een
  // doorschijnende sector op het dek (zoals op de kaarttekening van een camerastelling).
  const cp = cameraPlek(stAlles);
  if (cp) {
    const [cx, cy] = cp.W; const [dx, dy] = cp.dW; const rx = dy; const ry = -dx; // rechts van de kijkrichting
    const P0 = (l, v, z) => [cx + rx * l + dx * v, cy + ry * l + dy * v, z];
    const op0 = stAlles.camera?.op || 'statief';
    // Handheld: de camera ligt op de rechterschouder van de cameraman, dus iets naar rechts.
    const lOff = op0 === 'los' ? 0.2 : 0; const P = (l, v, z) => P0(l + lOff, v, z); const z0 = cp.h; const zk = z0 + (op0 === 'los' ? CAMERA_OOG : op0 === 'kraan' ? CAMERA_OOG : 1.2); const kl = '#111827'; const rand = '#0B0F19';
    // Kijkhoek op het dek.
    const n = mini ? 6 : 12; const sec = [P(0, 0, z0 + 0.015)];
    for (let k = 0; k <= n; k++) { const a = ((-CAMERA_SECTOR.hoek + (2 * CAMERA_SECTOR.hoek * k) / n) * Math.PI) / 180; sec.push(P(Math.sin(a) * CAMERA_SECTOR.r, Math.cos(a) * CAMERA_SECTOR.r, z0 + 0.015)); }
    quad(sec, '#FDE68A', '#B45309', { fillOpacity: 0.5, strokeOpacity: 0.9 });
    const op = stAlles.camera?.op || 'statief';
    // Cameraman: in 3D een echte figuur (uit.persoon), in de tekening en het mini-voorbeeld een eenvoudig silhouet.
    if (uit.persoon && op !== 'kraan') uit.persoon({ p: P0(0, op === 'los' ? -0.08 : -0.62, z0), d: [dx, dy], houding: op === 'los' ? 'schouder' : 'statief', hand: P(0, -0.25, zk + 0.05) });
    if (op === 'los') {
      // Handheld: de cameraman staat op het dek met de camera op de schouder (± 1,5 m).
      const g = '#6B7280';
      if (!uit.persoon) lijn(P0(-0.1, -0.1, z0), P0(0, -0.08, z0 + 0.85), g, mini ? 1 : 2.2);
      if (!uit.persoon) { lijn(P0(0.1, -0.1, z0), P0(0, -0.08, z0 + 0.85), g, mini ? 1 : 2.2); lijn(P0(0, -0.08, z0 + 0.85), P0(0, -0.08, zk - 0.05), g, mini ? 1.4 : 3); lijn(P0(0, -0.08, zk + 0.05), P0(0, -0.08, zk + 0.3), '#9CA3AF', mini ? 2 : 5); }
    } else if (op === 'kraan') {
      // Kraan (jib): statief met kolom, arm van ± 1 m achter (tegengewicht) tot 3 m voor, de camera onder de kop.
      const kz = z0 + 1.2;
      for (const a of [0, 120, 240]) { const r = (a * Math.PI) / 180; lijn(P(Math.sin(r) * 0.6, Math.cos(r) * 0.6 - 0.8, z0), P(0, -0.8, kz - 0.2), '#2B2F36', mini ? 0.7 : 1); }
      lijn(P(0, -0.8, kz - 0.2), P(0, -0.8, kz), '#2B2F36', mini ? 1 : 1.6);
      lijn(P(0, -1.8, kz - 0.25), P(0, 0, zk + 0.45), '#9CA3AF', mini ? 1.2 : 2.2);
      quad([P(-0.15, -1.95, kz - 0.55), P(0.15, -1.95, kz - 0.55), P(0.15, -1.7, kz - 0.55), P(-0.15, -1.7, kz - 0.55)], '#374151', '#111827');
      for (const [l0, l1] of [[-0.15, 0.15]]) { quad([P(l0, -1.95, kz - 0.55), P(l1, -1.95, kz - 0.55), P(l1, -1.95, kz - 0.25), P(l0, -1.95, kz - 0.25)], '#374151', '#111827'); }
      lijn(P(0, 0, zk + 0.45), P(0, 0, zk + 0.22), '#2B2F36', mini ? 0.8 : 1.2);
    } else {
      // Statief: drie poten (een naar voren, twee naar achteren) tot de kop op 1,35 m, daarop de kolom met de camera.
      const kop = P(0, 0, zk - 0.15);
      for (const a of [0, 120, 240]) { const r = (a * Math.PI) / 180; lijn(P(Math.sin(r) * 0.45, Math.cos(r) * 0.45, z0), kop, '#2B2F36', mini ? 0.6 : 0.85); }
      lijn(kop, P(0, 0, zk), '#2B2F36', mini ? 0.8 : 1.2);
    }
    // Body 0,44 breed × 0,30 lang × 0,22 hoog, de lens 0,16 × 0,15 ervoor.
    const blok = (l0, l1, v0, v1, za, zb, vul) => {
      quad([P(l0, v0, zb), P(l1, v0, zb), P(l1, v1, zb), P(l0, v1, zb)], vul, rand);
      quad([P(l0, v0, za), P(l1, v0, za), P(l1, v0, zb), P(l0, v0, zb)], vul, rand); quad([P(l0, v1, za), P(l1, v1, za), P(l1, v1, zb), P(l0, v1, zb)], vul, rand);
      quad([P(l0, v0, za), P(l0, v1, za), P(l0, v1, zb), P(l0, v0, zb)], vul, rand); quad([P(l1, v0, za), P(l1, v1, za), P(l1, v1, zb), P(l1, v0, zb)], vul, rand);
    };
    // Broadcastcamera (zoals een Sony HDC): smalle, lange body, lange zoomlens met een zonnekap, zoeker bovenop
    // links vooraan en een draaghandvat. Geen fototoestel.
    blok(-0.08, 0.08, -0.28, 0.12, zk, zk + 0.24, kl);
    blok(-0.05, 0.05, 0.12, 0.44, zk + 0.06, zk + 0.16, '#1F2937');
    blok(-0.08, 0.08, 0.44, 0.5, zk + 0.02, zk + 0.2, '#0B0F19');
    blok(-0.14, -0.05, -0.02, 0.16, zk + 0.27, zk + 0.35, '#1F2937');
    blok(0.05, 0.1, 0.14, 0.26, zk - 0.02, zk + 0.12, '#111827');
    lijn(P(0, -0.18, zk + 0.24), P(0, -0.18, zk + 0.33), '#111827', mini ? 0.8 : 1.6); lijn(P(0, -0.18, zk + 0.33), P(0, 0.06, zk + 0.33), '#111827', mini ? 0.8 : 1.6); lijn(P(0, 0.06, zk + 0.33), P(0, 0.06, zk + 0.24), '#111827', mini ? 0.8 : 1.6);
    if (!mini && uit.doel) uit.doel({ soort: 'camera', deel: cp.deel, s: 'camera', p: P(0, 0, zk + 0.11) });
  }
  // Wig in de knik (passtuk).
  for (const dl of delen) if (dl.wig) {
    const w = dl.wig; quad(w.punten.map(([x, y]) => [x, y, w.h]), '#C8A36F', '#6B4423');
    { const Lm = (p1, p2) => m2(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])); const lagen = 1 + Math.max(0, Math.floor((w.h - 0.4) / 2));
      for (const [p1, p2] of w.randen || []) stuk(`Leuning passtuk ${Lm(p1, p2)} m (${w.lsoort === 'net' ? 'spijlenhek' : 'buizen'})`);
      w.punten.forEach((a, k) => { const b = w.punten[(k + 1) % w.punten.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= 0.05) stuk(`Ligger ${Lm(a, b)} m (passtuk)`, lagen); });
      for (const [a, b] of w.randen || []) stuk(`Schoor ${Lm(a, b)} × 2,00 m (passtuk)`, Math.max(1, Math.round(w.h / 2)));
      stuk(`Passtuk stelling ${m2(w.breedte)} m breed (hoek ${Math.round(Math.abs(dl.hoek))}°)`); }
    // Stelling onder het passtuk: staanders op de hoeken, liggers om de 2 m en schoren in de open zijden.
    for (const c of w.punten) { lijn([c[0], c[1], 0], [c[0], c[1], w.h], '#5F6B78', mini ? 1.1 : 2.2); if (!mini) uit.voet([c[0], c[1], 0], { h: w.h, wiel: !!stAlles.wielen }); }
    const zijden = w.punten.map((p, k) => [p, w.punten[(k + 1) % w.punten.length]]);
    for (const [p, q] of zijden) {
      lijn([p[0], p[1], rozOp(0, w.h)], [q[0], q[1], rozOp(0, w.h)], '#7B8591', mini ? 1 : 1.6);
      for (let z = ROZET; z < w.h - 0.4; z += 2) lijn([p[0], p[1], z], [q[0], q[1], z], '#9AA3AD', mini ? 0.7 : 1.1);
    }
    for (const [p, q] of w.randen || []) { let k2 = 0; for (let z = ROZET; z < w.h - 0.4; z += 2, k2++) { const z2 = Math.min(rozOnder(0, w.h), z + 2); const [P, Q] = k2 % 2 ? [p, q] : [q, p]; lijn([P[0], P[1], z], [Q[0], Q[1], z2], '#9AA3AD', mini ? 0.7 : 1.1); } }
    // Leuning rond de knik: langs de buitenbocht (en de binnenkant van een passtuk), met staanders op de hoeken.
    const lh = leuningHoogte(w.lsoort);
    for (const [p, q] of w.randen || []) {
      for (const c of [p, q]) lijn([c[0], c[1], w.h], [c[0], c[1], w.h + lh], '#5F6B78', mini ? 1.1 : 2.2);
      if (w.lsoort === 'net') {
        lijn([p[0], p[1], w.h + lh], [q[0], q[1], w.h + lh], '#2F6F68', 1.6, 0.02); lijn([p[0], p[1], w.h + 0.1], [q[0], q[1], w.h + 0.1], '#2F6F68', 1.2, 0.02);
        const n = Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / (mini ? 0.4 : 0.12)); for (let k = 1; k < n; k++) { const f = k / n; lijn([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, w.h + 0.1], [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, w.h + lh], '#3F5F7A', mini ? 0.5 : 0.7, 0.02); }
      } else {
        for (const f of w.lsoort === 'stelling' ? [1, 0.69, 0.35] : [1, 0.5]) lijn([p[0], p[1], w.h + lh * f], [q[0], q[1], w.h + lh * f], f === 1 ? '#4B5563' : '#6B7280', f === 1 ? 1.4 : 1, 0.02);
      }
    }
  }
}


// Stuklijst van de hele constructie, uit de scène zelf: wat getekend wordt, wordt besteld. [{ naam, aantal }]
// De schoren van één wand zoals ze nu getekend worden (automatisch of zelf gezet): [[za, zb], …].
export function wandSchoren(st, deelId, rs) {
  const delen = delenVan2(st); const afs = delen.map((dl) => afgeleid2(dl.d, { verbonden: dl.verbonden })); const uitL = []; const niets = () => {};
  bouwScene({ st, delen, afs, mini: false }, { quad: niets, lijn: niets, voet: niets, rozet: niets, beeld: niets, label: niets, pen: niets, stuk: niets, doel: (t) => { if (t.soort === 'schoor' && t.rs === rs && (t.deel ?? '0') === (deelId ?? '0')) uitL.push([t.za, t.zb]); } });
  return uitL;
}
export function stellingStuklijst(st) {
  const delen = delenVan2(st); const afs = delen.map((dl) => afgeleid2(dl.d, { verbonden: dl.verbonden }));
  const t = new Map(); const niets = () => {};
  bouwScene({ st, delen, afs, mini: false }, { quad: niets, lijn: niets, voet: niets, rozet: niets, beeld: niets, label: niets, pen: niets, stuk: (naam, n) => t.set(naam, (t.get(naam) || 0) + n) });
  return [...t.entries()].map(([naam, aantal]) => ({ naam, aantal }));
}
