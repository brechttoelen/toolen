'use client';

// Stroomplanning: bron → kast → verbruiker, als boom via velden.stroom.voeding.
// Dit is een planningshulp, geen keuring. Spanningsval, beveiliging en keuring
// blijven bij de elektricien of de verhuurder.
//
// items.velden.stroom = {
//   rol: 'bron' | 'kast' | 'verbruiker' | 'kabel',
//   kva, cosphi, liter_per_uur        (bron)
//   ampere                            (kast: ingang; verbruiker: aansluiting; kabel: max stroom)
//   kw, fase: 'L1'|'L2'|'L3'|'3F'     (verbruiker)
//   voeding: item_id                  (kast/verbruiker: wie voedt dit)
//   aansluitingen: [{ voeding, kw, fase }]  (verbruiker met meerdere aansluitingen, bv. podium 32 A + 63 A:
//                                     elke aansluiting is een eigen knoop '<item_id>#<i>' met eigen voeding en kabel)
//   ingang, uitgangen: [{ type, aantal, doorlus? }]  (kast/bron: stekker en stopcontacten; bron zonder opgave
//                                     krijgt de standaard volgens kVA, zie standaardUitgangen)
//   invoer: true                      (kast in een binnenplan waar de stroom het gebouw binnenkomt: één
//                                     doorlus-uitgang van het type van de ingang)
//   van, naar: item_id, kabeltype     (kabel; naar mag '<item_id>#<i>' zijn)
// }
// Een stekkerdoos (bibliotheek: eigenschappen.stekkerdoos) is een kleine kast: ingang Schuko of
// CEE 16A mono, uitgangen n × Schuko. Items in een binnenplan (velden.binnen) tellen gewoon mee;
// een kabel binnen wordt gemeten in het stelsel van het binnenplan (velden.binnen.lokaal).

import { lengte } from './geo';
import * as turf from '@turf/turf';
import { alsStroomItem, UITGANG_A } from './vasteAansluitingen';

export const ROLLEN = [['', 'Geen'], ['bron', 'Bron'], ['kast', 'Verdeelkast'], ['verbruiker', 'Verbruiker'], ['kabel', 'Kabel']];
export const FASEN_EL = [['L1', 'L1'], ['L2', 'L2'], ['L3', 'L3'], ['3F', '3 fasen']];
export const AANSLUITINGEN = [16, 32, 63, 125, 250, 400];
export const KABELTYPES = ['3G2,5 (16A)', '5G2,5 (16A)', '5G6 (32A)', '5G16 (63A)', '5G35 (125A)', 'Powerlock (400A)'];
const KABEL_A = { '3G2,5 (16A)': 16, '5G2,5 (16A)': 16, '5G6 (32A)': 32, '5G16 (63A)': 63, '5G35 (125A)': 125, 'Powerlock (400A)': 400 };
// Powerlock is enkelpolig: per verbinding vijf losse aders.
export const KABEL_ADERS = { 'Powerlock (400A)': 5 };
export const POWERLOCK_ADERS = 'L1 bruin, L2 zwart, L3 grijs, N blauw, PE geel-groen';
// Welke kabel past op een ingang (stekker van de kast).
export const INGANG_KABEL = { 'CEE 16A 3F': '5G2,5 (16A)', 'CEE 16A mono': '3G2,5 (16A)', Schuko: '3G2,5 (16A)', 'CEE 32A 3F': '5G6 (32A)', 'CEE 63A': '5G16 (63A)', 'CEE 125A': '5G35 (125A)', Powerlock: 'Powerlock (400A)' };
// Kabeltype voor een aansluiting: volgens de ingang, anders de kleinste kabel die groot genoeg is
// (mono tot 16 A: 3G2,5).
export function kabelVoor(ampere, ingang = null, fase = null) {
  if (ingang && INGANG_KABEL[ingang]) return INGANG_KABEL[ingang];
  const a = Number(ampere);
  if (fase && fase !== '3F' && !(a > 16)) return '3G2,5 (16A)';
  if (!(a > 0)) return null;
  return ['5G2,5 (16A)', '5G6 (32A)', '5G16 (63A)', '5G35 (125A)', 'Powerlock (400A)'].find((t) => KABEL_A[t] >= a) || null;
}

