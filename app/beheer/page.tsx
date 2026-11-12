import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import PlatformZij from "@/components/beheer/PlatformZij";
import PlatformBeheer from "@/components/beheer/PlatformBeheer";
import Systeem from "@/components/beheer/Systeem";
import Collecties from "@/components/beheer/Collecties";
import Inlogkader from "@/components/Inlogkader";
import MfaScherm from "@/components/MfaScherm";
import { mfaStap } from "@/lib/mfa";

export const metadata = { title: "Platformbeheer" };

// Enkel voor platformbeheerders (maps.platform_beheerders). De databank controleert
// dit ook zelf: de functies en tabellen geven anderen niets terug.
export default async function Beheer({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  const { blad } = await searchParams;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?verder=/beheer");
  const [{ data: pb }, { data: profiel }] = await Promise.all([
    supabase.from("platform_beheerders").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("profielen").select("naam").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (!pb) notFound();
  // Platformbeheer vraagt altijd de tweede stap, ook na Microsoft, Google of een e-mailcode.
  const stap = await mfaStap(supabase, true);
  if (stap) return <Inlogkader titel="Platformbeheer"><MfaScherm stap={stap} reden={stap === "instellen" ? "Platformbeheer vraagt altijd een code uit een app op je gsm, ook als je via Microsoft, Google of een e-mailcode inlogt." : undefined} /></Inlogkader>;
  const b = blad === "pakketten" || blad === "systeem" || blad === "bibliotheek" ? blad : "organisaties";
  return (
    <div className="t-schil">
      <PlatformZij blad={b} gebruiker={profiel?.naam || auth.user.email || ""} />
      <div className="t-werk">{b === "systeem" ? <Systeem /> : b === "bibliotheek" ? <Collecties /> : <PlatformBeheer blad={b} />}</div>
    </div>
  );
}
