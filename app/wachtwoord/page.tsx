import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Inlogkader from "@/components/Inlogkader";
import MfaScherm from "@/components/MfaScherm";
import NieuwWachtwoord from "./NieuwWachtwoord";

export const metadata = { title: "Wachtwoord" };

// Nieuw wachtwoord kiezen na de link uit de mail. Wie al een code op de gsm heeft, geeft die eerst.
export default async function Wachtwoord({ searchParams }: { searchParams: Promise<{ nieuw?: string }> }) {
  const { nieuw } = await searchParams;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?fout=" + encodeURIComponent("Deze link is verlopen. Vraag een nieuwe via Wachtwoord vergeten."));
  const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
    return <Inlogkader><MfaScherm stap="code" reden="Geef eerst de code uit je app. Daarna kies je een nieuw wachtwoord." /></Inlogkader>;
  }
  return <Inlogkader><NieuwWachtwoord email={auth.user.email || ""} nieuw={!!nieuw} /></Inlogkader>;
}
