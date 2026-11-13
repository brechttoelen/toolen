'use client';

// Branding: bedrukte ontwerpen op dragers. Vier soorten dragers:
//   hek   = lijnelement met doek "bedrukt" (Heras): per hek een ontwerp  -> velden.doeken[i]
//   totem = infototem: per zijde een paneel                             -> velden.paneel_1..4
//   vlag  = beachvlag: één ontwerp                                      -> velden.ontwerp
//   truss = trusskubus (4 zijden) of trussboog (2 kanten)               -> velden.paneel_1..4
// Een ontwerp is een bibliotheekrij met tekenwijze 'doek' en eigenschappen.drager
// (leeg = hek, 'totem', 'vlag'). Met plan_id hoort het enkel bij dat event (geüpload
// door de collega), zonder plan_id staat het in de vaste FLCS-bibliotheek.
import * as turf from '@turf/turf';
import { isWand, wandFrames, wandPlekken, wandOntwerpen, zetWandPlek, wandPlekNaam, lengtesVanItem, wandStukken, naarMeterLijn } from './framewand';
import { nadenVan, isTotem, isVlag, isVlagHek, totemPanelen, TOTEM_ZIJDEN, trussDoek, isFrame, isDrape, FRAME_ZIJDEN } from './stijl';
import { buig, elementVeelhoek } from './geo';

export const DRAGERS = [
  { id: 'hek', naam: 'Heras-doeken', kort: 'Heras', enkel: 'doek', afmeting: '340 × 173 cm', kleur: '#E11D48' },
  { id: 'totem', naam: 'Totempanelen', kort: 'Totem', enkel: 'paneel', afmeting: '100 × 250 cm', kleur: '#16A34A' },
  { id: 'vlag', naam: 'Beachvlaggen', kort: 'Vlag', enkel: 'vlag', afmeting: '85 × 330 cm', kleur: '#2563EB' },
  { id: 'truss', naam: 'Truss-doeken', kort: 'Truss', enkel: 'trussdoek', afmeting: '200 × 200 cm', kleur: '#7C3AED' },
  { id: 'frame', naam: 'Frame-doeken', kort: 'Frame', enkel: 'framedoek', afmeting: '100 × 200 cm', kleur: '#EA580C' },
  { id: 'drape', naam: 'Pipe & drape-doeken', kort: 'Drape', enkel: 'drapedoek', afmeting: '300 × 300 cm', kleur: '#0F766E' },
  { id: 'stelling', naam: 'Stellingdoeken', kort: 'Stelling', enkel: 'stellingdoek', afmeting: '207 × 100 cm', kleur: '#0369A1', bouwer: true },
];
// Secties en zijden die als 'hek' (per stuk in de lijn) of als 'totem' (per zijde) werken.
const perStuk = (d) => d === 'hek' || d === 'drape';
const perZijde = (d) => d === 'totem' || d === 'truss' || d === 'frame';
export const dragerOp = (id) => DRAGERS.find((d) => d.id === id) || DRAGERS[0];
export const ontwerpDrager = (d) => (['totem', 'vlag', 'truss', 'frame', 'drape', 'stelling'].includes(d?.eigenschappen?.drager) ? d.eigenschappen.drager : 'hek');
export { isVlag, isVlagHek };
export function dragerVan(el) {
  if (!el) return null;
  if (isWand(el)) return 'frame'; // B-matrix frame-wand: per frame voor- en achterkant
  if (trussDoek(el)) return 'truss'; // trusskubus (4 zijden) of trussboog (2 kanten)
  if (isFrame(el)) return 'frame'; // textielframe: voor- en achterkant
  if (isDrape(el)) return 'drape'; // pipe & drape: per sectie
  if (isTotem(el)) return 'totem';
  if (isVlag(el)) return 'vlag';
  if (isVlagHek(el)) return 'hek'; // elk Heras (ook wit of zwart gezeild) kan per hek een doek krijgen
  return null;
}

