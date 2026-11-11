'use client';

import { getOrganisatie } from './merk';
import { ToolenTeken } from '../ToolenLogo';
import { tvCamTekst } from './tvcamera';
import { MeetPaneel, MEET_TEKST, zorgVoorMeetLagen, meetGeometrie } from './deelmeten';
import { VeldpuntPaneel, VeldpuntBewerk, VP_TEKST, zorgVoorVeldpuntLagen, zetVeldpunten } from './veldpunten';
import { AttestenLijst } from './attesten';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './maps.css';
import FeedbackKnop, { zetFeedbackContext } from './Feedback';
import { sb } from './db';
import { basisStijl, registreerProtocollen, zetOndergrond, klapBronvermeldingIn, kiesFotoVl } from './ondergronden';
import { kaartLagen, naarGeojson, zorgVoorPatronen } from './stijl';
import { berekenStuklijst } from './Stuklijst';
import { metTekeningen } from './tekeningen';
import { kader as bbox, middelpunt } from './geo';
import { PopupKop, PopupInfo, NavKnoppen } from './PopupInhoud';
import { isSign } from './signalisatie';
import { maten, matenTekst } from './stijl';
import BinnenScherm from './BinnenScherm';
import StroomDeel, { useStroomDossier } from './StroomDeel';
import { leesBeeld } from './camerabeeld';
import OntwerpDuimen, { ontwerpenVan } from './OntwerpDuimen';
import { heeft3d, Mini3D, Knop3D, Groot3D } from './drie3d';
import { DoorgangLijst } from './StellingBlok';
import { isStellingBouw } from './stellingbouw';
import { hitOp } from './hit';
import { binnenTekst } from './binnenTaal';

// Vaste teksten van de deelpagina in de taal van de link.
const T = {
  nl: { laden: 'Plan laden…', weg: 'Deze link is niet (meer) geldig. Vraag de organisator om een nieuwe link.', lagen: 'Lagen', pdf: 'PDF afdrukken', bezig: 'PDF maken…', navigeer: 'Navigeer', opm: 'Opmerkingen', naam: 'Je naam', tekst: 'Je opmerking', plaats: 'Plaatsen', dank: 'Bedankt, je opmerking is doorgegeven.', kaart: 'Luchtfoto', lijn: 'Lijntekening', straat: 'Stratenkaart', versie: 'versie', geen: 'Nog geen opmerkingen.', attesten: 'Keuringsattesten', herkomst: 'Geleverd door', alleLev: 'Alle leveranciers', materialen: 'Materialen', zonderLeg: 'Kaart zonder legende', metLeg: 'Kaart met legende', binnen: 'Binnen bekijken', drie: 'In 3D bekijken', },
  fr: { laden: 'Chargement du plan…', weg: "Ce lien n'est pas (ou plus) valable. Demandez un nouveau lien à l'organisateur.", lagen: 'Couches', pdf: 'Imprimer en PDF', bezig: 'Création du PDF…', navigeer: 'Itinéraire', opm: 'Remarques', naam: 'Votre nom', tekst: 'Votre remarque', plaats: 'Envoyer', dank: 'Merci, votre remarque a été transmise.', kaart: 'Photo aérienne', lijn: 'Plan au trait', straat: 'Carte routière', versie: 'version', geen: 'Pas encore de remarques.', attesten: "Attestations d'inspection", herkomst: 'Fourni par', alleLev: 'Tous les fournisseurs', materialen: 'Matériel', zonderLeg: 'Plan sans légende', metLeg: 'Plan avec légende', binnen: "Voir l'intérieur", drie: 'Voir en 3D', },
  en: { laden: 'Loading plan…', weg: 'This link is not (or no longer) valid. Ask the organiser for a new link.', lagen: 'Layers', pdf: 'Print PDF', bezig: 'Creating PDF…', navigeer: 'Navigate', opm: 'Comments', naam: 'Your name', tekst: 'Your comment', plaats: 'Post', dank: 'Thank you, your comment has been sent.', kaart: 'Aerial photo', lijn: 'Line drawing', straat: 'Street map', versie: 'version', geen: 'No comments yet.', attesten: 'Inspection certificates', herkomst: 'Supplied by', alleLev: 'All suppliers', materialen: 'Materials', zonderLeg: 'Map without legend', metLeg: 'Map with legend', binnen: 'Look inside', drie: 'View in 3D', },
};

