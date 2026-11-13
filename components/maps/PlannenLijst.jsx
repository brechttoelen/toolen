'use client';

import { bevestig, AppDialogen } from './dialoog';
import { useEffect, useMemo, useRef, useState } from 'react';
import './maps.css';
import { maps, alles, sb, foutTekst, wieBenIk, magSchrijven } from './db';
import { startLobby } from './live';
import { Avatar } from './Aanwezigheid';
import { STANDAARD_LAGEN, STANDAARD_FASEN } from './stijl';
import { regioVan } from './geo';
import { laadEvents, maakEvent, kleurVoor, eventDatum, groepeer } from './events';

const nieuwId = () => crypto.randomUUID();

async function zoekPlaats(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=be,nl,fr,lu,de&accept-language=nl&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Zoeken lukte niet');
  return (await r.json()).map((x) => ({ naam: x.display_name, centrum: [Number(x.lon), Number(x.lat)] }));
}

// Een bestaand plan kopiëren: lagen, fasen en items met nieuwe id's.
async function kopieerInhoud(bronId, doelId) {
  const [l, f, i] = await Promise.all([
    maps().from('lagen').select('*').eq('plan_id', bronId),
    maps().from('fasen').select('*').eq('plan_id', bronId),
    alles(() => maps().from('items').select('*').eq('plan_id', bronId)),
  ]);
  const fout = [l, f, i].find((x) => x.error);
  if (fout) throw fout.error;
  const laagMap = new Map(); const faseMap = new Map();
  const lagen = (l.data || []).map((x) => { const id = nieuwId(); laagMap.set(x.id, id); return { ...x, id, plan_id: doelId }; });
  const fasen = (f.data || []).map((x) => { const id = nieuwId(); faseMap.set(x.id, id); return { ...x, id, plan_id: doelId }; });
  const items = (i.data || []).map(({ created_at, updated_at, geplaatst_op, geplaatst_door, ...x }) => ({
    ...x, id: nieuwId(), plan_id: doelId, laag_id: laagMap.get(x.laag_id) || null,
    fase_ids: x.fase_ids ? x.fase_ids.map((y) => faseMap.get(y)).filter(Boolean) : null,
  }));
  if (lagen.length) { const r = await maps().from('lagen').insert(lagen); if (r.error) throw r.error; }
  if (fasen.length) { const r = await maps().from('fasen').insert(fasen); if (r.error) throw r.error; }
  for (let k = 0; k < items.length; k += 500) {
    const r = await maps().from('items').insert(items.slice(k, k + 500));
    if (r.error) throw r.error;
  }
}

