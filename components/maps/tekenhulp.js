// Tekenhulp: maat aan de cursor, lengte typen, kader-selectie, verlengen, knippen, rechtermuisklik.
// Uit Editor.jsx gehaald: de body van een useEffect; Editor roept dit aan met zijn
// state, refs en callbacks. Geeft de opruimfunctie terug.

import * as geo from './geo';
import * as turf from '@turf/turf';
import { paalPerPunt, segN } from './stijl';
import { hitOp } from './hit';

export default function tekenhulp(ctx) {
  // ctx is een functie: de waarden worden pas gelezen als het effect loopt (zoals de oorspronkelijke closure).
  const { bewerkbaarRef, getypt, kaartKlaar, knipLijn, knipRef, mapRef, muisPosRef, selecteerLijst, selectieRef, setCtxMenu, setGereedschap, setKnipId, setMelding, setVerleng, st, syncTd, tdRef, tipRef, toonTip, verlengRef, wijzigItem } = ctx();
    const map = mapRef.current;
    const td = tdRef.current;
    if (!map || !kaartKlaar || !td) return;
    map.boxZoom.disable(); // Shift + slepen = kader-selectie
    const M = { units: 'meters' };
    const tekenModi = ['lijn', 'vlak', 'meten', 'meten-vlak', 'notitie', 'maatlijn', 'element'];

    // Het punt dat nu getekend wordt (Terra Draw) en het vorige vaste punt.
    const bezig = () => {
      const f = td.getSnapshot().find((x) => x.properties?.currentlyDrawing);
      if (!f) return null;
      if (f.geometry.type === 'LineString') {
        const c = f.geometry.coordinates;
        if (c.length < 2) return null;
        return { vast: c[c.length - 2], cursor: c[c.length - 1], alle: c, lijn: true };
      }
      if (f.geometry.type === 'Polygon') {
        const r = f.geometry.coordinates[0];
        if (r.length < 3) return null;
        return { vast: r[r.length - 3], cursor: r[r.length - 2], alle: r.slice(0, -1), lijn: false };
      }
      return null;
    };
    const lijnInfo = (vast, cursor, alle) => {
      const seg = turf.distance(vast, cursor, M);
      const hoek = ((Math.round(turf.bearing(vast, cursor)) % 360) + 360) % 360;
      let tot = 0; for (let i = 1; i < alle.length; i++) tot += turf.distance(alle[i - 1], alle[i], M);
      const el = st.current.gereedschap === 'element' ? st.current.gekozenElement : null;
      let stuks = el?.tekenwijze === 'lijn' && Number(el.eenheid_m) > 0 ? ` · ${Math.max(1, Math.round(tot / Number(el.eenheid_m)))} st.` : '';
      // Paal en net: hoe ver de palen in dit stuk uit elkaar komen (max. één net per vak).
      if (paalPerPunt(el) && seg > 0.05) { const n = segN(seg, Number(el.eenheid_m)); stuks = ` · palen om de ${geo.getal(seg / n, 2)} m (${n} ${n === 1 ? 'net' : 'netten'})`; }
      return `${geo.getal(seg)} m · ${hoek}°${alle.length > 2 ? ` · totaal ${geo.getal(tot)} m` : ''}${stuks}`;
    };

    // Knipmodus zonder vaste lijn: de dichtste bewerkbare lijn onder de muis (binnen 12 px).
    const knipDoel = (e) => {
      const p = [e.lngLat.lng, e.lngLat.lat];
      const q = map.unproject([e.point.x + 12, e.point.y]);
      const tol = Math.abs(q.lng - p[0]) * 1.5 + 1e-9;
      let best = null;
      for (const it of st.current.items) {
        if (it.geometrie?.type !== 'LineString' || it.geometrie.coordinates.length < 2) continue;
        if (!bewerkbaarRef.current?.(it)) continue;
        const c = it.geometrie.coordinates;
        let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
        for (const [x, y] of c) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (p[0] < x0 - tol || p[0] > x1 + tol || p[1] < y0 - tol || p[1] > y1 + tol) continue;
        const np = turf.nearestPointOnLine(turf.lineString(c), turf.point(p), M);
        const sp = map.project(np.geometry.coordinates);
        const d = Math.hypot(sp.x - e.point.x, sp.y - e.point.y);
        if (d <= 12 && (!best || d < best.d)) best = { id: it.id, np, d };
      }
      return best;
    };

    const beweeg = (e) => {
      const tip = tipRef.current;
      if (tip) { tip.style.left = `${e.point.x + 16}px`; tip.style.top = `${e.point.y + 14}px`; }
      const g = st.current.gereedschap;
      const v = verlengRef.current;
      if (v && g === 'verleng') {
        const it = st.current.items.find((x) => x.id === v.id);
        if (!it) return;
        const c = it.geometrie.coordinates;
        const p = [e.lngLat.lng, e.lngLat.lat];
        const kant = v.kant || (turf.distance(p, c[0], M) < turf.distance(p, c[c.length - 1], M) ? 'begin' : 'einde');
        const eind = kant === 'begin' ? c[0] : c[c.length - 1];
        const data = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [eind, p] }, properties: {} }, { type: 'Feature', geometry: { type: 'Point', coordinates: eind }, properties: {} }] };
        map.getSource('fm-hulp')?.setData(data);
        toonTip(`${getypt.current ? `Lengte: ${getypt.current} m ⏎ · ` : ''}${geo.getal(turf.distance(eind, p, M))} m · ${((Math.round(turf.bearing(eind, p)) % 360) + 360) % 360}°`);
        return;
      }
      if (knipRef.current && g === 'knip') {
        const it = st.current.items.find((x) => x.id === knipRef.current);
        if (!it) return;
        const np = turf.nearestPointOnLine(turf.lineString(it.geometrie.coordinates), turf.point([e.lngLat.lng, e.lngLat.lat]), M);
        map.getSource('fm-hulp')?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: np.geometry, properties: { knip: true } }] });
        toonTip(`Hier knippen · ${geo.getal(np.properties.location)} m van het begin`);
        return;
      }
      if (g === 'knip') {
        const doel = knipDoel(e);
        map.getSource('fm-hulp')?.setData({ type: 'FeatureCollection', features: doel ? [{ type: 'Feature', geometry: doel.np.geometry, properties: { knip: true } }] : [] });
        toonTip(doel ? `Hier knippen · ${geo.getal(doel.np.properties.location)} m van het begin` : '');
        return;
      }
      if (!tekenModi.includes(g)) { toonTip(''); return; }
      const b = bezig();
      if (!b) { toonTip(getypt.current ? `Lengte: ${getypt.current} m` : ''); return; }
      toonTip(`${getypt.current ? `Lengte: ${getypt.current} m ⏎ · ` : ''}${lijnInfo(b.vast, b.cursor, b.alle)}`);
    };

    // Hulplaag voor verlengen en knippen.
    if (!map.getSource('fm-hulp')) {
      map.addSource('fm-hulp', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'fm-hulp-l', type: 'line', source: 'fm-hulp', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#E11D48', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
      map.addLayer({ id: 'fm-hulp-p', type: 'circle', source: 'fm-hulp', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['case', ['get', 'knip'], 6, 5], 'circle-color': ['case', ['get', 'knip'], '#E11D48', '#ffffff'], 'circle-stroke-color': '#E11D48', 'circle-stroke-width': 2 } });
      map.addSource('fm-kader', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'fm-kader-v', type: 'fill', source: 'fm-kader', paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'fm-kader-l', type: 'line', source: 'fm-kader', paint: { 'line-color': '#2563EB', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
    }
    const hulpLeeg = () => map.getSource('fm-hulp')?.setData({ type: 'FeatureCollection', features: [] });

    // Een klik nabootsen voor Terra Draw (lengte typen).
    const klikOp = (c) => {
      const cv = map.getCanvas(); const r = cv.getBoundingClientRect();
      const q = map.project(c);
      const o = { clientX: r.left + q.x, clientY: r.top + q.y, bubbles: true, isPrimary: true, pointerId: 1, button: 0, buttons: 0 };
      cv.dispatchEvent(new PointerEvent('pointermove', o));
      cv.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 }));
      cv.dispatchEvent(new PointerEvent('pointerup', o));
    };
    const doelVan = (vast, lengte, shift) => {
      const muis = muisPosRef.current || vast;
      let hoek = turf.bearing(vast, muis);
      if (shift) hoek = Math.round(hoek / 15) * 15;
      return turf.destination(vast, lengte, hoek, M).geometry.coordinates;
    };

    // Verlengen: punt toevoegen aan het gekozen uiteinde.
    const verlengMet = (p) => {
      const v = verlengRef.current;
      const it = st.current.items.find((x) => x.id === v?.id);
      if (!it) return;
      const c = it.geometrie.coordinates;
      const kant = v.kant || (turf.distance(p, c[0], M) < turf.distance(p, c[c.length - 1], M) ? 'begin' : 'einde');
      if (!v.kant) setVerleng({ ...v, kant });
      const nieuw = kant === 'begin' ? [p, ...c] : [...c, p];
      wijzigItem(it.id, { geometrie: { type: 'LineString', coordinates: nieuw } });
      setTimeout(syncTd, 0);
    };

    let enterOpEten = false;
    const toets = (e) => {
      const g = st.current.gereedschap;
      const tekenen = tekenModi.includes(g) && bezig();
      const verlengen = g === 'verleng' && verlengRef.current;
      if (!tekenen && !verlengen) { if (getypt.current) { getypt.current = ''; } return; }
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key) || ((e.key === ',' || e.key === '.') && !getypt.current.includes(','))) {
        getypt.current += e.key === '.' ? ',' : e.key;
        e.preventDefault(); e.stopImmediatePropagation();
        toonTip(`Lengte: ${getypt.current} m ⏎`);
        return;
      }
      if (e.key === 'Backspace' && getypt.current) {
        getypt.current = getypt.current.slice(0, -1);
        e.preventDefault(); e.stopImmediatePropagation();
        toonTip(getypt.current ? `Lengte: ${getypt.current} m ⏎` : '');
        return;
      }
      if (e.key === 'Escape' && getypt.current) { getypt.current = ''; e.preventDefault(); e.stopImmediatePropagation(); toonTip(''); return; }
      if (e.key === 'Enter' && getypt.current) {
        const L = Number(getypt.current.replace(',', '.'));
        getypt.current = '';
        e.preventDefault(); e.stopImmediatePropagation();
        enterOpEten = true;
        if (!(L > 0)) return;
        if (verlengen) {
          const it = st.current.items.find((x) => x.id === verlengRef.current.id);
          const c = it.geometrie.coordinates;
          const muis = muisPosRef.current || c[c.length - 1];
          const kant = verlengRef.current.kant || (turf.distance(muis, c[0], M) < turf.distance(muis, c[c.length - 1], M) ? 'begin' : 'einde');
          verlengMet(doelVan(kant === 'begin' ? c[0] : c[c.length - 1], L, e.shiftKey));
        } else {
          klikOp(doelVan(bezig().vast, L, e.shiftKey));
        }
        toonTip('');
      }
    };
    const toetsOp = (e) => { if (e.key === 'Enter' && enterOpEten) { enterOpEten = false; e.preventDefault(); e.stopImmediatePropagation(); } };

    // Kader-selectie: gereedschap Kader, of Shift + slepen op een lege plek.
    let kader = null;
    const itemLagen = () => ['fm-sign', 'fm-punt', 'fm-tekst', 'fm-lijn-vol', 'fm-lijn-streep', 'fm-lijn-stip', 'fm-lijn-streeppunt', 'fm-stuk-vulling', 'fm-stuk-lijn-vol', 'fm-vulling', 'fm-patroon', 'fm-vloer', 'fm-vloer-lijn'].filter((l) => map.getLayer(l));
    const neer = (e) => {
      const g = st.current.gereedschap;
      if (e.originalEvent.button !== 0) return;
      if (g === 'verleng' || g === 'knip') return;
      const kaderTool = g === 'kader';
      if (!kaderTool && !(g === 'selecteer' && e.originalEvent.shiftKey)) return;
      if (!kaderTool && hitOp(map, e.point, st.current.items)) return; // Shift-klik op item: bijselecteren (slimSlepen)
      e.preventDefault();
      kader = { a: e.point, erbij: e.originalEvent.shiftKey && !kaderTool ? true : e.originalEvent.shiftKey };
      map.dragPan.disable();
    };
    const sleepKader = (e) => {
      if (!kader) return;
      const a = map.unproject(kader.a); const b = e.lngLat;
      const ring = [[a.lng, a.lat], [b.lng, a.lat], [b.lng, b.lat], [a.lng, b.lat], [a.lng, a.lat]];
      kader.ring = ring;
      map.getSource('fm-kader')?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }] });
    };
    const los = () => {
      if (!kader) return;
      const k = kader; kader = null;
      map.dragPan.enable();
      map.getSource('fm-kader')?.setData({ type: 'FeatureCollection', features: [] });
      if (!k.ring) return;
      const vak = turf.polygon([k.ring]);
      const ids = st.current.items.filter((it) => it.geometrie && bewerkbaarRef.current(it)).filter((it) => {
        try { return turf.booleanIntersects(turf.feature(it.geometrie), vak); } catch { return false; }
      }).map((it) => it.id);
      // Raakt het kader een deel van een groep: dan de hele groep (buiten "Groep bewerken").
      if (!st.current.iso) {
        const groepen = new Set(st.current.items.filter((it) => ids.includes(it.id) && it.groep_id).map((it) => it.groep_id));
        for (const it of st.current.items) if (it.groep_id && groepen.has(it.groep_id) && !ids.includes(it.id) && bewerkbaarRef.current(it)) ids.push(it.id);
      }
      if (!ids.length) { setMelding('Niets in het kader.'); return; }
      setMelding(`${ids.length} ${ids.length === 1 ? 'item' : 'items'} geselecteerd met het kader.`);
      selecteerLijst(ids, k.erbij);
    };

    // Klikken bij verlengen en knippen.
    const klik = (e) => {
      const g = st.current.gereedschap;
      const p = [e.lngLat.lng, e.lngLat.lat];
      if (g === 'verleng' && verlengRef.current) { if (Date.now() < (map._fmNegeerKlik || 0)) return; verlengMet(p); return; }
      if (g === 'knip' && knipRef.current) { const id = knipRef.current; setKnipId(null); hulpLeeg(); toonTip(''); knipLijn(id, p); }
      else if (g === 'knip') { const doel = knipDoel(e); if (doel) { hulpLeeg(); toonTip(''); knipLijn(doel.id, doel.np.geometry.coordinates, { blijf: true }); } }
    };
    const dubbel = (e) => {
      if (st.current.gereedschap === 'verleng') { e.preventDefault(); setVerleng(null); setGereedschap('selecteer'); hulpLeeg(); toonTip(''); }
    };

    // Rechtermuisklik
    const rechts = (e) => {
      if (!st.current.schrijven) return;
      e.preventDefault();
      const g = st.current.gereedschap;
      if (g === 'verleng') { setVerleng(null); setGereedschap('selecteer'); hulpLeeg(); toonTip(''); return; }
      const hit = map.queryRenderedFeatures(e.point, { layers: itemLagen() })[0]?.properties?.id;
      const it = hit ? st.current.items.find((x) => x.id === hit) : null;
      if (it && !selectieRef.current.includes(it.id)) selecteerLijst([it.id]);
      setCtxMenu({ x: e.point.x, y: e.point.y, lngLat: [e.lngLat.lng, e.lngLat.lat], id: it?.id || null });
    };

    map.on('mousemove', beweeg);
    map.on('mousedown', neer);
    map.on('mousemove', sleepKader);
    map.on('mouseup', los);
    map.on('click', klik);
    map.on('dblclick', dubbel);
    map.on('contextmenu', rechts);
    window.addEventListener('keydown', toets, true);
    window.addEventListener('keyup', toetsOp, true);
    return () => {
      map.off('mousemove', beweeg); map.off('mousedown', neer); map.off('mousemove', sleepKader); map.off('mouseup', los);
      map.off('click', klik); map.off('dblclick', dubbel); map.off('contextmenu', rechts);
      window.removeEventListener('keydown', toets, true); window.removeEventListener('keyup', toetsOp, true);
    };
}
