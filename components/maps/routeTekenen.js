// Route langs de weg (OSRM van FOSSGIS: auto, fiets, te voet) of recht.
// Uit Editor.jsx gehaald: de body van een useEffect; Editor roept dit aan met zijn
// state, refs en callbacks. Geeft de opruimfunctie terug.

import { zetCursor } from './cursor';
import * as geo from './geo';
import * as turf from '@turf/turf';

export default function routeTekenen(ctx) {
  // ctx is een functie: de waarden worden pas gelezen als het effect loopt (zoals de oorspronkelijke closure).
  const { kaartKlaar, maakItem, wijzigItem, mapRef, naTekenenRef, profielRef, routeKlaarRef, routeRef, routeTerugRef, routeTekenRef, setMelding, setRouteInfo, st, tdFeature, tdRef } = ctx();
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const teken = () => {
      const r = routeRef.current;
      const coords = r.segmenten.flat();
      const f = [];
      if (coords.length > 1) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
      r.punten.forEach((p, i) => f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { eerste: i === 0, i } }));
      const data = { type: 'FeatureCollection', features: f };
      if (map.getSource('fm-route')) map.getSource('fm-route').setData(data);
      else {
        map.addSource('fm-route', { type: 'geojson', data });
        map.addLayer({ id: 'fm-route-l', type: 'line', source: 'fm-route', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#E11D48', 'line-width': 4, 'line-opacity': 0.85 } });
        map.addLayer({ id: 'fm-route-p', type: 'circle', source: 'fm-route', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['case', ['get', 'eerste'], 6, 4.5], 'circle-color': '#ffffff', 'circle-stroke-color': '#E11D48', 'circle-stroke-width': 2 } });
      }
      const L = coords.length > 1 ? geo.lengte({ type: 'LineString', coordinates: coords }) : 0;
      setRouteInfo(r.punten.length ? { n: r.punten.length, km: L / 1000, bewerk: !!r.bewerk } : null);
    };
    routeTekenRef.current = teken;
    const haal = async (a, b) => {
      const prof = profielRef.current;
      if (prof === 'recht') return [a, b];
      try {
        const url = `https://routing.openstreetmap.de/routed-${prof}/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const j = await res.json();
        const c = j.routes?.[0]?.geometry?.coordinates;
        if (!c?.length) throw new Error('geen route');
        // Begin en einde exact op de aangeklikte punten.
        return [a, ...c, b];
      } catch {
        setMelding('Geen route gevonden (of geen verbinding): dit stuk is recht getekend.');
        return [a, b];
      }
    };
    // Punten verslepen terwijl je nog tekent: de stukken ervoor en erna volgen opnieuw de weg.
    let sleep = null; let negeerTot = 0;
    const neer = (e) => {
      if (st.current.gereedschap !== 'route' || !routeRef.current.punten.length || !map.getLayer('fm-route-p')) return;
      const box = [[e.point.x - 7, e.point.y - 7], [e.point.x + 7, e.point.y + 7]];
      const hit = map.queryRenderedFeatures(box, { layers: ['fm-route-p'] })[0];
      const r0 = routeRef.current;
      if (!hit) {
        // Op de lijn zelf: een tussenpunt invoegen en meteen slepen (zoals in Google Maps).
        if (r0.punten.length < 2 || !map.queryRenderedFeatures(box, { layers: ['fm-route-l'] }).length) return;
        const p = [e.lngLat.lng, e.lngLat.lat];
        let k = 0; let best = Infinity;
        r0.segmenten.forEach((seg, j) => {
          if (seg.length < 2) return;
          const d = turf.pointToLineDistance(turf.point(p), turf.lineString(seg), { units: 'meters' });
          if (d < best) { best = d; k = j; }
        });
        const oud = r0.segmenten[k];
        r0.punten.splice(k + 1, 0, p);
        r0.segmenten.splice(k, 1, [r0.punten[k], p], [p, r0.punten[k + 2]]);
        e.preventDefault();
        sleep = { i: k + 1, bewogen: false, nieuw: true, oud };
        teken();
        map.dragPan.disable();
        zetCursor(map, 'sleep', 'grabbing');
        return;
      }
      e.preventDefault();
      sleep = { i: hit.properties.i, bewogen: false };
      map.dragPan.disable();
      zetCursor(map, 'sleep', 'grabbing');
    };
    const beweeg = (e) => {
      if (!sleep) {
        if (st.current.gereedschap === 'route' && map.getLayer('fm-route-p')) {
          const box = [[e.point.x - 7, e.point.y - 7], [e.point.x + 7, e.point.y + 7]];
          zetCursor(map, 'route', map.queryRenderedFeatures(box, { layers: ['fm-route-p'] }).length ? 'grab'
            : routeRef.current.punten.length > 1 && map.getLayer('fm-route-l') && map.queryRenderedFeatures(box, { layers: ['fm-route-l'] }).length ? 'copy' : '');
        }
        return;
      }
      const r = routeRef.current; const i = sleep.i;
      const p = [e.lngLat.lng, e.lngLat.lat];
      r.punten[i] = p; sleep.bewogen = true;
      if (i > 0) r.segmenten[i - 1] = [r.punten[i - 1], p];
      if (i < r.punten.length - 1) r.segmenten[i] = [p, r.punten[i + 1]];
      teken();
    };
    const los = async () => {
      if (!sleep) return;
      const { i, bewogen, nieuw, oud } = sleep; sleep = null;
      map.dragPan.enable(); zetCursor(map, 'sleep', '');
      if (!bewogen) {
        if (nieuw) {
          // Enkel geklikt op de lijn: geen nieuw punt, de oude stukken terug.
          const r = routeRef.current;
          r.punten.splice(i, 1); r.segmenten.splice(i - 1, 2, oud);
          negeerTot = Date.now() + 400;
          teken();
        }
        return;
      }
      negeerTot = Date.now() + 400; // de klik na het loslaten zet geen nieuw punt
      const r = routeRef.current;
      const werk = [];
      if (i > 0) werk.push([i - 1, r.punten[i - 1], r.punten[i]]);
      if (i < r.punten.length - 1) werk.push([i, r.punten[i], r.punten[i + 1]]);
      for (const [k, a, b] of werk) {
        const seg = await haal(a, b);
        if (routeRef.current === r && r.punten[k] === a) r.segmenten[k] = seg;
      }
      teken();
    };
    const klik = async (e) => {
      const s0 = st.current;
      if (!s0.schrijven || s0.gereedschap !== 'route') return;
      if (Date.now() < negeerTot) return;
      const p = [e.lngLat.lng, e.lngLat.lat];
      const r = routeRef.current;
      // Een bestaande route aanpassen: klikken op de kaart zet geen punten bij.
      if (r.bewerk) return;
      const vorige = r.punten[r.punten.length - 1];
      if (vorige) { const q = map.project(vorige); if (Math.hypot(q.x - e.point.x, q.y - e.point.y) < 6) return; }
      r.punten.push(p);
      if (vorige) {
        const plek = r.segmenten.length; r.segmenten.push([vorige, p]); teken();
        const seg = await haal(vorige, p);
        if (routeRef.current === r && r.segmenten[plek]) { r.segmenten[plek] = seg; }
      }
      teken();
    };
    const klaar = () => {
      const r = routeRef.current;
      const coords = r.segmenten.flat().filter((c, i, a) => i === 0 || c[0] !== a[i - 1][0] || c[1] !== a[i - 1][1]);
      routeRef.current = { punten: [], segmenten: [] };
      teken();
      if (coords.length < 2) return;
      // Vereenvoudigen (±1 m): de weg blijft gevolgd, maar zonder honderden knooppunten.
      let lijnC = coords;
      try { if (coords.length > 20) lijnC = turf.simplify(turf.lineString(coords), { tolerance: 0.00001, highQuality: true }).geometry.coordinates; } catch {}
      const geometrie = { type: 'LineString', coordinates: lijnC.map((c) => c.map((v) => Math.round(v * 1e7) / 1e7)) };
      const route = { profiel: profielRef.current, punten: r.punten };
      if (r.bewerk) {
        const oud = st.current.items.find((x) => x.id === r.bewerk);
        if (!oud) return;
        wijzigItem(oud.id, { geometrie, parameters: { ...(oud.parameters || {}), route } });
        try { tdRef.current?.updateFeatureGeometry(oud.id, geometrie); } catch {}
        setMelding(`Route aangepast: ${geo.getal(geo.lengte(geometrie) / 1000, 2)} km. Ctrl Z zet de vorige versie terug.`);
        naTekenenRef.current?.([oud.id]);
        return;
      }
      const it = maakItem({ soort: 'lijn', geometrie, parameters: { route } });
      tdRef.current?.addFeatures([tdFeature(it)]);
      setMelding(`Route van ${geo.getal(geo.lengte(it.geometrie) / 1000, 2)} km getekend.`);
      naTekenenRef.current?.([it.id]);
    };
    const terug = () => {
      const r = routeRef.current;
      r.punten.pop(); r.segmenten.pop();
      teken();
    };
    routeKlaarRef.current = klaar;
    routeTerugRef.current = terug;
    const dubbel = async (e) => {
      if (st.current.gereedschap !== 'route' || !routeRef.current.punten.length) return;
      e.preventDefault();
      // Dubbelklik op een tussenpunt (of een eindpunt bij aanpassen): punt weg, de weg opnieuw volgen.
      const r = routeRef.current;
      const box = [[e.point.x - 7, e.point.y - 7], [e.point.x + 7, e.point.y + 7]];
      const hit = map.getLayer('fm-route-p') && map.queryRenderedFeatures(box, { layers: ['fm-route-p'] })[0];
      const i = hit ? hit.properties.i : -1;
      if (i >= 0 && r.punten.length > 2 && (r.bewerk || i < r.punten.length - 1)) {
        r.punten.splice(i, 1);
        if (i === 0) r.segmenten.splice(0, 1);
        else if (i === r.punten.length) r.segmenten.splice(i - 1, 1);
        else {
          const a = r.punten[i - 1]; const b = r.punten[i];
          r.segmenten.splice(i - 1, 2, [a, b]);
          teken();
          const seg = await haal(a, b);
          if (routeRef.current === r && r.punten[i - 1] === a && r.punten[i] === b) r.segmenten[i - 1] = seg;
        }
        teken();
        return;
      }
      if (r.bewerk) return;
      // Enkel afwerken bij een echte dubbelklik op hetzelfde punt (niet bij twee snelle klikken op andere plaatsen).
      const laatste = routeRef.current.punten[routeRef.current.punten.length - 1];
      const q = map.project(laatste);
      if (Math.hypot(q.x - e.point.x, q.y - e.point.y) < 10) klaar();
    };
    map.on('click', klik);
    map.on('dblclick', dubbel);
    map.on('mousedown', neer); map.on('mousemove', beweeg); map.on('mouseup', los);
    map.on('touchstart', neer); map.on('touchmove', beweeg); map.on('touchend', los);
    return () => {
      map.off('click', klik); map.off('dblclick', dubbel);
      map.off('mousedown', neer); map.off('mousemove', beweeg); map.off('mouseup', los);
      map.off('touchstart', neer); map.off('touchmove', beweeg); map.off('touchend', los);
    };
}