export function NieuwPlan({ plannen, onSluit, startEvent = '' }) {
  const [v, setV] = useState({ naam: '', editie: '', event: startEvent, evNaam: '', evDatum: '', zoek: '', plaats: null, start: 'leeg', bron: '', fasen: [...STANDAARD_FASEN] });
  const [ev, setEv] = useState({ events: [], ok: false });
  useEffect(() => { laadEvents().then(setEv); }, []);
  const [resultaten, setResultaten] = useState([]);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  const zoek = async () => {
    if (!v.zoek.trim()) return;
    setFout('');
    try { setResultaten(await zoekPlaats(v.zoek.trim())); } catch (e) { setFout(e.message); }
  };

  const maak = async () => {
    if (!v.naam.trim()) { setFout('Geef het plan een naam.'); return; }
    if (v.start === 'kopie' && !v.bron) { setFout('Kies het plan dat je wil kopiëren.'); return; }
    setBezig(true); setFout('');
    try {
      const bron = v.start === 'kopie' ? plannen.find((p) => p.id === v.bron) : null;
      const centrum = v.plaats?.centrum || bron?.centrum || [3.6031, 50.8456];
      const wie = await wieBenIk();
      let event = ev.events.find((e) => e.id === v.event) || null;
      if (ev.ok && v.event === 'nieuw') {
        if (!v.evNaam.trim()) throw new Error('Geef het nieuwe event een naam.');
        event = await maakEvent({ naam: v.evNaam, datum: v.evDatum, kleur: kleurVoor(ev.events.length) });
      }
      const { data: plan, error } = await maps().from('plannen').insert({
        naam: v.naam.trim(), editie_naam: event?.naam || v.editie.trim() || null, ...(event ? { event_id: event.id } : {}), locatie: v.plaats ? v.plaats.naam.split(',').slice(0, 2).join(',') : (bron?.locatie || null),
        centrum, zoom: bron?.zoom || 17, basiskaart: bron?.basiskaart || 'luchtfoto', titelblok: bron?.titelblok || {}, aangemaakt_door: wie?.id || null,
      }).select().single();
      if (error) throw error;
      if (bron) await kopieerInhoud(bron.id, plan.id);
      else {
        const lagen = STANDAARD_LAGEN.map((l, i) => ({ plan_id: plan.id, naam: l.naam, kleur: l.kleur, stijl: l.stijl || {}, volgorde: i }));
        const r1 = await maps().from('lagen').insert(lagen);
        if (r1.error) throw r1.error;
        if (v.fasen.length) {
          const r2 = await maps().from('fasen').insert(v.fasen.map((naam, i) => ({ plan_id: plan.id, naam, volgorde: i })));
          if (r2.error) throw r2.error;
        }
      }
      window.location.href = `/maps/${plan.id}`;
    } catch (e) {
      setFout(foutTekst(e));
      setBezig(false);
    }
  };

  return (
    <div className="fm-dialoog-achter" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <section className="fm-dialoog fm" role="dialog" aria-label="Nieuw plan">
        <header><h2>Nieuw plan</h2><button className="fm-knop" onClick={onSluit}>Annuleren</button></header>
        <div className="inhoud">
          <div className="fm-raster2">
            <label className="fm-veld">Naam van het plan<input value={v.naam} onChange={(e) => setV({ ...v, naam: e.target.value })} placeholder="Finishzone Oudenaarde" autoFocus /></label>
            {ev.ok ? (
              <label className="fm-veld">Event
                <select value={v.event} onChange={(e) => setV({ ...v, event: e.target.value })}>
                  <option value="">Zonder event</option>
                  {ev.events.map((e) => <option key={e.id} value={e.id}>{e.naam}{e.datum ? ` · ${eventDatum(e.datum)}` : ''}</option>)}
                  <option value="nieuw">Nieuw event…</option>
                </select>
              </label>
            ) : (
              <label className="fm-veld">Wedstrijd of editie<input value={v.editie} onChange={(e) => setV({ ...v, editie: e.target.value })} placeholder="Ronde van Vlaanderen 2027" /></label>
            )}
          </div>
          {v.event === 'nieuw' && (
            <div className="fm-raster2">
              <label className="fm-veld">Naam van het event<input value={v.evNaam} onChange={(e) => setV({ ...v, evNaam: e.target.value })} placeholder="Ronde van Vlaanderen 2027" /></label>
              <label className="fm-veld">Datum<input type="date" value={v.evDatum} onChange={(e) => setV({ ...v, evDatum: e.target.value })} /></label>
            </div>
          )}
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <label className="fm-veld" style={{ flex: 1 }}>Waar ligt het?
                <input value={v.zoek} onChange={(e) => setV({ ...v, zoek: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') zoek(); }} placeholder="Adres of plaats, bv. Markt, Oudenaarde" />
              </label>
              <button className="fm-knop" onClick={zoek}>Zoeken</button>
            </div>
            {resultaten.length > 0 && (
              <div style={{ border: '1px solid #e8e8e6', marginTop: 6 }}>
                {resultaten.map((r) => (
                  <button key={r.naam} onClick={() => { setV({ ...v, plaats: r }); setResultaten([]); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #f0f0ee', background: '#fff', padding: '8px 10px', cursor: 'pointer', fontSize: 13 }}>{r.naam}</button>
                ))}
              </div>
            )}
            {v.plaats && <div className="fm-melding info" style={{ marginTop: 6 }}>{v.plaats.naam} · {regioVan(v.plaats.centrum)}{regioVan(v.plaats.centrum) === 'Elders' ? ' (geen gratis luchtfoto: stratenkaart op het scherm)' : ' (luchtfoto beschikbaar)'}</div>}
            <div className="fm-sub" style={{ marginTop: 4 }}>Zoeken via OpenStreetMap (Nominatim).</div>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="fm-kop" style={{ marginBottom: 6 }}>Vertrekpunt</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <label className="fm-vink" style={{ border: `${v.start === 'leeg' ? 2 : 1}px solid ${v.start === 'leeg' ? '#1d1d1b' : '#e2e2de'}`, padding: 12 }}>
                <input type="radio" checked={v.start === 'leeg'} onChange={() => setV({ ...v, start: 'leeg' })} /><span><strong>Leeg</strong><br /><span className="fm-sub">Standaardlagen en fasen</span></span>
              </label>
              <label className="fm-vink" style={{ border: `${v.start === 'kopie' ? 2 : 1}px solid ${v.start === 'kopie' ? '#1d1d1b' : '#e2e2de'}`, padding: 12 }}>
                <input type="radio" checked={v.start === 'kopie'} onChange={() => setV({ ...v, start: 'kopie' })} /><span><strong>Kopie van een plan</strong><br /><span className="fm-sub">Bv. vorig jaar</span></span>
              </label>
            </div>
            {v.start === 'kopie' && (
              <label className="fm-veld" style={{ marginTop: 8 }}>Te kopiëren plan
                <select value={v.bron} onChange={(e) => setV({ ...v, bron: e.target.value })}>
                  <option value="">Kies…</option>
                  {plannen.filter((p) => !p.verwijderd_op).map((p) => <option key={p.id} value={p.id}>{[p.editie_naam, p.naam].filter(Boolean).join(' · ')}</option>)}
                </select>
              </label>
            )}
          </fieldset>
          {v.start === 'leeg' && (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="fm-kop" style={{ marginBottom: 6 }}>Fasen</legend>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {STANDAARD_FASEN.map((f) => (
                  <label key={f} className="fm-vink"><input type="checkbox" checked={v.fasen.includes(f)} onChange={() => setV({ ...v, fasen: v.fasen.includes(f) ? v.fasen.filter((x) => x !== f) : [...v.fasen, f] })} />{f}</label>
                ))}
              </div>
            </fieldset>
          )}
          {fout && <div className="fm-melding fout">{fout}</div>}
        </div>
        <footer><button className="fm-knop" onClick={onSluit}>Annuleren</button><button className="fm-knop rood" disabled={bezig} onClick={maak}>{bezig ? 'Aanmaken…' : 'Plan aanmaken'}</button></footer>
      </section>
    </div>
  );
}

function wieIn(state) {
  const per = new Map();
  for (const lijst of Object.values(state || {})) for (const x of lijst || []) {
    if (!x?.plan_id || !x.uid) continue;
    const m = per.get(x.plan_id) || new Map(); m.set(x.uid, x); per.set(x.plan_id, m);
  }
  return new Map([...per].map(([k, m]) => [k, [...m.values()]]));
}

// Zo lang blijft een plan in de prullenbak voor het definitief verwijderd kan worden.
const BEWAAR = 90;
const datumKort = (t) => new Date(t).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });

// Kaart met alle plannen: een punt per plan in de kleur van zijn event.
function PlannenKaart({ plannen, kleurVan, onKies }) {
  const ref = useRef(null); const kaart = useRef(null);
  const [klaar, setKlaar] = useState(false);
  const klikRef = useRef(onKies); klikRef.current = onKies;
  const punten = useMemo(() => ({
    type: 'FeatureCollection',
    features: plannen.filter((p) => Array.isArray(p.centrum) && p.centrum.length === 2).map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p.centrum }, properties: { id: p.id, naam: p.naam, kleur: kleurVan(p) } })),
  }), [plannen, kleurVan]);
  useEffect(() => {
    let weg = false; let map = null;
    (async () => {
      const maplibregl = (await import('./kaartwerker'), await import('maplibre-gl'));
      await import('maplibre-gl/dist/maplibre-gl.css');
      const { basisStijl, registreerProtocollen } = await import('./ondergronden');
      if (weg || !ref.current) return;
      registreerProtocollen();
      map = new maplibregl.Map({ container: ref.current, style: basisStijl('lijntekening'), center: [4.2, 50.95], zoom: 7.4, attributionControl: { compact: true } });
      kaart.current = map;
      const opzet = () => {
        if (weg || map.getSource('plannen')) return;
        map.addSource('plannen', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'plannen-rand', type: 'circle', source: 'plannen', paint: { 'circle-radius': 9, 'circle-color': '#fff' } });
        map.addLayer({ id: 'plannen', type: 'circle', source: 'plannen', paint: { 'circle-radius': 6, 'circle-color': ['get', 'kleur'] } });
        map.addLayer({ id: 'plannen-naam', type: 'symbol', source: 'plannen', layout: { 'text-field': ['get', 'naam'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#0E1A33', 'text-halo-color': '#fff', 'text-halo-width': 1.6 } });
        map.on('click', 'plannen', (e) => { const id = e.features?.[0]?.properties?.id; if (id) klikRef.current(id); });
        map.on('mouseenter', 'plannen', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'plannen', () => { map.getCanvas().style.cursor = ''; });
        setKlaar(true);
      };
      // Bronnen mogen erbij zodra de stijl er is; 'load' wacht ook op alle tegels (die soms nooit komen).
      const probeer = () => { if (map.style?._loaded) { opzet(); return true; } return false; };
      if (!probeer()) { const h = () => { if (probeer()) map.off('styledata', h); }; map.on('styledata', h); }
    })();
    return () => { weg = true; map?.remove(); kaart.current = null; setKlaar(false); };
  }, []);
  useEffect(() => {
    const map = kaart.current; const bron = klaar && map?.getSource('plannen'); if (!bron) return;
    bron.setData(punten);
    const c = punten.features.map((f) => f.geometry.coordinates);
    if (c.length) {
      const xs = c.map((x) => x[0]); const ys = c.map((x) => x[1]);
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 60, maxZoom: 14, duration: 0 });
    }
  }, [punten, klaar]);
  return <div ref={ref} role="region" aria-label="Kaart met alle plannen" style={{ position: 'absolute', inset: 0 }} />;
}

