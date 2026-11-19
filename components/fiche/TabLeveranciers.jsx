'use client';

// Leveranciers van de site. De lijst toont één lijn per leverancier; een klik opent de bestelling:
// regels met aantal, wat, groep, locatie, levering en ophaling, tegenover wat er op de kaart staat.
// De telling en de regels zelf zitten in bestelling.js.
import { useEffect, useMemo, useState } from 'react';
import { StatusKeuze, Bewaarveld, Bewaartekst, Kiezer, Keuze, DagKiezer, Chips, Zoek, Seg, Cijfer, TabNotities } from './gedeeld';
import Toewijzen, { zonderLeverancier } from './Toewijzen';
import { opId, euro, getal, getalTekst } from './data';
import { uurKort, leesUur, volgorde } from './dagen';
import { STATUS_LEV, EENHEDEN, materiaalVan, leveranciersOpKaart, betrokken, matTekst, itemsVanLevering, somVan,
  bestelRijen, samenvatting, stand, momentKort, momentNaam, dagVerschil, locatieTekst, namenTekst, regelsVan, maakEcht, zetMoment, zetVast, splitsPerLocatie, leverficheRegels } from './bestelling';
import { maakXlsx, bewaarBestand } from '../maps/tabelExport';
import { maps } from '../maps/db';
import { bevestig } from '../maps/dialoog';
import RijKaart from './RijKaart';
import { leverlijstRijen } from '../maps/Stuklijst';

export { STATUS_LEV, materiaalVan, leveranciersOpKaart, betrokken, matTekst, itemsVanLevering, somVan };

const STATUS_OFF = [['gevraagd', 'Gevraagd'], ['ontvangen', 'Ontvangen'], ['goedgekeurd', 'Goedgekeurd'], ['afgewezen', 'Afgewezen']];
const STATUS_FAC = [['ontvangen', 'Ontvangen'], ['goedgekeurd', 'Goedgekeurd'], ['betaald', 'Betaald'], ['betwist', 'Betwist']];
const cijfer = (n) => new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 1 }).format(n);
const eenheidNaam = (e) => (e === 'm' ? 'm' : 'st.');
const standKlas = { weinig: 'pf-let', veel: 'pf-fout', klaar: 'pf-ok' };

// Besteld tegenover geplaatst, in cijfers. Groen is klaar, oranje te weinig, rood te veel.
function Balk({ n, tot, st }) {
  return (
    <span className="pf-tel" title={st === 'weinig' ? `nog ${cijfer(tot - n)} te plaatsen` : st === 'veel' ? `${cijfer(n - tot)} meer geplaatst dan besteld` : st === 'volgt' ? 'volgt de kaart' : undefined}>
      <b className={standKlas[st] || ''}>{cijfer(n)}</b><span className="pf-stil"> / {cijfer(tot)}</span>
    </span>
  );
}
// Cel die bewaart bij verlaten of Enter, met optionele suggesties. Met `tekst` staat de waarde als gewone
// tekst die over meerdere regels loopt; een klik (of Tab) maakt er een invulveld van.
function Veld({ waarde, onBewaar, label, placeholder = '', lijst, uit = false, klasse = 'pf-cel breed', style, tekst = false }) {
  const [v, setV] = useState(waarde ?? '');
  const [bewerk, setBewerk] = useState(false);
  useEffect(() => { setV(waarde ?? ''); }, [waarde]);
  if (tekst && !bewerk) {
    return <button type="button" className={`${klasse} pf-celtekst`} style={style} disabled={uit} aria-label={`${label}: ${waarde || 'leeg'}`} onClick={() => setBewerk(true)} onFocus={() => !uit && setBewerk(true)}>{waarde || <span className="leeg">{uit ? '' : placeholder}</span>}</button>;
  }
  return (
    <input className={klasse} style={style} value={v} placeholder={placeholder} aria-label={label} list={lijst} disabled={uit} autoFocus={tekst}
      onChange={(e) => setV(e.target.value)} onBlur={() => { setBewerk(false); if (String(v) !== String(waarde ?? '')) onBewaar(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(waarde ?? ''); e.currentTarget.blur(); } }} />
  );
}
const metSoort = (f, l) => `${l.werk ? `${momentNaam(l).toLowerCase()} ` : ''}${momentKort(f.plan, l)}`;
const periodeTekst = (f, lev, oph) => (lev || oph ? `${lev ? metSoort(f, lev) : '?'}${oph ? ` → ${metSoort(f, oph)}` : ''}` : '');

function excelBlad(f, lev, sl) {
  const b = bestelRijen(f, sl); const lv = opId(f.d.leveringen);
  return { naam: lev.naam.slice(0, 28), rijen: [
    [lev.naam, f.plan.naam, b.vast ? 'Vastgezet' : 'Loopt mee met de kaart'],
    [],
    ['Aantal', 'Eenheid', 'Wat', 'Groep', 'Locatie', 'Levering of opbouw', 'Ophaling of afbraak', 'Opmerking', 'Op de kaart'],
    ...b.rijen.map((x) => [x.besteld ?? '', eenheidNaam(x.r.eenheid), x.r.wat, x.r.groep || '', locatieTekst(f, x.r), momentKort(f.plan, lv.get(x.r.levering_id)), momentKort(f.plan, lv.get(x.r.ophaling_id)), [namenTekst(x.namen, 40), x.r.opmerking].filter(Boolean).join(' · '), x.vrij ? '' : x.geplaatst]),
    ...(sl.materiaal ? [[], [sl.materiaal]] : []),
  ] };
}

// Tweede blad: per item wat, waar (coördinaten en Google Maps) en wanneer (vroeger de leverlijst van de kaart).
function waarBlad(f, lev) {
  const els = new Map((f.elementen || []).map((e) => [e.id, e]));
  const rijen = leverlijstRijen((f.items || []).filter((i) => !i.vast && !i.verborgen), els, opId(f.lagen), f.d.fasen || [], lev.naam);
  return { naam: 'Waar per item', rijen };
}

