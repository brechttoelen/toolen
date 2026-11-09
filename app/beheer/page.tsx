import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Kop from "@/components/Kop";
import PlatformBeheer from "@/components/beheer/PlatformBeheer";

export const metadata = { title: "Platformbeheer" };

// Enkel voor platformbeheerders (maps.platform_beheerders). De databank controleert
// dit ook zelf: de functies en tabellen geven anderen niets terug.
export default async function Beheer() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?verder=/beheer");
  const [{ data: pb }, { data: profiel }] = await Promise.all([
    supabase.from("platform_beheerders").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("profielen").select("naam").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (!pb) notFound();
  return (
    <div className="t-pagina">
      <Kop product="beheer" gebruiker={{ naam: profiel?.naam, email: auth.user.email }} platform />
      <PlatformBeheer />
    </div>
  );
}
