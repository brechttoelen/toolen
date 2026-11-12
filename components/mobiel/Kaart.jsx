'use client';

// Kaart op de gsm: plan bekijken met gps en zoeken, item aantikken voor info.
// Ter plaatse: melden op een plek, foto op de plek, meten en (zelf aan te zetten) je plek delen met je ploeg.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { maps, sb, BUCKET, foutTekst, magSchrijven, publiekeUrl } from '../maps/db';
import { basisStijl, registreerProtocollen, zetOndergrond, klapBronvermeldingIn, kiesFotoVl, ONDERGRONDEN } from '../maps/ondergronden';
import { kaartLagen, naarGeojson, zorgVoorPatronen, maten, matenTekst } from '../maps/stijl';
import { middelpunt, kader, getal, lengte, oppervlakte, verschuifGraden } from '../maps/geo';
import { draaiRond } from '../maps/itemgeo';
import { soortenVoorPakket, rijMetOnderdelen, nieuwId, linkAan } from '../maps/ontvangers';
import { metTekeningen } from '../maps/tekeningen';
import { navigatieUrl } from '../maps/PopupInhoud';
import { isSign } from '../maps/signalisatie';
import { hitOp, ITEMLAGEN } from '../maps/hit';
import { zorgVoorVeldpuntLagen, zetVeldpunten } from '../maps/veldpunten';
import { zorgVoorMeetLagen, meetGeometrie } from '../maps/deelmeten';
import { startLive } from '../maps/live';
import { heeft3d, Knop3D, Groot3D } from '../maps/drie3d';
import BinnenScherm from '../maps/BinnenScherm';
import { kleurVoor } from '../maps/Aanwezigheid';
import { Ic } from './iconen';
import { initialen } from './MobielApp';

const leeg = { type: 'FeatureCollection', features: [] };
const WACHTRIJ = 'fm-mob-wachtrij';
const DEEL = 'fm-mob-deel';
const VERPLAATS = 'fm-mob-verplaats';
const leesJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const zetJson = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };
const afstand = (a, b) => turf.distance(a, b, { units: 'meters' });
const meters = (d) => (d < 1000 ? `${getal(d, 0)} m` : `${getal(d / 1000, 1)} km`);
const naamVan = (p) => p?.display_name || String(p?.email || '').replace(/@.*/, '') || 'Collega';
const eindeVanDag = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.getTime(); };

// Meldingen zonder verbinding: bewaard op het toestel en verstuurd zodra er netwerk is.
async function verstuurWachtrij() {
  const lijst = leesJson(WACHTRIJ, []);
  if (!lijst.length) return 0;
  const rest = [];
  for (const m of lijst) {
    const { error } = await maps().from('opmerkingen').insert(m);
    if (error) rest.push(m);
  }
  zetJson(WACHTRIJ, rest.length ? rest : null);
  return lijst.length - rest.length;
}

// Verplaatsingen zonder verbinding: per item de laatste stand, verstuurd zodra er netwerk is.
async function verstuurVerplaatsingen() {
  const w = leesJson(VERPLAATS, {});
  const ids = Object.keys(w);
  if (!ids.length) return 0;
  let n = 0;
  for (const id of ids) {
    const { data, error } = await maps().rpc('item_wijzig', { p_id: id, p_rev: null, p_patch: w[id] });
    if (!error && data?.status !== 'weg' && data?.status !== 'verwijderd') n++;
    if (!error) delete w[id];
  }
  zetJson(VERPLAATS, Object.keys(w).length ? w : null);
  return n;
}

// Verplaatsen kan voor alles behalve lijnen (hekken, kabels, parcours): die volgen de weg en verschuif je op een computer.
export const magVerplaatsen = (it) => !!it?.geometrie && it.geometrie.type !== 'LineString' && !it.vergrendeld && !it.velden?.binnen;

// Foto verkleinen tot max. 2000 px (JPEG), zo gaat een melding ook met weinig bereik door.
async function verklein(bestand) {
  try {
    const bmp = await createImageBitmap(bestand);
    const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob((b) => ok(b || bestand), 'image/jpeg', 0.82));
  } catch { return bestand; }
}

