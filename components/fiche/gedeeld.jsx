'use client';

// Kleine bouwstenen van de fiche.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { wedstrijd, datumVan, vanDatum, isoDag, label as dagLabel } from './dagen';

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

export function Paneel({ titel, sub, onSluit, children, voet, naast = false, knoppen = null }) {
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onSluit(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onSluit]);
  return (
    <div className={`pf-achter ${naast ? 'naast' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <aside className="pf-paneel" role="dialog" aria-label={titel}>
        <div className="pf-paneelkop">
          <div style={{ flex: 1, minWidth: 0 }}>{sub && <div className="pf-stil pf-klein">{sub}</div>}<h2>{titel}</h2></div>
          {knoppen}
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

// Eén keuzeveld voor de hele fiche: typen om te zoeken, pijltjes en Enter om te kiezen.
//   opties: [{ id, naam, sub?, groep? }]. Met `vrij` mag je ook iets typen dat niet in de lijst staat (onVrij).
//   Zonder `waarde` en met `tekst` toont het veld die vrije tekst.
export function Keuze({ waarde, opties, onChange, leeg = 'Geen', label, uit = false, placeholder = 'Kies of typ…', vrij = false, tekst = '', onVrij, wisbaar = true, klasse = 't-veld', style }) {
  const gekozen = opties.find((o) => o.id === waarde) || null;
  const toon = gekozen ? gekozen.naam : (tekst || '');
  const [q, setQ] = useState(null);          // null = niet aan het typen
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [vak, setVak] = useState(null);
  const ref = useRef(null);
  const zoek = (q || '').trim().toLowerCase();
  const lijst = (zoek ? opties.filter((o) => `${o.naam} ${o.sub || ''} ${o.groep || ''}`.toLowerCase().includes(zoek)) : opties).slice(0, 60);
  const metLeeg = wisbaar && !zoek && (waarde || tekst);
  const plaats = () => { const r = ref.current?.getBoundingClientRect(); if (r) setVak({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 220), max: Math.max(160, window.innerHeight - r.bottom - 16) }); };
  const doeOpen = () => { if (uit) return; plaats(); setOpen(true); setI(0); };
  const sluit = () => { setOpen(false); setQ(null); };
  useEffect(() => {
    if (!open) return undefined;
    const schuif = (e) => { if (e.target instanceof Element && e.target.closest('.pf-keuzelijst')) return; plaats(); };
    window.addEventListener('scroll', schuif, true); window.addEventListener('resize', plaats);
    return () => { window.removeEventListener('scroll', schuif, true); window.removeEventListener('resize', plaats); };
  }, [open]);
  const kies = (o) => { sluit(); ref.current?.blur(); if (o) { if (o.id !== waarde) onChange(o.id); } else if (waarde || tekst) { if (waarde) onChange(null); if (vrij && tekst) onVrij?.(''); } };
  const verlaat = () => {
    if (q == null) return sluit();
    const t = q.trim();
    const exact = t && opties.find((o) => o.naam.toLowerCase() === t.toLowerCase());
    sluit();
    if (exact) { if (exact.id !== waarde) onChange(exact.id); } else if (vrij && t !== toon) { if (waarde) onChange(null); onVrij?.(t); } else if (!t && (waarde || tekst)) kies(null);
  };
  const toets = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) doeOpen(); else setI((x) => Math.min(lijst.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === 'Enter') { if (open && lijst[i] && (zoek || !vrij)) { e.preventDefault(); kies(lijst[i]); } else e.currentTarget.blur(); }
    else if (e.key === 'Escape') { if (open) { e.stopPropagation(); sluit(); e.currentTarget.blur(); } }
  };
  let vorigeGroep = null;
  return (
    <span className="pf-keuze" style={style}>
      <input ref={ref} className={klasse} role="combobox" aria-expanded={open} aria-autocomplete="list" aria-label={label} disabled={uit} autoComplete="off"
        value={q ?? toon} placeholder={uit ? '' : (leeg && !vrij ? leeg : placeholder)}
        onFocus={(e) => { e.target.select(); doeOpen(); }} onClick={() => !open && doeOpen()}
        onChange={(e) => { setQ(e.target.value); setI(0); if (!open) doeOpen(); }} onBlur={verlaat} onKeyDown={toets} />
      <svg className="pijl" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
      {open && vak && (
        <div className="pf-keuzelijst" role="listbox" style={{ left: vak.left, top: vak.top, width: vak.width, maxHeight: Math.min(320, vak.max) }} onMouseDown={(e) => e.preventDefault()}>
          {metLeeg && <button type="button" className="leeg" onClick={() => kies(null)}>{leeg || 'Leegmaken'}</button>}
          {lijst.map((o, n) => {
            const kop = o.groep && o.groep !== vorigeGroep ? o.groep : null; vorigeGroep = o.groep || null;
            return [
              kop && <div key={`g${kop}`} className="kop">{kop}</div>,
              <button type="button" key={o.id} role="option" aria-selected={o.id === waarde} className={`${n === i ? 'actief' : ''} ${o.id === waarde ? 'gekozen' : ''}`} onMouseEnter={() => setI(n)} onClick={() => kies(o)}>
                <span>{o.naam}</span>{o.sub && <small>{o.sub}</small>}
              </button>,
            ];
          })}
          {!lijst.length && <div className="niets">{vrij && zoek ? `Enter: “${q.trim()}” als vrije tekst` : 'Niets gevonden'}</div>}
          {vrij && zoek && lijst.length > 0 && !lijst.some((o) => o.naam.toLowerCase() === zoek) && <div className="niets">Tab: “{q.trim()}” als vrije tekst</div>}
        </div>
      )}
    </span>
  );
}
// Keuze uit een lijst (personen, leveranciers, items): zelfde veld, met zoeken.
export function Kiezer({ waarde, opties, onChange, placeholder = 'Kies of typ…', leeg = 'Niemand', label, uit = false }) {
  return <Keuze waarde={waarde} opties={opties} onChange={onChange} placeholder={placeholder} leeg={leeg} label={label} uit={uit} style={{ width: '100%' }} />;
}

// Eén dagkiezer voor de hele fiche: een vrije datum (bewaard tegenover de wedstrijddag, zodat ze meeschuift
// naar een volgende editie). Zonder wedstrijddag: het aantal dagen voor (-) of na (+) de wedstrijd.
export function DagKiezer({ plan, anker, dag, onChange, label = 'Dag', uit = false, leeg = false, metLabel = true, style }) {
  const heeft = dag != null && dag !== '';
  if (wedstrijd(plan)) {
    const d = heeft ? datumVan(plan, anker, dag) : null;
    return (
      <span className="pf-dag" style={style}>
        <input className="t-veld" type="date" value={d ? isoDag(d) : ''} disabled={uit} aria-label={label}
          onChange={(e) => { if (e.target.value) onChange(vanDatum(plan, e.target.value)); else if (leeg) onChange(null); }} />
        {metLabel && heeft && <span className="lab">{dagLabel(plan, anker, dag)}</span>}
      </span>
    );
  }
  return (
    <span className="pf-dag" style={style}>
      <input className="t-veld" type="number" step="1" value={heeft ? (anker === 'einde' ? dag : dag) : ''} disabled={uit} aria-label={`${label}: dagen voor (-) of na (+) de wedstrijd`} placeholder="-2"
        onChange={(e) => { if (e.target.value === '') { if (leeg) onChange(null); return; } onChange({ anker: anker === 'einde' ? 'einde' : 'start', dag: Number(e.target.value) || 0 }); }} />
      {metLabel && <span className="lab">{heeft ? dagLabel(plan, anker, dag) : 'dagen tegenover de wedstrijd'}</span>}
    </span>
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

// Het scherm vult de rest van het venster; de tabel scrolt binnenin (planning, leveranciers).
export function useVolHoogte(ref, aan = true) {
  const [h, setH] = useState(null);
  useLayoutEffect(() => {
    if (!aan) return undefined;
    const meet = () => { if (ref.current) setH(Math.max(360, window.innerHeight - ref.current.getBoundingClientRect().top)); };
    meet(); window.addEventListener('resize', meet); return () => window.removeEventListener('resize', meet);
  }, [aan, ref]);
  return aan ? h : null;
}

// Knop met een klein paneel eronder (Filter, + Leverancier …); sluit bij klikken ernaast of Escape.
export function KnopPaneel({ label, aan = false, hoofd = false, rechts = false, breed = 300, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const weg = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('.pf-keuzelijst')) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', weg); window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', weg); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span className="pf-filterwrap" ref={ref}>
      <button className={`t-knop ${hoofd ? 'hoofd' : ''} ${aan ? 'aan' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>{label}</button>
      {open && <div className="pf-filterpop" role="dialog" aria-label={typeof label === 'string' ? label : undefined} style={{ width: breed, ...(rechts ? { left: 'auto', right: 0 } : {}) }}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>}
    </span>
  );
}


// Kleuren voor de soorten in de planning: goed van elkaar te onderscheiden, ook als streep.
export const SOORT_KLEUREN = [['#378ADD', 'Blauw'], ['#1D9E75', 'Teal'], ['#639922', 'Groen'], ['#BA7517', 'Oker'], ['#D85A30', 'Koraal'], ['#E24B4A', 'Rood'], ['#D4537E', 'Roze'], ['#7F77DD', 'Paars'], ['#888780', 'Grijs']];
export function KleurStalen({ waarde, onKies, uit = false, label = 'Kleur' }) {
  return (
    <span className="pf-stalen" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={!waarde} className={`geen ${!waarde ? 'aan' : ''}`} disabled={uit} onClick={() => onKies(null)} aria-label="Geen kleur" title="Geen kleur" />
      {SOORT_KLEUREN.map(([k, n]) => <button key={k} type="button" role="radio" aria-checked={waarde === k} className={waarde === k ? 'aan' : ''} style={{ background: k }} disabled={uit} onClick={() => onKies(k)} aria-label={n} title={n} />)}
    </span>
  );
}
