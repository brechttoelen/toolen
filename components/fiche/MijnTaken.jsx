'use client';

// Mijn taken: alle taakdagen waar ik uitvoerder of verantwoordelijke ben, over alle sites heen.
// Ook voor lezers: afvinken gaat via maps.taakdag_status (enkel eigen taken).
import { useEffect, useState } from 'react';
import '../maps/maps.css';
import './fiche.css';
import { maps, foutTekst, wieBenIk } from '../maps/db';
import { dagNaam, canoniek, sleutel, volgorde, uurKort, datumVan } from './dagen';
import { StatusKeuze, STATUS_TAAK, Chips } from './gedeeld';

export default function MijnTaken() {
  const [st, setSt] = useState({ laden: true, fout: '', rijen: [], plannen: new Map() });
  const [filter, setFilter] = useState('komend');
  const laad = async () => {
    const ik = await wieBenIk();
    if (!ik?.id) { setSt({ laden: false, fout: 'Niet ingelogd.', rijen: [], plannen: new Map() }); return; }
    const p = await maps().from('personen').select('id').eq('user_id', ik.id);
    const ids = (p.data || []).map((x) => x.id);
    if (!ids.length) { setSt({ laden: false, fout: '', rijen: [], plannen: new Map(), geenPersoon: true }); return; }
    const [d1, t1] = await Promise.all([
      maps().from('taak_dagen').select('*').in('uitvoerder_persoon_id', ids),
      maps().from('taken').select('*').in('wie_persoon_id', ids),
    ]);
    if (d1.error || t1.error) { setSt({ laden: false, fout: foutTekst(d1.error || t1.error), rijen: [], plannen: new Map() }); return; }
    const extra = t1.data?.length ? await maps().from('taak_dagen').select('*').in('taak_id', t1.data.map((t) => t.id)) : { data: [] };
    const dagen = new Map([...(d1.data || []), ...(extra.data || [])].map((d) => [d.id, d]));
    const taakIds = [...new Set([...dagen.values()].map((d) => d.taak_id))];
    const taken = new Map((t1.data || []).map((t) => [t.id, t]));
    const ontbreekt = taakIds.filter((i) => !taken.has(i));
    if (ontbreekt.length) { const t2 = await maps().from('taken').select('*').in('id', ontbreekt); (t2.data || []).forEach((t) => taken.set(t.id, t)); }
    const planIds = [...new Set([...taken.values()].map((t) => t.plan_id))];
    const pl = planIds.length ? await maps().from('plannen').select('id, naam, editie_naam, wedstrijd_van, wedstrijd_tot').in('id', planIds) : { data: [] };
    const plannen = new Map((pl.data || []).map((x) => [x.id, x]));
    setSt({ laden: false, fout: '', plannen, rijen: [...dagen.values()].map((d) => ({ d, t: taken.get(d.taak_id) })).filter((r) => r.t && !r.t.voorbereiding) });
  };
  useEffect(() => { laad(); }, []);
  const zet = async (d, v) => {
    setSt((s) => ({ ...s, rijen: s.rijen.map((r) => (r.d.id === d.id ? { ...r, d: { ...r.d, status: v } } : r)) }));
    const r = await maps().rpc('taakdag_status', { p_id: d.id, p_status: v });
    if (r.error) { setSt((s) => ({ ...s, fout: foutTekst(r.error) })); laad(); }
  };
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const zichtbaar = st.rijen.filter((r) => { const p = st.plannen.get(r.t.plan_id); const dt = p && datumVan(p, r.d.anker, r.d.dag); if (filter === 'open') return r.d.status !== 'klaar'; if (filter === 'komend') return !dt || dt >= vandaag; return true; });
  const groepen = new Map();
  for (const r of zichtbaar) { const p = st.plannen.get(r.t.plan_id) || {}; const c = canoniek(p, r.d.anker, r.d.dag); const k = `${r.t.plan_id}|${sleutel(c.anker, c.dag)}`; (groepen.get(k) || groepen.set(k, { p, c, rijen: [] }).get(k)).rijen.push(r); }
  const lijst = [...groepen.values()].sort((a, b) => { const da = datumVan(a.p, a.c.anker, a.c.dag), db = datumVan(b.p, b.c.anker, b.c.dag); return da && db ? da - db : volgorde(a.p, a.c, b.c); });
  return (
    <div className="pf">
      <div className="pf-kop" style={{ paddingBottom: 14 }}><h1 className="t-titel" style={{ margin: 0 }}>Mijn taken</h1><div className="pf-meta">Taken waar jij uitvoerder of verantwoordelijke bent, op alle sites.</div></div>
      <div className="pf-romp">
        <Chips waarde={filter} onChange={setFilter} opties={[['komend', 'Vanaf vandaag'], ['open', 'Nog open'], ['alles', 'Alles']]} />
        {st.fout && <div className="t-melding fout">{st.fout}</div>}
        {st.laden && <p className="pf-stil">Laden…</p>}
        {st.geenPersoon && <div className="t-melding">Je staat nog niet als persoon in een team. Vraag de projectmanager om je toe te voegen bij Contacten van een site.</div>}
        {!st.laden && !st.geenPersoon && !lijst.length && <p className="pf-stil">Geen taken in deze lijst.</p>}
        {lijst.map((g) => (
          <section key={`${g.p.id}${sleutel(g.c.anker, g.c.dag)}`} className="pf-kaart" style={{ gap: 6 }}>
            <div className="pf-kaartkop"><h2 style={{ fontSize: 16 }}>{dagNaam(g.p, g.c.anker, g.c.dag)}</h2><a className="pf-link" href={`/maps/${g.p.id}/fiche?tab=planning`}>{g.p.naam}</a></div>
            {g.rijen.sort((a, b) => String(a.d.uur_van || '99').localeCompare(String(b.d.uur_van || '99'))).map(({ d, t }) => (
              <div key={d.id} className="pf-rij" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', borderTop: '1px solid #EEF1F5', paddingTop: 6 }}>
                <span style={{ width: 48, fontWeight: 600, color: 'var(--t-navy)', fontVariantNumeric: 'tabular-nums' }}>{uurKort(d.uur_van) || '–'}</span>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ textDecoration: d.status === 'klaar' ? 'line-through' : 'none' }}>{t.titel}</span>{(t.waar_tekst || t.info) && <small className="pf-stil" style={{ display: 'block' }}>{[t.waar_tekst, t.info].filter(Boolean).join(' · ')}</small>}</span>
                <StatusKeuze waarde={d.status} opties={STATUS_TAAK} label={`Status ${t.titel}`} onChange={(v) => zet(d, v)} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
