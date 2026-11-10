import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Inlogkader from "@/components/Inlogkader";
import MfaScherm from "@/components/MfaScherm";
import MfaUit from "@/components/MfaUit";

export const metadata = { title: "Tweestapsverificatie" };

// Tweestapsverificatie aanzetten of beheren (vanuit het gebruikersmenu).
export default async function Mfa() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?verder=/mfa");
  const [{ data: f }, { data: niveau }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  const klaar = (f?.totp || []).find((x) => x.status === "verified");
  if (!klaar) return <Inlogkader titel="Tweestapsverificatie"><MfaScherm stap="instellen" reden="Zet een tweede stap aan: naast je wachtwoord of e-mail ook een code uit een app op je gsm." /></Inlogkader>;
  if (niveau?.currentLevel !== "aal2") return <Inlogkader titel="Tweestapsverificatie"><MfaScherm stap="code" /></Inlogkader>;
  return (
    <Inlogkader titel="Tweestapsverificatie">
      <div>
        <h2 className="t-titel" style={{ fontSize: 28, marginBottom: 6 }}>Staat aan</h2>
        <p className="t-sub" style={{ marginBottom: 18 }}>Ingesteld op {new Date(klaar.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })}. Wie met een wachtwoord inlogt, geeft telkens een code uit de app.</p>
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><a className="t-knop hoofd" href="/kies">Verder</a><MfaUit factorId={klaar.id} /></p>
      </div>
    </Inlogkader>
  );
}
