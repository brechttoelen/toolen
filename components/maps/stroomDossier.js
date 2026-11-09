'use client';

// Stroomdossier: wat de elektricien, de verhuurder en de chauffeur in de praktijk nodig hebben, in plaats van één
// grote kaart met alles erop.
//  1. Leverplan: overzichtskaart met enkel de stroompunten (S1, S2 …) groot genummerd, plus een leverlijst
//     (wat, van wie, waar met kaartlink, wanneer). Dit is het blad voor wie de generatoren en tanks uitrijdt.
//  2. Benodigdheden: alles wat geleverd moet worden, per leverancier opgeteld.
//  3. Per stroompunt (generator of vaste aansluiting) twee bladen:
//     a. situatie: kaart ingezoomd op dat net, de rest gedimd; kasten (V1 …), verbruikers (A1 …) en kabels (K1 …)
//        genummerd, kabeltype en stukken langs de kabel, kabelbruggen gemarkeerd;
//     b. aansluitschema en benodigdheden: van de bron tot elke verbruiker welke uitgang, welke kabel en welke
//        stukken; per stroompunt de lijst om mee te nemen, brandstof en een controlelijst bij het plaatsen.
// Planningshulp, geen keuring: beveiliging, spanningsval en keuring blijven bij de elektricien of verhuurder.
import { maakPdf, indeling, passendeSchaal } from './pdf';
import { uitgangVoorKind, stukkenTekst, KABEL_KLEUR } from './stroom';
import { herkomstVan } from './stijl';
import * as geo from './geo';
import * as turf from '@turf/turf';

