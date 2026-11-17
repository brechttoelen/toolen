'use client';

// Budget per vennootschap (kostendrager): budgetposten, offertes en facturen van de leveranciers
// en catering met een prijs. Enkel voor wie het recht financieel heeft.
import { useState } from 'react';
import { opId, euro, getal, getalTekst } from './data';
import { Bewaarveld, TabNotities } from './gedeeld';
import { somVan } from './TabLeveranciers';
import { cateringBedragen } from './TabCatering';
import { maakXlsx, bewaarBestand } from '../maps/tabelExport';

export default function TabBudget({ f }) {
  const [np, setNp] = useState({ omschrijving: '', venn: '', budget: '' });
  if (!f.financieel) return <div className="pf-romp"><div className="t-melding">Het budget is enkel zichtbaar voor eigenaars, beheerders en leden met het recht financieel.</div></div>;
  const s = f.schrijven;
  const venn = opId(f.d.vennootschappen); const lev = opId(f.d.leveranciers);
  const standaard = (f.d.plan_vennootschappen || []).find((v) => v.standaard)?.vennootschap_id || null;
  const sl = f.d.site_leveranciers || [];
  const posten = f.d.budgetposten || [];
  const off = f.d.offertes || []; const fac = f.d.facturen || [];
  const cat = cateringBedragen(f);

  // Regels: één per site-leverancier (met hun post als die er is) + losse posten + catering.
  const regels = [];
  for (const x of sl) {
    const p = posten.filter((b) => b.site_leverancier_id === x.id);
    const o = off.filter((y) => y.site_leverancier_id === x.id && y.status !== 'afgewezen');
    const fa = fac.filter((y) => y.site_leverancier_id === x.id);
    const v = p[0]?.vennootschap_id || o[0]?.vennootschap_id || fa[0]?.vennootschap_id || standaard;
    regels.push({ k: x.id, naam: lev.get(x.leverancier_id)?.naam || '?', sub: x.wat, post: p[0] || null, venn: v, budget: p.length ? somVan(p, 'budget') : null, vorig: p.length ? somVan(p, 'vorig_jaar') : null, offT: o.length ? somVan(o) : null, facT: fa.length ? somVan(fa) : null, sl: x });
  }
  for (const p of posten.filter((b) => !b.site_leverancier_id)) regels.push({ k: p.id, naam: p.omschrijving, post: p, venn: p.vennootschap_id || standaard, budget: p.budget, vorig: p.vorig_jaar, offT: null, facT: null });
  for (const c of cat) regels.push({ k: `cat${c.lev}`, naam: `Catering · ${c.naam}`, sub: 'uit de tab Catering', venn: c.venn || standaard, budget: null, vorig: null, offT: c.bedrag, facT: null, catering: true });

  const vennIds = [...new Set(regels.map((r) => r.venn || ''))];
  const groepen = vennIds.map((v) => ({ v, naam: v ? venn.get(v)?.naam || '?' : 'Nog geen vennootschap', regels: regels.filter((r) => (r.venn || '') === v).sort((a, b) => a.naam.localeCompare(b.naam)) }));
  const tot = (l, k) => l.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const prognose = (r) => r.facT ?? r.offT ?? r.budget ?? null;

  const zetBudget = async (r, v) => {
    const b = getal(v);
    if (r.post) return f.wijzig('budgetposten', r.post.id, { budget: b });
    await f.voegToe('budgetposten', { site_leverancier_id: r.sl.id, omschrijving: r.naam, budget: b, vennootschap_id: r.venn || null });
  };
  const zetVenn = async (r, v) => {
    if (r.post) return f.wijzig('budgetposten', r.post.id, { vennootschap_id: v || null });
    if (r.sl) return f.voegToe('budgetposten', { site_leverancier_id: r.sl.id, omschrijving: r.naam, vennootschap_id: v || null });
  };
  const nieuwePost = async () => {
    if (!np.omschrijving.trim()) return;
    await f.voegToe('budgetposten', { omschrijving: np.omschrijving.trim(), vennootschap_id: np.venn || standaard, budget: getal(np.budget) });
    setNp({ omschrijving: '', venn: np.venn, budget: '' });
  };
  const excel = async () => bewaarBestand(await maakXlsx([{ naam: 'Budget', rijen: [['Vennootschap', 'Post', 'Vorig jaar', 'Budget', 'Offerte', 'Factuur', 'Verschil factuur - offerte'],
    ...groepen.flatMap((g) => g.regels.map((r) => [g.naam, r.naam, r.vorig ?? '', r.budget ?? '', r.offT ?? '', r.facT ?? '', r.offT != null && r.facT != null ? Math.round((r.facT - r.offT) * 100) / 100 : '']))] }]), `budget ${f.plan.naam}.xlsx`);

  const totaal = { budget: tot(regels, 'budget'), off: tot(regels, 'offT'), fac: tot(regels, 'facT'), prog: regels.reduce((a, r) => a + (Number(prognose(r)) || 0), 0) };
  return (
    <div className="pf-romp">
      <div className="pf-raster vier">
        <div className="pf-kaart"><div className="pf-cijfer"><b>{euro(totaal.budget)}</b><span>Budget</span></div></div>
        <div className="pf-kaart"><div className="pf-cijfer"><b>{euro(totaal.off)}</b><span>Offertes en catering</span></div></div>
        <div className="pf-kaart"><div className="pf-cijfer"><b>{euro(totaal.fac)}</b><span>Facturen</span></div></div>
        <div className="pf-kaart"><div className="pf-cijfer"><b className={totaal.budget && totaal.prog > totaal.budget ? 'pf-fout' : ''}>{euro(totaal.prog)}</b><span>Verwacht (factuur, anders offerte, anders budget)</span></div></div>
      </div>
      <div className="pf-rij"><span className="pf-stil">Alle bedragen excl. btw.</span><div className="pf-vul" /><button className="t-knop" onClick={excel}>Excel</button></div>
      <div className="pf-tabvak">
        <table className="pf-tabel" style={{ minWidth: 980 }}>
          <thead><tr><th>Post</th><th style={{ width: 200 }}>Vennootschap</th><th className="getal">Vorig jaar</th><th className="getal">Budget</th><th className="getal">Offerte</th><th className="getal">Factuur</th><th className="getal">Verschil</th></tr></thead>
          <tbody>
            {!regels.length && <tr><td colSpan={7} className="pf-leeg">Nog geen posten. Leveranciers van de site en catering met een prijs komen hier vanzelf.</td></tr>}
            {groepen.map((g) => [
              <tr key={`g${g.v}`} className="groep"><td colSpan={7}>{g.naam} · budget {euro(tot(g.regels, 'budget'))} · factuur {euro(tot(g.regels, 'facT'))}</td></tr>,
              ...g.regels.map((r) => {
                const vers = r.offT != null && r.facT != null ? Math.round((r.facT - r.offT) * 100) / 100 : null;
                return (
                  <tr key={r.k}>
                    <td><b>{r.naam}</b>{r.sub && <small>{r.sub}</small>}</td>
                    <td>{r.catering ? <span className="pf-stil">{g.naam}</span> : <select className="t-veld" style={{ height: 28, width: '100%' }} value={r.venn || ''} disabled={!s} onChange={(e) => zetVenn(r, e.target.value)} aria-label="Vennootschap"><option value="">Kies…</option>{(f.d.vennootschappen || []).map((v) => <option key={v.id} value={v.id}>{v.naam}</option>)}</select>}</td>
                    <td className="getal pf-stil">{euro(r.vorig)}</td>
                    <td className="getal">{r.catering ? '' : <Bewaarveld klasse="pf-cel" style={{ width: 100 }} waarde={getalTekst(r.budget)} uit={!s} label={`Budget ${r.naam}`} onBewaar={(v) => zetBudget(r, v)} />}</td>
                    <td className="getal">{euro(r.offT)}</td>
                    <td className="getal">{euro(r.facT)}</td>
                    <td className={`getal ${vers > 0.009 ? 'pf-fout' : vers < -0.009 ? 'pf-let' : ''}`}>{vers ? (vers > 0 ? '+' : '') + euro(vers) : ''}</td>
                  </tr>
                );
              }),
            ])}
          </tbody>
          <tfoot><tr><td>Totaal</td><td /><td className="getal">{euro(tot(regels, 'vorig'))}</td><td className="getal">{euro(totaal.budget)}</td><td className="getal">{euro(totaal.off)}</td><td className="getal">{euro(totaal.fac)}</td><td /></tr></tfoot>
        </table>
      </div>
      {s && (
        <div className="pf-rij">
          <input className="t-veld" style={{ flex: '1 1 260px' }} value={np.omschrijving} onChange={(e) => setNp({ ...np, omschrijving: e.target.value })} placeholder="Nieuwe post, bv. Drukwerk" aria-label="Omschrijving" />
          <select className="t-veld" style={{ width: 220 }} value={np.venn} onChange={(e) => setNp({ ...np, venn: e.target.value })} aria-label="Vennootschap"><option value="">Standaard vennootschap</option>{(f.d.vennootschappen || []).map((v) => <option key={v.id} value={v.id}>{v.naam}</option>)}</select>
          <input className="t-veld" style={{ width: 120 }} value={np.budget} onChange={(e) => setNp({ ...np, budget: e.target.value })} placeholder="Budget €" aria-label="Budget" />
          <button className="t-knop hoofd" onClick={nieuwePost}>Post toevoegen</button>
        </div>
      )}
      <TabNotities f={f} tab="budget" />
    </div>
  );
}
