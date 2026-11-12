'use client';

import { heeftKoppeling, heeftModule } from './merk';
import { Beachvlag } from './BrandingPaneel';
import { voorbeeldVan } from './branding';
import Info from './info';
import { metTekeningen } from './tekeningen';
import { useEffect, useMemo, useRef, useState } from 'react';
import './maps.css';
import { maps, alles, sb, BUCKET, publiekeUrl, foutTekst, wieBenIk, magSchrijven, magBibliotheek, isCentraalElement } from './db';
import { ElementIcoon, elementMaat } from './BibliotheekPaneel';
import { KLEUREN, TOEBEHOREN, TB_SOORTEN } from './stijl';
import { leesSvg, dxfTekening } from './tekening';
import { leesDxf } from './dxf';
import { AANSLUITINGEN, FASEN_EL } from './stroom';
import { AppDialogen, bevestig, vraagTekst } from './dialoog';
import { Icoon } from './iconen';
import GevelBeheer from './GevelBeheer';
import { isUnitEl } from './containerbouw';
import { sorteerCategorieen, vergelijkCategorie, CATEGORIEEN, rubriekVan, rubriekSecties, rubriekNaam } from './categorieen';
import { useLeveranciers, juisteNaam, zorgLeverancier } from './leveranciers';
import { zoekScore } from './zoeken';
import { FAMILIES, FAMILIE_NAAM, familieVanElement, familieUitCategorie } from './familie';

const LEEG = { naam: '', categorie: 'Overig', tekenwijze: 'schaal', breedte_m: 3, diepte_m: 3, eenheid_m: null, hoogte_m: null, stijl: { kleur: '#2563EB', vuldekking: 0.15 }, standaardlaag: '', leverancier: '', eigenschappen: {}, actief: true };
const getal = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Excel of CSV plakken: kolommen met kop. Scheiding ; of tab of ,
export function leesTabel(tekst) {
  const regels = tekst.split(/\r?\n/).filter((r) => r.trim());
  if (regels.length < 2) return [];
  const scheiding = regels[0].includes('\t') ? '\t' : regels[0].includes(';') ? ';' : ',';
  const kop = regels[0].split(scheiding).map((k) => k.trim().toLowerCase());
  const k = (namen) => kop.findIndex((x) => namen.some((n) => x.startsWith(n)));
  const idx = { naam: k(['naam', 'name']), cat: k(['categ']), tw: k(['tekenw', 'soort', 'type']), b: k(['breed', 'b ']), d: k(['diep', 'lengte', 'l ']), e: k(['eenheid', 'per stuk']), lev: k(['lever']), kva: k(['kva']), amp: k(['amp']) };
  return regels.slice(1).map((r) => {
    const c = r.split(scheiding).map((x) => x.trim());
    const tw = (c[idx.tw] || '').toLowerCase();
    const e = getal(c[idx.e]);
    const b = getal(c[idx.b]);
    const tekenwijze = tw.startsWith('l') || (e && !b) ? 'lijn' : tw.startsWith('p') || (!b && !e) ? 'punt' : 'schaal';
    const eig = {};
    if (getal(c[idx.kva])) eig.kva = getal(c[idx.kva]);
    if (getal(c[idx.amp])) eig.ampere = getal(c[idx.amp]);
    return {
      naam: c[idx.naam] || '', categorie: c[idx.cat] || 'Overig', tekenwijze,
      breedte_m: tekenwijze === 'schaal' ? b : null, diepte_m: tekenwijze === 'schaal' ? getal(c[idx.d]) : null,
      eenheid_m: tekenwijze === 'lijn' ? e : null, leverancier: c[idx.lev] || null, eigenschappen: eig,
    };
  }).filter((r) => r.naam);
}

