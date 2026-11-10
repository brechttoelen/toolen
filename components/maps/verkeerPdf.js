'use client';

// Signalisatieplan verkeer (voor politie en stad): A3-kaart met enkel de verkeerslaag,
// legende met de gebruikte borden, dan per bord een regel (nr, bord, onderbord, straat,
// datum en uur) en de stuklijst.
import maplibregl from 'maplibre-gl';
import { jsPDF } from 'jspdf';
import { basisStijl, registreerProtocollen, drukbaar, bronvermelding } from './ondergronden';
import { kader as bbox } from './geo';
import { svgNaarPng } from './bord';
import {
  instVerkeer, isVerkeer, verkeerGroepen, verkeerStuklijst, bordSvg, onderbordSvg, icoonSleutel, bordOmschrijving, bordNaam,
  onderbordTekst, periodeTekst, lengteVan, aantalE1, aantalNadars, straatBij, SOORTEN,
} from './verkeer';
import * as turf from '@turf/turf';

const M = { units: 'meters' };
const bestandsnaam = (t) => t.replace(/[\\/:*?"<>|]/g, '');

function wachtIdle(map, ms = 25000) {
  return new Promise((ok) => {
    let klaar = false;
    const t = setTimeout(() => { if (!klaar) { klaar = true; ok(false); } }, ms);
    const check = () => { if (!klaar && map.loaded() && map.areTilesLoaded()) { klaar = true; clearTimeout(t); ok(true); } };
    map.once('idle', check);
    setTimeout(check, 400);
  });
}
async function kaartMaker(ondergrond, w, h, centrum) {
  registreerProtocollen();
  const doos = document.createElement('div');
  Object.assign(doos.style, { position: 'fixed', left: '-100000px', top: '0', width: `${w}px`, height: `${h}px` });
  document.body.appendChild(doos);
  const map = new maplibregl.Map({ container: doos, style: basisStijl(ondergrond), center: centrum, zoom: 16, interactive: false, pixelRatio: 1, preserveDrawingBuffer: true, attributionControl: false, fadeDuration: 0 });
  await new Promise((ok) => { if (map.style?._loaded) { ok(); return; } const t = setTimeout(ok, 15000); map.once('load', () => { clearTimeout(t); ok(); }); const h = () => { if (map.style?._loaded) { clearTimeout(t); map.off('styledata', h); ok(); } }; map.on('styledata', h); });
  return { map, async beeld() { await wachtIdle(map); try { return map.getCanvas().toDataURL('image/jpeg', 0.85); } catch { return null; } }, weg() { map.remove(); doos.remove(); } };
}

const LIJNKLEUR = { parkeerverbod: [0, 87, 184], afsluiting: [200, 16, 46], omleiding: [180, 83, 9] };
const pngCache = new Map();
async function bordBeeld(sleutel) {
  if (!pngCache.has(sleutel)) pngCache.set(sleutel, svgNaarPng(bordSvg(sleutel, 100), 160, 160).catch(() => null));
  return pngCache.get(sleutel);
}
// Bord (met wig voor de kijkrichting en nummer) op de kaart.
async function tekenBord(doc, x, y, v, mm = 7) {
  if (v.kijkrichting != null) {
    const r = ((Number(v.kijkrichting) || 0) * Math.PI) / 180;
    const rot = ([a, b]) => [x + a * Math.cos(r) - b * Math.sin(r), y + a * Math.sin(r) + b * Math.cos(r)];
    const pts = [[0, -mm * 1.1], [mm * 0.4, -mm * 0.45], [-mm * 0.4, -mm * 0.45]].map(rot);
    doc.setFillColor(225, 29, 72); doc.triangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], 'F');
  }
  const png = await bordBeeld(icoonSleutel(v));
  if (png) doc.addImage(png, 'PNG', x - mm / 2, y - mm / 2, mm, mm, undefined, 'FAST');
  if (v.nr != null && v.nr !== '') {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(29, 29, 27);
    const t = String(v.nr); const w = doc.getTextWidth(t) + 1.2;
    doc.setFillColor(255, 255, 255); doc.rect(x - w / 2, y + mm / 2 + 0.3, w, 2.6, 'F');
    doc.text(t, x, y + mm / 2 + 2.3, { align: 'center' });
  }
}

