'use client';

// Overzicht, Notities en Info van de fiche.
import { useEffect, useState } from 'react';
import { opId, euro } from './data';
import { Bewaarveld, Chips } from './gedeeld';
import { dagNaam, canoniek, sleutel, fase, FASE_NAAM, wedstrijd, datumTekst, vanDatum } from './dagen';
import { STATUS_LEV, somVan } from './TabLeveranciers';
import { waarTekst, wieTekst } from './TabPlanning';
import { maps, foutTekst } from '../maps/db';
import { bevestig } from '../maps/dialoog';

export { ALLE_TABS } from './tabs';
import { ALLE_TABS } from './tabs';

export function TabOverzicht({ f, naar }) {
  const { plan } = f;
  const taken = opId(f.d.taken);
  const dagen = (f.d.taak_dagen || []).filter((d) => taken.has(d.taak_id));
  const perFase = { opbouw: [0, 0], wedstrijd: [0, 0], afbraak: [0, 0] };
  for (const d of dagen) { const x = perFase[fase(plan, d.anker, d.dag)]; x[0]++; if (d.status !== 'klaar') x[1]++; }
  const voorb = (f.d.taken || []).filter((t) => t.voorbereiding);
  const sl = f.d.site_leveranciers || [];
  const lev = opId(f.d.leveranciers);
  const perStatus = STATUS_LEV.map(([k, n]) => [n, sl.filter((x) => x.status === k).length]).filter((x) => x[1]);
  const notOpen = (f.d.notities || []).filter((n) => !n.klaar);

  const aandacht = [];
  const zonderWie = dagen.filter((d) => d.status !== 'klaar' && !wieTekst(taken.get(d.taak_id), d, f));
  if (zonderWie.length) aandacht.push({ t: `${zonderWie.length} taakdagen zonder uitvoerder`, tab: 'planning' });
  const verloren = (f.d.taken || []).filter((t) => waarTekst(t, f).verloren);
  if (verloren.length) aandacht.push({ t: `${verloren.length} taken verloren hun plek op de kaart`, sub: verloren.slice(0, 3).map((t) => t.titel).join(', '), tab: 'planning' });
  const zonderOph = sl.filter((x) => { const lv = (f.d.leveringen || []).filter((l) => l.site_leverancier_id === x.id); return lv.some((l) => l.soort === 'levering') && !lv.some((l) => l.soort === 'ophaling'); });
  if (zonderOph.length) aandacht.push({ t: `${zonderOph.length} leveranciers leveren maar hebben geen ophaling`, sub: zonderOph.slice(0, 4).map((x) => lev.get(x.leverancier_id)?.naam).join(', '), tab: 'leveranciers' });
  const zonderPunt = (f.d.leveringen || []).filter((l) => !l.leverpunt_item_id && !l.leverpunt_tekst && !(f.d.bestelregels || []).some((r) => (r.levering_id === l.id || r.ophaling_id === l.id) && (r.locatie_laag_id || r.locatie_tekst)));
  if (zonderPunt.length) aandacht.push({ t: `${zonderPunt.length} leveringen zonder leverpunt`, tab: 'leveranciers' });
  if (f.financieel) {
    const afwijk = sl.filter((x) => { const o = (f.d.offertes || []).filter((y) => y.site_leverancier_id === x.id && y.status !== 'afgewezen'); const fa = (f.d.facturen || []).filter((y) => y.site_leverancier_id === x.id); return o.length && fa.length && somVan(fa) - somVan(o) > 0.009; });
    if (afwijk.length) aandacht.push({ t: `${afwijk.length} facturen hoger dan de offerte`, sub: afwijk.map((x) => lev.get(x.leverancier_id)?.naam).join(', '), tab: 'budget', fout: true });
  }
  const catZonder = (f.d.cateringregels || []).filter((r) => !r.leverancier_id && !r.rechtstreeks);
  if (catZonder.length) aandacht.push({ t: `${catZonder.length} cateringregels zonder leverancier`, tab: 'catering' });
  if (!wedstrijd(plan)) aandacht.push({ t: 'Wedstrijddag nog niet ingesteld', tab: 'info', fout: true });

  // Eerstvolgende dagen met taken
  const vandaag = new Date(); vandaag.setHours(12, 0, 0, 0);
  const komend = wedstrijd(plan) ? (() => {
    const nu = vanDatum(plan, vandaag); const k = new Map();
    for (const d of dagen) { const x = canoniek(plan, d.anker, d.dag); const key = sleutel(x.anker, x.dag); const e = k.get(key) || { ...x, n: 0, open: 0 }; e.n++; if (d.status !== 'klaar') e.open++; k.set(key, e); }
    return [...k.values()].filter((x) => volgordeDag(plan, x, nu) >= 0).sort((a, b) => volgordeDag(plan, a, b)).slice(0, 5);
  })() : [];

  return (
    <div className="pf-romp">
      <div className="pf-raster vier">
        {Object.entries(perFase).map(([k, [n, o]]) => <div key={k} className="pf-kaart"><div className="pf-cijfer"><b>{o}</b><span>open van {n} taakdagen · {FASE_NAAM[k]}</span></div></div>)}
        <div className="pf-kaart"><div className="pf-cijfer"><b>{voorb.filter((t) => t.status !== 'klaar').length}</b><span>open voorbereiding van {voorb.length}</span></div></div>
      </div>
      <div className="pf-raster">
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Vraagt aandacht</h2></div>
          {!aandacht.length && <span className="pf-stil">Niets dringends.</span>}
          {aandacht.map((a, i) => <button key={i} className="pf-lijstknop" onClick={() => naar(a.tab)}><b className={a.fout ? 'pf-fout' : ''}>{a.t}</b>{a.sub && <span>{a.sub}</span>}</button>)}
        </section>
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Komende dagen</h2><button className="pf-link" onClick={() => naar('planning')}>Planning</button></div>
          {!komend.length && <span className="pf-stil">{wedstrijd(plan) ? 'Geen taken meer gepland.' : 'Stel de wedstrijddag in om de komende dagen te zien.'}</span>}
          {komend.map((x) => <div key={sleutel(x.anker, x.dag)} className="pf-rij" style={{ flexWrap: 'nowrap' }}><b style={{ fontWeight: 600, flex: 1 }}>{dagNaam(plan, x.anker, x.dag)}</b><span className="pf-stil">{x.n} taken · {x.open} open</span></div>)}
        </section>
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Leveranciers</h2><button className="pf-link" onClick={() => naar('leveranciers')}>Alle {sl.length}</button></div>
          {!sl.length && <span className="pf-stil">Nog geen leveranciers op deze site.</span>}
          {perStatus.map(([n, a]) => <div key={n} className="pf-rij"><span style={{ flex: 1 }}>{n}</span><b>{a}</b></div>)}
          {f.financieel && sl.length > 0 && <span className="pf-stil">Offertes {euro(somVan((f.d.offertes || []).filter((o) => o.status !== 'afgewezen')))} · facturen {euro(somVan(f.d.facturen || []))}</span>}
        </section>
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Notities</h2><button className="pf-link" onClick={() => naar('notities')}>{notOpen.length} open</button></div>
          {!notOpen.length && <span className="pf-stil">Geen open notities.</span>}
          {notOpen.slice(0, 4).map((n) => <div key={n.id} className="pf-klein" style={{ whiteSpace: 'pre-wrap' }}>{n.tekst}</div>)}
        </section>
      </div>
    </div>
  );
}
function volgordeDag(plan, a, b) { const ka = canoniek(plan, a.anker, a.dag), kb = canoniek(plan, b.anker, b.dag); const w = wedstrijd(plan); const pos = (k) => (k.anker === 'einde' ? w.lengte - 1 + k.dag : k.dag); return pos(ka) - pos(kb); }

