'use client';

// Zweefkaartje boven een item (bewerkmodus): naam, maat, laag, stroom, attest.
import * as geo from './geo';
import { maten, toebehorenTelling, toebehorenVan, toebehorenNaam } from './stijl';
import { stroomVan } from './stroom';
import { isSign, instSign } from './signalisatie';
import { BordVoorbeeld } from './bord';
import { attestStatus } from './attesten';
import { heeft3d, Mini3D } from './drie3d';
import { tvCamTekst } from './tvcamera';

export default function ZweefKaartje({ zweef, items, elementenMap, lagenMap, plan }) {
  const zi = items.find((x) => x.id === zweef.id);
  if (!zi) return null;
  const el = zi.element_id ? elementenMap.get(zi.element_id) : null;
  const lg = lagenMap.get(zi.laag_id);
  const p = zi.parameters || {};
  const r1 = (v) => (Math.round(v * 10) / 10).toLocaleString('nl-BE');
  let maat = '';
  if (p.breedte && p.diepte) maat = `${r1(p.breedte)} × ${r1(p.diepte)} m`;
  else if (zi.geometrie?.type === 'LineString') maat = `${r1(geo.lengte(zi.geometrie))} m`;
  else if (zi.geometrie?.type === 'Polygon') maat = `${Math.round(geo.oppervlakte(zi.geometrie)).toLocaleString('nl-BE')} m²`;
  const sv = stroomVan(zi, el);
  const mt = maten(zi, el);
  if (mt.stuks != null) maat = `${maat ? `${maat} · ` : ''}${mt.stuks} ${mt.stuks === 1 ? 'stuk' : 'stuks'}${mt.raster ? ` (${mt.raster})` : ''}`;
  const tbt = toebehorenTelling(zi, el);
  if (el?.eigenschappen?.doek && el.eigenschappen.doek !== 'geen') maat = `${maat} · doek ${zi.velden?.doek_naam || el.eigenschappen.doek}${zi.velden?.doek_kant ? ` (${zi.velden.doek_kant})` : ''}`;
  if (tbt) maat = `${maat}${Object.entries(tbt).map(([k, n]) => ` · ${n} ${toebehorenNaam(el, k).toLowerCase()}`).join('')}`;
  const extra = [maat, mt.capaciteit ? `± ${mt.capaciteit.toLocaleString('nl-BE')} pers.` : '', p.rot ? `${Math.round(p.rot)}°` : '', sv?.rol === 'verbruiker' && sv.kw ? `${sv.kw} kW` : '', zi.vergrendeld ? 'vergrendeld' : ''].filter(Boolean).join(' · ');
  return (
    <div className="fm-zweef" style={{ left: zweef.x + 14, top: zweef.y + 14, ...(heeft3d(zi, el) ? { maxWidth: 266 } : {}) }}>
      <strong>{isSign(zi) ? `Punt ${zi.velden.sign.nr}${zi.velden.sign.straat ? ` · ${zi.velden.sign.straat}` : ''}` : zi.naam || el?.naam || 'Zonder naam'}</strong>
      {isSign(zi) && (zi.velden.sign.rijen || []).length > 0 && (() => { const ins = instSign(plan); return <BordVoorbeeld rijen={zi.velden.sign.rijen} bestMap={new Map(ins.bestemmingen.map((x) => [x.id, x]))} inst={ins} breedte={ins.bord === 'staand' ? 110 : 186} />; })()}
      {isSign(zi) && !(zi.velden.sign.rijen || []).length && <span>Nog geen panelen</span>}
      {zi.velden?.functie && <span className="functie">{zi.velden.functie}</span>}
      {tvCamTekst(zi, el) && <span className="functie">{tvCamTekst(zi, el)}</span>}
      {el && zi.naam && zi.naam !== el.naam && <span>{el.naam}</span>}
      {extra && <span>{extra}</span>}
      {lg && <span className="laag"><i style={{ background: lg.kleur || '#686D76' }} />{lg.naam}</span>}
      {heeft3d(zi, el) && <div className="fm-zweef-3d"><Mini3D it={zi} el={el} elementenMap={elementenMap} /></div>}
      {zi.velden?.attesten?.length > 0 && (() => { const st0 = zi.velden.attesten.map((a) => attestStatus(a)).sort((a, b) => ['vervallen', 'bijna', 'onbekend', 'geldig'].indexOf(a.code) - ['vervallen', 'bijna', 'onbekend', 'geldig'].indexOf(b.code))[0]; return <span>Attest: {st0.code === 'geldig' ? 'in orde' : st0.code === 'bijna' ? 'bijna vervallen' : st0.code === 'vervallen' ? 'vervallen' : 'geen datum'}</span>; })()}
    </div>
  );
}
