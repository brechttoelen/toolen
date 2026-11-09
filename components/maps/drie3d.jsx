'use client';

// 3D van een vrij gebouwde B-matrix wand of truss: klein (zweefkaartje, pop-up) en over het hele scherm.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { WandZicht } from './WandStudio';
import { TrussZicht } from './TrussStudio';
import { isWand, isVrij } from './framewand';
import { isTrussBouw } from './trussbouw';
import { isStellingBouw } from './stellingbouw';
import { isCameraStelling } from './tvcamera';
import { StellingDrie, zonderDoeken } from './StellingStudio';
import { StellingPlannen } from './stellingplannen';
import { isTentBouw, tentGroep } from './tentbouw';
import { TentDrie, MELDING_TENT } from './TentStudio';

// stelling3d: een vaste stelling uit de bibliotheek (bv. een camerastelling) met een 3D-voorbeeld.
// Een tent (kader, boog, pagode, vouwtent) op het plan heeft altijd een 3D-vorm.
export const isTent3d = (it, el) => !!it && isTentBouw(el) && !!it.parameters?.midden;
export const heeft3d = (it, el) => !!it && !!el && (!!el.eigenschappen?.stelling3d || isTent3d(it, el) || (it.geometrie?.type === 'LineString' && ((isWand(el) && isVrij(it)) || isTrussBouw(it) || isStellingBouw(it))));

const doekenVan = (elementenMap) => [...elementenMap.values()].filter((x) => x.tekenwijze === 'doek');
// Vaste stelling uit de bibliotheek; een camerastelling krijgt haar camera op het dek, gedraaid zoals de kop op het plan
// (parameters.kop_rot). Per element en draaiing onthouden, zodat de 3D niet bij elke render opnieuw bouwt.
const vast3dCache = new WeakMap();
function vast3d(it, el) {
  const st = el?.eigenschappen?.stelling3d; if (!st || !isCameraStelling(el)) return st;
  const rot = Number(it?.parameters?.kop_rot) || 0; const c = vast3dCache.get(st) || new Map();
  if (!c.has(rot)) { c.set(rot, { ...st, camera: { deel: '0', vak: Object.keys(st.vakken || {})[0] || '0,0', u: 0.5, v: 0.5, rot } }); vast3dCache.set(st, c); }
  return c.get(rot);
}

export function Mini3D({ it, el, elementenMap, items = null }) {
  if (!heeft3d(it, el)) return null;
  if (isTent3d(it, el)) return <TentDrie it={it} el={el} groep={items ? tentGroep(it, el, items, elementenMap) : null} items={items} doekMap={elementenMap} vloer={!!it.velden?.vloer} mini />;
  if (el.eigenschappen?.stelling3d && !isStellingBouw(it)) return <StellingDrie st={vast3d(it, el)} mini />;
  if (isStellingBouw(it)) return <StellingDrie st={it.velden.stelling} doekMap={elementenMap} mini />;
  return isTrussBouw(it) ? <TrussZicht it={it} el={el} doeken={doekenVan(elementenMap)} /> : <WandZicht it={it} el={el} elementenMap={elementenMap} />;
}

// plannen = vaste lijst plannen van de stellingbouwer (deellink); anders worden ze opgehaald.
// vast = deellink met enkel deze 3D: geen sluitknop.
export function Groot3D({ it, el, elementenMap, naam, onSluit, schrijven = false, plannen = null, items = null, vast = false }) {
  const [doekUit, setDoekUit] = useState(false);
  useEffect(() => {
    const t = (e) => { if (e.key === 'Escape' && !vast) { e.stopPropagation(); e.preventDefault(); onSluit(); } };
    window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true);
  }, [onSluit, vast]);
  if (!heeft3d(it, el) || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fm fm-3d-groot" role="dialog" aria-label="3D-weergave">
      <div className="fm-3d-kop"><strong>{naam || it.naam || el.naam}</strong><span className="fm-sub">1 vinger draaien · 2 vingers verschuiven en zoomen</span><span style={{ flex: 1 }} />{isStellingBouw(it) && (it.velden.stelling.doeken?.length > 0 || (it.velden.stelling.delen || []).some((d) => d.doeken?.length)) && <button type="button" className={`fm-knop fm-sb-oog${doekUit ? ' uit' : ''}`} aria-pressed={!doekUit} title={doekUit ? 'Doeken tonen' : 'Doeken verbergen (de constructie zien)'} onClick={() => setDoekUit((x) => !x)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{doekUit && <path d="M3 3l18 18" />}</svg>Doeken</button>}{!vast && <button className="fm-knop" onClick={onSluit}>Sluiten</button>}</div>
      {(isStellingBouw(it) || el.eigenschappen?.stelling3d) && <div className="fm-3d-plan">{isStellingBouw(it) && it.id ? <StellingPlannen planId={it.plan_id} itemId={it.id} schrijven={schrijven} compact vast={plannen} /> : <div className="fm-stplan-melding">Indicatieve weergave. Enkel de plannen van de stellingbouwer zijn bindend.</div>}</div>}
      {isTent3d(it, el) && <div className="fm-3d-plan"><div className="fm-stplan-melding">{MELDING_TENT}</div></div>}
      <div className="fm-3d-zicht">{isTent3d(it, el) ? <TentDrie it={it} el={el} groep={items ? tentGroep(it, el, items, elementenMap) : null} items={items} doekMap={elementenMap} vloer={!!it.velden?.vloer} /> : el.eigenschappen?.stelling3d && !isStellingBouw(it) ? <StellingDrie st={vast3d(it, el)} /> : isStellingBouw(it) ? <StellingDrie st={doekUit ? zonderDoeken(it.velden.stelling) : it.velden.stelling} doekMap={elementenMap} /> : isTrussBouw(it) ? <TrussZicht groot it={it} el={el} doeken={doekenVan(elementenMap)} /> : <WandZicht groot it={it} el={el} elementenMap={elementenMap} />}</div>
    </div>,
    document.body,
  );
}

// Klikbaar voorbeeld dat de 3D over het hele scherm opent.
export function Knop3D({ it, el, elementenMap, onOpen, tekst = 'In 3D bekijken' }) {
  if (!heeft3d(it, el)) return null;
  return (
    <button type="button" className="fm-bs-lees-3d" title="In 3D bekijken over het hele scherm" onClick={onOpen}>
      <Mini3D it={it} el={el} elementenMap={elementenMap} />
      <span className="fm-bs-lees-3d-tip">⤢ {tekst}</span>
    </button>
  );
}
