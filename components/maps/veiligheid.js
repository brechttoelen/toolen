'use client';

// Brandveiligheid voor tijdelijke evenementen (Vlaanderen).
// Elke hulpverleningszone heeft een eigen reglement; de waarden per zone staan in brandweerzones.js.
import * as turf from '@turf/turf';
import { ZONES } from './brandweerzones';

const M = { units: 'meters' };

// Richtwaarden als de zone (nog) geen eigen waarde heeft: model van Zone Vlaamse Ardennen
// (Oudenaarde e.a.), reglement voor tijdelijke evenementen.
export const STANDAARD = {
  personen_per_m2: 3,
  cm_per_persoon: 1,
  min_uitgangen: 2,
  min_breedte_uitgang_cm: 80,
  brede_route: { vanaf_personen: 500, breedte_cm: 240 },
  max_afstand_uitgang_m: 30,
  max_afstand_tweede_m: 60,
  blusser_per_m2: 150,
  brandweer: { max_afstand_m: 60, breedte_m: 4, hoogte_m: 4 },
};
export const STANDAARD_BRON = 'Richtwaarden (model Zone Vlaamse Ardennen)';

export const VELDEN = [
  ['personen_per_m2', 'Personen per m²', ''],
  ['cm_per_persoon', 'Uitgangsbreedte per persoon', 'cm'],
  ['min_uitgangen', 'Min. aantal uitgangen', ''],
  ['min_breedte_uitgang_cm', 'Min. breedte uitgang', 'cm'],
  ['brede_route.vanaf_personen', 'Brede uitgang vanaf', 'pers.'],
  ['brede_route.breedte_cm', 'Breedte brede uitgang', 'cm'],
  ['max_afstand_uitgang_m', 'Max. afstand tot uitgang', 'm'],
  ['max_afstand_tweede_m', 'Max. afstand tot 2e uitgang', 'm'],
  ['blusser_per_m2', '1 blustoestel per', 'm²'],
  ['brandweer.max_afstand_m', 'Brandweerwagen max. op', 'm'],
  ['brandweer.breedte_m', 'Brandweertoegang breedte', 'm'],
  ['brandweer.hoogte_m', 'Brandweertoegang hoogte', 'm'],
];
export const haal = (o, pad) => pad.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const zetPad = (o, pad, v) => { const ks = pad.split('.'); const r = { ...o }; let c = r; for (let i = 0; i < ks.length - 1; i++) { c[ks[i]] = { ...(c[ks[i]] || {}) }; c = c[ks[i]]; } c[ks[ks.length - 1]] = v; return r; };
const getal = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

// Gemeenten van vóór de fusies van 2025 (en enkele oudere), zodat ook oude namen een zone vinden.
const VROEGER = {
  'Beveren-Kruibeke-Zwijndrecht': ['Beveren', 'Kruibeke', 'Zwijndrecht'], 'Bilzen-Hoeselt': ['Bilzen', 'Hoeselt'], 'Tongeren-Borgloon': ['Tongeren', 'Borgloon'],
  'Tessenderlo-Ham': ['Tessenderlo', 'Ham'], 'Merelbeke-Melle': ['Merelbeke', 'Melle'], 'Nazareth-De Pinte': ['Nazareth', 'De Pinte'],
  Pajottegem: ['Galmaarden', 'Gooik', 'Herne'], Lochristi: ['Wachtebeke'], Lokeren: ['Moerbeke'], Wingene: ['Ruiselede'], Tielt: ['Meulebeke'],
  Evergem: ['Assenede'], Kruisem: ['Kruishoutem', 'Zingem'], Lievegem: ['Lovendegem', 'Waarschoot', 'Zomergem'], Deinze: ['Nevele'], Aalter: ['Knesselare'],
  Oudsbergen: ['Meeuwen-Gruitrode', 'Opglabbeek'], Pelt: ['Neerpelt', 'Overpelt'], 'Puurs-Sint-Amands': ['Puurs', 'Sint-Amands'],
};
const namenVan = (z) => (z.gemeenten || []).flatMap((g) => [g, ...(VROEGER[g] || [])]);

