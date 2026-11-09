'use client';

// Materiaal per leverancier: een volledig scherm met de stuklijst per leverancier, per categorie of per laag.
// Elke regel klapt open tot de items waaruit ze bestaat (bv. de Heras-lijnen die samen 1.442 m maken); per regel of
// per item kies je wie het levert, en "Toon op kaart" zet net die items scherp. De standaardleverancier per categorie
// (plan.instellingen.leveranciers) geldt voor items zonder eigen keuze en elementen zonder vaste leverancier.
import { getOrganisatie } from './merk';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { berekenStuklijst, stuklijstRijen, leverlijstRijen } from './Stuklijst';
import { maakXlsx, maakPdf, bewaarBestand } from './tabelExport';
import { herkomstVan, maten } from './stijl';
import { useLeveranciers, juisteNaam, zorgLeverancier, leveranciersVoor } from './leveranciers';
import { sorteerCategorieen, ZONDER_LEVERANCIER } from './categorieen';

const getal = (x, d = 0) => Number(x || 0).toLocaleString('nl-BE', { maximumFractionDigits: d });
const ZONDER = 'Zonder leverancier';
const VASTE = () => [getOrganisatie()?.kort || 'Organisator', 'Gemeente'];

// Knop met een klein menu: Excel of PDF.
function ExportKnop({ label, klein = false, opties }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return undefined; const f = () => setOpen(false); setTimeout(() => window.addEventListener('click', f), 0); return () => window.removeEventListener('click', f); }, [open]);
  return (
    <span className="fm-mat-exp">
      <button className={`fm-knop${klein ? ' klein' : ''}`} aria-expanded={open} onClick={() => setOpen((x) => !x)}>{label} ▾</button>
      {open && <span className="fm-mat-expmenu" role="menu">{opties.map(([n, f]) => <button key={n} role="menuitem" onClick={async () => { setOpen(false); try { await f(); } catch (e) { console.error('export mislukt', e); window.alert?.(`Exporteren mislukt: ${e?.message || e}`); } }}>{n}</button>)}</span>}
    </span>
  );
}

// Invoerveld met keuzelijst: bewaren bij Enter of bij het verlaten, enkel als er iets veranderde.
function LevVeld({ waarde, placeholder, opties, uit, onKies, label }) {
  const [v, setV] = useState(waarde || '');
  useEffect(() => setV(waarde || ''), [waarde]);
  const klaar = () => { if (v.trim() !== (waarde || '')) onKies(v.trim()); };
  return (
    <input className="fm-mat-lev" list="fm-mat-levs" aria-label={label} value={v} placeholder={placeholder} disabled={uit}
      onChange={(e) => setV(e.target.value)} onBlur={klaar} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { setV(waarde || ''); e.currentTarget.blur(); } }}
      onClick={(e) => e.stopPropagation()} />
  );
}

