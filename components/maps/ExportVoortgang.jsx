'use client';

// Voortgang van PDF's die in een eigen tabblad gemaakt worden, rechtsonder in de editor.
// Zo werk je verder in het plan en zie je toch hoe ver de export staat.
import { useEffect, useState } from 'react';
import { EXPORT_KANAAL, exportVensters } from './planLaden';

export default function ExportVoortgang() {
  const [lijst, setLijst] = useState([]);
  useEffect(() => {
    let c; try { c = new BroadcastChannel(EXPORT_KANAAL); } catch { return undefined; }
    c.onmessage = (e) => {
      const m = e.data; if (!m?.k) return;
      setLijst((l) => { const i = l.findIndex((x) => x.k === m.k); const n = { ...(i >= 0 ? l[i] : {}), ...m, op: Date.now() }; return i >= 0 ? l.map((x, j) => (j === i ? n : x)) : [...l, n]; });
    };
    return () => c.close();
  }, []);
  // Afgewerkte exports verdwijnen na een halve minuut.
  useEffect(() => {
    if (!lijst.some((x) => x.klaar)) return undefined;
    const t = setInterval(() => setLijst((l) => l.filter((x) => !x.klaar || Date.now() - x.op < 30000)), 5000);
    return () => clearInterval(t);
  }, [lijst]);
  if (!lijst.length) return null;
  const weg = (k) => setLijst((l) => l.filter((x) => x.k !== k));
  return (
    <div className="fm-exportlade" role="status" aria-live="polite">
      {lijst.map((x) => (
        <div key={x.k} className={`fm-exportlade-rij${x.fout ? ' fout' : x.klaar ? ' klaar' : ''}`}>
          <div className="fm-exportlade-kop">
            <strong>{x.naam || 'PDF'}</strong>
            <span>{x.fout ? 'Mislukt' : x.klaar ? 'Klaar' : `${x.pct || 0} %`}</span>
            {(x.klaar || x.fout) && <button type="button" aria-label="Sluiten" onClick={() => weg(x.k)}>×</button>}
          </div>
          {!x.klaar && !x.fout && <div className="fm-exportlade-balk"><i style={{ width: `${Math.max(3, x.pct || 0)}%` }} /></div>}
          <div className="fm-exportlade-tekst">
            {x.fout ? x.fout : x.klaar ? (x.meldingen?.length ? x.meldingen.join(' ') : 'De PDF staat in je downloads.') : x.tekst}
          </div>
          {!x.klaar && !x.fout && exportVensters.get(x.k) && <button type="button" className="fm-exportlade-link" onClick={() => { try { exportVensters.get(x.k).focus(); } catch {} }}>Tabblad tonen</button>}
        </div>
      ))}
    </div>
  );
}
