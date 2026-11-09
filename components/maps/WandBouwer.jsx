'use client';

// Bouwer voor een B-matrix frame-wand: hoogte, plint, per zijde de frames (breedtes) en per
// frame een doek op de voor- en achterkant. Werkt buiten (eigenschappen) en binnen (binnenplan).
import { useState } from 'react';
import { wandInst, wandFrames, wandTelling, wandTotaalHoogte, wandLengte, frameSleutel, mm, autoVul, lengtesVanItem } from './framewand';
import WandStudio, { WandZicht, vanPunten } from './WandStudio';
import { Groot3D, heeft3d } from './drie3d';
import { useEffect } from 'react';
import { neemBouwer } from './bouwerSignaal';

const getal = (v, d = 2) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: d });

// Compact in het zijpaneel: een 3D-voorbeeld van de wand en de knop naar de wandbouwer.
export default function WandBouwer({ it, el, lengtes, doeken = [], schrijven, onZet, totaalTelling = null, elementenMap = new Map() }) {
  const [open, setOpen] = useState(false); const [kijk, setKijk] = useState(false);
  useEffect(() => { if (neemBouwer(it.id)) setOpen(true); }, [it.id]);
  const I = wandInst(el);
  const frames = wandFrames(lengtes, it, el); const totH = wandTotaalHoogte(lengtes, it, el); const lengte = wandLengte(frames);
  const telling = wandTelling(lengtes, it, el); const voorraad = totaalTelling || telling;
  const sleutels = [...new Set([...Object.keys(I.voorraad), ...Object.keys(voorraad)])].sort();
  const metDoek = frames.filter((f) => f.voor || f.achter).length;
  // Doeken die niet in de lijst staan (bv. van een ander event) toch kunnen tonen.
  const em = new Map(elementenMap); for (const d of doeken) em.set(d.id, d);
  return (
    <div className="fm-wand">
      <button type="button" className="fm-wand-mini" onClick={() => setOpen(true)} title="Wandbouwer openen">
        <WandZicht it={it} el={el} elementenMap={em} mini />
      </button>
      <div className="fm-sub">{frames.length} frames · {getal(lengte)} m · {mm(totH)} mm hoog · {metDoek ? `${metDoek} met doek` : 'nog geen doeken'}</div>
      <button className="fm-knop zwart" onClick={() => setOpen(true)}>{schrijven ? 'Wand bouwen en branden' : 'Wand bekijken'}</button>
      {heeft3d(it, el) && <button className="fm-knop" onClick={() => setKijk(true)}>⤢ In 3D bekijken</button>}
      {kijk && <Groot3D it={it} el={el} elementenMap={em} onSluit={() => setKijk(false)} />}
      {sleutels.length > 0 && (
        <div className="fm-wand-voorraad">
          {sleutels.map((k) => {
            const [b, hh] = k.split('x').map(Number); const n = voorraad[k] || 0; const max = I.voorraad[k];
            return <span key={k} className={`fm-wand-chip${max != null && n > max ? ' te' : ''}${!n ? ' leeg' : ''}`} title={max != null ? `${n} nodig${totaalTelling ? ' in dit plan' : ''}, ${max} in voorraad` : `${n} nodig`}>{mm(b)}×{mm(hh)} <b>{n}{max != null ? `/${max}` : ''}</b></span>;
          })}
        </div>
      )}
      {open && <WandStudio it={it} el={el} elementenMap={em} doeken={doeken} schrijven={schrijven} onZet={(w2, pts) => onZet(w2, pts && !it.velden?.binnen?.lokaal ? vanPunten(it, pts) : null, pts)} onSluit={() => setOpen(false)} totaalTelling={totaalTelling} />}
    </div>
  );
}

// Snel: hoeveel frames per maat in alle wanden samen.
export function telAlleWanden(items, elementenMap, lengtesVan = lengtesVanItem) {
  const t = {};
  for (const it of items) {
    const el = it.element_id ? elementenMap.get(it.element_id) : null;
    if (!el?.eigenschappen?.wand) continue;
    const L = lengtesVan(it); if (!L?.length) continue;
    for (const [s, n] of Object.entries(wandTelling(L, it, el))) t[s] = (t[s] || 0) + n;
  }
  return t;
}
export { autoVul, frameSleutel };