export const aantalHekken = (it, el) => (it.geometrie?.type === 'LineString' ? Math.max(0, nadenVan(it.geometrie, el, it.parameters?.bogen, it.parameters?.openingen).length - 1) : 0);

// De plekken van een item met hun ontwerp (null = nog leeg).
export function plekkenVan(it, el) {
  if (isWand(el)) return wandPlekken(it, el);
  const d = dragerVan(el);
  if (perStuk(d)) return Array.from({ length: aantalHekken(it, el) }, (_, k) => (it.velden?.doeken || [])[k] || null);
  if (perZijde(d)) return totemPanelen(it, el);
  if (d === 'vlag') return [it.velden?.ontwerp || null];
  return [];
}
// Vlaggen in een Heras-lijn (velden.vlaggen, per hek; aan de eerste staander van dat hek).
export const hekVlaggen = (it, el) => Array.from({ length: aantalHekken(it, el) }, (_, k) => (it.velden?.vlaggen || [])[k] || null);
// Wat er nu op de plek van een treffer hangt.
export function huidigOntwerp(it, h) {
  if (h.wand) return wandPlekken(it, h.el)[h.plek] || null;
  if (h.opHek) return (it.velden?.vlaggen || [])[h.plek] || null;
  if (perStuk(h.drager)) return (it.velden?.doeken || [])[h.plek] || null;
  if (perZijde(h.drager)) return it.velden?.[`paneel_${h.plek + 1}`] || null;
  return it.velden?.ontwerp || null;
}
export const plekNaam = (drager, i, opHek = false, el = null) => (isWand(el) ? wandPlekNaam(i) : opHek ? `hek ${i + 1} (vlag aan de staander)` : drager === 'hek' ? `hek ${i + 1}` : drager === 'drape' ? `sectie ${i + 1}` : drager === 'frame' ? FRAME_ZIJDEN[i]?.toLowerCase() || `zijde ${i + 1}` : drager === 'totem' ? `zijde ${i + 1} (${TOTEM_ZIJDEN[i].toLowerCase()})`
  : drager === 'truss' ? (trussDoek(el) === 'boog' ? `kant ${i + 1}` : `zijde ${i + 1} (${TOTEM_ZIJDEN[i].toLowerCase()})`) : 'vlag');

// Een ontwerp op een plek zetten. Geeft het nieuwe item, of hetzelfde als er niets verandert.
export function zetOntwerp(it, el, plek, id, opHek = false) {
  if (isWand(el)) return zetWandPlek(it, el, plek, id);
  const d = dragerVan(el); const v = id || null;
  if (opHek) {
    const l = hekVlaggen(it, el);
    if (l[plek] === v) return it;
    l[plek] = v;
    return { ...it, velden: { ...(it.velden || {}), vlaggen: l.some(Boolean) ? l : null } };
  }
  if (perStuk(d)) {
    const n = aantalHekken(it, el);
    const l = Array.from({ length: n }, (_, k) => (it.velden?.doeken || [])[k] || null);
    if (l[plek] === v) return it;
    l[plek] = v;
    return { ...it, velden: { ...(it.velden || {}), doeken: l } };
  }
  if (perZijde(d)) {
    const k = `paneel_${plek + 1}`;
    if ((it.velden?.[k] || null) === v) return it;
    return { ...it, velden: { ...(it.velden || {}), [k]: v } };
  }
  if (d === 'vlag') {
    if ((it.velden?.ontwerp || null) === v) return it;
    return { ...it, velden: { ...(it.velden || {}), ontwerp: v } };
  }
  return it;
}