// Standaardlengtes die bestaan (huur): een getekende kabel wordt een combinatie van stukken.
// De bibliotheek is leidend (kabel-element met kabeltype + kabel_lengtes, zie kabelLengtesVan);
// dit is de terugval als de bibliotheek er niets over zegt. Zo tellen stuklijst en kabellijst gelijk.
export const KABEL_LENGTES = {
  '3G2,5 (16A)': [5, 10, 20, 50],
  '5G2,5 (16A)': [5, 10, 20, 50],
  '5G6 (32A)': [5, 10, 25, 50],
  '5G16 (63A)': [5, 10, 25, 50],
  '5G35 (125A)': [5, 10, 25, 50],
  'Powerlock (400A)': [5, 10, 25, 50],
};
// Lengtes per kabeltype uit de bibliotheek (eigenschappen.kabeltype + kabel_lengtes), aangevuld met de terugval.
export function kabelLengtesVan(elementenMap) {
  const uit = { ...KABEL_LENGTES };
  for (const el of elementenMap?.values?.() || []) {
    const e = el?.eigenschappen; if (!e?.kabeltype || !Array.isArray(e.kabel_lengtes)) continue;
    const ls = e.kabel_lengtes.map(Number).filter((x) => x > 0);
    if (ls.length && (el.actief ?? true)) uit[e.kabeltype] = ls;
  }
  return uit;
}
// Kleinste combinatie van stukken die samen lang genoeg is: zo weinig mogelijk stukken, daarna zo weinig
// mogelijk overlengte. Geeft { lengte: aantal }, bv. 63 m uit [5, 10, 25, 50] → { 50: 1, 25: 1 }.
export function kabelStukken(L, lengtes) {
  const ls = [...new Set((lengtes || []).map(Number).filter((x) => x > 0))].sort((a, b) => b - a);
  const uit = {};
  if (!ls.length || !(L > 0)) return uit;
  const max = ls[0];
  // Hele stukken van de langste lengte tot de rest in één stuk past: de rest zoeken we uitputtend.
  const vol = Math.max(0, Math.ceil(L / max) - 2);
  let rest = L - vol * max;
  if (vol) uit[max] = vol;
  let best = null;
  const zoek = (i, nog, telling, stuks, totaal) => {
    if (best && (stuks > best.stuks || (stuks === best.stuks && totaal >= best.totaal))) return;
    if (nog <= 1e-9) { best = { stuks, totaal, telling: { ...telling } }; return; }
    if (i >= ls.length) return;
    const l = ls[i];
    const maxN = Math.ceil(nog / l);
    for (let n = maxN; n >= 0; n--) {
      if (n) telling[l] = n; else delete telling[l];
      zoek(i + 1, nog - n * l, telling, stuks + n, totaal + n * l);
    }
    delete telling[l];
  };
  zoek(0, rest, {}, 0, 0);
  for (const [l, n] of Object.entries(best?.telling || {})) uit[l] = (uit[l] || 0) + n;
  return uit;
}
// Bestelling van één kabel: stukken, totaal meter en een tekst ("1 × 50 + 1 × 25").
// lengtesPerType: uit kabelLengtesVan(elementenMap); zonder opgave de terugval. Onbekend type: per 25 m.
export function kabelBestelling(meter, kabeltype, lengtesPerType = KABEL_LENGTES) {
  const lengtes = lengtesPerType?.[kabeltype] || KABEL_LENGTES[kabeltype];
  if (!lengtes) { const m = Math.ceil(meter / 25) * 25; return { stukken: { [m]: 1 }, meter: m, tekst: `${m} m (per 25 m)`, standaard: false }; }
  const stukken = kabelStukken(meter, lengtes);
  const totaal = Object.entries(stukken).reduce((t, [l, n]) => t + Number(l) * n, 0);
  return { stukken, meter: totaal, tekst: stukkenTekst(stukken), standaard: true };
}
export const stukkenTekst = (stukken) => Object.entries(stukken || {}).sort((a, b) => Number(b[0]) - Number(a[0])).map(([l, n]) => `${n} × ${l} m`).join(' + ');

// Standaard stopcontacten van een stroomgroep volgens het vermogen, als het element of item niets opgeeft.
export function standaardUitgangen(kva) {
  const k = Number(kva);
  if (!(k > 0)) return null;
  if (k < 30) return [{ type: 'CEE 32A 3F', aantal: 1 }, { type: 'CEE 16A mono', aantal: 1 }];
  if (k < 60) return [{ type: 'CEE 63A', aantal: 1 }, { type: 'CEE 32A 3F', aantal: 1 }, { type: 'CEE 16A mono', aantal: 1 }];
  if (k < 100) return [{ type: 'CEE 125A', aantal: 1 }, { type: 'CEE 63A', aantal: 1 }, { type: 'CEE 32A 3F', aantal: 1 }, { type: 'CEE 16A mono', aantal: 1 }];
  return [{ type: 'Powerlock', aantal: 1 }, { type: 'CEE 125A', aantal: 1 }, { type: 'CEE 63A', aantal: 1 }, { type: 'CEE 32A 3F', aantal: 1 }, { type: 'CEE 16A mono', aantal: 1 }];
}

