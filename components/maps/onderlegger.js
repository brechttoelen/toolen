'use client';

// Onderleggers: een afbeelding of PDF-pagina (bv. een CAD-plan van de stad) die
// op de kaart ligt. Georefereren gebeurt met een midden, een breedte in meter en
// een draaiing (met de klok mee). Fijn passen met twee punten: klik twee punten
// op de onderlegger en daarna dezelfde twee punten op de kaart.
//
// Bewaard in plannen.instellingen.onderleggers als
// { id, naam, url, pad, verhouding (hoogte/breedte), midden, breedte, rot, dekking, zichtbaar }.

import { maps, sb, BUCKET, foutTekst } from './db';

const MPG = 111320; // meter per graad breedte

function naarLngLat(midden, [oost, noord]) {
  const lat = midden[1] + noord / MPG;
  const lng = midden[0] + oost / (MPG * Math.cos((midden[1] * Math.PI) / 180));
  return [lng, lat];
}

function naarMeter(midden, [lng, lat]) {
  return [(lng - midden[0]) * MPG * Math.cos((midden[1] * Math.PI) / 180), (lat - midden[1]) * MPG];
}

// Lokaal (x naar rechts op de afbeelding, y naar boven) → oost/noord met draaiing.
function draai([x, y], rot) {
  const r = (rot * Math.PI) / 180;
  return [x * Math.cos(r) + y * Math.sin(r), -x * Math.sin(r) + y * Math.cos(r)];
}

// Vier hoeken in de volgorde die MapLibre verwacht: linksboven, rechtsboven, rechtsonder, linksonder.
export function hoeken(o) {
  const b = Number(o.breedte) || 100;
  const h = b * (Number(o.verhouding) || 1);
  return [[-b / 2, h / 2], [b / 2, h / 2], [b / 2, -h / 2], [-b / 2, -h / 2]].map((p) => naarLngLat(o.midden, draai(p, Number(o.rot) || 0)));
}

// Kaartpunt → positie op de onderlegger in meter t.o.v. het midden (onverdraaid).
export function naarLokaal(o, lngLat) {
  const [e, n] = naarMeter(o.midden, lngLat);
  return draai([e, n], -(Number(o.rot) || 0));
}

// Twee-puntspassing: bron = twee punten op de onderlegger (lokaal, in meter),
// doel = dezelfde twee punten op de kaart (lng/lat). Geeft nieuw midden, breedte en draaiing.
export function pasAan(o, bron, doel) {
  const [s1, s2] = bron;
  const t1 = naarMeter(o.midden, doel[0]);
  const t2 = naarMeter(o.midden, doel[1]);
  // Bronpunten zoals ze nu in oost/noord liggen.
  const a1 = draai(s1, o.rot || 0);
  const a2 = draai(s2, o.rot || 0);
  const lenA = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]);
  const lenT = Math.hypot(t2[0] - t1[0], t2[1] - t1[1]);
  if (lenA < 1e-6 || lenT < 1e-6) return null;
  const k = lenT / lenA;
  const hoekA = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
  const hoekT = Math.atan2(t2[1] - t1[1], t2[0] - t1[0]);
  const dHoek = hoekT - hoekA; // tegen de klok in, in radialen
  // Het oude midden (0,0) volgt dezelfde gelijkvormigheid.
  const c = Math.cos(dHoek), s = Math.sin(dHoek);
  const rel = [-a1[0] * k, -a1[1] * k];
  const nieuwMidden = [t1[0] + rel[0] * c - rel[1] * s, t1[1] + rel[0] * s + rel[1] * c];
  const rot = (((Number(o.rot) || 0) - (dHoek * 180) / Math.PI) % 360 + 360) % 360;
  return { midden: naarLngLat(o.midden, nieuwMidden), breedte: (Number(o.breedte) || 100) * k, rot };
}

// ---------- Vector-onderleggers (DXF) ----------
const dxfCache = new Map();
export async function laadDxf(url) {
  if (!dxfCache.has(url)) dxfCache.set(url, fetch(url).then((r) => r.json()));
  return dxfCache.get(url);
}
export function dxfGeojson(o, d) {
  const k = !d.vast && d.breedte ? (Number(o.breedte) || d.breedte) / d.breedte : 1;
  const t = d.vast ? (c) => c : ([x, y]) => naarLngLat(o.midden, draai([x * k, y * k], Number(o.rot) || 0));
  return {
    type: 'FeatureCollection',
    features: [
      ...d.lijnen.map((l) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.c.map(t) }, properties: { laag: l.laag } })),
      ...d.teksten.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: t(x.p) }, properties: { t: x.t, rot: -(Number(x.rot) || 0) + (d.vast ? 0 : Number(o.rot) || 0) } })),
    ],
  };
}

