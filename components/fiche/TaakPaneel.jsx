'use client';

// Een taak openen: titel, soort, wie, dagen (reeks en losse dagen, elk met uur, status en uitvoerder),
// afbraak, levering waar ze bij hoort, en waar op de kaart (item, groep, laag, laaggroep).
import { useState } from 'react';
import { Paneel, Bewaarveld, Bewaartekst, StatusKeuze, STATUS_TAAK, Kiezer, Keuze, DagKiezer } from './gedeeld';
import { dagLijst, dagNaam, canoniek, sleutel, uurKort, leesUur, wedstrijd, volgorde } from './dagen';
import { opId } from './data';
import { momentNaam } from './bestelling';
import RijKaart from './RijKaart';
import { bevestig } from '../maps/dialoog';

export default function TaakPaneel({ f, taakId, onSluit, naast = false, vorige = null, volgende = null }) {
  const t = (f.d.taken || []).find((x) => x.id === taakId);
  const [extra, setExtra] = useState(null);   // 'dag' of 'reeks': het datumveld onder de knoppen
  const dagen = (f.d.taak_dagen || []).filter((d) => d.taak_id === taakId).sort((a, b) => (a.anker === b.anker ? a.dag - b.dag : a.anker === 'start' ? -1 : 1));
  const kop = (f.d.taak_koppelingen || []).filter((k) => k.taak_id === taakId);
  if (!t) return null;
  const s = f.schrijven;
  const w = (patch) => f.wijzig('taken', t.id, patch);
  const itemMap = opId(f.items); const laagMap = opId(f.lagen);
  const personen = [...(f.d.personen || [])].sort((a, b) => a.naam.localeCompare(b.naam));
  const team = (f.d.site_rollen || []).map((r) => personen.find((p) => p.id === r.persoon_id)).filter(Boolean);
  const andere = personen.filter((p) => !team.includes(p));
  const persOpties = [...team.map((p) => ({ id: p.id, naam: `${p.naam} (team)` })), ...andere];
  const opSite = new Set((f.d.site_leveranciers || []).map((sl) => sl.leverancier_id));
  const levOpties = [...f.d.leveranciers].filter((l) => l.actief !== false || opSite.has(l.id)).sort((a, b) => (opSite.has(b.id) - opSite.has(a.id)) || a.naam.localeCompare(b.naam)).map((l) => ({ id: l.id, naam: l.naam, groep: opSite.has(l.id) ? 'Leveranciers van deze site' : 'Andere leveranciers' }));
  const slMap = opId(f.d.site_leveranciers); const levMap = opId(f.d.leveranciers);
  const leveringen = (f.d.leveringen || []).map((l) => ({ id: l.id, naam: `${momentNaam(l)} ${levMap.get(slMap.get(l.site_leverancier_id)?.leverancier_id)?.naam || ''} · ${dagNaam(f.plan, l.anker, l.dag)}${l.wat ? ` · ${l.wat}` : ''}` }));

  const k = (x) => { const c = canoniek(f.plan, x.anker, x.dag); return sleutel(c.anker, c.dag); };
  const zetDag = (d, x) => f.wijzig('taak_dagen', d.id, canoniek(f.plan, x.anker, x.dag));
  const voegDagToe = async (x) => {
    if (dagen.some((d) => k(d) === k(x))) return f.meld('Die dag staat er al bij');
    const eerste = dagen[0];
    await f.voegToe('taak_dagen', { taak_id: t.id, ...canoniek(f.plan, x.anker, x.dag), uur_van: eerste?.uur_van || null, uur_tot: eerste?.uur_tot || null, uitvoerder_persoon_id: eerste?.uitvoerder_persoon_id || null });
  };
  // Reeks: elke dag van de eerste dag tot en met de gekozen dag.
  const reeks = async (tot) => {
    if (!tot || !dagen.length) return;
    const start = dagen[0];
    if (volgorde(f.plan, tot, start) <= 0) return f.meld('Kies een dag na de eerste dag');
    const bestaand = new Set(dagen.map(k));
    const tussen = wedstrijd(f.plan)
      ? dagLijst(f.plan, [start, tot]).filter((x) => volgorde(f.plan, x, start) > 0 && volgorde(f.plan, x, tot) <= 0)
      : Array.from({ length: Math.max(0, tot.dag - start.dag) }, (_, n) => ({ anker: 'start', dag: start.dag + n + 1 }));
    const nieuw = tussen.filter((x) => !bestaand.has(k(x))).map((x) => ({ taak_id: t.id, anker: x.anker, dag: x.dag, uur_van: start.uur_van, uur_tot: start.uur_tot, uitvoerder_persoon_id: start.uitvoerder_persoon_id }));
    if (nieuw.length) await f.voegToe('taak_dagen', nieuw);
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
  const groepen = [...new Set(f.items.map((i) => i.groep_id).filter(Boolean))];
  const laaggroepen = [...new Set(f.lagen.map((l) => l.map).filter(Boolean))];
  const koppel = (rij) => f.voegToe('taak_koppelingen', { taak_id: t.id, ...rij });
  const waarOpties = [
    ...f.lagen.map((l) => ({ id: `laag:${l.id}`, naam: l.naam, groep: 'Hele laag' })),
    ...laaggroepen.map((g) => ({ id: `map:${g}`, naam: g, groep: 'Laaggroep' })),
    ...groepen.map((g) => { const n = f.items.filter((i) => i.groep_id === g); return { id: `groep:${g}`, naam: `${n[0]?.naam || 'Groep'} (${n.length} items)`, groep: 'Groep op de kaart' }; }),
    ...f.items.filter((i) => i.naam && !kop.some((x) => x.item_id === i.id)).map((i) => ({ id: `item:${i.id}`, naam: i.naam, sub: laagMap.get(i.laag_id)?.naam || (i.vast ? 'Vast item van de locatie' : ''), groep: 'Item op de kaart' })),
  ];
  const kiesWaar = (id) => {
    if (!id) return;
    const [soort, ...rest] = id.split(':'); const v = rest.join(':');
    if (soort === 'laag') koppel({ soort: 'laag', laag_id: v, label: laagMap.get(v)?.naam });
    else if (soort === 'map') koppel({ soort: 'laaggroep', laaggroep: v, label: v });
    else if (soort === 'groep') { const n = f.items.filter((i) => i.groep_id === v); koppel({ soort: 'groep', groep_id: v, label: `${n[0]?.naam || 'groep'} (${n.length})` }); }
    else if (soort === 'item') koppel({ soort: 'item', item_id: v, label: itemMap.get(v)?.naam });
  };
  const woorden = t.titel.toLowerCase().split(/[^a-z0-9à-ÿ]+/).filter((x) => x.length > 3 && !['opbouw', 'plaatsen', 'afbraak', 'levering', 'ophalen'].includes(x));
  const voorstel = woorden.length ? f.items.filter((i) => i.naam && woorden.some((wd) => i.naam.toLowerCase().includes(wd)) && !kop.some((k) => k.item_id === i.id)).slice(0, 4) : [];

  // De items achter de koppelingen, voor de luchtfoto.
  const kaartIds = [...new Set(kop.flatMap((k) => (k.item_id ? [k.item_id] : k.laag_id ? f.items.filter((i) => i.laag_id === k.laag_id).map((i) => i.id) : k.soort === 'groep' && k.groep_id ? f.items.filter((i) => i.groep_id === k.groep_id).map((i) => i.id) : k.laaggroep ? f.items.filter((i) => laagMap.get(i.laag_id)?.map === k.laaggroep).map((i) => i.id) : [])))];
  const verwijder = async () => {
    if (!(await bevestig(`Taak "${t.titel}" verwijderen, met al haar dagen?`, { ok: 'Verwijderen', gevaar: true }))) return;
    await f.wis('taken', t.id); onSluit();
  };

  return (
    <Paneel naast={naast} knoppen={(vorige || volgende) && <><button className="pf-sluit" onClick={vorige || undefined} disabled={!vorige} aria-label="Vorige taak">‹</button><button className="pf-sluit" onClick={volgende || undefined} disabled={!volgende} aria-label="Volgende taak">›</button></>} titel={t.titel} sub={[t.soort, t.relatie === 'afbraak' ? 'Afbraak' : null].filter(Boolean).join(' · ') || 'Taak'} onSluit={onSluit}
      voet={<>{s && <button className="t-knop gevaar" onClick={verwijder}>Verwijderen</button>}<span style={{ flex: 1 }} /><button className="t-knop hoofd" onClick={onSluit}>Klaar</button></>}>
      <div className="pf-blok">
        <label className="pf-veld"><span className="t-label">Taak</span><Bewaarveld klasse="t-veld" waarde={t.titel} uit={!s} label="Taak" onBewaar={(v) => v.trim() && w({ titel: v.trim() })} /></label>
        <div className="pf-velden">
          <label><span className="t-label">Soort</span><Bewaarveld klasse="t-veld" waarde={t.soort || ''} uit={!s} label="Soort" placeholder="bv. Gemeente" onBewaar={(v) => w({ soort: v.trim() || null })} /></label>
          <label><span className="t-label">Verantwoordelijk</span><Kiezer waarde={t.wie_persoon_id} opties={persOpties} uit={!s} label="Verantwoordelijke" onChange={(v) => w({ wie_persoon_id: v })} /></label>
        </div>
        <div className="pf-velden">
          <label style={{ gridColumn: '1 / -1' }}><span className="t-label">Uitvoerder · leverancier of vrije tekst</span>
            <Keuze waarde={t.wie_leverancier_id} opties={levOpties} vrij tekst={t.wie_tekst || ''} uit={!s} label="Uitvoerder" placeholder="Kies een leverancier of typ (bv. Team Wevelgem, 4 CW)" leeg="Geen uitvoerder"
              onChange={(v) => w(v ? { wie_leverancier_id: v, wie_tekst: null } : { wie_leverancier_id: null })} onVrij={(v) => w({ wie_tekst: v || null })} style={{ width: '100%' }} /></label>
        </div>
        <label className="pf-veld"><span className="t-label">Info</span><Bewaartekst waarde={t.info || ''} uit={!s} label="Info" onBewaar={(v) => w({ info: v.trim() || null })} rijen={2} /></label>
      </div>

      {t.voorbereiding ? (
        <div className="pf-blok"><b>Deadline</b>
          <DagKiezer plan={f.plan} anker={t.deadline_anker} dag={t.deadline_dag} uit={!s} leeg label="Deadline" onChange={(x) => w({ deadline_anker: x?.anker || null, deadline_dag: x ? x.dag : null })} />
          {s && <button className="pf-link" onClick={async () => { await w({ voorbereiding: false }); if (!dagen.length) await f.voegToe('taak_dagen', { taak_id: t.id, anker: 'start', dag: -1 }); }}>Op een dag zetten</button>}
        </div>
      ) : (
        <div className="pf-blok"><b>Wanneer</b>
          {dagen.map((d) => (
            <div key={d.id} className="pf-dagregel">
              <DagKiezer plan={f.plan} anker={d.anker} dag={d.dag} uit={!s} label="Dag" onChange={(x) => zetDag(d, x)} />
              <Bewaarveld klasse="t-veld" waarde={uurKort(d.uur_van)} uit={!s} label="Van" placeholder="van" onBewaar={(v) => { const u = leesUur(v); if (v && !u) return f.meld('Uur niet herkend, bv. 07:30'); f.wijzig('taak_dagen', d.id, { uur_van: u }); }} />
              <Bewaarveld klasse="t-veld" waarde={uurKort(d.uur_tot)} uit={!s} label="Tot" placeholder="tot" onBewaar={(v) => { const u = leesUur(v); if (v && !u) return f.meld('Uur niet herkend, bv. 17:00'); f.wijzig('taak_dagen', d.id, { uur_tot: u }); }} />
              <StatusKeuze waarde={d.status} opties={STATUS_TAAK} uit={!s} label="Status" onChange={(v) => f.wijzig('taak_dagen', d.id, { status: v, klaar_op: v === 'klaar' ? new Date().toISOString() : null })} />
              {s && dagen.length > 1 ? <button className="pf-sluit klein" onClick={() => f.wis('taak_dagen', d.id)} aria-label="Deze dag weghalen">✕</button> : <span />}
              {d.uitvoerder_persoon_id && <span className="pf-dagwie"><Kiezer waarde={d.uitvoerder_persoon_id} opties={persOpties} uit={!s} label="Uitvoerder op deze dag" leeg="Uitvoerder: zelfde als taak" onChange={(v) => f.wijzig('taak_dagen', d.id, { uitvoerder_persoon_id: v })} /></span>}
            </div>
          ))}
          {s && <div className="pf-rij" style={{ gap: 6 }}>
            <button className={`t-knop klein ${extra === 'dag' ? 'aan' : ''}`} onClick={() => setExtra(extra === 'dag' ? null : 'dag')}>+ Dag</button>
            {dagen.length > 0 && <button className={`t-knop klein ${extra === 'reeks' ? 'aan' : ''}`} onClick={() => setExtra(extra === 'reeks' ? null : 'reeks')}>Reeks tot…</button>}
            {!t.ouder_id && !afbraak && <button className="t-knop klein" onClick={maakAfbraak}>Afbraak toevoegen</button>}
            <span className="pf-vul" />
            <button className="pf-link pf-klein" onClick={() => w({ voorbereiding: true })}>Zonder dag</button>
          </div>}
          {extra && <div className="pf-rij" style={{ flexWrap: 'nowrap' }}><span className="pf-stil" style={{ flex: 'none' }}>{extra === 'dag' ? 'Dag erbij' : 'Elke dag tot en met'}</span>
            <DagKiezer plan={f.plan} leeg label={extra === 'dag' ? 'Dag toevoegen' : 'Reeks tot en met'} style={{ flex: 1 }} onChange={async (x) => { if (!x) return; if (extra === 'dag') await voegDagToe(x); else await reeks(x); setExtra(null); }} /></div>}
        </div>
      )}

      <div className="pf-blok"><b>Hoort bij</b>
        {ouder && <div className="pf-lijstknop" style={{ cursor: 'default' }}><b>{t.relatie === 'afbraak' ? 'Afbraak van' : 'Hoort bij'}: {ouder.titel}</b></div>}
        {!t.ouder_id && (afbraak
          ? <div className="pf-lijstknop" style={{ cursor: 'default', background: '#F7FBFF', borderColor: '#108AED' }}><b>{afbraak.titel}</b><span>Afbraak, gekoppeld aan deze taak</span></div>
          : null)}
        <label className="pf-veld"><span className="t-label">Na levering</span>
          <Kiezer waarde={t.levering_id} opties={leveringen} leeg="Geen levering" uit={!s} label="Levering" onChange={(v) => w({ levering_id: v, relatie: v ? (t.relatie || 'plaatsing') : (t.relatie === 'plaatsing' ? null : t.relatie) })} /></label>
      </div>

      <div className="pf-blok"><b>Waar</b>
        {kop.length > 0 && <div className="pf-pillen">{kop.map((k) => {
          const naam = (k.item_id && itemMap.get(k.item_id)?.naam) || (k.laag_id && `Laag ${laagMap.get(k.laag_id)?.naam || ''}`) || (k.laaggroep && `Laaggroep ${k.laaggroep}`) || (k.soort === 'groep' && `Groep ${k.label || ''}`) || null;
          return <span key={k.id} className={`pf-pil ${naam ? '' : 'let'}`}>{naam || `${k.label || 'Koppeling'} · niet meer op de kaart`}{s && <button onClick={() => f.wis('taak_koppelingen', k.id)} aria-label="Loskoppelen">✕</button>}</span>;
        })}</div>}
        {kaartIds.length > 0 && <RijKaart plan={f.plan} items={f.items} lagen={f.lagen} elementen={f.elementen} ids={kaartIds} />}
        {s && voorstel.length > 0 && <div className="pf-blok" style={{ gap: 4 }}><span className="pf-stil pf-klein">Voorstellen uit het plan op basis van de naam:</span>
          {voorstel.map((i) => <button key={i.id} className="pf-lijstknop" onClick={() => koppel({ soort: 'item', item_id: i.id, label: i.naam })}><b>{i.naam}</b><span>{laagMap.get(i.laag_id)?.naam || (i.vast ? 'Vast item van de locatie' : '')}</span></button>)}</div>}
        {s && <>
          <Keuze waarde={null} opties={waarOpties} vrij tekst={t.waar_tekst || ''} label="Waar" leeg="Vrije tekst wissen" placeholder="Zoek een item, laag of groep op de kaart, of typ een plaats"
            onChange={kiesWaar} onVrij={(v) => w({ waar_tekst: v || null })} style={{ width: '100%' }} />
        </>}
      </div>
    </Paneel>
  );
}
