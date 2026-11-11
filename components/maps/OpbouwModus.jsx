'use client';

import { streetViewUrl } from './streetview';
import { metTekeningen } from './tekeningen';
import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import './maps.css';
import { maps, sb, BUCKET, foutTekst, wieBenIk, magSchrijven, publiekeUrl as publiekeUrlOp } from './db';
import { basisStijl, registreerProtocollen, WA_TEGEL, klapBronvermeldingIn, kiesFotoVl, fotoVlTegel } from './ondergronden';
import { kaartLagen, naarGeojson, zorgVoorPatronen, maten, matenTekst, doekenPerHek, isTotem, isVlag, isVlagHek, totemPanelen, trussDoek } from './stijl';
import { middelpunt, kader, getal } from './geo';
import { navigatieUrl } from './PopupInhoud';
import { isSign, instSign } from './signalisatie';
import { BordVoorbeeld } from './bord';

// Opbouwmodus voor de gsm: per item "geplaatst" aanvinken, foto, navigeren.
export default function OpbouwModus({ planId }) {
  const kaartRef = useRef(null);
  const mapRef = useRef(null);
  const [profiel, setProfiel] = useState(null);
  const [plan, setPlan] = useState(null);
  const [lagen, setLagen] = useState([]);
  const [fasen, setFasen] = useState([]);
  const [items, setItems] = useState([]);
  const [elementen, setElementen] = useState([]);
  const [fout, setFout] = useState('');
  const [klaar, setKlaar] = useState(false);
  const [filter, setFilter] = useState({ laag: '', fase: '', open: true });
  const [mijn, setMijn] = useState(null);
  const [gekozen, setGekozen] = useState(null);
  const [fotoBezig, setFotoBezig] = useState(null);
  const [fotos, setFotos] = useState({});
  const [offline, setOffline] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [wie, p, l, f, i, b, ft] = await Promise.all([
          wieBenIk(),
          maps().from('plannen').select('*').eq('id', planId).maybeSingle(),
          maps().from('lagen').select('*').eq('plan_id', planId).order('volgorde'),
          maps().from('fasen').select('*').eq('plan_id', planId).order('volgorde'),
          maps().from('items').select('*').eq('plan_id', planId).order('volgorde'),
          maps().from('bibliotheek').select('*').or(`plan_id.is.null,plan_id.eq.${planId}`),
          maps().from('bestanden').select('item_id').eq('plan_id', planId).eq('soort', 'foto'),
        ]);
        const e = [p, l, f, i, b].find((r) => r.error);
        if (e) throw e.error;
        if (!p.data) throw new Error('Dit plan bestaat niet (meer).');
        setProfiel(wie); setPlan(p.data); setLagen(l.data || []); setFasen(f.data || []); setItems(pasWachtrijToe(i.data || [])); setElementen(metTekeningen(b.data || []));
        try { localStorage.setItem(`fm-opbouw-${planId}`, JSON.stringify({ wie, plan: p.data, lagen: l.data, fasen: f.data, items: i.data, elementen: b.data, op: Date.now() })); } catch {}
        const tel = {};
        for (const x of ft.data || []) if (x.item_id) tel[x.item_id] = (tel[x.item_id] || 0) + 1;
        setFotos(tel);
      } catch (err) {
        // Geen verbinding: laatst bewaarde versie van dit plan tonen.
        let oud = null;
        try { oud = JSON.parse(localStorage.getItem(`fm-opbouw-${planId}`) || 'null'); } catch {}
        if (oud?.plan) {
          setProfiel(oud.wie); setPlan(oud.plan); setLagen(oud.lagen || []); setFasen(oud.fasen || []); setItems(pasWachtrijToe(oud.items || [])); setElementen(oud.elementen || []);
          setOffline(`Offline: plan van ${new Date(oud.op).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}. Wat je aanvinkt, gaat door zodra er weer verbinding is.`);
        } else setFout(foutTekst(err));
      }
    })();
  }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wachtrij voor "geplaatst" zonder verbinding.
  const wachtrijSleutel = `fm-opbouw-wachtrij-${planId}`;
  // Enkel de gewijzigde velden bewaren: een collega die iets anders aan hetzelfde item wijzigde,
  // wordt niet overschreven. velden gaan per sleutel via item_wijzig (migratie 006).
  async function schrijf(id, patch) {
    const { velden, ...rest } = patch;
    if (velden) {
      const r = await maps().rpc('item_wijzig', { p_id: id, p_rev: null, p_patch: { velden } });
      if (r.error) return r;
    }
    if (Object.keys(rest).length) return maps().from('items').update(rest).eq('id', id);
    return { error: null };
  }
  const voegSamen = (a = {}, b = {}) => ({ ...a, ...b, ...(a.velden || b.velden ? { velden: { ...(a.velden || {}), ...(b.velden || {}) } } : {}) });
  function leesWachtrij() { try { return JSON.parse(localStorage.getItem(wachtrijSleutel) || '{}'); } catch { return {}; } }
  function pasWachtrijToe(lijst) { const w = leesWachtrij(); return lijst.map((x) => (w[x.id] ? voegSamen(x, w[x.id]) : x)); }
  const verstuurWachtrij = async () => {
    const w = leesWachtrij();
    const ids = Object.keys(w);
    if (!ids.length) return;
    for (const id of ids) {
      const { error } = await schrijf(id, w[id]);
      if (!error) delete w[id];
    }
    try { localStorage.setItem(wachtrijSleutel, JSON.stringify(w)); } catch {}
    if (!Object.keys(w).length) setOffline('');
  };
  useEffect(() => {
    verstuurWachtrij();
    window.addEventListener('online', verstuurWachtrij);
    return () => window.removeEventListener('online', verstuurWachtrij);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Service worker voor kaarttegels (enkel binnen /maps/).
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/maps-sw.js', { scope: '/maps/' }).catch(() => {});
  }, []);
  const [offlineBezig, setOfflineBezig] = useState('');
  const zoneOffline = async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const tegel = (lng, lat, z) => {
      const n = 2 ** z;
      const x = Math.floor(((lng + 180) / 360) * n);
      const r = (lat * Math.PI) / 180;
      const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
      return [x, y];
    };
    const urls = [];
    const midden = map.getCenter();
    const inVl = midden.lng > 2.52 && midden.lng < 5.95 && midden.lat > 50.67 && midden.lat < 51.51;
    const inNl = midden.lng > 3.2 && midden.lng < 7.25 && midden.lat > 50.72 && midden.lat < 53.6;
    const inWa = midden.lng > 2.8 && midden.lng < 6.45 && midden.lat > 49.45 && midden.lat < 50.85;
    // Zelfde bbox-tekst als MapLibre maakt, zodat de cache overeenkomt.
    const merc = (x, y, z) => { const r = 2 * Math.PI * 6378137 / 256 / Math.pow(2, z); return [x * r - 2 * Math.PI * 6378137 / 2, y * r - 2 * Math.PI * 6378137 / 2]; };
    const bboxTekst = (x, y, z) => { const s2 = Math.pow(2, z) - y - 1; const a = merc(256 * x, 256 * s2, z); const l = merc(256 * (x + 1), 256 * (s2 + 1), z); return a[0] + ',' + a[1] + ',' + l[0] + ',' + l[1]; };
    for (let z = 14; z <= 19; z++) {
      const [x0, y0] = tegel(b.getWest(), b.getNorth(), z);
      const [x1, y1] = tegel(b.getEast(), b.getSouth(), z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        if (inVl) urls.push(fotoVlTegel(z, x, y));
        if (inNl) urls.push(`https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/${String(z).padStart(2, '0')}/${x}/${y}.jpeg`);
        if (inWa) urls.push(WA_TEGEL(bboxTekst(x, y, z)));
      }
    }
    if (!urls.length) { setOfflineBezig('Offline kaarten kan enkel in Vlaanderen, Wallonië en Nederland.'); return; }
    if (urls.length > 4000) { setOfflineBezig(`Te groot gebied (${urls.length} tegels). Zoom verder in.`); return; }
    let klaar = 0;
    const doe = async (u) => { try { await fetch(u, { mode: 'cors' }); } catch {} klaar += 1; if (klaar % 25 === 0) setOfflineBezig(`Bewaren… ${klaar}/${urls.length}`); };
    for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i, i + 8).map(doe));
    setOfflineBezig(`${urls.length} kaarttegels bewaard voor dit gebied.`);
  };

  const lagenMap = useMemo(() => new Map(lagen.map((l) => [l.id, l])), [lagen]);
  const elMap = useMemo(() => new Map(elementen.map((e) => [e.id, e])), [elementen]);
  const schrijven = magSchrijven(profiel);

  const lijst = useMemo(() => {
    let l = items.filter((i) => !i.verborgen && i.soort !== 'tekst' && i.velden?.stroom?.rol !== 'kabel');
    if (filter.laag) l = l.filter((i) => i.laag_id === filter.laag);
    if (filter.fase) l = l.filter((i) => !i.fase_ids?.length || i.fase_ids.includes(filter.fase));
    if (filter.open) l = l.filter((i) => !i.geplaatst_op);
    const afst = (i) => (mijn ? turf.distance(mijn, middelpunt(i.geometrie), { units: 'meters' }) : null);
    return l.map((i) => ({ i, d: afst(i) })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0) || (a.i.volgorde - b.i.volgorde));
  }, [items, filter, mijn]);

  // Kaart
  useEffect(() => {
    if (!plan || !kaartRef.current || mapRef.current) return;
    registreerProtocollen();
    const map = new maplibregl.Map({ container: kaartRef.current, style: (kiesFotoVl(plan.instellingen?.fotoVl), basisStijl(plan.basiskaart || 'luchtfoto')), center: plan.centrum || [4.4, 50.9], zoom: Number(plan.zoom) || 17, maxZoom: 21, dragRotate: false, attributionControl: { compact: true } });
    klapBronvermeldingIn(map);
    map.touchZoomRotate.disableRotation();
    const geo = new maplibregl.GeolocateControl({ trackUserLocation: true, positionOptions: { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 } });
    map.addControl(geo, 'top-right');
    geo.on('geolocate', (e) => setMijn([e.coords.longitude, e.coords.latitude]));
    map.on('load', () => {
      map.addSource('fm-vormen', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('fm-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      for (const l of kaartLagen(map.getCenter().lat)) map.addLayer(l);
      map.addSource('fm-status', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'fm-status', type: 'circle', source: 'fm-status', paint: { 'circle-radius': ['case', ['get', 'gekozen'], 11, 7], 'circle-color': ['case', ['get', 'geplaatst'], '#16865C', '#E11D48'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      setKlaar(true);
      const k = kader(items.map((i) => i.geometrie));
      if (k) map.fitBounds(k, { padding: 40, maxZoom: 18, duration: 0 });
    });
    map.on('click', 'fm-status', (e) => setGekozen(e.features?.[0]?.properties?.id || null));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !klaar) return;
    const verborgen = new Set(filter.laag ? lagen.filter((l) => l.id !== filter.laag).map((l) => l.id) : []);
    const { vormen, labels } = naarGeojson(items.filter((i) => !isSign(i) && !i.velden?.binnen), lagenMap, elMap, { verborgenLagen: verborgen, actieveFase: filter.fase || null, verbergElementen: plan?.instellingen?.verborgen_elementen });
    zorgVoorPatronen(map, vormen.features, labels.features);
    map.getSource('fm-vormen')?.setData(vormen);
    map.getSource('fm-labels')?.setData(labels);
    map.getSource('fm-status')?.setData({ type: 'FeatureCollection', features: items.filter((i) => !i.verborgen && i.soort !== 'tekst' && (!filter.laag || i.laag_id === filter.laag)).map((i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: middelpunt(i.geometrie) }, properties: { id: i.id, geplaatst: !!i.geplaatst_op, gekozen: i.id === gekozen } })) });
  }, [items, lagenMap, elMap, filter, klaar, gekozen, lagen]);

  useEffect(() => {
    if (!gekozen) return;
    const it = items.find((x) => x.id === gekozen);
    if (it && mapRef.current) mapRef.current.easeTo({ center: middelpunt(it.geometrie), zoom: Math.max(mapRef.current.getZoom(), 18) });
    document.getElementById(`fm-op-${gekozen}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [gekozen]); // eslint-disable-line react-hooks/exhaustive-deps

  const zetGeplaatst = async (it) => {
    const patch = it.geplaatst_op ? { geplaatst_op: null, geplaatst_door: null } : { geplaatst_op: new Date().toISOString(), geplaatst_door: profiel?.id || null };
    setItems((l) => l.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    let error = null;
    try { ({ error } = await schrijf(it.id, patch)); } catch (e) { error = { message: 'offline', offline: true }; }
    if (error && (error.offline || !navigator.onLine || /fetch/i.test(error.message || ''))) {
      const w = leesWachtrij(); w[it.id] = voegSamen(w[it.id], patch);
      try { localStorage.setItem(wachtrijSleutel, JSON.stringify(w)); } catch {}
      setOffline('Geen verbinding: je wijzigingen gaan door zodra er weer netwerk is.');
    } else if (error) { setFout(foutTekst(error)); setItems((l) => l.map((x) => (x.id === it.id ? it : x))); }
  };

  // Doek per hek afvinken ("hangt"), ook offline.
  const zetHekKlaar = async (it, i) => {
    const n = doekenPerHek(it, elMap.get(it.element_id)).length;
    const klaar = Array.from({ length: n }, (_, k) => !!(it.velden?.doeken_klaar || [])[k]);
    if (i === 'alles') klaar.fill(!klaar.every(Boolean)); else klaar[i] = !klaar[i];
    const patch = { velden: { doeken_klaar: klaar } };
    setItems((l) => l.map((x) => (x.id === it.id ? { ...x, velden: { ...(x.velden || {}), doeken_klaar: klaar } } : x)));
    let error = null;
    try { ({ error } = await schrijf(it.id, patch)); } catch (e) { error = { message: 'offline', offline: true }; }
    if (error && (error.offline || !navigator.onLine || /fetch/i.test(error.message || ''))) {
      const w = leesWachtrij(); w[it.id] = voegSamen(w[it.id], patch);
      try { localStorage.setItem(wachtrijSleutel, JSON.stringify(w)); } catch {}
      setOffline('Geen verbinding: je wijzigingen gaan door zodra er weer netwerk is.');
    } else if (error) { setFout(foutTekst(error)); setItems((l) => l.map((x) => (x.id === it.id ? it : x))); }
  };

  const foto = async (it, bestand) => {
    if (!bestand) return;
    setFotoBezig(it.id);
    try {
      const ext = (bestand.name.split('.').pop() || 'jpg').toLowerCase();
      const pad = `${planId}/foto/${it.id}-${Date.now()}.${ext}`;
      const { error } = await sb().storage.from(BUCKET).upload(pad, bestand, { contentType: bestand.type || 'image/jpeg' });
      if (error) throw error;
      const r = await maps().from('bestanden').insert({ plan_id: planId, item_id: it.id, soort: 'foto', pad, meta: { door: profiel?.email || null } });
      if (r.error) throw r.error;
      setFotos((f) => ({ ...f, [it.id]: (f[it.id] || 0) + 1 }));
    } catch (err) { setFout(foutTekst(err)); }
    finally { setFotoBezig(null); }
  };

  if (fout && !plan) return <div className="fm" style={{ padding: 20 }}><div className="fm-melding fout">{fout}</div></div>;
  if (!plan) return <div className="fm" style={{ padding: 20 }}>Plan laden…</div>;
  const totaal = items.filter((i) => !i.verborgen && i.soort !== 'tekst').length;
  const geplaatst = items.filter((i) => !i.verborgen && i.soort !== 'tekst' && i.geplaatst_op).length;

  return (
    <div className="fm" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 48px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e8e8e6', background: '#fff', flexWrap: 'wrap' }}>
        <a className="fm-knop klein" href={`/maps/${planId}`}>Editor</a>
        <strong style={{ flex: 1, fontSize: 14, minWidth: 120 }}>{plan.naam}</strong>
        <span className="fm-tag groen">{geplaatst} / {totaal} geplaatst</span>
        <button className="fm-knop klein" onClick={zoneOffline}>Zone offline bewaren</button>
      </div>
      {(offline || offlineBezig) && <div className="fm-melding" style={{ margin: 0 }}>{offline || offlineBezig}</div>}
      <div ref={kaartRef} style={{ flex: '0 0 42%', minHeight: 200 }} />
      <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: '1px solid #e8e8e6', background: '#fff', flexWrap: 'wrap' }}>
        <select value={filter.laag} onChange={(e) => setFilter({ ...filter, laag: e.target.value })} style={{ height: 36, flex: '1 1 120px' }} aria-label="Laag">
          <option value="">Alle lagen</option>{lagen.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
        </select>
        {fasen.length > 0 && (
          <select value={filter.fase} onChange={(e) => setFilter({ ...filter, fase: e.target.value })} style={{ height: 36, flex: '1 1 120px' }} aria-label="Fase">
            <option value="">Alle fasen</option>{fasen.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}
          </select>
        )}
        <button className={`fm-knop${filter.open ? ' zwart' : ''}`} onClick={() => setFilter({ ...filter, open: !filter.open })}>Nog te plaatsen</button>
      </div>
      {fout && <div className="fm-melding fout" style={{ margin: 8 }}>{fout}</div>}
      <div style={{ flex: 1, overflowY: 'auto', background: '#F7F7F6' }}>
        {!lijst.length && <div className="fm-sub" style={{ padding: 16 }}>{filter.open ? 'Alles in deze selectie is geplaatst.' : 'Niets in deze selectie.'}</div>}
        {lijst.map(({ i, d }) => {
          const el = elMap.get(i.element_id);
          const laag = lagenMap.get(i.laag_id);
          const m = matenTekst(maten(i, el));
          const nav = navigatieUrl(i.geometrie);
          return (
            <div key={i.id} id={`fm-op-${i.id}`} onClick={() => setGekozen(i.id)}
              style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: i.id === gekozen ? '#fff' : '#FAFAFB', borderBottom: '1px solid #e8e8e6', borderLeft: `4px solid ${laag?.kleur || '#686D76'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ flex: 1, fontSize: 15 }}>{i.naam || el?.naam || i.soort}{isSign(i) ? ` (punt ${i.velden.sign.nr})` : ''}</strong>
                {d != null && <span className="fm-sub">{d < 1000 ? `${getal(d, 0)} m` : `${getal(d / 1000, 1)} km`}</span>}
              </div>
              <div className="fm-sub">{[laag?.naam, m, i.velden?.herkomst ? `van ${i.velden.herkomst}` : '', i.velden?.opbouw ? `plaatsen ${i.velden.opbouw}` : ''].filter(Boolean).join(' · ')}</div>
              {i.notitie && <div style={{ fontSize: 13 }}>{i.notitie}</div>}
              {isVlag(el) && i.velden?.ontwerp && <div className="fm-sub">Vlag: {elMap.get(i.velden.ontwerp)?.naam || '?'}</div>}
              {Array.isArray(i.velden?.vlaggen) && i.velden.vlaggen.some(Boolean) && <div className="fm-sub">Vlaggen aan de staander van: {i.velden.vlaggen.map((id, k) => (id ? `hek ${k + 1} ${elMap.get(id)?.naam || '?'}` : null)).filter(Boolean).join(' · ')}</div>}
              {(isTotem(el) || trussDoek(el)) && totemPanelen(i, el).some(Boolean) && (
                <div className="fm-sub">{trussDoek(el) ? 'Doeken' : 'Panelen'}: {totemPanelen(i, el).map((id, k) => `${k + 1} ${id ? elMap.get(id)?.naam || '?' : '–'}`).join(' · ')}</div>
              )}
              {isSign(i) && (i.velden.sign.rijen || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(() => { const ins = instSign(plan); const bm = new Map(ins.bestemmingen.map((x) => [x.id, x])); return <BordVoorbeeld rijen={i.velden.sign.rijen} bestMap={bm} inst={ins} breedte={240} />; })()}
                </div>
              )}
              {(el?.eigenschappen?.doek === 'bedrukt' || isVlagHek(el)) && Array.isArray(i.velden?.doeken) && i.velden.doeken.some(Boolean) && (() => {
                const klaar = i.velden.doeken_klaar || [];
                const perHek = doekenPerHek(i, el);
                const n = perHek.length; const k = perHek.filter((_, x) => klaar[x]).length;
                return (
                  <details className="fm-op-doeken" open={i.id === gekozen} onClick={(e) => e.stopPropagation()}>
                    <summary>Doeken per hek · {k}/{n} hangt</summary>
                    <div className="fm-op-hekken">
                      {perHek.map((id, x) => {
                        const d = id ? elMap.get(id) : null;
                        return (
                          <label key={x} className={klaar[x] ? 'klaar' : ''}>
                            <b>{x + 1}</b>
                            <span className="beeld" style={{ background: d?.eigenschappen?.kleur || '#fff' }}>{d?.eigenschappen?.beeld && <img src={publiekeUrlOp(d.eigenschappen.beeld)} alt="" />}</span>
                            <span className="naam">{d ? d.naam : 'geen doek'}{d?.eigenschappen?.afmeting ? <small>{d.eigenschappen.afmeting}</small> : null}</span>
                            {schrijven && <input type="checkbox" checked={!!klaar[x]} onChange={() => zetHekKlaar(i, x)} aria-label={`Hek ${x + 1} hangt`} />}
                          </label>
                        );
                      })}
                    </div>
                    {schrijven && <button className="fm-knop" style={{ height: 40 }} onClick={() => zetHekKlaar(i, 'alles')}>{k === n ? 'Alles terug open' : 'Alle hekken hangen'}</button>}
                  </details>
                );
              })()}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {schrijven && <button className={`fm-knop${i.geplaatst_op ? ' zwart' : ' rood'}`} style={{ height: 40 }} onClick={(e) => { e.stopPropagation(); zetGeplaatst(i); }}>{i.geplaatst_op ? 'Geplaatst ✓' : 'Geplaatst'}</button>}
                {nav && <a className="fm-knop" style={{ height: 40 }} href={nav} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Navigeer</a>}
                {(() => { const g = i.geometrie; const p = i.parameters?.midden || (g?.type === 'Point' ? g.coordinates : g?.type === 'LineString' ? g.coordinates[Math.floor(g.coordinates.length / 2)] : g?.type === 'Polygon' ? g.coordinates[0][0] : null); return p ? <a className="fm-knop" style={{ height: 40 }} href={streetViewUrl(p)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Street View</a> : null; })()}
                {schrijven && (
                  <label className="fm-knop" style={{ height: 40 }} onClick={(e) => e.stopPropagation()}>
                    {fotoBezig === i.id ? 'Uploaden…' : `Foto${fotos[i.id] ? ` (${fotos[i.id]})` : ''}`}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { foto(i, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
