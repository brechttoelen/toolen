'use client';

import Blok from './blok';
import { AttestenOverzicht, attestStatus } from './attesten';
import { heeftModule } from './merk';
import { useEffect, useMemo, useState } from 'react';
import { controleer, instControle, meldingSleutel } from './controle';
import { maps } from './db';
import { instBrand, zoneVoorTekst, VELDEN, haal, zetEigen, STANDAARD_BRON } from './veiligheid';
import { ZONES } from './brandweerzones';
import { sorteerCategorieen } from './categorieen';

const KLEUR = { fout: '#B91C1C', waarschuwing: '#D97706', info: '#686D76' };

export function MeldingenLijst({ meldingen, onKiesItem, onGoedkeuren }) {
  const open = meldingen.filter((x) => !x.goedgekeurd);
  const ok = meldingen.filter((x) => x.goedgekeurd);
  const groepen = new Map();
  for (const x of open) { if (!groepen.has(x.groep)) groepen.set(x.groep, []); groepen.get(x.groep).push(x); }
  return (
    <>
      {!open.length && <div className="fm-sub">Geen openstaande meldingen.</div>}
      {[...groepen.entries()].map(([g, lijst]) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="fm-kop">{g} · {lijst.length}</div>
          {lijst.map((x, i) => (
            <div key={i} className="fm-melding-rij" style={{ borderLeftColor: KLEUR[x.soort] || '#686D76' }}>
              <button className="tekst" disabled={!x.id} onClick={() => x.id && onKiesItem?.(x.id)}>{x.tekst}</button>
              {onGoedkeuren && <button className="ok" title="Goedkeuren: dit is bewust zo (bv. rijplaten onder een tent). Verdwijnt uit de telling." onClick={() => onGoedkeuren(x, true)}>✓ OK</button>}
            </div>
          ))}
        </div>
      ))}
      {ok.length > 0 && (
        <details className="fm-meer"><summary>Goedgekeurd · {ok.length}</summary>
          {ok.map((x, i) => (
            <div key={i} className="fm-melding-rij" style={{ borderLeftColor: '#16865C', opacity: 0.75 }}>
              <button className="tekst" disabled={!x.id} onClick={() => x.id && onKiesItem?.(x.id)}>{x.tekst}</button>
              {onGoedkeuren && <button className="ok" title="Weer als melding tonen" onClick={() => onGoedkeuren(x, false)}>Terug</button>}
            </div>
          ))}
        </details>
      )}
    </>
  );
}

export async function telOpenOpmerkingen(items) {
  const ids = items.map((i) => i.id);
  if (!ids.length) return 0;
  const { count } = await maps().from('opmerkingen').select('id', { count: 'exact', head: true }).in('item_id', ids.slice(0, 900)).eq('status', 'open');
  return count || 0;
}

