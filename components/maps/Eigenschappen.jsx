'use client';

import { isStellingBouw } from './stellingbouw';
import { isCameraStelling, isLosseTvCamera, tvCamTekst, LENZEN, OPSTELLINGEN } from './tvcamera';
import { isTentCategorie } from './categorieen';
import { isKabelcam, kabelcamInst, kabelcamGeo, kabelcamTekst, kabelcamMeldingen } from './kabelcam';
import { vereenvoudigLijn } from './uitwisseling';
import Info from './info';
import { brugCfg, brugMaten, brugStukken } from './rennersbrug';
import Blok from './blok';
import { LaagOpties } from './laagOpties';
import { vraagTekst } from './dialoog';
import { Fragment, useEffect, useRef, useState } from 'react';
import { parcoursKant, andereKant, pootjesKant } from './hekzijde';
import { isDeurElement, isPoortElement, deurLijnId, deurBreedte, schuifOpening, deurPlaats } from './deur';
import { effectieveStijl, tekeningZijdig, maten, matenTekst, modules, KLEUREN, VULLINGEN, toebehorenTelling, toebehorenVan, toebehorenInst, driehoekPlekken, nadenVan, doekRuns, overlapVan, overlapKanten, overlapLangs, padMaat, isRijpad, verspringVan, heeftFracties, fractiesVan, toegelatenFracties, fractieVan, rijenVan, isTotem, isPaneel, isVlag, isVlagHek, isFrame, isDrape, totemPanelen, TOTEM_ZIJDEN, herkomstVan, trussDoek, zijdenVan, moduleMaat, hellingVan, inBanen, tentVloerItem, hulpKleur, toebehorenNaam } from './stijl';
import { KAARTICONEN, IcoonSvg, IcoonKiezer, icoonNaam } from './kaarticonen';
import { Snelstijlen, StijlVisueel } from './LijnStijl';
import * as geo from './geo';
import { stroomVan, ROLLEN, FASEN_EL, AANSLUITINGEN, KABELTYPES, kabelBestelling, kabelLengtesVan, kabelLengte, isMonoKnoop } from './stroom';
import { alsStroomItem, UITGANG_TYPES } from './vasteAansluitingen';
import { publiekeUrl } from './db';
import { AttestenBewerken } from './attesten';
import { FotoStrook } from './fotos';
import WandBouwer, { telAlleWanden } from './WandBouwer';
import { TrussBlok } from './TrussBlok';
import { StellingBlok } from './StellingBlok';
import { TentBlok } from './TentBlok';
import { openStreetView } from './streetview';
import { isLichtmast, lichtBereik } from './licht';
import { LichtBlok } from './LichtBlok';
import { Icoon } from './iconen';
import { isTentBouw } from './tentbouw';
import { Knop3D, Groot3D } from './drie3d';
import { isWand, zijLengtes } from './framewand';
import { isPubliekeStructuur, capaciteit, instBrand } from './veiligheid';
import { sorteerCategorieen } from './categorieen';
import { familieVan } from './familie';
import { magModule } from './modules';
import { PaneelKop, Kern, PaneelTabs } from './Paneel';

const SOORT = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', element: 'Element', veelhoek: 'Regelmatige veelhoek', ellips: 'Ellips', sector: 'Kijkhoek', notitie: 'Notitie met pijl' };

