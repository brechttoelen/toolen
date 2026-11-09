// Deur of poort in een heraslijn. De lijn blijft één geheel: ze onthoudt per opening in welk stuk
// (k) en op hoeveel meter (d) de deur zit en hoe breed ze is (parameters.openingen, zie stijl.js);
// de deur zelf (een element op schaal) verwijst terug met parameters.inLijn = { lijn }. Verschuift,
// draait of verandert de lijn, dan wordt de deur opnieuw op haar plek in de lijn gezet (volgLijn);
// versleep je de deur, dan schuift ze langs de lijn (schuifOpening).
//
// Oud model (tot nov. 2026): de lijn werd in twee stukken geknipt en de deur onthield beide
// (parameters.inLijn = { a, b }). Zulke deuren blijven werken: lijnHeel maakt de lijn weer heel.
import * as turf from '@turf/turf';
import { nadenVan, openingenVan } from './stijl';
import { elementVeelhoek, rond } from './geo';

const M = { units: 'meters' };
const afst = (a, b) => turf.distance(a, b, M);
const langs = (a, b, d) => { const L = afst(a, b); return L < 1e-6 ? a : turf.along(turf.lineString([a, b]), Math.min(L, Math.max(0, d)), M).geometry.coordinates; };

export const isDeurElement = (el) => el?.eigenschappen?.inzet === 'deur' || el?.eigenschappen?.inzet === 'poort';
export const isPoortElement = (el) => el?.eigenschappen?.inzet === 'poort';
// Nieuw model: de deur zit in één lijn.
export const deurLijnId = (it) => it?.parameters?.inLijn?.lijn || null;
// Breedte van een deur of poort zoals ze in de lijn komt (dubbele poort: twee vleugels).
export const deurBreedte = (el, par = {}) => (Number(el?.breedte_m) || 1) * (isPoortElement(el) && par?.dubbel ? 2 : 1);

// Per-hek gegevens (doeken, vlaggen, gekozen toebehoren) samenvoegen (oud model: lijn weer heel).
const PER_HEK = ['doeken', 'vlaggen'];
function veldenSamen(va, vb, nA) {
  const v = { ...(va || {}) };
  for (const k of PER_HEK) {
    const a = Array.isArray(va?.[k]) ? va[k] : []; const b = Array.isArray(vb?.[k]) ? vb[k] : [];
    if (!a.length && !b.length) continue;
    const r = [...a.slice(0, nA), ...Array(Math.max(0, nA - a.length)).fill(null), ...b];
    v[k] = r.some(Boolean) ? r : null;
  }
  const ta = va?.toebehoren || {}; const tb = vb?.toebehoren || {};
  const sleutels = new Set([...Object.keys(ta), ...Object.keys(tb)]);
  if (sleutels.size) {
    v.toebehoren = {};
    for (const k of sleutels) {
      const a = ta[k]; const b = tb[k];
      if (!a || !b || !Array.isArray(b.plekken)) { v.toebehoren[k] = a || b; continue; }
      v.toebehoren[k] = {
        ...a,
        plekken: [...(a.plekken || []), ...b.plekken.map((i) => Number(i) + nA)],
        ...(a.zijden || b.zijden ? { zijden: { ...(a.zijden || {}), ...Object.fromEntries(Object.entries(b.zijden || {}).map(([i, z]) => [Number(i) + nA, z])) } } : {}),
      };
    }
  }
  return v;
}

