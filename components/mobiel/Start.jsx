'use client';

// Startscherm: het eerstvolgende event met zijn plannen bovenaan, daarna alle events.
import { useEffect, useMemo, useState } from 'react';
import { maps, foutTekst } from '../maps/db';
import { ToolenWoordmerk } from '../ToolenLogo';
import { OrgLogo, MetToolen } from '../Huisstijl';
import { Ic } from './iconen';
import { initialen } from './MobielApp';

const vandaag = () => new Date().toISOString().slice(0, 10);
const datum = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const wanneer = (t) => {
  if (!t) return '';
  const d = Math.round((new Date(new Date().toDateString()) - new Date(new Date(t).toDateString())) / 864e5);
  return d <= 0 ? 'Gewijzigd vandaag' : d === 1 ? 'Gewijzigd gisteren' : d < 7 ? `Gewijzigd ${d} dagen geleden` : `Gewijzigd ${new Date(t).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}`;
};
const BEWAAR = 'fm-mob-start';

export default function Start({ huisstijl, profiel, planId, onPlan, onMeer }) {
  const [events, setEvents] = useState(null);
  const [plannen, setPlannen] = useState([]);
  const [fout, setFout] = useState('');
  const [zoek, setZoek] = useState('');
  const [alle, setAlle] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [e, p] = await Promise.all([
          maps().from('events').select('id, naam, datum, einddatum, plek, kleur').order('datum', { ascending: true }),
          maps().from('plannen').select('id, naam, editie_naam, event_id, locatie, updated_at').is('verwijderd_op', null).order('updated_at', { ascending: false }),
        ]);
        if (e.error) throw e.error;
        if (p.error) throw p.error;
        setEvents(e.data || []); setPlannen(p.data || []);
        try { localStorage.setItem(BEWAAR, JSON.stringify({ e: e.data, p: p.data })); } catch { /* */ }
      } catch (err) {
        let oud = null; try { oud = JSON.parse(localStorage.getItem(BEWAAR) || 'null'); } catch { /* */ }
        if (oud) { setEvents(oud.e || []); setPlannen(oud.p || []); setFout('Geen verbinding: je ziet de lijst van je laatste bezoek.'); } else { setEvents([]); setFout(foutTekst(err)); }
      }
    })();
  }, []);

  const perEvent = useMemo(() => {
    const m = new Map();
    for (const p of plannen) { const k = p.event_id || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
    return m;
  }, [plannen]);
  // Eerstvolgend: het eerste event dat nog niet voorbij is, anders het laatste.
  const volgend = useMemo(() => {
    const lijst = (events || []).filter((e) => perEvent.has(e.id));
    return lijst.find((e) => (e.einddatum || e.datum || '') >= vandaag()) || lijst[lijst.length - 1] || null;
  }, [events, perEvent]);
  const laatst = plannen.find((p) => p.id === planId);

  const z = zoek.trim().toLowerCase();
  const gevonden = z ? plannen.filter((p) => `${p.naam} ${p.editie_naam || ''} ${p.locatie || ''} ${(events || []).find((e) => e.id === p.event_id)?.naam || ''}`.toLowerCase().includes(z)) : null;
  const eigen = !!(huisstijl && (huisstijl.logo_donker || huisstijl.logo_licht));

  const Rij = ({ p }) => (
    <button type="button" className="mb-rij" onClick={() => onPlan(p.id)}>
      <span className="mb-blok"><Ic.kaart /></span>
      <span><b>{p.naam}</b><small>{[p.editie_naam, wanneer(p.updated_at)].filter(Boolean).join(' · ')}</small></span>
      <span className="mb-pijl">›</span>
    </button>
  );

  return (
    <>
      <header className="mb-kop">
        {eigen ? <OrgLogo huisstijl={huisstijl} donker hoogte={30} /> : <ToolenWoordmerk op="navy" product="maps" grootte={18} />}
        <span style={{ flex: 1 }} />
        <button type="button" className="mb-avatar" aria-label="Account en meer" onClick={onMeer}>{profiel ? initialen(profiel) : ''}</button>
      </header>
      <main className="mb-inhoud">
        <div className="mb-pad">
          <label className="mb-zoek"><Ic.zoek /><input type="search" placeholder="Zoek een plan of event" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoeken" /></label>
          {fout && <div className="mb-melding">{fout}</div>}
          {events === null && <p className="mb-sub">Laden…</p>}
          {gevonden && (
            gevonden.length ? <div className="mb-lijst">{gevonden.map((p) => <Rij key={p.id} p={p} />)}</div> : <p className="mb-leeg">Niets gevonden.</p>
          )}
          {!gevonden && events !== null && (
            <>
              {laatst && (
                <>
                  <p className="mb-kopje">Laatst geopend</p>
                  <div className="mb-lijst"><Rij p={laatst} /></div>
                </>
              )}
              {volgend && (
                <>
                  <p className="mb-kopje">Eerstvolgend event</p>
                  <div className="mb-kaartje" role="group" aria-label={volgend.naam}>
                    <div className="tekst">
                      <strong>{volgend.naam}</strong>
                      <span className="mb-sub">{[datum(volgend.datum), volgend.plek, `${perEvent.get(volgend.id)?.length || 0} plannen`].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className="mb-lijst" style={{ border: 0, borderTop: '1px solid var(--t-rand)', borderRadius: 0 }}>
                      {(perEvent.get(volgend.id) || []).map((p) => <Rij key={p.id} p={p} />)}
                    </div>
                  </div>
                </>
              )}
              {!plannen.length && <p className="mb-leeg">Nog geen plannen. Maak je eerste plan op een computer.</p>}
              {plannen.length > 0 && (alle ? (
                <>
                  {(events || []).filter((e) => e.id !== volgend?.id && perEvent.has(e.id)).map((e) => (
                    <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p className="mb-kopje">{e.naam}{e.datum ? ` · ${datum(e.datum)}` : ''}</p>
                      <div className="mb-lijst">{perEvent.get(e.id).map((p) => <Rij key={p.id} p={p} />)}</div>
                    </div>
                  ))}
                  {perEvent.has('') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p className="mb-kopje">Zonder event</p>
                      <div className="mb-lijst">{perEvent.get('').map((p) => <Rij key={p.id} p={p} />)}</div>
                    </div>
                  )}
                </>
              ) : <button type="button" className="mb-knop" onClick={() => setAlle(true)}>Alle events en plannen</button>)}
              {huisstijl && <div className="mb-voet"><MetToolen huisstijl={huisstijl} /></div>}
            </>
          )}
        </div>
      </main>
    </>
  );
}
