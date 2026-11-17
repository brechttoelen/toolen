'use client';

// Een taak openen: titel, soort, wie, dagen (reeks en losse dagen, elk met uur, status en uitvoerder),
// afbraak, levering waar ze bij hoort, en waar op de kaart (item, groep, laag, laaggroep).
import { useMemo, useState } from 'react';
import { Paneel, Bewaarveld, Bewaartekst, StatusKeuze, STATUS_TAAK, Kiezer } from './gedeeld';
import { dagLijst, dagNaam, canoniek, sleutel, uitSleutel, uurKort, leesUur, label, wedstrijd } from './dagen';
import { opId } from './data';
import { bevestig } from '../maps/dialoog';

export default function TaakPaneel({ f, taakId, onSluit }) {
  const t = (f.d.taken || []).find((x) => x.id === taakId);
  const [zoekItem, setZoekItem] = useState('');
  const [totK, setTotK] = useState('');
  const dagen = (f.d.taak_dagen || []).filter((d) => d.taak_id === taakId).sort((a, b) => (a.anker === b.anker ? a.dag - b.dag : a.anker === 'start' ? -1 : 1));
  const kop = (f.d.taak_koppelingen || []).filter((k) => k.taak_id === taakId);
  const lijst = useMemo(() => {
    const alle = [...(f.d.taak_dagen || []), ...(f.d.leveringen || []), { anker: 'start', dag: -10 }, { anker: 'einde', dag: 5 }];
    return dagLijst(f.plan, alle);
  }, [f.plan, f.d.taak_dagen, f.d.leveringen]);
  if (!t) return null;
  const s = f.schrijven;
  const w = (patch) => f.wijzig('taken', t.id, patch);
  const itemMap = opId(f.items); const laagMap = opId(f.lagen);
  const personen = [...(f.d.personen || [])].sort((a, b) => a.naam.localeCompare(b.naam));
  const team = (f.d.site_rollen || []).map((r) => personen.find((p) => p.id === r.persoon_id)).filter(Boolean);
  const andere = personen.filter((p) => !team.includes(p));
  const persOpties = [...team.map((p) => ({ id: p.id, naam: `${p.naam} (team)` })), ...andere];
  const levOpties = (f.d.site_leveranciers || []).map((sl) => f.d.leveranciers.find((l) => l.id === sl.leverancier_id)).filter(Boolean);
  const slMap = opId(f.d.site_leveranciers); const levMap = opId(f.d.leveranciers);
  const leveringen = (f.d.leveringen || []).map((l) => ({ id: l.id, naam: `${l.soort === 'ophaling' ? 'Ophaling' : 'Levering'} ${levMap.get(slMap.get(l.site_leverancier_id)?.leverancier_id)?.naam || ''} · ${dagNaam(f.plan, l.anker, l.dag)}${l.wat ? ` · ${l.wat}` : ''}` }));

  const zetDag = (d, k) => { const x = uitSleutel(k); f.wijzig('taak_dagen', d.id, x); };
  const voegDagToe = async (k) => {
    const x = uitSleutel(k);
    if (dagen.some((d) => sleutel(...Object.values(canoniek(f.plan, d.anker, d.dag))) === k)) return f.meld('Die dag staat er al bij');
    const eerste = dagen[0];
    await f.voegToe('taak_dagen', { taak_id: t.id, ...x, uur_van: eerste?.uur_van || null, uur_tot: eerste?.uur_tot || null, uitvoerder_persoon_id: eerste?.uitvoerder_persoon_id || null });
  };
  const reeks = async () => {
    if (!totK || !dagen.length) return;
    const start = dagen[0]; const sk = sleutel(...Object.values(canoniek(f.plan, start.anker, start.dag)));
    const i0 = lijst.findIndex((x) => x.k === sk), i1 = lijst.findIndex((x) => x.k === totK);
    if (i0 < 0 || i1 <= i0) return f.meld('Kies een dag na de eerste dag');
    const bestaand = new Set(dagen.map((d) => sleutel(...Object.values(canoniek(f.plan, d.anker, d.dag)))));
    const nieuw = lijst.slice(i0 + 1, i1 + 1).filter((x) => !bestaand.has(x.k)).map((x) => ({ taak_id: t.id, anker: x.anker, dag: x.dag, uur_van: start.uur_van, uur_tot: start.uur_tot, uitvoerder_persoon_id: start.uitvoerder_persoon_id }));
    if (nieuw.length) await f.voegToe('taak_dagen', nieuw);
    setTotK('');
  };
  const afbraak = (f.d.taken || []).find((x) => x.ouder_id === t.id && x.relatie === 'afbraak');
  const maakAfbraak = async () => {
    const titel = `Afbraak ${t.titel.replace(/^(opbouw|bouw|plaatsen|plaatsing|levering)\s*/i, '')}`;
    const n = await f.voegToe('taken', { titel, soort: t.soort, ouder_id: t.id, relatie: 'afbraak', wie_persoon_id: t.wie_persoon_id, wie_leverancier_id: t.wie_leverancier_id, wie_tekst: t.wie_tekst, waar_tekst: t.waar_tekst });
    if (!n) return;
    await f.voegToe('taak_dagen', { taak_id: n.id, anker: 'einde', dag: 1, uitvoerder_persoon_id: dagen[0]?.uitvoerder_persoon_id || null });
    if (kop.length) await f.voegToe('taak_koppelingen', kop.map(({ soort, item_id, groep_id, laag_id, laaggroep, label: lb }) => ({ taak_id: n.id, soort, item_id, groep_id, laag_id, laaggroep, label: lb })));
    f.meld('Afbraak toegevoegd op D+1, zelfde plek en uitvoerder');
  };
  const ouder = t.ouder_id && (f.d.taken || []).find((x) => x.id === t.ouder_id);

  // Koppelen met de kaart
  const zoekQ = zoekItem.trim().toLowerCase();
  const treffers = zoekQ ? f.items.filter((i) => (i.naam || '').toLowerCase().includes(zoekQ)).slice(0, 8) : [];
  const groepen = [...new Set(f.items.map((i) => i.groep_id).filter(Boolean))];
  const laaggroepen = [...new Set(f.lagen.map((l) => l.map).filter(Boolean))];
  const koppel = (rij) => f.voegToe('taak_koppelingen', { taak_id: t.id, ...rij });
  const woorden = t.titel.toLowerCase().split(/[^a-z0-9à-ÿ]+/).filter((x) => x.length > 3 && !['opbouw', 'plaatsen', 'afbraak', 'levering', 'ophalen'].includes(x));
  const voorstel = woorden.length ? f.items.filter((i) => i.naam && woorden.some((wd) => i.naam.toLowerCase().includes(wd)) && !kop.some((k) => k.item_id === i.id)).slice(0, 4) : [];

  const verwijder = async () => {
    if (!(await bevestig(`Taak "${t.titel}" verwijderen, met al haar dagen?`, { ok: 'Verwijderen', gevaar: true }))) return;
    await f.wis('taken', t.id); onSluit();
  };

  return (
    <Paneel titel={t.titel} sub={[t.soort, t.relatie === 'afbraak' ? 'Afbraak' : null].filter(Boolean).join(' · ') || 'Taak'} onSluit={onSluit}
      voet={<>{s && <button className="t-knop gevaar" onClick={verwijder}>Verwijderen</button>}<span style={{ flex: 1 }} /><button className="t-knop hoofd" onClick={onSluit}>Klaar</button></>}>
      <div className="pf-blok">
        <label className="pf-veld"><span className="t-label">Taak</span><Bewaarveld klasse="t-veld" waarde={t.titel} uit={!s} label="Taak" onBewaar={(v) => v.trim() && w({ titel: v.trim() })} /></label>
        <div className="pf-velden">
          <label><span className="t-label">Soort</span><Bewaarveld klasse="t-veld" waarde={t.soort || ''} uit={!s} label="Soort" placeholder="bv. Gemeente" onBewaar={(v) => w({ soort: v.trim() || null })} /></label>
          <label><span className="t-label">Verantwoordelijk</span><Kiezer waarde={t.wie_persoon_id} opties={persOpties} uit={!s} label="Verantwoordelijke" onChange={(v) => w({ wie_persoon_id: v })} /></label>
        </div>
        <div className="pf-velden">
          <label><span className="t-label">Uitvoerder (leverancier)</span><Kiezer waarde={t.wie_leverancier_id} opties={levOpties} leeg="Geen" uit={!s} label="Leverancier" onChange={(v) => w({ wie_leverancier_id: v })} /></label>
          <label><span className="t-label">Of vrij</span><Bewaarveld klasse="t-veld" waarde={t.wie_tekst || ''} uit={!s} label="Wie, vrij" placeholder="Team Wevelgem, 4 CW" onBewaar={(v) => w({ wie_tekst: v.trim() || null })} /></label>
        </div>
        <label className="pf-veld"><span className="t-label">Info</span><Bewaartekst waarde={t.info || ''} uit={!s} label="Info" onBewaar={(v) => w({ info: v.trim() || null })} rijen={2} /></label>
      </div>

      {t.voorbereiding ? (
        <div className="pf-blok"><b>Deadline</b>
          <select className="t-veld" value={t.deadline_dag != null ? sleutel(t.deadline_anker, t.deadline_dag) : ''} disabled={!s} onChange={(e) => { const x = e.target.value ? uitSleutel(e.target.value) : null; w({ deadline_anker: x?.anker || null, deadline_dag: x ? x.dag : null }); }} aria-label="Deadline">
            <option value="">Geen deadline</option>
            {dagLijst(f.plan, [{ anker: 'start', dag: -60 }]).filter((x) => x.dag <= 0 && x.anker === 'start').map((x) => <option key={x.k} value={x.k}>{dagNaam(f.plan, x.anker, x.dag)}</option>)}
          </select>
          {s && <button className="pf-link" onClick={async () => { await w({ voorbereiding: false }); if (!dagen.length) await f.voegToe('taak_dagen', { taak_id: t.id, anker: 'start', dag: -1 }); }}>Op een dag zetten</button>}
        </div>
      ) : (
        <div className="pf-blok"><b>Wanneer</b>
          {dagen.map((d) => {
            const k = sleutel(...Object.values(canoniek(f.plan, d.anker, d.dag)));
            return (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) 70px 70px', gap: 6, alignItems: 'end', paddingBottom: 6, borderBottom: '1px solid #EEF1F5' }}>
                <label className="pf-veld"><span className="t-label">Dag</span>
                  <select className="t-veld" value={k} disabled={!s} onChange={(e) => zetDag(d, e.target.value)} aria-label="Dag">{lijst.map((x) => <option key={x.k} value={x.k}>{dagNaam(f.plan, x.anker, x.dag)}</option>)}</select></label>
                <label className="pf-veld"><span className="t-label">Van</span><Bewaarveld klasse="t-veld" waarde={uurKort(d.uur_van)} uit={!s} label="Van" placeholder="uur" onBewaar={(v) => { const u = leesUur(v); if (v && !u) return f.meld('Uur niet herkend, bv. 07:30'); f.wijzig('taak_dagen', d.id, { uur_van: u }); }} /></label>
                <label className="pf-veld"><span className="t-label">Tot</span><Bewaarveld klasse="t-veld" waarde={uurKort(d.uur_tot)} uit={!s} label="Tot" placeholder="uur" onBewaar={(v) => { const u = leesUur(v); if (v && !u) return f.meld('Uur niet herkend, bv. 17:00'); f.wijzig('taak_dagen', d.id, { uur_tot: u }); }} /></label>
                <div className="pf-rij" style={{ gridColumn: '1 / -1' }}>
                  <StatusKeuze waarde={d.status} opties={STATUS_TAAK} uit={!s} label="Status" onChange={(v) => f.wijzig('taak_dagen', d.id, { status: v, klaar_op: v === 'klaar' ? new Date().toISOString() : null })} />
                  <span style={{ flex: 1, minWidth: 140 }}><Kiezer waarde={d.uitvoerder_persoon_id} opties={persOpties} uit={!s} label="Uitvoerder op deze dag" leeg="Uitvoerder: zelfde als taak" onChange={(v) => f.wijzig('taak_dagen', d.id, { uitvoerder_persoon_id: v })} /></span>
                  {s && dagen.length > 1 && <button className="t-knop klein stil" onClick={() => f.wis('taak_dagen', d.id)}>Dag weg</button>}
                </div>
              </div>
            );
          })}
          {s && <>
            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) auto', gap: 6, alignItems: 'center' }}>
              <span className="pf-stil">tot en met</span>
              <select className="t-veld" value={totK} onChange={(e) => setTotK(e.target.value)} aria-label="Reeks tot en met"><option value="">Kies de laatste dag</option>{lijst.map((x) => <option key={x.k} value={x.k}>{dagNaam(f.plan, x.anker, x.dag)}</option>)}</select>
              <button className="t-knop klein" onClick={reeks} disabled={!totK}>Reeks</button>
            </div>
            <div className="pf-rij"><span className="pf-stil">Losse dag erbij</span><select className="t-veld" style={{ flex: 1 }} value="" onChange={(e) => e.target.value && voegDagToe(e.target.value)} aria-label="Losse dag toevoegen"><option value="">Kies een dag</option>{lijst.map((x) => <option key={x.k} value={x.k}>{dagNaam(f.plan, x.anker, x.dag)}</option>)}</select></div>
          </>}
          {dagen.length > 1 && <div className="t-melding">Op {dagen.length} dagen: {dagen.map((d) => label(f.plan, d.anker, d.dag)).join(', ')}. Elke dag heeft een eigen status en uur.</div>}
          <div className="pf-stil pf-klein">Bewaard tegenover de wedstrijddag{wedstrijd(f.plan) ? '' : ' (nog niet ingesteld)'}: schuift mee naar een volgende editie.</div>
          {s && <button className="pf-link" onClick={() => w({ voorbereiding: true })}>Naar voorbereiding (zonder dag)</button>}
        </div>
      )}

      <div className="pf-blok"><b>Hoort bij</b>
        {ouder && <div className="pf-lijstknop" style={{ cursor: 'default' }}><b>{t.relatie === 'afbraak' ? 'Afbraak van' : 'Hoort bij'}: {ouder.titel}</b></div>}
        {!t.ouder_id && (afbraak
          ? <div className="pf-lijstknop" style={{ cursor: 'default', background: '#F7FBFF', borderColor: '#108AED' }}><b>{afbraak.titel}</b><span>Afbraak, gekoppeld aan deze taak</span></div>
          : s && <div className="pf-rij"><button className="t-knop klein" onClick={maakAfbraak}>Afbraak toevoegen</button><span className="pf-stil pf-klein">Zelfde plek en uitvoerder, op D+1.</span></div>)}
        <label className="pf-veld"><span className="t-label">Na levering (bv. plaatsing na levering trailer)</span>
          <Kiezer waarde={t.levering_id} opties={leveringen} leeg="Geen levering" uit={!s} label="Levering" onChange={(v) => w({ levering_id: v, relatie: v ? (t.relatie || 'plaatsing') : (t.relatie === 'plaatsing' ? null : t.relatie) })} /></label>
      </div>

      <div className="pf-blok"><b>Waar</b>
        {kop.map((k) => {
          const naam = (k.item_id && itemMap.get(k.item_id)?.naam) || (k.laag_id && `Laag ${laagMap.get(k.laag_id)?.naam || ''}`) || (k.laaggroep && `Laaggroep ${k.laaggroep}`) || (k.soort === 'groep' && `Groep ${k.label || ''}`) || null;
          return (
            <div key={k.id} className="pf-rij" style={{ flexWrap: 'nowrap' }}>
              <span style={{ flex: 1 }} className={naam ? '' : 'pf-let'}>{naam || `${k.label || 'Koppeling'} · niet meer op de kaart`}</span>
              {k.item_id && <a className="pf-link" href={`/maps/${f.plan.id}?item=${k.item_id}`}>Op de kaart</a>}
              {s && <button className="t-knop klein stil" onClick={() => f.wis('taak_koppelingen', k.id)}>Los</button>}
            </div>
          );
        })}
        {s && voorstel.length > 0 && <div className="pf-blok" style={{ gap: 4 }}><span className="pf-stil pf-klein">Voorstellen uit het plan op basis van de naam:</span>
          {voorstel.map((i) => <button key={i.id} className="pf-lijstknop" onClick={() => koppel({ soort: 'item', item_id: i.id, label: i.naam })}><b>{i.naam}</b><span>{laagMap.get(i.laag_id)?.naam || (i.vast ? 'Vast item van de locatie' : '')}</span></button>)}</div>}
        {s && <>
          <input className="t-veld" value={zoekItem} onChange={(e) => setZoekItem(e.target.value)} placeholder="Zoek een item op de kaart" aria-label="Zoek een item" />
          {treffers.map((i) => <button key={i.id} className="pf-lijstknop" onClick={() => { koppel({ soort: 'item', item_id: i.id, label: i.naam }); setZoekItem(''); }}><b>{i.naam}</b><span>{laagMap.get(i.laag_id)?.naam || ''}</span></button>)}
          <div className="pf-velden">
            <label><span className="t-label">Hele laag</span><select className="t-veld" value="" onChange={(e) => e.target.value && koppel({ soort: 'laag', laag_id: e.target.value, label: laagMap.get(e.target.value)?.naam })} aria-label="Laag"><option value="">Kies…</option>{f.lagen.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}</select></label>
            {laaggroepen.length > 0 && <label><span className="t-label">Laaggroep</span><select className="t-veld" value="" onChange={(e) => e.target.value && koppel({ soort: 'laaggroep', laaggroep: e.target.value, label: e.target.value })} aria-label="Laaggroep"><option value="">Kies…</option>{laaggroepen.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>}
            {groepen.length > 0 && <label><span className="t-label">Groep</span><select className="t-veld" value="" onChange={(e) => { const g = e.target.value; if (!g) return; const n = f.items.filter((i) => i.groep_id === g); koppel({ soort: 'groep', groep_id: g, label: `${n[0]?.naam || 'groep'} (${n.length})` }); }} aria-label="Groep"><option value="">Kies…</option>{groepen.map((g) => { const n = f.items.filter((i) => i.groep_id === g); return <option key={g} value={g}>{n[0]?.naam || 'Groep'} · {n.length} items</option>; })}</select></label>}
          </div>
          <label className="pf-veld"><span className="t-label">Of vrij (zonder kaart)</span><Bewaarveld klasse="t-veld" waarde={t.waar_tekst || ''} label="Waar, vrij" placeholder="bv. centrum Wevelgem" onBewaar={(v) => w({ waar_tekst: v.trim() || null })} /></label>
        </>}
      </div>
    </Paneel>
  );
}
