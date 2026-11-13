'use client';

import Blok from './blok';
import { bevestig, vraagTekst } from './dialoog';
import { useEffect, useRef, useState } from 'react';
import { maps, foutTekst, namenVan } from './db';
import { nieuweOnderlegger, verwijderBestand } from './onderlegger';
import { zichtbareBreedte } from './OnderleggerGrepen';

// Vergelijking tussen een bewaarde versie en het huidige plan.
export function verschil(oud, nu) {
  const a = new Map((oud || []).map((i) => [i.id, i]));
  const b = new Map((nu || []).map((i) => [i.id, i]));
  const sleutel = (i) => JSON.stringify([i.geometrie, i.stijl, i.naam, i.laag_id, i.element_id, i.fase_ids, i.notitie]);
  const nieuw = []; const weg = []; const gewijzigd = [];
  for (const [id, i] of b) { if (!a.has(id)) nieuw.push(i); else if (sleutel(a.get(id)) !== sleutel(i)) gewijzigd.push(i); }
  for (const [id, i] of a) if (!b.has(id)) weg.push(i);
  return { nieuw, weg, gewijzigd };
}

export default function PlanPaneel({
  plan, fasen, items, schrijven, kaart, kalibratie,
  onFasen, onPlan, onVergelijk, onHerstel, vergelijkVersie, onKalibreer, onKiesItem, plekItems = [], onUitFiche, onNaarVast = null, lagen = [], olBewerk = null, onBewerkOl,
  deel = 'fasen', // welk tabblad van het plan: algemeen (locatie), fasen, achtergrond of geschiedenis
}) {
  const [open, setOpen] = useState({ fasen: true, onderleggers: (plan.instellingen?.onderleggers || []).some((o) => !o.binnen), versies: true, fiche: !!plan.plek_id, prullenbak: false });
  const [plekken, setPlekken] = useState(null);
  const plek = plekken?.find((x) => x.id === plan.plek_id) || null;
  useEffect(() => {
    if (!open.fiche || plekken) return;
    maps().from('plekken').select('*').order('naam').then(({ data, error }) => { if (error) setFout(foutTekst(error)); else setPlekken(data || []); });
  }, [open.fiche, plekken]);
  const nieuwePlek = async () => {
    const naam = await vraagTekst('Naam van de locatie (bv. Markt Oudenaarde)', plan.locatie || plan.naam);
    if (!naam) return;
    const { data, error } = await maps().from('plekken').insert({ naam, kader: null, contacten: [] }).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    setPlekken((l) => [...(l || []), data]);
    onPlan({ plek_id: data.id });
  };
  const zetContacten = async (contacten) => {
    setPlekken((l) => l.map((x) => (x.id === plek.id ? { ...x, contacten } : x)));
    const { error } = await maps().from('plekken').update({ contacten }).eq('id', plek.id);
    if (error) setFout(foutTekst(error));
  };
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState('');
  const [versies, setVersies] = useState(null);
  const bestandRef = useRef(null);
  const onderleggers = plan.instellingen?.onderleggers || [];
  const buiten = onderleggers.filter((o) => !o.binnen); // grondplannen van binnenplannen staan in het binnenplan zelf
  const wissel = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // ---------- Fasen ----------
  const nieuweFase = async () => {
    const naam = await vraagTekst('Naam van de fase', 'Opbouw D-2');
    if (!naam) return;
    const { data, error } = await maps().from('fasen').insert({ plan_id: plan.id, naam, volgorde: fasen.length }).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    onFasen([...fasen, data]);
  };
  const wijzigFase = async (f, patch) => {
    onFasen(fasen.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
    const { error } = await maps().from('fasen').update(patch).eq('id', f.id);
    if (error) setFout(foutTekst(error));
  };
  const verplaatsFase = async (i, d) => {
    const lijst = [...fasen];
    const j = i + d;
    if (j < 0 || j >= lijst.length) return;
    [lijst[i], lijst[j]] = [lijst[j], lijst[i]];
    const nieuw = lijst.map((f, k) => ({ ...f, volgorde: k }));
    onFasen(nieuw);
    await Promise.all(nieuw.map((f) => maps().from('fasen').update({ volgorde: f.volgorde }).eq('id', f.id)));
  };
  const verwijderFase = async (f) => {
    const n = items.filter((i) => i.fase_ids?.includes(f.id)).length;
    if (!await bevestig(n ? `${n} items staan in deze fase. Ze blijven bestaan, maar horen dan niet meer bij "${f.naam}". Doorgaan?` : `Fase "${f.naam}" verwijderen?`)) return;
    const { error } = await maps().from('fasen').delete().eq('id', f.id);
    if (error) { setFout(foutTekst(error)); return; }
    onFasen(fasen.filter((x) => x.id !== f.id));
  };

  // ---------- Onderleggers ----------
  const zetOnderleggers = (lijst) => onPlan({ instellingen: { ...(plan.instellingen || {}), onderleggers: lijst } });
  const wijzigOl = (id, patch) => zetOnderleggers(onderleggers.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const upload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFout('');
    try {
      const c = kaart?.getCenter();
      const midden = c ? [c.lng, c.lat] : plan.centrum;
      // Startbreedte: ongeveer de helft van wat je nu ziet.
      let breedte = 200;
      if (kaart) {
        const b = kaart.getBounds();
        breedte = Math.max(20, Math.round((b.getEast() - b.getWest()) * 111320 * Math.cos((midden[1] * Math.PI) / 180) * 0.6));
      }
      const o = await nieuweOnderlegger(plan.id, f, midden, breedte, setBezig);
      zetOnderleggers([...onderleggers, o]);
      onBewerkOl?.(o.id); // meteen slepen, schalen en draaien op de kaart
    } catch (err) {
      setFout(err?.message || String(err));
    } finally {
      setBezig('');
    }
  };
  const verwijderOl = async (o) => {
    if (!await bevestig(`Onderlegger "${o.naam}" verwijderen?`)) return;
    zetOnderleggers(onderleggers.filter((x) => x.id !== o.id));
    await verwijderBestand(o.pad);
  };

  // ---------- Versies ----------
  useEffect(() => {
    if (!open.versies || versies) return;
    maps().from('versies').select('id, versie, opmerking, door, created_at').eq('plan_id', plan.id).order('versie', { ascending: false })
      .then(({ data, error }) => { if (error) setFout(foutTekst(error)); else setVersies(data || []); });
  }, [open.versies, versies, plan.id]);
  useEffect(() => { setVersies(null); }, [plan.versie]);

  const vergelijk = async (v) => {
    if (vergelijkVersie?.id === v.id) { onVergelijk(null); return; }
    const { data, error } = await maps().from('versies').select('*').eq('id', v.id).single();
    if (error) { setFout(foutTekst(error)); return; }
    onVergelijk({ id: v.id, versie: v.versie, items: data.momentopname?.items || [] });
  };

  return (
    <div>
      {fout && <div className="fm-melding fout" style={{ margin: 10 }}>{fout}</div>}

      {deel === 'fasen' && <Blok titel="Fasen" open={open.fasen} onWissel={() => wissel('fasen')} info="Een item zonder fase hoort bij alle fasen. Bij een geselecteerd item kies je rechts in welke fasen het staat." rechts={<span className="fm-sub">{fasen.length}</span>}>
        {fasen.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: '1px solid #f4f4f2' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <strong style={{ flex: 1, fontSize: 13 }}>{f.naam}</strong>
              <span className="fm-sub">{items.filter((x) => x.fase_ids?.includes(f.id)).length}</span>
              {schrijven && <>
                <button className="fm-knop klein" aria-label="Hoger" onClick={() => verplaatsFase(i, -1)}>↑</button>
                <button className="fm-knop klein" aria-label="Lager" onClick={() => verplaatsFase(i, 1)}>↓</button>
                <button className="fm-knop klein" onClick={async () => { const n = await vraagTekst('Naam', f.naam); if (n) wijzigFase(f, { naam: n }); }}>Naam</button>
                <button className="fm-knop klein gevaar" onClick={() => verwijderFase(f)}>×</button>
              </>}
            </div>
            {schrijven && (
              <div className="fm-raster2">
                <label className="fm-veld" style={{ fontSize: 11 }}>Van<input type="datetime-local" value={f.van ? f.van.slice(0, 16) : ''} onChange={(e) => wijzigFase(f, { van: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
                <label className="fm-veld" style={{ fontSize: 11 }}>Tot<input type="datetime-local" value={f.tot ? f.tot.slice(0, 16) : ''} onChange={(e) => wijzigFase(f, { tot: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
              </div>
            )}
          </div>
        ))}
        {!fasen.length && <div className="fm-sub">Geen fasen. Items zonder fase zijn altijd zichtbaar.</div>}
        {schrijven && <button className="fm-knop klein" onClick={nieuweFase}>Fase toevoegen</button>}
      </Blok>}

      {deel === 'achtergrond' && <>
      <Blok titel="Achtergrondtekeningen" open={open.onderleggers} onWissel={() => wissel('onderleggers')} info="PDF, PNG, JPG of DXF onder je tekening om over te tekenen. Een DXF in Lambert 72, Lambert 2008 of RD New ligt meteen juist; de rest sleep, schaal en draai je op de kaart." rechts={<span className="fm-sub">{buiten.length}</span>}>
        {buiten.map((o) => {
          const bezigHier = olBewerk === o.id;
          return (
            <div key={o.id} className={`fm-olkaart${bezigHier ? ' aan' : ''}`}>
              <div className="fm-olkaart-kop">
                <input type="checkbox" checked={o.zichtbaar !== false} onChange={(e) => wijzigOl(o.id, { zichtbaar: e.target.checked })} aria-label={`${o.naam} tonen`} />
                <strong className="fm-afkap" title={o.naam}>{o.naam}</strong>
                {schrijven && <button className="fm-olkaart-x" aria-label={`${o.naam} verwijderen`} title="Verwijderen" onClick={() => verwijderOl(o)}>×</button>}
              </div>
              <label className="fm-olkaart-dek">Dekking <span>{Math.round((o.dekking ?? 0.7) * 100)}%</span>
                <input type="range" min="0.1" max="1" step="0.05" value={o.dekking ?? 0.7} onChange={(e) => wijzigOl(o.id, { dekking: Number(e.target.value) })} />
              </label>
              {o.vast && <div className="fm-sub">Ligt vast op zijn plaats ({o.stelsel === 'EPSG:31370' ? 'Lambert 72' : o.stelsel === 'EPSG:3812' ? 'Lambert 2008' : 'RD New'}).</div>}
              {schrijven && !o.vast && (
                <div className="fm-olkaart-knoppen">
                  <button className={`fm-knop klein${bezigHier ? ' zwart' : ''}`} onClick={() => { if (!bezigHier && o.zichtbaar === false) wijzigOl(o.id, { zichtbaar: true }); onBewerkOl?.(bezigHier ? null : o.id); }}>{bezigHier ? 'Klaar' : 'Aanpassen op de kaart'}</button>
                  <button className="fm-knop klein" title="Naar het midden van de kaart, op een werkbare grootte" onClick={() => { const c = kaart?.getCenter(); if (!c) return; wijzigOl(o.id, { midden: [c.lng, c.lat], ...(o.soort === 'dxf' && o.natuur ? {} : { breedte: zichtbareBreedte(kaart, 0.5) }) }); onBewerkOl?.(o.id); }}>Naar hier</button>
                </div>
              )}
            </div>
          );
        })}
        {schrijven && (
          <>
            <input ref={bestandRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.dxf,.dwg" onChange={upload} style={{ display: 'none' }} />
            <button className="fm-knop klein" disabled={!!bezig} onClick={() => bestandRef.current?.click()}>{bezig || 'Achtergrondtekening toevoegen'}</button>
          </>
        )}
      </Blok>

      </>}

      {deel === 'algemeen' && <>
      <Blok titel="Locatie en vaste items" open={open.fiche} onWissel={() => wissel('fiche')} info="Blijft over edities heen: stroomkasten, waterpunten, putten, bomen, doorrijhoogtes, contacten. Grijs zichtbaar onder elk plan op deze plek." rechts={<span className="fm-sub">{plekItems.length}</span>}>
        <label className="fm-veld">Plaatsfiche
          <select value={plan.plek_id || ''} disabled={!schrijven} onChange={(e) => onPlan({ plek_id: e.target.value || null })}>
            <option value="">Geen plaatsfiche</option>
            {(plekken || []).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
          </select>
        </label>
        {schrijven && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={nieuwePlek}>Nieuwe plaatsfiche</button>}
        {plek && (
          <>
            <div className="fm-kop">Contactpersonen</div>
            {(plek.contacten || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 4 }}>
                <input defaultValue={c.naam} placeholder="Naam" disabled={!schrijven} onBlur={(e) => zetContacten(plek.contacten.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)))} style={{ flex: 1, height: 30, minWidth: 0 }} />
                <input defaultValue={c.rol} placeholder="Rol" disabled={!schrijven} onBlur={(e) => zetContacten(plek.contacten.map((x, j) => (j === i ? { ...x, rol: e.target.value } : x)))} style={{ flex: 1, height: 30, minWidth: 0 }} />
                <input defaultValue={c.tel} placeholder="Telefoon" disabled={!schrijven} onBlur={(e) => zetContacten(plek.contacten.map((x, j) => (j === i ? { ...x, tel: e.target.value } : x)))} style={{ flex: 1, height: 30, minWidth: 0 }} />
                {schrijven && <button className="fm-knop klein gevaar" onClick={() => zetContacten(plek.contacten.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            {schrijven && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => zetContacten([...(plek.contacten || []), { naam: '', rol: '', tel: '' }])}>Contact toevoegen</button>}
            <div className="fm-kop">Op de fiche · {plekItems.length}</div>
            {plekItems.map((x) => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12 }}>
                <button onClick={() => onKiesItem(x.id)} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>{x.naam || x.soort}{x.velden?.doorrijhoogte ? ` · ${x.velden.doorrijhoogte} m hoog` : ''}</button>
                {schrijven && <span style={{ display: 'flex', gap: 4 }}>
                  {onNaarVast && (['bron', 'kast'].includes(x.velden?.stroom?.rol) || /kast|stroom|aansluit/i.test(x.naam || '')) && <button className="fm-knop klein" title="Omzetten naar een vaste aansluiting: zichtbaar in elk plan op deze plek, over alle evenementen heen" onClick={() => onNaarVast(x)}>→ Vaste aansluiting</button>}
                  <button className="fm-knop klein" onClick={() => onUitFiche(x)}>Kopie in dit plan</button>
                </span>}
              </div>
            ))}
            <div className="fm-sub">Toevoegen: selecteer een item, kies "Naar plaatsfiche".</div>
          </>
        )}
      </Blok>

      </>}

      {deel === 'geschiedenis' && <>
      <Blok titel="Versies" open={open.versies} onWissel={() => wissel('versies')} rechts={<span className="fm-sub">nu v{plan.versie}</span>}>
        {versies === null && <div className="fm-sub">Laden…</div>}
        {versies && !versies.length && <div className="fm-sub">Nog geen bewaarde versies. Met "Versie bewaren" bovenaan leg je de huidige stand vast.</div>}
        {versies?.map((v) => (
          <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #f4f4f2' }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 13 }}>Versie {v.versie}</strong>
              <div className="fm-sub">{new Date(v.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })}</div>
              {v.opmerking && <div style={{ fontSize: 12 }}>{v.opmerking}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className={`fm-knop klein${vergelijkVersie?.id === v.id ? ' zwart' : ''}`} onClick={() => vergelijk(v)}>{vergelijkVersie?.id === v.id ? 'Stoppen' : 'Vergelijken'}</button>
              {schrijven && onHerstel && <button className="fm-knop klein" onClick={() => onHerstel(v.id)}>Terugzetten</button>}
            </div>
          </div>
        ))}
        {vergelijkVersie && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div className="fm-kop">Verschil met versie {vergelijkVersie.versie}</div>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#16865C', marginRight: 6 }} />{vergelijkVersie.d.nieuw.length} nieuw</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#D97706', marginRight: 6 }} />{vergelijkVersie.d.gewijzigd.length} gewijzigd</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#B91C1C', marginRight: 6 }} />{vergelijkVersie.d.weg.length} weggehaald (gestreept)</span>
          </div>
        )}
      </Blok>

      <Prullenbak plan={plan} schrijven={schrijven} open={!!open.prullenbak} onWissel={() => wissel('prullenbak')} />

      </>}
    </div>
  );
}

// Verwijderde items (90 dagen) terugzetten. Het teruggezette item verschijnt via de live verbinding.
function Prullenbak({ plan, schrijven, open, onWissel }) {
  const [lijst, setLijst] = useState(null);
  const [namen, setNamen] = useState({});
  const [fout, setFout] = useState('');
  const laad = () => maps().from('items_prullenbak').select('id, naam, soort, verwijderd_op, verwijderd_door, element_id')
    .eq('plan_id', plan.id).is('teruggezet_op', null).order('verwijderd_op', { ascending: false }).limit(50)
    .then(async ({ data, error }) => {
      if (error) { setFout(foutTekst(error)); return; }
      setNamen(await namenVan((data || []).map((r) => r.verwijderd_door)));
      setLijst(data || []);
    });
  useEffect(() => { if (open) laad(); }, [open, plan.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const terug = async (ids) => {
    const { error } = await maps().rpc('items_terugzetten', { p_ids: ids });
    if (error) { setFout(foutTekst(error)); return; }
    setLijst((l) => (l || []).filter((x) => !ids.includes(x.id)));
  };
  const SOORT = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', element: 'Element', notitie: 'Notitie' };
  return (
    <Blok titel="Verwijderde items" open={open} onWissel={onWissel} info="Wat de laatste 90 dagen verwijderd werd, door jou of een collega. Terugzetten zet het item op zijn oude plaats." rechts={lijst ? <span className="fm-sub">{lijst.length}{lijst.length === 50 ? '+' : ''}</span> : null}>
      {fout && <div className="fm-melding fout">{fout}</div>}
      {lijst === null && <div className="fm-sub">Laden…</div>}
      {lijst && !lijst.length && <div className="fm-sub">Niets verwijderd.</div>}
      {lijst?.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f4f4f2' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.naam || SOORT[r.soort] || 'Item'}</div>
            <div className="fm-sub">{new Date(r.verwijderd_op).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{r.verwijderd_door ? ` · ${namen[r.verwijderd_door] || ''}` : ''}</div>
          </div>
          {schrijven && <button className="fm-knop klein" onClick={() => terug([r.id])}>Terugzetten</button>}
        </div>
      ))}
    </Blok>
  );
}
