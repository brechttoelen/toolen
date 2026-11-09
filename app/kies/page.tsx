import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { HOOFDDOMEIN } from "@/lib/org";
import Kop from "@/components/Kop";

export const metadata = { title: "Je organisaties" };

const ROL: Record<string, string> = { eigenaar: "Eigenaar", beheerder: "Beheerder", bewerker: "Bewerker", lezer: "Lezer" };
const STATUS: Record<string, string> = { proef: "Proefperiode", achterstallig: "Betaling open", alleen_lezen: "Alleen lezen", geblokkeerd: "Geblokkeerd" };

// Na het inloggen: naar je organisatie (één) of een keuze (meerdere).
export default async function Kies() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?verder=/kies");

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
    <div className="t-pagina">
      <Kop gebruiker={{ naam: profiel?.naam, email: auth.user.email }} platform={!!pb} organisaties={lijst.map((o) => ({ slug: o.slug, naam: o.naam, rol: o.rol }))} />
      <main className="t-inhoud" style={{ maxWidth: 640 }}>
        <h1 className="t-titel">Je organisaties</h1>
        <p className="t-sub">Kies waar je wil werken.</p>
        <div className="t-kaart" style={{ marginTop: 24 }}>
          {lijst.length === 0 && (
            <p style={{ padding: 20, margin: 0 }} className="t-stil">
              {auth.user.email} is nog geen lid van een organisatie. Vraag een uitnodiging aan de beheerder van je organisatie.
            </p>
          )}
          {lijst.map((o, i) => (
            <a key={o.id} href={adres(o.slug)} className="t-rij"
              style={{ padding: "16px 20px", borderTop: i ? "1px solid var(--t-rand)" : 0, color: "var(--t-tekst)" }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 500, fontSize: 15 }}>{o.naam}</span>
                <span className="t-stil" style={{ fontSize: 13 }}>{o.slug}.{HOOFDDOMEIN}</span>
              </span>
              {STATUS[o.status] && <span className={`t-pil ${o.status === "proef" ? "blauw" : "let-op"}`}>{STATUS[o.status]}</span>}
              <span className="t-pil">{ROL[o.rol] || o.rol}</span>
            </a>
          ))}
        </div>
        {pb && <p style={{ marginTop: 24 }}><a className="t-knop" href="/beheer">Platformbeheer</a></p>}
      </main>
    </div>
  );
}
