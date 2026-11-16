import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { adminIngesteld, supabaseAdmin } from "@/lib/supabase/admin";
import { basisAdres } from "@/lib/server";
import { geldigeSlug, HOOFDDOMEIN } from "@/lib/org";
import { veiligVerder } from "@/lib/verder";
import { BRUG_COOKIE, BRUG_PAD, brugEmail, brugVoor } from "@/lib/ssoBrug";

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

  let email: string | null = null;
  try { email = await brugEmail(brug, code, staat.g); } catch { email = null; }
  if (!email) return mis("Aanmelden met Microsoft is niet gelukt. Probeer opnieuw.");

  const admin = supabaseAdmin();
  const { data: lid } = await admin.rpc("brug_lid", { p_email: email, p_slug: slug });
  const l = lid as { user_id: string; email: string; organisatie_id: string; naam: string } | null;
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
