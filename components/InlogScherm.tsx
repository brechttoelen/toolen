"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { veiligVerder } from "@/lib/verder";
import { ToolenWoordmerk } from "./ToolenLogo";

// Inloggen met een link per mail, Microsoft (werk- of schoolaccount) of Google.
export default function InlogScherm() {
  const zoek = useSearchParams();
  const verder = veiligVerder(zoek.get("verder"));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"" | "bezig" | "verstuurd">("");
  const [fout, setFout] = useState(zoek.get("fout") || "");
  const [metWachtwoord, setMetWachtwoord] = useState(false);
  const [wachtwoord, setWachtwoord] = useState("");

  const terug = () => `${window.location.origin}/auth/callback?verder=${encodeURIComponent(verder)}`;

  async function viaMail(e: React.FormEvent) {
    e.preventDefault();
    setStatus("bezig"); setFout("");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: terug() } });
    if (error) { setFout(error.message); setStatus(""); } else setStatus("verstuurd");
  }

  async function viaWachtwoord(e: React.FormEvent) {
    e.preventDefault();
    setStatus("bezig"); setFout("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password: wachtwoord });
    if (error) { setFout(error.message); setStatus(""); return; }
    window.location.href = verder;
  }

  async function via(provider: "azure" | "google") {
    setFout("");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: { redirectTo: terug(), scopes: provider === "azure" ? "email openid profile" : undefined },
    });
    if (error) setFout(error.message);
  }

  return (
    <div className="t-pagina" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="t-kaart" style={{ width: "100%", maxWidth: 400, padding: 32 }}>
        <ToolenWoordmerk op="licht" product="maps" />
        <h1 className="t-titel" style={{ fontSize: 20, margin: "28px 0 20px" }}>Inloggen</h1>
        <div className="t-stapel" style={{ gap: 10 }}>
          <button type="button" className="t-knop" style={{ justifyContent: "flex-start" }} onClick={() => via("azure")}>Verder met Microsoft</button>
          <button type="button" className="t-knop" style={{ justifyContent: "flex-start" }} onClick={() => via("google")}>Verder met Google</button>
        </div>
        <div className="t-stil" style={{ margin: "24px 0 12px", fontSize: 13 }}>
          {metWachtwoord ? "of met je wachtwoord" : "of met een link per mail"}
          {" · "}
          <button type="button" onClick={() => { setMetWachtwoord(!metWachtwoord); setFout(""); }}
            style={{ border: 0, background: "none", padding: 0, color: "var(--t-blauw)", cursor: "pointer", font: "inherit" }}>
            {metWachtwoord ? "link per mail" : "wachtwoord"}
          </button>
        </div>
        {metWachtwoord ? (
          <form onSubmit={viaWachtwoord} className="t-stapel" style={{ gap: 10 }}>
            <input className="t-veld" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoComplete="username" />
            <input className="t-veld" type="password" required value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} placeholder="Wachtwoord" autoComplete="current-password" />
            <button type="submit" className="t-knop hoofd" disabled={status === "bezig"}>{status === "bezig" ? "Bezig…" : "Inloggen"}</button>
          </form>
        ) : status === "verstuurd" ? (
          <p className="t-melding ok">Kijk in je mailbox: we stuurden een link naar {email}. Niets gekregen? Kijk ook bij spam.</p>
        ) : (
          <form onSubmit={viaMail} className="t-stapel" style={{ gap: 10 }}>
            <input className="t-veld" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoComplete="email" />
            <button type="submit" className="t-knop hoofd" disabled={status === "bezig"}>{status === "bezig" ? "Bezig…" : "Stuur me een link"}</button>
          </form>
        )}
        {fout && <p className="t-melding fout" style={{ marginTop: 16 }}>{fout}</p>}
      </div>
    </div>
  );
}
