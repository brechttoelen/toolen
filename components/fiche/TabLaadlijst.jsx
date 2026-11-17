'use client';

// Laadlijst: vrije regels per bron (magazijn, opslag bij een leverancier, gemeente). Fijner dan het plan:
// krijtspray of gaffa teken je niet. Pakketten om vaste sets in één keer toe te voegen, voorstellen uit
// het plan voor eigen materiaal, laadbon per bron.
import { useState } from 'react';
import { opId, getal, getalTekst, itemLeverancier } from './data';
import { StatusKeuze, Bewaarveld, Chips, Zoek, TabNotities } from './gedeeld';
import { maakXlsx, bewaarBestand } from '../maps/tabelExport';
import { bevestig, vraagTekst } from '../maps/dialoog';

const STATUS_LAAD = [['te_pakken', 'Te pakken'], ['gepakt', 'Gepakt'], ['op_site', 'Op de site'], ['terug', 'Terug']];

export default function TabLaadlijst({ f }) {
  const s = f.schrijven;
  const bronnen = f.d.laad_bronnen || [];
  const regels = f.d.laadregels || [];
  const [bron, setBron] = useState('alle');
  const [zoek, setZoek] = useState('');
  const [n, setN] = useState({ aantal: '', wat: '', bron: bronnen[0]?.id || '', opmerking: '' });
  const [toonPlan, setToonPlan] = useState(false);
  const [nb, setNb] = useState('');
  const items = opId(f.items); const lev = opId(f.d.leveranciers);
  const q = zoek.trim().toLowerCase();
  const groepen = [...bronnen.map((b) => ({ b, id: b.id })), { b: { naam: 'Zonder bron' }, id: '' }]
    .filter((g) => bron === 'alle' || bron === g.id)
    .map((g) => ({ ...g, rijen: regels.filter((r) => (r.bron_id || '') === g.id && (!q || r.wat.toLowerCase().includes(q) || (r.opmerking || '').toLowerCase().includes(q))) }))
    .filter((g) => g.rijen.length);
  const toe = async () => {
    if (!n.wat.trim()) return f.meld('Wat moet er mee?');
    await f.voegToe('laadregels', { aantal: getal(n.aantal), wat: n.wat.trim(), bron_id: n.bron || null, opmerking: n.opmerking.trim() || null });
    setN({ ...n, aantal: '', wat: '', opmerking: '' });
  };
  const bon = async (g) => bewaarBestand(await maakXlsx([{ naam: g.b.naam, rijen: [[`Laadbon ${g.b.naam}`, f.plan.naam], [`Brengt: ${(g.b.leverancier_id && lev.get(g.b.leverancier_id)?.naam) || g.b.brengt_tekst || ''}`], [], ['Aantal', 'Wat', 'Waar op de site', 'Opmerking', 'Gepakt'],
    ...g.rijen.map((r) => [r.aantal != null ? Number(r.aantal) : '', r.wat, (r.waar_item_id && items.get(r.waar_item_id)?.naam) || r.waar_tekst || '', r.opmerking || '', r.status === 'te_pakken' ? '' : 'ja'])] }]), `laadbon ${g.b.naam} ${f.plan.naam}.xlsx`);
  const pakketToe = async (p) => {
    const rs = (p.regels || []).map((x) => ({ aantal: x.aantal ?? null, eenheid: x.eenheid || null, wat: x.wat, bron_id: x.bron_id || null, opmerking: x.opmerking || null, pakket_id: p.id }));
    if (rs.length) { await f.voegToe('laadregels', rs); f.meld(`${rs.length} regels uit "${p.naam}" toegevoegd`); }
  };
  const alsPakket = async () => {
    const lijst = bron === 'alle' ? regels : regels.filter((r) => (r.bron_id || '') === bron);
    if (!lijst.length) return;
    const naam = await vraagTekst(`Naam van het pakket (${lijst.length} regels)`, 'Aankomst standaard', { titel: 'Als pakket bewaren' });
    if (!naam?.trim()) return;
    await f.voegToe('laadpakketten', { naam: naam.trim(), organisatie_id: f.plan.organisatie_id, regels: lijst.map((r) => ({ aantal: r.aantal, eenheid: r.eenheid, wat: r.wat, bron_id: r.bron_id, opmerking: r.opmerking })) });
    f.meld(`Pakket "${naam.trim()}" bewaard voor de hele organisatie`);
  };
  const nieuweBron = async () => { const x = nb.trim(); if (!x) return; const b = await f.voegToe('laad_bronnen', { naam: x, organisatie_id: f.plan.organisatie_id, volgorde: bronnen.length + 1 }); if (b) setN({ ...n, bron: b.id }); setNb(''); };

  // Voorstellen uit het plan: items van leveranciers die aan een bron hangen (eigen materiaal bij een leverancier).
  const el = opId(f.elementen);
  const bronVanLev = new Map(bronnen.filter((b) => b.leverancier_id).map((b) => [b.leverancier_id, b]));
  const eigen = new Set(f.d.leveranciers.filter((l) => /^(flcs|flanders classics|eigen)$/i.test(l.naam.trim())).map((l) => l.id));
  const voorstellen = new Map();
  for (const i of f.items) {
    const lid = itemLeverancier(i, el, f.d.leveranciers); if (!lid || (!bronVanLev.has(lid) && !eigen.has(lid))) continue;
    const naam = el.get(i.element_id)?.naam || i.naam; if (!naam) continue;
    const k = `${lid}|${naam}`; const x = voorstellen.get(k) || { lid, naam, n: 0, bron: bronVanLev.get(lid) || null }; x.n++; voorstellen.set(k, x);
  }
  const nogNiet = [...voorstellen.values()].filter((x) => !regels.some((r) => r.wat.toLowerCase() === x.naam.toLowerCase()));

  return (
    <div className="pf-romp">
      <div className="t-melding">Een laadlijst is fijner dan het plan: krijtspray, gaffa of kabelbinders teken je niet. Typ regels zelf, neem een pakket over of neem eigen materiaal over uit het plan. Borden en pijlen typ je hier ook in zonder de module Signalisatie.</div>
      <div className="pf-rij">
        <Zoek waarde={zoek} onChange={setZoek} placeholder="Zoek in de laadlijst" />
        <Chips waarde={bron} onChange={setBron} opties={[['alle', 'Alles'], ...bronnen.map((b) => [b.id, b.naam])]} />
        <div className="pf-vul" />
        {s && (f.d.laadpakketten || []).length > 0 && <select className="t-veld" style={{ width: 200, height: 34 }} value="" onChange={(e) => { const p = f.d.laadpakketten.find((x) => x.id === e.target.value); if (p) pakketToe(p); }} aria-label="Pakket toevoegen"><option value="">Pakket toevoegen…</option>{f.d.laadpakketten.map((p) => <option key={p.id} value={p.id}>{p.naam} · {(p.regels || []).length}</option>)}</select>}
        {s && <button className="t-knop" onClick={alsPakket}>Als pakket bewaren</button>}
        {s && nogNiet.length > 0 && <button className="t-knop" onClick={() => setToonPlan(!toonPlan)}>Uit het plan · {nogNiet.length}</button>}
      </div>
      {toonPlan && (
        <div className="pf-kaart">
          <div className="pf-kaartkop"><h2>Eigen materiaal op de kaart dat nog niet op de laadlijst staat</h2><button className="pf-link" onClick={() => setToonPlan(false)}>Sluiten</button></div>
          {nogNiet.map((x) => (
            <div key={`${x.lid}${x.naam}`} className="pf-rij" style={{ flexWrap: 'nowrap' }}>
              <span style={{ flex: 1 }}>{x.n} × {x.naam} <span className="pf-stil">· {lev.get(x.lid)?.naam}</span></span>
              <button className="t-knop klein" onClick={() => f.voegToe('laadregels', { aantal: x.n, wat: x.naam, bron_id: x.bron?.id || n.bron || null })}>Toevoegen</button>
            </div>
          ))}
        </div>
      )}
      <div className="pf-tabvak">
        <table className="pf-tabel" style={{ minWidth: 900 }}>
          <thead><tr><th className="getal" style={{ width: 80 }}>Aantal</th><th>Wat</th><th style={{ width: '20%' }}>Waar op de site</th><th style={{ width: '24%' }}>Opmerking</th><th style={{ width: 140 }}>Status</th><th style={{ width: 50 }} /></tr></thead>
          <tbody>
            {!groepen.length && <tr><td colSpan={6} className="pf-leeg">{regels.length ? 'Niets gevonden.' : 'Nog geen regels.'}</td></tr>}
            {groepen.map((g) => [
              <tr key={`g${g.id}`} className="groep"><td colSpan={6}><span className="pf-rij"><span>{g.b.naam} · {g.rijen.length}</span><span style={{ fontWeight: 400 }}>{(g.b.leverancier_id && `brengt ${lev.get(g.b.leverancier_id)?.naam}`) || (g.b.brengt_tekst && `brengt ${g.b.brengt_tekst}`) || ''}</span><span className="pf-vul" /><button className="pf-link" onClick={() => bon(g)}>Laadbon</button></span></td></tr>,
              ...g.rijen.map((r) => (
                <tr key={r.id}>
                  <td className="getal"><Bewaarveld klasse="pf-cel" waarde={getalTekst(r.aantal)} uit={!s} label="Aantal" onBewaar={(v) => f.wijzig('laadregels', r.id, { aantal: getal(v) })} /></td>
                  <td><Bewaarveld waarde={r.wat} uit={!s} label="Wat" onBewaar={(v) => v.trim() && f.wijzig('laadregels', r.id, { wat: v.trim() })} /></td>
                  <td><select className="t-veld" style={{ height: 28, width: '100%' }} value={r.waar_item_id || ''} disabled={!s} onChange={(e) => f.wijzig('laadregels', r.id, { waar_item_id: e.target.value || null })} aria-label="Waar op de site"><option value="">{r.waar_tekst || '–'}</option>{f.items.filter((i) => i.naam).sort((a, b) => a.naam.localeCompare(b.naam)).map((i) => <option key={i.id} value={i.id}>{i.naam}</option>)}</select></td>
                  <td><Bewaarveld waarde={r.opmerking || ''} uit={!s} label="Opmerking" onBewaar={(v) => f.wijzig('laadregels', r.id, { opmerking: v.trim() || null })} /></td>
                  <td><StatusKeuze waarde={r.status} opties={STATUS_LAAD} uit={!s} label={`Status ${r.wat}`} onChange={(v) => f.wijzig('laadregels', r.id, { status: v })} /></td>
                  <td>{s && <button className="t-knop klein stil" onClick={async () => { if (await bevestig(`"${r.wat}" van de laadlijst halen?`, { ok: 'Weghalen' })) f.wis('laadregels', r.id); }} aria-label="Regel verwijderen">Weg</button>}</td>
                </tr>
              )),
            ])}
          </tbody>
          {s && <tfoot><tr>
            <td><input className="t-veld" style={{ height: 30, width: 64 }} value={n.aantal} onChange={(e) => setN({ ...n, aantal: e.target.value })} placeholder="1" aria-label="Aantal" /></td>
            <td><input className="t-veld" style={{ height: 30, width: '100%', boxSizing: 'border-box' }} value={n.wat} onChange={(e) => setN({ ...n, wat: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && toe()} placeholder="bv. Pijl rechtdoor 60×80" aria-label="Wat" /></td>
            <td><select className="t-veld" style={{ height: 30, width: '100%' }} value={n.bron} onChange={(e) => setN({ ...n, bron: e.target.value })} aria-label="Komt van"><option value="">Zonder bron</option>{bronnen.map((b) => <option key={b.id} value={b.id}>{b.naam}</option>)}</select></td>
            <td><input className="t-veld" style={{ height: 30, width: '100%', boxSizing: 'border-box' }} value={n.opmerking} onChange={(e) => setN({ ...n, opmerking: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && toe()} placeholder="Opmerking" aria-label="Opmerking" /></td>
            <td colSpan={2}><button className="t-knop klein hoofd" onClick={toe}>Toevoegen</button></td>
          </tr></tfoot>}
        </table>
      </div>
      {s && <div className="pf-rij"><span className="pf-stil">Nieuwe bron</span><input className="t-veld" style={{ width: 240, height: 32 }} value={nb} onChange={(e) => setNb(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nieuweBron()} placeholder="bv. Opslag bij ET" aria-label="Nieuwe bron" /><button className="t-knop klein" onClick={nieuweBron}>Toevoegen</button></div>}
      <TabNotities f={f} tab="laadlijst" />
    </div>
  );
}