export default function Kaart({ planId, profiel, doel, onKiesPlan }) {
  const kaartRef = useRef(null);
  const mapRef = useRef(null);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [klaar, setKlaar] = useState(false);
  const [fase, setFase] = useState('');
  const [verborgen, setVerborgen] = useState(() => new Set());
  const [ondergrond, setOndergrond] = useState(null);
  const [gekozen, setGekozen] = useState(null);
  const [paneel, setPaneel] = useState(null); // item | lagen | meten | melden | foto | wie | punt
  const [groot, setGroot] = useState(false);
  const [zoek, setZoek] = useState('');
  const [veldpunten, setVeldpunten] = useState([]);
  const [puntKeuze, setPuntKeuze] = useState(null);
  const [mijn, setMijn] = useState(null); // { punt, acc, t }
  const [volg, setVolg] = useState(false);
  const [deelt, setDeelt] = useState(false);
  const [aanwezig, setAanwezig] = useState([]);
  // Meten
  const [meetSoort, setMeetSoort] = useState('lijn');
  const [meetPunten, setMeetPunten] = useState([]);
  // Melden
  const [pin, setPin] = useState(null);
  const [pinItem, setPinItem] = useState(null);
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  // Foto
  const [foto, setFoto] = useState(null); // { blob, url, punt, acc, item, soort, notitie }
  const fotoInput = useRef(null);
  const fotoVoorItem = useRef(null);
  // Verplaatsen (vizier in het midden, zoals in Publitool: de kaart schuift eronder)
  const [verpl, setVerpl] = useState(null); // { ids, c0, hoek }
  const verplRef = useRef(null); verplRef.current = verpl;
  // Delen
  const [links, setLinks] = useState(null);
  const [groot3d, setGroot3d] = useState(null);
  const [binnen, setBinnen] = useState(null); // { host, verd }
  const [nieuweLink, setNieuweLink] = useState(null); // { naam, soort, lagen: 'alle'|'zicht' }
  // Item
  const [opm, setOpm] = useState([]);
  const [fotos, setFotos] = useState([]);

  const schrijven = magSchrijven(profiel);
  const paneelRef = useRef(null); paneelRef.current = paneel;
  const itemsRef = useRef([]);
  const liveRef = useRef(null);

  // ---------- Laden (met kopie op het toestel voor zonder bereik) ----------
  useEffect(() => {
    if (!planId) return;
    let weg = false;
    setData(null); setFout(''); setGekozen(null); setPaneel(null); setKlaar(false);
    (async () => {
      const sleutel = `fm-mob-p-${planId}`;
      try {
        const [p, l, f, i, b, v] = await Promise.all([
          maps().from('plannen').select('*').eq('id', planId).maybeSingle(),
          maps().from('lagen').select('*').eq('plan_id', planId).order('volgorde'),
          maps().from('fasen').select('*').eq('plan_id', planId).order('volgorde'),
          maps().from('items').select('*').eq('plan_id', planId).order('volgorde'),
          maps().from('bibliotheek').select('*').or(`plan_id.is.null,plan_id.eq.${planId}`),
          maps().from('opmerkingen').select('id, tekst, auteur_naam, status, punt, item_id, created_at').eq('plan_id', planId).not('punt', 'is', null).order('created_at'),
        ]);
        const e = [p, l, f, i, b].find((r) => r.error);
        if (e) throw e.error;
        if (!p.data) throw new Error('Dit plan bestaat niet (meer).');
        const d = { plan: p.data, lagen: l.data || [], fasen: f.data || [], items: i.data || [], elementen: b.data || [] };
        if (weg) return;
        setData({ ...d, elementen: metTekeningen(d.elementen) });
        setVeldpunten(v.data || []);
        try { localStorage.setItem(sleutel, JSON.stringify({ ...d, op: Date.now() })); } catch { /* te groot: dan niet offline */ }
      } catch (err) {
        const oud = leesJson(sleutel, null);
        if (weg) return;
        if (oud?.plan) {
          setData({ ...oud, elementen: metTekeningen(oud.elementen || []) });
          setMelding(`Geen verbinding: plan van ${new Date(oud.op).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}.`);
        } else setFout(foutTekst(err));
      }
    })();
    return () => { weg = true; };
  }, [planId]);

  useEffect(() => {
    const stuur = () => {
      verstuurWachtrij().then((n) => { if (n) setMelding(`${n} ${n === 1 ? 'melding' : 'meldingen'} van zonder bereik verstuurd.`); }).catch(() => {});
      verstuurVerplaatsingen().then((n) => { if (n) setMelding(`${n} ${n === 1 ? 'verplaatsing' : 'verplaatsingen'} van zonder bereik bewaard.`); }).catch(() => {});
    };
    stuur();
    window.addEventListener('online', stuur);
    return () => window.removeEventListener('online', stuur);
  }, []);

  const lagenMap = useMemo(() => new Map((data?.lagen || []).map((l) => [l.id, l])), [data]);
  const elMap = useMemo(() => new Map((data?.elementen || []).map((e) => [e.id, e])), [data]);
  const items = useMemo(() => (data?.items || []).filter((i) => !i.verborgen), [data]);
  itemsRef.current = items;
  const zichtbaar = useMemo(() => items.filter((i) => !verborgen.has(i.laag_id) && (!fase || !i.fase_ids?.length || i.fase_ids.includes(fase))), [items, verborgen, fase]);
  const naamItem = useCallback((i) => i?.naam || elMap.get(i?.element_id)?.naam || ({ lijn: 'Lijn', vlak: 'Vlak', punt: 'Punt', tekst: 'Tekst' })[i?.soort] || 'Item', [elMap]);
  const item = gekozen ? items.find((x) => x.id === gekozen) : null;
  // Gebouwen, tenten en containers met een binnenplan: daar kan je binnengaan (zoals in de deellink).
  const binnenHosts = useMemo(() => {
    const alle = data?.items || [];
    const tel = new Set(alle.filter((i) => i.velden?.binnen?.host).map((i) => i.velden.binnen.host));
    const ols = new Set((data?.plan?.instellingen?.onderleggers || []).map((o) => o.binnen?.host).filter(Boolean));
    return new Set(alle.filter((i) => !i.velden?.binnen && i.geometrie && (tel.has(i.id) || ols.has(i.id))).map((i) => i.id));
  }, [data]);

  // ---------- Kaart ----------
  useEffect(() => {
    if (!data || !kaartRef.current || mapRef.current) return undefined;
    registreerProtocollen();
    kiesFotoVl(data.plan.instellingen);
    const start = data.plan.basiskaart || 'luchtfoto';
    setOndergrond(start);
    const map = new maplibregl.Map({ container: kaartRef.current, style: basisStijl(start, data.plan.centrum), center: data.plan.centrum || [4.4, 50.9], zoom: Number(data.plan.zoom) || 17, maxZoom: 21, dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true } });
    klapBronvermeldingIn(map);
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      map.addSource('fm-vormen', { type: 'geojson', data: leeg });
      map.addSource('fm-labels', { type: 'geojson', data: leeg });
      for (const l of kaartLagen(map.getCenter().lat)) map.addLayer(l);
      map.addSource('mb-keuze', { type: 'geojson', data: leeg });
      map.addLayer({ id: 'mb-keuze-v', type: 'fill', source: 'mb-keuze', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#108AED', 'fill-opacity': 0.16 } });
      map.addLayer({ id: 'mb-keuze-l', type: 'line', source: 'mb-keuze', paint: { 'line-color': '#108AED', 'line-width': 4 } });
      map.addLayer({ id: 'mb-keuze-p', type: 'circle', source: 'mb-keuze', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 12, 'circle-color': 'rgba(16,138,237,0.2)', 'circle-stroke-color': '#108AED', 'circle-stroke-width': 3 } });
      zorgVoorVeldpuntLagen(map);
      zorgVoorMeetLagen(map);
      map.addSource('mb-voorbeeld', { type: 'geojson', data: leeg });
      map.addLayer({ id: 'mb-voorbeeld-v', type: 'fill', source: 'mb-voorbeeld', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#108AED', 'fill-opacity': 0.28 } });
      map.addLayer({ id: 'mb-voorbeeld-l', type: 'line', source: 'mb-voorbeeld', paint: { 'line-color': '#108AED', 'line-width': 3 } });
      map.addLayer({ id: 'mb-voorbeeld-p', type: 'circle', source: 'mb-voorbeeld', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 9, 'circle-color': '#108AED', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      map.addSource('mb-pin', { type: 'geojson', data: leeg });
      map.addLayer({ id: 'mb-pin', type: 'circle', source: 'mb-pin', paint: { 'circle-radius': 10, 'circle-color': '#C77700', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      map.addSource('mb-ik', { type: 'geojson', data: leeg });
      map.addLayer({ id: 'mb-ik-acc', type: 'circle', source: 'mb-ik', paint: { 'circle-radius': ['get', 'r'], 'circle-color': '#108AED', 'circle-opacity': 0.14, 'circle-pitch-alignment': 'map' } });
      map.addLayer({ id: 'mb-ik', type: 'circle', source: 'mb-ik', paint: { 'circle-radius': 8, 'circle-color': '#108AED', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      setKlaar(true);
      const k = kader(itemsRef.current.map((i) => i.geometrie));
      if (k && !data.plan.centrum) map.fitBounds(k, { padding: 40, maxZoom: 18, duration: 0 });
    });
    map.on('move', () => { if (verplRef.current) toonVoorbeeldRef.current?.(); });
    map.on('click', (e) => {
      const m = paneelRef.current;
      if (m === 'verplaats') return;
      if (m === 'meten') {
        // Vastklikken op de dichtste hoek van een item (binnen 18 px).
        let p = [e.lngLat.lng, e.lngLat.lat];
        try {
          const lagen = ITEMLAGEN.filter((l) => map.getLayer(l)); const R = 18; let best = R;
          for (const f of map.queryRenderedFeatures([[e.point.x - R, e.point.y - R], [e.point.x + R, e.point.y + R]], { layers: lagen })) {
            for (const c of turf.coordAll(f)) { const q = map.project(c); const d = Math.hypot(q.x - e.point.x, q.y - e.point.y); if (d < best) { best = d; p = c; } }
          }
        } catch { /* */ }
        setMeetPunten((l) => [...l, p]);
        return;
      }
      if (m === 'melden') { setPin([e.lngLat.lng, e.lngLat.lat]); return; }
      if (m === 'foto') return;
      // Veldpunt (melding op een plek): ruime zone voor de vinger.
      if (map.getLayer('fm-veldpunt')) {
        const R = 20;
        const vp = map.queryRenderedFeatures([[e.point.x - R, e.point.y - R], [e.point.x + R, e.point.y + R]], { layers: ['fm-veldpunt'] }).find((f) => f.properties?.id);
        if (vp) { setGekozen(null); setPuntKeuze(vp.properties.id); setPaneel('punt'); setGroot(false); return; }
      }
      const it = hitOp(map, e.point, itemsRef.current);
      if (it) { setGekozen(it.id); setPaneel('item'); setGroot(false); } else if (paneelRef.current === 'item' || paneelRef.current === 'punt') { setGekozen(null); setPaneel(null); }
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; setKlaar(false); };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klaar || !data) return;
    const { vormen, labels } = naarGeojson(items.filter((i) => !i.velden?.binnen), lagenMap, elMap, { verborgenLagen: verborgen, actieveFase: fase || null, verbergElementen: data.plan?.instellingen?.verborgen_elementen });
    zorgVoorPatronen(map, vormen.features, labels.features);
    map.getSource('fm-vormen')?.setData(vormen);
    map.getSource('fm-labels')?.setData(labels);
  }, [items, lagenMap, elMap, verborgen, fase, klaar, data]);

  useEffect(() => { if (mapRef.current && klaar && ondergrond) zetOndergrond(mapRef.current, ondergrond); }, [ondergrond, klaar]);
  useEffect(() => { const m = mapRef.current; if (m && klaar) { zorgVoorVeldpuntLagen(m); zetVeldpunten(m, veldpunten.filter((o) => o.status === 'open')); } }, [veldpunten, klaar, ondergrond]);
  useEffect(() => {
    const m = mapRef.current; if (!m || !klaar) return;
    m.getSource('mb-keuze')?.setData(item?.geometrie ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: item.geometrie, properties: {} }] } : leeg);
  }, [item, klaar]);
  useEffect(() => { const m = mapRef.current; if (m && klaar) m.getSource('mb-pin')?.setData(paneel === 'melden' && pin ? { type: 'Feature', geometry: { type: 'Point', coordinates: pin }, properties: {} } : leeg); }, [pin, paneel, klaar]);
  const meetLijst = meetSoort === 'mij' && mijn ? [mijn.punt, ...meetPunten] : meetPunten;
  useEffect(() => { const m = mapRef.current; if (m && klaar) m.getSource('fm-deelmeet')?.setData(paneel === 'meten' ? meetGeometrie(meetLijst, meetSoort === 'vlak') : leeg); }, [paneel, meetLijst, meetSoort, klaar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = mapRef.current; if (!m || !klaar) return;
    if (!mijn) { m.getSource('mb-ik')?.setData(leeg); return; }
    const mpp = (156543.03 * Math.cos((mijn.punt[1] * Math.PI) / 180)) / 2 ** m.getZoom();
    m.getSource('mb-ik')?.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: mijn.punt }, properties: { r: Math.min(200, Math.max(8, (mijn.acc || 10) / mpp)) } });
  }, [mijn, klaar]);

  // Van een melding of zoekresultaat naar de plek op de kaart.
  useEffect(() => {
    if (!klaar || !doel) return;
    const map = mapRef.current;
    if (doel.item) { const it = itemsRef.current.find((x) => x.id === doel.item); if (it) { setGekozen(it.id); setPaneel('item'); map.easeTo({ center: middelpunt(it.geometrie), zoom: Math.max(map.getZoom(), 18.5) }); } }
    if (doel.punt) { map.easeTo({ center: doel.punt, zoom: Math.max(map.getZoom(), 18.5) }); if (doel.id) { setPuntKeuze(doel.id); setPaneel('punt'); } }
    if (doel.paneel === 'delen' && magSchrijven(profiel)) openDelen();
  }, [klaar, doel]);

  // ---------- Gps ----------
  useEffect(() => {
    if (!volg || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => setMijn({ punt: [p.coords.longitude, p.coords.latitude], acc: Math.round(p.coords.accuracy || 50), t: Date.now() }),
      () => setMelding('Je locatie is niet beschikbaar. Geef de app toegang tot je locatie in de instellingen van je gsm.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [volg]);
  const eersteKeer = useRef(true);
  const waarBenIk = () => {
    setVolg(true);
    if (mijn && mapRef.current) mapRef.current.easeTo({ center: mijn.punt, zoom: Math.max(mapRef.current.getZoom(), 18) });
    else eersteKeer.current = true;
  };
  useEffect(() => {
    if (mijn && eersteKeer.current && volg && mapRef.current && !deelt) { eersteKeer.current = false; mapRef.current.easeTo({ center: mijn.punt, zoom: Math.max(mapRef.current.getZoom(), 18) }); }
  }, [mijn, volg, deelt]);

  // ---------- Wie is waar (enkel eigen organisatie, zelf aan te zetten, uit na vandaag) ----------
  useEffect(() => {
    const d = leesJson(DEEL, null);
    if (d && d.plan === planId && d.tot > Date.now()) { setDeelt(true); setVolg(true); } else if (d) zetJson(DEEL, null);
  }, [planId]);
  useEffect(() => {
    if (!deelt) return undefined;
    const t = setInterval(() => { const d = leesJson(DEEL, null); if (!d || d.tot < Date.now()) { setDeelt(false); zetJson(DEEL, null); } }, 60000);
    return () => clearInterval(t);
  }, [deelt]);
  useEffect(() => {
    if (!data || !profiel?.id || !planId) return undefined;
    const live = startLive({
      client: sb(), planId, sleutel: `${profiel.id}:${Math.random().toString(36).slice(2, 8)}`,
      onItem: (it) => setData((d) => (d ? { ...d, items: d.items.some((x) => x.id === it.id) ? d.items.map((x) => (x.id === it.id ? it : x)) : [...d.items, it] } : d)),
      onWeg: (w) => setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== w.id) } : d)),
      onAanwezig: (st) => {
        const per = new Map();
        for (const lijst of Object.values(st || {})) for (const m of lijst || []) if (m?.pos && m.uid && m.uid !== profiel.id && (!per.has(m.uid) || per.get(m.uid).t < m.t)) per.set(m.uid, m);
        setAanwezig([...per.values()]);
      },
    });
    liveRef.current = live;
    return () => { live.stop(); liveRef.current = null; setAanwezig([]); };
  }, [!!data, profiel?.id, planId]); // eslint-disable-line react-hooks/exhaustive-deps
  const laatstGedeeld = useRef(0);
  useEffect(() => {
    if (!liveRef.current || !profiel?.id) return;
    const basis = { uid: profiel.id, naam: naamVan(profiel), kleur: kleurVoor(profiel.id), mobiel: true, sinds: Date.now() };
    if (!deelt || !mijn) { liveRef.current.deel(basis); return; }
    if (Date.now() - laatstGedeeld.current < 4000) return;
    laatstGedeeld.current = Date.now();
    liveRef.current.deel({ ...basis, pos: mijn.punt, acc: mijn.acc, t: mijn.t, ini: initialen(profiel) });
  }, [deelt, mijn, profiel, klaar]);
  const markers = useRef(new Map());
  useEffect(() => {
    const map = mapRef.current; if (!map || !klaar) return;
    const nu = new Set();
    for (const a of aanwezig) {
      nu.add(a.uid);
      let mk = markers.current.get(a.uid);
      if (!mk) { const el = document.createElement('div'); el.className = 'mb-persoon'; mk = new maplibregl.Marker({ element: el }).setLngLat(a.pos).addTo(map); markers.current.set(a.uid, mk); }
      const el = mk.getElement();
      el.textContent = a.ini || initialen({ naam: a.naam }); el.style.background = a.kleur || '#022056'; el.title = a.naam || '';
      el.classList.toggle('oud', Date.now() - (a.t || 0) > 5 * 60000);
      mk.setLngLat(a.pos);
    }
    for (const [uid, mk] of markers.current) if (!nu.has(uid)) { mk.remove(); markers.current.delete(uid); }
  }, [aanwezig, klaar]);
  const zetDelen = (aan) => {
    setDeelt(aan);
    if (aan) { zetJson(DEEL, { plan: planId, tot: eindeVanDag() }); setVolg(true); } else { zetJson(DEEL, null); liveRef.current?.deel({ uid: profiel?.id, naam: naamVan(profiel), kleur: kleurVoor(profiel?.id), mobiel: true, sinds: Date.now() }); }
  };

  // ---------- Item ----------
  useEffect(() => {
    setOpm([]); setFotos([]);
    if (!gekozen) return undefined;
    let weg = false;
    maps().from('opmerkingen').select('id, tekst, auteur_naam, status, created_at').eq('item_id', gekozen).order('created_at').then(({ data: d }) => { if (!weg) setOpm(d || []); });
    maps().from('bestanden').select('id, pad, meta, created_at').eq('item_id', gekozen).eq('soort', 'foto').order('created_at', { ascending: false }).limit(9).then(({ data: d }) => { if (!weg) setFotos(d || []); });
    return () => { weg = true; };
  }, [gekozen]);
  const zetGeplaatst = async (it) => {
    const patch = it.geplaatst_op ? { geplaatst_op: null, geplaatst_door: null } : { geplaatst_op: new Date().toISOString(), geplaatst_door: profiel?.id || null };
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)) }));
    const { error } = await maps().from('items').update(patch).eq('id', it.id);
    if (error) { setMelding(foutTekst(error)); setData((d) => ({ ...d, items: d.items.map((x) => (x.id === it.id ? it : x)) })); }
  };

  // ---------- Melden ----------
  const startMelden = (it = null) => {
    setPaneel('melden'); setGroot(false); setTekst(''); setPinItem(it?.id || null);
    if (it) {
      // Bij een lange lijn (hekken, parcours): het punt van de lijn het dichtst bij het midden van het scherm.
      const c = mapRef.current?.getCenter().toArray();
      const g = it.geometrie;
      setPin(g?.type === 'LineString' && c ? turf.nearestPointOnLine(g, c).geometry.coordinates : middelpunt(g));
    }
    else if (mijn && Date.now() - mijn.t < 60000) setPin(mijn.punt);
    else { setPin(mapRef.current ? mapRef.current.getCenter().toArray() : null); setVolg(true); }
  };
  const verstuurMelding = async () => {
    if (!pin || !tekst.trim()) return;
    setBezig(true);
    const rij = { plan_id: planId, item_id: pinItem, punt: pin, tekst: tekst.trim(), auteur_id: profiel?.id || null, auteur_naam: naamVan(profiel) };
    let error = null;
    try { ({ error } = await maps().from('opmerkingen').insert(rij)); } catch (e) { error = { offline: true, message: String(e) }; }
    setBezig(false);
    if (error && (error.offline || !navigator.onLine || /fetch/i.test(error.message || ''))) {
      zetJson(WACHTRIJ, [...leesJson(WACHTRIJ, []), rij]);
      setMelding('Geen bereik: je melding wordt verstuurd zodra er netwerk is.');
    } else if (error) { setMelding(foutTekst(error)); return; } else setMelding('Melding verstuurd. De plannenmaker ziet ze op het plan.');
    setVeldpunten((l) => [...l, { id: `nieuw-${Date.now()}`, ...rij, status: 'open' }]);
    setPaneel(null); setPin(null); setTekst('');
  };

  // ---------- Foto op de plek ----------
  const kiesFoto = (it = null) => { fotoVoorItem.current = it?.id || null; setVolg(true); fotoInput.current?.click(); };
  const dichtste = useCallback((punt, n = 5) => (punt ? zichtbaar.filter((i) => i.soort !== 'tekst' && i.geometrie).map((i) => ({ i, d: afstand(punt, middelpunt(i.geometrie)) })).sort((a, b) => a.d - b.d).slice(0, n) : []), [zichtbaar]);
  const fotoGekozen = async (bestand) => {
    if (!bestand) return;
    const blob = await verklein(bestand);
    const vers = mijn && Date.now() - mijn.t < 60000;
    const punt = vers ? mijn.punt : mapRef.current?.getCenter().toArray() || null;
    const vast = fotoVoorItem.current;
    const item0 = vast || dichtste(punt, 1)[0]?.i.id || null;
    setFoto({ blob, url: URL.createObjectURL(blob), punt, acc: vers ? mijn.acc : null, item: item0, soort: 'opbouw', notitie: '' });
    setPaneel('foto'); setGroot(false); setGekozen(null);
  };
  const bewaarFoto = async () => {
    if (!foto) return;
    setBezig(true);
    try {
      const pad = `${planId}/foto/${foto.item || 'plek'}-${Date.now()}.jpg`;
      const { error } = await sb().storage.from(BUCKET).upload(pad, foto.blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const r = await maps().from('bestanden').insert({ plan_id: planId, item_id: foto.item, soort: 'foto', pad, meta: { door: profiel?.email || null, naam: naamVan(profiel), soort: foto.soort, notitie: foto.notitie || null, punt: foto.punt, acc: foto.acc, op: new Date().toISOString() } });
      if (r.error) throw r.error;
      setMelding('Foto bewaard bij het item.');
      URL.revokeObjectURL(foto.url); setFoto(null); setPaneel(null);
    } catch (err) {
      setMelding(!navigator.onLine ? 'Geen bereik: de foto is niet bewaard. Probeer opnieuw met netwerk.' : foutTekst(err));
    } finally { setBezig(false); }
  };

  // ---------- Verplaatsen ----------
  // Een item van een groep (bv. units van een containerbouw) gaat samen met de rest van de groep.
  const groepVan = useCallback((it) => (it?.groep_id ? items.filter((x) => x.groep_id === it.groep_id && magVerplaatsen(x)) : [it]), [items]);
  const nieuweStand = useCallback((v, c1) => {
    const dx = c1[0] - v.c0[0]; const dy = c1[1] - v.c0[1];
    return v.ids.map((id) => items.find((x) => x.id === id)).filter(Boolean).map((it) => {
      let n = { ...it, geometrie: verschuifGraden(it.geometrie, dx, dy), parameters: it.parameters?.midden ? { ...it.parameters, midden: [it.parameters.midden[0] + dx, it.parameters.midden[1] + dy] } : it.parameters };
      if (v.hoek) n = draaiRond(n, v.hoek, c1, data?.elementen || []);
      return n;
    });
  }, [items, data]);
  const toonVoorbeeldRef = useRef(null);
  toonVoorbeeldRef.current = () => {
    const map = mapRef.current; const v = verplRef.current; if (!map || !v) return;
    const st = nieuweStand(v, map.getCenter().toArray());
    map.getSource('mb-voorbeeld')?.setData({ type: 'FeatureCollection', features: st.map((x) => ({ type: 'Feature', geometry: x.geometrie, properties: {} })) });
  };
  useEffect(() => { if (klaar) { if (verpl) toonVoorbeeldRef.current?.(); else mapRef.current?.getSource('mb-voorbeeld')?.setData(leeg); } }, [verpl, klaar]);
  const startVerplaats = (it) => {
    const groep = groepVan(it);
    const k = kader(groep.map((x) => x.geometrie));
    const c0 = k ? [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2] : middelpunt(it.geometrie);
    setVerpl({ ids: groep.map((x) => x.id), c0, hoek: 0, naam: groep.length > 1 ? `${groep.length} delen van de groep` : naamItem(it) });
    setPaneel('verplaats'); setGroot(false);
    mapRef.current?.easeTo({ center: c0, zoom: Math.max(mapRef.current.getZoom(), 18.5), duration: 300 });
  };
  const draaiVerpl = (d) => setVerpl((v) => ({ ...v, hoek: (((v.hoek + d) % 360) + 360) % 360 }));
  const verplNaarMij = () => { if (mijn) mapRef.current?.easeTo({ center: mijn.punt }); else { setVolg(true); setMelding('Je locatie zoeken…'); } };
  const bewaarVerplaats = async () => {
    const v = verplRef.current; const map = mapRef.current; if (!v || !map) return;
    const c1 = map.getCenter().toArray();
    if (afstand(v.c0, c1) < 0.05 && !v.hoek) { setVerpl(null); setPaneel('item'); return; }
    const st = nieuweStand(v, c1);
    const oud = new Map(items.map((x) => [x.id, x]));
    setData((d) => ({ ...d, items: d.items.map((x) => st.find((y) => y.id === x.id) || x) }));
    setVerpl(null); setPaneel('item'); setBezig(true);
    let botsing = null; let offline = false;
    for (const n of st) {
      const patch = { geometrie: n.geometrie, parameters: n.parameters };
      let r;
      try { r = await maps().rpc('item_wijzig', { p_id: n.id, p_rev: oud.get(n.id)?.rev ?? null, p_patch: patch }); } catch (e) { r = { error: { offline: true, message: String(e) } }; }
      if (r.error && (r.error.offline || !navigator.onLine || /fetch/i.test(r.error.message || ''))) {
        const w = leesJson(VERPLAATS, {}); w[n.id] = patch; zetJson(VERPLAATS, w); offline = true; continue;
      }
      if (r.error) { setMelding(foutTekst(r.error)); setData((d) => ({ ...d, items: d.items.map((x) => (x.id === n.id ? oud.get(n.id) : x)) })); continue; }
      const sts = r.data?.status;
      if (sts === 'ok' || sts === 'samengevoegd') setData((d) => ({ ...d, items: d.items.map((x) => (x.id === n.id ? r.data.item : x)) }));
      else if (sts === 'botsing') { botsing = r.data.door || 'een collega'; setData((d) => ({ ...d, items: d.items.map((x) => (x.id === n.id ? r.data.item : x)) })); }
      else if (sts === 'weg' || sts === 'verwijderd') setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== n.id) }));
    }
    setBezig(false);
    setMelding(botsing ? `Niet verplaatst: ${typeof botsing === 'string' ? botsing : 'een collega'} wijzigde dit item net. Bekijk de nieuwe plek en probeer opnieuw.` : offline ? 'Geen bereik: de nieuwe plek wordt bewaard zodra er netwerk is.' : 'Verplaatst.');
  };
  const annuleerVerplaats = () => { setVerpl(null); setPaneel(gekozen ? 'item' : null); };

  // ---------- Delen ----------
  const laadLinks = useCallback(() => {
    maps().from('deel_links').select('id, naam, token, live, opties, ingetrokken_op, geldig_tot, created_at').eq('plan_id', planId).order('created_at', { ascending: false })
      .then(({ data: d, error }) => { if (error) setMelding(foutTekst(error)); setLinks(d || []); });
  }, [planId]);
  const openDelen = () => { setPaneel('delen'); setGroot(true); setNieuweLink(null); setLinks(null); laadLinks(); };
  const linkUrl = (t) => `${location.origin}/d/${t}`;
  const deelLink = async (l) => {
    const url = linkUrl(l.token);
    try {
      if (navigator.share) await navigator.share({ title: `${data?.plan?.naam || 'Plan'} · ${l.naam}`, url });
      else { await navigator.clipboard.writeText(url); setMelding('Link gekopieerd.'); }
    } catch { /* geannuleerd */ }
  };
  const trekIn = async (l) => {
    const { data: d, error } = await maps().from('deel_links').update({ ingetrokken_op: l.ingetrokken_op ? null : new Date().toISOString() }).eq('id', l.id).select('id, naam, token, live, opties, ingetrokken_op, geldig_tot, created_at').single();
    if (error) { setMelding(foutTekst(error)); return; }
    setLinks((ls) => ls.map((x) => (x.id === l.id ? d : x)));
  };
  const maakLink = async () => {
    const n = nieuweLink; if (!n?.naam.trim() || !data) return;
    setBezig(true);
    try {
      const s = soortenVoorPakket().find((x) => x.id === n.soort) || soortenVoorPakket()[0];
      const v = await maps().from('versies').insert({ plan_id: planId, versie: data.plan.versie || 1, opmerking: `Gedeeld met ${n.naam.trim()}`, momentopname: { items: data.items, lagen: data.lagen, fasen: data.fasen } }).select('id').single();
      if (v.error) throw v.error;
      const onderdeel = { id: nieuwId(), soort: 'plan', naam: data.plan.naam, ...(n.lagen === 'zicht' ? { laag_ids: data.lagen.filter((l) => !verborgen.has(l.id)).map((l) => l.id) } : {}), ...(fase ? { fase } : {}) };
      const rij = { plan_id: planId, naam: n.naam.trim(), live: false, versie_id: v.data.id, ...rijMetOnderdelen({ opties: { ...s.opties, taal: 'nl', ontvanger: { soort: s.id } } }, [onderdeel], data.lagen) };
      const r = await maps().from('deel_links').insert(rij).select('id, naam, token, live, opties, ingetrokken_op, geldig_tot, created_at').single();
      if (r.error) throw r.error;
      setLinks((ls) => [r.data, ...(ls || [])]); setNieuweLink(null);
      deelLink(r.data);
    } catch (err) { setMelding(foutTekst(err)); } finally { setBezig(false); }
  };

  // ---------- Zoeken ----------
  const z = zoek.trim().toLowerCase();
  const zoekRes = useMemo(() => {
    if (!z) return [];
    return items.filter((i) => i.soort !== 'tekst' && `${naamItem(i)} ${lagenMap.get(i.laag_id)?.naam || ''} ${i.notitie || ''}`.toLowerCase().includes(z)).slice(0, 30);
  }, [z, items, naamItem, lagenMap]);
  const naarItem = (it) => {
    setZoek(''); setGekozen(it.id); setPaneel('item'); setGroot(false);
    const map = mapRef.current; if (!map) return;
    const k = kader([it.geometrie]);
    if (k && (k[2] - k[0] > 0.0004 || k[3] - k[1] > 0.0004)) map.fitBounds(k, { padding: { top: 80, bottom: 320, left: 40, right: 40 }, maxZoom: 19 });
    else map.easeTo({ center: middelpunt(it.geometrie), zoom: Math.max(map.getZoom(), 18.5) });
  };

  // ---------- Weergave ----------
  if (!planId) {
    return (
      <>
        <header className="mb-kop"><h1>Kaart</h1></header>
        <main className="mb-inhoud"><div className="mb-leeg"><p>Kies eerst een plan.</p><button type="button" className="mb-knop hoofd" onClick={onKiesPlan}>Naar de plannen</button></div></main>
      </>
    );
  }
  const plan = data?.plan;
  const fasen = data?.fasen || [];
  const sluit = () => { setPaneel(null); setGekozen(null); setPuntKeuze(null); setMeetPunten([]); if (foto?.url) URL.revokeObjectURL(foto.url); setFoto(null); };
  const tool = (naam, I, onClick, aan = false) => (
    <button type="button" className={`mb-rond${aan ? ' aan' : ''}`} aria-label={naam} title={naam} aria-pressed={aan} onClick={onClick}><I /></button>
  );
  const meetL = meetLijst.length >= 2 ? lengte({ type: 'LineString', coordinates: meetSoort === 'vlak' && meetLijst.length >= 3 ? [...meetLijst, meetLijst[0]] : meetLijst }) : 0;
  const meetA = meetSoort === 'vlak' && meetLijst.length >= 3 ? oppervlakte({ type: 'Polygon', coordinates: [[...meetLijst, meetLijst[0]]] }) : 0;
  const punt = puntKeuze ? veldpunten.find((o) => o.id === puntKeuze) : null;

  return (
    <>
      <header className="mb-kop terug">
        <button type="button" className="mb-terug" aria-label="Terug naar de plannen" onClick={onKiesPlan}><Ic.terug /></button>
        <h1>{plan?.naam || 'Plan laden…'}</h1>
        {fasen.length > 0 && (
          <select className="mb-kopknop" value={fase} onChange={(e) => setFase(e.target.value)} aria-label="Fase">
            <option value="">Alle fasen</option>
            {fasen.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}
          </select>
        )}
      </header>
      <div className="mb-kaart">
        {fout && <div className="mb-pad"><div className="mb-melding fout">{fout}</div><button type="button" className="mb-knop" onClick={onKiesPlan}>Ander plan kiezen</button></div>}
        <div ref={kaartRef} className="mb-map" />
        {!paneel && data && (
          <div className="mb-zweef" style={{ left: 'var(--mb-rand)', right: 'var(--mb-rand)', top: 16 }}>
            <label className="mb-zoek"><Ic.zoek /><input type="search" placeholder="Zoek: kast, hek, tent…" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoek in het plan" /></label>
            {z && (
              <div className="mb-lijst mb-zoekres">
                {zoekRes.length ? zoekRes.map((i) => {
                  const l = lagenMap.get(i.laag_id);
                  return (
                    <button key={i.id} type="button" className="mb-rij" onClick={() => naarItem(i)}>
                      <span className="mb-stip" style={{ background: l?.kleur || '#8492A8' }} />
                      <span><b>{naamItem(i)}{isSign(i) ? ` (punt ${i.velden.sign.nr})` : ''}</b><small>{[l?.naam, mijn ? meters(afstand(mijn.punt, middelpunt(i.geometrie))) : ''].filter(Boolean).join(' · ')}</small></span>
                    </button>
                  );
                }) : <p className="mb-leeg" style={{ padding: 16 }}>Niets gevonden.</p>}
              </div>
            )}
          </div>
        )}
        {paneel === 'melden' && <div className="mb-zweef mb-hint">Tik op de kaart om de plek te kiezen.</div>}
        {paneel === 'verplaats' && (
          <>
            <div className="mb-zweef mb-hint">Schuif de kaart tot het kruis op de juiste plek staat. Twee vingers om te zoomen.</div>
            <div className="mb-vizier" aria-hidden="true" />
          </>
        )}
        {paneel === 'meten' && <div className="mb-zweef mb-hint">{meetSoort === 'mij' && !mijn ? 'Je locatie zoeken…' : 'Tik punten op de kaart. Ze klikken vast op hoeken van items.'}</div>}
        {melding && !paneel && (
          <div className="mb-zweef" style={{ left: 'var(--mb-rand)', right: 'calc(var(--mb-rand) + 64px)', bottom: 'calc(var(--mb-tabh) + 16px)' }}>
            <div className="mb-melding" role="status" onClick={() => setMelding('')}>{melding}</div>
          </div>
        )}
        {!paneel && data && (
          <div className="mb-zweef mb-gereedschap">
            {tool('Lagen en ondergrond', Ic.lagen, () => setPaneel('lagen'))}
            {tool('Meten', Ic.meten, () => { setPaneel('meten'); setMeetPunten([]); setMeetSoort('lijn'); setGekozen(null); })}
            {schrijven && tool('Foto op de plek', Ic.foto, () => kiesFoto())}
            {tool('Melden', Ic.melden, () => startMelden())}
            {schrijven && tool('Delen', Ic.deel, openDelen)}
            {tool('Wie is waar', Ic.wie, () => setPaneel('wie'), deelt)}
            {tool('Waar ben ik', Ic.ik, waarBenIk, volg && !!mijn)}
          </div>
        )}
        <input ref={fotoInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { fotoGekozen(e.target.files?.[0]); e.target.value = ''; }} />

        {paneel && (
          <section className={`mb-paneel${groot ? ' groot' : ''}`} aria-label="Paneel">
            <button type="button" className="mb-greep" aria-label={groot ? 'Kleiner' : 'Groter'} onClick={() => setGroot((g) => !g)} />
            <div className="mb-paneel-in">
              {paneel === 'item' && item && (() => {
                const el = elMap.get(item.element_id); const l = lagenMap.get(item.laag_id); const v = item.velden || {};
                const m = matenTekst(maten(item, el));
                const fn = (item.fase_ids || []).map((id) => fasen.find((f) => f.id === id)?.naam).filter(Boolean).join(', ');
                const nav = navigatieUrl(item.geometrie);
                const rijen = [['Leverancier', v.herkomst || item.herkomst], ['Plaatsen', v.opbouw], ['Weghalen', v.afbraak], ['Verantwoordelijke', v.verantwoordelijke], ['Contact', v.contact]].filter(([, w]) => w);
                return (
                  <>
                    <div>
                      <p className="mb-titel" style={{ fontSize: 20 }}>{naamItem(item)}</p>
                      <p className="mb-sub">{[l?.naam, fn && `fase ${fn}`, mijn ? `${meters(afstand(mijn.punt, middelpunt(item.geometrie)))} van jou` : ''].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="mb-feiten">
                      <div><small>Maat</small><b>{m || '–'}</b></div>
                      <div><small>Status</small><b>{item.geplaatst_op ? 'Geplaatst' : 'Nog te plaatsen'}</b></div>
                      <div><small>Meldingen</small><b>{opm.filter((o) => o.status === 'open').length}</b></div>
                    </div>
                    <div className="mb-knoppen">
                      <button type="button" className="mb-knop hoofd" onClick={() => startMelden(item)}><Ic.melden />Melden</button>
                      {nav ? <a className="mb-knop" href={nav} target="_blank" rel="noreferrer"><Ic.route />Route</a> : <span />}
                      {schrijven && <button type="button" className={`mb-knop${item.geplaatst_op ? ' ok' : ''}`} onClick={() => zetGeplaatst(item)}>{item.geplaatst_op ? 'Geplaatst' : 'Zet op geplaatst'}</button>}
                      {binnenHosts.has(item.id) && <button type="button" className="mb-knop" onClick={() => setBinnen({ host: item.id, verd: null })}><Ic.binnen />Binnengaan</button>}
                      {schrijven && magVerplaatsen(item) && <button type="button" className="mb-knop" onClick={() => startVerplaats(item)}><Ic.verplaats />Verplaatsen</button>}
                    </div>
                    {heeft3d(item, el) && <Knop3D it={item} el={el} elementenMap={elMap} onOpen={() => setGroot3d(item.id)} tekst="In 3D bekijken" />}
                    {(item.notitie || rijen.length > 0) && (
                      <dl className="mb-dl">
                        {item.notitie && <><dt>Notitie</dt><dd>{item.notitie}</dd></>}
                        {rijen.map(([k, w]) => <Fragment key={k}><dt>{k}</dt><dd>{w}</dd></Fragment>)}
                      </dl>
                    )}
                    {fotos.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                        {fotos.map((f) => <a key={f.id} href={publiekeUrl(f.pad)} target="_blank" rel="noreferrer" style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--t-vlak-2)' }}><img src={publiekeUrl(f.pad)} alt={f.meta?.notitie || 'Foto'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" /></a>)}
                      </div>
                    )}
                    {opm.length > 0 && (
                      <div className="mb-opm">
                        {opm.map((o) => <div key={o.id} style={o.status !== 'open' ? { opacity: 0.6 } : undefined}><small>{o.auteur_naam || 'Collega'} · {new Date(o.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}{o.status !== 'open' ? ' · opgelost' : ''}</small>{o.tekst}</div>)}
                      </div>
                    )}
                    <button type="button" className="mb-knop vol" onClick={sluit}>Sluiten</button>
                  </>
                );
              })()}

              {paneel === 'punt' && punt && (
                <>
                  <div><p className="mb-titel" style={{ fontSize: 20 }}>Melding</p><p className="mb-sub">{punt.auteur_naam || 'Collega'}{punt.created_at ? ` · ${new Date(punt.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}` : ''}{mijn ? ` · ${meters(afstand(mijn.punt, punt.punt))} van jou` : ''}</p></div>
                  <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{punt.tekst}</p>
                  <div className="mb-knoppen">
                    <a className="mb-knop" href={`https://www.google.com/maps/dir/?api=1&destination=${punt.punt[1].toFixed(6)},${punt.punt[0].toFixed(6)}`} target="_blank" rel="noreferrer"><Ic.route />Route</a>
                    {schrijven && !String(punt.id).startsWith('nieuw-') && (
                      <button type="button" className="mb-knop ok" onClick={async () => { const { error } = await maps().from('opmerkingen').update({ status: 'opgelost' }).eq('id', punt.id); if (error) setMelding(foutTekst(error)); else { setVeldpunten((l) => l.map((x) => (x.id === punt.id ? { ...x, status: 'opgelost' } : x))); sluit(); } }}>Opgelost</button>
                    )}
                  </div>
                  <button type="button" className="mb-knop vol" onClick={sluit}>Sluiten</button>
                </>
              )}

              {paneel === 'lagen' && (
                <>
                  <p className="mb-titel" style={{ fontSize: 20 }}>Lagen</p>
                  <div className="mb-segment" role="group" aria-label="Ondergrond">
                    {['luchtfoto', 'lijntekening', 'stratenkaart'].map((k) => <button key={k} type="button" className={ondergrond === k ? 'aan' : ''} onClick={() => setOndergrond(k)}>{ONDERGRONDEN[k]?.naam || k}</button>)}
                  </div>
                  <div className="mb-lijst">
                    {(data?.lagen || []).map((l) => (
                      <label key={l.id} className="mb-rij">
                        <span className="mb-stip" style={{ background: l.kleur || '#8492A8' }} />
                        <span><b>{l.naam}</b><small>{items.filter((i) => i.laag_id === l.id).length} items</small></span>
                        <input type="checkbox" checked={!verborgen.has(l.id)} style={{ width: 22, height: 22, accentColor: 'var(--t-blauw)' }} onChange={() => setVerborgen((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />
                      </label>
                    ))}
                  </div>
                  <button type="button" className="mb-knop vol" onClick={sluit}>Klaar</button>
                </>
              )}

              {paneel === 'meten' && (
                <>
                  <div className="mb-segment" role="group" aria-label="Soort meting">
                    {[['lijn', 'Afstand'], ['vlak', 'Oppervlakte'], ['mij', 'Vanaf mij']].map(([k, n]) => <button key={k} type="button" className={meetSoort === k ? 'aan' : ''} onClick={() => { setMeetSoort(k); if (k === 'mij') setVolg(true); }}>{n}</button>)}
                  </div>
                  <div className="mb-totaal">
                    <span className="mb-sub">{meetSoort === 'vlak' && meetLijst.length >= 3 ? 'Omtrek' : 'Totaal'} · {meetLijst.length} {meetLijst.length === 1 ? 'punt' : 'punten'}</span>
                    <strong>{meetL ? `${getal(meetL, meetL < 100 ? 1 : 0)} m` : '–'}</strong>
                  </div>
                  {meetA > 0 && <div className="mb-totaal"><span className="mb-sub">Oppervlakte</span><strong>{getal(meetA, meetA < 100 ? 1 : 0)} m²</strong></div>}
                  <div className="mb-knoppen drie">
                    <button type="button" className="mb-knop" disabled={!meetPunten.length} onClick={() => setMeetPunten((l) => l.slice(0, -1))}>Ongedaan</button>
                    <button type="button" className="mb-knop" disabled={!meetPunten.length} onClick={() => setMeetPunten([])}>Wissen</button>
                    <button type="button" className="mb-knop hoofd" onClick={sluit}>Klaar</button>
                  </div>
                </>
              )}

              {paneel === 'melden' && (
                <>
                  <div>
                    <p className="mb-titel" style={{ fontSize: 20 }}>Melding</p>
                    <p className="mb-sub">{pinItem ? `Bij ${naamItem(items.find((x) => x.id === pinItem))}` : 'Op de gekozen plek'}{pin && mijn ? ` · ${meters(afstand(mijn.punt, pin))} van jou` : ''}</p>
                  </div>
                  <label className="mb-veld">Wat is er?
                    <textarea rows={3} value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Bv. hek staat 2 m te ver" autoFocus />
                  </label>
                  <div className="mb-knoppen">
                    <button type="button" className="mb-knop" disabled={!mijn} onClick={() => { setPin(mijn.punt); setPinItem(null); }}>Op mijn plek</button>
                    <button type="button" className="mb-knop hoofd" disabled={!pin || !tekst.trim() || bezig} onClick={verstuurMelding}>{bezig ? 'Versturen…' : 'Versturen'}</button>
                  </div>
                  <button type="button" className="mb-knop vol" onClick={sluit}>Annuleren</button>
                </>
              )}

              {paneel === 'foto' && foto && (
                <>
                  <div className="mb-foto"><img src={foto.url} alt="Gekozen foto" /><span>{foto.acc ? `Gps ± ${foto.acc} m` : 'Plek: midden van de kaart'}</span></div>
                  <p className="mb-kopje">Bij welk item?</p>
                  <div className="mb-lijst">
                    {(() => {
                      const opties = dichtste(foto.punt, 4);
                      if (foto.item && !opties.some((o) => o.i.id === foto.item)) { const it = items.find((x) => x.id === foto.item); if (it) opties.unshift({ i: it, d: foto.punt ? afstand(foto.punt, middelpunt(it.geometrie)) : null }); }
                      return opties.map(({ i, d }) => (
                        <button key={i.id} type="button" className={`mb-rij${foto.item === i.id ? ' licht' : ''}`} aria-pressed={foto.item === i.id} onClick={() => setFoto({ ...foto, item: i.id })}>
                          <span className="mb-stip" style={{ background: lagenMap.get(i.laag_id)?.kleur || '#8492A8' }} />
                          <span><b>{naamItem(i)}</b><small>{d != null ? meters(d) : ''}</small></span>
                          {foto.item === i.id && <span className="mb-pijl">Gekozen</span>}
                        </button>
                      ));
                    })()}
                  </div>
                  <div className="mb-chips" role="group" aria-label="Soort">
                    {[['opbouw', 'Opbouw'], ['schade', 'Schade'], ['afbraak', 'Afbraak']].map(([k, n]) => <button key={k} type="button" className={foto.soort === k ? 'aan' : ''} onClick={() => setFoto({ ...foto, soort: k })}>{n}</button>)}
                  </div>
                  <label className="mb-veld">Notitie<input type="text" value={foto.notitie} placeholder="Optioneel" onChange={(e) => setFoto({ ...foto, notitie: e.target.value })} /></label>
                  <div className="mb-knoppen">
                    <button type="button" className="mb-knop" onClick={sluit}>Annuleren</button>
                    <button type="button" className="mb-knop hoofd" disabled={bezig || !foto.item} onClick={bewaarFoto}>{bezig ? 'Bewaren…' : 'Bewaren'}</button>
                  </div>
                </>
              )}

              {paneel === 'verplaats' && verpl && (
                <>
                  <div><p className="mb-titel" style={{ fontSize: 20 }}>Verplaatsen</p><p className="mb-sub">{verpl.naam}{verpl.hoek ? ` · ${verpl.hoek}° gedraaid` : ''}</p></div>
                  <div className="mb-knoppen drie">
                    <button type="button" className="mb-knop" onClick={() => draaiVerpl(-15)} aria-label="15 graden naar links draaien">↺ 15°</button>
                    <button type="button" className="mb-knop" onClick={() => draaiVerpl(90)} aria-label="Kwartslag draaien">90°</button>
                    <button type="button" className="mb-knop" onClick={() => draaiVerpl(15)} aria-label="15 graden naar rechts draaien">↻ 15°</button>
                  </div>
                  <button type="button" className="mb-knop vol" onClick={verplNaarMij}><Ic.ik maat={18} />Naar mijn plek</button>
                  <div className="mb-knoppen">
                    <button type="button" className="mb-knop" onClick={annuleerVerplaats}>Annuleren</button>
                    <button type="button" className="mb-knop hoofd" onClick={bewaarVerplaats}>Bewaren</button>
                  </div>
                </>
              )}

              {paneel === 'delen' && (
                <>
                  <div><p className="mb-titel" style={{ fontSize: 20 }}>Delen</p><p className="mb-sub">Een link per ontvanger. Wie de link heeft, ziet het plan zonder account.</p></div>
                  {nieuweLink ? (
                    <>
                      <label className="mb-veld">Voor wie<input type="text" value={nieuweLink.naam} placeholder="Bv. tentenbouwer, politie" autoFocus onChange={(e) => setNieuweLink({ ...nieuweLink, naam: e.target.value })} /></label>
                      <div className="mb-chips" role="group" aria-label="Soort ontvanger">
                        {soortenVoorPakket().map((x) => <button key={x.id} type="button" className={nieuweLink.soort === x.id ? 'aan' : ''} onClick={() => setNieuweLink({ ...nieuweLink, soort: x.id })}>{x.id}</button>)}
                      </div>
                      <p className="mb-sub">{soortenVoorPakket().find((x) => x.id === nieuweLink.soort)?.uitleg}</p>
                      <div className="mb-segment" role="group" aria-label="Welke lagen">
                        <button type="button" className={nieuweLink.lagen === 'alle' ? 'aan' : ''} onClick={() => setNieuweLink({ ...nieuweLink, lagen: 'alle' })}>Alle lagen</button>
                        <button type="button" className={nieuweLink.lagen === 'zicht' ? 'aan' : ''} onClick={() => setNieuweLink({ ...nieuweLink, lagen: 'zicht' })}>Wat je nu ziet</button>
                      </div>
                      <p className="mb-sub">De link toont het plan zoals het nu is{fase ? `, fase ${fasen.find((f) => f.id === fase)?.naam || ''}` : ''}. Meer instellen kan op een computer.</p>
                      <div className="mb-knoppen">
                        <button type="button" className="mb-knop" onClick={() => setNieuweLink(null)}>Annuleren</button>
                        <button type="button" className="mb-knop hoofd" disabled={!nieuweLink.naam.trim() || bezig} onClick={maakLink}>{bezig ? 'Maken…' : 'Maken en delen'}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button type="button" className="mb-knop hoofd vol" onClick={() => setNieuweLink({ naam: '', soort: soortenVoorPakket()[0]?.id, lagen: 'alle' })}>Nieuwe deellink</button>
                      {links === null && <p className="mb-sub">Laden…</p>}
                      {links && !links.length && <p className="mb-sub">Nog geen deellinks voor dit plan.</p>}
                      {links && links.length > 0 && (
                        <div className="mb-lijst">
                          {links.map((l) => {
                            const aan = linkAan(l);
                            return (
                              <div key={l.id} className="mb-rij" style={{ alignItems: 'flex-start', cursor: 'default' }}>
                                <span className="mb-blok" style={aan ? undefined : { opacity: 0.5 }}><Ic.deel /></span>
                                <span>
                                  <b>{l.naam}</b>
                                  <small>{[l.opties?.ontvanger?.soort, l.live ? 'Live' : 'Vaste versie', aan ? null : l.ingetrokken_op ? 'Ingetrokken' : 'Verlopen'].filter(Boolean).join(' · ')}</small>
                                  <span style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    {aan && <button type="button" className="mb-knop" style={{ height: 36 }} onClick={() => deelLink(l)}>Delen</button>}
                                    <button type="button" className="mb-knop" style={{ height: 36 }} onClick={() => trekIn(l)}>{l.ingetrokken_op ? 'Terug aanzetten' : 'Intrekken'}</button>
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button type="button" className="mb-knop vol" onClick={sluit}>Sluiten</button>
                    </>
                  )}
                </>
              )}

              {paneel === 'wie' && (
                <>
                  <div>
                    <p className="mb-titel" style={{ fontSize: 20 }}>Wie is waar</p>
                    <p className="mb-sub">Enkel collega's van je eigen organisatie die zelf hun plek delen. Nooit via deellinks, geen geschiedenis.</p>
                  </div>
                  {deelt ? <span className="mb-deelt">Je deelt je plek tot vanavond{mijn ? ` (± ${mijn.acc} m)` : ''}</span> : null}
                  <button type="button" className={`mb-knop vol${deelt ? '' : ' hoofd'}`} onClick={() => zetDelen(!deelt)}>{deelt ? 'Stop met delen' : 'Deel mijn plek tot vanavond'}</button>
                  {aanwezig.length ? (
                    <div className="mb-lijst">
                      {aanwezig.map((a) => {
                        const min = Math.round((Date.now() - (a.t || 0)) / 60000);
                        return (
                          <button key={a.uid} type="button" className="mb-rij" onClick={() => { mapRef.current?.easeTo({ center: a.pos, zoom: Math.max(mapRef.current.getZoom(), 18) }); setPaneel(null); }}>
                            <span className="mb-persoon" style={{ background: a.kleur || '#022056', border: 0, boxShadow: 'none' }}>{a.ini || initialen({ naam: a.naam })}</span>
                            <span><b>{a.naam || 'Collega'}</b><small>{min < 1 ? 'Nu' : `${min} min geleden`}{mijn ? ` · ${meters(afstand(mijn.punt, a.pos))} van jou` : ''}</small></span>
                            <span className="mb-pijl">›</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : <p className="mb-sub">Nog niemand deelt zijn plek op dit plan.</p>}
                  <button type="button" className="mb-knop vol" onClick={sluit}>Sluiten</button>
                </>
              )}
            </div>
          </section>
        )}
      </div>
      {groot3d && (() => { const gi = (data?.items || []).find((x) => x.id === groot3d); return gi ? <Groot3D it={gi} el={elMap.get(gi.element_id)} elementenMap={elMap} items={data.items} onSluit={() => setGroot3d(null)} /> : null; })()}
      {binnen && (() => {
        const alle = data?.items || [];
        const host = alle.find((i) => i.id === binnen.host);
        if (!host) return null;
        const vs = Array.isArray(host.velden?.binnenplan?.verdiepingen) && host.velden.binnenplan.verdiepingen.length ? host.velden.binnenplan.verdiepingen : [{ id: 'g', naam: 'Gelijkvloers' }];
        const verd = binnen.verd && vs.some((v) => v.id === binnen.verd) ? binnen.verd : vs[0].id;
        const ol = (data.plan?.instellingen?.onderleggers || []).find((o) => o.binnen?.host === host.id && (o.binnen.verd || vs[0].id) === verd) || null;
        const niets = () => null;
        return (
          <div className="fm-deel-binnen fm">
            <BinnenScherm host={host} verdiepingen={vs} verd={verd} onVerd={(v) => setBinnen({ ...binnen, verd: v })} onderlegger={ol} items={alle} taal="nl" fotosVast={new Map()}
              merk={<span className="fm-bs-merk"><i aria-hidden="true" />{data.plan.naam}</span>}
              elementen={data.elementen || []} elementenMap={elMap} schrijven={false}
              onMaak={niets} onWijzig={niets} onVerwijder={niets} onGrondplan={niets} onPassen={niets} onOnderlegger={niets} onNieuweVerdieping={niets} onSluit={() => setBinnen(null)} />
          </div>
        );
      })()}
    </>
  );
}
