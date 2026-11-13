'use client';

// Het detailpaneel: kop (naam, element, laag, fase, leverancier, ⋯-menu), kerngetal, tabs en voet.
// Zelfde skelet voor elke familie (zie familie.js); wat ertussen staat verschilt per familie (Eigenschappen.jsx).
import { getOrganisatie } from './merk';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ElementIcoon } from './BibliotheekPaneel';
import { Icoon } from './iconen';
import { sorteerCategorieen } from './categorieen';
import { familieVanElement } from './familie';
import { herkomstVan } from './stijl';
import { useLeveranciers, juisteNaam, zorgLeverancier } from './leveranciers';

const SOORT = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', element: 'Element', veelhoek: 'Regelmatige veelhoek', ellips: 'Ellips', sector: 'Kijkhoek', notitie: 'Notitie met pijl' };

// Naam: leeg = de elementnaam staat er grijs in. Bewaart na een korte pauze of bij Enter/verlaten.
function NaamVeld({ waarde, placeholder, uitgeschakeld, onBewaar }) {
  const [w, setW] = useState(waarde ?? '');
  const t = useRef(null);
  useEffect(() => { setW(waarde ?? ''); }, [waarde]);
  const bewaar = (v) => { clearTimeout(t.current); if ((v || '') !== (waarde || '')) onBewaar(v.trim() || null); };
  return <input className="fm-naam" value={w} placeholder={placeholder} disabled={uitgeschakeld} aria-label="Naam"
    onChange={(e) => { setW(e.target.value); clearTimeout(t.current); t.current = setTimeout(() => bewaar(e.target.value), 700); }}
    onBlur={() => bewaar(w)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setW(waarde ?? ''); }} />;
}

// Een keuzelijst die opent onder het veld (sluit bij klik ernaast of Escape). Zelfde look als een gewone select.
function useOpen() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const weg = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', weg); document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  return [open, setOpen, ref];
}

// Laag: het kleurtje staat in het veld en bij elke laag in de lijst. Lagen in een map staan onder de naam van de map.
function LaagKiezer({ lagen, laagId, uitgeschakeld, onWijzig }) {
  const [open, setOpen, ref] = useOpen();
  const huidig = lagen.find((l) => l.id === laagId);
  const kies = (id) => { setOpen(false); if ((id || null) !== (laagId || null)) onWijzig(id || null); };
  const rij = (l, diep = false) => (
    <button key={l.id} type="button" role="option" aria-selected={l.id === laagId} className={`${l.id === laagId ? 'aan' : ''}${diep ? ' diep' : ''}`} onClick={() => kies(l.id)}>
      <span className="bol" style={{ background: l.kleur || '#9A9EA6' }} />{l.naam}
    </button>
  );
  const lijst = []; const gezien = new Set();
  for (const l of lagen) {
    if (!l.map) { lijst.push(rij(l)); continue; }
    if (gezien.has(l.map)) continue;
    gezien.add(l.map);
    lijst.push(<div key={`m:${l.map}`} className="kop">{l.map}</div>, ...lagen.filter((x) => x.map === l.map).map((x) => rij(x, true)));
  }
  return (
    <div className="fm-kiesrij fm-kies-open" ref={ref}><span className="l">Laag</span>
      <button type="button" className="fm-kiesveld" disabled={uitgeschakeld} aria-label="Laag" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="bol" style={{ background: huidig?.kleur || '#9A9EA6' }} /><span className="w">{huidig?.naam || 'Zonder laag'}</span><Icoon naam="pijlomlaag" maat={11} />
      </button>
      {open && (
        <div className="fm-menu fm-kiesmenu" role="listbox">
          <button type="button" role="option" aria-selected={!laagId} className={!laagId ? 'aan' : ''} onClick={() => kies(null)}><span className="bol" style={{ background: '#9A9EA6' }} />Zonder laag</button>
          {lijst}
        </div>
      )}
    </div>
  );
}

