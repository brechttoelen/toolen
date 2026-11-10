"use client";

import { useState } from "react";
import { beleidFout } from "@/lib/wachtwoord";
import WachtwoordVeld from "@/components/WachtwoordVeld";

export default function NieuwWachtwoord({ email, nieuw }: { email: string; nieuw: boolean }) {
  const [pw, setPw] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [klaar, setKlaar] = useState(false);

  async function bewaar(e: React.FormEvent) {
    e.preventDefault();
    const f = beleidFout(pw, email);
    if (f) { setFout(f); return; }
    setBezig(true); setFout("");
    const r = await fetch("/api/wachtwoord", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wachtwoord: pw }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setFout(j.fout || "Er liep iets mis. Probeer opnieuw."); setBezig(false); return; }
    setKlaar(true);
  }

  if (klaar) return (
    <div>
      <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>Wachtwoord bewaard</h2>
      <p className="t-sub" style={{ marginBottom: 20 }}>Vanaf nu log je in met je bedrijfscode, {email} en dit wachtwoord.</p>
      <a className="t-knop hoofd" href="/kies">Verder</a>
    </div>
  );
  return (
    <div>
      <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>{nieuw ? "Stel je wachtwoord in" : "Nieuw wachtwoord"}</h2>
      <p className="t-sub" style={{ marginBottom: 22 }}>Voor {email}.</p>
      <form onSubmit={bewaar} className="t-stapel" style={{ gap: 14 }}>
        <input type="email" value={email} readOnly hidden autoComplete="username" />
        <WachtwoordVeld waarde={pw} onWaarde={setPw} email={email} label="Nieuw wachtwoord" />
        <button type="submit" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5 }} disabled={bezig}>{bezig ? "Bezig…" : "Wachtwoord bewaren"}</button>
        {fout && <p className="t-melding fout" style={{ margin: 0 }} role="alert">{fout}</p>}
      </form>
    </div>
  );
}
