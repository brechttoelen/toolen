'use client';

// Controles: meldingen, geen blokkades.
import * as turf from '@turf/turf';
import { berekenStroom } from './stroom';
import { isSign } from './signalisatie';
import { controleBrand } from './veiligheid';
import { heeftModule } from './merk';

const M = { units: 'meters' };

export function instControle(plan, lagen) {
  const c = plan?.instellingen?.controle || {};
  return {
    hulpdienstBreedte: c.hulpdienstBreedte ?? 4,
    maxHoogte: c.maxHoogte ?? 4,
    hulpdienstLagen: c.hulpdienstLagen ?? lagen.filter((l) => /hulpdienst|nood|evacuatie|calamiteit/i.test(l.naam)).map((l) => l.id),
    routeLagen: c.routeLagen ?? lagen.filter((l) => /parcours|route|hulpdienst|weg/i.test(l.naam)).map((l) => l.id),
    afstandsregels: Array.isArray(c.afstandsregels) ? c.afstandsregels : [],
  };
}

const naamVan = (it, el) => it.naam || el?.naam || it.soort;

// Ligt plat op de grond (rijplaten, vloer, tapijt): geen botsing met wat erop staat.
export const opDeGrond = (it, elementenMap) => {
  const el = it.element_id ? elementenMap.get(it.element_id) : null;
  if (it.velden?.vloer != null) return !!it.velden.vloer;
  return !!(el?.eigenschappen?.vloer ?? el?.eigenschappen?.module);
};
const hoogteVan = (it, elementenMap) => Number(it.velden?.hoogte) || Number(it.element_id ? elementenMap.get(it.element_id)?.hoogte_m : 0) || 0;

// Vaste sleutel van een melding, zonder getallen (die veranderen bij een kleine verschuiving).
export const meldingSleutel = (x) => `${x.groep}|${x.id || ''}|${String(x.tekst).replace(/[\d.,]+/g, '#')}`;

// Kiezer voor een afstandsregel: 'c:Categorie', 'e:element-id' of 'l:laag-id'.
export function past(it, kiezer, elementenMap) {
  if (!kiezer) return false;
  const [t, ...rest] = String(kiezer).split(':'); const v = rest.join(':');
  const el = it.element_id ? elementenMap.get(it.element_id) : null;
  if (t === 'e') return it.element_id === v;
  if (t === 'c') return (el?.categorie || '').toLowerCase() === v.toLowerCase();
  if (t === 'l') return it.laag_id === v;
  return false;
}

// Omhullende rechthoek van een geometrie (gecachet per geometrie-object: items zijn onveranderlijk).
const bboxCache = new WeakMap();
export function bboxVan(g) {
  if (!g) return null;
  let b = bboxCache.get(g);
  if (b) return b;
  b = [Infinity, Infinity, -Infinity, -Infinity];
  const loop = (c) => { if (typeof c[0] === 'number') { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; } else for (const d of c) loop(d); };
  loop(g.coordinates || []);
  if (!Number.isFinite(b[0])) b = null;
  else bboxCache.set(g, b);
  return b;
}
// Liggen twee geometrieën mogelijk binnen 'marge' meter van elkaar? (Snelle voorselectie vóór het echte rekenwerk.)
export function mogelijkDichtbij(a, b, marge = 0) {
  const A = bboxVan(a); const B = bboxVan(b);
  if (!A || !B) return false;
  const dLat = marge / 111320; const dLng = marge / (111320 * Math.max(0.2, Math.cos((((A[1] + A[3]) / 2) * Math.PI) / 180)));
  return !(A[2] + dLng < B[0] || B[2] + dLng < A[0] || A[3] + dLat < B[1] || B[3] + dLat < A[1]);
}

// Kortste afstand in meter tussen twee geometrieën (0 als ze elkaar raken).
// Met 'max' wordt enkel gerekend als ze mogelijk binnen die afstand liggen; anders Infinity.
export function afstand(a, b, max = null) {
  if (max != null && !mogelijkDichtbij(a, b, max)) return Infinity;
  try {
    if (turf.booleanIntersects(a, b)) return 0;
    const randen = (g) => (g.type === 'Polygon' ? g.coordinates.map((r) => turf.lineString(r)) : g.type === 'LineString' ? [turf.lineString(g.coordinates)] : []);
    const punten = (g) => (g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates.flat());
    let min = Infinity;
    const een = (p, g) => {
      if (g.type === 'Point') return turf.distance(p, g.coordinates, M);
      let d = Infinity;
      for (const r of randen(g)) d = Math.min(d, turf.pointToLineDistance(p, r, M));
      return d;
    };
    for (const p of punten(a)) min = Math.min(min, een(p, b));
    for (const p of punten(b)) min = Math.min(min, een(p, a));
    return min;
  } catch { return Infinity; }
}

