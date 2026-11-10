'use client';

// PDF op vaste schaal. De ondergrond wordt in een onzichtbare kaart op de
// juiste resolutie getekend en als afbeelding geplaatst; alle items, labels,
// raster, legende en titelblok zijn vector, dus scherp op elk formaat.
import maplibregl from 'maplibre-gl';
import { jsPDF } from 'jspdf';
import { zetOnderleggers } from './onderlegger';
import { basisStijl, bronvermelding, drukbaar, registreerProtocollen } from './ondergronden';
import { effectieveStijl, STREPEN, naarGeojson, losseFeatures, TEXTUUR_KLEUR, doekVan, toebehorenTelling, toebehorenVan, doekRuns, doekenPerHek, totemPanelen, isVlagHek } from './stijl';
import { publiekeUrl } from './db';
import { merkKort, getOrganisatie } from './merk';
import { naarDataUrl } from './bord';
import { icoonPng, laadIconen } from './kaarticonen';
import { verschil } from './PlanPaneel';
import * as turf from '@turf/turf';
import { berekenStuklijst } from './Stuklijst';
import * as geo from './geo';

export const PAPIER = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
const SCHALEN = [100, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000];

const hex = (h) => {
  const s = String(h || '#000000').replace('#', '');
  const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

const letters = (n) => {
  let s = '';
  let x = n + 1;
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); }
  return s;
};

export function paginaMaat({ papier, orientatie, vrijB, vrijH }) {
  let [b, h] = papier === 'vrij' ? [Number(vrijB) || 2100, Number(vrijH) || 1500] : PAPIER[papier] || PAPIER.A3;
  if (b < h) [b, h] = [h, b];
  return orientatie === 'staand' ? [h, b] : [b, h];
}

export function indeling(inst) {
  const [pb, ph] = paginaMaat(inst);
  const marge = pb >= 800 ? 15 : 10;
  // Zonder legende: geen zijkolom, de kaart over de volledige breedte; titelblok en schaal komen
  // compact op de kaart (in een hoek waar niets staat). Een rasterindex heeft wel een zijkolom nodig.
  const zonderZij = inst.legende === false && !(inst.raster?.aan && inst.raster?.index !== false);
  const zij = zonderZij ? 0 : Math.min(110, Math.max(62, pb * 0.2));
  const rand = inst.raster?.aan ? 6 : 0;
  return {
    pb, ph, marge, zij, zonderZij,
    kader: { x: marge + rand, y: marge + rand, b: pb - 2 * marge - (zonderZij ? 0 : zij + 6) - 2 * rand, h: ph - 2 * marge - 2 * rand },
    rand,
    zijX: pb - marge - zij,
  };
}

// Schaal die alle items laat passen, afgerond naar een gangbare schaal.
export function passendeSchaal(kaderB, kaderH, bbox) {
  if (!bbox) return 1000;
  const lat = (bbox[1] + bbox[3]) / 2;
  const breed = geo.lengte({ type: 'LineString', coordinates: [[bbox[0], lat], [bbox[2], lat]] }) * 1.1 + 10;
  const hoog = geo.lengte({ type: 'LineString', coordinates: [[bbox[0], bbox[1]], [bbox[0], bbox[3]]] }) * 1.1 + 10;
  const nodig = Math.max(breed / (kaderB / 1000), hoog / (kaderH / 1000));
  return SCHALEN.find((s) => s >= nodig) || Math.ceil(nodig / 1000) * 1000;
}

// Wachten tot de kaart klaar is, met voortgang (tegels binnen / gevraagd). Zolang er tegels binnenkomen wachten we;
// pas na een lange stilte (een tegel die niet antwoordt) gaan we verder met wat er is.
function wachtOpKaart(map, { ms = 120000, stil = 15000, onTegels = null } = {}) {
  return new Promise((ok) => {
    let klaar = false; let laatste = Date.now();
    // Per tegel één keer tellen (een tegel meldt zich soms meermaals).
    const G = new Set(); const B = new Set(); const F = new Set();
    const sl = (e) => { const t = e?.tile; const k = t?.tileID?.key ?? t?.uid; return k != null ? `${e.sourceId || ''}|${k}` : null; };
    const tel = () => ({ gevraagd: G.size, binnen: [...B].filter((k) => !F.has(k)).length, fout: F.size });
    const meld = () => { try { onTegels?.(tel()); } catch {} };
    const stop = (v) => { if (klaar) return; klaar = true; clearTimeout(t); clearInterval(iv); map.off('idle', check); map.off('data', bij); map.off('dataloading', vraag); map.off('error', mis); meld(); ok(v); };
    const t = setTimeout(() => stop(false), ms);
    const check = () => { if (map.loaded() && map.areTilesLoaded()) stop(true); };
    const vraag = (e) => { const k = sl(e); if (k) { G.add(k); laatste = Date.now(); } };
    const bij = (e) => { const k = sl(e); if (k) { B.add(k); laatste = Date.now(); } else if (e.dataType === 'style') laatste = Date.now(); };
    const mis = (e) => { const k = sl(e); if (k) { F.add(k); laatste = Date.now(); } else if (e?.sourceId) laatste = Date.now(); };
    map.on('idle', check); map.on('data', bij); map.on('dataloading', vraag); map.on('error', mis);
    map.once('load', () => { laatste = Date.now(); setTimeout(check, 200); });
    // Alle gevraagde tegels zijn binnen of mislukt: niet nog de volle stilte afwachten.
    const iv = setInterval(() => { meld(); const st0 = Date.now() - laatste; const n = tel(); if (st0 > stil || (n.gevraagd > 0 && n.binnen + n.fout >= n.gevraagd && st0 > 2500)) stop(map.loaded() && map.areTilesLoaded()); }, 400);
  });
}

async function tekenOndergrond({ ondergrond, centrum, schaal, kader, dpiDoel, onderleggers = [], onTegels = null }) {
  // Pixels: zo dicht mogelijk bij dpiDoel, maar binnen wat een browser aankan.
  let dpi = dpiDoel;
  const px = (d) => [Math.round((kader.b / 25.4) * d), Math.round((kader.h / 25.4) * d)];
  let [w, h] = px(dpi);
  while ((w * h > 16e6 || w > 8000 || h > 8000) && dpi > 60) { dpi -= 10; [w, h] = px(dpi); }
  // Luchtfoto's hebben geen scherpere beelden dan ± zoom 19 (25 cm per pixel). Fijner
  // ophalen kost enkel veel meer tegels (4× per zoomstap) en dus wachttijd; de items
  // zelf blijven in de PDF scherp omdat ze als vectoren getekend worden.
  const zoomVan = (d) => geo.zoomVoorMeterPerPixel(((kader.b / 1000) * schaal) / px(d)[0], centrum[1]);
  if (!onderleggers.some((o) => o.zichtbaar !== false && o.url)) {
    while (zoomVan(dpi) > 19.2 && dpi > 100) { dpi -= 10; [w, h] = px(dpi); }
  }
  const mpp = ((kader.b / 1000) * schaal) / w;
  const zoom = geo.zoomVoorMeterPerPixel(mpp, centrum[1]);

  registreerProtocollen();
  const doos = document.createElement('div');
  Object.assign(doos.style, { position: 'fixed', left: '-100000px', top: '0', width: `${w}px`, height: `${h}px` });
  document.body.appendChild(doos);
  const map = new maplibregl.Map({
    container: doos, style: basisStijl(ondergrond, centrum), center: centrum, zoom, interactive: false,
    pixelRatio: 1, preserveDrawingBuffer: true, attributionControl: false, fadeDuration: 0, maxCanvasSize: [8192, 8192],
  });
  const metOl = onderleggers.filter((o) => o.zichtbaar !== false && o.url);
  if (metOl.length) {
    await new Promise((ok) => { if (map.loaded()) ok(); else map.once('load', ok); });
    try { await zetOnderleggers(map, metOl); } catch (e) { console.warn('onderlegger in PDF', e); }
  }
  try {
    const volledig = await wachtOpKaart(map, { onTegels });
    let beeld = null;
    let melding = volledig ? '' : 'Niet alle kaarttegels kwamen op tijd binnen; de ondergrond kan onvolledig zijn.';
    if (ondergrond !== 'leeg' || metOl.length) {
      try { beeld = map.getCanvas().toDataURL('image/jpeg', 0.88); }
      catch { melding = 'De kaartdienst laat niet toe dat de ondergrond in een PDF komt (CORS). De PDF bevat enkel de items.'; }
    }
    return { beeld, melding, dpi, project: (c) => { const p = map.project(c); return [kader.x + (p.x / w) * kader.b, kader.y + (p.y / h) * kader.h]; }, map, doos };
  } catch (e) {
    map.remove(); doos.remove();
    throw e;
  }
}

