"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { veiligVerder } from "@/lib/verder";

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

  const knop: React.CSSProperties = { width: "100%", padding: "11px 14px", border: "1px solid #d6d6d3", background: "#fff", fontSize: 15, cursor: "pointer", textAlign: "left" };

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "96px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 24px" }}>Inloggen bij Toolen</h1>
      <div style={{ display: "grid", gap: 10 }}>
        <button type="button" style={knop} onClick={() => via("azure")}>Verder met Microsoft</button>
        <button type="button" style={knop} onClick={() => via("google")}>Verder met Google</button>
      </div>
      <div style={{ margin: "24px 0 12px", color: "#888", fontSize: 13 }}>
        {metWachtwoord ? "of met je wachtwoord" : "of met een link per mail"}
        {" · "}
        <button type="button" onClick={() => { setMetWachtwoord(!metWachtwoord); setFout(""); }}
          style={{ border: 0, background: "none", padding: 0, color: "#555", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>
          {metWachtwoord ? "link per mail" : "wachtwoord"}
        </button>
      </div>
      {metWachtwoord ? (
        <form onSubmit={viaWachtwoord} style={{ display: "grid", gap: 10 }}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoComplete="username"
            style={{ padding: "11px 12px", border: "1px solid #d6d6d3", fontSize: 15 }} />
          <input type="password" required value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} placeholder="Wachtwoord" autoComplete="current-password"
            style={{ padding: "11px 12px", border: "1px solid #d6d6d3", fontSize: 15 }} />
          <button type="submit" disabled={status === "bezig"} style={{ ...knop, background: "#1d1d1b", color: "#fff", border: 0, textAlign: "center" }}>
            {status === "bezig" ? "Bezig…" : "Inloggen"}
          </button>
        </form>
      ) : status === "verstuurd" ? (
        <p>Kijk in je mailbox: we stuurden een link naar {email}.</p>
      ) : (
        <form onSubmit={viaMail} style={{ display: "grid", gap: 10 }}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be"
            style={{ padding: "11px 12px", border: "1px solid #d6d6d3", fontSize: 15 }} />
          <button type="submit" disabled={status === "bezig"} style={{ ...knop, background: "#1d1d1b", color: "#fff", border: 0, textAlign: "center" }}>
            {status === "bezig" ? "Bezig…" : "Stuur me een link"}
          </button>
        </form>
      )}
      {fout && <p style={{ color: "#B91C1C", marginTop: 16 }}>{fout}</p>}
    </main>
  );
}
