'use client';

// Projectfiche van één site (plan): kop met tabs, elke tab een onderdeel van de fiche.
import { useEffect, useState } from 'react';
import '../maps/maps.css';
import './fiche.css';
import { useFiche } from './data';
import { AppDialogen } from '../maps/dialoog';
import { datumTekst, wedstrijd } from './dagen';
import TabPlanning from './TabPlanning';
import TabLeveranciers from './TabLeveranciers';
import TabLaadlijst from './TabLaadlijst';
import TabCatering from './TabCatering';
import TabBudget from './TabBudget';
import TabContacten from './TabContacten';
import { TabLocaties, TabMobiliteit } from './TabLocaties';
import { TabOverzicht, TabNotitiesPagina, TabInfo, ALLE_TABS } from './TabOverig';
import { opId } from './data';

export default function FicheScherm({ planId }) {
  const f = useFiche(planId);
  const [tab, setTab] = useState('overzicht');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && ALLE_TABS.some(([k]) => k === t)) setTab(t);
  }, []);
  const naar = (t) => { setTab(t); const u = new URL(window.location.href); u.searchParams.set('tab', t); window.history.replaceState(null, '', u); window.scrollTo(0, 0); };

  if (f.laden) return <div className="pf"><div className="pf-romp"><p className="pf-stil">Laden…</p></div></div>;
  if (!f.plan) return <div className="pf"><div className="pf-romp"><div className="t-melding fout">{f.fout || 'Dit plan bestaat niet.'}</div></div></div>;

  const { plan, event } = f;
  const verborgen = new Set(plan.instellingen?.fiche?.verborgen_tabs || []);
  const notOpen = (f.d.notities || []).filter((n) => !n.klaar).length;
  const tabs = ALLE_TABS.filter(([k]) => !verborgen.has(k) && (k !== 'budget' || f.financieel));
  const w = wedstrijd(plan);
  const pers = opId(f.d.personen);
  const team = (f.d.site_rollen || []).filter((r) => r.rol).slice(0, 3).map((r) => `${r.rol.toLowerCase()} ${pers.get(r.persoon_id)?.naam || ''}`.trim());
  const meta = [w ? (w.lengte > 1 ? `${datumTekst(w.van)} tot ${datumTekst(w.tot, true)}` : datumTekst(w.van, true)) : 'Wedstrijddag nog niet ingesteld', plan.locatie, ...team].filter(Boolean).join(' · ');
  const actief = tabs.some(([k]) => k === tab) ? tab : 'overzicht';

  return (
    <div className="pf">
      <AppDialogen />
      <div className="pf-kop">
        <div className="pf-kruimel"><a href="/maps">Overzicht</a><span>/</span><span>{event?.naam || plan.editie_naam || 'Zonder event'}</span></div>
        <div className="pf-kopregel">
          <h1 className="t-titel">{plan.naam}</h1>
          <a className="t-knop hoofd" href={`/maps/${plan.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Open het plan</a>
        </div>
        <div className="pf-meta">{meta}</div>
        <nav className="t-tabs" role="tablist" aria-label="Onderdelen van de fiche">
          {tabs.map(([k, n]) => <button key={k} role="tab" aria-selected={actief === k} className={actief === k ? 'aan' : ''} onClick={() => naar(k)}>{k === 'notities' && notOpen ? `${n} · ${notOpen}` : n}</button>)}
        </nav>
      </div>
      {f.fout && <div className="pf-romp" style={{ paddingBottom: 0 }}><div className="t-melding fout">{f.fout}</div></div>}
      {actief === 'overzicht' && <TabOverzicht f={f} naar={naar} />}
      {actief === 'planning' && <TabPlanning f={f} planId={planId} />}
      {actief === 'leveranciers' && <TabLeveranciers f={f} />}
      {actief === 'laadlijst' && <TabLaadlijst f={f} />}
      {actief === 'catering' && <TabCatering f={f} />}
      {actief === 'budget' && <TabBudget f={f} />}
      {actief === 'contacten' && <TabContacten f={f} />}
      {actief === 'locaties' && <TabLocaties f={f} />}
      {actief === 'mobiliteit' && <TabMobiliteit f={f} />}
      {actief === 'notities' && <TabNotitiesPagina f={f} naar={naar} />}
      {actief === 'info' && <TabInfo f={f} />}
      {f.melding && <div className="pf-toast" role="status">{f.melding}</div>}
    </div>
  );
}
