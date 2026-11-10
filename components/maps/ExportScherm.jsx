'use client';

// Exporteren in een eigen tabblad: je kan verder werken in het plan terwijl de PDF gemaakt wordt.
// Een duidelijke voortgang per blad en per kaarttegel; tegels die al eens geladen werden komen uit de bewaarde
// tegels (service worker), zodat een tweede export veel sneller gaat.
import { useEffect, useRef, useState } from 'react';
import { heeftModule } from './merk';
import { laadPlanData } from './planLaden';
import { maps } from './db';
import { berekenStroom } from './stroom';
import './maps.css';

const NAMEN = { stroomplan: 'Stroomdossier', veiligheidsplan: 'Veiligheidsplan', brandingplan: 'Brandingplan', pdf: 'PDF op schaal', uitsneden: 'PDF met profielen' };

export default function ExportScherm({ planId }) {
  const [opdracht, setOpdracht] = useState(null);
  const [plan, setPlan] = useState(null);
  const [stap, setStap] = useState({ nu: 0, totaal: 1, tekst: 'Plan laden…' });
  const [tegels, setTegels] = useState(null);
  const [tekst, setTekst] = useState('');
  const [klaar, setKlaar] = useState(false);
  const [fout, setFout] = useState('');
  const [meldingen, setMeldingen] = useState([]);
  const [start] = useState(() => Date.now());
  const [nu, setNu] = useState(Date.now());
  const gestart = useRef(false);

  useEffect(() => { const t = setInterval(() => setNu(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (gestart.current) return; gestart.current = true;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/maps-sw.js', { scope: '/maps/' }).catch(() => {});
    const k = new URLSearchParams(window.location.search).get('k');
    let o = null; try { o = JSON.parse(localStorage.getItem(`fm-export-${k}`) || 'null'); } catch {}
    if (!o) { setFout('Deze export is niet (meer) gekend. Start ze opnieuw vanuit het plan.'); return; }
    setOpdracht(o);
    (async () => {
      try {
        const d = await laadPlanData(planId);
        setPlan(d.plan); document.title = `${NAMEN[o.soort === 'werkruimte' ? o.id : o.soort] || 'Export'} · ${d.plan.naam}`;
        const fase = d.fasen.find((f) => f.id === o.faseId) || null;
        const lagenMap = new Map(d.lagen.map((l) => [l.id, l]));
        const opTegels = (x) => setTegels({ ...x });
        const zetStap = (i, n, t) => { setStap({ nu: i, totaal: n, tekst: t }); setTegels(null); };
        let m = [];
        if (o.soort === 'werkruimte') {
          const w = await import('./werkruimtePdf');
          if (o.id === 'stroomplan') {
            const stroom = berekenStroom(d.items, d.elementenMap, { gelijktijdigheid: d.plan.instellingen?.stroom?.gelijktijdigheid ?? 0.8, fasen: d.fasen, vast: d.vast });
            m = await w.stroomplanPdf({ plan: d.plan, lagen: d.lagen, items: d.items, elementenMap: d.elementenMap, lagenMap, fase, fasen: d.fasen, stroom, voortgang: setTekst, stap: zetStap, onTegels: opTegels });
          } else if (o.id === 'veiligheidsplan') { zetStap(0, 1, 'Kaart'); m = await w.veiligheidsplanPdf({ plan: d.plan, lagen: d.lagen, items: d.items, elementenMap: d.elementenMap, lagenMap, fase, voortgang: setTekst, onTegels: opTegels }); }
          else if (o.id === 'brandingplan') { zetStap(0, 1, 'Kaart'); m = await w.brandingplanPdf({ plan: d.plan, lagen: d.lagen, items: d.items, elementenMap: d.elementenMap, lagenMap, fase, voortgang: setTekst, onTegels: opTegels }); }
        } else {
          const { maakPdf, maakBladen } = await import('./pdf');
          const items = d.items.filter((x) => !x.velden?.binnen);
          let revisie = null;
          if (o.revisieVan) { const { data } = await maps().from('versies').select('versie, momentopname').eq('id', o.revisieVan).single(); if (data) revisie = { versie: data.versie, items: data.momentopname?.items || [] }; }
          const inst = { ...o.inst, revisie, revisies: o.revisies || [], onTegels: opTegels };
          // Zonder vast midden (passend): het midden van het plan.
          if (!Array.isArray(inst.centrum)) inst.centrum = d.plan.centrum || [4.4, 50.9];
          if (!Array.isArray(inst.lagen)) inst.lagen = d.lagen.filter((l) => l.printbaar !== false && l.zichtbaar !== false).map((l) => l.id);
          let doc = null;
          if (o.soort === 'uitsneden') {
            for (let i = 0; i < o.lijst.length; i++) {
              const u = o.lijst[i]; zetStap(i, o.lijst.length, u.naam);
              const r = await maakPdf({ plan: d.plan, lagen: d.lagen, items, elementenMap: d.elementenMap, fase, inst: { ...inst, ...(u.inst || {}), papier: u.papier || inst.papier, orientatie: u.orientatie || inst.orientatie, vrijB: u.vrijB ?? inst.vrijB, vrijH: u.vrijH ?? inst.vrijH, schaal: u.schaal, centrum: u.centrum }, voortgang: setTekst, doc, blad: { label: u.naam, laatste: i === o.lijst.length - 1 } });
              doc = r.doc; for (const x of r.meldingen) if (!m.includes(x)) m.push(x);
            }
          } else {
            zetStap(0, 1, 'Kaart');
            const args = { plan: d.plan, lagen: d.lagen, items, elementenMap: d.elementenMap, fase, inst, voortgang: setTekst, stap: zetStap };
            const r = inst.bladen && heeftModule('groot') ? await maakBladen(args) : await maakPdf(args);
            doc = r.doc; m = r.meldingen;
          }
          doc.save(`${o.bestandsnaam || d.plan.naam}.pdf`);
        }
        setMeldingen(m || []); setKlaar(true); setStap((s) => ({ ...s, nu: s.totaal, tekst: 'Klaar' }));
        try { localStorage.removeItem(`fm-export-${k}`); } catch {}
      } catch (e) { setFout(e?.message || String(e)); }
    })();
  }, [planId]);

  const naam = opdracht ? NAMEN[opdracht.soort === 'werkruimte' ? opdracht.id : opdracht.soort] || 'Export' : 'Export';
  const tegelDeel = tegels && tegels.gevraagd ? Math.min(1, (tegels.binnen + tegels.fout) / tegels.gevraagd) : 0;
  const pct = klaar ? 100 : Math.round(((stap.nu + tegelDeel * 0.9) / Math.max(1, stap.totaal)) * 100);
  const sec = Math.round((nu - start) / 1000);
  return (
    <div className="fm fm-export">
      <div className="fm-export-kaart">
        <div className="fm-export-kop"><span className="blok" /> <div><h1>{naam}</h1><div className="fm-sub">{plan?.naam || ''}</div></div></div>
        {fout ? <div className="fm-melding fout">{fout}</div> : (
          <>
            <div className="fm-export-balk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
            <div className="fm-export-regel"><b>{klaar ? 'Klaar' : stap.totaal > 1 ? `Blad ${Math.min(stap.nu + 1, stap.totaal)} van ${stap.totaal}` : 'Bezig'}</b><span>{pct} % · {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}</span></div>
            {!klaar && <div className="fm-sub">{stap.tekst}{tekst && tekst !== stap.tekst ? ` · ${tekst}` : ''}</div>}
            {!klaar && tegels && tegels.gevraagd > 0 && (
              <div className="fm-export-tegels">
                <div className="fm-export-balk klein"><i style={{ width: `${Math.round(tegelDeel * 100)}%` }} /></div>
                <span>Kaarttegels {tegels.binnen} van {tegels.gevraagd}{tegels.fout ? ` · ${tegels.fout} niet bereikbaar` : ''}</span>
              </div>
            )}
            {klaar && <p>De PDF staat in je downloads. Je mag dit tabblad sluiten.</p>}
            {meldingen.length > 0 && <div className="fm-export-meld">{meldingen.map((x, i) => <div key={i}>· {x}</div>)}</div>}
            {!klaar && <p className="fm-sub">Je kan intussen verder werken in het andere tabblad. Laat dit tabblad open tot de PDF klaar is.</p>}
          </>
        )}
        {(klaar || fout) && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="fm-knop zwart" onClick={() => window.close()}>Tabblad sluiten</button><a className="fm-knop" href={`/maps/${planId}`}>Naar het plan</a></div>}
      </div>
    </div>
  );
}