// Welke plek ligt onder de muis? project: [lng, lat] -> {x, y} (map.project).
// drager: enkel plekken van die soort (het penseel verft één soort ontwerp).
export function trefferBij({ items, elementenMap, lngLat, punt, project, drager, max = 16 }) {
  let beste = null;
  const px = (c) => { const p = project(c); return Math.hypot(p.x - punt.x, p.y - punt.y); };
  for (const it of items) {
    if (it.verborgen || !it.element_id) continue;
    const el = elementenMap.get(it.element_id);
    const opHek = drager === 'vlag' && isVlagHek(el);
    const d = opHek ? 'hek' : dragerVan(el);
    if (!d || (drager && d !== drager && !opHek)) continue;
    if (isWand(el)) {
      // Frame-wand: het frame onder de muis, voorkant rechts van de tekenrichting.
      if (it.geometrie?.type !== 'LineString') continue;
      const c = it.geometrie.coordinates;
      const { pts, terug } = naarMeterLijn(c);
      const o = c[0]; const kx = 111320 * Math.cos((o[1] * Math.PI) / 180); const m = [(lngLat[0] - o[0]) * kx, (lngLat[1] - o[1]) * 110574];
      // Dichtste frame; bij gestapelde frames het hoogste (dat zie je van bovenaf het best).
      let fb = null;
      for (const f of wandStukken(pts, it, el)) {
        const dx = f.e[0] - f.a[0]; const dy = f.e[1] - f.a[1]; const L2 = dx * dx + dy * dy || 1;
        const tt = Math.max(0, Math.min(1, ((m[0] - f.a[0]) * dx + (m[1] - f.a[1]) * dy) / L2));
        const dd = Math.hypot(m[0] - (f.a[0] + dx * tt), m[1] - (f.a[1] + dy * tt));
        if (!fb || dd < fb.dd - 0.02 || (Math.abs(dd - fb.dd) <= 0.02 && f.z0 + f.h > fb.f.z0 + fb.f.h)) fb = { f, dd, q: [f.a[0] + dx * tt, f.a[1] + dy * tt], kruis: dx * (m[1] - f.a[1]) - dy * (m[0] - f.a[0]) };
      }
      if (!fb) continue;
      const pxAfst = px(terug(fb.q));
      if (pxAfst > max || (beste && pxAfst >= beste.afst)) continue;
      beste = { it, el, drager: 'frame', wand: true, plek: fb.f.i * 2 + (fb.kruis >= 0 ? 1 : 0), afst: pxAfst }; // voorkant = rechts van de richting
      continue;
    }
    if (perStuk(d)) {
      if (it.geometrie?.type !== 'LineString') continue;
      const g = it.parameters?.bogen ? buig(it.geometrie, it.parameters.bogen) : it.geometrie;
      const q = turf.nearestPointOnLine(turf.lineString(g.coordinates), lngLat, { units: 'meters' });
      const afst = px(q.geometry.coordinates);
      if (afst > max || (beste && afst >= beste.afst)) continue;
      const naden = nadenVan(it.geometrie, el, it.parameters?.bogen, it.parameters?.openingen);
      if (naden.length < 2) continue;
      const begin = (naden.runs || []).map((r) => r.van || 0);
      const pos = (j) => (begin[naden[j].run] || 0) + naden[j].d;
      const loc = q.properties.location;
      let i = naden.length - 2;
      for (let j = 0; j < naden.length - 1; j++) if (loc <= pos(j + 1) + 1e-6) { i = j; break; }
      beste = opHek ? { it, el, drager: 'vlag', opHek: true, plek: i, afst } : { it, el, drager: d, plek: i, afst };
    } else if (d === 'truss' && trussDoek(el) === 'boog') {
      // Trussboog: de kant van de overspanning waar de muis staat (links = kant 1).
      if (it.geometrie?.type !== 'LineString' || it.geometrie.coordinates.length < 2) continue;
      const c = it.geometrie.coordinates;
      const q = turf.nearestPointOnLine(turf.lineString(c), lngLat, { units: 'meters' });
      const afst = px(q.geometry.coordinates);
      if (afst > max || (beste && afst >= beste.afst)) continue;
      const i = Math.min(c.length - 2, q.properties.index);
      const a = c[i]; const b = c[i + 1];
      const kruis = (b[0] - a[0]) * (lngLat[1] - a[1]) * Math.cos((a[1] * Math.PI) / 180) - (b[1] - a[1]) * (lngLat[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
      beste = { it, el, drager: d, plek: kruis >= 0 ? 0 : 1, afst };
    } else {
      const p = it.parameters || {};
      if (!p.midden) continue;
      if (d === 'vlag') {
        const afst = px(p.midden);
        if (afst <= Math.max(max, 22) && (!beste || afst < beste.afst)) beste = { it, el, drager: d, plek: 0, afst };
        continue;
      }
      // Totem: de zijde die het dichtst bij de muis ligt (binnen of net buiten de totem).
      const b = Number(p.breedte) || Number(el.breedte_m) || 1; const dd = Number(p.diepte) || Number(el.diepte_m) || 1;
      const ring = elementVeelhoek(p.midden, b, dd, Number(p.rot) || 0).coordinates[0];
      const binnen = turf.booleanPointInPolygon(lngLat, { type: 'Polygon', coordinates: [ring] });
      for (let k = 0; k < 4; k++) {
        const q = turf.nearestPointOnLine(turf.lineString([ring[k], ring[k + 1]]), lngLat);
        const afst = binnen ? px(q.geometry.coordinates) / 4 : px(q.geometry.coordinates);
        // Frame: enkel voor- (rand 0) en achterkant (rand 2).
        const plek = d === 'frame' ? (k === 2 ? 1 : 0) : k;
        if (d === 'frame' && (k === 1 || k === 3)) continue;
        if (d === 'frame' && plek >= totemPanelen(it, el).length) continue;
        if ((binnen || afst <= max) && (!beste || afst < beste.afst)) beste = { it, el, drager: d, plek, afst };
      }
    }
  }
  return beste;
}

// Telling voor de balk onderaan, het paneel en de bestellijst.
export function brandingTelling(items, elementenMap) {
  const uit = { hek: { plekken: 0, leeg: 0, items: 0 }, totem: { plekken: 0, leeg: 0, items: 0 }, vlag: { plekken: 0, leeg: 0, items: 0 }, truss: { plekken: 0, leeg: 0, items: 0 }, frame: { plekken: 0, leeg: 0, items: 0 }, drape: { plekken: 0, leeg: 0, items: 0 }, perOntwerp: new Map(), leeg: [] };
  uit.vlagInHek = 0;
  for (const it of items) {
    if (it.verborgen || !it.element_id) continue;
    const el = elementenMap.get(it.element_id);
    if (isVlagHek(el) && Array.isArray(it.velden?.vlaggen)) {
      for (const id of hekVlaggen(it, el)) if (id) { uit.perOntwerp.set(id, (uit.perOntwerp.get(id) || 0) + 1); uit.vlag.items++; uit.vlag.plekken++; uit.vlagInHek++; }
    }
    const d = dragerVan(el);
    if (!d) continue;
    const pl = isWand(el) ? wandOntwerpen(it, el) : plekkenVan(it, el);
    const t = uit[d]; t.items++; t.plekken += pl.length;
    let leeg = 0;
    pl.forEach((id) => { if (id) uit.perOntwerp.set(id, (uit.perOntwerp.get(id) || 0) + 1); else leeg++; });
    t.leeg += leeg;
    if (leeg) uit.leeg.push({ it, el, drager: d, leeg, totaal: pl.length });
  }
  return uit;
}

export function brandingCijfers(t) {
  if (!t) return '';
  const r = [];
  if (t.hek.items) r.push(`${t.hek.plekken} hekken · ${t.hek.plekken - t.hek.leeg} met doek`);
  if (t.totem.items) r.push(`${t.totem.items} totem${t.totem.items > 1 ? 's' : ''}${t.totem.leeg ? ` (${t.totem.leeg} zijden leeg)` : ''}`);
  if (t.vlag.items) r.push(`${t.vlag.items} vlag${t.vlag.items > 1 ? 'gen' : ''}${[t.vlagInHek ? `${t.vlagInHek} in Heras` : '', t.vlag.leeg ? `${t.vlag.leeg} zonder ontwerp` : ''].filter(Boolean).map((x) => ` (${x})`).join('')}`);
  if (t.truss?.items) r.push(`${t.truss.items} truss${t.truss.items > 1 ? 'en' : ''} · ${t.truss.plekken - t.truss.leeg} doek${t.truss.plekken - t.truss.leeg === 1 ? '' : 'en'}`);
  if (t.frame?.items) r.push(`${t.frame.items} frame${t.frame.items > 1 ? 's' : ''}${t.frame.leeg ? ` (${t.frame.leeg} zijden leeg)` : ''}`);
  if (t.drape?.items) r.push(`${t.drape.plekken} drape-secties · ${t.drape.plekken - t.drape.leeg} bedrukt`);
  return r.join(' · ') || 'Nog geen hekken met doek, totems, vlaggen, truss of frames';
}

// Bestellijst: per ontwerp het aantal (drukorder), met de event-eigen ontwerpen apart gemarkeerd.
export function brandingBestellijst(items, elementenMap) {
  const t = brandingTelling(items, elementenMap);
  return [...t.perOntwerp].map(([id, n]) => {
    const d = elementenMap.get(id);
    return { id, naam: d?.naam || '?', drager: ontwerpDrager(d), afmeting: d?.eigenschappen?.afmeting || '', aantal: n, eigen: !!d?.plan_id, bestand: d?.eigenschappen?.bestand || d?.eigenschappen?.beeld || '' };
  }).sort((a, b) => DRAGERS.findIndex((x) => x.id === a.drager) - DRAGERS.findIndex((x) => x.id === b.drager) || a.naam.localeCompare(b.naam, 'nl'));
}
export function brandingCsv(rijen) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return ['Soort;Ontwerp;Afmeting;Aantal;Alleen dit event', ...rijen.map((r) => [dragerOp(r.drager).enkel, r.naam, r.afmeting, r.aantal, r.eigen ? 'ja' : 'nee'].map(q).join(';'))].join('\n');
}

// Upload: van een pdf de eerste bladzijde als voorbeeld (jpg) en de gemiddelde kleur.
export async function voorbeeldVan(bestand) {
  let canvas;
  if (/pdf$/i.test(bestand.type) || /\.pdf$/i.test(bestand.name)) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: await bestand.arrayBuffer(), disableFontFace: true }).promise;
    const blad = await doc.getPage(1);
    const v0 = blad.getViewport({ scale: 1 });
    const schaal = Math.min(4, 1200 / Math.max(v0.width, v0.height));
    const v = blad.getViewport({ scale: schaal });
    canvas = document.createElement('canvas'); canvas.width = Math.round(v.width); canvas.height = Math.round(v.height);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await blad.render({ canvasContext: ctx, viewport: v }).promise;
  } else {
    const url = URL.createObjectURL(bestand);
    try {
      const img = await new Promise((ok, nok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => nok(new Error('Dit beeld kan niet gelezen worden.')); i.src = url; });
      const s = Math.min(1, 1200 / Math.max(img.width, img.height));
      canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * s); canvas.height = Math.round(img.height * s);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally { URL.revokeObjectURL(url); }
  }
  // Gemiddelde kleur, wit en bijna-wit niet meegeteld (marges).
  const klein = document.createElement('canvas'); klein.width = 40; klein.height = 40;
  const kc = klein.getContext('2d'); kc.drawImage(canvas, 0, 0, 40, 40);
  const px = kc.getImageData(0, 0, 40, 40).data;
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let i = 0; i < px.length; i += 4) { if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) continue; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
  const hx = (v) => Math.round(v).toString(16).padStart(2, '0');
  const kleur = n ? `#${hx(r / n)}${hx(g / n)}${hx(b / n)}` : '#94A3B8';
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  return { blob, kleur, verhouding: canvas.width / canvas.height };
}
