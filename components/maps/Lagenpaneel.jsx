'use client';

import Info from './info';
import { vraagTekst, useSluitBuiten } from './dialoog';
import { useRef, useState } from 'react';
import { LaagOpties } from './laagOpties';
import { Icoon } from './iconen';
import { KLEUREN, VULLINGEN } from './stijl';

const SOORT = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', element: 'Element', veelhoek: 'Veelhoek', ellips: 'Ellips', sector: 'Kijkhoek', notitie: 'Notitie' };

// Stijl die voor alle items van een laag geldt (tenzij een item een eigen stijl heeft).
function LaagStijl({ l, aantalEigen, onWijzig, onStijlWissen, onSluit }) {
  const st = l.stijl || {};
  const zet = (p) => onWijzig(l.id, { stijl: { ...st, ...p } });
  const getal = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
  return (
    <div className="fm-laagstijl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 12 }}>Stijl van de laag</strong><button className="fm-knop klein" onClick={onSluit}>Klaar</button></div>
      <div className="fm-kleuren">
        {KLEUREN.map((k) => <button key={k} className={(l.kleur || '').toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} aria-label={`Laagkleur ${k}`} onClick={() => onWijzig(l.id, { kleur: k })} />)}
      </div>
      <div className="fm-raster2">
        <label className="fm-veld">Lijndikte (px)<input defaultValue={st.dikte ?? ''} placeholder="2" inputMode="decimal" onChange={(e) => zet({ dikte: getal(e.target.value) })} /></label>
        <label className="fm-veld">Tekstgrootte<input defaultValue={st.tekstgrootte ?? ''} placeholder="12" inputMode="decimal" onChange={(e) => zet({ tekstgrootte: getal(e.target.value) })} /></label>
      </div>
      <div className="fm-veld">Lijnstijl
        <div className="fm-segment">{[['vol', 'Vol'], ['streep', 'Streep'], ['stip', 'Stip'], ['streeppunt', 'Str-pt']].map(([k, t]) => <button key={k} className={(st.streep || 'vol') === k ? 'aan' : ''} onClick={() => zet({ streep: k })}>{t}</button>)}</div>
      </div>
      <div className="fm-raster2">
        <label className="fm-veld">Vulling
          <select value={st.vulpatroon || 'effen'} onChange={(e) => zet({ vulpatroon: e.target.value })}>{VULLINGEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
        <label className="fm-veld">Dekking · {Math.round((st.vuldekking ?? 0.2) * 100)}%
          <input type="range" min="0" max="1" step="0.05" value={st.vuldekking ?? 0.2} onChange={(e) => zet({ vuldekking: Number(e.target.value) })} style={{ padding: 0, border: 0, height: 24 }} />
        </label>
      </div>
      <div className="fm-vinkrij">
        <label className="fm-vink"><input type="checkbox" checked={st.label === true} onChange={(e) => zet({ label: e.target.checked })} />Namen tonen</label>
        <label className="fm-vink"><input type="checkbox" checked={!!st.wit_rand} onChange={(e) => zet({ wit_rand: e.target.checked })} />Witte rand</label>
        <label className="fm-vink"><input type="checkbox" checked={!!st.maten} onChange={(e) => zet({ maten: e.target.checked })} />Maatlijnen</label>
        <label className="fm-vink"><input type="checkbox" checked={!!st.opp} onChange={(e) => zet({ opp: e.target.checked })} />Oppervlakte</label>
        <label className="fm-vink"><input type="checkbox" checked={l.printbaar} onChange={(e) => onWijzig(l.id, { printbaar: e.target.checked })} />Afdrukken</label>
      </div>
      {aantalEigen > 0 && (
        <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onStijlWissen(l.id)}>
          {aantalEigen} {aantalEigen === 1 ? 'item heeft' : 'items hebben'} een eigen stijl: laagstijl toepassen
        </button>
      )}
    </div>
  );
}