// Schermdikte (px) naar mm op papier: wat dunner dan op het scherm, zodat een plan rustig leest.
const PX_MM = 0.14;

function zetLijn(doc, s, schaal) {
  const [r, g, b] = hex(s.kleur);
  doc.setDrawColor(r, g, b);
  const mm = s.dikte_eenheid === 'm' ? (Number(s.dikte) / schaal) * 1000 : Math.max(0.12, (Number(s.dikte) || 1) * PX_MM);
  doc.setLineWidth(mm);
  const streep = STREPEN[s.streep];
  doc.setLineDashPattern(streep ? streep.map((x) => Math.max(0.3, x * mm)) : [], 0);
  return mm;
}

function pad(doc, punten, sluiten) {
  punten.forEach(([x, y], i) => (i === 0 ? doc.moveTo(x, y) : doc.lineTo(x, y)));
  if (sluiten) doc.close();
}

// Revisiewolk: bolletjes langs de rand van een rechthoek.
function wolk(doc, x, y, b, h) {
  const r = 1.6;
  const zijde = (x0, y0, x1, y1, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / (2 * r)));
    const dx = (x1 - x0) / n; const dy = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const sx = x0 + dx * i; const sy = y0 + dy * i;
      doc.lines([[dx * 0.1 + nx * r * 1.3, dy * 0.1 + ny * r * 1.3, dx * 0.9 + nx * r * 1.3, dy * 0.9 + ny * r * 1.3, dx, dy]], sx, sy, [1, 1], 'S', false);
    }
  };
  zijde(x, y, x + b, y, 0, -1);
  zijde(x + b, y, x + b, y + h, 1, 0);
  zijde(x + b, y + h, x, y + h, 0, 1);
  zijde(x, y + h, x, y, -1, 0);
}

function tekst(doc, t, x, y, { grootte = 8, kleur = '#1d1d1b', halo = true, uitlijning = 'center', vet = true, cursief = false, hoek = 0 } = {}) {
  if (!t) return;
  doc.setFont('helvetica', vet && cursief ? 'bolditalic' : cursief ? 'italic' : vet ? 'bold' : 'normal');
  doc.setFontSize(grootte);
  const regels = String(t).split('\n');
  if (halo) {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(grootte * 0.09);
    doc.setLineDashPattern([], 0);
    doc.text(regels, x, y, { align: uitlijning, baseline: 'middle', renderingMode: 'stroke', ...(hoek ? { angle: hoek } : {}) });
  }
  doc.setTextColor(...hex(kleur));
  doc.text(regels, x, y, { align: uitlijning, baseline: 'middle', ...(hoek ? { angle: hoek } : {}) });
}

// Logo van de eigen huisstijl als PNG voor het titelblok (null zonder huisstijl of als het niet laadt).
let logoCache = null;
async function huisstijlLogo() {
  const url = getOrganisatie()?.huisstijl?.logo_licht || getOrganisatie()?.huisstijl?.logo_donker;
  if (!url) return null;
  if (logoCache?.url === url) return logoCache;
  try {
    const blob = await (await fetch(url, { mode: 'cors' })).blob();
    const data = await new Promise((ok, nok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = nok; r.readAsDataURL(blob); });
    const maat = await new Promise((ok, nok) => { const im = new Image(); im.onload = () => ok([im.naturalWidth, im.naturalHeight]); im.onerror = nok; im.src = data; });
    logoCache = { url, data, ratio: maat[0] / Math.max(1, maat[1]) };
    return logoCache;
  } catch { return null; }
}
const metToolen = () => !getOrganisatie()?.huisstijl?.toolen_verbergen;

