'use client';

// Planning van de site: taken per dag (een taak kan op meerdere dagen staan), leveringen
// en ophalingen van leveranciers, en het programma van de wedstrijd.
import { useMemo, useState } from 'react';
import { dagLijst, label, dagNaam, isoWeek, sleutel, uitSleutel, canoniek, uurKort, leesUur, wedstrijd, fase, FASE_NAAM, datumTekst } from './dagen';
import { locatieTekst, momentNaam, momentDagen, namenTekst, bestelRijen } from './bestelling';
import { StatusKeuze, STATUS_TAAK, Seg, Chips, Bewaarveld, TabNotities, DagKiezer } from './gedeeld';
import { opId } from './data';
import TaakPaneel from './TaakPaneel';
import { bevestig } from '../maps/dialoog';

const DEEL = ['Voormiddag', 'Namiddag', 'Avond', 'Zonder uur'];
const deelVan = (u) => { if (!u) return 3; const h = Number(String(u).slice(0, 2)); return h < 12 ? 0 : h < 18 ? 1 : 2; };
const opUur = (a, b) => String(a.uur || '99').localeCompare(String(b.uur || '99'));

export function wieTekst(t, d, f) {
  const p = opId(f.d.personen); const l = opId(f.d.leveranciers);
  return p.get(d?.uitvoerder_persoon_id)?.naam || p.get(t.wie_persoon_id)?.naam || l.get(t.wie_leverancier_id)?.naam || t.wie_tekst || '';
}
export function waarTekst(t, f) {
  const k = (f.d.taak_koppelingen || []).filter((x) => x.taak_id === t.id);
  const it = opId(f.items); const lg = opId(f.lagen);
  const namen = k.map((x) => (x.item_id && it.get(x.item_id)?.naam) || (x.laag_id && lg.get(x.laag_id)?.naam) || x.laaggroep || x.label).filter(Boolean);
  return { tekst: namen.length ? namen.join(', ') : (t.waar_tekst || ''), verloren: k.some((x) => !x.item_id && !x.laag_id && !x.laaggroep && x.soort !== 'groep'), gekoppeld: k.length > 0 };
}