// Zone zoeken op gemeente (ook deelgemeenten als die in de lijst staan), of in een vrije tekst zoals "Markt Oudenaarde".
export function zoneVoorTekst(tekst) {
  const t = ` ${String(tekst || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, ' ')} `;
  let beste = null;
  for (const z of ZONES) {
    for (const g of namenVan(z)) {
      const n = ` ${String(g).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, ' ').trim()} `;
      if (n.trim() && t.includes(n) && (!beste || n.length > beste.n)) beste = { zone: z, gemeente: g, n: n.length };
    }
  }
  return beste;
}
export const zoneOpId = (id) => ZONES.find((z) => z.id === id) || null;
export const gemeenteInZone = (z, g) => (z ? namenVan(z) : []).some((x) => norm(x) === norm(g));

// Geldende regels: standaard < zone < eigen aanpassingen in het plan. Per waarde: waar komt ze vandaan.
export function instBrand(plan) {
  const b = plan?.instellingen?.brandveiligheid || {};
  const zone = zoneOpId(b.zone);
  let regels = JSON.parse(JSON.stringify(STANDAARD));
  const herkomst = {};
  for (const [pad] of VELDEN) herkomst[pad] = 'standaard';
  for (const [pad] of VELDEN) {
    const zv = getal(haal(zone?.regels, pad));
    if (zv != null) { regels = zetPad(regels, pad, zv); herkomst[pad] = 'zone'; }
    const ev = getal(haal(b.eigen, pad));
    if (ev != null) { regels = zetPad(regels, pad, ev); herkomst[pad] = 'eigen'; }
  }
  if (zone?.regels?.uitgangen && herkomst.min_uitgangen !== 'eigen') regels.uitgangen = zone.regels.uitgangen;
  return { aan: b.aan !== false, zone, regels, herkomst, eigen: b.eigen || {} };
}

// Aantal uitgangen voor een aantal personen: tabel van de zone, anders het minimum.
export function nodigeUitgangen(personen, R) {
  const u = R.uitgangen;
  if (!u?.tabel?.length) return R.min_uitgangen || 0;
  for (const [max, n] of u.tabel) if (max == null || personen <= max) return n;
  if (u.daarna) return u.daarna.basis + Math.ceil((personen - (u.daarna.vanaf || 0)) / u.daarna.per);
  return u.tabel[u.tabel.length - 1][1];
}
export const zetEigen = (eigen, pad, v) => zetPad(eigen || {}, pad, v);

// ---------- Soorten veiligheidselementen ----------
export const veiligheidVan = (el) => el?.eigenschappen?.veiligheid || null;
const isTent = (el) => /tent|chapiteau|paviljoen/i.test(el?.categorie || '') && !el?.eigenschappen?.vloer && !el?.eigenschappen?.module;
export const isPubliekeStructuur = (it, el) => it?.soort === 'element' && it.geometrie?.type === 'Polygon' && (it.velden?.publiek ?? isTent(el)) === true;

export function capaciteit(it, el, regels) {
  const opp = (() => { try { return turf.area(it.geometrie); } catch { return 0; } })();
  const eigen = getal(it.velden?.personen);
  return { opp, personen: eigen ?? Math.floor(opp * (regels.personen_per_m2 || 0)), eigen: eigen != null };
}

const fmt = (n, d = 0) => Number(n).toFixed(d).replace('.', ',');

