"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { veiligVerder } from "@/lib/verder";
import Inlogkader from "./Inlogkader";

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
    <Inlogkader>
        <div>
          <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>Inloggen</h2>
          <p className="t-sub" style={{ marginBottom: 22 }}>Gebruik het account van je werk.</p>
          <div className="t-stapel" style={{ gap: 10 }}>
            <button type="button" className="t-knop" style={{ height: 46, fontSize: 14.5 }} onClick={() => via("azure")}>Verder met Microsoft</button>
            <button type="button" className="t-knop" style={{ height: 46, fontSize: 14.5 }} onClick={() => via("google")}>Verder met Google</button>
          </div>
          <div className="t-stil" style={{ margin: "22px 0 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, height: 1, background: "var(--t-rand-2)" }} />
            {metWachtwoord ? "Of met je wachtwoord" : "Of met een link per mail"}
            <span style={{ flex: 1, height: 1, background: "var(--t-rand-2)" }} />
          </div>
          {metWachtwoord ? (
            <form onSubmit={viaWachtwoord} className="t-stapel" style={{ gap: 10 }}>
              <label><span className="t-label">E-mailadres</span><input className="t-veld" style={{ height: 44 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoComplete="username" /></label>
              <label><span className="t-label">Wachtwoord</span><input className="t-veld" style={{ height: 44 }} type="password" required value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} autoComplete="current-password" /></label>
              <button type="submit" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5 }} disabled={status === "bezig"}>{status === "bezig" ? "Bezig…" : "Inloggen"}</button>
            </form>
          ) : status === "verstuurd" ? (
            <p className="t-melding ok">Kijk in je mailbox: we stuurden een link naar {email}. Niets gekregen? Kijk ook bij spam.</p>
          ) : (
            <form onSubmit={viaMail} className="t-stapel" style={{ gap: 10 }}>
              <label><span className="t-label">E-mailadres</span><input className="t-veld" style={{ height: 44 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoComplete="email" /></label>
              <button type="submit" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5 }} disabled={status === "bezig"}>{status === "bezig" ? "Bezig…" : "Stuur me een inloglink"}</button>
            </form>
          )}
          <button type="button" onClick={() => { setMetWachtwoord(!metWachtwoord); setFout(""); }}
            style={{ border: 0, background: "none", padding: "14px 0 0", color: "var(--t-blauw-donker)", cursor: "pointer", font: "inherit", fontSize: 13.5 }}>
            {metWachtwoord ? "Liever een link per mail" : "Liever met een wachtwoord"}
          </button>
          {fout && <p className="t-melding fout" style={{ marginTop: 16 }}>{fout}</p>}
        </div>
    </Inlogkader>
  );
}
