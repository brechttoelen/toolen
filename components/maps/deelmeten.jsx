'use client';

// Meten in de deellink (tablet op het terrein): tik punten, zie de lengte per stuk en in totaal; als vlak ook de oppervlakte.
import { lengte, oppervlakte, getal } from './geo';

export const MEET_TEKST = {
  nl: { knop: 'Meten', uitleg: 'Tik punten op de kaart.', totaal: 'Totaal', omtrek: 'Omtrek', opp: 'Oppervlakte', terug: 'Laatste punt weg', wis: 'Opnieuw', klaar: 'Klaar', lijn: 'Afstand', vlak: 'Oppervlakte' },
  fr: { knop: 'Mesurer', uitleg: 'Touchez des points sur la carte.', totaal: 'Total', omtrek: 'Périmètre', opp: 'Surface', terug: 'Retirer le dernier point', wis: 'Recommencer', klaar: 'Terminé', lijn: 'Distance', vlak: 'Surface' },
  en: { knop: 'Measure', uitleg: 'Tap points on the map.', totaal: 'Total', omtrek: 'Perimeter', opp: 'Area', terug: 'Remove last point', wis: 'Start over', klaar: 'Done', lijn: 'Distance', vlak: 'Area' },
};

export function zorgVoorMeetLagen(map) {
  if (!map || map.getSource('fm-deelmeet')) return;
  map.addSource('fm-deelmeet', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'fm-deelmeet-v', type: 'fill', source: 'fm-deelmeet', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.12 } });
  map.addLayer({ id: 'fm-deelmeet-l', type: 'line', source: 'fm-deelmeet', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#2563EB', 'line-width': 3, 'line-dasharray': [2, 1] } });
  map.addLayer({ id: 'fm-deelmeet-p', type: 'circle', source: 'fm-deelmeet', filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 't']]], paint: { 'circle-radius': 6, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#2563EB', 'circle-stroke-width': 3 } });
  map.addLayer({ id: 'fm-deelmeet-t', type: 'symbol', source: 'fm-deelmeet', filter: ['has', 't'], layout: { 'text-field': ['get', 't'], 'text-size': 13, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }, paint: { 'text-color': '#1E3A8A', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2.5 } });
}

export function meetGeometrie(punten, vlak) {
  const f = punten.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
  if (punten.length >= 2) {
    const ring = vlak && punten.length >= 3 ? [...punten, punten[0]] : punten;
    f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: ring }, properties: {} });
    if (vlak && punten.length >= 3) f.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} });
    // Lengte per stuk, in het midden van elk stuk.
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]; const b = ring[i + 1]; const L = lengte({ type: 'LineString', coordinates: [a, b] });
      if (L >= 0.5) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }, properties: { t: `${getal(L, L < 10 ? 1 : 0)} m` } });
    }
  }
  return { type: 'FeatureCollection', features: f };
}

export function MeetPaneel({ taal = 'nl', punten, setPunten, vlak, setVlak, onSluit }) {
  const t = MEET_TEKST[taal] || MEET_TEKST.nl;
  const ring = vlak && punten.length >= 3 ? [...punten, punten[0]] : punten;
  const L = punten.length >= 2 ? lengte({ type: 'LineString', coordinates: ring }) : 0;
  const A = vlak && punten.length >= 3 ? oppervlakte({ type: 'Polygon', coordinates: [ring] }) : 0;
  return (
    <div className="fm fm-vp-paneel" role="dialog" aria-label={t.knop}>
      <div className="fm-vp-kop"><strong>📏 {t.knop}</strong><button type="button" className="fm-knop klein" onClick={onSluit}>{t.klaar}</button></div>
      <div className="fm-segment">{[[false, t.lijn], [true, t.vlak]].map(([k, n]) => <button key={String(k)} type="button" className={vlak === k ? 'aan' : ''} onClick={() => setVlak(k)}>{n}</button>)}</div>
      {punten.length < 2 ? <div className="fm-sub">{t.uitleg}</div> : (
        <div style={{ fontSize: 18, fontWeight: 600 }}>{vlak && punten.length >= 3 ? t.omtrek : t.totaal} {getal(L, L < 100 ? 1 : 0)} m{A > 0 ? <span style={{ display: 'block', fontSize: 15 }}>{t.opp} {getal(A, A < 100 ? 1 : 0)} m²</span> : null}</div>
      )}
      <div className="fm-vp-knoppen" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="fm-knop klein" disabled={!punten.length} onClick={() => setPunten((l) => l.slice(0, -1))}>{t.terug}</button>
        <button type="button" className="fm-knop klein" disabled={!punten.length} onClick={() => setPunten([])}>{t.wis}</button>
      </div>
    </div>
  );
}
