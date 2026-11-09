'use client';

import { bevestig, AppDialogen } from './dialoog';
import { useEffect, useState } from 'react';
import './maps.css';
import { maps, sb, foutTekst, wieBenIk, magSchrijven } from './db';
import { startLobby } from './live';
import { Avatar } from './Aanwezigheid';
import { STANDAARD_LAGEN, STANDAARD_FASEN } from './stijl';
import { regioVan } from './geo';
import { laadEvents, maakEvent, kleurVoor, eventDatum } from './events';

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
    maps().from('items').select('*').eq('plan_id', bronId),
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

export default function PlannenLijst() {
  const [plannen, setPlannen] = useState([]);
  const [profiel, setProfiel] = useState(null);
  const [fout, setFout] = useState('');
  const [laden, setLaden] = useState(true);
  const [zoek, setZoek] = useState('');
  const [nieuw, setNieuw] = useState(false);
  const [aanwezig, setAanwezig] = useState(new Map());
  const [ev, setEv] = useState({ events: [], ok: false });
  useEffect(() => { laadEvents().then(setEv); }, []);
  const eventVan = (p) => ev.events.find((e) => e.id === p.event_id) || null;
  useEffect(() => { const l = startLobby({ client: sb(), onState: (st) => setAanwezig(wieIn(st)) }); return () => l.stop(); }, []);

  useEffect(() => {
    (async () => {
      const [wie, r] = await Promise.all([wieBenIk(), maps().from('plannen').select('*, items(count)').order('updated_at', { ascending: false })]);
      setProfiel(wie);
      if (r.error) setFout(foutTekst(r.error)); else setPlannen(r.data || []);
      setLaden(false);
    })();
  }, []);

  // Verwijderen = naar de prullenbak. Definitief wissen kan pas na 90 dagen in de prullenbak (de database bewaakt dat ook).
  const [prullenbak, setPrullenbak] = useState(false);
  const zet = (id, patch) => setPlannen((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const verwijder = async (p) => {
    if (!await bevestig(`Plan "${p.naam}" naar de prullenbak? Je kan het daar terugzetten; definitief verwijderen kan pas na ${BEWAAR} dagen.`)) return;
    const patch = { verwijderd_op: new Date().toISOString(), verwijderd_door: profiel?.id || null };
    const { error } = await maps().from('plannen').update(patch).eq('id', p.id);
    if (error) { setFout(foutTekst(error)); return; }
    zet(p.id, patch);
  };
  const terugzetten = async (p) => {
    const patch = { verwijderd_op: null, verwijderd_door: null };
    const { error } = await maps().from('plannen').update(patch).eq('id', p.id);
    if (error) { setFout(foutTekst(error)); return; }
    zet(p.id, patch);
  };
  const wis = async (p) => {
    if (!await bevestig(`Plan "${p.naam}" en alles erin definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
    const { error } = await maps().from('plannen').delete().eq('id', p.id);
    if (error) { setFout(foutTekst(error)); return; }
    setPlannen((l) => l.filter((x) => x.id !== p.id));
  };

  const schrijven = magSchrijven(profiel);
  const weg = plannen.filter((p) => p.verwijderd_op);
  const lijst = plannen.filter((p) => !!p.verwijderd_op === prullenbak).filter((p) => !zoek || [p.naam, p.editie_naam, p.locatie].join(' ').toLowerCase().includes(zoek.toLowerCase()));

  return (
    <div className="fm">
      <AppDialogen />
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', padding: '20px 32px', background: '#fff', borderBottom: '1px solid #e8e8e6' }}>
        <div style={{ flex: '1 1 280px' }}>
          <h1 className="t-titel">Plannen</h1>
        </div>
        <label className="fm-veld" style={{ flex: '0 1 320px' }}><span style={{ position: 'absolute', left: -9999 }}>Zoek een plan</span>
          <input type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek op naam, editie of plaats" style={{ height: 40 }} />
        </label>
        {(weg.length > 0 || prullenbak) && <button className={`fm-knop${prullenbak ? ' zwart' : ''}`} style={{ height: 40 }} onClick={() => setPrullenbak((x) => !x)}>{prullenbak ? 'Terug naar de plannen' : `Prullenbak (${weg.length})`}</button>}
        {schrijven && !prullenbak && <button className="fm-knop rood" style={{ height: 40 }} onClick={() => setNieuw(true)}>Nieuw plan</button>}
      </header>
      {fout && <div style={{ padding: '16px 32px' }}><div className="fm-melding fout">{fout}</div></div>}
      {laden && <div style={{ padding: 32 }} className="fm-sub">Laden…</div>}
      {!laden && !fout && !lijst.length && <div style={{ padding: 32 }} className="fm-sub">{prullenbak ? 'De prullenbak is leeg.' : plannen.length ? 'Geen plannen gevonden.' : 'Nog geen plannen. Maak het eerste aan met "Nieuw plan".'}</div>}
      {prullenbak && lijst.length > 0 && <div style={{ padding: '12px 32px 0' }} className="fm-sub">Plannen in de prullenbak blijven {BEWAAR} dagen bewaard voor je ze definitief kan verwijderen. Terugzetten kan altijd.</div>}
      <div className="fm-lijst">
        {lijst.map((p) => (
          <div key={p.id} className="fm-kaartje">
            <a href={`/maps/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 6, background: eventVan(p)?.kleur || '#CFD7E3' }} />
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="fm-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{eventVan(p) && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: eventVan(p).kleur }} />}{eventVan(p)?.naam || p.editie_naam || 'Zonder event'}</span>
                <strong style={{ fontSize: 16 }}>{p.naam}</strong>
                {(aanwezig.get(p.id) || []).length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={(aanwezig.get(p.id) || []).map((x) => x.naam).join(', ')}>
                    {(aanwezig.get(p.id) || []).slice(0, 4).map((x) => <Avatar key={x.uid} p={x} maat={22} />)}
                    <span className="fm-sub">{(aanwezig.get(p.id) || []).map((x) => x.naam).join(', ')} {(aanwezig.get(p.id) || []).length === 1 ? 'werkt' : 'werken'} hierin</span>
                  </span>
                )}
                <span className="fm-sub">Versie {p.versie} · {p.items?.[0]?.count ?? 0} items · bewerkt {new Date(p.updated_at).toLocaleDateString('nl-BE')}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <span className={`fm-tag ${p.status === 'definitief' ? 'groen' : 'oranje'}`}>{p.status === 'definitief' ? 'Definitief' : 'Concept'}</span>
                  {p.locatie && <span className="fm-tag">{p.locatie}</span>}
                </span>
              </div>
            </a>
            {schrijven && !p.verwijderd_op && <div style={{ padding: '0 16px 12px' }}><button className="fm-knop klein gevaar" onClick={() => verwijder(p)}>Naar de prullenbak</button></div>}
            {schrijven && p.verwijderd_op && (() => {
              const vanaf = new Date(new Date(p.verwijderd_op).getTime() + BEWAAR * 864e5); const mag = Date.now() >= vanaf.getTime();
              return (
                <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="fm-sub">In de prullenbak sinds {new Date(p.verwijderd_op).toLocaleDateString('nl-BE')}</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="fm-knop klein" onClick={() => terugzetten(p)}>Terugzetten</button>
                    <button className="fm-knop klein gevaar" disabled={!mag} title={mag ? 'Plan en alles erin definitief verwijderen' : `Kan vanaf ${vanaf.toLocaleDateString('nl-BE')}`} onClick={() => wis(p)}>{mag ? 'Definitief verwijderen' : `Wissen vanaf ${vanaf.toLocaleDateString('nl-BE')}`}</button>
                  </span>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
      {nieuw && <NieuwPlan plannen={plannen} onSluit={() => setNieuw(false)} />}
    </div>
  );
}
