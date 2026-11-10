import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Kop from "./Kop";
import Zijbalk from "./Zijbalk";
import Inlogkader from "./Inlogkader";
import MfaScherm from "./MfaScherm";
import { mfaStap } from "@/lib/mfa";
import { huisstijlVan } from "@/lib/huisstijlServer";

export type Ik = {
  id?: string; role?: string; rol?: string; email?: string; display_name?: string;
  organisatie?: { id: string; slug: string; naam: string; kort?: string; status?: string; pakket?: string; modules?: string[]; proef_tot?: string | null };
  organisaties?: { slug: string; naam: string; rol: string }[];
} | null;

const STATUS_MELDING: Record<string, string> = {
  achterstallig: "De betaling van het abonnement is niet gelukt. Alles werkt nog; regel het via Instellingen → Abonnement.",
  alleen_lezen: "Dit abonnement staat op alleen-lezen: bekijken en exporteren kan, bewerken niet.",
  geblokkeerd: "Dit abonnement is geblokkeerd. Enkel de eigenaar kan nog inloggen om te betalen of te exporteren.",
};

// Schil rond alles binnen een organisatie: login controleren, rol ophalen, zijbalk tonen.
export default async function OrgSchil({ org, verder, children, extra }: { org: string; verder: string; children: React.ReactNode; extra?: React.ReactNode }) {
  const supabase = await supabaseServer(org);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?verder=${encodeURIComponent(verder)}`);
  const stap = await mfaStap(supabase);
  if (stap) return <Inlogkader huisstijl={await huisstijlVan(org)}><MfaScherm stap={stap} /></Inlogkader>;
  const [{ data: ikData }, { data: pb }, huisstijl] = await Promise.all([
    supabase.rpc("ik"),
    supabase.from("platform_beheerders").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
    huisstijlVan(org),
  ]);
  const ik = ikData as Ik;
  const platform = !!pb;
  const gebruiker = { naam: ik?.display_name, email: auth.user.email };

  if (!ik || !ik.role || !ik.organisatie) {
    return (
      <div className="t-pagina">
        <Kop gebruiker={gebruiker} platform={platform} />
        <main className="t-inhoud" style={{ maxWidth: 560 }}>
          <h1 className="t-titel">Geen toegang</h1>
          <p className="t-sub">{auth.user.email} is geen lid van deze organisatie. Vraag een beheerder om je uit te nodigen.</p>
          <p style={{ marginTop: 24 }}><a className="t-knop" href="/kies">Naar je organisaties</a></p>
        </main>
      </div>
    );
  }

  const melding = ik.organisatie.status ? STATUS_MELDING[ik.organisatie.status] : null;
  return (
    <Zijbalk
      organisatie={ik.organisatie}
      organisaties={ik.organisaties || []}
      gebruiker={gebruiker}
      rol={ik.rol}
      platform={platform}
      melding={melding}
      extra={extra}
      huisstijl={huisstijl}
      feedback={!!ik.organisatie.modules?.includes("feedback")}
    >
      {children}
    </Zijbalk>
  );
}
