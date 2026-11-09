'use client';

// Kleine voorbeelden van de ontwerpen op een drager (frame, totem, truss, pipe & drape),
// voor de zweefballon en de infokaart.
import { useState } from 'react';
import { publiekeUrl } from './db';
import { FotoGroot } from './fotos';
import { isFrame, isDrape, isTotem, trussDoek, zijdenVan, totemPanelen } from './stijl';
import { isWand, wandFrames, lengtesVanItem } from './framewand';

export function ontwerpenVan(it, el, elementenMap) {
  if (!it || !el) return [];
  if (isWand(el)) {
    // Frame-wand: elk verschillend ontwerp één keer, met de frames waar het op staat.
    const per = new Map();
    for (const f of wandFrames(lengtesVanItem(it) || [], it, el)) for (const [id, kant] of [[f.voor, 'V'], [f.achter, 'A']]) { if (!id) continue; const x = per.get(id) || []; x.push(`${f.i + 1}${kant}`); per.set(id, x); }
    return [...per].map(([id, waar]) => ({ id, zijde: waar.length > 3 ? `${waar.length}×` : waar.join(' '), el: elementenMap.get(id) })).filter((x) => x.el);
  }
  if (isFrame(el) || isTotem(el) || trussDoek(el)) {
    const z = zijdenVan(el);
    return totemPanelen(it, el).map((id, k) => ({ id, zijde: z[k]?.replace(/ \(.*\)$/, ''), el: id ? elementenMap.get(id) : null })).filter((x) => x.el);
  }
  if (isDrape(el)) return (it.velden?.doeken || []).map((id, k) => ({ id, zijde: `${k + 1}`, el: id ? elementenMap.get(id) : null })).filter((x) => x.el);
  return [];
}

// groot: in de infokaart, beelden zo breed als de kaart toelaat en klikbaar voor een grote weergave.
export default function OntwerpDuimen({ it, el, elementenMap, hoogte = 64, zijNamen = null, max = 4, groot = false, tekst = {} }) {
  const [open, setOpen] = useState(null);
  const l = ontwerpenVan(it, el, elementenMap);
  if (!l.length) return null;
  const staand = isFrame(el) || isTotem(el) || isWand(el);
  const zij = (x) => (zijNamen && zijNamen[x.zijde]) || x.zijde;
  const toon = l.slice(0, max);
  const beelden = toon.map((x) => ({ id: x.id, pad: x.el.eigenschappen?.beeld || x.el.eigenschappen?.bestand || '', titel: [zij(x), x.el.naam].filter(Boolean).join(' · ') }));
  return (
    <div className={`fm-duimen${groot ? ' groot' : ''}${groot && staand ? ' staand' : ''}`}>
      {toon.map((x, k) => {
        const src = x.el.eigenschappen?.beeld ? publiekeUrl(x.el.eigenschappen.beeld) : null;
        const stijl = groot ? { background: x.el.eigenschappen?.kleur || '#64748B', aspectRatio: staand ? '1 / 2' : '7 / 5' } : { height: hoogte, width: staand ? hoogte / 2 : hoogte * 1.4, background: x.el.eigenschappen?.kleur || '#64748B' };
        const beeld = <span className="fm-duim-beeld" style={stijl}>{src && <img src={src} alt="" />}</span>;
        return (
          <figure key={`${x.id}${k}`} className="fm-duim">
            {groot && src ? <button type="button" className="fm-duim-knop" aria-label={`${zij(x)} groot tonen`} onClick={() => setOpen(k)}>{beeld}</button> : beeld}
            <figcaption>{zij(x)}</figcaption>
            {groot && <span className="fm-duim-naam" title={x.el.naam}>{x.el.naam}</span>}
          </figure>
        );
      })}
      {l.length > max && <span className="fm-duim-meer">+{l.length - max}</span>}
      {open != null && beelden[open]?.pad && <FotoGroot lijst={beelden} i={open} setI={setOpen} tekst={tekst} />}
    </div>
  );
}