// Live tonen tijdens het slepen (zonder de andere onderleggers aan te raken).
export function toonLive(map, o) {
  const id = `fm-ol-${o.id}`; const bron = map.getSource(id);
  if (!bron) return;
  if (o.soort === 'dxf') { const d = dxfCache.get(o.url); if (d) d.then((x) => { const b2 = map.getSource(id); if (b2) b2.setData(dxfGeojson(o, x)); }); return; }
  bron.setCoordinates?.(hoeken(o));
}

// ---------- Kaartlagen ----------
export async function zetOnderleggers(map, lijst, voorLaag = map.getLayer?.('fm-vloer') ? 'fm-vloer' : 'fm-vulling') {
  const gewenst = new Set();
  const snaplijnen = [];
  for (const o of lijst || []) {
    if (o?.soort === 'dxf' && o.url) {
      const id = `fm-ol-${o.id}`;
      gewenst.add(id); gewenst.add(`${id}-t`);
      let d;
      try { d = await laadDxf(o.url); } catch { continue; }
      if (!map.getStyle()) return;
      const data = dxfGeojson(o, d);
      if (o.zichtbaar !== false) for (const f of data.features) if (f.geometry.type === 'LineString') snaplijnen.push(f.geometry);
      if (map.getSource(id)) map.getSource(id).setData(data);
      else {
        map.addSource(id, { type: 'geojson', data });
        map.addLayer({ id, type: 'line', source: id, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': o.kleur || '#1d1d1b', 'line-width': 1 } }, map.getLayer(voorLaag) ? voorLaag : undefined);
        map.addLayer({ id: `${id}-t`, type: 'symbol', source: id, minzoom: 17, filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['get', 't'], 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-rotate': ['get', 'rot'], 'text-rotation-alignment': 'map' }, paint: { 'text-color': o.kleur || '#1d1d1b' } }, map.getLayer(voorLaag) ? voorLaag : undefined);
      }
      map.setPaintProperty(id, 'line-opacity', Number(o.dekking ?? 0.7));
      map.setPaintProperty(`${id}-t`, 'text-opacity', Number(o.dekking ?? 0.7));
      map.setLayoutProperty(id, 'visibility', o.zichtbaar === false ? 'none' : 'visible');
      map.setLayoutProperty(`${id}-t`, 'visibility', o.zichtbaar === false ? 'none' : 'visible');
      continue;
    }
    if (!o?.url || !o.midden) continue;
    const id = `fm-ol-${o.id}`;
    gewenst.add(id);
    const coordinates = hoeken(o);
    const bron = map.getSource(id);
    if (bron) {
      if (bron._fmUrl !== o.url) bron.updateImage({ url: o.url, coordinates });
      else bron.setCoordinates(coordinates);
      bron._fmUrl = o.url;
    } else {
      map.addSource(id, { type: 'image', url: o.url, coordinates });
      map.getSource(id)._fmUrl = o.url;
      map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-fade-duration': 0 } }, map.getLayer(voorLaag) ? voorLaag : undefined);
    }
    map.setPaintProperty(id, 'raster-opacity', Number(o.dekking ?? 0.7));
    map.setLayoutProperty(id, 'visibility', o.zichtbaar === false ? 'none' : 'visible');
  }
  map._fmSnaplijnen = snaplijnen;
  for (const l of map.getStyle()?.layers || []) {
    if (l.id.startsWith('fm-ol-') && !gewenst.has(l.id)) map.removeLayer(l.id);
  }
  for (const id of Object.keys(map.getStyle()?.sources || {})) {
    if (id.startsWith('fm-ol-') && !gewenst.has(id) && !(map.getStyle()?.layers || []).some((l) => l.source === id)) map.removeSource(id);
  }
}

// ---------- Inlezen ----------
async function beeldMaat(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, nok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nok; i.src = url; });
    return [img.naturalWidth, img.naturalHeight];
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Eerste (of gekozen) pagina van een PDF als PNG, scherp genoeg om op in te zoomen.
async function pdfNaarPng(bestand, pagina = 1, maxPx = 4096) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await bestand.arrayBuffer(), disableFontFace: true }).promise;
  const p = await doc.getPage(Math.min(pagina, doc.numPages));
  const basis = p.getViewport({ scale: 1 });
  const schaal = Math.min(maxPx / basis.width, maxPx / basis.height, 6);
  const vp = p.getViewport({ scale: schaal });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await p.render({ canvasContext: ctx, viewport: vp }).promise;
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  return { blob, w: canvas.width, h: canvas.height, paginas: doc.numPages };
}

