'use client';

// Kleine bouwstenen van de fiche.
import { useEffect, useRef, useState } from 'react';

export const STATUS_TAAK = [['open', 'Open'], ['bevestigd', 'Bevestigd'], ['klaar', 'Klaar']];
export const statusKlas = (s) => ({ klaar: 'ok', bevestigd: 'blauw', op_site: 'ok', terug: 'ok', gepakt: 'blauw', gefactureerd: 'ok', afgesloten: 'ok', bevestigd_lev: 'blauw', offerte: 'blauw', betaald: 'ok', goedgekeurd: 'ok', betwist: 'let-op', afgewezen: 'let-op' }[s] || '');

// Status als keuzelijst in een tabel.
export function StatusKeuze({ waarde, opties, onChange, label, uit = false }) {
  return (
    <span className="pf-status">
      <select className={statusKlas(waarde)} value={waarde || ''} onChange={(e) => onChange(e.target.value)} aria-label={label} disabled={uit}>
        {opties.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
    </span>
  );
}

// Tekstveld dat pas bewaart bij verlaten of Enter (geen schrijfactie per toets).
export function Bewaarveld({ waarde, onBewaar, klasse = 'pf-cel breed', placeholder = '', label, uit = false, type = 'text', style }) {
  const [v, setV] = useState(waarde ?? '');
  const vorige = useRef(waarde ?? '');
  useEffect(() => { setV(waarde ?? ''); vorige.current = waarde ?? ''; }, [waarde]);
  const bewaar = () => { if (String(v) !== String(vorige.current)) { vorige.current = v; onBewaar(v); } };
  return (
    <input className={klasse} type={type} value={v} placeholder={placeholder} aria-label={label} disabled={uit} style={style}
      onChange={(e) => setV(e.target.value)} onBlur={bewaar}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(vorige.current); e.currentTarget.blur(); } }} />
  );
}

export function Bewaartekst({ waarde, onBewaar, placeholder = '', label, uit = false, rijen = 3 }) {
  const [v, setV] = useState(waarde ?? '');
  useEffect(() => { setV(waarde ?? ''); }, [waarde]);
  return <textarea className="t-veld" style={{ width: '100%', boxSizing: 'border-box', minHeight: rijen * 22, padding: 8, resize: 'vertical' }} value={v} placeholder={placeholder} aria-label={label} disabled={uit}
    onChange={(e) => setV(e.target.value)} onBlur={() => { if ((waarde ?? '') !== v) onBewaar(v); }} />;
}

export function Paneel({ titel, sub, onSluit, children, voet }) {
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onSluit(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onSluit]);
  return (
    <div className="pf-achter" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="pf-paneel" role="dialog" aria-label={titel}>
        <div className="pf-paneelkop">
          <div style={{ flex: 1, minWidth: 0 }}>{sub && <div className="pf-stil pf-klein">{sub}</div>}<h2>{titel}</h2></div>
          <button className="pf-sluit" onClick={onSluit} aria-label="Sluiten">✕</button>
        </div>
        <div className="pf-paneelromp">{children}</div>
        {voet && <div className="pf-paneelvoet">{voet}</div>}
      </aside>
    </div>
  );
}

export function Cijfer({ n, tekst, klasse = '' }) {
  return <div className="pf-kaart"><div className="pf-cijfer"><b className={klasse}>{n}</b><span>{tekst}</span></div></div>;
}

export function Zoek({ waarde, onChange, placeholder }) {
  return (
    <label className="pf-zoek">
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="#4A5A75" strokeWidth="1.6" fill="none" /><path d="M11 11l3.5 3.5" stroke="#4A5A75" strokeWidth="1.6" /></svg>
      <input value={waarde} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function Seg({ waarde, opties, onChange, label }) {
  return <div className="pf-seg" role="tablist" aria-label={label}>{opties.map(([k, n]) => <button key={k} role="tab" aria-selected={waarde === k} className={waarde === k ? 'aan' : ''} onClick={() => onChange(k)}>{n}</button>)}</div>;
}

export function Chips({ waarde, opties, onChange }) {
  return <div className="pf-chiprij">{opties.map(([k, n]) => <button key={k} className={`pf-chip ${waarde === k ? 'aan' : ''}`} aria-pressed={waarde === k} onClick={() => onChange(k)}>{n}</button>)}</div>;
}

// Keuze uit een lijst met zoeken (personen, leveranciers, items).
export function Kiezer({ waarde, opties, onChange, placeholder = 'Kies…', leeg = 'Niemand', label, uit = false }) {
  return (
    <select className="t-veld" style={{ width: '100%', boxSizing: 'border-box', height: 32 }} value={waarde || ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label} disabled={uit}>
      <option value="">{leeg}</option>
      {opties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
    </select>
  );
}

// Notities van één tab, onderaan die tab.
export function TabNotities({ f, tab }) {
  const lijst = (f.d.notities || []).filter((n) => n.tab === tab);
  const [tekst, setTekst] = useState('');
  if (!lijst.length && !f.schrijven) return null;
  const toe = async () => { const t = tekst.trim(); if (!t) return; await f.voegToe('notities', { tekst: t, tab, auteur_naam: f.profiel?.display_name || null }); setTekst(''); };
  return (
    <section className="pf-kaart">
      <div className="pf-kaartkop"><h2>Notities bij deze tab</h2></div>
      {lijst.map((n) => (
        <div key={n.id} className={`pf-rij pf-not ${n.klaar ? 'klaar' : ''}`} style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <input type="checkbox" checked={n.klaar} disabled={!f.schrijven} onChange={() => f.wijzig('notities', n.id, { klaar: !n.klaar, klaar_op: n.klaar ? null : new Date().toISOString() })} aria-label="Afvinken" style={{ marginTop: 3 }} />
          <span style={{ flex: 1 }}><span className="tekst" style={{ whiteSpace: 'pre-wrap' }}>{n.tekst}</span><small className="pf-stil pf-klein" style={{ display: 'block' }}>{[n.auteur_naam, new Date(n.created_at).toLocaleDateString('nl-BE')].filter(Boolean).join(' · ')}</small></span>
        </div>
      ))}
      {f.schrijven && <div className="pf-rij"><input className="t-veld" style={{ flex: 1 }} value={tekst} placeholder="Notitie toevoegen" onChange={(e) => setTekst(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && toe()} aria-label="Nieuwe notitie" /><button className="t-knop" onClick={toe}>Toevoegen</button></div>}
    </section>
  );
}
