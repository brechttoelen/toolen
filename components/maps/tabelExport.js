'use client';

// Tabellen als echt Excel-bestand (.xlsx) of als PDF, voor bestel- en leverlijsten.
// xlsx: zelf opgebouwd (SpreadsheetML in een zip via jszip): vette kop, kop vastgezet, filter, kolombreedtes,
// getallen als getal en links als hyperlink. PDF: jsPDF, A4, kop met plan en leverancier, tabel over meerdere pagina's.
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const kolNaam = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const isGetal = (v) => typeof v === 'number' && Number.isFinite(v);
const isLink = (v) => typeof v === 'string' && /^https?:\/\//.test(v);

function blad(rijen, kopRijen) {
  const n = Math.max(...rijen.map((r) => r.length));
  const breed = Array.from({ length: n }, (_, c) => Math.min(60, Math.max(8, ...rijen.map((r) => (isLink(r[c]) ? 14 : String(r[c] ?? '').length + 2)))));
  const links = [];
  const xml = rijen.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = `${kolNaam(ci)}${ri + 1}`; const kop = ri < kopRijen;
    if (v === '' || v == null) return '';
    if (isGetal(v)) return `<c r="${ref}"${kop ? ' s="1"' : ''}><v>${v}</v></c>`;
    if (isLink(v)) { links.push([ref, v]); return `<c r="${ref}" t="inlineStr" s="2"><is><t>Kaart</t></is></c>`; }
    return `<c r="${ref}" t="inlineStr"${kop ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const laatste = `${kolNaam(n - 1)}${rijen.length}`;
  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0">${kopRijen ? `<pane ySplit="${kopRijen}" topLeftCell="A${kopRijen + 1}" activePane="bottomLeft" state="frozen"/>` : ''}</sheetView></sheetViews>
<cols>${breed.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${xml}</sheetData>
${kopRijen && rijen.length > kopRijen ? `<autoFilter ref="A${kopRijen}:${laatste}"/>` : ''}
${links.length ? `<hyperlinks>${links.map(([ref], i) => `<hyperlink ref="${ref}" r:id="rId${i + 1}"/>`).join('')}</hyperlinks>` : ''}
</worksheet>`,
    rels: links.length ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links.map(([, url], i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(url)}" TargetMode="External"/>`).join('')}</Relationships>` : null,
  };
}

// bladen: [{ naam, rijen: [[...kop], [...], ...] }] — de eerste rij is de kop.
export async function maakXlsx(bladen) {
  const zip = new JSZip();
  const namen = bladen.map((b, i) => (String(b.naam || `Blad ${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Blad ${i + 1}`));
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${bladen.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${namen.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${bladen.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${bladen.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEDEB"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);
  bladen.forEach((b, i) => {
    const { xml, rels } = blad(b.rijen, b.rijen.length ? 1 : 0);
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml);
    if (rels) zip.file(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, rels);
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// PDF-tabel. kop: { titel, regels: [..] }, rijen: eerste rij = kolomkoppen. breedtes: relatief per kolom.
// rechts: kolomindexen die rechts uitlijnen (aantallen). groepen: rijen die met een naam beginnen en geen andere
// waarden hebben, worden als tussenkop getoond.
export function maakPdf({ titel, regels = [], rijen, breedtes, rechts = [], liggend = false }) {
  const doc = new jsPDF({ orientation: liggend ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight(); const M = 14;
  const [kop, ...data] = rijen;
  const som = (breedtes || kop.map(() => 1)).reduce((a, b) => a + b, 0);
  const bw = (breedtes || kop.map(() => 1)).map((b) => (b / som) * (W - 2 * M));
  let y = M;
  const voet = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120); doc.text(`${titel} · pagina ${doc.getNumberOfPages()}`, M, H - 7); doc.text(new Date().toLocaleDateString('nl-BE'), W - M, H - 7, { align: 'right' }); doc.setTextColor(0); };
  doc.setFillColor(225, 29, 72); doc.rect(M, y, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(titel, M + 5, y + 3); y += 9;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80);
  for (const r of regels.filter(Boolean)) { const l = doc.splitTextToSize(String(r), W - 2 * M); doc.text(l, M, y); y += l.length * 4.4; }
  doc.setTextColor(0); y += 3;
  const kopRij = () => {
    doc.setFillColor(237, 237, 235); doc.rect(M, y, W - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); let x = M;
    kop.forEach((k, i) => { doc.text(String(k), rechts.includes(i) ? x + bw[i] - 2 : x + 2, y + 4.8, { align: rechts.includes(i) ? 'right' : 'left' }); x += bw[i]; });
    y += 7; doc.setFont('helvetica', 'normal');
  };
  kopRij();
  for (const r of data) {
    const tussen = r.length && r.slice(1).every((v) => v === '' || v == null);
    doc.setFontSize(tussen ? 9 : 8.5); doc.setFont('helvetica', tussen ? 'bold' : 'normal');
    const cel = tussen ? [doc.splitTextToSize(String(r[0]), W - 2 * M - 4)] : r.map((v, i) => doc.splitTextToSize(String(v ?? ''), bw[i] - 4));
    const h = Math.max(...cel.map((c) => c.length)) * 3.8 + 2.6 + (tussen ? 1.5 : 0);
    if (y + h > H - 14) { voet(); doc.addPage(); y = M; kopRij(); doc.setFontSize(8.5); doc.setFont('helvetica', tussen ? 'bold' : 'normal'); }
    let x = M;
    if (tussen) doc.text(cel[0], M + 2, y + 5);
    else cel.forEach((c, i) => { doc.text(c, rechts.includes(i) ? x + bw[i] - 2 : x + 2, y + 4.2, { align: rechts.includes(i) ? 'right' : 'left' }); x += bw[i]; });
    y += h; doc.setDrawColor(225); doc.line(M, y, W - M, y);
  }
  voet();
  return doc.output('blob');
}

export function bewaarBestand(blob, naam) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = naam.replace(/[\\/:*?"<>|]/g, ''); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
