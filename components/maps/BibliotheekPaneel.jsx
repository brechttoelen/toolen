'use client';
import { StellingDrie, StellingDuim } from './StellingStudio';
import { TentDuim } from './TentStudio';
import { isTentBouw } from './tentbouw';
import { elementMag, elementModule, nietInPakket } from './modules';
import { publiekeUrl } from './db';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getal } from './geo';
import { vergelijkCategorie, rubriekVan, rubriekSecties, rubriekNaam } from './categorieen';
import { zoekScore, vergelijkVariant } from './zoeken';

// Kleine voorvertoning van een gedetailleerde tekening of een sjabloon.
function Voorvertoning({ el, maat }) {
  const t = el.eigenschappen?.tekening;
  if (t) {
    const b = t.b || 1; const h = t.h || 1;
    const pad = (c) => c.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${-y}`).join('');
    const sw = Math.max(b, h) / 120;
    return (
      <svg width={maat} height={maat} viewBox={`${-b / 2 - sw} ${-h / 2 - sw} ${b + 2 * sw} ${h + 2 * sw}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        {(t.vlakken || []).map((v, i) => <path key={`v${i}`} d={v.r.map((r) => `${pad(r)}Z`).join('')} fill={v.vul || 'none'} fillOpacity={v.op ?? 1} stroke={v.lijn || 'none'} strokeWidth={Math.max(sw, v.d || 0)} fillRule="evenodd" />)}
        {(t.lijnen || []).map((l, i) => <path key={`l${i}`} d={pad(l.c)} fill="none" stroke={l.k || '#1d1d1b'} strokeWidth={Math.max(sw, l.d || 0)} />)}
      </svg>
    );
  }
  const items = el.eigenschappen?.items;
  if (el.tekenwijze === 'sjabloon' && items?.length) {
    const lijnen = [];
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const it of items) {
      const g = it.geometrie;
      const ringen = g?.type === 'Polygon' ? g.coordinates : g?.type === 'LineString' ? [g.coordinates] : g?.type === 'Point' ? [[g.coordinates]] : [];
      for (const r of ringen) { lijnen.push({ r, dicht: g.type === 'Polygon', punt: g.type === 'Point', k: it.stijl?.kleur || '#2563EB' }); for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    }
    if (!Number.isFinite(x0)) return null;
    const w = Math.max(x1 - x0, 1); const h = Math.max(y1 - y0, 1); const sw = Math.max(w, h) / 80;
    return (
      <svg width={maat} height={maat} viewBox={`${x0 - sw * 2} ${-y1 - sw * 2} ${w + sw * 4} ${h + sw * 4}`} aria-hidden="true">
        {lijnen.map((l, i) => (l.punt
          ? <circle key={i} cx={l.r[0][0]} cy={-l.r[0][1]} r={sw * 2.5} fill={l.k} />
          : <path key={i} d={l.r.map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${-y}`).join('') + (l.dicht ? 'Z' : '')} fill={l.dicht ? `${l.k}22` : 'none'} stroke={l.k} strokeWidth={sw} />))}
      </svg>
    );
  }
  return null;
}

export function ElementIcoon({ el, maat = 26 }) {
  const v = Voorvertoning({ el, maat });
  if (v) return v;
  const kleur = el.stijl?.kleur || '#1d1d1b';
  if (el.tekenwijze === 'lijn') {
    const streep = el.stijl?.streep === 'streep' ? '5 3' : el.stijl?.streep === 'stip' ? '1 3' : undefined;
    return <svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke={kleur} strokeWidth="3" strokeDasharray={streep} /></svg>;
  }
  if (el.tekenwijze === 'punt') return <span style={{ width: 14, height: 14, borderRadius: '50%', background: kleur, border: '2px solid #fff', outline: '1px solid #DADDE3' }} />;
  const b = Number(el.breedte_m) || 1;
  const d = Number(el.diepte_m) || 1;
  const s = maat / Math.max(b, d);
  return <span style={{ width: Math.max(4, b * s), height: Math.max(4, d * s), border: `2px solid ${kleur}`, background: (el.stijl?.vulkleur || kleur) + '33' }} />;
}

export function elementMaat(el) {
  if (el.tekenwijze === 'lijn') return el.eenheid_m ? `Lijn · ${getal(Number(el.eenheid_m), 2)} m per stuk` : 'Lijn';
  if (el.tekenwijze === 'punt') {
    const e = el.eigenschappen || {};
    return ['Punt', e.kva ? `${e.kva} kVA` : '', e.ampere ? `${e.ampere}A` : ''].filter(Boolean).join(' · ');
  }
  const m = `${getal(Number(el.breedte_m), 2)} × ${getal(Number(el.diepte_m), 2)} m`;
  if (el.tekenwijze === 'sjabloon') return `Sjabloon · ${el.eigenschappen?.items?.length || 0} onderdelen · ${m}`;
  const a = (el.eigenschappen?.aansluitingen || []).map((x) => `${x.ampere || '?'} A`).join(' + ');
  const mod = el.eigenschappen?.module ? 'vlakvullend · ' : '';
  return `${el.eigenschappen?.tekening ? 'Tekening' : 'Op schaal'} · ${mod}${m}${a ? ` · ${a}` : ''}`;
}

const lees = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const schrijf = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Blijft bewaard als het paneel even dichtgaat (bv. na het plaatsen van een element):
// zoekterm, filters en scrollpositie, zodat je niet telkens bovenaan herbegint.
const onthoud = { zoek: '', fam: '', cat: '', lev: '', scroll: 0, dicht: new Set(), famKeuze: {}, varOpen: null, terugScroll: 0 };
// Opstellingen van één partner (bv. TV-compound): apart, onderaan.
export const isSet = (e) => !!e?.eigenschappen?.set;
const scrollerVan = (el) => { let e = el?.parentElement; while (e && e !== document.body) { const o = getComputedStyle(e).overflowY; if (o === 'auto' || o === 'scroll') return e; e = e.parentElement; } return null; };

export default function BibliotheekPaneel({ elementen, gekozen, onKies, schrijven, startCat = null, gebruikt = null, alleen = null, uitleg = null, std = null }) {
  const [anderOpen, setAnderOpen] = useState(() => new Set());
  // Open variantenoverzicht (blijft bewaard als het paneel even dichtgaat); terug = dezelfde plek in de lijst.
  const [varOpen, setVarOpenS] = useState(onthoud.varOpen); // ingeklapte leveranciers naast de standaard, opengeklikt
  const [zoek, setZoekS] = useState(onthoud.zoek);
  // Familie (tab) en daarbinnen eventueel één categorie. '' = start (in dit plan, favorieten, recent).
  const [fam, setFamS] = useState(onthoud.fam);
  const [cat, setCatS] = useState(onthoud.cat);
  const [lev, setLevS] = useState(onthoud.lev);
  const wortel = useRef(null);
  const zoekRef = useRef(null);
  // Meteen kunnen typen als het paneel opent (niet op een aanraakscherm: dan springt het toetsenbord open).
  useEffect(() => { if (alleen || onthoud.varOpen) return; try { if (window.matchMedia('(pointer: fine)').matches) zoekRef.current?.focus({ preventScroll: true }); } catch {} }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Even stilstaan op een element: een kaartje met grote foto, tekening en uitleg.
  const [info, setInfo] = useState(null);
  const infoTimer = useRef(null);
  const toonInfo = (el, e, wacht = 550) => {
    clearTimeout(infoTimer.current);
    // Naast de hele rij (ook als je over een variantknopje zweeft), niet over het paneel.
    const r = (e.currentTarget.closest?.('.fm-element') || e.currentTarget).getBoundingClientRect();
    infoTimer.current = setTimeout(() => setInfo({ el, x: r.right + 10, y: r.top }), wacht);
  };
  const verbergInfo = () => { clearTimeout(infoTimer.current); setInfo(null); };
  useEffect(() => () => clearTimeout(infoTimer.current), []);
  // Ander filter of andere zoekterm: de lijst begint weer bovenaan.
  const naarBoven = () => { onthoud.scroll = 0; const sc = scrollerVan(wortel.current); if (sc) sc.scrollTop = 0; };
  const setZoek = (v) => { onthoud.zoek = v; setZoekS(v); naarBoven(); };
  const setCat = (v) => { onthoud.cat = v; setCatS(v); naarBoven(); };
  const setFam = (v) => { onthoud.fam = v; setFamS(v); onthoud.cat = ''; setCatS(''); naarBoven(); };
  const setLev = (v) => { onthoud.lev = v; setLevS(v); naarBoven(); };
  const ctx = alleen ? `a:${alleen.map((x) => x.id).sort().join(',').slice(0, 200)}` : 'bib';
  const setVarOpen = (v) => { onthoud.varOpen = v; setVarOpenS(v); };
  const openVarianten = (f, vars) => {
    const sc = scrollerVan(wortel.current); onthoud.terugScroll = sc ? sc.scrollTop : 0;
    setVarOpen({ f, ids: vars.map((x) => x.id), ctx });
    requestAnimationFrame(() => { const s2 = scrollerVan(wortel.current); if (s2) s2.scrollTop = 0; });
  };
  const terug = () => {
    setVarOpen(null); verbergInfo();
    const doel = onthoud.terugScroll || 0;
    requestAnimationFrame(() => { const s2 = scrollerVan(wortel.current); if (s2) s2.scrollTop = doel; onthoud.scroll = doel; });
  };
  // Rubriek = categorie (zoals bij de leveranciers), zodat één rubriek ook één soort leverancier is.
  const famVan = useMemo(() => { const m = new Map(); for (const e of elementen) m.set(e.id, rubriekVan(e.categorie)); return m; }, [elementen]);
  // In een binnenplan of een werkruimte: meteen de juiste familie en categorie.
  useEffect(() => {
    const e = startCat && elementen.find((x) => x.categorie === startCat);
    if (!e) return;
    const f = famVan.get(e.id); const c = f === startCat ? startCat : ''; onthoud.fam = f; setFamS(f); onthoud.cat = c; setCatS(c);
  }, [startCat]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const sc = scrollerVan(wortel.current);
    if (!sc) return undefined;
    const doel = onthoud.scroll;
    sc.scrollTop = doel;
    // Favorieten en recent laden net na het tonen: daarna nog eens op de oude plek zetten.
    const r1 = requestAnimationFrame(() => { sc.scrollTop = doel; });
    let klaar = false; setTimeout(() => { klaar = true; }, 120);
    const bij = () => { if (klaar) onthoud.scroll = sc.scrollTop; };
    sc.addEventListener('scroll', bij, { passive: true });
    return () => { cancelAnimationFrame(r1); sc.removeEventListener('scroll', bij); };
  }, []);
  const [fav, setFav] = useState([]);
  const [recent, setRecent] = useState([]);
  useEffect(() => { setFav(lees('fm-favorieten')); setRecent(lees('fm-recent')); }, []);
  const metLev = (e) => !lev || e.leverancier === lev;
  const telling = (veld, rijen) => { const m = new Map(); for (const e of rijen) { const k = e[veld] || ''; m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => (veld === 'categorie' ? vergelijkCategorie(a[0], b[0]) : a[0].localeCompare(b[0], 'nl'))); };
  // Tellers per familie (met het leveranciersfilter).
  const perFam = useMemo(() => { const m = new Map(); for (const e of elementen) if (metLev(e)) { const f = famVan.get(e.id); m.set(f, (m.get(f) || 0) + 1); } return m; }, [elementen, famVan, lev]); // eslint-disable-line react-hooks/exhaustive-deps
  const inFam = useMemo(() => elementen.filter((e) => famVan.get(e.id) === fam), [elementen, famVan, fam]);
  const levs = useMemo(() => telling('leverancier', fam ? inFam : elementen).filter(([k]) => k), [elementen, inFam, fam]); // eslint-disable-line react-hooks/exhaustive-deps
  const DIT_EVENT = '__event'; const SUB = '__sub:';
  const cats = useMemo(() => telling('categorie', inFam.filter((e) => !e.plan_id && metLev(e))).filter(([k]) => k), [inFam, lev]); // eslint-disable-line react-hooks/exhaustive-deps
  const nEvent = inFam.filter((e) => e.plan_id && metLev(e)).length;
  const z = zoek.trim();
  const byId = new Map(elementen.map((e) => [e.id, e]));
  const favLijst = fav.map((id) => byId.get(id)).filter(Boolean);
  const recentLijst = recent.map((id) => byId.get(id)).filter((e) => e && !fav.includes(e.id)).slice(0, 6);
  const inPlan = (gebruikt || []).map(([id, n]) => [byId.get(id), n]).filter(([e]) => e && e.tekenwijze !== 'doek').slice(0, 6);
  const kies = (el) => {
    // Enkel bewaren; de zichtbare lijst blijft staan, anders verspringt alles eronder.
    const r = [el.id, ...lees('fm-recent').filter((x) => x !== el.id)].slice(0, 12);
    schrijf('fm-recent', r);
    if (el.eigenschappen?.familie) onthoud.famKeuze[el.eigenschappen.familie] = el.id;
    onKies(el);
  };
  const wisselFav = (id) => {
    const f = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id];
    setFav(f); schrijf('fm-favorieten', f);
  };
  const [, herteken] = useState(0);
  const wisselDicht = (k) => { if (onthoud.dicht.has(k)) onthoud.dicht.delete(k); else onthoud.dicht.add(k); herteken((x) => x + 1); };
  const ster = (el) => (
    <button className={`fm-ster${fav.includes(el.id) ? ' aan' : ''}`} title={fav.includes(el.id) ? 'Uit favorieten' : 'Bij favorieten'} aria-label="Favoriet"
      onClick={(e) => { e.stopPropagation(); wisselFav(el.id); }}>{fav.includes(el.id) ? '★' : '☆'}</button>
  );
  const icoon = (el) => <span className="ic">{el.eigenschappen?.fotos?.[0] ? <img src={publiekeUrl(el.eigenschappen.fotos[0])} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover' }} /> : el.eigenschappen?.stelling3d ? <StellingDuim st={el.eigenschappen.stelling3d} /> : isTentBouw(el) ? <TentDuim el={el} terugval={<ElementIcoon el={el} maat={30} />} /> : <ElementIcoon el={el} maat={30} />}</span>;
  const rij = (el, key, extra = null, titel = null) => { const mag = elementMag(el); const kan = schrijven && mag; return (
    <div key={key} className={`fm-element${gekozen?.id === el.id ? ' aan' : ''}${mag ? '' : ' fm-uitpakket'}`} role="button" tabIndex={0} aria-disabled={!kan}
      title={mag ? undefined : nietInPakket(elementModule(el))}
      onClick={() => { verbergInfo(); if (kan) kies(el); }} onKeyDown={(e) => { if (kan && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); kies(el); } }}
      onMouseEnter={(e) => toonInfo(el, e)} onMouseLeave={verbergInfo}>
      {icoon(el)}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{titel || el.naam}</span>
        <span className="fm-sub">{elementMaat(el)}</span>
        {(el.leverancier || extra) && <span className="fm-sub">{[el.leverancier, extra].filter(Boolean).join(' · ')}</span>}
        {!mag && <span className="fm-sub">niet in pakket</span>}
      </span>
      {ster(el)}
    </div>
  ); };
  // Familie met varianten: één rij (naam + gekozen variant); klik opent het overzicht van alle varianten in dit paneel.
  const kortModel = (m, f) => { const k = String(f || '').slice(0, 3).toLowerCase(); const [w, ...r] = String(m).split(' '); return k && r.length && w.toLowerCase().startsWith(k) ? r.join(' ') : m; };
  const familieRij = (vf, leden, key) => {
    const vars = [...leden].sort((a, b) => vergelijkVariant(a.eigenschappen.variant, b.eigenschappen.variant));
    const actief = vars.find((x) => x.id === gekozen?.id) || byId.get(onthoud.famKeuze[vf]) || vars[0];
    const toon = vars.includes(actief) ? actief : vars[0];
    const label = toon.eigenschappen?.model ? [kortModel(toon.eigenschappen.model, vf), toon.eigenschappen.uitvoering].filter(Boolean).join(' · ') : toon.eigenschappen?.variant;
    const levsF = new Set(vars.map((x) => x.leverancier).filter(Boolean));
    const doe = () => { verbergInfo(); openVarianten(vf, vars); };
    return (
      <div key={key} className={`fm-element fm-famrij${vars.some((x) => x.id === gekozen?.id) ? ' aan' : ''}`} role="button" tabIndex={0} aria-label={`${vf}: ${vars.length} varianten`}
        onClick={doe} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doe(); } }}
        onMouseEnter={(e) => toonInfo(toon, e)} onMouseLeave={verbergInfo}>
        {icoon(toon)}
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{vf} <span className="fm-sub" style={{ fontWeight: 400 }}>{label}</span></span>
          <span className="fm-sub">{vars.length} varianten{levsF.size > 1 ? ` · ${levsF.size} leveranciers` : levsF.size ? ` · ${[...levsF][0]}` : ''}</span>
        </span>
        <span className="fm-famrij-pijl" aria-hidden="true">›</span>
      </div>
    );
  };
  // Varianten samennemen (vanaf 2 in de huidige lijst), volgorde van de eerste.
  const rijenVan = (els, sleutel) => {
    const per = new Map();
    for (const e of els) { const f = e.eigenschappen?.familie; if (f) per.set(f, [...(per.get(f) || []), e]); }
    const gezien = new Set(); const uit = [];
    for (const e of els) {
      const f = e.eigenschappen?.familie;
      if (f && per.get(f).length > 1) { if (!gezien.has(f)) { gezien.add(f); uit.push(familieRij(f, per.get(f), `${sleutel}f${f}`)); } continue; }
      uit.push(rij(e, `${sleutel}${e.id}`));
    }
    return uit;
  };
  const opNaam = (a, b) => String(a.naam).localeCompare(String(b.naam), 'nl', { numeric: true });
  // Een groep met een kop die je kan inklappen.
  const groep = (k, titel, leden, inhoud) => {
    const dicht = onthoud.dicht.has(k);
    return (
      <div key={k}>
        <button className="fm-lijstkop fm-subgroep" aria-expanded={!dicht} onClick={() => wisselDicht(k)}>
          <span aria-hidden="true">{dicht ? '▸' : '▾'}</span> {titel} <span className="fm-sub">· {leden.length}</span>
        </button>
        {!dicht && inhoud}
      </div>
    );
  };
  // Binnen een categorie: subgroepen (eigenschap subgroep), in te klappen.
  const metSubgroepen = (els, sleutel) => {
    const groepen = new Map();
    for (const e of els) { const g = e.eigenschappen?.subgroep || ''; groepen.set(g, [...(groepen.get(g) || []), e]); }
    if (groepen.size < 2) return rijenVan(els, sleutel);
    return [...groepen].sort((a, b) => (!a[0]) - (!b[0]) || a[0].localeCompare(b[0], 'nl')).map(([g, leden]) => groep(`${sleutel}|${g}`, g || 'Overig', leden, rijenVan(leden, `${sleutel}${g}|`)));
  };

  // Standaardleverancier van het plan (per categorie): die elementen eerst, met de elementen zonder vaste leverancier;
  // andere leveranciers ingeklapt eronder (klik = open).
  const metStd = (els, sleutel) => {
    const per = new Map(); for (const e of els) { const s0 = std?.[e.categorie]; if (!s0 || !e.leverancier || e.leverancier === s0) continue; if (!per.has(e.leverancier)) per.set(e.leverancier, []); per.get(e.leverancier).push(e); }
    if (!per.size) return metSubgroepen(els, sleutel);
    const eigen = els.filter((e) => !std?.[e.categorie] || !e.leverancier || e.leverancier === std[e.categorie]);
    const sNaam = [...new Set(els.map((e) => std?.[e.categorie]).filter(Boolean))].join(', ');
    return [
      <div key={`${sleutel}|std`} className="fm-lijstkop fm-bib-std">{sNaam} <span className="fm-tag groen">standaard voor dit plan</span></div>,
      ...metSubgroepen(eigen, sleutel),
      ...[...per].sort((a, b) => a[0].localeCompare(b[0], 'nl')).map(([l, xs]) => {
        const k = `${sleutel}|ander|${l}`; const o = anderOpen.has(k);
        return (
          <div key={k}>
            <button className="fm-lijstkop fm-subgroep fm-bib-ander" aria-expanded={o} onClick={() => setAnderOpen((x) => { const n = new Set(x); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>
              <span aria-hidden="true">{o ? '▾' : '▸'}</span> {l} <span className="fm-sub">· {xs.length} · andere leverancier</span>
            </button>
            {o && rijenVan(xs.sort(opNaam), `${k}|`)}
          </div>
        );
      }),
    ];
  };

  // Wat er getoond wordt.
  let inhoud = null; let leeg = false; let hits = [];
  if (z) {
    // Zoeken gaat over alles: resultaten per familie, opstellingen van één partner onderaan.
    hits = elementen.filter(metLev).map((e) => [e, zoekScore(e, z)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1] || opNaam(a[0], b[0])).map(([e]) => e);
    leeg = !hits.length;
    const gewoon = hits.filter((e) => !isSet(e)); const sets = hits.filter(isSet);
    const perF = rubriekSecties([...new Set(gewoon.map((e) => famVan.get(e.id)))]).flatMap(([, rs]) => rs).map((r) => [{ k: r, naam: rubriekNaam(r) }, gewoon.filter((e) => famVan.get(e.id) === r)]);
    inhoud = (
      <>
        {perF.map(([f, l]) => <div key={f.k}><div className="fm-lijstkop">{f.naam} · {l.length}</div>{rijenVan(l, `z${f.k}`)}</div>)}
        {sets.length > 0 && <><div className="fm-lijstkop">In opstellingen</div>{rijenVan(sets, 's')}</>}
      </>
    );
  } else if (!fam) {
    leeg = !inPlan.length && !favLijst.length && !recentLijst.length;
    inhoud = (
      <>
        {inPlan.length > 0 && <><div className="fm-lijstkop">In dit plan</div>{inPlan.map(([el, n]) => rij(el, `p${el.id}`, `${n}× geplaatst`))}</>}
        {favLijst.length > 0 && <><div className="fm-lijstkop">Favorieten</div>{favLijst.map((el) => rij(el, `f${el.id}`))}</>}
        {recentLijst.length > 0 && <><div className="fm-lijstkop">Recent gebruikt</div>{recentLijst.map((el) => rij(el, `r${el.id}`))}</>}
      </>
    );
  } else {
    const lijst = inFam.filter(metLev).sort(opNaam);
    const vast = lijst.filter((e) => !e.plan_id);
    const event = lijst.filter((e) => e.plan_id);
    if (cat === DIT_EVENT) { leeg = !event.length; inhoud = rijenVan(event, 'e'); }
    else if (String(cat || '').startsWith(SUB)) { const g = cat.slice(SUB.length); const l = vast.filter((e) => (e.eigenschappen?.subgroep || '') === g); leeg = !l.length; inhoud = rijenVan(l, `g${g}`); }
    else if (cat) { const l = vast.filter((e) => e.categorie === cat); leeg = !l.length; inhoud = metStd(l.filter((e) => !isSet(e)), cat).concat(l.some(isSet) ? [<div key="sk" className="fm-lijstkop">Opstellingen</div>, ...rijenVan(l.filter(isSet), 's')] : []); }
    else {
      leeg = !lijst.length;
      const gewoon = vast.filter((e) => !isSet(e)); const sets = vast.filter(isSet);
      const cs = telling('categorie', gewoon).map(([c]) => c);
      inhoud = (
        <>
          {cs.length > 1 ? cs.map((c) => { const l = gewoon.filter((e) => (e.categorie || '') === c); return groep(`${fam}#${c}`, c || 'Overig', l, metStd(l, `${fam}#${c}`)); }) : metStd(gewoon, fam)}
          {sets.length > 0 && groep(`${fam}#sets`, 'Opstellingen van een partner', sets, rijenVan(sets, 's'))}
          {event.length > 0 && groep(`${fam}#event`, 'Dit event', event, rijenVan(event, 'e'))}
        </>
      );
    }
  }

  // Overzicht van de varianten van één familie (per leverancier, en per model als die er zijn).
  const varianten = varOpen && varOpen.ctx === ctx ? varOpen.ids.map((id) => byId.get(id)).filter(Boolean) : [];
  if (varOpen && varianten.length) {
    const f = varOpen.f; const sStd = std?.[varianten[0].categorie];
    const levsV = [...new Set(varianten.map((x) => x.leverancier || ''))].sort((a, b) => (a === sStd ? -1 : b === sStd ? 1 : (!a) - (!b) || a.localeCompare(b, 'nl')));
    const nl = (a, b) => String(a).localeCompare(String(b), 'nl', { numeric: true });
    const blok = (l) => {
      const xs = varianten.filter((x) => (x.leverancier || '') === l);
      const metModel = xs.some((x) => x.eigenschappen?.model);
      if (!metModel) return [...xs].sort((a, b) => vergelijkVariant(a.eigenschappen?.variant, b.eigenschappen?.variant)).map((v) => rij(v, `v${v.id}`));
      const per = new Map(); for (const v of xs) { const m = v.eigenschappen?.model || v.naam; if (!per.has(m)) per.set(m, []); per.get(m).push(v); }
      return [...per].sort((a, b) => (a[1].length > 1) - (b[1].length > 1) || nl(a[0], b[0])).map(([m, vs]) => (vs.length === 1
        ? rij(vs[0], `v${vs[0].id}`, null, [kortModel(m, f), vs[0].eigenschappen?.uitvoering].filter(Boolean).join(' · '))
        : groep(`var|${f}|${l}|${m}`, kortModel(m, f), vs, [...vs].sort((a, b) => nl(a.eigenschappen?.uitvoering || a.naam, b.eigenschappen?.uitvoering || b.naam)).map((v) => rij(v, `v${v.id}`, null, v.eigenschappen?.uitvoering || null)))));
    };
    return (
      <div ref={wortel}>
        <div className="fm-sectie fm-varkop">
          <button type="button" className="fm-varterug" onClick={terug}>‹ Bibliotheek</button>
          <div className="kop">{f} <span className="fm-sub">· {varianten.length} varianten</span></div>
        </div>
        {levsV.map((l) => (
          <div key={l || '_'}>
            {levsV.length > 1 && <div className={`fm-lijstkop${l && l === sStd ? ' fm-bib-std' : ''}`}>{l || 'Algemeen (leverancier vrij)'}{l && l === sStd && <> <span className="fm-tag groen">standaard voor dit plan</span></>}</div>}
            {blok(l)}
          </div>
        ))}
        {info && <ElementInfo el={info.el} x={info.x} y={info.y} />}
      </div>
    );
  }

  // Vaste keuze van een werkplek-gereedschap (bv. TV › Camera): dezelfde rijen, varianten en info, zonder zoeken of tabs.
  if (alleen) {
    const l = [...alleen].sort(opNaam);
    return (
      <div ref={wortel}>
        {uitleg && <div className="fm-sub" style={{ padding: '8px 12px' }}>{uitleg}</div>}
        {l.length ? metStd(l, 'a') : <div className="fm-sub" style={{ padding: 12 }}>Geen passende elementen in de bibliotheek.</div>}
        {info && <ElementInfo el={info.el} x={info.x} y={info.y} />}
      </div>
    );
  }
  const opToets = (e) => {
    if (e.key === 'Escape' && zoek) { e.preventDefault(); e.stopPropagation(); setZoek(''); return; }
    if (e.key === 'Enter' && z) { const eerste = hits.find((x) => elementMag(x)); if (eerste && schrijven) { e.preventDefault(); kies(eerste); } }
  };
  const subs = cats.length === 1 ? (() => { const m = new Map(); for (const e of inFam) if (!e.plan_id && metLev(e)) { const g = e.eigenschappen?.subgroep; if (g) m.set(g, (m.get(g) || 0) + 1); } return [...m].sort((a, b) => a[0].localeCompare(b[0], 'nl')); })() : [];
  const catKeuze = [['', `Alles`, inFam.filter((e) => !e.plan_id && metLev(e)).length], ...(cats.length === 1 ? (subs.length > 1 ? subs.map(([g, n]) => [`${SUB}${g}`, g, n]) : []) : cats.map(([c, n]) => [c, c, n])), ...(nEvent ? [[DIT_EVENT, 'Dit event', nEvent]] : [])];
  return (
    <div ref={wortel} className="fm-bib">
      <div className="fm-bib-kop">
        <div className="fm-bib-zoekveld">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <input ref={zoekRef} type="search" aria-label="Zoek in de bibliotheek" placeholder="Zoek: heras, nadar, generator, wc…" value={zoek} onChange={(e) => setZoek(e.target.value)} onKeyDown={opToets} />
          {zoek && <button type="button" className="wis" aria-label="Zoekterm wissen" onClick={() => { setZoek(''); zoekRef.current?.focus(); }}>×</button>}
        </div>
        {z ? (
          <div className="fm-bib-pad"><span>{hits.length === 1 ? '1 resultaat' : `${hits.length} resultaten`}{lev ? ` van ${lev}` : ''}</span>{hits.length > 0 && schrijven && <span className="fm-sub">Enter plaatst het eerste</span>}</div>
        ) : fam ? (
          <div className="fm-bib-pad">
            <button type="button" className="fm-bib-terug" onClick={() => setFam('')}>‹ Alles</button>
            <b>{rubriekNaam(fam)}</b><span className="fm-sub">{perFam.get(fam) || 0}</span>
          </div>
        ) : null}
        {!z && fam && catKeuze.length > 2 && (
          <div className="fm-bib-chips" role="tablist" aria-label="Categorie">
            {catKeuze.map(([k, n, t]) => <button key={k || '_'} type="button" role="tab" aria-selected={cat === k} className={cat === k ? 'aan' : ''} onClick={() => setCat(k)}>{n}<small>{t}</small></button>)}
          </div>
        )}
        {/* Leverancier: enkel als er binnen deze keuze echt iets te kiezen valt. */}
        {(fam || z) && (levs.length > 1 || lev) && (
          <label className="fm-veld fm-levfilter">Leverancier
            <select value={lev} onChange={(e) => setLev(e.target.value)}>
              <option value="">Alle leveranciers</option>
              {levs.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
            </select>
          </label>
        )}
      </div>
      {!z && !fam && (
        <div className="fm-bib-fams" role="list" aria-label="Rubrieken">
          {rubriekSecties([...perFam.keys()].filter((r) => perFam.get(r))).map(([sec, rs]) => [
            <div key={`s${sec}`} className="fm-bib-sectie" role="presentation">{sec}</div>,
            ...rs.map((r) => (
              <button key={r} type="button" role="listitem" onClick={() => setFam(r)}>
                <b>{rubriekNaam(r)}</b><small>{perFam.get(r)}</small>
              </button>
            )),
          ])}
        </div>
      )}
      {inhoud}
      {leeg && <div className="fm-sub" style={{ padding: 12 }}>{z ? 'Geen elementen gevonden.' : fam ? `Geen elementen in ${rubriekNaam(fam)}${lev ? ` van ${lev}` : ''}.` : 'Nog niets gebruikt in dit plan. Kies een rubriek hierboven of zoek.'}</div>}
      <div style={{ padding: 12 }}><a className="fm-knop vol" href="/maps/bibliotheek">Bibliotheek beheren</a></div>
      {info && <ElementInfo el={info.el} x={info.x} y={info.y} />}
    </div>
  );
}

// Kaartje naast de bibliotheek: grote foto en/of tekening, maten en omschrijving.
function ElementInfo({ el, x, y }) {
  const e = el.eigenschappen || {};
  const foto = e.fotos?.[0];
  const heeftTek = !!e.tekening;
  const H = 460;
  const top = Math.max(8, Math.min(y - 20, (typeof window !== 'undefined' ? window.innerHeight : 900) - H - 16));
  const hoogte = Number(el.hoogte_m) > 0 ? ` · h ${getal(Number(el.hoogte_m), 2)} m` : '';
  return (
    <div className="fm-bibinfo" style={{ left: x, top }} role="tooltip">
      {foto && <img src={publiekeUrl(foto)} alt="" className="foto" />}
      {e.stelling3d ? <div className="fm-bibinfo-3d"><StellingDrie st={e.stelling3d} mini /></div> : (heeftTek || !foto) && <div className="tek"><ElementIcoon el={el} maat={heeftTek ? 200 : 90} /></div>}
      <div className="kop">{el.naam}</div>
      <div className="fm-sub">{[el.categorie, el.leverancier].filter(Boolean).join(' · ')}</div>
      <div className="fm-sub">{elementMaat(el)}{hoogte}</div>
      {e.omschrijving && <p>{e.omschrijving}</p>}
      {(e.fotos?.length || 0) > 1 && <div className="fotos">{e.fotos.slice(1, 5).map((f) => <img key={f} src={publiekeUrl(f)} alt="" />)}</div>}
    </div>
  );
}
