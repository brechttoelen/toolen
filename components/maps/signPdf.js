'use client';

// Signalisatie-PDF: voorblad met overzichtskaart, 4 punten per A4 (kaartuitsnede,
// kijkrichting, de borden met hun pijl) en de bestellijst.
import maplibregl from 'maplibre-gl';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { basisStijl, registreerProtocollen, drukbaar, bronvermelding } from './ondergronden';
import { kader as bbox } from './geo';
import { isSign, instSign, bestellijst, KANTEN, BEVESTIGING } from './signalisatie';
import { bordSvg, svgNaarPng, naarDataUrl, LOGO_URL } from './bord';


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
  const map = new maplibregl.Map({ container: doos, style: basisStijl(ondergrond), center: centrum, zoom: 17, interactive: false, pixelRatio: 1, preserveDrawingBuffer: true, attributionControl: false, fadeDuration: 0 });
  await new Promise((ok) => map.once('load', ok));
  return {
    map,
    async beeld() {
      await wachtIdle(map);
      try { return map.getCanvas().toDataURL('image/jpeg', 0.85); } catch { return null; }
    },
    weg() { map.remove(); doos.remove(); },
  };
}

function tekenMarker(doc, x, y, nr, richting, metRichting) {
  if (metRichting) {
    const r = ((richting || 0) * Math.PI) / 180;
    const rot = ([a, b]) => [x + a * Math.cos(r) - b * Math.sin(r), y + a * Math.sin(r) + b * Math.cos(r)];
    // Wig achter het punt, in de rijrichting.
    const pts = [[0, -9], [3.2, -3], [-3.2, -3]].map(rot);
    doc.setFillColor(225, 29, 72);
    doc.triangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], 'F');
  }
  doc.setFillColor(225, 29, 72); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
  doc.circle(x, y, 3.2, 'FD');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text(String(nr ?? ''), x, y + 1.1, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

export async function signalisatiePdf({ plan, items, voortgang = () => {} }) {
  const inst = instSign(plan);
  const bestMap = new Map(inst.bestemmingen.map((b) => [b.id, b]));
  let logoSrc = null;
  if (inst.logo) { try { logoSrc = await naarDataUrl(LOGO_URL); } catch {} }
  const beelden = new Map();
  for (const bb of inst.bestemmingen) { if ((bb.soort === 'beeld' || bb.soort === 'set') && bb.beeld) { try { beelden.set(bb.id, await naarDataUrl(bb.beeld)); } catch {} } }
  const punten = items.filter((i) => isSign(i) && i.geometrie?.type === 'Point')
    .sort((a, b) => (Number(a.velden.sign.nr) || 0) - (Number(b.velden.sign.nr) || 0));
  if (!punten.length) throw new Error('Er zijn nog geen signalisatiepunten.');
  const b = bbox(punten.map((p) => p.geometrie));
  const centrum = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const og = drukbaar('luchtfoto', centrum) ? 'luchtfoto' : drukbaar('lijntekening', centrum) ? 'lijntekening' : 'leeg';
  const meldingen = [];
  if (og === 'leeg') meldingen.push('Geen drukbare luchtfoto voor deze plek: de kaartjes zijn zonder ondergrond.');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = 210; const H = 297; const m = 10;

  // ---------- Voorblad ----------
  voortgang('Overzichtskaart…');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Signalisatieplan', m, 22);
  doc.setFontSize(13); doc.text(plan.naam, m, 30);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(104, 109, 118);
  doc.text([plan.editie_naam, plan.locatie, `versie ${plan.versie}`, new Date().toLocaleDateString('nl-BE')].filter(Boolean).join(' · '), m, 36);
  doc.setTextColor(0, 0, 0);
  try {
    const qr = await QRCode.toDataURL(`${window.location.origin}/maps/${plan.id}`, { margin: 0, width: 240 });
    doc.addImage(qr, 'PNG', W - m - 24, 12, 24, 24);
    doc.setFontSize(6.5); doc.text('Digitaal plan', W - m - 12, 39, { align: 'center' });
  } catch {}
  const ovB = W - 2 * m; const ovH = 150; const ovY = 44;
  const ovPx = [Math.round(ovB * 7), Math.round(ovH * 7)];
  const ov = await kaartMaker(og, ovPx[0], ovPx[1], centrum);
  try {
    ov.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, maxZoom: 18, duration: 0 });
    const beeld = await ov.beeld();
    if (beeld) doc.addImage(beeld, 'JPEG', m, ovY, ovB, ovH, undefined, 'FAST');
    else if (og !== 'leeg') meldingen.push('De kaartdienst liet de ondergrond niet toe in de PDF (CORS).');
    doc.setDrawColor(29, 29, 27); doc.setLineWidth(0.3); doc.rect(m, ovY, ovB, ovH);
    for (const p of punten) {
      const q = ov.map.project(p.geometrie.coordinates);
      tekenMarker(doc, m + (q.x / ovPx[0]) * ovB, ovY + (q.y / ovPx[1]) * ovH, p.velden.sign.nr, p.velden.sign.richting, p.velden.sign.richting != null);
    }
  } finally { ov.weg(); }
  doc.setFontSize(6.5); doc.setTextColor(104, 109, 118);
  doc.text(bronvermelding(og, centrum) || '', m, ovY + ovH + 4);
  doc.setTextColor(0, 0, 0);
  // Inhoud: lijst van de punten.
  let y = ovY + ovH + 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`${punten.length} punten`, m, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  const kol = 3; const kb = (W - 2 * m) / kol;
  punten.forEach((p, i) => {
    const r = Math.floor(i / kol); const k = i % kol;
    const yy = y + r * 4.5;
    if (yy > H - 12) return;
    doc.text(`${p.velden.sign.nr}. ${p.velden.sign.straat || p.naam || ''} (${(p.velden.sign.rijen || []).length})`.slice(0, 48), m + k * kb, yy);
  });

  // ---------- Punten, 4 per blad ----------
  const bw = (W - 2 * m - 6) / 2; const bh = (H - 2 * m - 12) / 2;
  const kh = 62;
  const px = [Math.round(bw * 9), Math.round(kh * 9)];
  const km = await kaartMaker(og, px[0], px[1], centrum);
  try {
    for (let i = 0; i < punten.length; i++) {
      const p = punten[i];
      const s = p.velden.sign;
      if (i % 4 === 0) {
        doc.addPage();
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(`${plan.naam} · signalisatie`, m, m + 2);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(104, 109, 118);
        doc.text(`versie ${plan.versie}`, W - m, m + 2, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }
      voortgang(`Punt ${i + 1} van ${punten.length}…`);
      const j = i % 4;
      const x0 = m + (j % 2) * (bw + 6);
      const y0 = m + 8 + Math.floor(j / 2) * (bh + 4);
      doc.setDrawColor(218, 221, 227); doc.setLineWidth(0.2); doc.rect(x0, y0, bw, bh);
      // Kop
      doc.setFillColor(225, 29, 72); doc.rect(x0, y0, 12, 10, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text(String(s.nr ?? ''), x0 + 6, y0 + 7, { align: 'center' });
      doc.setTextColor(0, 0, 0); doc.setFontSize(10);
      doc.text((s.straat || p.naam || 'Punt').slice(0, 40), x0 + 15, y0 + 4.8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(104, 109, 118);
      doc.text(`${KANTEN.find(([k]) => k === (s.kant || 'rechts'))?.[1] || ''} · ${BEVESTIGING.find(([k]) => k === (s.bevestiging || 'heras'))?.[1] || ''} · ${p.geometrie.coordinates[1].toFixed(5)}, ${p.geometrie.coordinates[0].toFixed(5)}`, x0 + 15, y0 + 8.6);
      doc.setTextColor(0, 0, 0);
      // Kaartje
      const ky = y0 + 12;
      km.map.jumpTo({ center: p.geometrie.coordinates, zoom: 18.6, bearing: 0 });
      const beeld = await km.beeld();
      if (beeld) doc.addImage(beeld, 'JPEG', x0 + 2, ky, bw - 4, kh, undefined, 'FAST');
      doc.setDrawColor(29, 29, 27); doc.rect(x0 + 2, ky, bw - 4, kh);
      tekenMarker(doc, x0 + 2 + (bw - 4) / 2, ky + kh / 2, s.nr, s.richting, s.richting != null);
      // Borden zoals ze er echt uitzien
      let py = ky + kh + 4;
      const rijen = s.rijen || [];
      const ruimte = bh - (py - y0) - 2;
      const perRij = ruimte / Math.max(1, rijen.length) - 1.5;
      for (const r of rijen) {
        const bst = bestMap.get(r.bestemming_id);
        const { svg, w: sw, h: sh } = bordSvg({ best: bst, pijl: r.pijl, type: inst.bord, logo: inst.logo, logoSrc, beeldSrc: beelden.get(r.bestemming_id) || (bst?.soort === 'beeld' || bst?.soort === 'set' ? '' : undefined) });
        const bbH = Math.min(perRij, ((bw - 8) * sh) / sw);
        const bbB = (bbH * sw) / sh;
        try {
          const png = await svgNaarPng(svg, Math.round(bbB * 6), Math.round(bbH * 6));
          doc.addImage(png, 'PNG', x0 + (bw - bbB) / 2, py, bbB, bbH, undefined, 'FAST');
        } catch { doc.setFontSize(8); doc.text(bst?.naam || '?', x0 + 4, py + 4); }
        py += bbH + 1.5;
      }
      if (!rijen.length) { doc.setFontSize(8); doc.setTextColor(104, 109, 118); doc.text('Geen panelen.', x0 + 4, py + 3); doc.setTextColor(0, 0, 0); }
    }
  } finally { km.weg(); }

  // ---------- Bestellijst ----------
  const lijst = bestellijst(items, inst.bestemmingen, inst.reserve, inst.bord);
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Bestellijst signalisatie', m, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(104, 109, 118);
  doc.text(`${lijst.punten} punten · reserve ${Math.round(inst.reserve * 100)} %`, m, 26);
  doc.setTextColor(0, 0, 0);
  y = 36;
  const rij = (a, b2, c, vet) => { doc.setFont('helvetica', vet ? 'bold' : 'normal'); doc.text(a, m, y); doc.text(String(b2), 140, y, { align: 'right' }); doc.text(String(c), 190, y, { align: 'right' }); y += 6; };
  doc.setFontSize(9); rij('Omschrijving', 'Nodig', 'Bestellen', true);
  doc.setDrawColor(29, 29, 27); doc.line(m, y - 4, W - m, y - 4);
  for (const pnl of lijst.panelen) rij(`Bord ${pnl.naam}`, pnl.stuks, Math.ceil(pnl.stuks * (1 + inst.reserve)));
  for (const x of lijst.bevestiging) rij(`Bevestiging ${x.soort}`, x.n, x.n);

  return { doc, meldingen };
}
