"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Backup = { id: string; op: string; soort: string; bytes: number; tabellen: Record<string, number> };

const wanneer = (d: string) => new Date(d).toLocaleString("nl-BE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const mb = (b: number) => `${(b / 1048576).toLocaleString("nl-BE", { maximumFractionDigits: 1 })} MB`;

// Eigen backups: elke nacht automatisch, en met de hand voor een grote wijziging. Downloaden bewaart een kopie buiten de databank.
export default function Backups({ begin }: { begin: Backup[] }) {
  const [lijst, setLijst] = useState(begin);
  const [bezig, setBezig] = useState("");
  const [fout, setFout] = useState("");
  const laatste = lijst[0];
  const oud = !laatste || Date.now() - new Date(laatste.op).getTime() > 36 * 3600e3;

  const maak = async () => {
    setBezig("maak"); setFout("");
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("backup_maken", { p_soort: "hand" });
    if (error) setFout(error.message);
    const { data } = await sb.rpc("platform_backups");
    if (data) setLijst(data as Backup[]);
    setBezig("");
  };
  const download = async (b: Backup) => {
    setBezig(b.id); setFout("");
    const { data, error } = await supabaseBrowser().rpc("platform_backup_inhoud", { p_id: b.id });
    setBezig("");
    if (error || !data) { setFout(error?.message || "Deze backup is niet meer beschikbaar."); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `toolen-backup-${b.op.slice(0, 16).replace(/[:T]/g, "-")}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <section className="t-kaart t-sys-vak" style={{ gridColumn: "1 / -1" }}>
      <div className="t-rij" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Backups</h2>
        <div className="t-rij" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className={`t-pil ${oud ? "let-op" : "ok"}`}>{laatste ? `Laatste: ${wanneer(laatste.op)}` : "Nog geen backup"}</span>
          <button type="button" className="t-knop klein" disabled={!!bezig} onClick={maak}>{bezig === "maak" ? "Bezig…" : "Nu een backup maken"}</button>
        </div>
      </div>
      {fout && <p className="t-melding fout">{fout}</p>}
      <p className="t-sub" style={{ margin: 0 }}>Elke nacht automatisch, in de databank zelf. Download af en toe een backup: die kopie staat dan ook buiten de databank.</p>
      {lijst.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {lijst.map((b) => (
            <li key={b.id} className="t-rij" style={{ borderTop: "1px solid var(--t-rand)", padding: "8px 0", gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{wanneer(b.op)}</b> <span className="t-stil" style={{ fontSize: 12.5 }}>· {b.soort === "auto" ? "Automatisch" : "Met de hand"} · {mb(b.bytes)} · {b.tabellen.plannen ?? 0} plannen, {b.tabellen.items ?? 0} items, {b.tabellen.bibliotheek ?? 0} elementen</span>
              </span>
              <button type="button" className="t-knop klein" disabled={!!bezig} onClick={() => download(b)}>{bezig === b.id ? "Ophalen…" : "Download"}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
