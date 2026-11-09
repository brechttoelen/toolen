'use client';

import { bevestig } from './dialoog';
import Info from './info';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BORDTYPES, EenBord, bordenPdf, PIJLCODE } from './bord';
import { sb, BUCKET, publiekeUrl, foutTekst } from './db';
import {
  PIJLEN, KANTEN, BEVESTIGING, SJABLOONKLEUREN, PijlSvg, isSign, instSign,
  pijlVoorstel, richtingUitRoutes, bestellijst, bestellijstCsv, volgendNr,
} from './signalisatie';
import { routeLijn, osrmManoeuvres, knikken, kandidatenVoorRoute, clusters, plannen, signStatus, routebeschrijving } from './signVoorstel';
import SignPuntDetail from './SignPuntDetail';
import * as turf from '@turf/turf';

const STATUS = { voorstel: ['V', '#2563EB', 'Voorstel van de tool'], aangepast: ['A', '#D97706', 'Voorstel, door jou aangepast'], eigen: ['E', '#686D76', 'Zelf gezet'] };

function Paneel({ b, pijl, klein, inst }) {
  return <EenBord best={b} pijl={pijl} type={inst?.bord || 'paneel'} logo={inst?.logo !== false} breedte={klein ? 150 : 200} />;
}


export default function SignalisatiePaneel({
  plan, items, schrijven, geselecteerd, zetModus, onZetModus, onPlan, onWijzigItem, onKiesItem, onPdf, onVoorstel, onRouteAanpassen = null, lagen, zonderDetail = false, modus = 'wegwijzers', onModus = null, verkeer = null,
}) {
  const inst = instSign(plan);
  const [nieuweBest, setNieuweBest] = useState(null);
  const bestMap = useMemo(() => new Map(inst.bestemmingen.map((b) => [b.id, b])), [inst.bestemmingen]);
  const lijnen = items.filter((i) => i.geometrie?.type === 'LineString' && !isSign(i) && i.velden?.stroom?.rol !== 'kabel');
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // Routelijn in rijrichting (vanaf het PPO-punt) per route.
  const routeCoords = (r) => routeLijn(itemMap.get(r.lijn_id), itemMap.get(r.ppo_id));
  const routeVan = (b) => { const r = inst.routes.find((x) => x.bestemming_id === b?.id); const c = r && routeCoords(r); return c ? { type: 'LineString', coordinates: c } : null; };
  const routes = inst.routes.map((r) => { const c = routeCoords(r); return c ? { type: 'LineString', coordinates: c } : null; }).filter(Boolean);
  const ppoKandidaten = items.filter((i) => i.geometrie?.type === 'Point' && !isSign(i));
  const [routeFilter, setRouteFilter] = useState('');
  const [voorstel, setVoorstel] = useState(null);
  const [beschrijving, setBeschrijving] = useState(null);
  const lagenVanSign = new Set(items.filter(isSign).map((i) => i.laag_id));
  const filterBest = routeFilter ? inst.routes.find((r) => r.id === routeFilter)?.bestemming_id : null;
  const punten = items.filter(isSign)
    .sort((a, b) => String(a.laag_id).localeCompare(String(b.laag_id)) || (Number(a.velden.sign.nr) || 0) - (Number(b.velden.sign.nr) || 0));
  const zichtbarePunten = filterBest ? punten.filter((p) => (p.velden.sign.rijen || []).some((r) => r.bestemming_id === filterBest)) : punten;
  const gek = items.find((i) => i.id === geselecteerd && isSign(i));
  const lijst = bestellijst(items, inst.bestemmingen, inst.reserve, inst.bord);
  const geprint = inst.bord !== 'paneel';
  const [routeOpen, setRouteOpen] = useState(null);
  const [kiezer, setKiezer] = useState(false);
  const [bestOpen, setBestOpen] = useState(() => !inst.bestemmingen.length);
  const [bezig, setBezig] = useState('');
  const stopRef = useRef(null);
  const [melding, setMelding] = useState('');
  const uploadBeeld = async (bestand) => {
    if (!bestand) return;
    setBezig('Afbeelding opladen…');
    try {
      const ext = (bestand.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const pad = `${plan.id}/sign/${Date.now()}.${ext}`;
      const { error } = await sb().storage.from(BUCKET).upload(pad, bestand, { contentType: bestand.type || 'image/png' });
      if (error) throw error;
      setNieuweBest((b) => ({ ...b, soort: 'beeld', beeld: publiekeUrl(pad), naam: b.naam || bestand.name.replace(/\.[^.]+$/, '') }));
    } catch (e) { setMelding(foutTekst(e)); }
    setBezig('');
  };
  const drukbestand = async () => {
    setMelding(''); setBezig('Borden maken…');
    try {
      const { doc, meldingen } = await bordenPdf({ plan, items, inst, isSign, formaat: inst.formaat, voortgang: setBezig });
      if (doc) doc.save(`Borden - ${plan.naam}.pdf`);
      if (meldingen.length) setMelding(meldingen.join(' '));
    } catch (e) { setMelding(e?.message || String(e)); }
    setBezig('');
  };

  const zetInst = (patch) => onPlan({ instellingen: { ...(plan.instellingen || {}), signalisatie: { ...inst, ...patch } } });
  const bewaarBest = () => {
    if (!nieuweBest?.naam?.trim()) return;
    const b = { ...nieuweBest, naam: nieuweBest.naam.trim(), id: nieuweBest.id || crypto.randomUUID() };
    zetInst({ bestemmingen: nieuweBest.id ? inst.bestemmingen.map((x) => (x.id === b.id ? b : x)) : [...inst.bestemmingen, b] });
    setNieuweBest(null);
  };
  const verwijderBest = async (b) => {
    const n = punten.filter((p) => (p.velden.sign.rijen || []).some((r) => r.bestemming_id === b.id)).length;
    if (!await bevestig(n ? `${b.naam} hangt op ${n} punten. Toch verwijderen? Die rijen verdwijnen ook.` : `${b.naam} verwijderen?`)) return;
    zetInst({ bestemmingen: inst.bestemmingen.filter((x) => x.id !== b.id) });
    for (const p of punten) {
      const rijen = (p.velden.sign.rijen || []).filter((r) => r.bestemming_id !== b.id);
      if (rijen.length !== (p.velden.sign.rijen || []).length) onWijzigItem(p.id, { velden: { ...p.velden, sign: { ...p.velden.sign, rijen } } });
    }
  };

  const zetSign = (p, patch) => onWijzigItem(p.id, { velden: { ...p.velden, sign: { ...p.velden.sign, ...patch } } });
  const zetRij = (p, i, patch) => zetSign(p, { rijen: p.velden.sign.rijen.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const verschuifRij = (p, i, d) => {
    const r = [...p.velden.sign.rijen]; const j = i + d;
    if (j < 0 || j >= r.length) return;
    [r[i], r[j]] = [r[j], r[i]];
    zetSign(p, { rijen: r });
  };
  const nummerOpnieuw = () => {
    // Per laag, in volgorde langs de routes (vanaf het PPO-punt); punten naast een route achteraan.
    const lijnen2 = inst.routes.map(routeCoords).map((c) => (c ? turf.lineString(c) : null));
    const sleutel = (p) => {
      for (let i = 0; i < lijnen2.length; i++) {
        if (!lijnen2[i]) continue;
        const n = turf.nearestPointOnLine(lijnen2[i], turf.point(p.geometrie.coordinates), { units: 'meters' });
        if (n.properties.dist < 60) return [i, n.properties.location];
      }
      return [999, Number(p.velden.sign.nr) || 0];
    };
    const perLaag = new Map();
    for (const p of punten) { if (!perLaag.has(p.laag_id)) perLaag.set(p.laag_id, []); perLaag.get(p.laag_id).push([sleutel(p), p]); }
    for (const lijst2 of perLaag.values()) {
      lijst2.sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1]);
      lijst2.forEach(([, p], i) => { if (Number(p.velden.sign.nr) !== i + 1) zetSign(p, { nr: i + 1 }); });
    }
  };

  // Altijd genummerd van het begin van de route naar het einde: komt er een punt
  // tussen, wordt er een verwijderd of verschoven, dan schuift de nummering mee.
  const nummerSleutel = schrijven ? JSON.stringify([
    punten.map((p) => [p.id, p.laag_id, ...(p.geometrie?.coordinates || []).map((v) => Math.round(v * 1e5))]),
    inst.routes.map((r) => [r.lijn_id, r.ppo_id, (itemMap.get(r.lijn_id)?.geometrie?.coordinates || []).length]),
  ]) : '';
  const laatsteNummer = useRef(null); laatsteNummer.current = nummerOpnieuw;
  useEffect(() => {
    if (!nummerSleutel) return undefined;
    const t = setTimeout(() => laatsteNummer.current(), 700);
    return () => clearTimeout(t);
  }, [nummerSleutel]);

  // ---------- Routes ----------
  const zetRoutes = (lijst2) => zetInst({ routes: lijst2, bestemmingen: inst.bestemmingen.map(({ route_id, ...b }) => b) });
  const zetRoute = (id, patch) => { setVoorstel(null); zetRoutes(inst.routes.map((r) => (r.id === id ? { ...r, ...patch } : r))); };

  // ---------- Voorstel berekenen ----------
  const bereken = async () => {
    setMelding(''); setVoorstel(null);
    const rs = []; const kand = []; const info = {};
    const stop = { gestopt: false }; stopRef.current = stop;
    const t0 = Date.now();
    // De teller loopt elke seconde door, ook als één vraag lang duurt: je ziet dat hij bezig is.
    let laatste = [0]; let tik = null;
    const klok = setInterval(() => tik?.(), 1000);
    try {
      for (const [i, r] of inst.routes.entries()) {
        const lijn = itemMap.get(r.lijn_id);
        const coords = routeCoords(r);
        if (!coords || !r.bestemming_id) { info[r.id] = { fout: !coords ? 'geen lijn' : 'geen bestemming' }; continue; }
        const naam = bestMap.get(r.bestemming_id)?.naam || `route ${i + 1}`;
        const toon = (f = 0, wijze) => { laatste = [f, wijze]; setBezig(`Route ${i + 1}/${inst.routes.length} · ${naam} · ${Math.round(((i + f) / inst.routes.length) * 100)}%${wijze === 'precies' ? ' · precieze methode (trager)' : ''} · ${Math.round((Date.now() - t0) / 1000)} s`); };
        tik = () => toon(...laatste);
        toon(0);
        let res;
        try { res = await osrmManoeuvres(coords, { voortgang: toon, stop }); } catch (e) { if (stop.gestopt) throw e; res = knikken(coords); }
        const route = { ...r, laag_id: lijn.laag_id, coords };
        rs.push(route);
        info[r.id] = { res };
        kand.push(...kandidatenVoorRoute(route, coords, res));
      }
      const groepen = clusters(kand, rs);
      setVoorstel({ acties: plannen(groepen, items, inst.auto_ankers), info, groepen });
    } catch (e) { setMelding(stop.gestopt ? 'Voorstel gestopt.' : e?.message || String(e)); }
    clearInterval(klok);
    stopRef.current = null;
    setBezig('');
  };
  const pasVoorstelToe = () => {
    const a = voorstel.acties;
    const wijzig = [...a.bijwerken, ...a.leeg].map((b) => ({ id: b.id, patch: { ...(b.geometrie ? { geometrie: b.geometrie } : {}), velden: { ...(itemMap.get(b.id)?.velden || {}), sign: b.sign } } }));
    const teller = new Map();
    const nieuw = [...a.nieuw].sort((x, y) => x.groep.volg[0] - y.groep.volg[0] || x.groep.volg[1] - y.groep.volg[1]).map(({ groep: g, auto }) => {
      const nr = (teller.get(g.laag_id) ?? volgendNr(items, g.laag_id) - 1) + 1;
      teller.set(g.laag_id, nr);
      return { laag_id: g.laag_id, geometrie: { type: 'Point', coordinates: g.plek }, naam: `Signalisatie ${nr}`,
        velden: { sign: { nr, richting: g.richting, rijen: g.rijen, kant: 'rechts', bevestiging: 'heras', auto } } };
    });
    onVoorstel({ nieuw, wijzig, weg: a.vervalt });
    // Onthoud welke kruispunten voorgesteld zijn: wat je daarna verwijdert, komt niet terug.
    zetInst({ auto_ankers: a.ankers });
    setVoorstel(null);
  };
  const toonBeschrijving = async (r) => {
    const coords = routeCoords(r);
    if (!coords) return;
    setBeschrijving({ id: r.id, regels: null });
    try {
      const res = voorstel?.info?.[r.id]?.res || await osrmManoeuvres(coords);
      setBeschrijving({ id: r.id, regels: routebeschrijving(res, bestMap.get(r.bestemming_id)?.naam) });
    } catch { setBeschrijving({ id: r.id, regels: [], fout: true }); }
  };
  const csv = () => {
    const blob = new Blob(['﻿' + bestellijstCsv(lijst, inst.reserve)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Signalisatie bestellijst - ${plan.naam}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const aantalPanelen = lijst.panelen.reduce((t, x) => t + x.stuks, 0);
  const lengteKm = (r) => { const c = routeCoords(r); return c ? turf.length(turf.lineString(c)) : null; };
  const autoAanwezig = punten.some((p) => p.velden.sign.auto);
  const kop = (nr, titel, extra) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 18, height: 18, background: '#1d1d1b', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{nr}</span>
      <span className="fm-kop" style={{ flex: 1 }}>{titel}</span>
      {extra}
    </div>
  );
  if (modus === 'verkeer') {
    const kop = onModus ? <div className="fm-sectie"><ModusKeuze modus={modus} onModus={onModus} /></div> : null;
    // Het verkeerspaneel komt uit de editor (die kent de gereedschappen en de export).
    return verkeer ? verkeer(kop) : <div>{kop}<div className="fm-sectie"><div className="fm-leeglijst"><strong>Verkeerssignalisatie</strong>Open de werkruimte Signalisatie (Alt 2) en kies Verkeer.</div></div></div>;
  }
  return (
    <div>
      {onModus && <div className="fm-sectie"><ModusKeuze modus={modus} onModus={onModus} /></div>}
      <div className="fm-sectie" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <span className="fm-sub" style={{ flex: 1 }}>{[[inst.bestemmingen.length, 'bord', 'borden'], [punten.length, 'punt', 'punten'], [aantalPanelen, 'paneel', 'panelen']].map(([n, e, m]) => `${n} ${n === 1 ? e : m}`).join(' · ')}</span>
        <Info>1. Kies de borden. 2. Koppel elke route aan een bord en laat de punten voorstellen, of zet ze zelf. 3. Bestel en druk af.</Info>
      </div>

      {/* 1. Borden */}
      <div className="fm-sectie">
        {kop(1, `Borden · ${inst.bestemmingen.length}`, inst.bestemmingen.length > 0 && <button className="fm-knop klein" onClick={() => setBestOpen(!bestOpen)}>{bestOpen || nieuweBest ? 'Inklappen' : 'Tonen'}</button>)}
        {(bestOpen || nieuweBest || !inst.bestemmingen.length) && inst.bestemmingen.map((b) => (
          <div key={b.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}><Paneel b={b} pijl={geprint ? 'rechtdoor' : 'geen'} klein inst={inst} /></div>
            {schrijven && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {b.soort !== 'set' && <button className="fm-knop klein" onClick={() => setNieuweBest({ ...b })}>Wijzig</button>}
                <button className="fm-knop klein gevaar" aria-label={`${b.naam} verwijderen`} onClick={() => verwijderBest(b)}>×</button>
              </div>
            )}
          </div>
        ))}
        {schrijven && !nieuweBest && (
          <div className="fm-raster2">
            <button className="fm-knop klein zwart" onClick={() => setKiezer(true)}>Uit bibliotheek</button>
            <button className="fm-knop klein" onClick={() => { setBestOpen(true); setNieuweBest({ soort: 'sjabloon', naam: '', boventitel: '', kleur: '#FACC15', tekstkleur: '#1d1d1b' }); }}>Eigen bord</button>
          </div>
        )}
        {kiezer && <BordenKiezer al={new Set(inst.bestemmingen.filter((b) => b.set_id).map((b) => b.set_id))} onSluit={() => setKiezer(false)}
          onToevoegen={(lijst2) => { zetInst({ bestemmingen: [...inst.bestemmingen, ...lijst2.map((b) => ({ id: crypto.randomUUID(), soort: 'set', set_id: b.id, naam: b.naam, groep: b.groep, beeld: b.beeld, b_mm: b.b_mm, h_mm: b.h_mm, zone: b.zone, bron: b.bron }))] }); setKiezer(false); setBestOpen(true); }} />}
        {nieuweBest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid #e8e8e6' }}>
            <div className="fm-segment">
              {[['sjabloon', 'Tekst'], ['beeld', 'Afbeelding']].map(([k, t]) => <button key={k} style={{ flex: 1 }} className={(nieuweBest.soort || 'sjabloon') === k ? 'aan' : ''} onClick={() => setNieuweBest({ ...nieuweBest, soort: k })}>{t}</button>)}
            </div>
            <label className="fm-veld">{nieuweBest.soort === 'beeld' ? 'Naam' : 'Tekst'}<input value={nieuweBest.naam} onChange={(e) => setNieuweBest({ ...nieuweBest, naam: e.target.value })} placeholder={nieuweBest.soort === 'beeld' ? 'Superprestige' : 'Fan zone, 01, …'} autoFocus /></label>
            {nieuweBest.soort === 'beeld' ? (
              <>
                <label className="fm-veld">Link naar de afbeelding<input value={nieuweBest.beeld || ''} onChange={(e) => setNieuweBest({ ...nieuweBest, beeld: e.target.value.trim() })} placeholder="https://…/logo.png" /></label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label className="fm-knop klein" style={{ cursor: 'pointer' }}>{bezig || 'of opladen'}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={(e) => uploadBeeld(e.target.files?.[0])} /></label>
                  <Info>Opladen werkt altijd in de PDF; een link alleen als die website het toelaat.</Info>
                </div>
              </>
            ) : (
              <>
                <label className="fm-veld">Boventitel (optioneel)<input value={nieuweBest.boventitel || ''} onChange={(e) => setNieuweBest({ ...nieuweBest, boventitel: e.target.value })} placeholder="PARKING" /></label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {SJABLOONKLEUREN.map(([k, t]) => (
                    <button key={k} aria-label={`Kleur ${k}`} onClick={() => setNieuweBest({ ...nieuweBest, kleur: k, tekstkleur: t })}
                      style={{ width: 26, height: 26, background: k, color: t, border: nieuweBest.kleur === k ? '2px solid #E11D48' : '1px solid #1d1d1b', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>A</button>
                  ))}
                </div>
              </>
            )}
            <EenBord best={nieuweBest} pijl={geprint ? 'rechts' : 'geen'} type={inst.bord} logo={inst.logo} breedte={200} />
            <div className="fm-raster2">
              <button className="fm-knop klein zwart" disabled={!nieuweBest.naam?.trim()} onClick={bewaarBest}>Bewaren</button>
              <button className="fm-knop klein" onClick={() => setNieuweBest(null)}>Annuleren</button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Routes */}
      <div className="fm-sectie">
        {kop(2, `Routes · ${inst.routes.length}`, <Info>Teken per parking de route met &quot;Route langs de weg&quot; (profiel auto), en koppel ze hier aan haar bord en PPO-punt. De tool zet dan een bord waar je echt afslaat, niet bij elke straatnaam. Routes die samen lopen, hangen samen op één punt.</Info>)}
        {inst.routes.map((r, i) => {
          const b = bestMap.get(r.bestemming_id);
          const open = routeOpen === r.id || (!r.lijn_id || !r.bestemming_id);
          const fout = voorstel?.info?.[r.id]?.fout;
          const terugval = voorstel?.info?.[r.id]?.res?.terugval;
          const km = lengteKm(r);
          return (
            <div key={r.id} style={{ border: '1px solid #e8e8e6', background: '#fff' }}>
              <button onClick={() => setRouteOpen(routeOpen === r.id ? null : r.id)} style={{ display: 'flex', width: '100%', gap: 6, alignItems: 'center', padding: '5px 6px', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 10, height: 10, background: b?.kleur || '#686D76', flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b ? `${b.boventitel ? `${b.boventitel} ` : ''}${b.naam}` : `Route ${i + 1}`}</span>
                {km != null && <span className="fm-sub">{km.toFixed(1).replace('.', ',')} km</span>}
                {(fout || terugval) && <span style={{ color: '#B45309', fontSize: 12 }} title={fout ? `Niet berekend: ${fout}` : 'Zonder routeplanner berekend: controleren'}>!</span>}
                <span aria-hidden="true" style={{ color: '#686D76' }}>{open ? '–' : '+'}</span>
              </button>
              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 6px 6px' }}>
                  <label className="fm-veld">Bord
                    <select value={r.bestemming_id || ''} disabled={!schrijven} onChange={(e) => zetRoute(r.id, { bestemming_id: e.target.value || null })}>
                      <option value="">Kies…</option>
                      {inst.bestemmingen.map((x) => <option key={x.id} value={x.id}>{x.boventitel ? `${x.boventitel} ` : ''}{x.naam}{x.soort === 'set' ? ` · ${x.groep}` : ''}</option>)}
                    </select>
                  </label>
                  <label className="fm-veld">Lijn op de kaart
                    <select value={r.lijn_id || ''} disabled={!schrijven} onChange={(e) => zetRoute(r.id, { lijn_id: e.target.value || null })}>
                      <option value="">Kies…</option>
                      {lijnen.map((l) => <option key={l.id} value={l.id}>{l.naam || 'Lijn zonder naam'}</option>)}
                    </select>
                  </label>
                  <label className="fm-veld">PPO-punt
                    <select value={r.ppo_id || ''} disabled={!schrijven} onChange={(e) => zetRoute(r.id, { ppo_id: e.target.value || null })}>
                      <option value="">Begin van de lijn</option>
                      {ppoKandidaten.map((p) => <option key={p.id} value={p.id}>{p.naam || p.velden?.nr || 'Punt zonder naam'}</option>)}
                    </select>
                  </label>
                  {fout && <div className="fm-sub" style={{ color: '#B91C1C' }}>Niet berekend: {fout}.</div>}
                  {terugval && <div className="fm-sub" style={{ color: '#8A4D00' }}>Routeplanner onbereikbaar: punten uit de knikken in de lijn, controleren.</div>}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="fm-knop klein" style={{ flex: 1 }} disabled={!r.lijn_id} onClick={() => onKiesItem(r.lijn_id)}>Op kaart</button>
                    {schrijven && onRouteAanpassen && <button className="fm-knop klein" style={{ flex: 1 }} disabled={!r.lijn_id} title="Sleep de punten of op de lijn; de route volgt de weg" onClick={() => onRouteAanpassen(r.lijn_id)}>Aanpassen</button>}
                    <button className="fm-knop klein" style={{ flex: 1 }} disabled={!r.lijn_id} onClick={() => (beschrijving?.id === r.id ? setBeschrijving(null) : toonBeschrijving(r))}>Beschrijving</button>
                    {schrijven && <button className="fm-knop klein gevaar" aria-label="Route verwijderen" onClick={() => { setVoorstel(null); if (routeFilter === r.id) setRouteFilter(''); zetRoutes(inst.routes.filter((x) => x.id !== r.id)); }}>×</button>}
                  </div>
                  {beschrijving?.id === r.id && (
                    <div style={{ fontSize: 12, background: '#FAFAFB', padding: 6 }}>
                      {!beschrijving.regels ? <span className="fm-sub">Ophalen…</span>
                        : beschrijving.fout || !beschrijving.regels.length ? <span className="fm-sub">Geen beschrijving: routeplanner onbereikbaar.</span>
                          : (<>
                            <ol style={{ margin: 0, paddingLeft: 18 }}>{beschrijving.regels.map((t, j) => <li key={j}>{t}</li>)}</ol>
                            <button className="fm-knop klein" style={{ marginTop: 4 }} onClick={() => navigator.clipboard?.writeText(beschrijving.regels.join('\n'))}>Kopiëren</button>
                          </>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {schrijven && (
          <>
            <button className="fm-knop klein" onClick={() => { const id = crypto.randomUUID(); setRouteOpen(id); zetRoutes([...inst.routes, { id, lijn_id: null, ppo_id: inst.routes[inst.routes.length - 1]?.ppo_id || null, bestemming_id: null }]); }}>+ Route</button>
            {inst.routes.length > 0 && (<>
              <button className="fm-knop zwart vol" disabled={!inst.routes.some((r) => r.lijn_id && r.bestemming_id) || !!bezig} onClick={bereken}>{bezig || (autoAanwezig ? 'Voorstel bijwerken' : 'Bordpunten voorstellen')}</button>
              {bezig && stopRef.current && <button className="fm-knop klein vol" onClick={() => { if (stopRef.current) stopRef.current.gestopt = true; }}>Stoppen</button>}
            </>)}
          </>
        )}
        {voorstel && (() => {
          const a = voorstel.acties;
          const niets = !a.nieuw.length && !a.bijwerken.length && !a.vervalt.length && !a.leeg.length;
          const contr = a.nieuw.filter((n) => n.groep.controleren).length;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '2px solid #1d1d1b', background: '#fff' }}>
              {niets ? <div className="fm-sub">Alles staat al goed.</div> : (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                  {a.nieuw.length > 0 && <li>{a.nieuw.length} nieuwe punten, {a.nieuw.reduce((t, n) => t + n.groep.rijen.length, 0)} panelen{contr ? ` (${contr} controleren)` : ''}</li>}
                  {a.bijwerken.length > 0 && <li>{a.bijwerken.length} punten bijgewerkt</li>}
                  {a.vervalt.length > 0 && <li>{a.vervalt.length} punten vervallen</li>}
                  {a.leeg.length > 0 && <li style={{ color: '#B91C1C' }}>{a.leeg.length} aangepaste punten worden leeg</li>}
                </ul>
              )}
              {a.genegeerd > 0 && (
                <div className="fm-sub">{a.genegeerd} eerder verwijderde punten blijven weg.{' '}
                  <button className="fm-knop klein" onClick={() => setVoorstel({ ...voorstel, acties: plannen(voorstel.groepen, items, []) })}>Terugzetten</button>
                </div>
              )}
              <div className="fm-raster2">
                {!niets && <button className="fm-knop klein rood" onClick={pasVoorstelToe}>Toepassen</button>}
                <button className="fm-knop klein" onClick={() => setVoorstel(null)}>{niets ? 'Sluiten' : 'Annuleren'}</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. Bordposities */}
      <div className="fm-sectie">
        {kop(3, `Punten · ${filterBest ? `${zichtbarePunten.length}/${punten.length}` : punten.length}`, <Info>V = voorstel van de tool, A = voorstel dat je aanpaste (blijft bij bijwerken), E = zelf gezet. Nummers lopen per laag.</Info>)}
        {schrijven && <button className={`fm-knop klein${zetModus ? ' rood' : ''}`} onClick={() => onZetModus(!zetModus)}>{zetModus ? 'Klaar met plaatsen' : 'Zelf punten zetten'}</button>}
        {zetModus && <div className="fm-sub" style={{ color: '#8A4D00' }}>Klik op de kaart.</div>}
        {inst.routes.length > 1 && punten.length > 0 && (
          <select aria-label="Filter op route" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} style={{ height: 26, fontSize: 12 }}>
            <option value="">Alle routes</option>
            {inst.routes.map((r, i) => <option key={r.id} value={r.id}>{[bestMap.get(r.bestemming_id)?.boventitel, bestMap.get(r.bestemming_id)?.naam].filter(Boolean).join(' ') || `Route ${i + 1}`}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {zichtbarePunten.map((p, idx) => {
            const s = p.velden.sign;
            const open = p.id === geselecteerd;
            const [letter, kleur, uitleg] = STATUS[signStatus(p)];
            const laagKop = lagenVanSign.size > 1 && (idx === 0 || zichtbarePunten[idx - 1].laag_id !== p.laag_id);
            return (
              <div key={p.id}>
                {laagKop && <div className="fm-lijstkop" style={{ padding: '6px 0 2px' }}>{lagen?.find((l) => l.id === p.laag_id)?.naam || 'Zonder laag'}</div>}
                <button onClick={() => onKiesItem(p.id)} style={{ display: 'flex', width: '100%', gap: 6, alignItems: 'center', padding: '4px 6px', border: open ? '2px solid #1d1d1b' : `1px solid ${s.auto?.leeg ? '#B91C1C' : '#e8e8e6'}`, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ minWidth: 22, height: 20, padding: '0 3px', background: '#E11D48', color: '#fff', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.nr}</span>
                  <span style={{ flex: 1, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.straat || p.naam || 'Bordpositie'}</span>
                  {s.auto?.controleren && <span style={{ color: '#B45309', fontSize: 12 }} title="Niet uit de routeplanner: controleren">!</span>}
                  {s.auto?.leeg && <span className="fm-sub" style={{ color: '#B91C1C' }}>leeg</span>}
                  <span className="fm-sub">{(s.rijen || []).length}×</span>
                  <span title={uitleg} style={{ width: 15, height: 15, fontSize: 9, fontWeight: 700, color: '#fff', background: kleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{letter}</span>
                </button>
              </div>
            );
          })}
        </div>
        {schrijven && punten.length > 1 && <button className="fm-knop klein" onClick={nummerOpnieuw} title="Per laag, in de volgorde van de routes">Opnieuw nummeren</button>}
      </div>

      {gek && !zonderDetail && <SignPuntDetail plan={plan} items={items} punt={gek} schrijven={schrijven} onWijzigItem={onWijzigItem} />}

      {/* 4. Bestellen en afdrukken */}
      <div className="fm-sectie">
        {kop(4, 'Bestellen en afdrukken')}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div className="fm-segment" style={{ flex: 1 }}>
            {BORDTYPES.map(([k, t]) => <button key={k} style={{ flex: 1 }} className={inst.bord === k ? 'aan' : ''} disabled={!schrijven} onClick={() => zetInst({ bord: k })}>{t}</button>)}
          </div>
          <Info>{BORDTYPES.map(([, t, u]) => `${t}: ${u}`).join(' ')}</Info>
        </div>
        {geprint && <label className="fm-vink"><input type="checkbox" checked={inst.logo} disabled={!schrijven} onChange={(e) => zetInst({ logo: e.target.checked })} />Logo van de organisatie op het bord</label>}
        <details className="fm-meer"><summary>Bestellijst · {aantalPanelen} panelen</summary>
          <label className="fm-sub" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>Reserve
            <select value={inst.reserve} disabled={!schrijven} onChange={(e) => zetInst({ reserve: Number(e.target.value) })} style={{ height: 24 }}>
              {[0, 0.05, 0.1, 0.15, 0.2].map((r) => <option key={r} value={r}>{Math.round(r * 100)} %</option>)}
            </select>
          </label>
          {lijst.panelen.map((p) => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12 }}><span style={{ minWidth: 0 }}>{p.naam}</span><span style={{ whiteSpace: 'nowrap' }}>{p.stuks} → {Math.ceil(p.stuks * (1 + inst.reserve))}</span></div>)}
          {lijst.pijlen > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}><span>Pijlstickers</span><span>{lijst.pijlen} → {lijst.pijlenBesteld}</span></div>}
          {lijst.ubocht > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>U-bochtpijlen</span><span>{lijst.ubocht} → {lijst.ubochtBesteld}</span></div>}
          {lijst.bevestiging.map((b) => <div key={b.soort} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{b.soort}</span><span>{b.n}</span></div>)}
        </details>
        <div className="fm-raster2">
          <button className="fm-knop klein" disabled={!lijst.punten} onClick={csv}>Bestellijst CSV</button>
          <button className="fm-knop klein" disabled={!lijst.punten} onClick={onPdf}>Plan-PDF</button>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="fm-knop klein rood" style={{ flex: 1 }} disabled={!inst.bestemmingen.length || !!bezig} onClick={drukbestand}>{bezig && bezig !== 'Afbeelding opladen…' ? bezig : 'Drukbestand borden'}</button>
          <select aria-label="Papierformaat" value={inst.formaat} disabled={!schrijven} onChange={(e) => zetInst({ formaat: e.target.value })} style={{ height: 24 }}>
            {['A4', 'A3', 'A2', 'A1'].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <Info>Eén bord per blad, met het aantal te drukken (incl. reserve) en de punten in de rand. Zonder punten komt elk bord één keer.</Info>
        </div>
        {melding && <div className="fm-melding info" style={{ fontSize: 11.5 }}>{melding}</div>}
      </div>
    </div>
  );
}

// Wegwijzers (parkings, bestemmingen) of verkeerssignalisatie (C3, E1, omleidingen): twee modi naast elkaar.
function ModusKeuze({ modus, onModus }) {
  return (
    <div className="fm-segment" role="tablist" aria-label="Soort signalisatie">
      {[['wegwijzers', 'Wegwijzers'], ['verkeer', 'Verkeer']].map(([k, t]) => <button key={k} role="tab" aria-selected={modus === k} style={{ flex: 1 }} className={modus === k ? 'aan' : ''} onClick={() => onModus(k)}>{t}</button>)}
    </div>
  );
}

// Kiezen uit de bordenbibliotheek (alle bestaande FLCS-borden).
function BordenKiezer({ al, onToevoegen, onSluit }) {
  const [set, setSet] = useState(null);
  const [groep, setGroep] = useState('');
  const [zoek, setZoek] = useState('');
  const [gekozen, setGekozen] = useState([]);
  useEffect(() => { import('./bordenset').then((m) => setSet(m)); }, []);
  if (!set) return null;
  const q = zoek.trim().toLowerCase();
  const lijst = set.BORDENSET.filter((b) => (!groep || b.groep === groep) && (!q || b.naam.toLowerCase().includes(q) || b.groep.toLowerCase().includes(q)));
  const wissel = (b) => setGekozen((g) => (g.some((x) => x.id === b.id) ? g.filter((x) => x.id !== b.id) : [...g, b]));
  return (
    <div className="fm-dialoog-achter" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <section className="fm-dialoog fm fm-bordkiezer" role="dialog" aria-label="Bordenbibliotheek">
        <header><h2>Bordenbibliotheek</h2><button className="fm-knop" onClick={onSluit}>Sluiten</button></header>
        <div className="fm-bordkiezer-filter">
          <input autoFocus value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek, bv. parking 12, toilets, VIP" aria-label="Zoek een bord" />
          <select value={groep} onChange={(e) => setGroep(e.target.value)} aria-label="Soort">
            <option value="">Alle soorten ({set.BORDENSET.length})</option>
            {set.BORDGROEPEN.map((g) => <option key={g} value={g}>{g} ({set.BORDENSET.filter((b) => b.groep === g).length})</option>)}
          </select>
        </div>
        <div className="fm-bordkiezer-raster">
          {lijst.map((b) => {
            const aan = gekozen.some((x) => x.id === b.id);
            return (
              <button key={b.id} className={`${aan ? 'aan' : ''}${al.has(b.id) ? ' al' : ''}`} onClick={() => wissel(b)} title={`${b.naam} · ${b.b_mm}×${b.h_mm} mm · ${b.bron}`}>
                <span className="beeld"><img src={b.beeld} alt="" loading="lazy" /></span>
                <span className="naam">{b.naam}</span>
                <span className="fm-sub">{b.b_mm / 10}×{b.h_mm / 10} cm{b.zone ? ' · pijlvak' : ''}{al.has(b.id) ? ' · al in plan' : ''}</span>
              </button>
            );
          })}
          {!lijst.length && <div className="fm-sub">Niets gevonden.</div>}
        </div>
        <footer className="fm-bordkiezer-voet">
          <span className="fm-sub">{gekozen.length ? `${gekozen.length} gekozen` : 'Klik op de borden die je in dit plan nodig hebt.'}</span>
          <button className="fm-knop rood" disabled={!gekozen.length} onClick={() => onToevoegen(gekozen.filter((b) => !al.has(b.id)))}>Toevoegen aan het plan</button>
        </footer>
      </section>
    </div>
  );
}