export async function maakPdf({ plan, lagen, items, elementenMap, fase, inst, voortgang = () => {}, doc: bestaandDoc = null, blad = null }) {
  await laadIconen(items.map((i) => i.stijl?.icoon).filter(Boolean));
  const logo = await huisstijlLogo();
  const L = indeling(inst);
  const { kader } = L;
  const lagenMap = new Map(lagen.map((l) => [l.id, l]));
  const printLagen = new Set(lagen.filter((l) => l.printbaar && (inst.lagen ? inst.lagen.includes(l.id) : l.zichtbaar)).map((l) => l.id));
  const zichtbaar = items.filter((it) => !it.verborgen && !it.velden?.binnen && (!it.laag_id || printLagen.has(it.laag_id))
    && (!fase || !it.fase_ids?.length || it.fase_ids.includes(fase.id)));

  const kaderItems = geo.kader(zichtbaar.map((i) => i.geometrie));
  const schaal = inst.schaal || passendeSchaal(kader.b, kader.h, kaderItems);
  // Passend: het midden van de items; anders het gekozen midden.
  const centrum = (!inst.schaal && kaderItems) ? [(kaderItems[0] + kaderItems[2]) / 2, (kaderItems[1] + kaderItems[3]) / 2] : (Array.isArray(inst.centrum) ? inst.centrum : plan.centrum || [4.4, 50.9]);
  const meldingen = [];
  let ondergrond = inst.ondergrond;
  if (!drukbaar(ondergrond, centrum)) {
    meldingen.push(ondergrond === 'stratenkaart'
      ? 'OpenStreetMap-tegels mogen niet in drukwerk; de PDF is zonder ondergrond gemaakt.'
      : 'Voor deze plek is er geen drukbare ondergrond van deze soort; de PDF is zonder ondergrond gemaakt.');
    ondergrond = 'leeg';
  }

  voortgang('Ondergrond laden…');
  const og = await tekenOndergrond({ ondergrond, centrum, schaal, kader, dpiDoel: inst.dpi || 200, onTegels: inst.onTegels || null, onderleggers: inst.onderleggers === false ? [] : (plan.instellingen?.onderleggers || []).filter((o) => !o.binnen) }); // grondplannen van binnenplannen horen niet op de kaart
  if (og.melding) meldingen.push(og.melding);

  try {
    voortgang('Items tekenen…');
    const doc = bestaandDoc || new jsPDF({ orientation: L.pb >= L.ph ? 'landscape' : 'portrait', unit: 'mm', format: [L.pb, L.ph], compress: true });
    if (bestaandDoc) doc.addPage([L.pb, L.ph], L.pb >= L.ph ? 'landscape' : 'portrait');
    const kaartBlz = doc.getNumberOfPages();
    const GS = (o) => new doc.GState({ opacity: o, 'stroke-opacity': o });

    if (og.beeld) doc.addImage(og.beeld, 'JPEG', kader.x, kader.y, kader.b, kader.h, undefined, 'FAST');
    if (og.beeld && inst.dimmen) { doc.setGState(GS(inst.dimmen)); doc.setFillColor(255, 255, 255); doc.rect(kader.x, kader.y, kader.b, kader.h, 'F'); doc.setGState(GS(1)); }

    // Alles binnen het kaartkader.
    doc.saveGraphicsState();
    doc.rect(kader.x, kader.y, kader.b, kader.h, null);
    doc.clip();
    doc.discardPath();

    // Items: dezelfde omzetting als de kaart (dubbele lijnen, pijlen, maatlijnen, iconen …).
    const tbTonen = inst.toebehoren === 'altijd' || (inst.toebehoren !== 'nooit' && schaal <= 500);
    const { vormen, labels: symbolen } = naarGeojson(zichtbaar, lagenMap, elementenMap, { verbergElementen: plan.instellingen?.verborgen_elementen, doek: inst.doek !== false, toebehoren: tbTonen, doeknaam: inst.doek !== false && inst.doeknaam === true, heknummers: tbTonen });
    const lijnMm = (p) => (p.dikte_m > 0 ? (p.dikte_m / schaal) * 1000 : Math.max(0.12, (Number(p.dikte) || 1) * PX_MM));
    const zetLijnP = (p) => zetLijn(doc, { kleur: p.kleur, dikte: p.dikte_m > 0 ? p.dikte_m : p.dikte, dikte_eenheid: p.dikte_m > 0 ? 'm' : 'px', streep: p.streep }, schaal);
    const labels = [];
    // Teksten die elkaar overlappen niet over elkaar drukken (bv. boxnummers op een overzichtsplan):
    // de eerste die past komt erop, de rest valt weg.
    const bezet = []; const vrijeTeksten = [];
    const vrij = (t, x, y, pt, vet = true) => {
      doc.setFont('helvetica', vet ? 'bold' : 'normal'); doc.setFontSize(pt);
      const r = String(t).split('\n'); const w = Math.max(...r.map((q) => doc.getTextWidth(q))) + 0.6; const h = r.length * pt * 0.3528 * 1.15 + 0.4;
      const b = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (bezet.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return false;
      bezet.push(b); return true;
    };
    // Zonder "maten" ook geen lengtes of oppervlaktes in de namen.
    const zonderMaten = (t) => (inst.maten ? t : String(t).split('\n').filter((r) => !/^[\d.,\s]+(m|m²)(\s·.*)?$/.test(r.trim())).join('\n'));
    // Zelfde volgorde als op de kaart: vloeren (platen) onderaan, dan vlakken, dan lijnen, dan punten.
    const rang = (f) => { const t = f.geometry?.type; const o = f.properties?.onder === true; return t === 'Point' ? 4 : t === 'Polygon' ? (o ? 0 : 2) : (o ? 1 : 3); };
    const geordend = losseFeatures(vormen.features).map((f, i) => [f, i]).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1] - b[1]).map((x) => x[0]);
    // Zoomniveau dat met deze schaal overeenkomt (voor teksten die pas vanaf een zoom zichtbaar zijn).
    const printZoom = Math.log2((156543.03 * Math.cos(((centrum?.[1] || 51) * Math.PI) / 180)) / (schaal * 0.000264));
    // Zoomvenster per feature (minz/maxz, bv. een camerastelling: bolletje uitgezoomd, tekening ingezoomd).
    const inVenster = (p) => !((p.minz && printZoom < Number(p.minz)) || (p.maxz && printZoom >= Number(p.maxz)));
    for (const f of geordend) {
      const p = f.properties;
      const g = f.geometry;
      if (!inVenster(p)) continue;
      if (g.type === 'Point') {
        const [x, y] = og.project(g.coordinates);
        if (p.soort === 'tekst') {
          // Na de namen van de items tekenen: die gaan voor als er plaats tekort is.
          if (p.vanaf_zoom && printZoom < Number(p.vanaf_zoom)) continue;
          vrijeTeksten.push({ p, x, y, teken: () => {
            if (p.achtergrond) {
              doc.setFont('helvetica', p.vet ? 'bold' : 'normal'); doc.setFontSize(p.tekstgrootte * 0.75);
              const w = doc.getTextWidth(p.tekst) + 2; const h = p.tekstgrootte * 0.75 * 0.45 + 1.5;
              if (!p.tekst_rot) { doc.setFillColor(255, 255, 255); doc.rect(x - w / 2, y - h / 2, w, h, 'F'); }
            }
            tekst(doc, p.tekst, x, y, { grootte: p.tekstgrootte * 0.75, kleur: p.kleur, vet: p.vet !== false, cursief: !!p.cursief, hoek: -p.tekst_rot });
          } });
          continue;
        }
        doc.setGState(GS(p.dekking ?? 1));
        const dMm = p.icoon_m > 0 ? (p.icoon_m / schaal) * 1000 : null;
        if (p.icoon && !p.nr) {
          const png = icoonPng(p.icoon, p.kleur);
          const d = dMm || 4.8;
          if (png) doc.addImage(png, 'PNG', x - d / 2, y - d / 2, d, d);
        } else {
          doc.setFillColor(...hex(p.kleur)); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.4); doc.setLineDashPattern([], 0);
          doc.circle(x, y, dMm ? dMm / 2 : p.nr ? 2.4 : 1.6, 'FD');
          if (p.nr) { doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255); doc.text(p.nr, x, y, { align: 'center', baseline: 'middle' }); }
        }
        doc.setGState(GS(1));
      } else if (g.type === 'LineString') {
        const pts = g.coordinates.map(og.project);
        if (p.wit_rand) {
          const mm = lijnMm(p);
          doc.setDrawColor(255, 255, 255); doc.setLineWidth(mm + 0.6); doc.setLineDashPattern([], 0);
          pad(doc, pts, false); doc.stroke();
        }
        doc.setGState(GS(p.dekking ?? 1));
        zetLijnP(p);
        pad(doc, pts, false);
        doc.stroke();
        doc.setGState(GS(1));
      } else if (g.type === 'Polygon') {
        const ringen = g.coordinates.map((r) => r.map(og.project));
        const vulling = p.vuldekking;
        const textuur = TEXTUUR_KLEUR[p.vulpatroon];
        if (vulling > 0 && (p.vulpatroon === 'effen' || textuur)) {
          doc.setGState(GS(textuur ? Math.max(0.6, vulling) : vulling));
          doc.setFillColor(...hex(textuur || p.vulkleur));
          ringen.forEach((r) => pad(doc, r, true));
          doc.fill();
          doc.setGState(GS(1));
        }
        if (p.vulpatroon === 'arcering' || p.vulpatroon === 'raster' || p.vulpatroon === 'kasseien' || p.vulpatroon === 'hout') {
          doc.saveGraphicsState();
          ringen.forEach((r) => pad(doc, r, true));
          doc.clip();
          doc.discardPath();
          const xs = ringen[0].map((q) => q[0]); const ys = ringen[0].map((q) => q[1]);
          const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
          doc.setDrawColor(...hex(textuur ? '#5F5B55' : p.kleur)); doc.setLineWidth(0.25); doc.setLineDashPattern([], 0);
          doc.setGState(GS(0.75));
          const stap = 2.2;
          if (p.vulpatroon === 'arcering') {
            for (let d = x0 - (y1 - y0); d < x1; d += stap) { doc.line(d, y1, d + (y1 - y0), y0); }
          } else if (p.vulpatroon === 'hout') {
            for (let yy = y0; yy <= y1; yy += 1.6) doc.line(x0, yy, x1, yy);
          } else {
            for (let x = x0; x <= x1; x += stap) doc.line(x, y0, x, y1);
            for (let yy = y0; yy <= y1; yy += stap) doc.line(x0, yy, x1, yy);
          }
          doc.setGState(GS(1));
          doc.restoreGraphicsState();
        }
        doc.setGState(GS(p.dekking ?? 1));
        zetLijnP(p);
        ringen.forEach((r) => pad(doc, r, true));
        doc.stroke();
        doc.setGState(GS(1));
      }
    }
    for (const f of symbolen.features) {
      const p = f.properties;
      if (!inVenster(p)) continue;
      if (p.soort === 'pijl') {
        const [x, y] = og.project(f.geometry.coordinates);
        const r = (p.rot * Math.PI) / 180;
        const m = Math.max(1.6, Math.max(0.12, (Number(p.dikte) || 1) * PX_MM) * 3.6);
        const rot = ([a, b]) => [x + a * Math.cos(r) - b * Math.sin(r), y + a * Math.sin(r) + b * Math.cos(r)];
        const [t1, t2, t3] = [[0, -m * 0.6], [m * 0.55, m * 0.6], [-m * 0.55, m * 0.6]].map(rot);
        doc.setFillColor(...hex(p.kleur)); doc.triangle(t1[0], t1[1], t2[0], t2[1], t3[0], t3[1], 'F');
      } else if (p.soort === 'patroon') {
        const [x, y] = og.project(f.geometry.coordinates);
        if (p.icoon) { const png = icoonPng(p.icoon, p.kleur, 64); if (png) doc.addImage(png, 'PNG', x - 1.5, y - 1.5, 3, 3); }
        else if (p.label) tekst(doc, p.label, x, y, { grootte: Math.max(4, p.tekstgrootte * 0.5), kleur: p.kleur, hoek: -p.rot });
      } else if (p.soort === 'heknr') {
        const [x, y] = og.project(f.geometry.coordinates);
        doc.setFillColor(...hex(p.kleur)); doc.circle(x, y, 1.3, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(4.6); doc.setTextColor(255, 255, 255);
        doc.text(p.label, x, y, { align: 'center', baseline: 'middle' });
      } else if (p.soort === 'langs' || p.soort === 'doeknaam') {
        const g = f.geometry;
        const tot = geo.lengte(g);
        const mid = turf.along(turf.lineString(g.coordinates), tot / 2, { units: 'meters' }).geometry.coordinates;
        const voor = turf.along(turf.lineString(g.coordinates), Math.max(0, tot / 2 - 1), { units: 'meters' }).geometry.coordinates;
        const na = turf.along(turf.lineString(g.coordinates), Math.min(tot, tot / 2 + 1), { units: 'meters' }).geometry.coordinates;
        const [ax, ay] = og.project(voor); const [bx, by] = og.project(na); const [mx, my] = og.project(mid);
        let hoek = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
        if (hoek > 90) hoek -= 180; if (hoek < -90) hoek += 180;
        const off = 1.6; const rr = (hoek * Math.PI) / 180;
        const tl = zonderMaten(p.label); if (tl) labels.push({ t: tl, x: mx + off * Math.sin(rr), y: my - off * Math.cos(rr), hoek: -hoek });
      } else if (p.soort === 'tekening-tekst') {
        const [x, y] = og.project(f.geometry.coordinates);
        const mm = (p.tekst_m / schaal) * 1000;
        if (mm >= 0.6) tekst(doc, p.label, x, y, { grootte: mm / 0.3528 / 0.72, kleur: p.kleur, halo: false, vet: p.vet !== false, cursief: !!p.cursief, hoek: -(p.tekst_rot || 0) });
      } else if (p.soort === 'label') {
        const [x, y] = og.project(f.geometry.coordinates);
        const t = inst.maten && p.maat ? `${p.label}\n${p.maat}` : zonderMaten(p.label);
        if (!t) continue;
        labels.push({ t, x, y: p.punt ? y + 3.6 : y, hoek: -(p.tekst_rot || 0), achtergrond: p.achtergrond });
      }
    }
    for (const l of labels) {
      if (!vrij(l.t, l.x, l.y, inst.labelGrootte || 6.5)) continue;
      if (l.achtergrond && !l.hoek) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(inst.labelGrootte || 6.5);
        const regels = String(l.t).split('\n');
        const w = Math.max(...regels.map((r) => doc.getTextWidth(r))) + 2; const h = regels.length * (inst.labelGrootte || 6.5) * 0.42 + 1.5;
        doc.setFillColor(255, 255, 255); doc.rect(l.x - w / 2, l.y - h / 2, w, h, 'F');
      }
      tekst(doc, l.t, l.x, l.y, { grootte: inst.labelGrootte || 6.5, hoek: l.hoek || 0 });
    }
    // Losse teksten (bv. boxnummers): botst er een met een andere tekst, dan valt die hele groep weg —
    // liever geen nummers dan een willekeurige helft. Op een grotere schaal passen ze en staan ze er allemaal.
    {
      const box = (v) => { doc.setFont('helvetica', v.p.vet !== false ? 'bold' : 'normal'); const pt = v.p.tekstgrootte * 0.75; doc.setFontSize(pt); const r = String(v.p.tekst).split('\n'); const w = Math.max(...r.map((q) => doc.getTextWidth(q))) + 0.6; const h = r.length * pt * 0.3528 * 1.15 + 0.4; return [v.x - w / 2, v.y - h / 2, v.x + w / 2, v.y + h / 2]; };
      const raak = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      const bx = vrijeTeksten.map(box);
      const weg = new Set();
      bx.forEach((a, i) => { if (bezet.some((o) => raak(a, o))) weg.add(i); for (let j = i + 1; j < bx.length; j++) if (raak([a[0] - 1.5, a[1] - 1.5, a[2] + 1.5, a[3] + 1.5], bx[j])) { weg.add(i); weg.add(j); } });
      vrijeTeksten.forEach((v, i) => { if (!weg.has(i)) { bezet.push(bx[i]); v.teken(); } });
    }

    // Revisiewolkjes rond wat veranderde t.o.v. de gekozen versie.
    if (inst.revisie?.items) {
      const d = verschil(inst.revisie.items, zichtbaar);
      doc.setDrawColor(225, 29, 72); doc.setLineWidth(0.45); doc.setLineDashPattern([], 0);
      for (const it of [...d.nieuw, ...d.gewijzigd, ...d.weg]) {
        const k = geo.kader([it.geometrie]);
        if (!k) continue;
        const [ax, ay] = og.project([k[0], k[3]]); const [bx, by] = og.project([k[2], k[1]]);
        wolk(doc, Math.min(ax, bx) - 2.5, Math.min(ay, by) - 2.5, Math.abs(bx - ax) + 5, Math.abs(by - ay) + 5);
      }
    }

    // Rasterplan: vakken met letters en cijfers.
    let vakken = null;
    if (inst.raster?.aan) {
      const kol = Math.max(2, Math.min(52, Number(inst.raster.kolommen) || 12));
      const vak = kader.b / kol;
      const rij = Math.max(1, Math.round(kader.h / vak));
      const vakH = kader.h / rij;
      vakken = { kol, rij, vak, vakH };
      const wit = ondergrond === 'luchtfoto' || ondergrond === 'luchtfoto_straten';
      doc.setDrawColor(...(wit ? [255, 255, 255] : [29, 29, 27]));
      doc.setLineWidth(0.25); doc.setLineDashPattern([], 0);
      doc.setGState(GS(0.9));
      for (let i = 1; i < kol; i++) doc.line(kader.x + i * vak, kader.y, kader.x + i * vak, kader.y + kader.h);
      for (let j = 1; j < rij; j++) doc.line(kader.x, kader.y + j * vakH, kader.x + kader.b, kader.y + j * vakH);
      doc.setGState(GS(1));
    }
    doc.restoreGraphicsState();

    // Kader en randen.
    doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.4); doc.setLineDashPattern([], 0);
    doc.rect(kader.x, kader.y, kader.b, kader.h);
    if (vakken) {
      const { kol, rij, vak, vakH } = vakken;
      const r = L.rand;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(Math.min(9, r * 1.6)); doc.setTextColor(29, 29, 27);
      for (let i = 0; i < kol; i++) {
        const x = kader.x + (i + 0.5) * vak;
        doc.text(letters(i), x, kader.y - r / 2, { align: 'center', baseline: 'middle' });
        doc.text(letters(i), x, kader.y + kader.h + r / 2, { align: 'center', baseline: 'middle' });
      }
      for (let j = 0; j < rij; j++) {
        const y = kader.y + (j + 0.5) * vakH;
        doc.text(String(j + 1), kader.x - r / 2, y, { align: 'center', baseline: 'middle' });
        doc.text(String(j + 1), kader.x + kader.b + r / 2, y, { align: 'center', baseline: 'middle' });
      }
    }

    // Zijkolom: titelblok, legende, schaal, bron.
    // Zonder zijkolom: enkel schaal en noordpijl, in een wit vak linksonder op de kaart.
    const zx = L.zonderZij ? L.kader.x + 4 : L.zijX;
    const zb = L.zonderZij ? Math.min(80, L.kader.b * 0.3) : L.zij;
    let y = L.marge;
    const tb = plan.titelblok || {};
    const blok = (hoogte) => { doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.35); doc.setLineDashPattern([], 0); doc.rect(zx, y, zb, hoogte); };
    const groot = L.pb >= 800 ? 1.4 : L.pb >= 590 ? 1.2 : 1;

    // Titelblok
    const tRegels = [
      ['Locatie', plan.locatie], ['Datum', tb.datum], ['Tekenaar', tb.tekenaar],
      ['Versie', `${plan.versie} · ${new Date().toLocaleDateString('nl-BE')}`], ['Fase', fase?.naam], ['Blad', blad?.label],
    ].filter(([, w]) => w);
    const org = [tb.organisatie, tb.ondernemingsnummer, ...(String(tb.adres || '').split('\n'))].filter(Boolean);
    // Compacte weergave op de kaart: kies voor elk vak de hoek met de minste items eronder.
    const hoekVrij = (() => {
      if (!L.zonderZij) return null;
      const pts = [];
      for (const it of zichtbaar) {
        const g = it.geometrie; if (!g) continue;
        const cs = g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates[0] : [];
        let vorige = null;
        for (const c of cs) {
          const q = og.project(c);
          if (vorige) { const d = Math.hypot(q[0] - vorige[0], q[1] - vorige[1]); const n = Math.min(60, Math.floor(d / 3)); for (let k = 1; k < n; k++) pts.push([vorige[0] + ((q[0] - vorige[0]) * k) / n, vorige[1] + ((q[1] - vorige[1]) * k) / n]); }
          pts.push(q); vorige = q;
        }
      }
      const m = 5; const bezetHoek = new Set();
      return (w, h, voorkeur) => {
        const plek = { lb: [kader.x + m, kader.y + m], rb: [kader.x + kader.b - m - w, kader.y + m], lo: [kader.x + m, kader.y + kader.h - m - h], ro: [kader.x + kader.b - m - w, kader.y + kader.h - m - h] };
        let beste = null;
        for (const k of voorkeur) {
          if (bezetHoek.has(k)) continue;
          const [x, y] = plek[k]; const n = pts.filter(([px, py]) => px >= x - 2 && px <= x + w + 2 && py >= y - 2 && py <= y + h + 2).length;
          if (!beste || n < beste.n) beste = { k, n, x, y };
        }
        bezetHoek.add(beste.k); return beste;
      };
    })();
    const kaartje = (x, y, w, h) => {
      doc.setGState(GS(0.9)); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 1.2, 1.2, 'F'); doc.setGState(GS(1));
      doc.setDrawColor(210, 210, 206); doc.setLineWidth(0.15); doc.setLineDashPattern([], 0); doc.roundedRect(x, y, w, h, 1.2, 1.2, 'S');
    };
    if (inst.titelblok !== false && L.zonderZij) {
      const k = L.pb >= 800 ? 1.25 : L.pb >= 590 ? 1.1 : 1;
      const titelT = [plan.editie_naam, plan.naam, inst.titel].filter(Boolean).join(' – ');
      const meta1 = [plan.locatie, tb.datum, fase?.naam, blad?.label].filter(Boolean).join('  ·  ');
      const meta2 = [`v${plan.versie} · ${new Date().toLocaleDateString('nl-BE')}`, tb.tekenaar, tb.organisatie].filter(Boolean).join('  ·  ');
      const maxW = Math.min(150 * k, kader.b * 0.42);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5 * k);
      const titel = doc.splitTextToSize(titelT, maxW - 8).slice(0, 2);
      const tw = Math.max(...titel.map((r) => doc.getTextWidth(r)));
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6 * k);
      const mw = Math.max(doc.getTextWidth(meta1), doc.getTextWidth(meta2));
      const w = Math.min(maxW, Math.max(tw, mw, 30) + 8);
      const h = 5.5 * k + titel.length * 4.2 * k + (meta1 ? 3.4 * k : 0) + 3.4 * k + 2.5;
      const pl = hoekVrij(w, h, ['rb', 'lb', 'ro', 'lo']);
      kaartje(pl.x, pl.y, w, h);
      let ty = pl.y + 4 * k;
      doc.setTextColor(225, 29, 72); doc.setFont('helvetica', 'bold'); doc.setFontSize(6 * k); doc.text(merkKort(), pl.x + 4, ty, { baseline: 'middle' });
      ty += 3.6 * k; doc.setTextColor(29, 29, 27); doc.setFontSize(9.5 * k);
      titel.forEach((r) => { doc.text(r, pl.x + 4, ty, { baseline: 'middle' }); ty += 4.2 * k; });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6 * k); doc.setTextColor(90, 94, 100);
      ty -= 0.6 * k;
      if (meta1) { doc.text(doc.splitTextToSize(meta1, w - 8)[0], pl.x + 4, ty, { baseline: 'middle' }); ty += 3.4 * k; }
      doc.text(doc.splitTextToSize(meta2, w - 8)[0], pl.x + 4, ty, { baseline: 'middle' });
    }
    if (inst.titelblok !== false && !L.zonderZij) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5 * groot);
    const titel = doc.splitTextToSize([plan.editie_naam, plan.naam, inst.titel].filter(Boolean).join(' – '), zb - 8).slice(0, 2);
    const tbH = 16 * groot + (titel.length > 1 ? 4 * groot : 0) + tRegels.length * 4.2 * groot + (org.length ? 4 + org.length * 3.8 * groot : 0) + 4;
    blok(tbH);
    doc.setTextColor(29, 29, 27);
    if (logo) {
      const lh = 5.2 * groot; const lw = Math.min(zb - 8, lh * logo.ratio);
      try { doc.addImage(logo.data, 'PNG', zx + 4, y + 1.6 * groot, lw, lw / logo.ratio); } catch { doc.setFontSize(8 * groot); doc.text(merkKort(), zx + 4, y + 6 * groot); }
    } else { doc.setFontSize(8 * groot); doc.text(merkKort(), zx + 4, y + 6 * groot); }
    doc.setFontSize(10.5 * groot);
    doc.text(titel, zx + 4, y + 11 * groot);
    let ty = y + 16 * groot + (titel.length > 1 ? 4 * groot : 0);
    doc.setFontSize(7.5 * groot);
    for (const [k, w] of tRegels) {
      doc.setFont('helvetica', 'bold'); doc.text(k, zx + 4, ty);
      doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(String(w), zb - 30)[0], zx + 24 * groot, ty);
      ty += 4.2 * groot;
    }
    if (org.length) {
      ty += 2;
      doc.setFont('helvetica', 'bold'); doc.text('Organisatie', zx + 4, ty);
      doc.setFont('helvetica', 'normal');
      org.forEach((r, i) => doc.text(String(r), zx + 24 * groot, ty + i * 3.8 * groot));
    }
    y += tbH + 4;
    }

    let indexRest = []; // ook buiten de zijkolom nodig (vervolgpagina)
    if (!L.zonderZij) {
    // Revisietabel
    const revs = inst.titelblok === false ? [] : (inst.revisies || []).slice(0, 5);
    if (revs.length) {
      const lh = 3.8 * groot;
      const rh = 7 * groot + revs.length * lh + 2;
      blok(rh);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5 * groot); doc.setTextColor(29, 29, 27);
      doc.text('Revisies', zx + 4, y + 4.8 * groot);
      doc.setFontSize(6.5 * groot);
      revs.forEach((r, i) => {
        const ry = y + 7 * groot + lh / 2 + i * lh;
        doc.setFont('helvetica', 'bold'); doc.text(`v${r.versie}`, zx + 4, ry, { baseline: 'middle' });
        doc.setFont('helvetica', 'normal'); doc.text(new Date(r.created_at).toLocaleDateString('nl-BE'), zx + 12 * groot, ry, { baseline: 'middle' });
        doc.text(doc.splitTextToSize(r.opmerking || '', zb - 34 * groot)[0] || '', zx + 30 * groot, ry, { baseline: 'middle' });
      });
      y += rh + 4;
    }

    // Bladwijzer bij een bladindeling
    if (blad?.kol > 1 || blad?.rij > 1) {
      const cel = Math.min(6 * groot, (zb - 30) / blad.kol);
      const bh = 8 * groot + blad.rij * cel + 2;
      blok(bh);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5 * groot); doc.setTextColor(29, 29, 27);
      doc.text('Bladindeling', zx + 4, y + 4.8 * groot);
      doc.setFontSize(5.5 * groot);
      for (let j = 0; j < blad.rij; j++) for (let i = 0; i < blad.kol; i++) {
        const cx = zx + 4 + i * cel; const cy = y + 7 * groot + j * cel;
        const hier = i === blad.i && j === blad.j;
        doc.setFillColor(...(hier ? [225, 29, 72] : [255, 255, 255])); doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.2);
        doc.rect(cx, cy, cel, cel, 'FD');
        doc.setTextColor(...(hier ? [255, 255, 255] : [29, 29, 27]));
        doc.text(`${letters(i)}${j + 1}`, cx + cel / 2, cy + cel / 2, { align: 'center', baseline: 'middle' });
      }
      doc.setTextColor(29, 29, 27);
      y += bh + 4;
    }

    // Legende
    if (inst.legende !== false) {
      const gebruikt = lagen.filter((l) => printLagen.has(l.id) && zichtbaar.some((i) => i.laag_id === l.id));
      const elementen = [...new Set(zichtbaar.filter((i) => i.element_id).map((i) => i.element_id))].map((id) => elementenMap.get(id)).filter(Boolean);
      // Toebehoren die op dit blad staan, één rij per symbool.
      const tbRijen = [];
      if (tbTonen) {
        const gezien = new Set();
        for (const it of zichtbaar) {
          const el = it.element_id ? elementenMap.get(it.element_id) : null;
          const tel = el ? toebehorenTelling(it, el) : null;
          for (const k of Object.keys(tel || {})) {
            const a = toebehorenVan(el).find((x) => x.k === String(k).split('@')[0]);
            if (!a || a.soort === 'geen') continue;
            const sl = `${a.soort}|${a.naam}`;
            if (!gezien.has(sl)) { gezien.add(sl); tbRijen.push(a); }
          }
        }
      }
      // Doeken per hek die op dit blad gebruikt worden.
      const doekRijen = inst.doek === false ? [] : [...new Set(zichtbaar.flatMap((i) => [...(Array.isArray(i.velden?.doeken) ? i.velden.doeken : []), ...totemPanelen(i), ...(Array.isArray(i.velden?.vlaggen) ? i.velden.vlaggen : []), i.velden?.ontwerp].filter(Boolean)))].map((id) => elementenMap.get(id)).filter(Boolean);
      const lh = 4.4 * groot;
      // Past alles niet, dan eerst de doeken en toebehoren weg, dan de elementen inkorten: nooit een lege legende.
      const maxRegels = Math.floor((L.ph - L.marge - 40 - y - 8 * groot - 2) / lh);
      if (gebruikt.length + elementen.length + tbRijen.length + doekRijen.length > maxRegels) { doekRijen.length = 0; tbRijen.length = 0; }
      if (gebruikt.length + elementen.length > maxRegels) elementen.splice(Math.max(0, maxRegels - gebruikt.length));
      if (gebruikt.length > maxRegels) gebruikt.splice(Math.max(0, maxRegels));
      const regels = gebruikt.length + elementen.length + tbRijen.length + doekRijen.length;
      const legH = 8 * groot + regels * lh + 2;
      if (regels > 0) {
        blok(legH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5 * groot); doc.setTextColor(29, 29, 27);
        doc.text('Legende', zx + 4, y + 5.5 * groot);
        let ly = y + 8 * groot + lh / 2;
        doc.setFontSize(7 * groot);
        for (const l of gebruikt) {
          const s = effectieveStijl(null, l, null);
          doc.setFillColor(...hex(l.kleur)); doc.setDrawColor(...hex(l.kleur)); doc.setLineWidth(0.4);
          doc.setLineDashPattern(STREPEN[s.streep] ? STREPEN[s.streep].map((v) => v * 0.6) : [], 0);
          doc.setGState(GS(0.35)); doc.rect(zx + 4, ly - 1.4 * groot, 6 * groot, 2.8 * groot, 'F'); doc.setGState(GS(1));
          doc.rect(zx + 4, ly - 1.4 * groot, 6 * groot, 2.8 * groot);
          doc.setLineDashPattern([], 0);
          doc.setFont('helvetica', 'normal'); doc.text(l.naam, zx + 12 * groot, ly, { baseline: 'middle' });
          ly += lh;
        }
        for (const e of elementen) {
          const s = effectieveStijl(null, null, e);
          const dk = inst.doek !== false && e.tekenwijze === 'lijn' ? doekVan(e) : null;
          if (dk) {
            // Band van het doek onder de lijn, zoals op de kaart.
            doc.setLineDashPattern([], 0);
            if (dk.soort === 'wit') { doc.setDrawColor(...hex(dk.rand)); doc.setLineWidth(2.4); doc.line(zx + 4, ly, zx + 10 * groot, ly); doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.7); doc.line(zx + 4, ly, zx + 10 * groot, ly); }
            else { doc.setGState(GS(dk.dekking)); doc.setDrawColor(...hex(dk.kleur)); doc.setLineWidth(2.4); doc.line(zx + 4, ly, zx + 10 * groot, ly); doc.setGState(GS(1)); }
          }
          doc.setDrawColor(...hex(s.kleur)); doc.setLineWidth(0.6); doc.setLineDashPattern(STREPEN[s.streep] ? STREPEN[s.streep].map((v) => v * 0.6) : [], 0);
          if (e.tekenwijze === 'lijn') doc.line(zx + 4, ly, zx + 10 * groot, ly);
          else if (e.tekenwijze === 'punt') { doc.setFillColor(...hex(s.kleur)); doc.circle(zx + 7 * groot, ly, 1.2, 'F'); }
          else doc.rect(zx + 4, ly - 1.4 * groot, 6 * groot, 2.8 * groot);
          doc.setLineDashPattern([], 0);
          const namen = doekVan(e)?.soort === 'bedrukt' ? [...new Set(zichtbaar.filter((i) => i.element_id === e.id && i.velden?.doek_naam).map((i) => i.velden.doek_naam))] : [];
          doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(`${e.naam}${namen.length ? `: ${namen.join(', ')}` : ''}`, zb - 16 * groot)[0], zx + 12 * groot, ly, { baseline: 'middle' });
          ly += lh;
        }
        for (const d of doekRijen) {
          doc.setGState(GS(0.7)); doc.setFillColor(...hex(d.eigenschappen?.kleur || '#E11D48')); doc.rect(zx + 4, ly - 1.2 * groot, 6 * groot, 2.4 * groot, 'F'); doc.setGState(GS(1));
          doc.setFont('helvetica', 'normal'); doc.setTextColor(29, 29, 27); doc.text(doc.splitTextToSize(`${{ totem: 'Paneel', vlag: 'Vlag', truss: 'Truss-doek' }[d.eigenschappen?.drager] || 'Doek'}: ${d.naam}`, zb - 16 * groot)[0], zx + 12 * groot, ly, { baseline: 'middle' });
          ly += lh;
        }
        for (const a of tbRijen) {
          const cx = zx + 7 * groot;
          doc.setLineDashPattern([], 0); doc.setDrawColor(29, 29, 27); doc.setFillColor(29, 29, 27);
          if (a.soort === 'klem') doc.rect(cx - 0.9, ly - 0.9, 1.8, 1.8, 'F');
          else if (a.soort === 'schoor') { doc.setLineWidth(0.5); doc.line(cx - 2.4, ly - 1.2, cx + 2.4, ly - 1.2); doc.line(cx, ly - 1.2, cx, ly + 1.2); doc.rect(cx - 0.9, ly + 0.9, 1.8, 0.8, 'F'); }
          else if (a.soort === 'driehoek') { doc.setLineWidth(0.4); doc.line(cx - 2.2, ly + 1.2, cx + 2.2, ly + 1.2); doc.line(cx - 2.2, ly + 1.2, cx, ly - 1.4); doc.line(cx + 2.2, ly + 1.2, cx, ly - 1.4); }
          else if (a.soort === 'wiel') { doc.setLineWidth(0.4); doc.setFillColor(255, 255, 255); doc.circle(cx, ly, 1.1, 'FD'); }
          else if (a.soort === 'paal') { doc.setFillColor(120, 53, 15); doc.circle(cx, ly, 0.9, 'F'); }
          else if (a.soort === 'blok') { doc.setFillColor(138, 109, 59); doc.rect(cx - 1.1, ly - 1.1, 2.2, 2.2, 'F'); }
          doc.setFont('helvetica', 'normal'); doc.text(a.naam, zx + 12 * groot, ly, { baseline: 'middle' });
          ly += lh;
        }
        y += legH + 4;
      }
    }

    // Index van het rasterplan
    indexRest = [];
    if (vakken && inst.raster?.index !== false) {
      const regels = zichtbaar.filter((i) => i.naam && i.soort !== 'tekst').map((i) => {
        const [x, yy] = og.project(geo.middelpunt(i.geometrie));
        const c = Math.floor((x - kader.x) / vakken.vak);
        const r = Math.floor((yy - kader.y) / vakken.vakH);
        if (c < 0 || r < 0 || c >= vakken.kol || r >= vakken.rij) return null;
        return { naam: i.naam, vak: `${letters(c)}${r + 1}`, kleur: lagenMap.get(i.laag_id)?.kleur || '#686D76' };
      }).filter(Boolean).sort((a, b) => a.naam.localeCompare(b.naam));
      const lh = 3.8 * groot;
      const beschikbaar = L.ph - L.marge - 34 * groot - y - 8;
      const past = Math.max(0, Math.floor((beschikbaar - 8 * groot) / lh));
      const hier = regels.slice(0, past);
      indexRest = regels.slice(past);
      if (hier.length) {
        const ih = 8 * groot + hier.length * lh + 2;
        blok(ih);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5 * groot); doc.setTextColor(29, 29, 27);
        doc.text('Index', zx + 4, y + 5.5 * groot);
        doc.setFontSize(6.8 * groot);
        hier.forEach((r, i) => {
          const ry = y + 8 * groot + lh / 2 + i * lh;
          doc.setFillColor(...hex(r.kleur)); doc.rect(zx + 4, ry - 1, 2, 2, 'F');
          doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(r.naam, zb - 24)[0], zx + 8, ry, { baseline: 'middle' });
          doc.setFont('helvetica', 'bold'); doc.text(r.vak, zx + zb - 4, ry, { align: 'right', baseline: 'middle' });
        });
        y += ih + 4;
      }
    }

    }

    if (L.zonderZij) {
      // Subtiel: schaalbalk, schaal, noordpijl en bron in een klein vak in een vrije onderhoek.
      const k = L.pb >= 800 ? 1.15 : 1;
      const doelM = (28 * k / 1000) * schaal;
      const mooi = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].reduce((a, b) => (b <= doelM ? b : a), 1);
      const lenMm = (mooi / schaal) * 1000;
      const bron = [bronvermelding(ondergrond, centrum), metToolen() ? 'Toolen Maps' : null].filter(Boolean).join(' · ');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6 * k);
      const bronR = doc.splitTextToSize(bron, 95 * k).slice(0, 2);
      const bw = Math.max(lenMm + 20 * k, Math.max(...bronR.map((r) => doc.getTextWidth(r))) + 12 * k);
      const bh = 10.5 * k + bronR.length * 2 * k;
      const pl = hoekVrij(bw, bh, ['lo', 'ro', 'lb', 'rb']);
      kaartje(pl.x, pl.y, bw, bh);
      const bx = pl.x + 3; const by = pl.y + 3.2 * k;
      doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.15);
      for (let i = 0; i < 4; i++) { doc.setFillColor(...(i % 2 === 0 ? [29, 29, 27] : [255, 255, 255])); doc.rect(bx + (i * lenMm) / 4, by, lenMm / 4, 1, 'FD'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2 * k); doc.setTextColor(29, 29, 27);
      doc.text(`${mooi} m`, bx + lenMm + 1.5, by + 0.6, { baseline: 'middle' });
      doc.setFont('helvetica', 'bold'); doc.text(`1:${schaal.toLocaleString('nl-BE')}${inst.papier !== 'vrij' ? ` · ${inst.papier}` : ''}`, bx, by + 4.4 * k, { baseline: 'middle' });
      const nx = pl.x + bw - 4.5 * k; const ny = pl.y + 2.2 * k;
      doc.setFillColor(29, 29, 27); doc.triangle(nx, ny, nx + 1.6 * k, ny + 4.2 * k, nx - 1.6 * k, ny + 4.2 * k, 'F');
      doc.setFontSize(4.8 * k); doc.text('N', nx, ny + 6.2 * k, { align: 'center', baseline: 'middle' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6 * k); doc.setTextColor(120, 124, 130);
      bronR.forEach((r, i) => doc.text(r, bx, pl.y + 9.6 * k + i * 2 * k, { baseline: 'middle' }));
    }
    // Schaal, noordpijl en bron onderaan de zijkolom.
    if (!L.zonderZij) {
    const onder = L.zonderZij ? L.kader.y + L.kader.h - 4 : L.ph - L.marge;
    const sb = 34 * groot;
    const sy = onder - sb;
    doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.35); doc.setFillColor(255, 255, 255); doc.rect(zx, sy, zb, sb, L.zonderZij ? 'FD' : 'S');
    const doelMm = Math.min(zb - 30, 50);
    const doelM = (doelMm / 1000) * schaal;
    const mooi = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].reduce((a, b) => (b <= doelM ? b : a), 1);
    const lenMm = (mooi / schaal) * 1000;
    const bx = zx + 4; const by = sy + 9 * groot;
    for (let i = 0; i < 4; i++) {
      doc.setFillColor(...(i % 2 === 0 ? [29, 29, 27] : [255, 255, 255]));
      doc.rect(bx + (i * lenMm) / 4, by, lenMm / 4, 1.6, 'FD');
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5 * groot); doc.setTextColor(29, 29, 27);
    doc.text('0', bx, by + 4.5 * groot, { align: 'center' });
    doc.text(`${mooi} m`, bx + lenMm, by + 4.5 * groot, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8 * groot);
    doc.text(`Schaal 1:${schaal.toLocaleString('nl-BE')}${inst.papier !== 'vrij' ? ` op ${inst.papier}` : ''}`, bx, sy + 5 * groot);
    // Noordpijl
    const nx = zx + zb - 9 * groot; const ny = sy + 5 * groot;
    doc.setFillColor(29, 29, 27);
    doc.triangle(nx, ny, nx + 3 * groot, ny + 8 * groot, nx - 3 * groot, ny + 8 * groot, 'F');
    doc.setFontSize(7 * groot); doc.text('N', nx, ny + 12 * groot, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8 * groot); doc.setTextColor(104, 109, 118);
    const bron = [bronvermelding(ondergrond, centrum), metToolen() ? 'Gemaakt met Toolen Maps' : null].filter(Boolean).join(' · ');
    doc.text(doc.splitTextToSize(bron, zb - 8), zx + 4, sy + sb - 7 * groot);
    }

    // Hekkenlijnen met doek per hek: label L1, L2 … bij het begin, voor de doekenlijst.
    const doekLijnen = inst.doekenlijst !== false && inst.doek !== false
      ? zichtbaar.filter((i) => Array.isArray(i.velden?.doeken) && i.velden.doeken.some(Boolean) && (elementenMap.get(i.element_id)?.eigenschappen?.doek === 'bedrukt' || isVlagHek(elementenMap.get(i.element_id))) && i.geometrie?.type === 'LineString')
      : [];
    doekLijnen.forEach((it, k) => {
      const [x, y] = og.project(it.geometrie.coordinates[0]);
      if (x < kader.x || x > kader.x + kader.b || y < kader.y || y > kader.y + kader.h) return;
      const t = `L${k + 1}`;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      const w = doc.getTextWidth(t) + 2.4;
      doc.setFillColor(29, 29, 27); doc.rect(x - w / 2, y - 6.2, w, 4, 'F');
      doc.setTextColor(255, 255, 255); doc.text(t, x, y - 4.2, { align: 'center', baseline: 'middle' });
    });

    // Extra pagina: rest van de index en de stuklijst.
    const stuk = inst.stuklijst ? berekenStuklijst(zichtbaar, elementenMap, lagenMap, null, plan?.instellingen?.leveranciers || null) : null;
    if ((!blad || blad.laatste) && (indexRest.length || (stuk && stuk.elementen.length))) {
      doc.addPage([L.pb, L.ph], L.pb >= L.ph ? 'landscape' : 'portrait');
      let py = L.marge + 6;
      doc.setTextColor(29, 29, 27); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text([plan.editie_naam, plan.naam].filter(Boolean).join(' – '), L.marge, py);
      py += 10;
      const kolom = (titel, rijen, x, breedte) => {
        let yy = py;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(titel, x, yy); yy += 6;
        doc.setFontSize(9);
        for (const [a, b] of rijen) {
          if (yy > L.ph - L.marge) break;
          doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(a, breedte - 30)[0], x, yy);
          doc.setFont('helvetica', 'bold'); doc.text(String(b), x + breedte, yy, { align: 'right' });
          doc.setDrawColor(232, 232, 230); doc.setLineWidth(0.2); doc.line(x, yy + 1.6, x + breedte, yy + 1.6);
          yy += 5.4;
        }
      };
      const helft = (L.pb - 3 * L.marge) / 2;
      if (stuk && stuk.elementen.length) kolom('Stuklijst', stuk.elementen.map((e) => [`${e.naam}${e.tekenwijze === 'lijn' ? ` (${geo.getal(e.meter)} m)` : ''}`, e.aantal]), L.marge, Math.min(helft, 140));
      if (indexRest.length) kolom('Index (vervolg)', indexRest.map((r) => [r.naam, r.vak]), L.marge * 2 + Math.min(helft, 140), Math.min(helft, 140));
    }

    // Doekenlijst: per hekkenlijn welk doek op welk hek, om af te vinken bij het ophangen.
    if ((!blad || blad.laatste) && doekLijnen.length) {
      const beelden = new Map();
      for (const id of new Set(doekLijnen.flatMap((i) => i.velden.doeken.filter(Boolean)))) {
        const pad = elementenMap.get(id)?.eigenschappen?.beeld;
        if (pad) { try { beelden.set(id, await naarDataUrl(publiekeUrl(pad))); } catch {} }
      }
      doc.addPage([L.pb, L.ph], L.pb >= L.ph ? 'landscape' : 'portrait');
      let py = L.marge + 6;
      const nieuweBlz = () => { doc.addPage([L.pb, L.ph], L.pb >= L.ph ? 'landscape' : 'portrait'); py = L.marge + 6; };
      doc.setTextColor(29, 29, 27); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text(`Doekenlijst · ${[plan.editie_naam, plan.naam].filter(Boolean).join(' – ')}`, L.marge, py); py += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(104, 109, 118);
      doc.text('Hekken tellen vanaf het label L1, L2 … op het plan. Vink af wat hangt.', L.marge, py); py += 8;
      const breed = Math.min(L.pb - 2 * L.marge, 190);
      doekLijnen.forEach((it, k) => {
        const el = elementenMap.get(it.element_id);
        const runs = doekRuns(it, elementenMap);
        if (py + 14 > L.ph - L.marge) nieuweBlz();
        doc.setTextColor(29, 29, 27); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.setFillColor(29, 29, 27); doc.rect(L.marge, py - 4, 9, 5.4, 'F');
        doc.setTextColor(255, 255, 255); doc.text(`L${k + 1}`, L.marge + 4.5, py - 1.3, { align: 'center', baseline: 'middle' });
        doc.setTextColor(29, 29, 27);
        doc.text(`${it.naam || el?.naam || 'Hekken'} · ${doekenPerHek(it, el).length} hekken${lagenMap.get(it.laag_id) ? ` · ${lagenMap.get(it.laag_id).naam}` : ''}`, L.marge + 12, py);
        py += 6;
        doc.setFontSize(9.5);
        for (const r of runs) {
          if (py + 9 > L.ph - L.marge) nieuweBlz();
          const d = r.id ? elementenMap.get(r.id) : null;
          const img = r.id ? beelden.get(r.id) : null;
          if (img) { try { doc.addImage(img, /^data:image\/png/.test(img) ? 'PNG' : 'JPEG', L.marge + 12, py - 4.6, 14, 7); } catch { doc.setFillColor(...hex(d?.eigenschappen?.kleur || '#E11D48')); doc.rect(L.marge + 12, py - 4.6, 14, 7, 'F'); } }
          else if (d) { doc.setFillColor(...hex(d.eigenschappen?.kleur || '#E11D48')); doc.rect(L.marge + 12, py - 4.6, 14, 7, 'F'); }
          else { doc.setDrawColor(185, 188, 193); doc.setLineWidth(0.3); doc.rect(L.marge + 12, py - 4.6, 14, 7); }
          doc.setFont('helvetica', 'bold'); doc.setTextColor(29, 29, 27);
          doc.text(r.van === r.tot ? `Hek ${r.van}` : `Hek ${r.van}–${r.tot}`, L.marge + 30, py);
          doc.setFont('helvetica', 'normal');
          doc.text(`${r.naam}${d?.eigenschappen?.afmeting ? `  (${d.eigenschappen.afmeting})` : ''}`, L.marge + 56, py);
          doc.text(`${r.tot - r.van + 1}×`, L.marge + breed - 16, py, { align: 'right' });
          doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.3); doc.rect(L.marge + breed - 9, py - 3.6, 4.4, 4.4);
          doc.setDrawColor(232, 232, 230); doc.setLineWidth(0.2); doc.line(L.marge + 12, py + 3.4, L.marge + breed, py + 3.4);
          py += 9;
        }
        py += 4;
      });
      // Totaal per doek
      const tot = new Map();
      for (const it of doekLijnen) for (const id of doekenPerHek(it, elementenMap.get(it.element_id))) if (id) tot.set(id, (tot.get(id) || 0) + 1);
      if (py + 10 > L.ph - L.marge) nieuweBlz();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(29, 29, 27); doc.text('Totaal per doek', L.marge, py); py += 6;
      doc.setFontSize(9.5);
      for (const [id, n] of [...tot].sort((a, b) => b[1] - a[1])) {
        if (py + 6 > L.ph - L.marge) nieuweBlz();
        const d = elementenMap.get(id);
        doc.setFillColor(...hex(d?.eigenschappen?.kleur || '#E11D48')); doc.rect(L.marge, py - 3.2, 4, 4, 'F');
        doc.setFont('helvetica', 'normal'); doc.text(d?.naam || '?', L.marge + 7, py);
        doc.setFont('helvetica', 'bold'); doc.text(String(n), L.marge + 90, py, { align: 'right' });
        py += 6;
      }
    }

    voortgang('');
    // Eigen bovenlaag (bv. nummers van een stroomdossier) met dezelfde projectie als de kaart.
    if (typeof inst.erbij === 'function') { const n = doc.getNumberOfPages(); doc.setPage(kaartBlz); await inst.erbij({ doc, project: og.project, kader, schaal, L }); doc.setPage(n); }
    return { doc, schaal, meldingen, dpi: og.dpi };
  } finally {
    og.map.remove();
    og.doos.remove();
  }
}


