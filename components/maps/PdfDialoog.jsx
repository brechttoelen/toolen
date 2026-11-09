'use client';

// PDF maken op volledig scherm: links de instellingen en de bewaarde uitsneden,
// rechts een kaart met het afdrukkader. Het kader verschuif je door erin te
// slepen; een hoek slepen verandert de schaal. Uitsneden blijven bij het plan
// bewaard voor een volgende export, en meerdere uitsneden kunnen samen in één PDF.
import Info from './info';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { maakPdf, maakBladen, indeling, passendeSchaal, PAPIER } from './pdf';
import { maps } from './db';
import { elementVeelhoek, kader as bbox, getal } from './geo';
import { basisStijl, registreerProtocollen, zetOndergrond, klapBronvermeldingIn } from './ondergronden';
import { kaartLagen, naarGeojson, zorgVoorPatronen } from './stijl';
import { vraagTekst, bevestig } from './dialoog';
import * as turf from '@turf/turf';

const SCHALEN = [200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000, 10000];
const nieuwId = () => Math.random().toString(36).slice(2, 10);
// Een "mooie" schaal na het slepen van een hoek.
const rondSchaal = (s) => {
  const stap = s < 500 ? 25 : s < 2000 ? 50 : s < 5000 ? 250 : 500;
  return Math.max(50, Math.round(s / stap) * stap);
};
const schaalTekst = (s) => `1:${Number(s).toLocaleString('nl-BE')}`;

