import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { adminIngesteld, supabaseAdmin } from "@/lib/supabase/admin";
import { basisAdres } from "@/lib/server";
import { geldigeSlug, HOOFDDOMEIN } from "@/lib/org";
import { veiligVerder } from "@/lib/verder";
import { BRUG_COOKIE, BRUG_PAD, brugVoor, brugWie, type BrugWie } from "@/lib/ssoBrug";

export const dynamic = "force-dynamic";

// Terugkeer van de Microsoft-aanmelding via de brug: nagaan wie het is, en voor een actief lid een Toolen-sessie maken.
export async function GET(req: NextRequest) {
  const basis = basisAdres(req);
  let staat: { g?: string; s?: string; v?: string } = {};
  try { staat = JSON.parse(req.cookies.get(BRUG_COOKIE)?.value || "{}"); } catch {}
  const slug = geldigeSlug(staat.s) ? staat.s! : "";
  const klaar = (adres: string) => { const res = NextResponse.redirect(adres); res.cookies.set(BRUG_COOKIE, "", { path: BRUG_PAD, maxAge: 0 }); return res; };
  const mis = (tekst: string) => klaar(`${basis}/login?fout=${encodeURIComponent(tekst)}${slug ? `&code=${slug}` : ""}`);

  const code = req.nextUrl.searchParams.get("code");
  const brug = brugVoor(slug);
  if (!code || !staat.g || !brug) return mis("Aanmelden met Microsoft is niet gelukt. Probeer opnieuw.");
  if (!adminIngesteld()) return mis("Aanmelden met Microsoft is hier nog niet ingesteld.");

  let wie: BrugWie | null = null;
  try { wie = await brugWie(brug, code, staat.g); } catch { wie = null; }
  if (!wie) return mis("Aanmelden met Microsoft is niet gelukt. Probeer opnieuw.");

  const admin = supabaseAdmin();
  type Lid = { user_id: string | null; email: string; organisatie_id: string; naam: string } | null;
  let l: Lid = null;
  if (brug.hubApp) {
    // Het toegangsbeheer van de organisatie beslist: geen rol daar = geen toegang hier.
    if (!wie.rol) {
      await admin.rpc("brug_lid_uit", { p_email: wie.email, p_slug: slug });
      return mis(`Je hebt in ${brug.hubNaam || "het toegangsbeheer van je bedrijf"} geen toegang tot Toolen Maps. Vraag ze daar aan.`);
    }
    const zet = () => admin.rpc("brug_lid_zetten", { p_email: wie!.email, p_slug: slug, p_rol: wie!.rol });
    let r = await zet();
    if (!r.error && r.data && !(r.data as Lid)!.user_id) {
      // Eerste keer: een account zonder wachtwoord (aanmelden gaat via Microsoft).
      const { error } = await admin.auth.admin.createUser({ email: wie.email, email_confirm: true, user_metadata: wie.naam ? { full_name: wie.naam } : {} });
      if (error) return mis("Je account kon niet aangemaakt worden. Probeer opnieuw.");
      r = await zet();
    }
    if (r.error) return mis(/plaatsen|lezers/i.test(r.error.message) ? r.error.message : "Aanmelden is niet gelukt. Probeer opnieuw.");
    l = r.data as Lid;
  } else {
    const { data: lid } = await admin.rpc("brug_lid", { p_email: wie.email, p_slug: slug });
    l = lid as Lid;
  }
  if (!l?.user_id) return mis("Dit Microsoft-account heeft hier geen toegang. Vraag de beheerder van je bedrijf om je uit te nodigen met dit e-mailadres.");

  // Eigen sessie voor dit lid: een eenmalige aanmeldcode die de server meteen zelf inwisselt (er vertrekt geen mail).
  const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email: l.email });
  const hash = link?.properties?.hashed_token;
  if (e1 || !hash) return mis("Aanmelden is niet gelukt. Probeer opnieuw.");
  const sb = await supabaseServer();
  const { data: sessie, error: e2 } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: hash });
  if (e2 || !sessie?.session) return mis("Aanmelden is niet gelukt. Probeer opnieuw.");

  // Onthouden dat deze sessie van Microsoft komt: ze hoeft geen code uit de app te geven.
  try {
    const p = JSON.parse(Buffer.from(sessie.session.access_token.split(".")[1], "base64url").toString("utf8")) as { session_id?: string };
    if (p.session_id) await admin.rpc("brug_sessie_bewaren", { p_session: p.session_id, p_user: l.user_id, p_org: l.organisatie_id });
  } catch {}

  const standaard = basis === `https://login.${HOOFDDOMEIN}` ? `https://${slug}.${HOOFDDOMEIN}/maps` : `/maps?org=${slug}`;
  const verder = veiligVerder(staat.v, standaard);
  return klaar(verder.startsWith("/") ? `${basis}${verder}` : verder);
}