export default function BibliotheekBeheer({ soort = 'elementen' }) {
  // Twee aparte pagina's: Bibliotheek (elementen) en Branding (doeken, panelen, vlaggen).
  const [lijst, setLijst] = useState([]);
  const [doeken, setDoeken] = useState([]);
  const weergave = soort === 'branding' ? 'doeken' : 'elementen';
  const [profiel, setProfiel] = useState(null);
  const [gekozen, setGekozen] = useState(null);
  const [bibTab, setBibTab] = useState('algemeen');
  const [vorm, setVorm] = useState(LEEG);
  const [opgeslagen, setOpgeslagen] = useState('');
  const bibGewijzigd = !opgeslagen || JSON.stringify(vorm) !== opgeslagen;
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [importTekst, setImportTekst] = useState('');
  const [toonImport, setToonImport] = useState(false);
  const [cat, setCat] = useState('');
  const [tekBestand, setTekBestand] = useState(null); // { naam, soort, tekst, dxf }
  const [tekBreedte, setTekBreedte] = useState('');
  const [artikels, setArtikels] = useState([]);
  useEffect(() => {
    // Stock-artikels (alleen lezen) om een element aan te koppelen.
    if (!heeftKoppeling('stock')) return;
    sb().schema('logistiek').from('artikels').select('id, code, naam, aantal_totaal').order('naam').limit(2000)
      .then(({ data }) => setArtikels(data || []));
  }, []);

  useEffect(() => {
    (async () => {
      const [wie, r] = await Promise.all([wieBenIk(), alles(() => maps().from('bibliotheek').select('*').is('plan_id', null).order('categorie').order('naam'))]);
      setProfiel(wie);
      if (!r.error) r.data = metTekeningen(r.data);
      if (r.error) setFout(foutTekst(r.error)); else { setLijst((r.data || []).filter((x) => x.tekenwijze !== 'stijl' && x.tekenwijze !== 'doek')); setDoeken((r.data || []).filter((x) => x.tekenwijze === 'doek')); }
    })();
  }, []);

  // Waar je was na vernieuwen: overzicht, categorie, gekozen element en tabblad staan in de adresbalk.
  const urlStand = useRef(null);
  if (urlStand.current === null && typeof window !== 'undefined') { const q = new URLSearchParams(window.location.search); urlStand.current = { w: q.get('w'), cat: q.get('cat'), el: q.get('el'), tab: q.get('tab') }; }
  useEffect(() => { const u = urlStand.current; if (u?.cat) setCat(u.cat); }, []);
  useEffect(() => {
    const u = urlStand.current; if (!u?.el || !lijst.length) return;
    const el = lijst.find((x) => x.id === u.el); urlStand.current = { ...u, el: null };
    if (el || u.el === 'nieuw') { kies(el || null).then(() => { if (u.tab) setBibTab(u.tab); }); }
  }, [lijst.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      const u = new URL(window.location.href); const zet = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
      zet('cat', weergave === 'doeken' ? null : cat || null); zet('el', weergave === 'doeken' ? null : gekozen || null); zet('tab', gekozen && bibTab !== 'algemeen' ? bibTab : null);
      if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
    } catch {}
  }, [weergave, cat, gekozen, bibTab]);

  // Een element uit de centrale bibliotheek van Toolen kan een klant bekijken en kopiëren, niet wijzigen.
  const magBib = magBibliotheek(profiel);
  const centraalEl = isCentraalElement(profiel, vorm);
  const schrijven = magBib && !centraalEl;
  const alleenLezen = magSchrijven(profiel) && !magBib;
  const cats = useMemo(() => sorteerCategorieen(new Set([...CATEGORIEEN, ...lijst.map((e) => e.categorie)])), [lijst]);
  const levLijst = useLeveranciers();
  const kies = async (el) => {
    if (gekozen && gekozen !== (el?.id || 'nieuw') && bibGewijzigd && !(await bevestig(`De wijzigingen aan "${vorm.naam || 'dit element'}" zijn nog niet bewaard. Toch verdergaan?`, { ok: 'Verdergaan zonder bewaren', gevaar: true }))) return;
    const n = el ? { ...LEEG, ...el, stijl: { ...(el.stijl || {}) } } : { ...LEEG };
    setBibTab('algemeen'); setGekozen(el?.id || 'nieuw'); setVorm(n); setOpgeslagen(el?.id ? JSON.stringify(n) : ''); setMelding(''); setFout('');
  };

  const verwijder = async () => {
    if (!gekozen || gekozen === 'nieuw') return;
    // Over alle organisaties heen: een centraal element staat ook in plannen van klanten.
    const { data: gebruik } = await maps().rpc('element_gebruik', { p_id: gekozen });
    const n = Number(gebruik) || 0;
    const tekst = n
      ? `"${vorm.naam}" staat ${n === 1 ? '1 keer' : `${n} keer`} in plannen. Die blijven op de kaart staan als gewone vorm, maar verliezen de koppeling met dit element (tellingen, stroom, stock). Definitief verwijderen?`
      : `"${vorm.naam}" definitief verwijderen uit de bibliotheek?`;
    if (!(await bevestig(tekst, { titel: 'Element verwijderen', ok: 'Verwijderen', gevaar: true }))) return;
    const r = await bibSchrijf().delete().eq('id', gekozen);
    if (r.error) { setFout(foutTekst(r.error)); return; }
    setLijst((l) => l.filter((x) => x.id !== gekozen));
    setGekozen(null); setFout('');
    setMelding(`"${vorm.naam}" is verwijderd.`);
  };

  const bewaar = async () => {
    if (!vorm.naam.trim()) { setFout('Geef het element een naam.'); return; }
    const { id, created_at, updated_at, ...rij } = vorm;
    rij.naam = rij.naam.trim();
    for (const k of ['breedte_m', 'diepte_m', 'eenheid_m', 'hoogte_m']) rij[k] = getal(rij[k]);
    if ((rij.tekenwijze === 'schaal' || rij.tekenwijze === 'sjabloon') && !(rij.breedte_m > 0 && rij.diepte_m > 0)) { setFout('Een element op schaal heeft een breedte en een diepte nodig.'); return; }
    if (rij.tekenwijze === 'lijn' && rij.eenheid_m != null && !(rij.eenheid_m > 0)) { setFout('De lengte per stuk moet groter zijn dan 0.'); return; }
    rij.standaardlaag = rij.standaardlaag || null;
    rij.varianten = (rij.varianten || []).filter((v) => v.naam?.trim()).map((v) => ({ naam: v.naam.trim(), breedte_m: getal(v.breedte_m), diepte_m: getal(v.diepte_m) }));
    rij.artikel_id = rij.artikel_id || null;
    rij.leverancier = juisteNaam(rij.leverancier, levLijst) || null;
    if (rij.leverancier) zorgLeverancier(rij.leverancier);
    const r = gekozen === 'nieuw'
      ? await bibSchrijf().insert(rij).select().single()
      : await bibSchrijf().update(rij).eq('id', gekozen).select().single();
    if (r.error) { setFout(foutTekst(r.error)); return; }
    setLijst((l) => (gekozen === 'nieuw' ? [...l, r.data] : l.map((x) => (x.id === r.data.id ? r.data : x))).sort((a, b) => vergelijkCategorie(a.categorie, b.categorie) || a.naam.localeCompare(b.naam, 'nl')));
    setGekozen(r.data.id);
    setOpgeslagen(JSON.stringify(vorm));
    setMelding('Bewaard. Geplaatste elementen in plannen gebruiken de nieuwe stijl meteen; nieuwe maten gelden voor nieuw geplaatste exemplaren.');
    setFout('');
  };

  const importRijen = useMemo(() => leesTabel(importTekst).map((r) => ({ ...r, bestaat: lijst.find((x) => x.naam.toLowerCase() === r.naam.toLowerCase()) })), [importTekst, lijst]);
  const importeer = async () => {
    setFout('');
    let n = 0;
    for (const r of importRijen) {
      const { bestaat, ...rij } = r;
      const q = bestaat ? bibSchrijf().update(rij).eq('id', bestaat.id).select().single() : bibSchrijf().insert(rij).select().single();
      const { data, error } = await q;
      if (error) { setFout(`${r.naam}: ${foutTekst(error)}`); break; }
      n += 1;
      setLijst((l) => (bestaat ? l.map((x) => (x.id === data.id ? data : x)) : [...l, data]));
    }
    setMelding(`${n} elementen verwerkt.`);
    setImportTekst('');
    setToonImport(false);
  };

  // Gedetailleerde tekening (SVG uit Illustrator, DXF uit AutoCAD) als element op schaal.
  const kiesTekening = async (f) => {
    if (!f) return;
    setFout('');
    const tekst = await f.text();
    const soort = /\.dxf$/i.test(f.name) ? 'dxf' : 'svg';
    let dxf = null;
    if (soort === 'dxf') { try { dxf = leesDxf(tekst); } catch (e) { setFout(e.message); return; } }
    setTekBestand({ naam: f.name, soort, tekst, dxf });
    if (soort === 'dxf') zetTekening({ naam: f.name, soort, tekst, dxf }, '');
    else if (getal(tekBreedte) > 0) zetTekening({ naam: f.name, soort, tekst }, tekBreedte);
    else setMelding(`${f.name} gekozen. Vul nu de echte breedte in meter in (bv. 6) en druk op Enter.`);
  };
  const zetTekening = (bestand = tekBestand, breedte = tekBreedte) => {
    if (!bestand) return;
    const b = getal(breedte);
    try {
      let t;
      if (bestand.soort === 'svg') {
        if (!(b > 0)) { setFout('Vul de echte breedte van de tekening in (meter).'); return; }
        t = leesSvg(bestand.tekst, b);
      } else t = dxfTekening(bestand.dxf, { breedteM: b > 0 ? b : null });
      setVorm((v) => ({
        ...v, tekenwijze: 'schaal', breedte_m: t.b, diepte_m: t.h, omtrek: null,
        naam: v.naam || bestand.naam.replace(/\.(svg|dxf)$/i, ''),
        stijl: { ...(v.stijl || {}), vuldekking: 0 },
        eigenschappen: { ...(v.eigenschappen || {}), tekening: t },
      }));
      setFout('');
      setMelding(`Tekening ingeladen: ${(t.vlakken.length + t.lijnen.length)} vormen, ${t.teksten.length} teksten, ${String(t.b).replace('.', ',')} × ${String(t.h).replace('.', ',')} m. Vergeet niet te bewaren.`);
    } catch (e) { setFout(e.message || String(e)); }
  };
  const tekening = vorm.eigenschappen?.tekening;

  // Foto's van het element (eerste = hoofdfoto in de bibliotheek).
  const [fotoBezig, setFotoBezig] = useState(false);
  const voegFotosToe = async (bestanden) => {
    if (!bestanden?.length) return;
    setFotoBezig(true); setFout('');
    try {
      const nieuw = [];
      for (const f of bestanden) {
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const pad = `bibliotheek/${gekozen === 'nieuw' ? 'nieuw' : gekozen}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await sb().storage.from(BUCKET).upload(pad, f, { contentType: f.type || 'image/jpeg' });
        if (error) throw error;
        nieuw.push(pad);
      }
      setVorm((v) => ({ ...v, eigenschappen: { ...(v.eigenschappen || {}), fotos: [...(v.eigenschappen?.fotos || []), ...nieuw] } }));
      setMelding(`${nieuw.length} foto${nieuw.length > 1 ? "'s" : ''} toegevoegd. Vergeet niet te bewaren.`);
    } catch (e) { setFout(foutTekst(e)); }
    finally { setFotoBezig(false); }
  };
  const fotos = vorm.eigenschappen?.fotos || [];
  const zetEig = (patch) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), ...patch } });

  const s = vorm.stijl || {};
  const zetStijl = (p) => setVorm({ ...vorm, stijl: { ...s, ...p } });
  const eig = vorm.eigenschappen || {};

  return (
    <div className="fm">
      <AppDialogen />
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '20px 32px', background: '#fff', borderBottom: '1px solid #e8e8e6' }}>
        <div style={{ flex: '1 1 280px' }}>
          <h1 className="t-titel">{weergave === 'doeken' ? 'Branding' : 'Bibliotheek'}</h1>
          <p className="fm-sub" style={{ margin: '4px 0 0', fontSize: 14 }}>{weergave === 'doeken' ? `Doeken, panelen, vlaggen en frames · ${doeken.length} ontwerpen, gedeeld over alle plannen.` : `Elementen met echte maten · ${lijst.length} elementen, gedeeld over alle plannen.`}</p>
        </div>
        {schrijven && weergave === 'elementen' && <button className="fm-knop" style={{ height: 40 }} onClick={() => setToonImport((x) => !x)}>Importeren uit Excel of CSV</button>}
        {schrijven && weergave === 'elementen' && (
          <label className="fm-knop" style={{ height: 40 }}>Tekening inladen (SVG of DXF)
            <input type="file" accept=".svg,.dxf,image/svg+xml" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; await kies(null); setTekBreedte(''); setTimeout(() => kiesTekening(f), 0); }} />
          </label>
        )}
        {schrijven && weergave === 'elementen' && <a className="fm-knop" style={{ height: 40 }} href="/maps/bibliotheek/teken/nieuw">Element tekenen</a>}
        {schrijven && weergave === 'elementen' && <button className="fm-knop rood" style={{ height: 40 }} onClick={() => kies(null)}>Nieuw element</button>}
      </header>
      {alleenLezen && <div style={{ padding: '12px 32px 0' }}><div className="fm-melding info">Enkel beheerders wijzigen de gedeelde bibliotheek. Een eigen object voor één plan maak je in het plan zelf.</div></div>}
      {(fout || melding) && <div style={{ padding: '12px 32px 0' }}>{fout && <div className="fm-melding fout">{fout}</div>}{melding && <div className="fm-melding info">{melding}</div>}</div>}

      {toonImport && (
        <div style={{ margin: '16px 32px', background: '#fff', border: '1px solid #e8e8e6' }}>
          <div className="fm-sectie">
            <div className="fm-kop">Plak rijen uit Excel (met kop)<Info>Kolommen: naam, categorie, tekenwijze (punt, lijn of schaal), breedte, diepte, eenheid, leverancier, kva, ampere. Een bestaande naam wordt bijgewerkt.</Info></div>
            <label className="fm-veld"><span style={{ position: 'absolute', left: -9999 }}>Tabel</span><textarea rows={6} value={importTekst} onChange={(e) => setImportTekst(e.target.value)} placeholder={'naam;categorie;tekenwijze;breedte;diepte;eenheid;leverancier;kva\nGenerator 100 kVA;Stroom;punt;;;;Intermetal Motor;100'} /></label>
            {importRijen.length > 0 && (
              <>
                <table className="fm-tabel">
                  <thead><tr><th>Naam</th><th>Categorie</th><th>Tekenwijze</th><th>Maten</th><th>Status</th></tr></thead>
                  <tbody>{importRijen.map((r, i) => <tr key={i}><td>{r.naam}</td><td>{r.categorie}</td><td>{r.tekenwijze}</td><td>{elementMaat(r)}</td><td style={{ color: r.bestaat ? '#8A4D00' : '#0E6B48' }}>{r.bestaat ? 'Bestaat al: bijwerken' : 'Nieuw'}</td></tr>)}</tbody>
                </table>
                <button className="fm-knop zwart" onClick={importeer}>{importRijen.length} elementen verwerken</button>
              </>
            )}
          </div>
        </div>
      )}

      {weergave === 'doeken' && (heeftModule('branding') ? <DoekenBeheer doeken={doeken} setDoeken={setDoeken} schrijven={schrijven} /> : <div style={{ padding: 32 }} className="fm-sub">De module Branding staat niet aan voor deze organisatie.</div>)}
      <div style={{ display: weergave === 'doeken' ? 'none' : 'flex', flexWrap: 'wrap', gap: 24, padding: '16px 32px 32px' }}>
        <Overzicht lijst={lijst} setLijst={setLijst} cats={cats} cat={cat} setCat={setCat} gekozen={gekozen} kies={kies} schrijven={magBib} profiel={profiel} setMelding={setMelding} setFout={setFout} />

        {gekozen && (
          <aside style={{ flex: '1 1 340px', maxWidth: 420, background: '#fff', border: '1px solid #e8e8e6', alignSelf: 'flex-start', position: 'sticky', top: 12, maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}>
            <div className="fm-subtabs" role="tablist" style={{ top: 0 }}>
              {[['algemeen', 'Algemeen'], ['tekening', 'Tekening'], ['info', "Foto's"], ['meer', familieVanElement(vorm) === 'stroom' ? 'Stroom' : 'Meer']].map(([k, t]) => <button key={k} role="tab" aria-selected={bibTab === k} className={bibTab === k ? 'aan' : ''} onClick={() => setBibTab(k)}>{t}</button>)}
            </div>
            {bibTab === 'algemeen' && (<>
            <div className="fm-sectie">
              <div className="fm-kop" style={{ fontSize: 16 }}>{gekozen === 'nieuw' ? 'Nieuw element' : vorm.naam}</div>
              <label className={`fm-veld${gekozen === 'nieuw' && !vorm.familie ? ' fm-eerst' : ''}`}><span>Soort<Info>Bepaalt welk detailscherm het element krijgt (een hek krijgt toebehoren en doek, een generator stroom). Waar het in de bibliotheek staat, volgt uit de categorie: dezelfde indeling als bij de leveranciers. Leeg = afgeleid uit de categorie.</Info></span>
                <select value={vorm.familie || ''} disabled={!schrijven} onChange={(e) => { const f = e.target.value || null; setVorm({ ...vorm, familie: f, ...(gekozen === 'nieuw' && f === 'hekken' && vorm.tekenwijze === 'schaal' ? { tekenwijze: 'lijn', eenheid_m: vorm.eenheid_m || 2.5 } : {}) }); }}>
                  <option value="">Automatisch: {FAMILIE_NAAM[familieUitCategorie(vorm.categorie, vorm)]}</option>
                  {FAMILIES.filter((f) => f.k !== 'vormen').map((f) => <option key={f.k} value={f.k}>{f.naam}</option>)}
                </select>
              </label>
              <label className="fm-veld">Naam<input value={vorm.naam} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, naam: e.target.value })} /></label>
              <div className="fm-raster2">
                <label className="fm-veld">Categorie<input list="fm-cats" value={vorm.categorie} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, categorie: e.target.value })} /></label>
                <label className="fm-veld">Leverancier<input list="fm-levs" value={vorm.leverancier || ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, leverancier: e.target.value })} placeholder="Leeg = algemeen (standaard van het plan)" /></label>
                <datalist id="fm-levs">{levLijst.filter((l) => l.actief !== false).map((l) => <option key={l.id} value={l.naam}>{(l.categorieen || []).join(', ')}</option>)}</datalist>
              </div>
              <datalist id="fm-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
              {vorm.tekenwijze === 'sjabloon' ? (
                <div className="fm-sub">Sjabloon met {vorm.eigenschappen?.items?.length || 0} onderdelen, {String(vorm.breedte_m).replace('.', ',')} × {String(vorm.diepte_m).replace('.', ',')} m.<Info>Een sjabloon maak je in een plan: selecteer de onderdelen en kies Als sjabloon.</Info></div>
              ) : (
              <div className="fm-veld">Tekenwijze
                <div className="fm-segment">
                  {[['punt', 'Punt'], ['lijn', 'Lijn'], ['schaal', 'Op schaal']].map(([k, t]) => <button key={k} className={vorm.tekenwijze === k ? 'aan' : ''} disabled={!schrijven} onClick={() => setVorm({ ...vorm, tekenwijze: k })}>{t}</button>)}
                </div>
              </div>
              )}
              {vorm.tekenwijze === 'schaal' && (
                <div className="fm-raster3">
                  <label className="fm-veld">Breedte (m)<input value={vorm.breedte_m ?? ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, breedte_m: e.target.value })} inputMode="decimal" /></label>
                  <label className="fm-veld">Diepte (m)<input value={vorm.diepte_m ?? ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, diepte_m: e.target.value })} inputMode="decimal" /></label>
                  <label className="fm-veld">Hoogte (m)<input value={vorm.hoogte_m ?? ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, hoogte_m: e.target.value })} inputMode="decimal" /></label>
                </div>
              )}
              {vorm.tekenwijze === 'schaal' && (
                <label className="fm-vink"><input type="checkbox" checked={!!vorm.eigenschappen?.module} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), module: e.target.checked || undefined } })} />
                  Vlakvullend: een gesleept vak wordt ingedeeld in stukken van deze maat (houten vloer, rijplaten)</label>
              )}
              {vorm.tekenwijze === 'schaal' && vorm.eigenschappen?.module && (
                <label className="fm-vink"><input type="checkbox" checked={!!vorm.eigenschappen?.strak} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), strak: e.target.checked || undefined, ...(e.target.checked ? { overlap_m: 0, overlap_lang_m: 0, overlap_kort_m: 0 } : {}) } })} />
                  Vloer: panelen sluiten strak aan (niet verspringend, geen overlap, haakse hoeken)</label>
              )}
              {vorm.tekenwijze === 'schaal' && vorm.eigenschappen?.module && (
                <div className="fm-raster2">
                  <label className="fm-veld">Overlap lange zijde (cm)<input value={(vorm.eigenschappen?.overlap_lang_m ?? vorm.eigenschappen?.overlap_m) != null ? Math.round(Number(vorm.eigenschappen.overlap_lang_m ?? vorm.eigenschappen.overlap_m) * 100) : ''} disabled={!schrijven} inputMode="decimal" onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), overlap_lang_m: e.target.value === '' ? undefined : (Number(e.target.value.replace(',', '.')) || 0) / 100 } })} /></label>
                  <label className="fm-veld">Overlap korte zijde (cm)<input value={(vorm.eigenschappen?.overlap_kort_m ?? vorm.eigenschappen?.overlap_m) != null ? Math.round(Number(vorm.eigenschappen.overlap_kort_m ?? vorm.eigenschappen.overlap_m) * 100) : ''} disabled={!schrijven} inputMode="decimal" onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), overlap_kort_m: e.target.value === '' ? undefined : (Number(e.target.value.replace(',', '.')) || 0) / 100 } })} /></label>
                  <label className="fm-veld">Verspringing (m, 0 = halve plaat)<input value={vorm.eigenschappen?.verspring_m ?? ''} disabled={!schrijven} inputMode="decimal" onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), verspring_m: e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')) || 0 } })} /></label>
                  <label className="fm-vink" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!vorm.eigenschappen?.verspringend_standaard} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), verspringend_standaard: e.target.checked || undefined } })} />Standaard verspringend</label>
                  <label className="fm-veld">Gewicht per stuk (kg)<input value={vorm.eigenschappen?.gewicht_kg ?? ''} disabled={!schrijven} inputMode="decimal" onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), gewicht_kg: e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')) || 0 } })} /></label>
                </div>
              )}
              {vorm.tekenwijze === 'schaal' && (
                <label className="fm-vink"><input type="checkbox" checked={vorm.eigenschappen?.vloer ?? !!vorm.eigenschappen?.module} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), vloer: e.target.checked } })} />
                  Ligt plat op de grond: geen botsing met wat erop staat (rijplaten, vloer, tapijt)</label>
              )}
              {vorm.tekenwijze === 'lijn' && (<>
                <div className="fm-raster2">
                  <label className="fm-veld">Lengte per stuk (m) · leeg = geen telling<input value={vorm.eenheid_m ?? ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eenheid_m: e.target.value })} inputMode="decimal" placeholder="bv. 2,035" /></label>
                  <label className="fm-veld"><span>Breedte op de grond (m)<Info>Leeg = gewone lijn. Met een breedte (vanaf 0,05) tekent de lijn op ware breedte, bv. Boplan. Bij Tekening teken je één stuk dat langs de lijn herhaald wordt.</Info></span><input value={vorm.diepte_m ?? ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, diepte_m: e.target.value })} inputMode="decimal" placeholder="bv. 0,825" /></label>
                </div>
                <div className="fm-veld"><span>Lengte bij tekenen<Info>Licht snappen: dicht bij een heel aantal stukken springt de lijn erop (bv. heras). Volledige stuks: altijd een heel aantal (bv. Boplan).</Info></span>
                  <div className="fm-segment">
                    {[['zacht', 'Licht snappen'], ['vol', 'Enkel volledige stuks'], ['uit', 'Vrij']].map(([k, t]) => <button key={k} className={(vorm.eigenschappen?.lengte_snap || 'zacht') === k ? 'aan' : ''} disabled={!schrijven} onClick={() => setVorm({ ...vorm, eigenschappen: { ...(vorm.eigenschappen || {}), lengte_snap: k } })}>{t}</button>)}
                  </div>
                </div>
                <div className="fm-veld"><span>Doek op dit element<Info>Op kaart en PDF komt een band in de kleur van het doek onder de lijn. Bedrukt: op het plan kies je per lijn welk doek.</Info></span>
                  <div className="fm-segment">
                    {[['geen', 'Geen'], ['wit', 'Wit'], ['zwart', 'Zwart'], ['bedrukt', 'Bedrukt']].map(([k, t]) => <button key={k} className={(eig.doek || 'geen') === k ? 'aan' : ''} disabled={!schrijven} onClick={() => zetEig({ doek: k })}>{t}</button>)}
                  </div>
                  {eig.doek === 'bedrukt' && <div className="fm-kleuren">{KLEUREN.map((k) => <button key={k} className={(eig.doek_kleur || '#E11D48').toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} aria-label={k} disabled={!schrijven} onClick={() => zetEig({ doek_kleur: k })} />)}</div>}
                </div>
                {(() => {
                  const lijst = Array.isArray(vorm.eigenschappen?.toebehoren) ? vorm.eigenschappen.toebehoren : TOEBEHOREN;
                  const zet = (l) => zetEig({ toebehoren: l });
                  const wijzig = (i, patch) => zet(lijst.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div className="fm-veld"><span>Toebehoren<Info>Bv. klemmen, schoren, wielen, zandzakken. Op het plan vink je per lijn aan wat erbij komt; het telt mee in de stuklijst.</Info></span>
                      <div className="fm-tblijst">
                        {lijst.map((a, i) => (
                          <div key={a.k} className="fm-tbrij">
                            <input value={a.naam} disabled={!schrijven} onChange={(e) => wijzig(i, { naam: e.target.value })} placeholder="Naam, bv. Klemmen" aria-label="Naam" />
                            {schrijven && <button className="fm-sluit" aria-label="Verwijderen" onClick={() => zet(lijst.filter((_, j) => j !== i))}>×</button>}
                            <div className="opties">
                            <select value={a.soort || 'geen'} disabled={!schrijven} onChange={(e) => wijzig(i, { soort: e.target.value })} aria-label="Hoe op de kaart">
                              {Object.entries(TB_SOORTEN).map(([k, x]) => <option key={k} value={k}>{x.naam}</option>)}
                            </select>
                            <select value={a.om || (a.soort === 'schoor' ? 2 : 1)} disabled={!schrijven || a.soort === 'klem'} onChange={(e) => wijzig(i, { om: Number(e.target.value) })} aria-label="Hoe vaak">
                              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{a.soort === 'klem' ? 'elke naad' : n === 1 ? 'elke naad' : `om de ${n}`}</option>)}
                            </select>
                            <select value={a.per || 1} disabled={!schrijven} onChange={(e) => wijzig(i, { per: Number(e.target.value) })} aria-label="Aantal per plek">
                              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}×</option>)}
                            </select>
                            {a.soort === 'driehoek' && <label className="fm-vink" title="Nadardriehoek: de twee benen zijn zelf hekken en worden zo getekend (anders stalen schoren met voetplaat, zoals bij heras)"><input type="checkbox" checked={!!a.hek} disabled={!schrijven} onChange={(e) => wijzig(i, { hek: e.target.checked })} />Benen zijn hekken</label>}
                            <label className="fm-vink" title="Staat standaard aan bij elke lijn van dit element"><input type="checkbox" checked={!!a.standaard_aan} disabled={!schrijven} onChange={(e) => wijzig(i, { standaard_aan: e.target.checked })} />Standaard aan</label>
                            </div>
                          </div>
                        ))}
                      </div>
                      {schrijven && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => zet([...lijst, { k: Math.random().toString(36).slice(2, 8), naam: '', soort: 'geen', om: 1, per: 1 }])}>+ Toebehoren</button>}
                    </div>
                  );
                })()}
              </>)}
              {vorm.omtrek && <div className="fm-sub">Eigen omtrek met {vorm.omtrek.length} hoekpunten (gemaakt vanuit een getekend vlak).</div>}
              <label className="fm-veld">Standaardlaag (naam)<input value={vorm.standaardlaag || ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, standaardlaag: e.target.value })} placeholder="bv. Hospitality" /></label>
            </div>
            </>)}
            {bibTab === 'info' && (<>
            <div className="fm-sectie">
              <div className="fm-kop">Foto's en info</div>
              {fotos.length > 0 && (
                <div className="fm-fotorij">
                  {fotos.map((pad, i) => (
                    <div key={pad} className="fm-foto">
                      <a href={publiekeUrl(pad)} target="_blank" rel="noreferrer"><img src={publiekeUrl(pad)} alt={`Foto ${i + 1} van ${vorm.naam}`} /></a>
                      {i === 0 && <span className="hoofd">Hoofdfoto</span>}
                      {schrijven && (
                        <span className="acties">
                          {i > 0 && <button title="Als hoofdfoto" onClick={() => zetEig({ fotos: [pad, ...fotos.filter((x) => x !== pad)] })}>★</button>}
                          <button title="Foto weghalen" onClick={() => zetEig({ fotos: fotos.filter((x) => x !== pad) })}>×</button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {schrijven && (
                <label className="fm-knop klein" style={{ alignSelf: 'flex-start' }}>{fotoBezig ? 'Uploaden…' : "Foto's toevoegen"}
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; voegFotosToe(f); }} />
                </label>
              )}
              <label className="fm-veld">Omschrijving<textarea rows={3} value={eig.omschrijving || ''} disabled={!schrijven} onChange={(e) => zetEig({ omschrijving: e.target.value })} placeholder="Wat is het, waarvoor gebruiken we het, waar op letten bij opbouw…" /></label>
              {vorm.tekenwijze !== 'doek' && vorm.tekenwijze !== 'sjabloon' && (
                <div className="fm-rij2">
                  <label className="fm-veld">Ter plaatse aanwezig<Info>Voor materiaal van een locatie (bv. 100 tafels van het Thermae Palace). De stuklijst toont dan hoeveel je moet aanvullen. Zet de categorie bv. op "Locatie: Thermae Palace" zodat ze samen in de bibliotheek staan.</Info>
                    <input inputMode="numeric" value={eig.voorraad ?? ''} disabled={!schrijven} placeholder="bv. 100" onChange={(e) => { const v = e.target.value.trim(); zetEig({ voorraad: v === '' ? undefined : Math.max(0, Math.round(Number(v.replace(',', '.')) || 0)) }); }} />
                  </label>
                </div>
              )}
              <div className="fm-raster2">
                <label className="fm-veld">Opbouw per stuk (min)<input value={eig.opbouw_min ?? ''} inputMode="decimal" disabled={!schrijven} onChange={(e) => zetEig({ opbouw_min: getal(e.target.value) })} /></label>
                <label className="fm-veld">Afbraak per stuk (min)<input value={eig.afbraak_min ?? ''} inputMode="decimal" disabled={!schrijven} onChange={(e) => zetEig({ afbraak_min: getal(e.target.value) })} placeholder={eig.opbouw_min ? `± ${Math.round(eig.opbouw_min * 0.6)}` : ''} /></label>
                <label className="fm-veld">Mensen per ploeg<input value={eig.mensen ?? ''} inputMode="decimal" disabled={!schrijven} onChange={(e) => zetEig({ mensen: getal(e.target.value) })} /></label>
                <label className="fm-veld">Gewicht (kg)<input value={eig.gewicht_kg ?? ''} inputMode="decimal" disabled={!schrijven} onChange={(e) => zetEig({ gewicht_kg: getal(e.target.value) })} /></label>
              </div>
              <div className="fm-raster2">
                <label className="fm-veld">Transport / heftruck<input value={eig.transport || ''} disabled={!schrijven} onChange={(e) => zetEig({ transport: e.target.value })} placeholder="bv. heftruck nodig, 1 pallet" /></label>
                <label className="fm-veld">Contact leverancier<input value={eig.contact || ''} disabled={!schrijven} onChange={(e) => zetEig({ contact: e.target.value })} placeholder="naam, gsm" /></label>
              </div>
              <label className="fm-veld">Link (productfiche, handleiding)<input value={eig.link || ''} disabled={!schrijven} onChange={(e) => zetEig({ link: e.target.value })} placeholder="https://…" /></label>
              <label className="fm-veld">Zoekwoorden<input value={(eig.tags || []).join(', ')} disabled={!schrijven} onChange={(e) => zetEig({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="bv. vip, catering, overdekt" /></label>
              <div className="fm-raster3">
                <label className="fm-veld"><span>Subgroep<Info>Groep binnen de categorie in het paneel, bv. Generatoren of Kabels.</Info></span><input value={eig.subgroep || ''} disabled={!schrijven} onChange={(e) => zetEig({ subgroep: e.target.value || undefined })} /></label>
                <label className="fm-veld"><span>Variantgroep<Info>Elementen met dezelfde variantgroep staan in het paneel als één rij met een knopje per variant (bv. Generator: 20 · 30 · 45 kVA).</Info></span><input value={eig.familie || ''} disabled={!schrijven} onChange={(e) => zetEig({ familie: e.target.value || undefined })} placeholder="bv. Generator" /></label>
                <label className="fm-veld">Variant<input value={eig.variant || ''} disabled={!schrijven} onChange={(e) => zetEig({ variant: e.target.value || undefined })} placeholder="bv. 60 kVA" /></label>
              </div>
            </div>
            </>)}
            {bibTab === 'tekening' && vorm.tekenwijze === 'punt' && <div className="fm-sectie"><div className="fm-sub">Een gedetailleerde tekening kan bij een element op schaal of een lijn. Zet de tekenwijze bij Algemeen op "Op schaal" of "Lijn".</div></div>}
            {bibTab === 'tekening' && (<>
            {vorm.tekenwijze === 'lijn' && (
              <div className="fm-sectie">
                <div className="fm-kop">Tekening van één stuk</div>
                {tekening ? (
                  <div style={{ background: '#FAFAFB', border: '1px solid #e8e8e6', display: 'flex', justifyContent: 'center', padding: 8 }}><ElementIcoon el={{ ...vorm, tekenwijze: 'schaal', breedte_m: tekening.b, diepte_m: tekening.h }} maat={220} /></div>
                ) : (
                  <div className="fm-sub">Teken één stuk van bovenaf; het wordt langs de lijn herhaald. Vul eerst bij Algemeen de lengte per stuk en de breedte in.</div>
                )}
                {schrijven && gekozen !== 'nieuw' && <a className="fm-knop zwart" style={{ alignSelf: 'flex-start' }} href={`/maps/bibliotheek/teken/${gekozen}`}>{tekening ? 'Tekening bewerken' : 'Stuk tekenen in de editor'}</a>}
                {schrijven && gekozen === 'nieuw' && <div className="fm-sub">Bewaar het element eerst.</div>}
                {schrijven && tekening && <button className="fm-knop klein gevaar" style={{ alignSelf: 'flex-start' }} onClick={() => { const { tekening: _, bron: __, ...rest } = vorm.eigenschappen || {}; setVorm({ ...vorm, eigenschappen: rest }); }}>Tekening verwijderen</button>}
              </div>
            )}
            {vorm.tekenwijze === 'schaal' && (
              <div className="fm-sectie">
                <div className="fm-kop">Gedetailleerde tekening</div>
                {tekening ? (
                  <div style={{ background: '#FAFAFB', border: '1px solid #e8e8e6', display: 'flex', justifyContent: 'center', padding: 8 }}><ElementIcoon el={vorm} maat={220} /></div>
                ) : (
                  <div className="fm-sub">Teken het element hier, of laad een SVG of DXF. Het komt op ware grootte op de kaart.</div>
                )}
                {schrijven && gekozen !== 'nieuw' && <a className="fm-knop zwart" style={{ alignSelf: 'flex-start' }} href={`/maps/bibliotheek/teken/${gekozen}`}>{tekening ? 'Tekening bewerken' : 'Tekening maken in de editor'}</a>}
                {schrijven && (
                  <>
                    <div className="fm-raster2">
                      <label className="fm-knop" style={{ alignSelf: 'end' }}>{tekening ? 'Andere tekening' : 'Bestand kiezen'}
                        <input type="file" accept=".svg,.dxf,image/svg+xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; kiesTekening(f); }} />
                      </label>
                      <label className="fm-veld">Echte breedte (m)<input value={tekBreedte} inputMode="decimal" placeholder={tekBestand?.soort === 'dxf' ? 'uit de DXF' : 'bv. 6'} onChange={(e) => setTekBreedte(e.target.value)} onBlur={() => tekBestand && zetTekening()} onKeyDown={(e) => e.key === 'Enter' && zetTekening()} /></label>
                    </div>
                    {tekBestand && <div className="fm-sub">{tekBestand.naam}{tekBestand.soort === 'svg' ? ' · de hoogte volgt uit de verhoudingen' : ' · maten uit de DXF-eenheden, of vul een breedte in om te schalen'}</div>}
                    {tekening && <button className="fm-knop klein gevaar" style={{ alignSelf: 'flex-start' }} onClick={() => { const { tekening: _, ...rest } = vorm.eigenschappen || {}; setVorm({ ...vorm, eigenschappen: rest }); setTekBestand(null); }}>Tekening verwijderen</button>}
                  </>
                )}
              </div>
            )}
            </>)}
            {bibTab === 'algemeen' && (<>
            <div className="fm-sectie">
              <div className="fm-kop">Stijl</div>
              <label className="fm-vink"><input type="checkbox" checked={s.label === true} disabled={!schrijven} onChange={(e) => zetStijl({ label: e.target.checked })} />Naam standaard op de kaart</label>
              {tekening?.teksten?.length > 0 && <label className="fm-vink"><input type="checkbox" checked={s.tekening_tekst !== false} disabled={!schrijven} onChange={(e) => zetStijl({ tekening_tekst: e.target.checked })} />Teksten in de tekening tonen</label>}
              <div className="fm-kleuren">{KLEUREN.map((k) => <button key={k} className={(s.kleur || '').toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} aria-label={k} disabled={!schrijven} onClick={() => zetStijl({ kleur: k, vulkleur: k })} />)}</div>
              {vorm.tekenwijze !== 'punt' && (
                <div className="fm-veld">Lijnstijl
                  <div className="fm-segment">{[['vol', 'Vol'], ['streep', 'Streep'], ['stip', 'Stip'], ['streeppunt', 'Streep-punt']].map(([k, t]) => <button key={k} className={(s.streep || 'vol') === k ? 'aan' : ''} disabled={!schrijven} onClick={() => zetStijl({ streep: k })}>{t}</button>)}</div>
                </div>
              )}
              {vorm.tekenwijze === 'schaal' && (
                <label className="fm-veld">Dekking vulling · {Math.round((s.vuldekking ?? 0.15) * 100)}%<input type="range" min="0" max="1" step="0.05" value={s.vuldekking ?? 0.15} disabled={!schrijven} onChange={(e) => zetStijl({ vuldekking: Number(e.target.value) })} style={{ padding: 0, border: 0, height: 24 }} /></label>
              )}
            </div>
            </>)}
            {bibTab === 'algemeen' && (() => {
              const delen = eig.onderdelen || [];
              const zetD = (l) => zetEig({ onderdelen: l });
              const kandidaten = lijst.filter((x) => x.id !== gekozen && x.tekenwijze !== 'stijl');
              return (
                <div className="fm-sectie">
                  <div className="fm-kop">Bestaat uit<Info>Bv. heraspoort = 1 heras + 2 wielen. De onderdelen tellen mee in de stuklijst.</Info></div>
                  {delen.map((o, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 28px', gap: 4, alignItems: 'center' }}>
                      <input value={o.aantal ?? 1} inputMode="numeric" aria-label="Aantal" disabled={!schrijven} onChange={(e) => zetD(delen.map((x, j) => (j === i ? { ...x, aantal: Number(String(e.target.value).replace(',', '.')) || '' } : x)))} />
                      <select value={o.element_id || (o.naam ? `vrij:${o.naam}` : '')} disabled={!schrijven} aria-label="Onderdeel" style={{ width: '100%', minWidth: 0 }}
                        onChange={(e) => { const v = e.target.value; zetD(delen.map((x, j) => (j === i ? (v.startsWith('vrij:') ? { aantal: x.aantal, naam: v.slice(5) } : { aantal: x.aantal, element_id: v }) : x))); }}>
                        <option value="">Kies een element…</option>
                        {o.naam && <option value={`vrij:${o.naam}`}>{o.naam} (los)</option>}
                        {kandidaten.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
                      </select>
                      {schrijven && <button className="fm-sluit" aria-label="Verwijderen" onClick={() => zetD(delen.filter((_, j) => j !== i))}>×</button>}
                    </div>
                  ))}
                  {schrijven && (
                    <div className="fm-vinkrij" style={{ gap: 6 }}>
                      <button className="fm-knop klein" onClick={() => zetD([...delen, { aantal: 1, element_id: '' }])}>+ Onderdeel uit de bibliotheek</button>
                      <button className="fm-knop klein" onClick={async () => { const n = await vraagTekst('Naam van het onderdeel (iets dat niet in de bibliotheek staat, bv. "Wiel")', ''); if (n?.trim()) zetD([...delen, { aantal: 1, naam: n.trim() }]); }}>+ Los onderdeel</button>
                    </div>
                  )}
                </div>
              );
            })()}
            {bibTab === 'algemeen' && isUnitEl(vorm) && <GevelBeheer L={Number(vorm.breedte_m) || 6} B={Number(vorm.diepte_m) || 3} gevel={eig.gevel || []} schrijven={schrijven} onZet={(gevel) => setVorm({ ...vorm, eigenschappen: { ...eig, gevel: gevel.length ? gevel : undefined } })} />}
            {bibTab === 'algemeen' && (<>
            <div className="fm-sectie">
              <div className="fm-kop">Varianten<Info>Bv. tent open of dicht, podium 8×6 of 10×8. Je kiest bij het plaatsen; de stuklijst telt per variant.</Info></div>
              {(vorm.varianten || []).map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 4 }}>
                  <input value={v.naam} placeholder="Naam" disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, varianten: vorm.varianten.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)) })} style={{ flex: 2, minWidth: 0, height: 32 }} />
                  {vorm.tekenwijze === 'schaal' && <input value={v.breedte_m ?? ''} placeholder="B" inputMode="decimal" disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, varianten: vorm.varianten.map((x, j) => (j === i ? { ...x, breedte_m: e.target.value } : x)) })} style={{ flex: 1, minWidth: 0, height: 32 }} />}
                  {vorm.tekenwijze === 'schaal' && <input value={v.diepte_m ?? ''} placeholder="D" inputMode="decimal" disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, varianten: vorm.varianten.map((x, j) => (j === i ? { ...x, diepte_m: e.target.value } : x)) })} style={{ flex: 1, minWidth: 0, height: 32 }} />}
                  {schrijven && <button className="fm-knop klein gevaar" onClick={() => setVorm({ ...vorm, varianten: vorm.varianten.filter((_, j) => j !== i) })}>×</button>}
                </div>
              ))}
              {schrijven && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => setVorm({ ...vorm, varianten: [...(vorm.varianten || []), { naam: '', breedte_m: vorm.breedte_m, diepte_m: vorm.diepte_m }] })}>Variant toevoegen</button>}
            </div>
            </>)}
            {bibTab === 'meer' && (<>
            <div className="fm-sectie">
              <div className="fm-kop">Koppeling met de stock</div>
              <label className="fm-veld">Stock-artikel (alleen lezen)
                <select value={vorm.artikel_id || ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, artikel_id: e.target.value || null })}>
                  <option value="">Niet gekoppeld</option>
                  {artikels.map((a) => <option key={a.id} value={a.id}>{[a.code, a.naam].filter(Boolean).join(' · ')}{a.aantal_totaal != null ? ` (${a.aantal_totaal} in stock)` : ''}</option>)}
                </select>
              </label>
              <div className="fm-sub">De stuklijst toont de stock (alleen lezen).</div>
            </div>
            </>)}
            {bibTab === 'meer' && (<>
            {vorm.tekenwijze !== 'lijn' && familieVanElement(vorm) !== 'stroom' && (
              <div className="fm-sectie">
                <div className="fm-kop">Stroomaansluitingen<Info>Bv. een podium met 32 A en 63 A. In het plan kies je per aansluiting de voeding.</Info></div>
                {(eig.aansluitingen || []).map((a, i) => {
                  const zetA = (patch) => setVorm({ ...vorm, eigenschappen: { ...eig, aansluitingen: eig.aansluitingen.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.9fr) auto', gap: 4, alignItems: 'end' }}>
                      <label className="fm-veld">Naam<input value={a.naam || ''} placeholder={`${a.ampere || ''} A`} disabled={!schrijven} onChange={(e) => zetA({ naam: e.target.value })} /></label>
                      <label className="fm-veld">Stroom<select value={a.ampere ?? ''} disabled={!schrijven} onChange={(e) => zetA({ ampere: getal(e.target.value) })}><option value="">?</option>{AANSLUITINGEN.map((x) => <option key={x} value={x}>{x} A</option>)}</select></label>
                      <label className="fm-veld">Fase<select value={a.fase || '3F'} disabled={!schrijven} onChange={(e) => zetA({ fase: e.target.value })}>{FASEN_EL.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                      <label className="fm-veld">kW<input value={a.kw ?? ''} inputMode="decimal" disabled={!schrijven} onChange={(e) => zetA({ kw: getal(e.target.value) })} /></label>
                      {schrijven && <button className="fm-knop klein gevaar" style={{ height: 28 }} onClick={() => setVorm({ ...vorm, eigenschappen: { ...eig, aansluitingen: eig.aansluitingen.filter((_, j) => j !== i) } })} aria-label="Aansluiting weg">×</button>}
                    </div>
                  );
                })}
                {schrijven && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => setVorm({ ...vorm, eigenschappen: { ...eig, aansluitingen: [...(eig.aansluitingen || []), { ampere: 32, fase: '3F', kw: null }] } })}>Aansluiting toevoegen</button>}
                <label className="fm-veld" style={{ maxWidth: 220 }}>Eigen kabel (m)<input value={eig.eigen_kabel_m ?? ''} inputMode="decimal" placeholder="geen" disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...eig, eigen_kabel_m: getal(e.target.value) || null } })} /></label>
                <div className="fm-sub">Levert de verhuurder zelf kabel mee (bv. LED-trailer 25 m)? Dan zet je in het plan enkel een kast binnen dat bereik.</div>
              </div>
            )}
            </>)}
            {bibTab === 'meer' && (<>
            {familieVanElement(vorm) === 'stroom' && (
              <div className="fm-sectie">
                <div className="fm-kop">Elektriciteit</div>
                <div className="fm-raster2">
                  <label className="fm-veld">Vermogen (kVA)<input value={eig.kva ?? ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...eig, kva: getal(e.target.value) } })} inputMode="decimal" /></label>
                  <label className="fm-veld">Stroom (A)<input value={eig.ampere ?? ''} disabled={!schrijven} onChange={(e) => setVorm({ ...vorm, eigenschappen: { ...eig, ampere: getal(e.target.value) } })} inputMode="decimal" /></label>
                </div>
              </div>
            )}
            </>)}
            {magBib && centraalEl && (
              <div className="fm-sectie" style={{ borderBottom: 0, position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e8e8e6', zIndex: 2 }}>
                <div className="fm-sub">Dit element komt uit de bibliotheek van Toolen en wordt daar bijgehouden. Wil je het aanpassen, maak dan een eigen kopie.</div>
                <button className="fm-knop" style={{ alignSelf: 'flex-start' }} onClick={() => kies({ ...vorm, id: undefined, organisatie_id: undefined, collectie_id: undefined, rev: undefined, naam: `${vorm.naam} (eigen)` })}>Eigen kopie maken</button>
              </div>
            )}
            {schrijven && (
              <div className="fm-sectie" style={{ flexDirection: 'row', flexWrap: 'wrap', borderBottom: 0, position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e8e8e6', zIndex: 2 }}>
                {bibGewijzigd
                  ? <button className="fm-knop rood" onClick={bewaar}>Bewaren</button>
                  : <span className="fm-bewaarstatus" style={{ cursor: 'default' }}><span className="stip" />Bewaard</span>}
                {gekozen !== 'nieuw' && <button className="fm-knop" onClick={() => kies({ ...vorm, id: undefined, naam: `${vorm.naam} (kopie)` })}>Dupliceren</button>}
                {gekozen !== 'nieuw' && <button className="fm-knop" onClick={() => setVorm({ ...vorm, actief: !vorm.actief })}>{vorm.actief ? 'Niet meer aanbieden' : 'Weer aanbieden'}</button>}
                {gekozen !== 'nieuw' && <button className="fm-knop gevaar" style={{ marginLeft: 'auto', width: 40, padding: 0, justifyContent: 'center' }} onClick={verwijder} title="Definitief verwijderen" aria-label="Definitief verwijderen"><Icoon naam="prullenbak" maat={16} /></button>}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}


// Doeken van FLCS (sponsor- en eventdoeken voor gezeilde hekken). Per event kies
// je per hek welk doek erop komt; hier staan ze allemaal, met een beeld en een kleur.
// Schrijven in de bibliotheek: open plannen (andere tabbladen) halen de bibliotheek daarna opnieuw op.
const bibSchrijf = () => { setTimeout(() => { try { new BroadcastChannel('fm-bibliotheek').postMessage({ t: Date.now() }); } catch {} }, 1500); return maps().from('bibliotheek'); };

function DoekenBeheer({ doeken, setDoeken, schrijven }) {
  const [gekozen, setGekozen] = useState(null);
  const [v, setV] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [soort, setSoort] = useState(() => { try { return new URLSearchParams(window.location.search).get('ds') || 'hek'; } catch { return 'hek'; } }); // hek = doeken voor Heras, totem = forexpanelen, vlag = beachvlaggen, truss = trussdoeken
  const totem = soort === 'totem';
  const dr = (d) => d.eigenschappen?.drager || 'hek';
  const lijst = useMemo(() => doeken.filter((d) => dr(d) === soort), [doeken, soort]); // eslint-disable-line react-hooks/exhaustive-deps
  // Na vernieuwen: zelfde soort en hetzelfde doek open (adresbalk).
  const urlDoek = useRef(undefined);
  if (urlDoek.current === undefined) { try { urlDoek.current = new URLSearchParams(window.location.search).get('doek'); } catch { urlDoek.current = null; } }
  useEffect(() => { if (!urlDoek.current || !doeken.length) return; const d = doeken.find((x) => x.id === urlDoek.current); urlDoek.current = null; if (d) { setSoort(dr(d)); kies(d); } }, [doeken.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { const u = new URL(window.location.href); if (soort !== 'hek') u.searchParams.set('ds', soort); else u.searchParams.delete('ds'); if (gekozen && gekozen !== 'nieuw') u.searchParams.set('doek', gekozen); else u.searchParams.delete('doek'); if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href); } catch {}
  }, [soort, gekozen]);
  useEffect(() => () => { try { const u = new URL(window.location.href); u.searchParams.delete('ds'); u.searchParams.delete('doek'); window.history.replaceState(window.history.state, '', u.href); } catch {} }, []);
  const kies = (d) => { if (vRef.current?.id) opslaan(); bewaard.current = d ? JSON.stringify((({ id: _i, created_at: _c, updated_at: _u, ...x }) => x)(d)) : ''; setStatus(''); setFout(''); setGekozen(d?.id || 'nieuw'); setV(d ? { ...d, eigenschappen: { ...(d.eigenschappen || {}) } } : { naam: '', categorie: 'Doeken en drukwerk', tekenwijze: 'doek', stijl: {}, eigenschappen: totem ? { kleur: '#16A34A', afmeting: '100 × 250 cm', drager: 'totem' } : soort === 'truss' ? { kleur: '#7C3AED', afmeting: '200 × 200 cm', drager: 'truss' } : soort === 'frame' ? { kleur: '#EA580C', afmeting: '100 × 200 cm', drager: 'frame' } : soort === 'drape' ? { kleur: '#0F766E', afmeting: '300 × 300 cm', drager: 'drape' } : soort === 'vlag' ? { kleur: '#2563EB', afmeting: '85 × 330 cm', drager: 'vlag' } : { kleur: '#E11D48', afmeting: '340 × 173 cm' }, actief: true }); setFout(''); };
  // Bewaren: een bestaand doek bewaart meteen bij een keuze (kleur, drager, ontwerp) en bij het verlaten van
  // een tekstveld; een nieuw doek komt pas in de bibliotheek met "Doek toevoegen".
  const [status, setStatus] = useState('');
  const vRef = useRef(null); vRef.current = v;
  const bewaard = useRef('');
  const opslaan = async (w = vRef.current) => {
    if (!w?.id || !schrijven) return;
    const { id, created_at, updated_at, ...rij } = w;
    rij.naam = (rij.naam || '').trim() || 'Naamloos doek';
    const sleutel = JSON.stringify(rij); if (sleutel === bewaard.current) return;
    setStatus('Bewaren…'); setFout('');
    const r0 = await bibSchrijf().update(rij).eq('id', id).select().single();
    if (r0.error) { setStatus(''); setFout(foutTekst(r0.error)); return; }
    bewaard.current = sleutel;
    setDoeken((l) => l.map((x) => (x.id === r0.data.id ? r0.data : x)));
    setStatus('Bewaard');
  };
  const toevoegen = async () => {
    const w = vRef.current; if (!w) return;
    if (!w.naam?.trim()) { setFout(w.eigenschappen?.drager === 'totem' ? 'Geef het paneel een naam.' : 'Geef het doek een naam.'); return; }
    const { id, created_at, updated_at, ...rij } = w; rij.naam = rij.naam.trim();
    setStatus('Bewaren…'); setFout('');
    const r0 = await bibSchrijf().insert(rij).select().single();
    if (r0.error) { setStatus(''); setFout(foutTekst(r0.error)); return; }
    bewaard.current = JSON.stringify((({ id: _i, created_at: _c, updated_at: _u, ...x }) => x)(r0.data));
    setDoeken((l) => [...l, r0.data].sort((a2, b2) => a2.naam.localeCompare(b2.naam)));
    setGekozen(r0.data.id); setV({ ...r0.data }); setStatus('Toegevoegd');
  };
  // Lokaal aanpassen (tekstvelden) of aanpassen en meteen bewaren (knoppen, ontwerp).
  const zetLokaal = (patch) => setV((x) => ({ ...x, eigenschappen: { ...(x.eigenschappen || {}), ...patch } }));
  const zetE = (patch) => { const w = { ...vRef.current, eigenschappen: { ...(vRef.current?.eigenschappen || {}), ...patch } }; setV(w); vRef.current = w; opslaan(w); };
  const verwijder = async () => {
    if (!(await bevestig(`Doek "${v.naam}" verwijderen? Hekken die dit doek hadden, tonen dan geen doek meer.`, { ok: 'Verwijderen', gevaar: true }))) return;
    const r = await bibSchrijf().delete().eq('id', v.id || gekozen);
    if (r.error) { setFout(foutTekst(r.error)); return; }
    setDoeken((l) => l.filter((x) => x.id !== (v.id || gekozen))); setGekozen(null); setV(null);
  };
  const beeld = async (f) => {
    if (!f) return;
    setBezig(true); setFout('');
    try {
      // jpg, png of pdf: het origineel blijft bewaard, het beeld wordt een jpg (bij een pdf de eerste pagina).
      const v0 = await voorbeeldVan(f);
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const stam = `doeken/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const a = await sb().storage.from(BUCKET).upload(`${stam}.${ext}`, f, { contentType: f.type || undefined });
      if (a.error) throw a.error;
      const b = await sb().storage.from(BUCKET).upload(`${stam}-beeld.jpg`, v0.blob, { contentType: 'image/jpeg' });
      if (b.error) throw b.error;
      const w0 = vRef.current;
      const w = { ...w0, naam: w0.naam || f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), eigenschappen: { ...(w0.eigenschappen || {}), beeld: `${stam}-beeld.jpg`, bestand: `${stam}.${ext}`, bestandsnaam: f.name, ...(w0.id ? {} : { kleur: v0.kleur }) } };
      setV(w); vRef.current = w; opslaan(w);
    } catch (e) { setFout(e.message || String(e)); } finally { setBezig(false); }
  };
  // De tegels apart onthouden: typen in het paneel rechts tekent ze niet telkens opnieuw.
  const raster = useMemo(() => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {lijst.map((d) => (
            <button key={d.id} onClick={() => kies(d)} style={{ textAlign: 'left', background: '#fff', border: gekozen === d.id ? '2px solid #1d1d1b' : '1px solid #e8e8e6', padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dr(d) === 'vlag' ? (
                <span style={{ height: 90, background: '#FAFAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Beachvlag src={d.eigenschappen?.beeld ? publiekeUrl(d.eigenschappen.beeld) : null} kleur={d.eigenschappen?.kleur} hoogte={84} /></span>
              ) : (
                <span style={{ height: 90, background: d.eigenschappen?.kleur || '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {d.eigenschappen?.beeld && <img src={publiekeUrl(d.eigenschappen.beeld)} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                </span>
              )}
              <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 10, height: 10, background: d.eigenschappen?.kleur || '#E11D48', flex: 'none' }} />{d.naam}</strong>
              <span className="fm-sub">{d.eigenschappen?.afmeting || ''}</span>
            </button>
          ))}
          {!lijst.length && <div className="fm-sub">{totem ? 'Nog geen panelen.' : 'Nog geen doeken.'}</div>}
        </div>
  ), [lijst, gekozen]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '16px 32px 32px' }}>
      <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="fm-segment fm-doektabs">{[['hek', `Heras-doeken · ${doeken.filter((d) => dr(d) === 'hek').length}`], ['totem', `Totempanelen · ${doeken.filter((d) => dr(d) === 'totem').length}`], ['vlag', `Beachvlaggen · ${doeken.filter((d) => dr(d) === 'vlag').length}`], ['truss', `Truss-doeken · ${doeken.filter((d) => dr(d) === 'truss').length}`], ['frame', `Frame-doeken · ${doeken.filter((d) => dr(d) === 'frame').length}`], ['drape', `Drape-doeken · ${doeken.filter((d) => dr(d) === 'drape').length}`]].map(([k, t]) => <button key={k} className={soort === k ? 'aan' : ''} onClick={() => { setSoort(k); setGekozen(null); setV(null); }}>{t}</button>)}</div>
          <span className="fm-sub" style={{ flex: '1 1 160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{totem ? 'Forexpanelen voor de infototem' : soort === 'vlag' ? 'Ontwerpen voor beachvlaggen' : soort === 'truss' ? 'Doeken voor een trusskubus of -boog' : soort === 'frame' ? 'Doeken voor textielframes (B-matrix), voor- en achterkant' : soort === 'drape' ? 'Bedrukte doeken voor pipe & drape, per sectie' : 'Doeken voor gezeilde hekken'}<Info>{totem ? 'Op het plan kies je per zijde van een infototem welk paneel erop komt.' : 'Op het plan kies je per hek welk doek erop komt (hek met eigen doek).'}</Info></span>
          {schrijven && <button className="fm-knop rood" onClick={() => kies(null)}>{totem ? 'Nieuw paneel' : soort === 'vlag' ? 'Nieuwe vlag' : 'Nieuw doek'}</button>}
        </div>
        {raster}
      </div>
      {v && (
        <aside style={{ flex: '1 1 340px', maxWidth: 420, background: '#fff', border: '1px solid #e8e8e6', alignSelf: 'flex-start' }}>
          <div className="fm-sectie">
            <div className="fm-kop">{gekozen === 'nieuw' ? (v.eigenschappen?.drager === 'totem' ? 'Nieuw paneel' : 'Nieuw doek') : v.naam}</div>
            <div className="fm-veld">Voor
              <div className="fm-doekvoor">{[['', 'Heras-hek'], ['totem', 'Infototem'], ['vlag', 'Beachvlag'], ['truss', 'Truss'], ['frame', 'Frame'], ['drape', 'Pipe & drape']].map(([k, t]) => <button key={t} className={(v.eigenschappen?.drager || '') === k ? 'aan' : ''} disabled={!schrijven} onClick={() => zetE({ drager: k || null })}>{t}</button>)}</div>
            </div>
            {fout && <div className="fm-melding fout">{fout}</div>}
            <label className="fm-veld">Naam<input value={v.naam || ''} disabled={!schrijven} onChange={(e) => { const t = e.target.value; setV((x) => ({ ...x, naam: t })); }} onBlur={() => opslaan()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} placeholder="bv. Sponsor A" /></label>
            <label className="fm-veld">Afmeting<input value={v.eigenschappen?.afmeting || ''} disabled={!schrijven} onChange={(e) => zetLokaal({ afmeting: e.target.value })} onBlur={() => opslaan()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} placeholder="bv. 340 × 173 cm" /></label>
            <div className="fm-veld">Kleur op de kaart
              <div className="fm-kleuren">{KLEUREN.map((k) => <button key={k} className={(v.eigenschappen?.kleur || '').toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} aria-label={k} disabled={!schrijven} onClick={() => zetE({ kleur: k })} />)}
                <input type="color" value={v.eigenschappen?.kleur || '#E11D48'} disabled={!schrijven} onChange={(e) => zetLokaal({ kleur: e.target.value })} onBlur={() => opslaan()} aria-label="Eigen kleur" style={{ padding: 0, border: '1px solid #DADDE3' }} />
              </div>
            </div>
            <div className="fm-veld">Ontwerp
              <label className={`fm-doekdrop${v.eigenschappen?.beeld ? ' met' : ''}${schrijven ? '' : ' uit'}`}
                onDragOver={(e) => { if (schrijven) { e.preventDefault(); e.currentTarget.classList.add('over'); } }} onDragLeave={(e) => e.currentTarget.classList.remove('over')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); if (schrijven) beeld(e.dataTransfer.files?.[0]); }}>
                {v.eigenschappen?.beeld ? <img src={publiekeUrl(v.eigenschappen.beeld)} alt={`Beeld van ${v.naam}`} /> : <span><b>{bezig ? 'Uploaden…' : 'Sleep het ontwerp hierheen'}</b><small>of klik om te kiezen · jpg, png of pdf</small></span>}
                {schrijven && <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; beeld(f); }} />}
              </label>
              {v.eigenschappen?.bestandsnaam && <span className="fm-sub" title={v.eigenschappen.bestandsnaam} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bezig ? 'Uploaden…' : v.eigenschappen.bestandsnaam}{/\.pdf$/i.test(v.eigenschappen.bestandsnaam) ? ' · eerste pagina als beeld' : ''}</span>}
              {schrijven && v.eigenschappen?.beeld && <button className="fm-knop klein gevaar" style={{ alignSelf: 'flex-start' }} onClick={() => zetE({ beeld: null, bestand: null, bestandsnaam: null })}>Ontwerp weghalen</button>}
            </div>
          </div>
          {schrijven && (
            <div className="fm-sectie" style={{ flexDirection: 'row', alignItems: 'center', borderBottom: 0 }}>
              {!v.id && <button className="fm-knop rood" disabled={bezig} onClick={toevoegen}>{totem ? 'Paneel toevoegen' : soort === 'vlag' ? 'Vlag toevoegen' : 'Doek toevoegen'}</button>}
              {v.id && <span className="fm-sub">{fout ? '' : status === 'Bewaren…' ? 'Bewaren…' : status ? '✓ Bewaard' : 'Wijzigingen worden meteen bewaard'}</span>}
              {v.id && <button className="fm-knop gevaar klein" style={{ marginLeft: 'auto' }} onClick={verwijder}>Verwijderen</button>}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}


// Overzicht van de bibliotheek: tegels of tabel, zoeken, controlelijst en meerdere tegelijk aanpassen.
const CONTROLES = [
  ['', 'Alles'],
  ['foto', 'Zonder foto', (e) => !e.eigenschappen?.fotos?.length],
  ['tekening', 'Zonder tekening', (e) => e.tekenwijze === 'schaal' && !e.eigenschappen?.tekening && !e.eigenschappen?.tekening_ref],
  ['maat', 'Zonder maat', (e) => (e.tekenwijze === 'schaal' && !(Number(e.breedte_m) > 0 && Number(e.diepte_m) > 0)) || (e.tekenwijze === 'lijn' && isHekNaam(e) && !(Number(e.eenheid_m) > 0))],
  ['leverancier', 'Zonder leverancier', (e) => !e.leverancier],
  ['tags', 'Zonder zoekwoorden', (e) => !(e.eigenschappen?.tags || []).length],
  ['omschrijving', 'Zonder omschrijving', (e) => !e.eigenschappen?.omschrijving],
  ['inactief', 'Niet actief', (e) => e.actief === false],
];
const isHekNaam = (e) => /hek|heras|nadar|barrier/i.test(e.naam || '');
const maatVan = (e) => (e.tekenwijze === 'lijn' ? (Number(e.eenheid_m) || 0) : (Number(e.breedte_m) || 0) * (Number(e.diepte_m) || 0));
// Bewaren zonder de opgezochte tekening (die komt uit tekening_ref).
const zuiverEig = (eig) => { const { tekening, ...r } = eig || {}; return eig?.tekening_ref ? r : eig; };

function Overzicht({ lijst, setLijst, cats, cat, setCat, gekozen, kies, schrijven, profiel, setMelding, setFout }) {
  const [zoek, setZoek] = useState('');
  const [controle, setControle] = useState('');
  const [weergave, setWeergave] = useState(() => { try { return localStorage.getItem('fm-bib-weergave2') || 'tabel'; } catch { return 'tabel'; } });
  // Familie als eerste filter; de categorieën eronder horen bij die familie.
  const famVan = useMemo(() => new Map(lijst.map((e) => [e.id, familieVanElement(e)])), [lijst]);
  // Filter op rubriek (= categorie, zoals bij de leveranciers); de soort bepaalt enkel het detailscherm.
  const rubVan = useMemo(() => new Map(lijst.map((e) => [e.id, rubriekVan(e.categorie)])), [lijst]);
  const [fam, setFamS] = useState(() => (cat ? rubriekVan(cat) : ''));
  const setFam = (f) => { setFamS(f); setCat(''); };
  const perFam = useMemo(() => { const m = new Map(); for (const e of lijst) { const f = rubVan.get(e.id); m.set(f, (m.get(f) || 0) + 1); } return m; }, [lijst, rubVan]);
  const famCats = cats.filter((c) => lijst.some((e) => e.categorie === c && (!fam || rubVan.get(e.id) === fam)));
  const [sorteer, setSorteer] = useState(['naam', 1]);
  const [sel, setSel] = useState(new Set());
  const [bulk, setBulk] = useState({ familie: '', categorie: '', subgroep: '', leverancier: '', tags: '', actief: '' });
  const [bezig, setBezig] = useState(false);
  const zetWeergave = (w) => { setWeergave(w); try { localStorage.setItem('fm-bib-weergave2', w); } catch {} };
  const ctl = CONTROLES.find((c) => c[0] === controle);
  const telControle = (k) => { const f = CONTROLES.find((c) => c[0] === k)?.[2]; return f ? lijst.filter((e) => (!fam || rubVan.get(e.id) === fam) && (!cat || e.categorie === cat) && f(e)).length : null; };
  let rijen = lijst.filter((e) => (!fam || rubVan.get(e.id) === fam) && (!cat || e.categorie === cat) && (!ctl?.[2] || ctl[2](e)));
  if (zoek.trim()) rijen = rijen.map((e) => [e, zoekScore(e, zoek)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).map(([e]) => e);
  else {
    const [k, r] = sorteer;
    const waarde = (e) => ({ naam: e.naam, familie: `${FAMILIE_NAAM[famVan.get(e.id)]} ${e.categorie}`, categorie: `${e.categorie} ${e.eigenschappen?.subgroep || ''}`, leverancier: e.leverancier || '~', maat: maatVan(e), tags: (e.eigenschappen?.tags || []).length, foto: (e.eigenschappen?.fotos || []).length, voorraad: Number(e.eigenschappen?.voorraad) || 0 }[k]);
    rijen = [...rijen].sort((a, b) => { const x = waarde(a); const y = waarde(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'nl', { numeric: true })) * r; });
  }
  const kiesbaar = rijen.filter((e) => !isCentraalElement(profiel, e));
  const allesGekozen = kiesbaar.length > 0 && kiesbaar.every((e) => sel.has(e.id));
  const wissel = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const kop = (k, t) => <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setSorteer(([a, r]) => [k, a === k ? -r : 1])}>{t}{sorteer[0] === k ? (sorteer[1] > 0 ? ' ▲' : ' ▼') : ''}</th>;

  const pasToe = async () => {
    const ids = [...sel]; if (!ids.length) return;
    const tags = bulk.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    setBezig(true); setFout('');
    const nieuw = new Map();
    try {
      for (const id of ids) {
        const e = lijst.find((x) => x.id === id); if (!e) continue;
        const eig = { ...(e.eigenschappen || {}) };
        if (bulk.subgroep.trim()) eig.subgroep = bulk.subgroep.trim() === '-' ? undefined : bulk.subgroep.trim();
        if (tags.length) eig.tags = [...new Set([...(eig.tags || []), ...tags])];
        const rij = { eigenschappen: zuiverEig(eig) };
        if (bulk.categorie.trim()) rij.categorie = bulk.categorie.trim();
        if (bulk.familie) rij.familie = bulk.familie === '-' ? null : bulk.familie;
        if (bulk.leverancier.trim()) rij.leverancier = bulk.leverancier.trim() === '-' ? null : bulk.leverancier.trim();
        if (bulk.actief) rij.actief = bulk.actief === 'ja';
        const r = await bibSchrijf().update(rij).eq('id', id).select().single();
        if (r.error) throw r.error;
        nieuw.set(id, { ...e, ...rij, eigenschappen: { ...eig } });
      }
      setLijst((l) => l.map((x) => nieuw.get(x.id) || x));
      setMelding(`${nieuw.size} element${nieuw.size === 1 ? '' : 'en'} aangepast.`);
      setBulk({ familie: '', categorie: '', subgroep: '', leverancier: '', tags: '', actief: '' });
    } catch (err) { setFout(foutTekst(err)); }
    finally { setBezig(false); }
  };

  return (
    <div style={{ flex: '999 1 520px', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
        <label className="fm-veld" style={{ flex: '1 1 220px', margin: 0 }}><span style={{ position: 'absolute', left: -9999 }}>Zoeken</span>
          <input type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek op naam, leverancier of zoekwoord…" />
        </label>
        <label className="fm-veld" style={{ margin: 0 }}>Controle
          <select value={controle} onChange={(e) => setControle(e.target.value)}>
            {CONTROLES.map(([k, t]) => <option key={k} value={k}>{t}{k ? ` (${telControle(k)})` : ''}</option>)}
          </select>
        </label>
        <div className="fm-segment" style={{ width: 'auto' }}>
          <button className={weergave === 'tegels' ? 'aan' : ''} onClick={() => zetWeergave('tegels')}>Tegels</button>
          <button className={weergave === 'tabel' ? 'aan' : ''} onClick={() => zetWeergave('tabel')}>Tabel</button>
        </div>
      </div>
      <div className="fm-famtabs fm-famtabs-breed" role="tablist" aria-label="Rubriek" style={{ marginBottom: 8 }}>
        <button type="button" role="tab" aria-selected={!fam} className={!fam ? 'aan' : ''} onClick={() => setFam('')}>Alles <span className="n">{lijst.length}</span></button>
        {rubriekSecties([...perFam.keys()]).flatMap(([, rs]) => rs).map((r) => <button key={r} type="button" role="tab" aria-selected={fam === r} className={fam === r ? 'aan' : ''} onClick={() => setFam(r)}>{rubriekNaam(r)} <span className="n">{perFam.get(r)}</span></button>)}
      </div>
      {fam && famCats.length > 1 && (
        <div className="fm-catchips" style={{ marginBottom: 12 }}>
          <button type="button" className={!cat ? 'aan' : ''} onClick={() => setCat('')}>Alle categorieën</button>
          {famCats.map((c) => <button key={c} type="button" className={cat === c ? 'aan' : ''} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
        </div>
      )}
      {schrijven && sel.size > 0 && (
        <div className="fm-bulk">
          <strong>{sel.size} gekozen</strong>
          <select value={bulk.familie} onChange={(e) => setBulk({ ...bulk, familie: e.target.value })} aria-label="Soort"><option value="">Soort: ongewijzigd</option>{FAMILIES.filter((f) => f.k !== 'vormen').map((f) => <option key={f.k} value={f.k}>{f.naam}</option>)}<option value="-">Automatisch (uit categorie)</option></select>
          <input placeholder="Categorie" list="fm-cats" value={bulk.categorie} onChange={(e) => setBulk({ ...bulk, categorie: e.target.value })} />
          <input placeholder="Subgroep (- = weg)" value={bulk.subgroep} onChange={(e) => setBulk({ ...bulk, subgroep: e.target.value })} />
          <input placeholder="Leverancier (- = weg)" value={bulk.leverancier} onChange={(e) => setBulk({ ...bulk, leverancier: e.target.value })} />
          <input placeholder="Zoekwoorden erbij (komma's)" value={bulk.tags} onChange={(e) => setBulk({ ...bulk, tags: e.target.value })} />
          <select value={bulk.actief} onChange={(e) => setBulk({ ...bulk, actief: e.target.value })}><option value="">Actief: ongewijzigd</option><option value="ja">Actief</option><option value="nee">Niet actief</option></select>
          <button className="fm-knop zwart" disabled={bezig} onClick={pasToe}>{bezig ? 'Bezig…' : 'Toepassen'}</button>
          <button className="fm-knop" onClick={() => setSel(new Set())}>Selectie wissen</button>
        </div>
      )}
      <div className="fm-sub" style={{ marginBottom: 8 }}>{rijen.length} element{rijen.length === 1 ? '' : 'en'}{schrijven ? ' · vink aan om er meerdere tegelijk aan te passen' : ''}</div>
      {weergave === 'tabel' ? (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e8e8e6' }}>
          <table className="fm-tabel fm-bibtabel">
            <thead><tr>
              {schrijven && <th><input type="checkbox" aria-label="Alles kiezen" checked={allesGekozen} onChange={() => setSel(allesGekozen ? new Set() : new Set(kiesbaar.map((e) => e.id)))} /></th>}
              <th aria-label="Voorbeeld" />{kop('naam', 'Naam')}{kop('familie', 'Soort')}{kop('categorie', 'Categorie · subgroep')}{kop('leverancier', 'Leverancier')}{kop('maat', 'Maat')}{kop('tags', 'Zoekwoorden')}{kop('foto', "Foto's")}{kop('voorraad', 'Ter plaatse')}
            </tr></thead>
            <tbody>
              {rijen.map((e) => (
                <tr key={e.id} className={gekozen === e.id ? 'aan' : ''} onClick={() => kies(e)} style={{ cursor: 'pointer' }}>
                  {schrijven && <td onClick={(x) => x.stopPropagation()}>{!isCentraalElement(profiel, e) && <input type="checkbox" aria-label={`${e.naam} kiezen`} checked={sel.has(e.id)} onChange={() => wissel(e.id)} />}</td>}
                  <td style={{ width: 36 }}><ElementIcoon el={e} maat={26} /></td>
                  <td><strong>{e.naam}</strong>{isCentraalElement(profiel, e) && <span className="fm-tag" style={{ marginLeft: 6 }} title="Uit de bibliotheek van Toolen">Toolen</span>}{e.eigenschappen?.familie && <div className="fm-sub">{e.eigenschappen.familie} · {e.eigenschappen.variant}</div>}{e.actief === false && <div className="fm-sub">niet actief</div>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{FAMILIE_NAAM[famVan.get(e.id)]}{!e.familie && <div className="fm-sub">automatisch</div>}</td>
                  <td>{e.categorie}{e.eigenschappen?.subgroep ? <div className="fm-sub">{e.eigenschappen.subgroep}</div> : null}</td>
                  <td>{e.leverancier || <span className="fm-sub">—</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{elementMaat(e).replace(/^(Tekening|Op schaal) · /, '')}</td>
                  <td title={(e.eigenschappen?.tags || []).join(', ')} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(e.eigenschappen?.tags || []).join(', ') || <span className="fm-sub">—</span>}</td>
                  <td className="getal">{(e.eigenschappen?.fotos || []).length || <span className="fm-sub">—</span>}</td>
                  <td className="getal">{e.eigenschappen?.voorraad ?? <span className="fm-sub">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {rijen.map((el) => (
            <div key={el.id} style={{ position: 'relative' }}>
              <button onClick={() => kies(el)} style={{ width: '100%', height: '100%', textAlign: 'left', background: '#fff', border: gekozen === el.id ? '2px solid #1d1d1b' : '1px solid #e8e8e6', padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ height: 90, background: '#FAFAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {el.eigenschappen?.fotos?.[0]
                    ? <img src={publiekeUrl(el.eigenschappen.fotos[0])} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ElementIcoon el={el} maat={60} />}
                </span>
                <strong style={{ fontSize: 14 }}>{el.naam}</strong>
                <span className="fm-sub">{elementMaat(el)}</span>
                <span className="fm-sub">{[FAMILIE_NAAM[famVan.get(el.id)], el.categorie, el.eigenschappen?.subgroep, el.leverancier, el.actief === false ? 'niet actief' : ''].filter(Boolean).join(' · ')}</span>
              </button>
              {schrijven && <input type="checkbox" aria-label={`${el.naam} kiezen`} checked={sel.has(el.id)} onChange={() => wissel(el.id)} style={{ position: 'absolute', top: 18, left: 18, width: 18, height: 18 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
