'use client';

// Leverfiche op een deellink (zonder login): de vastgezette bestelling van één leverancier op één site.
import { useEffect, useState } from 'react';
import { sb } from '../maps/db';
import { leverficheGroepen, eindeTekst, aantalTekst } from './bestelling';
import './fiche.css';

export default function LeverficheDeel({ token }) {
  const [d, setD] = useState(undefined);
  useEffect(() => { sb().schema('maps').rpc('leverfiche', { p_token: token }).then(({ data }) => setD(data || null), () => setD(null)); }, [token]);
  if (d === undefined) return <main className="pf-lf"><p className="pf-stil">Laden…</p></main>;
  if (!d) return <main className="pf-lf"><h1>Leverfiche</h1><p>Deze link bestaat niet of is ingetrokken.</p></main>;
  const plan = { naam: d.plan, wedstrijd_van: d.wedstrijd_van, wedstrijd_tot: d.wedstrijd_tot };
  const van = d.wedstrijd_van ? new Date(`${d.wedstrijd_van}T12:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const groepen = leverficheGroepen(plan, d.regels || []);
  return (
    <main className="pf-lf">
      <div className="pf-rij"><h1 style={{ flex: 1 }}>Leverfiche · {d.plan}</h1><button className="t-knop klein pf-lf-geen-druk" onClick={() => window.print()}>Afdrukken of PDF</button></div>
      <p className="pf-stil">{[van && `Wedstrijd ${van}`, d.locatie, d.vastgezet_op && `stand van ${new Date().toLocaleDateString('nl-BE')}`].filter(Boolean).join(' · ')}</p>
      <div className="pf-lf-band"><b>{String(d.leverancier || '').toUpperCase()}{d.organisatie ? ` · via ${d.organisatie}` : ''}</b><span>{d.wat || ''}</span></div>
      {!d.vastgezet_op && <p>De bestelling staat nog niet vast. Zodra ze vastgezet is, staat ze hier.</p>}
      {groepen.map((g) => (
        <section key={g.titel}>
          <h2>{g.titel}</h2>
          <table>
            <thead><tr><th className="getal">Aantal</th><th>Omschrijving</th><th>Groep</th><th>Locatie</th><th>Ophaling of afbraak</th></tr></thead>
            <tbody>{g.rijen.map((r, i) => (
              <tr key={i}><td className="getal"><b>{aantalTekst(r)}</b></td><td>{r.wat}{r.opmerking && <small>{r.opmerking}</small>}</td><td>{r.groep}</td><td>{r.locatie}</td><td>{eindeTekst(plan, r.oph)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      ))}
      <p className="pf-stil pf-klein">Deze pagina toont altijd de laatste stand van de bestelling.</p>
    </main>
  );
}