export function controleer({ plan, lagen, items, elementenMap, fasen, opmerkingenOpen = null, vast = [] }) {
  const inst = instControle(plan, lagen);
  const m = [];
  const vlakken = items.filter((i) => i.geometrie?.type === 'Polygon' && !i.verborgen);
  const lijnen = items.filter((i) => i.geometrie?.type === 'LineString' && !i.verborgen);
  const grondVan = new Map(); // één keer per item uitzoeken of het op de grond ligt
  const opGrond = (it) => { let v = grondVan.get(it); if (v === undefined) { v = opDeGrond(it, elementenMap); grondVan.set(it, v); } return v; };

  // 1. Hulpdienstenroutes: vrije breedte.
  for (const r of lijnen.filter((l) => inst.hulpdienstLagen.includes(l.laag_id))) {
    let buffer;
    try { buffer = turf.buffer(turf.lineString(r.geometrie.coordinates), inst.hulpdienstBreedte / 2, M); } catch { continue; }
    for (const v of vlakken) {
      if (inst.hulpdienstLagen.includes(v.laag_id)) continue;
      if (opGrond(v)) continue;
      if (!mogelijkDichtbij(r.geometrie, v.geometrie, inst.hulpdienstBreedte)) continue;
      try {
        if (turf.booleanIntersects(buffer, v.geometrie)) {
          m.push({ id: v.id, soort: 'fout', groep: 'Hulpdiensten', tekst: `${naamVan(v, elementenMap.get(v.element_id))} staat op de hulpdienstenroute "${r.naam || 'route'}" (vrije breedte ${inst.hulpdienstBreedte} m).` });
        }
      } catch {}
    }
  }

  // 2. Overlappende structuren (tenten, podia, voertuigen).
  const structuren = vlakken.filter((v) => v.soort === 'element' || v.soort === 'rechthoek');
  const bovenGrond = structuren.filter((v) => !opGrond(v));
  for (let a = 0; a < bovenGrond.length; a++) {
    for (let b = a + 1; b < bovenGrond.length; b++) {
      const A = bovenGrond[a]; const B = bovenGrond[b];
      if (!mogelijkDichtbij(A.geometrie, B.geometrie)) continue;
      const fa = A.fase_ids?.length ? A.fase_ids : null; const fb = B.fase_ids?.length ? B.fase_ids : null;
      if (fa && fb && !fa.some((x) => fb.includes(x))) continue; // nooit tegelijk
      if ((Number(A.velden?.verdieping) || 0) !== (Number(B.velden?.verdieping) || 0)) continue; // gestapeld
      const eA = elementenMap.get(A.element_id)?.eigenschappen || {}; const eB = elementenMap.get(B.element_id)?.eigenschappen || {};
      if ((eA.inrichting_meubel && eB.inrichting) || (eB.inrichting_meubel && eA.inrichting)) continue; // meubel in een unit
      try {
        if (turf.booleanIntersects(A.geometrie, B.geometrie)) {
          const ov = turf.intersect(turf.featureCollection([turf.feature(A.geometrie), turf.feature(B.geometrie)]));
          const opp = ov ? turf.area(ov) : 0;
          if (opp > 0.5) m.push({ id: A.id, soort: 'waarschuwing', groep: 'Botsingen', tekst: `${naamVan(A, elementenMap.get(A.element_id))} overlapt ${naamVan(B, elementenMap.get(B.element_id))} (${opp.toFixed(1)} m²).` });
        }
      } catch {}
    }
  }

  // 2b. Kabels onder een tentvloer of podium.
  for (const k of lijnen.filter((l) => l.velden?.stroom?.rol === 'kabel')) {
    for (const v of structuren) {
      if (!mogelijkDichtbij(k.geometrie, v.geometrie)) continue;
      try { if (turf.booleanIntersects(k.geometrie, v.geometrie)) m.push({ id: k.id, soort: 'waarschuwing', groep: 'Botsingen', tekst: `${k.naam || 'Kabel'} loopt onder ${naamVan(v, elementenMap.get(v.element_id))}: kabelgoot of andere weg nodig.` }); } catch {}
    }
  }

  // Gestapelde units: er moet een unit onder staan, en op verdieping 1+ een buitentrap in de buurt.
  const gestapeld = vlakken.filter((v) => Number(v.velden?.verdieping) > 0 && elementenMap.get(v.element_id)?.eigenschappen?.stapelbaar);
  const trappen = vlakken.filter((v) => elementenMap.get(v.element_id)?.eigenschappen?.tekening_ref === 'un-warsco-trap-260');
  for (const u of gestapeld) {
    const v = Number(u.velden.verdieping);
    const onder = vlakken.find((o) => o.id !== u.id && (Number(o.velden?.verdieping) || 0) === v - 1 && elementenMap.get(o.element_id)?.eigenschappen?.stapelbaar && mogelijkDichtbij(u.geometrie, o.geometrie) && (() => { try { const ov = turf.intersect(turf.featureCollection([turf.feature(u.geometrie), turf.feature(o.geometrie)])); return ov && turf.area(ov) > 0.8 * turf.area(u.geometrie); } catch { return false; } })());
    if (!onder) m.push({ id: u.id, soort: 'fout', groep: 'Gestapelde units', tekst: `${naamVan(u, elementenMap.get(u.element_id))} staat op verdieping ${v} zonder unit eronder.` });
    if (!trappen.some((t) => afstand(t.geometrie, u.geometrie, 2) < 2)) m.push({ id: u.id, soort: 'waarschuwing', groep: 'Gestapelde units', tekst: `${naamVan(u, elementenMap.get(u.element_id))} (verdieping ${v}): geen buitentrap tegen de unit.` });
  }

  // Brandveiligheid (regels van de brandweerzone).
  m.push(...controleBrand({ plan, items, elementenMap, opDeGrond, afstand }));

  // 3. Doorrijhoogte op een route.
  for (const it of items) {
    const h = Number(it.velden?.doorrijhoogte);
    if (!h) continue;
    if (h < inst.maxHoogte) {
      const opRoute = lijnen.some((r) => inst.routeLagen.includes(r.laag_id) && mogelijkDichtbij(it.geometrie, r.geometrie, 5) && (() => { try { return turf.booleanIntersects(it.geometrie, r.geometrie) || turf.pointToLineDistance(turf.centroid(it.geometrie), r.geometrie, M) < 5; } catch { return false; } })());
      if (opRoute) m.push({ id: it.id, soort: 'fout', groep: 'Doorrijhoogte', tekst: `${naamVan(it, elementenMap.get(it.element_id))}: doorrijhoogte ${h} m, lager dan ${inst.maxHoogte} m voor voertuigen op de route.` });
    }
  }

  // 3a. Hoogte onder een boog, bovenleiding of boom (vrije hoogte).
  const obstakels = items.filter((i) => !i.verborgen && Number(i.velden?.doorrijhoogte) > 0 && i.geometrie);
  if (obstakels.length) {
    for (const it of items) {
      if (it.verborgen || !it.geometrie) continue;
      const h = hoogteVan(it, elementenMap);
      if (!h) continue;
      for (const o of obstakels) {
        if (o.id === it.id) continue;
        const vrij = Number(o.velden.doorrijhoogte);
        if (h <= vrij) continue;
        if (afstand(it.geometrie, o.geometrie, 1) < 1) m.push({ id: it.id, soort: 'fout', groep: 'Hoogte', tekst: `${naamVan(it, elementenMap.get(it.element_id))} (${String(h).replace('.', ',')} m) staat onder ${naamVan(o, elementenMap.get(o.element_id))} met ${String(vrij).replace('.', ',')} m vrije hoogte.` });
      }
    }
  }

  // 3b. Afstandsregels (bv. generator minstens 10 m van een tent).
  for (const r of inst.afstandsregels) {
    const min = Number(r.min);
    if (!(min > 0) || !r.a || !r.b) continue;
    const A = items.filter((i) => i.geometrie && !i.verborgen && past(i, r.a, elementenMap));
    const B = items.filter((i) => i.geometrie && !i.verborgen && past(i, r.b, elementenMap));
    if (A.length * B.length > 20000) continue;
    const gezien = new Set();
    for (const x of A) {
      for (const y of B) {
        if (x.id === y.id) continue;
        const sleutel = [x.id, y.id].sort().join('|');
        if (gezien.has(sleutel)) continue;
        gezien.add(sleutel);
        const fx = x.fase_ids?.length ? x.fase_ids : null; const fy = y.fase_ids?.length ? y.fase_ids : null;
        if (fx && fy && !fx.some((f) => fy.includes(f))) continue;
        const d = afstand(x.geometrie, y.geometrie, min);
        if (d < min) {
          m.push({ id: x.id, soort: r.ernst === 'waarschuwing' ? 'waarschuwing' : 'fout', groep: 'Afstanden', tekst: `${naamVan(x, elementenMap.get(x.element_id))} staat ${d < 0.05 ? 'tegen' : `${d.toFixed(1).replace('.', ',')} m van`} ${naamVan(y, elementenMap.get(y.element_id))} (minimum ${String(min).replace('.', ',')} m${r.reden ? `: ${r.reden}` : ''}).` });
        }
      }
    }
  }

  // 3c. Keuringsattesten: vervallen, bijna vervallen of ontbrekend (verplichte categorieën).
  const verplicht = plan.instellingen?.attesten?.verplicht || [];
  const nu = Date.now();
  for (const it of items) {
    if (it.verborgen) continue;
    const el = it.element_id ? elementenMap.get(it.element_id) : null;
    const lijst = it.velden?.attesten || [];
    for (const a of lijst) {
      if (!a.geldig_tot) continue;
      const t = new Date(a.geldig_tot).getTime();
      if (t < nu) m.push({ id: it.id, soort: 'fout', groep: 'Attesten', tekst: `${naamVan(it, el)}: ${a.type} vervallen sinds ${new Date(a.geldig_tot).toLocaleDateString('nl-BE')}.` });
      else if (t - nu < 30 * 86400000) m.push({ id: it.id, soort: 'waarschuwing', groep: 'Attesten', tekst: `${naamVan(it, el)}: ${a.type} vervalt op ${new Date(a.geldig_tot).toLocaleDateString('nl-BE')}.` });
    }
    if (!lijst.length && el && verplicht.includes(el.categorie)) m.push({ id: it.id, soort: 'waarschuwing', groep: 'Attesten', tekst: `${naamVan(it, el)}: keuringsattest ontbreekt.` });
  }

  // 4. Stroom.
  const stroom = berekenStroom(items, elementenMap, { gelijktijdigheid: plan.instellingen?.stroom?.gelijktijdigheid ?? 0.8, fasen, routeLagen: inst.routeLagen, vast });
  for (const s of stroom.meldingen) if (s.soort !== 'tip') m.push({ ...s, groep: 'Stroom' });

  // 5. Werken in de grond.
  const grond = items.filter((i) => i.velden?.grond);
  if (grond.length) m.push({ id: grond[0].id, soort: 'waarschuwing', groep: 'Werken in de grond', tekst: `${grond.length} items met haringen, pennen of aarding: kijk na of een KLIP-planaanvraag (Vlaanderen) of KLIC-melding (Nederland) nodig is.` });

  // 6. Signalisatie zonder panelen.
  for (const s of items.filter(isSign)) if (!(s.velden.sign.rijen || []).length) m.push({ id: s.id, soort: 'waarschuwing', groep: 'Signalisatie', tekst: `Signalisatiepunt ${s.velden.sign.nr} heeft nog geen panelen.` });

  // 7. Items zonder fase (als er fasen zijn) en zonder laag.
  if (fasen.length) {
    const zonder = items.filter((i) => !i.fase_ids?.length && !isSign(i));
    if (zonder.length) m.push({ id: zonder[0].id, soort: 'info', groep: 'Fasen', tekst: `${zonder.length} items zonder fase (die tellen in alle fasen).` });
  }
  const zonderLaag = items.filter((i) => !i.laag_id || !lagen.some((l) => l.id === i.laag_id));
  if (zonderLaag.length) m.push({ id: zonderLaag[0].id, soort: 'info', groep: 'Lagen', tekst: `${zonderLaag.length} items zonder laag.` });

  if (opmerkingenOpen) m.push({ id: null, soort: 'waarschuwing', groep: 'Opmerkingen', tekst: `${opmerkingenOpen} opmerkingen staan nog open.` });
  const ok = new Set(plan?.instellingen?.controle?.goedgekeurd || []);
  const uit = m.filter((x) => !GROEP_MODULE[x.groep] || heeftModule(GROEP_MODULE[x.groep]));
  for (const x of uit) if (ok.has(meldingSleutel(x))) x.goedgekeurd = true;
  return uit;
}
// Meldingen die bij een module horen; de rest (overlap, hoogte, afstanden, lagen, fasen …) is basis.
const GROEP_MODULE = { Hulpdiensten: 'veiligheid', Doorrijhoogte: 'veiligheid', Attesten: 'veiligheid', Brandveiligheid: 'veiligheid', Stroom: 'stroom', Signalisatie: 'signalisatie' };