// Per publieke tent: wat er is en wat er moet zijn (checklist). Gebruikt door de
// werkruimte Veiligheid, het veiligheidsplan en de meldingen van controle.js.
export function tentChecklist({ plan, items, elementenMap, opDeGrond, afstand }) {
  const ib = instBrand(plan);
  const R = ib.regels;
  const elVan = (it) => (it.element_id ? elementenMap.get(it.element_id) : null);
  const zicht = items.filter((i) => !i.verborgen && i.geometrie);
  const soort = (s) => zicht.filter((i) => veiligheidVan(elVan(i)) === s);
  const naam = (it) => it.naam || elVan(it)?.naam || 'Item';
  const uitgangen = soort('uitgang').filter((i) => i.geometrie.type === 'LineString');
  const blussers = soort('blusser');
  const structuren = zicht.filter((i) => i.geometrie.type === 'Polygon' && !opDeGrond(i, elementenMap) && !veiligheidVan(elVan(i)));
  const publiek = structuren.filter((i) => isPubliekeStructuur(i, elVan(i)) && !(Number(i.velden?.verdieping) > 0));
  const tenten = [];
  for (const t of publiek) {
    const { opp, personen } = capaciteit(t, elVan(t), R);
    if (opp < 1) continue;
    const eigen = uitgangen.filter((u) => afstand(u.geometrie, t.geometrie, 1.0) < 1.0);
    const breedtes = eigen.map((u) => ({ u, cm: Math.round(turf.length(turf.lineString(u.geometrie.coordinates), M) * 100) }));
    const totaal = breedtes.reduce((a, b) => a + b.cm, 0);
    const nodig = nodigeUitgangen(personen, R);
    const nodigCm = R.cm_per_persoon ? Math.ceil(personen * R.cm_per_persoon) : 0;
    const br = R.brede_route || {};
    const bredeNodig = !!(br.vanaf_personen && br.breedte_cm && personen >= br.vanaf_personen);
    const bredeOk = !bredeNodig || breedtes.some((b) => b.cm >= br.breedte_cm);
    const smal = R.min_breedte_uitgang_cm ? breedtes.filter((b) => b.cm < R.min_breedte_uitgang_cm) : [];
    // Afstand tot de uitgangen, in vogelvlucht vanuit een raster in de tent.
    let ver1 = 0; let ver2 = 0;
    if (eigen.length && (R.max_afstand_uitgang_m || R.max_afstand_tweede_m)) {
      const bb = turf.bbox(t.geometrie);
      const stap = Math.max(1, Math.sqrt(opp) / 12);
      const lijnen = eigen.map((u) => turf.lineString(u.geometrie.coordinates));
      const dLat = stap / 111320; const dLng = stap / (111320 * Math.cos(((bb[1] + bb[3]) / 2) * Math.PI / 180));
      for (let y = bb[1] + dLat / 2; y < bb[3]; y += dLat) {
        for (let x = bb[0] + dLng / 2; x < bb[2]; x += dLng) {
          const p = turf.point([x, y]);
          if (!turf.booleanPointInPolygon(p, t.geometrie)) continue;
          const ds = lijnen.map((l) => turf.pointToLineDistance(p, l, M)).sort((a, b) => a - b);
          ver1 = Math.max(ver1, ds[0]);
          if (ds.length > 1) ver2 = Math.max(ver2, ds[1]);
        }
      }
    }
    const blusNodig = R.blusser_per_m2 ? Math.max(1, Math.ceil(opp / R.blusser_per_m2)) : 0;
    const blusEr = blussers.filter((b) => afstand(b.geometrie, t.geometrie, 3) < 3).length;
    const regels = [
      { id: 'uitgangen', label: 'Uitgangen', waarde: `${eigen.length} / ${nodig}`, ok: !nodig || eigen.length >= nodig, ernst: 'fout', tekort: Math.max(0, nodig - eigen.length) },
      { id: 'breedte', label: 'Breedte samen', waarde: `${totaal} / ${nodigCm} cm`, ok: !nodigCm || totaal >= nodigCm, ernst: 'fout', tekort: Math.max(0, nodigCm - totaal) },
      ...(bredeNodig ? [{ id: 'breed', label: `Eén uitgang ≥ ${br.breedte_cm} cm`, waarde: bredeOk ? 'ja' : 'nee', ok: bredeOk, ernst: 'fout' }] : []),
      ...(smal.length ? [{ id: 'smal', label: `Smaller dan ${R.min_breedte_uitgang_cm} cm`, waarde: `${smal.length}`, ok: false, ernst: 'waarschuwing' }] : []),
      ...(R.max_afstand_uitgang_m ? [{ id: 'afstand', label: 'Afstand tot uitgang', waarde: eigen.length ? `${fmt(ver1)} / ${R.max_afstand_uitgang_m} m` : '–', ok: !eigen.length || ver1 <= R.max_afstand_uitgang_m, ernst: 'fout' }] : []),
      ...(R.max_afstand_tweede_m && eigen.length > 1 ? [{ id: 'afstand2', label: 'Afstand tot 2e uitgang', waarde: `${fmt(ver2)} / ${R.max_afstand_tweede_m} m`, ok: ver2 <= R.max_afstand_tweede_m, ernst: 'waarschuwing' }] : []),
      ...(blusNodig ? [{ id: 'blussers', label: 'Blustoestellen', waarde: `${blusEr} / ${blusNodig}`, ok: blusEr >= blusNodig, ernst: 'waarschuwing', tekort: Math.max(0, blusNodig - blusEr) }] : []),
    ];
    tenten.push({ it: t, id: t.id, naam: naam(t), opp, personen, uitgangen: eigen, breedtes, totaal, nodig, nodigCm, smal, ver1, ver2, blusEr, blusNodig, bredeNodig, bredeOk, regels,
      fouten: regels.filter((r) => !r.ok && r.ernst === 'fout').length, waarschuwingen: regels.filter((r) => !r.ok && r.ernst === 'waarschuwing').length });
  }
  return { ib, R, tenten, publiek, structuren, uitgangen, blussers, soort, naam, elVan, zicht };
}

