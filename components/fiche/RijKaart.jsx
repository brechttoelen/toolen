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
  // Lijst rechts: elementen met dezelfde naam samen, met hun aantal.
  const lijst = useMemo(() => { const per = new Map(); for (const i of gekozen) { const k = `${i.velden?.binnen ? 'b' : 'u'}|${i.naam || ''}`; const g = per.get(k) || { i, n: 0, binnen: !!i.velden?.binnen }; g.n += 1; per.set(k, g); } return [...per.values()]; }, [gekozen]);

  useEffect(() => {
    let weg = false;
    (async () => {
      try {
        if (!gedeeld) gedeeld = await maakKaart(plan);
        const k = gedeeld; await k.klaar; if (weg || !gast.current) return;
        gast.current.appendChild(k.doos); k.map.resize();
        const kies = new Set(ids);
        const lagenMap = new Map(lagen.map((l) => [l.id, l])); const elMap = new Map(elementen.map((e) => [e.id, e]));
        // Buiten: getekend zoals in de editor. Binnen (in een gebouw): één punt per gebouw, de opstelling zelf staat in het binnenplan.
        const buiten = gekozen.filter((i) => !i.velden?.binnen);
        const { vormen, labels } = k.stijl.naarGeojson(buiten, lagenMap, elMap, {});
        k.stijl.zorgVoorPatronen(k.map, vormen.features, labels.features);
        k.map.getSource('fm-vormen').setData(vormen); k.map.getSource('fm-labels').setData(labels);
        k.map.getSource('pf-alle').setData(fc(items.filter((i) => !kies.has(i.id) && !i.velden?.binnen)));
        // Plaats van elk element: het midden van zijn tekening (een stelling is groter dan haar basislijn).
        const vak = new Map();
        for (const ft of vormen.features) { const id = ft.properties?.id; if (!id) continue; const v = vak.get(id) || [Infinity, Infinity, -Infinity, -Infinity]; for (const c of punten(ft.geometry)) { v[0] = Math.min(v[0], c[0]); v[1] = Math.min(v[1], c[1]); v[2] = Math.max(v[2], c[0]); v[3] = Math.max(v[3], c[1]); } vak.set(id, v); }
        const plek = (i) => { const v = vak.get(i.id); return v && Number.isFinite(v[0]) ? [(v[0] + v[2]) / 2, (v[1] + v[3]) / 2] : midden(i.geometrie); };
        const prikkers = buiten.map((i) => ({ c: plek(i), naam: i.naam })).filter((x) => x.c);
        const perGebouw = new Map();
        for (const i of gekozen.filter((x) => x.velden?.binnen)) { const h = i.velden.binnen.host || 'x'; const g = perGebouw.get(h) || { n: 0, c: null }; g.n += 1; g.c = g.c || midden(items.find((x) => x.id === h)?.geometrie) || midden(i.geometrie); perGebouw.set(h, g); }
        for (const [h, g] of perGebouw) if (g.c) prikkers.push({ c: g.c, naam: `${items.find((x) => x.id === h)?.naam || 'Binnen'} · ${g.n} binnen` });
        k.map.getSource('pf-plek').setData({ type: 'FeatureCollection', features: prikkers.map((x) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: x.c } })) });
        k.markers.forEach((m) => m.remove()); k.markers = [];
        const dubbel = new Map(); for (const x of prikkers) dubbel.set(x.naam, (dubbel.get(x.naam) || 0) + 1);
        for (const x of prikkers.slice(0, 80)) {
          if (!x.naam || dubbel.get(x.naam) > 1) continue;   // een naam die meerdere elementen delen, wijst niets aan
          const el = document.createElement('div'); el.className = 'pf-kaartlabel'; el.textContent = x.naam;
          k.markers.push(new k.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -24] }).setLngLat(x.c).addTo(k.map));
        }
        k.plek = new Map(buiten.map((i) => [i.id, plek(i)]));
        const p = [...[...vak.values()].filter((v) => Number.isFinite(v[0])).flatMap((v) => [[v[0], v[1]], [v[2], v[3]]]), ...prikkers.map((x) => x.c)];
        if (p.length) {
          const b = p.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])], [Infinity, Infinity, -Infinity, -Infinity]);
          k.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, maxZoom: 19.5, duration: 0 });
        }
        setStand(p.length ? 'ok' : 'leeg');
      } catch (e) { console.error('kaart onder de rij', e); if (!weg) setStand('fout'); }
    })();
    return () => { weg = true; if (gedeeld?.doos.parentNode) gedeeld.doos.parentNode.removeChild(gedeeld.doos); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel]);

  const naar = (i) => { const c = gedeeld?.plek?.get(i.id) || midden(i.geometrie); if (c && gedeeld) gedeeld.map.flyTo({ center: c, zoom: Math.max(gedeeld.map.getZoom(), 19), duration: 500 }); };
  return (
    <div className="pf-rijkaart">
      <div className="kaart" ref={gast}>{stand !== 'ok' && <span className="stand">{stand === 'laden' ? 'Kaart laden…' : stand === 'leeg' ? 'Deze regel heeft geen elementen met een plaats op de kaart.' : 'De kaart kon niet laden.'}</span>}</div>
      <div className="lijst">
        <div className="pf-rij" style={{ flexWrap: 'nowrap' }}><b style={{ flex: 1, fontWeight: 600 }}>{gekozen.length} {gekozen.length === 1 ? 'element' : 'elementen'}</b><button className="pf-sluit" onClick={onSluit} aria-label="Kaart sluiten">✕</button></div>
        <div className="namen">{lijst.map((x) => <button key={x.i.id} className="pf-lijstknop" onClick={() => naar(x.i)}><b>{x.n > 1 ? `${x.n} × ` : ''}{x.i.naam || 'Zonder naam'}</b>{x.binnen && <span>binnen · de opstelling staat in het binnenplan</span>}</button>)}</div>
        {gekozen[0] && <a className="t-knop klein" href={`/maps/${plan.id}?item=${gekozen[0].id}`} style={{ textDecoration: 'none' }}>Open op de kaart</a>}
      </div>
    </div>
  );
}