// Invoerveld dat meteen (na een korte pauze in het typen) toepast, en ook bij
// Enter of bij het verlaten van het veld.
function Veld({ label, waarde, onBewaar, soort = 'text', uitgeschakeld, eenheid, rijen, ...rest }) {
  const [w, setW] = useState(waarde ?? '');
  const timer = useRef(null);
  const bewaardRef = useRef(waarde);
  useEffect(() => { bewaardRef.current = waarde; if (!timer.current) setW(waarde ?? ''); }, [waarde]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const bewaar = (v = w, opBlur = true) => {
    clearTimeout(timer.current); timer.current = null;
    if (String(v) === String(bewaardRef.current ?? '')) return;
    if (soort === 'number') {
      const t = String(v).replace(',', '.').trim();
      if (t === '') { if (opBlur) { bewaardRef.current = ''; onBewaar(0); } return; }
      const n = Number(t);
      if (Number.isFinite(n)) { bewaardRef.current = n; onBewaar(n); } else if (opBlur) setW(waarde ?? '');
    } else { bewaardRef.current = v; onBewaar(v); }
  };
  const props = {
    value: w, disabled: uitgeschakeld,
    onChange: (e) => {
      const v = e.target.value;
      setW(v);
      clearTimeout(timer.current);
      // Getallen snel, tekst iets later (minder tussenstappen in Ongedaan maken).
      timer.current = setTimeout(() => bewaar(v, false), soort === 'number' ? 450 : 700);
    },
    onBlur: () => bewaar(w, true),
    onKeyDown: (e) => { if (e.key === 'Enter' && !rijen) { e.currentTarget.blur(); } if (e.key === 'Escape') { setW(waarde ?? ''); } },
    ...rest,
  };
  return (
    <label className="fm-veld">{label}{eenheid ? ` (${eenheid})` : ''}
      {rijen ? <textarea rows={rijen} {...props} /> : <input type={soort === 'number' ? 'text' : soort} inputMode={soort === 'number' ? 'decimal' : undefined} {...props} />}
    </label>
  );
}

function Segment({ waarden, waarde, onKies, uitgeschakeld }) {
  return (
    <div className="fm-segment">
      {waarden.map(([k, t]) => <button key={k} className={waarde === k ? 'aan' : ''} disabled={uitgeschakeld} onClick={() => onKies(k)}>{t}</button>)}
    </div>
  );
}

export function PlanAlgemeen({ plan, items, schrijven, onPlan, elementenMap }) {
  const tb = plan.titelblok || {};
  const zetTb = (k, v) => onPlan({ titelblok: { ...tb, [k]: v } });
  let capaciteit = 0;
  for (const it of items) capaciteit += maten(it, elementenMap.get(it.element_id)).capaciteit || 0;
  return (
    <div>
      <div className="fm-sectie">
        <Veld label="Naam van het plan" waarde={plan.naam} onBewaar={(v) => v && onPlan({ naam: v })} uitgeschakeld={!schrijven} />
        <Veld label="Wedstrijd of editie" waarde={plan.editie_naam} onBewaar={(v) => onPlan({ editie_naam: v || null })} uitgeschakeld={!schrijven} />
        <Veld label="Locatie" waarde={plan.locatie} onBewaar={(v) => onPlan({ locatie: v || null })} uitgeschakeld={!schrijven} />
        <label className="fm-veld">Status
          <select value={plan.status} disabled={!schrijven} onChange={(e) => onPlan({ status: e.target.value })}>
            <option value="concept">Concept</option><option value="definitief">Definitief</option>
          </select>
        </label>
        <div className="fm-raster2">
          <div style={{ padding: 10, border: '1px solid #e8e8e6' }}><div className="fm-sub">Items</div><div style={{ fontSize: 18, fontWeight: 600 }}>{items.length}</div></div>
          <div style={{ padding: 10, border: '1px solid #e8e8e6' }}><div className="fm-sub">Capaciteit</div><div style={{ fontSize: 18, fontWeight: 600 }}>{capaciteit ? capaciteit.toLocaleString('nl-BE') : '–'}</div></div>
        </div>
      </div>
      <Blok titel="Titelblok voor de PDF" open={!!(tb.organisatie || tb.tekenaar || tb.datum)} info="Komt in het titelblok van elke PDF op schaal.">
        <Veld label="Organisatie" waarde={tb.organisatie} onBewaar={(v) => zetTb('organisatie', v)} uitgeschakeld={!schrijven} placeholder="bv. RIA vzw" />
        <Veld label="Ondernemingsnummer" waarde={tb.ondernemingsnummer} onBewaar={(v) => zetTb('ondernemingsnummer', v)} uitgeschakeld={!schrijven} />
        <Veld label="Adres" waarde={tb.adres} onBewaar={(v) => zetTb('adres', v)} uitgeschakeld={!schrijven} rijen={2} />
        <Veld label="Tekenaar" waarde={tb.tekenaar} onBewaar={(v) => zetTb('tekenaar', v)} uitgeschakeld={!schrijven} />
        <Veld label="Datum van het event" waarde={tb.datum} onBewaar={(v) => zetTb('datum', v)} uitgeschakeld={!schrijven} placeholder="bv. 4 april 2027" />
      </Blok>
      <Blok titel="Koppeling met Entry" open={!!plan.edition_id} info="Editie-ID van het event. Zones en parkings met een Entry-instelling (bij Planning en notitie van een item) horen dan bij die editie.">
        <Veld label="Editie-ID" waarde={plan.edition_id} onBewaar={(v) => onPlan({ edition_id: v || null })} uitgeschakeld={!schrijven} placeholder="optioneel" />
      </Blok>
    </div>
  );
}

export default function Eigenschappen(props) {
  const { item, groepNaam = '', onGroepNaam = () => {}, groepAantal = 0, binnenplan = null, plan, lagen, fasen, elementen, doeken: alleDoeken = [], doekPenseel = null, onDoekPenseel = () => {}, elementenMap, lagenMap, items, schrijven,
    onWijzig, onStijl, onGeometrie, onDupliceer, onVerwijder, onRaster, onLangsLijn, onAlsElement, onPlan, onZoom, onKabel, onActie, gekopieerdeStijl, plannen, fotos, uitgebreid = true, snelstijlen = [], vast = [], onMenu = null, iso = false } = props;
  const dragerVanOntwerp = (d) => d?.eigenschappen?.drager || 'hek';
  const doeken = alleDoeken.filter((d) => dragerVanOntwerp(d) === 'hek');
  const panelen = alleDoeken.filter(isPaneel);
  const vlagOntwerpen = alleDoeken.filter((d) => dragerVanOntwerp(d) === 'vlag');
  const trussDoeken = alleDoeken.filter((d) => dragerVanOntwerp(d) === 'truss');
  const frameDoeken = alleDoeken.filter((d) => dragerVanOntwerp(d) === 'frame');
  const drapeDoeken = alleDoeken.filter((d) => dragerVanOntwerp(d) === 'drape');
  const [raster, setRaster] = useState({ rijen: 2, kolommen: 4, x: 2, y: 2 });
  const [langs, setLangs] = useState({ element: '', interval: 10 });
  const [vakKeuze, setVakKeuze] = useState([]); // gekozen vakken in een vlakvullend element ('i,j'); Ctrl/Shift: meerdere
  const [tabKeuze, setTabKeuze] = useState(null); // gekozen tab; null = de standaardtab van de familie
  const [tbOpen, setTbOpen] = useState(null); // welk toebehoren open staat (chip aangeklikt)
  useEffect(() => { setTabKeuze(null); setTbOpen(null); }, [item?.id]);

  if (!plan) return null;
  if (!item) return <PlanAlgemeen plan={plan} items={items} schrijven={schrijven} onPlan={onPlan} elementenMap={elementenMap} />;

  const laag = lagenMap.get(item.laag_id);
  const el = item.element_id ? elementenMap.get(item.element_id) : null;
  const s = effectieveStijl(item, laag, el);
  const m = maten(item, el);
  const g = item.geometrie;
  const p = item.parameters || {};
  const ro = !schrijven;
  const isVlak = g.type === 'Polygon';
  const isLijn = g.type === 'LineString';
  const parametrisch = isVlak && p.breedte && p.diepte;
  // Weergave-opties (naam, maten, oppervlakte) tellen niet als eigen stijl.
  const WEERGAVE = ['label', 'maten', 'opp', 'tekening_tekst', 'zone_m'];
  const eigenStijl = item.stijl && Object.keys(item.stijl).some((k) => !WEERGAVE.includes(k));
  const velden = item.velden || {};
  const zetVeld = (k, v) => onWijzig({ velden: { ...velden, [k]: v } });
  const tekening = item.soort === 'element' ? el?.eigenschappen?.tekening : null;
  // Vlakvullend element: maten springen naar een veelvoud van één stuk.
  const modMaat = (as) => { if (!el?.eigenschappen?.module) return null; const r = Number(p.module_rot) === 90; return Number(as === 'b' ? (r ? el.diepte_m : el.breedte_m) : (r ? el.breedte_m : el.diepte_m)) || null; };
  const okant = el?.eigenschappen?.module ? overlapKanten(item, el) : { lang: 0, kort: 0 };
  const snapM = (v, m, ovl) => (m ? Math.max(1, Math.round((v - ovl) / Math.max(0.05, m - ovl))) * (m - ovl) + ovl : v);
  const snapB = (v) => snapM(v, modMaat('b'), overlapLangs(okant, modMaat('d') || 0, modMaat('b') || 0));
  const snapD = (v) => snapM(v, modMaat('d'), overlapLangs(okant, modMaat('b') || 0, modMaat('d') || 0));
  const kg = Number(el?.eigenschappen?.gewicht_kg) || 0;
  const ton = (n) => (kg ? ` · ${geo.getal((n * kg) / 1000, 1)} ton` : '');

  const isPunt = g?.type === 'Point' && item.soort !== 'tekst';
  // Lijnen en vlakken: snelstijlen + visueel paneel.
  const nieuw = (isLijn || isVlak) && item.soort !== 'notitie';
  const BEHOUD_BIJ_SNELSTIJL = [...WEERGAVE, 'afronden', 'tekst_langs', 'tekstgrootte', 'tekst_rot', 'vet', 'cursief', 'achtergrond'];
  const pasSnelstijlToe = (x) => onWijzig({ stijl: { ...Object.fromEntries(Object.entries(item.stijl || {}).filter(([k]) => BEHOUD_BIJ_SNELSTIJL.includes(k))), ...x.stijl } });
  const renderStijl = () => (item.soort === 'element' && el ? (
      <Blok titel="Opmaak · vast" open={false}>
        <div className="fm-sub">De opmaak van {el.naam} ligt vast in de bibliotheek.<Info>Zo ziet elk {el.tekenwijze === 'lijn' ? 'hek' : 'element'} er in elk plan hetzelfde uit. Aanpassen via Bibliotheek beheren.</Info></div>
        {eigenStijl && schrijven && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onWijzig({ stijl: Object.fromEntries(Object.entries(item.stijl || {}).filter(([k]) => [...WEERGAVE, 'afronden'].includes(k))) })}>Oude eigen opmaak weghalen</button>}
      </Blok>
    ) : (
      <Blok titel={`Stijl · ${eigenStijl ? 'eigen' : 'volgt de laag'}`} open={!!eigenStijl || item.soort === 'tekst' || isPunt || nieuw} rechts={eigenStijl && schrijven ? <button className="fm-knop klein" title="Eigen stijl weghalen, zodat het item weer de laag volgt" onClick={(e) => { e.preventDefault(); onWijzig({ stijl: Object.fromEntries(Object.entries(item.stijl || {}).filter(([k]) => WEERGAVE.includes(k))) }); }}>Terug naar laagstijl</button> : null}>
        {!eigenStijl && <div className="fm-sub">Volgt {el ? 'het element en ' : ''}de laag {laag?.naam || ''}.<Info>Een wijziging hier geldt enkel voor dit item.</Info></div>}
        {nieuw && (
          <>
            <Snelstijlen soort={isVlak ? 'vlak' : 'lijn'} eigen={snelstijlen} plan={plan.instellingen?.stijlen || []} huidig={s} uitgeschakeld={ro} onKies={pasSnelstijlToe} />
            <details className="fm-meer" open={!!eigenStijl}><summary>Aanpassen{eigenStijl ? ' · enkel dit item' : ''}</summary>
              <StijlVisueel s={s} soort={isVlak ? 'vlak' : 'lijn'} uitgeschakeld={ro} onStijl={onStijl} VULLINGEN={VULLINGEN} />
            </details>
          </>
        )}
        {!isPunt && !nieuw && <div>
          <div className="fm-sub" style={{ marginBottom: 4 }}>{item.soort === 'tekst' ? 'Tekstkleur' : 'Lijnkleur'}</div>
          <div className="fm-kleuren">
            {KLEUREN.map((k) => <button key={k} className={s.kleur.toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} aria-label={k} disabled={ro} onClick={() => onStijl({ kleur: k })} />)}
            <input type="color" value={s.kleur} disabled={ro} onChange={(e) => onStijl({ kleur: e.target.value })} aria-label="Eigen kleur" title="Eigen kleur" style={{ padding: 0, border: '1px solid #DADDE3' }} />
          </div>
        </div>}
        {(g.type === 'Point' || item.parameters?.midden) && (
          <button type="button" className="fm-knop klein fm-sv-knop" title="Opent Google Street View in een nieuw tabblad, op het dichtste beeld bij dit punt" onClick={() => openStreetView(g.type === 'Point' ? g.coordinates : item.parameters.midden, item.parameters?.richting ?? null)}><Icoon naam="streetview" maat={14} />Street View hier</button>
        )}
        {g.type === 'Point' && item.soort !== 'tekst' && (
          <>
            <div className="fm-kop" style={{ marginTop: 4 }}>Icoon en kleur{s.icoon ? ` · ${icoonNaam(s.icoon)}` : ''}</div>
            <IcoonKiezer waarde={s.icoon} kleur={s.kleur} uitgeschakeld={ro} onKies={(k) => onStijl({ icoon: k })} onKleur={(k) => onStijl({ kleur: k })} />
            {s.icoon && KAARTICONEN[s.icoon] && <div className="fm-sub">Ouder icoon: <IcoonSvg naam={s.icoon} maat={14} /> {KAARTICONEN[s.icoon].naam}. Kies een icoon uit de lijst om te vervangen.</div>}
            <details className="fm-meer"><summary>Grootte op de kaart</summary>
            <Veld label="Ware grootte (diameter)" eenheid="m" soort="number" waarde={s.icoon_m || ''} uitgeschakeld={ro} onBewaar={(v) => onStijl({ icoon_m: v > 0 ? v : null })} placeholder="leeg = vaste grootte op het scherm" />
            </details>
            <div className="fm-raster2">
              <Veld label="Nummer" waarde={velden.nr ?? ''} onBewaar={(v) => zetVeld('nr', v === '' ? null : v)} uitgeschakeld={ro} placeholder="bv. 12" />
              {schrijven && <button className="fm-knop klein" style={{ alignSelf: 'end' }} title="Nummert alle punten in deze laag met hetzelfde icoon" onClick={() => onActie?.('nummeren')}>Reeks nummeren</button>}
            </div>
          </>
        )}
        {(item.soort === 'tekst' || isVlak || isLijn) && (
          <details className="fm-meer" open={item.soort === 'tekst'}><summary>Tekst</summary>
          <div className="fm-raster2">
            <Veld label="Tekstgrootte" eenheid="pt" soort="number" waarde={s.tekstgrootte} uitgeschakeld={ro} onBewaar={(v) => v > 4 && onStijl({ tekstgrootte: v })} />
            {item.soort === 'tekst' && (
              <label className="fm-veld">Tonen
                <select value={String(Number(s.vanaf_zoom) || 0)} disabled={ro} onChange={(e) => onStijl({ vanaf_zoom: Number(e.target.value) || null })}>
                  <option value="0">Altijd</option>
                  <option value="17">Pas vanaf zoom 17 (wijk)</option>
                  <option value="18">Pas vanaf zoom 18 (straat)</option>
                  <option value="19">Pas vanaf zoom 19 (dichtbij)</option>
                  <option value="20">Pas vanaf zoom 20 (heel dichtbij)</option>
                </select>
              </label>
            )}
            {(item.soort === 'tekst' || isVlak) && <Veld label="Tekst draaien" eenheid="°" soort="number" waarde={s.tekst_rot || 0} uitgeschakeld={ro} onBewaar={(v) => onStijl({ tekst_rot: v })} />}
          </div>
          {(item.soort === 'tekst' || isVlak) && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label className="fm-vink"><input type="checkbox" checked={item.soort === 'tekst' ? s.vet !== false : !!s.vet} disabled={ro} onChange={(e) => onStijl({ vet: e.target.checked })} />Vet</label>
              <label className="fm-vink"><input type="checkbox" checked={!!s.cursief} disabled={ro} onChange={(e) => onStijl({ cursief: e.target.checked })} />Cursief</label>
              <label className="fm-vink"><input type="checkbox" checked={!!s.achtergrond} disabled={ro} onChange={(e) => onStijl({ achtergrond: e.target.checked })} />Witte achtergrond</label>
            </div>
          )}
          {isLijn && <label className="fm-vink"><input type="checkbox" checked={!!s.tekst_langs} disabled={ro} onChange={(e) => onStijl({ tekst_langs: e.target.checked })} />Naam langs de lijn</label>}
          </details>
        )}
        {item.soort !== 'tekst' && g.type !== 'Point' && (
          <>
            {!nieuw && <>
            <div className="fm-raster2">
              <Veld label="Dikte" eenheid={s.dikte_eenheid === 'm' ? 'm' : 'px'} soort="number" waarde={s.dikte} uitgeschakeld={ro} onBewaar={(v) => v > 0 && onStijl({ dikte: v })} />
              <div className="fm-veld">Eenheid<Segment waarden={[['px', 'px'], ['m', 'meter']]} waarde={s.dikte_eenheid} uitgeschakeld={ro} onKies={(k) => onStijl({ dikte_eenheid: k })} /></div>
            </div>
            <div className="fm-veld">Lijnstijl
              <Segment waarden={[['vol', 'Vol'], ['streep', 'Streep'], ['stip', 'Stip'], ['streeppunt', 'Streep-punt']]} waarde={s.streep} uitgeschakeld={ro} onKies={(k) => onStijl({ streep: k })} />
            </div>
            <label className="fm-vink"><input type="checkbox" checked={!!s.wit_rand} disabled={ro} onChange={(e) => onStijl({ wit_rand: e.target.checked })} />Witte rand (leesbaar op luchtfoto)</label>
            </>}
            {isLijn && item.soort !== 'notitie' && (uitgebreid || Number(s.dubbel) > 0 || s.patroon_interval) && (
              <details className="fm-meer" open={!!s.patroon_interval}><summary>Dubbele lijn en patroonlijn</summary>
                <Veld label="Dubbele lijn, tussenafstand" eenheid="m" soort="number" waarde={s.dubbel || ''} uitgeschakeld={ro} onBewaar={(v) => onStijl({ dubbel: v > 0 ? v : null })} placeholder="bv. 6 (nadars aan beide kanten)" />
                <div className="fm-sub">Patroonlijn: een symbool om de x meter (bv. boarding).</div>
                <div className="fm-raster3">
                  <label className="fm-veld">Icoon
                    <select value={s.patroon_icoon || ''} disabled={ro} onChange={(e) => onStijl({ patroon_icoon: e.target.value || null })}>
                      <option value="">Geen</option>{Object.entries(KAARTICONEN).map(([k, v]) => <option key={k} value={k}>{v.naam}</option>)}
                    </select>
                  </label>
                  <Veld label="Of tekst" waarde={s.patroon_tekst || ''} uitgeschakeld={ro} onBewaar={(v) => onStijl({ patroon_tekst: v || null })} placeholder="bv. LOGO" />
                  <Veld label="Om de" eenheid="m" soort="number" waarde={s.patroon_interval || ''} uitgeschakeld={ro} onBewaar={(v) => onStijl({ patroon_interval: v > 0 ? v : null })} />
                </div>
              </details>
            )}
          </>
        )}
        {!nieuw && <label className="fm-veld">Dekking · {Math.round((s.dekking ?? 1) * 100)}%
          <input type="range" min="0.1" max="1" step="0.05" value={s.dekking ?? 1} disabled={ro} onChange={(e) => onStijl({ dekking: Number(e.target.value) })} style={{ padding: 0, border: 0, height: 24 }} />
        </label>}
        {isVlak && (
          <>
            {!nieuw && <div className="fm-veld">Vulling
              <select value={s.vulpatroon || 'effen'} disabled={ro} onChange={(e) => onStijl({ vulpatroon: e.target.value })}>
                {VULLINGEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </div>}
            {s.vulpatroon === 'trap' && (
              <div className="fm-raster2">
                <div className="fm-veld">Looprichting
                  <Segment waarden={[['x', '→'], ['-x', '←'], ['y', '↑'], ['-y', '↓']]} waarde={s.trap_richting || 'x'} uitgeschakeld={ro} onKies={(k) => onStijl({ trap_richting: k })} />
                </div>
                <Veld label="Trede" eenheid="m" soort="number" waarde={s.trede || 0.3} uitgeschakeld={ro} onBewaar={(v) => v >= 0.1 && onStijl({ trede: v })} />
              </div>
            )}
            {s.vulpatroon === 'trap' && !parametrisch && <div className="fm-sub">Treden werken op rechthoeken en elementen op schaal.</div>}
            {!nieuw && <>
            <div>
              <div className="fm-sub" style={{ marginBottom: 4 }}>Vulkleur</div>
              <div className="fm-kleuren">
                {KLEUREN.map((k) => <button key={k} className={String(s.vulkleur).toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} aria-label={`Vulling ${k}`} disabled={ro} onClick={() => onStijl({ vulkleur: k })} />)}
                <input type="color" value={s.vulkleur || s.kleur} disabled={ro} onChange={(e) => onStijl({ vulkleur: e.target.value })} aria-label="Eigen vulkleur" title="Eigen kleur" style={{ padding: 0, border: '1px solid #DADDE3' }} />
              </div>
            </div>
            <label className="fm-veld">Dekking vulling · {Math.round((s.vuldekking ?? 0.2) * 100)}%
              <input type="range" min="0" max="1" step="0.05" value={s.vuldekking ?? 0.2} disabled={ro} onChange={(e) => onStijl({ vuldekking: Number(e.target.value) })} style={{ padding: 0, border: 0, height: 24 }} />
            </label>
            </>}
          </>
        )}
        {schrijven && nieuw && (
          <div className="fm-stijlvoet">
            <button className="fm-knop klein" title="Pipet: stijl kopiëren" onClick={() => onActie?.('stijl-kopieren')}>Kopiëren</button>
            <button className="fm-knop klein" disabled={!gekopieerdeStijl} onClick={() => onActie?.('stijl-plakken')}>Plakken</button>
            <button className="fm-knop klein zwart" title="Voor de hele organisatie: iedereen ziet deze snelstijl" onClick={() => onActie?.('snelstijl-bewaren', isVlak ? 'vlak' : 'lijn')}>Als snelstijl bewaren</button>
          </div>
        )}
        {schrijven && uitgebreid && !nieuw && (
          <details className="fm-meer"><summary>Stijl kopiëren of bewaren</summary>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="fm-knop klein" title="Pipet: stijl kopiëren" onClick={() => onActie?.('stijl-kopieren')}>Stijl kopiëren</button>
            <button className="fm-knop klein" disabled={!gekopieerdeStijl} onClick={() => onActie?.('stijl-plakken')}>Stijl plakken</button>
            <select value="" onChange={(e) => e.target.value && onActie?.('stijl-toepassen', e.target.value)} style={{ height: 30 }} aria-label="Benoemde stijl">
              <option value="">Benoemde stijl…</option>
              {(plan.instellingen?.stijlen || []).map((x) => <option key={x.naam} value={x.naam}>{x.naam}</option>)}
            </select>
            <button className="fm-knop klein" onClick={() => onActie?.('stijl-bewaren')}>Bewaar als stijl</button>
          </div>
          </details>
        )}
      </Blok>
  ));
  // Opstelling van een element: montage, stapelen, verdieping, inrichting, toebehoren, CAD.
  const opstelling = item.soort === 'element' ? [
      item.soort === 'element' && el?.eigenschappen?.generator === 'rennersbrug' && (() => {
        const cfg = brugCfg(p); const m = brugMaten(cfg); const st = brugStukken(cfg);
        const zet = (patch) => {
          const nc = { ...cfg, ...patch }; const nm = brugMaten(nc);
          onGeometrie(geo.elementVeelhoek(p.midden || geo.middelpunt(g), nm.breedte, nm.diepte, p.rot || 0), { breedte: nm.breedte, diepte: nm.diepte, brug: nc });
        };
        const stap = (k, min, max, label, sub) => (
          <div className="fm-veld">{label}
            <div className="fm-stapper"><button disabled={ro || cfg[k] <= min} onClick={() => zet({ [k]: cfg[k] - 1 })}>−</button><span>{cfg[k]}</span><button disabled={ro || cfg[k] >= max} onClick={() => zet({ [k]: cfg[k] + 1 })}>+</button></div>
            <span className="fm-sub">{sub}</span>
          </div>
        );
        return (
          <div className="fm-module">
            <div className="fm-raster2">
              {stap('doorgang', 1, 8, 'Doorgang (vakken)', `${geo.getal(cfg.doorgang * 2.072, 2)} m`)}
              {stap('helling', 2, 12, 'Helling per kant (vakken)', `${geo.getal(m.Lh, 2)} m`)}
            </div>
            <div className="fm-raster2">
              <label className="fm-veld">Breedte
                <select value={cfg.breedte} disabled={ro} onChange={(e) => zet({ breedte: e.target.value })}>
                  <option value="5.18">5,18 m (2,07 + 1,04 + 2,07)</option>
                  <option value="4.14">4,14 m (2,07 + 2,07)</option>
                </select>
              </label>
              <Veld label="Vrije hoogte doorgang" eenheid="m" soort="number" waarde={cfg.hoogte} uitgeschakeld={ro} onBewaar={(v) => zet({ hoogte: Number(String(v).replace(',', '.')) || cfg.hoogte })} />
            </div>
            <div className="fm-sub" style={{ color: m.procent > 25 ? '#B4123A' : undefined }}>
              Helling {geo.getal(m.graden, 1)}° · {Math.round(m.procent)} % (stijgt {geo.getal(m.stijg, 2)} m over {geo.getal(m.Lh, 2)} m){m.procent > 25 ? ' · steil: neem een vak meer' : ''}
            </div>
            <div className="fm-sub">Totaal {geo.getal(m.L, 2)} m lang (met aanloop van 1,76 m aan elke kant) · {st.vloer} vloerelementen · {st.helling} hellingelementen</div>
          </div>
        );
      })(),
      item.soort === 'element' && Array.isArray(el?.eigenschappen?.montages) && (
        <div className="fm-veld">Montage
          {/* Veel of lange keuzes: een keuzelijst (knoppen worden dan onleesbaar in een smal paneel). */}
          {el.eigenschappen.montages.length > 3 || el.eigenschappen.montages.some(([, t]) => String(t).length > 14) ? (
            <select aria-label="Montage" value={velden.montage || el.eigenschappen.montages[0][0]} disabled={ro} onChange={(e) => zetVeld('montage', e.target.value)}>
              {el.eigenschappen.montages.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          ) : (
            <div className="fm-segment" role="group" aria-label="Montage">
              {el.eigenschappen.montages.map(([k, t]) => (
                <button key={k} className={(velden.montage || el.eigenschappen.montages[0][0]) === k ? 'aan' : ''} disabled={ro} onClick={() => zetVeld('montage', k)}>{t}</button>
              ))}
            </div>
          )}
        </div>
      ),
      // Hekken met een kant (schuin dranghek, crash barrier): pootjes of voet links of rechts, of naar buiten (weg van het parcours).
      item.soort === 'element' && el?.tekenwijze === 'lijn' && g?.type === 'LineString' && tekeningZijdig(el) && (() => {
        const pk = parcoursKant(item, items, lagen);
        const kant = pootjesKant(item);
        const buiten = pk ? andereKant(pk) : null;
        return (
          <div className="fm-veld">Pootjes
            <div className="fm-segment" role="group" aria-label="Kant van de pootjes">
              <button className={kant === 'links' ? 'aan' : ''} disabled={ro} onClick={() => zetVeld('spiegel', false)}>Links</button>
              <button className={kant === 'rechts' ? 'aan' : ''} disabled={ro} onClick={() => zetVeld('spiegel', true)}>Rechts</button>
              {buiten && <button disabled={ro || kant === buiten} title={`Weg van het parcours (dat ligt ${pk})`} onClick={() => zetVeld('spiegel', buiten === 'rechts')}>Naar buiten</button>}
            </div>
            <div className="fm-sub">Links of rechts van de tekenrichting{pk ? ` · het parcours ligt ${pk}` : ''}.</div>
          </div>
        );
      })(),
      item.soort === 'element' && el?.eigenschappen?.stapelbaar && (() => {
        const rj = rijenVan(item, el);
        const zet = (n) => onWijzig({ parameters: { ...p, rijen: Math.max(1, n) } });
        return (
          <div className="fm-veld">{el.eigenschappen.stapel_label || 'Boven elkaar'}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="fm-stapper"><button disabled={ro || rj <= 1} onClick={() => zet(rj - 1)}>−</button><span>{rj}</span><button disabled={ro} onClick={() => zet(rj + 1)}>+</button></div>
              <span className="fm-sub">{m.stuks != null ? `${m.stuks} ${el.eigenschappen.stapel_eenheid || 'stuks'} in totaal` : ''}</span>
            </div>
          </div>
        );
      })(),
      item.soort === 'element' && el?.eigenschappen?.kop_draaibaar && (() => {
        const k = Number(p.kop_rot) || 0;
        const zet = (v) => onWijzig({ parameters: { ...p, kop_rot: ((Math.round(v) % 360) + 360) % 360 } });
        return (
          <div className="fm-veld">{el.eigenschappen.kop_label || 'Draaiing scherm'} (los van de trailer)
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="fm-knop klein" disabled={ro} onClick={() => zet(k - 15)} title="15° linksom">↺ 15°</button>
              <Veld label="" eenheid="°" soort="number" waarde={k} uitgeschakeld={ro} onBewaar={(v) => zet(Number(v) || 0)} />
              <button className="fm-knop klein" disabled={ro} onClick={() => zet(k + 15)} title="15° rechtsom">↻ 15°</button>
            </div>
          </div>
        );
      })(),
      item.soort === 'element' && heeftFracties(el) && (() => {
        const frs = fractiesVan(item, el);
        const opties = toegelatenFracties(el);
        const zet = (i, k) => { const a = [...frs]; a[i] = k; onWijzig({ velden: { ...velden, fracties: a } }); };
        return (
          <div className="fm-veld">Fractie{frs.length > 1 ? 's' : ''}
            {frs.map((f, i) => (
              <div key={i} className="fm-fracties">
                {frs.length > 1 && <span className="fm-sub" style={{ width: 44 }}>Vak {i + 1}</span>}
                {opties.map((o) => (
                  <button key={o.k} type="button" disabled={ro} title={o.naam} aria-pressed={f === o.k} className={f === o.k ? 'aan' : ''}
                    style={{ background: o.kleur, color: o.donker ? '#1d1d1b' : '#fff' }} onClick={() => zet(i, o.k)}>{o.letter}</button>
                ))}
                <span className="fm-sub">{fractieVan(f).naam}</span>
              </div>
            ))}
          </div>
        );
      })(),
      item.soort === 'element' && (el?.eigenschappen?.stapelbaar || el?.eigenschappen?.inrichting_meubel || Number(velden.verdieping) > 0) && (() => {
        const v = Number(velden.verdieping) || 0;
        const max = Number(el?.eigenschappen?.stapelbaar) || 3;
        return (
          <div className="fm-veld">
            <span>Verdieping<Info>Gestapelde units: zet de bovenste unit exact op de onderste en kies hier de verdieping. Bovenaan de kaart kies je welke verdieping scherp staat. Meubilair op een verdieping krijgt dezelfde verdieping.</Info></span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div className="fm-segment" style={{ flex: 1 }}>
                {[0, 1, 2].slice(0, max).map((n) => <button key={n} style={{ flex: 1 }} className={v === n ? 'aan' : ''} disabled={ro} onClick={() => onWijzig({ velden: { ...velden, verdieping: n || undefined } })}>{n ? `+${n}` : 'Gelijkvl.'}</button>)}
              </div>
              {el?.eigenschappen?.stapelbaar && !ro && v < max - 1 && <button className="fm-knop klein" title="Zelfde unit exact erbovenop, één verdieping hoger" onClick={() => onActie?.('erbovenop')}>Unit erbovenop</button>}
            </div>
          </div>
        );
      })(),
      item.soort === 'element' && el?.tekenwijze === 'lijn' && Number(el.eenheid_m) > 0 && g?.type === 'LineString' && toebehorenVan(el).length > 0 && (() => {
        const lijst = toebehorenVan(el);
        const t = toebehorenInst(item, el);
        const tel = toebehorenTelling(item, el) || {};
        const zetT = (k, patch) => onWijzig({ velden: { ...velden, toebehoren: { ...(velden.toebehoren || {}), [k]: { ...t[k], ...patch } } } });
        const sel = (waarde, opties, zet) => <select value={waarde} disabled={ro} onChange={(e) => zet(Number(e.target.value))} style={{ width: 'auto', height: 26 }}>{opties.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>;
        const vlagN = (p.vlagBegin ? 1 : 0) + (p.vlagEind ? 1 : 0) + (p.vlaggen?.length || 0);
        return (
          <div className="fm-veld fm-tbveld">
            <span>Toebehoren<Info>Hele lijn: om de zoveel naden, aan één kant of beide. Een stuk: klik op de kaart het eerste en het laatste hek. Losse hekken: klik of sleep over de hekken. Bij een stuk of losse hekken bepaalt de kant waar je naast de lijn klikt (L en R staan erbij). Welke toebehoren er zijn, stel je in bij het element in de bibliotheek.</Info></span>
            <div className="fm-tbchips">
              {lijst.map((a) => {
                const ti = t[a.k];
                const aantal = a.soort === 'paal' ? Object.entries(tel).filter(([k]) => k.startsWith(`${a.k}@`)).reduce((x, [, n]) => x + n, 0) : (tel[a.k] ?? 0);
                return (
                  <button key={a.k} type="button" className={`fm-tbchip${ti.aan ? ' aan' : ''}${tbOpen === a.k ? ' open' : ''}`} disabled={ro && !ti.aan}
                    title={ti.aan ? `${a.naam}: instellen` : `${a.naam} toevoegen`}
                    onClick={() => {
                      if (!ti.aan && !ro) {
                        const metKant = ['schoor', 'driehoek', 'blok', 'paal'].includes(a.soort);
                        const pk = metKant && !velden.toebehoren?.[a.k]?.kant ? parcoursKant(item, items, lagen) : null;
                        zetT(a.k, { aan: true, ...(pk ? { kant: andereKant(pk) } : {}) });
                        setTbOpen(a.k);
                      } else setTbOpen(tbOpen === a.k ? null : a.k);
                    }}>{a.naam}{ti.aan && <b>{aantal}</b>}</button>
                );
              })}
              {vlagN > 0 && <button type="button" className={`fm-tbchip${vlagN ? ' aan' : ''}${tbOpen === '_vlag' ? ' open' : ''}`} disabled={ro && !vlagN} title="Gele vlag op de kop van een paal: begin, einde of een knooppunt" onClick={() => setTbOpen(tbOpen === '_vlag' ? null : '_vlag')}>Gele vlag (begin/einde){vlagN > 0 && <b>{vlagN}</b>}</button>}
            </div>
            {tbOpen === '_vlag' && (
              <div className="fm-tbdetail">
                <div className="fm-vinkrij">
                  <label className="fm-vink"><input type="checkbox" disabled={ro} checked={!!p.vlagBegin} onChange={(e) => onWijzig({ parameters: { ...p, vlagBegin: e.target.checked || undefined } })} />Op het begin</label>
                  <label className="fm-vink"><input type="checkbox" disabled={ro} checked={!!p.vlagEind} onChange={(e) => onWijzig({ parameters: { ...p, vlagEind: e.target.checked || undefined } })} />Op het einde</label>
                </div>
                <span className="fm-sub">Op een ander knooppunt: rechtsklik op dat punt van de lijn.{p.vlaggen?.length ? ` Nu ${p.vlaggen.length} op een knooppunt.` : ''}</span>
                {p.vlaggen?.length > 0 && !ro && <button type="button" className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onWijzig({ parameters: { ...p, vlaggen: undefined } })}>Vlaggen op knooppunten weghalen</button>}
              </div>
            )}
            <div className="fm-toebehoren">
              {lijst.filter((a) => a.k === tbOpen).map((a) => {
                const ti = t[a.k]; const kies = ti.waar === 'gekozen'; const drie = a.soort === 'driehoek';
                const penseel = doekPenseel?.tb === a.k;
                const metKant = ['schoor', 'driehoek', 'blok', 'paal'].includes(a.soort);
                const aantal = a.soort === 'paal' ? Object.entries(tel).filter(([k]) => k.startsWith(`${a.k}@`)).reduce((x, [, n]) => x + n, 0) : (tel[a.k] ?? 0);
                const nKeuze = (ti.plekken || []).length;
                const keuze = !kies ? 'lijn' : penseel ? (doekPenseel.modus || 'hek') : (ti.keuze || 'hek');
                const start = (modus) => onDoekPenseel({ itemId: item.id, tb: a.k, naam: a.naam, zet: { waar: 'gekozen' }, zijde: metKant, modus: modus === 'stuk' ? 'stuk' : 'hek' });
                return (
                  <Fragment key={a.k}>
                    <div className="fm-tb-kop">
                      <label className="fm-vink"><input type="checkbox" checked={ti.aan} disabled={ro} onChange={(e) => {
                        // Aanzetten: standaard aan de buitenkant (weg van het parcours) als dat te bepalen is.
                        const pk = e.target.checked && metKant && !velden.toebehoren?.[a.k]?.kant ? parcoursKant(item, items, lagen) : null;
                        zetT(a.k, { aan: e.target.checked, ...(pk ? { kant: andereKant(pk) } : {}) }); if (!e.target.checked && penseel) onDoekPenseel(null);
                      }} />{a.naam}</label>
                      {ti.aan && <b>{aantal}</b>}
                    </div>
                    {ti.aan && (<>
                      <div className="rij">
                        <span className="fm-segment" style={{ width: 'auto' }}>
                          {[['lijn', 'Hele lijn'], ['stuk', 'Een stuk'], ['hek', 'Losse hekken']].map(([k, n]) => (
                            <button key={k} disabled={ro} className={keuze === k ? 'aan' : ''} title={{ lijn: 'Over de hele lijn', stuk: 'Klik op de kaart het eerste en het laatste hek', hek: 'Klik of sleep over de hekken op de kaart' }[k]}
                              onClick={() => { if (keuze === k && (k === 'lijn' || penseel)) return; if (k === 'lijn') { zetT(a.k, { waar: undefined, keuze: undefined }); if (penseel) onDoekPenseel(null); } else { zetT(a.k, { waar: 'gekozen', keuze: k, plekken: ti.plekken || [] }); start(k); } }}>{n}</button>
                          ))}
                        </span>
                      </div>
                      <div className="rij">
                        {a.soort !== 'klem' && !(drie && kies) && sel(ti.om, [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => [n, n === 1 ? (drie ? 'op elk hek' : 'op elke naad') : `om de ${n} ${drie ? 'hekken' : 'naden'}`]), (v) => zetT(a.k, { om: v }))}
                        {metKant && !kies && <span className="fm-segment" style={{ width: 'auto' }}>{[['links', 'Links'], ['rechts', 'Rechts'], ['beide', 'Beide']].map(([k, n]) => <button key={k} disabled={ro} className={ti.kant === k ? 'aan' : ''} onClick={() => zetT(a.k, { kant: k })}>{n}</button>)}</span>}
                        {!drie && sel(ti.per, [1, 2, 3, 4].map((n) => [n, a.soort === 'klem' ? `${n} per naad` : `${n} per plek`]), (v) => zetT(a.k, { per: v }))}
                        {a.soort === 'paal' && <select value={String(ti.lengte || 1.6)} disabled={ro} onChange={(e) => zetT(a.k, { lengte: Number(e.target.value) })} style={{ width: 'auto', height: 26 }} aria-label="Lengte van de paal">{[1.6, 1.8, 2].map((v) => <option key={v} value={String(v)}>{String(v.toFixed(2)).replace('.', ',')} m</option>)}</select>}
                      </div>
                      {kies && (
                        <div className="rij">
                          <button className="fm-knop klein zwart" disabled={ro} onClick={() => (penseel ? onDoekPenseel(null) : start(keuze))}>{penseel ? 'Klaar' : `Op de kaart aanduiden${nKeuze ? ` · ${nKeuze} ${nKeuze === 1 ? 'hek' : 'hekken'}` : ''}`}</button>
                          {nKeuze > 0 && !ro && <button className="fm-knop klein" title="Alle gekozen hekken van dit toebehoren loslaten" onClick={() => zetT(a.k, { plekken: [], zijden: undefined })}>Wissen</button>}
                        </div>
                      )}
                      {kies && penseel && <div className="fm-sub fm-tb-hint">{keuze === 'stuk' ? 'Klik op de kaart het eerste en het laatste hek van het stuk.' : 'Klik of sleep over de hekken.'}{metKant ? ' Waar je naast de lijn klikt, bepaalt de kant.' : ''} Nog eens over hetzelfde gaan haalt het weg.</div>}
                      {kies && !nKeuze && <div className="fm-sub fm-tb-hint">Nog niets gekozen: op deze lijn staat er niets tot je hekken aanduidt.</div>}
                    </>)}
                  </Fragment>
                );
              })}
            </div>
          </div>
        );
      })(),
      item.soort === 'element' && el?.eigenschappen?.inrichting && (() => {
        // Inrichting van een unit: meubilair tellen zonder het te tekenen (komt in de stuklijst).
        const meubels = [...elementenMap.values()].filter((x) => x.eigenschappen?.inrichting_meubel).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
        const inr = velden.inrichting || {};
        const totaal = Object.entries(inr).filter(([, n]) => n > 0);
        const zetI = (id, n) => { const v = { ...inr }; if (n > 0) v[id] = n; else delete v[id]; onWijzig({ velden: { ...velden, inrichting: v } }); };
        return (
          <details className="fm-meer" open={totaal.length > 0}>
            <summary>Inrichting{totaal.length ? ` · ${totaal.map(([id, n]) => `${n} ${(elementenMap.get(id)?.naam || '?').split(' ')[0].toLowerCase()}`).join(', ')}` : ''}<Info>Meubilair in deze unit, zonder het te tekenen. Telt mee in de stuklijst. Wil je de opstelling zien, zet het meubilair dan uit de bibliotheek in de unit.</Info></summary>
            <div className="fm-toebehoren">
              {meubels.map((m) => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{m.naam}</span>
                  <input type="number" min="0" step="1" disabled={ro} value={inr[m.id] || ''} placeholder="0" onChange={(e) => zetI(m.id, Math.max(0, Math.round(Number(e.target.value) || 0)))} style={{ width: 56, height: 26 }} />
                </label>
              ))}
              {!meubels.length && <div className="fm-sub">Nog geen meubilair in de bibliotheek.</div>}
            </div>
          </details>
        );
      })(),
      item.soort === 'element' && el?.plan_id && el.eigenschappen?.cad && (
        <div className="fm-veld">
          <span>CAD-object<Info>Plan van de leverancier, enkel in dit plan. Krijg je een nieuwe versie, laad ze dan hier in: plaats en draaiing blijven behouden.</Info></span>
          <span className="fm-sub">{el.eigenschappen.cad.bestand}{el.eigenschappen.cad.pagina ? ` · p. ${el.eigenschappen.cad.pagina}` : ''} · {el.eigenschappen.cad.ingeladen}{el.eigenschappen.cad.vorige ? ` (vorige: ${el.eigenschappen.cad.vorige.bestand})` : ''}</span>
          {!ro && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button className="fm-knop klein zwart" onClick={() => onActie?.('cad-versie')}>Nieuwe versie inladen</button>
              <a className="fm-knop klein" href={`/maps/bibliotheek/teken/${el.id}`} target="_blank" rel="noreferrer">Lijnen bewerken</a>
            </div>
          )}
        </div>
      ),
  ].filter(Boolean) : [];

  // ---------- Nieuw paneel: familie, kop, kern, tabs ----------
  const familie = familieVan(item, el);
  const labelAan = [s.label === true && 'naam', !!s.maten && 'maatlijnen', !!s.opp && 'oppervlakte'].filter(Boolean);
  const labelVinkjes = item.soort === 'tekst' || item.groep_id ? null : (tekening ? (
    <details className="fm-meer"><summary>Label op de kaart · {labelAan.length ? labelAan.join(', ') : 'geen'}</summary>
        {item.soort !== 'tekst' && !item.groep_id && (
          <div className="fm-vinkrij">
            <label className="fm-vink"><input type="checkbox" checked={s.label === true} disabled={ro} onChange={(e) => onStijl({ label: e.target.checked })} />Naam op de kaart</label>
            {tekening?.teksten?.length > 0 && <label className="fm-vink"><input type="checkbox" checked={s.tekening_tekst !== false} disabled={ro} onChange={(e) => onStijl({ tekening_tekst: e.target.checked })} />Teksten in de tekening</label>}
            {g.type !== 'Point' && <label className="fm-vink" title="Maatlijnen met de lengtes, zoals op een bouwplan (ook op de PDF)"><input type="checkbox" checked={!!s.maten} disabled={ro} onChange={(e) => onStijl({ maten: e.target.checked })} />Maatlijnen</label>}
            {isVlak && <label className="fm-vink"><input type="checkbox" checked={!!s.opp} disabled={ro} onChange={(e) => onStijl({ opp: e.target.checked })} />Oppervlakte</label>}
          </div>
        )}
    </details>
  ) : (
    <>
        {item.soort !== 'tekst' && !item.groep_id && (
          <div className="fm-vinkrij">
            <label className="fm-vink"><input type="checkbox" checked={s.label === true} disabled={ro} onChange={(e) => onStijl({ label: e.target.checked })} />Naam op de kaart</label>
            {tekening?.teksten?.length > 0 && <label className="fm-vink"><input type="checkbox" checked={s.tekening_tekst !== false} disabled={ro} onChange={(e) => onStijl({ tekening_tekst: e.target.checked })} />Teksten in de tekening</label>}
            {g.type !== 'Point' && <label className="fm-vink" title="Maatlijnen met de lengtes, zoals op een bouwplan (ook op de PDF)"><input type="checkbox" checked={!!s.maten} disabled={ro} onChange={(e) => onStijl({ maten: e.target.checked })} />Maatlijnen</label>}
            {isVlak && <label className="fm-vink"><input type="checkbox" checked={!!s.opp} disabled={ro} onChange={(e) => onStijl({ opp: e.target.checked })} />Oppervlakte</label>}
          </div>
        )}
    </>
  ));
  const binnenplanJsx = (
    <>
        {binnenplan && magModule('binnen') && (binnenplan.open ? (
          <div className="fm-binnenknop">
            <button className="fm-knop klein zwart" onClick={binnenplan.open}>{binnenplan.aantal ? `Binnenplan openen · ${binnenplan.aantal} items` : 'Binnenplan maken'}</button>
            <Info>Een binnenplan per verdieping, met een grondplan (PDF of foto) als onderlegger om over te tekenen. Wat je erin zet, telt mee in de stuklijst maar staat niet op de gewone kaart.</Info>
          </div>
        ) : binnenplan.ruimte && (
          <label className="fm-vink" title="Wat in deze ruimte staat, wordt in de stuklijst per ruimte geteld"><input type="checkbox" checked={!!velden.ruimte} disabled={ro} onChange={(e) => onWijzig({ velden: { ...velden, ruimte: e.target.checked || undefined } })} />Dit is een ruimte (bv. Perszaal)</label>
        ))}
    </>
  );
  // Wisselen van element vanuit de kop: lijn (nadar ↔ heras ↔ gewone lijn), ander formaat of andere inhoud.
  const wissel = (id, soort) => {
    if (soort === 'lijn') {
      const BEHOUD = ['afronden', 'label', 'maten', 'opp', 'tekst_langs'];
      const st = Object.fromEntries(Object.entries(item.stijl || {}).filter(([k]) => BEHOUD.includes(k)));
      if (!id) onWijzig({ soort: 'lijn', element_id: null, stijl: st });
      else onWijzig({ soort: 'element', element_id: id, stijl: st });
    } else if (soort === 'inhoud') onWijzig({ element_id: id });
    else onActie?.('formaat', id);
  };
  // Kerngetal: wat je het eerst wil weten, per familie.
  // Vloeren (platen als vlak of als pad): de tab Instellen heet Leggen.
  const legTab = familie === 'vloeren' && !!el && (!!el.eigenschappen?.module || isRijpad(item, el));
  const kern = (() => {
    const L = m.lengte ? `${geo.getal(m.lengte)} m` : '';
    if (familie === 'hekken' && el?.tekenwijze === 'lijn') {
      const tb = toebehorenTelling(item, el) || {};
      const tbTekst = Object.entries(tb).map(([k, n]) => `${n} ${toebehorenNaam(el, k).toLowerCase()}`).join(' · ');
      return { groot: m.stuks != null ? `${m.stuks} ${m.stuks === 1 ? 'stuk' : 'stuks'} · ${L}` : L, klein: [g.coordinates?.length > 2 ? `${g.coordinates.length - 1} rechte stukken` : '', tbTekst].filter(Boolean).join(' · ') || null };
    }
    if (isLichtmast(el)) { const b = lichtBereik(item, el); const l = velden.licht || {}; return { groot: b ? `± ${geo.getal(b.R, 0)} m ${b.half ? 'naar één kant' : 'rondom'}` : el.naam, klein: [l.aan ? 'licht aan' : 'licht uit', el.hoogte_m ? `mast ${String(el.hoogte_m).replace('.', ',')} m` : ''].filter(Boolean).join(' · ') }; }
    if (item.soort === 'tekst') return { groot: item.naam || 'Tekst', klein: `${Number(s.tekstgrootte) || 12} pt` };
    if (g.type === 'Point') return { groot: el?.naam || icoonNaam(s.icoon) || 'Punt', klein: velden.nr != null ? `nr ${velden.nr}` : null };
    const mt = matenTekst(m);
    if (el?.tekenwijze === 'schaal' && p.breedte && p.diepte) return { groot: `${geo.getal(p.breedte)} × ${geo.getal(p.diepte)} m${m.stuks > 1 ? ` · ${m.stuks} stuks` : ''}`, klein: [el.leverancier, el.hoogte_m ? `${String(el.hoogte_m).replace('.', ',')} m hoog` : '', Number(p.rot) ? `draai ${geo.getal(p.rot, 0)}°` : ''].filter(Boolean).join(' · ') || null };
    if (isVlak) return { groot: `${geo.getal(m.opp || 0, 0)} m²`, klein: mt && mt !== `${geo.getal(m.opp || 0, 0)} m²` ? mt : (m.omtrek ? `omtrek ${geo.getal(m.omtrek)} m` : null) };
    if (isLijn) return { groot: L || '—', klein: `${g.coordinates?.length || 0} punten${mt && mt !== L ? ` · ${mt}` : ''}` };
    return { groot: mt || null, klein: null };
  })();
  const bouwerBlokken = (
    <div className="fm-sectie">
        {isTentCategorie(el?.categorie) && item.parameters?.midden && (() => {
          const vloeren = (elementen || []).filter((e) => e.eigenschappen?.vloer && ['vlonder', 'cassette', 'zwaarlastvloer'].includes(e.eigenschappen?.materiaal));
          const vEl = velden.vloer ? elementenMap.get(velden.vloer) : null;
          const vi = vEl ? tentVloerItem(item, vEl) : null; const vm = vi ? modules(vi, vEl) : null;
          return (
            <label className="fm-veld">Vloer in de tent
              <select value={velden.vloer || ''} disabled={ro} onChange={(e) => onWijzig({ velden: { ...velden, vloer: e.target.value || null } })}>
                <option value="">Geen vloer</option>
                {vloeren.map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}
              </select>
              {vm && <span className="fm-sub">{vm.stuks} × {vEl.naam} · zichtbaar als raster in de tent, telt mee in de stuklijst</span>}
            </label>
          );
        })()}
        {isTentBouw(el) && item.parameters?.midden && <TentBlok it={item} el={el} doeken={alleDoeken} items={items} elementen={elementen} elementenMap={elementenMap} schrijven={schrijven} onZet={(tent) => onWijzig({ velden: { ...(item.velden || {}), tent } })} onVloer={(id) => onWijzig({ velden: { ...(item.velden || {}), vloer: id || null } })} onActie={onActie} />}
        {el && el.eigenschappen?.stelling3d && !isStellingBouw(item) && <Vaste3D item={item} el={el} />}
        {el && el.eigenschappen?.stelling && item.geometrie?.type === 'LineString' && <StellingBlok it={item} el={el} doeken={alleDoeken} schrijven={schrijven} onZet={(stelling, extra) => onWijzig({ velden: { ...(item.velden || {}), stelling, ...(extra || {}) } })} />}
        {el && el.tekenwijze === 'lijn' && /truss/i.test(el.categorie || '') && !isWand(el) && !el.eigenschappen?.stelling && item.geometrie?.type === 'LineString' && <TrussBlok it={item} el={el} doeken={trussDoeken} schrijven={schrijven} onZet={(truss, g) => onWijzig({ velden: { ...(item.velden || {}), truss }, ...(g ? { geometrie: g } : {}) })} />}
        {isWand(el) && item.geometrie?.type === 'LineString' && (() => {
          const meet = (g) => zijLengtes(g.coordinates, (a, b) => geo.lengte({ type: 'LineString', coordinates: [a, b] }));
          return <WandBouwer it={item} el={el} lengtes={meet(item.geometrie)} doeken={frameDoeken} schrijven={schrijven} onZet={(wand, g) => onWijzig({ velden: { ...(item.velden || {}), wand }, ...(g ? { geometrie: g } : {}) })}
            totaalTelling={telAlleWanden(items || [], elementenMap)} />;
        })()}
    </div>
  );
  // Eigen tabs per familie: panelen (branding), licht (stroom), camera (camerastelling).
  const panelenJsx = (isTotem(el) || trussDoek(el) || isFrame(el) || isDrape(el)) ? (
    <div className="fm-sectie">
      {isTotem(el) && <TotemPanelen item={item} panelen={panelen} elementenMap={elementenMap} onWijzig={onWijzig} schrijven={schrijven} />}
      {trussDoek(el) && <TotemPanelen item={item} el={el} panelen={trussDoeken} elementenMap={elementenMap} onWijzig={onWijzig} schrijven={schrijven} />}
      {isFrame(el) && <TotemPanelen item={item} el={el} panelen={frameDoeken} elementenMap={elementenMap} onWijzig={onWijzig} schrijven={schrijven} />}
      {isDrape(el) && <DrapeDoeken item={item} el={el} doeken={drapeDoeken} elementenMap={elementenMap} onWijzig={onWijzig} schrijven={schrijven} />}
    </div>
  ) : null;
  const lichtJsx = isLichtmast(el) ? <div className="fm-sectie">{isLichtmast(el) && <LichtBlok item={item} el={el} schrijven={schrijven} onWijzig={(licht) => onWijzig({ velden: { ...(item.velden || {}), licht } })} onActie={onActie} />}</div> : null;
  // Kabelcam (Eurogrip Flyline): verreikers, camera op de kabel, kijkrichting, kabelhoogte en lens.
  const kabelcamJsx = isKabelcam(el) && g?.type === 'LineString' ? (() => {
    const kc = kabelcamInst(item, el); const geo2 = kabelcamGeo(item, el); const span = geo2 ? Math.round(geo2.span) : 0;
    const zetKc = (patch) => onWijzig({ velden: { ...(item.velden || {}), kabelcam: { ...(item.velden?.kabelcam || {}), ...patch } } });
    const tv = item.velden?.tvcamera || {};
    const verreikers = (elementen || []).filter((x) => x.actief !== false && /verreiker|telehandler/i.test(`${x.naam} ${x.eigenschappen?.familie || ''}`));
    const meld = kabelcamMeldingen(item, el, elementenMap);
    return (
      <div className="fm-sectie">
        <span className="fm-sub">{kabelcamTekst(item, el)}. De kabel hangt altijd tussen twee verreikers, nooit aan eigen masten.</span>
        <label className="fm-veld">Verreiker aan beide uiteinden<select disabled={!schrijven} value={kc.verreiker || ''} onChange={(e) => zetKc({ verreiker: e.target.value || null })}><option value="">Kies een verreiker</option>{verreikers.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</select></label>
        <label className="fm-veld">Camera op de kabel · {Math.round(kc.t * span)} m van A<input type="range" min={0} max={100} step={1} disabled={!schrijven} value={Math.round(kc.t * 100)} onChange={(e) => zetKc({ t: Number(e.target.value) / 100 })} /></label>
        <div className="fm-veld">Kijkrichting · {kc.kijk}°<div className="fm-segment">{[['Naar B', 0], ['Dwars rechts', 90], ['Naar A', 180], ['Dwars links', -90]].map(([n, v]) => <button key={n} type="button" disabled={!schrijven} className={kc.kijk === v ? 'aan' : ''} onClick={() => zetKc({ kijk: v })}>{n}</button>)}</div>
          <input type="range" min={-180} max={180} step={5} disabled={!schrijven} value={kc.kijk} onChange={(e) => zetKc({ kijk: Number(e.target.value) })} /></div>
        <label className="fm-veld">Kabelhoogte (m)<input type="number" min={0} step={0.5} disabled={!schrijven} value={item.velden?.kabelcam?.hoogte ?? ''} placeholder={el.eigenschappen?.kabelcam?.hoogte ? String(el.eigenschappen.kabelcam.hoogte) : 'bv. 12'} onChange={(e) => zetKc({ hoogte: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        <label className="fm-veld">Type camera (lens)<input list="fm-lenzen" disabled={!schrijven} value={tv.lens || ''} placeholder="bv. 22x" onChange={(e) => onWijzig({ velden: { ...(item.velden || {}), tvcamera: { ...tv, lens: e.target.value.trim() || undefined } } })} /></label>
        <datalist id="fm-lenzen">{LENZEN.map((l) => <option key={l} value={l} />)}</datalist>
        {meld.map((m) => <div key={m} className="fm-melding info">{m}</div>)}
      </div>
    );
  })() : null;
  const cameraJsx = isCameraStelling(el, item) || isLosseTvCamera(el) ? (
    <>
        {(() => { const c = item.velden?.tvcamera || {}; const zet = (patch) => { const tv = Object.fromEntries(Object.entries({ ...c, ...patch }).filter(([, v]) => v)); const stl = item.velden?.stelling; onWijzig({ velden: { ...(item.velden || {}), tvcamera: tv, ...(stl?.camera && 'opstelling' in patch ? { stelling: { ...stl, camera: { ...stl.camera, op: tv.opstelling || undefined } } } : {}) } }); }; return (
          <div className="fm-sectie">
            <label className="fm-veld">Type camera (lens)<input list="fm-lenzen" disabled={!schrijven} value={c.lens || ''} placeholder={el?.eigenschappen?.tvcamera?.lens || 'bv. 86x'} onChange={(e) => zet({ lens: e.target.value.trim() })} /></label>
            <datalist id="fm-lenzen">{LENZEN.map((l) => <option key={l} value={l} />)}</datalist>
            {!isLosseTvCamera(el) && <div className="fm-veld">Opstelling<div className="fm-segment" title="Nog eens klikken = niet ingevuld">{OPSTELLINGEN.map(([k, n]) => <button key={k} type="button" disabled={!schrijven} className={c.opstelling === k ? 'aan' : ''} onClick={() => zet({ opstelling: c.opstelling === k ? '' : k })}>{n}</button>)}</div></div>}
            {tvCamTekst(item, el) && <span className="fm-sub">In de popup: {item.naam ? `${item.naam} · ` : ''}{tvCamTekst(item, el)}</span>}
          </div>); })()}
    </>
  ) : null;
  // Branding altijd op een eigen tab: doeken per hek, vlagontwerp, beachvlaggen in de hekken, panelen.
  const heeftDoek = g?.type === 'LineString' && !item.parameters?.route && el && el.tekenwijze === 'lijn' && el.eigenschappen?.doek && el.eigenschappen.doek !== 'geen';
  const heeftBranding = magModule('branding') && !!(heeftDoek || (el && isVlagHek(el)) || isVlag(el) || (Array.isArray(velden.vlaggen) && velden.vlaggen.some(Boolean)) || panelenJsx);
  const brandingJsx = heeftBranding ? (
    <div className="fm-sectie">
        {(() => {
          // Doek per hek (de elementkeuze zelf staat in de kop van het paneel).
          const isLijnItem = g?.type === 'LineString' && !item.parameters?.route && el && el.tekenwijze === 'lijn';
          if (!isLijnItem) return null;
          const dk = el?.eigenschappen?.doek;
          return (
            <>
              {(dk === 'bedrukt' || isVlagHek(el)) && doeken.length > 0 && <DoekPerHek item={item} el={el} doeken={doeken} elementenMap={elementenMap} onWijzig={onWijzig} penseel={doekPenseel} onPenseel={onDoekPenseel} />}
              {dk === 'bedrukt' && !doeken.length && (
                <label className="fm-veld">Doek (ontwerp of sponsor)
                  <input defaultValue={velden.doek_naam || ''} key={item.id} placeholder="bv. Sponsor X – banner" onBlur={(e) => e.target.value !== (velden.doek_naam || '') && onWijzig({ velden: { ...velden, doek_naam: e.target.value.trim() || null } })} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                </label>
              )}
              {dk && dk !== 'geen' && (
                <div className="fm-veld"><span>Doek aan de kant<Info>Voor de opbouwploeg, gezien in de richting waarin de lijn getekend is.</Info></span>
                  <div className="fm-segment">{[['links', 'Links'], ['rechts', 'Rechts'], ['beide', 'Beide']].map(([k, t]) => <button key={k} className={velden.doek_kant === k ? 'aan' : ''} onClick={() => onWijzig({ velden: { ...velden, doek_kant: velden.doek_kant === k ? null : k } })}>{t}</button>)}</div>
                </div>
              )}
            </>
          );
        })()}
        {isVlag(el) && (
          <label className="fm-veld">Ontwerp op de vlag
            <select value={velden.ontwerp || ''} disabled={!schrijven} onChange={(e) => onWijzig({ velden: { ...velden, ontwerp: e.target.value || null } })}>
              <option value="">Nog geen ontwerp</option>
              {vlagOntwerpen.map((d) => <option key={d.id} value={d.id}>{d.naam}{d.plan_id ? ' (dit event)' : ''}</option>)}
            </select>
            {!vlagOntwerpen.length && <span className="fm-sub">Nog geen vlagontwerpen: upload er een in de werkruimte Branding.</span>}
          </label>
        )}
        {Array.isArray(velden.vlaggen) && velden.vlaggen.some(Boolean) && (
          <div className="fm-veld"><span>Vlaggen in deze hekken<Info>Elke vlag hangt aan de eerste staander van dat hek. Toevoegen of weghalen doe je met het penseel in de werkruimte Branding (tab Beachvlaggen).</Info></span>
            <span className="fm-sub">{velden.vlaggen.map((id, k) => (id ? `hek ${k + 1}: ${elementenMap.get(id)?.naam || '?'}` : null)).filter(Boolean).join(' · ')}</span>
            {schrijven && <button className="fm-knop klein" onClick={() => onWijzig({ velden: { ...velden, vlaggen: null } })}>Alle vlaggen weghalen</button>}
          </div>
        )}
      {panelenJsx}
    </div>
  ) : null;
  const instellenKop = (
    <>
      <div className="fm-sectie">
        {isDeurElement(el) && item.parameters?.midden && (() => {
          const p = item.parameters; const poort = isPoortElement(el);
          const klap = (k) => onWijzig({ parameters: { ...p, [k]: !p[k] } });
          const lijn = deurLijnId(item) ? (items || []).find((x) => x.id === deurLijnId(item)) : null;
          const inLijn = !!lijn && (lijn.parameters?.openingen || []).some((o) => o?.id === item.id);
          // Dubbel: twee vleugels, dus twee keer zo breed. Enkel als dat nog in het rechte stuk past.
          const zetDubbel = (dubbel) => {
            if (!!p.dubbel === dubbel) return;
            const b = deurBreedte(el, { dubbel });
            if (inLijn && !schuifOpening(lijn, { ...item, parameters: { ...p, breedte: b } }, b) && b > (Number(p.breedte) || 0)) { onMenu?.('melding', 'Een dubbele poort past hier niet: het rechte stuk is te kort.'); return; }
            // De scharnierkant blijft staan: de tweede vleugel komt erbij in de lijn (tenzij ze over het einde zou steken).
            const o = inLijn ? lijn.parameters.openingen.find((x) => x?.id === item.id) : null;
            const pl = o ? deurPlaats(lijn, { ...o, b }, Number(p.diepte) || 0.7) : null;
            onWijzig({ parameters: { ...p, dubbel, breedte: b, ...(pl ? { midden: pl.midden, rot: pl.rot } : {}) }, ...(pl ? { geometrie: pl.geometrie } : {}) });
          };
          return (
            <div className="fm-veld"><span>{poort ? 'Poort' : 'Deur'}<Info>{poort ? 'De poort vervangt een hek in de lijn (dubbel: twee hekken) en schuift mee als je ze versleept. Scharnier aan de ene kant, wiel aan de vrije kant. Verwijder je ze, dan lopen de hekken weer door.' : 'De deur zit in de heraslijn en schuift mee als je ze versleept. Verwijder je ze, dan lopen de hekken weer door.'}</Info></span>
              {poort && (
                <div className="fm-segment">{[[false, 'Enkel'], [true, 'Dubbel']].map(([k, t]) => <button key={String(k)} className={!!p.dubbel === k ? 'aan' : ''} disabled={!schrijven} onClick={() => zetDubbel(k)}>{t}</button>)}</div>
              )}
              <div className="fm-vinkrij" style={{ gap: 4 }}>
                {!(poort && p.dubbel) && <button className="fm-knop klein" disabled={!schrijven} onClick={() => klap('spiegel_x')} title="Scharnier aan de andere kant">⇋ Scharnier {p.spiegel_x ? 'rechts' : 'links'}</button>}
                <button className="fm-knop klein" disabled={!schrijven} onClick={() => klap('spiegel_y')} title="Naar de andere kant opendraaien">⇅ Opent naar {p.spiegel_y ? 'kant 2' : 'kant 1'}</button>
              </div>
              {!inLijn && !p.inLijn?.a && <span className="fm-sub">Staat los (niet in een heraslijn).</span>}
            </div>
          );
        })()}
        {el && (el.eigenschappen?.fotos?.length > 0 || el.eigenschappen?.omschrijving || el.eigenschappen?.link) && (
          <details className="fm-meer"><summary>Fiche van het element</summary>
            {el.eigenschappen?.fotos?.length > 0 && (
              <div className="fm-fotorij">{el.eigenschappen.fotos.slice(0, 6).map((pad) => <a key={pad} className="fm-foto" href={publiekeUrl(pad)} target="_blank" rel="noreferrer"><img src={publiekeUrl(pad)} alt="" /></a>)}</div>
            )}
            {el.eigenschappen?.omschrijving && <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{el.eigenschappen.omschrijving}</div>}
            <div className="fm-sub">{[el.leverancier, el.eigenschappen?.gewicht_kg ? `${el.eigenschappen.gewicht_kg} kg` : '', el.eigenschappen?.opbouw_min ? `opbouw ${el.eigenschappen.opbouw_min} min` : '', el.eigenschappen?.mensen ? `${el.eigenschappen.mensen} mensen` : '', el.eigenschappen?.transport, el.eigenschappen?.contact].filter(Boolean).join(' · ')}</div>
            {el.eigenschappen?.link && <a className="fm-knop klein" href={el.eigenschappen.link} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>Productfiche openen</a>}
          </details>
        )}
      </div>
    </>
  );
  const matenEnOpstelling = (
    <>
      {isLijn && schrijven && !item.parameters?.route && item.soort !== 'notitie' && (
        <div className="fm-sectie fm-acties">
          <div className="fm-vinkrij" style={{ gap: 4 }}>
            <button type="button" className="fm-knop klein" onClick={() => onMenu?.('evenwijdig')}>Evenwijdige kopie…</button>
            <button type="button" className="fm-knop klein" onClick={() => onMenu?.('verleng')}>Verder tekenen</button>
          </div>
        </div>
      )}
      {opstelling.length > 0 && (
        <Blok titel={familie === 'hekken' ? 'Hek' : 'Opstelling'}>
          {opstelling.map((x, i) => <Fragment key={i}>{x}</Fragment>)}
        </Blok>
      )}
      <Blok titel={legTab ? 'Leggen' : 'Maten'} open={legTab || !(item.soort === 'element' && el?.tekenwijze === 'lijn')}>
        {el?.varianten?.length > 0 && (
          <label className="fm-veld">Variant
            <select value={velden.variant || ''} disabled={ro} onChange={(e) => {
              const v = el.varianten.find((x) => x.naam === e.target.value);
              const nv = { ...velden, variant: e.target.value || null };
              if (v && el.tekenwijze === 'schaal' && v.breedte_m && v.diepte_m) {
                const mid = p.midden || geo.middelpunt(g);
                onWijzig({ velden: nv, parameters: { ...p, midden: mid, breedte: Number(v.breedte_m), diepte: Number(v.diepte_m) }, geometrie: geo.elementVeelhoek(mid, Number(v.breedte_m), Number(v.diepte_m), p.rot || 0) });
              } else onWijzig({ velden: nv });
            }}>
              <option value="">Standaard</option>
              {el.varianten.map((v) => <option key={v.naam} value={v.naam}>{v.naam}{v.breedte_m ? ` (${v.breedte_m} × ${v.diepte_m} m)` : ''}</option>)}
            </select>
          </label>
        )}
        {matenTekst(m) && <div style={{ fontSize: 13 }}>{matenTekst(m)}</div>}
        {parametrisch && (
          <div className="fm-raster3">
            <Veld label="Breedte" eenheid="m" soort="number" waarde={geo.rond(p.breedte, 2)} uitgeschakeld={ro || !!el?.omtrek}
              onBewaar={(v0) => { const v = snapB(v0); return v > 0 && onGeometrie(item.soort === 'rechthoek' ? geo.parametrischeVorm('rechthoek', { ...p, midden: p.midden || geo.middelpunt(g), breedte: v }) : geo.elementVeelhoek(p.midden || geo.middelpunt(g), v, p.diepte, p.rot || 0), { breedte: v }); }} />
            <Veld label="Diepte" eenheid="m" soort="number" waarde={geo.rond(p.diepte, 2)} uitgeschakeld={ro || !!el?.omtrek}
              onBewaar={(v0) => { const v = snapD(v0); return v > 0 && onGeometrie(item.soort === 'rechthoek' ? geo.parametrischeVorm('rechthoek', { ...p, midden: p.midden || geo.middelpunt(g), diepte: v }) : geo.elementVeelhoek(p.midden || geo.middelpunt(g), p.breedte, v, p.rot || 0), { diepte: v }); }} />
            <Veld label="Draaiing" eenheid="°" soort="number" waarde={geo.rond(p.rot || 0, 1)} uitgeschakeld={ro}
              onBewaar={(v) => onGeometrie(item.soort === 'rechthoek' ? geo.parametrischeVorm('rechthoek', { ...p, midden: p.midden || geo.middelpunt(g), rot: ((v % 360) + 360) % 360 }) : geo.elementVeelhoek(p.midden || geo.middelpunt(g), p.breedte, p.diepte, ((v % 360) + 360) % 360, el?.omtrek), { rot: ((v % 360) + 360) % 360 })} />
          </div>
        )}
        {item.soort === 'element' && el?.tekenwijze === 'schaal' && !el?.eigenschappen?.module && !el?.eigenschappen?.vakken_standaard && parametrisch && (() => {
          const n = Math.max(1, Math.round(Number(p.aantal) || 1));
          const tussen = Math.max(0, Number(p.tussen) || 0);
          const stuk = (Number(p.breedte) - (n - 1) * tussen) / n;
          // De linkerkant blijft staan; de rij groeit naar rechts. Tussenruimte = vrije ruimte tussen twee stukken.
          const zetAantal = (n2, t2 = tussen) => {
            if (n2 < 1) return;
            const B = stuk * n2 + (n2 - 1) * t2; const r = ((Number(p.rot) || 0) * Math.PI) / 180;
            const dx = (B - Number(p.breedte)) / 2;
            const mid0 = p.midden || geo.middelpunt(g);
            const mid = geo.verschuif({ type: 'Point', coordinates: mid0 }, dx * Math.cos(r), -dx * Math.sin(r)).coordinates;
            onWijzig({ parameters: { ...p, midden: mid, breedte: B, aantal: n2 > 1 ? n2 : undefined, tussen: t2 > 0 ? t2 : undefined }, geometrie: geo.elementVeelhoek(mid, B, p.diepte, p.rot || 0, n2 > 1 ? null : el.omtrek) });
          };
          return (
            <div className="fm-veld">Naast elkaar
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="fm-stapper"><button disabled={ro || n <= 1} onClick={() => zetAantal(n - 1)}>−</button><span>{n}</span><button disabled={ro} onClick={() => zetAantal(n + 1)}>+</button></div>
                <span className="fm-sub">{n > 1 ? `telt als ${n} stuks` : 'één stuk'}</span>
              </div>
              {n > 1 && (
                <label className="fm-veld" style={{ marginTop: 6 }}>Tussenruimte (m)
                  <input key={`t${item.id}${tussen}`} type="number" min="0" step="0.1" defaultValue={tussen || ''} placeholder="0" disabled={ro} style={{ width: 90 }}
                    onBlur={(e) => { const v = Math.max(0, Number(String(e.target.value).replace(',', '.')) || 0); if (Math.abs(v - tussen) > 1e-6) zetAantal(n, v); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                </label>
              )}
            </div>
          );
        })()}
        {item.soort === 'element' && el?.eigenschappen?.module && parametrisch && (() => {
          const mod = modules(item, el);
          const zetVak = (nx, ny, extra = {}) => {
            const np = { ...p, ...extra };
            const [mb, md] = moduleMaat(el, np);
            const ok = overlapKanten({ parameters: np }, el); const ox = overlapLangs(ok, md, mb); const oy = overlapLangs(ok, mb, md);
            const B = Math.max(1, nx) * (mb - ox) + ox; const D = Math.max(1, ny) * (md - oy) + oy;
            onGeometrie(geo.elementVeelhoek(p.midden || geo.middelpunt(g), B, D, p.rot || 0), { ...extra, breedte: B, diepte: D });
          };
          return (
            <div className="fm-module">
              <div className="fm-sub">Vlakvullend · stukken van {geo.getal(el.breedte_m)} × {geo.getal(el.diepte_m)} m</div>
              <div className="fm-raster2">
                <div className="fm-veld">{inBanen(el) ? (Number(p.module_rot) !== 90 ? 'Breedte (× 1,04 m)' : 'Vakken in de lengte') : 'In de breedte'}
                  <div className="fm-stapper"><button disabled={ro || mod.nx <= 1} onClick={() => zetVak(mod.nx - 1, mod.ny)}>−</button><span>{mod.nx}</span><button disabled={ro} onClick={() => zetVak(mod.nx + 1, mod.ny)}>+</button></div>
                </div>
                <div className="fm-veld">{inBanen(el) ? (Number(p.module_rot) !== 90 ? 'Vakken in de lengte' : 'Breedte (× 1,04 m)') : 'In de diepte'}
                  <div className="fm-stapper"><button disabled={ro || mod.ny <= 1} onClick={() => zetVak(mod.nx, mod.ny - 1)}>−</button><span>{mod.ny}</span><button disabled={ro} onClick={() => zetVak(mod.nx, mod.ny + 1)}>+</button></div>
                </div>
              </div>
              {(() => {
                // Per vak een ander element van hetzelfde formaat (bv. trap of helling in een stellingvloer).
                if (inBanen(el) || !el.eigenschappen?.tekening || mod.nx * mod.ny > 240) return null;
                const familie = elementen.filter((x) => x.actief !== false && x.categorie === el.categorie && (x.leverancier || '') === (el.leverancier || '') && x.eigenschappen?.tekening);
                const eb = Number(el.breedte_m); const ed = Number(el.diepte_m);
                // Hoeveel vakken een element beslaat (breedte × diepte in elementen van dit vak), of null.
                const span = (x) => { const w = Number(x.breedte_m) / eb; const h = Number(x.diepte_m) / ed; const W = Math.round(w); const H = Math.round(h); return W >= 1 && H >= 1 && W <= 4 && H <= 4 && Math.abs(w - W) < 0.02 && Math.abs(h - H) < 0.02 ? [W, H] : null; };
                const opties = familie.filter((x) => span(x));
                if (opties.length < 2) return null;
                const vakken = p.vakken || {};
                const ankerVan = (k) => (vakken[k]?.in || k);
                const elVan = (k) => { const v = vakken[ankerVan(k)]; return typeof v === 'string' ? v : v?.id || null; };
                const letter = (id) => { const x = familie.find((z) => z.id === id); const n = x ? x.naam.replace(/^stelling\s*/i, '') : '?'; return n.replace(/^[^A-Za-zÀ-ÿ]*/, '').charAt(0).toUpperCase(); };
                const kol = mod.nx; const rij = mod.ny;
                const sleutel = (c, r) => `${c},${rij - 1 - r}`;
                const keuze = vakKeuze.filter((k) => { const [i, j] = k.split(',').map(Number); return i < kol && j < rij; });
                // Gekozen vakken als rechthoek? Dan passen ook grotere elementen (bv. een tribunevak over twee vakken).
                const ij = keuze.map((k) => k.split(',').map(Number));
                const i0 = Math.min(...ij.map((x) => x[0])); const j0 = Math.min(...ij.map((x) => x[1]));
                const bw = Math.max(...ij.map((x) => x[0])) - i0 + 1; const bh = Math.max(...ij.map((x) => x[1])) - j0 + 1;
                const isBlok = keuze.length > 0 && keuze.length === bw * bh;
                const passend = opties.filter((x) => { const [w, h] = span(x); return (w === 1 && h === 1) || (isBlok && w === bw && h === bh); });
                const wis = (n, k) => { const a = n[k]?.in || k; const v = n[a]; if (v && typeof v === 'object' && v.id) { for (let di = 0; di < (v.w || 1); di++) for (let dj = 0; dj < (v.h || 1); dj++) { const [ai, aj] = a.split(',').map(Number); delete n[`${ai + di},${aj + dj}`]; } } delete n[a]; delete n[k]; };
                const zet = (id) => {
                  const n = { ...vakken };
                  for (const k of keuze) wis(n, k);
                  const x = familie.find((z) => z.id === id);
                  const [w, h] = x ? span(x) : [1, 1];
                  if (id && id !== el.id) {
                    if (w === 1 && h === 1) for (const k of keuze) n[k] = id;
                    else { const a = `${i0},${j0}`; n[a] = { id, w, h }; for (let di = 0; di < w; di++) for (let dj = 0; dj < h; dj++) if (di || dj) n[`${i0 + di},${j0 + dj}`] = { in: a }; }
                  }
                  onGeometrie(g, { vakken: Object.keys(n).length ? n : undefined });
                };
                const klikVak = (k, e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) setVakKeuze(keuze.includes(k) ? keuze.filter((x) => x !== k) : [...keuze, k]);
                  else setVakKeuze(keuze.length === 1 && keuze[0] === k ? [] : [k]);
                };
                const aantal = new Set(Object.keys(vakken).map(ankerVan)).size;
                const huidig = keuze.length ? (new Set(keuze.map(elVan)).size === 1 ? (elVan(keuze[0]) || el.id) : '') : el.id;
                return (
                  <details className="fm-meer" open={aantal > 0 || keuze.length > 0}>
                    <summary>Per vak{aantal ? ` · ${aantal} anders` : ''}<Info>Klik een vak en kies wat erin komt, bv. een trap of helling. Ctrl, Cmd of Shift + klik: meerdere vakken; kies je er twee naast elkaar, dan past ook een groter element zoals een tribunevak.</Info></summary>
                    <div className="fm-vakraster" style={{ gridTemplateColumns: `repeat(${kol}, minmax(14px, 26px))` }}>
                      {Array.from({ length: rij }).flatMap((_, r) => Array.from({ length: kol }).map((__, c) => {
                        const k = sleutel(c, r); const id = elVan(k);
                        return <button key={k} className={`${id ? 'anders' : ''}${keuze.includes(k) ? ' aan' : ''}`} disabled={ro} title={id ? familie.find((z) => z.id === id)?.naam : el.naam} onClick={(e) => klikVak(k, e)}>{id ? letter(id) : ''}</button>;
                      }))}
                    </div>
                    {keuze.length > 0 && (
                      <label className="fm-veld">{keuze.length === 1 ? 'Dit vak' : `Deze ${keuze.length} vakken`}
                        <select value={huidig} disabled={ro} onChange={(e) => zet(e.target.value)}>
                          {!huidig && <option value="">— verschillend —</option>}
                          {passend.map((x) => { const [w, h] = span(x); return <option key={x.id} value={x.id}>{x.id === el.id ? `${x.naam} (zoals de rest)` : x.naam}{w * h > 1 ? ` · ${w * h} vakken` : ''}</option>; })}
                        </select>
                      </label>
                    )}
                    {aantal > 0 && !ro && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => { setVakKeuze([]); onGeometrie(g, { vakken: undefined }); }}>Alle vakken weer gelijk</button>}
                  </details>
                );
              })()}
              <div className="fm-vinkrij">
                {<button className="fm-knop klein" disabled={ro} onClick={() => { const r90 = Number(p.module_rot) === 90 ? 0 : 90; const [mb, md] = moduleMaat(el, { ...p, module_rot: r90 }); zetVak(Math.max(1, Math.round(p.breedte / mb)), Math.max(1, Math.round(p.diepte / md)), { module_rot: r90 }); }}>Stukken kwartslag draaien</button>}
                {!el.eigenschappen?.strak && <label className="fm-vink"><input type="checkbox" checked={!!p.verspringend} disabled={ro} onChange={(e) => onGeometrie(g, { verspringend: e.target.checked })} />Verspringend</label>}
              </div>
{!el.eigenschappen?.strak && (
                <div className="fm-raster2">
                  <Veld label="Overlap lange zijde" eenheid="cm" soort="number" waarde={Math.round(okant.lang * 100)} uitgeschakeld={ro} onBewaar={(v) => zetVak(mod.nx, mod.ny, { overlap: undefined, overlap_kort: okant.kort, overlap_lang: Math.max(0, Number(v) || 0) / 100 })} />
                  <Veld label="Overlap korte zijde" eenheid="cm" soort="number" waarde={Math.round(okant.kort * 100)} uitgeschakeld={ro} onBewaar={(v) => zetVak(mod.nx, mod.ny, { overlap: undefined, overlap_lang: okant.lang, overlap_kort: Math.max(0, Number(v) || 0) / 100 })} />
                </div>
              )}
              {inBanen(el) && (
                <div className="fm-sub">Breedte {geo.getal(mod.nHalf * Number(el.diepte_m), 2)} m: {(mod.banen || []).map((b) => (b === 2 ? '2,07 dwars' : '1,04 in de lengte')).join(' + ')} · {mod.nLang} vak{mod.nLang === 1 ? '' : 'ken'} van 2,07 m in de lengte. Pijl = rijrichting.</div>
              )}
              {el.eigenschappen?.helling && (() => {
                const h = hellingVan(p, el);
                return (
                  <>
                    <Veld label="Hoogteverschil" eenheid="m" soort="number" waarde={Number(p.hoogte) || 0} uitgeschakeld={ro}
                      onBewaar={(v) => {
                        // Het vak past zich aan: hele elementen, de hoek van het laatste element valt op de rand.
                        const hoogte = Math.max(0, Number(String(v).replace(',', '.')) || 0);
                        let np = { ...p, hoogte, helling: null };
                        for (let k = 0; k < 4; k++) { const [mb, md] = moduleMaat(el, np); np = { ...np, breedte: mod.nx * mb, diepte: mod.ny * md }; }
                        onGeometrie(geo.elementVeelhoek(p.midden || geo.middelpunt(g), np.breedte, np.diepte, p.rot || 0), { hoogte, helling: null, breedte: np.breedte, diepte: np.diepte });
                      }} />
                    <div className="fm-sub">{h ? `Helling ${geo.getal(h, 1)}° · ${geo.getal(Math.tan((h * Math.PI) / 180) * 100, 0)} % · een vak beslaat ${geo.getal(mod.vak, 2)} m in bovenaanzicht` : 'Vul het hoogteverschil in (bv. de vloerhoogte van de brug): de hoek volgt uit de lengte van het vak.'}</div>
                  </>
                );
              })()}
              {p.verspringend && !el.eigenschappen?.strak && (
                <Veld label="Verspringing (0 = halve plaat)" eenheid="m" soort="number" waarde={verspringVan(item, el)} uitgeschakeld={ro} onBewaar={(v) => onGeometrie(g, { verspring: Math.max(0, Number(v) || 0) })} />
              )}
              <div style={{ fontSize: 12, fontWeight: 600 }}>{mod.stuks} stuks{p.verspringend && mod.ny > 1 && !(verspringVan(item, el) > 0) && !el.eigenschappen?.strak ? (mod.halve && el.eigenschappen?.halve_naam ? ` (waarvan ${mod.halve} ${el.eigenschappen.halve_naam})` : ' (incl. halve stukken aan de rand)') : ''}{ton(mod.stuks)}</div>
            </div>
          );
        })()}
        {isRijpad(item, el) && (() => {
          const pm = padMaat(item, el);
          const zet = (extra) => onGeometrie(g, extra);
          return (
            <div className="fm-module">
              <div className="fm-sub">Rijpad · platen van {geo.getal(el.breedte_m)} × {geo.getal(el.diepte_m)} m</div>
              <div className="fm-segment" role="group" aria-label="Legwijze">
                {[['dwars', 'Dwars'], ['langs', 'In de lengte'], ['sporen', '2 sporen']].map(([k, t]) => (
                  <button key={k} className={pm.leg === k ? 'aan' : ''} disabled={ro} onClick={() => zet({ leg: k })}>{t}</button>
                ))}
              </div>
              {pm.leg !== 'sporen' ? (
                <div className="fm-veld">Platen naast elkaar
                  <div className="fm-stapper"><button disabled={ro || pm.rijen <= 1} onClick={() => zet({ rijen: pm.rijen - 1 })}>−</button><span>{pm.rijen}</span><button disabled={ro} onClick={() => zet({ rijen: pm.rijen + 1 })}>+</button></div>
                </div>
              ) : (
                <Veld label="Ruimte tussen de sporen" eenheid="m" soort="number" waarde={pm.tussen} uitgeschakeld={ro} onBewaar={(v) => zet({ tussen: Math.max(0, Number(v) || 0) })} />
              )}
{!el.eigenschappen?.strak && (
                <div className="fm-raster2">
                  <Veld label="Overlap lange zijde" eenheid="cm" soort="number" waarde={Math.round(okant.lang * 100)} uitgeschakeld={ro} onBewaar={(v) => zet({ overlap: undefined, overlap_kort: okant.kort, overlap_lang: Math.max(0, Number(v) || 0) / 100 })} />
                  <Veld label="Overlap korte zijde" eenheid="cm" soort="number" waarde={Math.round(okant.kort * 100)} uitgeschakeld={ro} onBewaar={(v) => zet({ overlap: undefined, overlap_lang: okant.lang, overlap_kort: Math.max(0, Number(v) || 0) / 100 })} />
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 600 }}>{m.stuks} platen · pad {geo.getal(pm.W)} m breed · {geo.getal(m.lengte)} m lang{ton(m.stuks)}</div>
              <div style={{ fontSize: 12, color: '#686D76' }}>{el.eigenschappen?.strak ? 'Vloer: panelen sluiten strak aan, hoeken haaks. Teken het pad met rechte hoeken (houd Shift voor 15°-stappen).' : 'In een bocht lopen de platen iets door, zodat de buitenkant bedekt blijft.'}</div>
            </div>
          );
        })()}
        {item.soort === 'rechthoek' && parametrisch && (
          <Veld label="Afgeronde hoeken" eenheid="m" soort="number" waarde={p.afronding || 0} uitgeschakeld={ro}
            onBewaar={(v) => { const np = { ...p, afronding: Math.max(0, v) }; onGeometrie(geo.parametrischeVorm('rechthoek', np), { afronding: Math.max(0, v) }); }} />
        )}
        {['veelhoek', 'ellips', 'sector'].includes(item.soort) && (
          <div className="fm-raster3">
            {item.soort === 'veelhoek' && <>
              <Veld label="Zijden" soort="number" waarde={p.zijden || 3} uitgeschakeld={ro} onBewaar={(v) => { const np = { ...p, zijden: Math.max(3, Math.min(24, Math.round(v))) }; onGeometrie(geo.parametrischeVorm('veelhoek', np), np); }} />
              <Veld label="Straal" eenheid="m" soort="number" waarde={geo.rond(p.straal || 5, 2)} uitgeschakeld={ro} onBewaar={(v) => { if (v > 0) { const np = { ...p, straal: v }; onGeometrie(geo.parametrischeVorm('veelhoek', np), np); } }} />
              <Veld label="Draaiing" eenheid="°" soort="number" waarde={p.rot || 0} uitgeschakeld={ro} onBewaar={(v) => { const np = { ...p, rot: v }; onGeometrie(geo.parametrischeVorm('veelhoek', np), np); }} />
            </>}
            {item.soort === 'ellips' && <>
              <Veld label="Breedte" eenheid="m" soort="number" waarde={geo.rond((p.rx || 5) * 2, 2)} uitgeschakeld={ro} onBewaar={(v) => { if (v > 0) { const np = { ...p, rx: v / 2 }; onGeometrie(geo.parametrischeVorm('ellips', np), np); } }} />
              <Veld label="Hoogte" eenheid="m" soort="number" waarde={geo.rond((p.ry || 3) * 2, 2)} uitgeschakeld={ro} onBewaar={(v) => { if (v > 0) { const np = { ...p, ry: v / 2 }; onGeometrie(geo.parametrischeVorm('ellips', np), np); } }} />
              <Veld label="Draaiing" eenheid="°" soort="number" waarde={p.rot || 0} uitgeschakeld={ro} onBewaar={(v) => { const np = { ...p, rot: v }; onGeometrie(geo.parametrischeVorm('ellips', np), np); }} />
            </>}
            {item.soort === 'sector' && <>
              <Veld label="Straal" eenheid="m" soort="number" waarde={geo.rond(p.straal || 20, 2)} uitgeschakeld={ro} onBewaar={(v) => { if (v > 0) { const np = { ...p, straal: v }; onGeometrie(geo.parametrischeVorm('sector', np), np); } }} />
              <Veld label="Richting" eenheid="°" soort="number" waarde={p.richting || 0} uitgeschakeld={ro} onBewaar={(v) => { const np = { ...p, richting: ((v % 360) + 360) % 360 }; onGeometrie(geo.parametrischeVorm('sector', np), np); }} />
              <Veld label="Openingshoek" eenheid="°" soort="number" waarde={p.hoek || 60} uitgeschakeld={ro} onBewaar={(v) => { const np = { ...p, hoek: Math.max(1, Math.min(359, v)) }; onGeometrie(geo.parametrischeVorm('sector', np), np); }} />
            </>}
          </div>
        )}
        {item.soort === 'cirkel' && (
          <Veld label="Straal" eenheid="m" soort="number" waarde={geo.rond(p.straal, 2)} uitgeschakeld={ro}
            onBewaar={(v) => v > 0 && onGeometrie(geo.cirkel(p.midden || geo.middelpunt(g), v), { straal: v })} />
        )}
          {(isLijn || (isVlak && !parametrisch && item.soort !== 'element' && !['cirkel', 'ellips', 'veelhoek', 'sector'].includes(item.soort))) && g.coordinates && (isLijn ? g.coordinates.length > 2 : true) && (
            <div className="fm-veld">Hoeken afronden
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Segment waarden={[['0', 'Scherp'], ['1', '1 m'], ['2', '2 m'], ['5', '5 m']]} waarde={String(Number(s.afronden) || 0)} uitgeschakeld={ro} onKies={(k) => onStijl({ afronden: Number(k) > 0 ? Number(k) : null })} />
                <input type="number" min="0" step="0.5" aria-label="Straal in meter" style={{ width: 64 }} disabled={ro} key={s.afronden || 0} defaultValue={s.afronden || ''} placeholder="m"
                  onBlur={(e) => { const v = Number(e.target.value); if (v !== (Number(s.afronden) || 0)) onStijl({ afronden: v > 0 ? v : null }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              </div>
            </div>
          )}
          {isLijn && item.soort !== 'element' && g.coordinates?.length > 40 && !ro && (() => { const n2 = vereenvoudigLijn(g.coordinates).length; return n2 < g.coordinates.length - 5 ? (
            <div className="fm-veld">
              <span>{g.coordinates.length} punten<Info>Een ingelezen spoor (GPX, KML, KMZ) heeft vaak punten om de paar meter: moeilijk te verslepen. Vereenvoudigen houdt de vorm (tot 0,4 m afwijking).</Info></span>
              <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onGeometrie({ type: 'LineString', coordinates: vereenvoudigLijn(g.coordinates) }, { bogen: undefined, koord: undefined })}>Vereenvoudigen tot {n2} punten</button>
            </div>) : null; })()}
          {isLijn && el?.tekenwijze === 'lijn' && el.eigenschappen?.paal_naam && (
            <div className="fm-veld">Uitvoering
              <div className="fm-segment">{[['net', 'Paal met net'], ['koord', 'Paal met koord']].map(([k, n]) => <button key={k} type="button" disabled={ro} className={(p.koordAlles ? 'koord' : 'net') === k ? 'aan' : ''} onClick={() => onWijzig({ parameters: { ...p, koordAlles: k === 'koord' || undefined, koord: undefined } })}>{n}</button>)}</div>
              <span className="fm-sub">Per vak afwijken: rechtsklik op een vak van de lijn.</span>
            </div>
          )}
          {/* Gele vlag enkel op een paal (punt) of een lijn zonder toebehoren; op hekken is het een toebehoren. */}
          {((g.type === 'Point' && (!el || /paal|post|vlag/i.test(`${el.naam} ${el.categorie || ''}`))) || isLijn) && !(item.soort === 'element' && el?.tekenwijze === 'lijn' && Number(el.eenheid_m) > 0 && isLijn && toebehorenVan(el).length > 0) && (
            <div className="fm-veld">Gele vlag<Info>Een gele vlag op de kop van een paal: op het begin of het einde van een lijn (hek, paal en net), of op een punt zoals een materiaalpost. Op een ander knooppunt van een lijn: rechtsklik op dat punt.</Info>
              {g.type === 'Point'
                ? <label className="fm-vink"><input type="checkbox" disabled={ro} checked={!!p.vlag} onChange={(e) => onWijzig({ parameters: { ...p, vlag: e.target.checked || undefined } })} />Gele vlag erop</label>
                : <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label className="fm-vink"><input type="checkbox" disabled={ro} checked={!!p.vlagBegin} onChange={(e) => onWijzig({ parameters: { ...p, vlagBegin: e.target.checked || undefined } })} />Op het begin</label>
                  {isLijn && <label className="fm-vink"><input type="checkbox" disabled={ro} checked={!!p.vlagEind} onChange={(e) => onWijzig({ parameters: { ...p, vlagEind: e.target.checked || undefined } })} />Op het einde</label>}
                  {p.vlaggen?.length > 0 && <span className="fm-sub">+ {p.vlaggen.length} op een knooppunt{!ro && <> · <button type="button" className="fm-link" onClick={() => onWijzig({ parameters: { ...p, vlaggen: undefined } })}>weg</button></>}</span>}
                </div>}
            </div>
          )}
          {isLijn && !p.koordAlles && p.koord?.length > 0 && (
            <div className="fm-veld">
              <span>{p.koord.length} {p.koord.length === 1 ? 'vak' : 'vakken'} met enkel een koord (geen net)<Info>Rechtsklik op een vak van de lijn: koord of weer net.</Info></span>
              {!ro && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onWijzig({ parameters: { ...p, koord: undefined } })}>Overal weer net</button>}
            </div>
          )}
          {isLijn && !p.route && (() => {
            const hl = (p.hulplijnen || []).map(Number).filter((x) => x > 0);
            const zet = (lijst) => onWijzig({ parameters: { ...p, hulplijnen: lijst.length ? [...new Set(lijst)].sort((a, b) => a - b) : undefined } });
            const sleutel = hl.join(';');
            return (
              <div className="fm-veld">
                <span>Hulplijnen links en rechts<Info>Stippellijnen evenwijdig met deze lijn op elke afstand, bv. om nadar en netten langs het parcours te tekenen. Wat je tekent klikt eraan vast. Enkel op het scherm, niet op de PDF.</Info></span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Segment waarden={[['', 'Geen'], ['1;2', '1 · 2 m'], ['2;4', '2 · 4 m'], ['1;2;3;4;5', '1 tot 5 m']]} waarde={sleutel} uitgeschakeld={ro} onKies={(k) => zet(k ? k.split(';').map(Number) : [])} />
                  <input type="text" aria-label="Afstanden in meter" style={{ width: 110 }} disabled={ro} key={sleutel} defaultValue={hl.map((x) => String(x).replace('.', ',')).join(' ')} placeholder="bv. 1,5 3 6"
                    onBlur={(e) => { const l = e.target.value.split(/[\s;/]+/).map((x) => Number(x.replace(',', '.'))).filter((x) => x > 0 && x < 500); if (l.join(';') !== sleutel) zet(l); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                </div>
                {hl.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {hl.map((d, i) => (
                      <label key={d} title={`Kleur van de hulplijnen op ${String(d).replace('.', ',')} m`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: ro ? 'default' : 'pointer' }}>
                        <span style={{ width: 14, height: 14, borderRadius: 3, background: hulpKleur(item, d, i), position: 'relative', border: '1px solid rgba(0,0,0,.15)' }}>
                          {!ro && <input type="color" value={hulpKleur(item, d, i)} onChange={(e) => onWijzig({ parameters: { ...p, hulpkleuren: { ...(p.hulpkleuren || {}), [String(d)]: e.target.value } } })} style={{ opacity: 0, position: 'absolute', inset: 0, width: 14, height: 14, cursor: 'pointer' }} aria-label={`Kleur hulplijn ${d} m`} />}
                        </span>
                        {String(d).replace('.', ',')} m
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        {(isLijn || (isVlak && !parametrisch && !['cirkel', 'ellips', 'veelhoek', 'sector'].includes(item.soort))) && (() => {
          const zz = geo.zijden(g);
          if (zz.length < 1 || zz.length > 40) return null;
          return (
            <details className="fm-meer" open={zz.length <= 8}><summary>Zijden exact · {zz.length}<Info>Typ een lengte of richting (kompas: 0 = noord, 90 = oost). {isVlak ? 'Een lengte rekt de vorm op en houdt de hoeken haaks; een richting draait wat erna komt.' : 'Wat erna komt schuift mee.'}</Info></summary>
              <div className="fm-zijden">
                <span className="kop">#</span><span className="kop">Lengte (m)</span><span className="kop">Richting (°)</span>
                {zz.map((z, i) => (
                  <Fragment key={i}>
                    <span className="nr">{i + 1}</span>
                    {z.sluit && !isVlak ? <span className="sluit">{geo.getal(z.lengte, 2)}</span>
                      : <Veld label="" soort="number" waarde={geo.rond(z.lengte, 2)} uitgeschakeld={ro} onBewaar={(v) => v > 0 && onGeometrie(geo.zetZijde(g, i, { lengte: v }), {})} />}
                    {z.sluit ? <span className="sluit">{geo.getal(z.richting, 1)}</span>
                      : <Veld label="" soort="number" waarde={geo.rond(z.richting, 1)} uitgeschakeld={ro} onBewaar={(v) => onGeometrie(geo.zetZijde(g, i, { richting: ((v % 360) + 360) % 360 }), {})} />}
                  </Fragment>
                ))}
              </div>
            </details>
          );
        })()}
        {g.type === 'Point' && (
          <div className="fm-raster2">
            <Veld label="Breedtegraad" soort="number" waarde={geo.rond(g.coordinates[1], 6)} uitgeschakeld={ro}
              onBewaar={(v) => onGeometrie({ type: 'Point', coordinates: [g.coordinates[0], v] }, { midden: [g.coordinates[0], v] })} />
            <Veld label="Lengtegraad" soort="number" waarde={geo.rond(g.coordinates[0], 6)} uitgeschakeld={ro}
              onBewaar={(v) => onGeometrie({ type: 'Point', coordinates: [v, g.coordinates[1]] }, { midden: [v, g.coordinates[1]] })} />
          </div>
        )}
      </Blok>


    </>
  );
  const meerBlokken = (
    <>
      {item.soort !== 'tekst' && item.soort !== 'notitie' && (
        <Blok titel="Veiligheid" open={!!(velden.dichtheid || s.zone_m) || isPubliekeStructuur(item, el)} info="Vrije zone: afstand die rond het item vrij moet blijven (generator, brandweg); staat als rand op de kaart en telt mee in de controle. Bezetting: personen per m² voor de capaciteit van het plan.">
          {item.soort === 'element' && item.geometrie?.type === 'Polygon' && /tent|structu|chapiteau|paviljoen/i.test(el?.categorie || '') && (() => {
            const pub = isPubliekeStructuur(item, el);
            const ib = instBrand(plan);
            const cap = capaciteit(item, el, ib.regels);
            return (
              <div className="fm-veld">
                <label className="fm-vink"><input type="checkbox" disabled={ro} checked={pub} onChange={() => onWijzig({ velden: { ...velden, publiek: !pub } })} />Publiek toegankelijk<Info>Publieke tent: de controle telt nooduitgangen, breedtes en blustoestellen. Zonder eigen aantal rekent ze met {String(ib.regels.personen_per_m2).replace('.', ',')} personen per m².</Info></label>
                {pub && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input key={`p-${item.id}-${velden.personen ?? ''}`} inputMode="numeric" disabled={ro} style={{ width: 70 }} defaultValue={velden.personen ?? ''} placeholder={String(cap.personen)}
                      onBlur={(e) => { const v = e.target.value.trim() === '' ? null : Math.round(Number(e.target.value)); if (v === null || v >= 0) onWijzig({ velden: { ...velden, personen: v } }); }} />
                    <span className="fm-sub">personen max. ({Math.round(cap.opp)} m²{cap.eigen ? '' : ', berekend'})</span>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="fm-raster2">
            <Veld label="Vrije zone rondom" eenheid="m" soort="number" waarde={s.zone_m || ''} onBewaar={(v) => onStijl({ zone_m: v > 0 ? v : null })} uitgeschakeld={ro} placeholder="bv. 10" />
            {isVlak && (uitgebreid || velden.dichtheid) && (
              <Veld label="Bezetting" eenheid="p/m²" soort="number" waarde={velden.dichtheid ?? ''} uitgeschakeld={ro} onBewaar={(v) => zetVeld('dichtheid', v || null)} placeholder="bv. 2" />
            )}
          </div>
        </Blok>
      )}

      {familie !== 'stroom' && magModule('stroom') && <StroomSectie item={item} el={el} items={items} elementenMap={elementenMap} ro={ro} isLijn={isLijn} vast={vast}
        onZet={(patch) => onWijzig({ velden: { ...velden, stroom: { ...(velden.stroom || {}), ...patch } } })} onKabel={onKabel} />}

      {item.soort !== 'tekst' && magModule('veiligheid') && (
        <Blok titel={`Keuringsattesten${velden.attesten?.length ? ` · ${velden.attesten.length}` : ''}`} open={!!velden.attesten?.length}>
          <AttestenBewerken item={item} planId={item.plan_id} ro={ro} onZet={(l) => zetVeld('attesten', l)} />
        </Blok>
      )}
      <Blok titel="Planning en notitie" open={!!(item.notitie || velden.opbouw || velden.afbraak || velden.verantwoordelijke)}>
        <div className="fm-raster2">
          <Veld label="Plaatsen" waarde={velden.opbouw} onBewaar={(v) => zetVeld('opbouw', v || null)} uitgeschakeld={ro} placeholder="za 06:00" />
          <Veld label="Weghalen" waarde={velden.afbraak} onBewaar={(v) => zetVeld('afbraak', v || null)} uitgeschakeld={ro} placeholder="zo 19:00" />
          <Veld label="Verantwoordelijke" waarde={velden.verantwoordelijke} onBewaar={(v) => zetVeld('verantwoordelijke', v || null)} uitgeschakeld={ro} />
          <Veld label="Contact" waarde={velden.contact} onBewaar={(v) => zetVeld('contact', v || null)} uitgeschakeld={ro} />
        </div>
        <Veld label="Notitie" waarde={item.notitie} onBewaar={(v) => onWijzig({ notitie: v || null })} uitgeschakeld={ro} rijen={3} />
        <div className="fm-raster2">
          <Veld label="Hoogte" eenheid="m" soort="number" waarde={velden.hoogte ?? ''} onBewaar={(v) => zetVeld('hoogte', v || null)} uitgeschakeld={ro} placeholder={el?.hoogte_m ? `${el.hoogte_m} (bibliotheek)` : 'bv. tent 5'} />
          <Veld label="Vrije hoogte eronder" eenheid="m" soort="number" waarde={velden.doorrijhoogte ?? ''} onBewaar={(v) => zetVeld('doorrijhoogte', v || null)} uitgeschakeld={ro} placeholder="boog, bovenleiding, boom" />
        </div>
        <label className="fm-vink"><input type="checkbox" checked={!!velden.grond} disabled={ro} onChange={(e) => zetVeld('grond', e.target.checked || null)} />Werken in de grond</label>
        <div className="fm-raster2">
          <label className="fm-veld">Entry
            <select value={velden.entry?.soort || ''} disabled={ro} onChange={(e) => zetVeld('entry', e.target.value ? { ...(velden.entry || {}), soort: e.target.value } : null)}>
              <option value="">Niet voor Entry</option><option value="zone">Toegangszone</option><option value="parking">Parking</option>
            </select>
          </label>
          {velden.entry?.soort && <Veld label="Toegangsniveau" waarde={velden.entry?.niveau || ''} onBewaar={(v) => zetVeld('entry', { ...velden.entry, niveau: v || null })} uitgeschakeld={ro} placeholder="bv. VIP, Pers, Teams" />}
        </div>
        {(isLijn || g.type === 'Point') && (
          <details open={!!velden.afsluiting}>
            <summary className="fm-sub" style={{ cursor: 'pointer' }}>Wegafsluiting (lijst voor de politie)</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
              <label className="fm-veld">Soort
                <select value={velden.afsluiting?.soort || ''} disabled={ro} onChange={(e) => zetVeld('afsluiting', e.target.value ? { ...(velden.afsluiting || {}), soort: e.target.value } : null)}>
                  <option value="">Geen afsluiting</option><option value="volledig">Volledig afgesloten</option><option value="plaatselijk">Plaatselijk verkeer</option><option value="eenrichting">Eenrichting</option><option value="parkeerverbod">Parkeerverbod</option>
                </select>
              </label>
              {velden.afsluiting?.soort && (
                <>
                  <Veld label="Straat" waarde={velden.afsluiting.straat || ''} onBewaar={(v) => zetVeld('afsluiting', { ...velden.afsluiting, straat: v || null })} uitgeschakeld={ro} />
                  <div className="fm-raster2">
                    <label className="fm-veld">Van<input type="datetime-local" disabled={ro} value={velden.afsluiting.van || ''} onChange={(e) => zetVeld('afsluiting', { ...velden.afsluiting, van: e.target.value || null })} /></label>
                    <label className="fm-veld">Tot<input type="datetime-local" disabled={ro} value={velden.afsluiting.tot || ''} onChange={(e) => zetVeld('afsluiting', { ...velden.afsluiting, tot: e.target.value || null })} /></label>
                  </div>
                </>
              )}
            </div>
          </details>
        )}
        {(fotos?.length > 0 || item.velden?.binnenplan || el?.eigenschappen?.binnenlocatie) && item.plan_id && (
          <FotoStrook key={item.id} planId={item.plan_id} itemId={item.id} schrijven={schrijven} />
        )}
        {item.geplaatst_op && <div className="fm-sub">Geplaatst op {new Date(item.geplaatst_op).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}</div>}
      </Blok>

      {schrijven && uitgebreid && (
        <Blok titel="Geavanceerd" open={false}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!el && <button className="fm-knop klein" onClick={onAlsElement}>Bewaar als element</button>}
            {plan.plek_id && <button className="fm-knop klein" onClick={() => onActie?.('plaatsfiche')}>Naar vaste items van deze locatie</button>}
            {g.type !== 'Point' && !parametrisch && <button className="fm-knop klein" onClick={async () => { const f = await vraagTekst('Schalen met factor (bv. 1,5 of 0,5)', '1'); const v = Number(String(f || '').replace(',', '.')); if (v > 0 && v !== 1) onActie?.('schaal', v); }}>Schalen</button>}
            <button className="fm-knop klein" onClick={async () => { const m = await vraagTekst('Bufferzone rond dit item, in meter', '5'); const v = Number(String(m || '').replace(',', '.')); if (v > 0) onActie?.('buffer', v); }}>Bufferzone</button>
            {plannen?.length > 0 && (
              <select value="" onChange={(e) => e.target.value && onActie?.('kopieer-plan', e.target.value)} style={{ height: 30 }} aria-label="Kopiëren naar ander plan">
                <option value="">Kopiëren naar plan…</option>
                {plannen.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
              </select>
            )}
          </div>
          {isVlak && (
            <PathfinderBlok item={item} items={items} onActie={onActie} />
          )}
          {parametrisch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
              <div className="fm-sub">Raster maken vanaf dit item</div>
              <div className="fm-raster2">
                <Veld label="Rijen" soort="number" waarde={raster.rijen} onBewaar={(v) => setRaster((r) => ({ ...r, rijen: Math.max(1, Math.round(v)) }))} />
                <Veld label="Kolommen" soort="number" waarde={raster.kolommen} onBewaar={(v) => setRaster((r) => ({ ...r, kolommen: Math.max(1, Math.round(v)) }))} />
                <Veld label="Tussen kolommen" eenheid="m" soort="number" waarde={raster.x} onBewaar={(v) => setRaster((r) => ({ ...r, x: v }))} />
                <Veld label="Tussen rijen" eenheid="m" soort="number" waarde={raster.y} onBewaar={(v) => setRaster((r) => ({ ...r, y: v }))} />
              </div>
              <button className="fm-knop klein" onClick={() => onRaster(raster.rijen, raster.kolommen, raster.x, raster.y)}>{raster.rijen * raster.kolommen - 1} kopieën maken</button>
            </div>
          )}
          {isLijn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
              <div className="fm-sub">Elementen langs deze lijn zetten</div>
              <label className="fm-veld">Element
                <select value={langs.element} onChange={(e) => setLangs((l) => ({ ...l, element: e.target.value }))}>
                  <option value="">Kies…</option>
                  {elementen.filter((e) => e.tekenwijze !== 'lijn').map((e) => <option key={e.id} value={e.id}>{e.naam}</option>)}
                </select>
              </label>
              <Veld label="Om de" eenheid="m" soort="number" waarde={langs.interval} onBewaar={(v) => setLangs((l) => ({ ...l, interval: v }))} />
              <button className="fm-knop klein" disabled={!langs.element || !(langs.interval > 0)}
                onClick={() => onLangsLijn(langs.element, langs.interval)}>
                {langs.element && langs.interval > 0 ? `${Math.floor((m.lengte || 0) / langs.interval) + 1} plaatsen` : 'Plaatsen'}
              </button>
            </div>
          )}
        </Blok>
      )}
    </>
  );
  function assembleer() {
    // Stijl (kleur, lijn, vulling) is een tab bij vrije vormen en elementen zonder tekening; een element met tekening
    // volgt zijn element en laag, en heeft enkel "Label op de kaart" onder Instellen.
    const isBouwer0 = familie === 'bouwers' && !!el;
    const metStijl = !tekening && !isBouwer0;
    const isBouwer = familie === 'bouwers' && !!el && (isTentBouw(el) || !!el.eigenschappen?.stelling || !!el.eigenschappen?.stelling3d || isWand(el) || (el.tekenwijze === 'lijn' && /truss/i.test(el.categorie || '')) || isTentCategorie(el.categorie));
    // Binnen: tenten, units en vrije vlakken; geen stellingen, truss of wanden.
    const metBinnen = magModule('binnen') && !!binnenplan && !!(binnenplan.ruimte || (binnenplan.open && (['units', 'vormen'].includes(familie) || (familie === 'bouwers' && isTentBouw(el)))));
    const stroomTab = familie === 'stroom' && magModule('stroom');
    const standaard = isBouwer ? 'bouwer' : brandingJsx && (familie === 'branding' || panelenJsx) ? 'branding' : stroomTab ? 'stroom' : familie === 'vormen' && item.soort !== 'notitie' ? 'stijl' : 'in';
    const tab = tabKeuze || standaard;
    const tabs = [isBouwer && { k: 'bouwer', naam: cameraJsx ? 'Camera' : 'Bouwer' }, stroomTab && { k: 'stroom', naam: lichtJsx ? 'Licht' : 'Stroom' }, { k: 'in', naam: legTab ? 'Leggen' : 'Instellen' }, brandingJsx && { k: 'branding', naam: 'Branding' }, metBinnen && { k: 'binnen', naam: 'Binnen' }, metStijl && { k: 'stijl', naam: g.type === 'Point' && familie === 'vormen' ? 'Icoon' : 'Stijl' }, { k: 'meer', naam: 'Meer' }];
    return (
      <div className="fm-paneel2" data-familie={familie}>
        <PaneelKop std={plan?.instellingen?.leveranciers || null} item={item} el={el} elementen={elementen} lagen={lagen} fasen={fasen} items={items} elementenMap={elementenMap} schrijven={schrijven}
          onWijzig={onWijzig} onWissel={wissel} onActie={(a, arg) => onMenu?.(a, arg)} groepNaam={groepNaam} groepAantal={groepAantal} iso={iso} />
        <Kern groot={kern.groot} klein={kern.klein} />
        <PaneelTabs tabs={tabs} tab={tab} onTab={setTabKeuze} />
        {tab === 'bouwer' && <>{cameraJsx}{bouwerBlokken}</>}
        {tab === 'in' && !isBouwer && <>{cameraJsx}{kabelcamJsx}</>}
        {tab === 'branding' && brandingJsx}
        {tab === 'stroom' && lichtJsx}
        {tab === 'stroom' && <StroomSectie item={item} el={el} items={items} elementenMap={elementenMap} ro={ro} isLijn={isLijn} vast={vast} open
          onZet={(patch) => onWijzig({ velden: { ...velden, stroom: { ...(velden.stroom || {}), ...patch } } })} onKabel={onKabel} />}
        {tab === 'in' && <>{!stroomTab && lichtJsx}{!metBinnen && binnenplanJsx}{instellenKop}{matenEnOpstelling}{!isBouwer && bouwerBlokken}{labelVinkjes && <div className="fm-sectie">{labelVinkjes}</div>}</>}
        {tab === 'binnen' && <div className="fm-sectie">{binnenplanJsx}</div>}
        {tab === 'stijl' && metStijl && renderStijl()}
        {tab === 'meer' && <>{!metStijl && renderStijl()}{meerBlokken}</>}
      </div>
    );
  }
  return assembleer();
}

export function StroomSectie({ item, el, items, elementenMap, ro, isLijn, onZet, onKabel, vast = [], open = null }) {
  const st = stroomVan(item, el);
  const rollen = isLijn ? ROLLEN.filter(([k]) => k === '' || k === 'kabel') : ROLLEN.filter(([k]) => k !== 'kabel');
  if (!st.rol && ro) return null;
  // Bronnen en kasten in het plan, plus de vaste aansluitingen van de stad (register over alle evenementen).
  const voedingen = [...vast.map(alsStroomItem), ...items.filter((i) => i.id !== item.id && ['bron', 'kast'].includes(stroomVan(i, elementenMap.get(i.element_id)).rol))];
  const naam = (i) => (i.vast ? `${i.naam} (vast${i.vast.max_ampere ? `, ${i.vast.max_ampere} A` : ''})` : i.naam || elementenMap.get(i.element_id)?.naam || (i.velden?.stroom?.invoer ? 'Stroominvoer' : 'Zonder naam'));
  const getalOf = (v) => (v === '' || v == null ? null : Number(v));
  return (
    <Blok titel="Elektriciteit" open={open ?? !!st.rol}>
      <label className="fm-veld">Rol
        <select value={st.rol || ''} disabled={ro} onChange={(e) => onZet({ rol: e.target.value })}>
          {rollen.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>
      {st.rol === 'bron' && (
        <div className="fm-raster3">
          <Veld label="Vermogen" eenheid="kVA" soort="number" waarde={st.kva ?? ''} onBewaar={(v) => onZet({ kva: getalOf(v) })} uitgeschakeld={ro} />
          <Veld label="cos φ" soort="number" waarde={st.cosphi} onBewaar={(v) => onZet({ cosphi: getalOf(v) })} uitgeschakeld={ro} />
          <Veld label="Verbruik" eenheid="l/u" soort="number" waarde={st.liter_per_uur ?? ''} onBewaar={(v) => onZet({ liter_per_uur: getalOf(v) })} uitgeschakeld={ro} />
        </div>
      )}
      {st.rol === 'verbruiker' && st.aansluitingen?.length > 0 && (
        <div className="fm-aansluitingen">
          {st.aansluitingen.map((a, i) => {
            const zetA = (patch) => {
              const eigen = [...(item.velden?.stroom?.aansluitingen || [])];
              eigen[i] = { ...(eigen[i] || {}), ...patch };
              onZet({ aansluitingen: eigen });
            };
            return (
              <div key={i} className="fm-aansluiting">
                <div className="kop">{a.naam || `Aansluiting ${i + 1}`} · {a.ampere || '?'} A · {a.fase === '3F' ? '3 fasen' : a.fase}</div>
                <label className="fm-veld">Gevoed door
                  <select value={a.voeding || ''} disabled={ro} onChange={(e) => zetA({ voeding: e.target.value || null })}>
                    <option value="">Niet aangesloten</option>
                    {voedingen.map((v) => <option key={v.id} value={v.id}>{naam(v)}</option>)}
                  </select>
                </label>
                <div className="fm-raster2">
                  <Veld label="Vermogen" eenheid="kW" soort="number" waarde={a.kw ?? ''} onBewaar={(v) => zetA({ kw: getalOf(v) || null })} uitgeschakeld={ro} />
                  <label className="fm-veld">Fase
                    <select value={a.fase} disabled={ro} onChange={(e) => zetA({ fase: e.target.value })}>{FASEN_EL.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                  </label>
                </div>
              </div>
            );
          })}
          {!ro && st.aansluitingen.some((a) => a.voeding) && onKabel && <button className="fm-knop klein" onClick={() => onKabel(item.id)}>Kabel tekenen vanaf de voeding</button>}
        </div>
      )}
      {st.rol === 'verbruiker' && (
        <div>
          <Veld label="Eigen kabel" eenheid="m" soort="number" waarde={item.velden?.stroom?.eigen_kabel ?? ''} placeholder={el?.eigenschappen?.eigen_kabel_m ? String(el.eigenschappen.eigen_kabel_m) : 'geen'} onBewaar={(v) => onZet({ eigen_kabel: getalOf(v) || null })} uitgeschakeld={ro} />
          <div className="fm-sub">Brengt de verbruiker zelf kabel mee (LED-trailer, Portix …)? Dan volstaat een kast binnen dat bereik en komt die kabel niet op onze bestellijst.</div>
        </div>
      )}
      {(st.rol === 'kast' || (st.rol === 'verbruiker' && !st.aansluitingen?.length)) && (
        <>
          <label className="fm-veld">Gevoed door
            <select value={st.voeding || ''} disabled={ro} onChange={(e) => onZet({ voeding: e.target.value || null })}>
              <option value="">Niet aangesloten</option>
              {voedingen.map((v) => <option key={v.id} value={v.id}>{naam(v)}</option>)}
            </select>
          </label>
          <div className={st.rol === 'verbruiker' ? 'fm-raster3' : 'fm-raster2'}>
            <label className="fm-veld">{st.rol === 'kast' ? 'Ingang' : 'Aansluiting'}
              <select value={st.ampere ?? ''} disabled={ro} onChange={(e) => onZet({ ampere: getalOf(e.target.value) })}>
                <option value="">?</option>{AANSLUITINGEN.map((a) => <option key={a} value={a}>{a} A</option>)}
              </select>
            </label>
            {st.rol === 'kast' && !el?.eigenschappen?.ingang && (
              // Stekker van een kast zonder bibliotheekgegevens (bv. een invoerpunt in een gebouw): bepaalt de kabel en de doorlus.
              <label className="fm-veld">Stekker
                <select value={st.ingang || ''} disabled={ro} onChange={(e) => onZet({ ingang: e.target.value || null })}>
                  <option value="">?</option>{UITGANG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            )}
            {st.rol === 'kast' && isMonoKnoop(st) && (
              <label className="fm-veld">Fase
                <select value={st.fase === '3F' ? 'L1' : st.fase} disabled={ro} onChange={(e) => onZet({ fase: e.target.value })}>{FASEN_EL.filter(([k]) => k !== '3F').map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
              </label>
            )}
            {st.rol === 'verbruiker' && <Veld label="Vermogen" eenheid="kW" soort="number" waarde={st.kw ?? ''} onBewaar={(v) => onZet({ kw: getalOf(v) })} uitgeschakeld={ro} />}
            {st.rol === 'verbruiker' && (
              <label className="fm-veld">Fase
                <select value={st.fase} disabled={ro} onChange={(e) => onZet({ fase: e.target.value })}>{FASEN_EL.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
              </label>
            )}
          </div>
          {!ro && st.voeding && onKabel && <button className="fm-knop klein" onClick={() => onKabel(item.id)}>Kabel tekenen vanaf de voeding</button>}
        </>
      )}
      {st.rol === 'kabel' && (
        <>
          <label className="fm-veld">Kabeltype
            <select value={st.kabeltype || ''} disabled={ro} onChange={(e) => onZet({ kabeltype: e.target.value || null })}>
              <option value="">?</option>{KABELTYPES.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <div className="fm-raster2">
            <label className="fm-veld">Van
              <select value={st.van || ''} disabled={ro} onChange={(e) => onZet({ van: e.target.value || null })}>
                <option value="">?</option>{voedingen.map((v) => <option key={v.id} value={v.id}>{naam(v)}</option>)}
              </select>
            </label>
            <label className="fm-veld">Naar
              <select value={st.naar || ''} disabled={ro} onChange={(e) => onZet({ naar: e.target.value || null })}>
                <option value="">?</option>{items.filter((i) => i.id !== item.id && stroomVan(i, elementenMap.get(i.element_id)).rol && stroomVan(i, elementenMap.get(i.element_id)).rol !== 'kabel').flatMap((v) => {
                  const sv = stroomVan(v, elementenMap.get(v.element_id));
                  if (sv.aansluitingen?.length) return sv.aansluitingen.map((a, j) => <option key={`${v.id}#${j}`} value={`${v.id}#${j}`}>{naam(v)} · {a.naam || `${a.ampere || '?'} A`}</option>);
                  return [<option key={v.id} value={v.id}>{naam(v)}</option>];
                })}
              </select>
            </label>
          </div>
          {(() => { const L = kabelLengte(item); const b = kabelBestelling(L * 1.1, st.kabeltype, kabelLengtesVan(elementenMap)); return <div className="fm-sub">Lengte {geo.getal(L, 1)} m{item.velden?.binnen ? ' (binnen)' : ''} · met 10 % marge: {b.standaard ? `${b.tekst} (${b.meter} m)` : `${b.meter} m, per 25 m`}.</div>; })()}
        </>
      )}
    </Blok>
  );
}

function PathfinderBlok({ item, items, onActie }) {
  const [ander, setAnder] = useState('');
  const kandidaten = items.filter((i) => i.id !== item.id && i.geometrie?.type === 'Polygon');
  if (!kandidaten.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
      <div className="fm-sub">Pathfinder met een ander vlak</div>
      <select value={ander} onChange={(e) => setAnder(e.target.value)} style={{ height: 30 }}>
        <option value="">Kies een vlak…</option>
        {kandidaten.map((k) => <option key={k.id} value={k.id}>{k.naam || SOORT[k.soort] || k.soort}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['samenvoegen', 'Samenvoegen'], ['aftrekken', 'Aftrekken'], ['snijden', 'Snijden']].map(([k, t]) => (
          <button key={k} className="fm-knop klein" disabled={!ander} onClick={() => onActie?.('pathfinder', { ander, bewerking: k })}>{t}</button>
        ))}
      </div>
    </div>
  );
}



// Per hek een doek uit de doekenbibliotheek van FLCS.
function DoekPerHek({ item, el, doeken, elementenMap, onWijzig, penseel, onPenseel }) {
  const velden = item.velden || {};
  const n = Math.max(0, nadenVan(item.geometrie, el, item.parameters?.bogen, item.parameters?.openingen).length - 1);
  const lijst = Array.from({ length: n }, (_, i) => (velden.doeken || [])[i] || null);
  const [van, setVan] = useState(1); const [tot, setTot] = useState(n); const [kies, setKies] = useState(doeken[0]?.id || '');
  const [patroon, setPatroon] = useState([]);
  useEffect(() => { setTot(n); }, [n, item.id]);
  const zet = (l) => onWijzig({ velden: { ...velden, doeken: l } });
  const kleur = (id) => elementenMap.get(id)?.eigenschappen?.kleur || '#E11D48';
  const runs = doekRuns({ velden: { doeken: lijst } }, elementenMap);
  const opties = <>{doeken.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}</>;
  const actief = !!penseel && !penseel.tb && penseel.itemId === item.id;
  const lijnAan = !actief && n > 0 && lijst.some(Boolean) && lijst.every((x) => (x || null) === (lijst[0] || null));
  return (
    <div className="fm-veld fm-doekperhek"><span>Doek per hek · {n} hekken<Info>Hekken tellen vanaf het begin van de lijn. Op de kaart staan de nummers bij ver inzoomen.</Info></span>
      <div className="fm-hekstrook" aria-hidden="true">{lijst.map((id, i) => <span key={i} title={`Hek ${i + 1}: ${id ? elementenMap.get(id)?.naam : 'geen doek'}`} style={{ background: id ? kleur(id) : '#ffffff', borderColor: id ? kleur(id) : '#B9BCC1' }} />)}</div>
      <div className="fm-doekrij">
        <select value={kies} onChange={(e) => { setKies(e.target.value); if (actief) onPenseel({ ...penseel, doekId: e.target.value }); }} aria-label="Doek"><option value="">Geen doek</option>{opties}</select>
      </div>
      <div className="fm-doekrij">
        <span className="fm-segment" style={{ width: 'auto' }}>
          <button className={lijnAan ? 'aan' : ''} title={`Dit doek op alle ${n} hekken`} onClick={() => { if (actief) onPenseel(null); zet(lijst.map(() => kies || null)); }}>Hele lijn</button>
          {[['stuk', 'Een stuk'], ['hek', 'Losse hekken']].map(([k, t]) => <button key={k} className={actief && (penseel.modus || 'hek') === k ? 'aan' : ''} title={k === 'stuk' ? 'Klik op de kaart het eerste en het laatste hek' : 'Klik of sleep over de hekken op de kaart'} onClick={() => { if (actief && (penseel.modus || 'hek') === k) return; onPenseel({ itemId: item.id, doekId: kies, modus: k }); }}>{t}</button>)}
        </span>
        {actief && <button className="fm-knop klein zwart" onClick={() => onPenseel(null)}>Klaar</button>}
      </div>
      {actief && <span className="fm-sub">{penseel.modus === 'stuk' ? 'Klik op de kaart het eerste en het laatste hek' : 'Klik of sleep over de hekken'}: ze krijgen "{elementenMap.get(kies)?.naam || 'geen doek'}".</span>}
      {lijnAan && <span className="fm-sub">Alle {n} hekken: "{elementenMap.get(lijst[0])?.naam || 'geen doek'}".</span>}
      <details className="fm-meer"><summary>Op nummer en patroon</summary>
      <div className="fm-doekrij">
        <span>Hek</span><input value={van} inputMode="numeric" aria-label="Van hek" onChange={(e) => setVan(Number(e.target.value) || 1)} /><span>tot</span><input value={tot} inputMode="numeric" aria-label="Tot hek" onChange={(e) => setTot(Number(e.target.value) || n)} />
        <button className="fm-knop klein" onClick={() => { const a = Math.max(1, Math.min(van, tot)); const b = Math.min(n, Math.max(van, tot)); zet(lijst.map((x, i) => (i + 1 >= a && i + 1 <= b ? (kies || null) : x))); }}>Toepassen</button>
      </div>
      <div className="fm-doekrij">
        <span>Patroon</span>
        <select value="" onChange={(e) => e.target.value && setPatroon((p) => [...p, e.target.value])} aria-label="Doek toevoegen aan patroon"><option value="">+ doek…</option>{opties}</select>
        <span className="fm-sub" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patroon.length ? patroon.map((id) => elementenMap.get(id)?.naam).join(', ') : 'bv. A, A, B'}</span>
        {patroon.length > 0 && <button className="fm-knop klein" onClick={() => setPatroon([])}>×</button>}
        <button className="fm-knop klein" disabled={!patroon.length} onClick={() => zet(lijst.map((_, i) => patroon[i % patroon.length]))}>Herhalen</button>
      </div>
      </details>
      {runs.length > 0 && (
        <div className="fm-doekruns">
          {runs.map((r) => <span key={r.van}><i style={{ background: r.id ? kleur(r.id) : '#fff' }} />{r.van === r.tot ? `Hek ${r.van}` : `Hek ${r.van}–${r.tot}`}: {r.naam}</span>)}
        </div>
      )}
      <div className="fm-vinkrij" style={{ gap: 6 }}>
        <button className="fm-knop klein" onClick={() => navigator.clipboard?.writeText(runs.map((r) => `${r.van === r.tot ? `Hek ${r.van}` : `Hek ${r.van}-${r.tot}`}: ${r.naam}`).join('\n'))}>Opbouwlijst kopiëren</button>
        <button className="fm-knop klein gevaar" onClick={() => zet([])}>Alles wissen</button>
      </div>
    </div>
  );
}

// Pipe & drape: per sectie een gordijn (standaard) of een bedrukt doek.
function DrapeDoeken({ item, el, doeken, elementenMap, onWijzig, schrijven }) {
  const n = Math.max(0, nadenVan(item.geometrie, el, item.parameters?.bogen, item.parameters?.openingen).length - 1);
  if (!n) return null;
  const l = Array.from({ length: n }, (_, k) => (item.velden?.doeken || [])[k] || null);
  const zet = (nl) => onWijzig({ velden: { ...(item.velden || {}), doeken: nl.some(Boolean) ? nl : null } });
  return (
    <div className="fm-veld"><span>Doek per sectie · {n} {n === 1 ? 'sectie' : 'secties'}</span>
      {l.map((id, k) => (
        <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <b style={{ width: 18, color: id ? elementenMap.get(id)?.eigenschappen?.kleur : undefined }}>{k + 1}</b>
          <select value={id || ''} disabled={!schrijven} style={{ flex: 1, minWidth: 0 }} onChange={(e) => { const nl = [...l]; nl[k] = e.target.value || null; zet(nl); }}>
            <option value="">Gordijn (geen print)</option>
            {doeken.map((d) => <option key={d.id} value={d.id}>{d.naam}{d.plan_id ? ' (dit event)' : ''}</option>)}
          </select>
        </label>
      ))}
      {schrijven && doeken.length > 0 && n > 1 && (
        <select value="" onChange={(e) => { if (e.target.value) zet(l.map(() => (e.target.value === '-' ? null : e.target.value))); }} aria-label="Alle secties">
          <option value="">Alle secties hetzelfde…</option>
          {doeken.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}
          <option value="-">Alle secties terug gordijn</option>
        </select>
      )}
      {!doeken.length && <span className="fm-sub">Nog geen drape-doeken. Voeg ze toe in de werkruimte Branding.</span>}
    </div>
  );
}

// Infototem: per zijde een bedrukt paneel uit de panelenbibliotheek (Bibliotheek > Doeken).
function TotemPanelen({ item, el = null, panelen, elementenMap, onWijzig, schrijven }) {
  const boog = trussDoek(el) === 'boog' || isFrame(el); const truss = !!trussDoek(el) || isFrame(el);
  const ZIJ = zijdenVan(el);
  const lijst = totemPanelen(item, el);
  const kleur = (id) => (id ? elementenMap.get(id)?.eigenschappen?.kleur || '#16A34A' : '#D4D6DA');
  // Elke zijde is een eigen veld: twee collega's die elk een andere zijde kiezen, overschrijven elkaar niet.
  const zet = (k, id) => onWijzig({ velden: { ...(item.velden || {}), [`paneel_${k + 1}`]: id || null } });
  const alle = (id) => onWijzig({ velden: { ...(item.velden || {}), ...Object.fromEntries(ZIJ.map((_, k) => [`paneel_${k + 1}`, id || null])) } });
  const z = 14; const W = 96;
  return (
    <div className="fm-veld fm-totem"><span>{truss ? (boog ? 'Doek per kant' : 'Doek per zijde') : 'Panelen per zijde'}<Info>{boog ? 'Kant 1 ligt links van de richting waarin je de boog tekende, kant 2 rechts. Op de kaart krijgt elke kant een band in de kleur van zijn doek. Met het penseel (werkruimte Branding, tab Truss) klik je gewoon aan de juiste kant van de boog.' : 'Zijde 1 is de voorkant (onderkant van het blokje bij draaiing 0), daarna met de klok mee. Op de kaart krijgt elke zijde de kleur van zijn ontwerp; bij ver inzoomen staan de nummers erbij.'} {truss ? 'Ontwerpen voeg je toe in de werkruimte Branding, tab Truss.' : 'Panelen beheer je in de bibliotheek, bij Doeken.'}</Info></span>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {boog ? null : <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} aria-hidden="true" style={{ flex: 'none' }}>
          <rect x={z} y={z} width={W - 2 * z} height={W - 2 * z} fill="#F1F5F9" stroke="#8A8D93" />
          {[[z, W - z, W - z, W - z], [W - z, W - z, W - z, z], [W - z, z, z, z], [z, z, z, W - z]].map(([a, b, c, d], k) => <line key={k} x1={a} y1={b} x2={c} y2={d} stroke={kleur(lijst[k])} strokeWidth={8} />)}
          {[[W / 2, W - 2], [W - 5, W / 2 + 4], [W / 2, 11], [5, W / 2 + 4]].map(([x, y], k) => <text key={k} x={x} y={y} fontSize="11" fontWeight="700" textAnchor="middle" fill="#1d1d1b">{k + 1}</text>)}
        </svg>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
          {ZIJ.map((n, k) => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <b style={{ width: 14, color: lijst[k] ? kleur(lijst[k]) : undefined }}>{k + 1}</b>
              <select value={lijst[k] || ''} disabled={!schrijven} onChange={(e) => zet(k, e.target.value)} aria-label={`${truss ? 'Doek' : 'Paneel'} ${n.toLowerCase()}`} style={{ flex: 1, minWidth: 0 }}>
                <option value="">{n.replace(/ \(.*\)$/, '')}: geen {truss ? 'doek' : 'paneel'}</option>
                {panelen.map((d) => <option key={d.id} value={d.id}>{d.naam}{d.plan_id ? ' (dit event)' : ''}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
      {!panelen.length && <span className="fm-sub">{isFrame(el) ? 'Nog geen frame-doeken. Laad er een op in de werkruimte Branding, tab Frame.' : truss ? 'Nog geen truss-doeken. Laad er een op in de werkruimte Branding, tab Truss.' : 'Nog geen panelen. Voeg ze toe in de bibliotheek bij Doeken, met "voor infototem".'}</span>}
      {schrijven && panelen.length > 0 && (
        <select value="" onChange={(e) => { if (e.target.value) alle(e.target.value === '-' ? null : e.target.value); }} aria-label="Alle zijden">
          <option value="">{boog ? 'Beide kanten hetzelfde…' : 'Alle zijden hetzelfde…'}</option>
          {panelen.map((d) => <option key={d.id} value={d.id}>{d.naam}</option>)}
          <option value="-">{boog ? 'Beide kanten leegmaken' : 'Alle zijden leegmaken'}</option>
        </select>
      )}
    </div>
  );
}

// Vaste stelling uit de bibliotheek (bv. camerastelling): 3D-voorbeeld, klik = over het hele scherm.
function Vaste3D({ item, el }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fm-sectie">
      <Knop3D it={item} el={el} elementenMap={new Map()} onOpen={() => setOpen(true)} />
      {open && <Groot3D it={item} el={el} elementenMap={new Map()} onSluit={() => setOpen(false)} />}
    </div>
  );
}