export default function PlannenLijst() {
  const [plannen, setPlannen] = useState([]);
  const [profiel, setProfiel] = useState(null);
  const [fout, setFout] = useState('');
  const [laden, setLaden] = useState(true);
  const [zoek, setZoek] = useState('');
  const [filter, setFilter] = useState('');
  const [nieuw, setNieuw] = useState(null);
  const [aanwezig, setAanwezig] = useState(new Map());
  const [ev, setEv] = useState({ events: [], ok: false });
  const [kaartAan, setKaartAan] = useState(false);
  // Werklijst: snelle filters en groeperen (per event of één lijst op laatst bewerkt).
  const [snel, setSnel] = useState('');
  const [perEvent, setPerEvent] = useState(true);
  const [menuVan, setMenuVan] = useState(null);
  useEffect(() => { if (!menuVan) return undefined; const f = (e) => { if (!e.target.closest?.('.t-plmenu')) setMenuVan(null); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, [menuVan]);
  useEffect(() => { laadEvents().then(setEv); }, []);
  useEffect(() => { const l = startLobby({ client: sb(), orgId: profiel?.organisatie?.id, onState: (st) => setAanwezig(wieIn(st)) }); return () => l.stop(); }, [profiel?.organisatie?.id]);

  useEffect(() => {
    (async () => {
      const [wie, r0] = await Promise.all([wieBenIk(), maps().from('plannen').select('*, items(count), deel_links(count)').order('updated_at', { ascending: false })]);
      const r = r0.error ? await maps().from('plannen').select('*, items(count)').order('updated_at', { ascending: false }) : r0;
      setProfiel(wie);
      if (r.error) setFout(foutTekst(r.error)); else setPlannen(r.data || []);
      setLaden(false);
    })();
  }, []);

  // Verwijderen = naar de prullenbak. Definitief wissen kan pas na 90 dagen in de prullenbak (de database bewaakt dat ook).
  const [prullenbak, setPrullenbak] = useState(false);
  const zet = (id, patch) => setPlannen((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const bewaar = async (p, patch) => {
    const { error } = await maps().from('plannen').update(patch).eq('id', p.id);
    if (error) { setFout(foutTekst(error)); return false; }
    zet(p.id, patch); return true;
  };
  const verwijder = async (p) => {
    if (!await bevestig(`Plan "${p.naam}" naar de prullenbak? Je kan het daar terugzetten. Definitief verwijderen kan pas na ${BEWAAR} dagen.`)) return;
    bewaar(p, { verwijderd_op: new Date().toISOString(), verwijderd_door: profiel?.id || null });
  };
  const terugzetten = (p) => bewaar(p, { verwijderd_op: null, verwijderd_door: null });
  const wis = async (p) => {
    if (!await bevestig(`Plan "${p.naam}" en alles erin definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
    const { error } = await maps().from('plannen').delete().eq('id', p.id);
    if (error) { setFout(foutTekst(error)); return; }
    setPlannen((l) => l.filter((x) => x.id !== p.id));
  };
  const koppel = (p, eventId) => {
    const e = ev.events.find((x) => x.id === eventId);
    bewaar(p, { event_id: eventId || null, ...(e ? { editie_naam: e.naam } : {}) });
  };

  const schrijven = magSchrijven(profiel);
  const weg = plannen.filter((p) => p.verwijderd_op);
  const q = zoek.trim().toLowerCase();
  const evNaam = useMemo(() => new Map(ev.events.map((e) => [e.id, e.naam])), [ev]);
  const actief = plannen.filter((p) => !!p.verwijderd_op === prullenbak)
    .filter((p) => !q || [p.naam, p.editie_naam, p.locatie, evNaam.get(p.event_id)].join(' ').toLowerCase().includes(q))
    .filter((p) => !filter || (filter === 'geen' ? !p.event_id : p.event_id === filter));
  const mijn = (p) => !!profiel?.id && (p.aangemaakt_door === profiel.id || p.bewerkt_door === profiel.id);
  const SNEL = [['', 'Alle', () => true], ['concept', 'Concept', (p) => p.status !== 'definitief'], ['definitief', 'Definitief', (p) => p.status === 'definitief'], ['mijn', 'Mijn plannen', mijn]];
  const lijst = actief.filter(SNEL.find((x) => x[0] === snel)?.[2] || (() => true));
  const groepen = useMemo(() => {
    if (!perEvent || prullenbak) return [{ id: 'alles', naam: null, plannen: lijst }];
    const g = groepeer(lijst, ev.events, ev.ok).filter((x) => x.plannen.length);
    const vandaag = new Date().toISOString().slice(0, 10);
    g.sort((a, b) => (!a.datum) - (!b.datum) || ((a.datum < vandaag) - (b.datum < vandaag)) || String(a.datum || a.naam).localeCompare(String(b.datum || b.naam)));
    const los = lijst.filter((p) => !g.some((x) => x.plannen.includes(p)));
    if (los.length) g.push({ id: 'geen', naam: 'Zonder event', kleur: '#CFD7E3', datum: null, plannen: los, los: true });
    return g;
  }, [lijst, ev, perEvent, prullenbak]); // eslint-disable-line react-hooks/exhaustive-deps
  const kleurVan = useMemo(() => { const m = new Map(groepeer(lijst, ev.events, ev.ok).flatMap((g) => g.plannen.map((p) => [p.id, g.kleur]))); return (p) => m.get(p.id) || '#8492A8'; }, [lijst, ev]);
  const bewerkt = (t) => { const d = new Date(t); const nu = new Date(); const dag = (x) => x.toISOString().slice(0, 10); if (dag(d) === dag(nu)) return `Vandaag ${d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`; const g = new Date(nu); g.setDate(g.getDate() - 1); if (dag(d) === dag(g)) return 'Gisteren'; return datumKort(t); };
  const gedeeld = (p) => { const n = p.deel_links?.[0]?.count; return n == null ? '' : n ? `${n} ${n === 1 ? 'link' : 'links'}` : 'Niet gedeeld'; };

  const pil = (d) => <span className={`t-pil ${d ? 'ok' : 'let-op'}`}>{d ? 'Definitief' : 'Concept'}</span>;

  return (
    <div className="fm t-plannen" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--t-vlak)', fontFamily: 'var(--font-sans)' }}>
      <AppDialogen />
      <header className="t-plkop">
        <h1 className="t-titel">{prullenbak ? 'Prullenbak' : 'Plannen'}</h1>
        {(weg.length > 0 || prullenbak) && <button className="t-knop" onClick={() => setPrullenbak((x) => !x)}>{prullenbak ? 'Terug naar de plannen' : `Prullenbak · ${weg.length}`}</button>}
        {schrijven && !prullenbak && <button className="t-knop hoofd" onClick={() => setNieuw('')}>Nieuw plan</button>}
      </header>

      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', minHeight: 0 }}>
        <section aria-label="Lijst van plannen" className="t-plromp">
          <div className="t-plfilters">
            <label className="t-plzoek">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <span style={{ position: 'absolute', left: -9999 }}>Zoek een plan</span>
              <input type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek op plan, event of plaats" />
            </label>
            {!prullenbak && SNEL.filter(([k]) => k !== 'mijn' || profiel?.id).map(([k, n, f]) => (
              <button key={k || 'alle'} type="button" className={`t-plchip${snel === k ? ' aan' : ''}`} aria-pressed={snel === k} onClick={() => setSnel(k)}>{n}<small>{actief.filter(f).length}</small></button>
            ))}
            <span className="t-plrechts">
              {ev.ok && (
                <label><span style={{ position: 'absolute', left: -9999 }}>Event</span>
                  <select className="t-veld" value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="">Alle events</option>
                    {ev.events.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}
                    <option value="geen">Zonder event</option>
                  </select>
                </label>
              )}
              {!prullenbak && (
                <span className="fm-segment t-plseg" role="group" aria-label="Groeperen">
                  <button type="button" className={perEvent ? 'aan' : ''} aria-pressed={perEvent} onClick={() => setPerEvent(true)}>Per event</button>
                  <button type="button" className={!perEvent ? 'aan' : ''} aria-pressed={!perEvent} onClick={() => setPerEvent(false)}>Recent</button>
                </span>
              )}
              {!prullenbak && <button className="t-knop" aria-pressed={kaartAan} onClick={() => setKaartAan(!kaartAan)}>{kaartAan ? 'Kaart verbergen' : 'Kaart'}</button>}
            </span>
          </div>

          {fout && <div className="t-melding fout">{fout}</div>}
          {laden && <p className="t-stil">Laden…</p>}
          {!laden && !fout && !lijst.length && <p className="t-sub">{prullenbak ? 'De prullenbak is leeg.' : plannen.length ? 'Geen plannen gevonden.' : 'Nog geen plannen. Maak het eerste aan met "Nieuw plan".'}</p>}
          {prullenbak && lijst.length > 0 && <p className="t-sub" style={{ margin: 0 }}>Plannen in de prullenbak blijven {BEWAAR} dagen bewaard voor je ze definitief kan verwijderen. Terugzetten kan altijd.</p>}

          {lijst.length > 0 && (
            <div className="t-pltabel-vak">
              <table className="t-pltabel">
                <thead>
                  <tr>
                    <th>Plan</th>
                    {!perEvent && <th>Event</th>}
                    <th>Status</th>
                    <th className="getal">Items</th>
                    <th>Versie</th>
                    <th>Gedeeld</th>
                    <th>Bewerkt</th>
                    <th><span style={{ position: 'absolute', left: -9999 }}>Acties</span></th>
                  </tr>
                </thead>
                {groepen.map((g) => (
                  <tbody key={g.id}>
                    {g.naam && (
                      <tr className="t-plgroep">
                        <td colSpan={perEvent ? 7 : 8}>
                          <span className="stip" style={{ background: g.kleur }} aria-hidden="true" />
                          <b>{g.naam}</b>
                          <span>{[g.datum ? eventDatum(g.datum) : null, `${g.plannen.length} ${g.plannen.length === 1 ? 'plan' : 'plannen'}`].filter(Boolean).join(' · ')}</span>
                          {schrijven && !prullenbak && !g.los && ev.ok && <button className="t-pllink" onClick={() => setNieuw(g.id)}>Plan toevoegen</button>}
                        </td>
                      </tr>
                    )}
                    {g.plannen.map((p) => {
                      const wie = aanwezig.get(p.id) || [];
                      const vanaf = p.verwijderd_op ? new Date(new Date(p.verwijderd_op).getTime() + BEWAAR * 864e5) : null;
                      return (
                        <tr key={p.id} className="t-plrij">
                          <td>
                            {p.verwijderd_op ? <b>{p.naam}</b> : <a href={`/maps/${p.id}`}>{p.naam}</a>}
                            <small>{p.locatie || '\u00a0'}</small>
                          </td>
                          {!perEvent && <td className="stil">{evNaam.get(p.event_id) || p.editie_naam || 'Zonder event'}</td>}
                          <td>{p.verwijderd_op ? <span className="t-stil">Sinds {datumKort(p.verwijderd_op)}</span> : pil(p.status === 'definitief')}</td>
                          <td className="getal">{p.items?.[0]?.count ?? 0}</td>
                          <td>v{p.versie}</td>
                          <td className="stil">{gedeeld(p)}</td>
                          <td className="stil">
                            <span className="t-plwie">
                              {wie.slice(0, 3).map((x) => <Avatar key={x.uid} p={x} maat={22} />)}
                              <span title={wie.length ? `${wie.map((x) => x.naam).join(', ')} ${wie.length === 1 ? 'werkt' : 'werken'} hierin` : undefined}>{bewerkt(p.updated_at)}</span>
                            </span>
                          </td>
                          <td className="acties">
                            {schrijven && p.verwijderd_op && (
                              <span className="t-rij" style={{ gap: 6, justifyContent: 'flex-end' }}>
                                <button className="t-knop klein" onClick={() => terugzetten(p)}>Terugzetten</button>
                                <button className="t-knop klein gevaar" disabled={Date.now() < vanaf.getTime()} title={Date.now() >= vanaf.getTime() ? 'Plan en alles erin definitief verwijderen' : `Kan vanaf ${vanaf.toLocaleDateString('nl-BE')}`} onClick={() => wis(p)}>{Date.now() >= vanaf.getTime() ? 'Definitief verwijderen' : `Wissen vanaf ${datumKort(vanaf)}`}</button>
                              </span>
                            )}
                            {schrijven && !p.verwijderd_op && (
                              <span className="t-plmenu">
                                <button type="button" className="t-plmeer" aria-label={`Meer voor ${p.naam}`} aria-expanded={menuVan === p.id} onClick={() => setMenuVan(menuVan === p.id ? null : p.id)}>
                                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="12.5" cy="8" r="1.4" fill="currentColor" /></svg>
                                </button>
                                {menuVan === p.id && (
                                  <div className="t-menu" style={{ right: 0, left: 'auto', top: 'calc(100% + 4px)', minWidth: 240 }}>
                                    <a href={`/maps/${p.id}`}>Openen</a>
                                    {ev.ok && (
                                      <label className="t-plmenu-veld">Event
                                        <select className="t-veld" value={p.event_id || ''} onChange={(e) => { koppel(p, e.target.value); setMenuVan(null); }}>
                                          <option value="">Zonder event</option>
                                          {ev.events.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}
                                        </select>
                                      </label>
                                    )}
                                    <hr />
                                    <button className="gevaar" onClick={() => { setMenuVan(null); verwijder(p); }}>Naar de prullenbak</button>
                                  </div>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </section>
        {kaartAan && !prullenbak && (
          <section style={{ flex: '1 1 420px', minHeight: 480, position: 'relative', borderLeft: '1px solid var(--t-rand)', background: '#EDF0F4' }}>
            <PlannenKaart plannen={lijst} kleurVan={kleurVan} onKies={(id) => { window.location.href = `/maps/${id}`; }} />
          </section>
        )}
      </div>
      {nieuw !== null && <NieuwPlan plannen={plannen} startEvent={nieuw} onSluit={() => setNieuw(null)} />}
    </div>
  );
}