// Heet dit element een kast (verdeelkast, eventbox, distro)? Een koelkast of dossierkast niet.
export const isKastNaam = (naam) => /(^|[\s(,/·-])(verdeel|stroom|event|straat|put|markt|schakel|zekerings?|hoofd|onder|sub)?kast(je|en)?(?![a-z])|eventbox|distro/i.test(naam || '');

// Standaardwaarden uit het bibliotheek-element (eigenschappen.kva / ampere).
export function stroomVan(item, element) {
  const eig = element?.eigenschappen || {};
  const eigen = item.velden?.stroom || {};
  let rol = eigen.rol;
  // Aansluitingen uit de bibliotheek (bv. podium: 32 A + 63 A), per item aan te vullen met voeding en kW.
  const basisA = Array.isArray(eig.aansluitingen) ? eig.aansluitingen : [];
  const aansluitingen = basisA.length
    ? basisA.map((a, i) => ({ ampere: a.ampere ?? null, fase: a.fase || '3F', kw: a.kw ?? null, naam: a.naam || '', ...(eigen.aansluitingen?.[i] || {}) }))
    : null;
  if (rol === undefined) {
    if (aansluitingen) rol = 'verbruiker';
    else if (eig.kva) rol = 'bron';
    else if (eig.ampere && (eig.rol === 'kast' || eig.stekkerdoos || isKastNaam(element?.naam))) rol = 'kast';
    else if (eig.kw) rol = 'verbruiker';
    else if (eig.kabeltype) rol = 'kabel';
    else rol = '';
  }
  // Ingang van een kast (stekker): bv. 'Powerlock' of 'CEE 125A'; een stekkerdoos: 'Schuko'.
  const ingang = eigen.ingang ?? eig.ingang ?? null;
  const invoer = !!eigen.invoer;
  return {
    rol,
    kva: eigen.kva ?? eig.kva ?? null,
    cosphi: eigen.cosphi ?? 0.8,
    liter_per_uur: eigen.liter_per_uur ?? eig.liter_per_uur ?? null,
    // Kast zonder opgave: de stroomsterkte van zijn stekker.
    ampere: eigen.ampere ?? eig.ampere ?? (rol === 'kast' && ingang ? UITGANG_A[ingang] || null : null),
    ingang,
    kw: eigen.kw ?? eig.kw ?? null,
    fase: eigen.fase ?? (eig.fase || '3F'),
    voeding: eigen.voeding ?? null,
    van: eigen.van ?? null,
    naar: eigen.naar ?? null,
    kabeltype: eigen.kabeltype ?? eig.kabeltype ?? null,
    aansluitingen: rol === 'verbruiker' ? aansluitingen : null,
    // Uitgangen van een kast of bron: [{ type: 'CEE 32A 3F', aantal, doorlus? }], uit het item of de bibliotheek.
    // Een stroomgroep zonder opgave krijgt de standaard stopcontacten volgens zijn kVA; een invoerpunt
    // (stroom komt het gebouw binnen) geeft zijn ingang één op één door.
    uitgangen: Array.isArray(eigen.uitgangen) ? eigen.uitgangen : Array.isArray(eig.uitgangen) ? eig.uitgangen
      : rol === 'bron' && !eigen.vast ? standaardUitgangen(eigen.kva ?? eig.kva)
        : rol === 'kast' && invoer && ingang ? [{ type: ingang, aantal: 1, doorlus: true }] : null,
    uitgangenStandaard: !Array.isArray(eigen.uitgangen) && !Array.isArray(eig.uitgangen) && rol === 'bron' && !eigen.vast && !!standaardUitgangen(eigen.kva ?? eig.kva),
    afzekering: eigen.afzekering ?? eig.afzekering ?? null,
    // Verbruiker met eigen kabel (LED-trailer, Portix, Stihl …): enkel een kast binnen dat bereik, geen kabel van ons.
    eigen_kabel: Number(eigen.eigen_kabel ?? eig.eigen_kabel_m) || null,
    stekkerdoos: !!eig.stekkerdoos,
    invoer,
    vast: !!eigen.vast,
  };
}

// Kabels (één per aansluiting) die een kast of verbruiker nodig heeft: { voeding, ampere, fase, naar, label }.
export function kabelDoelen(item, s) {
  if (s.aansluitingen?.length) return s.aansluitingen.map((a, i) => ({ voeding: a.voeding, ampere: a.ampere, fase: a.fase, naar: `${item.id}#${i}`, label: a.naam || `${a.ampere || '?'} A` })).filter((d) => d.voeding);
  return s.voeding ? [{ voeding: s.voeding, ampere: s.ampere, fase: s.fase, naar: item.id, label: '' }] : [];
}
// Kabeltype voor één doel: volgens de uitgang die het op zijn voeding krijgt (bezetting van die knoop),
// anders volgens de ingang van het item of de ampère.
export function kabelTypeVoor(item, s, doel, voedingKnoop) {
  const uitgang = uitgangVoorKind(voedingKnoop?.bezetting, doel.naar);
  return (uitgang && INGANG_KABEL[uitgang]) || kabelVoor(doel.ampere, doel.naar === item.id ? s.ingang : null, doel.fase);
}
// Een item aan een voeding hangen: bij meerdere aansluitingen de eerste zonder voeding (daarna weer
// vanaf de eerste). Geeft de nieuwe velden.stroom en een tekstje over welke aansluiting het werd.
export function koppelVoeding(item, s, voedingId) {
  const stroom = { ...(item.velden?.stroom || {}), rol: s.rol };
  let welke = '';
  if (s.aansluitingen?.length) {
    const lijst = s.aansluitingen.map((a, i) => ({ ...(item.velden?.stroom?.aansluitingen?.[i] || {}) }));
    const i0 = s.aansluitingen.findIndex((a) => !a.voeding); const i = i0 < 0 ? 0 : i0;
    lijst[i].voeding = voedingId;
    stroom.aansluitingen = lijst;
    const a = s.aansluitingen[i]; welke = ` (${a.naam || `${a.ampere || '?'} A`}${s.aansluitingen.length > 1 ? `, ${i + 1} van ${s.aansluitingen.length}` : ''})`;
  } else stroom.voeding = voedingId;
  return { stroom, welke };
}

// Stekker: 230 V (mono, blauw) of 400 V (3 fasen, rood). Voor kabelkleur op de kaart.
export const KABEL_KLEUR = { 230: '#2563EB', 400: '#DC2626' };
export function kabelSpanning(kabeltype, naarKnoop) {
  if (kabeltype && /^3G/.test(kabeltype)) return 230;
  if (kabeltype && /^5G|Powerlock/.test(kabeltype)) return 400;
  if (naarKnoop?.s?.fase && naarKnoop.s.fase !== '3F') return 230;
  return 400;
}

// Bezetting van de uitgangen van een kast, bron of vaste aansluiting: per type aantal, bezet, vrij
// en welke kinderen erop hangen. Mono (230 V) op een mono-stopcontact, 3 fasen op een CEE 3F;
// een kast neemt de uitgang van zijn ingang (bv. de doorlus van een eventbox).
const UITGANG_MONO = new Set(['CEE 16A mono', 'Schuko']);
export const isMonoKnoop = (s) => (s.ingang ? UITGANG_MONO.has(s.ingang) : s.rol === 'verbruiker' && !!s.fase && s.fase !== '3F');
export const ampereNodig = (s) => (s.ingang && UITGANG_A[s.ingang]) || Number(s.ampere) || (isMonoKnoop(s) ? 16 : 32);
export function uitgangenBezetting(uitgangen, knoop) {
  const lijst = (uitgangen || []).filter((u) => u.type);
  if (!lijst.length) return null;
  const kinderen = (knoop?.kinderen || []).map((k) => ({ id: k.id, a: ampereNodig(k.s), mono: isMonoKnoop(k.s) }));
  const r = lijst.map((u) => ({ type: u.type, aantal: Number(u.aantal) || 1, ampere: UITGANG_A[u.type] || null, mono: UITGANG_MONO.has(u.type), doorlus: !!u.doorlus, bezet: 0, kinderen: [] }));
  // Elke verbruiker neemt de kleinste passende uitgang die groot genoeg is; de zwaarste eerst.
  for (const k of kinderen.sort((x, y) => y.a - x.a)) {
    // Mono kan enkel op een mono-uitgang (schuko, CEE 16A mono): een 3-fasen-uitgang is geen optie.
    const past = (u) => (k.mono ? u.mono : !u.mono);
    // Geen verloopstukken: de stekker moet op een uitgang van dezelfde stroomsterkte passen; anders een verdeelkast ertussen.
    const kand = r.filter((u) => u.bezet < u.aantal && (u.ampere || 0) === k.a && past(u))[0];
    if (kand) { kand.bezet += 1; kand.kinderen.push(k.id); }
  }
  return r.map((u) => ({ ...u, vrij: u.aantal - u.bezet }));
}
// Op welke uitgang (type) van zijn voeding een kind hangt, of null als er geen vrije past.
export const uitgangVoorKind = (bezetting, kindId) => (bezetting || []).find((u) => u.kinderen.includes(kindId))?.type || null;

const naamVan = (it, el) => it.naam || el?.naam || (it.velden?.stroom?.invoer ? 'Stroominvoer' : null) || ({ bron: 'Bron', kast: 'Kast', verbruiker: 'Verbruiker' }[it.velden?.stroom?.rol]) || 'Item';

// Lengte van een kabel: in een binnenplan in het stelsel van dat plan (meter), anders op de kaart.
export function kabelLengte(it) {
  const l = it.velden?.binnen?.lokaal?.geometrie;
  if (l?.type === 'LineString') return l.coordinates.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - l.coordinates[i - 1][0], p[1] - l.coordinates[i - 1][1]) : 0), 0);
  return lengte(it.geometrie);
}

