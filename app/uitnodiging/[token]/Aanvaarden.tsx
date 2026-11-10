"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { orgAdres } from "@/lib/adres";
import { beleidFout } from "@/lib/wachtwoord";
import WachtwoordVeld from "@/components/WachtwoordVeld";

// Al ingelogd met het juiste adres: enkel aanvaarden.
export default function Aanvaarden({ token }: { token: string }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  async function ja() {
    setBezig(true); setFout("");
    const { data, error } = await supabaseBrowser().rpc("uitnodiging_aanvaarden", { p_token: token });
    if (error) { setFout(error.message); setBezig(false); return; }
    window.location.href = orgAdres((data as { slug: string }).slug);
  }
  return (
    <>
      <button className="t-knop hoofd" onClick={ja} disabled={bezig}>{bezig ? "Bezig…" : "Uitnodiging aanvaarden"}</button>
      {fout && <p className="t-melding fout" style={{ marginTop: 12 }}>{fout}</p>}
    </>
  );
}

// Nog geen account: naam en wachtwoord kiezen. Daarna meteen inloggen; de organisatie vraagt dan de tweede stap.
export function AccountMaken({ token, email, naam: start, slug }: { token: string; email: string; naam: string | null; slug: string }) {
  const [naam, setNaam] = useState(start || "");
  const [pw, setPw] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  async function maak(e: React.FormEvent) {
    e.preventDefault();
    const f = beleidFout(pw, email);
    if (f) { setFout(f); return; }
    setBezig(true); setFout("");
    const r = await fetch("/api/uitnodiging/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, naam, wachtwoord: pw }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setFout(j.fout || "Er liep iets mis. Probeer opnieuw."); setBezig(false); return; }
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: pw });
    if (error) { window.location.href = `/login?code=${slug}`; return; }
    try { localStorage.setItem("toolen_code", slug); } catch {}
    window.location.href = orgAdres(slug);
  }

  return (
    <form onSubmit={maak} className="t-stapel" style={{ gap: 14 }}>
      <label><span className="t-label">Je naam</span>
        <input className="t-veld" style={{ height: 44 }} required value={naam} onChange={(e) => setNaam(e.target.value)} autoComplete="name" placeholder="Voornaam Achternaam" />
      </label>
      <label><span className="t-label">E-mailadres</span>
        <input className="t-veld" style={{ height: 44, background: "var(--t-vlak, #F3F5F8)" }} value={email} readOnly autoComplete="username" />
      </label>
      <WachtwoordVeld waarde={pw} onWaarde={setPw} email={email} />
      <button type="submit" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5 }} disabled={bezig}>{bezig ? "Bezig…" : "Account aanmaken"}</button>
      <p className="t-stil" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>Daarna stel je een code in op je gsm met een app zoals Microsoft Authenticator of Google Authenticator. Hou je gsm bij de hand.</p>
      {fout && <p className="t-melding fout" style={{ margin: 0 }} role="alert">{fout}</p>}
    </form>
  );
}