export default function ControlePaneel({ plan, lagen, items, elementenMap, lagenMap, fasen, schrijven, onPlan, onKiesItem, openBlok = null, vast = [] }) {
  const [open, setOpen] = useState(null);
  const inst = instControle(plan, lagen);
  useEffect(() => { telOpenOpmerkingen(items).then(setOpen).catch(() => setOpen(null)); }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const meldingen = useMemo(() => controleer({ plan, lagen, items, elementenMap, fasen, opmerkingenOpen: open, vast }), [plan, lagen, items, elementenMap, fasen, open]);
  const zet = (patch) => onPlan({ instellingen: { ...(plan.instellingen || {}), controle: { ...(plan.instellingen?.controle || {}), ...inst, ...patch } } });
  const fouten = meldingen.filter((x) => x.soort === 'fout' && !x.goedgekeurd).length;
  const goedkeuren = (x, aan) => {
    const k = meldingSleutel(x);
    const lijst = plan.instellingen?.controle?.goedgekeurd || [];
    zet({ goedgekeurd: aan ? [...new Set([...lijst, k])] : lijst.filter((y) => y !== k) });
  };
  const ib = instBrand(plan);
  const attesten = items.filter((i) => !i.verborgen && i.velden?.attesten?.length);
  const attestProbleem = attesten.filter((i) => i.velden.attesten.some((a) => ['vervallen', 'bijna'].includes(attestStatus(a).code))).length;

  return (
    <div>
      <div className="fm-sectie">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, padding: 8, border: '1px solid #e8e8e6' }}><div className="fm-sub">Fouten</div><div style={{ fontSize: 18, fontWeight: 600, color: fouten ? '#B91C1C' : '#0E6B48' }}>{fouten}</div></div>
          <div style={{ flex: 1, padding: 8, border: '1px solid #e8e8e6' }}><div className="fm-sub">Meldingen</div><div style={{ fontSize: 18, fontWeight: 600 }}>{meldingen.filter((x) => !x.goedgekeurd).length}</div></div>
        </div>
        <MeldingenLijst meldingen={meldingen} onKiesItem={onKiesItem} onGoedkeuren={schrijven ? goedkeuren : null} />
      </div>

      <div className="fm-meerkop">Regels en instellingen</div>
      {heeftModule('veiligheid') && (
      <Blok titel="Brandveiligheid" open={openBlok === 'brand'} rechts={<span className="fm-sub">{ib.aan ? (ib.zone?.kort || 'richtwaarden') : 'uit'}</span>}
        info="Tenten en publieke structuren worden getoetst aan het reglement van de brandweerzone: aantal en breedte van de nooduitgangen, afstand tot een uitgang, blustoestellen, brandweertoegang, generatoren en gasflessen buiten. Teken nooduitgangen als lijn over de opening (de lengte is de breedte). Waarden zonder zonereglement zijn richtwaarden.">
        <Brandveiligheid plan={plan} items={items} schrijven={schrijven} onPlan={onPlan} />
      </Blok>
      )}
      {heeftModule('veiligheid') && (
      <Blok titel="Keuringsattesten" open={openBlok === 'attesten'} rechts={<span className="fm-sub">{attestProbleem ? `${attestProbleem} na te kijken` : `${attesten.length} items`}</span>}
        info="Attesten (elektrische keuring, gas, blusser…) hangen aan een item: selecteer het en voeg rechts bij Keuringsattesten een bestand of link toe. Vervallen of ontbrekende attesten komen bij de meldingen.">
        <AttestenOverzicht plan={plan} items={items} elementenMap={elementenMap} lagenMap={lagenMap} schrijven={schrijven} onPlan={onPlan} onKiesItem={onKiesItem} />
      </Blok>
      )}
      <Blok titel="Afstandsregels" open={openBlok === 'afstand'} rechts={<span className="fm-sub">{inst.afstandsregels.length}</span>}
        info="Minimum afstand tussen items, bv. generator 10 m van een tent. Wat te dicht staat, komt bij de meldingen.">
        <Afstandsregels regels={inst.afstandsregels} lagen={lagen} elementenMap={elementenMap} schrijven={schrijven} onZet={(afstandsregels) => zet({ afstandsregels })} />
      </Blok>
      {heeftModule('veiligheid') && (
      <Blok titel="Hulpdiensten en routes" open={openBlok === 'routes'} rechts={<span className="fm-sub">{inst.hulpdienstBreedte} m</span>}
        info="Teken de routes van hulpdiensten en voertuigen als lijn in een eigen laag en vink die laag hier aan. De controle meldt wat die routes blokkeert of te laag is. Doorrijhoogte en werken in de grond stel je per item in bij Planning en notitie.">
        <div className="fm-raster2">
          <label className="fm-veld">Vrije breedte hulpdiensten (m)<input inputMode="decimal" disabled={!schrijven} defaultValue={inst.hulpdienstBreedte} onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) zet({ hulpdienstBreedte: v }); }} /></label>
          <label className="fm-veld">Hoogte voertuigen (m)<input inputMode="decimal" disabled={!schrijven} defaultValue={inst.maxHoogte} onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) zet({ maxHoogte: v }); }} /></label>
        </div>
        <details className="fm-meer" open={inst.hulpdienstLagen.length > 0}>
          <summary>Lagen met hulpdienstenroutes · {inst.hulpdienstLagen.length}</summary>
          {lagen.map((l) => <label key={l.id} className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={inst.hulpdienstLagen.includes(l.id)} onChange={() => zet({ hulpdienstLagen: inst.hulpdienstLagen.includes(l.id) ? inst.hulpdienstLagen.filter((x) => x !== l.id) : [...inst.hulpdienstLagen, l.id] })} />{l.naam}</label>)}
        </details>
        <details className="fm-meer" open={inst.routeLagen.length > 0}>
          <summary>Lagen met routes voor voertuigen · {inst.routeLagen.length}</summary>
          {lagen.map((l) => <label key={l.id} className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={inst.routeLagen.includes(l.id)} onChange={() => zet({ routeLagen: inst.routeLagen.includes(l.id) ? inst.routeLagen.filter((x) => x !== l.id) : [...inst.routeLagen, l.id] })} />{l.naam}</label>)}
        </details>
      </Blok>
      )}
    </div>
  );
}

