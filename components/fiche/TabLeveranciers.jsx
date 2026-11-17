'use client';

// Leveranciers van de site: status, aanspreekpunt, wat ze leveren (uit het plan en vrij),
// leveringen en ophalingen met leverpunt, offertes en facturen. Excel per leverancier.
import { useMemo, useState } from 'react';
import { StatusKeuze, Bewaarveld, Bewaartekst, Kiezer, Chips, Zoek, TabNotities } from './gedeeld';
import { opId, euro, getal, getalTekst, itemLeverancier } from './data';
import { dagLijst, dagNaam, uitSleutel, uurKort, leesUur } from './dagen';
import { maakXlsx, bewaarBestand } from '../maps/tabelExport';
import { bevestig } from '../maps/dialoog';

export const STATUS_LEV = [['nog_niets', 'Nog niets'], ['inschatting', 'Inschatting'], ['offerte_gevraagd', 'Offerte gevraagd'], ['offerte', 'Offerte ontvangen'], ['bevestigd', 'Bevestigd'], ['gefactureerd', 'Gefactureerd'], ['afgesloten', 'Afgesloten']];
const STATUS_OFF = [['gevraagd', 'Gevraagd'], ['ontvangen', 'Ontvangen'], ['goedgekeurd', 'Goedgekeurd'], ['afgewezen', 'Afgewezen']];
const STATUS_FAC = [['ontvangen', 'Ontvangen'], ['goedgekeurd', 'Goedgekeurd'], ['betaald', 'Betaald'], ['betwist', 'Betwist']];

// Materiaal per leverancier uit het plan: aantal items per naam.
export function materiaalVan(f, levId) {
  const el = opId(f.elementen);
  const tel = new Map();
  for (const i of f.items) {
    if (itemLeverancier(i, el, f.d.leveranciers) !== levId) continue;
    const naam = el.get(i.element_id)?.naam || i.naam || 'Item';
    tel.set(naam, (tel.get(naam) || 0) + 1);
  }
  return [...tel.entries()].sort((a, b) => b[1] - a[1]);
}
export const somVan = (lijst, veld = 'bedrag_excl') => lijst.reduce((a, x) => a + (Number(x[veld]) || 0), 0);