const ROOD = [225, 29, 72]; const ZWART = [29, 29, 27]; const GRIJS = [104, 109, 118]; const LICHT = [237, 237, 235];
const KAST_K = [91, 33, 182]; const VERBR_K = [3, 105, 161]; const KABEL_K = { 400: [220, 38, 38], 230: [37, 99, 235] };
const g1 = (x, d = 0) => Number(x || 0).toLocaleString('nl-BE', { maximumFractionDigits: d });
const zonderPijl = (t) => String(t || '').replace(/→/g, '>').replace(/≈/g, '±');
const bestandsnaam = (t) => t.replace(/[\\/:*?"<>|]/g, '');
const basisId = (id) => String(id).split('#')[0];
// Rechte afstand (m) tussen twee items: in een binnenplan in zijn eigen maten, anders op de kaart.
function afstandM(a, b) {
  const la = a?.velden?.binnen?.lokaal; const lb = b?.velden?.binnen?.lokaal;
  if (la && lb && a.velden.binnen.host === b.velden.binnen.host) { const pa = la.midden || la.geometrie?.coordinates; const pb = lb.midden || lb.geometrie?.coordinates; if (Array.isArray(pa) && Array.isArray(pb) && typeof pa[0] === 'number' && typeof pb[0] === 'number') return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); }
  const pa = a?.geometrie ? geo.middelpunt(a.geometrie) : null; const pb = b?.geometrie ? geo.middelpunt(b.geometrie) : null;
  if (!pa || !pb) return null;
  try { return turf.distance(pa, pb, { units: 'meters' }); } catch { return null; }
}
// Geleverd door: in een deellink staat het al berekend op het item (herkomst), anders zoals in de editor.
const hkVan = (it, el, std) => (it && 'herkomst' in it ? it.herkomst || '' : herkomstVan(it, el, std));
// Bij elke generator: een aardpen en een aardingskabel (standaard meegeleverd).
export const AARDING = ['Aardpen', 'Aardingskabel'];
// Wat er mee moet naar één stroompunt: [aantal, wat, leverancier].
export function meeRijen(p) {
  const rij = [];
  if (!p.vast) { rij.push([1, p.titel, p.lev]); for (const a of AARDING) rij.push([1, `${a} (bij de generator)`, p.lev]); }
  for (const k of p.kasten) rij.push([k.aantal, `${k.naam} (${k.codes.join(', ')})`, k.leverancier || '']);
  for (const c of p.kabelTypes) rij.push([Object.values(c.stukken).reduce((a, q) => a + q, 0), `Kabel ${c.type}: ${stukkenTekst(c.stukken)}`, c.leverancier || '']);
  if (p.bruggen) rij.push([p.bruggen, 'Kabelbrug of kabelgoot (kruising met parcours of route)', '']);
  return rij;
}
// ── Gegevens ──────────────────────────────────────────────────────────────────────────────────────────
export function dossierGegevens({ stroom, items, elementenMap, plan, fasen = [] }) {
  const std = plan?.instellingen?.leveranciers || null;
  const itemsById = new Map(items.map((i) => [i.id, i]));
  // Kabels per doel (naar) en hun gegevens uit de berekening (type, lengte, stukken, kruisingen).
  const kabelInfo = new Map(stroom.kabels.map((c) => [c.id, c]));
  const kabelsNaar = new Map();
  for (const k of stroom.knopen.values()) {
    if (k.s.rol !== 'kabel' || !k.s.naar) continue;
    const c = kabelInfo.get(k.id); if (!c) continue;
    if (!kabelsNaar.has(k.s.naar)) kabelsNaar.set(k.s.naar, []);
    kabelsNaar.get(k.s.naar).push({ ...c, item: k.item, van: k.s.van });
  }
  const bronnen = stroom.bronnen.filter((b) => b.kinderen.length || !b.s.vast)
    .sort((a, b) => (a.s.vast - b.s.vast) || (Number(b.s.kva) || 0) - (Number(a.s.kva) || 0) || String(a.naam).localeCompare(String(b.naam), 'nl'));
  const faseNaam = (it) => (it?.fase_ids?.length ? it.fase_ids.map((f) => fasen.find((x) => x.id === f)?.naam).filter(Boolean).join(', ') : '');
  const punten = bronnen.map((b, bi) => {
    const nr = `S${bi + 1}`;
    const rijen = []; const kabels = []; let nV = 0; let nA = 0; const extraMeld = [];
    const loop = (k, diepte, ouder) => {
      let code = nr;
      if (k.s.rol === 'kast') code = `V${++nV}`;
      else if (k.s.rol === 'verbruiker') code = `A${++nA}`;
      const ks = (kabelsNaar.get(k.id) || []).filter((c) => !ouder || c.van === ouder.id || !c.van);
      const eigenL = k.s.rol === 'verbruiker' ? k.s.eigen_kabel : null;
      const eigenLev = eigenL ? hkVan(k.item, k.el, std) || 'de verbruiker' : null;
      const kc = ks.map((c) => { const kk = { ...c, code: `K${kabels.length + 1}`, eigen: !!eigenL && c.lengte <= eigenL, eigenLev, eigenL }; kabels.push(kk); return kk; });
      // Eigen kabel zonder getekende kabel: rechte afstand tot de kast als schatting.
      let eigenKabel = null;
      if (eigenL && ouder) {
        const a = afstandM(k.item, ouder.item); const lang = kc.length ? Math.max(...kc.map((c) => c.lengte)) : a;
        eigenKabel = { lengte: eigenL, afstand: lang, lev: eigenLev, past: lang != null && lang <= eigenL };
        if (eigenKabel.afstand != null && !eigenKabel.past) extraMeld.push({ id: k.item.id, soort: 'fout', tekst: `${k.naam}: eigen kabel ${eigenL} m, maar ± ${Math.round(eigenKabel.afstand)} m tot ${ouder.naam}. Zet een kast dichterbij.` });
      }
      const uitgang = ouder ? uitgangVoorKind(ouder.bezetting, k.id) : null;
      rijen.push({ k, diepte, code, kabels: kc, uitgang, ouder, geenUitgang: !!ouder && !!ouder.bezetting && !uitgang, eigenKabel });
      for (const c of k.kinderen) loop(c, diepte + 1, k);
    };
    loop(b, 0, null);
    const el = b.el; const eig = el?.eigenschappen || {};
    const lev = b.s.vast ? (b.item.vast?.beheerder === 'stad' ? `Stad ${b.item.vast?.gemeente || ''}`.trim() : b.item.vast?.beheerder || 'Vaste aansluiting') : hkVan(b.item, el, std) || 'Leverancier nog kiezen';
    const titel = b.s.vast ? `${b.naam}${b.item.vast?.soort ? ` (${b.item.vast.soort})` : ''}` : (el?.naam || b.naam);
    const pos = geo.middelpunt(b.item.geometrie);
    // Benodigdheden van dit stroompunt.
    const kasten = new Map();
    for (const r of rijen) {
      if (r.k.s.rol !== 'kast') continue;
      const h = hkVan(r.k.item, r.k.el, std) || '';
      const sl = `${r.k.el?.naam || r.k.naam}|${h}`;
      const x = kasten.get(sl) || { naam: r.k.el?.naam || r.k.naam, leverancier: h, aantal: 0, codes: [] }; x.aantal += 1; x.codes.push(r.code); kasten.set(sl, x);
    }
    const kabelTypes = new Map();
    for (const c of kabels) {
      if (c.eigen) continue; // komt met de verbruiker mee
      const el2 = c.item.element_id ? elementenMap.get(c.item.element_id) : null;
      const h = hkVan(c.item, el2, std) || '';
      const sl = `${c.type}|${h}`;
      const x = kabelTypes.get(sl) || { type: c.type, leverancier: h, stukken: {}, meter: 0, codes: [] };
      for (const [l, n] of Object.entries(c.stukken || {})) x.stukken[l] = (x.stukken[l] || 0) + n;
      x.meter += c.besteld || 0; x.codes.push(c.code); kabelTypes.set(sl, x);
    }
    const bruggen = kabels.reduce((t, c) => t + (c.kruisingen || 0), 0);
    const ids = new Set(); for (const r of rijen) ids.add(basisId(r.k.id)); for (const c of kabels) ids.add(c.item.id);
    const meldingen = [...stroom.meldingen.filter((m) => ids.has(basisId(m.id))), ...extraMeld];
    const kruispunten = (stroom.kruispunten || []).filter((p) => !p.gedekt && kabels.some((c) => c.item.id === p.kabel));
    return {
      nr, b, titel, lev, pos, rijen, kabels, kasten: [...kasten.values()], kabelTypes: [...kabelTypes.values()], bruggen, ids, meldingen, kruispunten,
      kva: b.s.kva, procent: b.procent, belast: b.belast, tank: eig.tank_l || null, lph: b.s.liter_per_uur || null, wanneer: faseNaam(b.item),
      vast: b.item.vast || null,
    };
  });
  // Tanks (brandstof) en andere leverpunten in de categorie Elektriciteit die geen bron zijn.
  const tanks = items.filter((i) => { const e = i.element_id ? elementenMap.get(i.element_id) : null; return e && /tank|brandstof|diesel/i.test(e.naam || '') && !e.eigenschappen?.kva; })
    .map((i, n) => { const e = elementenMap.get(i.element_id); return { nr: `T${n + 1}`, item: i, titel: e.naam, lev: hkVan(i, e, std) || 'Leverancier nog kiezen', pos: geo.middelpunt(i.geometrie), wanneer: faseNaam(i) }; });
  // Binnenlocaties: per gebouw of tent (en verdieping) de kasten, verbruikers en kabels die binnen liggen.
  const binnen = new Map();
  for (const p of punten) {
    for (const r of p.rijen) {
      const bi = r.k.item.velden?.binnen; if (!bi?.host) continue;
      const sl = `${bi.host}|${bi.verd || 'g'}`;
      if (!binnen.has(sl)) binnen.set(sl, { host: itemsById.get(bi.host), verd: bi.verd || 'g', rijen: [], kabels: [], punten: new Set() });
      const g = binnen.get(sl); g.rijen.push({ ...r, p }); g.punten.add(p.nr);
      for (const c of r.kabels) if (c.item.velden?.binnen?.host === bi.host) g.kabels.push({ ...c, p });
    }
  }
  const binnenLijst = [...binnen.values()].filter((g) => g.host).map((g, i) => {
    const h = g.host; const he = h.element_id ? elementenMap.get(h.element_id) : null;
    const vs = h.velden?.binnenplan?.verdiepingen || [];
    const verdNaam = vs.length > 1 ? vs.find((v) => v.id === g.verd)?.naam || '' : '';
    const naam = `${h.naam || he?.naam || 'Gebouw'}${verdNaam ? ` · ${verdNaam}` : ''}`;
    const inhoud = items.filter((x) => x.velden?.binnen?.host === h.id && (x.velden.binnen.verd || 'g') === g.verd && x.velden.binnen.lokaal?.geometrie);
    const kasten = new Map();
    for (const r of g.rijen) if (r.k.s.rol === 'kast') { const hk = hkVan(r.k.item, r.k.el, std) || ''; const sl = `${r.k.el?.naam || r.k.naam}|${hk}`; const x = kasten.get(sl) || { naam: r.k.el?.naam || r.k.naam, leverancier: hk, aantal: 0, codes: [] }; x.aantal += 1; x.codes.push(`${r.p.nr}.${r.code}`); kasten.set(sl, x); }
    const kabelTypes = new Map();
    for (const c of g.kabels) { const el2 = c.item.element_id ? elementenMap.get(c.item.element_id) : null; const hk = hkVan(c.item, el2, std) || ''; const sl = `${c.type}|${hk}`; const x = kabelTypes.get(sl) || { type: c.type, leverancier: hk, stukken: {}, codes: [] }; for (const [l, n] of Object.entries(c.stukken || {})) x.stukken[l] = (x.stukken[l] || 0) + n; x.codes.push(`${c.p.nr}.${c.code}`); kabelTypes.set(sl, x); }
    return { nr: `B${i + 1}`, naam, host: h, omtrek: omtrekLokaal(h, items.filter((x) => x.velden?.binnen?.host === h.id)), verd: g.verd, rijen: g.rijen, kabels: g.kabels, punten: [...g.punten], inhoud, kasten: [...kasten.values()], kabelTypes: [...kabelTypes.values()] };
  });
  return { punten, tanks, binnen: binnenLijst, itemsById, gelijktijdigheid: stroom.gelijktijdigheid };
}

// Omtrek van de tent of het gebouw in het stelsel van het binnenplan: de verschuiving en draaiing tussen kaart
// en binnenplan halen we uit de items die in beide staan (kleinste kwadraten, ook met een gespiegelde as).
function omtrekLokaal(host, binnenItems) {
  const ring = host?.geometrie?.type === 'Polygon' ? host.geometrie.coordinates[0] : null;
  if (!ring) return null;
  const o = ring[0]; const kx = 111320 * Math.cos((o[1] * Math.PI) / 180); const ky = 110540;
  const m = ([lng, lat]) => [(lng - o[0]) * kx, (lat - o[1]) * ky];
  const paren = [];
  for (const it of binnenItems) {
    const w = it.geometrie; const l = it.velden?.binnen?.lokaal?.geometrie; if (!w || !l || w.type !== l.type) continue;
    const wc = w.type === 'Point' ? [w.coordinates] : w.type === 'LineString' ? w.coordinates : w.type === 'Polygon' ? w.coordinates[0] : [];
    const lc = l.type === 'Point' ? [l.coordinates] : l.type === 'LineString' ? l.coordinates : l.type === 'Polygon' ? l.coordinates[0] : [];
    if (wc.length !== lc.length) continue;
    wc.forEach((c, j) => paren.push([m(c), lc[j]]));
  }
  if (paren.length < 2) return null;
  const pas = (spiegel) => {
    const P = paren.map(([a, b]) => [a, spiegel ? [b[0], -b[1]] : b]);
    const ca = [0, 1].map((k) => P.reduce((t, q) => t + q[0][k], 0) / P.length); const cb = [0, 1].map((k) => P.reduce((t, q) => t + q[1][k], 0) / P.length);
    let sxx = 0; let sxy = 0;
    for (const [a, b] of P) { const ax = a[0] - ca[0]; const ay = a[1] - ca[1]; const bx = b[0] - cb[0]; const by = b[1] - cb[1]; sxx += ax * bx + ay * by; sxy += ax * by - ay * bx; }
    const th = Math.atan2(sxy, sxx); const c = Math.cos(th); const sn = Math.sin(th);
    const f = (a) => { const ax = a[0] - ca[0]; const ay = a[1] - ca[1]; return [c * ax - sn * ay + cb[0], sn * ax + c * ay + cb[1]]; };
    const fout = P.reduce((t, [a, b]) => { const q = f(a); return t + Math.hypot(q[0] - b[0], q[1] - b[1]); }, 0);
    return { fout, naar: (pt) => { const q = f(m(pt)); return spiegel ? [q[0], -q[1]] : q; } };
  };
  const a = pas(false); const b = pas(true); const best = a.fout <= b.fout ? a : b;
  if (best.fout / paren.length > 0.5) return null; // past niet: liever geen omtrek dan een verkeerde
  return ring.map(best.naar);
}

// Alles wat geleverd moet worden, per leverancier.
export function benodigdhedenPerLeverancier(d) {
  const per = new Map();
  const zet = (lev, soort, naam, aantal, detail, codes) => {
    const l = lev || 'Leverancier nog kiezen';
    if (!per.has(l)) per.set(l, new Map());
    const m = per.get(l); const sl = `${soort}|${naam}`;
    const x = m.get(sl) || { soort, naam, aantal: 0, detail: {}, codes: [] };
    x.aantal += aantal; x.codes.push(...codes);
    if (detail) for (const [k, n] of Object.entries(detail)) x.detail[k] = (x.detail[k] || 0) + n;
    m.set(sl, x);
  };
  for (const p of d.punten) {
    if (!p.vast) { zet(p.lev, '1 Stroombron', p.titel, 1, null, [p.nr]); for (const a of AARDING) zet(p.lev, '2 Aarding', a, 1, null, [p.nr]); }
    for (const k of p.kasten) zet(k.leverancier, '3 Verdeelkast', k.naam, k.aantal, null, k.codes.map((c) => `${p.nr}.${c}`));
    for (const c of p.kabelTypes) zet(c.leverancier, '4 Kabel', c.type, Object.values(c.stukken).reduce((a, b) => a + b, 0), c.stukken, [p.nr]);
    if (p.bruggen) zet('Leverancier nog kiezen', '5 Kabelbrug', 'Kabelbrug of kabelgoot', p.bruggen, null, [p.nr]);
  }
  for (const t of d.tanks) zet(t.lev, '1 Stroombron', t.titel, 1, null, [t.nr]);
  return [...per].sort((a, b) => (a[0] === 'Leverancier nog kiezen') - (b[0] === 'Leverancier nog kiezen') || a[0].localeCompare(b[0], 'nl'))
    .map(([lev, m]) => ({ lev, regels: [...m.values()].sort((a, b) => a.soort.localeCompare(b.soort) || a.naam.localeCompare(b.naam, 'nl', { numeric: true })) }));
}

// ── Tekenhulpen ───────────────────────────────────────────────────────────────────────────────────────
function kop(doc, titel, sub, pb) {
  doc.setFillColor(...ROOD); doc.rect(14, 12, 4, 4, 'F');
  doc.setTextColor(...ZWART); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(zonderPijl(titel), 21, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIJS); doc.text(zonderPijl(sub), 21, 22);
  doc.setDrawColor(220); doc.line(14, 26, pb - 14, 26); doc.setTextColor(...ZWART);
}
function voet(doc, plan, pb, ph) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140);
  doc.text(zonderPijl(`${plan.naam} · versie ${plan.versie} · stroomdossier · planningshulp, geen keuring: beveiliging, spanningsval en keuring liggen bij de elektricien of verhuurder`), 14, ph - 7);
  doc.text(`blz. ${doc.getNumberOfPages()}`, pb - 14, ph - 7, { align: 'right' });
  doc.setTextColor(...ZWART);
}
function bol(doc, x, y, r, tekst, kleur, wit = true) {
  doc.setFillColor(...kleur); doc.setDrawColor(255); doc.setLineWidth(r * 0.12); doc.circle(x, y, r, 'FD');
  doc.setTextColor(...(wit ? [255, 255, 255] : ZWART)); doc.setFont('helvetica', 'bold'); doc.setFontSize(r * 3.2);
  doc.text(tekst, x, y + r * 0.42, { align: 'center' }); doc.setTextColor(...ZWART); doc.setLineWidth(0.2);
}
// Plaatsing zonder overlap: elk nummer en elk etiket zoekt een vrije plek rond zijn punt, met een lijntje naar het
// symbool, zodat het nummer nooit over de generator, kast of verbruiker zelf valt.
function plaatser(kader) {
  const bezet = [];
  const binnen = (r) => r[0] >= kader.x + 1 && r[1] >= kader.y + 1 && r[2] <= kader.x + kader.b - 1 && r[3] <= kader.y + kader.h - 1;
  const vrij = (r) => binnen(r) && !bezet.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
  return { bezet, vrij, neem: (r) => bezet.push(r) };
}
const RICHTINGEN = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7], [0, -1], [0, 1], [-1, 0], [1, 0]];
// Nummerbol naast het punt, met een lijntje ernaartoe.
function bolNaast(doc, pl, x, y, r, tekst, kleur, afstand) {
  let best = null;
  for (const f of [1, 1.6, 2.3, 3.2]) {
    for (const [dx, dy] of RICHTINGEN) { const cx = x + dx * afstand * f; const cy = y + dy * afstand * f; const rr = [cx - r - 0.6, cy - r - 0.6, cx + r + 0.6, cy + r + 0.6]; if (pl.vrij(rr)) { best = [cx, cy, rr]; break; } }
    if (best) break;
  }
  if (!best) { const cx = x - afstand * 0.7; const cy = y - afstand * 0.7; best = [cx, cy, [cx - r, cy - r, cx + r, cy + r]]; }
  const [cx, cy, rr] = best; pl.neem(rr);
  const d = Math.hypot(cx - x, cy - y) || 1;
  doc.setDrawColor(...kleur); doc.setLineWidth(0.35); doc.line(x, y, cx - ((cx - x) / d) * r, cy - ((cy - y) / d) * r);
  doc.setFillColor(...kleur); doc.circle(x, y, 0.7, 'F');
  bol(doc, cx, cy, r, tekst, kleur);
  return [cx, cy];
}
function etiketMaat(doc, regels) {
  const w = Math.max(...regels.map((r, i) => { doc.setFont('helvetica', i ? 'normal' : 'bold'); doc.setFontSize(7); return doc.getTextWidth(zonderPijl(r)); })) + 3;
  return [w, regels.length * 3 + 1.6];
}
function etiket(doc, x, y, regels, kleur, pl, rand = 2) {
  const [w, h] = etiketMaat(doc, regels);
  const kand = [[x + rand, y - h - rand], [x + rand, y + rand], [x - w - rand, y - h - rand], [x - w - rand, y + rand], [x - w / 2, y - h - rand * 2], [x - w / 2, y + rand * 2], [x + rand * 3, y - h / 2], [x - w - rand * 3, y - h / 2],
    [x + rand * 4, y - h - rand * 4], [x - w - rand * 4, y + rand * 4], [x + rand * 4, y + rand * 4], [x - w - rand * 4, y - h - rand * 4]];
  let k = kand.find(([bx, by]) => pl.vrij([bx, by, bx + w, by + h]));
  if (!k) k = kand.find(([bx, by]) => pl.vrij([bx, by, bx + w, by + h].map((v, i) => v))) || kand[0];
  const [bx, by] = k; pl.neem([bx, by, bx + w, by + h]);
  doc.setFillColor(255, 255, 255); doc.setDrawColor(...kleur); doc.setLineWidth(0.3); doc.roundedRect(bx, by, w, h, 0.8, 0.8, 'FD');
  regels.forEach((r, i) => { doc.setFont('helvetica', i ? 'normal' : 'bold'); doc.setFontSize(7); doc.setTextColor(...(i ? ZWART : kleur)); doc.text(zonderPijl(r), bx + 1.5, by + 3 + i * 3); });
  doc.setTextColor(...ZWART); doc.setLineWidth(0.2);
}
function tabel(doc, x, y, kolommen, rijen, { maxY, nieuweBlz, rijH = 5.4, pt = 8.5, kopKleur = LICHT } = {}) {
  const tekenKop = () => {
    doc.setFillColor(...kopKleur); doc.rect(x, y, kolommen.reduce((t, k) => t + k.b, 0), 6.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(pt); let cx = x;
    for (const k of kolommen) { doc.text(k.t, k.r ? cx + k.b - 1.5 : cx + 1.5, y + 4.4, { align: k.r ? 'right' : 'left' }); cx += k.b; }
    y += 6.5;
  };
  tekenKop();
  for (const r of rijen) {
    doc.setFontSize(pt);
    const cel = kolommen.map((k, i) => { doc.setFont('helvetica', k.vet ? 'bold' : 'normal'); return doc.splitTextToSize(zonderPijl(r[i] ?? ''), k.b - 3); });
    const h = Math.max(rijH, Math.max(...cel.map((c) => c.length)) * (pt * 0.42) + 2);
    if (maxY && y + h > maxY && nieuweBlz) { y = nieuweBlz(); tekenKop(); }
    let cx = x;
    kolommen.forEach((k, i) => {
      doc.setFont('helvetica', k.vet ? 'bold' : 'normal');
      if (k.link && r.links?.[i]) doc.textWithLink(cel[i][0] || '', cx + 1.5, y + pt * 0.42 + 0.6, { url: r.links[i] });
      else doc.text(cel[i], k.r ? cx + k.b - 1.5 : cx + 1.5, y + pt * 0.42 + 0.6, { align: k.r ? 'right' : 'left' });
      cx += k.b;
    });
    y += h; doc.setDrawColor(228); doc.line(x, y, cx, y);
  }
  return y;
}
const kaartUrl = (pos) => (pos ? `https://www.google.com/maps?q=${pos[1].toFixed(6)},${pos[0].toFixed(6)}` : '');
const plaatsTekst = (p) => [p.vast?.adres, p.pos ? `${p.pos[1].toFixed(5)}, ${p.pos[0].toFixed(5)}` : ''].filter(Boolean).join(' · ');

// ── PDF ───────────────────────────────────────────────────────────────────────────────────────────────
export async function stroomDossierPdf({ plan, lagen, items, elementenMap, fase, fasen = [], stroom, voortgang = () => {}, bewaar = true, stap = null, onTegels = null }) {
  const d = dossierGegevens({ stroom, items, elementenMap, plan, fasen });
  if (!d.punten.length) throw new Error('Er staan nog geen stroombronnen met aansluitingen op het plan.');
  const ondergrond = plan.basiskaart === 'stratenkaart' ? 'lijntekening' : plan.basiskaart || 'luchtfoto';
  const printLagen = lagen.filter((l) => l.printbaar !== false).map((l) => l.id);
  const alleIds = new Set(d.punten.flatMap((p) => [...p.ids]));
  const instBasis = { papier: 'A3', orientatie: 'liggend', ondergrond, dimmen: 0.35, legende: false, stuklijst: false, maten: false, dpi: 130, raster: { aan: false }, lagen: printLagen, doek: false, toebehoren: 'nooit', onderleggers: true, onTegels };
  const L = indeling(instBasis);
  const schaalVoor = (geoms, min) => Math.max(min, passendeSchaal(L.kader.b * 0.86, L.kader.h * 0.86, geo.kader(geoms)));
  // Kabels in de kleur van hun spanning (zoals op de kaart in de app), niet die van het bibliotheek-element.
  const spanVan = new Map(d.punten.flatMap((p) => p.kabels.map((c) => [c.item.id, c.spanning])));
  items = items.map((it) => (spanVan.has(it.id) ? { ...it, stijl: { ...(it.stijl || {}), kleur: KABEL_KLEUR[spanVan.get(it.id)] || it.stijl?.kleur, dikte: Math.max(Number(it.stijl?.dikte) || 1, 3) } } : it));
  const dim = (it, sterk) => ({ ...it, naam: sterk ? '' : it.naam, stijl: { ...(it.stijl || {}), dekking: sterk ? 0.12 : 0.3, vuldekking: 0.04 } });
  const meldingen = [];
  let doc = null;

  // 1. Leverplan: enkel stroompunten scherp, groot genummerd.
  const nKaart = 1 + d.punten.length; let kNu = 0;
  stap?.(kNu++, nKaart, 'Leverplan');
  voortgang('Leverplan…');
  const overzichtItems = items.map((it) => (alleIds.has(it.id) ? it : dim(it, false)));
  const ptGeoms = [...d.punten.map((p) => p.b.item.geometrie), ...d.tanks.map((t) => t.item.geometrie)].filter(Boolean);
  const r1 = await maakPdf({
    plan, lagen, items: overzichtItems, elementenMap, fase, voortgang: () => {},
    inst: {
      ...instBasis, titel: 'Stroom · leverplan', centrum: (() => { const k = geo.kader(ptGeoms); return [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2]; })(), schaal: schaalVoor(ptGeoms, 500),
      erbij: ({ doc: dd, project, kader }) => {
        dd.saveGraphicsState(); dd.rect(kader.x, kader.y, kader.b, kader.h, null); dd.clip(); dd.discardPath();
        const pl = plaatser(kader);
        const pts = d.punten.filter((p) => p.pos).map((p) => ({ p, xy: project(p.pos) }));
        // Eerst de plekken van de generatoren zelf vrijhouden.
        for (const { xy: [x, y] } of pts) pl.neem([x - 3, y - 3, x + 3, y + 3]);
        const bollen = pts.map(({ p, xy: [x, y] }) => ({ p, c: bolNaast(dd, pl, x, y, 4.6, p.nr, p.vast ? [21, 128, 61] : ROOD, 11) }));
        for (const { p, c: [cx, cy] } of bollen) etiket(dd, cx, cy, [`${p.nr} · ${p.vast ? p.titel : `${p.kva || '?'} kVA`}`, p.lev], p.vast ? [21, 128, 61] : ROOD, pl, 5);
        for (const t of d.tanks) { if (!t.pos) continue; const [x, y] = project(t.pos); bolNaast(dd, pl, x, y, 3.8, t.nr, [180, 83, 9], 9); }
        dd.restoreGraphicsState();
      },
    },
  });
  doc = r1.doc; meldingen.push(...r1.meldingen);
  const [pb, ph] = [L.pb, L.ph];
  voet(doc, plan, pb, ph);

  // 2. Leverlijst + benodigdheden per leverancier.
  doc.addPage([pb, ph], 'landscape');
  kop(doc, 'Leverlijst stroom', `${plan.naam}${fase ? ` · ${fase.naam}` : ''} · wat moet waar staan · klik op de plaats voor de kaart`, pb);
  const nieuweBlz = (t) => () => { voet(doc, plan, pb, ph); doc.addPage([pb, ph], 'landscape'); kop(doc, t, plan.naam, pb); return 32; };
  const lever = [...d.punten.map((p) => ({ p, rij: [p.nr, p.titel, p.lev, plaatsTekst(p), p.wanneer || 'hele event', [p.vast ? (p.vast.sleutel ? `sleutel: ${p.vast.sleutel}` : 'vaste aansluiting: sleutel en toegang regelen') : p.tank ? `tank ${g1(p.tank)} L` : '', p.kasten.length ? `${p.kasten.reduce((t, k) => t + k.aantal, 0)} verdeelkast(en)` : '', p.kabels.length ? `${p.kabels.length} kabels` : ''].filter(Boolean).join(' · ')] })),
    ...d.tanks.map((t) => ({ p: t, rij: [t.nr, t.titel, t.lev, plaatsTekst(t), t.wanneer || 'hele event', ''] }))];
  let y = tabel(doc, 14, 32, [{ t: 'Nr', b: 14, vet: true }, { t: 'Wat', b: 90, vet: true }, { t: 'Leverancier', b: 60 }, { t: 'Plaats', b: 92, link: true }, { t: 'Wanneer', b: 45 }, { t: 'Mee te nemen / aandacht', b: 91 }],
    lever.map(({ p, rij }) => Object.assign(rij, { links: { 3: kaartUrl(p.pos) } })), { maxY: ph - 16, nieuweBlz: nieuweBlz('Leverlijst stroom (vervolg)') });
  y += 10;
  if (y > ph - 60) y = nieuweBlz('Benodigdheden per leverancier')();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Benodigdheden per leverancier', 14, y); y += 4;
  for (const g of benodigdhedenPerLeverancier(d)) {
    if (y > ph - 40) y = nieuweBlz('Benodigdheden per leverancier (vervolg)')();
    y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ROOD); doc.text(g.lev, 14, y); doc.setTextColor(...ZWART); y += 2;
    y = tabel(doc, 14, y, [{ t: 'Soort', b: 34 }, { t: 'Wat', b: 110, vet: true }, { t: 'Aantal', b: 20, r: true }, { t: 'Stukken', b: 90 }, { t: 'Voor', b: 138 }],
      g.regels.map((r) => [r.soort.slice(2), r.naam, g1(r.aantal), Object.keys(r.detail).length ? stukkenTekst(r.detail) : '', [...new Set(r.codes)].join(', ')]), { maxY: ph - 16, nieuweBlz: nieuweBlz('Benodigdheden per leverancier (vervolg)') });
  }
  voet(doc, plan, pb, ph);

  // 3. Per stroompunt: situatie + aansluitschema.
  for (const p of d.punten) {
    voortgang(`${p.nr} · situatie…`); stap?.(kNu++, nKaart, `${p.nr} · ${p.titel}`);
    const eigen = items.filter((it) => p.ids.has(it.id));
    const geoms = [p.b.item.geometrie, ...eigen.map((i) => i.geometrie)].filter(Boolean);
    const k = geo.kader(geoms);
    const lijst = items.map((it) => (p.ids.has(it.id) ? it : dim(it, alleIds.has(it.id))));
    const codeVan = new Map(p.rijen.map((r) => [basisId(r.k.id), r]));
    const r = await maakPdf({
      plan, lagen, items: lijst, elementenMap, fase, voortgang: () => {}, doc,
      inst: {
        ...instBasis, titel: `Stroom · ${p.nr} ${p.titel}`, centrum: [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2], schaal: schaalVoor(geoms, 250),
        erbij: ({ doc: dd, project, kader }) => {
          dd.saveGraphicsState(); dd.rect(kader.x, kader.y, kader.b, kader.h, null); dd.clip(); dd.discardPath();
          const pl = plaatser(kader);
          // Symbolen vrijhouden, dan eerst de nummers (bron, kasten, verbruikers), dan de kabeletiketten.
          const knopen = []; const gedaan = new Set();
          for (const rr of p.rijen) {
            const id = basisId(rr.k.id); if (gedaan.has(id)) continue; gedaan.add(id);
            const pos = geo.middelpunt(rr.k.item.geometrie); if (!pos) continue;
            const [x, y2] = project(pos); knopen.push({ rr, id, x, y: y2 }); pl.neem([x - 2.5, y2 - 2.5, x + 2.5, y2 + 2.5]);
          }
          const mids = [];
          for (const c of p.kabels) {
            const co = c.item.geometrie?.coordinates; if (!co?.length) continue;
            let m = co[Math.floor(co.length / 2)]; try { const ls = turf.lineString(co); m = turf.along(ls, turf.length(ls) / 2).geometry.coordinates; } catch {}
            const [x, y2] = project(m); mids.push({ c, x, y: y2 }); pl.neem([x - 1.2, y2 - 1.2, x + 1.2, y2 + 1.2]);
          }
          for (const { rr, id, x, y: y2 } of knopen) {
            if (rr.k.s.rol === 'bron') bolNaast(dd, pl, x, y2, 4.4, p.nr, p.vast ? [21, 128, 61] : ROOD, 10);
            else bolNaast(dd, pl, x, y2, 2.9, codeVan.get(id)?.code || rr.code, rr.k.s.rol === 'kast' ? KAST_K : VERBR_K, 7);
          }
          for (const { c, x, y: y2 } of mids) {
            const kl = KABEL_K[c.spanning] || KABEL_K[400];
            dd.setFillColor(...kl); dd.circle(x, y2, 1.1, 'F');
            etiket(dd, x, y2, c.eigen ? [`${c.code} · eigen kabel`, `${c.eigenLev} · ${g1(c.lengte)} m`] : [`${c.code} · ${c.type}`, `${g1(c.lengte)} m > ${c.stukkenTekst}`], kl, pl);
          }
          for (const q of p.kruispunten) { const [x, y2] = project(q.punt); dd.setDrawColor(217, 119, 6); dd.setLineWidth(0.8); dd.line(x - 2.2, y2 - 2.2, x + 2.2, y2 + 2.2); dd.line(x - 2.2, y2 + 2.2, x + 2.2, y2 - 2.2); dd.setLineWidth(0.2); etiket(dd, x, y2, ['Kabelbrug'], [217, 119, 6], pl); }
          dd.restoreGraphicsState();
          // Legende onderaan links.
          const lx = kader.x + 3; let ly = kader.y + kader.h - 25;
          dd.setFillColor(255, 255, 255); dd.setDrawColor(200); dd.roundedRect(lx, ly, 96, 22, 1, 1, 'FD'); ly += 5;
          dd.setFontSize(7.5); dd.setFont('helvetica', 'bold'); dd.text('Legende', lx + 3, ly); dd.setFont('helvetica', 'normal');
          bol(dd, lx + 5, ly + 5, 2.2, 'S', ROOD); dd.text('stroompunt', lx + 9, ly + 6);
          bol(dd, lx + 34, ly + 5, 2.2, 'V', KAST_K); dd.text('verdeelkast', lx + 38, ly + 6);
          bol(dd, lx + 63, ly + 5, 2.2, 'A', VERBR_K); dd.text('verbruiker', lx + 67, ly + 6);
          dd.setDrawColor(...KABEL_K[400]); dd.setLineWidth(0.8); dd.line(lx + 3, ly + 12, lx + 10, ly + 12); dd.text('400 V (5G)', lx + 12, ly + 13);
          dd.setDrawColor(...KABEL_K[230]); dd.line(lx + 34, ly + 12, lx + 41, ly + 12); dd.text('230 V (3G)', lx + 43, ly + 13);
          dd.setDrawColor(217, 119, 6); dd.line(lx + 64, ly + 10.5, lx + 67, ly + 13.5); dd.line(lx + 64, ly + 13.5, lx + 67, ly + 10.5); dd.text('kabelbrug', lx + 69, ly + 13); dd.setLineWidth(0.2);
        },
      },
    });
    doc = r.doc; for (const m of r.meldingen) if (!meldingen.includes(m)) meldingen.push(m);
    voet(doc, plan, pb, ph);

    voortgang(`${p.nr} · aansluitschema…`);
    doc.addPage([pb, ph], 'landscape');
    const ondertitel = p.vast
      ? `${p.lev} · ${plaatsTekst(p)}${p.vast.max_ampere ? ` · max ${p.vast.max_ampere} A` : ''}`
      : `${p.kva || '?'} kVA · ${p.lev} · belasting ± ${g1(p.belast || 0, 1)} kW${p.procent != null ? ` (${Math.round(p.procent)} % bij ${Math.round(d.gelijktijdigheid * 100)} % gelijktijdigheid)` : ''}`;
    kop(doc, `${p.nr} · ${p.titel}`, ondertitel, pb);
    schemaBlad(doc, p, { x: 14, y: 34, b: 238, maxY: ph - 16, nieuw: () => { voet(doc, plan, pb, ph); doc.addPage([pb, ph], 'landscape'); kop(doc, `${p.nr} · ${p.titel} (vervolg)`, ondertitel, pb); return 34; } });
    // Rechterkolom (op het eerste schemablad): benodigdheden, brandstof, controlelijst.
    benodigdBlok(doc, p, { x: 262, y: 34, b: pb - 14 - 262, maxY: ph - 16 });
    voet(doc, plan, pb, ph);
  }

  // 4. Binnenlocaties: plan van binnen met kasten, verbruikers en kabels, plus wat erbinnen nodig is.
  for (const g of d.binnen) {
    voortgang(`${g.nr} · ${g.naam}…`);
    doc.addPage([pb, ph], 'landscape');
    kop(doc, `${g.nr} · Binnen: ${g.naam}`, `gevoed vanuit ${g.punten.join(', ')} · nummers zoals in het aansluitschema van dat stroompunt`, pb);
    binnenBlad(doc, g, elementenMap, { x: 14, y: 32, b: 236, h: ph - 32 - 16 });
    binnenLijstBlok(doc, g, { x: 262, y: 34, b: pb - 14 - 262, maxY: ph - 16 });
    voet(doc, plan, pb, ph);
  }

  stap?.(nKaart, nKaart, 'Klaar');
  if (bewaar) doc.save(bestandsnaam(`Stroomdossier - ${plan.naam} v${plan.versie}.pdf`));
  return { doc, meldingen, naam: bestandsnaam(`Stroomdossier - ${plan.naam} v${plan.versie}.pdf`) };
}

