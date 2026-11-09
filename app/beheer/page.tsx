import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import PlatformZij from "@/components/beheer/PlatformZij";
import PlatformBeheer from "@/components/beheer/PlatformBeheer";

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
  return (
    <div className="t-schil">
      <PlatformZij blad={blad === "pakketten" ? "pakketten" : "organisaties"} gebruiker={profiel?.naam || auth.user.email || ""} />
      <div className="t-werk"><PlatformBeheer blad={blad === "pakketten" ? "pakketten" : "organisaties"} /></div>
    </div>
  );
}