export default function Lagenpaneel({ lagen, items, actieveLaag, schrijven, onKies, onWijzig, onNieuw, onVerwijder, onRuimOp, geselecteerd, onKiesItem, groepNaam = () => '', onKiesGroep, onGroepNaam, onStijlWissen, elementenMap = new Map(), verbergElementen = [], onVerbergElementen, onItemZicht, onItemSlot, onItemLaag, onVolgorde, legeMappen = [], onLegeMappen, extra = [], onKiesItems }) {
  const [dropLaag, setDropLaag] = useState(null);
  const [instellen, setInstellen] = useState(null);
  const [menuLaag, setMenuLaag] = useState(null);
  const [sleepLaag, setSleepLaag] = useState(null);
  const [dropMap, setDropMap] = useState(null);
  const [menuMap, setMenuMap] = useState(null);
  const [openLaag, setOpenLaag] = useState(null); // laag waarvan de items openstaan
  // Meerdere items in de lijst kiezen: Shift = reeks, Ctrl/Cmd = erbij of eraf. Zelfde selectie als op de kaart.
  const gekozen = new Set([geselecteerd, ...extra].filter(Boolean));
  const anker = useRef(null);
  const [itemMenu, setItemMenu] = useState(null); // { x, y } rechtsklikmenu bij de gekozen items
  useSluitBuiten(!!itemMenu, () => setItemMenu(null));
  const kiesInLijst = (e, id, rij) => {
    if (onKiesItems && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      let ids;
      if (e.shiftKey && anker.current && rij.includes(anker.current)) {
        const a = rij.indexOf(anker.current); const b = rij.indexOf(id);
        ids = [...new Set([...(e.metaKey || e.ctrlKey ? gekozen : []), ...rij.slice(Math.min(a, b), Math.max(a, b) + 1)])];
      } else {
        ids = gekozen.has(id) ? [...gekozen].filter((x) => x !== id) : [...gekozen, id];
        anker.current = id;
      }
      // Het aangeklikte item vooraan: dat toont de eigenschappen als het het enige is.
      onKiesItems(ids.includes(id) ? [id, ...ids.filter((x) => x !== id)] : ids);
      return;
    }
    anker.current = id;
    onKiesItem(id);
  };
  const naarLaag = (ids, laagId) => onItemLaag?.(ids, laagId);
  const [dropEind, setDropEind] = useState(false);
  const [dicht, setDicht] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('fm-mappen-dicht') || '[]')); } catch { return new Set(); } });
  useSluitBuiten(!!menuMap, () => setMenuMap(null));
  const wisselDicht = (m) => setDicht((d) => { const n = new Set(d); if (n.has(m)) n.delete(m); else n.add(m); try { localStorage.setItem('fm-mappen-dicht', JSON.stringify([...n])); } catch {} return n; });
  // Lagen in mappen: een map staat op de plaats van haar eerste laag, met al haar lagen eronder.
  // Lege mappen (net aangemaakt) staan bovenaan, tot er een laag in komt.
  const mappen = [...new Set([...lagen.map((l) => l.map).filter(Boolean), ...legeMappen])];
  const leeg = legeMappen.filter((m) => !lagen.some((l) => l.map === m));
  const blokken = leeg.map((m) => ({ map: m, lagen: [] }));
  { const gezien = new Set(); for (const l of lagen) { if (!l.map) blokken.push({ laag: l }); else if (!gezien.has(l.map)) { gezien.add(l.map); blokken.push({ map: l.map, lagen: lagen.filter((x) => x.map === l.map) }); } } }
  const stopSlepen = () => { setSleepLaag(null); setDropLaag(null); setDropMap(null); setDropEind(false); };
  // Laag `vanId` vóór laag `voorId` zetten (null = helemaal onderaan), met de map erbij.
  const zetLaag = (vanId, voorId, map) => {
    const v = lagen.find((x) => x.id === vanId); if (!v) return;
    const ids = lagen.map((x) => x.id).filter((x) => x !== vanId);
    if (voorId) ids.splice(Math.max(0, ids.indexOf(voorId)), 0, vanId); else ids.push(vanId);
    const patch = (v.map || null) !== (map || null) ? { [vanId]: { map: map || null } } : {};
    if (ids.every((id, i) => lagen[i]?.id === id) && !patch[vanId]) return;
    onVolgorde?.(ids, patch);
  };
  useSluitBuiten(!!menuLaag, () => setMenuLaag(null));
  // Enkel deze laag tonen, of (nogmaals) alles terug tonen.
  const solo = (id) => {
    const alleenDeze = lagen.every((x) => (x.id === id ? x.zichtbaar : !x.zichtbaar));
    for (const x of lagen) {
      const moet = alleenDeze ? true : x.id === id;
      if (x.zichtbaar !== moet) onWijzig(x.id, { zichtbaar: moet });
    }
  };
  const tel = new Map();
  for (const i of items) tel.set(i.laag_id, (tel.get(i.laag_id) || 0) + 1);
  const zonderLaag = items.filter((i) => !i.laag_id || !lagen.some((l) => l.id === i.laag_id));
  const verbergEl = new Set(verbergElementen);
  const verborgenPerLaag = new Map();
  for (const i of items) if (i.verborgen) verborgenPerLaag.set(i.laag_id, (verborgenPerLaag.get(i.laag_id) || 0) + 1);
  const typesInPlan = [...new Set(items.map((i) => i.element_id).filter(Boolean))].map((id) => elementenMap.get(id)).filter(Boolean).sort((a, b) => a.naam.localeCompare(b.naam));

  const laagRij = (l, inMap = false) => {
        const aan = l.id === actieveLaag;
        const uit = openLaag === l.id;
        const eigen = uit ? items.filter((i) => i.laag_id === l.id) : [];
        return (
          <div key={l.id}>
            <div className={`fm-laag${inMap ? ' inmap' : ''}${aan ? ' aan' : ''}${dropLaag === l.id && !sleepLaag ? ' drop' : ''}${sleepLaag && sleepLaag !== l.id && dropLaag === l.id ? ' drop-laag' : ''}`} onClick={() => onKies(l.id)}
              draggable={schrijven && !!onVolgorde} onDragStart={(e) => { if (e.target !== e.currentTarget) return; e.dataTransfer.setData('text/fm-laag', l.id); e.dataTransfer.effectAllowed = 'move'; setSleepLaag(l.id); }}
              onDragEnd={stopSlepen}
              title={schrijven ? 'Sleep om de volgorde te wijzigen' : undefined}
              onDragOver={(e) => { if (schrijven && (e.dataTransfer.types.includes('text/fm-item') || e.dataTransfer.types.includes('text/fm-laag'))) { e.preventDefault(); if (dropLaag !== l.id) setDropLaag(l.id); } }}
              onDragLeave={() => setDropLaag((d) => (d === l.id ? null : d))}
              onDrop={(e) => {
                const laagId = e.dataTransfer.getData('text/fm-laag');
                const id = e.dataTransfer.getData('text/fm-item');
                let meer = []; try { meer = JSON.parse(e.dataTransfer.getData('text/fm-items') || '[]'); } catch {}
                stopSlepen();
                if (laagId) { e.preventDefault(); if (laagId !== l.id) zetLaag(laagId, l.id, l.map); return; }
                if (meer.length > 1) { e.preventDefault(); naarLaag(meer, l.id); return; }
                if (id) { e.preventDefault(); onItemLaag?.(id, l.id); }
              }}>
              <button aria-label={`${l.zichtbaar ? 'Verberg' : 'Toon'} ${l.naam}`} aria-pressed={l.zichtbaar} title="Alt + klik: enkel deze laag tonen"
                onClick={(e) => { e.stopPropagation(); if (e.altKey) solo(l.id); else onWijzig(l.id, { zichtbaar: !l.zichtbaar }); }}
                style={{ color: l.zichtbaar ? '#1d1d1b' : '#c4c4c0' }}>
                <Icoon naam={l.zichtbaar ? 'oog' : 'oogdicht'} maat={16} />
              </button>
              <label style={{ width: 14, height: 14, background: l.kleur, cursor: schrijven ? 'pointer' : 'default', position: 'relative' }} onClick={(e) => e.stopPropagation()} title="Kleur van de laag">
                {schrijven && <input type="color" value={l.kleur} onChange={(e) => onWijzig(l.id, { kleur: e.target.value })} style={{ opacity: 0, position: 'absolute', inset: 0, width: 14, height: 14, cursor: 'pointer' }} aria-label={`Kleur van ${l.naam}`} />}
              </label>
              <span className="naam" style={{ fontWeight: aan ? 600 : 400 }}
                onDoubleClick={async () => { if (!schrijven) return; const n = await vraagTekst('Nieuwe naam', l.naam); if (n) onWijzig(l.id, { naam: n }); }}>{l.naam}</span>
              <button className="tel" aria-expanded={uit} aria-label={`Items van ${l.naam} ${uit ? 'verbergen' : 'tonen'}`} onClick={(e) => { e.stopPropagation(); setOpenLaag(uit ? null : l.id); }}>{tel.get(l.id) || 0}{verborgenPerLaag.get(l.id) ? <span style={{ color: '#B45309' }}> · {verborgenPerLaag.get(l.id)} weg</span> : null}<span className="pijl">{uit ? '▾' : '▸'}</span></button>
              <button aria-label={`${l.vergrendeld ? 'Ontgrendel' : 'Vergrendel'} ${l.naam}`} aria-pressed={l.vergrendeld} disabled={!schrijven}
                onClick={(e) => { e.stopPropagation(); onWijzig(l.id, { vergrendeld: !l.vergrendeld }); }}
                style={{ color: l.vergrendeld ? '#1d1d1b' : '#c4c4c0' }}>
                <Icoon naam={l.vergrendeld ? 'slot' : 'slotopen'} maat={14} />
              </button>
              {schrijven && (
                <span style={{ position: 'relative' }}>
                  <button data-menuknop aria-label={`Meer voor ${l.naam}`} title="Meer" onClick={(e) => { e.stopPropagation(); setMenuLaag(menuLaag === l.id ? null : l.id); }} style={{ color: '#686D76', fontWeight: 700, letterSpacing: 1 }}>⋯</button>
                  {menuLaag === l.id && (
                    <div className="fm-menu" style={{ right: 0, top: 26, minWidth: 180 }} onClick={(e) => { e.stopPropagation(); setMenuLaag(null); }}>
                      <button onClick={() => solo(l.id)}>{lagen.every((x) => (x.id === l.id ? x.zichtbaar : !x.zichtbaar)) ? 'Alle lagen weer tonen' : 'Enkel deze laag tonen'}</button>
                      <button onClick={() => { onKies(l.id); setInstellen(l.id); }}>Stijl van de laag</button>
                      <button onClick={async () => { const n = await vraagTekst('Nieuwe naam', l.naam); if (n) onWijzig(l.id, { naam: n }); }}>Hernoemen</button>
                      <button onClick={async () => { const n = await vraagTekst(`In welke map?${mappen.length ? ` (bestaand: ${mappen.join(', ')})` : ''}`, l.map || ''); if (n != null) onWijzig(l.id, { map: n.trim() || null }); }}>{l.map ? 'Andere map…' : 'In een map steken…'}</button>
                      {l.map && <button onClick={() => onWijzig(l.id, { map: null })}>Uit de map halen</button>}
                      <button onClick={() => onWijzig(l.id, { printbaar: !l.printbaar })}>{l.printbaar ? 'Niet op de PDF' : 'Wel op de PDF'}</button>
                      <button style={{ color: '#B4123A' }} onClick={() => onVerwijder(l.id)}>Laag verwijderen</button>
                    </div>
                  )}
                </span>
              )}
            </div>
            {(uit || (aan && instellen === l.id)) && (
              <div style={{ background: '#FAFAFB', borderBottom: '1px solid #f0f0ee' }}>
                {uit && eigen.length === 0 && <div className="fm-sub" style={{ padding: '8px 12px' }}>Nog niets in deze laag.</div>}
                {(() => {
                  // Een groep staat als één regel in de lijst, met de naam van de groep.
                  const gezien = new Set(); const rijen = [];
                  for (const i of eigen) {
                    if (i.groep_id) {
                      if (gezien.has(i.groep_id)) continue; gezien.add(i.groep_id);
                      // De groep staat enkel onder de laag van de groep (die van het eerste item).
                      const leden = items.filter((x) => x.groep_id === i.groep_id);
                      if (leden[0] && leden[0].laag_id !== l.id) continue;
                      rijen.push({ groep: i.groep_id, n: leden.length, eerste: leden[0]?.id });
                    } else rijen.push(i);
                  }
                  return rijen;
                })().slice(0, 60).map((i, _k, alle) => {
                  const eigenIds = alle.filter((x) => !x.groep).map((x) => x.id);
                  if (i.groep) return (
                    <div key={`g${i.groep}`} className="fm-laagitem" draggable={schrijven} onDragStart={(e) => { e.dataTransfer.setData('text/fm-item', i.eerste); e.dataTransfer.effectAllowed = 'move'; }}>
                      <span className="oog" style={{ width: 22, display: 'inline-flex', justifyContent: 'center', color: '#686D76' }} aria-hidden="true">▣</span>
                      <button className="naam" onClick={() => onKiesGroep?.(i.groep)} onDoubleClick={() => schrijven && onGroepNaam?.(i.groep)} title={schrijven ? 'Dubbelklik om de groep een naam te geven' : undefined}>
                        <span>{groepNaam(i.groep) || 'Groep zonder naam'}</span>
                        <small>Groep · {i.n} items</small>
                      </button>
                      {onItemSlot && (() => { const ids = items.filter((x) => x.groep_id === i.groep).map((x) => x.id); const dicht = ids.length > 0 && items.filter((x) => x.groep_id === i.groep).every((x) => x.vergrendeld); return (
                        <button className={`slot${dicht ? ' aan' : ''}`} disabled={!schrijven} title={dicht ? 'Groep ontgrendelen' : 'Groep vergrendelen'} aria-label={dicht ? 'Groep ontgrendelen' : 'Groep vergrendelen'} aria-pressed={dicht}
                          onClick={(e) => { e.stopPropagation(); onItemSlot(ids, !dicht); }}>
                          <Icoon naam={dicht ? 'slot' : 'slotopen'} maat={12} />
                        </button>
                      ); })()}
                    </div>
                  );
                  const el = i.element_id ? elementenMap.get(i.element_id) : null;
                  const typeWeg = !!el && verbergEl.has(el.id);
                  return (
                    <div key={i.id} className={`fm-laagitem${gekozen.has(i.id) ? ' gekozen' : ''}`} draggable={schrijven}
                      onDragStart={(e) => { const mee = gekozen.has(i.id) && gekozen.size > 1 ? [...gekozen] : [i.id]; e.dataTransfer.setData('text/fm-item', i.id); e.dataTransfer.setData('text/fm-items', JSON.stringify(mee)); e.dataTransfer.effectAllowed = 'move'; }}
                      onContextMenu={(e) => { if (!schrijven || !onItemLaag) return; e.preventDefault(); if (!gekozen.has(i.id)) { anker.current = i.id; onKiesItems ? onKiesItems([i.id]) : onKiesItem(i.id); } setItemMenu({ x: e.clientX, y: e.clientY, ids: gekozen.has(i.id) ? [...gekozen] : [i.id] }); }}
                      title={schrijven ? 'Shift/Ctrl + klik: meer kiezen · slepen of rechtsklik: naar een andere laag' : undefined} style={{ opacity: i.verborgen || typeWeg ? 0.5 : 1 }}>
                      <button className="oog" disabled={!schrijven || typeWeg} title={typeWeg ? 'Dit soort element is verborgen (zie onderaan)' : i.verborgen ? 'Tonen' : 'Verbergen'} aria-label={i.verborgen ? 'Tonen' : 'Verbergen'}
                        onClick={() => onItemZicht?.(i.id, !!i.verborgen)}>
                        <Icoon naam={i.verborgen || typeWeg ? 'oogdicht' : 'oog'} maat={13} />
                      </button>
                      <button className="naam" disabled={i.verborgen} onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }} onClick={(e) => kiesInLijst(e, i.id, eigenIds)}>
                        <span>{i.naam || el?.naam || SOORT[i.soort] || i.soort}</span>
                        <small>{el ? el.naam === (i.naam || el.naam) ? SOORT[i.soort] : el.naam : SOORT[i.soort]}</small>
                      </button>
                      {onItemSlot && (
                        <button className={`slot${i.vergrendeld ? ' aan' : ''}`} disabled={!schrijven} title={i.vergrendeld ? 'Ontgrendelen' : 'Vergrendelen (niet meer te verschuiven of aan te passen)'} aria-label={i.vergrendeld ? 'Ontgrendelen' : 'Vergrendelen'} aria-pressed={!!i.vergrendeld}
                          onClick={(e) => { e.stopPropagation(); const ids = gekozen.has(i.id) && gekozen.size > 1 ? [...gekozen] : [i.id]; onItemSlot(ids, !i.vergrendeld); }}>
                          <Icoon naam={i.vergrendeld ? 'slot' : 'slotopen'} maat={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {schrijven && eigen.some((i) => i.verborgen) && <div style={{ padding: '4px 12px 6px 30px' }}><button className="fm-knop klein" onClick={() => eigen.filter((i) => i.verborgen).forEach((i) => onItemZicht?.(i.id, true))}>Alle verborgen items in deze laag tonen</button></div>}
                {eigen.length > 60 && <div className="fm-sub" style={{ padding: '6px 12px 6px 30px' }}>+ {eigen.length - 60} meer</div>}
                {schrijven && instellen === l.id && (
                  <LaagStijl key={l.id} l={l} aantalEigen={items.filter((i) => i.laag_id === l.id).filter((i) => i.stijl && ['kleur', 'vulkleur', 'dikte', 'streep', 'vulpatroon', 'vuldekking', 'label', 'wit_rand', 'tekstgrootte', 'dekking'].some((k) => k in i.stijl)).length} onWijzig={onWijzig} onStijlWissen={onStijlWissen} onSluit={() => setInstellen(null)} />
                )}
                {uit && !l.printbaar && <div className="fm-sub" style={{ padding: '0 12px 8px' }}>Deze laag komt niet op de PDF.</div>}
              </div>
            )}
          </div>
        );
  };

  const mapRij = ({ map: m, lagen: ml }) => {
    const open = !dicht.has(m);
    const zicht = ml.some((x) => x.zichtbaar);
    const slot = ml.every((x) => x.vergrendeld);
    const n = ml.reduce((a, x) => a + (tel.get(x.id) || 0), 0);
    const hernoem = async () => {
      const nm = (await vraagTekst('Naam van de map', m))?.trim();
      if (!nm || nm === m) return;
      for (const x of ml) onWijzig(x.id, { map: nm });
      if (legeMappen.includes(m)) onLegeMappen?.(legeMappen.map((x) => (x === m ? nm : x)));
    };
    return (
      <div key={`map:${m}`}>
        <div className={`fm-laag fm-map${dropMap === m ? ' drop' : ''}`} onClick={() => wisselDicht(m)} title={schrijven ? 'Sleep een laag hierop om ze in deze map te steken' : undefined}
          onDragOver={(e) => { if (schrijven && e.dataTransfer.types.includes('text/fm-laag')) { e.preventDefault(); if (dropMap !== m) setDropMap(m); } }}
          onDragLeave={() => setDropMap((d) => (d === m ? null : d))}
          onDrop={(e) => {
            const laagId = e.dataTransfer.getData('text/fm-laag');
            stopSlepen();
            if (!laagId) return;
            e.preventDefault();
            // Onderaan in de map; in een lege map komt de laag bovenaan de lijst (daar staat de map).
            if (!ml.length) { zetLaag(laagId, lagen[0]?.id === laagId ? lagen[1]?.id : lagen[0]?.id, m); return; }
            if (ml.some((x) => x.id === laagId)) return;
            const na = lagen.findIndex((x) => x.id === ml[ml.length - 1].id);
            zetLaag(laagId, lagen.slice(na + 1).find((x) => x.id !== laagId)?.id || null, m);
          }}>
          <button aria-label={`${zicht ? 'Verberg' : 'Toon'} map ${m}`} aria-pressed={zicht} onClick={(e) => { e.stopPropagation(); for (const x of ml) if (x.zichtbaar === zicht) onWijzig(x.id, { zichtbaar: !zicht }); }} style={{ color: zicht ? '#1d1d1b' : '#c4c4c0' }}>
            <Icoon naam={zicht ? 'oog' : 'oogdicht'} maat={16} />
          </button>
          <span className="pijl" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="naam" onDoubleClick={(e) => { e.stopPropagation(); if (schrijven) hernoem(); }}>{m}</span>
          <span className="tel" title={`${ml.length} ${ml.length === 1 ? 'laag' : 'lagen'}, ${n} items`}>{n}</span>
          <button aria-label={`${slot ? 'Ontgrendel' : 'Vergrendel'} map ${m}`} aria-pressed={slot} disabled={!schrijven} onClick={(e) => { e.stopPropagation(); for (const x of ml) if (x.vergrendeld === slot) onWijzig(x.id, { vergrendeld: !slot }); }} style={{ color: slot ? '#1d1d1b' : '#c4c4c0' }}>
            <Icoon naam={slot ? 'slot' : 'slotopen'} maat={14} />
          </button>
          {schrijven ? (
            <span style={{ position: 'relative' }}>
              <button data-menuknop aria-label={`Meer voor map ${m}`} title="Meer" onClick={(e) => { e.stopPropagation(); setMenuMap(menuMap === m ? null : m); }} style={{ color: '#686D76', fontWeight: 700, letterSpacing: 1 }}>⋯</button>
              {menuMap === m && (
                <div className="fm-menu" style={{ right: 0, top: 26, minWidth: 180 }} onClick={(e) => { e.stopPropagation(); setMenuMap(null); }}>
                  <button onClick={() => onNieuw?.(m)}>Nieuwe laag in deze map</button>
                  <button onClick={hernoem}>Map hernoemen</button>
                  <button onClick={() => { for (const x of ml) onWijzig(x.id, { map: null }); if (legeMappen.includes(m)) onLegeMappen?.(legeMappen.filter((x) => x !== m)); }}>{ml.length ? 'Map opheffen (lagen blijven)' : 'Map verwijderen'}</button>
                </div>
              )}
            </span>
          ) : <span />}
        </div>
        {open && ml.map((x) => laagRij(x, true))}
        {open && !ml.length && <div className="fm-sub fm-mapleeg">{sleepLaag ? 'Loslaten op de map' : 'Leeg · sleep een laag op de map'}</div>}
      </div>
    );
  };

  return (
    <div>
      {itemMenu && (
        <div className="fm-menu fm-itemmenu" style={{ position: 'fixed', left: Math.min(itemMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250), top: Math.min(itemMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 120), minWidth: 230 }} onClick={(e) => e.stopPropagation()}>
          <div className="fm-sub" style={{ padding: '4px 10px 6px' }}>{itemMenu.ids.length} {itemMenu.ids.length === 1 ? 'item' : 'items'} naar laag</div>
          <select autoFocus aria-label="Naar laag" defaultValue="" style={{ margin: '0 8px 8px', width: 'calc(100% - 16px)' }}
            onChange={(e) => { const d = e.target.value; if (d) naarLaag(itemMenu.ids, d); setItemMenu(null); }}>
            <option value="" disabled>Kies een laag…</option>
            <LaagOpties lagen={lagen} />
          </select>
          {onItemSlot && (() => { const alle = itemMenu.ids.every((id) => items.find((x) => x.id === id)?.vergrendeld); return (
            <button style={{ width: '100%' }} onClick={() => { onItemSlot(itemMenu.ids, !alle); setItemMenu(null); }}>
              <Icoon naam={alle ? 'slotopen' : 'slot'} maat={13} /> {alle ? 'Ontgrendelen' : 'Vergrendelen'}{itemMenu.ids.length > 1 ? ` (${itemMenu.ids.length})` : ''}
            </button>
          ); })()}
        </div>
      )}
      {blokken.map((b) => (b.map ? mapRij(b) : laagRij(b.laag)))}
      {schrijven && sleepLaag && (
        <div className={`fm-laag-eind${dropEind ? ' drop' : ''}`}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('text/fm-laag')) { e.preventDefault(); if (!dropEind) setDropEind(true); } }}
          onDragLeave={() => setDropEind(false)}
          onDrop={(e) => { const id = e.dataTransfer.getData('text/fm-laag'); stopSlepen(); if (id) { e.preventDefault(); zetLaag(id, null, null); } }}>
          Onderaan, buiten een map
        </div>
      )}
      {zonderLaag.length > 0 && <div className="fm-sub" style={{ padding: '8px 12px' }}>{zonderLaag.length} items zonder laag</div>}
      {schrijven && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="fm-knop vol" style={{ flex: 1 }} onClick={() => onNieuw()}><span>Nieuwe laag</span></button>
            <button className="fm-knop vol" style={{ flex: 1 }} title="Een map om lagen te groeperen, bv. Evenementieel" onClick={async () => { const m = (await vraagTekst('Naam van de map (bv. Evenementieel)'))?.trim(); if (!m) return; if (mappen.includes(m)) return; if (onLegeMappen) { onLegeMappen([...legeMappen, m]); setDicht((d) => { const n = new Set(d); n.delete(m); return n; }); } else onNieuw(m); }}><span>Nieuwe map</span></button>
          </div>
          {onRuimOp && (() => { const n = lagen.filter((l) => !items.some((i) => i.laag_id === l.id)).length; return n > 0 && lagen.length > 1 ? <button className="fm-knop klein vol" onClick={onRuimOp}>Lege lagen opruimen ({n})</button> : null; })()}
        </div>
      )}
      {typesInPlan.length > 0 && (
        <details className="fm-meer" style={{ margin: '0 12px 12px' }} open={verbergEl.size > 0}>
          <summary>Tonen per soort element{verbergEl.size ? ` · ${verbergEl.size} verborgen` : ''}<Info>Bv. alle heras even weg om de tenten te zien. Geldt ook voor de PDF, deel-links en de opbouwmodus.</Info></summary>
          {typesInPlan.map((e) => (
            <label key={e.id} className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={!verbergEl.has(e.id)}
              onChange={() => onVerbergElementen?.(verbergEl.has(e.id) ? verbergElementen.filter((x) => x !== e.id) : [...verbergElementen, e.id])} />
              {e.naam} <span className="fm-sub">· {items.filter((i) => i.element_id === e.id).length}</span></label>
          ))}
        </details>
      )}
      <div className="fm-sub" style={{ padding: '0 12px 12px' }}>Nieuwe items komen in de actieve laag.<Info>Klik een laag om ze actief te maken. Via ⋯ stel je de stijl in, hernoem je een laag, steek je ze in een map of verwijder je ze. Sleep een laag op een map om ze erin te steken, of tussen andere lagen om de volgorde te wijzigen.</Info></div>
    </div>
  );
}
