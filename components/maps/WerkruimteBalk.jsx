'use client';

import { useEffect, useRef, useState } from 'react';
import { WERKRUIMTES, WR_MODULE } from './werkruimtes';
import { heeftModule, nietInPakket } from './merk';

// Werkplek kiezen in de topbalk: één knop met de huidige werkplek, de rest in een uitklaplijst
// (met beta-label, sneltoets en badge voor open brandveiligheidsfouten).
export default function WerkruimteBalk({ actief, onKies, badges = {} }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const weg = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', weg); document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  const w = WERKRUIMTES.find((x) => x.id === actief) || WERKRUIMTES[0];
  const plan = w.id === 'plan';
  return (
    <div className="fm-wr-kies" ref={ref}>
      <button type="button" className={`fm-wr-knop${plan ? '' : ' aan'}`} aria-haspopup="listbox" aria-expanded={open} title="Werkplek kiezen"
        style={plan ? undefined : { background: w.kleur, borderColor: w.kleur }} onClick={() => setOpen((o) => !o)}>
        <span className="lbl">Werkplek</span>
        {!plan && <i className="bol" style={{ background: '#fff' }} aria-hidden="true" />}
        <span className="naam">{w.naam}</span>
        {w.beta && <span className="fm-wr-beta" style={plan ? undefined : { color: '#fff', borderColor: 'rgba(255,255,255,.7)' }}>beta</span>}
        {badges[w.id] > 0 && <span className="fm-wr-badge" style={plan ? undefined : { background: '#fff', color: w.kleur }}>{badges[w.id]}</span>}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open && (
        <div className="fm-uitklap fm-wr-menu" role="listbox" aria-label="Werkplek">
          {WERKRUIMTES.map((x) => (
            <button key={x.id} type="button" role="option" aria-selected={x.id === actief} className={x.id === actief ? 'aan' : ''}
              disabled={!!WR_MODULE[x.id] && !heeftModule(WR_MODULE[x.id])} title={WR_MODULE[x.id] && !heeftModule(WR_MODULE[x.id]) ? nietInPakket(WR_MODULE[x.id]) : undefined}
              onClick={() => { setOpen(false); onKies(x.id); }}>
              <i className="bol" style={{ background: x.kleur }} aria-hidden="true" />
              <span className="naam">{x.naam}</span>
              {x.beta && <span className="fm-wr-beta">beta</span>}
              {!!WR_MODULE[x.id] && !heeftModule(WR_MODULE[x.id]) && <span className="fm-wr-beta">niet in pakket</span>}
              {badges[x.id] > 0 && <span className="fm-wr-badge">{badges[x.id]}</span>}
              <kbd>Alt {x.toets}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Exportknoppen van de werkruimte, rechts bovenaan: primair in de kleur, de rest als gewone knop.
export function WerkruimteExport({ wr, bezig = '', onExport }) {
  // Enkel de hoofdexport als knop; de andere staan bovenaan in het exportmenu ernaast (bovenbalk blijft passen).
  const p = (wr?.exports || []).filter((e) => e.primair);
  if (!p.length) return null;
  return (
    <div className="fm-wr-export">
      {p.map((e) => <button key={e.id} className="fm-knop fm-wr-primair" style={{ background: wr.kleur, borderColor: wr.kleur }} disabled={!!bezig} onClick={() => onExport(e.id)}>{bezig || e.naam}</button>)}
    </div>
  );
}