export default function DeelWeergave({ token, deel = null, onData = null }) {
  const [data, setData] = useState(undefined); // undefined = laden, null = ongeldig
  // Na vernieuwen terug waar je was: kaartbeeld, ondergrond, verborgen lagen en het gebouw waar je binnenkeek
  // (per link, in dit tabblad). Lukt het bewaren niet (privévenster), dan gewoon het startbeeld.
  const opslag = `fm-deel:${token}${deel ? `:${deel}` : ''}`;
  const bewaard = useRef(undefined);
  if (bewaard.current === undefined) { try { bewaard.current = JSON.parse(sessionStorage.getItem(opslag) || 'null'); } catch { bewaard.current = null; } }
  const bewaar = (patch) => { try { const v = { ...(JSON.parse(sessionStorage.getItem(opslag) || 'null') || {}), ...patch }; sessionStorage.setItem(opslag, JSON.stringify(v)); } catch {} };
  const [verborgen, setVerborgen] = useState(new Set());
  const [gekozen, setGekozen] = useState(null);
  const [popupDiv, setPopupDiv] = useState(null);
  const [zweef, setZweef] = useState(null); // { id, x, y } zwarte ballon bij zweven
  const [ondergrond, setOndergrond] = useState('luchtfoto');
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const [klaar, setKlaar] = useState(false);
  const [offline, setOffline] = useState(null); // tijdstip van de bewaarde stand als het netwerk wegviel
  const [herkomst, setHerkomst] = useState('');
  const [toonLijst, setToonLijst] = useState(false);
  const [toonLagen, setToonLagen] = useState(() => typeof window === 'undefined' || window.innerWidth > 640);
  const [dichtMap, setDichtMap] = useState(() => new Set());
  const [binnenOpen, setBinnenOpen] = useState(null); // id van het gebouw waar je binnenkijkt
  const [groot3d, setGroot3d] = useState(null); // wand of truss in 3D over het hele scherm
  // Veldpunten: een punt zetten op het terrein ("camera 3 hier"), voor de organisator om achteraf in te tekenen.
  const [vpModus, setVpModus] = useState(false); const [vpPlek, setVpPlek] = useState(null); const [vpLijst, setVpLijst] = useState([]); const [vpKeuze, setVpKeuze] = useState(null);
  const [vpVerplaats, setVpVerplaats] = useState(false);
  const [meet, setMeet] = useState(false); const [meetPunten, setMeetPunten] = useState([]); const [meetVlak, setMeetVlak] = useState(false); const meetRef = useRef(false); meetRef.current = meet;
  const vpRef = useRef(false); vpRef.current = vpModus; const vpPlekRef = useRef(null); vpPlekRef.current = vpPlek; const vpVerRef = useRef(null); vpVerRef.current = vpVerplaats && vpKeuze ? vpKeuze : null;
  useEffect(() => { if (data?.veldpunten) setVpLijst(data.veldpunten); }, [data]);
  // Gsm: info als onderblad in plaats van een pop-up op de kaart.
  const [gsm, setGsm] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches);
  useEffect(() => { const mq = window.matchMedia?.('(max-width: 760px)'); if (!mq) return undefined; const f = () => setGsm(mq.matches); mq.addEventListener?.('change', f); return () => mq.removeEventListener?.('change', f); }, []);
  const kaartRef = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => zetFeedbackContext(() => { const m = mapRef.current; let zoom = null; let centrum = null; try { zoom = Math.round(m.getZoom() * 10) / 10; const c = m.getCenter(); centrum = [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))]; } catch {} return { scherm: 'Deellink', kaart: m, zoom, centrum }; }), []);
  const popupRef = useRef(null);

  const taal = T[data?.link?.opties?.taal] ? data.link.opties.taal : 'nl';
  const t = T[taal];

  useEffect(() => {
    // Offline in het veld: de laatst geladen stand bewaren en tonen als het netwerk wegvalt.
    const sleutel = `fm-deel-${token}${deel ? `:${deel}` : ''}`;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/maps-sw.js', { scope: '/maps/' }).catch(() => {});
    sb().schema('maps').rpc('deel_link_lezen', deel ? { p_token: token, p_deel: deel } : { p_token: token }).then(({ data: d0, error }) => {
      let d = d0;
      if (error) {
        let c = null; try { c = JSON.parse(localStorage.getItem(sleutel) || 'null'); } catch {}
        if (c?.d) { d = c.d; setOffline(c.op); } else { setData(null); console.warn('deel_link_lezen', error); return; }
      } else if (d) { try { localStorage.setItem(sleutel, JSON.stringify({ op: Date.now(), d })); } catch {} }
      if (!d) { setData(null); onData?.(null); return; }
      setData(d); onData?.(d);
      setOndergrond(bewaard.current?.o || d.plan.basiskaart || 'luchtfoto');
      if (Array.isArray(bewaard.current?.v)) setVerborgen(new Set(bewaard.current.v));
      if (bewaard.current?.binnen) setBinnenOpen(bewaard.current.binnen);
      if (typeof document !== 'undefined') document.title = `${d.plan.naam} · ${getOrganisatie()?.huisstijl?.toolen_verbergen ? (getOrganisatie()?.huisstijl?.kort || getOrganisatie()?.naam) : 'Toolen Maps'}`;
    });
  }, [token, deel]); // eslint-disable-line react-hooks/exhaustive-deps

  const lagenMap = useMemo(() => new Map((data?.lagen || []).map((l) => [l.id, l])), [data]);
  // Materiaallijst: zoals de stuklijst in de editor, per leverancier ("geleverd door").
  const materialen = useMemo(() => {
    if (!data) return [];
    const els = new Map((data.elementen || []).map((e) => [e.id, e]));
    const its = (data.items || []).map((i) => ({ ...i, velden: { ...(i.velden || {}), herkomst: i.herkomst || null } }));
    return berekenStuklijst(its, els, new Map()).elementen;
  }, [data]);
  const herkomsten = useMemo(() => {
    const m = new Map(); for (const i of data?.items || []) if (i.herkomst) m.set(i.herkomst, (m.get(i.herkomst) || 0) + 1);
    return [...m].sort((a, b) => a[0].localeCompare(b[0], 'nl'));
  }, [data]);
  const elementenMap = useMemo(() => new Map(metTekeningen(data?.elementen || []).map((e) => [e.id, e])), [data]);
  // Server filtert al; dit is een vangnet voor de fijnmazige keuze van de link.
  const items = useMemo(() => {
    const o = data?.link?.opties || {};
    const vEl = new Set([...(o.verberg_elementen || []), ...(data?.plan?.instellingen?.verborgen_elementen || [])]);
    const vSo = new Set(o.verberg_soorten || []);
    const vIt = new Set(o.verberg_items || []);
    return (data?.items || []).filter((i) => !vIt.has(i.id) && (i.element_id ? !vEl.has(i.element_id) : !vSo.has(i.soort)));
  }, [data]);
  const itemsRef = useRef(items); itemsRef.current = items;
  // Deellink "Stroom": stroompunten met per punt het dossier.
  const sd = useStroomDossier(data, items, elementenMap);
  const [toonStroom, setToonStroom] = useState(true);
  useEffect(() => { if (data?.link?.opties?.stroom) setToonLagen(false); }, [data]);
  // Gebouwen, tenten en containers met een binnenplan (of iets dat erin staat): daar kan je binnenkijken.
  const binnenHosts = useMemo(() => {
    const tel = new Set(items.filter((i) => i.velden?.binnen?.host).map((i) => i.velden.binnen.host));
    const ols = new Set((data?.plan?.instellingen?.onderleggers || []).map((o) => o.binnen?.host).filter(Boolean));
    return new Set(items.filter((i) => !i.velden?.binnen && i.geometrie && (tel.has(i.id) || ols.has(i.id))).map((i) => i.id));
  }, [items, data]);

  useEffect(() => { if (data) bewaar({ o: ondergrond, v: [...verborgen], binnen: binnenOpen || null }); }, [data, ondergrond, verborgen, binnenOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // Kaart opstarten
  useEffect(() => {
    if (!data || !kaartRef.current || mapRef.current) return;
    registreerProtocollen();
    const b = bbox(items.filter((i) => !i.velden?.binnen).map((i) => i.geometrie));
    const centrum = Array.isArray(data.plan.centrum) ? data.plan.centrum : [4.4, 50.9];
    const map = new maplibregl.Map({
      container: kaartRef.current, style: (kiesFotoVl(data.plan.instellingen?.fotoVl), basisStijl(data.plan.basiskaart || 'luchtfoto')),
      center: centrum, zoom: Number(data.plan.zoom) || 16, maxZoom: 22, dragRotate: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    klapBronvermeldingIn(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 140 }), 'bottom-left');
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true, showAccuracyCircle: true, positionOptions: { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 } }), 'bottom-right');
    // Startbeeld van de link (zoals de afzender het instelde), anders alles in beeld.
    const sb = data.link?.opties?.beeld;
    const bw = bewaard.current?.beeld;
    if (bw && Array.isArray(bw.c)) map.jumpTo({ center: bw.c, zoom: Number(bw.z) || 16, bearing: Number(bw.b) || 0 });
    else if (sb && Array.isArray(sb.c)) map.jumpTo({ center: sb.c, zoom: Number(sb.z) || 16, bearing: Number(sb.b) || 0 });
    else if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, maxZoom: 19, duration: 0 });
    map.on('moveend', () => { const c = map.getCenter(); bewaar({ beeld: { c: [c.lng, c.lat], z: map.getZoom(), b: map.getBearing() } }); });
    map.on('load', () => {
      map.addSource('fm-vormen', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('fm-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      for (const l of kaartLagen(centrum[1])) map.addLayer(l);
      // Binnenkijken: label en klikzone op elk gebouw met een binnenplan.
      map.addSource('fm-binnen', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'fm-binnen-hit', type: 'circle', source: 'fm-binnen', minzoom: 15, paint: { 'circle-radius': 20, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } });
      zorgVoorVeldpuntLagen(map);
      map.addLayer({ id: 'fm-binnen', type: 'symbol', source: 'fm-binnen', minzoom: 15, layout: { 'text-field': ['get', 't'], 'text-size': 12, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true, 'text-offset': [0, 1.4] }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#1d1d1b', 'text-halo-width': 2.5, 'text-halo-blur': 0.5 } });
      setKlaar(true);
    });
    const lagenIds = ['fm-punt', 'fm-tekst', 'fm-lijn-vol', 'fm-lijn-streep', 'fm-lijn-stip', 'fm-lijn-streeppunt', 'fm-stuk-vulling', 'fm-stuk-lijn-vol', 'fm-vulling', 'fm-patroon', 'fm-vloer', 'fm-vloer-lijn'];
    map.on('click', (e) => {
      if (meetRef.current) { setMeetPunten((l) => [...l, [e.lngLat.lng, e.lngLat.lat]]); return; }
      // Veldpunt raken: ruime zone voor een vinger (en ook op de tekst eronder), het dichtste punt wint.
      const vpHit = () => {
        if (!map.getLayer('fm-veldpunt')) return null; const R = 22;
        const fs = map.queryRenderedFeatures([[e.point.x - R, e.point.y - R], [e.point.x + R, e.point.y + R]], { layers: ['fm-veldpunt', 'fm-veldpunt-t'] }).filter((f) => f.properties?.id);
        let best = null; let bd = Infinity;
        for (const f of fs) { const q = map.project(f.geometry.coordinates); const d = Math.hypot(q.x - e.point.x, q.y - e.point.y); if (d < bd) { bd = d; best = f.properties.id; } }
        return best;
      };
      // Tijdens "Punt zetten": tik je op een bestaand punt, dan open je dat punt (niet een nieuw punt ernaast).
      if (vpRef.current) { const id = vpHit(); if (id && !vpPlekRef.current) { setVpModus(false); setGekozen(null); setVpKeuze(id); return; } setVpPlek([e.lngLat.lng, e.lngLat.lat]); return; }
      if (vpVerRef.current) { const id = vpVerRef.current; setVpVerplaats(false); wijzigVpRef.current?.({ id }, { punt: [e.lngLat.lng, e.lngLat.lat] }); return; }
      { const id = vpHit(); if (id) { setGekozen(null); setVpKeuze(id); return; } }
      setVpKeuze(null);
      const bh = map.getLayer('fm-binnen') ? map.queryRenderedFeatures(e.point, { layers: ['fm-binnen', 'fm-binnen-hit'] }) : [];
      if (bh[0]?.properties?.host) { setGekozen(null); setBinnenOpen(bh[0].properties.host); return; }
      // Zoals in de editor: ruime zone met de vinger, voorrang voor punten en lijnen boven grote vlakken.
      const it0 = hitOp(map, e.point, itemsRef.current || []);
      setGekozen(it0?.id || null);
    });
    map.on('mousemove', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: lagenIds.filter((l) => map.getLayer(l)) });
      map.getCanvas().style.cursor = hits.length ? 'pointer' : '';
      const id = hits[0]?.properties?.id || null;
      if (map.getLayer('fm-binnen') && map.queryRenderedFeatures(e.point, { layers: ['fm-binnen', 'fm-binnen-hit'] }).length) map.getCanvas().style.cursor = 'pointer';
      setZweef((z) => (!id ? null : z?.id === id && Math.abs(z.x - e.point.x) < 2 && Math.abs(z.y - e.point.y) < 2 ? z : { id, x: e.point.x, y: e.point.y }));
    });
    map.on('mouseout', () => setZweef(null));
    map.on('movestart', () => setZweef(null));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klaar) return;
    // Filter "Geleverd door": die items scherp, de rest gedimd.
    const focus = herkomst ? new Set(items.filter((i) => i.herkomst === herkomst).map((i) => i.id)) : null;
    const { vormen, labels } = naarGeojson(items.filter((i) => !i.velden?.binnen), lagenMap, elementenMap, { verborgenLagen: verborgen, verbergElementen: data?.plan?.instellingen?.verborgen_elementen, focus });
    zorgVoorPatronen(map, vormen.features, labels.features);
    map.getSource('fm-vormen')?.setData(vormen);
    map.getSource('fm-labels')?.setData(labels);
    const bf = items.filter((x) => binnenHosts.has(x.id) && !verborgen.has(x.laag_id)).map((x) => {
      const k = bbox([x.geometrie]);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: x.parameters?.midden || [(k[0] + k[2]) / 2, (k[1] + k[3]) / 2] }, properties: { host: x.id, t: `▦ ${x.naam || elementenMap.get(x.element_id)?.naam || 'Binnenplan'}` } };
    });
    map.getSource('fm-binnen')?.setData({ type: 'FeatureCollection', features: bf });
  }, [items, lagenMap, elementenMap, verborgen, klaar, herkomst, binnenHosts]);

  useEffect(() => { if (mapRef.current && klaar) zetOndergrond(mapRef.current, ondergrond); }, [ondergrond, klaar]);
  useEffect(() => { if (mapRef.current && klaar) { zorgVoorVeldpuntLagen(mapRef.current); zetVeldpunten(mapRef.current, vpLijst, vpModus ? vpPlek : null); } }, [vpLijst, vpPlek, vpModus, klaar, ondergrond]);
  useEffect(() => { const m = mapRef.current; if (m) m.getCanvas().style.cursor = vpModus || vpVerplaats || meet ? 'crosshair' : ''; }, [vpModus, vpVerplaats, meet]);
  useEffect(() => { const m = mapRef.current; if (!m || !klaar) return; zorgVoorMeetLagen(m); m.getSource('fm-deelmeet')?.setData(meet ? meetGeometrie(meetPunten, meetVlak) : { type: 'FeatureCollection', features: [] }); }, [meet, meetPunten, meetVlak, klaar, ondergrond]);
  const bewaarVeldpunt = async ({ punt, tekst, naam }) => {
    const { data: id, error } = await sb().schema('maps').rpc('deel_link_punt', { p_token: token, p_lng: punt[0], p_lat: punt[1], p_naam: naam, p_tekst: tekst });
    if (error || !id) return false;
    setVpLijst((l) => [...l, { id, punt, tekst, auteur: naam || '—', status: 'open', op: new Date().toISOString(), eigen: true }]);
    return true;
  };
  const wijzigVeldpunt = async (o, { tekst = null, punt = null, weg = false }) => {
    const { data: ok, error } = await sb().schema('maps').rpc('deel_link_punt_wijzig', { p_token: token, p_id: o.id, p_lng: punt ? punt[0] : null, p_lat: punt ? punt[1] : null, p_tekst: tekst, p_weg: weg });
    if (error || !ok) return false;
    if (weg) { setVpLijst((l) => l.filter((x) => x.id !== o.id)); setVpKeuze(null); }
    else setVpLijst((l) => l.map((x) => (x.id === o.id ? { ...x, ...(tekst ? { tekst } : {}), ...(punt ? { punt } : {}) } : x)));
    return true;
  };
  const wijzigVpRef = useRef(null); wijzigVpRef.current = wijzigVeldpunt;

  // Pop-up
  useEffect(() => {
    const map = mapRef.current;
    popupRef.current?.remove();
    popupRef.current = null;
    setPopupDiv(null);
    if (!map || !gekozen) return;
    const it = items.find((x) => x.id === gekozen);
    if (!it) return;
    if (gsm) { setToonLagen(false); setToonLijst(false); map.easeTo({ center: middelpunt(it.geometrie), padding: { top: 0, bottom: Math.round(window.innerHeight * 0.45), left: 0, right: 0 }, duration: 350 }); return; }
    const div = document.createElement('div');
    const p = new maplibregl.Popup({ className: 'fm-popup', maxWidth: 'none', offset: 12 })
      .setLngLat(middelpunt(it.geometrie)).setDOMContent(div).addTo(map);
    p.on('close', () => { if (popupRef.current === p) { setPopupDiv(null); setGekozen(null); } });
    popupRef.current = p;
    setPopupDiv(div);
  }, [gekozen, gsm]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pdfMenu, setPdfMenu] = useState(false);
  const stroomPdf = async () => {
    setPdfMenu(false); setFout('');
    try {
      const { stroomDossierPdf } = await import('./stroomDossier');
      await stroomDossierPdf({ plan: data.plan, lagen: data.lagen || [], items, elementenMap, fase: null, fasen: [], stroom: sd.stroom, voortgang: setBezig });
    } catch (e) { setFout(e?.message || String(e)); } finally { setBezig(''); }
  };
  const pdf = async (legende = false) => {
    setPdfMenu(false);
    setFout('');
    try {
      const { maakPdf } = await import('./pdf');
      const map = mapRef.current;
      const c = map.getCenter();
      const lagen = (data.lagen || []).filter((l) => !verborgen.has(l.id));
      const inst = {
        papier: 'A3', orientatie: 'liggend', schaal: null, ondergrond: ondergrond === 'stratenkaart' ? 'lijntekening' : ondergrond,
        dimmen: 0, legende, stuklijst: false, maten: false, dpi: 150, raster: { aan: false },
        lagen: lagen.map((l) => l.id), centrum: [c.lng, c.lat],
      };
      const { doc } = await maakPdf({ plan: data.plan, lagen, items: items.filter((i) => !verborgen.has(i.laag_id)), elementenMap, fase: null, inst, voortgang: setBezig });
      doc.save(`${[data.plan.editie_naam, data.plan.naam].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '')}.pdf`);
    } catch (e) {
      setFout(e?.message || String(e));
    } finally {
      setBezig('');
    }
  };

  if (data === undefined) return <div className="fm" style={{ padding: 32 }}>{T.nl.laden}</div>;
  if (data === null) {
    return (
      <div className="fm" style={{ padding: 32, maxWidth: 560 }}>
        <h1 className="t-titel" style={{ fontSize: 26 }}>Toolen Maps</h1>
        <p>{T.nl.weg}</p><p className="fm-sub">{T.fr.weg}</p><p className="fm-sub">{T.en.weg}</p>
      </div>
    );
  }

  const opties = data.link.opties || {};
  // Deel-link van enkel een binnenplan: meteen het binnenscherm, alleen om te bekijken.
  if (opties.binnen) return <DeelBinnen data={data} elementenMap={elementenMap} taal={taal} />;
  // Deel-link van enkel een 3D (stelling, wand, truss, tent): meteen over het hele scherm, zonder kaart.
  if (opties.drie) {
    const di = items.find((x) => x.id === opties.drie);
    if (!di) return <div className="fm" style={{ padding: 32 }}><p>{T.nl.weg}</p></div>;
    return <Groot3D vast it={di} el={elementenMap.get(di.element_id)} naam={data.link.naam ? `${di.naam || elementenMap.get(di.element_id)?.naam || ''}` : undefined} elementenMap={elementenMap} items={items} plannen={(data.stellingplannen || []).filter((p) => p.item_id === di.id).map((p) => ({ pad: p.pad, meta: { naam: p.naam } }))} onSluit={() => {}} />;
  }
  const it = gekozen ? items.find((x) => x.id === gekozen) : null;
  const hs = getOrganisatie()?.huisstijl || null;

  return (
    <div className="fm" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <header className="fm-deelkop" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 16px', background: 'var(--t-navy, #022056)', color: '#fff' }}>
        {hs && (hs.logo_donker || hs.logo_licht)
          ? <img src={hs.logo_donker || hs.logo_licht} alt={hs.naam || ''} style={{ height: 26, width: 'auto', maxWidth: 160, objectFit: 'contain' }} />
          : <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--t-blauw, #108AED)' }} />}
        <div className="fm-deeltitel" style={{ flex: '1 1 200px', minWidth: 0 }}>
          <strong style={{ fontSize: 16, fontFamily: 'var(--font-titel)', fontStretch: '112%', fontWeight: 700 }}>{data.plan.naam}</strong>
          <span style={{ fontSize: 13, color: '#a9a9a5', marginLeft: 8 }}>{[data.plan.editie_naam, data.plan.locatie, `${t.versie} ${data.plan.versie}`, data.link.stand ? new Date(data.link.stand.op).toLocaleDateString(taal === 'en' ? 'en-GB' : taal === 'fr' ? 'fr-BE' : 'nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : (data.link.live ? 'live' : null)].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="fm-deel-tools">
        <select aria-label="Ondergrond" value={ondergrond} onChange={(e) => setOndergrond(e.target.value)} style={{ height: 30, border: 0, padding: '0 8px', flex: '1 1 140px', maxWidth: 220 }}>
          <option value="luchtfoto">{t.kaart}</option><option value="luchtfoto_straten">{t.kaart} + {t.straat.toLowerCase()}</option><option value="lijntekening">{t.lijn}</option><option value="stratenkaart">{t.straat}</option>
        </select>
        {herkomsten.length > 1 && (
          <select aria-label={t.herkomst} value={herkomst} onChange={(e) => setHerkomst(e.target.value)} style={{ height: 30, border: 0, padding: '0 8px', flex: '1 1 160px', maxWidth: 240 }}>
            <option value="">{t.alleLev}</option>
            {herkomsten.map(([h, n]) => <option key={h} value={h}>{t.herkomst}: {h} ({n})</option>)}
          </select>
        )}
        {!sd && opties.materialen !== false && materialen.length > 0 && <button className="fm-knop klein" aria-pressed={toonLijst} onClick={() => { setToonLijst((x) => !x); if (gsm) { setToonLagen(false); setGekozen(null); } }}>{t.materialen}</button>}
        <button className="fm-knop klein" aria-pressed={meet} onClick={() => { setMeet((x) => !x); setMeetPunten([]); setVpModus(false); setGekozen(null); setVpKeuze(null); if (gsm) { setToonLagen(false); setToonLijst(false); } }}>📏 {(MEET_TEKST[taal] || MEET_TEKST.nl).knop}</button>
        {opties.opmerkingen && <button className="fm-knop klein" aria-pressed={vpModus} title={(VP_TEKST[taal] || VP_TEKST.nl).uitleg} onClick={() => { setVpModus((x) => !x); setVpPlek(null); setMeet(false); setGekozen(null); if (gsm) { setToonLagen(false); setToonLijst(false); } }}>📍 {(VP_TEKST[taal] || VP_TEKST.nl).knop}</button>}
        {sd && <button className="fm-knop klein" aria-pressed={toonStroom} onClick={() => { setToonStroom((x) => !x); if (gsm) { setToonLagen(false); setToonLijst(false); setGekozen(null); } }}>⚡ Stroompunten</button>}
        <button className="fm-knop klein" aria-pressed={toonLagen} onClick={() => { setToonLagen((x) => !x); if (gsm) { setToonLijst(false); setGekozen(null); setToonStroom(false); } }}>{t.lagen}</button>
        {opties.pdf !== false && <button className="fm-knop klein rood" data-menuknop disabled={!!bezig} aria-expanded={pdfMenu} onClick={() => setPdfMenu((x) => !x)}>{bezig || t.pdf}</button>}
          <FeedbackKnop deelToken={token} klein />
          {hs && !hs.toolen_verbergen && <a className="t-powered" href="https://toolen.be" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,.82)', alignSelf: 'center' }}>Powered by <ToolenTeken op="navy" grootte={16} /><b style={{ color: '#fff' }}>Toolen Maps</b></a>}
        </div>
      </header>
      {pdfMenu && (
        <>
          <div className="fm-deel-pdfachter" onClick={() => setPdfMenu(false)} />
          <div className="fm-menu fm-deel-pdfmenu" role="menu">
            <button role="menuitem" onClick={() => pdf(false)}>{t.zonderLeg}</button>
            <button role="menuitem" onClick={() => pdf(true)}>{t.metLeg}</button>
            {sd && <button role="menuitem" onClick={stroomPdf}>Stroomdossier (alle punten)</button>}
          </div>
        </>
      )}
      {fout && <div className="fm-melding fout" style={{ margin: 8 }}>{fout}</div>}
      {offline && <div className="fm-melding info" style={{ margin: 0, borderRadius: 0 }}>Geen netwerk: je ziet de stand van {new Date(offline).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</div>}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={kaartRef} style={{ position: 'absolute', inset: 0 }} />
        {meet && <MeetPaneel taal={taal} punten={meetPunten} setPunten={setMeetPunten} vlak={meetVlak} setVlak={setMeetVlak} onSluit={() => { setMeet(false); setMeetPunten([]); }} />}
        {vpModus && <VeldpuntPaneel taal={taal} eigen={vpLijst.filter((o) => o.eigen && o.status === 'open')} onKies={(o) => { setVpModus(false); setVpPlek(null); setVpKeuze(o.id); mapRef.current?.easeTo({ center: o.punt, duration: 300 }); }} plek={vpPlek} setPlek={(p) => { setVpPlek(p); if (p) mapRef.current?.easeTo({ center: p, duration: 300 }); }} onBewaar={bewaarVeldpunt} onSluit={() => { setVpModus(false); setVpPlek(null); }} />}
        {vpKeuze && !vpModus && (() => { const o = vpLijst.find((x) => x.id === vpKeuze); if (!o) return null; return (
          <VeldpuntBewerk o={o} taal={taal} verplaatsen={vpVerplaats} setVerplaatsen={setVpVerplaats} onWijzig={wijzigVeldpunt} onSluit={() => { setVpKeuze(null); setVpVerplaats(false); }} />); })()}
        {zweef && !gsm && zweef.id !== gekozen && (() => {
          const zi = items.find((x) => x.id === zweef.id); if (!zi) return null;
          const el = zi.element_id ? elementenMap.get(zi.element_id) : null; const lg = lagenMap.get(zi.laag_id);
          const m = matenTekst(maten(zi, el));
          return (
            <div className="fm-zweef" style={{ left: zweef.x + 14, top: zweef.y + 14, ...(heeft3d(zi, el) ? { maxWidth: 266 } : {}) }}>
              <strong>{zi.naam || el?.naam || lg?.naam || 'Item'}</strong>
              {zi.velden?.functie && <span className="functie">{zi.velden.functie}</span>}
              {tvCamTekst(zi, el) && <span className="functie">{tvCamTekst(zi, el)}</span>}
              {el && zi.naam && zi.naam !== el.naam && <span>{el.naam}</span>}
              {m && <span>{m}</span>}
              {lg && <span className="laag"><i style={{ background: lg.kleur || '#686D76' }} />{lg.naam}</span>}
              {heeft3d(zi, el) ? <div className="fm-zweef-3d"><Mini3D it={zi} el={el} elementenMap={elementenMap} items={items} /></div> : <OntwerpDuimen it={zi} el={el} elementenMap={elementenMap} hoogte={64} />}
            </div>
          );
        })()}
        {toonLijst && opties.materialen !== false && (
          <div className="fm-zwevend fm-deel-matpaneel" style={{ right: 12, top: 12, width: 320, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 80px)', overflowY: 'auto', padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>{t.materialen}{herkomst ? ` · ${herkomst}` : ''}</strong>
              <button className="fm-knop klein" onClick={() => setToonLijst(false)} aria-label="Sluiten">×</button>
            </div>
            <table className="fm-tabel">
              <tbody>
                {materialen.filter((e) => !herkomst || e.leverancier === herkomst).map((e) => (
                  <tr key={`${e.naam}|${e.leverancier}`}>
                    <td>{e.naam}{!herkomst && e.leverancier && <div className="fm-sub">{t.herkomst}: {e.leverancier}</div>}{e.tekenwijze === 'lijn' && e.meter > 0 && <div className="fm-sub">{Math.round(e.meter)} m</div>}</td>
                    <td className="getal">{e.aantal || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sd && toonStroom && !toonLagen && <StroomDeel sd={sd} map={mapRef.current} items={items} gsm={gsm} onSluit={() => setToonStroom(false)} onBinnen={(id) => setBinnenOpen(id)} />}
        {toonLagen && (
          <div className="fm-zwevend fm-deel-lagenpaneel">
            <div className="fm-deel-lagenkop"><strong>{t.lagen}</strong><button className="fm-x" aria-label="Dichtklappen" onClick={() => setToonLagen(false)}>×</button></div>
            {(() => {
              // Lagen per map, mappen dicht te klappen en in één keer aan of uit te zetten.
              const lg = data.lagen || []; const uit = []; const gezien = new Set();
              const wisselLagen = (ids, aan) => setVerborgen((v) => { const n = new Set(v); for (const id of ids) { if (aan) n.delete(id); else n.add(id); } return n; });
              const rij = (l, inMap) => (
                <label key={l.id} className={`fm-vink${inMap ? ' inmap' : ''}`}>
                  <input type="checkbox" checked={!verborgen.has(l.id)} onChange={() => wisselLagen([l.id], verborgen.has(l.id))} />
                  <span style={{ width: 10, height: 10, background: l.kleur, flex: 'none' }} /><span className="fm-afkap">{l.naam}</span>
                </label>
              );
              for (const l of lg) {
                if (!l.map) { uit.push(rij(l)); continue; }
                if (gezien.has(l.map)) continue; gezien.add(l.map);
                const ml = lg.filter((x) => x.map === l.map); const ids = ml.map((x) => x.id); const n = ids.filter((id) => !verborgen.has(id)).length; const open = !dichtMap.has(l.map);
                uit.push(
                  <div key={`m:${l.map}`}>
                    <div className="fm-deel-mapkop2">
                      <input type="checkbox" aria-label={`Map ${l.map}`} checked={n === ids.length} ref={(el) => { if (el) el.indeterminate = n > 0 && n < ids.length; }} onChange={() => wisselLagen(ids, n !== ids.length)} />
                      <button onClick={() => setDichtMap((d) => { const x = new Set(d); if (x.has(l.map)) x.delete(l.map); else x.add(l.map); return x; })}><span className="fm-afkap">{l.map}</span><span className="pijl">{open ? '▾' : '▸'}</span></button>
                    </div>
                    {open && ml.map((x) => rij(x, true))}
                  </div>,
                );
              }
              return uit;
            })()}
          </div>
        )}
      </div>
      {gsm && it && (
        <div className="fm-deel-blad" role="dialog" aria-label={it.naam || 'Info'}>
          <button className="fm-x fm-deel-blad-x" aria-label={t.sluiten || 'Sluiten'} onClick={() => setGekozen(null)}>×</button>
          <DeelPopup key={it.id} item={it} laag={lagenMap.get(it.laag_id)} element={elementenMap.get(it.element_id)} elementenMap={elementenMap} taal={taal} t={t} token={token}
            opties={opties} opmerkingen={(data.opmerkingen || []).filter((o) => o.item_id === it.id)} onBinnen={binnenHosts.has(it.id) ? () => { setGekozen(null); setBinnenOpen(it.id); } : null} on3d={() => setGroot3d(it.id)} />
        </div>
      )}
      {popupDiv && it && createPortal(
        <DeelPopup item={it} laag={lagenMap.get(it.laag_id)} element={elementenMap.get(it.element_id)} elementenMap={elementenMap} taal={taal} t={t} token={token}
          opties={opties} opmerkingen={(data.opmerkingen || []).filter((o) => o.item_id === it.id)} onBinnen={binnenHosts.has(it.id) ? () => { setGekozen(null); setBinnenOpen(it.id); } : null} on3d={() => setGroot3d(it.id)} />,
        popupDiv,
      )}
      {groot3d && (() => { const gi = items.find((x) => x.id === groot3d); return gi ? <Groot3D it={gi} el={elementenMap.get(gi.element_id)} elementenMap={elementenMap} items={items} plannen={(data.stellingplannen || []).filter((p) => p.item_id === gi.id).map((p) => ({ pad: p.pad, meta: { naam: p.naam } }))} onSluit={() => setGroot3d(null)} /> : null; })()}
      {binnenOpen && (
        <div className="fm-deel-binnen">
          <DeelBinnen data={data} elementenMap={elementenMap} taal={taal} hostId={binnenOpen} onSluit={() => setBinnenOpen(null)} />
        </div>
      )}
    </div>
  );
}

function DeelPopup({ item, laag, element, elementenMap, taal = 'nl', t, token, opties, opmerkingen, onBinnen = null, on3d = null }) {
  const [naam, setNaam] = useState('');
  const [tekst, setTekst] = useState('');
  const [verstuurd, setVerstuurd] = useState(false);
  const [lijst, setLijst] = useState(opmerkingen);
  const nav = isSign(item); // navigeren is enkel zinvol bij signalisatie

  const plaats = async () => {
    if (!tekst.trim()) return;
    const { data } = await sb().schema('maps').rpc('deel_link_opmerking', { p_token: token, p_item: item.id, p_naam: naam, p_tekst: tekst });
    if (data) {
      setLijst((l) => [...l, { auteur: naam || '—', tekst: tekst.trim(), op: new Date().toISOString() }]);
      setTekst('');
      setVerstuurd(true);
    }
  };

  return (
    <div className="fm fm-pop" style={{ width: 300, maxWidth: 'calc(100vw - 40px)' }}>
      <PopupKop item={item} laag={laag} element={element} />
      {onBinnen && <div className="blok"><button className="fm-knop zwart" style={{ width: '100%', whiteSpace: 'nowrap' }} onClick={onBinnen}>▦ {t.binnen || 'Binnen bekijken'}</button></div>}
      {on3d && heeft3d(item, element) && <div className="blok"><Knop3D it={item} el={element} elementenMap={elementenMap} onOpen={on3d} tekst={t.drie || 'In 3D bekijken'} /></div>}
      {isStellingBouw(item) && <div className="blok"><DoorgangLijst st={item.velden.stelling} /></div>}
      {element && elementenMap && !heeft3d(item, element) && ontwerpenVan(item, element, elementenMap).length > 0 && <div className="blok"><OntwerpDuimen it={item} el={element} elementenMap={elementenMap} groot max={8} zijNamen={binnenTekst(taal)} tekst={binnenTekst(taal)} /></div>}
      {opties.notities && <PopupInfo item={item} />}
      {opties.attesten !== false && item.velden?.attesten?.length > 0 && <div className="blok"><div className="fm-kop">{t.attesten}</div><AttestenLijst attesten={item.velden.attesten} /></div>}
      {opties.opmerkingen && (
        <div className="blok">
          <div className="fm-kop">{t.opm}</div>
          {!lijst.length && <div className="fm-sub">{t.geen}</div>}
          {lijst.map((o, i) => <div key={i} style={{ fontSize: 13 }}><strong>{o.auteur}</strong> {o.tekst}</div>)}
          <label className="fm-veld">{t.naam}<input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={80} /></label>
          <label className="fm-veld">{t.tekst}<textarea rows={2} value={tekst} onChange={(e) => setTekst(e.target.value)} maxLength={2000} /></label>
          <button className="fm-knop zwart" onClick={plaats}>{t.plaats}</button>
          {verstuurd && <div className="fm-sub">{t.dank}</div>}
        </div>
      )}
      {nav && <div className="blok"><NavKnoppen geometrie={item.geometrie} tekst={t.navigeer} /></div>}
    </div>
  );
}

function DeelBinnen({ data, elementenMap, taal, hostId = null, onSluit = null }) {
  const items = data.items || [];
  const host = items.find((i) => i.id === (hostId || data.link.opties.binnen));
  const vs = (Array.isArray(host?.velden?.binnenplan?.verdiepingen) && host.velden.binnenplan.verdiepingen.length) ? host.velden.binnenplan.verdiepingen : [{ id: 'g', naam: 'Gelijkvloers' }];
  // Rechtstreekse link naar een camerabeeld (?cam= of in de link zelf): die verdieping en die camera openen.
  const cam = (() => { try { return new URLSearchParams(window.location.search).get('cam') || data.link?.opties?.cam || null; } catch { return data.link?.opties?.cam || null; } })();
  const camIt = cam ? items.find((i) => i.id === cam && i.velden?.binnen?.host === host?.id) : null;
  const [verd, setVerd] = useState(camIt?.velden?.binnen?.verd && vs.some((v) => v.id === camIt.velden.binnen.verd) ? camIt.velden.binnen.verd : vs[0].id);
  if (!host) return <div className="fm" style={{ padding: 32 }}>Dit binnenplan is niet (meer) beschikbaar.</div>;
  const ols = data.plan?.instellingen?.onderleggers || [];
  const ol = ols.find((o) => o.binnen?.host === host.id && (o.binnen.verd || vs[0].id) === verd) || null;
  const leeg = () => null;
  const fotosVast = new Map();
  for (const f of data.fotos || []) { const l = fotosVast.get(f.item_id) || []; l.push({ id: f.pad, pad: f.pad, meta: { mini: f.mini } }); fotosVast.set(f.item_id, l); }
  const merk = <span className="fm-bs-merk"><i aria-hidden="true" />{[data.plan.editie_naam, data.plan.naam].filter(Boolean)[0] || 'Toolen Maps'}</span>;
  return (
    <BinnenScherm host={host} verdiepingen={vs} verd={verd} onVerd={setVerd} onderlegger={ol} items={items} taal={taal} fotosVast={fotosVast} merk={merk}
      elementen={data.elementen || []} elementenMap={elementenMap} schrijven={false} beginCamera={camIt ? cam : null} beginCameraBeeld={(() => { try { return leesBeeld(new URLSearchParams(window.location.search).get('v')); } catch { return null; } })()}
      onMaak={leeg} onWijzig={leeg} onVerwijder={leeg} onGrondplan={leeg} onPassen={leeg} onOnderlegger={leeg} onNieuweVerdieping={leeg} onSluit={onSluit} />
  );
}

