import { supabaseServer } from "@/lib/supabase/server";
import Inlogkader from "@/components/Inlogkader";
import Aanvaarden from "./Aanvaarden";

export const metadata = { title: "Uitnodiging" };

const ROL: Record<string, string> = { eigenaar: "eigenaar", beheerder: "beheerder", bewerker: "bewerker", lezer: "lezer" }; // midden in een zin
type Info = { email: string; rol: string; organisatie: string; slug: string; geldig: boolean; aanvaard: boolean; door: string | null } | null;

export default async function Uitnodiging({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await supabaseServer();
  const [{ data }, { data: auth }] = await Promise.all([supabase.rpc("uitnodiging_info", { p_token: token }), supabase.auth.getUser()]);
  const info = data as Info;
  const ik = auth.user?.email?.toLowerCase();

  return (
    <Inlogkader>
      <div>
        {!info || !info.geldig ? (
          <>
            <h1 className="t-titel" style={{ fontSize: 28 }}>Uitnodiging niet geldig</h1>
            <p className="t-sub">{info?.aanvaard ? "Deze uitnodiging is al aanvaard." : "Deze link is verlopen of bestaat niet. Vraag een nieuwe uitnodiging."}</p>
            <p style={{ marginTop: 20 }}><a className="t-knop" href="/kies">Naar je organisaties</a></p>
          </>
        ) : (
          <>
            <h1 className="t-titel" style={{ fontSize: 28 }}>Uitnodiging voor {info.organisatie}</h1>
            <p className="t-sub">
              {info.door ? `${info.door} nodigt je uit` : "Je bent uitgenodigd"} als {ROL[info.rol] || info.rol} van {info.organisatie} in Toolen Maps.
            </p>
            <p className="t-sub">Voor {info.email}</p>
            <div style={{ marginTop: 24 }}>
              {!ik ? (
                <a className="t-knop hoofd" href={`/login?verder=${encodeURIComponent(`/uitnodiging/${token}`)}`}>Inloggen om te aanvaarden</a>
              ) : ik !== info.email.toLowerCase() ? (
                <p className="t-melding fout">Je bent ingelogd als {auth.user?.email}. Deze uitnodiging is voor {info.email}: log uit en log in met dat adres.</p>
              ) : (
                <Aanvaarden token={token} />
              )}
            </div>
          </>
        )}
      </div>
    </Inlogkader>
  );
}