// Waar komt een deur als je bij `punt` klikt: op de dichtstbijzijnde naad tussen twee hekken.
// Geeft { k, d, i, midden, rot, ver } of { fout }. k = stuk van de lijn, d = meter vanaf het begin van dat stuk.
export function deurPlek(it, el, punt, breedte) {
  const c = it.geometrie?.coordinates;
  if (it.geometrie?.type !== 'LineString' || !c || c.length < 2) return { fout: 'Dit is geen lijn.' };
  const naden = nadenVan(it.geometrie, el, it.parameters?.bogen, it.parameters?.openingen);
  if (naden.length < 3) return { fout: 'Deze lijn is te kort voor een deur: teken minstens twee hekken.' };
  let best = null;
  for (let i = 1; i < naden.length - 1; i++) {
    const dd = afst(naden[i].p, punt);
    if (!best || dd < best.d) best = { i, d: dd };
  }
  const n = naden[best.i]; const run = naden.runs[n.run];
  let k = run.seg; let d = run.d0 + n.d;
  // Naad met al een opening: de nieuwe komt erachter (twee deuren naast elkaar).
  if (n.open) d = n.open.tot;
  const L = (q) => afst(c[q], c[q + 1]);
  // Naad op een knikpunt: de deur komt in het stuk erna (als dat lang genoeg is), anders ervoor.
  if (d >= L(k) - 0.01 && k + 1 < c.length - 1 && L(k + 1) >= breedte + 0.02) { k += 1; d = 0; }
  if (d + breedte > L(k) + 0.01) {
    if (d - breedte >= -0.01) d -= breedte; else return { fout: 'Hier is het rechte stuk te kort voor een deur.' };
    d = Math.max(0, d);
  }
  if (Number(it.parameters?.bogen?.[k])) return { fout: 'Zet de deur op een recht stuk, niet in een bocht.' };
  if ((it.parameters?.koord || []).map(Number).includes(k)) return { fout: 'Hier hangt een koord: kies een stuk met hekken.' };
  // Niet over een andere opening heen.
  for (const o of openingenVan(it.parameters)) if (Number(o.k) === k && d < Number(o.d) + Number(o.b) - 0.01 && d + breedte > Number(o.d) + 0.01) return { fout: 'Hier zit al een deur of poort.' };
  const midden = langs(c[k], c[k + 1], d + breedte / 2);
  const rot = turf.bearing(c[k], c[k + 1]) - 90;
  return { k, d: rond(d, 3), i: best.i, midden, rot, ver: best.d };
}