export default function PdfDialoog({ nieuwTab = false, plan, lagen, fasen, items, elementenMap, actieveFase, kaart, onSluit, onPlan }) {
  const opgeslagen = plan.instellingen?.pdf || {};
  const [inst, setInst] = useState({
    papier: 'A3', orientatie: 'liggend', vrijB: 2100, vrijH: 1500, schaal: null, ondergrond: plan.basiskaart === 'stratenkaart' ? 'lijntekening' : plan.basiskaart,
    dimmen: 0, legende: true, stuklijst: true, maten: false, dpi: 200, raster: { aan: false, kolommen: 12, index: true },
    lagen: lagen.filter((l) => l.printbaar && l.zichtbaar).map((l) => l.id), ...opgeslagen,
  });
  const [fase, setFase] = useState(actieveFase || '');
  const [bezig, setBezig] = useState('');
  const [meldingen, setMeldingen] = useState([]);
  const [fout, setFout] = useState('');
  const [uitsneden, setUitsneden] = useState(() => plan.instellingen?.pdf_uitsneden || []);
  const [actief, setActief] = useState(null); // id van de geladen uitsnede
  const [aangevinkt, setAangevinkt] = useState([]);

  const zet = (p) => setInst((i) => ({ ...i, ...p }));
  const [versies, setVersies] = useState([]);
  const [revisieVan, setRevisieVan] = useState('');
  useEffect(() => {
    maps().from('versies').select('id, versie, opmerking, created_at').eq('plan_id', plan.id).order('versie', { ascending: false })
      .then(({ data }) => setVersies(data || []));
  }, [plan.id]);
  const L = indeling(inst);
  const zichtbareItems = useMemo(() => items.filter((i) => !i.verborgen && (!i.laag_id || inst.lagen.includes(i.laag_id)) && (!fase || !i.fase_ids?.length || i.fase_ids.includes(fase))), [items, inst.lagen, fase]);
  const itemKader = useMemo(() => bbox(zichtbareItems.map((i) => i.geometrie)), [zichtbareItems]);
  const schaal = inst.schaal || passendeSchaal(L.kader.b, L.kader.h, itemKader);
  const grondB = (L.kader.b / 1000) * schaal;
  const grondH = (L.kader.h / 1000) * schaal;

  // Midden van het kader: bij 'passend' het midden van de items, anders vrij te verschuiven.
  const [eigenMidden, setEigenMidden] = useState(() => opgeslagen.centrum || (kaart ? [kaart.getCenter().lng, kaart.getCenter().lat] : (plan.centrum || [4.4, 50.9])));
  const centrum = useMemo(() => {
    if (!inst.schaal && itemKader) return [(itemKader[0] + itemKader[2]) / 2, (itemKader[1] + itemKader[3]) / 2];
    return eigenMidden;
  }, [inst.schaal, itemKader, eigenMidden]);
  const kaderGeom = useMemo(() => elementVeelhoek(centrum, grondB, grondH, 0), [centrum, grondB, grondH]);

  // ---------- Voorbeeldkaart ----------
  const vakRef = useRef(null);
  const mapRef = useRef(null);
  const [klaar, setKlaar] = useState(false);
  const stRef = useRef({}); stRef.current = { centrum, grondB, grondH, kaderGeom, schaal, L, inst };
  useEffect(() => {
    if (!vakRef.current) return undefined;
    registreerProtocollen();
    const map = new maplibregl.Map({
      container: vakRef.current, style: basisStijl(inst.ondergrond === 'leeg' ? 'leeg' : inst.ondergrond),
      center: kaart ? kaart.getCenter() : centrum, zoom: kaart ? kaart.getZoom() : 17, maxZoom: 22, dragRotate: false, attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    klapBronvermeldingIn(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 140 }), 'bottom-left');
    map.on('load', () => {
      zetOndergrond(map, inst.ondergrond);
      map.addSource('fm-vormen', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('fm-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      for (const l of kaartLagen(centrum[1])) map.addLayer(l);
      const leeg = { type: 'FeatureCollection', features: [] };
      map.addSource('pdf-buiten', { type: 'geojson', data: leeg });
      map.addLayer({ id: 'pdf-buiten', type: 'fill', source: 'pdf-buiten', paint: { 'fill-color': '#1d1d1b', 'fill-opacity': 0.35 } });
      map.addSource('pdf-kader', { type: 'geojson', data: leeg });
      map.addLayer({ id: 'pdf-kader-l', type: 'line', source: 'pdf-kader', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': '#E11D48', 'line-width': 2.5 } });
      map.addLayer({ id: 'pdf-kader-h', type: 'circle', source: 'pdf-kader', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#E11D48', 'circle-stroke-width': 2.5 } });
      map.addSource('pdf-andere', { type: 'geojson', data: leeg });
      map.addLayer({ id: 'pdf-andere-l', type: 'line', source: 'pdf-andere', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': '#2563EB', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'pdf-andere-t', type: 'symbol', source: 'pdf-andere', filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['get', 'naam'], 'text-size': 12, 'text-font': ['Noto Sans Bold'], 'symbol-placement': 'point', 'text-anchor': 'top-left', 'text-offset': [0.4, 0.4], 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#2563EB', 'text-halo-width': 2.5 } });
      // Het kader in beeld brengen.
      const g = stRef.current.kaderGeom.coordinates[0];
      const xs = g.map((p) => p[0]); const ys = g.map((p) => p[1]);
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, duration: 0, maxZoom: 21 });
      setKlaar(true);
    });

    // Kader verslepen (erin klikken) of een hoek verslepen (schaal).
    let sleep = null;
    const hoekBij = (e) => {
      const g = stRef.current.kaderGeom.coordinates[0].slice(0, 4);
      return g.findIndex((p) => { const q = map.project(p); return Math.hypot(q.x - e.point.x, q.y - e.point.y) < 12; });
    };
    const binnen = (e) => { try { return turf.booleanPointInPolygon([e.lngLat.lng, e.lngLat.lat], stRef.current.kaderGeom); } catch { return false; } };
    const neer = (e) => {
      if (e.originalEvent.button !== 0) return;
      const h = hoekBij(e);
      if (h >= 0) { e.preventDefault(); map.dragPan.disable(); sleep = { hoek: true }; return; }
      if (binnen(e)) { e.preventDefault(); map.dragPan.disable(); sleep = { start: [e.lngLat.lng, e.lngLat.lat], midden: stRef.current.centrum }; }
    };
    const beweeg = (e) => {
      if (!sleep) {
        map.getCanvas().style.cursor = hoekBij(e) >= 0 ? 'nwse-resize' : binnen(e) ? 'move' : '';
        return;
      }
      if (sleep.hoek) {
        // Afstand tot het midden bepaalt de schaal.
        const c = stRef.current.centrum; const { L: L0 } = stRef.current;
        const dx = turf.distance(c, [e.lngLat.lng, c[1]], { units: 'meters' }) * 2;
        const dy = turf.distance(c, [c[0], e.lngLat.lat], { units: 'meters' }) * 2;
        const s = Math.max(dx / (L0.kader.b / 1000), dy / (L0.kader.h / 1000));
        setEigenMidden(c);
        setInst((i) => ({ ...i, schaal: rondSchaal(s) }));
        setActief(null);
        return;
      }
      const dx = e.lngLat.lng - sleep.start[0]; const dy = e.lngLat.lat - sleep.start[1];
      setEigenMidden([sleep.midden[0] + dx, sleep.midden[1] + dy]);
      if (!stRef.current.inst.schaal) setInst((i) => ({ ...i, schaal: stRef.current.schaal }));
      setActief(null);
    };
    const los = () => { if (sleep) { sleep = null; map.dragPan.enable(); } };
    map.on('mousedown', neer); map.on('mousemove', beweeg); map.on('mouseup', los);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Items in het voorbeeld (enkel wat op het blad komt).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klaar) return;
    const lagenMap = new Map(lagen.map((l) => [l.id, l]));
    const verborgen = new Set(lagen.filter((l) => !inst.lagen.includes(l.id)).map((l) => l.id));
    const tb = inst.toebehoren === 'altijd' || (inst.toebehoren !== 'nooit' && schaal <= 500);
    const { vormen, labels } = naarGeojson(items.filter((i) => !i.velden?.binnen), lagenMap, elementenMap, { verborgenLagen: verborgen, actieveFase: fase || null, verbergElementen: plan.instellingen?.verborgen_elementen, doek: inst.doek !== false, toebehoren: tb, doeknaam: inst.doeknaam === true });
    zorgVoorPatronen(map, vormen.features, labels.features);
    map.getSource('fm-vormen')?.setData(vormen);
    map.getSource('fm-labels')?.setData(labels);
  }, [items, lagen, elementenMap, inst.lagen, fase, klaar, inst.doek, inst.doeknaam, inst.toebehoren, schaal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mapRef.current && klaar) zetOndergrond(mapRef.current, inst.ondergrond); }, [inst.ondergrond, klaar]);

  // Kader, verduistering erbuiten en de andere bewaarde uitsneden.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klaar) return;
    const ring = kaderGeom.coordinates[0];
    map.getSource('pdf-kader')?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: kaderGeom, properties: {} }, ...ring.slice(0, 4).map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }))] });
    map.getSource('pdf-buiten')?.setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [...ring].reverse()] }, properties: {} });
    const andere = uitsneden.filter((u) => u.id !== actief).map((u) => {
      const Lu = indeling({ ...inst, ...u });
      const g = elementVeelhoek(u.centrum, (Lu.kader.b / 1000) * u.schaal, (Lu.kader.h / 1000) * u.schaal, 0);
      return [{ type: 'Feature', geometry: g, properties: {} }, { type: 'Feature', geometry: { type: 'Point', coordinates: g.coordinates[0][3] }, properties: { naam: u.naam } }];
    }).flat();
    map.getSource('pdf-andere')?.setData({ type: 'FeatureCollection', features: andere });
  }, [kaderGeom, klaar, uitsneden, actief, inst]);

  const naarKader = () => {
    const map = mapRef.current; if (!map) return;
    const g = kaderGeom.coordinates[0]; const xs = g.map((p) => p[0]); const ys = g.map((p) => p[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, maxZoom: 21 });
  };
  const kaderHierheen = () => {
    const map = mapRef.current; if (!map) return;
    const c = map.getCenter();
    setEigenMidden([c.lng, c.lat]);
    if (!inst.schaal) zet({ schaal });
    setActief(null);
  };

  // ---------- Uitsneden ----------
  const bewaarUitsneden = (lijst) => {
    setUitsneden(lijst);
    onPlan?.({ instellingen: { ...(plan.instellingen || {}), pdf_uitsneden: lijst } });
  };
  const huidigeUitsnede = () => ({ centrum, schaal, papier: inst.papier, orientatie: inst.orientatie, vrijB: inst.vrijB, vrijH: inst.vrijH });
  const nieuweUitsnede = async () => {
    const naam = await vraagTekst('Naam van deze uitsnede (bv. "Aankomstzone detail")', `Uitsnede ${uitsneden.length + 1}`, { titel: 'Uitsnede bewaren', ok: 'Bewaren' });
    if (!naam?.trim()) return;
    const u = { id: nieuwId(), naam: naam.trim(), ...huidigeUitsnede() };
    bewaarUitsneden([...uitsneden, u]); setActief(u.id);
  };
  const laad = (u) => {
    setInst((i) => ({ ...i, papier: u.papier || i.papier, orientatie: u.orientatie || i.orientatie, vrijB: u.vrijB ?? i.vrijB, vrijH: u.vrijH ?? i.vrijH, schaal: u.schaal }));
    setEigenMidden(u.centrum); setActief(u.id);
    setTimeout(() => {
      const map = mapRef.current; if (!map) return;
      const Lu = indeling({ ...inst, ...u });
      const g = elementVeelhoek(u.centrum, (Lu.kader.b / 1000) * u.schaal, (Lu.kader.h / 1000) * u.schaal, 0).coordinates[0];
      const xs = g.map((p) => p[0]); const ys = g.map((p) => p[1]);
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, maxZoom: 21 });
    }, 0);
  };
  const actieveU = uitsneden.find((u) => u.id === actief);
  const gewijzigdeU = actieveU && (Math.abs(actieveU.schaal - schaal) > 0.1 || actieveU.papier !== inst.papier || actieveU.orientatie !== inst.orientatie || turf.distance(actieveU.centrum, centrum, { units: 'meters' }) > 0.5);

  // ---------- Maken ----------
  const opties = async () => {
    const f = fasen.find((x) => x.id === fase) || null;
    let revisie = null;
    if (revisieVan) {
      const { data } = await maps().from('versies').select('versie, momentopname').eq('id', revisieVan).single();
      if (data) revisie = { versie: data.versie, items: data.momentopname?.items || [] };
    }
    const revisies = inst.revisietabel !== false ? versies : [];
    return { f, revisie, revisies };
  };
  const bestandsnaam = (f, extra = '') => [plan.editie_naam, plan.naam, extra, f?.naam, `v${plan.versie}`].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '');
  const bewaarInstellingen = () => onPlan?.({ instellingen: { ...(plan.instellingen || {}), pdf_uitsneden: uitsneden, pdf: { ...inst, lagen: undefined, centrum: inst.schaal ? centrum : undefined } } });
  // In een eigen tabblad (met voortgang), zodat je hier verder kan werken.
  const inTab = async (opdracht) => {
    const { startExport } = await import('./planLaden');
    const { lagen: _l, revisie: _r, revisies: _rs, onTegels: _o, ...rest } = inst;
    const ok = startExport(plan.id, { ...opdracht, faseId: fase || null, revisieVan: revisieVan || null, revisies: inst.revisietabel !== false ? versies : [], inst: { ...rest, lagen: inst.lagen, centrum } });
    if (ok) { bewaarInstellingen(); onSluit(); }
    return ok;
  };
  const maak = async () => {
    setFout(''); setMeldingen([]);
    if (nieuwTab && await inTab({ soort: 'pdf', inst: null, bestandsnaam: bestandsnaam(fasen.find((x) => x.id === fase) || null, actieveU && !gewijzigdeU ? actieveU.naam : '') }).catch(() => false)) return;
    try {
      const { f, revisie, revisies } = await opties();
      const args = { plan, lagen, items, elementenMap, fase: f, inst: { ...inst, schaal: inst.schaal, centrum, revisie, revisies }, voortgang: setBezig };
      const { doc, meldingen: m } = inst.bladen ? await maakBladen(args) : await maakPdf(args);
      setMeldingen(m);
      doc.save(`${bestandsnaam(f, actieveU && !gewijzigdeU ? actieveU.naam : '')}.pdf`);
      bewaarInstellingen();
    } catch (e) {
      setFout(e?.message || String(e));
    } finally {
      setBezig('');
    }
  };
  const maakMeerdere = async () => {
    setFout(''); setMeldingen([]);
    const lijst = uitsneden.filter((u) => aangevinkt.includes(u.id));
    if (nieuwTab && await inTab({ soort: 'uitsneden', lijst, bestandsnaam: bestandsnaam(fasen.find((x) => x.id === fase) || null, `${lijst.length} uitsneden`) }).catch(() => false)) return;
    try {
      const { f, revisie, revisies } = await opties();
      let doc = null; const alle = [];
      for (let i = 0; i < lijst.length; i++) {
        const u = lijst[i];
        setBezig(`Uitsnede ${i + 1} van ${lijst.length}: ${u.naam}…`);
        const r = await maakPdf({ plan, lagen, items, elementenMap, fase: f, inst: { ...inst, papier: u.papier || inst.papier, orientatie: u.orientatie || inst.orientatie, vrijB: u.vrijB ?? inst.vrijB, vrijH: u.vrijH ?? inst.vrijH, schaal: u.schaal, centrum: u.centrum, revisie, revisies }, voortgang: () => {}, doc, blad: { label: u.naam, laatste: i === lijst.length - 1 } });
        doc = r.doc;
        for (const m of r.meldingen) if (!alle.includes(m)) alle.push(m);
      }
      setMeldingen(alle);
      doc.save(`${bestandsnaam(f, `${lijst.length} uitsneden`)}.pdf`);
      bewaarInstellingen();
    } catch (e) {
      setFout(e?.message || String(e));
    } finally {
      setBezig('');
    }
  };

  // Vaste luisteraar (via een ref): anders wordt hij tijdens dezelfde toetsaanslag
  // vervangen door een herteken van de editor en komt Escape nooit aan.
  const sluitRef = useRef(onSluit); sluitRef.current = onSluit;
  useEffect(() => {
    const toets = (e) => { if (e.key === 'Escape' && !e.target?.closest?.('.fm-appdialoog-achter')) sluitRef.current(); };
    window.addEventListener('keydown', toets);
    return () => window.removeEventListener('keydown', toets);
  }, []);

  const wissel = (id) => zet({ lagen: inst.lagen.includes(id) ? inst.lagen.filter((x) => x !== id) : [...inst.lagen, id] });
  const schaalOpties = SCHALEN.includes(inst.schaal) || !inst.schaal ? SCHALEN : [...SCHALEN, inst.schaal].sort((a, b) => a - b);

  return (
    <div className="fm fm-pdfscherm" role="dialog" aria-label="PDF maken">
      <header className="fm-pdfkop">
        <strong>PDF maken</strong>
        <span className="fm-sub">{plan.naam}</span>
        <span style={{ flex: 1 }} />
        <button className="fm-knop" onClick={onSluit}>Sluiten <span className="fm-sub" style={{ marginLeft: 6 }}>Esc</span></button>
      </header>
      <div className="fm-pdfromp">
        <aside className="fm-pdfpaneel">
          <div className="fm-sectie">
            <div className="fm-kop">Uitsneden<Info>Bewaar een zone (bv. een detail van de aankomst) om ze later opnieuw af te drukken. Vink er meerdere aan voor één PDF.</Info></div>
            <div className="fm-uitsneden">
              <button className={`fm-uitsnede ${!actief && !inst.schaal ? 'aan' : ''}`} onClick={() => { zet({ schaal: null }); setActief(null); setTimeout(naarKader, 0); }}>
                <span className="naam">Alles passend</span><small>alle items op één blad</small>
              </button>
              {uitsneden.map((u) => (
                <div key={u.id} className={`fm-uitsnede ${actief === u.id ? 'aan' : ''}`}>
                  <input type="checkbox" aria-label={`${u.naam} meenemen in één PDF`} checked={aangevinkt.includes(u.id)} onChange={(e) => setAangevinkt((a) => (e.target.checked ? [...a, u.id] : a.filter((x) => x !== u.id)))} />
                  <button className="tekst" onClick={() => laad(u)}>
                    <span className="naam">{u.naam}</span><small>{u.papier === 'vrij' ? 'vrij formaat' : u.papier} {u.orientatie} · {schaalTekst(u.schaal)}</small>
                  </button>
                  <button className="ic" title="Hernoemen" onClick={async () => { const n = await vraagTekst('Nieuwe naam', u.naam, { ok: 'Hernoemen' }); if (n?.trim()) bewaarUitsneden(uitsneden.map((x) => (x.id === u.id ? { ...x, naam: n.trim() } : x))); }}>✎</button>
                  <button className="ic gevaar" title="Verwijderen" onClick={async () => { if (await bevestig(`Uitsnede "${u.naam}" verwijderen?`, { ok: 'Verwijderen', gevaar: true })) { bewaarUitsneden(uitsneden.filter((x) => x.id !== u.id)); setAangevinkt((a) => a.filter((x) => x !== u.id)); if (actief === u.id) setActief(null); } }}>×</button>
                </div>
              ))}
            </div>
            <div className="fm-vinkrij" style={{ gap: 6 }}>
              {gewijzigdeU
                ? <button className="fm-knop klein zwart" onClick={() => bewaarUitsneden(uitsneden.map((x) => (x.id === actief ? { ...x, ...huidigeUitsnede() } : x)))}>Wijziging bewaren in "{actieveU.naam}"</button>
                : null}
              <button className="fm-knop klein" onClick={nieuweUitsnede}>+ Huidig kader bewaren als uitsnede</button>
            </div>
          </div>
          <div className="fm-sectie">
            <div className="fm-kop">Blad</div>
            <div className="fm-raster2">
              <label className="fm-veld">Papier
                <select value={inst.papier} onChange={(e) => zet({ papier: e.target.value })}>
                  {Object.keys(PAPIER).map((p) => <option key={p}>{p}</option>)}
                  <option value="vrij">Vrij formaat</option>
                </select>
              </label>
              <label className="fm-veld">Richting
                <select value={inst.orientatie} onChange={(e) => zet({ orientatie: e.target.value })}><option value="liggend">Liggend</option><option value="staand">Staand</option></select>
              </label>
            </div>
            {inst.papier === 'vrij' && (
              <div className="fm-raster2">
                <label className="fm-veld">Breedte (mm)<input value={inst.vrijB} onChange={(e) => zet({ vrijB: e.target.value })} inputMode="numeric" /></label>
                <label className="fm-veld">Hoogte (mm)<input value={inst.vrijH} onChange={(e) => zet({ vrijH: e.target.value })} inputMode="numeric" /></label>
              </div>
            )}
            <div className="fm-raster2">
              <label className="fm-veld">Schaal
                <select value={inst.schaal || ''} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; if (v && !inst.schaal) setEigenMidden(centrum); zet({ schaal: v }); }}>
                  <option value="">Passend (nu {schaalTekst(schaal)})</option>
                  {schaalOpties.map((s) => <option key={s} value={s}>{schaalTekst(s)}</option>)}
                </select>
              </label>
              <label className="fm-veld">Ondergrond
                <select value={inst.ondergrond} onChange={(e) => zet({ ondergrond: e.target.value })}>
                  <option value="luchtfoto">Luchtfoto</option><option value="luchtfoto_straten">Luchtfoto met straten</option><option value="lijntekening">Lijntekening (GRB)</option><option value="leeg">Leeg</option>
                </select>
              </label>
            </div>
            <div className="fm-raster2">
              <label className="fm-veld">Ondergrond dimmen
                <select value={inst.dimmen} onChange={(e) => zet({ dimmen: Number(e.target.value) })}><option value={0}>Niet</option><option value={0.3}>30%</option><option value={0.5}>50%</option></select>
              </label>
              <label className="fm-veld">Resolutie
                <select value={inst.dpi} onChange={(e) => zet({ dpi: Number(e.target.value) })}><option value={150}>150 dpi (snel)</option><option value={200}>200 dpi</option><option value={300}>300 dpi</option></select>
              </label>
            </div>
            {fasen.length > 0 && (
              <label className="fm-veld">Fase
                <select value={fase} onChange={(e) => setFase(e.target.value)}><option value="">Alle fasen</option>{fasen.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}</select>
              </label>
            )}
          </div>
          <div className="fm-sectie">
            <div className="fm-kop">Lagen</div>
            {lagen.map((l) => <label key={l.id} className="fm-vink"><input type="checkbox" checked={inst.lagen.includes(l.id)} onChange={() => wissel(l.id)} /><span style={{ width: 10, height: 10, background: l.kleur }} />{l.naam}</label>)}
          </div>
          <div className="fm-sectie">
            <div className="fm-kop">Op het blad</div>
            <label className="fm-vink"><input type="checkbox" checked={inst.titelblok !== false} onChange={(e) => zet({ titelblok: e.target.checked })} />Titelblok</label>
            <label className="fm-vink"><input type="checkbox" checked={inst.legende} onChange={(e) => zet({ legende: e.target.checked })} />Legende</label>
            {inst.legende === false && <div className="fm-sub">Zonder legende loopt de kaart over de volledige breedte; titelblok en schaal staan klein in een vrije hoek.</div>}
            <label className="fm-vink"><input type="checkbox" checked={inst.maten} onChange={(e) => zet({ maten: e.target.checked })} />Maten bij elementen</label>
            <label className="fm-vink"><input type="checkbox" checked={inst.doek !== false} onChange={(e) => zet({ doek: e.target.checked })} />Doek op hekken tonen als band</label>
            {inst.doek !== false && <label className="fm-vink"><input type="checkbox" checked={inst.doekenlijst !== false} onChange={(e) => zet({ doekenlijst: e.target.checked })} />Doekenlijst per hek als extra pagina (om af te vinken)</label>}
            {inst.doek !== false && <label className="fm-vink"><input type="checkbox" checked={inst.doeknaam === true} onChange={(e) => zet({ doeknaam: e.target.checked })} />Naam van bedrukt doek op de lijn (voor detailuitsneden)</label>}
            <label className="fm-veld">Toebehoren (klemmen, schoren …)
              <select value={inst.toebehoren || 'detail'} onChange={(e) => zet({ toebehoren: e.target.value })}>
                <option value="detail">Tonen vanaf 1:500 (nu {schaal <= 500 ? 'wel' : 'niet'})</option><option value="altijd">Altijd tonen</option><option value="nooit">Niet tonen</option>
              </select>
            </label>
            <label className="fm-vink"><input type="checkbox" checked={inst.stuklijst} onChange={(e) => zet({ stuklijst: e.target.checked })} />Stuklijst als extra pagina</label>
            {inst.titelblok !== false && <label className="fm-vink"><input type="checkbox" checked={inst.revisietabel !== false} onChange={(e) => zet({ revisietabel: e.target.checked })} />Revisietabel in het titelblok</label>}
            {versies.length > 0 && (
              <label className="fm-veld">Wijzigingen markeren met wolkjes
                <select value={revisieVan} onChange={(e) => setRevisieVan(e.target.value)}>
                  <option value="">Niet</option>
                  {versies.map((v) => <option key={v.id} value={v.id}>t.o.v. versie {v.versie}{v.opmerking ? ` · ${v.opmerking.slice(0, 30)}` : ''}</option>)}
                </select>
              </label>
            )}
            <label className="fm-vink"><input type="checkbox" checked={!!inst.bladen} onChange={(e) => zet({ bladen: e.target.checked })} />Bladindeling: alles op vaste schaal over meerdere bladen</label>
            {inst.bladen && !inst.schaal && <div className="fm-sub" style={{ color: '#8A4D00' }}>Kies hierboven een vaste schaal.</div>}
            <label className="fm-vink"><input type="checkbox" checked={inst.raster.aan} onChange={(e) => zet({ raster: { ...inst.raster, aan: e.target.checked } })} />Rasterplan met vakken (A, B, C … en 1, 2, 3 …)</label>
            {inst.raster.aan && (
              <div className="fm-raster2">
                <label className="fm-veld">Kolommen<input value={inst.raster.kolommen} inputMode="numeric" onChange={(e) => zet({ raster: { ...inst.raster, kolommen: e.target.value } })} /></label>
                <label className="fm-vink" style={{ alignSelf: 'end' }}><input type="checkbox" checked={inst.raster.index !== false} onChange={(e) => zet({ raster: { ...inst.raster, index: e.target.checked } })} />Index met vakken</label>
              </div>
            )}
            <div className="fm-sub">Titelblok: in te vullen bij het plan (niets geselecteerd).</div>
          </div>
          <div className="fm-pdfvoet">
            {fout && <div className="fm-melding fout">{fout}</div>}
            {meldingen.map((m) => <div key={m} className="fm-melding">{m}</div>)}
            <button className="fm-knop rood vol" disabled={!!bezig} onClick={maak}>{bezig || `PDF maken${actieveU && !gewijzigdeU ? ` · ${actieveU.naam}` : ''}`}</button>
            {aangevinkt.length > 1 && <button className="fm-knop vol" disabled={!!bezig} onClick={maakMeerdere}>{aangevinkt.length} uitsneden samen in één PDF</button>}
          </div>
        </aside>
        <div className="fm-pdfkaart">
          <div ref={vakRef} style={{ position: 'absolute', inset: 0 }} />
          <div className="fm-pdfinfo">
            <strong>{inst.papier === 'vrij' ? `${inst.vrijB} × ${inst.vrijH} mm` : `${inst.papier} ${inst.orientatie}`} · {schaalTekst(schaal)}</strong>
            <span>{getal(grondB, 0)} × {getal(grondH, 0)} m op het blad</span>
            <span className="fm-sub">Sleep het kader om te verschuiven, een hoek om te zoomen</span>
            <div className="fm-vinkrij" style={{ gap: 6 }}>
              <button className="fm-knop klein" onClick={naarKader}>Toon kader</button>
              <button className="fm-knop klein" onClick={kaderHierheen}>Kader naar het midden van het beeld</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