// Fasen: een veld met de gekozen fasen, opent een lijstje met vinkjes (geen vinkje = in alle fasen).
function FaseKiezer({ fasen, faseIds, uitgeschakeld, onWijzig }) {
  const [open, setOpen, ref] = useOpen();
  const gekozen = fasen.filter((f) => faseIds?.includes(f.id));
  const tekst = !gekozen.length ? 'Alle fasen' : gekozen.map((f) => f.naam).join(', ');
  return (
    <div className="fm-kiesrij fm-kies-open" ref={ref}><span className="l">Fase</span>
      <button type="button" className="fm-kiesveld" disabled={uitgeschakeld} aria-label="Fase" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="In welke fasen dit item meetelt"><span className="w">{tekst}</span><Icoon naam="pijlomlaag" maat={11} /></button>
      {open && (
        <div className="fm-menu fm-kiesmenu">
          {fasen.map((f) => {
            const aan = !!faseIds?.includes(f.id);
            return <label key={f.id}><input type="checkbox" checked={aan} onChange={() => { const set = new Set(faseIds || []); if (aan) set.delete(f.id); else set.add(f.id); onWijzig(set.size ? [...set] : null); }} />{f.naam}</label>;
          })}
          <button type="button" onClick={() => { onWijzig(null); setOpen(false); }}>Alle fasen (geen vinkje)</button>
        </div>
      )}
    </div>
  );
}

// Het ⋯-menu: alles over dit item dat je zelden nodig hebt, op één plek. Dezelfde lijst als de rechtermuisknop.
export function ItemMenu({ item, el, open, onSluit, onActie, inGroep = false, iso = false, anker = null }) {
  const ref = useRef(null);
  // Vast op het scherm (niet in het scrollende paneel), rechts uitgelijnd onder de ⋯-knop.
  const stijl = anker ? { position: 'fixed', top: anker.bottom + 2, right: Math.max(8, window.innerWidth - anker.right), left: 'auto' } : undefined;
  useEffect(() => { if (!open) return undefined; const weg = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('.fm-menuanker')) onSluit(); }; const esc = (e) => { if (e.key === 'Escape') onSluit(); }; document.addEventListener('mousedown', weg); document.addEventListener('keydown', esc); return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', esc); }; }, [open, onSluit]);
  if (!open) return null;
  const g = item.geometrie?.type;
  const lijn = g === 'LineString'; const punt = g === 'Point';
  const doe = (a, arg) => { onSluit(); onActie(a, arg); };
  const K = ({ a, arg, kort, kind, children }) => <button type="button" className={kind || ''} onClick={() => doe(a, arg)}>{children}{kort && <small>{kort}</small>}</button>;
  return (
    <div className="fm-menu fm-itemmenu" ref={ref} role="menu" style={stijl} onClick={(e) => e.stopPropagation()}>
      <div className="fm-menukop">Dit item</div>
      <K a="zoom" kort="Z">Zoom naar item</K>
      <K a="dupliceren" kort="Ctrl D">Dupliceren</K>
      <K a="kopieer">Kopiëren (ook naar een ander plan)</K>
      <K a="verbergen">Verbergen</K>
      <K a="vastzetten">{item.vergrendeld ? 'Losmaken' : 'Vastzetten'}</K>
      {!punt && <K a="spiegel-x">Spiegelen ↔</K>}
      {!punt && <K a="spiegel-y">Spiegelen ↕</K>}
      {g === 'Polygon' && <K a="uitlijnen-weg">Evenwijdig aan de weg draaien</K>}
      {g === 'Polygon' && !(item.parameters?.breedte && item.parameters?.diepte) && <K a="punten-wissen">Punten wissen</K>}
      <div className="fm-menukop">Volgorde</div>
      <K a="voor">Naar voren</K>
      <K a="achter">Naar achteren</K>
      <div className="fm-menukop">Groep</div>
      {inGroep ? <>
        {!iso && <K a="iso">Groep apart bewerken</K>}
        <K a="groep-naam">Groep een naam geven…</K>
        <K a="degroeperen">Groep opheffen</K>
      </> : <K a="groeperen">Groeperen met de selectie</K>}
      {lijn && <>
        <div className="fm-menukop">Lijn</div>
        <K a="evenwijdig">Evenwijdige kopie…</K>
        <K a="verleng">Verder tekenen</K>
        <K a="punten-wissen">Punten wissen</K>
        {item.parameters?.route && <K a="route">Route aanpassen</K>}
        <K a="knip">Knippen op een punt</K>
        <K a="omkeren">Omkeren (tekenrichting)</K>
        <K a="langs-weg" arg="car">Langs de weg leggen<small>auto</small></K>
        <K a="langs-weg" arg="bike">Langs de weg leggen<small>fiets</small></K>
      </>}
      <div className="fm-menukop">Bewaren</div>
      {!el && <K a="bewaar-element">Bewaren als bibliotheek-element</K>}
      <K a="sjabloon">Bewaren als sjabloon</K>
      <hr />
      <K a="verwijderen" kort="Del" kind="gevaar">Verwijderen</K>
    </div>
  );
}

