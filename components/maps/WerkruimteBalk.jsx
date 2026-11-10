'use client';

import { WERKRUIMTES, WR_MODULE } from './werkruimtes';
import { heeftModule, nietInPakket } from './merk';
import { Icoon } from './iconen';

// Werkplek kiezen in de topbalk: enkel symbolen, de actieve met naam. Met de muis over een symbool
// (of met Tab erop) schuift enkel dat symbool open met zijn naam; de zoekbalk ernaast wordt even smaller.
export default function WerkruimteBalk({ actief, onKies, badges = {} }) {
  return (
    <div className="fm-wr-houder">
      <div className="fm-wr-schuif" role="tablist" aria-label="Werkplek">
        {WERKRUIMTES.map((x) => {
          const slot = !!WR_MODULE[x.id] && !heeftModule(WR_MODULE[x.id]);
          const aan = x.id === actief;
          return (
            <button key={x.id} type="button" role="tab" aria-selected={aan} className={aan ? 'aan' : ''} disabled={slot}
              title={slot ? nietInPakket(WR_MODULE[x.id]) : `Alt ${x.toets}`} aria-label={x.naam} onClick={() => onKies(x.id)}>
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