// Aansluitschema als boom: per regel de kabel (nummer, type, lengte, stukken, uitgang op de voeding) en de knoop.
function schemaBlad(doc, p, { x, y, b, maxY, nieuw }) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Aansluitschema', x, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIJS);
  doc.text('Van de stroombron naar elke verbruiker: op welke uitgang, met welke kabel en welke stukken. Nummers = nummers op de situatiekaart.', x, y + 2); doc.setTextColor(...ZWART); y += 8;
  const IND = 13; const BW = 112; const BH = 10.5; const KH = 7.5;
  const vorige = [];
  for (const r of p.rijen) {
    const nodig = r.kabels.length * KH + BH + 3;
    if (y + nodig > maxY) { y = nieuw(); vorige.length = 0; }
    const bx = x + r.diepte * IND;
    if (r.diepte > 0) {
      const lx = x + (r.diepte - 1) * IND + 4;
      const boven = vorige[r.diepte - 1] ?? y;
      doc.setDrawColor(150); doc.setLineWidth(0.3); const my = y + r.kabels.length * KH + BH / 2; doc.line(lx, boven, lx, my); doc.line(lx, my, bx, my);
    }
    if (r.kabels.length) {
      r.kabels.forEach((c, ci) => {
        const kl = KABEL_K[c.spanning] || KABEL_K[400]; const yy = y + ci * KH;
        doc.setFillColor(...kl); doc.roundedRect(bx, yy + 1, 9, 4.6, 0.8, 0.8, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.text(c.code, bx + 4.5, yy + 4.2, { align: 'center' });
        doc.setTextColor(...ZWART); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6);
        const t = zonderPijl(c.eigen ? `${r.uitgang ? `op ${r.uitgang} · ` : ''}eigen kabel van ${c.eigenLev} (${c.eigenL} m) · ${g1(c.lengte)} m nodig` : `${r.uitgang ? `op ${r.uitgang} · ` : ''}${c.type} · ${g1(c.lengte)} m > ${c.stukkenTekst}${c.kruisingen ? ` · ${c.kruisingen}× kabelbrug` : ''}`);
        doc.text(t, bx + 11, yy + 4.3);
        if (ci === 0 && r.geenUitgang) { const w = doc.getTextWidth(t); doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold'); doc.text('geen passende uitgang: verdeelkast ertussen', bx + 13 + w, yy + 4.3); doc.setTextColor(...ZWART); }
      });
      y += KH * r.kabels.length;
    }
    const rol = r.k.s.rol; const kl = rol === 'bron' ? (p.vast ? [21, 128, 61] : ROOD) : rol === 'kast' ? KAST_K : VERBR_K;
    const over = rol === 'bron' ? r.k.procent > 100 : rol === 'kast' && r.k.s.ampere && r.k.maxA > r.k.s.ampere;
    doc.setDrawColor(...(over ? [185, 28, 28] : kl)); doc.setLineWidth(over ? 0.7 : 0.35); doc.setFillColor(255, 255, 255); doc.roundedRect(bx, y, Math.min(BW, b - (bx - x)), BH, 1, 1, 'FD');
    doc.setFillColor(...kl); doc.rect(bx, y, 11, BH, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(rol === 'bron' ? p.nr : r.code, bx + 5.5, y + 6.4, { align: 'center' });
    doc.setTextColor(...ZWART); doc.setFontSize(8.6); doc.text(doc.splitTextToSize(zonderPijl(r.k.naam), BW - 16)[0], bx + 13, y + 4.3);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...GRIJS);
    const s = r.k.s;
    const info = rol === 'bron' ? [s.kva ? `${s.kva} kVA` : '', `belast ± ${g1(r.k.belast || 0, 1)} kW`, (r.k.bezetting || []).map((u) => `${u.bezet}/${u.aantal} × ${u.type}`).join(', ')]
      : rol === 'kast' ? [s.ampere ? `${s.ampere} A` : '', `${g1(r.k.kw || 0, 1)} kW`, `L1 ${g1(r.k.fase?.L1 || 0, 1)} · L2 ${g1(r.k.fase?.L2 || 0, 1)} · L3 ${g1(r.k.fase?.L3 || 0, 1)} kW`, (r.k.bezetting || []).map((u) => `${u.bezet}/${u.aantal} × ${u.type}`).join(', ')]
        : [s.kw ? `${s.kw} kW` : 'kW onbekend', s.fase === '3F' ? '3 fasen' : s.fase, s.ampere ? `${s.ampere} A` : ''];
    doc.text(doc.splitTextToSize(info.filter(Boolean).join(' · '), BW - 16)[0], bx + 13, y + 8.4); doc.setTextColor(...ZWART);
    if (!r.kabels.length && r.eigenKabel) { doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); doc.setTextColor(...(r.eigenKabel.past ? [21, 128, 61] : [185, 28, 28])); doc.text(zonderPijl(`eigen kabel van ${r.eigenKabel.lev} (${r.eigenKabel.lengte} m)${r.eigenKabel.afstand != null ? ` · ± ${g1(r.eigenKabel.afstand)} m tot de kast` : ''}`), bx + Math.min(BW, b - (bx - x)) + 2, y + 6.2); doc.setTextColor(...ZWART); }
    else if (!r.kabels.length && r.diepte > 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); doc.setTextColor(185, 28, 28); doc.text('geen kabel getekend', bx + Math.min(BW, b - (bx - x)) + 2, y + 6.2); doc.setTextColor(...ZWART); }
    vorige[r.diepte] = y + BH; vorige.length = r.diepte + 1;
    y += BH + 3;
  }
  doc.setLineWidth(0.2);
  return y;
}