// Controlelijst voor een plan definitief wordt.
export function DefinitiefDialoog({ plan, lagen, items, elementenMap, fasen, onSluit, onBevestig, onKiesItem, vast = [] }) {
  const [open, setOpen] = useState(null);
  useEffect(() => { telOpenOpmerkingen(items).then(setOpen).catch(() => setOpen(0)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const meldingen = useMemo(() => (open === null ? [] : controleer({ plan, lagen, items, elementenMap, fasen, opmerkingenOpen: open, vast })), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fm-dialoog-achter" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <section className="fm-dialoog fm" role="dialog" aria-label="Definitief maken" style={{ maxWidth: 560 }}>
        <header><h2>Plan definitief maken</h2><button className="fm-knop" onClick={onSluit}>Annuleren</button></header>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
          {open === null ? <div className="fm-sub">Controleren…</div> : (
            <>
              <div className="fm-sub">{meldingen.some((x) => !x.goedgekeurd) ? 'Kijk deze punten na. Doorgaan mag; de lijst wordt bij de versie bewaard.' : 'Geen openstaande meldingen. Alles ziet er goed uit.'}</div>
              <MeldingenLijst meldingen={meldingen} onKiesItem={(id) => { onSluit(); onKiesItem(id); }} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid #e8e8e6' }}>
          <button className="fm-knop rood" disabled={open === null} onClick={() => onBevestig(meldingen.filter((x) => !x.goedgekeurd))}>{meldingen.length ? 'Toch definitief maken' : 'Definitief maken'}</button>
          <button className="fm-knop" onClick={onSluit}>Eerst nakijken</button>
        </div>
      </section>
    </div>
  );
}

// Afstandsregels: minimum afstand tussen twee soorten items.
function Afstandsregels({ regels, lagen, elementenMap, schrijven, onZet }) {
  const elementen = [...elementenMap.values()].filter((e) => e.actief !== false).sort((a, b) => a.naam.localeCompare(b.naam));
  const cats = sorteerCategorieen(new Set(elementen.map((e) => e.categorie).filter(Boolean)));
  const Kiezer = ({ waarde, onKies }) => (
    <select value={waarde || ''} disabled={!schrijven} onChange={(e) => onKies(e.target.value)}>
      <option value="">Kies…</option>
      <optgroup label="Categorie">{cats.map((c) => <option key={c} value={`c:${c}`}>{c} (alles)</option>)}</optgroup>
      <optgroup label="Element">{elementen.map((e) => <option key={e.id} value={`e:${e.id}`}>{e.naam}</option>)}</optgroup>
      <optgroup label="Laag">{lagen.map((l) => <option key={l.id} value={`l:${l.id}`}>{l.naam}</option>)}</optgroup>
    </select>
  );
  const zetR = (i, patch) => onZet(regels.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      {regels.map((r, i) => (
        <div key={r.id || i} className="fm-regel">
          <Kiezer waarde={r.a} onKies={(v) => zetR(i, { a: v })} />
          <div className="fm-regel-mid">
            <span>minstens</span>
            <input inputMode="decimal" disabled={!schrijven} defaultValue={r.min ?? ''} onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); zetR(i, { min: v > 0 ? v : null }); }} style={{ width: 54 }} />
            <span>m van</span>
          </div>
          <Kiezer waarde={r.b} onKies={(v) => zetR(i, { b: v })} />
          <div className="fm-regel-mid">
            <input placeholder="reden (optioneel)" disabled={!schrijven} defaultValue={r.reden || ''} onBlur={(e) => zetR(i, { reden: e.target.value || null })} style={{ flex: 1 }} />
            <select value={r.ernst || 'fout'} disabled={!schrijven} onChange={(e) => zetR(i, { ernst: e.target.value })} style={{ width: 110 }}>
              <option value="fout">Fout</option><option value="waarschuwing">Waarschuwing</option>
            </select>
            {schrijven && <button className="fm-knop klein gevaar" onClick={() => onZet(regels.filter((_, j) => j !== i))} aria-label="Regel weg">×</button>}
          </div>
        </div>
      ))}
      {!regels.length && <div className="fm-sub">Nog geen regels.</div>}
      {schrijven && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onZet([...regels, { id: Math.random().toString(36).slice(2, 9), a: '', b: '', min: 10, ernst: 'fout' }])}>Regel toevoegen</button>}
    </>
  );
}

// Brandveiligheid: zone kiezen, de geldende waarden zien en per plan aanpassen.
export function Brandveiligheid({ plan, items, schrijven, onPlan }) {
  const ib = instBrand(plan);
  const b = plan.instellingen?.brandveiligheid || {};
  const zet = (patch) => onPlan({ instellingen: { ...(plan.instellingen || {}), brandveiligheid: { ...b, ...patch } } });
  // Gemeente van het plan op de kaart (midden van de getekende items, anders het kaartmidden).
  const [gemeente, setGemeente] = useState(null);
  const punt = useMemo(() => {
    const ps = items.filter((i) => i.geometrie?.type === 'Point').map((i) => i.geometrie.coordinates)
      .concat(items.filter((i) => i.geometrie && i.geometrie.type !== 'Point').map((i) => (i.geometrie.type === 'Polygon' ? i.geometrie.coordinates[0][0] : i.geometrie.coordinates[0])));
    if (ps.length) return [ps.reduce((a, p) => a + p[0], 0) / ps.length, ps.reduce((a, p) => a + p[1], 0) / ps.length].map((v) => Math.round(v * 1000) / 1000);
    return Array.isArray(plan.centrum) ? plan.centrum : null;
  }, [items, plan.centrum]);
  useEffect(() => {
    if (b.zone || !punt) return;
    let weg = false;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=nl&lon=${punt[0]}&lat=${punt[1]}`)
      .then((r) => r.json()).then((j) => { if (!weg) setGemeente([j.name, j.address?.municipality, j.address?.city, j.address?.town, j.address?.village].filter(Boolean)); }).catch(() => {});
    return () => { weg = true; };
  }, [b.zone, punt?.[0], punt?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const voorstel = !ib.zone ? (gemeente || []).map((g) => zoneVoorTekst(g)).find(Boolean) || zoneVoorTekst(`${plan.locatie || ''} ${plan.naam || ''}`) : null;
  const HERK = { zone: ['zone', '#0E6B48'], eigen: ['eigen', '#2563EB'], standaard: ['richtw.', '#8A8F98'] };
  return (
    <>
      <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={ib.aan} onChange={() => zet({ aan: !ib.aan })} />Controleren</label>
      {ib.aan && (
        <>
          <label className="fm-veld">Brandweerzone
            <select value={b.zone || ''} disabled={!schrijven} onChange={(e) => zet({ zone: e.target.value || null })}>
              <option value="">Geen zone ({STANDAARD_BRON.toLowerCase()})</option>
              {ZONES.map((z) => <option key={z.id} value={z.id}>{z.kort}{z.zonder_reglement ? ' – geen reglement gevonden' : ''}</option>)}
            </select>
          </label>
          {voorstel && schrijven && <button className="fm-knop klein" onClick={() => zet({ zone: voorstel.zone.id })}>{voorstel.gemeente}: {voorstel.zone.naam} kiezen</button>}
          {ib.zone && (
            <div className="fm-sub">
              {ib.zone.naam}
              {ib.zone.bron_url && <> · <a href={ib.zone.bron_url} target="_blank" rel="noreferrer">reglement</a></>}
              {ib.zone.website && <> · <a href={ib.zone.website} target="_blank" rel="noreferrer">website</a></>}
              {ib.zone.zonder_reglement && <div style={{ color: '#B45309' }}>Geen zonaal evenementenreglement gevonden: vraag het na bij de gemeente of de brandweer. Tot dan gelden de richtwaarden.</div>}
              {ib.zone.opmerking && <details><summary style={{ cursor: 'pointer' }}>Opmerking</summary>{ib.zone.opmerking}</details>}
              {ib.regels.uitgangen?.tabel && <div>Uitgangen: {ib.regels.uitgangen.tabel.map(([max, n], i, a) => `${n} ${max == null ? `vanaf ${(a[i - 1]?.[0] ?? 0) + 1}` : `tot ${max}`} p`).join(', ')}{ib.regels.uitgangen.daarna ? `, daarna +1 per ${ib.regels.uitgangen.daarna.per} p` : ''}.</div>}
            </div>
          )}
          <details className="fm-meer">
            <summary>Waarden ({Object.values(ib.herkomst).filter((h) => h === 'zone').length} uit zone, {Object.values(ib.herkomst).filter((h) => h === 'eigen').length} eigen)</summary>
            {VELDEN.map(([pad, label, eenh]) => {
              const [t, kl] = HERK[ib.herkomst[pad]];
              const eigen = haal(b.eigen, pad);
              return (
                <div key={pad} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ flex: 1 }}>{label}</span>
                  <input key={`${pad}-${b.zone}-${eigen ?? ''}`} inputMode="decimal" disabled={!schrijven} style={{ width: 58 }} defaultValue={eigen ?? ''} placeholder={String(haal(ib.regels, pad) ?? '–').replace('.', ',')}
                    onBlur={(e) => { const v = e.target.value.trim() === '' ? null : Number(e.target.value.replace(',', '.')); if (v === null || v >= 0) zet({ eigen: zetEigen(b.eigen, pad, v) }); }} />
                  <span style={{ width: 34 }} className="fm-sub">{eenh}</span>
                  <span style={{ width: 42, color: kl, fontSize: 11 }}>{t}</span>
                </div>
              );
            })}
            <div className="fm-sub">Leeg = waarde van de zone of richtwaarde.</div>
          </details>
          {ib.zone?.extra?.length > 0 && (
            <details className="fm-meer"><summary>Andere regels van de zone ({ib.zone.extra.length})</summary>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{ib.zone.extra.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
