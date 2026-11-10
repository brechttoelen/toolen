import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { HOOFDDOMEIN } from "@/lib/org";
import Inlogkader from "@/components/Inlogkader";
import MfaScherm from "@/components/MfaScherm";
import { mfaStap } from "@/lib/mfa";

export const metadata = { title: "Je organisaties" };

const ROL: Record<string, string> = { eigenaar: "Eigenaar", beheerder: "Beheerder", bewerker: "Bewerker", lezer: "Lezer" };
const STATUS: Record<string, string> = { proef: "Proefperiode", achterstallig: "Betaling open", alleen_lezen: "Alleen lezen", geblokkeerd: "Geblokkeerd" };

// Na het inloggen: naar je organisatie (één) of een keuze (meerdere).
export default async function Kies() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?verder=/kies");
  const stap = await mfaStap(supabase);
  if (stap) return <Inlogkader><MfaScherm stap={stap} /></Inlogkader>;

  const host = (await headers()).get("host") || "";
  const opDomein = host.split(":")[0].endsWith(HOOFDDOMEIN);
  const adres = (slug: string) => (opDomein ? `https://${slug}.${HOOFDDOMEIN}/maps` : `/maps?org=${slug}`);

  const [{ data: leden }, { data: pb }, { data: profiel }] = await Promise.all([
    supabase.from("leden").select("rol, organisatie_id").eq("user_id", auth.user.id).eq("actief", true),
    supabase.from("platform_beheerders").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("profielen").select("naam").eq("id", auth.user.id).maybeSingle(),
  ]);
  const ids = (leden || []).map((l) => l.organisatie_id);
  const { data: orgs } = ids.length
    ? await supabase.from("organisaties").select("id, slug, naam, status").in("id", ids).neq("status", "verwijderd").order("naam")
    : { data: [] as { id: string; slug: string; naam: string; status: string }[] };
  const lijst = (orgs || []).map((o) => ({ ...o, rol: leden?.find((l) => l.organisatie_id === o.id)?.rol || "" }));

  if (lijst.length === 1 && !pb) redirect(adres(lijst[0].slug));

  return (
    <Inlogkader>
      <h2 className="t-titel" style={{ fontSize: 28 }}>Je organisaties</h2>
      <p className="t-sub" style={{ marginBottom: 20 }}>Kies waar je wil werken.</p>
      {lijst.length === 0 && (
        <p className="t-melding">{auth.user.email} is nog geen lid van een organisatie. Vraag een uitnodiging aan de beheerder van je organisatie.</p>
      )}
      <div className="t-stapel" style={{ gap: 10 }}>
        {lijst.map((o) => (
          <a key={o.id} href={adres(o.slug)} className="t-kaart t-rij" style={{ padding: 12, color: "var(--t-tekst)", textDecoration: "none" }}>
            <span style={{ width: 40, height: 40, borderRadius: 8, background: "var(--t-navy)", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", flex: "none" }}>{o.naam.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{o.naam}</span>
              <span className="t-stil" style={{ fontSize: 13 }}>{o.slug}.{HOOFDDOMEIN}</span>
            </span>
            {STATUS[o.status] && <span className={`t-pil ${o.status === "proef" ? "blauw" : "let-op"}`}>{STATUS[o.status]}</span>}
            <span className="t-pil">{ROL[o.rol] || o.rol}</span>
          </a>
        ))}
      </div>
      <div className="t-rij" style={{ marginTop: 24, justifyContent: "space-between" }}>
        <span className="t-stil" style={{ fontSize: 13 }}>Ingelogd als {profiel?.naam || auth.user.email}</span>
        {pb && <a className="t-knop" href="/beheer">Platformbeheer</a>}
      </div>
    </Inlogkader>
  );
}
