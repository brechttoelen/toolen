'use client';

// Locaties (gebouwen, zalen) en parkings van de site. Ze hangen bij voorkeur aan een item op de kaart,
// meestal een vast item van de plaatsfiche, zodat ze van editie tot editie blijven. Wat per editie verschilt
// (toegang, ruimtes, technieker, wie welke parking gebruikt) staat in de fiche van de site.
import { useState } from 'react';
import { opId } from './data';
import { Bewaarveld, Bewaartekst, TabNotities } from './gedeeld';
import { bevestig } from '../maps/dialoog';
import { maakXlsx, bewaarBestand } from '../maps/tabelExport';

const nieuwId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

function useLijst(f, sleutel) {
  const fiche = f.plan.instellingen?.fiche || {};
  const lijst = Array.isArray(fiche[sleutel]) ? fiche[sleutel] : [];
  const bewaar = (nieuw) => f.planWijzig({ instellingen: { ...(f.plan.instellingen || {}), fiche: { ...fiche, [sleutel]: nieuw } } });
  return { lijst, bewaar, zet: (id, patch) => bewaar(lijst.map((x) => (x.id === id ? { ...x, ...patch } : x))), weg: (id) => bewaar(lijst.filter((x) => x.id !== id)), toe: (x) => bewaar([...lijst, { id: nieuwId(), ...x }]) };
}

function ItemKiezer({ f, waarde, onChange, label }) {
  const items = [...f.items].filter((i) => i.naam).sort((a, b) => (b.vast ? 1 : 0) - (a.vast ? 1 : 0) || a.naam.localeCompare(b.naam));
  return (
    <select className="t-veld" style={{ height: 30 }} value={waarde || ''} disabled={!f.schrijven} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
      <option value="">Niet op de kaart</option>
      {items.map((i) => <option key={i.id} value={i.id}>{i.naam}{i.vast ? ' (vast item)' : ''}</option>)}
    </select>
  );
}

export function TabLocaties({ f }) {
  const s = f.schrijven; const { lijst, zet, weg, toe } = useLijst(f, 'locaties');
  const items = opId(f.items);
  const [naam, setNaam] = useState('');
  const excel = async () => bewaarBestand(await maakXlsx([{ naam: 'Locaties', rijen: [['Locatie', 'Toegang', 'Ruimte', 'Functie', 'Technieker', 'Opmerking'],
    ...lijst.flatMap((l) => (l.ruimtes?.length ? l.ruimtes : [{ naam: '', functie: '' }]).map((r, i) => [i ? '' : l.naam, i ? '' : l.toegang || '', r.naam, r.functie, i ? '' : l.technieker || '', i ? '' : l.opmerking || '']))] }]), `locaties ${f.plan.naam}.xlsx`);
  return (
    <div className="pf-romp">
      <div className="pf-rij">
        <span className="pf-stil">{lijst.length} locaties. Een locatie aan een vast item van de plaatsfiche blijft over edities heen staan.</span>
        <div className="pf-vul" />
        <button className="t-knop" onClick={excel}>Excel voor de gemeente</button>
        {s && <><input className="t-veld" style={{ width: 240, height: 34 }} value={naam} onChange={(e) => setNaam(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && naam.trim()) { toe({ naam: naam.trim(), ruimtes: [] }); setNaam(''); } }} placeholder="Nieuwe locatie, bv. CC Guldenberg" aria-label="Nieuwe locatie" />
          <button className="t-knop hoofd" onClick={() => { if (naam.trim()) { toe({ naam: naam.trim(), ruimtes: [] }); setNaam(''); } }}>Locatie toevoegen</button></>}
      </div>
      <div className="pf-raster">
        {!lijst.length && <div className="pf-leeg">Nog geen locaties.</div>}
        {lijst.map((l) => {
          const it = l.item_id && items.get(l.item_id);
          return (
            <section key={l.id} className="pf-kaart">
              <div className="pf-kaartkop"><h2><Bewaarveld waarde={l.naam} uit={!s} label="Naam" klasse="pf-cel breed" style={{ fontWeight: 700, fontSize: 16 }} onBewaar={(v) => v.trim() && zet(l.id, { naam: v.trim() })} /></h2>
                {it && <a className="pf-link" href={`/maps/${f.plan.id}?item=${it.id}`}>Op de kaart</a>}</div>
              {l.item_id && !it && <div className="t-melding let-op">Het item op de kaart bestaat niet meer. Kies een ander.</div>}
              <div className="pf-veldrij"><span>Op de kaart</span><ItemKiezer f={f} waarde={l.item_id} label="Item op de kaart" onChange={(v) => zet(l.id, { item_id: v })} /></div>
              <div className="pf-veldrij"><span>Toegang</span><Bewaarveld waarde={l.toegang || ''} uit={!s} label="Toegang" placeholder="za 8:00 tot zo 22:00" onBewaar={(v) => zet(l.id, { toegang: v.trim() || null })} /></div>
              <div className="pf-blok" style={{ gap: 4 }}><span className="t-label" style={{ margin: 0 }}>Ruimtes</span>
                {(l.ruimtes || []).map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 6 }}>
                    <Bewaarveld waarde={r.naam} uit={!s} label="Ruimte" placeholder="Zaal" onBewaar={(v) => zet(l.id, { ruimtes: l.ruimtes.map((x, j) => (j === i ? { ...x, naam: v } : x)) })} />
                    <Bewaarveld waarde={r.functie} uit={!s} label="Functie" placeholder="Functie" onBewaar={(v) => zet(l.id, { ruimtes: l.ruimtes.map((x, j) => (j === i ? { ...x, functie: v } : x)) })} />
                    {s && <button className="t-knop klein stil" onClick={() => zet(l.id, { ruimtes: l.ruimtes.filter((x, j) => j !== i) })} aria-label="Ruimte weg">✕</button>}
                  </div>
                ))}
                {s && <button className="pf-link" style={{ alignSelf: 'flex-start' }} onClick={() => zet(l.id, { ruimtes: [...(l.ruimtes || []), { naam: '', functie: '' }] })}>+ Ruimte</button>}
              </div>
              <div className="pf-veldrij"><span>Technieker</span><Bewaarveld waarde={l.technieker || ''} uit={!s} label="Technieker" placeholder="Naam en telefoon" onBewaar={(v) => zet(l.id, { technieker: v.trim() || null })} /></div>
              <label className="pf-veld"><span className="t-label">Opmerking</span><Bewaartekst waarde={l.opmerking || ''} uit={!s} label="Opmerking" rijen={2} onBewaar={(v) => zet(l.id, { opmerking: v.trim() || null })} /></label>
              {s && <button className="t-knop klein stil" style={{ alignSelf: 'flex-start' }} onClick={async () => { if (await bevestig(`Locatie "${l.naam}" verwijderen?`, { ok: 'Verwijderen', gevaar: true })) weg(l.id); }}>Verwijderen</button>}
            </section>
          );
        })}
      </div>
      <TabNotities f={f} tab="locaties" />
    </div>
  );
}

