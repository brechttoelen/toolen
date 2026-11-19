'use client';

// Leveranciers › Toewijzen: al het materiaal van de kaart, gegroepeerd per categorie, laag, groep of leverancier.
// Per regel, per groep of voor een selectie kies je wie het levert; dat komt op de items zelf (velden.herkomst),
// dezelfde plek als "Geleverd door" op de kaart. Vervangt het vroegere materiaalscherm van de kaart.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { berekenStuklijst } from '../maps/Stuklijst';
import { GEEN_LEV } from '../maps/stijl';
import { getOrganisatie } from '../maps/merk';
import { Keuze, Seg, Zoek, useVolHoogte } from './gedeeld';
import { ZONDER_LEVERANCIER } from '../maps/categorieen';
import { opId } from './data';
import RijKaart from './RijKaart';

export const ZONDER = 'Zonder leverancier';
const getal = (x, d = 0) => Number(x || 0).toLocaleString('nl-BE', { maximumFractionDigits: d });
const pijl = <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function materiaal(f) {
  const els = new Map((f.elementen || []).map((e) => [e.id, e]));
  const lagen = opId(f.lagen);
  const items = (f.items || []).filter((i) => !i.vast && !i.verborgen);
  return { els, lagen, items };
}
function regelsVan(items, els, lagen) {
  try { return berekenStuklijst(items, els, lagen, null, {}).elementen || []; } catch { return []; }
}

// Hoeveel materiaal op de kaart niemand levert (voor de lijst Per leverancier).
export function zonderLeverancier(f) {
  const { els, lagen, items } = materiaal(f);
  const im = new Map(items.map((i) => [i.id, i]));
  const rs = regelsVan(items, els, lagen).filter((r) => !r.leverancier && !ZONDER_LEVERANCIER.includes(r.categorie) && [...(r.ids || [])].some((id) => { const it = im.get(id); return it?.element_id && els.has(it.element_id); }));
  return { regels: rs.length, stuks: rs.reduce((t, r) => t + (Number(r.aantal) || 0), 0) };
}

// Leverancier kiezen of typen; een nieuwe naam kan meteen.
function LevKeuze({ waarde, namen, uit, onKies, label, breed = 200 }) {
  const opties = useMemo(() => namen.map((n) => ({ id: n, naam: n })), [namen]);
  const inLijst = !!waarde && namen.includes(waarde);
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', width: breed, maxWidth: '100%' }}>
      <Keuze waarde={inLijst ? waarde : null} tekst={inLijst ? '' : (waarde || '')} opties={opties} vrij uit={uit} label={label} placeholder={ZONDER} leeg={ZONDER}
        onChange={(v) => onKies(v || '')} onVrij={(t) => onKies(t || '')} style={{ width: '100%' }} />
    </span>
  );
}