// Plaats (midden, draaiing, geometrie) van een deur voor opening `o` op lijn `lijn`. Null als het stuk weg is.
export function deurPlaats(lijn, o, diepte = 0.7) {
  const c = lijn?.geometrie?.coordinates; const k = Number(o.k);
  if (lijn?.geometrie?.type !== 'LineString' || !c || !(k >= 0) || k >= c.length - 1) return null;
  const L = afst(c[k], c[k + 1]); const b = Number(o.b) || 1;
  const d = Math.min(Math.max(0, Number(o.d) || 0), Math.max(0, L - b));
  const midden = langs(c[k], c[k + 1], d + b / 2);
  const rot = rond(turf.bearing(c[k], c[k + 1]) - 90, 2);
  return { midden, rot, breedte: b, diepte, geometrie: elementVeelhoek(midden, b, diepte, rot, null) };
}
const dicht = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) < 2e-8 && Math.abs(a[1] - b[1]) < 2e-8;
const hoekGelijk = (a, b) => Math.abs((((Number(a) || 0) - (Number(b) || 0)) % 360 + 540) % 360 - 180) < 0.05;
// Staat de deur al waar de lijn haar zet?
export function deurOpPlek(deur, pl) {
  const p = deur?.parameters || {};
  return !!pl && dicht(p.midden, pl.midden) && hoekGelijk(p.rot, pl.rot) && Math.abs((Number(p.breedte) || 0) - pl.breedte) < 0.005;
}
// Wijzigingen voor de deuren van een lijn: [{ deur, patch }], plus de openingen die geen deur meer hebben.
export function volgLijn(lijn, items) {
  const uit = []; const weg = []; const rest = [];
  for (const o of openingenVan(lijn.parameters)) {
    const deur = items.find((x) => x.id === o.id);
    if (!deur || deurLijnId(deur) !== lijn.id) { weg.push(o.id); continue; }
    rest.push(o);
    const pl = deurPlaats(lijn, o, Number(deur.parameters?.diepte) || 0.7);
    if (!pl || deurOpPlek(deur, pl)) continue;
    uit.push({ deur, patch: { geometrie: pl.geometrie, parameters: { ...deur.parameters, midden: pl.midden, rot: pl.rot, breedte: pl.breedte, inLijn: { lijn: lijn.id } } } });
  }
  return { patches: uit, weg, openingen: rest };
}
// De deur is zelf verplaatst (of breder geworden): de opening schuift mee langs de lijn.
// Geeft { opening } (nieuwe k, d, b) of null als er niets te veranderen is.
export function schuifOpening(lijn, deur, breedte = null) {
  const c = lijn?.geometrie?.coordinates; const p = deur?.parameters || {};
  if (lijn?.geometrie?.type !== 'LineString' || !c || c.length < 2 || !p.midden) return null;
  const op = openingenVan(lijn.parameters); const o = op.find((x) => x.id === deur.id);
  if (!o) return null;
  const b = Number(breedte) || Number(o.b) || 1;
  let np; try { np = turf.nearestPointOnLine(turf.lineString(c), turf.point(p.midden), M); } catch { return null; }
  let k = Math.min(c.length - 2, Math.max(0, Number(np.properties.index) || 0));
  const L = (q) => afst(c[q], c[q + 1]);
  // In een bocht of koord kan geen deur: dan blijft ze in haar stuk.
  const kan = (q) => !Number(lijn.parameters?.bogen?.[q]) && !(lijn.parameters?.koord || []).map(Number).includes(q) && L(q) >= b - 0.01;
  if (!kan(k)) k = Number(o.k);
  if (!kan(k)) return null;
  let d = Math.max(0, Math.min(L(k) - b, afst(c[k], np.geometry.coordinates) - b / 2));
  // Niet over een andere opening heen: ervoor of erna blijven.
  for (const x of op) {
    if (x.id === o.id || Number(x.k) !== k) continue;
    const x0 = Number(x.d); const x1 = x0 + Number(x.b);
    if (d < x1 && d + b > x0) d = Number(o.k) === k && Number(o.d) + Number(o.b) / 2 < (x0 + x1) / 2 ? Math.max(0, x0 - b) : Math.min(L(k) - b, x1);
  }
  d = rond(d, 3);
  if (k === Number(o.k) && Math.abs(d - Number(o.d)) < 0.002 && Math.abs(b - Number(o.b)) < 0.002) return null;
  return { opening: { ...o, k, d, b } };
}
// Openingen na een wijziging van de lijn: zelfde aantal punten → blijven in hun stuk (bij een versleept
// knikpunt blijft de afstand tot het punt dat níet bewoog); punten erbij of weg → op hun oude plaats
// terug op de lijn gezet (dichtstbijzijnde stuk).
export function herschikOpeningen(oudG, nieuwG, openingen) {
  const op = openingenVan({ openingen }); if (!op.length) return openingen;
  const c0 = oudG?.coordinates; const c1 = nieuwG?.coordinates;
  if (oudG?.type !== 'LineString' || nieuwG?.type !== 'LineString' || !c0 || !c1 || c1.length < 2) return openingen;
  const uit = [];
  if (c0.length === c1.length) {
    for (const o of op) {
      const k = Number(o.k); if (k >= c1.length - 1) continue;
      const L0 = afst(c0[k], c0[k + 1]); const L1 = afst(c1[k], c1[k + 1]);
      const b = Number(o.b); let d = Number(o.d);
      if (Math.abs(L1 - L0) > 0.005) {
        const beginVast = dicht(c0[k], c1[k]); const eindVast = dicht(c0[k + 1], c1[k + 1]);
        if (!beginVast && eindVast) d = L1 - (L0 - d); // begin versleept: afstand tot het einde houden
        else if (!beginVast && !eindVast) d = L0 > 0 ? (d * L1) / L0 : d; // allebei (bv. geschaald): naar verhouding
      }
      d = Math.max(0, Math.min(Math.max(0, L1 - b), d));
      uit.push({ ...o, d: rond(d, 3) });
    }
    return uit;
  }
  // Punt erbij of weg: elke deur op haar oude plek (midden) terug in de lijn.
  for (const o of op) {
    const k0 = Number(o.k); if (k0 >= c0.length - 1) continue;
    const mid = langs(c0[k0], c0[k0 + 1], Number(o.d) + Number(o.b) / 2);
    let np; try { np = turf.nearestPointOnLine(turf.lineString(c1), turf.point(mid), M); } catch { continue; }
    const k = Math.min(c1.length - 2, Math.max(0, Number(np.properties.index) || 0));
    const L = afst(c1[k], c1[k + 1]); const b = Number(o.b);
    if (L < b - 0.01) continue; // past niet meer: opening weg (de deur komt los)
    const d = Math.max(0, Math.min(L - b, afst(c1[k], np.geometry.coordinates) - b / 2));
    uit.push({ ...o, k, d: rond(d, 3) });
  }
  return uit;
}
// Openingen na het knippen van een lijn in deel 1 (stukken tot i, eindigend op q) en deel 2 (vanaf q).
export function knipOpeningen(openingen, i, c, q) {
  const op = openingenVan({ openingen }); const a = []; const b = [];
  const dq = afst(c[i], q);
  for (const o of op) {
    const k = Number(o.k);
    if (k < i) a.push(o);
    else if (k > i) b.push({ ...o, k: k - i });
    else if (Number(o.d) + Number(o.b) / 2 <= dq) a.push(o);
    else b.push({ ...o, k: 0, d: rond(Math.max(0, Number(o.d) - dq), 3) });
  }
  return { a: a.length ? a : undefined, b: b.length ? b : undefined };
}
// Tekenrichting omgekeerd (punten in omgekeerde volgorde): stuk k wordt n-2-k, afstand vanaf de andere kant.
export function keerOpeningen(openingen, c) {
  const op = openingenVan({ openingen }); if (!op.length) return undefined;
  const n = c.length;
  return op.map((o) => { const k = Number(o.k); const L = afst(c[k], c[k + 1]); return { ...o, k: n - 2 - k, d: rond(Math.max(0, L - Number(o.d) - Number(o.b)), 3) }; });
}