// 1 fase 230 V: kW → A = kW*1000/230 ; 3 fasen 400 V: A = kW*1000/(√3*400*cosφ)
function ampereVan(kw, fase, cosphi = 0.9) {
  if (!kw) return 0;
  return fase === '3F' ? (kw * 1000) / (Math.sqrt(3) * 400 * cosphi) : (kw * 1000) / (230 * cosphi);
}

// Kabelgoot of kabelbrug uit de bibliotheek; eigenschappen.rolstoel = rolstoeltoegankelijk (lage, brede oprijplaten).
export const isKabelgoot = (el) => !!el && el.tekenwijze === 'lijn' && /kabelgoot|kabelbrug/i.test(el.naam || '');
export const isRolstoelGoot = (el) => isKabelgoot(el) && (!!el.eigenschappen?.rolstoel || /rolstoel/i.test(el.naam || ''));
export function berekenStroom(items, elementenMap, { gelijktijdigheid = 0.8, marge = 0.1, fasen = [], routeLagen = [], vast = [] } = {}) {
  const knopen = new Map();
  const lengtesPerType = kabelLengtesVan(elementenMap);
  // Items in een binnenplan krijgen het gebouw of de tent achter hun naam, zodat je ze in het schema herkent.
  const hosts = new Map(items.map((i) => [i.id, i]));
  const metHost = (it, naam) => { const h = it.velden?.binnen?.host ? hosts.get(it.velden.binnen.host) : null; const hn = h ? h.naam || elementenMap.get(h.element_id)?.naam : null; return hn ? `${naam} · ${hn}` : naam; };
  // Vaste aansluitingen (stad, Fluvius) tellen als bron, met id 'va:<uuid>'.
  for (const it of [...vast.map(alsStroomItem), ...items]) {
    const el = it.element_id ? elementenMap.get(it.element_id) : null;
    const s = stroomVan(it, el);
    if (!s.rol) continue;
    if (s.aansluitingen?.length) {
      // Elke aansluiting is een eigen verbruiker met een eigen voeding.
      s.aansluitingen.forEach((a, i) => {
        const sa = { ...s, rol: 'verbruiker', ampere: a.ampere, fase: a.fase || '3F', kw: a.kw, voeding: a.voeding ?? null };
        const naam = `${metHost(it, naamVan(it, el))} · ${a.naam || `${a.ampere || '?'} A`}`;
        knopen.set(`${it.id}#${i}`, { id: `${it.id}#${i}`, item: it, el, s: sa, naam, kinderen: [] });
      });
      continue;
    }
    knopen.set(it.id, { id: it.id, item: it, el, s, naam: metHost(it, naamVan(it, el)), kinderen: [] });
  }
  const meldingen = [];
  // Boom opbouwen.
  // Zonder voeding maar met een getekende kabel ernaartoe: de kabel bepaalt de voeding.
  const viaKabel = new Map();
  for (const k of knopen.values()) if (k.s.rol === 'kabel' && k.s.naar && k.s.van) viaKabel.set(k.s.naar, k.s.van);
  for (const k of knopen.values()) {
    if (k.s.rol === 'kabel' || k.s.rol === 'bron') continue;
    const vid = k.s.voeding || viaKabel.get(k.id) || null;
    const ouder = vid ? knopen.get(vid) : null;
    if (ouder && ouder.s.rol !== 'verbruiker' && ouder.s.rol !== 'kabel' && ouder.id !== k.id) ouder.kinderen.push(k);
    else if (k.s.rol !== 'kabel') meldingen.push({ id: k.item.id, soort: 'waarschuwing', tekst: `${k.naam}: niet aangesloten op een bron of kast.` });
  }
  // Uitgangen: wie hangt op welk stopcontact, en wie krijgt er geen.
  for (const k of knopen.values()) {
    if (k.s.rol !== 'kast' && k.s.rol !== 'bron') continue;
    k.bezetting = uitgangenBezetting(k.s.uitgangen, k);
    if (!k.bezetting) continue;
    for (const c of k.kinderen) {
      if (uitgangVoorKind(k.bezetting, c.id)) continue;
      const a = ampereNodig(c.s);
      const geenMono = isMonoKnoop(c.s) && !k.bezetting.some((u) => u.mono);
      meldingen.push({ id: c.item.id, soort: 'fout', tekst: geenMono ? `${k.naam} heeft geen mono-uitgang voor ${c.naam}: zet er een verdeeldoos tussen (bv. CEE 32A → schuko).` : `${k.naam}: geen vrije ${isMonoKnoop(c.s) ? 'mono' : `${a} A`}-uitgang voor ${c.naam}. Zet er een verdeelkast met die uitgang tussen (we werken zonder verloopstukken).` });
    }
  }
  // Lus-veiligheid + belasting optellen.
  const bezocht = new Set();
  const tel = (k) => {
    if (bezocht.has(k.id)) { meldingen.push({ id: k.item.id, soort: 'fout', tekst: `${k.naam}: kring in de aansluitingen.` }); return { kw: 0, fase: { L1: 0, L2: 0, L3: 0 } }; }
    bezocht.add(k.id);
    const fase = { L1: 0, L2: 0, L3: 0 };
    let kw = 0;
    if (k.s.rol === 'verbruiker') {
      kw = Number(k.s.kw) || 0;
      if (k.s.fase === '3F') { fase.L1 += kw / 3; fase.L2 += kw / 3; fase.L3 += kw / 3; } else fase[k.s.fase || 'L1'] += kw;
    }
    for (const c of k.kinderen) {
      const r = tel(c);
      kw += r.kw; fase.L1 += r.fase.L1; fase.L2 += r.fase.L2; fase.L3 += r.fase.L3;
    }
    // Mono kast (stekkerdoos, kast op een mono-stekker): alles erachter hangt op zijn ene fase.
    if (k.s.rol === 'kast' && isMonoKnoop(k.s)) { const f = k.s.fase && k.s.fase !== '3F' ? k.s.fase : 'L1'; fase.L1 = 0; fase.L2 = 0; fase.L3 = 0; fase[f] = kw; }
    k.kw = kw; k.fase = fase;
    k.ampereFase = { L1: (fase.L1 * 1000) / 230, L2: (fase.L2 * 1000) / 230, L3: (fase.L3 * 1000) / 230 };
    return { kw, fase };
  };
  const bronnen = [...knopen.values()].filter((k) => k.s.rol === 'bron');
  for (const b of bronnen) {
    tel(b);
    const capaciteit = (Number(b.s.kva) || 0) * (Number(b.s.cosphi) || 0.8);
    b.capaciteit = capaciteit;
    b.belast = b.kw * gelijktijdigheid;
    b.procent = capaciteit ? (b.belast / capaciteit) * 100 : null;
    if (b.s.vast && b.s.ampere) {
      const max = Math.max(b.ampereFase?.L1 || 0, b.ampereFase?.L2 || 0, b.ampereFase?.L3 || 0) * gelijktijdigheid;
      b.maxA = max;
      if (max > b.s.ampere) meldingen.push({ id: b.item.id, soort: 'fout', tekst: `${b.naam}: ${Math.round(max)} A op een fase, meer dan de hoofdzekering van ${b.s.ampere} A.` });
    }
    if (!b.s.kva) meldingen.push({ id: b.item.id, soort: 'waarschuwing', tekst: `${b.naam}: vermogen (kVA) ontbreekt.` });
    else if (b.procent > 100) meldingen.push({ id: b.item.id, soort: 'fout', tekst: `${b.naam}: overbelast (${Math.round(b.procent)} %).` });
    else if (b.procent > 80) meldingen.push({ id: b.item.id, soort: 'waarschuwing', tekst: `${b.naam}: zwaar belast (${Math.round(b.procent)} %).` });
  }
  // Kasten en verbruikers tegenover hun voeding.
  for (const k of knopen.values()) {
    if (k.s.rol === 'kast' && k.s.ampere) {
      const max = Math.max(k.ampereFase?.L1 || 0, k.ampereFase?.L2 || 0, k.ampereFase?.L3 || 0) * gelijktijdigheid;
      k.maxA = max;
      if (max > k.s.ampere) meldingen.push({ id: k.item.id, soort: 'fout', tekst: `${k.naam}: ${Math.round(max)} A op een fase, meer dan ${k.s.ampere} A.` });
      const f = k.fase || { L1: 0, L2: 0, L3: 0 };
      const vals = [f.L1, f.L2, f.L3];
      const hoog = Math.max(...vals); const laag = Math.min(...vals);
      // Een mono kast heeft maar één fase: daar valt niets te verdelen.
      if (!isMonoKnoop(k.s) && hoog > 0 && (hoog - laag) / hoog > 0.4) {
        const vol = ['L1', 'L2', 'L3'][vals.indexOf(hoog)]; const leeg = ['L1', 'L2', 'L3'][vals.indexOf(laag)];
        meldingen.push({ id: k.item.id, soort: 'tip', tekst: `${k.naam}: fasen ongelijk (${vol} ${hoog.toFixed(1)} kW, ${leeg} ${laag.toFixed(1)} kW). Zet een verbruiker van ${vol} op ${leeg}.` });
      }
    }
    if (k.s.rol === 'verbruiker' && k.s.voeding) {
      const ouder = knopen.get(k.s.voeding);
      if (ouder?.s.rol === 'kast' && ouder.s.ampere && k.s.ampere && k.s.ampere > ouder.s.ampere) {
        meldingen.push({ id: k.item.id, soort: 'fout', tekst: `${k.naam}: aansluiting ${k.s.ampere} A op kast van ${ouder.s.ampere} A.` });
      }
      if (k.s.ampere && k.s.kw) {
        const a = ampereVan(k.s.kw, k.s.fase);
        if (a > k.s.ampere) meldingen.push({ id: k.item.id, soort: 'waarschuwing', tekst: `${k.naam}: ${k.s.kw} kW vraagt ± ${Math.round(a)} A, meer dan de aansluiting van ${k.s.ampere} A.` });
      }
    }
  }
  // Kabels: lengte + marge, omgezet naar de standaardlengtes uit de bibliotheek; type tegenover verbruiker; kruisingen.
  const routes = items.filter((i) => i.geometrie?.type === 'LineString' && routeLagen.includes(i.laag_id) && (i.velden?.stroom?.rol || '') !== 'kabel');
  // Kabelgoten (gewoon of rolstoel) die al op het plan liggen: een kruising binnen 1,2 m daarvan is gedekt.
  const goten = items.filter((i) => i.geometrie?.type === 'LineString' && !i.verborgen && isKabelgoot(elementenMap.get(i.element_id)));
  const kabels = []; const kruispunten = [];
  for (const k of knopen.values()) {
    if (k.s.rol !== 'kabel' || k.item.geometrie?.type !== 'LineString') continue;
    const l = kabelLengte(k.item);
    const nodig = l * (1 + marge);
    const bestelling = kabelBestelling(nodig, k.s.kabeltype, lengtesPerType);
    const besteld = bestelling.meter;
    let kruisingen = 0; let gedekt = 0;
    // Een kabel binnen kruist geen parcours of route.
    if (!k.item.velden?.binnen) for (const r of routes) {
      try {
        for (const f of turf.lineIntersect(k.item.geometrie, r.geometrie).features) {
          kruisingen += 1;
          const punt = f.geometry.coordinates;
          let goot = false;
          for (const g of goten) { try { if (turf.pointToLineDistance(turf.point(punt), turf.lineString(g.geometrie.coordinates), { units: 'meters' }) <= 1.2) { goot = true; break; } } catch {} }
          if (goot) gedekt += 1;
          // Richting van de kabel op dat punt: daar komt de goot langs.
          let richting = 0; try { const np = turf.nearestPointOnLine(turf.lineString(k.item.geometrie.coordinates), turf.point(punt), { units: 'meters' }); const c = k.item.geometrie.coordinates; const i = Math.min(c.length - 2, np.properties.index); richting = turf.bearing(c[i], c[i + 1]); } catch {}
          kruispunten.push({ punt, richting, kabel: k.item.id, route: r.id, gedekt: goot });
        }
      } catch {}
    }
    kruisingen = kruisingen - gedekt;
    const kabelA = KABEL_A[k.s.kabeltype] || k.s.ampere || null;
    const naar = k.s.naar ? knopen.get(k.s.naar) : null;
    if (kabelA && naar?.s.ampere && naar.s.ampere > kabelA) meldingen.push({ id: k.item.id, soort: 'fout', tekst: `Kabel naar ${naar.naam}: ${kabelA} A-kabel voor een ${naar.s.ampere} A-aansluiting.` });
    const ing = naar?.s.ingang; const past = ing && INGANG_KABEL[ing];
    if (past && k.s.kabeltype && k.s.kabeltype !== past) meldingen.push({ id: k.item.id, soort: 'fout', tekst: `Kabel naar ${naar.naam}: de ingang is ${ing}, dus een kabel ${past}${ing === 'Powerlock' ? ' (set van 5 aders)' : ''}.` });
    if (kruisingen) meldingen.push({ id: k.item.id, soort: 'waarschuwing', tekst: `Kabel${naar ? ` naar ${naar.naam}` : ''} kruist ${kruisingen}× het parcours of een route zonder kabelgoot: kabelgoot (of rolstoelgoot) nodig.` });
    const van = k.s.van ? knopen.get(k.s.van) : null;
    kabels.push({ id: k.id, naam: k.naam, type: k.s.kabeltype || 'onbekend type', lengte: l, besteld, stukken: bestelling.stukken, stukkenTekst: bestelling.tekst, kruisingen, van: van?.naam || null, naar: naar?.naam || null, spanning: kabelSpanning(k.s.kabeltype, naar), ampere: kabelA });
  }
  // Per type: aantal stukken en meter, en per standaardlengte het aantal (lengtes: { 50: 2, 25: 1 }).
  const kabelLijst = new Map();
  for (const c of kabels) {
    const aders = KABEL_ADERS[c.type] || 1;
    const r = kabelLijst.get(c.type) || { type: c.type, stuks: 0, meter: 0, aders, lengtes: {}, standaard: !!lengtesPerType[c.type], standaardLengtes: lengtesPerType[c.type] || null };
    for (const [l, n] of Object.entries(c.stukken)) { r.lengtes[l] = (r.lengtes[l] || 0) + n * aders; r.stuks += n * aders; }
    r.meter += c.besteld * aders;
    kabelLijst.set(c.type, r);
  }
  const kabelbruggen = kabels.reduce((s, c) => s + c.kruisingen, 0); // nog zonder kabelgoot
  // Brandstof per fase met begin en einde.
  const brandstof = [];
  for (const f of fasen) {
    if (!f.van || !f.tot) continue;
    const uren = (new Date(f.tot) - new Date(f.van)) / 36e5;
    if (!(uren > 0)) continue;
    let liter = 0;
    for (const b of bronnen) {
      if (b.item.fase_ids?.length && !b.item.fase_ids.includes(f.id)) continue;
      if (b.s.liter_per_uur) liter += b.s.liter_per_uur * uren;
    }
    if (liter) brandstof.push({ fase: f.naam, uren, liter });
  }
  return { bronnen, knopen, meldingen, kabels, kabelLijst: [...kabelLijst.values()], kabelbruggen, kruispunten, brandstof, gelijktijdigheid, lengtesPerType };
}

