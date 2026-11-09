'use client';

// In het zijpaneel van een tent: 3D-voorbeeld en de knop naar de tentbouwer.
import { useEffect, useMemo, useState } from 'react';
import { neemBouwer } from './bouwerSignaal';
import TentStudio, { TentDrie } from './TentStudio';
import { tentMaten, tentTelling, tentGroep } from './tentbouw';
import { Groot3D } from './drie3d';

const f2 = (v) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 2 });

export function TentBlok({ it, el, schrijven, onZet, onVloer, onActie, doeken = [], items = [], elementen = [], elementenMap = new Map() }) {
  const [open, setOpen] = useState(false); const [kijk, setKijk] = useState(false);
  // Net geplaatst via Bouwers: de tentbouwer meteen openen.
  useEffect(() => { if (neemBouwer(it.id)) setOpen(true); }, [it.id]);
  const m = tentMaten(it, el); const doekMap = useMemo(() => new Map(doeken.map((d) => [d.id, d])), [doeken]);
  const gebouwd = !!it.velden?.tent;
  // Tenten die op het plan tegen deze tent staan, horen er in 3D bij.
  // Enkel opnieuw rekenen als de tenten zelf veranderen (niet bij elk ander item in een groot plan).
  const tenten = useMemo(() => items.filter((x) => x.id === it.id || x.velden?.tent || (x.element_id && ['Tenten', 'Tenten en vloeren'].includes(elementenMap.get(x.element_id)?.categorie))), [items, it.id, elementenMap]);
  // Ook de tentvelden van de buren horen erbij: een banner over gekoppelde tenten verandert in een andere tent.
  const sleutel = tenten.map((x) => `${x.id}:${x.parameters?.midden?.join(',')}:${x.parameters?.rot}:${x.parameters?.breedte}:${x.parameters?.diepte}:${x.id === it.id ? '' : JSON.stringify(x.velden?.tent?.frames || null) + JSON.stringify(x.velden?.tent?.frameKoppel || null) + JSON.stringify(x.velden?.tent?.wanden || null)}`).join('|');
  const groep = useMemo(() => tentGroep(it, el, tenten, elementenMap), [it, el, sleutel, elementenMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const buren = groep.length - 1;
  // Voor het 3D-voorbeeld enkel de tenten en de deuren/ramen uit hun binnenplan (zo tekent het niet opnieuw bij elke wijziging elders).
  const ids = new Set(groep.map((g) => g.it.id));
  const binnen = items.filter((x) => x.velden?.binnen?.host && ids.has(x.velden.binnen.host));
  const sleutel2 = `${sleutel}#${binnen.map((x) => `${x.id}:${JSON.stringify(x.geometrie?.coordinates)}:${JSON.stringify(x.velden?.meubel || null)}`).join('|')}`;
  const items3d = useMemo(() => [...tenten, ...binnen], [sleutel2]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fm-truss-blok fm-sectie">
      <button type="button" className="fm-wand-mini" onClick={() => setOpen(true)} title="Tentbouwer openen"><TentDrie it={it} el={el} groep={groep} items={items3d} doekMap={doekMap} vloer={!!it.velden?.vloer} mini /></button>
      <button className="fm-knop zwart" onClick={() => setOpen(true)}>{schrijven ? (gebouwd ? 'Tent aanpassen in 3D' : 'Tent bouwen in 3D (wanden, dak, deuren)') : 'Tent bekijken'}</button>
      <button className="fm-knop" onClick={() => setKijk(true)}>⤢ In 3D bekijken</button>
      {kijk && <Groot3D it={it} el={el} schrijven={schrijven} items={items} elementenMap={new Map([...elementenMap, ...doekMap])} onSluit={() => setKijk(false)} />}
      <span className="fm-sub">{f2(m.B)} × {f2(m.L)} m · zijwand {f2(m.zijH)} m · nok {f2(m.nok)} m · {tentTelling(it, el).filter((x) => x.naam.startsWith('Wand')).reduce((a, x) => a + x.aantal, 0)} wandsegmenten{buren ? ` · gekoppeld aan ${buren} ${buren === 1 ? 'tent' : 'tenten'}` : ''}</span>
      {open && <TentStudio it={it} el={el} groep={groep} items={items} elementen={elementen} onVloer={onVloer} onActie={onActie} doeken={doeken} vloer={it.velden?.vloer ? elementenMap.get(it.velden.vloer) || true : false} schrijven={schrijven} onZet={(tent) => onZet(tent)} onSluit={() => setOpen(false)} />}
    </div>
  );
}
