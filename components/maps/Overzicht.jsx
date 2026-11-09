'use client';

// Overzicht: het startscherm van Toolen Maps. Komende events met een voorbeeld van hun plan,
// de seizoenslijn, wat aandacht vraagt en wie nu bezig is.
import { useEffect, useMemo, useState } from 'react';
import './maps.css';
import { maps, sb, foutTekst, wieBenIk, magSchrijven } from './db';
import { startLobby } from './live';
import { Avatar } from './Aanwezigheid';
import { AppDialogen, bevestig } from './dialoog';
import { NieuwPlan } from './PlannenLijst';
import { laadEvents, groepeer, eventDatum, dagenTot, EVENT_KLEUREN, kleurVoor, MAAND_KORT } from './events';

function wieIn(state) {
  const per = new Map();
  for (const lijst of Object.values(state || {})) for (const x of lijst || []) {
    if (!x?.plan_id || !x.uid) continue;
    const m = per.get(x.plan_id) || new Map(); m.set(x.uid, x); per.set(x.plan_id, m);
  }
  return per;
}

// ---------- Planvoorbeeld: de items van een plan als kleine kaart in de Toolen-stijl ----------
function coords(g, uit) {
  if (!g) return;
  if (g.type === 'Point') uit.push(g.coordinates);
  else if (g.type === 'LineString' || g.type === 'MultiPoint') g.coordinates.forEach((c) => uit.push(c));
  else if (g.type === 'Polygon' || g.type === 'MultiLineString') g.coordinates.forEach((r) => r.forEach((c) => uit.push(c)));
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.forEach((c) => uit.push(c))));
}
const kwantiel = (l, q) => l[Math.min(l.length - 1, Math.max(0, Math.floor(q * (l.length - 1))))];

function PlanVoorbeeld({ items, kleur, hoogte = 168, label }) {
  const W = 360; const H = hoogte;
  const vormen = useMemo(() => {
    const alle = [];
    items.forEach((i) => coords(i.geometrie, alle));
    if (alle.length < 2) return null;
    // Uitschieters negeren: 3e tot 97e percentiel.
    const xs = alle.map((c) => c[0]).sort((a, b) => a - b); const ys = alle.map((c) => c[1]).sort((a, b) => a - b);
    let [x0, x1, y0, y1] = [kwantiel(xs, 0.03), kwantiel(xs, 0.97), kwantiel(ys, 0.03), kwantiel(ys, 0.97)];
    const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
    let bw = (x1 - x0) * kx; let bh = y1 - y0;
    if (bw < 1e-6 && bh < 1e-6) { bw = 0.0005; bh = 0.0005; }
    const marge = 0.12; const s = Math.min((W * (1 - 2 * marge)) / (bw || 1e-9), (H * (1 - 2 * marge)) / (bh || 1e-9));
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
    const p = (c) => `${(W / 2 + (c[0] - cx) * kx * s).toFixed(1)},${(H / 2 - (c[1] - cy) * s).toFixed(1)}`;
    const uit = [];
    items.forEach((i, k) => {
      const g = i.geometrie; if (!g) return;
      if (g.type === 'Polygon') uit.push(<path key={k} d={g.coordinates.map((r) => `M${r.map(p).join('L')}Z`).join('')} fill="#fff" stroke={kleur} strokeWidth="1.6" />);
      else if (g.type === 'MultiPolygon') uit.push(<path key={k} d={g.coordinates.map((pl) => pl.map((r) => `M${r.map(p).join('L')}Z`).join('')).join('')} fill="#fff" stroke={kleur} strokeWidth="1.6" />);
      else if (g.type === 'LineString') uit.push(<path key={k} d={`M${g.coordinates.map(p).join('L')}`} fill="none" stroke={i.velden?.stroom ? '#022056' : kleur} strokeWidth={i.velden?.stroom ? 1 : 2} strokeDasharray={i.soort === 'element' ? '4 3' : undefined} strokeLinecap="round" />);
      else if (g.type === 'Point') { const [x, y] = p(g.coordinates).split(','); uit.push(<circle key={k} cx={x} cy={y} r="2.6" fill="#022056" />); }
    });
    return uit;
  }, [items, kleur, H]);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} style={{ display: 'block', background: '#EDF0F4' }}>
      <defs><pattern id="tm-raster" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#E2E7EE" strokeWidth="1" /></pattern></defs>
      <rect width={W} height={H} fill="url(#tm-raster)" />
      {vormen || <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#6B7A90" fontFamily="IBM Plex Sans">Nog leeg</text>}
    </svg>
  );
}