function benodigdBlok(doc, p, { x, y, b, maxY }) {
  const titel = (t) => { y += 7; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ZWART); doc.text(t, x, y); y += 2; };
  doc.setFillColor(248, 248, 246); doc.rect(x - 4, 28, b + 8, maxY - 28, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Mee te nemen voor ' + p.nr, x, y); y += 2;
  const rij = meeRijen(p).map(([n, w, l]) => [g1(n), w, l]);
  y = tabel(doc, x, y + 2, [{ t: 'Aantal', b: 15, r: true, vet: true }, { t: 'Wat', b: b - 15 - 38 }, { t: 'Leverancier', b: 38 }], rij, { pt: 8 });
  if (!p.vast && (p.tank || p.lph)) {
    titel('Brandstof');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2);
    const t = [p.tank ? `Tank ${g1(p.tank)} L` : '', p.lph ? `verbruik ± ${g1(p.lph, 1)} L/u bij vollast` : '', p.tank && p.lph ? `± ${g1(p.tank / p.lph)} u zonder bijtanken` : ''].filter(Boolean).join(' · ');
    doc.text(doc.splitTextToSize(t, b), x, y + 3); y += 8;
  }
  if (p.meldingen.length) {
    titel('Aandacht');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    for (const m of p.meldingen.slice(0, 8)) { const l = doc.splitTextToSize(zonderPijl(`${m.soort === 'fout' ? '!' : '·'} ${m.tekst}`), b - 2); if (y + l.length * 3.6 > maxY - 50) break; doc.setTextColor(...(m.soort === 'fout' ? [185, 28, 28] : ZWART)); doc.text(l, x, y + 3); y += l.length * 3.6 + 1; }
    doc.setTextColor(...ZWART);
  }
  titel('Bij het plaatsen');
  const lijst = p.vast
    ? ['Sleutel en toegang tot de kast geregeld met de beheerder', 'Afzekering in de kast nagekeken (max ' + (p.vast.max_ampere || '?') + ' A)', 'Kabels uit de doorgang of in een kabelbrug', 'Verdeelkasten droog en afgeschermd voor publiek', 'Aangesloten en getest door een bevoegd persoon (BA4/BA5)']
    : ['Vlakke, stevige ondergrond; lekbak of absorptiemat onder de generator', 'Aardpen geslagen en de aardingskabel aangesloten', 'Brandblusser bij de generator', 'Generator afgeschermd met hekken, uitlaat weg van tenten en publiek', 'Kabels uit de doorgang of in een kabelbrug', 'Verdeelkasten droog en afgeschermd voor publiek', 'Brandstof gevuld; wie tankt bij en wanneer', 'Aangesloten en getest door een bevoegd persoon (BA4/BA5)'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2);
  for (const t of lijst) { if (y > maxY - 6) break; doc.setDrawColor(120); doc.rect(x, y + 1, 3, 3); doc.text(doc.splitTextToSize(t, b - 6), x + 5, y + 3.6); y += 5.6; }
}

