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
  const [mod, og] = await Promise.all([import('maplibre-gl'), import('../maps/ondergronden')]);
  const maplibregl = mod.default?.Map ? mod.default : mod;
  og.registreerProtocollen();
  try { og.kiesFotoVl(plan.instellingen); } catch { /* standaard luchtfoto */ }
  const doos = document.createElement('div'); doos.style.cssText = 'position:absolute;inset:0';
  const start = Array.isArray(plan.centrum) ? plan.centrum : [4.4, 50.9];
  const map = new maplibregl.Map({ container: doos, style: og.basisStijl('luchtfoto', start), center: start, zoom: 15, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  const klaar = new Promise((ok) => map.once('load', () => {
    const leeg = { type: 'FeatureCollection', features: [] };
    map.addSource('pf-alle', { type: 'geojson', data: leeg }); map.addSource('pf-kies', { type: 'geojson', data: leeg });
    map.addLayer({ id: 'pf-alle-lijn', type: 'line', source: 'pf-alle', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.75 } });
    map.addLayer({ id: 'pf-alle-punt', type: 'circle', source: 'pf-alle', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 2.5, 'circle-color': '#ffffff', 'circle-opacity': 0.75 } });
    map.addLayer({ id: 'pf-kies-vlak', type: 'fill', source: 'pf-kies', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#FF7A00', 'fill-opacity': 0.45 } });
    map.addLayer({ id: 'pf-kies-lijn', type: 'line', source: 'pf-kies', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#FF7A00', 'line-width': 4 } });
    map.addLayer({ id: 'pf-kies-punt', type: 'circle', source: 'pf-kies', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 8, 'circle-color': '#FF7A00', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    ok();
  }));
  return { map, doos, klaar, markers: [], maplibregl };
}

export default function RijKaart({ plan, items, ids, onSluit }) {
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
        const s = new Set(ids);
        k.map.getSource('pf-alle').setData(fc(items.filter((i) => !s.has(i.id) && !i.vast)));
        k.map.getSource('pf-kies').setData(fc(gekozen));
        k.markers.forEach((m) => m.remove()); k.markers = [];
        for (const i of gekozen.slice(0, 60)) {
          const c = midden(i.geometrie); if (!c || !i.naam) continue;
          const el = document.createElement('div'); el.className = 'pf-kaartlabel'; el.textContent = i.naam;
          k.markers.push(new k.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] }).setLngLat(c).addTo(k.map));
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
