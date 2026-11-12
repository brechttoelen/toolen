"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type FoutGroep = { vinger: string; laatst: string; eerst: string; aantal: number; vandaag: number; gebruikers: number; organisaties: string[] | null;
  bron: string; bericht: string; stapel: string | null; adres: string | null; versie: string | null; toestel: string | null };

const wanneer = (d: string) => new Date(d).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const toestelKort = (t: string | null) => !t ? "" : /iPhone|iPad/.test(t) ? "iPhone of iPad" : /Android/.test(t) ? "Android" : /Mac OS/.test(t) ? "Mac" : /Windows/.test(t) ? "Windows" : "Ander toestel";

// Fouten die de app zelf meldt (browser en server), per soort fout. Enkel voor platformbeheer, 30 dagen bewaard.
export default function Fouten({ begin }: { begin: FoutGroep[] }) {
  const [lijst, setLijst] = useState(begin);
  const [open, setOpen] = useState<string | null>(null);
  const [fout, setFout] = useState("");

  const weg = async (v: string) => {
    const { error } = await supabaseBrowser().rpc("platform_fout_weg", { p_vinger: v });
    if (error) { setFout(error.message); return; }
    setLijst((l) => l.filter((x) => x.vinger !== v));
  };
  const vandaag = lijst.reduce((n, f) => n + f.vandaag, 0);

  return (
    <section className="t-kaart t-sys-vak" style={{ gridColumn: "1 / -1" }}>
      <div className="t-rij" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Fouten</h2>
        <span className={`t-pil ${vandaag ? "let-op" : "ok"}`}>{vandaag ? `${vandaag} vandaag` : "Geen fouten vandaag"}</span>
      </div>
      {fout && <p className="t-melding fout">{fout}</p>}
      {!lijst.length ? <p className="t-sub" style={{ margin: 0 }}>Geen fouten gemeld in de laatste 30 dagen.</p> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {lijst.map((f) => (
            <li key={f.vinger} style={{ borderTop: "1px solid var(--t-rand)", padding: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="t-rij" style={{ gap: 10, alignItems: "flex-start" }}>
                <button type="button" onClick={() => setOpen(open === f.vinger ? null : f.vinger)} aria-expanded={open === f.vinger}
                  style={{ flex: 1, minWidth: 0, textAlign: "left", border: 0, background: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer" }}>
                  <b style={{ display: "block", overflowWrap: "anywhere" }}>{f.bericht}</b>
                  <span className="t-stil" style={{ fontSize: 12.5 }}>
                    {[`${f.aantal}×`, f.gebruikers ? `${f.gebruikers} ${f.gebruikers === 1 ? "gebruiker" : "gebruikers"}` : null, f.organisaties?.join(", "), f.bron === "server" ? "Server" : toestelKort(f.toestel), f.adres, `laatst ${wanneer(f.laatst)}`, f.versie ? `versie ${f.versie}` : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <button type="button" className="t-knop klein" onClick={() => weg(f.vinger)}>Opgelost</button>
              </div>
              {open === f.vinger && (
                <pre style={{ margin: 0, padding: 12, background: "var(--t-vlak)", borderRadius: 6, fontSize: 12, lineHeight: 1.5, overflowX: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {[f.stapel || "Geen plek in de code bekend.", "", `Eerst gezien ${wanneer(f.eerst)}`, f.toestel].filter((x) => x != null).join("\n")}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