export function TabNotitiesPagina({ f, naar }) {
  const [filter, setFilter] = useState('open');
  const [tekst, setTekst] = useState('');
  const [tab, setTab] = useState('');
  const [mee, setMee] = useState(false);
  const lijst = (f.d.notities || []).filter((n) => filter === 'alle' || (filter === 'open' ? !n.klaar : filter === 'klaar' ? n.klaar : n.meenemen)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const toe = async () => { const t = tekst.trim(); if (!t) return; await f.voegToe('notities', { tekst: t, tab: tab || null, meenemen: mee, auteur_naam: f.profiel?.display_name || null }); setTekst(''); setMee(false); };
  const tabNaam = Object.fromEntries(ALLE_TABS);
  return (
    <div className="pf-romp">
      {f.schrijven && <div className="pf-kaart">
        <div className="pf-rij" style={{ flexWrap: 'nowrap' }}><input className="t-veld" style={{ flex: 1 }} value={tekst} onChange={(e) => setTekst(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && toe()} placeholder="Notitie voor het team: iets om na te vragen of te beslissen" aria-label="Nieuwe notitie" /><button className="t-knop hoofd" onClick={toe}>Toevoegen</button></div>
        <div className="pf-rij"><span className="pf-stil">Hoort bij</span><select className="t-veld" style={{ width: 180, height: 30 }} value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Tab"><option value="">Geen tab</option>{ALLE_TABS.filter(([k]) => !['overzicht', 'notities', 'info'].includes(k)).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          <label className="pf-rij" style={{ gap: 6 }}><input type="checkbox" checked={mee} onChange={() => setMee(!mee)} /> Meenemen naar volgende editie (evaluatie)</label></div>
      </div>}
      <Chips waarde={filter} onChange={setFilter} opties={[['open', 'Open'], ['klaar', 'Afgevinkt'], ['mee', 'Voor volgende editie'], ['alle', 'Alles']]} />
      <div className="pf-tabvak">
        <table className="pf-tabel">
          <tbody>
            {!lijst.length && <tr><td className="pf-leeg">Niets in deze lijst.</td></tr>}
            {lijst.map((n) => (
              <tr key={n.id} className={`pf-not ${n.klaar ? 'klaar' : ''}`}>
                <td style={{ width: 34 }}><input type="checkbox" checked={n.klaar} disabled={!f.schrijven} onChange={() => f.wijzig('notities', n.id, { klaar: !n.klaar, klaar_op: n.klaar ? null : new Date().toISOString() })} aria-label="Afvinken" /></td>
                <td><span className="tekst" style={{ whiteSpace: 'pre-wrap' }}>{n.tekst}</span>
                  <small>{[n.auteur_naam, new Date(n.created_at).toLocaleDateString('nl-BE')].filter(Boolean).join(' · ')}{n.tab && <> · <button className="pf-link" style={{ fontSize: 12.5 }} onClick={() => naar(n.tab)}>{tabNaam[n.tab] || n.tab}</button></>}{n.meenemen && ' · voor volgende editie'}</small></td>
                <td style={{ width: 230 }}>{f.schrijven && <span className="pf-rij" style={{ flexWrap: 'nowrap', gap: 4 }}>
                  <button className="t-knop klein stil" onClick={() => f.wijzig('notities', n.id, { meenemen: !n.meenemen })}>{n.meenemen ? 'Niet meenemen' : 'Meenemen'}</button>
                  <button className="t-knop klein stil" onClick={async () => { if (await bevestig('Notitie verwijderen?', { ok: 'Verwijderen', gevaar: true })) f.wis('notities', n.id); }}>Verwijderen</button></span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TabInfo({ f }) {
  const { plan, event } = f; const s = f.schrijven;
  const fiche = plan.instellingen?.fiche || {};
  const verborgen = new Set(fiche.verborgen_tabs || []);
  const pv = f.d.plan_vennootschappen || [];
  const [nv, setNv] = useState({ naam: '', btw: '', adres: '', factuur_email: '' });
  const [plannen, setPlannen] = useState([]);
  const [bron, setBron] = useState('');
  useEffect(() => { maps().from('plannen').select('id, naam, editie_naam, updated_at').neq('id', plan.id).is('verwijderd_op', null).order('updated_at', { ascending: false }).then((r) => setPlannen(r.data || [])); }, [plan.id]);
  const leeg = !(f.d.taken || []).length && !(f.d.site_leveranciers || []).length;
  const zetTab = (k) => { const n = new Set(verborgen); if (n.has(k)) n.delete(k); else n.add(k); f.planWijzig({ instellingen: { ...(plan.instellingen || {}), fiche: { ...fiche, verborgen_tabs: [...n] } } }); };
  const zetVenn = async (v, aan) => { const x = pv.find((p) => p.vennootschap_id === v.id); if (aan && !x) await f.voegToe('plan_vennootschappen', { vennootschap_id: v.id, standaard: !pv.length }); if (!aan && x) await f.wis('plan_vennootschappen', x.id); };
  const zetStandaard = async (x) => { const oud = pv.find((p) => p.standaard); if (oud) await f.wijzig('plan_vennootschappen', oud.id, { standaard: false }); await f.wijzig('plan_vennootschappen', x.id, { standaard: true }); };
  const overnemen = async () => {
    if (!bron) return;
    if (!(await bevestig('De fiche van dat plan overnemen? Taken, leveranciers, leveringen, laadlijst, catering, team en budgetposten komen mee op dezelfde dag tegenover de wedstrijd. Offertes en facturen niet.', { ok: 'Overnemen' }))) return;
    const r = await maps().rpc('fiche_overnemen', { p_van: bron, p_naar: plan.id });
    if (r.error) return f.meld(foutTekst(r.error));
    f.meld(`Overgenomen: ${r.data?.taken ?? 0} taken, ${r.data?.laadregels ?? 0} laadregels`); f.herlaad();
  };
  return (
    <div className="pf-romp">
      <div className="pf-raster">
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Algemeen</h2></div>
          <div className="pf-velden">
            <label><span className="t-label">Naam van het plan</span><Bewaarveld klasse="t-veld" waarde={plan.naam} uit={!s} label="Naam van het plan" onBewaar={(v) => v.trim() && f.planWijzig({ naam: v.trim() })} /></label>
            <label><span className="t-label">Wedstrijd of editie</span><Bewaarveld klasse="t-veld" waarde={plan.editie_naam} uit={!s} label="Wedstrijd of editie" onBewaar={(v) => f.planWijzig({ editie_naam: v.trim() || null })} /></label>
            <label><span className="t-label">Locatie</span><Bewaarveld klasse="t-veld" waarde={plan.locatie} uit={!s} label="Locatie" onBewaar={(v) => f.planWijzig({ locatie: v.trim() || null })} /></label>
            <label><span className="t-label">Status</span><select className="t-veld" value={plan.status} disabled={!s} onChange={(e) => f.planWijzig({ status: e.target.value })}><option value="concept">Concept</option><option value="definitief">Definitief</option></select></label>
          </div>
          {event && <span className="pf-stil pf-klein">Hoort bij het event {event.naam}.</span>}
          <details>
            <summary className="pf-link">Titelblok voor de PDF</summary>
            <div className="pf-velden" style={{ marginTop: 8 }}>
              {[['organisatie', 'Organisatie'], ['ondernemingsnummer', 'Ondernemingsnummer'], ['adres', 'Adres'], ['tekenaar', 'Tekenaar'], ['datum', 'Datum van het event']].map(([k, n]) => (
                <label key={k}><span className="t-label">{n}</span><Bewaarveld klasse="t-veld" waarde={plan.titelblok?.[k]} uit={!s} label={n} onBewaar={(v) => f.planWijzig({ titelblok: { ...(plan.titelblok || {}), [k]: v.trim() || undefined } })} /></label>
              ))}
            </div>
          </details>
          <span className="pf-stil pf-klein">Dezelfde gegevens als onder het tandwiel in de kaart.</span>
        </section>
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Wedstrijd</h2></div>
          <div className="pf-velden">
            <label><span className="t-label">Eerste wedstrijddag</span><input className="t-veld" type="date" value={plan.wedstrijd_van || ''} disabled={!s} onChange={(e) => f.planWijzig({ wedstrijd_van: e.target.value || null, ...(!plan.wedstrijd_tot || plan.wedstrijd_tot < e.target.value ? { wedstrijd_tot: e.target.value || null } : {}) })} /></label>
            <label><span className="t-label">Laatste wedstrijddag</span><input className="t-veld" type="date" value={plan.wedstrijd_tot || ''} min={plan.wedstrijd_van || undefined} disabled={!s} onChange={(e) => f.planWijzig({ wedstrijd_tot: e.target.value || null })} /></label>
          </div>
          <span className="pf-stil pf-klein">Taken staan tegenover de wedstrijddag (D-3, D, D+1). Verzet je de datum, dan schuift alles mee.{event?.datum && !plan.wedstrijd_van ? ` Het event staat op ${datumTekst(new Date(`${event.datum}T12:00:00`), true)}.` : ''}</span>
          {s && event?.datum && plan.wedstrijd_van !== event.datum && <button className="pf-link" style={{ alignSelf: 'flex-start' }} onClick={() => f.planWijzig({ wedstrijd_van: event.datum, wedstrijd_tot: event.einddatum || event.datum })}>Datum van het event overnemen</button>}
        </section>
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Vennootschappen op deze site</h2></div>
          <span className="pf-stil pf-klein">Wie de facturen krijgt. Per budgetpost, offerte, factuur en bestelling kies je er een; de standaard staat voorgeselecteerd.</span>
          {(f.d.vennootschappen || []).map((v) => { const x = pv.find((p) => p.vennootschap_id === v.id); return (
            <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!!x} disabled={!s} onChange={() => zetVenn(v, !x)} aria-label={`${v.naam} op deze site`} style={{ marginTop: 3 }} />
              <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{v.naam}</b><small className="pf-stil" style={{ display: 'block' }}>{[v.btw, v.adres, v.factuur_email].filter(Boolean).join(' · ')}</small>
                {x && <span className="pf-rij" style={{ marginTop: 4 }}><Bewaarveld waarde={x.wat || ''} uit={!s} label="Waarvoor" placeholder="Waarvoor, bv. Event of VIP" onBewaar={(w) => f.wijzig('plan_vennootschappen', x.id, { wat: w.trim() || null })} />
                  {x.standaard ? <span className="t-pil blauw">Standaard</span> : s && <button className="pf-link" onClick={() => zetStandaard(x)}>Standaard maken</button>}</span>}</span>
            </div>); })}
          {s && <details><summary className="pf-link">Nieuwe vennootschap</summary>
            <div className="pf-velden" style={{ marginTop: 8 }}>
              {[['naam', 'Naam'], ['btw', 'Btw-nummer'], ['adres', 'Adres'], ['factuur_email', 'Factuurmail']].map(([k, n]) => <input key={k} className="t-veld" placeholder={n} aria-label={n} value={nv[k]} onChange={(e) => setNv({ ...nv, [k]: e.target.value })} />)}
              <button className="t-knop klein hoofd" onClick={async () => { if (!nv.naam.trim()) return; const v = await f.voegToe('vennootschappen', { ...nv, naam: nv.naam.trim(), organisatie_id: plan.organisatie_id }); if (v) await zetVenn(v, true); setNv({ naam: '', btw: '', adres: '', factuur_email: '' }); }}>Toevoegen</button>
            </div></details>}
        </section>
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Tabs van deze site</h2></div>
          <span className="pf-stil pf-klein">Zet uit wat je op deze site niet gebruikt.</span>
          {ALLE_TABS.filter(([k]) => !['overzicht', 'info'].includes(k) && !(f.tabsUit || []).includes(k)).map(([k, n]) => <label key={k} className="pf-rij" style={{ gap: 8 }}><input type="checkbox" checked={!verborgen.has(k)} disabled={!s} onChange={() => zetTab(k)} /> {n}</label>)}
        </section>
        {s && <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Overnemen van een ander plan</h2></div>
          {leeg ? <>
            <span className="pf-stil pf-klein">Neem de fiche over van een vorige editie of van een gelijkaardige site. Werd dit plan gekopieerd, dan blijven de koppelingen met de kaart behouden.</span>
            <select className="t-veld" value={bron} onChange={(e) => setBron(e.target.value)} aria-label="Plan om van over te nemen"><option value="">Kies een plan…</option>{plannen.map((p) => <option key={p.id} value={p.id}>{p.naam}{p.editie_naam ? ` · ${p.editie_naam}` : ''}{p.id === plan.vorig_plan_id ? ' (bron van dit plan)' : ''}</option>)}</select>
            <button className="t-knop hoofd" style={{ alignSelf: 'flex-start' }} disabled={!bron} onClick={overnemen}>Overnemen</button>
          </> : <span className="pf-stil">Deze site heeft al een fiche. Overnemen kan enkel in een lege fiche.</span>}
        </section>}
      </div>
    </div>
  );
}