export default function MateriaalScherm({ verborgen = false, plan, items, elementenMap, lagenMap, fasen, actieveFase, schrijven, onWijzigItems, onStd, onToon, onSluit }) {
  const std = plan?.instellingen?.leveranciers || {};
  const levLijst = useLeveranciers();
  const levInfo = useMemo(() => new Map(levLijst.map((l) => [l.naam, l])), [levLijst]);
  const [groep, setGroep] = useState('lev');
  const [lev, setLev] = useState(null); // null = alle, '' = zonder leverancier
  const [zoek, setZoek] = useState('');
  const [open, setOpen] = useState(() => new Set());
  // Scrollpositie onthouden: terug van "Toon op kaart" sta je op dezelfde plek.
  const lijstRef = useRef(null); const scrollRef = useRef(0);
  useLayoutEffect(() => { if (!verborgen && lijstRef.current) lijstRef.current.scrollTop = scrollRef.current; }, [verborgen]);
  const [stdOpen, setStdOpen] = useState(false);
  const fase = fasen.find((f) => f.id === actieveFase);
  useEffect(() => { const t = (e) => { if (e.key === 'Escape' && !e.target.closest?.('input')) onSluit(); }; window.addEventListener('keydown', t); return () => window.removeEventListener('keydown', t); }, [onSluit]);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const s = useMemo(() => berekenStuklijst(items, elementenMap, lagenMap, actieveFase, std), [items, elementenMap, lagenMap, actieveFase, std]);
  // Per laag: de stuklijst van de items in die laag.
  const perLaag = useMemo(() => {
    if (groep !== 'laag') return null;
    const g = new Map(); for (const it of items) { const k = it.laag_id || ''; if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
    return [...g].map(([k, l]) => [lagenMap.get(k)?.naam || 'Zonder laag', berekenStuklijst(l, elementenMap, lagenMap, actieveFase, std).elementen]).filter(([, r]) => r.length).sort((a, b) => a[0].localeCompare(b[0], 'nl'));
  }, [groep, items, elementenMap, lagenMap, actieveFase, std]);

  // Wie levert er (met totalen), en welke namen kan je kiezen.
  const leveranciers = useMemo(() => {
    const m = new Map(); for (const r of s.elementen) { const k = r.leverancier || ''; m.set(k, (m.get(k) || 0) + r.aantal); }
    return [...m].sort((a, b) => (!a[0]) - (!b[0]) || b[1] - a[1]);
  }, [s]);
  const alleNamen = useMemo(() => [...new Set([...VASTE(), ...levLijst.filter((l) => l.actief !== false).map((l) => l.naam), ...Object.values(std), ...leveranciers.map(([k]) => k)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl')), [std, leveranciers, levLijst]);
  const stdVoor = (naam) => Object.entries(std).filter(([, v]) => v === naam).map(([k]) => k);

  // Per item: element, eigen keuze, afwijking van de standaard.
  const info = (id) => {
    const it = itemMap.get(id); const el = it?.element_id ? elementenMap.get(it.element_id) : null;
    if (!it) return null;
    const eigen = String(it.velden?.herkomst || '').trim();
    const sd = el?.categorie ? std[el.categorie] : '';
    return { it, el, eigen, wie: herkomstVan(it, el, std), viaStd: !eigen && !el?.leverancier && !!sd, af: !eigen && !!el?.leverancier && !!sd && el.leverancier !== sd, sd };
  };
  // Leeg of gelijk aan wat er toch al zou komen = geen eigen keuze (de standaard volgt dan mee); expliciet = toch vastleggen.
  const zetHerkomst = (ids, waarde, expliciet = false) => {
    const patches = [];
    for (const id of ids) {
      const x = info(id); if (!x?.el) continue;
      const vanzelf = x.el.leverancier || x.sd || '';
      const w = juisteNaam(waarde, levLijst);
      const doel = !w ? '' : !expliciet && w === vanzelf ? '' : w;
      if (doel !== x.eigen) patches.push([id, { velden: { ...(x.it.velden || {}), herkomst: doel || null } }]);
    }
    if (patches.length) { onWijzigItems(patches); if (waarde) zorgLeverancier(waarde); }
  };

  const rijen = (groep === 'laag' ? perLaag.flatMap(([l, rs]) => rs.map((r) => ({ ...r, ids: r.ids, _g: l }))) : s.elementen.map((r) => ({ ...r, ids: r.ids, _g: groep === 'lev' ? r.leverancier || ZONDER : r.categorie || 'Overig' })))
    .filter((r) => (lev === null || (r.leverancier || '') === lev) && (!zoek || r.naam.toLowerCase().includes(zoek.toLowerCase())));
  const groepen = new Map(); for (const r of rijen) { if (!groepen.has(r._g)) groepen.set(r._g, []); groepen.get(r._g).push(r); }
  const lijst = [...groepen].sort((a, b) => (a[0] === ZONDER) - (b[0] === ZONDER) || (groep === 'lev' ? b[1].reduce((t, r) => t + r.aantal, 0) - a[1].reduce((t, r) => t + r.aantal, 0) : a[0].localeCompare(b[0], 'nl')));

  // Wat aandacht vraagt: elementen van een andere leverancier dan de standaard, en materiaal zonder leverancier.
  const aandacht = useMemo(() => {
    const af = new Map(); const geen = new Map();
    for (const r of s.elementen) for (const id of r.ids || []) {
      const x = info(id); if (!x?.el) continue;
      if (x.af) { const k = `${x.el.id}`; const v = af.get(k) || { el: x.el, sd: x.sd, ids: [] }; v.ids.push(id); af.set(k, v); }
      if (!x.wie) { const k = `${x.el.categorie || 'Overig'}`; const v = geen.get(k) || { cat: k, ids: new Set(), namen: new Set() }; v.ids.add(id); v.namen.add(x.el.naam); geen.set(k, v); }
    }
    return { af: [...af.values()], geen: [...geen.values()] };
  }, [s, std]); // eslint-disable-line react-hooks/exhaustive-deps
  const categorieen = useMemo(() => {
    const c = new Map();
    for (const it of items) { const el = it.element_id ? elementenMap.get(it.element_id) : null; if (!el?.categorie || el.eigenschappen?.huis) continue; c.set(el.categorie, (c.get(el.categorie) || 0) + 1); }
    for (const k of Object.keys(std)) if (!c.has(k)) c.set(k, 0);
    return sorteerCategorieen([...c.keys()].filter((k) => !ZONDER_LEVERANCIER.includes(k))).map((k) => [k, c.get(k)]);
  }, [items, elementenMap, std]);
  const levVoorCat = (cat) => [...new Set([...leveranciersVoor(levLijst, cat).map((l) => l.naam), ...[...elementenMap.values()].filter((e) => e.categorie === cat && e.leverancier).map((e) => e.leverancier), ...levLijst.filter((l) => l.soort !== 'extern').map((l) => l.naam), ...VASTE(), ...(std[cat] ? [std[cat]] : [])])].sort((a, b) => a.localeCompare(b, 'nl'));

  const wissel = (k) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // Bestellijst (wat) en leverlijst (wat, waar, wanneer) per leverancier, als Excel of PDF.
  const planTekst = `${plan?.naam || ''}${fase ? ` · ${fase.naam}` : ' · alle fasen'}`;
  const contactTekst = (naam) => { const l = levInfo.get(naam); return l ? [l.contactpersoon, l.email, l.telefoon].filter(Boolean).join(' · ') : ''; };
  const regelsVan = (naam) => s.elementen.filter((r) => (r.leverancier || '') === naam);
  const perCategorie = (rijen) => { const uit = [['Element', 'Aantal', 'Meter']]; const cats = sorteerCategorieen([...new Set(rijen.map((r) => r.categorie || 'Andere'))]); for (const c of cats) { uit.push([c, '', '']); for (const r of rijen.filter((x) => (x.categorie || 'Andere') === c)) uit.push([r.naam, getal(r.aantal), r.tekenwijze === 'lijn' && r.meter ? `${getal(r.meter, 1)} m` : '']); } return uit; };
  const bestandsnaam = (soort, naam, ext) => `${soort} ${naam || 'zonder leverancier'} - ${plan?.naam || ''}.${ext}`;
  const bestelXlsx = async (naam) => bewaarBestand(await maakXlsx([{ naam: naam || 'Zonder leverancier', rijen: stuklijstRijen({ elementen: regelsVan(naam) }, false) }]), bestandsnaam('bestellijst', naam, 'xlsx'));
  const bestelPdf = (naam) => bewaarBestand(maakPdf({ titel: `Bestellijst ${naam || 'zonder leverancier'}`, regels: [planTekst, contactTekst(naam)], rijen: perCategorie(regelsVan(naam)), breedtes: [6, 1.2, 1.4], rechts: [1, 2] }), bestandsnaam('bestellijst', naam, 'pdf'));
  const leverXlsx = async (naam) => bewaarBestand(await maakXlsx([{ naam, rijen: leverlijstRijen(items, elementenMap, lagenMap, fasen, naam, std) }]), bestandsnaam('leverlijst', naam, 'xlsx'));
  const leverPdf = (naam) => {
    const r = leverlijstRijen(items, elementenMap, lagenMap, fasen, naam, std);
    const k = [0, 1, 2, 3, 4, 5, 6, 7, 11];
    bewaarBestand(maakPdf({ titel: `Leverlijst ${naam}`, regels: [planTekst, contactTekst(naam), 'Wat, waar en wanneer. De kaart met de juiste plek staat in de Excel-versie per regel.'], rijen: r.map((x) => k.map((i) => x[i])), breedtes: [3.2, 2.2, 1.6, 1.6, 0.9, 0.9, 1.6, 1.6, 2.6], rechts: [4, 5], liggend: true }), bestandsnaam('leverlijst', naam, 'pdf'));
  };
  const levNamen = [...new Set(s.elementen.map((r) => r.leverancier || ''))].sort((a, b) => (!a) - (!b) || a.localeCompare(b, 'nl'));
  const allesXlsx = async () => bewaarBestand(await maakXlsx([{ naam: 'Alles', rijen: stuklijstRijen(s) }, ...levNamen.map((n) => ({ naam: n || 'Zonder leverancier', rijen: stuklijstRijen({ elementen: regelsVan(n) }, false) }))]), `materiaal ${plan?.naam || ''}.xlsx`);
  const allesPdf = () => {
    const rijen = [['Element', 'Aantal', 'Meter']];
    for (const n of levNamen) { rijen.push([`${n || 'Zonder leverancier'}${contactTekst(n) ? ` · ${contactTekst(n)}` : ''}`, '', '']); for (const r of regelsVan(n)) rijen.push([`${r.naam}${r.categorie ? `  (${r.categorie})` : ''}`, getal(r.aantal), r.tekenwijze === 'lijn' && r.meter ? `${getal(r.meter, 1)} m` : '']); }
    bewaarBestand(maakPdf({ titel: 'Materiaal per leverancier', regels: [planTekst], rijen, breedtes: [6, 1.2, 1.4], rechts: [1, 2] }), `materiaal ${plan?.naam || ''}.pdf`);
  };
  const regelSleutel = (r) => `${r._g}|${r.naam}|${r.leverancier}`;

  return (
    <div className={`fm-mat${verborgen ? ' verborgen' : ''}`} role="dialog" aria-label="Materiaal per leverancier" aria-hidden={verborgen || undefined}>
      <datalist id="fm-mat-levs">{alleNamen.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="fm-mat-bar">
        <strong>Materiaal</strong><span className="fm-mat-sub">{plan?.naam}{fase ? ` · ${fase.naam}` : ' · alle fasen'}</span>
        <span style={{ flex: 1 }} />
        <button className={`fm-knop${stdOpen ? ' zwart' : ''}`} onClick={() => setStdOpen((x) => !x)}>Standaardleveranciers</button>
        <a className="fm-knop" href="/maps/leveranciers" target="_blank" rel="noreferrer">Leverancierslijst</a>
        <ExportKnop label="Alles exporteren" opties={[['Excel (.xlsx), blad per leverancier', allesXlsx], ['PDF', allesPdf]]} />
        <button className="fm-knop zwart" onClick={onSluit}>Terug naar de kaart</button>
      </div>
      <div className="fm-mat-body">
        <aside className="fm-mat-links">
          <div className="fm-mat-lab">Leveranciers</div>
          <button className={`fm-mat-levknop${lev === null ? ' aan' : ''}`} onClick={() => setLev(null)}><b>Alle leveranciers</b><span>{getal(s.elementen.reduce((t, r) => t + r.aantal, 0))}</span></button>
          {leveranciers.map(([k, n]) => (
            <button key={k || '_'} className={`fm-mat-levknop${lev === k ? ' aan' : ''}`} onClick={() => setLev(lev === k ? null : k)}>
              <b>{k || ZONDER}</b><span>{getal(n)}</span>
              {k && stdVoor(k).length > 0 && <small>standaard voor {stdVoor(k).join(', ')}</small>}
              {!k && <small>nog toe te wijzen</small>}
            </button>
          ))}
        </aside>
        <main className="fm-mat-midden">
          <div className="fm-mat-werk">
            <span className="fm-mat-lab">Groeperen</span>
            <div className="fm-segment">{[['lev', 'Leverancier'], ['cat', 'Categorie'], ['laag', 'Laag']].map(([k, n]) => <button key={k} className={groep === k ? 'aan' : ''} onClick={() => setGroep(k)}>{n}</button>)}</div>
            <span style={{ flex: 1 }} />
            <input type="search" className="fm-mat-zoek" placeholder="Zoek materiaal" aria-label="Zoek materiaal" value={zoek} onChange={(e) => setZoek(e.target.value)} />
          </div>
          <div className="fm-mat-lijst" ref={lijstRef} onScroll={(e) => { if (!verborgen) scrollRef.current = e.currentTarget.scrollTop; }}>
            {!lijst.length && <div className="fm-sub" style={{ padding: 16 }}>{s.elementen.length ? 'Niets gevonden voor deze keuze.' : 'Nog geen materiaal uit de bibliotheek in dit plan.'}</div>}
            {lijst.map(([g, rs]) => {
              const n = rs.reduce((t, r) => t + r.aantal, 0); const m = rs.reduce((t, r) => t + (r.tekenwijze === 'lijn' ? r.meter || 0 : 0), 0);
              const ids = [...new Set(rs.flatMap((r) => [...(r.ids || [])]))];
              return (
                <section key={g} className="fm-mat-groep">
                  <div className="fm-mat-gkop">
                    <h3>{g}</h3>
                    {groep === 'lev' && stdVoor(g).map((c) => <span key={c} className="fm-tag groen">standaard voor {c}</span>)}
                    {groep === 'cat' && (std[g] ? <span className="fm-tag groen">standaard: {std[g]}</span> : <span className="fm-tag">geen standaard</span>)}
                    <span className="fm-mat-tot">{getal(n)} st.{m ? ` · ${getal(m)} m` : ''}</span>
                    {groep === 'lev' && levInfo.get(g) && (() => { const l = levInfo.get(g); const d = [l.contactpersoon, l.email, l.telefoon].filter(Boolean); return d.length ? <span className="fm-mat-contact">{d.map((x) => <span key={x}>{x}</span>)}</span> : <a className="fm-mat-contact leeg" href="/maps/leveranciers" target="_blank" rel="noreferrer">contact aanvullen</a>; })()}
                    <span style={{ flex: 1 }} />
                    {groep === 'lev' && g !== ZONDER && <><ExportKnop klein label="Bestellijst" opties={[['Excel (.xlsx)', () => bestelXlsx(g)], ['PDF', () => bestelPdf(g)]]} /><ExportKnop klein label="Leverlijst" opties={[['Excel (.xlsx)', () => leverXlsx(g)], ['PDF', () => leverPdf(g)]]} /></>}
                    <button className="fm-knop klein" onClick={() => onToon(ids, g)}>Toon op kaart</button>
                  </div>
                  <table className="fm-mat-tabel">
                    <thead><tr><th>Materiaal</th><th>{groep === 'lev' ? 'Categorie' : 'Geleverd door'}</th><th className="r">Aantal</th><th className="r">Lengte</th><th aria-label="Acties" /></tr></thead>
                    <tbody>
                      {rs.map((r) => {
                        const k = regelSleutel(r); const isOpen = open.has(k); const rIds = [...(r.ids || [])];
                        const xs = rIds.map(info).filter(Boolean); const af = xs.filter((x) => x.af).length; const viaStd = xs.some((x) => x.viaStd);
                        const metEl = xs.filter((x) => x.el);
                        return (
                          <Fragment key={k}>
                            <tr className={`fm-mat-rij${af ? ' af' : ''}${isOpen ? ' open' : ''}`} onClick={() => wissel(k)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) wissel(k); }} aria-expanded={isOpen}>
                              <td><span className="fm-mat-pijl" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>{r.naam}
                                {af > 0 && <span className="fm-tag oranje" title={`De standaard voor ${xs.find((x) => x.af)?.el.categorie} is ${xs.find((x) => x.af)?.sd}`}>wijkt af van de standaard</span>}
                                {viaStd && <span className="fm-tag">via standaard</span>}</td>
                              <td>{groep === 'lev' ? r.categorie : metEl.length ? <LevVeld label={`Geleverd door voor ${r.naam}`} waarde={r.leverancier} placeholder={ZONDER} uit={!schrijven} onKies={(v) => zetHerkomst(rIds, v)} /> : r.leverancier || '—'}</td>
                              <td className="r">{getal(r.aantal)}</td>
                              <td className="r">{r.tekenwijze === 'lijn' && r.meter ? `${getal(r.meter, 1)} m` : ''}</td>
                              <td className="r"><button className="fm-knop klein" onClick={(e) => { e.stopPropagation(); onToon(rIds, r.naam); }}>Toon</button></td>
                            </tr>
                            {isOpen && (
                              <tr className="fm-mat-sub-rij"><td colSpan={5}>
                                <div className="fm-mat-items">
                                  <div className="fm-mat-itemkop"><span>{rIds.length} {rIds.length === 1 ? 'item' : 'items'} op het plan</span>{groep === 'lev' && metEl.length > 0 && <label>Alles van deze regel naar <LevVeld label={`Leverancier voor alle ${r.naam}`} waarde="" placeholder={r.leverancier || 'leverancier'} uit={!schrijven} onKies={(v) => zetHerkomst(rIds, v)} /></label>}</div>
                                  {xs.map((x) => { const mm = x.el ? maten(x.it, x.el) : {}; return (
                                    <div key={x.it.id} className="fm-mat-item">
                                      <span className="n">{x.it.naam || x.el?.naam || 'Item'}</span>
                                      <span className="fm-sub">{lagenMap.get(x.it.laag_id)?.naam || 'Zonder laag'}</span>
                                      <span className="fm-sub r">{x.el?.tekenwijze === 'lijn' && mm.lengte ? `${getal(mm.lengte, 1)} m${mm.stuks != null ? ` · ${mm.stuks} st.` : ''}` : mm.stuks > 1 ? `${mm.stuks} st.` : ''}</span>
                                      {x.el ? <LevVeld label={`Geleverd door voor ${x.it.naam || x.el.naam}`} waarde={x.eigen} placeholder={x.el.leverancier || x.sd || ZONDER} uit={!schrijven} onKies={(v) => zetHerkomst([x.it.id], v)} /> : <span />}
                                      <button className="fm-knop klein" onClick={() => onToon([x.it.id], x.it.naam || x.el?.naam || 'Item')}>Toon</button>
                                    </div>
                                  ); })}
                                </div>
                              </td></tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
        </main>
        <aside className="fm-mat-rechts">
          {stdOpen ? (
            <>
              <div className="fm-mat-lab">Standaardleveranciers · per categorie</div>
              <div className="fm-sub">Geldt voor items zonder eigen keuze, van elementen zonder vaste leverancier. Per item of per regel kan je altijd afwijken.</div>
              {categorieen.map(([c, n]) => (
                <label key={c} className="fm-mat-std">
                  <span><b>{c}</b><small>{n ? `${n} items op dit plan` : 'niet op dit plan'}</small></span>
                  <select disabled={!schrijven} value={std[c] || ''} onChange={(e) => { const nw = { ...std }; if (e.target.value) nw[c] = e.target.value; else delete nw[c]; onStd(nw); }}>
                    <option value="">Geen standaard</option>
                    {levVoorCat(c).map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
              ))}
            </>
          ) : (
            <>
              <div className="fm-mat-lab">Vraagt aandacht</div>
              {aandacht.af.map((a) => (
                <div key={a.el.id} className="fm-mat-kaart af">
                  <b>{a.el.naam} · {a.ids.length} {a.ids.length === 1 ? 'item' : 'items'}</b>
                  <span>Komt van {a.el.leverancier}, terwijl {a.el.categorie} in dit plan van {a.sd} komt.</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="fm-knop klein" onClick={() => onToon(a.ids, a.el.naam)}>Toon op kaart</button>
                    {schrijven && <button className="fm-knop klein" onClick={() => zetHerkomst(a.ids, a.el.leverancier, true)}>Zo laten</button>}
                  </span>
                </div>
              ))}
              {aandacht.geen.map((g) => (
                <div key={g.cat} className="fm-mat-kaart geen">
                  <b>{g.cat} · {g.ids.size} {g.ids.size === 1 ? 'item' : 'items'} zonder leverancier</b>
                  <span>{[...g.namen].slice(0, 4).join(', ')}{g.namen.size > 4 ? ' …' : ''}</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="fm-knop klein" onClick={() => onToon([...g.ids], `${g.cat} zonder leverancier`)}>Toon op kaart</button>
                    {schrijven && <button className="fm-knop klein" onClick={() => setStdOpen(true)}>Standaard kiezen</button>}
                  </span>
                </div>
              ))}
              {!aandacht.af.length && !aandacht.geen.length && <div className="fm-mat-kaart"><b>Alles toegewezen</b><span>Elk stuk materiaal heeft een leverancier.</span></div>}
              <div className="fm-sub" style={{ marginTop: 6 }}>Klik een regel open om te zien uit welke items ze bestaat. Leverancier wisselen kan per regel of per item; leeg laten = de standaard.</div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
