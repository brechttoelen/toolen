'use client';

// In het zijpaneel van een truss-lijn: voorbeeld en de knop naar de trussbouwer.
import { useState } from 'react';
import TrussStudio, { TrussZicht } from './TrussStudio';
import { vanPunten } from './WandStudio';
import { isTrussBouw } from './trussbouw';
import { Groot3D } from './drie3d';
import { useEffect } from 'react';
import { neemBouwer } from './bouwerSignaal';

// onZet(truss, geometrie|null, lokaal-punten): de ankerlijn verhuist mee onder de truss.
export function TrussBlok({ it, el, schrijven, onZet, doeken = [] }) {
  const [open, setOpen] = useState(false); const [kijk, setKijk] = useState(false);
  useEffect(() => { if (neemBouwer(it.id)) setOpen(true); }, [it.id]);
  const gebouwd = isTrussBouw(it);
  return (
    <div className="fm-truss-blok fm-sectie">
      {gebouwd && <button type="button" className="fm-wand-mini" onClick={() => setOpen(true)} title="Trussbouwer openen"><TrussZicht it={it} el={el} doeken={doeken} /></button>}
      <button className="fm-knop zwart" onClick={() => setOpen(true)}>{gebouwd ? (schrijven ? 'Truss bouwen' : 'Truss bekijken') : 'Truss bouwen in 3D (frames, portalen)'}</button>
      {gebouwd && <button className="fm-knop" onClick={() => setKijk(true)}>⤢ In 3D bekijken</button>}
      {kijk && <Groot3D it={it} el={el} elementenMap={new Map(doeken.map((d) => [d.id, d]))} onSluit={() => setKijk(false)} />}
      {gebouwd && <span className="fm-sub">{it.velden.truss.stukken.length} stukken, vrij gebouwd: de getekende lijn is enkel nog het ankerpunt.</span>}
      {open && <TrussStudio it={it} el={el} doeken={doeken} schrijven={schrijven} onZet={(t, pts) => onZet(t, pts && !it.velden?.binnen?.lokaal ? vanPunten(it, pts) : null, pts)} onSluit={() => setOpen(false)} />}
    </div>
  );
}
