"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { veiligVerder } from "@/lib/verder";
import { orgAdres } from "@/lib/adres";
import { geldigeSlug, subdomein } from "@/lib/org";
import Inlogkader from "./Inlogkader";

type Info = { code: string; naam: string | null; sso: ("azure" | "google")[] };
const ALGEMEEN = "Bedrijfscode, e-mailadres of wachtwoord klopt niet.";
const ONTHOUD = "toolen_code";

// Bedrijfscode uit het adres: ?code=, het subdomein waar je naartoe gaat, of de organisatie van een preview.
function codeUitAdres(code: string | null, verder: string): string | null {
  if (geldigeSlug(code?.toLowerCase())) return code!.toLowerCase();
  try { const s = subdomein(new URL(verder).host); if (geldigeSlug(s)) return s; } catch {}
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)toolen_org=([^;]+)/) : null;
  return m && geldigeSlug(m[1]) ? m[1] : null;
}

// Inloggen met bedrijfscode, e-mailadres en wachtwoord. Daarna altijd de code uit de app.
// Microsoft en Google enkel als de organisatie die heeft (grote klanten).
export default function InlogScherm() {
  const zoek = useSearchParams();
  const verder = veiligVerder(zoek.get("verder"));
  const [code, setCode] = useState("");
  const [vast, setVast] = useState(false); // code uit het adres: niet te typen
  const [info, setInfo] = useState<Info | null>(null);
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [zien, setZien] = useState(false);
  const [modus, setModus] = useState<"inloggen" | "vergeten" | "verstuurd">("inloggen");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(zoek.get("fout") || "");
  const [melding, setMelding] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const uitAdres = codeUitAdres(zoek.get("code"), verder);
    let onthouden = ""; try { onthouden = localStorage.getItem(ONTHOUD) || ""; } catch {}
    const c = uitAdres || onthouden;
    if (c) { setCode(c.toUpperCase()); setVast(!!uitAdres); setTimeout(() => emailRef.current?.focus(), 50); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Naam en SSO van het bedrijf ophalen (rustig, na het typen).
  useEffect(() => {
    const c = code.trim().toLowerCase();
    if (!geldigeSlug(c)) { setInfo(null); return; }
    const t = setTimeout(() => {
      supabaseBrowser().rpc("inlog_info", { p_code: c }).then(({ data }) => setInfo((data as Info) || null));
    }, 250);
    return () => clearTimeout(t);
  }, [code]);

  const doel = (slug: string) => (verder && verder !== "/kies" ? verder : orgAdres(slug));

  async function inloggen(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toLowerCase();
    if (!geldigeSlug(c)) { setFout("Vul je bedrijfscode in, bv. FLCS. Je vindt ze in je uitnodiging."); return; }
    setBezig(true); setFout("");
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: wachtwoord });
    if (error) {
      setFout(error.status === 429 ? "Te veel pogingen. Wacht een paar minuten en probeer opnieuw." : ALGEMEEN);
      setBezig(false); return;
    }
    const { data: slug } = await sb.rpc("lid_van_code", { p_code: c });
    if (!slug) { await sb.auth.signOut(); setFout(ALGEMEEN); setBezig(false); return; }
    try { localStorage.setItem(ONTHOUD, c); } catch {}
    window.location.href = doel(slug as string);
  }

  async function vergeten(e: React.FormEvent) {
    e.preventDefault();
    setBezig(true); setFout("");
    const r = await fetch("/api/wachtwoord/vergeten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
    const j = await r.json().catch(() => ({}));
    setMelding(j.melding || "Als dit adres bij ons gekend is, krijg je een mail.");
    setModus("verstuurd"); setBezig(false);
  }

  async function sso(provider: "azure" | "google") {
    setFout("");
    try { localStorage.setItem(ONTHOUD, code.trim().toLowerCase()); } catch {}
    const terug = `${window.location.origin}/auth/callback?verder=${encodeURIComponent(doel(code.trim().toLowerCase()))}`;
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider, options: { redirectTo: terug, scopes: provider === "azure" ? "email openid profile" : undefined } });
    if (error) setFout(error.message);
  }

  const link = { border: 0, background: "none", padding: 0, color: "var(--t-blauw-donker)", cursor: "pointer", font: "inherit", fontSize: 13.5 } as const;

  if (modus !== "inloggen") {
    return (
      <Inlogkader>
        <div>
          <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>Wachtwoord vergeten</h2>
          {modus === "verstuurd" ? (
            <p className="t-melding ok" style={{ marginTop: 16 }}>{melding} Niets gekregen? Kijk ook bij ongewenste mail.</p>
          ) : (
            <>
              <p className="t-sub" style={{ marginBottom: 22 }}>Geef je e-mailadres. Je krijgt een link om een nieuw wachtwoord te kiezen.</p>
              <form onSubmit={vergeten} className="t-stapel" style={{ gap: 12 }}>
                <label><span className="t-label">E-mailadres</span><input className="t-veld" style={{ height: 44 }} type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoComplete="email" /></label>
                <button type="submit" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5 }} disabled={bezig}>{bezig ? "Bezig…" : "Stuur me een link"}</button>
              </form>
            </>
          )}
          <p style={{ marginTop: 18 }}><button type="button" style={link} onClick={() => { setModus("inloggen"); setFout(""); }}>Terug naar inloggen</button></p>
        </div>
      </Inlogkader>
    );
  }

  return (
    <Inlogkader>
      <div>
        <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>Inloggen</h2>
        <p className="t-sub" style={{ marginBottom: 22 }}>{vast && info?.naam ? <>Bij <strong>{info.naam}</strong></> : "Met de bedrijfscode uit je uitnodiging."}</p>
        <form onSubmit={inloggen} className="t-stapel" style={{ gap: 12 }}>
          {!vast && (
            <label><span className="t-label">Bedrijfscode</span>
              <input className="t-veld" style={{ height: 44, textTransform: "uppercase", letterSpacing: ".04em" }} required value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                placeholder="Bv. FLCS" autoComplete="organization" autoCapitalize="characters" spellCheck={false} autoFocus={!code} maxLength={30} />
              {info?.naam && <span className="t-stil" style={{ display: "block", fontSize: 12.5, marginTop: 5 }}>{info.naam}</span>}
            </label>
          )}
          <label><span className="t-label">E-mailadres</span>
            <input ref={emailRef} className="t-veld" style={{ height: 44 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.be" autoComplete="username" />
          </label>
          <label>
            <span className="t-label" style={{ display: "flex", justifyContent: "space-between" }}>Wachtwoord
              <button type="button" style={{ ...link, fontSize: 12.5 }} onClick={() => { setModus("vergeten"); setFout(""); }}>Wachtwoord vergeten?</button>
            </span>
            <span style={{ position: "relative", display: "block" }}>
              <input className="t-veld" style={{ height: 44, paddingRight: 74, width: "100%" }} type={zien ? "text" : "password"} required value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setZien(!zien)} aria-pressed={zien} style={{ ...link, position: "absolute", right: 12, top: 0, height: 44, fontSize: 12.5 }}>{zien ? "Verbergen" : "Tonen"}</button>
            </span>
          </label>
          <button type="submit" className="t-knop hoofd" style={{ height: 46, fontSize: 14.5, marginTop: 4 }} disabled={bezig}>{bezig ? "Bezig…" : "Inloggen"}</button>
        </form>
        {fout && <p className="t-melding fout" style={{ marginTop: 16 }} role="alert">{fout}</p>}

        {!!info?.sso?.length && (
          <>
            <div className="t-stil" style={{ margin: "22px 0 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, height: 1, background: "var(--t-rand-2)" }} />Of met het account van je werk<span style={{ flex: 1, height: 1, background: "var(--t-rand-2)" }} />
            </div>
            <div className="t-stapel" style={{ gap: 10 }}>
              {info.sso.includes("azure") && <button type="button" className="t-knop" style={{ height: 46, fontSize: 14.5 }} onClick={() => sso("azure")}>Verder met Microsoft</button>}
              {info.sso.includes("google") && <button type="button" className="t-knop" style={{ height: 46, fontSize: 14.5 }} onClick={() => sso("google")}>Verder met Google</button>}
            </div>
          </>
        )}

        <p className="t-stil" style={{ fontSize: 12.5, marginTop: 22, lineHeight: 1.5 }}>
          {vast ? <>Ander bedrijf? <button type="button" style={{ ...link, fontSize: 12.5 }} onClick={() => { setVast(false); setCode(""); setInfo(null); }}>Andere bedrijfscode</button>. </> : null}
          Nog geen account? Vraag de beheerder van je bedrijf om je uit te nodigen.
        </p>
      </div>
    </Inlogkader>
  );
}
