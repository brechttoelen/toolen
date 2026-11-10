"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { veiligVerder } from "@/lib/verder";

export default function Account({ email, naam: start, verder }: { email: string; naam: string; verder: string }) {
  const [naam, setNaam] = useState(start);
  const [stand, setStand] = useState<{ soort: "ok" | "fout"; tekst: string } | null>(null);
  const [bezig, setBezig] = useState(false);
  async function bewaar(e: React.FormEvent) {
    e.preventDefault();
    const n = naam.trim();
    if (n.length < 2) { setStand({ soort: "fout", tekst: "Vul je naam in." }); return; }
    setBezig(true); setStand(null);
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("profielen").update({ naam: n }).eq("id", u.user?.id || "");
    if (!error) await sb.auth.updateUser({ data: { full_name: n } });
    setStand(error ? { soort: "fout", tekst: error.message } : { soort: "ok", tekst: "Bewaard." });
    setBezig(false);
  }
  return (
    <div>
      <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>Mijn account</h2>
      <p className="t-sub" style={{ marginBottom: 22 }}>{email}</p>
      <form onSubmit={bewaar} className="t-stapel" style={{ gap: 12 }}>
        <label><span className="t-label">Je naam</span>
          <input className="t-veld" style={{ height: 44 }} value={naam} onChange={(e) => setNaam(e.target.value)} autoComplete="name" placeholder="Voornaam Achternaam" />
        </label>
        <p className="t-stil" style={{ fontSize: 12.5, margin: 0 }}>Collega's zien deze naam, en hij staat in de uitnodigingen die je verstuurt.</p>
        <button type="submit" className="t-knop hoofd" style={{ height: 44 }} disabled={bezig}>{bezig ? "Bezig…" : "Naam bewaren"}</button>
        {stand && <p className={`t-melding ${stand.soort}`} style={{ margin: 0 }}>{stand.tekst}</p>}
      </form>
      <div className="t-stapel" style={{ gap: 8, marginTop: 26 }}>
        <a className="t-knop" href="/wachtwoord">Wachtwoord wijzigen</a>
        <a className="t-knop" href="/mfa">Tweestapsverificatie</a>
        <a className="t-knop stil" href={veiligVerder(verder)}>Terug</a>
      </div>
    </div>
  );
}
