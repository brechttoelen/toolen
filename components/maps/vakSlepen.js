// Vlakvullende elementen: een vak slepen = ingedeeld in stukken (rijplaten, vloer).
// Uit Editor.jsx gehaald: de body van een useEffect; Editor roept dit aan met zijn
// state, refs en callbacks. Geeft de opruimfunctie terug.

import * as geo from './geo';
import { overlapKanten, overlapLangs } from './stijl';

export default function vakSlepen(ctx) {
  // ctx is een functie: de waarden worden pas gelezen als het effect loopt (zoals de oorspronkelijke closure).
  const { kaartKlaar, laagVoorElement, maakItem, mapRef, naTekenenRef, negeerKlik, setMelding, st, tdFeature, tdRef } = ctx();
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    let sleep = null;
    const toon = (g) => {
      const data = { type: 'FeatureCollection', features: g ? [{ type: 'Feature', geometry: g, properties: {} }] : [] };
      if (map.getSource('fm-spook')) map.getSource('fm-spook').setData(data);
      else {
        map.addSource('fm-spook', { type: 'geojson', data });
        map.addLayer({ id: 'fm-spook-v', type: 'fill', source: 'fm-spook', paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.12 } });
        map.addLayer({ id: 'fm-spook-l', type: 'line', source: 'fm-spook', paint: { 'line-color': '#2563EB', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
      }
    };
    const vak = (s0, e) => {
      const el = st.current.gekozenElement;
      const rot = st.current.elementRot || 0;
      const mLat = 110574; const mLng = 111320 * Math.cos((s0[1] * Math.PI) / 180);
      const dx = (e[0] - s0[0]) * mLng; const dy = (e[1] - s0[1]) * mLat;
      const r = (rot * Math.PI) / 180;
      // Naar het assenstelsel van het element (x = breedte bij draaiing rot).
      const lx = dx * Math.cos(r) - dy * Math.sin(r);
      const ly = dx * Math.sin(r) + dy * Math.cos(r);
      const mb = Number(el.breedte_m) || 1; const md = Number(el.diepte_m) || 1;
      const ok = overlapKanten(null, el); const ox = overlapLangs(ok, md, mb); const oy = overlapLangs(ok, mb, md);
      const nx = Math.max(1, Math.round((Math.abs(lx) - ox) / Math.max(0.05, mb - ox))); const ny = Math.max(1, Math.round((Math.abs(ly) - oy) / Math.max(0.05, md - oy)));
      const B = nx * (mb - ox) + ox; const D = ny * (md - oy) + oy;
      const cx = Math.sign(lx || 1) * B / 2; const cy = Math.sign(ly || 1) * D / 2;
      const wx = cx * Math.cos(r) + cy * Math.sin(r); const wy = -cx * Math.sin(r) + cy * Math.cos(r);
      const midden = [s0[0] + wx / mLng, s0[1] + wy / mLat];
      return { midden, B, D, rot, nx, ny };
    };
    const omlaag = (e) => {
      const s0 = st.current;
      if (!s0.schrijven || s0.gereedschap !== 'element' || !s0.gekozenElement?.eigenschappen?.module || s0.plaatLeg !== 'vak' || e.originalEvent.button !== 0) return;
      e.preventDefault();
      sleep = { start: [e.lngLat.lng, e.lngLat.lat], px: e.point, bewogen: false };
      map.dragPan.disable();
    };
    const beweeg = (e) => {
      if (!sleep) return;
      if (!sleep.bewogen && Math.hypot(e.point.x - sleep.px.x, e.point.y - sleep.px.y) < 6) return;
      sleep.bewogen = true;
      const v = vak(sleep.start, [e.lngLat.lng, e.lngLat.lat]);
      toon(geo.elementVeelhoek(v.midden, v.B, v.D, v.rot));
      setMelding(`${v.nx} × ${v.ny} = ${v.nx * v.ny} stukken · ${geo.getal(v.B)} × ${geo.getal(v.D)} m`);
      sleep.laatste = v;
    };
    const omhoog = () => {
      if (!sleep) return;
      const s0 = sleep; sleep = null;
      map.dragPan.enable();
      toon(null);
      if (!s0.bewogen || !s0.laatste) return;
      negeerKlik.current = true;
      setTimeout(() => { negeerKlik.current = false; }, 250);
      const el = st.current.gekozenElement; const v = s0.laatste;
      const it = maakItem({ laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, geometrie: geo.elementVeelhoek(v.midden, v.B, v.D, v.rot), parameters: { midden: v.midden, breedte: v.B, diepte: v.D, rot: v.rot, ...(el.eigenschappen?.verspringend_standaard ? { verspringend: true } : {}) } });
      tdRef.current?.addFeatures([tdFeature(it)]);
      setMelding('');
      naTekenenRef.current?.([it.id]);
    };
    map.on('mousedown', omlaag); map.on('mousemove', beweeg); map.on('mouseup', omhoog);
    return () => { map.off('mousedown', omlaag); map.off('mousemove', beweeg); map.off('mouseup', omhoog); };
}
