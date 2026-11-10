'use client';

import { useMemo, useState } from 'react';
import { useSluitBuiten } from './dialoog';
import { Icoon } from './iconen';

// Altijd zichtbaar op de kaart: in welke laag nieuwe items komen. Klik om snel een andere laag
// actief te maken of lagen aan/uit te zetten, zonder het lagenpaneel te openen.
export default function LaagChip({ lagen, actieveLaag, items, schrijven, onKies, onZicht, onPaneel }) {
  const [open, setOpen] = useState(false);
  useSluitBuiten(open, () => setOpen(false));
  const actief = lagen.find((l) => l.id === actieveLaag);
  const tel = useMemo(() => { const m = new Map(); for (const i of items) m.set(i.laag_id, (m.get(i.laag_id) || 0) + 1); return m; }, [items]);
  if (!lagen.length) return null;
  // Mappen bij elkaar, zoals in het lagenpaneel.
  const blokken = []; const gezien = new Set();
  for (const l of lagen) {
    if (!l.map) blokken.push({ laag: l });
    else if (!gezien.has(l.map)) { gezien.add(l.map); blokken.push({ map: l.map, lagen: lagen.filter((x) => x.map === l.map) }); }
  }
  const rij = (l, inMap) => {
    const aan = l.id === actieveLaag;
    return (
      <div key={l.id} className={`rij${aan ? ' aan' : ''}${inMap ? ' inmap' : ''}`}>
        <button className="oog" title={l.zichtbaar ? 'Verbergen' : 'Tonen'} aria-label={`${l.zichtbaar ? 'Verberg' : 'Toon'} ${l.naam}`} disabled={!schrijven} onClick={() => onZicht(l.id, !l.zichtbaar)} style={{ color: l.zichtbaar ? '#1d1d1b' : '#c4c4c0' }}>
          <Icoon naam={l.zichtbaar ? 'oog' : 'oogdicht'} maat={14} />
        </button>
        <button className="naam" onClick={() => { onKies(l.id); setOpen(false); }} title="Nieuwe items in deze laag">
          <i style={{ background: l.kleur }} />
          <span>{l.naam}</span>
          {l.vergrendeld && <Icoon naam="slot" maat={11} />}
          <small>{tel.get(l.id) || 0}</small>
          {aan && <b aria-label="actief">✓</b>}
        </button>
      </div>
    );
  };
  const waarschuwing = actief && (!actief.zichtbaar || actief.vergrendeld) ? (actief.vergrendeld ? 'vergrendeld' : 'verborgen') : '';
  return (
    <div className="fm-laagchip" onPointerDown={(e) => e.stopPropagation()}>
      {open && (
        <div className="fm-menu fm-laagchip-lijst" role="menu">
          <div className="kop">Nieuwe items komen in …</div>
          <div className="lijst">
            {blokken.map((b) => (b.map
              ? <div key={`m:${b.map}`}><div className="map">{b.map}</div>{b.lagen.map((l) => rij(l, true))}</div>
              : rij(b.laag, false)))}
          </div>
          <button className="alles" onClick={() => { setOpen(false); onPaneel(); }}>Lagenpaneel openen</button>
        </div>
      )}
      <button data-menuknop className={`knop${waarschuwing ? ' let' : ''}`} onClick={() => setOpen((o) => !o)} title="Actieve laag: hier komen nieuwe items. Klik om te wisselen.">
        <Icoon naam="lagen" maat={14} />
        <i style={{ background: actief?.kleur || '#686D76' }} />
        <span className="label"><small>Nieuwe items in</small><span className="naam">{actief?.map ? <small>{actief.map} › </small> : null}{actief?.naam || 'Geen laag'}</span></span>
        {waarschuwing && <em>{waarschuwing}</em>}
        <span aria-hidden="true" className="pijl">▾</span>
      </button>
    </div>
  );
}
