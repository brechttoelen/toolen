'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WERKRUIMTES, WR_MODULE } from './werkruimtes';
import { heeftModule, nietInPakket } from './merk';
import { Icoon } from './iconen';

// Werkplek kiezen in de topbalk: dicht staan enkel de symbolen (de actieve met naam).
// Met de muis erover, met Tab erin of met een tik schuift de balk horizontaal open en zie je alle namen.
// Open ligt de balk over de topbalk heen, zodat de rest niet verspringt.
export default function WerkruimteBalk({ actief, onKies, badges = {} }) {
  const [open, setOpen] = useState(false);
  const [breedte, setBreedte] = useState(null);
  const binnen = useRef(null); const houder = useRef(null); const dicht = useRef(null);
  // Breedte van de dichte balk, als plaats in de topbalk.
  useLayoutEffect(() => { if (!open && binnen.current) setBreedte(binnen.current.offsetWidth); }, [open, actief, badges]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const weg = (e) => { if (!houder.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', weg, true); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', weg, true); document.removeEventListener('keydown', esc); };
  }, [open]);
  const openen = () => { clearTimeout(dicht.current); setOpen(true); };
  const sluiten = () => { clearTimeout(dicht.current); dicht.current = setTimeout(() => setOpen(false), 180); };
  return (
    <div className="fm-wr-houder" ref={houder} style={breedte ? { width: breedte } : undefined}
      onMouseEnter={openen} onMouseLeave={sluiten} onFocus={openen} onBlur={(e) => { if (!houder.current?.contains(e.relatedTarget)) sluiten(); }}>
      <div ref={binnen} className={`fm-wr-schuif${open ? ' open' : ''}`} role="tablist" aria-label="Werkplek">
        {WERKRUIMTES.map((x) => {
          const slot = !!WR_MODULE[x.id] && !heeftModule(WR_MODULE[x.id]);
          const aan = x.id === actief;
          return (
            <button key={x.id} type="button" role="tab" aria-selected={aan} className={aan ? 'aan' : ''} disabled={slot}
              title={slot ? nietInPakket(WR_MODULE[x.id]) : `${x.naam} (Alt ${x.toets})`} aria-label={x.naam}
              onClick={() => { if (aan && !open) { setOpen(true); return; } onKies(x.id); setOpen(false); }}>
              <Icoon naam={x.icoon || 'kaart'} maat={16} />
              <span className="naam">{x.naam}</span>
              {badges[x.id] > 0 && <span className="fm-wr-badge">{badges[x.id]}</span>}
            </button>
          );
        })}
      </div>
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
