'use client';

// Containerbouwer: units naast, achter en op elkaar, schakelunits en buitentrappen. Elke unit blijft een item op het plan.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import TerugKnop from './TerugKnop';
import { useBouwerSchild, schildProps } from './bouwerschild';
import { webglKan } from './StellingStudio';
import { StellingPlannen } from './stellingplannen';
import GevelBeheer from './GevelBeheer';
import { schakelGedraaid } from './containerbouw';
import { unitGroep, unitAssen, isUnitEl, isTrapEl, schakelPlan, schakelElement, containerMeldingen, plekNaast, plekTrap, containerTelling, containerPrims, stapelMax, plekBijSlepen, unitStijl, openZijden, schakelVan, gevelLijn } from './containerbouw';

const DrieGL = dynamic(() => import('./TentDrieGL'), { ssr: false, loading: () => <div className="fm-wz fm-sub" style={{ display: 'grid', placeItems: 'center' }}>3D laden…</div> });
const getal = (v) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 2 });
const ZIJDEN = [['L', 'Links'], ['R', 'Rechts'], ['V', 'Voor'], ['A', 'Achter'], ['O', 'Erop']];

// Bovenaanzicht van een unit voor de lijst: kader in de kleur van de leverancier, open zijden gestippeld, deuren en ramen.
export function UnitDuim({ el, w = 76, h = 52 }) {
  const L = Number(el?.breedte_m) || 3; const B = Number(el?.diepte_m) || 6; const st = unitStijl(el);
  const s = Math.min((w - 8) / L, (h - 8) / B); const ox = (w - L * s) / 2; const oy = (h - B * s) / 2;
  const X = (x) => ox + x * s; const Y = (y) => oy + (B - y) * s;
  if (isTrapEl(el)) {
    const n = 9; return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <rect x={X(0)} y={Y(B)} width={L * s} height={B * s} fill="#E5E7EB" stroke="#9CA3AF" />
        {Array.from({ length: n }, (_, k) => <line key={k} x1={X((L * 0.75 * (k + 1)) / (n + 1))} y1={Y(B)} x2={X((L * 0.75 * (k + 1)) / (n + 1))} y2={Y(0)} stroke="#9CA3AF" />)}
        <rect x={X(L * 0.75)} y={Y(B)} width={L * 0.25 * s} height={B * s} fill="#D1D5DB" stroke="#9CA3AF" />
      </svg>
    );
  }
  const open = new Set(openZijden(schakelVan(el)?.rol));
  const zij = { V: [[0, 0], [L, 0]], R: [[L, 0], [L, B]], A: [[L, B], [0, B]], L: [[0, B], [0, 0]] };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect x={X(0)} y={Y(B)} width={L * s} height={B * s} fill={st.paneel} />
      {Object.entries(zij).map(([z, [p, q]]) => <line key={z} x1={X(p[0])} y1={Y(p[1])} x2={X(q[0])} y2={Y(q[1])} stroke={st.kader} strokeWidth={open.has(z) ? 1.2 : 2.6} strokeDasharray={open.has(z) ? '3 2' : undefined} />)}
      {(el?.eigenschappen?.gevel || []).map((o, k) => { const { a, e } = gevelLijn(o, L, B); const raam = o.soort === 'raam'; return <line key={k} x1={X(a[0])} y1={Y(a[1])} x2={X(e[0])} y2={Y(e[1])} stroke={raam ? '#60A5FA' : '#B45309'} strokeWidth={raam ? 3 : 4} />; })}
    </svg>
  );
}
const kortNaam = (e) => { const c = /\(([^)]*\d[^)]*)\)\s*$/.exec(e?.naam || ''); return c ? c[1].replace(/^Warsco /, '') : e?.naam; };
const maatTekst = (e) => `${getal(Number(e.breedte_m) < Number(e.diepte_m) ? e.diepte_m : e.breedte_m)} × ${getal(Math.min(Number(e.breedte_m), Number(e.diepte_m)))} m`;

