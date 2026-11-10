// Wegafsluitingen: de lijst voor de politievergunning, als Excel (CSV) of PDF.
import { middelpunt, lengte } from './geo';

export const AFS = { volledig: 'Volledig afgesloten', plaatselijk: 'Plaatselijk verkeer', eenrichting: 'Eenrichting', parkeerverbod: 'Parkeerverbod' };
export const afsluitingenVan = (items) => items.filter((i) => i.velden?.afsluiting?.soort && i.geometrie);
const tijd = (t) => (t ? new Date(t).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' }) : '');

export function afsluitingenCsv(plan, items) {
  const r = [['Straat', 'Soort', 'Van', 'Tot', 'Lengte (m)', 'Naam', 'Breedtegraad', 'Lengtegraad']];
  for (const i of afsluitingenVan(items)) {
    const a = i.velden.afsluiting; const m = middelpunt(i.geometrie) || [];
    r.push([a.straat || '', AFS[a.soort] || a.soort, tijd(a.van), tijd(a.tot), i.geometrie.type === 'LineString' ? Math.round(lengte(i.geometrie)) : '', i.naam || '', m[1]?.toFixed(6) || '', m[0]?.toFixed(6) || '']);
  }
  const blob = new Blob(['﻿' + r.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Wegafsluitingen - ${plan.naam}.csv`; a.click();
}

export async function afsluitingenPdf(plan, items) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(`Wegafsluitingen · ${plan.naam}`, 12, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text([plan.editie_naam, plan.locatie, `versie ${plan.versie}`].filter(Boolean).join(' · '), 12, 22);
  let y = 32;
  const kol = [12, 82, 132, 172, 212, 240];
  doc.setFont('helvetica', 'bold'); ['Straat', 'Soort', 'Van', 'Tot', 'Lengte', 'Opmerking'].forEach((t, k) => doc.text(t, kol[k], y)); y += 6;
  doc.setFont('helvetica', 'normal');
  for (const i of [...afsluitingenVan(items)].sort((a, b) => String(a.velden.afsluiting.van || '').localeCompare(String(b.velden.afsluiting.van || '')))) {
    if (y > 195) { doc.addPage(); y = 16; }
    const a = i.velden.afsluiting;
    [a.straat || i.naam || '', AFS[a.soort] || a.soort, tijd(a.van), tijd(a.tot), i.geometrie.type === 'LineString' ? `${Math.round(lengte(i.geometrie))} m` : '', (i.notitie || '').slice(0, 40)].forEach((t, k) => doc.text(String(t).slice(0, 40), kol[k], y));
    doc.setDrawColor(232, 232, 230); doc.line(12, y + 2, 285, y + 2); y += 7;
  }
  doc.save(`Wegafsluitingen - ${plan.naam}.pdf`.replace(/[\\/:*?"<>|]/g, ''));
}
