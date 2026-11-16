'use client';

// Event aanmaken, wijzigen of verwijderen (naam, datum, plaats, kleur). Gebruikt op het overzicht en in de planlijst.
import { useState } from 'react';
import { maps, foutTekst } from './db';
import { bevestig } from './dialoog';
import { EVENT_KLEUREN, kleurVoor } from './events';

export default function EventDialoog({ event, aantal, onSluit, onKlaar }) {
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