export default function ContainerStudio({ it, el, items = [], elementen = [], elementenMap = new Map(), schrijven, onActie, onSluit }) {
  useBouwerSchild();
  const [gl, setGl] = useState(false); useEffect(() => { setGl(webglKan()); }, []);
  const groep = useMemo(() => unitGroep(it, el, items, elementenMap), [it, el, items, elementenMap]);
  const [sel, setSel] = useState(it.id);
  const g = groep.find((x) => x.it.id === sel) || groep[0];
  const units = useMemo(() => elementen.filter((e) => e.actief !== false && !e.plan_id && (isUnitEl(e) || isTrapEl(e))).sort((a, b) => String(a.leverancier || '').localeCompare(String(b.leverancier || ''), 'nl') || Number(isTrapEl(a)) - Number(isTrapEl(b)) || a.naam.localeCompare(b.naam, 'nl')), [elementen]);
  const [nieuw, setNieuw] = useState(el?.id || '');
  const elNieuw = units.find((e) => e.id === nieuw) || null;
  const A = unitAssen(it);

  // Schakelunits: het juiste type (eind of midden) volgt uit de buren.
  const plan = useMemo(() => schakelPlan(groep), [groep]);
  useEffect(() => {
    if (!schrijven || !onActie) return;
    for (const p of plan) {
      const e2 = schakelElement(elementen, p.fam, p.rol); if (e2) { onActie('unit-wijzig', { _it: p.id, el: e2.id }); continue; }
      // Geen eigen type voor die kant: dezelfde eindunit, een halve draai.
      const e3 = schakelGedraaid(elementen, p.fam, p.rol); const o = groep.find((x) => x.it.id === p.id);
      if (e3 && o) onActie('unit-wijzig', { _it: p.id, el: e3.id, rot: ((Number(o.it.parameters?.rot) || 0) + 180) % 360 });
    }
  }, [JSON.stringify(plan)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Na het plaatsen: de nieuwe unit kiezen, zodat je meteen verder bouwt.
  const [wacht, setWacht] = useState(null);
  useEffect(() => { if (!wacht) return; const n = groep.find((o) => o.v === wacht.v && Math.abs(o.x0 - wacht.x0) < 0.05 && Math.abs(o.y0 - wacht.y0) < 0.05); if (n) { setSel(n.it.id); setWacht(null); } }, [groep, wacht]);
  const midden = (p) => A.naarGeo([p.x0 + p.L / 2, p.y0 + p.B / 2]);
  const plaats = (e2, p, q = 0) => {
    if (!A || !e2 || !p) return; if (!isTrapEl(e2)) setWacht(p);
    onActie('unit-plaats', { el: e2.id, midden: midden(p), breedte: Number(e2.breedte_m), diepte: Number(e2.diepte_m), rot: (A.rot + q) % 360, verdieping: p.v });
  };
  const vrij = (p) => !groep.some((o) => o.v === p.v && Math.min(o.x1, p.x0 + p.L) - Math.max(o.x0, p.x0) > 0.1 && Math.min(o.y1, p.y0 + p.B) - Math.max(o.y0, p.y0) > 0.1);

  // Slepen in 3D: een unit verplaatsen, of een unit uit de lijst erin slepen. R = draaien tijdens het slepen.
  const [sleep, setSleep] = useState(null); // { id?, el, q, p }
  const sleepRef = useRef(null); sleepRef.current = sleep;
  const lijstSleep = useRef(null); // element dat uit de lijst gesleept wordt
  const alleen = groep.filter((x) => !x.trap).length <= 1;
  const met = (s0, grond, hit) => { const p = plekBijSlepen(groep, s0.el, s0.q, grond, hit, s0.id); if (p && p.soort === 'vrij' && !(alleen && s0.id)) p.ok = false; return { ...s0, q: p?.q ?? s0.q, p, grond, hit }; };
  // Weghalen, ook de unit waarop de bouwer geopend werd: de bouwer verhuist dan naar een andere unit; de laatste unit sluit de bouwer.
  const weg = (o) => {
    if (o.it.id !== it.id) { onActie('unit-weg', { _it: o.it.id }); setSel(it.id); return; }
    const ander = groep.find((x) => x.it.id !== it.id && !x.trap) || groep.find((x) => x.it.id !== it.id);
    if (!ander) { onSluit(); setTimeout(() => onActie('unit-weg', { _it: o.it.id }), 0); return; }
    onActie('unit-weg', { _it: o.it.id, anker: ander.it.id });
  };
  const sleepVrij = schrijven ? (fase, data, grond, hit) => {
    const o = groep.find((x) => x.it.id === data?.unit); if (!o) return;
    const s0 = sleepRef.current?.id === o.it.id ? sleepRef.current : { id: o.it.id, el: o.el, q: o.rot };
    const s1 = met(s0, grond, hit);
    if (fase === 'beweeg') { setSleep(s1); return; }
    setSleep(null); setSel(o.it.id);
    if (s1.p?.ok) onActie('unit-wijzig', { _it: o.it.id, midden: midden(s1.p), rot: (A.rot + s1.q) % 360, verdieping: s1.p.v });
  } : null;
  const dropVrij = schrijven ? (fase, grond, hit) => {
    const e2 = lijstSleep.current; if (!e2) return;
    if (fase === 'weg') { setSleep(null); return; }
    const s1 = met(sleepRef.current && !sleepRef.current.id ? sleepRef.current : { el: e2, q: 0 }, grond, hit);
    if (fase === 'over') { setSleep(s1); return; }
    setSleep(null); lijstSleep.current = null;
    if (s1.p?.ok) plaats(e2, s1.p, s1.q);
  } : null;
  useEffect(() => {
    const h = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      if ((e.key === 'r' || e.key === 'R') && schrijven) {
        e.preventDefault();
        const s0 = sleepRef.current; if (s0) { setSleep(met({ ...s0, q: (s0.q + 90) % 360 }, s0.grond, s0.hit)); return; }
        if (g) onActie('unit-wijzig', { _it: g.it.id, rot: ((Number(g.it.parameters?.rot) || 0) + 90) % 360 });
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && schrijven && g) { e.preventDefault(); weg(g); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  // De opstelling als één geheel op het plan: alle aaneengesloten units in dezelfde groep.
  const groepSleutel = groep.map((x) => `${x.it.id}:${x.it.groep_id || ''}`).sort().join('|');
  useEffect(() => {
    if (!schrijven || groep.length < 2) return;
    const g0 = groep[0].it.groep_id;
    if (g0 && groep.every((x) => x.it.groep_id === g0)) return;
    onActie('unit-groep', { _it: it.id, ids: groep.map((x) => x.it.id) });
  }, [groepSleutel]); // eslint-disable-line react-hooks/exhaustive-deps
  const meldingen = useMemo(() => containerMeldingen(groep), [groep]);
  const telling = useMemo(() => containerTelling(groep), [groep]);
  const prims = useMemo(() => (gl ? containerPrims(groep, g?.it.id, sleep?.p ? { weg: sleep.id || null, spook: sleep.p } : {}) : null), [gl, groep, g?.it.id, sleep]);
  const kw = telling.reduce((a, r) => a + r.kw, 0);
  const hoog = Math.max(0, ...groep.map((x) => x.v)) + 1;
  const trap = units.find(isTrapEl);
  const bovenste = g && !g.trap && g.v > 0;
  const [trapZijde, setTrapZijde] = useState('V');

  const maakPdf = async () => {
    const [{ bouwerPdf }, { tentGroep }] = await Promise.all([import('./bouwerPdf'), import('./TentDrieGL')]);
    const pr = containerPrims(groep, null);
    await bouwerPdf({ soort: 'container', titel: String(it.naam || el?.naam || 'Units'), sub: [...new Set(groep.map((x) => x.el?.leverancier).filter(Boolean))].join(' · '), maakGroep: (T) => tentGroep(T, pr),
      hoogtes: [...new Set(groep.filter((x) => !x.trap).map((x) => Math.round((x.z0 + x.H) * 100) / 100))],
      kenmerken: [['Units', groep.filter((x) => !x.trap).length], ['Trappen', groep.filter((x) => x.trap).length], ['Hoog', hoog], ['Stroom', `± ${getal(kw)} kW`]] });
  };
  const levs = [...new Set(units.map((e) => e.leverancier || ''))];

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
          {schrijven && levs.map((lev) => (
            <div key={lev}>
              <div className="fm-kop">{lev || 'Units'}</div>
              <div className="fm-cb-lijst">
                {units.filter((e) => (e.leverancier || '') === lev).map((e) => (
                  <button key={e.id} type="button" draggable className={`fm-cb-kaart${nieuw === e.id ? ' aan' : ''}`} title={`${e.naam} · sleep in 3D`}
                    onClick={() => setNieuw(e.id)} onDragStart={(ev) => { lijstSleep.current = e; setNieuw(e.id); ev.dataTransfer.setData('text/fm-unit', e.id); ev.dataTransfer.effectAllowed = 'copy'; }} onDragEnd={() => { lijstSleep.current = null; setSleep(null); }}>
                    <UnitDuim el={e} />
                    <b>{kortNaam(e)}</b>
                    <small>{isTrapEl(e) ? 'Trap' : maatTekst(e)}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
        <div className="fm-ws-zicht">
          {prims ? <DrieGL prims={prims} kies={(d) => { if (d?.unit) setSel(d.unit); }} sleepVrij={sleepVrij} dropVrij={dropVrij} bevries={!!sleep} /> : <div className="fm-sub" style={{ padding: 20 }}>3D is niet beschikbaar in deze browser.</div>}
          {schrijven && <div className="fm-ws-tip fm-sub" style={{ top: 12, bottom: "auto" }}>{sleep ? (sleep.p?.ok ? (sleep.p.soort === 'erop' ? 'Erop' : 'Loslaten om te plaatsen') + ' · R = draaien' : 'Zet de unit tegen of op een andere unit') : 'Sleep een unit uit de lijst of in 3D · R = draaien · Delete = weghalen'}</div>}
        </div>
        <aside className="fm-ws-rechts">
          {g && <div className="fm-cb-gekozen"><UnitDuim el={g.el} w={64} h={44} /><div><b>{kortNaam(g.el)}</b><span className="fm-sub">{g.trap ? 'Trap' : `Verdieping ${g.v}`}{g.el?.leverancier ? ` · ${g.el.leverancier}` : ''}</span></div></div>}
          {schrijven && g && <>
            {!g.trap && elNieuw && !isTrapEl(elNieuw) && <div className="fm-cb-zijden">
              {ZIJDEN.map(([z, n]) => { const p = plekNaast(g, elNieuw, z); const te = z === 'O' && g.v + 2 > stapelMax(g.el); return <button key={z} type="button" className="fm-knop klein" title={`${kortNaam(elNieuw)} ${n.toLowerCase()}`} disabled={!p || !vrij(p) || te} onClick={() => plaats(elNieuw, p)}>{n}</button>; })}
            </div>}
            {bovenste && trap && <div className="fm-cb-zijden">
              {[['V', 'Voor'], ['A', 'Achter']].map(([z, n]) => <button key={z} type="button" className={`fm-knop klein${trapZijde === z ? ' zwart' : ''}`} onClick={() => setTrapZijde(z)}>Trap {n.toLowerCase()}</button>)}
              {[['L', 'links'], ['R', 'rechts']].map(([k, n]) => { const p = plekTrap(g, trap, trapZijde, k); return <button key={k} type="button" className="fm-knop klein" disabled={!vrij(p)} onClick={() => plaats(trap, p)}>Trap {n}</button>; })}
            </div>}
            {g.el?.eigenschappen?.gevelVrij && !g.trap && <GevelBeheer L={Number(g.el.breedte_m) || 6} B={Number(g.el.diepte_m) || 3} gevel={g.it.velden?.gevel || g.el.eigenschappen?.gevel || []} schrijven onZet={(gevel) => onActie('unit-gevel', { _it: g.it.id, gevel })} />}
            <div className="fm-cb-zijden" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <button type="button" className="fm-knop klein" title="Een kwartslag (R)" onClick={() => onActie('unit-wijzig', { _it: g.it.id, rot: ((Number(g.it.parameters?.rot) || 0) + 90) % 360 })}>Draaien</button>
              <button type="button" className="fm-knop klein" onClick={() => weg(g)}>Weghalen</button>
            </div>
          </>}
          <div className="fm-kop" style={{ marginTop: 10 }}>Nakijken</div>
          {meldingen.length ? meldingen.map((m, k) => <button key={k} type="button" className={`fm-melding ${m.soort === 'fout' ? 'fout' : ''}`} style={{ textAlign: 'left', border: 0, cursor: 'pointer', width: '100%', marginBottom: 6 }} onClick={() => setSel(m.ids[0])}>{m.tekst}</button>) : <div className="fm-melding ok">In orde.</div>}
          <div className="fm-kop" style={{ marginTop: 10 }}>Stuklijst</div>
          {telling.map((r) => <div key={r.naam} className="fm-tr-feit" title={r.naam}><span>{kortNaam({ naam: r.naam })}</span><b>{r.aantal}</b></div>)}
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
