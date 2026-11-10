'use client';

// Containerbouwer: units naast, achter en op elkaar, schakelunits en buitentrappen. Elke unit blijft een item op het plan.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import TerugKnop from './TerugKnop';
import { useBouwerSchild, schildProps } from './bouwerschild';
import { webglKan } from './StellingStudio';
import { StellingPlannen } from './stellingplannen';
import { unitGroep, unitAssen, isUnitEl, isTrapEl, schakelPlan, schakelElement, containerMeldingen, plekNaast, plekTrap, containerTelling, containerPrims, stapelMax } from './containerbouw';

const DrieGL = dynamic(() => import('./TentDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });
const getal = (v) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 2 });
const ZIJDEN = [['L', 'Links'], ['R', 'Rechts'], ['V', 'Voor'], ['A', 'Achter'], ['O', 'Erop']];

export default function ContainerStudio({ it, el, items = [], elementen = [], elementenMap = new Map(), schrijven, onActie, onSluit }) {
  useBouwerSchild();
  const [gl, setGl] = useState(false); useEffect(() => { setGl(webglKan()); }, []);
  const groep = useMemo(() => unitGroep(it, el, items, elementenMap), [it, el, items, elementenMap]);
  const [sel, setSel] = useState(it.id);
  const g = groep.find((x) => x.it.id === sel) || groep[0];
  const units = useMemo(() => elementen.filter((e) => e.actief !== false && !e.plan_id && isUnitEl(e)).sort((a, b) => String(a.leverancier || '').localeCompare(String(b.leverancier || ''), 'nl') || a.naam.localeCompare(b.naam, 'nl')), [elementen]);
  const trap = useMemo(() => elementen.find((e) => e.actief !== false && !e.plan_id && isTrapEl(e)), [elementen]);
  const [nieuw, setNieuw] = useState(el?.id || '');
  const elNieuw = units.find((e) => e.id === nieuw) || g?.el || units[0];
  const [trapZijde, setTrapZijde] = useState('V');
  const A = unitAssen(it);

  // Schakelunits: het juiste type (eind of midden) volgt uit de buren.
  const plan = useMemo(() => schakelPlan(groep), [groep]);
  useEffect(() => {
    if (!schrijven || !onActie) return;
    for (const p of plan) { const e2 = schakelElement(elementen, p.fam, p.rol); if (e2) onActie('unit-wijzig', { _it: p.id, el: e2.id }); }
  }, [JSON.stringify(plan)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Na het plaatsen: de nieuwe unit kiezen, zodat je meteen verder bouwt.
  const [wacht, setWacht] = useState(null);
  useEffect(() => { if (!wacht) return; const n = groep.find((o) => o.v === wacht.v && Math.abs(o.x0 - wacht.x0) < 0.05 && Math.abs(o.y0 - wacht.y0) < 0.05); if (n) { setSel(n.it.id); setWacht(null); } }, [groep, wacht]);
  const plaats = (e2, p) => {
    if (!A || !e2) return; if (!isTrapEl(e2)) setWacht(p);
    const midden = A.naarGeo([p.x0 + p.L / 2, p.y0 + p.B / 2]);
    onActie('unit-plaats', { el: e2.id, midden, breedte: Number(e2.breedte_m), diepte: Number(e2.diepte_m), rot: A.rot, verdieping: p.v });
  };
  const vrij = (p) => !groep.some((o) => o.v === p.v && Math.min(o.x1, p.x0 + p.L) - Math.max(o.x0, p.x0) > 0.1 && Math.min(o.y1, p.y0 + p.B) - Math.max(o.y0, p.y0) > 0.1);
  const meldingen = useMemo(() => containerMeldingen(groep), [groep]);
  const telling = useMemo(() => containerTelling(groep), [groep]);
  const prims = useMemo(() => (gl ? containerPrims(groep, g?.it.id) : null), [gl, groep, g?.it.id]);
  const kw = telling.reduce((a, r) => a + r.kw, 0);
  const hoog = Math.max(0, ...groep.map((x) => x.v)) + 1;
  const bovenste = g && !g.trap && g.v > 0;

  const maakPdf = async () => {
    const [{ bouwerPdf }, { tentGroep }] = await Promise.all([import('./bouwerPdf'), import('./TentDrieGL')]);
    const pr = containerPrims(groep, null);
    await bouwerPdf({ soort: 'container', titel: String(it.naam || el?.naam || 'Units'), sub: [...new Set(groep.map((x) => x.el?.leverancier).filter(Boolean))].join(' · '), maakGroep: (T) => tentGroep(T, pr),
      hoogtes: [...new Set(groep.filter((x) => !x.trap).map((x) => Math.round((x.z0 + x.H) * 100) / 100))],
      kenmerken: [['Units', groep.filter((x) => !x.trap).length], ['Trappen', groep.filter((x) => x.trap).length], ['Hoog', hoog], ['Stroom', `± ${getal(kw)} kW`]] });
  };

  return createPortal(
    <div className="fm fm-ws" role="dialog" aria-label="Containerbouwer" {...schildProps}>
      <div className="fm-ws-kop">
        <TerugKnop onClick={onSluit} />
        <strong>Containerbouwer</strong>
        <span className="fm-sub">{groep.filter((x) => !x.trap).length === 1 ? '1 unit' : `${groep.filter((x) => !x.trap).length} units`} · {hoog} hoog · ± {getal(kw)} kW</span>
        <span style={{ flex: 1 }} />
        <button className="fm-knop klein" disabled={!gl} onClick={maakPdf}>PDF</button>
      </div>
      <div className="fm-ws-lijf">
        <aside className="fm-ws-doeken fm-cb-links">
          <div className="fm-kop">Gekozen</div>
          {g && <div className="fm-cb-gekozen"><b>{g.el?.naam}</b><span className="fm-sub">{g.trap ? 'Trap' : `Verdieping ${g.v}`}{g.el?.leverancier ? ` · ${g.el.leverancier}` : ''}</span></div>}
          {schrijven && g && !g.trap && <>
            <div className="fm-kop">Unit erbij</div>
            <label className="fm-veld"><select value={elNieuw?.id || ''} onChange={(e) => setNieuw(e.target.value)} aria-label="Welke unit">
              {[...new Set(units.map((e) => e.leverancier || ''))].map((lev) => <optgroup key={lev} label={lev || 'Zonder leverancier'}>{units.filter((e) => (e.leverancier || '') === lev).map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}</optgroup>)}
            </select></label>
            <div className="fm-cb-zijden">
              {ZIJDEN.map(([z, n]) => { const p = elNieuw && plekNaast(g, elNieuw, z); const te = z === 'O' && g.v + 2 > stapelMax(g.el); return <button key={z} type="button" className="fm-knop klein" disabled={!p || !vrij(p) || te} onClick={() => plaats(elNieuw, p)}>{n}</button>; })}
            </div>
          </>}
          {schrijven && bovenste && trap && <>
            <div className="fm-kop">Trap</div>
            <div className="fm-segment fm-tb-vol" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>{[['V', 'Voor'], ['A', 'Achter']].map(([z, n]) => <button key={z} type="button" className={trapZijde === z ? 'aan' : ''} onClick={() => setTrapZijde(z)}>{n}</button>)}</div>
            <div className="fm-cb-zijden" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {[['L', 'Links'], ['R', 'Rechts']].map(([k, n]) => { const p = plekTrap(g, trap, trapZijde, k); return <button key={k} type="button" className="fm-knop klein" disabled={!vrij(p)} onClick={() => plaats(trap, p)}>{n}</button>; })}
            </div>
          </>}
          {schrijven && g && <>
            <div className="fm-kop">Unit</div>
            <div className="fm-cb-zijden" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <button type="button" className="fm-knop klein" title="Deur en ramen aan de andere kant" onClick={() => onActie('unit-wijzig', { _it: g.it.id, rot: ((Number(g.it.parameters?.rot) || 0) + 180) % 360 })}>Draaien</button>
              <button type="button" className="fm-knop klein" disabled={g.it.id === it.id} onClick={() => { onActie('unit-weg', { _it: g.it.id }); setSel(it.id); }}>Weghalen</button>
            </div>
          </>}
        </aside>
        <div className="fm-ws-zicht">
          {prims ? <DrieGL prims={prims} kies={(d) => { if (d?.unit) setSel(d.unit); }} /> : <div className="fm-sub" style={{ padding: 20 }}>3D is niet beschikbaar in deze browser.</div>}
        </div>
        <aside className="fm-ws-rechts">
          <div className="fm-kop">Nakijken</div>
          {meldingen.length ? meldingen.map((m, k) => <button key={k} type="button" className={`fm-melding ${m.soort === 'fout' ? 'fout' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer', width: '100%', marginBottom: 6 }} onClick={() => setSel(m.ids[0])}>{m.tekst}</button>) : <div className="fm-melding ok">In orde.</div>}
          <div className="fm-kop" style={{ marginTop: 10 }}>Stuklijst</div>
          {telling.map((r) => <div key={r.naam} className="fm-tr-feit" title={r.naam}><span>{(/\(([^)]*[A-Z]{2,}[^)]*\d[^)]*)\)\s*$/.exec(r.naam) || [])[1] || r.naam}</span><b>{r.aantal}</b></div>)}
          {kw > 0 && <div className="fm-tr-feit"><span>Stroom</span><b>± {getal(kw)} kW · {telling.reduce((a, r) => a + r.aans, 0)} aansluitingen</b></div>}
          <div className="fm-kop" style={{ marginTop: 10 }}>Plannen van de leverancier</div>
          <StellingPlannen planId={it.plan_id} itemId={it.id} schrijven={schrijven} compact soort="containerplan" wie="unitleverancier" />
        </aside>
      </div>
    </div>,
    document.body,
  );
}

// In het zijpaneel van een unit: de knop naar de containerbouwer (opent meteen als de unit net via Bouwers geplaatst is).
export function ContainerBlok({ it, el, items, elementen, elementenMap, schrijven, onActie }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { import('./bouwerSignaal').then(({ neemBouwer }) => { if (neemBouwer(it.id)) setOpen(true); }); }, [it.id]);
  const groep = useMemo(() => unitGroep(it, el, items, elementenMap), [it, el, items, elementenMap]);
  const n = groep.filter((x) => !x.trap).length;
  return (
    <div className="fm-truss-blok fm-sectie">
      <button className="fm-knop zwart" onClick={() => setOpen(true)}>{schrijven ? 'Containerbouwer' : 'Opstelling bekijken'}</button>
      <span className="fm-sub">{n} {n === 1 ? 'unit' : 'units'} · {Math.max(0, ...groep.map((x) => x.v)) + 1} hoog</span>
      {open && <ContainerStudio it={it} el={el} items={items} elementen={elementen} elementenMap={elementenMap} schrijven={schrijven} onActie={onActie} onSluit={() => setOpen(false)} />}
    </div>
  );
}
