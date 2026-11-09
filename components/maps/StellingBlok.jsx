'use client';

// In het zijpaneel van een stellinglijn: 3D-voorbeeld en de knop naar de stellingbouwer.
import { useEffect, useMemo, useState } from 'react';
import StellingStudio, { StellingDrie } from './StellingStudio';
import { isStellingBouw, stellingDoorgangen, functieNaam } from './stellingbouw';
import { stellingStuklijst as stellingTelling } from './stelling/scene';
import { neemBouwer } from './bouwerSignaal';
import { Groot3D } from './drie3d';
import { StellingPlannen } from './stellingplannen';

const f2 = (v) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 2 });
// Vrije breedte × hoogte per doorgang (voor de brandweer), niet permanent op het plan maar hier en in de deellink.
export function DoorgangLijst({ st, titel = 'Doorgangen (vrije breedte × hoogte)' }) {
  const l = stellingDoorgangen(st); if (!l.length) return null;
  return (
    <div className="fm-dglijst">
      <div className="fm-kop">{titel}</div>
      {l.map((d) => <div key={d.nr} className={d.fout ? 'fout' : ''}>Doorgang {d.nr}{d.functie ? ` · ${functieNaam(d.functie)}` : ''}: <strong>{f2(d.B)} × {f2(d.H)} m</strong>{d.fout ? ` · ${d.fout}` : ''}</div>)}
    </div>
  );
}

export function StellingBlok({ it, el, schrijven, onZet, doeken = [] }) {
  const doekMap = useMemo(() => new Map(doeken.map((d) => [d.id, d])), [doeken]);
  const [open, setOpen] = useState(false); const [kijk, setKijk] = useState(false);
  useEffect(() => { if (neemBouwer(it.id)) setOpen(true); }, [it.id]);
  const gebouwd = isStellingBouw(it);
  const n = gebouwd ? Object.keys(it.velden.stelling.vakken).length : 0;
  return (
    <div className="fm-truss-blok fm-sectie">
      {gebouwd && <button type="button" className="fm-wand-mini" onClick={() => setOpen(true)} title="Stellingbouwer openen"><StellingDrie st={it.velden.stelling} doekMap={doekMap} mini /></button>}
      <button className="fm-knop zwart" onClick={() => setOpen(true)}>{gebouwd ? (schrijven ? 'Stelling bouwen' : 'Stelling bekijken') : 'Stelling bouwen in 3D (brug, podium, tribune)'}</button>
      {gebouwd && <button className="fm-knop" onClick={() => setKijk(true)}>⤢ In 3D bekijken</button>}
      {kijk && <Groot3D it={it} el={el} schrijven={schrijven} elementenMap={new Map(doeken.map((d) => [d.id, d]))} onSluit={() => setKijk(false)} />}
      {gebouwd && <DoorgangLijst st={it.velden.stelling} />}
      {gebouwd && it.id && <StellingPlannen planId={it.plan_id} itemId={it.id} schrijven={schrijven} />}
      {gebouwd && <span className="fm-sub">{n} vakken · {stellingTelling(it.velden.stelling).reduce((a, x) => a + x.aantal, 0)} onderdelen. De getekende lijn is het ankerpunt.</span>}
      {open && <StellingStudio it={it} el={el} doeken={doeken} schrijven={schrijven} onZet={(stelling, extra) => onZet(stelling, extra)} onSluit={() => setOpen(false)} />}
    </div>
  );
}
