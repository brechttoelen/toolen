'use client';

import { useEffect, useMemo } from 'react';
import { EenBord, PIJLCODE } from './bord';
import { PIJLEN, KANTEN, BEVESTIGING, instSign, isSign, pijlVoorstel, richtingUitRoutes } from './signalisatie';
import { routeLijn, signStatus } from './signVoorstel';

export const SIGN_STATUS = { voorstel: ['V', '#2563EB', 'Voorstel van de tool'], aangepast: ['A', '#D97706', 'Voorstel, door jou aangepast'], eigen: ['E', '#686D76', 'Zelf gezet'] };

// Gesorteerde bordpunten: per laag, op nummer. Dezelfde volgorde als de lijst in het paneel.
export const signPunten = (items) => items.filter(isSign).sort((a, b) => String(a.laag_id).localeCompare(String(b.laag_id)) || (Number(a.velden.sign.nr) || 0) - (Number(b.velden.sign.nr) || 0));

// Detail van één bordpunt: nummer, straat, kijkrichting, kant, bevestiging en de panelen.
// Met `nav` erbij: vorige/volgende (kaart volgt) en "Gecontroleerd" voor punten met een '!'.
export default function SignPuntDetail({ plan, items, punt, schrijven, onWijzigItem, onKiesItem = null, nav = false, compact = false }) {
  const inst = instSign(plan);
  const bestMap = useMemo(() => new Map(inst.bestemmingen.map((b) => [b.id, b])), [inst.bestemmingen]);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const routeCoords = (r) => routeLijn(itemMap.get(r.lijn_id), itemMap.get(r.ppo_id));
  const routeVan = (b) => { const r = inst.routes.find((x) => x.bestemming_id === b?.id); const c = r && routeCoords(r); return c ? { type: 'LineString', coordinates: c } : null; };
  const routes = inst.routes.map((r) => { const c = routeCoords(r); return c ? { type: 'LineString', coordinates: c } : null; }).filter(Boolean);
  const lijst = useMemo(() => signPunten(items), [items]);
  const idx = lijst.findIndex((p) => p.id === punt?.id);
  const vorige = idx > 0 ? lijst[idx - 1] : null;
  const volgende = idx >= 0 && idx < lijst.length - 1 ? lijst[idx + 1] : null;
  const volgendeControle = lijst.slice(idx + 1).find((p) => p.velden.sign.auto?.controleren) || lijst.slice(0, Math.max(0, idx)).find((p) => p.velden.sign.auto?.controleren) || null;

  const zetSign = (p, patch) => onWijzigItem(p.id, { velden: { ...p.velden, sign: { ...p.velden.sign, ...patch } } });
  const zetRij = (p, i, patch) => zetSign(p, { rijen: p.velden.sign.rijen.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const verschuifRij = (p, i, d) => { const r = [...p.velden.sign.rijen]; const j = i + d; if (j < 0 || j >= r.length) return; [r[i], r[j]] = [r[j], r[i]]; zetSign(p, { rijen: r }); };
  const gecontroleerd = () => {
    const a = { ...(punt.velden.sign.auto || {}) }; delete a.controleren;
    zetSign(punt, { auto: a });
    if (volgendeControle && onKiesItem) onKiesItem(volgendeControle.id);
  };
  // PageUp / PageDown bladeren door de punten; de kaart volgt.
  useEffect(() => {
    if (!nav || !onKiesItem) return undefined;
    const toets = (e) => {
      const d = e.target; if (d && (d.tagName === 'INPUT' || d.tagName === 'TEXTAREA' || d.tagName === 'SELECT')) return;
      if (e.key === 'PageDown' && volgende) { e.preventDefault(); onKiesItem(volgende.id); }
      if (e.key === 'PageUp' && vorige) { e.preventDefault(); onKiesItem(vorige.id); }
    };
    window.addEventListener('keydown', toets);
    return () => window.removeEventListener('keydown', toets);
  }, [nav, onKiesItem, vorige?.id, volgende?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!punt) return null;
  const s = punt.velden.sign;
  const [letter, kleur, uitleg] = SIGN_STATUS[signStatus(punt)];
  return (
    <div className={compact ? '' : 'fm-sectie'} style={compact ? undefined : { background: '#FAFAFB' }}>
      {nav && (
        <div className="fm-sign-nav">
          <button className="fm-knop klein" disabled={!vorige} onClick={() => onKiesItem?.(vorige.id)} title="Vorige punt (PageUp)">‹ Vorige</button>
          <span className="fm-sub">{idx + 1} / {lijst.length}</span>
          <button className="fm-knop klein" disabled={!volgende} onClick={() => onKiesItem?.(volgende.id)} title="Volgende punt (PageDown)">Volgende ›</button>
        </div>
      )}
      <div className="fm-kop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1 }}>Punt {s.nr}</span>
        <span title={uitleg} style={{ width: 16, height: 16, fontSize: 9.5, fontWeight: 700, color: '#fff', background: kleur, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{letter}</span>
      </div>
      {s.auto?.controleren && (
        <div className="fm-sign-controleren">
          <span>Niet uit de routeplanner: kijk na of dit punt klopt.</span>
          {schrijven && <button className="fm-knop klein zwart" onClick={gecontroleerd}>Gecontroleerd{volgendeControle ? ' › volgende' : ''}</button>}
        </div>
      )}
      <div className="fm-raster2">
        <label className="fm-veld">Nummer<input defaultValue={s.nr} key={`nr${punt.id}${s.nr}`} disabled={!schrijven} onBlur={(e) => zetSign(punt, { nr: e.target.value })} /></label>
        <label className="fm-veld">Straat<input defaultValue={s.straat || ''} key={`st${punt.id}`} disabled={!schrijven} onBlur={(e) => zetSign(punt, { straat: e.target.value || null })} /></label>
      </div>
      <label className="fm-veld">
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>Kijkrichting · {Math.round(s.richting ?? 0)}°</span>
          {schrijven && routes.length > 0 && <button className="fm-knop klein" onClick={(e) => { e.preventDefault(); const r = richtingUitRoutes(punt.geometrie.coordinates, routes); if (r != null) zetSign(punt, { richting: Math.round(r) }); }}>Uit route</button>}
        </span>
        <input type="range" min="0" max="359" step="1" disabled={!schrijven} value={s.richting ?? 0} onChange={(e) => zetSign(punt, { richting: Number(e.target.value) })} style={{ padding: 0, border: 0, height: 22 }} />
      </label>
      <div className="fm-raster2">
        <label className="fm-veld">Kant
          <select value={s.kant || 'rechts'} disabled={!schrijven} onChange={(e) => zetSign(punt, { kant: e.target.value })}>{KANTEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
        <label className="fm-veld">Bevestiging
          <select value={s.bevestiging || 'heras'} disabled={!schrijven} onChange={(e) => zetSign(punt, { bevestiging: e.target.value })}>{BEVESTIGING.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
      </div>
      <div className="fm-kop">Panelen <span className="fm-sub">van boven naar onder</span></div>
      {(s.rijen || []).map((r, i) => {
        const b = bestMap.get(r.bestemming_id);
        const vs = pijlVoorstel(punt.geometrie.coordinates, s.richting, routeVan(b));
        const afwijking = vs && r.pijl && r.pijl !== 'geen' && r.pijl !== vs;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: '#fff', border: `1px solid ${afwijking ? '#D97706' : '#e8e8e6'}` }}>
            <EenBord best={b} pijl={r.pijl} type={inst.bord || 'paneel'} logo={inst.logo !== false} breedte={200} />
            {r.afslag && <div className="fm-sub">Rotonde: {r.afslag}e afslag</div>}
            {schrijven && (
              <>
                <select aria-label="Bord" value={r.bestemming_id || ''} onChange={(e) => zetRij(punt, i, { bestemming_id: e.target.value })} style={{ height: 26, fontSize: 12 }}>
                  {inst.bestemmingen.map((x) => <option key={x.id} value={x.id}>{x.boventitel ? `${x.boventitel} ` : ''}{x.naam}{x.soort === 'set' ? ` · ${x.groep}` : ''}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 3 }}>
                  <select aria-label="Pijl" value={r.pijl || 'rechtdoor'} onChange={(e) => zetRij(punt, i, { pijl: e.target.value })} style={{ height: 24, flex: 1, minWidth: 0, fontSize: 12 }}>
                    {PIJLEN.map(([k, t]) => <option key={k} value={k}>{t}{PIJLCODE[k] ? ` (${PIJLCODE[k]})` : ''}</option>)}
                  </select>
                  <button className="fm-knop klein" aria-label="Hoger" disabled={i === 0} onClick={() => verschuifRij(punt, i, -1)}>↑</button>
                  <button className="fm-knop klein" aria-label="Lager" disabled={i === s.rijen.length - 1} onClick={() => verschuifRij(punt, i, 1)}>↓</button>
                  <button className="fm-knop klein gevaar" aria-label="Paneel weg" onClick={() => zetSign(punt, { rijen: s.rijen.filter((_, j) => j !== i) })}>×</button>
                </div>
              </>
            )}
            {afwijking && (
              <div className="fm-sub" style={{ color: '#8A4D00', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ flex: 1 }}>Route zegt: {PIJLEN.find(([k]) => k === vs)?.[1]?.toLowerCase()}</span>
                {schrijven && <button className="fm-knop klein" onClick={() => zetRij(punt, i, { pijl: vs })}>Overnemen</button>}
              </div>
            )}
          </div>
        );
      })}
      {schrijven && inst.bestemmingen.length > 0 && (
        <button className="fm-knop klein" onClick={() => {
          const b = inst.bestemmingen[0];
          const vs = pijlVoorstel(punt.geometrie.coordinates, s.richting, routeVan(b));
          zetSign(punt, { rijen: [...(s.rijen || []), { bestemming_id: b.id, pijl: vs || 'rechtdoor' }] });
        }}>+ Paneel</button>
      )}
      {!inst.bestemmingen.length && <div className="fm-sub">Kies eerst borden (stap 1).</div>}
    </div>
  );
}