// Bestand → upload in de bucket → onderlegger-object (nog niet bewaard in het plan).
// Vector-PDF (CAD- of architectenplan) als lijnen inlezen in plaats van als afbeelding:
// scherp op elke zoom, en je tekent erop met snappen. mPerPt = meter per PDF-punt
// (schaal 1:N → N × 0,0003528); zonder schaal: zo breed als breedteM, daarna passen met twee punten.
export async function pdfLijnen(bestand, { mPerPt = null, breedteM = 50 } = {}) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await bestand.arrayBuffer(), disableFontFace: true }).promise;
  const page = await doc.getPage(1);
  const { pdfVectoren, schoonOp } = await import('./cadpdf');
  const paden = schoonOp(await pdfVectoren(page, pdfjs), { minPt: 0.3 });
  if (paden.length < 40) return null; // gescand of foto: dan als afbeelding
  let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity;
  for (const q of paden) for (const [x, y] of q.pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  const k = mPerPt || breedteM / ((c - a) || 1);
  const mx = (a + c) / 2; const my = (b + d) / 2;
  const f = ([x, y]) => [Math.round((x - mx) * k * 1000) / 1000, Math.round((y - my) * k * 1000) / 1000];
  const maxD = Math.max(...paden.map((q) => q.d || 0));
  const lijnen = paden.slice(0, 30000).map((q) => ({ laag: (q.d || 0) >= maxD * 0.6 ? 'WANDEN' : 'DETAIL', c: (q.dicht ? [...q.pts, q.pts[0]] : q.pts).map(f) }));
  // Teksten (zaalnamen …) uit de PDF.
  const teksten = [];
  try {
    const tc = await page.getTextContent();
    for (const t of tc.items) { const s = String(t.str || '').trim(); if (!s) continue; const [, , , , e, g] = t.transform; teksten.push({ t: s, p: f([e, g]), h: Math.max(0.2, (t.height || 8) * k) }); }
  } catch { /* geen tekst */ }
  return { vast: false, breedte: (c - a) * k, hoogte: (d - b) * k, lijnen, teksten, pdf: true };
}
// Een al gelezen vector-onderlegger (lijnen in meter) bewaren.
export async function bewaarVectorOnderlegger(planId, naam, ol, midden) {
  const id = crypto.randomUUID();
  const pad = `${planId}/onderlegger/${id}.json`;
  const { error } = await sb().storage.from(BUCKET).upload(pad, new Blob([JSON.stringify(ol)], { type: 'application/json' }), { contentType: 'application/json' });
  if (error) throw new Error(foutTekst(error));
  const url = sb().storage.from(BUCKET).getPublicUrl(pad).data.publicUrl;
  await maps().from('bestanden').insert({ plan_id: planId, soort: 'onderlegger', pad, meta: { naam, lijnen: ol.lijnen.length, pdf: true } });
  return { id, soort: 'dxf', stelsel: 'lokaal', naam: naam.replace(/\.[^.]+$/, ''), url, pad, verhouding: (ol.hoogte / ol.breedte) || 1, midden, breedte: ol.breedte, rot: 0, dekking: 0.8, zichtbaar: true, kleur: '#1d1d1b', vast: false };
}

