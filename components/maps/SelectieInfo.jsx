'use client';

// Rechterpaneel bij meerdere geselecteerde items: wat er geselecteerd is (per soort, met
// totalen) en wat je in één keer kunt aanpassen: laag, fasen, geleverd door, vergrendelen.
import { useState } from 'react';
import * as geo from './geo';
import { maten, isHekElement } from './stijl';
import { schoorTussen } from './verstevig';
import { LaagOpties } from './laagOpties';
import { stroomVan } from './stroom';

const SOORT = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', notitie: 'Notitie', veelhoek: 'Veelhoek', ellips: 'Ellips', sector: 'Kijkhoek', afstand: 'Maatlijn' };
const g1 = (v) => (Math.round(v * 10) / 10).toLocaleString('nl-BE');

export default function SelectieInfo({ sel, lagen, lagenMap, fasen, elementenMap, schrijven, onWijzig, onVerwijder, onSluit, onKies, onMaak }) {
  const [herkomst, setHerkomst] = useState('');
  const [schoor, setSchoor] = useState({ om: 5, patroon: 'zigzag' });
  // Twee nadarlijnen geselecteerd: schuine dranghekken ertussen om ze te verstevigen.
  const hekken = sel.filter((x) => x.geometrie?.type === 'LineString' && isHekElement(elementenMap.get(x.element_id)));
  const schuinEl = hekken.length === 2 && sel.length === 2 ? ([...elementenMap.values()].find((e) => /schuin/i.test(e.naam || '') && isHekElement(e)) || elementenMap.get(hekken[0].element_id)) : null;
  const plaatsSchoren = () => {
    const L = Number(schuinEl.eenheid_m) || 2.5;
    const { lijnen } = schoorTussen(hekken[0].geometrie.coordinates, hekken[1].geometrie.coordinates, { om: schoor.om, lengte: L, patroon: schoor.patroon });
    onMaak(lijnen.map((c) => ({ soort: 'element', element_id: schuinEl.id, laag_id: hekken[0].laag_id, fase_ids: hekken[0].fase_ids || null, geometrie: { type: 'LineString', coordinates: c }, parameters: {}, naam: 'Schuin hek (versteviging)' })));
  };
  // Twee stroomgroepen geselecteerd: koppelen als twin (de eerste draagt de aansluitingen).
  const gens = sel.length === 2 ? sel.map((x) => ({ it: x, s: stroomVan(x, elementenMap.get(x.element_id)) })).filter((x) => x.s.rol === 'bron' && !x.s.vast) : [];
  const twinVan = gens.length === 2 ? gens.find((x) => x.s.twin === gens.find((y) => y !== x).it.id) : null;
  const zetStroom = (x, patch) => onWijzig(x.it.id, { velden: { ...(x.it.velden || {}), stroom: { ...(x.it.velden?.stroom || {}), ...patch } } });
  const koppelTwin = (wijze) => { zetStroom(gens[0], { twin: gens[1].it.id, twinWijze: wijze }); if (gens[1].s.twin) zetStroom(gens[1], { twin: null }); };
  // Per soort element: aantal, stuks, meter, m².
  const per = new Map();
  for (const it of sel) {
    const el = it.element_id ? elementenMap.get(it.element_id) : null;
    const sleutel = el ? `e:${el.id}` : `s:${it.soort}`;
    const r = per.get(sleutel) || { naam: el?.naam || SOORT[it.soort] || it.soort, n: 0, stuks: 0, m: 0, m2: 0, ids: [] };
    r.n += 1; r.ids.push(it.id);
    const mt = maten(it, el);
    if (mt.stuks) r.stuks += mt.stuks;
    if (it.geometrie?.type === 'LineString') r.m += geo.lengte(it.geometrie);
    if (it.geometrie?.type === 'Polygon' && !el) r.m2 += geo.oppervlakte(it.geometrie);
    per.set(sleutel, r);
  }
  const rijen = [...per.values()].sort((a, b) => b.n - a.n);
  const laagIds = [...new Set(sel.map((x) => x.laag_id))];
  const herk = [...new Set(sel.filter((x) => x.element_id).map((x) => x.velden?.herkomst || ''))];
  const slot = sel.filter((x) => x.vergrendeld).length;
  const zet = (f) => { for (const it of sel) { const p = f(it); if (p) onWijzig(it.id, p); } };
  const faseStaat = (id) => { const n = sel.filter((x) => x.fase_ids?.includes(id)).length; return n === 0 ? 'geen' : n === sel.length ? 'alle' : 'deels'; };
  return (
    <aside className="fm-eigenschappen">
      <div className="fm-paneelkop"><span className="fm-paneelnaam">{sel.length} geselecteerd</span><button className="fm-sluit" aria-label="Selectie opheffen" onClick={onSluit}>×</button></div>
      <div className="fm-paneel-inhoud fm-selinfo">
        <div className="fm-sectie">
          <div className="fm-kop">In de selectie</div>
          <table className="fm-tabel fm-selinfo-tabel">
            <tbody>
              {rijen.map((r) => (
                <tr key={r.naam} onClick={() => onKies?.(r.ids)} title="Enkel deze selecteren">
                  <td><span className="fm-afkap">{r.naam}</span></td>
                  <td className="getal">{r.n}×</td>
                  <td className="getal fm-sub">{[r.stuks && r.stuks !== r.n ? `${r.stuks} st.` : '', r.m ? `${g1(r.m)} m` : '', r.m2 ? `${Math.round(r.m2)} m²` : ''].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {schrijven && gens.length === 2 && (
          <div className="fm-sectie">
            <div className="fm-kop">Twin</div>
            {twinVan ? (
              <>
                <div className="fm-sub">{twinVan.s.twinWijze === 'reserve' ? `Gekoppeld: telt als ${twinVan.s.kva || '?'} kVA, de tweede is reserve.` : `Gekoppeld: telt als één bron van ${(Number(gens[0].s.kva) || 0) + (Number(gens[1].s.kva) || 0)} kVA.`}</div>
                <div className="fm-selinfo-rij">
                  <div className="fm-segment" role="group" aria-label="Werking">
                    {[['samen', 'Samen leveren'], ['reserve', 'Reserve']].map(([k, n]) => <button key={k} className={twinVan.s.twinWijze === k ? 'aan' : ''} onClick={() => zetStroom(twinVan, { twinWijze: k })}>{n}</button>)}
                  </div>
                  <button className="fm-knop klein" onClick={() => zetStroom(twinVan, { twin: null })}>Ontkoppelen</button>
                </div>
              </>
            ) : (
              <>
                <div className="fm-sub">Twee stroomgroepen als één bron in de stroomberekening.</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="fm-knop klein zwart" onClick={() => koppelTwin('samen')}>Koppelen · samen leveren</button>
                  <button className="fm-knop klein" onClick={() => koppelTwin('reserve')}>Koppelen · één als reserve</button>
                </div>
              </>
            )}
          </div>
        )}
        {schrijven && schuinEl && onMaak && (() => {
          const L = Number(schuinEl.eenheid_m) || 2.5;
          const v = schoorTussen(hekken[0].geometrie.coordinates, hekken[1].geometrie.coordinates, { om: schoor.om, lengte: L, patroon: schoor.patroon });
          return (
            <div className="fm-sectie">
              <div className="fm-kop">Verstevigen tussen de twee lijnen</div>
              <div className="fm-selinfo-rij">
                <div className="fm-segment" role="group" aria-label="Patroon">
                  {[['zigzag', 'Zigzag'], ['schuin', 'Schuin']].map(([k, n]) => <button key={k} className={schoor.patroon === k ? 'aan' : ''} onClick={() => setSchoor((x) => ({ ...x, patroon: k }))}>{n}</button>)}
                </div>
                <label className="fm-sub" style={{ whiteSpace: 'nowrap' }}>om <input type="number" min="2" step="0.5" value={schoor.om} style={{ width: 56 }} onChange={(e) => setSchoor((x) => ({ ...x, om: Number(e.target.value) || 5 }))} /> m</label>
              </div>
              <div className="fm-sub">{v.lijnen.length} × {schuinEl.naam}{v.tebreed ? ` · ${v.tebreed} keer is de tussenruimte breder dan ${g1(L)} m` : ''}</div>
              <button className="fm-knop klein zwart" disabled={!v.lijnen.length} onClick={plaatsSchoren}>Schuine hekken plaatsen</button>
            </div>
          );
        })()}
        {schrijven && (
          <div className="fm-sectie">
            <label className="fm-veld">Laag
              <select value={laagIds.length === 1 ? laagIds[0] || '' : ''} onChange={(e) => { const d = e.target.value; if (d) zet((x) => (x.laag_id !== d && !x.vergrendeld ? { laag_id: d } : null)); }}>
                {laagIds.length !== 1 && <option value="">{laagIds.length} verschillende lagen</option>}
                <LaagOpties lagen={lagen} />
              </select>
            </label>
            {laagIds.length > 1 && <div className="fm-sub">{laagIds.map((id) => lagenMap.get(id)?.naam || 'zonder laag').join(', ')}</div>}
            {fasen.length > 0 && (
              <div>
                <div className="fm-sub" style={{ marginBottom: 4 }}>Fasen (geen vinkje = in alle fasen)</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {fasen.map((f) => { const s = faseStaat(f.id); return (
                    <label key={f.id} className="fm-vink"><input type="checkbox" checked={s === 'alle'} ref={(el) => { if (el) el.indeterminate = s === 'deels'; }}
                      onChange={() => zet((x) => { if (x.vergrendeld) return null; const l = x.fase_ids || []; const nl = s === 'alle' ? l.filter((y) => y !== f.id) : [...new Set([...l, f.id])]; return { fase_ids: nl.length ? nl : null }; })} />{f.naam}</label>
                  ); })}
                </div>
              </div>
            )}
            {sel.some((x) => x.element_id) && (
              <div className="fm-veld">Geleverd door
                <div className="fm-selinfo-rij">
                  <input aria-label="Geleverd door" value={herkomst} placeholder={herk.length === 1 ? herk[0] || 'leverancier uit de bibliotheek' : `${herk.length} verschillende`} onChange={(e) => setHerkomst(e.target.value)} />
                  <button className="fm-knop klein" disabled={!herkomst.trim()} onClick={() => { const v = herkomst.trim(); zet((x) => (x.element_id && !x.vergrendeld ? { velden: { ...(x.velden || {}), herkomst: v } } : null)); setHerkomst(''); }}>Instellen</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="fm-knop klein" onClick={() => zet((x) => ({ vergrendeld: slot !== sel.length }))}>{slot === sel.length ? 'Ontgrendelen' : 'Vergrendelen'}</button>
              <button className="fm-knop klein" onClick={() => zet((x) => (x.vergrendeld ? null : { verborgen: true }))}>Verbergen</button>
              <span style={{ flex: 1 }} />
              <button className="fm-knop klein" style={{ color: '#B4123A' }} onClick={() => onVerwijder(sel.filter((x) => !x.vergrendeld).map((x) => x.id))}>Wissen</button>
            </div>
            {slot > 0 && <div className="fm-sub">{slot} vergrendeld: die blijven ongewijzigd.</div>}
          </div>
        )}
      </div>
    </aside>
  );
}
