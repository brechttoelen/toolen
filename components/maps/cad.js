'use client';

// Tekst van een CAD-bestand: een DXF rechtstreeks, een DWG via de server (die geeft DXF-tekst terug).
export const isCad = (naam) => /\.(dxf|dwg)$/i.test(naam || '');
export async function cadTekst(bestand) {
  if (!/\.dwg$/i.test(bestand.name)) return bestand.text();
  if (bestand.size > 4 * 1024 * 1024) throw new Error('Deze DWG is groter dan 4 MB. Bewaar ze in je CAD-programma als DXF, of zet overbodige lagen uit.');
  const r = await fetch('/api/cad/dwg', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bestand });
  if (!r.ok) { let m = 'Deze DWG kon niet gelezen worden.'; try { const j = await r.json(); m = j.fout || j.error || j.melding || m; } catch {} throw new Error(m); }
  return r.text();
}
