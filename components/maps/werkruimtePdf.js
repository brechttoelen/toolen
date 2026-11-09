'use client';

// PDF's van de werkruimtes: kaart op schaal (zoals "PDF op schaal") met daarna de
// discipline-eigen bladen. Stroomplan = kaart + eendraadschema + kabellijst.
// Veiligheidsplan = kaart met veiligheidslagen + tabel per tent + regels van de zone + bron.
import { maakPdf } from './pdf';
import { tentChecklist } from './veiligheid';
import { opDeGrond, afstand } from './controle';
import { relevanteItems } from './werkruimtes';
import { kader } from './geo';

const bestandsnaam = (t) => t.replace(/[\\/:*?"<>|]/g, '');

function pdfInst(plan, lagen, items, extra = {}) {
  const og = plan.basiskaart === 'stratenkaart' ? 'lijntekening' : plan.basiskaart || 'luchtfoto';
  // Midden van de zichtbare items (schaal volgt automatisch), anders het kaartmidden van het plan.
  const k = kader(items.filter((i) => !i.verborgen && i.geometrie).map((i) => i.geometrie));
  const centrum = k ? [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2] : (Array.isArray(plan.centrum) ? plan.centrum : [4.4, 50.9]);
  return { centrum, papier: 'A3', orientatie: 'liggend', schaal: null, ondergrond: og, dimmen: 0.3, legende: true, stuklijst: false, maten: false, dpi: 200, raster: { aan: false }, lagen: lagen.filter((l) => l.printbaar && l.zichtbaar).map((l) => l.id), ...(plan.instellingen?.pdf?.titelblok ? { titelblok: plan.instellingen.pdf.titelblok } : {}), ...extra };
}

// Enkel de relevante items van de werkruimte scherp; de rest blijft (gedimd) als context.
function metFocus(items, wrId, ctx) {
  const set = relevanteItems(wrId, { ...ctx, items });
  if (!set) return items;
  return items.map((it) => (set.has(it.id) ? it : { ...it, stijl: { ...(it.stijl || {}), dekking: 0.25, vuldekking: 0.05 } }));
}

// Stroomplan = stroomdossier: leverplan, benodigdheden per leverancier en per stroompunt situatie + aansluitschema.
export async function stroomplanPdf({ plan, lagen, items, elementenMap, fase, fasen = [], stroom, voortgang = () => {}, stap = null, onTegels = null }) {
  const { stroomDossierPdf } = await import('./stroomDossier');
  const { meldingen } = await stroomDossierPdf({ plan, lagen, items, elementenMap, fase, fasen, stroom, voortgang, stap, onTegels });
  return meldingen;
}

export async function veiligheidsplanPdf({ plan, lagen, items, elementenMap, lagenMap, fase, voortgang = () => {}, onTegels = null }) {
  const lijst = metFocus(items, 'veiligheid', { plan, lagenMap, elementenMap });
  const { doc, meldingen } = await maakPdf({ plan, lagen, items: lijst, elementenMap, fase, inst: pdfInst(plan, lagen, items, { titel: 'Veiligheidsplan', onTegels }), voortgang });
  voortgang('Checklist…');
  doc.addPage('a4', 'portrait');
  checklistInPdf(doc, { plan, items, elementenMap });
  doc.save(bestandsnaam(`Veiligheidsplan - ${plan.naam} v${plan.versie}.pdf`));
  return meldingen;
}

// Checklist voor de brandweer, los als A4.
export async function checklistPdf({ plan, items, elementenMap }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  checklistInPdf(doc, { plan, items, elementenMap });
  doc.save(bestandsnaam(`Checklist brandweer - ${plan.naam} v${plan.versie}.pdf`));
}

function checklistInPdf(doc, { plan, items, elementenMap }) {
  const c = tentChecklist({ plan, items, elementenMap, opDeGrond, afstand });
  const R = c.R; const z = c.ib.zone;
  const m = 14; let y = 18;
  const W = 210;
  const nieuwBlad = (h = 8) => { if (y + h > 282) { doc.addPage('a4', 'portrait'); y = 18; } };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Checklist brandveiligheid', m, y); y += 7;
  doc.setFontSize(11); doc.text(plan.naam, m, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(104, 109, 118);
  doc.text([plan.editie_naam, plan.locatie, `versie ${plan.versie}`, new Date().toLocaleDateString('nl-BE')].filter(Boolean).join(' · '), m, y); y += 8;
  doc.setTextColor(0, 0, 0);

  // Zone en regels
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(z ? `Hulpverleningszone ${z.naam}` : 'Richtwaarden (geen zone gekozen)', m, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const uit = R.uitgangen?.tabel ? R.uitgangen.tabel.map(([max, n], i, a) => `${n} ${max == null ? `vanaf ${(a[i - 1]?.[0] ?? 0) + 1}` : `tot ${max}`} p`).join(', ') + (R.uitgangen.daarna ? `, daarna +1 per ${R.uitgangen.daarna.per} p` : '') : `minstens ${R.min_uitgangen} uitgangen`;
  const regels = [
    `Uitgangen: ${uit}`, `Breedte: ${R.cm_per_persoon} cm per persoon, minimum ${R.min_breedte_uitgang_cm} cm per uitgang${R.brede_route?.vanaf_personen ? `, vanaf ${R.brede_route.vanaf_personen} p één uitgang van ${R.brede_route.breedte_cm} cm` : ''}`,
    `Afstand tot een uitgang: max. ${R.max_afstand_uitgang_m} m${R.max_afstand_tweede_m ? `, tot een tweede ${R.max_afstand_tweede_m} m` : ''}`, `Blustoestellen: 1 per ${R.blusser_per_m2} m²`,
    `Brandweer: toegang ${R.brandweer?.breedte_m} m breed en ${R.brandweer?.hoogte_m} m hoog, op max. ${R.brandweer?.max_afstand_m} m`,
    `Bezetting zonder opgave: ${R.personen_per_m2} personen per m²`,
  ];
  for (const r of regels) { doc.text(`· ${r}`, m, y); y += 4.3; }
  if (z?.bron_url) { doc.setTextColor(37, 99, 235); doc.textWithLink(`Bron: ${z.bron_url}`, m, y, { url: z.bron_url }); doc.setTextColor(0, 0, 0); y += 4.3; }
  if (z?.zonder_reglement) { doc.setTextColor(180, 83, 9); doc.text('Geen zonaal reglement gevonden: richtwaarden, te bevestigen door de brandweer.', m, y); doc.setTextColor(0, 0, 0); y += 4.3; }
  y += 4;

  // Tabel per tent
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`Tenten en publieke ruimtes · ${c.tenten.length}`, m, y); y += 5;
  const kol = [m, 70, 88, 108, 134, 160, 182];
  doc.setFontSize(8); ['Tent', 'Opp.', 'Pers.', 'Uitgangen', 'Breedte (cm)', 'Afstand (m)', 'Blussers'].forEach((t, i) => doc.text(t, kol[i], y));
  doc.setDrawColor(29, 29, 27); doc.line(m, y + 1.5, W - m, y + 1.5); y += 5.5;
  doc.setFont('helvetica', 'normal');
  const cel = (t, ok, i) => { if (ok === false) doc.setTextColor(185, 28, 28); doc.text(String(t), kol[i], y); doc.setTextColor(0, 0, 0); };
  for (const t of c.tenten) {
    nieuwBlad();
    const r = (id) => t.regels.find((x) => x.id === id);
    cel(t.naam.slice(0, 32), true, 0); cel(`${Math.round(t.opp)} m²`, true, 1); cel(t.personen, true, 2);
    cel(`${t.uitgangen.length} / ${t.nodig}`, r('uitgangen')?.ok, 3); cel(`${t.totaal} / ${t.nodigCm}`, r('breedte')?.ok, 4);
    cel(r('afstand') ? r('afstand').waarde : '–', r('afstand')?.ok ?? true, 5); cel(t.blusNodig ? `${t.blusEr} / ${t.blusNodig}` : '–', r('blussers')?.ok ?? true, 6);
    y += 4.5;
    const ontbreekt = t.regels.filter((x) => !x.ok).map((x) => `${x.label} ${x.waarde}`);
    if (ontbreekt.length) { doc.setTextColor(185, 28, 28); doc.setFontSize(7.5); doc.text(`   ontbreekt: ${ontbreekt.join(' · ')}`, m, y); doc.setFontSize(8); doc.setTextColor(0, 0, 0); y += 4; }
  }
  if (!c.tenten.length) { doc.text('Geen publieke tenten in dit plan.', m, y); y += 5; }
  y += 5;
  // Terrein
  nieuwBlad(30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Terrein', m, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const vink = (ok) => (ok ? '[x]' : '[ ]');
  const toeg = c.soort('brandweertoegang').length + c.soort('opstelplaats').length;
  for (const [ok, t] of [[toeg > 0, `Brandweertoegang of opstelplaats getekend (${toeg})`], [c.soort('verzamelplaats').length > 0, `Verzamelplaats aangeduid (${c.soort('verzamelplaats').length})`], [c.soort('vluchtweg').length > 0, `Vluchtwegen getekend (${c.soort('vluchtweg').length})`], [c.soort('blusser').length > 0, `Blustoestellen op het plan (${c.soort('blusser').length})`], [c.soort('ehbo').length + c.soort('aed').length > 0, `EHBO of AED (${c.soort('ehbo').length + c.soort('aed').length})`]]) {
    doc.text(`${vink(ok)} ${t}`, m, y); y += 4.5;
  }
  y += 6; doc.setFontSize(7.5); doc.setTextColor(104, 109, 118);
  doc.text('Hulp bij de aanvraag, geen goedkeuring: de brandweer beslist. Getekend met Toolen Maps.', m, y);
  doc.setTextColor(0, 0, 0);
}

// Brandingplan: kaart (doekenlijst per hek zit al in maakPdf) + ontwerpenoverzicht met beeld
// en aantal (drukorder) + totems en vlaggen per stuk.
export async function brandingplanPdf({ plan, lagen, items, elementenMap, lagenMap, fase, voortgang = () => {}, onTegels = null }) {
  const { brandingBestellijst, dragerOp, dragerVan } = await import('./branding');
  const { totemPanelen, TOTEM_ZIJDEN, zijdenVan } = await import('./stijl');
  const { publiekeUrl } = await import('./db');
  const lijst = metFocus(items, 'branding', { plan, lagenMap, elementenMap });
  const { doc, meldingen } = await maakPdf({ plan, lagen, items: lijst, elementenMap, fase, inst: pdfInst(plan, lagen, items, { titel: 'Brandingplan', doekenlijst: true, onTegels }), voortgang });
  voortgang('Ontwerpen…');
  const rijen = brandingBestellijst(items, elementenMap);
  const beeld = async (pad) => {
    if (!pad) return null;
    try {
      const r = await fetch(publiekeUrl(pad)); if (!r.ok) return null;
      const b = await r.blob();
      const data = await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); });
      const img = await new Promise((ok, nok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nok; i.src = data; });
      return { data, v: img.width / img.height };
    } catch { return null; }
  };
  doc.addPage('a4', 'portrait');
  const m = 14; let y = 18;
  const nieuw = (h) => { if (y + h > 284) { doc.addPage('a4', 'portrait'); y = 18; } };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(29, 29, 27); doc.text('Ontwerpen', m, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(104, 109, 118);
  doc.text([plan.naam, `versie ${plan.versie}`, new Date().toLocaleDateString('nl-BE')].join(' · '), m, y); y += 8;
  doc.setTextColor(0, 0, 0);
  let vorige = null;
  for (const r of rijen) {
    if (r.drager !== vorige) {
      nieuw(14); vorige = r.drager;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(dragerOp(r.drager).naam, m, y); y += 5;
    }
    nieuw(26);
    const d = elementenMap.get(r.id);
    const b = await beeld(d?.eigenschappen?.beeld);
    const bw = 34; const bh = 22;
    if (b) {
      const w = Math.min(bw, bh * b.v); const h = w / b.v;
      try { doc.addImage(b.data, 'JPEG', m, y, w, h); } catch {}
    } else {
      const k = (d?.eigenschappen?.kleur || '#94A3B8').replace('#', '');
      doc.setFillColor(parseInt(k.slice(0, 2), 16), parseInt(k.slice(2, 4), 16), parseInt(k.slice(4, 6), 16)); doc.rect(m, y, bw, bh, 'F');
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(r.naam, m + bw + 5, y + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(104, 109, 118);
    doc.text([r.afmeting, r.eigen ? 'alleen dit event' : 'organisatiebibliotheek'].filter(Boolean).join(' · '), m + bw + 5, y + 10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(`${r.aantal}×`, 196, y + 7, { align: 'right' });
    y += bh + 4;
  }
  if (!rijen.length) { doc.setFontSize(9); doc.text('Nog geen ontwerpen toegewezen.', m, y); y += 6; }
  // Totems en vlaggen per stuk.
  const dragers = items.filter((it) => !it.verborgen && (['totem', 'vlag', 'truss', 'frame'].includes(dragerVan(elementenMap.get(it.element_id))) || (Array.isArray(it.velden?.vlaggen) && it.velden.vlaggen.some(Boolean))));
  if (dragers.length) {
    nieuw(16); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Totems, vlaggen en truss', m, y); y += 6;
    doc.setFontSize(8.5);
    for (const it of dragers) {
      const el = elementenMap.get(it.element_id);
      const t = dragerVan(el) === 'totem' || dragerVan(el) === 'truss' || dragerVan(el) === 'frame';
      const regels = Array.isArray(it.velden?.vlaggen) && it.velden.vlaggen.some(Boolean) && !t && dragerVan(el) !== 'vlag' ? it.velden.vlaggen.map((id, k) => (id ? `vlag aan hek ${k + 1}: ${elementenMap.get(id)?.naam || '?'}` : null)).filter(Boolean) : t ? totemPanelen(it, el).map((id, k) => `${k + 1} ${(zijdenVan(el)[k] || TOTEM_ZIJDEN[k]).toLowerCase()}: ${id ? elementenMap.get(id)?.naam || '?' : '– leeg –'}`) : [`ontwerp: ${it.velden?.ontwerp ? elementenMap.get(it.velden.ontwerp)?.naam || '?' : '– leeg –'}`];
      nieuw(6 + regels.length * 4.3);
      doc.setFont('helvetica', 'bold'); doc.text(`${it.naam || el.naam}${lagenMap.get(it.laag_id) ? ` · ${lagenMap.get(it.laag_id).naam}` : ''}`, m, y); y += 4.5;
      doc.setFont('helvetica', 'normal');
      for (const r of regels) { doc.text(`   ${r}`, m, y); y += 4.3; }
      y += 1.5;
    }
  }
  doc.save(bestandsnaam(`Brandingplan - ${plan.naam} v${plan.versie}.pdf`));
  return meldingen;
}
