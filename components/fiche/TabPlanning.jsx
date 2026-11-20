'use client';

// Planning van de site: taken per dag (een taak kan op meerdere dagen staan), leveringen
// en ophalingen van leveranciers, en het programma van de wedstrijd.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dagLijst, label, dagNaam, sleutel, uitSleutel, canoniek, uurKort, leesUur, wedstrijd, fase, FASE_NAAM } from './dagen';
import { locatieTekst, momentNaam, momentDagen, bestelRijen } from './bestelling';
import { StatusKeuze, STATUS_TAAK, Seg, Chips, Bewaarveld, TabNotities, DagKiezer, Keuze, Zoek, Paneel, SoortKleuren } from './gedeeld';
import { opId, soortKleur } from './data';
import TaakPaneel from './TaakPaneel';
import { useUrlStaat } from '../urlStaat';
import RijKaart from './RijKaart';
import { bevestig } from '../maps/dialoog';

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

const ONDERDEEL_GELDIG = (v) => ['opbouw', 'voorbereiding', 'programma'].includes(v);

export default function TabPlanning({ f, planId, naar }) {
  const { plan } = f;
  // In de adresbalk: ?onderdeel=voorbereiding|programma en ?taak=<id> (open taak). Vorige sluit de taak weer.
  const [sub, setSub] = useUrlStaat('onderdeel', 'opbouw', { geldig: ONDERDEEL_GELDIG });
  const [soort, setSoort] = useState('Alles');
  const [enkelOpen, setEnkelOpen] = useState(false);
  const [toonProg, setToonProg] = useState(true);
  const [legeDagen, setLegeDagen] = useState(true);
  const [zoek, setZoek] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [notOpen, setNotOpen] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [levOpen, setLevOpen] = useState(null);   // opengeklapte levering of opbouw (één tegelijk: er is één kaart)
  const [open, setOpen] = useUrlStaat('taak', null);
  const [actiefK, setActiefK] = useState(null);   // de dag die bovenaan de lijst staat
  const [hoogte, setHoogte] = useState(null);
  const romp = useRef(null); const vak = useRef(null); const strook = useRef(null); const filterRef = useRef(null);
  const dagRij = useRef(new Map());

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
  const rijenPerSl = new Map();
  const regelIds = (l) => { const sl = slMap.get(l.site_leverancier_id); const rs = regelsBij(l); if (!sl || !rs.length) return []; if (!rijenPerSl.has(sl.id)) rijenPerSl.set(sl.id, bestelRijen(f, sl).rijen); const ids = new Set(rs.map((r) => r.id)); return [...new Set(rijenPerSl.get(sl.id).filter((x) => ids.has(x.r.id)).flatMap((x) => x.ids || []))]; };
  const regelDetails = (l) => { const sl = slMap.get(l.site_leverancier_id); const rs = regelsBij(l); const m = new Map(); if (!sl || !rs.length) return m; if (!rijenPerSl.has(sl.id)) rijenPerSl.set(sl.id, bestelRijen(f, sl).rijen); const ids = new Set(rs.map((r) => r.id)); for (const x of rijenPerSl.get(sl.id)) if (ids.has(x.r.id)) for (const id of x.ids || []) m.set(id, x.r.wat); return m; };
  // Items achter de koppelingen van een taak (item, laag, groep of laaggroep).
  const laagMap = opId(f.lagen);
  const taakIds = (t) => [...new Set((f.d.taak_koppelingen || []).filter((k) => k.taak_id === t.id).flatMap((k) => (k.item_id ? [k.item_id] : k.laag_id ? f.items.filter((i) => i.laag_id === k.laag_id).map((i) => i.id) : k.soort === 'groep' && k.groep_id ? f.items.filter((i) => i.groep_id === k.groep_id).map((i) => i.id) : k.laaggroep ? f.items.filter((i) => laagMap.get(i.laag_id)?.map === k.laaggroep).map((i) => i.id) : [])))];
  const regelPlaats = (l) => [...new Set(regelsBij(l).map((r) => locatieTekst(f, r)).filter(Boolean))].join(', ');
  const levWaar = (l) => { const rs = regelsBij(l); return (l.leverpunt_item_id && f.items.find((x) => x.id === l.leverpunt_item_id)?.naam) || l.leverpunt_tekst || regelPlaats(l) || [...new Set(rs.map((x) => x.groep).filter(Boolean))].join(', '); };
  const levTitel = (l) => `${momentNaam(l)}${l.werk && slMap.get(l.site_leverancier_id)?.wat ? ` ${slMap.get(l.site_leverancier_id).wat}` : ''} · ${l.lev?.naam || 'leverancier'}`;

  // Alle dagen van de eerste tot de laatste, in één doorlopende lijst.
  const lijst = useMemo(() => dagLijst(plan, [...dagen, ...leveringen.flatMap((l) => momentDagen(plan, l)), ...programma, { anker: 'start', dag: 0 }]), [plan, dagen, leveringen, programma]);
  const vandaagK = lijst.find((x) => x.datum && x.datum.toDateString() === new Date().toDateString())?.k || null;
  const wedK = sleutel(canoniek(plan, 'start', 0).anker, canoniek(plan, 'start', 0).dag);

  const soorten = ['Alles', ...new Set([...taken.map((t) => t.soort).filter(Boolean), ...(leveringen.length ? ['Levering'] : [])])];
  const q = zoek.trim().toLowerCase();
  const past = (...s) => !q || s.some((x) => x && String(x).toLowerCase().includes(q));

  const rijen = [];
  for (const d of dagen) {
    const c = canoniek(plan, d.anker, d.dag); const k = sleutel(c.anker, c.dag);
    const t = takenMap.get(d.taak_id);
    if (t.voorbereiding || !(soort === 'Alles' || t.soort === soort) || (enkelOpen && d.status === 'klaar')) continue;
    if (q && !past(t.titel, t.info, t.soort, waarTekst(t, f).tekst, wieTekst(t, d, f))) continue;
    rijen.push({ soort: 'taak', k, uur: uurKort(d.uur_van), d, t });
  }
  // Een opbouw of afbraak over meerdere dagen staat op elke dag van de periode.
  if (soort === 'Alles' || soort === 'Levering') for (const l of leveringen) {
    if ((enkelOpen && l.status === 'klaar') || (q && !past(levTitel(l), l.wat, levWaar(l), regelTekst(l)))) continue;
    momentDagen(plan, l).forEach((c, n, alle) => rijen.push({ soort: 'levering', k: sleutel(c.anker, c.dag), uur: uurKort(l.uur_van), l, n, van: alle.length }));
  }
  if (toonProg && soort === 'Alles') for (const p of programma) {
    if (q && !past(p.wat)) continue;
    const c = canoniek(plan, p.anker, p.dag); rijen.push({ soort: 'prog', k: sleutel(c.anker, c.dag), uur: uurKort(p.uur_van), p });
  }
  const perDag = new Map(lijst.map((x) => [x.k, []]));
  for (const r of rijen) (perDag.get(r.k) || perDag.set(r.k, []).get(r.k)).push(r);
  const filterAan = soort !== 'Alles' || enkelOpen || !toonProg || !!q;
  const groepen = lijst.map((x) => ({ x, rijen: (perDag.get(x.k) || []).sort(opUur) })).filter((g) => g.rijen.length || (legeDagen && !filterAan));
  const openOp = (r) => (r.soort === 'taak' && r.d.status !== 'klaar') || (r.soort === 'levering' && r.l.status !== 'klaar');
  const takenTotaal = rijen.filter((r) => r.soort === 'taak');
  const nOpen = takenTotaal.filter((r) => r.d.status !== 'klaar').length;

  // Hoogte: het scherm vult de rest van het venster, de tabel scrolt binnenin.
  useLayoutEffect(() => {
    if (sub !== 'opbouw') return undefined;
    const meet = () => { if (romp.current) setHoogte(Math.max(360, window.innerHeight - romp.current.getBoundingClientRect().top)); };
    meet(); window.addEventListener('resize', meet); return () => window.removeEventListener('resize', meet);
  }, [sub]);

  const theadH = () => vak.current?.querySelector('thead')?.offsetHeight || 37;
  const naarDag = (k, glad = true) => {
    const el = dagRij.current.get(k); const v = vak.current; if (!el || !v) return; setActiefK(k);
    v.scrollTo({ top: el.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - theadH(), behavior: glad ? 'smooth' : 'auto' });
  };
  const spy = useRef(0);
  const opScroll = () => {
    cancelAnimationFrame(spy.current);
    spy.current = requestAnimationFrame(() => {
      const v = vak.current; if (!v) return; const grens = v.getBoundingClientRect().top + theadH() + 4; let k = null;
      for (const [kk, el] of dagRij.current) { if (!el.isConnected) continue; if (el.getBoundingClientRect().top <= grens) k = kk; }
      setActiefK(k || groepen[0]?.x.k || null);
    });
  };
  // De dagstrook volgt mee met de dag bovenaan.
  useEffect(() => {
    const s = strook.current; const b = s?.querySelector(`[data-k="${actiefK}"]`); if (!s || !b) return;
    if (b.offsetLeft < s.scrollLeft + 40 || b.offsetLeft + b.offsetWidth > s.scrollLeft + s.clientWidth - 40) s.scrollTo({ left: b.offsetLeft - s.clientWidth / 3, behavior: 'smooth' });
  }, [actiefK]);
  // Bij het openen: naar vandaag als die in de planning valt, anders bovenaan.
  const eerst = useRef(true);
  useEffect(() => {
    if (sub !== 'opbouw' || !hoogte) return;
    if (eerst.current) { eerst.current = false; if (vandaagK) requestAnimationFrame(() => naarDag(vandaagK, false)); }
    opScroll();
  }, [sub, hoogte]);
  useEffect(() => {
    if (!filterOpen) return undefined;
    const weg = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', weg); return () => document.removeEventListener('mousedown', weg);
  }, [filterOpen]);

  // Selectie (taakdagen)
  const selIds = [...sel].filter((id) => dagen.some((d) => d.id === id));
  const kies = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = {
    status: (st) => f.wijzig('taak_dagen', selIds, { status: st, klaar_op: st === 'klaar' ? new Date().toISOString() : null }),
    wie: (pid) => pid && f.wijzig('taak_dagen', selIds, { uitvoerder_persoon_id: pid }),
    schuif: async (n) => {
      for (const id of selIds) { const d = dagen.find((x) => x.id === id); const c = canoniek(plan, d.anker, d.dag + n); await f.wijzig('taak_dagen', id, { anker: c.anker, dag: c.dag }); }
      f.meld(`${selIds.length} ${selIds.length === 1 ? 'taak' : 'taken'} een dag ${n > 0 ? 'later' : 'vroeger'}`);
    },
    naar: async (x) => {
      if (!x) return; const c = canoniek(plan, x.anker, x.dag);
      await f.wijzig('taak_dagen', selIds, { anker: c.anker, dag: c.dag });
      f.meld(`${selIds.length} ${selIds.length === 1 ? 'taak' : 'taken'} naar ${dagNaam(plan, c.anker, c.dag)}`);
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

  const nieuweTaak = async (k) => {
    const x = uitSleutel(k || actiefK || vandaagK || wedK);
    const t = await f.voegToe('taken', { titel: 'Nieuwe taak', soort: soort !== 'Alles' && soort !== 'Levering' ? soort : null });
    if (!t) return;
    const d = await f.voegToe('taak_dagen', { taak_id: t.id, anker: x?.anker || 'start', dag: x?.dag ?? 0 });
    if (d) setOpen(t.id);
  };

  const personen = f.d.personen || [];
  const team = new Set((f.d.site_rollen || []).map((r) => r.persoon_id));
  const wieOpties = [...personen].sort((a, b) => (team.has(b.id) - team.has(a.id)) || a.naam.localeCompare(b.naam)).map((p) => ({ id: p.id, naam: p.naam, groep: team.has(p.id) ? 'Team van de site' : 'Anderen' }));
  const nNotities = (f.d.notities || []).filter((n) => n.tab === 'planning' && !n.klaar).length;
  const nFilters = [soort !== 'Alles', enkelOpen, !toonProg].filter(Boolean).length;
  const pijl = <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

  const rijVan = (r) => {
    if (r.soort === 'prog') return <tr key={`p${r.p.id}`} className="prog"><td /><td className="pf-uur">{r.uur || '–'}{uurKort(r.p.uur_tot) && <small>{uurKort(r.p.uur_tot)}</small>}</td><td colSpan={4}><span className="pf-soortik prog" aria-hidden="true" /><b>{r.p.wat}</b><small>Programma</small></td></tr>;
    if (r.soort === 'levering') {
      const l = r.l; const lk = `${l.id}-${r.n || 0}`; const isOpen = levOpen === lk; const rs = regelsBij(l); const waar = levWaar(l);
      return [
        <tr key={`l${lk}`} className={`${isOpen ? 'gekozen' : ''} ${l.status === 'klaar' ? 'klaar' : ''} ${soortKleur(f, 'Levering') ? 'pf-soortrij' : ''}`} style={soortKleur(f, 'Levering') ? { '--soort': soortKleur(f, 'Levering') } : undefined}><td className="pf-pijlcel"><span className="pf-vakjes"><span />{(rs.length > 0 || f.schrijven) ? <button className="pf-pijl" aria-expanded={isOpen} aria-label="Wat en waar tonen, met kaart en opmerking" onClick={() => setLevOpen(isOpen ? null : lk)}>{pijl}</button> : <span />}</span></td><td className="pf-uur">{r.uur || '–'}{uurKort(l.uur_tot) && <small>{uurKort(l.uur_tot)}</small>}</td>
          <td><span className={`pf-soortik ${l.werk ? 'werk' : 'lev'}`} aria-hidden="true" />{naar ? <button className="pf-rijknop wat" title="Open de bestelling bij deze leverancier" onClick={() => naar('leveranciers', { lev: l.site_leverancier_id })}>{levTitel(l)}</button> : <b>{levTitel(l)}</b>}
            {l.wat && <small style={{ color: 'var(--t-tekst)' }}>{l.wat}</small>}</td>
          <td>{waar || (l.werk ? <span className="pf-stil">–</span> : <span className="pf-stil">Leverpunt ontbreekt</span>)}</td>
          <td>{l.lev?.naam && naar ? <button className="pf-link" onClick={() => naar('leveranciers', { lev: l.site_leverancier_id })}>{l.lev.naam}</button> : l.lev?.naam}</td>
          <td><StatusKeuze waarde={l.status} opties={STATUS_TAAK} uit={!f.schrijven} label="Status levering" onChange={(v) => f.wijzig('leveringen', l.id, { status: v })} /></td></tr>,
        isOpen && <tr key={`l${lk}-open`} className="pf-kaartrij"><td colSpan={6}>
          <div className="pf-momentopen">
            <label className="pf-rij" style={{ flexWrap: 'nowrap' }}><span className="pf-stil">Opmerking</span><Bewaarveld klasse="t-veld" style={{ flex: 1 }} waarde={l.wat || ''} uit={!f.schrijven} label="Opmerking bij dit moment" placeholder="bv. over de tramsporen" onBewaar={(v) => f.wijzig('leveringen', l.id, { wat: v.trim() || null })} /></label>
          </div>
          {rs.length > 0 && <RijKaart plan={f.plan} items={f.items} lagen={f.lagen} elementen={f.elementen} ids={regelIds(l)} details={regelDetails(l)} onSluit={() => setLevOpen(null)} />}
        </td></tr>,
      ];
    }
    const { t, d } = r; const w = waarTekst(t, f); const wie = wieTekst(t, d, f);
    const meer = dagen.filter((x) => x.taak_id === t.id).length;
    const tk = `t${d.id}`; const tOpen = levOpen === tk; const ids = w.gekoppeld ? taakIds(t) : [];
    return [
      <tr key={d.id} className={`${sel.has(d.id) || open === t.id || tOpen ? 'gekozen' : ''} ${d.status === 'klaar' ? 'klaar' : ''} ${soortKleur(f, t.soort) ? 'pf-soortrij' : ''}`} style={soortKleur(f, t.soort) ? { '--soort': soortKleur(f, t.soort) } : undefined}>
        <td className="pf-pijlcel"><span className="pf-vakjes">{f.schrijven ? <input type="checkbox" checked={sel.has(d.id)} onChange={() => kies(d.id)} aria-label="Selecteren" /> : <span />}{ids.length > 0 ? <button className="pf-pijl" aria-expanded={tOpen} aria-label="Toon op de kaart" onClick={() => setLevOpen(tOpen ? null : tk)}>{pijl}</button> : <span />}</span></td>
        <td className="pf-uur">{r.uur || '–'}{uurKort(d.uur_tot) && <small>{uurKort(d.uur_tot)}</small>}</td>
        <td><span className="pf-soortik taak" aria-hidden="true" /><button className="pf-rijknop wat" onClick={() => setOpen(t.id)}>{t.titel}</button>
          <small>{[t.soort, t.relatie === 'afbraak' && 'afbraak', meer > 1 && `${meer} dagen`, t.info].filter(Boolean).join(' · ')}</small></td>
        <td>{w.tekst ? <span className={w.verloren ? 'pf-let' : ''}>{w.tekst}{w.verloren && <small>koppeling met de kaart verloren</small>}</span> : <span className="pf-stil">–</span>}</td>
        <td className={wie ? '' : 'pf-let'}>{wie || 'Niemand'}</td>
        <td><StatusKeuze waarde={d.status} opties={STATUS_TAAK} label={`Status van ${t.titel}`} uit={!f.schrijven}
          onChange={(v) => f.wijzig('taak_dagen', d.id, { status: v, klaar_op: v === 'klaar' ? new Date().toISOString() : null })} /></td>
      </tr>,
      tOpen && <tr key={`${tk}-open`} className="pf-kaartrij"><td colSpan={6}>
        <RijKaart plan={f.plan} items={f.items} lagen={f.lagen} elementen={f.elementen} ids={ids} onSluit={() => setLevOpen(null)} />
      </td></tr>,
    ];
  };

  const taakVolg = [...new Set(groepen.flatMap((g) => g.rijen).filter((r) => r.soort === 'taak').map((r) => r.t.id))];
  const stapTaak = (n) => { const i = taakVolg.indexOf(open); const v = taakVolg[i + n]; if (v) setOpen(v, { vervang: true }); };
  const balk = selIds.length > 0 && f.schrijven && sub === 'opbouw' ? (
    <div className="pf-planbalk sel" role="toolbar" aria-label="Acties op de selectie">
      <b>{selIds.length} geselecteerd</b>
      {STATUS_TAAK.map(([k, n]) => <button key={k} className="pf-bknop" onClick={() => bulk.status(k)}>{n}</button>)}
      <span className="sep" />
      <Keuze waarde={null} opties={wieOpties} label="Wie toewijzen" leeg="Wie…" placeholder="Wie…" wisbaar={false} klasse="pf-bsel" style={{ width: 150 }} onChange={bulk.wie} />
      <span className="sep" />
      <button className="pf-bknop" onClick={() => bulk.schuif(-1)} title="Een dag vroeger">− 1 dag</button>
      <button className="pf-bknop" onClick={() => bulk.schuif(1)} title="Een dag later">+ 1 dag</button>
      <span className="pf-bdag"><DagKiezer plan={plan} anker={null} dag={null} metLabel={false} label="Naar een dag" onChange={bulk.naar} /></span>
      <span className="sep" />
      <button className="pf-bknop" onClick={bulk.weg}>Verwijderen</button>
      <span style={{ flex: 1 }} />
      <button className="pf-bknop" onClick={() => setSel(new Set())} aria-label="Selectie wissen">✕</button>
    </div>
  ) : (
    <div className="pf-planbalk">
      <Seg waarde={sub} onChange={setSub} label="Onderdeel" opties={[['opbouw', 'Opbouw tot afbraak'], ['voorbereiding', 'Voorbereiding'], ['programma', 'Programma']]} />
      {sub === 'opbouw' && <>
        <Zoek waarde={zoek} onChange={setZoek} placeholder="Zoek taak, wie of waar" />
        <span className="pf-filterwrap" ref={filterRef}>
          <button className={`t-knop ${nFilters ? 'aan' : ''}`} aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>Filter{nFilters ? ` · ${nFilters}` : ''}</button>
          {filterOpen && <div className="pf-filterpop" role="dialog" aria-label="Filter" style={{ width: 360 }}>
            <span className="t-label">Soort</span>
            <Chips waarde={soort} onChange={setSoort} opties={soorten.map((s) => [s, s])} />
            <label className="pf-rij" style={{ gap: 8 }}><input type="checkbox" checked={enkelOpen} onChange={() => setEnkelOpen(!enkelOpen)} /> Enkel wat nog open is</label>
            <label className="pf-rij" style={{ gap: 8 }}><input type="checkbox" checked={toonProg} onChange={() => setToonProg(!toonProg)} /> Programma tonen</label>
            <label className="pf-rij" style={{ gap: 8 }}><input type="checkbox" checked={legeDagen} onChange={() => setLegeDagen(!legeDagen)} /> Lege dagen tonen</label>
            {soorten.length > 1 && <>
              <span className="t-label" style={{ marginTop: 6 }} title={f.event ? `Geldt voor alle sites van ${f.event.naam}` : undefined}>Kleur per soort{f.event ? ' · voor heel het event' : ''}</span>
              <SoortKleuren soorten={soorten.filter((x) => x !== 'Alles')} kleur={(x) => soortKleur(f, x)} uit={!f.schrijven} onKies={(x, k) => f.soortKleurZet(x, k)} />
            </>}
          </div>}
        </span>
        <span className="pf-knoppen">
          {vandaagK && <button className="t-knop" onClick={() => naarDag(vandaagK)}>Vandaag</button>}
          <button className="t-knop" onClick={() => naarDag(wedK)}>Wedstrijd</button>
        </span>
      </>}
      <div className="pf-vul" />
      {sub === 'opbouw' && <span className="pf-stil pf-klein pf-telling">{takenTotaal.length} taken · {nOpen} open</span>}
      <button className={`t-knop ${notOpen ? 'aan' : ''}`} onClick={() => setNotOpen(!notOpen)}>Notities{nNotities ? ` · ${nNotities}` : ''}</button>
      {sub === 'opbouw' && f.schrijven && <button className="t-knop hoofd" onClick={() => nieuweTaak()}>+ Taak</button>}
    </div>
  );

  return (
    <div className={`pf-plan ${open || notOpen ? 'met-paneel' : ''}`} ref={romp} style={sub === 'opbouw' && hoogte ? { height: hoogte } : undefined}>
      {balk}
      {!wedstrijd(plan) && <div className="t-melding let-op">De wedstrijddag van deze site is nog niet ingesteld (tab Info). Dagen staan voorlopig als D-2, D, D+1 zonder datum.</div>}

      {sub === 'opbouw' && <>
        {filterAan && <div className="pf-chiprij">
          {q && <button className="pf-chip aan" onClick={() => setZoek('')}>“{zoek.trim()}” ✕</button>}
          {soort !== 'Alles' && <button className="pf-chip aan" onClick={() => setSoort('Alles')}>{soort} ✕</button>}
          {enkelOpen && <button className="pf-chip aan" onClick={() => setEnkelOpen(false)}>Enkel open ✕</button>}
          {!toonProg && <button className="pf-chip aan" onClick={() => setToonProg(true)}>Zonder programma ✕</button>}
        </div>}
        <div className="pf-dagstrook" ref={strook} role="tablist" aria-label="Spring naar een dag" onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && strook.current) strook.current.scrollLeft += e.deltaY; }}>
          {lijst.map((x) => {
            const rs = perDag.get(x.k) || []; const o = rs.filter(openOp).length; const fs = fase(plan, x.anker, x.dag);
            return <button key={x.k} data-k={x.k} role="tab" aria-selected={actiefK === x.k} className={`${actiefK === x.k ? 'aan' : ''} ${fs} ${x.k === vandaagK ? 'vandaag' : ''} ${rs.length ? '' : 'leeg'}`} onClick={() => naarDag(x.k)}>
              <span>{x.datum ? x.datum.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric' }) : label(plan, x.anker, x.dag)}</span>
              <small>{x.datum ? label(plan, x.anker, x.dag) : ''}{o ? <i>{o}</i> : null}</small>
            </button>;
          })}
        </div>
        <div className="pf-tabvak pf-planvak" ref={vak} onScroll={opScroll}>
          <table className="pf-tabel" style={{ minWidth: 860 }}>
            <thead><tr><th style={{ width: 52 }} /><th style={{ width: 64 }}>Uur</th><th>Wat</th><th style={{ width: '20%' }}>Waar</th><th style={{ width: '16%' }}>Wie</th><th style={{ width: 130 }}>Status</th></tr></thead>
            <tbody>
              {!groepen.length && <tr><td colSpan={6} className="pf-leeg">{filterAan ? 'Niets gevonden met deze filter.' : `Nog geen taken${f.schrijven ? '. Maak er een met + Taak.' : '.'}`}</td></tr>}
              {groepen.map(({ x, rijen: rs }) => {
                const ids = rs.filter((r) => r.soort === 'taak').map((r) => r.d.id);
                const alle = ids.length > 0 && ids.every((id) => sel.has(id));
                const o = rs.filter(openOp).length; const fs = fase(plan, x.anker, x.dag);
                return [
                  <tr key={`g${x.k}`} ref={(el) => { if (el) dagRij.current.set(x.k, el); else dagRij.current.delete(x.k); }} className={`groep dag ${fs} ${rs.length ? '' : 'leeg'} ${x.k === vandaagK ? 'vandaag' : ''}`}><td colSpan={6}>
                    <span className="pf-dagkop">
                      <span className="pf-dagvak">{f.schrijven && ids.length > 0 && <input type="checkbox" checked={alle} onChange={() => setSel((s) => { const n = new Set(s); ids.forEach((id) => (alle ? n.delete(id) : n.add(id))); return n; })} aria-label="Hele dag selecteren" />}</span>
                      <b>{dagNaam(plan, x.anker, x.dag)}</b><span>{FASE_NAAM[fs]}</span>{x.k === vandaagK && <span className="t-pil">Vandaag</span>}
                      {rs.length ? <span>{rs.length} {rs.length === 1 ? 'regel' : 'regels'}{o ? ` · ${o} open` : ''}</span> : <span>niets gepland</span>}
                      <span className="pf-vul" />
                      {f.schrijven && <button className="pf-link" onClick={() => nieuweTaak(x.k)}>+ taak op deze dag</button>}
                    </span>
                  </td></tr>,
                  ...rs.map(rijVan),
                ];
              })}
            </tbody>
          </table>
          <div className="pf-staart" style={{ height: Math.max(0, (hoogte || 600) - 320) }} aria-hidden="true" />
        </div>
      </>}

      {sub === 'voorbereiding' && <Voorbereiding f={f} onOpen={setOpen} />}
      {sub === 'programma' && <Programma f={f} />}
      {notOpen && !open && <Paneel naast titel="Notities" sub="Planning" onSluit={() => setNotOpen(false)}><TabNotities f={f} tab="planning" /></Paneel>}
      {open && <TaakPaneel naast f={f} taakId={open} onSluit={() => setOpen(null)} vorige={sub === 'opbouw' && taakVolg.indexOf(open) > 0 ? () => stapTaak(-1) : null} volgende={sub === 'opbouw' && taakVolg.indexOf(open) >= 0 && taakVolg.indexOf(open) < taakVolg.length - 1 ? () => stapTaak(1) : null} />}
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