// Binnenplan in de eigen maten (meter, y naar boven): alle inrichting grijs, stroom in kleur en genummerd.
function binnenBlad(doc, g, elementenMap, { x, y, b, h }) {
  const ringen = (geom) => (geom.type === 'Polygon' ? geom.coordinates : geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'Point' ? [[geom.coordinates]] : []);
  const alle = [...g.inhoud.flatMap((it) => ringen(it.velden.binnen.lokaal.geometrie).flat()), ...(g.omtrek || [])];
  if (!alle.length) { doc.setFontSize(9); doc.text('Geen binnenplan getekend.', x, y + 6); return; }
  const xs = alle.map((c) => c[0]); const ys = alle.map((c) => c[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const sch = Math.min((b - 10) / Math.max(1, x1 - x0), (h - 16) / Math.max(1, y1 - y0));
  const ox = x + 5 + ((b - 10) - (x1 - x0) * sch) / 2; const oy = y + 5 + ((h - 16) - (y1 - y0) * sch) / 2;
  const P = (c) => [ox + (c[0] - x0) * sch, oy + (y1 - c[1]) * sch];
  doc.setDrawColor(225); doc.rect(x, y, b, h);
  if (g.omtrek) { const pts = g.omtrek.map(P); doc.setDrawColor(...ZWART); doc.setLineWidth(0.8); for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); doc.setLineWidth(0.2); }
  const stroomIds = new Set([...g.rijen.map((r) => basisId(r.k.id)), ...g.kabels.map((c) => c.item.id)]);
  // Inrichting en wanden (grijs).
  for (const it of g.inhoud) {
    if (stroomIds.has(it.id)) continue;
    const gm = it.velden.binnen.lokaal.geometrie;
    doc.setDrawColor(170); doc.setLineWidth(0.25);
    for (const r of ringen(gm)) { if (r.length < 2) continue; const pts = r.map(P); for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); }
  }
  const pl = plaatser({ x, y, b, h });
  // Kabels.
  for (const c of g.kabels) {
    const co = c.item.velden.binnen.lokaal?.geometrie?.coordinates; if (!co?.length) continue;
    const kl = KABEL_K[c.spanning] || KABEL_K[400]; const pts = co.map(P);
    doc.setDrawColor(...kl); doc.setLineWidth(0.7); doc.setLineDashPattern([1.5, 1], 0);
    for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    doc.setLineDashPattern([], 0); doc.setLineWidth(0.2);
  }
  // Kasten en verbruikers: vorm in kleur en nummer ernaast.
  const knopen = []; const gedaan = new Set();
  for (const r of g.rijen) {
    const id = basisId(r.k.id); if (gedaan.has(id)) continue; gedaan.add(id);
    const gm = r.k.item.velden.binnen.lokaal?.geometrie; if (!gm) continue;
    const kl = r.k.s.rol === 'kast' ? KAST_K : VERBR_K;
    doc.setDrawColor(...kl); doc.setLineWidth(0.5);
    for (const ring of ringen(gm)) { const pts = ring.map(P); if (pts.length > 1) for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); }
    const m = r.k.item.velden.binnen.lokaal.midden || (gm.type === 'Point' ? gm.coordinates : ringen(gm)[0]?.[0]);
    if (!m) continue; const [px, py] = P(m); knopen.push({ r, px, py, kl }); pl.neem([px - 2, py - 2, px + 2, py + 2]);
  }
  const mids = g.kabels.map((c) => { const co = c.item.velden.binnen.lokaal?.geometrie?.coordinates; if (!co?.length) return null; const m = co[Math.floor((co.length - 1) / 2)]; const n = co[Math.min(co.length - 1, Math.floor((co.length - 1) / 2) + 1)]; const [ax, ay] = P(m); const [bx2, by2] = P(n); return { c, x: (ax + bx2) / 2, y: (ay + by2) / 2 }; }).filter(Boolean);
  for (const k of mids) pl.neem([k.x - 1, k.y - 1, k.x + 1, k.y + 1]);
  for (const { r, px, py, kl } of knopen) bolNaast(doc, pl, px, py, 2.9, `${r.p.nr}.${r.code}`.replace(/^S\d+\./, '') , kl, 7);
  for (const { c, x: kx, y: ky } of mids) { const kl = KABEL_K[c.spanning] || KABEL_K[400]; doc.setFillColor(...kl); doc.circle(kx, ky, 1, 'F'); etiket(doc, kx, ky, [`${c.code} · ${c.type}`, `${g1(c.lengte)} m > ${c.stukkenTekst}`], kl, pl); }
  doc.setLineWidth(0.2);
  // Schaalstok.
  const m10 = [1, 2, 5, 10, 20].find((v) => v * sch > 25) || 20;
  doc.setDrawColor(...ZWART); doc.setLineWidth(0.5); doc.line(x + 4, y + h - 5, x + 4 + m10 * sch, y + h - 5); doc.setLineWidth(0.2);
  doc.setFontSize(7.5); doc.text(`${m10} m`, x + 6 + m10 * sch, y + h - 4);
}