// Meldingen voor brandveiligheid; gebruikt door controle.js.
export function controleBrand({ plan, items, elementenMap, opDeGrond, afstand }) {
  const ib = instBrand(plan);
  if (!ib.aan) return [];
  const m = [];
  const G = 'Brandveiligheid';
  const { R, tenten: checklist, publiek, structuren, soort, naam, elVan } = tentChecklist({ plan, items, elementenMap, opDeGrond, afstand });
  const zicht = items.filter((i) => !i.verborgen && i.geometrie);

  for (const c of checklist) {
    const t = c.it; const n = c.naam; const personen = c.personen; const opp = c.opp; const eigen = c.uitgangen;
    if (c.nodig && eigen.length < c.nodig) {
      m.push({ id: t.id, soort: 'fout', groep: G, tekst: `${n} (${personen} pers.): ${eigen.length} uitgang${eigen.length === 1 ? '' : 'en'}, nodig ${c.nodig}.` });
    }
    for (const b of c.smal) m.push({ id: b.u.id, soort: 'waarschuwing', groep: G, tekst: `${naam(b.u)} bij ${n} is ${b.cm} cm breed, minimum ${R.min_breedte_uitgang_cm} cm.` });
    if (c.nodigCm && eigen.length && c.totaal < c.nodigCm) {
      m.push({ id: t.id, soort: 'fout', groep: G, tekst: `${n}: uitgangen samen ${c.totaal} cm, nodig ${c.nodigCm} cm voor ${personen} personen.` });
    }
    const br = R.brede_route || {};
    if (c.bredeNodig && eigen.length && !c.bredeOk) {
      m.push({ id: t.id, soort: 'fout', groep: G, tekst: `${n} (${personen} pers.): minstens één uitgang van ${br.breedte_cm} cm nodig vanaf ${br.vanaf_personen} personen.` });
    }
    if (eigen.length) {
      if (R.max_afstand_uitgang_m && c.ver1 > R.max_afstand_uitgang_m) m.push({ id: t.id, soort: 'fout', groep: G, tekst: `${n}: een plek in de tent ligt ${fmt(c.ver1)} m van de dichtste uitgang (max. ${R.max_afstand_uitgang_m} m).` });
      if (R.max_afstand_tweede_m && eigen.length > 1 && c.ver2 > R.max_afstand_tweede_m) m.push({ id: t.id, soort: 'waarschuwing', groep: G, tekst: `${n}: een plek in de tent ligt ${fmt(c.ver2)} m van de tweede uitgang (max. ${R.max_afstand_tweede_m} m).` });
    }
    if (c.blusNodig && c.blusEr < c.blusNodig) m.push({ id: t.id, soort: 'waarschuwing', groep: G, tekst: `${n} (${fmt(opp)} m²): ${c.blusEr} blustoestel${c.blusEr === 1 ? '' : 'len'}, nodig ${c.blusNodig} (1 per ${R.blusser_per_m2} m²).` });
  }

  // Generatoren en gasflessen niet in of tegen een tent.
  const tenten = structuren.filter((i) => isTent(elVan(i)) || isPubliekeStructuur(i, elVan(i)));
  for (const g of zicht.filter((i) => elVan(i)?.eigenschappen?.kva || veiligheidVan(elVan(i)) === 'gas')) {
    const isGas = veiligheidVan(elVan(g)) === 'gas';
    for (const t of tenten) {
      if (t.id === g.id) continue;
      let binnen = false;
      try { binnen = turf.booleanIntersects(g.geometrie, t.geometrie); } catch {}
      if (binnen) m.push({ id: g.id, soort: 'fout', groep: G, tekst: `${naam(g)} staat in of tegen ${naam(t)}: ${isGas ? 'gasflessen' : 'generatoren'} buiten de tent.` });
    }
  }

  // Vluchtwegen vrijhouden.
  for (const v of soort('vluchtweg').filter((i) => i.geometrie.type === 'LineString')) {
    for (const s of structuren) {
      if (publiek.includes(s)) continue; // een vluchtweg mag door de tent zelf lopen
      try { if (turf.booleanIntersects(v.geometrie, s.geometrie)) m.push({ id: s.id, soort: 'fout', groep: G, tekst: `${naam(s)} staat op de vluchtweg "${naam(v)}".` }); } catch {}
    }
  }

  // Brandweer: toegang vrij en dicht genoeg bij elke publieke structuur.
  const toegang = soort('brandweertoegang').filter((i) => i.geometrie.type === 'LineString');
  const opstel = soort('opstelplaats');
  const bw = R.brandweer || {};
  for (const r of toegang) {
    const b = Number(r.velden?.breedte) || bw.breedte_m || 4;
    let buf; try { buf = turf.buffer(turf.lineString(r.geometrie.coordinates), b / 2, M); } catch { continue; }
    for (const s of structuren) {
      try { if (turf.booleanIntersects(buf, s.geometrie)) m.push({ id: s.id, soort: 'fout', groep: G, tekst: `${naam(s)} staat op de brandweertoegang "${naam(r)}" (vrije breedte ${fmt(b, 1)} m).` }); } catch {}
    }
  }
  if (publiek.length) {
    if (!toegang.length && !opstel.length) m.push({ id: publiek[0].id, soort: 'info', groep: G, tekst: 'Nog geen brandweertoegang of opstelplaats getekend.' });
    else if (bw.max_afstand_m) {
      for (const t of publiek) {
        const d = Math.min(...[...toegang, ...opstel].map((x) => afstand(x.geometrie, t.geometrie)));
        if (d > bw.max_afstand_m) m.push({ id: t.id, soort: 'waarschuwing', groep: G, tekst: `${naam(t)} ligt ${fmt(d)} m van de brandweertoegang (max. ${bw.max_afstand_m} m).` });
      }
    }
    if (!soort('verzamelplaats').length) m.push({ id: publiek[0].id, soort: 'info', groep: G, tekst: 'Nog geen verzamelplaats aangeduid.' });
  }
  return m;
}
