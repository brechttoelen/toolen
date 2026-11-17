'use client';

// Catering: één regel per product, voor wie, dag, uur en leverplaats. Drie weergaven:
// per dag (raster groepen × dagen voor de crew), per leverplaats (wedstrijddag), per leverancier (bestelbon).
// Voorstellen: een leverancier die op een dag in de planning staat maar nog geen maaltijd heeft.
import { useMemo, useState } from 'react';
import { opId, euro, getal, getalTekst } from './data';
import { Seg, Chips, Bewaarveld, TabNotities } from './gedeeld';
import { dagLijst, dagNaam, label, canoniek, sleutel, uitSleutel, uurKort, leesUur } from './dagen';
import { maakXlsx, bewaarBestand } from '../maps/tabelExport';

const num = (x) => Number(x) || 0;
const telbaar = (r) => !r.rechtstreeks && ['st', 'pers', 'stuks', 'personen'].includes(String(r.eenheid || 'st').toLowerCase());

export function cateringBedragen(f) {
  const prijs = new Map((f.d.catering_prijzen || []).map((p) => [`${p.leverancier_id || ''}|${p.product}|${p.eenheid}`, Number(p.prijs)]));
  const per = new Map();
  for (const r of f.d.cateringregels || []) {
    if (r.rechtstreeks) continue;
    const p = prijs.get(`${r.leverancier_id || ''}|${r.product}|${r.eenheid}`);
    if (!Number.isFinite(p)) continue;
    const k = r.leverancier_id || '';
    const x = per.get(k) || { lev: k, naam: f.d.leveranciers.find((l) => l.id === k)?.naam || 'Zonder leverancier', bedrag: 0, venn: r.vennootschap_id };
    x.bedrag += num(r.aantal) * p; per.set(k, x);
  }
  return [...per.values()].map((x) => ({ ...x, bedrag: Math.round(x.bedrag * 100) / 100 }));
}

export default function TabCatering({ f }) {
  const [view, setView] = useState('dag');
  const regels = f.d.cateringregels || [];
  const lev = opId(f.d.leveranciers);
  const crew = regels.filter((r) => r.soort === 'crew');
  const som = (l) => l.reduce((a, r) => a + num(r.aantal), 0);
  const kpi = [
    [som(crew.filter(telbaar)), `Maaltijden opbouw en afbraak · ${new Set(crew.map((r) => sleutel(r.anker, r.dag))).size} dagen`],
    [som(regels.filter((r) => /lunch/i.test(r.product) && telbaar(r))), 'Lunchpakketten'],
    [new Set(regels.map((r) => r.leverancier_id).filter(Boolean)).size, 'Leveranciers'],
    [regels.filter((r) => !r.leverancier_id && !r.rechtstreeks).length, 'Regels zonder leverancier'],
  ];
  return (
    <div className="pf-romp">
      <div className="pf-raster vier">{kpi.map(([n, t]) => <div key={t} className="pf-kaart"><div className="pf-cijfer"><b className={t.startsWith('Regels zonder') && n ? 'pf-let' : ''}>{n}</b><span>{t}</span></div></div>)}</div>
      <div className="pf-rij">
        <Seg waarde={view} onChange={setView} label="Weergave catering" opties={[['dag', 'Per dag'], ['plaats', 'Per leverplaats'], ['lev', 'Per leverancier']]} />
        <span className="pf-stil">{{ dag: 'Maaltijden tijdens opbouw en afbraak: wie eet op welke dag.', plaats: 'Wat waar en wanneer geleverd wordt.', lev: 'De bestelbon per leverancier.' }[view]}</span>
      </div>
      {view === 'dag' && <PerDag f={f} crew={crew} lev={lev} />}
      {view === 'plaats' && <PerPlaats f={f} lev={lev} />}
      {view === 'lev' && <PerLeverancier f={f} lev={lev} />}
      <TabNotities f={f} tab="catering" />
    </div>
  );
}

const voorNaam = (r, lev) => (r.voor_leverancier_id && lev.get(r.voor_leverancier_id)?.naam) || r.voor_tekst || 'Zonder naam';

