"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { centraalAdres } from "@/lib/adres";

// Tweede stap bij het inloggen: een code van 6 cijfers uit een app (Microsoft Authenticator,
// Google Authenticator, 1Password …). Eerst instellen met een QR-code, daarna bij elke aanmelding met wachtwoord.
export default function MfaScherm({ stap, reden }: { stap: "code" | "instellen"; reden?: string }) {
  const [factor, setFactor] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [geheim, setGeheim] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data, error } = await sb.auth.mfa.listFactors();
      if (error) { setFout(error.message); return; }
      const klaar = data.totp.find((f) => f.status === "verified");
      if (klaar) { setFactor(klaar.id); return; }
      // Een half ingestelde code van een vorige poging eerst weg.
      for (const f of data.all.filter((x) => x.factor_type === "totp" && x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: f.id });
      const r = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Toolen ${new Date().toISOString().slice(0, 10)}` });
      if (r.error) { setFout(r.error.message); return; }
      setFactor(r.data.id); setQr(r.data.totp.qr_code); setGeheim(r.data.totp.secret);
    })();
  }, []);

  async function bevestig(e: React.FormEvent) {
    e.preventDefault();
    if (!factor || code.replace(/\D/g, "").length !== 6) return;
    setBezig(true); setFout("");
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: factor, code: code.replace(/\D/g, "") });
    if (error) { setFout(error.message.includes("Invalid") ? "Die code klopt niet. Kijk of de klok van je gsm juist staat en probeer de volgende code." : error.message); setBezig(false); return; }
    window.location.reload();
  }
  async function afmelden() {
    await supabaseBrowser().auth.signOut();
    window.location.href = centraalAdres("/login");
  }

  const instellen = stap === "instellen" || !!qr;
  return (
    <div>
      <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>{instellen ? "Tweestapsverificatie instellen" : "Code uit je app"}</h2>
      <p className="t-sub" style={{ marginBottom: 18 }}>
        {reden || (instellen
          ? "Wie met een wachtwoord inlogt, geeft ook een code uit een app op de gsm. Zo kan niemand anders met je wachtwoord binnen."
          : "Geef de code van 6 cijfers uit je app (bv. Microsoft Authenticator of Google Authenticator).")}
      </p>
      {instellen && (
        <ol className="t-stapel" style={{ gap: 10, paddingLeft: 18, margin: "0 0 16px", fontSize: 14, lineHeight: 1.5 }}>
          <li>Open een app voor codes op je gsm, bv. Microsoft Authenticator, Google Authenticator of 1Password.</li>
          <li>Scan deze QR-code met die app.
            <div style={{ marginTop: 10, width: 180, height: 180, background: "#fff", border: "1px solid var(--t-rand)", borderRadius: 8, display: "grid", placeItems: "center" }}>
              {qr ? <img src={qr} alt="QR-code om tweestapsverificatie in te stellen" width={164} height={164} /> : <span className="t-stil">Laden…</span>}
            </div>
            {geheim && <p className="t-stil" style={{ fontSize: 12.5, marginTop: 6, wordBreak: "break-all" }}>Lukt scannen niet? Typ deze sleutel: <code>{geheim}</code></p>}
          </li>
          <li>Typ hieronder de code die de app toont.</li>
        </ol>
      )}
      <form onSubmit={bevestig} className="t-stapel" style={{ gap: 10 }}>
        <label><span className="t-label">Code</span>
          <input className="t-veld" style={{ height: 48, fontSize: 22, letterSpacing: "0.3em", fontFamily: "var(--font-mono, monospace)" }} inputMode="numeric" autoComplete="one-time-code" autoFocus
            maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
        </label>
        <button type="submit" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5 }} disabled={bezig || !factor || code.replace(/\D/g, "").length !== 6}>{bezig ? "Bezig…" : "Bevestigen"}</button>
      </form>
      {fout && <p className="t-melding fout" style={{ marginTop: 14 }}>{fout}</p>}
      <button type="button" onClick={afmelden} style={{ border: 0, background: "none", padding: "14px 0 0", color: "var(--t-blauw-donker)", cursor: "pointer", font: "inherit", fontSize: 13.5 }}>Afmelden</button>
      <p className="t-stil" style={{ fontSize: 12.5, marginTop: 14 }}>Gsm kwijt? Vraag de beheerder van Toolen om je tweestapsverificatie te wissen.</p>
    </div>
  );
}
