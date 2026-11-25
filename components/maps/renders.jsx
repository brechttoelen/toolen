'use client';

// 3D-renders bij een item: links naar een interactieve viewer (bv. een Claude-artifact).
// Bewaard in item.velden.renders = [{ naam, url }]; geen bestanden in de bucket.
import { vraagTekst, bevestig } from './dialoog';

const veilig = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };

export function RenderLijst({ renders }) {
  const lijst = (renders || []).filter((r) => veilig(r?.url));
  if (!lijst.length) return null;
  return (
    <div className="fm-stplan compact">
      {lijst.map((r) => (
        <div key={r.url} className="fm-stplan-rij">
          <a href={veilig(r.url)} target="_blank" rel="noreferrer" title="3D-render openen">🧊 {r.naam || '3D-render'}</a>
        </div>
      ))}
    </div>
  );
}

export function RendersBewerken({ renders, ro, onZet }) {
  const lijst = (renders || []).filter((r) => veilig(r?.url));
  const voegToe = async () => {
    const url = veilig(String((await vraagTekst('Link naar de 3D-render (https://…)', '')) || '').trim());
    if (!url) return;
    const naam = String((await vraagTekst('Naam van de render', '3D-render')) || '').trim() || '3D-render';
    onZet([...lijst, { naam, url }]);
  };
  return (
    <div className="fm-stplan compact">
      {lijst.map((r) => (
        <div key={r.url} className="fm-stplan-rij">
          <a href={veilig(r.url)} target="_blank" rel="noreferrer" title="3D-render openen">🧊 {r.naam || '3D-render'}</a>
          {!ro && <button type="button" aria-label="Render weghalen" onClick={async () => { if (!(await bevestig(`"${r.naam || '3D-render'}" weghalen?`))) return; const rest = lijst.filter((x) => x.url !== r.url); onZet(rest.length ? rest : null); }}>×</button>}
        </div>
      ))}
      {!lijst.length && <div className="fm-sub">Nog geen 3D-render gekoppeld.</div>}
      {!ro && <button type="button" className="fm-knop klein" onClick={voegToe}>+ Render koppelen</button>}
    </div>
  );
}
