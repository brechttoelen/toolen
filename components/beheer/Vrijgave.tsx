"use client";

import { useEffect, useState } from "react";

type Wijziging = { sha: string; tekst: string; op: string };
type Stand = { live: string; test: string; wachtend: Wijziging[]; achter: number; controle: "ok" | "bezig" | "mislukt" | "onbekend"; vorige: string | null; kanTerug: boolean };

const CONTROLE = { ok: ["ok", "Controle geslaagd"], bezig: ["let-op", "Controle loopt"], mislukt: ["fout", "Controle mislukt"], onbekend: ["", "Nog geen controle"] } as const;
const wanneer = (d: string) => new Date(d).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Updates: wat in de testomgeving klaarstaat, vrijgeven voor alle klanten, of terug naar de vorige versie.
export default function Vrijgave({ repo, testAdres }: { repo: string; testAdres: string }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [ingesteld, setIngesteld] = useState<boolean | null>(null);
  const [fout, setFout] = useState("");
  const [melding, setMelding] = useState("");
  const [bezig, setBezig] = useState("");
  const [zeker, setZeker] = useState<"" | "vrijgeven" | "terugzetten">("");

  const laad = async () => {
    try {
      const r = await fetch("/api/platform/update", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { setFout(d.fout || "Laden mislukt."); return; }
      setIngesteld(!!d.ingesteld); setStand(d.stand || null); setFout("");
    } catch { setFout("Geen verbinding."); }
  };
  useEffect(() => { laad(); }, []);

  const doe = async (actie: "vrijgeven" | "terugzetten") => {
    setBezig(actie); setFout(""); setMelding(""); setZeker("");
    try {
      const r = await fetch("/api/platform/update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actie, test: stand?.test }) });
      const d = await r.json();
      if (!r.ok) { setFout(d.fout || "Niet gelukt."); return; }
      setStand(d.stand);
      setMelding(actie === "vrijgeven" ? "Vrijgegeven. De nieuwe versie staat binnen enkele minuten bij alle klanten." : "Teruggezet. De vorige versie staat binnen enkele minuten weer bij alle klanten.");
    } catch { setFout("Geen verbinding."); } finally { setBezig(""); }
  };

  return (
    <section className="t-kaart t-sys-vak" style={{ gridColumn: "1 / -1" }}>
      <div className="t-rij" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Updates</h2>
        <div className="t-rij" style={{ gap: 8, flexWrap: "wrap" }}>
          <a className="t-knop klein" href={testAdres} target="_blank" rel="noreferrer">Testomgeving openen</a>
          <button type="button" className="t-knop klein" onClick={laad}>Vernieuwen</button>
        </div>
      </div>
      {fout && <p className="t-melding fout">{fout}</p>}
      {melding && <p className="t-melding ok">{melding}</p>}
      {ingesteld === false && (
        <p className="t-sub" style={{ margin: 0 }}>Nog niet ingesteld. Zet in Vercel de omgevingsvariabele <code>TOOLEN_GITHUB_TOKEN</code> (een GitHub-sleutel met schrijfrecht op de inhoud van deze repository) en bouw opnieuw.</p>
      )}
      {ingesteld && stand && (
        <>
          <dl className="t-sys-feiten">
            <dt>Bij klanten</dt><dd><a href={`https://github.com/${repo}/commit/${stand.live}`} target="_blank" rel="noreferrer"><code>{stand.live.slice(0, 7)}</code></a></dd>
            <dt>In test</dt><dd><a href={`https://github.com/${repo}/commit/${stand.test}`} target="_blank" rel="noreferrer"><code>{stand.test.slice(0, 7)}</code></a> <span className={`t-pil ${CONTROLE[stand.controle][0]}`}>{CONTROLE[stand.controle][1]}</span></dd>
          </dl>
          {stand.wachtend.length ? (
            <>
              <p className="t-sub" style={{ margin: 0 }}>{stand.wachtend.length} {stand.wachtend.length === 1 ? "wijziging wacht" : "wijzigingen wachten"} in de testomgeving:</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                {stand.wachtend.map((w) => <li key={w.sha}>{w.tekst} <span className="t-stil" style={{ fontSize: 12.5 }}>· {wanneer(w.op)}</span></li>)}
              </ul>
            </>
          ) : <p className="t-sub" style={{ margin: 0 }}>Klanten hebben de nieuwste versie. Er wacht niets in de testomgeving.</p>}
          <div className="t-rij" style={{ gap: 8, flexWrap: "wrap" }}>
            {zeker === "" && (
              <>
                <button type="button" className="t-knop hoofd" disabled={!stand.wachtend.length || stand.controle !== "ok" || !!bezig} onClick={() => setZeker("vrijgeven")}>{bezig === "vrijgeven" ? "Vrijgeven…" : "Update vrijgeven"}</button>
                <button type="button" className="t-knop" disabled={!stand.kanTerug || !!bezig} onClick={() => setZeker("terugzetten")}>{bezig === "terugzetten" ? "Terugzetten…" : "Terug naar de vorige versie"}</button>
              </>
            )}
            {zeker !== "" && (
              <>
                <span style={{ alignSelf: "center" }}>{zeker === "vrijgeven" ? `${stand.wachtend.length} ${stand.wachtend.length === 1 ? "wijziging" : "wijzigingen"} vrijgeven voor alle klanten?` : "Alle klanten terug naar de vorige versie?"}</span>
                <button type="button" className="t-knop hoofd" onClick={() => doe(zeker)}>Ja, {zeker}</button>
                <button type="button" className="t-knop" onClick={() => setZeker("")}>Annuleren</button>
              </>
            )}
          </div>
          {stand.wachtend.length > 0 && stand.controle !== "ok" && <p className="t-stil" style={{ margin: 0, fontSize: 12.5 }}>Vrijgeven kan zodra de automatische controle van de testversie geslaagd is.</p>}
          <p className="t-stil" style={{ margin: 0, fontSize: 12.5 }}>Wijzigingen aan de databank gaan niet mee met deze knop: die worden apart op de databank van de klanten uitgevoerd bij het vrijgeven.</p>
        </>
      )}
    </section>
  );
}