export default function TabLeveranciers({ f }) {
  // ?lev=<id> opent meteen die bestelling (link vanop de kaart).
  const [open, setOpen] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lev') : null));
  // Per leverancier (lijst en bestelling) of Toewijzen (al het materiaal van de kaart). ?weergave=toewijzen vanop de kaart.
  const [weergave, setWeergave] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('weergave') === 'toewijzen' ? 'toewijzen' : 'lijst'));
  const [startZonder, setStartZonder] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('zonder') === '1'));
  const [kopH, setKopH] = useState(0);
  useEffect(() => { const meet = () => { const k = document.querySelector('.pf-kop'); if (k) setKopH(k.offsetHeight); }; meet(); window.addEventListener('resize', meet); return () => window.removeEventListener('resize', meet); }, []);
  const [filter, setFilter] = useState('Alle');
  const [zoek, setZoek] = useState('');
  const [suggesties, setSuggesties] = useState([]);
  const levMap = opId(f.d.leveranciers);
  const sl = f.d.site_leveranciers || [];
  const opSite = new Set(sl.map((x) => x.leverancier_id));
  const opKaart = leveranciersOpKaart(f);
  const nietMeer = sl.filter((x) => !opKaart.has(x.leverancier_id));
  const weg = nietMeer.filter((x) => !betrokken(f, x, opKaart));
  const fin = f.financieel;
  const org = f.plan?.organisatie_id;

  // Vrije regels die de organisatie al eens gebruikte: suggesties bij het typen.
  useEffect(() => {
    let leeft = true;
    (async () => {
      try {
        const r = await maps().from('bestelregels').select('wat').eq('organisatie_id', org).is('kaart_naam', null).limit(2000);
        if (leeft && r.data) setSuggesties([...new Set(r.data.map((x) => x.wat).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
      } catch { /* geen suggesties */ }
    })();
    return () => { leeft = false; };
  }, [org]);

  const rijen = useMemo(() => {
    // Leveranciers met materiaal op de kaart staan er vanzelf, ook zonder lijn in de databank.
    const alle = [...sl, ...[...opKaart.keys()].filter((id) => !opSite.has(id)).map((id) => ({ id: null, leverancier_id: id, status: 'nog_niets' }))];
    return alle.map((x) => {
      const lev = levMap.get(x.leverancier_id) || { naam: '?' };
      const off = (f.d.offertes || []).filter((o) => x.id && o.site_leverancier_id === x.id && o.status !== 'afgewezen');
      const fac = (f.d.facturen || []).filter((o) => x.id && o.site_leverancier_id === x.id);
      const offT = off.length ? somVan(off) : null; const facT = fac.length ? somVan(fac) : null;
      return { x, lev, s: samenvatting(f, x), offT, facT, verschil: offT != null && facT != null ? Math.round((facT - offT) * 100) / 100 : null };
    }).sort((a, b) => a.lev.naam.localeCompare(b.lev.naam));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.d, f.items, f.lagen]);
  const q = zoek.trim().toLowerCase();
  const pass = (r) => (!q || r.lev.naam.toLowerCase().includes(q) || (r.x.wat || '').toLowerCase().includes(q) || r.s.rijen.some((y) => (y.r.wat || '').toLowerCase().includes(q)))
    && (filter === 'Alle' || (filter === 'Op te volgen' && r.s.punten.length) || (filter === 'Nog geen offerte' && !r.offT) || (filter === 'Factuur wijkt af' && r.verschil && Math.abs(r.verschil) > 0.009));
  const zichtbaar = rijen.filter(pass);

  const openLijn = async (r) => {
    if (r.x.id) return setOpen(r.x.id);
    if (!f.schrijven) return;
    const n = await f.voegToe('site_leveranciers', { leverancier_id: r.x.leverancier_id });
    if (n) setOpen(n.id);
  };
  const voegLevToe = async (levId) => { if (!levId || opSite.has(levId)) return; const n = await f.voegToe('site_leveranciers', { leverancier_id: levId }); if (n) setOpen(n.id); };
  const nieuweNaam = async (naam) => {
    const n = String(naam || '').trim(); if (!n) return;
    let lev = f.d.leveranciers.find((l) => l.naam.toLowerCase() === n.toLowerCase());
    if (!lev) lev = await f.voegToe('leveranciers', { naam: n, organisatie_id: f.plan.organisatie_id });
    if (lev) await voegLevToe(lev.id);
  };
  const exportAlles = async () => {
    const overzicht = { naam: 'Overzicht', rijen: [['Leverancier', 'Wat', 'Status', 'Regels', 'Besteld', 'Geplaatst', 'Eerste levering', 'Laatste ophaling', 'Opvolgen', ...(fin ? ['Offerte', 'Factuur', 'Verschil'] : [])],
      ...rijen.map((r) => [r.lev.naam, r.x.wat || '', STATUS_LEV.find((s) => s[0] === r.x.status)?.[1] || '', r.s.regels, r.s.telbaar ? r.s.besteld : '', r.s.telbaar ? r.s.geplaatst : '', momentKort(f.plan, r.s.eerste), momentKort(f.plan, r.s.laatste), r.s.punten.map((p) => p.t).join('; '), ...(fin ? [r.offT ?? '', r.facT ?? '', r.verschil ?? ''] : [])])] };
    bewaarBestand(await maakXlsx([overzicht, ...rijen.map((r) => excelBlad(f, r.lev, r.x))]), `leveranciers ${f.plan.naam}.xlsx`);
  };

  const zonderLev = useMemo(() => zonderLeverancier(f), [f.items, f.elementen, f.lagen]); // eslint-disable-line react-hooks/exhaustive-deps
  const naarBestelling = (naam) => { const r = rijen.find((x) => x.lev.naam.toLowerCase() === String(naam).toLowerCase()); if (r) { setWeergave('lijst'); openLijn(r); } };
  const schakel = <Seg waarde={weergave} onChange={(v) => { setWeergave(v); if (v === 'lijst') setStartZonder(false); }} label="Weergave" opties={[['lijst', 'Per leverancier'], ['toewijzen', 'Toewijzen']]} />;
  if (weergave === 'toewijzen') {
    return (
      <div className="pf-romp">
        <div className="pf-rij">{schakel}<span className="pf-stil pf-klein">Wie levert wat: per regel, per groep of voor een selectie. Het komt op de items, zoals "Geleverd door" op de kaart.</span></div>
        <Toewijzen f={f} startZonder={startZonder} onBestelling={naarBestelling} kopHoogte={kopH} />
      </div>
    );
  }

  const gekozen = open && rijen.find((r) => r.x.id === open);
  if (gekozen) {
    return (
      <div className="pf-romp">
        <Bestelling f={f} sl={gekozen.x} lev={gekozen.lev} s={gekozen.s} suggesties={suggesties} terug={() => setOpen(null)}
          onExcel={async () => bewaarBestand(await maakXlsx([excelBlad(f, gekozen.lev, gekozen.x), waarBlad(f, gekozen.lev)]), `${gekozen.lev.naam} ${f.plan.naam}.xlsx`)} />
      </div>
    );
  }

  const kolommen = fin ? 9 : 7;
  return (
    <div className="pf-romp">
      <div className="pf-rij">{schakel}</div>
      <div className="pf-raster vier">
        <Cijfer n={rijen.length} tekst="leveranciers" />
        <Cijfer n={rijen.filter((r) => r.s.vast).length} tekst="bestelling vastgezet" />
        <Cijfer n={rijen.filter((r) => r.s.punten.length).length} tekst="op te volgen" klasse={rijen.some((r) => r.s.punten.length) ? 'pf-let' : ''} />
      </div>
      {weg.length > 0 && f.schrijven && (
        <div className="t-melding let-op pf-rij">
          <span style={{ flex: 1 }}>{weg.length} {weg.length === 1 ? 'leverancier heeft' : 'leveranciers hebben'} geen materiaal meer op de kaart en verder niets op deze site: {weg.map((x) => levMap.get(x.leverancier_id)?.naam).filter(Boolean).join(', ')}.</span>
          <button className="t-knop klein" onClick={() => f.wis('site_leveranciers', weg.map((x) => x.id))}>Weghalen</button>
        </div>
      )}
      <div className="pf-rij">
        <Zoek waarde={zoek} onChange={setZoek} placeholder="Zoek een leverancier of materiaal" />
        <Chips waarde={filter} onChange={setFilter} opties={['Alle', 'Op te volgen', ...(fin ? ['Nog geen offerte', 'Factuur wijkt af'] : [])].map((x) => [x, x])} />
        <div className="pf-vul" />
        <button className="t-knop" onClick={exportAlles}>Excel</button>
        {f.schrijven && <>
          <Keuze waarde={null} vrij label="Leverancier toevoegen" placeholder="Leverancier toevoegen: kies of typ een nieuwe naam" style={{ width: 340 }}
            opties={f.d.leveranciers.filter((l) => !opSite.has(l.id) && !opKaart.has(l.id) && l.actief !== false).map((l) => ({ id: l.id, naam: l.naam, sub: l.categorieen?.join(', ') || '' }))}
            onChange={(v) => v && voegLevToe(v)} onVrij={(v) => v && nieuweNaam(v)} />
        </>}
      </div>
      <div className="pf-tabvak">
        <table className="pf-tabel" style={{ minWidth: fin ? 1040 : 820 }}>
          <thead><tr><th>Leverancier</th><th style={{ width: 170 }}>Status</th><th className="getal" style={{ width: 60 }}>Regels</th><th className="getal" style={{ width: 120 }}>Geplaatst</th><th>Eerste levering → laatste ophaling</th><th style={{ width: 110 }}>Opvolgen</th>{fin && <><th className="getal">Offerte</th><th className="getal">Factuur</th></>}<th style={{ width: 24 }} /></tr></thead>
          <tbody>
            {!zichtbaar.length && <tr><td colSpan={kolommen} className="pf-leeg">{rijen.length ? 'Geen leverancier past bij deze filter.' : 'Nog geen leveranciers op deze site. Ze verschijnen vanzelf zodra er materiaal van een leverancier op de kaart staat.'}</td></tr>}
            {zonderLev.stuks > 0 && !q && filter === 'Alle' && (
              <tr className="pf-zonderlev">
                <td><button className="pf-rijknop" onClick={() => { setStartZonder(true); setWeergave('toewijzen'); }}>Zonder leverancier</button><small>Materiaal op de kaart dat niemand levert</small></td>
                <td colSpan={2}><span className="t-pil let-op">{zonderLev.regels} {zonderLev.regels === 1 ? 'regel' : 'regels'}</span></td>
                <td className="getal"><b className="pf-let">{cijfer(zonderLev.stuks)}</b><span className="pf-stil"> st.</span></td>
                <td colSpan={fin ? 4 : 2}>{f.schrijven && <button className="t-knop klein hoofd" onClick={() => { setStartZonder(true); setWeergave('toewijzen'); }}>Toewijzen</button>}</td>
                <td />
              </tr>
            )}
            {zichtbaar.map((r) => {
              const s = r.s; const st = s.vast ? (s.geplaatst < s.besteld ? 'weinig' : s.geplaatst > s.besteld ? 'veel' : 'klaar') : null;
              return (
                <tr key={r.x.id || r.x.leverancier_id}>
                  <td><button className="pf-rijknop" onClick={() => openLijn(r)}>{r.lev.naam}</button><small>{r.x.wat || r.lev.categorieen?.join(', ') || ''}</small></td>
                  <td>{r.x.id
                    ? <StatusKeuze waarde={r.x.status} opties={STATUS_LEV} uit={!f.schrijven} label={`Status ${r.lev.naam}`} onChange={(v) => f.wijzig('site_leveranciers', r.x.id, { status: v })} />
                    : <span className="t-pil">Op de kaart</span>}
                    {s.telbaar > 0 && <small>{s.vast ? 'vastgezet' : 'loopt mee met de kaart'}</small>}</td>
                  <td className="getal">{s.regels || <span className="pf-stil">–</span>}</td>
                  <td className="getal">{s.telbaar ? <><b className={standKlas[st] || ''}>{cijfer(s.geplaatst)}</b><span className="pf-stil"> / {cijfer(s.besteld)}</span></> : <span className="pf-stil">{s.regels ? 'niet getekend' : '–'}</span>}</td>
                  <td>{s.eerste || s.laatste ? <>{periodeTekst(f, s.eerste, s.laatste)}{s.meer > 0 && <span className="pf-stil pf-klein"> +{s.meer}</span>}</> : <span className="pf-stil">–</span>}</td>
                  <td>{s.punten.length
                    ? <span className={`t-pil ${s.punten.some((p) => p.k === 'fout') ? 'fout' : 'let-op'}`} title={s.punten.map((p) => p.t).join('\n')}>{s.punten.length} {s.punten.length === 1 ? 'punt' : 'punten'}</span>
                    : s.regels ? <span className="pf-ok pf-klein">in orde</span> : <span className="pf-stil">–</span>}</td>
                  {fin && <><td className="getal">{euro(r.offT)}</td><td className={`getal ${r.verschil > 0.009 ? 'pf-fout' : ''}`}>{euro(r.facT)}</td></>}
                  <td className="getal"><button className="pf-link" onClick={() => openLijn(r)} aria-label={`Open ${r.lev.naam}`}>›</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TabNotities f={f} tab="leveranciers" />
    </div>
  );
}

// Dag en uren van een levering of ophaling kiezen. Met een wedstrijddag kies je een datum (bewaard tegenover
// de wedstrijd, zodat ze meeschuift naar een volgende editie); zonder kies je een dag uit de lijst.
function MomentVelden({ f, soort, waarde, onChange }) {
  const einde = soort === 'ophaling';
  const laatste = { anker: waarde.anker, dag: (Number(waarde.dag) || 0) + Math.max(1, waarde.dagen || 1) - 1 };
  return (
    <div className="pf-rij" style={{ gap: 6 }}>
      <Seg waarde={waarde.werk ? 'werk' : 'slot'} onChange={(v) => onChange({ ...waarde, werk: v === 'werk' })} label={einde ? 'Ophaling of afbraak' : 'Levering of opbouw'}
        opties={einde ? [['slot', 'Ophaling'], ['werk', 'Afbraak']] : [['slot', 'Levering'], ['werk', 'Opbouw']]} />
      <DagKiezer plan={f.plan} anker={waarde.anker} dag={waarde.dag} label={`Dag ${soort}`} metLabel={false} onChange={(x) => onChange({ ...waarde, ...x })} />
      {<>
        <span className="pf-stil pf-klein">tot en met</span>
        <DagKiezer plan={f.plan} anker={laatste.anker} dag={laatste.dag} label="Laatste dag" metLabel={false} onChange={(x) => onChange({ ...waarde, dagen: Math.max(1, dagVerschil(f.plan, waarde, x) + 1) })} />
        <span className="pf-stil pf-klein">{waarde.dagen > 1 ? `${waarde.dagen} dagen · uren per dag` : 'één dag · uren'}</span>
      </>}
      <input className="t-veld" style={{ width: 72 }} value={waarde.van} onChange={(e) => onChange({ ...waarde, van: e.target.value })} placeholder="van" aria-label="Van" />
      <input className="t-veld" style={{ width: 72 }} value={waarde.tot} onChange={(e) => onChange({ ...waarde, tot: e.target.value })} placeholder="tot" aria-label="Tot" />
    </div>
  );
}

// Eén menu met de documenten voor een leverancier.
function Documenten({ opties, bezig, naam }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return undefined; const weg = (e) => { if (!e.target.closest?.('.pf-docmenu')) setOpen(false); }; const esc = (e) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('mousedown', weg); window.addEventListener('keydown', esc); return () => { document.removeEventListener('mousedown', weg); window.removeEventListener('keydown', esc); }; }, [open]);
  return (
    <span className="pf-docmenu">
      <button className="t-knop klein" aria-expanded={open} disabled={bezig} onClick={() => setOpen(!open)}>Documenten ▾</button>
      {open && <div className="pf-docpop" role="menu" aria-label={`Documenten voor ${naam}`}>
        <span className="pf-stil pf-klein" style={{ padding: '2px 8px 4px', fontWeight: 600 }}>Voor {naam}</span>
        {opties.map(([t, sub, fn]) => <button key={t} role="menuitem" onClick={() => { setOpen(false); fn(); }}><b>{t}</b><span>{sub}</span></button>)}
      </div>}
    </span>
  );
}

export function Bestelling({ f, sl, lev, s: b, suggesties, terug, onExcel }) {
  const s = f.schrijven;
  const [sel, setSel] = useState(() => new Set());
  const [actie, setActie] = useState(null);       // 'levering' | 'ophaling' | 'periode' | 'locatie' | 'groep' | 'opmerking' | 'naar'
  const [tekst, setTekst] = useState('');
  const [mLev, setMLev] = useState({ anker: 'start', dag: -1, van: '', tot: '', werk: false, dagen: 1 });
  const [mOph, setMOph] = useState({ anker: 'einde', dag: 1, van: '', tot: '', werk: false, dagen: 1 });
  const [groeperen, setGroeperen] = useState('geen');
  const [nieuw, setNieuw] = useState('');
  const [bezig, setBezig] = useState(false);
  const [kolom, setKolom] = useState('geplaatst');   // laatste kolom: geplaatst op de kaart of geleverd op het terrein
  const [plak, setPlak] = useState(null);
  const [kopHoogte, setKopHoogte] = useState(160);   // de selectiebalk blijft net onder de vaste kop van de fiche staan
  useEffect(() => { const meet = () => { const k = document.querySelector('.pf-kop'); if (k) setKopHoogte(k.offsetHeight); }; meet(); window.addEventListener('resize', meet); return () => window.removeEventListener('resize', meet); }, []);
  const [kaartRij, setKaartRij] = useState(null);   // rij waaronder de luchtfoto openstaat
  const lvMap = opId(f.d.leveringen);
  const lagen = f.lagen || [];
  const gekozen = b.rijen.filter((x) => sel.has(x.id));
  const losMat = b.los;
  const groepen = [...new Set((f.d.bestelregels || []).map((r) => r.groep).filter(Boolean))].sort((a, c) => a.localeCompare(c));
  const lijstId = `bl-${sl.id}`;

  const zet = (rij, patch) => (rij.virtueel ? maakEcht(f, rij, patch) : f.wijzig('bestelregels', rij.r.id, patch));
  const echteRegels = async (rijen) => { const uit = []; for (const x of rijen) { const r = await maakEcht(f, x); if (r) uit.push(r); } return uit; };
  const klaar = () => { setSel(new Set()); setActie(null); setTekst(''); };
  const metBezig = async (fn) => { if (bezig) return; setBezig(true); try { await fn(); } finally { setBezig(false); } };
  const locatiePatch = (v) => { const t = String(v || '').trim(); const lg = lagen.find((l) => l.naam.trim().toLowerCase() === t.toLowerCase()); return lg ? { locatie_laag_id: lg.id, locatie_tekst: null } : { locatie_laag_id: null, locatie_tekst: t || null }; };

  const startActie = (a, rijen = gekozen) => {
    const eerste = rijen[0]?.r;
    const uit = (l, std) => (l ? { anker: l.anker, dag: l.dag, van: uurKort(l.uur_van), tot: uurKort(l.uur_tot), werk: !!l.werk, dagen: Number(l.dagen) || 1 } : std);
    if (a === 'levering' || a === 'periode') setMLev(uit(lvMap.get(eerste?.levering_id), { anker: 'start', dag: -1, van: '', tot: '', werk: false, dagen: 1 }));
    if (a === 'ophaling' || a === 'periode') setMOph(uit(lvMap.get(eerste?.ophaling_id), { anker: 'einde', dag: 1, van: '', tot: '', werk: false, dagen: 1 }));
    setTekst(a === 'locatie' ? locatieTekst(f, eerste || {}) : a === 'groep' ? eerste?.groep || '' : a === 'opmerking' ? eerste?.opmerking || '' : '');
    setActie(a);
  };
  const moment = (m) => { const van = leesUur(m.van), tot = leesUur(m.tot); if ((m.van && !van) || (m.tot && !tot)) { f.meld('Uur niet herkend, bv. 08:00'); return undefined; } return { anker: m.anker, dag: m.dag, uur_van: van, uur_tot: tot, werk: !!m.werk, dagen: Math.max(1, m.dagen || 1) }; };
  const pasToe = (wat) => metBezig(async () => {
    const regels = await echteRegels(gekozen); if (!regels.length) return;
    const ids = regels.map((r) => r.id);
    if (wat === 'levering' || wat === 'periode') { const m = moment(mLev); if (m === undefined) return; await zetMoment(f, sl, regels, 'levering', m); }
    if (wat === 'ophaling' || wat === 'periode') { const m = moment(mOph); if (m === undefined) return; await zetMoment(f, sl, regels.map((r) => ({ ...r })), 'ophaling', m); }
    if (wat === 'locatie') await f.wijzig('bestelregels', ids, locatiePatch(tekst));
    if (wat === 'groep') await f.wijzig('bestelregels', ids, { groep: tekst.trim() || null });
    if (wat === 'opmerking') await f.wijzig('bestelregels', ids, { opmerking: tekst.trim() || null });
    if (wat === 'naar' && tekst) await f.wijzig('bestelregels', ids, { site_leverancier_id: tekst, levering_id: null, ophaling_id: null });
    klaar();
  });
  const leegMoment = (soort) => metBezig(async () => { await zetMoment(f, sl, gekozen.filter((x) => !x.virtueel).map((x) => x.r), soort, null); klaar(); });
  const dupliceer = () => metBezig(async () => {
    const n = regelsVan(f, sl.id).length;
    await f.voegToe('bestelregels', gekozen.map((x, i) => ({ site_leverancier_id: sl.id, wat: x.r.wat, kaart_naam: x.r.kaart_naam || null, kaart_sleutel: x.k || null, eenheid: x.r.eenheid || 'st', aantal: x.r.aantal ?? null, groep: x.r.groep || null,
      locatie_laag_id: x.r.locatie_laag_id || null, locatie_tekst: x.r.locatie_tekst || null, levering_id: x.r.levering_id || null, ophaling_id: x.r.ophaling_id || null, opmerking: x.r.opmerking || null, volgorde: n + i })));
    klaar();
  });
  const splits = () => metBezig(async () => { let n = 0; for (const x of gekozen) n += await splitsPerLocatie(f, sl, x); f.meld(n ? `${n} regels gemaakt, één per laag.` : 'Niets te splitsen: het materiaal ligt in één laag, of de regel staat niet op de kaart.'); klaar(); });
  const wisGekozen = () => metBezig(async () => {
    const echt = gekozen.filter((x) => !x.virtueel);
    if (!echt.length) { f.meld('Deze regels komen uit de kaart: haal het materiaal daar weg of geef het een andere leverancier.'); return; }
    if (!(await bevestig(`${echt.length} ${echt.length === 1 ? 'regel' : 'regels'} wissen?`, { ok: 'Wissen', gevaar: true }))) return;
    await zetMoment(f, sl, echt.map((x) => x.r), 'levering', null); await zetMoment(f, sl, echt.map((x) => x.r), 'ophaling', null);
    await f.wis('bestelregels', echt.map((x) => x.r.id)); klaar();
  });
  const voegRegelToe = () => metBezig(async () => {
    const t = nieuw.trim(); if (!t) return;
    const m = losMat.find((x) => x.naam.toLowerCase() === t.toLowerCase());
    await f.voegToe('bestelregels', { site_leverancier_id: sl.id, wat: m ? m.naam : t, kaart_naam: m ? m.naam : null, kaart_sleutel: m ? m.sleutel : null, aantal: m && b.vast ? m.aantal : null, volgorde: regelsVan(f, sl.id).length });
    setNieuw('');
  });
  const voegNietBesteldToe = () => metBezig(async () => {
    const n = regelsVan(f, sl.id).length;
    await f.voegToe('bestelregels', b.nietBesteld.map((m, i) => ({ site_leverancier_id: sl.id, wat: m.naam, kaart_naam: m.naam, kaart_sleutel: m.sleutel, aantal: m.aantal, volgorde: n + i })));
  });
  // Plakken uit Excel: één regel per lijn, kolommen Aantal, Wat, Groep, Locatie, Opmerking (tab of puntkomma).
  const plakToe = () => metBezig(async () => {
    const n = regelsVan(f, sl.id).length; const nieuw = [];
    for (const lijn of String(plak || '').split(/\r?\n/)) {
      const c = lijn.split(lijn.includes('\t') ? '\t' : ';').map((x) => x.trim());
      if (!c.some(Boolean)) continue;
      let aantal = getal(c[0]); let rest = c;
      if (aantal != null) rest = c.slice(1); else if (/^aantal$/i.test(c[0])) continue;
      const wat = rest[0]; if (!wat) continue;
      const m = losMat.find((x) => x.naam.toLowerCase() === wat.toLowerCase() && !nieuw.some((y) => y.kaart_sleutel === x.sleutel));
      nieuw.push({ site_leverancier_id: sl.id, wat: m ? m.naam : wat, kaart_naam: m ? m.naam : null, kaart_sleutel: m ? m.sleutel : null, aantal, groep: rest[1] || null, ...locatiePatch(rest[2]), opmerking: rest[3] || null, volgorde: n + nieuw.length });
    }
    if (!nieuw.length) { f.meld('Geen regels herkend. Verwacht per lijn: aantal, wat, groep, locatie, opmerking.'); return; }
    if (await f.voegToe('bestelregels', nieuw)) { f.meld(`${nieuw.length} ${nieuw.length === 1 ? 'regel' : 'regels'} toegevoegd.`); setPlak(null); }
  });
  const leverfichePdf = async () => {
    const { maakLeverfichePdf } = await import('./leverfichePdf');
    maakLeverfichePdf({ plan: f.plan, leverancier: lev.naam, organisatie: null, wat: sl.wat, regels: leverficheRegels(f, sl), vast: b.vast }).save(`Leverfiche ${lev.naam} ${f.plan.naam}.pdf`);
  };
  const deelAdres = sl.deel_token && typeof window !== 'undefined' ? `${window.location.origin}/d/l/${sl.deel_token}` : '';
  const deel = () => metBezig(async () => {
    if (!b.vast) { f.meld('Zet de bestelling eerst vast: een deellink toont enkel een vaste bestelling.'); return; }
    let token = sl.deel_token;
    if (!token) { const a = new Uint8Array(24); window.crypto.getRandomValues(a); token = [...a].map((x) => x.toString(16).padStart(2, '0')).join(''); if (!(await f.wijzig('site_leveranciers', sl.id, { deel_token: token }))) return; }
    const adres = `${window.location.origin}/d/l/${token}`;
    try { await navigator.clipboard.writeText(adres); f.meld('Link naar de leverfiche gekopieerd.'); } catch { f.meld(adres); }
  });
  const wisLev = async () => { if (await bevestig(`${lev.naam} van deze site halen? De bestelling, leveringen, offertes en facturen van deze site verdwijnen mee.`, { ok: 'Weghalen', gevaar: true })) { await f.wis('site_leveranciers', sl.id); terug(); } };

  // Groeperen: zelfde regels, andere volgorde, met een kopregel per groep.
  const sleutelVan = (x) => (groeperen === 'groep' ? x.r.groep || 'Zonder groep' : groeperen === 'locatie' ? locatieTekst(f, x.r) || 'Zonder locatie' : groeperen === 'levering' ? momentKort(f.plan, lvMap.get(x.r.levering_id)) || 'Zonder levering' : '');
  const getoond = useMemo(() => {
    if (groeperen === 'geen') return b.rijen.map((x) => ({ x }));
    const per = new Map(); for (const x of b.rijen) { const k = sleutelVan(x); if (!per.has(k)) per.set(k, []); per.get(k).push(x); }
    let ks = [...per.keys()];
    if (groeperen === 'levering') { const dag = (k) => { const x = per.get(k)[0]; return lvMap.get(x.r.levering_id) || null; }; ks.sort((a, c) => { const da = dag(a), dc = dag(c); return !da ? 1 : !dc ? -1 : volgorde(f.plan, da, dc); }); }
    else ks = ks.sort((a, c) => (a.startsWith('Zonder') ? 1 : c.startsWith('Zonder') ? -1 : a.localeCompare(c)));
    return ks.flatMap((k) => [{ kop: k, n: per.get(k).length }, ...per.get(k).map((x) => ({ x }))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.rijen, groeperen, f.d.leveringen]);

  const contacten = (f.d.personen || []).filter((p) => p.leverancier_id === sl.leverancier_id);
  const contact = contacten.find((c) => c.id === sl.aanspreekpunt_id);
  const vennootschappen = f.d.vennootschappen || [];
  const standaardV = (f.d.plan_vennootschappen || []).find((v) => v.standaard)?.vennootschap_id || null;
  const offertes = (f.d.offertes || []).filter((o) => o.site_leverancier_id === sl.id);
  const facturen = (f.d.facturen || []).filter((o) => o.site_leverancier_id === sl.id);
  const losseMomenten = (f.d.leveringen || []).filter((l) => l.site_leverancier_id === sl.id && !regelsVan(f, sl.id).some((r) => r.levering_id === l.id || r.ophaling_id === l.id)).sort((x, y) => volgorde(f.plan, x, y));
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
  const alleAan = b.rijen.length > 0 && b.rijen.every((x) => sel.has(x.id));

  return (
    <>
      <section className="pf-kaart">
        <div className="pf-rij">
          <button className="pf-link" onClick={terug}>‹ Alle leveranciers</button>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-titel)', fontSize: 20 }}>{lev.naam}</h2>
          <StatusKeuze waarde={sl.status} opties={STATUS_LEV} uit={!s} label={`Status ${lev.naam}`} onChange={(v) => f.wijzig('site_leveranciers', sl.id, { status: v })} />
          <span className={`t-pil ${b.vast ? 'ok' : ''}`}>{b.vast ? 'Vastgezet' : 'Loopt mee met de kaart'}</span>
          <div className="pf-vul" />
          <span className="pf-stil pf-klein">Groeperen</span>
          <Seg waarde={groeperen} onChange={setGroeperen} label="Groeperen" opties={[['geen', 'Geen'], ['groep', 'Groep'], ['locatie', 'Locatie'], ['levering', 'Levering']]} />
          <Documenten opties={[
            ['Bestelling', 'Excel: aantal, wat, groep, locatie, en per item waar het staat (Google Maps)', onExcel],
            ['Leverfiche', 'PDF: wat, waar en wanneer per levering of opbouw', leverfichePdf],
            ...(s ? [[sl.deel_token ? 'Deellink kopiëren' : 'Deellink maken', 'De leverfiche online, zonder login, altijd de laatste stand', deel]] : []),
          ]} bezig={bezig} naam={lev.naam} />
          {s && <button className={`t-knop klein ${b.vast ? '' : 'hoofd'}`} disabled={bezig} onClick={() => metBezig(() => zetVast(f, sl, !b.vast))} title={b.vast ? 'De aantallen volgen opnieuw wat er op de kaart staat (regels zonder aantal).' : 'Elke regel krijgt het aantal dat nu op de kaart staat. Daarna zie je het verschil.'}>{b.vast ? 'Laten meelopen' : 'Vastzetten'}</button>}
        </div>
        <div className="pf-kopvelden">
          <label><span className="t-label">Wat ze leveren</span><Bewaarveld klasse="t-veld" waarde={sl.wat || ''} uit={!s} label="Wat" placeholder="bv. betonplaten" onBewaar={(v) => f.wijzig('site_leveranciers', sl.id, { wat: v.trim() || null })} /></label>
          <label><span className="t-label">Aanspreekpunt</span><Kiezer waarde={sl.aanspreekpunt_id} opties={contacten} leeg={contacten.length ? 'Kies een contact' : 'Nog geen contact bij deze leverancier'} uit={!s} label="Aanspreekpunt" onChange={(v) => f.wijzig('site_leveranciers', sl.id, { aanspreekpunt_id: v })} />
            {contact && (contact.telefoon || contact.email) && <span className="pf-contact">{contact.telefoon && <a href={`tel:${contact.telefoon.replace(/[^+\d]/g, '')}`}>{contact.telefoon}</a>}{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}</span>}</label>
          <label><span className="t-label">Opmerking</span><Bewaarveld klasse="t-veld" waarde={sl.opmerking || ''} uit={!s} label="Opmerking" onBewaar={(v) => f.wijzig('site_leveranciers', sl.id, { opmerking: v.trim() || null })} /></label>
        </div>

        {s && gekozen.length > 0 && (<div className="pf-vastbalk" style={{ top: kopHoogte }}>
          <div className="pf-bulk">
            <b>{gekozen.length} {gekozen.length === 1 ? 'regel' : 'regels'}</b>
            {[['levering', 'Begin', 'Levering of opbouw instellen'], ['ophaling', 'Einde', 'Ophaling of afbraak instellen'], ['locatie', 'Locatie', 'Locatie instellen'], ['groep', 'Groep', 'Groep instellen'], ['opmerking', 'Opmerking', 'Opmerking instellen'], ['naar', 'Verplaats', 'Naar een andere leverancier van deze site']].map(([k, n, t]) => (
              <button key={k} className="pf-bknop" title={t} aria-pressed={actie === k} style={actie === k ? { background: 'rgba(255,255,255,.2)' } : undefined} onClick={() => (actie === k ? setActie(null) : startActie(k))}>{n}</button>
            ))}
            <span className="sep" />
            <button className="pf-bknop" title="Regels dupliceren" onClick={dupliceer}>Dupliceer</button>
            <button className="pf-bknop" title="Eén regel per laag waar het materiaal ligt" onClick={splits}>Splits</button>
            <div className="pf-vul" />
            <button className="pf-bknop" title="Regels wissen" onClick={wisGekozen}>Wis</button>
            <button className="pf-bknop" onClick={klaar} aria-label="Selectie opheffen">✕</button>
          </div>
          {actie && (
          <div className="pf-actie">
            {(actie === 'levering' || actie === 'periode') && <MomentVelden f={f} soort="levering" waarde={mLev} onChange={setMLev} />}
            {(actie === 'ophaling' || actie === 'periode') && <MomentVelden f={f} soort="ophaling" waarde={mOph} onChange={setMOph} />}
            {(actie === 'locatie' || actie === 'groep' || actie === 'opmerking') && (
              <input className="t-veld" style={{ flex: '1 1 260px' }} autoFocus value={tekst} onChange={(e) => setTekst(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pasToe(actie)}
                list={actie === 'locatie' ? `${lijstId}-lagen` : actie === 'groep' ? `${lijstId}-groepen` : undefined}
                placeholder={actie === 'locatie' ? 'Laag op de kaart of vrije tekst' : actie === 'groep' ? 'bv. Parcours, Event, HR' : 'Opmerking'} aria-label={actie} />
            )}
            {actie === 'naar' && (
              <Keuze waarde={tekst || null} onChange={(v) => setTekst(v || '')} label="Andere leverancier" leeg="Kies een leverancier van deze site" style={{ flex: '1 1 260px' }}
                opties={(f.d.site_leveranciers || []).filter((x) => x.id !== sl.id).map((x) => ({ id: x.id, naam: f.d.leveranciers.find((l) => l.id === x.leverancier_id)?.naam || '?' }))} />
            )}
            <div className="pf-rij" style={{ gap: 6 }}>
              <button className="t-knop klein hoofd" disabled={bezig} onClick={() => pasToe(actie)}>Toepassen op {gekozen.length} {gekozen.length === 1 ? 'regel' : 'regels'}</button>
              {(actie === 'levering' || actie === 'periode') && <button className="t-knop klein" disabled={bezig} onClick={() => leegMoment('levering')}>Geen levering of opbouw</button>}
              {(actie === 'ophaling' || actie === 'periode') && <button className="t-knop klein" disabled={bezig} onClick={() => leegMoment('ophaling')}>Geen ophaling of afbraak</button>}
              <button className="t-knop klein stil" onClick={() => setActie(null)}>Annuleren</button>
            </div>
          </div>
          )}
        </div>)}

        <div className="pf-tabvak" style={{ maxHeight: 'none', border: 0, borderRadius: 0 }}>
          <table className="pf-tabel pf-bestel" style={{ minWidth: 980 }}>
            <thead><tr>
              <th style={{ width: 26 }} /><th style={{ width: 30 }}>{s && <input type="checkbox" checked={alleAan} onChange={() => setSel(alleAan ? new Set() : new Set(b.rijen.map((x) => x.id)))} aria-label="Alles selecteren" />}</th>
              <th className="getal" style={{ width: 104 }}>Aantal</th><th>Wat</th><th style={{ width: 160 }}>Groep</th><th style={{ width: 160 }}>Locatie</th><th style={{ width: 270 }}>Periode · begin → einde</th><th style={{ width: 150 }}><button className={`pf-kolknop ${kolom === 'geplaatst' ? 'aan' : ''}`} onClick={() => setKolom('geplaatst')} title="Hoeveel staat er op de kaart">Geplaatst</button><button className={`pf-kolknop ${kolom === 'geleverd' ? 'aan' : ''}`} onClick={() => setKolom('geleverd')} title="Ontvangst op het terrein afvinken">Geleverd</button></th>
            </tr></thead>
            <tbody>
              {!b.rijen.length && <tr><td colSpan={8} className="pf-leeg">Nog geen regels. Materiaal van {lev.naam} op de kaart komt hier vanzelf; voeg hieronder toe wat je niet tekent.</td></tr>}
              {getoond.map((g) => {
                if (g.kop != null) return <tr key={`kop-${g.kop}`} className="groep"><td colSpan={8}>{g.kop} · {g.n} {g.n === 1 ? 'regel' : 'regels'}</td></tr>;
                const x = g.x; const r = x.r; const st = stand(x); const aan = sel.has(x.id);
                const l = lvMap.get(r.levering_id), o = lvMap.get(r.ophaling_id);
                const metMeter = !x.vrij && (b.mat.get(x.k)?.meter || 0) > 0;
                return [
                  <tr key={x.id} className={aan ? 'gekozen' : ''}>
                    <td className="pf-pijlcel">{x.ids?.length > 0 && <button className="pf-pijl" aria-expanded={kaartRij === x.id} aria-label={`${kaartRij === x.id ? 'Kaart sluiten' : 'Toon op de kaart'}: ${r.wat}`} title="Toon deze elementen op de luchtfoto" onClick={() => setKaartRij(kaartRij === x.id ? null : x.id)}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}</td>
                    <td>{s && <input type="checkbox" checked={aan} onChange={() => setSel((v) => { const n = new Set(v); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} aria-label={`Selecteer ${r.wat}`} />}</td>
                    <td className="getal">
                      <Veld klasse="pf-cel" style={{ width: 62, fontWeight: 600 }} waarde={x.volgt ? '' : getalTekst(r.aantal)} placeholder={x.volgt && x.geplaatst != null ? cijfer(x.geplaatst) : ''} uit={!s} label={`Aantal ${r.wat}`} onBewaar={(v) => zet(x, { aantal: getal(v) })} />
                      {metMeter && s
                        ? <select className="pf-eenheid" value={r.eenheid || 'st'} onChange={(e) => zet(x, { eenheid: e.target.value })} aria-label="Eenheid">{EENHEDEN.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                        : <span className="pf-stil pf-klein"> {eenheidNaam(r.eenheid)}</span>}
                    </td>
                    <td><div className="pf-watcel">
                      <Veld tekst klasse="pf-cel breed wat" waarde={r.wat} uit={!s} label="Wat" onBewaar={(v) => v.trim() && zet(x, { wat: v.trim() })} />
                      <Veld klasse="pf-cel breed sub" waarde={r.opmerking || ''} uit={!s} label={`Opmerking bij ${r.wat}`} placeholder={s ? 'opmerking' : ''} onBewaar={(v) => zet(x, { opmerking: v.trim() || null })} />
                      {x.namen?.length > 0 && <small title={x.namen.join(', ')}>{namenTekst(x.namen)}</small>}
                      {x.weg && <small className="pf-let">staat niet meer op de kaart{s && <> · <button className="pf-link" onClick={() => f.wijzig('bestelregels', r.id, { kaart_naam: null, kaart_sleutel: null })}>loskoppelen</button></>}</small>}
                      {!x.vrij && !x.weg && x.kaartNaam !== r.wat && <small>op de kaart: {x.kaartNaam}</small>}
                    </div></td>
                    <td><Veld tekst waarde={r.groep || ''} uit={!s} label={`Groep ${r.wat}`} lijst={`${lijstId}-groepen`} onBewaar={(v) => zet(x, { groep: v.trim() || null })} /></td>
                    <td><Veld tekst waarde={locatieTekst(f, r)} uit={!s} label={`Locatie ${r.wat}`} lijst={`${lijstId}-lagen`} onBewaar={(v) => zet(x, locatiePatch(v))} /></td>
                    <td>
                      <button className="pf-periode" disabled={!s} onClick={() => { setSel(new Set([x.id])); startActie('periode', [x]); }} aria-label={`Periode ${r.wat}`}>
                        {l || o ? periodeTekst(f, l, o) : <span className={b.vast ? 'pf-let' : 'pf-stil'}>{s ? 'instellen' : '–'}</span>}
                      </button>
                    </td>
                    <td>
                      {kolom === 'geleverd' ? (x.besteld == null ? <span className="pf-stil">–</span> : (
                        <span className="pf-rij" style={{ gap: 4, flexWrap: 'nowrap' }}>
                          <Veld klasse="pf-cel" style={{ width: 56 }} waarde={getalTekst(r.geleverd)} placeholder="0" uit={!s} label={`Geleverd ${r.wat}`} onBewaar={(v) => zet(x, { geleverd: getal(v) })} />
                          <span className={Number(r.geleverd || 0) >= x.besteld ? 'pf-ok' : 'pf-stil'} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>/ {cijfer(x.besteld)}</span>
                          {s && Number(r.geleverd || 0) < x.besteld && <button className="t-knop klein stil" onClick={() => zet(x, { geleverd: x.besteld })} title="Alles geleverd" aria-label={`Alles geleverd: ${r.wat}`}>✓</button>}
                        </span>
                      )) : (<>
                      {x.vrij
                        ? (s && losMat.length > 0
                          ? <select className="pf-eenheid" style={{ maxWidth: 150 }} value="" onChange={(e) => { const m = losMat.find((y) => y.sleutel === e.target.value); if (m) f.wijzig('bestelregels', r.id, { kaart_naam: m.naam, kaart_sleutel: m.sleutel }); }} aria-label="Koppelen aan materiaal op de kaart"><option value="">niet getekend</option>{losMat.map((m) => <option key={m.sleutel} value={m.sleutel}>koppel: {m.naam}</option>)}</select>
                          : <span className="pf-stil">niet getekend</span>)
                        : x.besteld == null ? <span className="pf-stil">{cijfer(x.geplaatst)} op de kaart</span> : <Balk n={x.geplaatst} tot={x.besteld} st={x.volgt ? 'volgt' : st} />}
                      </>)}
                    </td>
                  </tr>,
                  kaartRij === x.id && <tr key={`${x.id}-kaart`} className="pf-kaartrij"><td colSpan={8}><RijKaart plan={f.plan} items={f.items} lagen={f.lagen} elementen={f.elementen} ids={x.ids || []} onSluit={() => setKaartRij(null)} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        {s && (
          <div className="pf-rij">
            <input className="t-veld" style={{ flex: '0 1 340px' }} value={nieuw} onChange={(e) => setNieuw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && voegRegelToe()} list={`${lijstId}-wat`} placeholder="Regel toevoegen: wat bestel je?" aria-label="Nieuwe regel" />
            <button className="t-knop klein" disabled={!nieuw.trim() || bezig} onClick={voegRegelToe}>+ Regel</button>
            <button className="t-knop klein" onClick={() => setPlak(plak == null ? '' : null)}>Plakken uit Excel</button>
            <span className="pf-stil pf-klein">Staat het niet op de kaart, dan blijft het een vrije regel (machines, verbruik, transport).</span>
          </div>
        )}
        {s && plak != null && (
          <div className="pf-actie" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span className="pf-klein">Plak rijen uit Excel. Kolommen in deze volgorde: <b>Aantal · Wat · Groep · Locatie · Opmerking</b>. Enkel Wat is verplicht.</span>
            <textarea className="t-veld" style={{ minHeight: 110, padding: 8, fontFamily: 'inherit' }} autoFocus value={plak} onChange={(e) => setPlak(e.target.value)} aria-label="Rijen uit Excel" placeholder={'2\tM30-4 met sideshift\tParcours\tMateriaaldepot\tnummerplaat'} />
            <div className="pf-rij"><button className="t-knop klein hoofd" disabled={bezig || !plak.trim()} onClick={plakToe}>Regels toevoegen</button><button className="t-knop klein stil" onClick={() => setPlak(null)}>Annuleren</button></div>
          </div>
        )}
        <datalist id={`${lijstId}-lagen`}>{lagen.map((l) => <option key={l.id} value={l.naam} />)}</datalist>
        <datalist id={`${lijstId}-groepen`}>{groepen.map((g) => <option key={g} value={g} />)}</datalist>
        <datalist id={`${lijstId}-wat`}>{[...new Set([...losMat.map((m) => m.naam), ...suggesties])].map((n) => <option key={n} value={n} />)}</datalist>

        {b.nietBesteld.length > 0 && (
          <div className="t-melding let-op pf-rij">
            <span style={{ flex: 1 }}>Op de kaart maar niet in de bestelling: {matTekst(b.nietBesteld)}.</span>
            {s && <button className="t-knop klein" disabled={bezig} onClick={voegNietBesteldToe}>Toevoegen aan de bestelling</button>}
          </div>
        )}
        {losseMomenten.length > 0 && (
          <div className="pf-klein">
            <span className="pf-stil">Ook gepland, zonder regel: </span>
            {losseMomenten.map((l) => <span key={l.id} className="t-pil" style={{ marginRight: 6 }}>{momentNaam(l)} {momentKort(f.plan, l)}{l.wat ? ` · ${l.wat}` : ''}{s && <button className="pf-link" style={{ marginLeft: 6 }} onClick={() => f.wis('leveringen', l.id)} aria-label="Moment wissen">✕</button>}</span>)}
          </div>
        )}
        {s && sl.deel_token && <div className="pf-klein pf-rij"><span className="pf-stil">Deellink voor {lev.naam}:</span><a className="pf-link" href={deelAdres} target="_blank" rel="noreferrer">{deelAdres}</a><button className="pf-link" onClick={() => f.wijzig('site_leveranciers', sl.id, { deel_token: null })}>Intrekken</button>{!b.vast && <span className="pf-let">toont niets zolang de bestelling niet vaststaat</span>}</div>}
        {sl.materiaal && <label className="pf-veld"><span className="t-label">Vroegere vrije lijst (zet dit om in regels)</span><Bewaartekst waarde={sl.materiaal || ''} uit={!s} label="Ander materiaal" rijen={2} onBewaar={(v) => f.wijzig('site_leveranciers', sl.id, { materiaal: v.trim() || null })} /></label>}
      </section>

      {f.financieel && (
        <section className="pf-kaart">
          <div className="pf-kaartkop"><h2>Offertes en facturen</h2></div>
          <div className="pf-tabvak" style={{ maxHeight: 'none' }}>
            <table className="pf-tabel">
              <thead><tr><th>Nummer</th><th>Datum</th><th className="getal">Excl. btw</th><th>Vennootschap</th><th>Status</th><th>Link</th><th /></tr></thead>
              <tbody>
                <tr className="groep"><td colSpan={8}>Offertes · {euro(somVan(offertes.filter((o) => o.status !== 'afgewezen')))}</td></tr>
                {offertes.map((o) => geldRij('offertes', o, STATUS_OFF))}
                <tr className="groep"><td colSpan={8}>Facturen · {euro(somVan(facturen))}</td></tr>
                {facturen.map((o) => geldRij('facturen', o, STATUS_FAC))}
              </tbody>
            </table>
          </div>
          {s && <div className="pf-rij">
            <button className="t-knop klein" onClick={() => f.voegToe('offertes', { site_leverancier_id: sl.id, vennootschap_id: standaardV, status: 'ontvangen' }).then(() => (['nog_niets', 'inschatting', 'offerte_gevraagd'].includes(sl.status) ? f.wijzig('site_leveranciers', sl.id, { status: 'offerte' }) : null))}>Offerte toevoegen</button>
            <button className="t-knop klein" onClick={() => f.voegToe('facturen', { site_leverancier_id: sl.id, vennootschap_id: standaardV, status: 'ontvangen' }).then(() => f.wijzig('site_leveranciers', sl.id, { status: 'gefactureerd' }))}>Factuur toevoegen</button>
          </div>}
        </section>
      )}
      {s && <div className="pf-rij"><div className="pf-vul" /><button className="t-knop klein gevaar" onClick={wisLev}>{lev.naam} van de site halen</button></div>}
    </>
  );
}
