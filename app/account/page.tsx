import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Inlogkader from "@/components/Inlogkader";
import Account from "./Account";

export const metadata = { title: "Mijn account" };

// Eigen naam, wachtwoord en tweestapsverificatie.
export default async function AccountPagina({ searchParams }: { searchParams: Promise<{ verder?: string }> }) {
  const { verder } = await searchParams;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?verder=/account");
  const { data: p } = await supabase.from("profielen").select("naam").eq("id", auth.user.id).maybeSingle();
  return (
    <Inlogkader titel="Mijn account">
      <Account email={auth.user.email || ""} naam={(p as { naam?: string } | null)?.naam || ""} verder={verder || "/kies"} />
    </Inlogkader>
  );
}
