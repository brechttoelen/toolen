// Exporteren: profielen en bestanden. Zie Uitvoer.jsx voor het scherm.
import { naarKml, naarGeojsonBestand, download } from './uitwisseling';
import { effectieveStijl } from './stijl';

// Wat een PDF-profiel naast kader, papier en schaal bewaart.
export const PROFIEL_VELDEN = ['ondergrond', 'dimmen', 'dpi', 'legende', 'stuklijst', 'maten', 'titelblok', 'doek', 'doekenlijst', 'doeknaam', 'toebehoren', 'revisietabel', 'raster', 'bladen', 'lagen'];

// Profielen van een plan. Oudere plannen bewaarden enkel uitsneden (kader, papier, schaal).
export function profielenVan(plan) {
  const p = plan?.instellingen?.pdf_profielen;
  if (Array.isArray(p)) return p;
  return Array.isArray(plan?.instellingen?.pdf_uitsneden) ? plan.instellingen.pdf_uitsneden : [];
}

export const schaalTekst = (s) => (s ? `1:${Number(s).toLocaleString('nl-BE')}` : 'Passend');
export const profielSamenvatting = (u) => [u.papier === 'vrij' ? 'Vrij formaat' : u.papier, u.orientatie, schaalTekst(u.schaal)].filter(Boolean).join(' · ');

export const bestandsnaam = (plan, ...extra) => [plan.editie_naam, plan.naam, ...extra, `v${plan.versie}`].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '');

// Kaartbestanden (Google Earth, My Maps, QGIS) en een afbeelding van het kaartbeeld.
export async function bestandMaken(soort, { plan, lagen, items, elementenMap, laagId = '', kaart = null }) {
  const lagenMap = new Map(lagen.map((l) => [l.id, l]));
  const stijlVan = (it) => effectieveStijl(it, lagenMap.get(it.laag_id), elementenMap.get(it.element_id));
  const L = laagId ? lagen.filter((l) => l.id === laagId) : lagen;
  const I = laagId ? items.filter((i) => i.laag_id === laagId) : items;
  const naam = bestandsnaam(plan, laagId ? lagenMap.get(laagId)?.naam : null);
  if (soort === 'png') {
    if (!kaart) throw new Error('De kaart is nog niet klaar.');
    await new Promise((ok, nee) => {
      kaart.once('render', () => {
        try {
          const a = document.createElement('a');
          a.href = kaart.getCanvas().toDataURL('image/png');
          a.download = `${naam}.png`;
          a.click(); ok();
        } catch { nee(new Error('De ondergrond laat geen afbeelding toe. Zet de ondergrond op Leeg of Lijntekening en probeer opnieuw.')); }
      });
      kaart.triggerRepaint();
    });
    return;
  }
  if (!I.length) throw new Error('Er staan geen items in deze selectie.');
  if (soort === 'kml') download(naarKml({ plan, lagen: L, items: I, stijlVan }), `${naam}.kml`, 'application/vnd.google-earth.kml+xml');
  else if (soort === 'kmz') {
    const JSZip = (await import('jszip')).default; const zip = new JSZip();
    zip.file('doc.kml', naarKml({ plan, lagen: L, items: I, stijlVan }));
    download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `${naam}.kmz`, 'application/vnd.google-earth.kmz');
  } else if (soort === 'geojson') download(naarGeojsonBestand({ lagen: L, items: I, stijlVan }), `${naam}.geojson`, 'application/geo+json');
}