export function TabMobiliteit({ f }) {
  const s = f.schrijven; const { lijst, zet, weg, toe } = useLijst(f, 'parkings');
  const items = opId(f.items);
  const gesorteerd = [...lijst].sort((a, b) => String(a.nr || '').localeCompare(String(b.nr || ''), 'nl', { numeric: true }));
  return (
    <div className="pf-romp">
      <div className="pf-rij"><span className="pf-stil">Parkings met hun nummer, voor wie en wanneer. Hang ze aan een item op de kaart, dan staan ze ook op de plannen.</span><div className="pf-vul" />
        {s && <button className="t-knop hoofd" onClick={() => toe({ nr: '', voor: '', locatie: '', wanneer: '' })}>Parking toevoegen</button>}</div>
      <div className="pf-tabvak">
        <table className="pf-tabel" style={{ minWidth: 900 }}>
          <thead><tr><th style={{ width: 70 }}>Nr</th><th>Voor wie</th><th>Locatie</th><th style={{ width: 180 }}>Wanneer</th><th style={{ width: 220 }}>Op de kaart</th><th style={{ width: 50 }} /></tr></thead>
          <tbody>
            {!gesorteerd.length && <tr><td colSpan={6} className="pf-leeg">Nog geen parkings.</td></tr>}
            {gesorteerd.map((p) => (
              <tr key={p.id}>
                <td><Bewaarveld klasse="pf-cel" waarde={p.nr || ''} uit={!s} label="Nummer" placeholder="P5" onBewaar={(v) => zet(p.id, { nr: v.trim() })} /></td>
                <td><Bewaarveld waarde={p.voor || ''} uit={!s} label="Voor wie" placeholder="Teams Elite Men" onBewaar={(v) => zet(p.id, { voor: v.trim() })} /></td>
                <td><Bewaarveld waarde={p.locatie || ''} uit={!s} label="Locatie" placeholder="Parking Kloosterstraat" onBewaar={(v) => zet(p.id, { locatie: v.trim() })} /></td>
                <td><Bewaarveld waarde={p.wanneer || ''} uit={!s} label="Wanneer" placeholder="Zaterdag en zondag" onBewaar={(v) => zet(p.id, { wanneer: v.trim() })} /></td>
                <td><ItemKiezer f={f} waarde={p.item_id} label="Item op de kaart" onChange={(v) => zet(p.id, { item_id: v, locatie: p.locatie || (v && items.get(v)?.naam) || '' })} /></td>
                <td>{s && <button className="t-knop klein stil" onClick={() => weg(p.id)} aria-label="Parking weg">Weg</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="pf-kaart" style={{ background: '#FAFBFD' }}>
        <div className="pf-kaartkop"><h2>Signalisatie en omleidingen</h2><span className="pf-stil">volgt</span></div>
        <div className="pf-stil">Komt hier zodra de module Signalisatie af is: pijlen naar de parkings, afsluitingen, omleidingen en de borden per parking. Tot dan typ je borden en pijlen in de Laadlijst.</div>
      </section>
      <TabNotities f={f} tab="mobiliteit" />
    </div>
  );
}
