'use client';

// In het zijpaneel van een truss-lijn: voorbeeld en de knop naar de trussbouwer.
import { useEffect, useMemo, useState } from 'react';
import TrussStudio, { TrussZicht, doekVlak, zetTrussType } from './TrussStudio';
import TrussTeken from './TrussTeken';
import { vanPunten } from './WandStudio';
import { isTrussBouw, trussTypeVoor } from './trussbouw';
import { isRaster, rasterUitOud, ruimOp } from './trussraster';
import { Groot3D } from './drie3d';
import { neemBouwer } from './bouwerSignaal';

// Een truss uit de oude bouwer (losse stukken) omzetten naar lijnen, met zijn doeken. null = lukt niet.
function omzetten(it, el) {
  const t = it.velden?.truss; if (!t?.stukken?.length) return null;
  try {
    const T = trussTypeVoor(el, t); zetTrussType(T); const r = rasterUitOud(t.stukken, T.B); if (!r) return null;
    const lokaal = t.stukken.map((s) => ({ id: s.id, L: Number(s.L), a: [s.p?.[0] || 0, s.p?.[1] || 0, Number(s.z) || 0], r: ((Number(s.r) || 0) * Math.PI) / 180, op: !!s.op }));
    const dichtst = (P, v) => { let b = 0; for (let n = 1; n < P.length; n++) if (Math.abs(P[n] - v) < Math.abs(P[b] - v)) b = n; return b; };
    const dl = [];
    for (const d of t.doeken || []) {
      const V = doekVlak(d, lokaal); if (!V) continue; const as = Math.abs(V.u[0]) > 0.7 ? 'x' : 'y'; const c = as === 'x' ? 0 : 1; const p0 = V.o[c] + V.u[c] * V.s0; const p1 = V.o[c] + V.u[c] * V.s1;
      const vak = { as, vast: dichtst(r.assen[as === 'x' ? 'y' : 'x'], V.o[1 - c]), i0: dichtst(r.assen[as], Math.min(p0, p1)), i1: dichtst(r.assen[as], Math.max(p0, p1)), k: dichtst(r.assen.z, V.z1) };
      if (vak.i1 > vak.i0) dl.push({ id: d.id, vak, wijze: d.wijze === 'op' ? 'op' : 'in', zijde: d.zijde, voor: d.voor || null, achter: d.achter || null, plaatsing: d.plaatsing, start: d.start });
    }
    const klaar = ruimOp(r.R, dl, T.B); return { R: klaar.R, doeken: klaar.doeken, omgezet: true };
  } catch { return null; }
}

// onZet(truss, geometrie|null, lokaal-punten): de ankerlijn verhuist mee onder de truss.
export function TrussBlok({ it, el, schrijven, onZet, doeken = [] }) {
  const [open, setOpen] = useState(false); const [kijk, setKijk] = useState(false);
  useEffect(() => { if (neemBouwer(it.id)) setOpen(true); }, [it.id]);
  const gebouwd = isTrussBouw(it); const lijnen = isRaster(it.velden?.truss);
  // Oude truss: omzetten bij het openen (pas bewaard bij de eerste wijziging). Lukt dat niet, dan de oude bouwer.
  const start = useMemo(() => (open && gebouwd && !lijnen ? omzetten(it, el) : null), [open, it.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const zet = (t, pts) => onZet(t, pts && !it.velden?.binnen?.lokaal ? vanPunten(it, pts) : null, pts);
  return (
    <div className="fm-truss-blok fm-sectie">
      {gebouwd && <button type="button" className="fm-wand-mini" onClick={() => setOpen(true)} title="Trussbouwer openen"><TrussZicht it={it} el={el} doeken={doeken} /></button>}
      <button className="fm-knop zwart" onClick={() => setOpen(true)}>{gebouwd ? (schrijven ? 'Truss bouwen' : 'Truss bekijken') : 'Truss bouwen in 3D (frames, portalen)'}</button>
      {gebouwd && <button className="fm-knop" onClick={() => setKijk(true)}>⤢ In 3D bekijken</button>}
      {kijk && <Groot3D it={it} el={el} elementenMap={new Map(doeken.map((d) => [d.id, d]))} onSluit={() => setKijk(false)} />}
      {gebouwd && <span className="fm-sub">{it.velden.truss.stukken.length} stukken: de getekende lijn is enkel nog het ankerpunt.</span>}
      {open && (lijnen || !gebouwd || start
        ? <TrussTeken it={it} el={el} doeken={doeken} schrijven={schrijven} start={start} onZet={zet} onSluit={() => setOpen(false)} />
        : <TrussStudio it={it} el={el} doeken={doeken} schrijven={schrijven} onZet={zet} onSluit={() => setOpen(false)} />)}
    </div>
  );
}
