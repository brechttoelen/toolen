"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Kaartbron = { bron: string; naam: string; soort: string; ok: boolean; status: number | null; ms: number | null; fout: string | null; gecontroleerd_op: string; faalt_sinds: string | null };

const wanneer = (d: string) => new Date(d).toLocaleString("nl-BE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Externe kaartdiensten (luchtfoto's, stratenkaart, zoeken, route): gratis en zonder garantie. Elke dag één controle.
export default function Kaartbronnen({ begin }: { begin: Kaartbron[] }) {
  const [lijst, setLijst] = useState(begin);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const uitval = lijst.filter((b) => !b.ok);
  const laatst = lijst.reduce((m, b) => (b.gecontroleerd_op > m ? b.gecontroleerd_op : m), "");
  const oud = !laatst || Date.now() - new Date(laatst).getTime() > 36 * 3600e3;

  const controleer = async () => {
    setBezig(true); setFout("");
    try {
      const r = await fetch("/api/platform/kaartbronnen", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { fout?: string };
      if (!r.ok) setFout(j.fout || "De controle is mislukt.");
      const { data } = await supabaseBrowser().rpc("platform_kaartbronnen");
      if (data) setLijst(data as Kaartbron[]);
    } catch { setFout("De controle is mislukt."); }
    setBezig(false);
  };

  return (
    <section className="t-kaart t-sys-vak" style={{ gridColumn: "1 / -1" }}>
      <div className="t-rij" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Kaartbronnen</h2>
        <div className="t-rij" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className={`t-pil ${uitval.length || oud ? "let-op" : "ok"}`}>
            {!laatst ? "Nog niet gecontroleerd" : uitval.length ? `${uitval.length} van ${lijst.length} valt uit` : oud ? `Laatste controle: ${wanneer(laatst)}` : `Alle ${lijst.length} werken`}
          </span>
          <button type="button" className="t-knop klein" disabled={bezig} onClick={controleer}>{bezig ? "Bezig…" : "Nu controleren"}</button>
        </div>
      </div>
      {fout && <p className="t-melding fout">{fout}</p>}
      <p className="t-sub" style={{ margin: 0 }}>Luchtfoto's, stratenkaart, zoeken en route komen van externe, gratis diensten zonder garantie. Elke dag wordt van elke bron één tegel opgevraagd{laatst ? ` (laatst ${wanneer(laatst)})` : ""}.</p>
      {lijst.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {lijst.map((b) => (
            <li key={b.bron} className="t-rij" style={{ borderTop: "1px solid var(--t-rand)", padding: "8px 0", gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{b.naam}</b>
                {!b.ok && <span className="t-stil" style={{ fontSize: 12.5 }}> · {b.fout || "Werkt niet"}{b.faalt_sinds ? ` · Sinds ${wanneer(b.faalt_sinds)}` : ""}</span>}
              </span>
              {b.ok && b.ms != null && <span className="t-stil" style={{ fontSize: 12.5 }}>{(b.ms / 1000).toLocaleString("nl-BE", { maximumFractionDigits: 1 })} s</span>}
              <span className={`t-pil ${b.ok ? "ok" : "let-op"}`}>{b.ok ? "Werkt" : "Valt uit"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
