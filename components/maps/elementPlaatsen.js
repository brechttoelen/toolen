// Element plaatsen met een klik op de kaart (punt, lijn-element of op schaal).
// Uit Editor.jsx gehaald: de body van een useEffect; Editor roept dit aan met zijn
// state, refs en callbacks. Geeft de opruimfunctie terug.

import * as geo from './geo';
import { heeftFracties } from './stijl';
import { isBouwElement, vraagBouwer } from './bouwerSignaal';
import { stellingMaten, stellingKader } from './stellingbouw';

export default function elementPlaatsen(ctx) {
  // ctx is een functie: de waarden worden pas gelezen als het effect loopt (zoals de oorspronkelijke closure).
  const { binnenPlaatsRef, bouwerPlaatsRef, lichtRichtRef, plaatsSnapRef, zetDeurRef, elementItem, kaartKlaar, kalibreerKlik, laagVoorElement, maakItem, mapRef, naTekenenRef, negeerKlik, plaatsSjabloon, setExtra, setGereedschap, setGeselecteerd, st, tdFeature, tdRef, zetSignPunt } = ctx();
    const map = mapRef.current;
    if (!map || !kaartKlaar) return;
    const klik = (e) => {
      const s = st.current;
      if (negeerKlik.current) return;
      if (s.kalibratie) { kalibreerKlik([e.lngLat.lng, e.lngLat.lat]); return; }
      if (s.signZet && s.schrijven) {
        // Klik op een bestaand bord: dat bord kiezen in plaats van er een nieuw bij te zetten.
        const pt = e.point;
        const lagen = ['fm-sign', 'fm-vk-bord'].filter((l) => map.getLayer(l));
        const raak = lagen.length ? map.queryRenderedFeatures([[pt.x - 8, pt.y - 8], [pt.x + 8, pt.y + 8]], { layers: lagen }).map((f) => f.properties?.id).find((id) => id && s.items.some((x) => x.id === id && (x.velden?.sign || x.velden?.verkeer?.soort === 'bord'))) : null;
        if (raak && s.items.some((x) => x.id === raak)) { setGeselecteerd(raak); setExtra([]); try { tdRef.current?.selectFeature(raak); } catch {} return; }
        zetSignPunt([e.lngLat.lng, e.lngLat.lat]); return;
      }
      const lngLat = [e.lngLat.lng, e.lngLat.lat];
      if (lichtRichtRef?.current) { const f = lichtRichtRef.current; lichtRichtRef.current = null; f(lngLat); return; }
      if (s.schrijven && s.gereedschap === 'bouwer') { bouwerPlaatsRef?.current?.(lngLat); return; }
      if (s.schrijven && ['veelhoek', 'ellips', 'sector'].includes(s.gereedschap)) {
        const mpp = geo.meterPerPixel(map.getZoom(), lngLat[1]);
        const r = Math.max(2, geo.rond(mpp * 40, 1));
        const params = s.gereedschap === 'veelhoek' ? { midden: lngLat, straal: r, zijden: 3, rot: 0 }
          : s.gereedschap === 'ellips' ? { midden: lngLat, rx: r, ry: geo.rond(r * 0.6, 1), rot: 0 }
            : { midden: lngLat, straal: r * 2, richting: 0, hoek: 60 };
        const it = maakItem({ soort: s.gereedschap, parameters: params, geometrie: geo.parametrischeVorm(s.gereedschap, params) });
        tdRef.current?.addFeatures([tdFeature(it)]);
        setGereedschap('selecteer');
        setTimeout(() => { setGeselecteerd(it.id); try { tdRef.current?.selectFeature(it.id); } catch {} }, 30);
        return;
      }
      if (s.schrijven && s.gereedschap === 'element' && s.gekozenElement?.tekenwijze === 'sjabloon') {
        const ids = plaatsSjabloon(s.gekozenElement, lngLat, s.elementRot);
        naTekenenRef.current?.(ids);
        return;
      }
      if (s.schrijven && s.gereedschap === 'element' && isBouwElement(s.gekozenElement)) {
        // Truss of B-matrix: één klik zet een startlijn (4 m, in de gekozen draaiing) en opent meteen de bouwer.
        const el = s.gekozenElement;
        // Een kant-en-klare stelling uit de bibliotheek (bv. een camerastelling): de stelling uit het sjabloon
        // meteen op de plek van de klik, met het midden op de klik, als gewone stelling uit de bouwer.
        const sj = el.eigenschappen?.stelling && el.eigenschappen?.stelling3d;
        if (sj) {
          const st = JSON.parse(JSON.stringify(sj)); const M = stellingMaten(st); const K = stellingKader(st);
          const Lx = M.x(K.i1) - M.x(K.i0); const Ly = M.y(K.j1) - M.y(K.j0);
          const a = (((Number(s.elementRot) || 0) + 90) * Math.PI) / 180; const kx = 111320 * Math.cos((lngLat[1] * Math.PI) / 180); const ky = 110574;
          const ex = Math.sin(a); const ny = Math.cos(a); // richting van de ankerlijn (oost, noord)
          const px = -ny; const py = ex; // links ervan (de y-as van de stelling)
          const o = [lngLat[0] - (ex * (Lx / 2 + M.x(K.i0)) + px * (Ly / 2 + M.y(K.j0))) / kx, lngLat[1] - (ny * (Lx / 2 + M.x(K.i0)) + py * (Ly / 2 + M.y(K.j0))) / ky];
          const q = [o[0] + (ex * Math.max(1, Lx)) / kx, o[1] + (ny * Math.max(1, Lx)) / ky];
          const velden = { stelling: st, ...(st.camera ? { tvcamera: { opstelling: st.camera.op || 'statief' } } : {}) };
          const it = maakItem({ laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, naam: null, geometrie: { type: 'LineString', coordinates: [o, q] }, parameters: {}, velden });
          tdRef.current?.addFeatures([tdFeature(it)]);
          setGereedschap('selecteer');
          setTimeout(() => { setGeselecteerd(it.id); try { tdRef.current?.selectFeature(it.id); } catch {} }, 30);
          return;
        }
        const L = 4; const r = (((Number(s.elementRot) || 0) + 90) * Math.PI) / 180;
        const kx = 111320 * Math.cos((lngLat[1] * Math.PI) / 180); const ky = 110574;
        const d = [(Math.sin(r) * L) / 2 / kx, (Math.cos(r) * L) / 2 / ky];
        const it = maakItem({ laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, geometrie: { type: 'LineString', coordinates: [[lngLat[0] - d[0], lngLat[1] - d[1]], [lngLat[0] + d[0], lngLat[1] + d[1]]] }, parameters: {} });
        tdRef.current?.addFeatures([tdFeature(it)]);
        vraagBouwer(it.id);
        setGereedschap('selecteer');
        setTimeout(() => { setGeselecteerd(it.id); try { tdRef.current?.selectFeature(it.id); } catch {} }, 30);
        return;
      }
      if (s.schrijven && s.gereedschap === 'binnenlocatie') { binnenPlaatsRef.current?.([e.lngLat.lng, e.lngLat.lat]); return; }
      if (s.schrijven && s.gereedschap === 'element' && s.gekozenElement?.tekenwijze === 'lijn' && s.lijnStuks && plaatsSnapRef?.current?.lijn) {
        // Vast aantal stuks met één klik (bv. 1 nadar), in het verlengde van een lijn als die dichtbij ligt.
        const el = s.gekozenElement;
        const it = maakItem({ laag_id: laagVoorElement(el), soort: 'element', element_id: el.id, geometrie: { type: 'LineString', coordinates: plaatsSnapRef.current.lijn }, parameters: {} });
        tdRef.current?.addFeatures([tdFeature(it)]);
        // Gereedschap blijft actief: zo zet je er snel meerdere na elkaar (Esc = stoppen).
        return;
      }
      if (s.schrijven && s.gereedschap === 'element' && ['deur', 'poort'].includes(s.gekozenElement?.eigenschappen?.inzet)) {
        // Deur of poort: in een heraslijn, op de dichtstbijzijnde naad.
        const it = zetDeurRef.current?.(s.gekozenElement, lngLat, e.point);
        if (it) naTekenenRef.current?.([it.id]);
        return;
      }
      if (s.schrijven && s.gereedschap === 'element' && s.gekozenElement && s.gekozenElement.tekenwijze !== 'lijn' && !(s.gekozenElement.eigenschappen?.module && s.plaatLeg !== 'vak')) {
        const el = s.gekozenElement;
        const fr = heeftFracties(el) && s.plaatsFractie && !el.eigenschappen.vakken_standaard ? { velden: { fracties: Array(Math.max(1, s.elementAantal || 1)).fill(s.plaatsFractie) } } : {};
        // Voorbeeld lijnde zich uit tegen een rand: daar plaatsen.
        const sn = plaatsSnapRef?.current;
        const it = maakItem({ laag_id: laagVoorElement(el), ...elementItem(el, sn?.midden || [e.lngLat.lng, e.lngLat.lat], sn ? sn.rot : s.elementRot, { aantal: el.eigenschappen?.vakken_standaard ? 1 : s.elementAantal, ...fr }) });
        tdRef.current?.addFeatures([tdFeature(it)]);
        naTekenenRef.current?.([it.id]);
        return;
      }
      if (!s.schrijven) {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['fm-sign', 'fm-punt', 'fm-tekst', 'fm-lijn-vol', 'fm-lijn-streep', 'fm-lijn-stip', 'fm-lijn-streeppunt', 'fm-stuk-vulling', 'fm-stuk-lijn-vol', 'fm-vulling', 'fm-patroon', 'fm-vloer', 'fm-vloer-lijn'] });
        setGeselecteerd(hits[0]?.properties?.id || null);
      }
    };
    map.on('click', klik);
    return () => map.off('click', klik);
}