// Elementkeuze: wisselen binnen de familie. Lijnen: alle lijnelementen (of gewone lijn); vlak-elementen: een ander
// formaat van dezelfde soort, of dezelfde maat met een andere inhoud.
// Model kiezen met beeld: tegels per model, zoeken en filter per leverancier (zelfde opzet als de doekkiezer).
function ModelKnop({ el, per, levs, mk, kort, uit, onKies }) {
  const [open, setOpen] = useState(false); const [zoek, setZoek] = useState(''); const [lev, setLev] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const t = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true);
  }, [open]);
  const nu = mk(el); const z = zoek.trim().toLowerCase();
  const sleutels = [...per.keys()].filter((k) => (lev == null || k.split('|')[0] === lev) && (!z || k.toLowerCase().includes(z)))
    .sort((a, b) => (a === nu ? -1 : b === nu ? 1 : 0) || a.split('|')[1].localeCompare(b.split('|')[1], 'nl', { numeric: true }));
  return (
    <>
      <button type="button" className="fm-dk-knop gekozen" disabled={uit} aria-haspopup="dialog" onClick={() => setOpen(true)} style={{ flex: 1, minWidth: 0 }}>
        <span className="fm-dk-el"><ElementIcoon el={el} maat={34} /></span>
        <span className="tekst"><b>{kort(nu.split('|')[1])}</b><small>{el.leverancier || 'Leverancier vrij'}</small></span>
        {!uit && <span className="actie">Wijzigen</span>}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fm fm-appdialoog-achter" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="fm-appdialoog fm-dk-venster" role="dialog" aria-modal="true" aria-label="Model kiezen">
            <div className="fm-dk-kop"><span className="titel">Model kiezen</span><span style={{ flex: 1 }} /><button type="button" className="fm-sluit" aria-label="Sluiten" onClick={() => setOpen(false)}>×</button></div>
            <div className="fm-dk">
              <div className="fm-dk-balk"><input type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een model" aria-label="Zoek een model" /></div>
              <div className="fm-dk-filter" role="group" aria-label="Leverancier">
                <button type="button" aria-pressed={lev == null} className={lev == null ? 'aan' : ''} onClick={() => setLev(null)}>Alle · {per.size}</button>
                {levs.map((l) => <button key={l || '_'} type="button" aria-pressed={lev === l} className={lev === l ? 'aan' : ''} onClick={() => setLev(l)}>{l || 'Leverancier vrij'} · {[...per.keys()].filter((k) => k.split('|')[0] === l).length}</button>)}
              </div>
              <div className="fm-dk-tegels">
                {sleutels.map((k) => { const l = per.get(k); return (
                  <button key={k} type="button" className={`fm-dk-tegel${k === nu ? ' aan' : ''}`} title={k.split('|')[1]} onClick={() => { setOpen(false); if (k !== nu) onKies(k); }}>
                    <span className="fm-dk-el groot"><ElementIcoon el={l[0]} maat={56} /></span>
                    <b>{kort(k.split('|')[1])}</b>
                    <small>{[k.split('|')[0] || 'Leverancier vrij', l.length > 1 ? `${l.length} uitvoeringen` : null].filter(Boolean).join(' · ')}</small>
                  </button>
                ); })}
                {!sleutels.length && <div className="fm-sub" style={{ gridColumn: '1 / -1', padding: 8 }}>Niets gevonden.</div>}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function ElementKeuze({ item, el, elementen, uitgeschakeld, onWissel }) {
  const g = item.geometrie;
  if (!el && g?.type !== 'LineString') return <div className="fm-kiesrij stil"><span className="l">Soort</span><span className="w">{SOORT[item.soort] || item.soort}</span></div>;
  if (g?.type === 'LineString' && !item.parameters?.route && (item.soort === 'lijn' || el?.tekenwijze === 'lijn')) {
    const lijnEl = (elementen || []).filter((x) => x.tekenwijze === 'lijn' && x.actief !== false);
    const cats = sorteerCategorieen(new Set(lijnEl.map((x) => x.categorie || 'Overig')));
    return (
      <label className="fm-kiesrij"><span className="l">Element</span>
        <select value={item.element_id || ''} disabled={uitgeschakeld} onChange={(e) => onWissel(e.target.value || null, 'lijn')} aria-label="Soort lijn">
          <option value="">Gewone lijn (geen element)</option>
          {cats.map((c) => <optgroup key={c} label={c}>{lijnEl.filter((x) => (x.categorie || 'Overig') === c).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</optgroup>)}
        </select>
      </label>
    );
  }
  if (!el) return <div className="fm-kiesrij stil"><span className="l">Soort</span><span className="w">{SOORT[item.soort] || item.soort}</span></div>;
  // Platen gelegd als pad of vlak (rijplaten, vloercassettes): wisselen binnen de familie, ook naar een andere leverancier.
  if (el.tekenwijze === 'schaal' && !item.parameters?.midden && el.eigenschappen?.familie && (g?.type === 'LineString' || g?.type === 'Polygon')) {
    const f = el.eigenschappen.familie;
    const leden = (elementen || []).filter((x) => x.tekenwijze === 'schaal' && x.actief !== false && x.eigenschappen?.familie === f && !x.plan_id);
    if (leden.length > 1) {
      const nl = (a, b) => String(a).localeCompare(String(b), 'nl', { numeric: true });
      const levs = [...new Set(leden.map((x) => x.leverancier || ''))].sort((a, b) => (a === (el.leverancier || '') ? -1 : b === (el.leverancier || '') ? 1 : (!a) - (!b) || nl(a, b)));
      return (
        <label className="fm-kiesrij"><span className="l">Element</span>
          <select value={el.id} disabled={uitgeschakeld} aria-label="Element" onChange={(e) => { if (e.target.value !== el.id) onWissel(e.target.value, 'inhoud'); }}>
            {levs.map((l) => (
              <optgroup key={l || '_'} label={l ? `Van ${l}` : 'Algemeen (leverancier vrij)'}>
                {leden.filter((x) => (x.leverancier || '') === l).sort((a, b) => nl(a.naam, b.naam)).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      );
    }
  }
  if (el.tekenwijze === 'schaal' && item.parameters?.midden) {
    const fam = familieVanElement(el);
    const zelfde = (x) => Math.abs(Number(x.breedte_m) - Number(el.breedte_m)) < 0.02 && Math.abs(Number(x.diepte_m) - Number(el.diepte_m)) < 0.02;
    const prod = el.eigenschappen?.familie;
    const soort = (elementen || []).filter((x) => x.id !== el.id && x.tekenwijze === 'schaal' && x.actief !== false && familieVanElement(x) === fam && x.categorie === el.categorie
      && (prod ? x.eigenschappen?.familie === prod || /tent/i.test(el.categorie || '') : true));
    // Zelfde product bij een andere leverancier (bv. een statafel van Levi in plaats van Nima Rent): eigen groep.
    const anderLev = prod ? soort.filter((x) => (x.leverancier || '') !== (el.leverancier || '')) : [];
    const formaten = soort.filter((x) => !zelfde(x) && !anderLev.includes(x));
    const inhoud = soort.filter((x) => zelfde(x) && (x.leverancier || '') === (el.leverancier || ''));
    const sorteer = (l) => [...l].sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
    // Grote catalogus (bv. meubilair van Levi): eerst het model per leverancier, dan de uitvoering (kleur, hoogte …).
    if (prod && soort.length >= 8 && [el, ...soort].some((x) => x.eigenschappen?.model)) {
      const alle = [el, ...soort];
      const mk = (x) => `${x.leverancier || ''}|${x.eigenschappen?.model || x.naam}`;
      const per = new Map(); for (const v of alle) { const k = mk(v); if (!per.has(k)) per.set(k, []); per.get(k).push(v); }
      const nl = (a, b) => a.localeCompare(b, 'nl', { numeric: true });
      const levs = [...new Set(alle.map((x) => x.leverancier || ''))].sort((a, b) => (a === (el.leverancier || '') ? -1 : b === (el.leverancier || '') ? 1 : (!a) - (!b) || nl(a, b)));
      const ditModel = per.get(mk(el));
      const kort = (m) => { const [w, ...r] = String(m).split(' '); return r.length && w.toLowerCase().startsWith(prod.slice(0, 3).toLowerCase()) ? r.join(' ') : m; };
      const wissel = (x) => { if (x && x.id !== el.id) onWissel(x.id, zelfde(x) ? 'inhoud' : 'formaat'); };
      return (
        <>
          <div className="fm-kiesrij"><span className="l">Model</span>
            <ModelKnop el={el} per={per} levs={levs} mk={mk} kort={kort} uit={uitgeschakeld} onKies={(k) => { const l = per.get(k) || []; const u = el.eigenschappen?.uitvoering; wissel(l.find((x) => u && x.eigenschappen?.uitvoering === u) || l[0]); }} />
          </div>
          {ditModel.length > 1 && (
            <label className="fm-kiesrij"><span className="l">Uitvoering</span>
              <select value={el.id} disabled={uitgeschakeld} aria-label="Uitvoering" onChange={(e) => wissel(ditModel.find((x) => x.id === e.target.value))}>
                {[...ditModel].sort((a, b) => nl(a.eigenschappen?.uitvoering || a.naam, b.eigenschappen?.uitvoering || b.naam)).map((x) => <option key={x.id} value={x.id}>{x.eigenschappen?.uitvoering || x.naam}</option>)}
              </select>
            </label>
          )}
        </>
      );
    }
    return (
      <label className="fm-kiesrij"><span className="l">Element</span>
        <select value={el.id} disabled={uitgeschakeld} onChange={(e) => { const id = e.target.value; if (id === el.id) return; onWissel(id, inhoud.some((x) => x.id === id) || anderLev.some((x) => x.id === id && zelfde(x)) ? 'inhoud' : 'formaat'); }} aria-label="Element">
          <option value={el.id}>{el.naam}</option>
          {inhoud.length > 0 && <optgroup label="Zelfde maat, andere inhoud">{sorteer(inhoud).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</optgroup>}
          {formaten.length > 0 && <optgroup label="Ander formaat">{sorteer(formaten).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</optgroup>}
          {[...new Set(anderLev.map((x) => x.leverancier || ''))].sort((a, b) => (!a) - (!b) || a.localeCompare(b, 'nl')).map((l) => <optgroup key={l || '_'} label={l ? `Van ${l}` : 'Algemeen (leverancier vrij)'}>{sorteer(anderLev.filter((x) => (x.leverancier || '') === l)).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</optgroup>)}
        </select>
      </label>
    );
  }
  return <div className="fm-kiesrij stil"><span className="l">Element</span><span className="w">{el.naam}</span></div>;
}

export function PaneelKop({ std = null, item, el, elementen, lagen, fasen, items, elementenMap, schrijven, onWijzig, onWissel, onActie, groepNaam = '', groepAantal = 0, iso = false, slot = null }) {
  const [menu, setMenu] = useState(false);
  const [anker, setAnker] = useState(null);
  const ro = !schrijven;
  const velden = item.velden || {};
  const naamLabel = item.soort === 'tekst' || item.soort === 'notitie' ? 'Tekst' : 'Naam';
  const levLijst = useLeveranciers();
  const herkomsten = [...new Set([getOrganisatie()?.kort || 'Organisator', 'Gemeente', ...levLijst.filter((l) => l.actief !== false).map((l) => l.naam), ...(items || []).map((x) => herkomstVan(x, elementenMap.get(x.element_id), std)), ...Object.values(std || {}), ...(elementen || []).map((x) => x.leverancier)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
  // Wie deze categorie levert eerst (bv. bij een toiletcabine: GSV Verhuur, Nima Rent, Toekoer …), daarna de rest.
  const levertHier = new Set(levLijst.filter((l) => el?.categorie && (l.categorieen || []).includes(el.categorie)).map((l) => l.naam));
  herkomsten.sort((a, b) => (levertHier.has(b) - levertHier.has(a)) || a.localeCompare(b, 'nl'));
  return (
    <div className="fm-paneelkop2">
      <div className="fm-naamrij">
        <span className="l">{naamLabel}</span>
        <NaamVeld waarde={item.naam} placeholder={el?.naam || SOORT[item.soort] || ''} uitgeschakeld={ro} onBewaar={(v) => onWijzig({ naam: v })} />
        {schrijven && (
          <span className="fm-menuanker">
            <button type="button" className="fm-ik" title="Meer" aria-haspopup="menu" aria-expanded={menu} data-menuknop onClick={(e) => { e.stopPropagation(); setAnker(e.currentTarget.getBoundingClientRect()); setMenu((m) => !m); }}>⋯</button>
            <ItemMenu item={item} el={el} open={menu} onSluit={() => setMenu(false)} onActie={onActie} inGroep={!!item.groep_id} iso={iso} anker={anker} />
          </span>
        )}
      </div>
      <ElementKeuze item={item} el={el} elementen={elementen} uitgeschakeld={ro} onWissel={onWissel} />
      <LaagKiezer lagen={lagen} laagId={item.laag_id} uitgeschakeld={ro} onWijzig={(id) => onWijzig({ laag_id: id })} />
      {fasen.length > 0 && <FaseKiezer fasen={fasen} faseIds={item.fase_ids} uitgeschakeld={ro} onWijzig={(ids) => onWijzig({ fase_ids: ids })} />}
      {el && el.tekenwijze !== 'doek' && (
        <label className="fm-kiesrij" title="Wie brengt dit voor dit event. Leeg = de leverancier uit de bibliotheek. De stuklijst en de leverlijsten splitsen hierop."><span className="l">Leverancier</span>
          <input key={item.id} list="fm-herkomsten" defaultValue={velden.herkomst || ''} placeholder={el.leverancier ? `${el.leverancier} (standaard)` : std?.[el.categorie] ? `${std[el.categorie]} (standaard van het plan)` : 'Niet ingevuld'} disabled={ro}
            onBlur={(e) => { const v = juisteNaam(e.target.value, levLijst); if (v !== (velden.herkomst || '')) { onWijzig({ velden: { ...velden, herkomst: v || null } }); if (v) zorgLeverancier(v); } }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Geleverd door" />
          <datalist id="fm-herkomsten">{herkomsten.map((v) => <option key={v} value={v}>{levertHier.has(v) ? `levert ${el?.categorie}` : ""}</option>)}</datalist>
        </label>
      )}
      {(item.groep_id || item.vergrendeld || slot) && (
        <div className="fm-kopchips">
          {item.groep_id && <button type="button" className="fm-chip" title="Groep: klik om de groep apart te bewerken" onClick={() => onActie('iso')}>{groepNaam || 'Groep'} · {groepAantal} items</button>}
          {item.vergrendeld && <button type="button" className="fm-chip" title="Vastgezet: klik om los te maken" onClick={() => onActie('vastzetten')}><Icoon naam="slot" maat={11} /> vast</button>}
          {slot && <span className="fm-chip rood">{slot}</span>}
        </div>
      )}
    </div>
  );
}

export function Kern({ groot, klein }) {
  if (!groot && !klein) return null;
  return <div className="fm-kern">{groot && <div className="groot">{groot}</div>}{klein && <div className="klein">{klein}</div>}</div>;
}

export function PaneelTabs({ tabs, tab, onTab }) {
  const lijst = tabs.filter(Boolean);
  if (lijst.length < 2) return null;
  return (
    <div className="fm-tabs fm-paneeltabs" role="tablist">
      {lijst.map((t) => <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={tab === t.k ? 'aan' : ''} onClick={() => onTab(t.k)}>{t.naam}{t.teller != null && <span className="teller">{t.teller}</span>}</button>)}
    </div>
  );
}
