"use client";

import { useState } from "react";

// Platform: wie nog geen wachtwoord heeft (vroeger Microsoft, Google of een e-mailcode) een mail sturen.
export default function WachtwoordMails({ aantal }: { aantal: number }) {
  const [stand, setStand] = useState("");
  async function stuur() {
    if (!confirm(`${aantal} account${aantal === 1 ? "" : "s"} een mail sturen om een wachtwoord in te stellen?`)) return;
    setStand("Bezig…");
    const r = await fetch("/api/platform/wachtwoordmail", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await r.json().catch(() => ({}));
    setStand(r.ok ? `${j.verstuurd} verstuurd${j.mislukt?.length ? `, mislukt: ${j.mislukt.join(", ")}` : ""}.` : j.fout || "Mislukt.");
  }
  return (
    <div className="t-rij" style={{ gap: 10 }}>
      <button className="t-knop klein" onClick={stuur} disabled={stand === "Bezig…"}>Mail sturen om een wachtwoord in te stellen</button>
      {stand && <span className="t-stil" style={{ fontSize: 13 }}>{stand}</span>}
    </div>
  );
}