// Bladindeling: een groot gebied op vaste schaal over meerdere bladen.
export async function maakBladen({ plan, lagen, items, elementenMap, fase, inst, voortgang = () => {}, stap = null }) {
  const L = indeling(inst);
  const printLagen = new Set(lagen.filter((l) => l.printbaar && (inst.lagen ? inst.lagen.includes(l.id) : l.zichtbaar)).map((l) => l.id));
  const zichtbaar = items.filter((it) => !it.verborgen && !it.velden?.binnen && (!it.laag_id || printLagen.has(it.laag_id)) && (!fase || !it.fase_ids?.length || it.fase_ids.includes(fase.id)));
  const b = geo.kader(zichtbaar.map((i) => i.geometrie));
  if (!b) throw new Error('Geen items om af te drukken.');
  const schaal = inst.schaal;
  if (!schaal) throw new Error('Kies een vaste schaal voor een bladindeling.');
  const kb = (L.kader.b / 1000) * schaal * 0.95;
  const kh = (L.kader.h / 1000) * schaal * 0.95;
  const M = { units: 'meters' };
  const breed = turf.distance([b[0], b[3]], [b[2], b[3]], M);
  const hoog = turf.distance([b[0], b[1]], [b[0], b[3]], M);
  const kol = Math.max(1, Math.ceil(breed / kb));
  const rij = Math.max(1, Math.ceil(hoog / kh));
  if (kol * rij > 40) throw new Error(`Dat worden ${kol * rij} bladen. Kies een kleinere schaal of een groter papier.`);
  // Linksboven van het geheel, zodat de bladen het gebied centraal afdekken.
  const midden = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const west = turf.destination(midden, (kol * kb) / 2, -90, M).geometry.coordinates;
  const nw = turf.destination(west, (rij * kh) / 2, 0, M).geometry.coordinates;
  let doc = null;
  const meldingen = [];
  for (let j = 0; j < rij; j++) {
    for (let i = 0; i < kol; i++) {
      const n = j * kol + i + 1;
      voortgang(`Blad ${n} van ${kol * rij}…`); stap?.(n - 1, kol * rij, `Blad ${n} van ${kol * rij}`);
      const oost = turf.destination(nw, (i + 0.5) * kb, 90, M).geometry.coordinates;
      const centrum = turf.destination(oost, (j + 0.5) * kh, 180, M).geometry.coordinates;
      const r = await maakPdf({ plan, lagen, items, elementenMap, fase, inst: { ...inst, centrum }, voortgang: () => {}, doc, blad: { label: `${letters(i)}${j + 1} (${n}/${kol * rij})`, kol, rij, i, j, laatste: n === kol * rij } });
      doc = r.doc;
      for (const m of r.meldingen) if (!meldingen.includes(m)) meldingen.push(m);
    }
  }
  return { doc, schaal, meldingen, bladen: kol * rij };
}
