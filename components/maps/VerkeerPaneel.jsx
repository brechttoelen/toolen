'use client';

// Verkeer (Signalisatie-werkruimte, modus Verkeer): borden zetten, parkeerverbod,
// afsluiting en omleiding tekenen, lijst per soort, stuklijst en export.
import { useState } from 'react';
import Info from './info';
import { osrmManoeuvres, knikken, routeLijn } from './signVoorstel';
import {
  BORDEN, BORD_MAP, BORD_PIJLEN, SNELHEDEN, ONDERBORDEN, SOORTEN, instVerkeer, isVerkeerBord, verkeerGroepen, verkeerStuklijst,
  bordSvg, onderbordSvg, bordPng, icoonSleutel, bordOmschrijving, onderbordTekst, periodeTekst, lengteVan, aantalE1, aantalNadars,
  f41Kandidaten, f41Plannen, f41Status, volgendVerkeerNr, straatBij,
} from './verkeer';

const STATUS = { voorstel: ['V', '#2563EB', 'Voorstel van de tool'], aangepast: ['A', '#D97706', 'Voorstel, door jou aangepast'], eigen: ['E', '#686D76', 'Zelf gezet'] };
const m0 = (n) => `${Math.round(n)} m`;
const Svg = ({ svg, breedte }) => <span style={{ display: 'inline-block', width: breedte, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />; // eslint-disable-line react/no-danger

// Bord met onderbord, zoals het aan de paal hangt.
export function BordVoorbeeld({ v, breedte = 110 }) {
  const ob = onderbordTekst(v);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Svg svg={bordSvg(icoonSleutel(v), breedte)} breedte={breedte} />
      {ob && <Svg svg={onderbordSvg(ob, breedte)} breedte={breedte} />}
    </div>
  );
}

export default function VerkeerPaneel({ plan, items, schrijven, geselecteerd, zetBord, onZetBord, onTool, onPlan, onWijzigItem, onKiesItem, onVoorstel, onExport, kop = null }) {
  const inst = instVerkeer(plan);
  const g = verkeerGroepen(items);
  const lijst = verkeerStuklijst(items, inst);
  const [voorstel, setVoorstel] = useState(null);
  const [bezig, setBezig] = useState('');
  const [melding, setMelding] = useState('');
  const zetInst = (patch) => onPlan({ instellingen: { ...(plan.instellingen || {}), verkeer: { ...inst, ...patch } } });
  const totaal = g.bord.length + g.parkeerverbod.length + g.afsluiting.length + g.omleiding.length;

  // F41-borden voorstellen op de echte afslagen van een omleiding.
  const stelVoor = async (om) => {
    setMelding(''); setVoorstel(null);
    const coords = routeLijn(om, null);
    if (!coords) return;
    setBezig('Afslagen zoeken…');
    try {
      let res;
      try { res = await osrmManoeuvres(coords); } catch { res = knikken(coords); }
      const kand = f41Kandidaten(om, coords, res);
      setVoorstel({ id: om.id, acties: f41Plannen(om, kand, items), terugval: !!res.terugval, kand });
    } catch (e) { setMelding(e?.message || String(e)); }
    setBezig('');
  };
  const pasToe = () => {
    const a = voorstel.acties;
    const om = items.find((x) => x.id === voorstel.id);
    let nr = volgendVerkeerNr(items) - 1;
    const nieuw = a.nieuw.sort((x, y) => x.k.pos - y.k.pos).map(({ k, auto }) => ({
      laag_id: om?.laag_id, geometrie: { type: 'Point', coordinates: k.plek }, naam: `F41 ${nr += 1}`,
      velden: { verkeer: { soort: 'bord', bord: 'F41', pijl: k.pijl, tekst: om?.velden?.verkeer?.tekst || '', kijkrichting: k.richting, nr, onderbord: '', auto } },
    }));
    onVoorstel({ nieuw, wijzig: a.bijwerken, weg: a.vervalt });
    setVoorstel(null);
  };
  // Straatnamen ophalen voor borden zonder straat (1 per seconde, Nominatim).
  const straten = async () => {
    const zonder = g.bord.filter((b) => !b.velden.verkeer.straat);
    if (!zonder.length) { setMelding('Elk bord heeft al een straat.'); return; }
    for (const [i, b] of zonder.entries()) {
      setBezig(`Straat ${i + 1} van ${zonder.length}…`);
      const s = await straatBij(b.geometrie.coordinates);
      if (s) onWijzigItem(b.id, { velden: { ...b.velden, verkeer: { ...b.velden.verkeer, straat: s } } });
    }
    setBezig('');
  };

  const rij = (it, inhoud, extra = null) => (
    <button key={it.id} onClick={() => onKiesItem(it.id)} style={{ display: 'flex', width: '100%', gap: 6, alignItems: 'center', padding: '3px 6px', border: it.id === geselecteerd ? '2px solid #1d1d1b' : '1px solid #e8e8e6', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12 }}>
      {inhoud}{extra}
    </button>
  );
  const groepKop = (soort, n, extra) => <div className="fm-kop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}>{SOORTEN[soort]} · {n}</span>{extra}</div>;

  return (
    <div>
      {kop}
      <div className="fm-sectie" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <span className="fm-sub" style={{ flex: 1 }}>{g.bord.length} borden · {lijst.e1} E1 · {lijst.nadars} nadars</span>
        <Info>Borden: kies een bord en klik op de kaart, aan de kant van de weg waar het staat. Parkeerverbod en afsluiting teken je als lijn; de borden en nadars worden geteld. Omleiding: teken de route en laat de F41-borden voorstellen.</Info>
      </div>

      {/* Zetten en tekenen */}
      {schrijven && (
        <div className="fm-sectie">
          <div className="fm-kop">Bord zetten{zetBord ? <span className="fm-sub" style={{ color: '#8A4D00', fontWeight: 400 }}> · klik op de kaart</span> : null}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
            {BORDEN.map((b) => (
              <button key={b.code} title={`${b.code} · ${b.naam}`} aria-pressed={zetBord === b.code} onClick={() => onZetBord(zetBord === b.code ? null : b.code)}
                style={{ padding: 3, border: zetBord === b.code ? '2px solid #1d1d1b' : '1px solid #e8e8e6', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <img src={bordPng(icoonSleutel({ bord: b.code, waarde: 50, pijl: 'rechts' }))} alt="" width={28} height={28} />
                <span style={{ fontSize: 9.5, fontWeight: 600 }}>{b.code === 'NADAR' ? 'Nadar' : b.code}</span>
              </button>
            ))}
          </div>
          <div className="fm-kop">Lijn tekenen</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            <button className="fm-knop klein" onClick={() => onTool('parkeerverbod')}>Parkeerverbod</button>
            <button className="fm-knop klein" onClick={() => onTool('afsluiting')}>Afsluiting</button>
            <button className="fm-knop klein" onClick={() => onTool('omleiding')}>Omleiding</button>
          </div>
          <details className="fm-meer"><summary>Standaard datum en uur · E1 om de {inst.interval} m</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 8px 0' }}>
              <div className="fm-raster2">
                <label className="fm-veld">Van<input type="datetime-local" value={inst.van} onChange={(e) => zetInst({ van: e.target.value })} /></label>
                <label className="fm-veld">Tot<input type="datetime-local" value={inst.tot} onChange={(e) => zetInst({ tot: e.target.value })} /></label>
              </div>
              {periodeTekst(inst.van, inst.tot) && <div className="fm-sub">Onderbord: {periodeTekst(inst.van, inst.tot)}</div>}
              <label className="fm-veld">E1 om de … m (parkeerverbod)<input type="number" min="5" max="100" step="5" value={inst.interval} onChange={(e) => zetInst({ interval: Number(e.target.value) || 15 })} /></label>
            </div>
          </details>
        </div>
      )}

      {/* Lijst per soort */}
      <div className="fm-sectie">
        {!totaal && <div className="fm-leeglijst"><strong>Nog geen verkeerssignalisatie</strong>Zet een bord of teken een parkeerverbod, afsluiting of omleiding.</div>}
        {g.bord.length > 0 && (
          <>
            {groepKop('bord', g.bord.length, <Info>V = voorstel (F41 uit een omleiding), A = voorstel dat je aanpaste, E = zelf gezet. Een ! betekent: zonder routeplanner berekend, controleren.</Info>)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {g.bord.map((it) => {
                const v = it.velden.verkeer;
                const [letter, kleur, uitleg] = STATUS[f41Status(it)];
                return rij(it, (
                  <>
                    <img src={bordPng(icoonSleutel(v))} alt="" width={22} height={22} />
                    <span style={{ minWidth: 18, fontWeight: 700, fontSize: 11 }}>{v.nr}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bordOmschrijving(v)}{v.straat ? ` · ${v.straat.split(',')[0]}` : ''}</span>
                    {v.auto?.controleren && <span style={{ color: '#B45309' }} title="Niet uit de routeplanner: controleren">!</span>}
                    {onderbordTekst(v) && <span className="fm-sub" title={onderbordTekst(v)}>+ob</span>}
                    {v.auto && <span title={uitleg} style={{ width: 15, height: 15, fontSize: 9, fontWeight: 700, color: '#fff', background: kleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{letter}</span>}
                  </>
                ));
              })}
            </div>
            {schrijven && <button className="fm-knop klein" disabled={!!bezig} onClick={straten}>{bezig.startsWith('Straat') ? bezig : 'Straatnamen ophalen'}</button>}
          </>
        )}
        {g.parkeerverbod.length > 0 && (
          <>
            {groepKop('parkeerverbod', g.parkeerverbod.length)}
            {g.parkeerverbod.map((it) => rij(it, <><img src={bordPng('E1')} alt="" width={22} height={22} /><span style={{ flex: 1 }}>{it.naam || 'Parkeerverbod'} · {m0(lengteVan(it))}</span><span className="fm-sub">{aantalE1(it, Number(it.velden.verkeer.interval) || inst.interval)}× E1</span></>))}
          </>
        )}
        {g.afsluiting.length > 0 && (
          <>
            {groepKop('afsluiting', g.afsluiting.length)}
            {g.afsluiting.map((it) => rij(it, <><img src={bordPng('NADAR')} alt="" width={22} height={22} /><span style={{ flex: 1 }}>{it.naam || 'Afsluiting'} · {m0(lengteVan(it))}</span><span className="fm-sub">{aantalNadars(it)} nadars · C3</span></>))}
          </>
        )}
        {g.omleiding.length > 0 && (
          <>
            {groepKop('omleiding', g.omleiding.length)}
            {g.omleiding.map((it) => {
              const f41 = g.bord.filter((b) => b.velden.verkeer.auto?.omleiding_id === it.id).length;
              return (
                <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {rij(it, <><img src={bordPng('F41-rechts')} alt="" width={22} height={22} /><span style={{ flex: 1 }}>{it.naam || 'Omleiding'} · {(lengteVan(it) / 1000).toFixed(1).replace('.', ',')} km</span><span className="fm-sub">{f41}× F41</span></>)}
                  {schrijven && voorstel?.id !== it.id && <button className="fm-knop klein" disabled={!!bezig} onClick={() => stelVoor(it)}>{bezig && !bezig.startsWith('Straat') ? bezig : f41 ? 'F41-borden bijwerken' : 'F41-borden voorstellen'}</button>}
                  {voorstel?.id === it.id && (() => {
                    const a = voorstel.acties;
                    const niets = !a.nieuw.length && !a.bijwerken.length && !a.vervalt.length;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '2px solid #1d1d1b', background: '#fff' }}>
                        {niets ? <div className="fm-sub">Alles staat al goed.</div> : (
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                            {a.nieuw.length > 0 && <li>{a.nieuw.length} nieuwe F41-borden</li>}
                            {a.bijwerken.length > 0 && <li>{a.bijwerken.length} bijgewerkt</li>}
                            {a.vervalt.length > 0 && <li>{a.vervalt.length} vervallen</li>}
                          </ul>
                        )}
                        {voorstel.terugval && <div className="fm-sub" style={{ color: '#8A4D00' }}>Routeplanner onbereikbaar: afslagen uit de knikken in de lijn, controleren.</div>}
                        {!voorstel.kand.length && <div className="fm-sub">Geen afslagen gevonden op deze lijn.</div>}
                        <div className="fm-raster2">
                          {!niets && <button className="fm-knop klein rood" onClick={pasToe}>Toepassen</button>}
                          <button className="fm-knop klein" onClick={() => setVoorstel(null)}>{niets ? 'Sluiten' : 'Annuleren'}</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Stuklijst en export */}
      <div className="fm-sectie">
        <details className="fm-meer" open={totaal > 0}><summary>Stuklijst · {lijst.totaal} borden{lijst.onderborden.length ? `, ${lijst.onderborden.reduce((t, o) => t + o.n, 0)} onderborden` : ''}</summary>
          <div style={{ padding: '2px 8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lijst.borden.map((b) => <div key={b.sleutel} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}><img src={bordPng(b.sleutel)} alt="" width={18} height={18} /><span style={{ flex: 1 }}>{b.naam}</span><strong>{b.n}</strong></div>)}
            {lijst.onderborden.length > 0 && <div className="fm-lijstkop" style={{ padding: '6px 0 2px' }}>Onderborden</div>}
            {lijst.onderborden.map((o) => <div key={o.tekst} style={{ display: 'flex', gap: 6, fontSize: 12 }}><span style={{ flex: 1 }}>{o.tekst.replace(/\n/g, ' ')}</span><strong>{o.n}</strong></div>)}
            {!lijst.totaal && <div className="fm-sub">Nog niets te tellen.</div>}
          </div>
        </details>
        <div className="fm-raster2">
          <button className="fm-knop klein" disabled={!lijst.totaal} onClick={() => onExport('verkeerlijst')}>Stuklijst CSV</button>
          <button className="fm-knop klein rood" disabled={!totaal} onClick={() => onExport('verkeersplan')}>Signalisatieplan PDF</button>
        </div>
        {melding && <div className="fm-melding info" style={{ fontSize: 11.5 }}>{melding}</div>}
      </div>
    </div>
  );
}

// Detail rechts van één verkeersitem: bord, onderbord, datums, kijkrichting; of de lijninstellingen.
export function VerkeerDetail({ plan, items, item, schrijven, onWijzigItem, onKiesItem = null }) {
  const inst = instVerkeer(plan);
  const [bezig, setBezig] = useState(false);
  if (!item?.velden?.verkeer) return null;
  const v = item.velden.verkeer;
  const zet = (patch) => onWijzigItem(item.id, { velden: { ...item.velden, verkeer: { ...v, ...patch } } });
  const b = BORD_MAP.get(v.bord);
  const uit = !schrijven;
  const onderbord = (
    <>
      <label className="fm-veld">Onderbord
        <select value={v.onderbord || ''} disabled={uit} onChange={(e) => zet({ onderbord: e.target.value, ...(e.target.value === 'periode' && !v.van && !v.tot ? { van: inst.van, tot: inst.tot } : {}) })}>
          {ONDERBORDEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>
      {v.onderbord === 'periode' && (
        <div className="fm-raster2">
          <label className="fm-veld">Van<input type="datetime-local" value={v.van || ''} disabled={uit} onChange={(e) => zet({ van: e.target.value })} /></label>
          <label className="fm-veld">Tot<input type="datetime-local" value={v.tot || ''} disabled={uit} onChange={(e) => zet({ tot: e.target.value })} /></label>
        </div>
      )}
      {v.onderbord === 'tekst' && <label className="fm-veld">Tekst<textarea rows={2} defaultValue={v.onderbord_tekst || ''} key={`ot${item.id}`} disabled={uit} onBlur={(e) => zet({ onderbord_tekst: e.target.value })} /></label>}
    </>
  );
  if (v.soort !== 'bord') {
    const L = lengteVan(item);
    return (
      <div className="fm-sectie" style={{ background: '#FAFAFB' }}>
        <div className="fm-kop">{SOORTEN[v.soort]?.replace(/en$/, '')} · {m0(L)}</div>
        {v.soort === 'parkeerverbod' && (
          <>
            <div className="fm-sub">{aantalE1(item, Number(v.interval) || inst.interval)} × E1, om de {Number(v.interval) || inst.interval} m, elk met onderbord.</div>
            <label className="fm-veld">E1 om de … m<input type="number" min="5" max="100" step="5" value={v.interval || inst.interval} disabled={uit} onChange={(e) => zet({ interval: Number(e.target.value) || inst.interval })} /></label>
            {onderbord}
            {!v.onderbord && <div className="fm-sub" style={{ color: '#8A4D00' }}>Zonder onderbord met datum en uur geldt het verbod altijd. Kies &quot;Datum en uur&quot;.</div>}
          </>
        )}
        {v.soort === 'afsluiting' && (
          <>
            <div className="fm-sub">{aantalNadars(item)} nadars van 2,5 m en één C3 met onderbord.</div>
            {onderbord}
            <BordVoorbeeld v={{ ...v, bord: 'C3' }} breedte={90} />
          </>
        )}
        {v.soort === 'omleiding' && (
          <>
            <label className="fm-veld">Naam<input defaultValue={item.naam || ''} key={`n${item.id}`} disabled={uit} onBlur={(e) => onWijzigItem(item.id, { naam: e.target.value || null })} /></label>
            <label className="fm-veld">Tekst op de F41-borden (optioneel)<input defaultValue={v.tekst || ''} key={`t${item.id}`} disabled={uit} placeholder="bv. Parking P1" onBlur={(e) => zet({ tekst: e.target.value })} /></label>
            <div className="fm-sub">{items.filter((x) => isVerkeerBord(x) && x.velden.verkeer.auto?.omleiding_id === item.id).length} F41-borden horen bij deze omleiding. Voorstellen doe je in het paneel links.</div>
          </>
        )}
      </div>
    );
  }
  const [letter, kleur, uitleg] = STATUS[f41Status(item)];
  const draai = (d) => zet({ kijkrichting: (((Number(v.kijkrichting) || 0) + d) % 360 + 360) % 360 });
  const haalStraat = async () => { setBezig(true); const s = await straatBij(item.geometrie.coordinates); if (s) zet({ straat: s }); setBezig(false); };
  return (
    <div className="fm-sectie" style={{ background: '#FAFAFB' }}>
      <div className="fm-kop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1 }}>Bord {v.nr} · {v.bord}</span>
        {v.auto && <span title={uitleg} style={{ width: 16, height: 16, fontSize: 9.5, fontWeight: 700, color: '#fff', background: kleur, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{letter}</span>}
      </div>
      {v.auto?.controleren && (
        <div className="fm-sign-controleren">
          <span>Niet uit de routeplanner: kijk na of dit bord klopt.</span>
          {schrijven && <button className="fm-knop klein zwart" onClick={() => { const a = { ...v.auto }; delete a.controleren; zet({ auto: a }); }}>Gecontroleerd</button>}
        </div>
      )}
      <BordVoorbeeld v={v} />
      <label className="fm-veld">Bord
        <select value={v.bord} disabled={uit} onChange={(e) => zet({ bord: e.target.value })}>
          {BORDEN.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.naam}</option>)}
        </select>
      </label>
      {b?.waarde && (
        <label className="fm-veld">Snelheid
          <select value={SNELHEDEN.includes(Number(v.waarde)) ? Number(v.waarde) : 50} disabled={uit} onChange={(e) => zet({ waarde: Number(e.target.value) })}>{SNELHEDEN.map((s) => <option key={s} value={s}>{s} km/u</option>)}</select>
        </label>
      )}
      {b?.pijl && (
        <label className="fm-veld">Pijl
          <select value={v.pijl || 'rechtdoor'} disabled={uit} onChange={(e) => zet({ pijl: e.target.value })}>{BORD_PIJLEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
      )}
      {b?.tekst && <label className="fm-veld">Tekst<input defaultValue={v.tekst || ''} key={`tx${item.id}`} disabled={uit} placeholder={v.bord === 'F41' ? 'bv. Parking P1' : 'bv. Wielerwedstrijd'} onBlur={(e) => zet({ tekst: e.target.value })} /></label>}
      {onderbord}
      <label className="fm-veld">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ flex: 1 }}>Kijkrichting · {Math.round(v.kijkrichting ?? 0)}°</span>
          <Info>De richting waar het bord naar kijkt: het verkeer dat het moet lezen, komt uit die richting. De wig op de kaart toont ze.</Info>
          {schrijven && <button className="fm-knop klein" aria-label="15° naar links" onClick={(e) => { e.preventDefault(); draai(-15); }}>↺</button>}
          {schrijven && <button className="fm-knop klein" aria-label="15° naar rechts" onClick={(e) => { e.preventDefault(); draai(15); }}>↻</button>}
        </span>
        <input type="range" min="0" max="359" step="1" disabled={uit} value={v.kijkrichting ?? 0} onChange={(e) => zet({ kijkrichting: Number(e.target.value) })} style={{ padding: 0, border: 0, height: 22 }} />
      </label>
      <div className="fm-raster2">
        <label className="fm-veld">Nummer<input defaultValue={v.nr ?? ''} key={`nr${item.id}${v.nr}`} disabled={uit} onBlur={(e) => zet({ nr: Number(e.target.value) || v.nr })} /></label>
        <label className="fm-veld">
          <span style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>Straat</span>{schrijven && <button className="fm-knop klein" disabled={bezig} onClick={(e) => { e.preventDefault(); haalStraat(); }}>{bezig ? '…' : 'Ophalen'}</button>}</span>
          <input defaultValue={v.straat || ''} key={`st${item.id}${v.straat || ''}`} disabled={uit} onBlur={(e) => zet({ straat: e.target.value || null })} />
        </label>
      </div>
      {v.auto?.omleiding_id && onKiesItem && <button className="fm-knop klein" onClick={() => onKiesItem(v.auto.omleiding_id)}>Naar de omleiding</button>}
    </div>
  );
}
