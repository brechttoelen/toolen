import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Kop from "./Kop";

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

// Schil rond alles binnen een organisatie: login controleren, rol ophalen, kop tonen.
export default async function OrgSchil({ org, verder, children, extra }: { org: string; verder: string; children: React.ReactNode; extra?: React.ReactNode }) {
  const supabase = await supabaseServer(org);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?verder=${encodeURIComponent(verder)}`);
  const [{ data: ikData }, { data: pb }] = await Promise.all([
    supabase.rpc("ik"),
    supabase.from("platform_beheerders").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
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

  const beheerder = ik.rol === "eigenaar" || ik.rol === "beheerder";
  const melding = ik.organisatie.status ? STATUS_MELDING[ik.organisatie.status] : null;
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--t-vlak)" }}>
      <Kop
        organisatie={ik.organisatie}
        gebruiker={gebruiker}
        organisaties={ik.organisaties || []}
        platform={platform}
        instellingen
        extra={extra}
        links={[
          { href: "/maps", tekst: "Plannen" },
          { href: "/maps/bibliotheek", tekst: "Bibliotheek" },
          { href: "/maps/leveranciers", tekst: "Leveranciers" },
          { href: "/maps/feedback", tekst: "Feedback" },
          ...(beheerder ? [{ href: "/instellingen", tekst: "Instellingen" }] : []),
        ]}
      />
      {melding && <div className="t-melding" style={{ borderRadius: 0, background: "var(--t-let-op-zacht)", color: "var(--t-let-op)", padding: "8px 20px" }}>{melding}</div>}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