export default function TabLeveranciers({ f }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('Alle');
  const [zoek, setZoek] = useState('');
  const [nieuw, setNieuw] = useState('');
  const levMap = opId(f.d.leveranciers);
  const sl = f.d.site_leveranciers || [];
  const opSite = new Set(sl.map((x) => x.leverancier_id));
  const uitPlan = (f.planLev || []).filter((x) => !opSite.has(x.leverancier_id));
  const fin = f.financieel;

  const rijen = useMemo(() => sl.map((x) => {
    const lev = levMap.get(x.leverancier_id) || { naam: '?' };
    const lv = (f.d.leveringen || []).filter((l) => l.site_leverancier_id === x.id);
    const off = (f.d.offertes || []).filter((o) => o.site_leverancier_id === x.id && o.status !== 'afgewezen');
    const fac = (f.d.facturen || []).filter((o) => o.site_leverancier_id === x.id);
    const offT = off.length ? somVan(off) : null; const facT = fac.length ? somVan(fac) : null;
    return { x, lev, lv, offT, facT, verschil: offT != null && facT != null ? Math.round((facT - offT) * 100) / 100 : null };
  }).sort((a, b) => a.lev.naam.localeCompare(b.lev.naam)), [sl, f.d, levMap]);
  const q = zoek.trim().toLowerCase();
  const pass = (r) => (!q || r.lev.naam.toLowerCase().includes(q) || (r.x.wat || '').toLowerCase().includes(q))
    && (filter === 'Alle' || (filter === 'Nog geen offerte' && !r.offT) || (filter === 'Factuur wijkt af' && r.verschil && Math.abs(r.verschil) > 0.009) || (filter === 'Zonder levering' && !r.lv.length));
  const zichtbaar = rijen.filter(pass);

  const voegLevToe = async (levId) => { if (!levId || opSite.has(levId)) return; await f.voegToe('site_leveranciers', { leverancier_id: levId }); };
  const nieuweNaam = async () => {
    const n = nieuw.trim(); if (!n) return;
    let lev = f.d.leveranciers.find((l) => l.naam.toLowerCase() === n.toLowerCase());
    if (!lev) lev = await f.voegToe('leveranciers', { naam: n, organisatie_id: f.plan.organisatie_id });
    if (lev) await voegLevToe(lev.id);
    setNieuw('');
  };
  const allesUitPlan = async () => { await f.voegToe('site_leveranciers', uitPlan.map((x) => ({ leverancier_id: x.leverancier_id }))); };

  const excelVan = (r) => {
    const mat = materiaalVan(f, r.x.leverancier_id);
    return { naam: r.lev.naam, rijen: [
      [r.lev.naam, f.plan.naam],
      [],
      ['Wat', 'Aantal'], ...mat.map(([n, a]) => [n, a]), ...(r.x.materiaal ? [[r.x.materiaal, '']] : []),
      [],
      ['Levering of ophaling', 'Dag', 'Van', 'Tot', 'Leverpunt', 'Wat'],
      ...r.lv.map((l) => [l.soort === 'ophaling' ? 'Ophaling' : 'Levering', dagNaam(f.plan, l.anker, l.dag), uurKort(l.uur_van), uurKort(l.uur_tot), (l.leverpunt_item_id && f.items.find((i) => i.id === l.leverpunt_item_id)?.naam) || l.leverpunt_tekst || '', l.wat || '']),
    ] };
  };
  const exportAlles = async () => {
    const overzicht = { naam: 'Overzicht', rijen: [['Leverancier', 'Wat', 'Status', 'Leveringen', ...(fin ? ['Offerte', 'Factuur', 'Verschil'] : [])],
      ...rijen.map((r) => [r.lev.naam, r.x.wat || '', STATUS_LEV.find((s) => s[0] === r.x.status)?.[1] || '', r.lv.map((l) => `${l.soort === 'ophaling' ? 'Ophaling' : 'Levering'} ${dagNaam(f.plan, l.anker, l.dag)} ${uurKort(l.uur_van)}`).join('; '), ...(fin ? [r.offT ?? '', r.facT ?? '', r.verschil ?? ''] : [])])] };
    bewaarBestand(await maakXlsx([overzicht, ...rijen.map(excelVan)]), `leveranciers ${f.plan.naam}.xlsx`);
  };

  return (
    <div className="pf-romp">
      {uitPlan.length > 0 && f.schrijven && (
        <div className="t-melding let-op pf-rij">
          <span style={{ flex: 1 }}>{uitPlan.length} {uitPlan.length === 1 ? 'leverancier staat' : 'leveranciers staan'} op de kaart maar nog niet in deze lijst: {uitPlan.map((x) => levMap.get(x.leverancier_id)?.naam).filter(Boolean).join(', ')}.</span>
          <button className="t-knop klein" onClick={allesUitPlan}>Toevoegen</button>
        </div>
      )}
      <div className="pf-rij">
        <Zoek waarde={zoek} onChange={setZoek} placeholder="Zoek een leverancier" />
        <Chips waarde={filter} onChange={setFilter} opties={['Alle', ...(fin ? ['Nog geen offerte', 'Factuur wijkt af'] : []), 'Zonder levering'].map((x) => [x, x])} />
        <div className="pf-vul" />
        <button className="t-knop" onClick={exportAlles}>Excel</button>
        {f.schrijven && <>
          <select className="t-veld" style={{ width: 220, height: 34 }} value="" onChange={(e) => voegLevToe(e.target.value)} aria-label="Leverancier uit de lijst toevoegen">
            <option value="">Leverancier toevoegen…</option>
            {f.d.leveranciers.filter((l) => !opSite.has(l.id) && l.actief !== false).map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
          </select>
          <input className="t-veld" style={{ width: 180, height: 34 }} value={nieuw} onChange={(e) => setNieuw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nieuweNaam()} placeholder="of nieuwe naam" aria-label="Nieuwe leverancier" />
        </>}
      </div>
      <div className="pf-tabvak">
        <table className="pf-tabel" style={{ minWidth: fin ? 1000 : 760 }}>
          <thead><tr><th>Leverancier</th><th>Levering</th><th>Ophaling</th><th style={{ width: 160 }}>Status</th>{fin && <><th className="getal">Offerte</th><th className="getal">Factuur</th><th className="getal">Verschil</th></>}</tr></thead>
          <tbody>
            {!zichtbaar.length && <tr><td colSpan={fin ? 7 : 4} className="pf-leeg">{sl.length ? 'Geen leverancier past bij deze filter.' : 'Nog geen leveranciers op deze site.'}</td></tr>}
            {zichtbaar.map((r) => {
              const lev = r.lv.filter((l) => l.soort === 'levering'); const oph = r.lv.filter((l) => l.soort === 'ophaling');
              const kort = (l) => `${dagNaam(f.plan, l.anker, l.dag)}${l.uur_van ? ` ${uurKort(l.uur_van)}` : ''}`;
              const isOpen = open === r.x.id;
              return [
                <tr key={r.x.id} className={isOpen ? 'gekozen' : ''}>
                  <td><button className="pf-rijknop" onClick={() => setOpen(isOpen ? null : r.x.id)} aria-expanded={isOpen}>{r.lev.naam}</button><small>{r.x.wat || r.lev.categorieen?.join(', ') || ''}</small></td>
                  <td>{lev.length ? lev.map(kort).join(', ') : <span className="pf-stil">–</span>}</td>
                  <td>{oph.length ? oph.map(kort).join(', ') : lev.length ? <span className="pf-let">niet ingevuld</span> : <span className="pf-stil">–</span>}</td>
                  <td><StatusKeuze waarde={r.x.status} opties={STATUS_LEV} uit={!f.schrijven} label={`Status ${r.lev.naam}`} onChange={(v) => f.wijzig('site_leveranciers', r.x.id, { status: v })} /></td>
                  {fin && <><td className="getal">{euro(r.offT)}</td><td className="getal">{euro(r.facT)}</td><td className={`getal ${r.verschil > 0.009 ? 'pf-fout' : r.verschil < -0.009 ? 'pf-let' : ''}`}>{r.verschil ? (r.verschil > 0 ? '+' : '') + euro(r.verschil) : ''}</td></>}
                </tr>,
                isOpen && <tr key={`${r.x.id}o`}><td colSpan={fin ? 7 : 4} style={{ padding: 0 }}><LevOpen f={f} r={r} onExcel={async () => bewaarBestand(await maakXlsx([excelVan(r)]), `${r.lev.naam} ${f.plan.naam}.xlsx`)} /></td></tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <TabNotities f={f} tab="leveranciers" />
    </div>
  );
}

function LevOpen({ f, r, onExcel }) {
  const s = f.schrijven; const x = r.x;
  const mat = materiaalVan(f, x.leverancier_id);
  const contacten = (f.d.personen || []).filter((p) => p.leverancier_id === x.leverancier_id);
  const lijst = dagLijst(f.plan, [...(f.d.taak_dagen || []), ...(f.d.leveringen || []), { anker: 'start', dag: -10 }, { anker: 'einde', dag: 5 }]);
  const [nl, setNl] = useState({ soort: 'levering', k: 'start:-1', uur: '', tot: '', wat: '', punt: '' });
  const voegLevToe = async () => {
    const d = uitSleutel(nl.k); const u = leesUur(nl.uur); const t = leesUur(nl.tot);
    await f.voegToe('leveringen', { site_leverancier_id: x.id, soort: nl.soort, ...d, uur_van: u, uur_tot: t, wat: nl.wat.trim() || null, leverpunt_item_id: nl.punt || null });
    setNl({ ...nl, uur: '', tot: '', wat: '' });
  };
  const vennootschappen = (f.d.vennootschappen || []);
  const standaardV = (f.d.plan_vennootschappen || []).find((v) => v.standaard)?.vennootschap_id || null;
  const offertes = (f.d.offertes || []).filter((o) => o.site_leverancier_id === x.id);
  const facturen = (f.d.facturen || []).filter((o) => o.site_leverancier_id === x.id);
  const wis = async () => { if (await bevestig(`${r.lev.naam} van deze site halen? Leveringen, offertes en facturen van deze site verdwijnen mee.`, { ok: 'Weghalen', gevaar: true })) f.wis('site_leveranciers', x.id); };
  const geldRij = (t, o, statussen) => (
    <tr key={o.id}>
      <td><Bewaarveld waarde={o.nummer || ''} uit={!s} label="Nummer" placeholder="nr" onBewaar={(v) => f.wijzig(t, o.id, { nummer: v || null })} /></td>
      <td><Bewaarveld waarde={o.datum || ''} type="date" uit={!s} label="Datum" onBewaar={(v) => f.wijzig(t, o.id, { datum: v || null })} /></td>
      <td className="getal"><Bewaarveld klasse="pf-cel" style={{ width: 96 }} waarde={getalTekst(o.bedrag_excl)} uit={!s} label="Bedrag excl. btw" onBewaar={(v) => f.wijzig(t, o.id, { bedrag_excl: getal(v) })} /></td>
      <td><select className="t-veld" style={{ height: 28, width: 150 }} value={o.vennootschap_id || ''} disabled={!s} onChange={(e) => f.wijzig(t, o.id, { vennootschap_id: e.target.value || null })} aria-label="Vennootschap"><option value="">Vennootschap…</option>{vennootschappen.map((v) => <option key={v.id} value={v.id}>{v.naam}</option>)}</select></td>
      <td><select className="t-veld" style={{ height: 28 }} value={o.status} disabled={!s} onChange={(e) => f.wijzig(t, o.id, { status: e.target.value })} aria-label="Status">{statussen.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></td>
      <td><Bewaarveld waarde={o.link || ''} uit={!s} label="Link" placeholder="https://…" onBewaar={(v) => f.wijzig(t, o.id, { link: v.trim() || null })} />{o.link && /^https?:/.test(o.link) && <a className="pf-link" href={o.link} target="_blank" rel="noreferrer">Openen</a>}</td>
      <td>{s && <button className="t-knop klein stil" onClick={() => f.wis(t, o.id)}>Weg</button>}</td>
    </tr>
  );
  return (
    <div className="pf-open">
      <div className="pf-blok">
        <h3>Afspraken</h3>
        <label className="pf-veld"><span className="t-label">Wat</span><Bewaarveld klasse="t-veld" waarde={x.wat || ''} uit={!s} label="Wat" placeholder="bv. toiletten, hekken en trailers" onBewaar={(v) => f.wijzig('site_leveranciers', x.id, { wat: v.trim() || null })} /></label>
        <label className="pf-veld"><span className="t-label">Aanspreekpunt</span><Kiezer waarde={x.aanspreekpunt_id} opties={contacten} leeg={contacten.length ? 'Kies…' : 'Nog geen contact in de stamlijst'} uit={!s} label="Aanspreekpunt" onChange={(v) => f.wijzig('site_leveranciers', x.id, { aanspreekpunt_id: v })} /></label>
        {(() => { const p = contacten.find((c) => c.id === x.aanspreekpunt_id); return p ? <span className="pf-stil pf-klein">{[p.telefoon, p.email].filter(Boolean).join(' · ')}</span> : null; })()}
        <label className="pf-veld"><span className="t-label">Opmerking</span><Bewaartekst waarde={x.opmerking || ''} uit={!s} label="Opmerking" rijen={2} onBewaar={(v) => f.wijzig('site_leveranciers', x.id, { opmerking: v.trim() || null })} /></label>
        <div className="pf-rij"><button className="t-knop klein" onClick={onExcel}>Excel voor {r.lev.naam}</button>{s && <button className="t-knop klein gevaar" onClick={wis}>Van de site halen</button>}</div>
      </div>
      <div className="pf-blok">
        <h3>Materiaal</h3>
        {mat.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{mat.map(([n, a]) => <li key={n}>{a} × {n}</li>)}</ul> : <span className="pf-stil">Niets van deze leverancier op de kaart.</span>}
        <label className="pf-veld"><span className="t-label">Ook (niet op de kaart)</span><Bewaartekst waarde={x.materiaal || ''} uit={!s} label="Ander materiaal" rijen={2} onBewaar={(v) => f.wijzig('site_leveranciers', x.id, { materiaal: v.trim() || null })} /></label>
      </div>
      <div className="pf-blok">
        <h3>Leveringen en ophalingen</h3>
        {r.lv.map((l) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, padding: '6px 0', borderBottom: '1px solid #E3E8EF' }}>
            <span><b style={{ fontWeight: 600 }}>{l.soort === 'ophaling' ? 'Ophaling' : 'Levering'} · {dagNaam(f.plan, l.anker, l.dag)}{l.uur_van ? ` · ${uurKort(l.uur_van)}${l.uur_tot ? `–${uurKort(l.uur_tot)}` : ''}` : ''}</b>
              <small className="pf-stil" style={{ display: 'block' }}>{[(l.leverpunt_item_id && f.items.find((i) => i.id === l.leverpunt_item_id)?.naam) || l.leverpunt_tekst, l.wat].filter(Boolean).join(' · ') || 'Geen leverpunt'}</small></span>
            {s && <button className="t-knop klein stil" onClick={() => f.wis('leveringen', l.id)}>Weg</button>}
          </div>
        ))}
        {s && <>
          <div className="pf-velden">
            <label><span className="t-label">Soort</span><select className="t-veld" value={nl.soort} onChange={(e) => setNl({ ...nl, soort: e.target.value })}><option value="levering">Levering</option><option value="ophaling">Ophaling</option></select></label>
            <label><span className="t-label">Dag</span><select className="t-veld" value={nl.k} onChange={(e) => setNl({ ...nl, k: e.target.value })}>{lijst.map((d) => <option key={d.k} value={d.k}>{dagNaam(f.plan, d.anker, d.dag)}</option>)}</select></label>
          </div>
          <div className="pf-velden">
            <label><span className="t-label">Van</span><input className="t-veld" value={nl.uur} onChange={(e) => setNl({ ...nl, uur: e.target.value })} placeholder="08:00" /></label>
            <label><span className="t-label">Tot</span><input className="t-veld" value={nl.tot} onChange={(e) => setNl({ ...nl, tot: e.target.value })} placeholder="12:00" /></label>
          </div>
          <label className="pf-veld"><span className="t-label">Leverpunt op de kaart</span><select className="t-veld" value={nl.punt} onChange={(e) => setNl({ ...nl, punt: e.target.value })}><option value="">Geen</option>{f.items.filter((i) => i.naam).sort((a, b) => a.naam.localeCompare(b.naam)).map((i) => <option key={i.id} value={i.id}>{i.naam}</option>)}</select></label>
          <label className="pf-veld"><span className="t-label">Wat</span><input className="t-veld" value={nl.wat} onChange={(e) => setNl({ ...nl, wat: e.target.value })} placeholder="3 trailers schuine hekken" /></label>
          <button className="t-knop klein hoofd" style={{ alignSelf: 'flex-start' }} onClick={voegLevToe}>Toevoegen</button>
        </>}
      </div>
      {f.financieel && (
        <div className="pf-blok" style={{ gridColumn: '1 / -1' }}>
          <h3>Offertes en facturen</h3>
          <table className="pf-tabel" style={{ background: '#fff', border: '1px solid var(--t-rand)', borderRadius: 8 }}>
            <thead><tr><th>Nummer</th><th>Datum</th><th className="getal">Excl. btw</th><th>Vennootschap</th><th>Status</th><th>Link</th><th /></tr></thead>
            <tbody>
              <tr className="groep"><td colSpan={7}>Offertes · {euro(somVan(offertes.filter((o) => o.status !== 'afgewezen')))}</td></tr>
              {offertes.map((o) => geldRij('offertes', o, STATUS_OFF))}
              <tr className="groep"><td colSpan={7}>Facturen · {euro(somVan(facturen))}</td></tr>
              {facturen.map((o) => geldRij('facturen', o, STATUS_FAC))}
            </tbody>
          </table>
          {s && <div className="pf-rij">
            <button className="t-knop klein" onClick={() => f.voegToe('offertes', { site_leverancier_id: x.id, vennootschap_id: standaardV, status: 'ontvangen' }).then(() => x.status === 'nog_niets' || x.status === 'inschatting' || x.status === 'offerte_gevraagd' ? f.wijzig('site_leveranciers', x.id, { status: 'offerte' }) : null)}>Offerte toevoegen</button>
            <button className="t-knop klein" onClick={() => f.voegToe('facturen', { site_leverancier_id: x.id, vennootschap_id: standaardV, status: 'ontvangen' }).then(() => f.wijzig('site_leveranciers', x.id, { status: 'gefactureerd' }))}>Factuur toevoegen</button>
          </div>}
        </div>
      )}
    </div>
  );
}