function binnenLijstBlok(doc, g, { x, y, b, maxY }) {
  doc.setFillColor(248, 248, 246); doc.rect(x - 4, 28, b + 8, maxY - 28, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Aansluitingen binnen', x, y); y += 2;
  const rijen = g.rijen.map((r) => [`${r.p.nr}.${r.code}`, `${r.k.naam}${r.k.s.rol === 'verbruiker' && r.k.s.kw ? ` · ${r.k.s.kw} kW` : ''}`, r.kabels.map((c) => `${c.code} ${c.type} ${g1(c.lengte)} m${r.uitgang ? ` op ${r.uitgang}` : ''}`).join('; ') || (r.geenUitgang ? 'geen passende uitgang' : '')]);
  y = tabel(doc, x, y + 2, [{ t: 'Nr', b: 18, vet: true }, { t: 'Wat', b: b - 18 - 62 }, { t: 'Kabel', b: 62 }], rijen, { pt: 7.8, maxY });
  y += 8; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Mee te nemen binnen', x, y); y += 2;
  const mee = [...g.kasten.map((k) => [g1(k.aantal), `${k.naam} (${k.codes.join(', ')})`, k.leverancier]), ...g.kabelTypes.map((c) => [g1(Object.values(c.stukken).reduce((a, q) => a + q, 0)), `Kabel ${c.type}: ${stukkenTekst(c.stukken)}`, c.leverancier])];
  tabel(doc, x, y + 2, [{ t: 'Aantal', b: 15, r: true, vet: true }, { t: 'Wat', b: b - 15 - 38 }, { t: 'Leverancier', b: 38 }], mee.length ? mee : [['', 'Niets extra binnen', '']], { pt: 8, maxY });
}
