"use client";

import { useState } from "react";

type Ev = { id: string; naam: string; datum: string | null };

// Toegang tot evenementen: alle, of enkel gekozen. Eigenaars en beheerders zien altijd alles.
export function Toegang({ ids, events, kaal }: { ids: string[] | null; events: Ev[]; kaal?: boolean }) {
  if (!ids?.length) return kaal ? <>Alle evenementen</> : <span className="t-stil">Alle evenementen</span>;
  const namen = ids.map((id) => events.find((e) => e.id === id)?.naam).filter(Boolean) as string[];
  const tekst = namen.length <= 2 ? namen.join(", ") : `${namen.length} evenementen`;
  return kaal ? <>{tekst}</> : <span title={namen.join(", ")}>{tekst}</span>;
}

export function ToegangKiezer({ events, ids, onIds }: { events: Ev[]; ids: string[] | null; onIds: (ids: string[] | null) => void }) {
  const beperkt = ids !== null;
  const jaar = (d: string | null) => (d ? new Date(d).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "");
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="t-label">Toegang</legend>
      <div className="t-rij" style={{ gap: 18, flexWrap: "wrap", fontSize: 13.5 }}>
        <label className="t-rij" style={{ gap: 6 }}><input type="radio" checked={!beperkt} onChange={() => onIds(null)} />Alle evenementen</label>
        <label className="t-rij" style={{ gap: 6 }}><input type="radio" checked={beperkt} onChange={() => onIds(ids || [])} />Enkel gekozen evenementen</label>
      </div>
      {beperkt && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "6px 16px", maxHeight: 220, overflowY: "auto" }}>
          {events.map((e) => (
            <label key={e.id} className="t-rij" style={{ gap: 8, fontSize: 13.5, alignItems: "flex-start" }}>
              <input type="checkbox" style={{ marginTop: 3 }} checked={ids!.includes(e.id)} onChange={() => onIds(ids!.includes(e.id) ? ids!.filter((x) => x !== e.id) : [...ids!, e.id])} />
              <span>{e.naam}{e.datum && <span className="t-stil" style={{ display: "block", fontSize: 12 }}>{jaar(e.datum)}</span>}</span>
            </label>
          ))}
        </div>
      )}
      {beperkt && !ids!.length && <p className="t-stil" style={{ fontSize: 12.5, margin: "8px 0 0" }}>Kies minstens één evenement, anders geldt toegang tot alle evenementen.</p>}
    </fieldset>
  );
}

export const WERKPLEKKEN: { id: string; naam: string; module: string | null }[] = [
  { id: "sign", naam: "Signalisatie", module: "signalisatie" },
  { id: "stroom", naam: "Stroom", module: "stroom" },
  { id: "veiligheid", naam: "Veiligheid", module: "veiligheid" },
  { id: "branding", naam: "Branding", module: "branding" },
  { id: "tv", naam: "TV", module: null },
];
export const werkplekNamen = (ids: string[] | null) => (ids?.length ? ids.map((id) => WERKPLEKKEN.find((w) => w.id === id)?.naam || id).join(", ") : null);

// Wat een bewerker mag wijzigen: alles, of enkel de items en instellingen van gekozen werkplekken.
export function WerkplekKiezer({ ids, onIds, modules }: { ids: string[] | null; onIds: (ids: string[] | null) => void; modules: string[] }) {
  const beperkt = ids !== null;
  const lijst = WERKPLEKKEN.filter((w) => !w.module || modules.includes(w.module));
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="t-label">Mag wijzigen</legend>
      <div className="t-rij" style={{ gap: 18, flexWrap: "wrap", fontSize: 13.5 }}>
        <label className="t-rij" style={{ gap: 6 }}><input type="radio" checked={!beperkt} onChange={() => onIds(null)} />Het hele plan</label>
        <label className="t-rij" style={{ gap: 6 }}><input type="radio" checked={beperkt} onChange={() => onIds(ids || [])} />Enkel gekozen werkplekken</label>
      </div>
      {beperkt && (
        <div className="t-rij" style={{ gap: 18, flexWrap: "wrap", fontSize: 13.5, marginTop: 10 }}>
          {lijst.map((w) => (
            <label key={w.id} className="t-rij" style={{ gap: 6 }}>
              <input type="checkbox" checked={ids!.includes(w.id)} onChange={() => onIds(ids!.includes(w.id) ? ids!.filter((x) => x !== w.id) : [...ids!, w.id])} />{w.naam}
            </label>
          ))}
        </div>
      )}
      <p className="t-stil" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
        {beperkt ? (ids!.length ? "Ziet het hele plan, maar wijzigt enkel de items en instellingen van deze werkplekken. Bv. de elektricien: enkel Stroom." : "Kies minstens één werkplek, anders mag hij het hele plan wijzigen.") : "Bv. een elektricien beperk je tot Stroom: hij ziet alles, maar wijzigt enkel kasten, kabels en verbruikers."}
      </p>
    </fieldset>
  );
}

// Toegang van een bestaand lid wijzigen: eerst kiezen, dan bewaren.
export function ToegangBewerken({ events, ids, wpl, metWpl, modules, onBewaar }: { events: Ev[]; ids: string[] | null; wpl: string[] | null; metWpl: boolean; modules: string[]; onBewaar: (ids: string[] | null, wpl: string[] | null) => void }) {
  const [keuze, setKeuze] = useState<string[] | null>(ids);
  const [wp, setWp] = useState<string[] | null>(wpl);
  return (
    <div className="t-stapel" style={{ gap: 14, padding: "6px 0" }}>
      {events.length > 0 && <ToegangKiezer events={events} ids={keuze} onIds={setKeuze} />}
      {metWpl && <WerkplekKiezer ids={wp} onIds={setWp} modules={modules} />}
      <div><button className="t-knop klein hoofd" onClick={() => onBewaar(keuze?.length ? keuze : null, wp?.length ? wp : null)}>Bewaren</button></div>
    </div>
  );
}
