"use client";

import { useState } from "react";
import { MIN_LENGTE, beleidFout, sterkte } from "@/lib/wachtwoord";

const WOORD = ["Te kort", "Zwak", "Redelijk", "Goed", "Sterk"];
const KLEUR = ["#B91C1C", "#D97706", "#CA8A04", "#16865C", "#0E6B48"];

// Nieuw wachtwoord met tonen/verbergen en een meter. Geen tweede keer typen: met "Tonen" zie je wat je typt.
export default function WachtwoordVeld({ waarde, onWaarde, email, label = "Kies een wachtwoord" }: { waarde: string; onWaarde: (v: string) => void; email?: string | null; label?: string }) {
  const [zien, setZien] = useState(false);
  const s = waarde.length < MIN_LENGTE ? 0 : Math.max(1, sterkte(waarde));
  const f = waarde ? beleidFout(waarde, email) : null;
  return (
    <label>
      <span className="t-label">{label}</span>
      <span style={{ position: "relative", display: "block" }}>
        <input className="t-veld" style={{ height: 44, paddingRight: 74, width: "100%" }} type={zien ? "text" : "password"} required minLength={MIN_LENGTE} value={waarde}
          onChange={(e) => onWaarde(e.target.value)} autoComplete="new-password" aria-describedby="ww-uitleg" />
        <button type="button" onClick={() => setZien(!zien)} aria-pressed={zien}
          style={{ position: "absolute", right: 12, top: 0, height: 44, border: 0, background: "none", color: "var(--t-blauw-donker)", cursor: "pointer", font: "inherit", fontSize: 12.5 }}>{zien ? "Verbergen" : "Tonen"}</button>
      </span>
      <span style={{ display: "flex", gap: 4, marginTop: 8 }} aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <i key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: waarde && s >= i ? KLEUR[s] : "var(--t-rand-2)" }} />)}
      </span>
      <span id="ww-uitleg" className="t-stil" style={{ display: "block", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
        {waarde ? (f || `${WOORD[s]}.`) : `Minstens ${MIN_LENGTE} tekens. Een zin van een paar woorden is sterk en makkelijk te onthouden.`}
      </span>
    </label>
  );
}