export default function Toewijzen({ f, startZonder = false, onBestelling, schakel = null }) {
  const romp = useRef(null); const hoogte = useVolHoogte(romp);
  const { els, lagen, items } = useMemo(() => materiaal(f), [f.elementen, f.lagen, f.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [groep, setGroep] = useState('cat');
  const [zonder, setZonder] = useState(startZonder);
  const [zoek, setZoek] = useState('');
  const [open, setOpen] = useState(null);         // één regel tegelijk open: er is één kaart
  const [sel, setSel] = useState(() => new Map()); // regelsleutel → ids
  useEffect(() => { setSel(new Map()); setOpen(null); }, [groep]);
  const s = f.schrijven;

  // Regels per groep: per laag en per groep van de kaart een eigen telling.
  const groepen = useMemo(() => {
    const per = (sleutel, naam) => {
      const m = new Map(); for (const it of items) { const k = sleutel(it); if (!m.has(k)) m.set(k, []); m.get(k).push(it); }
      return [...m].map(([k, l]) => [naam(k, l), regelsVan(l, els, lagen)]);
    };
    let lijst;
    if (groep === 'laag') lijst = per((i) => i.laag_id || '', (k) => lagen.get(k)?.naam || 'Zonder laag');
    else if (groep === 'groep') {
      const gn = f.plan?.instellingen?.groepen || {}; let n = 0;
      lijst = per((i) => i.groep_id || '', (k, l) => (!k ? 'Zonder groep' : gn[k]?.naam || l.find((x) => x.naam)?.naam || `Groep ${++n}`));
    } else {
      const rs = regelsVan(items, els, lagen); const m = new Map();
      for (const r of rs) { const k = groep === 'lev' ? (r.leverancier || ZONDER) : (r.categorie || 'Overig'); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
      lijst = [...m];
    }
    return lijst.filter(([, rs]) => rs.length).sort((a, b) => (b[0] === ZONDER) - (a[0] === ZONDER) || a[0].localeCompare(b[0], 'nl', { numeric: true }));
  }, [groep, items, els, lagen, f.plan]);

  // Items met een element in de bibliotheek: enkel die krijgen een leverancier.
  const metEl = (ids) => [...(ids || [])].filter((id) => { const it = itemMap.get(id); return it?.element_id && els.has(it.element_id); });
  const q = zoek.trim().toLowerCase();
  const zichtbaar = groepen.map(([g, rs]) => [g, rs.filter((r) => metEl(r.ids).length && (!zonder || (!r.leverancier && !ZONDER_LEVERANCIER.includes(r.categorie))) && (!q || r.naam.toLowerCase().includes(q) || (r.leverancier || '').toLowerCase().includes(q) || g.toLowerCase().includes(q)))]).filter(([, rs]) => rs.length);
  const sleutel = (g, r) => `${g}|${r.naam}|${r.leverancier}|${[...(r.ids || [])][0] || ''}`;
  const namenVan = (r) => [...new Set(metEl(r.ids).map((id) => itemMap.get(id)?.naam).filter((n) => n && n !== r.naam))];

  const orgNaam = getOrganisatie()?.kort || getOrganisatie()?.naam || '';
  const namen = useMemo(() => [...new Set([orgNaam, 'Gemeente', ...(f.d.leveranciers || []).filter((l) => l.actief !== false).map((l) => l.naam), ...groepen.flatMap(([, rs]) => rs.map((r) => r.leverancier))].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl')), [f.d.leveranciers, groepen, orgNaam]);
  const juist = (n) => { const t = String(n || '').trim(); return namen.find((x) => x.toLowerCase() === t.toLowerCase()) || t; };

  // Toewijzen: leeg = echt niemand. Heeft het element een vaste leverancier, dan leggen we "geen" vast.
  // Gelijk aan de vaste leverancier van het element = geen eigen keuze nodig.
  const toewijs = async (ids, waarde) => {
    const w = juist(waarde); const per = new Map();
    for (const id of metEl(ids)) {
      const it = itemMap.get(id); const el = els.get(it.element_id);
      const doel = !w ? (el?.leverancier ? GEEN_LEV : '') : w === el?.leverancier ? '' : w;
      if (String(it.velden?.herkomst || '').trim() === doel) continue;
      if (!per.has(doel)) per.set(doel, []); per.get(doel).push(id);
    }
    if (!per.size) return;
    if (w && !(f.d.leveranciers || []).some((l) => l.naam.toLowerCase() === w.toLowerCase()) && w !== orgNaam && w !== 'Gemeente') await f.voegToe('leveranciers', { naam: w, organisatie_id: f.plan.organisatie_id });
    await f.herkomstZet([...per]);
    const n = [...per.values()].reduce((t, x) => t + x.length, 0);
    f.meld(`${n} ${n === 1 ? 'item' : 'items'} ${w ? `naar ${w}` : 'zonder leverancier'}`);
  };

  const selIds = [...new Set([...sel.values()].flat())];
  const selRegels = zichtbaar.flatMap(([g, rs]) => rs.filter((r) => sel.has(sleutel(g, r))));
  const selLev = [...new Set(selRegels.map((r) => r.leverancier || ''))];
  const kies = (k, ids) => setSel((m) => { const n = new Map(m); if (n.has(k)) n.delete(k); else n.set(k, ids); return n; });
  const kiesGroep = (g, rs, aan) => setSel((m) => { const n = new Map(m); for (const r of rs) { const k = sleutel(g, r); if (aan) n.set(k, metEl(r.ids)); else n.delete(k); } return n; });
  const toonOpKaart = (ids, label) => {
    try { localStorage.setItem(`fm-toon-${f.plan.id}`, JSON.stringify({ ids, label, op: Date.now() })); } catch { /* geen opslag */ }
    window.location.href = `/maps/${f.plan.id}?toon=1`;
  };
  const nZonder = groepen.reduce((t, [, rs]) => t + rs.filter((r) => !r.leverancier && !ZONDER_LEVERANCIER.includes(r.categorie) && metEl(r.ids).length).reduce((u, r) => u + (Number(r.aantal) || 0), 0), 0);

  return (
    <div className="pf-plan pf-toew" ref={romp} style={hoogte ? { height: hoogte } : undefined}>
      {s && selIds.length > 0 ? (
        <div className="pf-planbalk sel" role="toolbar" aria-label="Selectie toewijzen">
          <b>{selRegels.length} {selRegels.length === 1 ? 'regel' : 'regels'} · {getal(selIds.length)} items</b>
          <span className="pf-klein" style={{ opacity: 0.85, whiteSpace: 'nowrap', marginRight: 4 }}>Leverancier</span>
          <span className="pf-toew-bulkkeuze"><LevKeuze namen={namen} waarde="" label="Leverancier voor de selectie" breed={200} onKies={async (v) => { await toewijs(selIds, v); setSel(new Map()); }} /></span>
          <span className="sep" />
          <button className="pf-bknop" onClick={() => toonOpKaart(selIds, `${selRegels.length} regels`)}>Toon op de kaart</button>
          {selLev.length === 1 && selLev[0] && onBestelling && <button className="pf-bknop" onClick={() => onBestelling(selLev[0])}>Naar de bestelling</button>}
          <span style={{ flex: 1 }} />
          <button className="pf-bknop" onClick={() => setSel(new Map())} aria-label="Selectie wissen">✕</button>
        </div>
      ) : (
        <div className="pf-planbalk">
          {schakel}
          <Seg waarde={groep} onChange={setGroep} label="Groeperen" opties={[['cat', 'Categorie'], ['laag', 'Laag'], ['groep', 'Groep'], ['lev', 'Leverancier']]} />
          <Zoek waarde={zoek} onChange={setZoek} placeholder="Zoek materiaal of leverancier" />
          <button className={`pf-chip ${zonder ? 'aan let' : ''}`} aria-pressed={zonder} onClick={() => setZonder(!zonder)}>{ZONDER}{nZonder ? ` · ${getal(nZonder)}` : ''}{zonder ? ' ✕' : ''}</button>
          <div className="pf-vul" />
        </div>
      )}

      <div className="pf-tabvak pf-planvak">
        <table className="pf-tabel" style={{ minWidth: 760 }}>
          <thead><tr><th style={{ width: 52 }} /><th>Materiaal</th><th className="getal" style={{ width: 110 }}>Aantal</th><th style={{ width: 230 }}>Geleverd door</th></tr></thead>
          <tbody>
            {!zichtbaar.length && <tr><td colSpan={4} className="pf-leeg">{zonder ? 'Alle materiaal op de kaart heeft een leverancier.' : q ? 'Niets gevonden.' : 'Nog geen materiaal op de kaart.'}</td></tr>}
            {zichtbaar.map(([g, rs]) => {
              const alle = rs.every((r) => sel.has(sleutel(g, r)));
              const ids = rs.flatMap((r) => metEl(r.ids));
              const levs = [...new Set(rs.map((r) => r.leverancier || ''))];
              const stuks = rs.reduce((t, r) => t + (Number(r.aantal) || 0), 0); const meter = rs.reduce((t, r) => t + (r.tekenwijze === 'lijn' ? Number(r.meter) || 0 : 0), 0);
              return (
                <Fragment key={g}>
                  <tr className={`groep pf-toew-groep ${g === ZONDER ? 'let-op' : ''}`}><td colSpan={4}>
                    <span className="pf-dagkop">
                      <span className="pf-dagvak">{s && <input type="checkbox" checked={alle} onChange={() => kiesGroep(g, rs, !alle)} aria-label={`Alles van ${g} selecteren`} />}</span>
                      <b>{g}</b>{ZONDER_LEVERANCIER.includes(g) && <span className="pf-klein">van de locatie, telt niet als zonder leverancier</span>}<span>{getal(stuks)} st.{meter ? ` · ${getal(meter)} m` : ''} · {rs.length} {rs.length === 1 ? 'regel' : 'regels'}</span>
                      <span className="pf-vul" />
                      {s && groep !== 'lev' && <><span className="pf-klein">Hele groep naar</span><LevKeuze namen={namen} waarde={levs.length === 1 ? levs[0] : ''} label={`Leverancier voor heel ${g}`} breed={190} onKies={(v) => toewijs(ids, v)} /></>}
                    </span>
                  </td></tr>
                  {rs.map((r) => {
                    const k = sleutel(g, r); const rIds = metEl(r.ids); const isOpen = open === k; const nm = namenVan(r);
                    return (
                      <Fragment key={k}>
                        <tr className={`${sel.has(k) || isOpen ? 'gekozen' : ''} ${r.leverancier || ZONDER_LEVERANCIER.includes(r.categorie) ? '' : 'pf-toew-zonder'}`}>
                          <td className="pf-pijlcel"><span className="pf-vakjes">{s ? <input type="checkbox" checked={sel.has(k)} onChange={() => kies(k, rIds)} aria-label={`${r.naam} selecteren`} /> : <span />}<button className="pf-pijl" aria-expanded={isOpen} aria-label="Toon op de luchtfoto" onClick={() => setOpen(isOpen ? null : k)}>{pijl}</button></span></td>
                          <td><b>{r.naam}</b><small>{[groep !== 'cat' && r.categorie, nm.length && `${nm.slice(0, 6).join(', ')}${nm.length > 6 ? ` +${nm.length - 6}` : ''}`].filter(Boolean).join(' · ') || `${rIds.length} ${rIds.length === 1 ? 'item' : 'items'} op de kaart`}</small></td>
                          <td className="getal">{getal(r.aantal)} st.{r.tekenwijze === 'lijn' && r.meter ? <small>{getal(r.meter, 1)} m</small> : null}</td>
                          <td><LevKeuze namen={namen} waarde={r.leverancier || ''} uit={!s} label={`Geleverd door voor ${r.naam}`} onKies={(v) => toewijs(rIds, v)} breed={210} /></td>
                        </tr>
                        {isOpen && <tr className="pf-kaartrij"><td colSpan={4}>
                          <RijKaart plan={f.plan} items={f.items} lagen={f.lagen} elementen={f.elementen} ids={rIds} onSluit={() => setOpen(null)} />
                          {rIds.length > 1 && rIds.length <= 80 && (
                            <div className="pf-toew-items">
                              {rIds.map((id) => { const it = itemMap.get(id); const el = els.get(it.element_id); const h = String(it.velden?.herkomst || '').trim(); const wie = h === GEEN_LEV ? '' : h || el?.leverancier || '';
                                return <div key={id} className="pf-toew-item"><span>{it.naam || el?.naam || 'Item'}</span><LevKeuze namen={namen} waarde={wie} uit={!s} label={`Geleverd door voor ${it.naam || el?.naam || 'item'}`} breed={190} onKies={(v) => toewijs([id], v)} /></div>; })}
                            </div>
                          )}
                        </td></tr>}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