// ---------- Event aanmaken of wijzigen ----------
function EventDialoog({ event, aantal, onSluit, onKlaar }) {
  const [v, setV] = useState({ naam: event?.naam || '', datum: event?.datum || '', kleur: event?.kleur || kleurVoor(aantal), plek: event?.plek || '' });
  const [fout, setFout] = useState('');
  const bewaar = async () => {
    if (!v.naam.trim()) { setFout('Geef het event een naam.'); return; }
    const rij = { naam: v.naam.trim(), datum: v.datum || null, kleur: v.kleur, plek: v.plek.trim() || null };
    const r = event ? await maps().from('events').update(rij).eq('id', event.id) : await maps().from('events').insert(rij);
    if (r.error) setFout(foutTekst(r.error)); else onKlaar();
  };
  const wis = async () => {
    if (!await bevestig(`Event "${event.naam}" verwijderen? De plannen blijven bestaan, zonder event.`)) return;
    const r = await maps().from('events').delete().eq('id', event.id);
    if (r.error) setFout(foutTekst(r.error)); else onKlaar();
  };
  return (
    <div className="t-dialoog-achter" onMouseDown={(e) => e.target === e.currentTarget && onSluit()}>
      <div className="t-dialoog t-stapel" role="dialog" aria-label={event ? 'Event wijzigen' : 'Nieuw event'}>
        <h2 style={{ margin: 0 }}>{event ? 'Event wijzigen' : 'Nieuw event'}</h2>
        <label><span className="t-label">Naam</span><input className="t-veld" autoFocus value={v.naam} onChange={(e) => setV({ ...v, naam: e.target.value })} placeholder="Ronde van Vlaanderen 2027" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label><span className="t-label">Datum</span><input className="t-veld" type="date" value={v.datum} onChange={(e) => setV({ ...v, datum: e.target.value })} /></label>
          <label><span className="t-label">Plaats</span><input className="t-veld" value={v.plek} onChange={(e) => setV({ ...v, plek: e.target.value })} placeholder="Antwerpen → Oudenaarde" /></label>
        </div>
        <div><span className="t-label">Kleur</span>
          <div role="radiogroup" aria-label="Kleur" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EVENT_KLEUREN.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={v.kleur === k} aria-label={`Kleur ${k}`} onClick={() => setV({ ...v, kleur: k })}
                style={{ width: 32, height: 32, borderRadius: 8, background: k, border: 0, cursor: 'pointer', boxShadow: v.kleur === k ? `0 0 0 2px #fff, 0 0 0 4px ${k}` : 'none' }} />
            ))}
          </div>
        </div>
        {fout && <p className="t-melding fout" style={{ margin: 0 }}>{fout}</p>}
        <div className="t-rij">
          {event && <button className="t-knop gevaar" onClick={wis}>Verwijderen</button>}
          <span style={{ flex: 1 }} />
          <button className="t-knop" onClick={onSluit}>Annuleren</button>
          <button className="t-knop hoofd" onClick={bewaar}>Bewaren</button>
        </div>
      </div>
    </div>
  );
}

const kaart = { background: '#fff', border: '1px solid var(--t-rand)', borderRadius: 12 };
const sub = { fontSize: 13, color: 'var(--t-tekst-2)' };