// Eendraadschema als geneste lijst met posities (voor SVG en PDF).
export function schemaIndeling(bronnen) {
  const rijen = [];
  const loop = (k, diepte) => {
    rijen.push({ k, diepte });
    for (const c of k.kinderen) loop(c, diepte + 1);
  };
  for (const b of bronnen) loop(b, 0);
  return rijen;
}

export function knoopTekst(k) {
  const s = k.s;
  if (s.rol === 'bron') return `${s.kva || '?'} kVA · ${k.belast ? k.belast.toFixed(1) : 0} kW${k.procent != null ? ` · ${Math.round(k.procent)} %` : ''}`;
  if (s.rol === 'kast') return `${s.ampere || '?'} A · ${k.kw ? k.kw.toFixed(1) : 0} kW · L1 ${(k.fase?.L1 || 0).toFixed(1)} · L2 ${(k.fase?.L2 || 0).toFixed(1)} · L3 ${(k.fase?.L3 || 0).toFixed(1)}`;
  return `${s.kw || '?'} kW · ${s.fase === '3F' ? '3 fasen' : s.fase}${s.ampere ? ` · ${s.ampere} A` : ''}`;
}

// Kabellijst als CSV (puntkomma, Excel-klaar).
export function kabellijstCsv(r) {
  const rijen = [['Kabel', 'Van', 'Naar', 'Type', 'Spanning', 'Lengte (m)', 'Bestellen (m)', 'Stukken', 'Kabelbruggen']];
  for (const c of r.kabels) rijen.push([c.naam, c.van || '', c.naar || '', c.type, `${c.spanning} V`, c.lengte.toFixed(1).replace('.', ','), c.besteld, c.stukkenTekst, c.kruisingen]);
  rijen.push([]);
  rijen.push(['Samenvatting', '', '', 'Type', '', '', 'Meter', 'Stuks', 'Per lengte']);
  for (const c of r.kabelLijst) rijen.push(['', '', '', c.type, '', '', c.meter, c.stuks, stukkenTekst(c.lengtes)]);
  return rijen.map((rij) => rij.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
}
