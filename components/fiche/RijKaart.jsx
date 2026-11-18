'use client';

// Luchtfoto onder een rij: waar liggen de elementen van deze bestelregel? Er bestaat maar één kaart voor het
// hele scherm; ze verhuist naar de rij die openstaat. De kaartcode laadt pas bij de eerste keer openen.
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

let gedeeld = null;   // { map, doos, klaar: Promise, markers: [] }

const punten = (g, uit = []) => { const loop = (c) => { if (typeof c?.[0] === 'number') uit.push(c); else for (const x of c || []) loop(x); }; if (g) loop(g.coordinates); return uit; };
const midden = (g) => { const p = punten(g); if (!p.length) return null; return [p.reduce((a, c) => a + c[0], 0) / p.length, p.reduce((a, c) => a + c[1], 0) / p.length]; };
const fc = (items) => ({ type: 'FeatureCollection', features: items.filter((i) => i.geometrie?.type).map((i) => ({ type: 'Feature', id: i.id, properties: { id: i.id }, geometry: i.geometrie })) });

async function maakKaart(plan) {
  const [mod, og, stijl] = await Promise.all([import('maplibre-gl'), import('../maps/ondergronden'), import('../maps/stijl')]);
  const maplibregl = mod.default?.Map ? mod.default : mod;
  og.registreerProtocollen();
  try { og.kiesFotoVl(plan.instellingen); } catch { /* standaard luchtfoto */ }
  const doos = document.createElement('div'); doos.style.cssText = 'position:absolute;inset:0';
  const start = Array.isArray(plan.centrum) ? plan.centrum : [4.4, 50.9];
  const map = new maplibregl.Map({ container: doos, style: og.basisStijl('luchtfoto', start), center: start, zoom: 15, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  const klaar = new Promise((ok) => map.once('load', () => {
    const leeg = { type: 'FeatureCollection', features: [] };
    // De rest van het plan: dun en grijswit, enkel als houvast.
    map.addSource('pf-alle', { type: 'geojson', data: leeg });
    map.addLayer({ id: 'pf-alle-lijn', type: 'line', source: 'pf-alle', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#E6E9EE', 'line-width': 1, 'line-opacity': 0.7 } });
    map.addLayer({ id: 'pf-alle-punt', type: 'circle', source: 'pf-alle', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 2.5, 'circle-color': '#E6E9EE', 'circle-opacity': 0.7 } });
    // De elementen van de regel zelf: getekend zoals in de kaarteditor (zelfde lagen en stijlen).
    map.addSource('fm-vormen', { type: 'geojson', data: leeg }); map.addSource('fm-labels', { type: 'geojson', data: leeg });
    for (const l of stijl.kaartLagen(start[1])) { try { map.addLayer(l); } catch (e) { console.warn('kaartlaag', l.id, e); } }
    map.addSource('pf-plek', { type: 'geojson', data: leeg });
    // Ring rond het midden van elk element: ook een klein of smal element valt meteen op.
    map.addLayer({ id: 'pf-plek-ring', type: 'circle', source: 'pf-plek', paint: { 'circle-radius': 18, 'circle-color': '#FF7A00', 'circle-opacity': 0.18, 'circle-stroke-color': '#FF7A00', 'circle-stroke-width': 2.5 } });
    try { og.klapBronvermeldingIn(map); } catch { /* blijft open */ }
    ok();
  }));
  return { map, doos, klaar, markers: [], maplibregl, stijl };
}

export default function RijKaart({ plan, items, lagen = [], elementen = [], ids, onSluit }) {
  const gast = useRef(null);
  const [stand, setStand] = useState('laden');
  const gekozen = useMemo(() => { const s = new Set(ids); return items.filter((i) => s.has(i.id) && i.geometrie?.type); }, [items, ids]);
  const sleutel = ids.join(',');

  useEffect(() => {
    let weg = false;
    (async () => {
      try {
        if (!gedeeld) gedeeld = await maakKaart(plan);
        const k = gedeeld; await k.klaar; if (weg || !gast.current) return;
        gast.current.appendChild(k.doos); k.map.resize();
        const kies = new Set(ids);
        const lagenMap = new Map(lagen.map((l) => [l.id, l])); const elMap = new Map(elementen.map((e) => [e.id, e]));
        const { vormen, labels } = k.stijl.naarGeojson(gekozen, lagenMap, elMap, {});
        k.stijl.zorgVoorPatronen(k.map, vormen.features, labels.features);
        k.map.getSource('fm-vormen').setData(vormen); k.map.getSource('fm-labels').setData(labels);
        k.map.getSource('pf-alle').setData(fc(items.filter((i) => !kies.has(i.id) && !i.velden?.binnen)));
        k.map.getSource('pf-plek').setData({ type: 'FeatureCollection', features: gekozen.map((i) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: midden(i.geometrie) } })).filter((x) => x.geometry.coordinates) });
        k.markers.forEach((m) => m.remove()); k.markers = [];
        for (const i of gekozen.slice(0, 60)) {
          const c = midden(i.geometrie); if (!c || !i.naam) continue;
          const el = document.createElement('div'); el.className = 'pf-kaartlabel'; el.textContent = i.naam;
          k.markers.push(new k.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -24] }).setLngLat(c).addTo(k.map));
        }
        const p = gekozen.flatMap((i) => punten(i.geometrie));
        if (p.length) {
          const b = p.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])], [Infinity, Infinity, -Infinity, -Infinity]);
          k.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, maxZoom: 19, duration: 0 });
        }
        setStand(p.length ? 'ok' : 'leeg');
      } catch (e) { console.error('kaart onder de rij', e); if (!weg) setStand('fout'); }
    })();
    return () => { weg = true; if (gedeeld?.doos.parentNode) gedeeld.doos.parentNode.removeChild(gedeeld.doos); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel]);

  const naar = (i) => { const c = midden(i.geometrie); if (c && gedeeld) gedeeld.map.flyTo({ center: c, zoom: Math.max(gedeeld.map.getZoom(), 19), duration: 500 }); };
  return (
    <div className="pf-rijkaart">
      <div className="kaart" ref={gast}>{stand !== 'ok' && <span className="stand">{stand === 'laden' ? 'Kaart laden…' : stand === 'leeg' ? 'Deze regel heeft geen elementen met een plaats op de kaart.' : 'De kaart kon niet laden.'}</span>}</div>
      <div className="lijst">
        <div className="pf-rij" style={{ flexWrap: 'nowrap' }}><b style={{ flex: 1, fontWeight: 600 }}>{gekozen.length} {gekozen.length === 1 ? 'element' : 'elementen'}</b><button className="pf-sluit" onClick={onSluit} aria-label="Kaart sluiten">✕</button></div>
        <div className="namen">{gekozen.map((i) => <button key={i.id} className="pf-lijstknop" onClick={() => naar(i)}><b>{i.naam || 'Zonder naam'}</b></button>)}</div>
        {gekozen[0] && <a className="t-knop klein" href={`/maps/${plan.id}?item=${gekozen[0].id}`} style={{ textDecoration: 'none' }}>Open op de kaart</a>}
      </div>
    </div>
  );
}