function PerDag({ f, crew, lev }) {
  const { plan } = f; const s = f.schrijven;
  const [nieuweGroep, setNieuweGroep] = useState('');
  const [nieuweDag, setNieuweDag] = useState('');
  const [extraDagen, setExtraDagen] = useState([]);
  const [extraGroepen, setExtraGroepen] = useState([]);
  const dagKeys = [...new Set([...crew.map((r) => { const c = canoniek(plan, r.anker, r.dag); return sleutel(c.anker, c.dag); }), ...extraDagen])];
  const kols = dagLijst(plan, dagKeys.map(uitSleutel)).filter((x) => dagKeys.includes(x.k));
  const groepen = [...new Set([...crew.map((r) => voorNaam(r, lev)), ...extraGroepen])];
  const cel = (g, k) => crew.find((r) => voorNaam(r, lev) === g && sleutel(...Object.values(canoniek(plan, r.anker, r.dag))) === k);
  const kolInfo = (k) => { const rs = crew.filter((r) => sleutel(...Object.values(canoniek(plan, r.anker, r.dag))) === k); return { rs, menu: [...new Set(rs.map((r) => r.product))].join(', '), tot: rs.filter(telbaar).reduce((a, r) => a + num(r.aantal), 0) }; };

  // Wie staat die dag in de planning? Leveranciers met een taak of levering.
  const aanwezig = useMemo(() => {
    const m = new Map(); const sl = opId(f.d.site_leveranciers); const tk = opId(f.d.taken);
    const zet = (levId, anker, dag) => { if (!levId) return; const c = canoniek(plan, anker, dag); const k = sleutel(c.anker, c.dag); const n = lev.get(levId)?.naam; if (!n) return; (m.get(k) || m.set(k, new Set()).get(k)).add(n); };
    for (const l of f.d.leveringen || []) zet(sl.get(l.site_leverancier_id)?.leverancier_id, l.anker, l.dag);
    for (const d of f.d.taak_dagen || []) zet(tk.get(d.taak_id)?.wie_leverancier_id, d.anker, d.dag);
    return m;
  }, [f.d, plan, lev]);
  const vorige = (g, k) => { const i = kols.findIndex((x) => x.k === k); for (let j = i - 1; j >= 0; j--) { const r = cel(g, kols[j].k); if (r && num(r.aantal)) return num(r.aantal); } return 1; };
  const sjabloon = (k) => kolInfo(k).rs[0] || crew[0] || {};
  const maak = (g, k, aantal) => {
    const sj = sjabloon(k); const d = uitSleutel(k);
    const levVoor = f.d.leveranciers.find((l) => l.naam === g);
    return f.voegToe('cateringregels', { soort: 'crew', product: sj.product || 'Maaltijd', eenheid: sj.eenheid || 'pers', leverancier_id: sj.leverancier_id || null, voor_tekst: levVoor ? null : g, voor_leverancier_id: levVoor?.id || null, ...d, uur: sj.uur || null, leverplaats_item_id: sj.leverplaats_item_id || null, leverplaats_tekst: sj.leverplaats_tekst || null, aantal, vennootschap_id: sj.vennootschap_id || null });
  };
  const zet = (g, k, v) => { const r = cel(g, k); const n = getal(v); if (r) { if (n == null || n === 0) return f.wis('cateringregels', r.id); return f.wijzig('cateringregels', r.id, { aantal: n }); } if (n) return maak(g, k, n); };
  const lijst = dagLijst(plan, [...(f.d.taak_dagen || []), ...(f.d.leveringen || []), { anker: 'start', dag: -10 }, { anker: 'einde', dag: 5 }]);
  const totaal = kols.reduce((a, x) => a + kolInfo(x.k).tot, 0);

  return <>
    <div className="pf-tabvak">
      <table className="pf-tabel" style={{ minWidth: 260 + kols.length * 76 }}>
        <thead><tr><th className="vastlinks" style={{ minWidth: 190 }}>Voor wie</th>{kols.map((x) => { const i = kolInfo(x.k); return <th key={x.k} className="getal" style={{ minWidth: 70 }}><span style={{ color: 'var(--t-tekst)' }}>{dagNaam(plan, x.anker, x.dag).split(' · ')[0]}</span><small style={{ display: 'block', fontWeight: 400 }}>{label(plan, x.anker, x.dag)}{i.menu ? ` · ${i.menu}` : ''}</small></th>; })}<th className="getal">Totaal</th></tr></thead>
        <tbody>
          {!groepen.length && <tr><td colSpan={kols.length + 2} className="pf-leeg">Nog geen maaltijden. Voeg een dag en een groep toe, of neem ze over van een vorige editie.</td></tr>}
          {groepen.map((g) => (
            <tr key={g}>
              <td className="vastlinks" style={{ fontWeight: 500 }}>{g}</td>
              {kols.map((x) => {
                const r = cel(g, x.k);
                const voorstel = !r && s && aanwezig.get(x.k)?.has(g);
                return <td key={x.k} className="getal">{voorstel
                  ? <button className="pf-voorstel" title={`${g} staat op deze dag in de planning`} onClick={() => maak(g, x.k, vorige(g, x.k))}>+ {vorige(g, x.k)}</button>
                  : <Bewaarveld klasse="pf-cel" waarde={r ? getalTekst(r.aantal) : ''} uit={!s} label={`${g} · ${dagNaam(plan, x.anker, x.dag)}`} onBewaar={(v) => zet(g, x.k, v)} />}</td>;
              })}
              <td className="getal" style={{ fontWeight: 600 }}>{crew.filter((r) => voorNaam(r, lev) === g && telbaar(r)).reduce((a, r) => a + num(r.aantal), 0) || ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td className="vastlinks">Totaal</td>{kols.map((x) => <td key={x.k} className="getal">{kolInfo(x.k).tot || ''}</td>)}<td className="getal">{totaal || ''}</td></tr></tfoot>
      </table>
    </div>
    {s && <div className="pf-rij">
      <span className="pf-voorstel" style={{ cursor: 'default' }}>+ 5</span><span className="pf-stil">= staat die dag in de planning maar heeft nog geen maaltijd. Klik om het aantal van de vorige dag over te nemen.</span>
      <div className="pf-vul" />
      <select className="t-veld" style={{ width: 200, height: 32 }} value={nieuweDag} onChange={(e) => { setNieuweDag(''); if (e.target.value) setExtraDagen((l) => [...new Set([...l, e.target.value])]); }} aria-label="Dag toevoegen"><option value="">Dag toevoegen…</option>{lijst.filter((x) => !dagKeys.includes(x.k)).map((x) => <option key={x.k} value={x.k}>{dagNaam(plan, x.anker, x.dag)}</option>)}</select>
      <input className="t-veld" style={{ width: 200, height: 32 }} value={nieuweGroep} onChange={(e) => setNieuweGroep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && nieuweGroep.trim()) { setExtraGroepen((l) => [...l, nieuweGroep.trim()]); setNieuweGroep(''); } }} placeholder="Groep toevoegen, bv. Gigant" aria-label="Groep toevoegen" list="pf-levnamen" />
      <datalist id="pf-levnamen">{f.d.leveranciers.map((l) => <option key={l.id} value={l.naam} />)}</datalist>
    </div>}
    {s && crew.length > 0 && <MenuPerDag f={f} kols={kols} kolInfo={kolInfo} />}
  </>;
}

// Menu en leverancier van een dag in één keer zetten (alle regels van die dag).
function MenuPerDag({ f, kols, kolInfo }) {
  return (
    <details className="pf-kaart"><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Menu, leverancier en leverplaats per dag</summary>
      <table className="pf-tabel"><thead><tr><th>Dag</th><th>Menu</th><th>Leverancier</th><th>Uur</th><th>Leverplaats</th></tr></thead><tbody>
        {kols.map((x) => { const i = kolInfo(x.k); const r0 = i.rs[0]; if (!r0) return null; const ids = i.rs.map((r) => r.id); return (
          <tr key={x.k}><td>{dagNaam(f.plan, x.anker, x.dag)}</td>
            <td><Bewaarveld waarde={r0.product} label="Menu" onBewaar={(v) => v.trim() && f.wijzig('cateringregels', ids, { product: v.trim() })} /></td>
            <td><select className="t-veld" style={{ height: 28 }} value={r0.leverancier_id || ''} onChange={(e) => f.wijzig('cateringregels', ids, { leverancier_id: e.target.value || null })} aria-label="Leverancier"><option value="">Nog kiezen</option>{f.d.leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}</select></td>
            <td><Bewaarveld klasse="pf-cel" waarde={uurKort(r0.uur)} label="Uur" onBewaar={(v) => f.wijzig('cateringregels', ids, { uur: leesUur(v) })} /></td>
            <td><Bewaarveld waarde={r0.leverplaats_tekst || ''} label="Leverplaats" onBewaar={(v) => f.wijzig('cateringregels', ids, { leverplaats_tekst: v.trim() || null })} /></td>
          </tr>); })}
      </tbody></table>
    </details>
  );
}

function PerPlaats({ f, lev }) {
  const { plan } = f; const s = f.schrijven;
  const regels = (f.d.cateringregels || []).filter((r) => r.soort !== 'crew');
  const keys = [...new Set(regels.map((r) => sleutel(...Object.values(canoniek(plan, r.anker, r.dag)))))];
  const dagen = dagLijst(plan, keys.map(uitSleutel)).filter((x) => keys.includes(x.k));
  const [dagK, setDagK] = useState(null);
  const huidig = dagen.find((x) => x.k === dagK) || dagen.find((x) => x.k === 'start:0') || dagen[0];
  const items = opId(f.items);
  const plaatsVan = (r) => (r.leverplaats_item_id && items.get(r.leverplaats_item_id)?.naam) || r.leverplaats_tekst || 'Geen leverplaats';
  const opDag = huidig ? regels.filter((r) => sleutel(...Object.values(canoniek(plan, r.anker, r.dag))) === huidig.k) : [];
  const plaatsen = [...new Set(opDag.map(plaatsVan))];
  const leeg = { product: 'Lunchpakket', voor: '', groep: '', uur: '', aantal: '', eenheid: 'st', plaats: '', lev: '', k: huidig?.k || 'start:0' };
  const [n, setN] = useState(leeg);
  const lijst = dagLijst(plan, [...(f.d.taak_dagen || []), { anker: 'start', dag: -10 }, { anker: 'einde', dag: 5 }]);
  const toe = async () => {
    if (!n.product.trim() || !n.voor.trim()) return f.meld('Product en voor wie invullen');
    const levVoor = f.d.leveranciers.find((l) => l.naam.toLowerCase() === n.voor.trim().toLowerCase());
    const it = f.items.find((i) => i.naam && i.naam === n.plaats);
    await f.voegToe('cateringregels', { soort: 'wedstrijddag', product: n.product.trim(), eenheid: n.eenheid || 'st', voor_tekst: levVoor ? null : n.voor.trim(), voor_leverancier_id: levVoor?.id || null, groep: n.groep.trim() || null, ...uitSleutel(n.k || huidig?.k || 'start:0'), uur: leesUur(n.uur), aantal: getal(n.aantal), leverplaats_item_id: it?.id || null, leverplaats_tekst: it ? null : (n.plaats.trim() || null), leverancier_id: n.lev || null });
    setN({ ...n, voor: '', aantal: '' }); setDagK(n.k);
  };
  return <>
    {dagen.length > 0 && <div className="pf-rij"><span className="pf-stil">Dag</span><Chips waarde={huidig?.k} onChange={setDagK} opties={dagen.map((x) => [x.k, dagNaam(plan, x.anker, x.dag)])} /></div>}
    <div className="pf-tabvak">
      <table className="pf-tabel" style={{ minWidth: 980 }}>
        <thead><tr><th>Product</th><th>Voor wie</th><th style={{ width: 70 }}>Uur</th><th className="getal" style={{ width: 120 }}>Aantal</th><th>Opmerking</th><th style={{ width: 180 }}>Leverancier</th><th style={{ width: 60 }} /></tr></thead>
        <tbody>
          {!opDag.length && <tr><td colSpan={7} className="pf-leeg">Nog geen bestellingen{huidig ? ' op deze dag' : ''}.</td></tr>}
          {plaatsen.map((p) => {
            const rs = opDag.filter((r) => plaatsVan(r) === p).sort((a, b) => String(a.uur || '').localeCompare(String(b.uur || '')) || a.product.localeCompare(b.product));
            return [
              <tr key={`g${p}`} className="groep"><td colSpan={7}>{p} · {rs.filter(telbaar).reduce((a, r) => a + num(r.aantal), 0)} stuks</td></tr>,
              ...rs.map((r) => (
                <tr key={r.id} style={r.rechtstreeks ? { color: 'var(--t-tekst-2)' } : null}>
                  <td>{r.product}</td>
                  <td><b style={{ fontWeight: 500 }}>{voorNaam(r, lev)}</b>{r.groep && r.groep !== voorNaam(r, lev) && <small>{r.groep}</small>}</td>
                  <td>{uurKort(r.uur) || '–'}</td>
                  <td className="getal"><Bewaarveld klasse="pf-cel" waarde={getalTekst(r.aantal)} uit={!s} label={`Aantal ${voorNaam(r, lev)}`} onBewaar={(v) => f.wijzig('cateringregels', r.id, { aantal: getal(v) })} /> <small style={{ display: 'inline' }}>{r.eenheid}</small></td>
                  <td><Bewaarveld waarde={r.opmerking || ''} uit={!s} label="Opmerking" onBewaar={(v) => f.wijzig('cateringregels', r.id, { opmerking: v.trim() || null })} />{r.rechtstreeks && <small>Rechtstreeks met de leverancier · telt niet mee</small>}</td>
                  <td><select className="t-veld" style={{ height: 28, width: '100%' }} value={r.leverancier_id || ''} disabled={!s} onChange={(e) => f.wijzig('cateringregels', r.id, { leverancier_id: e.target.value || null })} aria-label="Leverancier"><option value="">Nog kiezen</option>{f.d.leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}</select></td>
                  <td>{s && <button className="t-knop klein stil" onClick={() => f.wis('cateringregels', r.id)} aria-label="Regel verwijderen">Weg</button>}</td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
    {s && <div className="pf-kaart">
      <b>Bestelling toevoegen</b>
      <div className="pf-velden">
        <label><span className="t-label">Dag</span><select className="t-veld" value={n.k || huidig?.k || ''} onChange={(e) => setN({ ...n, k: e.target.value })}>{lijst.map((x) => <option key={x.k} value={x.k}>{dagNaam(plan, x.anker, x.dag)}</option>)}</select></label>
        <label><span className="t-label">Product</span><input className="t-veld" value={n.product} onChange={(e) => setN({ ...n, product: e.target.value })} list="pf-producten" /></label>
        <label><span className="t-label">Voor wie</span><input className="t-veld" value={n.voor} onChange={(e) => setN({ ...n, voor: e.target.value })} list="pf-levnamen2" placeholder="Portix, Vrijwilligers" /></label>
        <label><span className="t-label">Groep</span><input className="t-veld" value={n.groep} onChange={(e) => setN({ ...n, groep: e.target.value })} placeholder="Organisatie" /></label>
        <label><span className="t-label">Uur</span><input className="t-veld" value={n.uur} onChange={(e) => setN({ ...n, uur: e.target.value })} placeholder="06:30" /></label>
        <label><span className="t-label">Aantal</span><input className="t-veld" value={n.aantal} onChange={(e) => setN({ ...n, aantal: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && toe()} /></label>
        <label><span className="t-label">Eenheid</span><select className="t-veld" value={n.eenheid} onChange={(e) => setN({ ...n, eenheid: e.target.value })}>{['st', 'pers', 'l', 'kg', 'doos', 'pak'].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
        <label><span className="t-label">Leverplaats</span><input className="t-veld" value={n.plaats} onChange={(e) => setN({ ...n, plaats: e.target.value })} list="pf-plaatsen" placeholder="Item op de kaart of vrij" /></label>
        <label><span className="t-label">Leverancier</span><select className="t-veld" value={n.lev} onChange={(e) => setN({ ...n, lev: e.target.value })}><option value="">Nog kiezen</option>{f.d.leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}</select></label>
      </div>
      <datalist id="pf-producten">{[...new Set((f.d.cateringregels || []).map((r) => r.product))].map((p) => <option key={p} value={p} />)}</datalist>
      <datalist id="pf-levnamen2">{f.d.leveranciers.map((l) => <option key={l.id} value={l.naam} />)}</datalist>
      <datalist id="pf-plaatsen">{f.items.filter((i) => i.naam).map((i) => <option key={i.id} value={i.naam} />)}</datalist>
      <div><button className="t-knop hoofd" onClick={toe}>Toevoegen</button></div>
    </div>}
  </>;
}

function PerLeverancier({ f, lev }) {
  const { plan } = f;
  const regels = f.d.cateringregels || [];
  const prijzen = f.d.catering_prijzen || [];
  const ids = [...new Set(regels.map((r) => r.leverancier_id || ''))];
  const items = opId(f.items);
  const plaatsVan = (r) => (r.leverplaats_item_id && items.get(r.leverplaats_item_id)?.naam) || r.leverplaats_tekst || '';
  const zetPrijs = async (levId, product, eenheid, v) => {
    const b = prijzen.find((p) => (p.leverancier_id || '') === levId && p.product === product && p.eenheid === eenheid);
    const prijs = getal(v);
    if (b) return f.wijzig('catering_prijzen', b.id, { prijs });
    return f.voegToe('catering_prijzen', { leverancier_id: levId || null, product, eenheid, prijs });
  };
  const bon = async (levId) => {
    const rs = regels.filter((r) => (r.leverancier_id || '') === levId && !r.rechtstreeks).sort((a, b) => (a.anker === b.anker ? a.dag - b.dag : a.anker === 'start' ? -1 : 1));
    const naam = lev.get(levId)?.naam || 'Zonder leverancier';
    const venn = (f.d.vennootschappen || []).find((v) => v.id === (rs[0]?.vennootschap_id || (f.d.plan_vennootschappen || []).find((x) => x.standaard)?.vennootschap_id));
    bewaarBestand(await maakXlsx([{ naam: 'Bestelling', rijen: [[`Bestelling ${naam}`, plan.naam], ...(venn ? [['Facturatie', `${venn.naam} · ${venn.btw || ''} · ${venn.adres || ''} · ${venn.factuur_email || ''}`]] : []), [],
      ['Dag', 'Uur', 'Leverplaats', 'Product', 'Voor wie', 'Aantal', 'Eenheid', 'Opmerking'],
      ...rs.map((r) => [dagNaam(plan, r.anker, r.dag), uurKort(r.uur), plaatsVan(r), r.product, voorNaam(r, lev), num(r.aantal), r.eenheid, r.opmerking || ''])] }]), `bestelling ${naam} ${plan.naam}.xlsx`);
  };
  if (!ids.length) return <div className="pf-leeg">Nog geen bestellingen.</div>;
  return (
    <div className="pf-raster" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
      {ids.map((id) => {
        const rs = regels.filter((r) => (r.leverancier_id || '') === id);
        const prods = [...new Set(rs.filter((r) => !r.rechtstreeks).map((r) => `${r.product}|${r.eenheid}`))].map((k) => {
          const [product, eenheid] = k.split('|'); const n = rs.filter((r) => !r.rechtstreeks && r.product === product && r.eenheid === eenheid).reduce((a, r) => a + num(r.aantal), 0);
          const p = prijzen.find((x) => (x.leverancier_id || '') === id && x.product === product && x.eenheid === eenheid);
          return { product, eenheid, n, prijs: p?.prijs, bedrag: p?.prijs != null ? n * Number(p.prijs) : null };
        });
        const dagen = [...new Set(rs.map((r) => sleutel(...Object.values(canoniek(plan, r.anker, r.dag)))))];
        const tot = prods.reduce((a, p) => a + (p.bedrag || 0), 0); const zonder = prods.filter((p) => p.prijs == null).length;
        return (
          <section key={id} className="pf-kaart">
            <div className="pf-kaartkop"><h2>{lev.get(id)?.naam || 'Nog geen leverancier'}</h2><span className="pf-stil">{rs.length} regels · {dagen.length} {dagen.length === 1 ? 'dag' : 'dagen'}</span></div>
            <table className="pf-tabel"><thead><tr><th>Product</th><th className="getal">Totaal</th>{f.financieel && <><th className="getal">Prijs</th><th className="getal">Bedrag</th></>}</tr></thead>
              <tbody>{prods.map((p) => (
                <tr key={p.product + p.eenheid}><td>{p.product}{!['st', 'pers'].includes(p.eenheid) && <small>{p.eenheid}</small>}</td><td className="getal">{getalTekst(p.n)}</td>
                  {f.financieel && <><td className="getal"><Bewaarveld klasse="pf-cel" waarde={getalTekst(p.prijs)} uit={!f.schrijven} label={`Prijs ${p.product}`} onBewaar={(v) => zetPrijs(id, p.product, p.eenheid, v)} /></td><td className="getal">{euro(p.bedrag)}</td></>}</tr>
              ))}</tbody></table>
            {f.financieel && <span className="pf-stil">{tot ? `${euro(tot)} naar Budget` : 'Vul een prijs in, dan komt het bedrag in Budget'}{zonder && tot ? ` · ${zonder} producten zonder prijs` : ''}</span>}
            <div className="pf-rij"><button className="t-knop klein" onClick={() => bon(id)}>Bestelbon (Excel)</button></div>
          </section>
        );
      })}
    </div>
  );
}