export async function nieuweOnderlegger(planId, bestand, midden, breedteM, voortgang = () => {}) {
  let blob = bestand;
  let w;
  let h;
  let ext = (bestand.name.split('.').pop() || 'png').toLowerCase();
  if (ext === 'dxf') {
    voortgang('DXF lezen…');
    const { leesDxf, raadStelsel, naarOnderlegger } = await import('./dxf');
    const d = leesDxf(await bestand.text());
    const stelsel = raadStelsel(d);
    const ol = naarOnderlegger(d, stelsel);
    voortgang('Uploaden…');
    const id = crypto.randomUUID();
    const pad = `${planId}/onderlegger/${id}.json`;
    const { error } = await sb().storage.from(BUCKET).upload(pad, new Blob([JSON.stringify(ol)], { type: 'application/json' }), { contentType: 'application/json' });
    if (error) throw new Error(foutTekst(error));
    const url = sb().storage.from(BUCKET).getPublicUrl(pad).data.publicUrl;
    await maps().from('bestanden').insert({ plan_id: planId, soort: 'onderlegger', pad, meta: { naam: bestand.name, stelsel, lijnen: d.lijnen.length } });
    const k = ol.vast ? null : ol;
    return {
      id, soort: 'dxf', stelsel, naam: bestand.name.replace(/\.[^.]+$/, ''), url, pad,
      verhouding: k ? (k.hoogte / k.breedte) || 1 : 1, midden: midden, breedte: k ? k.breedte : null, rot: 0, dekking: 0.8, zichtbaar: true, kleur: '#1d1d1b',
      vast: !!ol.vast,
    };
  }
  if (ext === 'pdf' || bestand.type === 'application/pdf') {
    voortgang('PDF omzetten…');
    const r = await pdfNaarPng(bestand);
    blob = r.blob; w = r.w; h = r.h; ext = 'png';
  } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    [w, h] = await beeldMaat(bestand);
  } else {
    throw new Error('Kies een PDF, PNG, JPG of DXF. Een DWG bewaar je in je CAD-programma eerst als DXF.');
  }
  voortgang('Uploaden…');
  const id = crypto.randomUUID();
  const pad = `${planId}/onderlegger/${id}.${ext}`;
  const { error } = await sb().storage.from(BUCKET).upload(pad, blob, { contentType: ext === 'png' ? 'image/png' : blob.type || 'image/jpeg', upsert: false });
  if (error) throw new Error(foutTekst(error));
  const url = sb().storage.from(BUCKET).getPublicUrl(pad).data.publicUrl;
  await maps().from('bestanden').insert({ plan_id: planId, soort: 'onderlegger', pad, meta: { naam: bestand.name, w, h } });
  return { id, naam: bestand.name.replace(/\.[^.]+$/, ''), url, pad, verhouding: h / w, midden, breedte: breedteM, rot: 0, dekking: 0.7, zichtbaar: true };
}

export async function verwijderBestand(pad) {
  if (!pad) return;
  await sb().storage.from(BUCKET).remove([pad]);
  await maps().from('bestanden').delete().eq('pad', pad);
}

// ---------- Binnenplan: assenstelsel van het grondplan ----------
// Lokaal = de eigen maten van het grondplan in meter (DXF: zoals getekend; PDF of foto: zoals gepast).
// Geeft { naarGeo([x, y]) → [lng, lat], naarPlan([lng, lat]) → [x, y], rot, k }.
// Een georeferentieel DXF (vast) krijgt een lokaal stelsel rond zijn midden, noord = boven.
export function planTransform(o, d, terugMidden = null, terugRot = 0) {
  if (d?.vast) {
    let sx = 0; let sy = 0; let n = 0;
    for (const l of d.lijnen || []) for (const [x, y] of l.c) { sx += x; sy += y; n += 1; }
    const m = n ? [sx / n, sy / n] : (terugMidden || [0, 0]);
    return { naarGeo: (c) => naarLngLat(m, c), naarPlan: (c) => naarMeter(m, c), rot: 0, k: 1, midden: m, vast: true };
  }
  if (!o) {
    // Zonder grondplan: rond het midden van de host, en (bij een tent) in de richting van de tent.
    const m = terugMidden || [0, 0]; const r = Number(terugRot) || 0;
    return { naarGeo: (c) => naarLngLat(m, draai(c, r)), naarPlan: (c) => draai(naarMeter(m, c), -r), rot: r, k: 1, midden: m };
  }
  const nat = Number(o.natuur) || (d && !d.pdf && d.breedte) || 0;
  const k = o.soort === 'dxf' && nat ? (Number(o.breedte) || nat) / nat : 1;
  const rot = Number(o.rot) || 0;
  return {
    naarGeo: ([x, y]) => naarLngLat(o.midden, draai([x * k, y * k], rot)),
    naarPlan: (c) => { const [a, b] = draai(naarMeter(o.midden, c), -rot); return [a / k, b / k]; },
    rot, k, midden: o.midden,
  };
}
// Passen met twee punten zonder de schaal te veranderen (DXF met echte maten): enkel verschuiven en draaien.
export function pasAanVast(o, bron, doel) {
  const r = pasAan(o, bron, doel);
  if (!r) return null;
  const k = r.breedte / (Number(o.breedte) || r.breedte);
  if (Math.abs(k - 1) < 1e-9) return r;
  // Zelfde draaiing, maar midden zo dat het middelpunt van de twee doelpunten samenvalt.
  const lb = [(bron[0][0] + bron[1][0]) / 2, (bron[0][1] + bron[1][1]) / 2];
  const ld = [(doel[0][0] + doel[1][0]) / 2, (doel[0][1] + doel[1][1]) / 2];
  const t = naarMeter(o.midden, ld);
  const q = draai(lb, r.rot);
  return { midden: naarLngLat(o.midden, [t[0] - q[0], t[1] - q[1]]), breedte: Number(o.breedte), rot: r.rot };
}