export async function verkeersplanPdf({ plan, items, voortgang = () => {} }) {
  const inst = instVerkeer(plan);
  const lijst = items.filter((i) => isVerkeer(i) && !i.verborgen && i.geometrie);
  if (!lijst.length) throw new Error('Er is nog geen verkeerssignalisatie.');
  const g = verkeerGroepen(lijst);
  const stuk = verkeerStuklijst(lijst, inst);
  const b = bbox(lijst.map((p) => p.geometrie));
  const centrum = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const og = drukbaar('lijntekening', centrum) ? 'lijntekening' : drukbaar('luchtfoto', centrum) ? 'luchtfoto' : 'leeg';
  const meldingen = [];
  if (og === 'leeg') meldingen.push('Geen drukbare ondergrond voor deze plek: de kaart is zonder ondergrond.');

  // Straatnamen die nog ontbreken (Nominatim, 1 per seconde).
  const straten = new Map();
  const zonder = g.bord.filter((it) => !it.velden.verkeer.straat);
  for (const [i, it] of zonder.entries()) {
    voortgang(`Straat ${i + 1} van ${zonder.length}…`);
    const s = await straatBij(it.geometrie.coordinates);
    if (s) straten.set(it.id, s);
  }
  const straatVan = (it) => it.velden.verkeer.straat || straten.get(it.id) || '';

  // ---------- Blad 1: kaart A3 liggend ----------
  voortgang('Kaart…');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  const W = 420; const H = 297; const m = 12;
  const zij = 92;
  const kx = m; const ky = m + 12; const kb = W - 2 * m - zij - 6; const kh = H - ky - m - 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Signalisatieplan verkeer', m, m + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(104, 109, 118);
  doc.text([plan.editie_naam, plan.naam, plan.locatie, `versie ${plan.versie}`, new Date().toLocaleDateString('nl-BE'), periodeTekst(inst.van, inst.tot)].filter(Boolean).join(' · '), m, m + 10);
  doc.setTextColor(0, 0, 0);
  const px = [Math.round(kb * 6), Math.round(kh * 6)];
  const km = await kaartMaker(og, px[0], px[1], centrum);
  try {
    km.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 90, maxZoom: 18, duration: 0 });
    const beeld = await km.beeld();
    if (beeld) doc.addImage(beeld, 'JPEG', kx, ky, kb, kh, undefined, 'FAST');
    else if (og !== 'leeg') meldingen.push('De kaartdienst liet de ondergrond niet toe in de PDF (CORS).');
    const proj = (c) => { const q = km.map.project(c); return [kx + (q.x / px[0]) * kb, ky + (q.y / px[1]) * kh]; };
    doc.saveGraphicsState(); doc.rect(kx, ky, kb, kh, null); doc.clip(); doc.discardPath();
    // Lijnen
    for (const soort of ['omleiding', 'parkeerverbod', 'afsluiting']) {
      for (const it of g[soort]) {
        const pts = it.geometrie.coordinates.map(proj);
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(soort === 'afsluiting' ? 3 : 2.2); doc.setLineDashPattern([], 0);
        doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'S');
        doc.setDrawColor(...LIJNKLEUR[soort]); doc.setLineWidth(soort === 'afsluiting' ? 2 : 1.3);
        if (soort === 'parkeerverbod') doc.setLineDashPattern([2, 1.5], 0);
        doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'S');
        doc.setLineDashPattern([], 0);
      }
    }
    // E1 om de N m, C3 bij elke afsluiting, dan de losse borden.
    for (const it of g.parkeerverbod) {
      const lijn = turf.lineString(it.geometrie.coordinates); const L = turf.length(lijn, M);
      const stap = Number(it.velden.verkeer.interval) || inst.interval; const n = aantalE1(it, stap);
      for (let i = 0; i < n; i++) { const [x, y] = proj(turf.along(lijn, Math.min(L, i * stap), M).geometry.coordinates); await tekenBord(doc, x, y, { bord: 'E1' }, 3.2); }
    }
    for (const it of g.afsluiting) {
      const lijn = turf.lineString(it.geometrie.coordinates); const L = turf.length(lijn, M);
      const [x, y] = proj(turf.along(lijn, L / 2, M).geometry.coordinates);
      await tekenBord(doc, x, y, { bord: 'C3', nr: `${aantalNadars(it)}× nadar` }, 5);
    }
    for (const it of g.bord) { const [x, y] = proj(it.geometrie.coordinates); await tekenBord(doc, x, y, it.velden.verkeer); }
    doc.restoreGraphicsState();
    doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.4); doc.rect(kx, ky, kb, kh);
  } finally { km.weg(); }
  doc.setFontSize(6.5); doc.setTextColor(104, 109, 118);
  doc.text(bronvermelding(og, centrum) || '', kx, ky + kh + 4);
  doc.setTextColor(0, 0, 0);

  // Legende rechts: gebruikte borden met aantal, lijnsoorten, cijfers.
  const zx = W - m - zij; let y = ky;
  doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Legende', zx, y + 4); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  for (const r of stuk.borden) {
    if (y > H - m - 30) break;
    const png = await bordBeeld(r.sleutel);
    if (png) doc.addImage(png, 'PNG', zx, y, 6, 6, undefined, 'FAST');
    doc.text(doc.splitTextToSize(`${r.naam} – ${bordNaam(r.sleutel.split('-')[0])}`, zij - 20)[0], zx + 8, y + 4);
    doc.setFont('helvetica', 'bold'); doc.text(String(r.n), zx + zij, y + 4, { align: 'right' }); doc.setFont('helvetica', 'normal');
    y += 7.5;
  }
  y += 2;
  for (const [soort, naam] of [['afsluiting', 'Afsluiting (nadars)'], ['parkeerverbod', 'Parkeerverbod'], ['omleiding', 'Omleiding']]) {
    if (!g[soort].length) continue;
    doc.setDrawColor(...LIJNKLEUR[soort]); doc.setLineWidth(1.2); doc.setLineDashPattern(soort === 'parkeerverbod' ? [2, 1.5] : [], 0);
    doc.line(zx, y + 2.5, zx + 6, y + 2.5); doc.setLineDashPattern([], 0);
    doc.text(naam, zx + 8, y + 3.5); doc.setFont('helvetica', 'bold'); doc.text(String(g[soort].length), zx + zij, y + 3.5, { align: 'right' }); doc.setFont('helvetica', 'normal');
    y += 6;
  }
  y += 3;
  doc.setFillColor(225, 29, 72); doc.triangle(zx + 3, y, zx + 5.4, y + 4, zx + 0.6, y + 4, 'F');
  doc.text('Wig = kijkrichting van het bord', zx + 8, y + 3.5); y += 8;
  doc.setFontSize(7); doc.setTextColor(104, 109, 118);
  for (const t of doc.splitTextToSize(`${stuk.totaal} borden · ${stuk.onderborden.reduce((t2, o) => t2 + o.n, 0)} onderborden · ${stuk.nadars} nadars (2,5 m). Nummers verwijzen naar de tabel. Opgemaakt met Toolen Maps; goedkeuring door de wegbeheerder.`, zij)) { doc.text(t, zx, y + 3); y += 3.6; }
  doc.setTextColor(0, 0, 0);

  // ---------- Blad 2+: tabel per bord ----------
  voortgang('Tabel…');
  doc.addPage('a4', 'portrait');
  const PW = 210; const PH = 297; const pm = 12; let ty = 18;
  const nieuwBlad = (h = 8) => { if (ty + h > PH - 14) { doc.addPage('a4', 'portrait'); ty = 18; } };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Verkeerssignalisatie – overzicht', pm, ty); ty += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(104, 109, 118);
  doc.text([plan.naam, plan.locatie, `versie ${plan.versie}`, new Date().toLocaleDateString('nl-BE')].filter(Boolean).join(' · '), pm, ty); ty += 8;
  doc.setTextColor(0, 0, 0);
  const kol = [pm, pm + 8, pm + 18, pm + 52, pm + 112, pm + 158];
  const tabelKop = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    ['Nr', '', 'Bord', 'Onderbord', 'Straat', 'Kijkt naar'].forEach((t, i) => doc.text(t, kol[i], ty));
    doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.3); doc.line(pm, ty + 1.5, PW - pm, ty + 1.5); ty += 6;
    doc.setFont('helvetica', 'normal');
  };
  const windstreek = (h) => ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'][Math.round((((Number(h) || 0) % 360) + 360) % 360 / 45) % 8];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`Borden · ${g.bord.length}`, pm, ty); ty += 5;
  tabelKop();
  for (const it of g.bord) {
    const v = it.velden.verkeer;
    const ob = onderbordTekst(v).replace(/\n/g, ' ');
    const obRegels = doc.splitTextToSize(ob || '–', 56); const stRegels = doc.splitTextToSize(straatVan(it) || '–', 44);
    const h = Math.max(obRegels.length, stRegels.length) * 3.6 + 2.5;
    nieuwBlad(h + 2); if (ty === 18) { tabelKop(); }
    const png = await bordBeeld(icoonSleutel(v));
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text(String(v.nr ?? ''), kol[0], ty + 3); doc.setFont('helvetica', 'normal');
    if (png) doc.addImage(png, 'PNG', kol[1], ty - 0.5, 5, 5, undefined, 'FAST');
    doc.text(doc.splitTextToSize(`${bordOmschrijving(v)} – ${bordNaam(v.bord)}`, 32), kol[2], ty + 3);
    doc.text(obRegels, kol[3], ty + 3);
    doc.text(stRegels, kol[4], ty + 3);
    doc.text(v.kijkrichting != null ? `${windstreek(v.kijkrichting)} (${Math.round(v.kijkrichting)}°)` : '–', kol[5], ty + 3);
    doc.text(`${it.geometrie.coordinates[1].toFixed(5)}, ${it.geometrie.coordinates[0].toFixed(5)}`, kol[5], ty + 6.6);
    ty += Math.max(h, 7.5);
    doc.setDrawColor(230, 230, 228); doc.setLineWidth(0.15); doc.line(pm, ty - 1, PW - pm, ty - 1);
  }
  if (!g.bord.length) { doc.setFontSize(8.5); doc.text('Geen losse borden.', pm, ty); ty += 6; }
  for (const soort of ['parkeerverbod', 'afsluiting', 'omleiding']) {
    if (!g[soort].length) continue;
    ty += 6; nieuwBlad(16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`${SOORTEN[soort]} · ${g[soort].length}`, pm, ty); ty += 5;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    for (const it of g[soort]) {
      nieuwBlad(8);
      const v = it.velden.verkeer; const L = Math.round(lengteVan(it));
      const c = it.geometrie.coordinates[0];
      const wat = soort === 'parkeerverbod' ? `${aantalE1(it, Number(v.interval) || inst.interval)} × E1 om de ${Number(v.interval) || inst.interval} m · ${onderbordTekst({ ...v, onderbord: v.onderbord || 'periode' }) || 'zonder datum'}`
        : soort === 'afsluiting' ? `${aantalNadars(it)} nadars · C3${onderbordTekst(v) ? ` + ${onderbordTekst(v).replace(/\n/g, ' ')}` : ''}`
          : `${g.bord.filter((x) => x.velden.verkeer.auto?.omleiding_id === it.id).length} × F41${v.tekst ? ` "${v.tekst}"` : ''}`;
      doc.setFont('helvetica', 'bold'); doc.text(doc.splitTextToSize(it.naam || SOORTEN[soort].replace(/en$/, ''), 40)[0], pm, ty); doc.setFont('helvetica', 'normal');
      doc.text(`${L} m`, pm + 44, ty);
      doc.text(doc.splitTextToSize(wat, 100)[0], pm + 58, ty);
      doc.setFontSize(6.5); doc.setTextColor(104, 109, 118); doc.text(`begin ${c[1].toFixed(5)}, ${c[0].toFixed(5)}`, pm + 58, ty + 3.2); doc.setTextColor(0, 0, 0); doc.setFontSize(8);
      ty += 7.5;
    }
  }
  // Stuklijst
  ty += 8; nieuwBlad(30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Stuklijst', pm, ty); ty += 5;
  doc.setFontSize(8); doc.text('Omschrijving', pm, ty); doc.text('Aantal', PW - pm, ty, { align: 'right' }); doc.line(pm, ty + 1.5, PW - pm, ty + 1.5); ty += 6;
  doc.setFont('helvetica', 'normal');
  for (const r of stuk.borden) { nieuwBlad(); doc.text(`Bord ${r.naam} – ${bordNaam(r.sleutel.split('-')[0])}`, pm, ty); doc.text(String(r.n), PW - pm, ty, { align: 'right' }); ty += 4.6; }
  for (const o of stuk.onderborden) { nieuwBlad(); doc.text(`Onderbord "${o.tekst.replace(/\n/g, ' ')}"`, pm, ty); doc.text(String(o.n), PW - pm, ty, { align: 'right' }); ty += 4.6; }
  // Voorbeeld van de onderborden (hoe ze eruitzien)
  if (stuk.onderborden.length) {
    ty += 6; nieuwBlad(24);
    doc.setFont('helvetica', 'bold'); doc.text('Onderborden', pm, ty); ty += 3; doc.setFont('helvetica', 'normal');
    let x = pm;
    for (const o of stuk.onderborden) {
      const regels = o.tekst.split('\n').length; const bw = 48; const bh = (10 + regels * 14) * (bw / 100);
      if (x + bw > PW - pm) { x = pm; ty += bh + 4; nieuwBlad(bh + 4); }
      try { const png = await svgNaarPng(onderbordSvg(o.tekst, 100), 480, Math.round(bh * 10)); doc.addImage(png, 'PNG', x, ty, bw, bh, undefined, 'FAST'); } catch {}
      x += bw + 4;
    }
  }
  doc.save(bestandsnaam(`Signalisatieplan verkeer - ${plan.naam} v${plan.versie}.pdf`));
  return meldingen;
}