export default function TabPlanning({ f, planId }) {
  const { plan } = f;
  const [sub, setSub] = useState('opbouw');
  const [weerg, setWeerg] = useState(() => (wedstrijd(plan) ? 'dag' : 'alles'));
  const [dagK, setDagK] = useState(null);
  const [soort, setSoort] = useState('Alles');
  const [enkelOpen, setEnkelOpen] = useState(false);
  const [toonProg, setToonProg] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [levOpen, setLevOpen] = useState(() => new Set());   // opengeklapte leveringen en opbouw
  const [open, setOpen] = useState(null);

  const taken = f.d.taken || [];
  const takenMap = useMemo(() => opId(taken), [taken]);
  const dagen = (f.d.taak_dagen || []).filter((d) => takenMap.has(d.taak_id));
  const slMap = opId(f.d.site_leveranciers); const levMap = opId(f.d.leveranciers);
  const leveringen = (f.d.leveringen || []).map((l) => ({ ...l, lev: levMap.get(slMap.get(l.site_leverancier_id)?.leverancier_id) }));
  const programma = f.d.programma || [];
  // Wat en waar van een levering uit de bestelregels die ernaar verwijzen.
  const regelsBij = (l) => (f.d.bestelregels || []).filter((r) => r.levering_id === l.id || r.ophaling_id === l.id);
  const regelTekst = (l) => { const rs = regelsBij(l); return rs.map((r) => `${r.aantal != null ? `${Number(r.aantal)} × ` : ''}${r.wat}`).join(' · '); };
  // Namen van de items (CAM 1, CAM 2) bij een moment; de telling per leverancier en per moment één keer per weergave.
  const rijenPerSl = new Map(); const namenPerMoment = new Map();
  const regelNamen = (l) => {
    if (namenPerMoment.has(l.id)) return namenPerMoment.get(l.id);
    const sl = slMap.get(l.site_leverancier_id); const rs = regelsBij(l); let t = '';
    if (sl && rs.length) { if (!rijenPerSl.has(sl.id)) rijenPerSl.set(sl.id, bestelRijen(f, sl).rijen); const ids = new Set(rs.map((r) => r.id)); t = namenTekst([...new Set(rijenPerSl.get(sl.id).filter((x) => ids.has(x.r.id)).flatMap((x) => x.namen || []))], 16); }
    namenPerMoment.set(l.id, t); return t;
  };
  const regelPlaats = (l) => [...new Set(regelsBij(l).map((r) => locatieTekst(f, r)).filter(Boolean))].join(', ');

  const lijst = useMemo(() => dagLijst(plan, [...dagen, ...leveringen.flatMap((l) => momentDagen(plan, l)), ...programma, { anker: 'start', dag: 0 }, ...(dagK ? [uitSleutel(dagK)] : [])]), [plan, dagen, leveringen, programma, dagK]);
  const huidig = lijst.find((x) => x.k === dagK) || lijst.find((x) => x.k === 'start:0') || lijst[0];
  const idx = Math.max(0, lijst.indexOf(huidig));
  const metWeek = !!wedstrijd(plan);
  const inBereik = (x) => weerg === 'alles' || (weerg === 'week' ? (metWeek ? isoWeek(x.datum) === isoWeek(huidig.datum) && Math.abs(x.datum - huidig.datum) < 8 * 864e5 : true) : x.k === huidig.k);
  const bereik = lijst.filter(inBereik);
  const bereikK = new Set(bereik.map((x) => x.k));

  const soorten = ['Alles', ...new Set([...taken.map((t) => t.soort).filter(Boolean), ...(leveringen.length ? ['Levering'] : [])])];
  const filt = (t, d) => (soort === 'Alles' || t.soort === soort) && (!enkelOpen || d.status !== 'klaar');

  const rijen = [];
  for (const d of dagen) {
    const c = canoniek(plan, d.anker, d.dag); const k = sleutel(c.anker, c.dag);
    const t = takenMap.get(d.taak_id);
    if (bereikK.has(k) && !t.voorbereiding && filt(t, d)) rijen.push({ soort: 'taak', k, uur: uurKort(d.uur_van), d, t });
  }
  // Een opbouw of afbraak over meerdere dagen staat op elke dag van de periode.
  if (soort === 'Alles' || soort === 'Levering') for (const l of leveringen) momentDagen(plan, l).forEach((c, n, alle) => {
    const k = sleutel(c.anker, c.dag);
    if (bereikK.has(k) && (!enkelOpen || l.status !== 'klaar')) rijen.push({ soort: 'levering', k, uur: uurKort(l.uur_van), l, n, van: alle.length });
  });
  if (toonProg && soort === 'Alles') for (const p of programma) {
    const c = canoniek(plan, p.anker, p.dag); const k = sleutel(c.anker, c.dag);
    if (bereikK.has(k)) rijen.push({ soort: 'prog', k, uur: uurKort(p.uur_van), p });
  }
  const groepen = weerg === 'dag'
    ? [0, 1, 2, 3].map((g) => ({ naam: DEEL[g], klas: g === 3 ? 'let-op' : '', rijen: rijen.filter((r) => deelVan(r.uur) === g).sort(opUur) })).filter((g) => g.rijen.length)
    : bereik.map((x) => ({ naam: `${dagNaam(plan, x.anker, x.dag)} · ${FASE_NAAM[fase(plan, x.anker, x.dag)]}`, rijen: rijen.filter((r) => r.k === x.k).sort(opUur) })).filter((g) => g.rijen.length);
  const takenInBereik = rijen.filter((r) => r.soort === 'taak');
  const nOpen = takenInBereik.filter((r) => r.d.status === 'open').length;

  const stap = (r) => {
    if (weerg === 'week' && metWeek) { const w = bereik; const ni = r > 0 ? lijst.indexOf(w[w.length - 1]) + 1 : lijst.indexOf(w[0]) - 1; setDagK(lijst[Math.min(lijst.length - 1, Math.max(0, ni))].k); }
    else setDagK(lijst[Math.min(lijst.length - 1, Math.max(0, idx + r))].k);
  };
  const titel = weerg === 'dag' ? `${dagNaam(plan, huidig.anker, huidig.dag)} · ${FASE_NAAM[fase(plan, huidig.anker, huidig.dag)]}`
    : weerg === 'week' && metWeek ? `Week ${isoWeek(huidig.datum)} · ${datumTekst(bereik[0].datum)} tot ${datumTekst(bereik[bereik.length - 1].datum)}`
      : lijst.length ? `${dagNaam(plan, lijst[0].anker, lijst[0].dag)} tot ${dagNaam(plan, lijst[lijst.length - 1].anker, lijst[lijst.length - 1].dag)}` : '';

  // Selectie (taakdagen)
  const selIds = [...sel].filter((id) => dagen.some((d) => d.id === id));
  const kies = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = {
    status: (st) => f.wijzig('taak_dagen', selIds, { status: st, klaar_op: st === 'klaar' ? new Date().toISOString() : null }),
    wie: (pid) => f.wijzig('taak_dagen', selIds, { uitvoerder_persoon_id: pid || null }),
    schuif: async (n) => {
      for (const id of selIds) { const d = dagen.find((x) => x.id === id); const c = canoniek(plan, d.anker, d.dag + n); await f.wijzig('taak_dagen', id, { anker: c.anker, dag: c.dag }); }
      if (weerg === 'dag') { const c = canoniek(plan, huidig.anker, huidig.dag + n); setDagK(sleutel(c.anker, c.dag)); }
      f.meld(`${selIds.length} ${selIds.length === 1 ? 'taak' : 'taken'} een dag ${n > 0 ? 'later' : 'vroeger'}`);
    },
    weg: async () => {
      if (!(await bevestig(`${selIds.length} ${selIds.length === 1 ? 'dag' : 'dagen'} van taken verwijderen? Een taak zonder dagen verdwijnt mee.`, { ok: 'Verwijderen', gevaar: true }))) return;
      const taakIds = new Set(dagen.filter((d) => selIds.includes(d.id)).map((d) => d.taak_id));
      await f.wis('taak_dagen', selIds);
      const leeg = [...taakIds].filter((tid) => !dagen.some((d) => d.taak_id === tid && !selIds.includes(d.id)));
      if (leeg.length) await f.wis('taken', leeg);
      setSel(new Set());
    },
  };

  const nieuweTaak = async () => {
    const t = await f.voegToe('taken', { titel: 'Nieuwe taak', soort: soort !== 'Alles' && soort !== 'Levering' ? soort : null });
    if (!t) return;
    const d = await f.voegToe('taak_dagen', { taak_id: t.id, anker: huidig?.anker || 'start', dag: huidig?.dag || 0 });
    if (d) setOpen(t.id);
  };

  const personen = f.d.personen || [];
  const team = new Set((f.d.site_rollen || []).map((r) => r.persoon_id));
  const wieOpties = [...personen].sort((a, b) => (team.has(b.id) - team.has(a.id)) || a.naam.localeCompare(b.naam));

  return (
    <div className="pf-romp">
      <div className="pf-rij">
        <Seg waarde={sub} onChange={setSub} label="Onderdeel" opties={[['opbouw', 'Opbouw tot afbraak'], ['voorbereiding', 'Voorbereiding'], ['programma', 'Programma']]} />
        <div className="pf-vul" />
        {sub === 'opbouw' && f.schrijven && <button className="t-knop hoofd" onClick={nieuweTaak}>Nieuwe taak</button>}
      </div>
      {!wedstrijd(plan) && <div className="t-melding let-op">De wedstrijddag van deze site is nog niet ingesteld (tab Info). Dagen staan voorlopig als D-2, D, D+1 zonder datum.</div>}

      {sub === 'opbouw' && <>
        <div className="pf-kaart" style={{ padding: '8px 12px', gap: 8 }}>
          <div className="pf-rij">
            <Seg waarde={weerg} onChange={setWeerg} label="Weergave" opties={[['dag', 'Dag'], ['week', 'Week'], ['alles', 'Alles']]} />
            {weerg !== 'alles' && <><button className="t-knop klein" onClick={() => stap(-1)} aria-label="Vorige">‹</button>
              <b style={{ fontWeight: 600, minWidth: 200 }}>{titel}</b>
              <button className="t-knop klein" onClick={() => stap(1)} aria-label="Volgende">›</button>
              <button className="t-knop klein" onClick={() => setDagK('start:0')}>Wedstrijddag</button></>}
            {weerg === 'alles' && <b style={{ fontWeight: 600 }}>{titel}</b>}
            <DagKiezer plan={plan} anker={huidig?.anker} dag={huidig?.dag} metLabel={false} label="Ga naar een dag" onChange={(x) => { const c = canoniek(plan, x.anker, x.dag); setDagK(sleutel(c.anker, c.dag)); if (weerg === 'alles') setWeerg('dag'); }} />
            <div className="pf-vul" />
            <span className="pf-stil">{takenInBereik.length} taken · {nOpen} open</span>
          </div>
        </div>
        <div className="pf-rij">
          <Chips waarde={soort} onChange={setSoort} opties={soorten.map((s) => [s, s])} />
          <label className="pf-rij" style={{ gap: 6, marginLeft: 8 }}><input type="checkbox" checked={enkelOpen} onChange={() => setEnkelOpen(!enkelOpen)} /> Enkel open</label>
          <label className="pf-rij" style={{ gap: 6, marginLeft: 8 }}><input type="checkbox" checked={toonProg} onChange={() => setToonProg(!toonProg)} /> Programma tonen</label>
        </div>
        {selIds.length > 0 && f.schrijven && (
          <div className="pf-bulk" role="toolbar" aria-label="Acties op de selectie">
            <b>{selIds.length} geselecteerd</b>
            {STATUS_TAAK.map(([k, n]) => <button key={k} className="pf-bknop" onClick={() => bulk.status(k)}>{n}</button>)}
            <span className="sep" />
            <label className="pf-rij" style={{ gap: 6, fontSize: 13 }}>Wie<select className="pf-bsel" value="" onChange={(e) => bulk.wie(e.target.value)} aria-label="Wie toewijzen"><option value="">Kies…</option>{wieOpties.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}</select></label>
            <span className="sep" />
            <button className="pf-bknop" onClick={() => bulk.schuif(-1)}>− 1 dag</button>
            <button className="pf-bknop" onClick={() => bulk.schuif(1)}>+ 1 dag</button>
            <span className="sep" />
            <button className="pf-bknop" onClick={bulk.weg}>Verwijderen</button>
            <span style={{ flex: 1 }} />
            <button className="pf-bknop" onClick={() => setSel(new Set())}>Selectie wissen</button>
          </div>
        )}
        <div className="pf-tabvak">
          <table className="pf-tabel" style={{ minWidth: 900 }}>
            <thead><tr><th style={{ width: 34 }} /><th style={{ width: 64 }}>Uur</th><th>Taak</th><th style={{ width: '20%' }}>Waar</th><th style={{ width: '16%' }}>Wie</th><th style={{ width: 130 }}>Status</th></tr></thead>
            <tbody>
              {!groepen.length && <tr><td colSpan={6} className="pf-leeg">Geen taken {weerg === 'dag' ? 'op deze dag' : 'in deze periode'}{f.schrijven ? '. Maak er een met Nieuwe taak.' : '.'}</td></tr>}
              {groepen.map((g) => {
                const ids = g.rijen.filter((r) => r.soort === 'taak').map((r) => r.d.id);
                const alle = ids.length > 0 && ids.every((id) => sel.has(id));
                return [
                  <tr key={`g${g.naam}`} className={`groep ${g.klas || ''}`}><td colSpan={6}>
                    <label className="pf-rij" style={{ gap: 8 }}>{f.schrijven && ids.length > 0 && <input type="checkbox" checked={alle} onChange={() => setSel((s) => { const n = new Set(s); ids.forEach((id) => (alle ? n.delete(id) : n.add(id))); return n; })} aria-label="Hele groep selecteren" />}{g.naam} · {ids.length} {ids.length === 1 ? 'taak' : 'taken'}</label>
                  </td></tr>,
                  ...g.rijen.map((r) => {
                    if (r.soort === 'prog') return <tr key={`p${r.p.id}`} className="prog"><td /><td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.uur || '–'}</td><td colSpan={4}><b>{r.p.wat}</b><small>Programma</small></td></tr>;
                    if (r.soort === 'levering') {
                      const l = r.l;
                      return (
                        <tr key={`l${l.id}-${r.n || 0}`}><td /><td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.uur || '–'}</td>
                          <td><b>{momentNaam(l)}{l.werk && slMap.get(l.site_leverancier_id)?.wat ? ` ${slMap.get(l.site_leverancier_id).wat}` : ''} · {l.lev?.naam || 'leverancier'}</b><small>{[r.van > 1 && `dag ${r.n + 1} van ${r.van}`, uurKort(l.uur_tot) && `tot ${uurKort(l.uur_tot)}`, l.wat || (regelsBij(l).length > 0 && `${regelsBij(l).length} ${regelsBij(l).length === 1 ? 'regel' : 'regels'}`)].filter(Boolean).join(' · ')}{regelsBij(l).length > 0 && <> · <button className="pf-link" style={{ fontSize: 'inherit' }} aria-expanded={levOpen.has(`${l.id}-${r.n || 0}`)} onClick={() => setLevOpen((v) => { const n = new Set(v); const k = `${l.id}-${r.n || 0}`; if (n.has(k)) n.delete(k); else n.add(k); return n; })}>{levOpen.has(`${l.id}-${r.n || 0}`) ? 'verbergen' : 'wat en waar'}</button></>}</small>
                            {levOpen.has(`${l.id}-${r.n || 0}`) && <><small>{regelTekst(l)}</small>{regelNamen(l) && <small>{regelNamen(l)}</small>}</>}</td>
                          <td>{(l.leverpunt_item_id && f.items.find((x) => x.id === l.leverpunt_item_id)?.naam) || l.leverpunt_tekst || regelPlaats(l) || <span className="pf-stil">Leverpunt ontbreekt</span>}</td>
                          <td>{l.lev?.naam}</td>
                          <td><StatusKeuze waarde={l.status} opties={STATUS_TAAK} uit={!f.schrijven} label="Status levering" onChange={(v) => f.wijzig('leveringen', l.id, { status: v })} /></td></tr>
                      );
                    }
                    const { t, d } = r; const w = waarTekst(t, f); const wie = wieTekst(t, d, f);
                    const meer = dagen.filter((x) => x.taak_id === t.id).length;
                    return (
                      <tr key={d.id} className={`${sel.has(d.id) ? 'gekozen' : ''} ${d.status === 'klaar' ? 'klaar' : ''}`}>
                        <td>{f.schrijven && <input type="checkbox" checked={sel.has(d.id)} onChange={() => kies(d.id)} aria-label="Selecteren" />}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.uur || '–'}{uurKort(d.uur_tot) && <small>{uurKort(d.uur_tot)}</small>}</td>
                        <td><button className="pf-rijknop wat" onClick={() => setOpen(t.id)}>{t.titel}</button>
                          <small>{[t.soort, t.relatie === 'afbraak' && 'afbraak', meer > 1 && `${meer} dagen`, t.info].filter(Boolean).join(' · ')}</small></td>
                        <td>{w.tekst ? <span className={w.verloren ? 'pf-let' : ''}>{w.tekst}{w.verloren && <small>koppeling met de kaart verloren</small>}</span> : <span className="pf-stil">–</span>}</td>
                        <td className={wie ? '' : 'pf-let'}>{wie || 'Niemand'}</td>
                        <td><StatusKeuze waarde={d.status} opties={STATUS_TAAK} label={`Status van ${t.titel}`} uit={!f.schrijven}
                          onChange={(v) => f.wijzig('taak_dagen', d.id, { status: v, klaar_op: v === 'klaar' ? new Date().toISOString() : null })} /></td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
        <TabNotities f={f} tab="planning" />
      </>}

      {sub === 'voorbereiding' && <Voorbereiding f={f} onOpen={setOpen} />}
      {sub === 'programma' && <Programma f={f} />}
      {open && <TaakPaneel f={f} taakId={open} onSluit={() => setOpen(null)} />}
    </div>
  );
}

function Voorbereiding({ f, onOpen }) {
  const lijst = (f.d.taken || []).filter((t) => t.voorbereiding);
  const [tekst, setTekst] = useState('');
  const toe = async () => { const t = tekst.trim(); if (!t) return; await f.voegToe('taken', { titel: t, voorbereiding: true }); setTekst(''); };
  const open = lijst.filter((t) => t.status !== 'klaar'); const klaar = lijst.filter((t) => t.status === 'klaar');
  const rij = (t) => (
    <tr key={t.id} className={t.status === 'klaar' ? 'klaar' : ''}>
      <td style={{ width: 34 }}><input type="checkbox" checked={t.status === 'klaar'} disabled={!f.schrijven} onChange={() => f.wijzig('taken', t.id, { status: t.status === 'klaar' ? 'open' : 'klaar' })} aria-label="Afvinken" /></td>
      <td><button className="pf-rijknop wat" onClick={() => onOpen(t.id)}>{t.titel}</button>{t.info && <small>{t.info}</small>}</td>
      <td style={{ width: 140 }}>{t.deadline_dag != null ? dagNaam(f.plan, t.deadline_anker || 'start', t.deadline_dag) : <span className="pf-stil">Geen deadline</span>}</td>
      <td style={{ width: '20%' }}>{wieTekst(t, null, f) || <span className="pf-stil">–</span>}</td>
    </tr>
  );
  return <>
    <div className="t-melding">Wat vóór de opbouw geregeld moet zijn: vergunningen, brieven, bestellingen. Zonder dag, eventueel met een deadline.</div>
    {f.schrijven && <div className="pf-rij"><input className="t-veld" style={{ flex: 1 }} value={tekst} onChange={(e) => setTekst(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && toe()} placeholder="Nieuwe voorbereidende taak" aria-label="Nieuwe voorbereidende taak" /><button className="t-knop hoofd" onClick={toe}>Toevoegen</button></div>}
    <div className="pf-tabvak"><table className="pf-tabel">
      <thead><tr><th /><th>Taak</th><th>Deadline</th><th>Wie</th></tr></thead>
      <tbody>
        {!lijst.length && <tr><td colSpan={4} className="pf-leeg">Nog geen voorbereidende taken.</td></tr>}
        {open.length > 0 && <tr className="groep let-op"><td colSpan={4}>Nog open · {open.length}</td></tr>}
        {open.map(rij)}
        {klaar.length > 0 && <tr className="groep"><td colSpan={4}>Klaar · {klaar.length}</td></tr>}
        {klaar.map(rij)}
      </tbody>
    </table></div>
  </>;
}

function Programma({ f }) {
  const { plan } = f;
  const lijst = [...(f.d.programma || [])].sort((a, b) => (a.anker === b.anker ? a.dag - b.dag : a.anker === 'start' ? -1 : 1) || String(a.uur_van || '99').localeCompare(String(b.uur_van || '99')));
  const w = wedstrijd(plan);
  const dagOpties = w ? Array.from({ length: w.lengte }, (_, i) => i) : [0];
  const [nieuw, setNieuw] = useState({ dag: 0, uur: '', wat: '' });
  const toe = async () => {
    if (!nieuw.wat.trim()) return;
    const u = leesUur(nieuw.uur);
    await f.voegToe('programma', { anker: 'start', dag: Number(nieuw.dag) || 0, uur_van: u, wat: nieuw.wat.trim() });
    setNieuw({ ...nieuw, uur: '', wat: '' });
  };
  return <>
    <div className="t-melding">Het programma van de wedstrijd, op uur gesorteerd. Het staat ook in de dagplanning (Programma tonen).</div>
    <div className="pf-tabvak"><table className="pf-tabel">
      <thead><tr>{dagOpties.length > 1 && <th style={{ width: 110 }}>Dag</th>}<th style={{ width: 90 }}>Uur</th><th>Wat</th><th style={{ width: 90 }} /></tr></thead>
      <tbody>
        {!lijst.length && <tr><td colSpan={4} className="pf-leeg">Nog geen programma.</td></tr>}
        {lijst.map((p) => (
          <tr key={p.id}>
            {dagOpties.length > 1 && <td>{label(plan, p.anker, p.dag)}</td>}
            <td><Bewaarveld waarde={uurKort(p.uur_van)} uit={!f.schrijven} label="Uur" klasse="pf-cel" onBewaar={(v) => { const u = leesUur(v); if (v && !u) return f.meld('Uur niet herkend, bv. 14:10'); f.wijzig('programma', p.id, { uur_van: u }); }} /></td>
            <td><Bewaarveld waarde={p.wat} uit={!f.schrijven} label="Wat" onBewaar={(v) => v.trim() && f.wijzig('programma', p.id, { wat: v.trim() })} /></td>
            <td>{f.schrijven && <button className="t-knop klein stil" onClick={() => f.wis('programma', p.id)}>Verwijderen</button>}</td>
          </tr>
        ))}
      </tbody>
      {f.schrijven && <tfoot><tr>
        {dagOpties.length > 1 && <td><select className="t-veld" style={{ height: 30 }} value={nieuw.dag} onChange={(e) => setNieuw({ ...nieuw, dag: e.target.value })} aria-label="Dag">{dagOpties.map((i) => <option key={i} value={i}>{label(plan, 'start', i)}</option>)}</select></td>}
        <td><input className="t-veld" style={{ height: 30, width: 70 }} value={nieuw.uur} onChange={(e) => setNieuw({ ...nieuw, uur: e.target.value })} placeholder="14:10" aria-label="Uur" /></td>
        <td><input className="t-veld" style={{ height: 30, width: '100%', boxSizing: 'border-box' }} value={nieuw.wat} onChange={(e) => setNieuw({ ...nieuw, wat: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && toe()} placeholder="Start Women Elite" aria-label="Wat" /></td>
        <td><button className="t-knop klein hoofd" onClick={toe}>Toevoegen</button></td>
      </tr></tfoot>}
    </table></div>
  </>;
}
