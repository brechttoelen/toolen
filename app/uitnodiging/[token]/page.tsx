import { supabaseServer } from "@/lib/supabase/server";
import Inlogkader from "@/components/Inlogkader";
import Aanvaarden, { AccountMaken } from "./Aanvaarden";
import { huisstijlVan } from "@/lib/huisstijlServer";
import { brugVoor } from "@/lib/ssoBrug";

export const metadata = { title: "Uitnodiging" };

const ROL: Record<string, string> = { eigenaar: "eigenaar", beheerder: "beheerder", bewerker: "bewerker", lezer: "lezer" }; // midden in een zin
type Info = { email: string; naam: string | null; rol: string; organisatie: string; slug: string; geldig: boolean; aanvaard: boolean; account: boolean; door: string | null; sso?: string[] } | null;

export default async function Uitnodiging({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await supabaseServer();
  const [{ data }, { data: auth }] = await Promise.all([supabase.rpc("uitnodiging_info", { p_token: token }), supabase.auth.getUser()]);
  const info = data as Info;
  const ik = auth.user?.email?.toLowerCase();
  const huisstijl = info?.slug ? await huisstijlVan(info.slug) : null;
  // Organisatie met Microsoft via de eigen omgeving (brug): dat kan ook, zonder wachtwoord.
  const brug = !!info?.slug && (info.sso || []).includes("brug") && !!brugVoor(info.slug);

  return (
    <Inlogkader huisstijl={huisstijl}>
      <div>
        {!info || !info.geldig ? (
          <>
            <h1 className="t-titel" style={{ fontSize: 28 }}>Uitnodiging niet geldig</h1>
            <p className="t-sub">{info?.aanvaard ? "Deze uitnodiging is al gebruikt. Log in met je bedrijfscode, e-mailadres en wachtwoord." : "Deze link is verlopen of bestaat niet. Vraag wie je uitnodigde om ze opnieuw te versturen."}</p>
            <p style={{ marginTop: 20 }}><a className="t-knop" href={`/login${info?.slug ? `?code=${info.slug}` : ""}`}>Naar inloggen</a></p>
          </>
        ) : (
          <>
            <h1 className="t-titel" style={{ fontSize: 28 }}>Welkom bij {info.organisatie}</h1>
            <p className="t-sub" style={{ marginBottom: 4 }}>
              {info.door ? `${info.door} nodigt je uit` : "Je bent uitgenodigd"} als {ROL[info.rol] || info.rol} in Toolen Maps.
            </p>
            <p className="t-stil" style={{ fontSize: 13.5 }}>Bedrijfscode <strong>{info.slug.toUpperCase()}</strong> · {info.email}</p>
            {brug && !ik && (
              <div style={{ marginTop: 24 }}>
                <a className="t-knop hoofd" style={{ height: 46, fontSize: 14.5, display: "flex", width: "100%" }} href={`/auth/brug/start?code=${info.slug}`}>Verder met Microsoft</a>
                <p className="t-stil" style={{ fontSize: 12.5, margin: "8px 0 0", lineHeight: 1.5 }}>Met je account van {info.organisatie}, zonder wachtwoord. Je rol komt dan uit het toegangsbeheer van {info.organisatie}.</p>
                <div className="t-stil" style={{ margin: "22px 0 0", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, height: 1, background: "var(--t-rand-2)" }} />{info.account ? "Of met je wachtwoord" : "Of maak een account met een wachtwoord"}<span style={{ flex: 1, height: 1, background: "var(--t-rand-2)" }} />
                </div>
              </div>
            )}
            <div style={{ marginTop: 24 }}>
              {ik && ik !== info.email.toLowerCase() ? (
                <p className="t-melding fout">Je bent ingelogd als {auth.user?.email}. Deze uitnodiging is voor {info.email}: log uit en open de link opnieuw.</p>
              ) : ik ? (
                <Aanvaarden token={token} />
              ) : info.account ? (
                <>
                  <p className="t-sub" style={{ marginBottom: 14 }}>Je hebt al een account. Log in om de uitnodiging te aanvaarden.</p>
                  <a className="t-knop hoofd" href={`/login?code=${info.slug}&verder=${encodeURIComponent(`/uitnodiging/${token}`)}`}>Inloggen</a>
                </>
              ) : (
                <AccountMaken token={token} email={info.email} naam={info.naam} slug={info.slug} />
              )}
            </div>
          </>
        )}
      </div>
    </Inlogkader>
  );
}