export default function Overzicht() {
  const [plannen, setPlannen] = useState([]);
  const [ev, setEv] = useState({ events: [], ok: false });
  const [profiel, setProfiel] = useState(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [voorbeelden, setVoorbeelden] = useState({});
  const [open, setOpen] = useState({ opmerkingen: new Map(), deellinks: new Set() });
  const [aanwezig, setAanwezig] = useState(new Map());
  const [nieuwPlan, setNieuwPlan] = useState(null);
  const [evDialoog, setEvDialoog] = useState(null);
  const [zoek, setZoek] = useState('');

  const laad = async () => {
    const [wie, r, e, o, d] = await Promise.all([
      wieBenIk(),
      maps().from('plannen').select('id, naam, editie_naam, event_id, status, versie, locatie, centrum, zoom, basiskaart, titelblok, updated_at, verwijderd_op, items(count)').is('verwijderd_op', null).order('updated_at', { ascending: false }),
      laadEvents(),
      maps().from('opmerkingen').select('plan_id').eq('status', 'open'),
      maps().from('deel_links').select('plan_id').is('ingetrokken_op', null),
    ]);
    setProfiel(wie);
    if (r.error) setFout(foutTekst(r.error)); else setPlannen(r.data || []);
    setEv(e);
    const om = new Map(); (o.data || []).forEach((x) => x.plan_id && om.set(x.plan_id, (om.get(x.plan_id) || 0) + 1));
    setOpen({ opmerkingen: om, deellinks: new Set((d.data || []).map((x) => x.plan_id)) });
    setLaden(false);
  };
  useEffect(() => { laad(); }, []);
  useEffect(() => { const l = startLobby({ client: sb(), onState: (st) => setAanwezig(wieIn(st)) }); return () => l.stop(); }, []);

  const schrijven = magSchrijven(profiel);
  const groepen = useMemo(() => groepeer(plannen, ev.events, ev.ok), [plannen, ev]);
  const vandaag = new Date().toISOString().slice(0, 10);
  const komend = groepen.filter((g) => g.datum && g.datum >= vandaag).sort((a, b) => a.datum.localeCompare(b.datum));
  const zonderDatum = groepen.filter((g) => !g.datum);
  const kaarten = [...komend, ...zonderDatum].slice(0, 3);
  const losse = plannen.filter((p) => !groepen.some((g) => g.plannen.includes(p)));

  // Voorbeelden voor de kaarten: het laatst gewijzigde plan van elk event.
  const voorbeeldPlannen = kaarten.map((g) => g.plannen[0]?.id).filter(Boolean).join(',');
  useEffect(() => {
    if (!voorbeeldPlannen) return;
    let weg = false;
    Promise.all(voorbeeldPlannen.split(',').map(async (id) => {
      const r = await maps().from('items').select('geometrie, soort, velden').eq('plan_id', id).eq('verborgen', false).limit(1500);
      return [id, r.data || []];
    })).then((l) => { if (!weg) setVoorbeelden(Object.fromEntries(l)); });
    return () => { weg = true; };
  }, [voorbeeldPlannen]);

  // Wat aandacht vraagt: echte signalen uit de databank.
  const aandacht = useMemo(() => {
    const uit = [];
    for (const g of komend) {
      const d = dagenTot(g.datum);
      const concept = g.plannen.filter((p) => p.status !== 'definitief');
      if (d <= 30 && concept.length) uit.push({ soort: 'Plannen', fout: d <= 14, tekst: `${concept.length} ${concept.length === 1 ? 'plan staat' : 'plannen staan'} nog op concept`, waar: `${g.naam} · over ${d} dagen`, href: `/maps/${concept[0].id}`, kleur: g.kleur });
      if (d <= 45 && g.plannen.length && !g.plannen.some((p) => open.deellinks.has(p.id))) uit.push({ soort: 'Delen', fout: false, tekst: 'Nog geen deellink voor externen', waar: g.naam, href: `/maps/${g.plannen[0].id}`, kleur: g.kleur });
    }
    for (const p of plannen) {
      const n = open.opmerkingen.get(p.id);
      if (n) { const g = groepen.find((x) => x.plannen.includes(p)); uit.push({ soort: 'Opmerkingen', fout: false, tekst: `${n} ${n === 1 ? 'opmerking staat' : 'opmerkingen staan'} open`, waar: [g?.naam, p.naam].filter(Boolean).join(' · '), href: `/maps/${p.id}`, kleur: g?.kleur || '#CFD7E3' }); }
    }
    if (ev.ok) for (const g of zonderDatum) if (g.plannen.length) uit.push({ soort: 'Event', fout: false, tekst: 'Datum ontbreekt', waar: g.naam, onClick: () => setEvDialoog(g), kleur: g.kleur });
    return uit.slice(0, 6);
  }, [komend, zonderDatum, plannen, groepen, open, ev.ok]);

  const bezig = [...aanwezig.entries()].flatMap(([planId, m]) => {
    const p = plannen.find((x) => x.id === planId); if (!p) return [];
    const g = groepen.find((x) => x.plannen.includes(p));
    return [...m.values()].map((x) => ({ ...x, plan: p, kleur: g?.kleur }));
  });

  // Seizoenslijn: komende events binnen 12 maanden.
  const lijn = useMemo(() => {
    const l = komend.filter((g) => dagenTot(g.datum) <= 366);
    if (!l.length) return null;
    const t0 = new Date(`${l[0].datum.slice(0, 7)}-01T12:00:00`);
    const laatste = new Date(`${l[l.length - 1].datum}T12:00:00`);
    const t1 = new Date(laatste.getFullYear(), laatste.getMonth() + 1, 1, 12);
    const span = t1 - t0;
    const pos = (d) => ((new Date(`${d}T12:00:00`) - t0) / span) * 100;
    const maanden = [];
    for (let m = new Date(t0); m < t1; m = new Date(m.getFullYear(), m.getMonth() + 1, 1, 12)) maanden.push({ naam: MAAND_KORT[m.getMonth()], x: ((m - t0) / span) * 100 });
    const rijen = [-1, -1, -1, -1];
    const punten = l.map((g) => {
      const x = pos(g.datum);
      let rij = rijen.findIndex((r) => x - r > 14);
      if (rij < 0) rij = 0;
      rijen[rij] = x;
      return { g, x, rij };
    });
    return { maanden, punten };
  }, [komend]);

  const gezocht = zoek.trim().toLowerCase();
  const treffers = gezocht ? plannen.filter((p) => [p.naam, p.editie_naam, p.locatie].join(' ').toLowerCase().includes(gezocht)).slice(0, 8) : [];
  const eersteStart = komend[0] ? dagenTot(komend[0].datum) : null;
  const titel = { fontFamily: 'var(--font-titel)', fontStretch: '112%', fontWeight: 700, fontSize: 19, margin: 0 };

  return (
    <div className="fm" style={{ flex: 1, background: 'var(--t-vlak)', fontFamily: 'var(--font-sans)' }}>
      <AppDialogen />
      <main style={{ padding: '28px 32px 48px', display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1360 }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ flex: '1 1 300px' }}>
            <p style={{ ...sub, margin: 0, fontSize: 13.5 }}>{eventDatum(vandaag).replace(/^(\w+)/, (d) => ({ Ma: 'Maandag', Di: 'Dinsdag', Wo: 'Woensdag', Do: 'Donderdag', Vr: 'Vrijdag', Za: 'Zaterdag', Zo: 'Zondag' }[d] || d))}</p>
            <h1 className="t-titel" style={{ fontSize: 36, marginTop: 2 }}>Overzicht</h1>
          </div>
          <div style={{ position: 'relative', flex: '0 1 340px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', background: '#fff', border: '1px solid var(--t-rand-2)', borderRadius: 10 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="#4A5A75" strokeWidth="1.6" fill="none" /><path d="M11 11l3.5 3.5" stroke="#4A5A75" strokeWidth="1.6" /></svg>
              <span style={{ position: 'absolute', left: -9999 }}>Zoek een plan</span>
              <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een plan of event" style={{ all: 'unset', flex: 1, fontSize: 14 }} />
            </label>
            {treffers.length > 0 && (
              <div className="t-menu" style={{ left: 0, right: 0, top: 'calc(100% + 4px)' }}>
                {treffers.map((p) => <a key={p.id} href={`/maps/${p.id}`}><span style={{ flex: 1 }}>{p.naam}</span><span className="t-stil" style={{ fontSize: 12 }}>{p.editie_naam}</span></a>)}
              </div>
            )}
          </div>
          {schrijven && ev.ok && <button className="t-knop" style={{ height: 44 }} onClick={() => setEvDialoog('nieuw')}>Nieuw event</button>}
          {schrijven && <button className="t-knop hoofd" style={{ height: 44, padding: '0 18px', fontSize: 14 }} onClick={() => setNieuwPlan('')}>Nieuw plan</button>}
        </header>

        {fout && <div className="t-melding fout">{fout}</div>}
        {!ev.ok && !laden && <div className="t-melding let-op">Events zijn nog niet ingesteld in de databank (migratie 0007). Plannen worden voorlopig gegroepeerd op hun editie.</div>}
        {laden && <p style={sub}>Laden…</p>}

        {!laden && !plannen.length && (
          <section style={{ ...kaart, padding: 28, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <h2 style={titel}>Welkom bij Toolen Maps</h2>
            <p style={{ ...sub, margin: 0, fontSize: 14 }}>Maak een event aan met een datum, en teken daarna het eerste plan.</p>
            {schrijven && <div className="t-rij">{ev.ok && <button className="t-knop" onClick={() => setEvDialoog('nieuw')}>Nieuw event</button>}<button className="t-knop hoofd" onClick={() => setNieuwPlan('')}>Nieuw plan</button></div>}
          </section>
        )}

        {kaarten.length > 0 && (
          <section aria-labelledby="volgend" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="t-rij" style={{ alignItems: 'baseline' }}><h2 id="volgend" style={{ ...titel, flex: 1 }}>Volgende events</h2><a href="/maps/plannen" style={{ fontSize: 13.5, fontWeight: 500 }}>Alle plannen</a></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {kaarten.map((g) => {
                const d = dagenTot(g.datum);
                const def = g.plannen.filter((p) => p.status === 'definitief').length;
                const eerste = g.plannen[0];
                return (
                  <article key={g.id} style={{ ...kaart, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <a href={eerste ? `/maps/${eerste.id}` : '/maps/plannen'} style={{ position: 'relative', display: 'block' }} aria-label={eerste ? `${g.naam}: ${eerste.naam} openen` : g.naam}>
                      <PlanVoorbeeld items={(eerste && voorbeelden[eerste.id]) || []} kleur={g.kleur} label={eerste ? `Voorbeeld van ${eerste.naam}` : 'Nog geen plan'} />
                      <span style={{ position: 'absolute', left: 12, top: 12, background: g.kleur, color: '#fff', fontFamily: 'var(--font-titel)', fontStretch: '112%', fontWeight: 700, fontSize: 14, padding: '5px 10px', borderRadius: 6 }}>{g.naam}</span>
                    </a>
                    <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                        <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span style={sub}>{eventDatum(g.datum)}</span>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{g.plek || eerste?.locatie || `${g.plannen.length} ${g.plannen.length === 1 ? 'plan' : 'plannen'}`}</span>
                        </span>
                        {d != null && <span style={{ textAlign: 'right' }}><span style={{ fontFamily: 'var(--font-titel)', fontStretch: '125%', fontWeight: 800, fontSize: 30, lineHeight: 1, letterSpacing: '-0.02em' }}>{d}</span><span style={{ ...sub, display: 'block', fontSize: 12 }}>{d === 1 ? 'Dag' : 'Dagen'}</span></span>}
                      </div>
                      {g.plannen.length > 0 && <div style={{ display: 'flex', gap: 3 }} aria-label={`${def} van ${g.plannen.length} plannen definitief`}>{g.plannen.map((p, i) => <span key={p.id} style={{ flex: 1, height: 8, borderRadius: 2, background: i < def ? g.kleur : '#E3E8EF' }} />)}</div>}
                      <div className="t-rij" style={{ justifyContent: 'space-between', fontSize: 12.5, color: 'var(--t-tekst-2)' }}>
                        <span>{g.plannen.length ? `${def} van ${g.plannen.length} plannen definitief` : 'Nog geen plannen'}</span>
                        {schrijven && <span className="t-rij" style={{ gap: 6 }}>
                          {ev.ok && <button className="t-knop klein stil" onClick={() => setEvDialoog(g)}>Wijzigen</button>}
                          <button className="t-knop klein" onClick={() => setNieuwPlan(ev.ok ? g.id : '')}>Plan toevoegen</button>
                        </span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {lijn && (
          <section aria-labelledby="seizoen" style={{ ...kaart, padding: '18px 20px 20px' }}>
            <div className="t-rij" style={{ alignItems: 'baseline', marginBottom: 12 }}>
              <h2 id="seizoen" style={{ ...titel, flex: 1 }}>Seizoen</h2>
              <span style={sub}>{komend.length} {komend.length === 1 ? 'event' : 'events'} · {komend.reduce((t, g) => t + g.plannen.length, 0)} plannen{eersteStart != null ? ` · Eerste start over ${eersteStart} ${eersteStart === 1 ? 'dag' : 'dagen'}` : ''}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ position: 'relative', minWidth: 720, height: 160, margin: '0 12px' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 64, height: 4, background: '#E3E8EF', borderRadius: 2 }} />
                {lijn.maanden.map((m) => (
                  <span key={m.naam + m.x}>
                    <span style={{ position: 'absolute', left: `${m.x}%`, top: 56, width: 2, height: 20, background: '#CFD7E3' }} />
                    <span style={{ position: 'absolute', left: `${m.x}%`, top: 140, fontSize: 11.5, color: 'var(--t-tekst-2)', fontWeight: 500 }}>{m.naam}</span>
                  </span>
                ))}
                {lijn.punten.map(({ g, x, rij }) => (
                  <a key={g.id} href={g.plannen[0] ? `/maps/${g.plannen[0].id}` : '/maps/plannen'} title={`${g.naam} · ${eventDatum(g.datum)}`} style={{ color: 'var(--t-tekst)', textDecoration: 'none' }}>
                    <span style={{ position: 'absolute', left: `${x}%`, top: 58, width: 16, height: 16, marginLeft: -8, borderRadius: '50%', background: g.kleur, border: '3px solid #fff', boxShadow: `0 0 0 1px ${g.kleur}`, boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', left: `${x}%`, top: [6, 32, 86, 112][rij], transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 600, background: '#fff', borderBottom: `3px solid ${g.kleur}`, padding: '2px 4px' }}>{g.naam}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {plannen.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            <section aria-labelledby="aandacht" style={{ ...kaart, padding: '18px 20px' }}>
              <h2 id="aandacht" style={{ ...titel, fontSize: 18, marginBottom: 6 }}>Vraagt aandacht</h2>
              {!aandacht.length && <p style={{ ...sub, margin: '8px 0 0' }}>Niets dringends. Alles ziet er goed uit.</p>}
              {aandacht.map((a, i) => {
                const inhoud = (
                  <>
                    <span aria-hidden="true" style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, background: a.kleur, flex: 'none' }} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{a.tekst}</span><span style={sub}>{a.waar}</span></span>
                    <span className={`t-pil ${a.fout ? 'fout' : 'let-op'}`}>{a.soort}</span>
                  </>
                );
                const st = { display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #EEF1F5', color: 'var(--t-tekst)', textDecoration: 'none', width: '100%', background: 'none', border: 0, borderBottomStyle: 'solid', font: 'inherit', textAlign: 'left', cursor: 'pointer' };
                return a.href ? <a key={i} href={a.href} style={st}>{inhoud}</a> : <button key={i} onClick={a.onClick} style={st}>{inhoud}</button>;
              })}
            </section>
            <section aria-labelledby="nu" style={{ ...kaart, padding: '18px 20px' }}>
              <h2 id="nu" style={{ ...titel, fontSize: 18, marginBottom: 6 }}>Nu bezig</h2>
              {!bezig.length && <p style={{ ...sub, margin: '8px 0 0' }}>Niemand werkt op dit moment in een plan.</p>}
              {bezig.slice(0, 6).map((b) => (
                <a key={`${b.uid}${b.plan.id}`} href={`/maps/${b.plan.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #EEF1F5', color: 'var(--t-tekst)', textDecoration: 'none' }}>
                  <Avatar p={b} maat={32} rand={false} />
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 500 }}>{b.naam}</span><span style={sub}>{[b.plan.editie_naam, b.plan.naam].filter(Boolean).join(' · ')}</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#17663F' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28B571' }} />Live</span>
                </a>
              ))}
              {losse.length > 0 && <p style={{ ...sub, margin: '12px 0 0' }}>{losse.length} {losse.length === 1 ? 'plan hoort' : 'plannen horen'} nog bij geen event. <a href="/maps/plannen">Bekijken</a></p>}
            </section>
          </div>
        )}
      </main>
      {nieuwPlan !== null && <NieuwPlan plannen={plannen} startEvent={nieuwPlan} onSluit={() => setNieuwPlan(null)} />}
      {evDialoog && <EventDialoog event={evDialoog === 'nieuw' ? null : evDialoog} aantal={ev.events.length} onSluit={() => setEvDialoog(null)} onKlaar={() => { setEvDialoog(null); laad(); }} />}
    </div>
  );
}
