'use client';

// Leverfiche als PDF (A4 staand): kop met leverancier en site, daarna de regels per levermoment.
import { jsPDF } from 'jspdf';
import { leverficheGroepen, eindeTekst, aantalTekst } from './bestelling';

export function maakLeverfichePdf({ plan, leverancier, organisatie, wat, regels, vast }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 14, R = 196; let y = 18;
  const pagina = (nodig) => { if (y + nodig > 284) { doc.addPage(); y = 18; } };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(`Leverfiche · ${plan.naam || ''}`, L, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
  const van = plan.wedstrijd_van ? new Date(`${plan.wedstrijd_van}T12:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  doc.text([van && `Wedstrijd ${van}`, plan.locatie, `versie van ${new Date().toLocaleDateString('nl-BE')}`, !vast && 'voorlopig: de bestelling staat nog niet vast'].filter(Boolean).join(' · '), L, y); y += 7;
  doc.setTextColor(255); doc.setFillColor(17, 17, 17); doc.rect(L, y, R - L, 9, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(`${String(leverancier || '').toUpperCase()}${organisatie ? ` · via ${organisatie}` : ''}`, L + 3, y + 6.2);
  if (wat) doc.text(String(wat), R - 3, y + 6.2, { align: 'right' });
  y += 14; doc.setTextColor(0);
  const kol = [{ t: 'Aantal', x: L, w: 20, r: true }, { t: 'Omschrijving', x: L + 23, w: 70 }, { t: 'Groep', x: L + 95, w: 22 }, { t: 'Locatie', x: L + 119, w: 34 }, { t: 'Ophaling of afbraak', x: L + 155, w: 27 }];
  for (const g of leverficheGroepen(plan, regels)) {
    pagina(22);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(g.titel, L, y); y += 2; doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 5;
    doc.setFontSize(8.5); doc.setTextColor(90); for (const k of kol) doc.text(k.t, k.r ? k.x + k.w : k.x, y, k.r ? { align: 'right' } : undefined); doc.setTextColor(0); y += 4.5;
    for (const r of g.rijen) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const cellen = [aantalTekst(r), r.wat, r.groep, r.locatie, eindeTekst(plan, r.oph)];
      const lijnen = cellen.map((c, i) => doc.splitTextToSize(String(c || ''), kol[i].w));
      const opm = r.opmerking ? doc.splitTextToSize(r.opmerking, kol[1].w) : [];
      const h = Math.max(...lijnen.map((x) => x.length), 1) * 4.6 + opm.length * 4 + 2.5;
      pagina(h);
      lijnen.forEach((x, i) => { doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.text(x, kol[i].r ? kol[i].x + kol[i].w : kol[i].x, y, kol[i].r ? { align: 'right' } : undefined); });
      if (opm.length) { doc.setFontSize(8.5); doc.setTextColor(90); doc.text(opm, kol[1].x, y + lijnen[1].length * 4.6); doc.setTextColor(0); }
      y += h - 1.5; doc.setLineWidth(0.1); doc.line(L, y - 2.2, R, y - 2.2); y += 1.5;
    }
    y += 5;
  }
  if (!regels.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Nog geen regels in deze bestelling.', L, y); }
  return doc;
}