// Oud model: de twee stukken naast een deur terug één lijn maken (overbodige punten op een rechte lijn vallen weg).
export function lijnHeel(a, b, el) {
  const ca = a.geometrie?.coordinates; const cb = b.geometrie?.coordinates;
  if (!ca?.length || !cb?.length) return null;
  if (afst(ca[ca.length - 1], cb[0]) > 4) return null; // intussen ver uit elkaar geschoven
  const nA = Math.max(0, nadenVan(a.geometrie, el, a.parameters?.bogen).length - 1);
  let pts = [...ca, ...cb];
  // Bochten en koorden per segment bijhouden terwijl punten wegvallen.
  const na = ca.length;
  let seg = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const oud = s < na - 1 ? { bron: 'a', s } : s === na - 1 ? null : { bron: 'b', s: s - na };
    const bron = oud ? (oud.bron === 'a' ? a : b) : null;
    seg.push({ boog: bron ? Number(bron.parameters?.bogen?.[oud.s]) || 0 : 0, koord: bron ? (bron.parameters?.koord || []).map(Number).includes(oud.s) : false });
  }
  for (const j of [na, na - 1]) {
    if (j <= 0 || j >= pts.length - 1) continue;
    const r1 = turf.bearing(pts[j - 1], pts[j]); const r2 = turf.bearing(pts[j], pts[j + 1]);
    const dr = Math.abs(((r2 - r1 + 540) % 360) - 180);
    const kort = afst(pts[j - 1], pts[j]) < 0.01 || afst(pts[j], pts[j + 1]) < 0.01;
    if ((dr < 1 || kort) && !seg[j - 1].boog && !seg[j].boog && !seg[j - 1].koord && !seg[j].koord) {
      pts = [...pts.slice(0, j), ...pts.slice(j + 1)];
      seg = [...seg.slice(0, j), ...seg.slice(j + 1)];
    }
  }
  const bogen = Object.fromEntries(seg.map((x, s) => [s, x.boog]).filter(([, h]) => h));
  const koord = seg.map((x, s) => (x.koord ? s : null)).filter((s) => s != null);
  return {
    geometrie: { type: 'LineString', coordinates: pts },
    parameters: { ...(a.parameters || {}), bogen: Object.keys(bogen).length ? bogen : undefined, koord: koord.length ? koord : undefined },
    velden: veldenSamen(a.velden, b.velden, nA),
  };
}
