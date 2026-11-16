import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { basisAdres } from "@/lib/server";
import { geldigeSlug } from "@/lib/org";
import { veiligVerder } from "@/lib/verder";
import { BRUG_COOKIE, BRUG_PAD, brugVoor, pkce } from "@/lib/ssoBrug";

export const dynamic = "force-dynamic";

// Start van "Verder met Microsoft" via de brug: door naar de aanmelding van het project van de organisatie.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = (p.get("code") || "").toLowerCase();
  const basis = basisAdres(req);
  const mis = (tekst: string) => NextResponse.redirect(`${basis}/login?fout=${encodeURIComponent(tekst)}${geldigeSlug(slug) ? `&code=${slug}` : ""}`);
  const brug = geldigeSlug(slug) ? brugVoor(slug) : null;
  if (!brug) return mis("Deze aanmelding bestaat niet voor dit bedrijf.");
  // Enkel als het platform de brug voor deze organisatie heeft aangezet.
  const sb = await supabaseServer();
  const { data: info } = await sb.rpc("inlog_info", { p_code: slug });
  if (!((info as { sso?: string[] } | null)?.sso || []).includes("brug")) return mis("Deze aanmelding bestaat niet voor dit bedrijf.");

  const { geheim, uitdaging } = pkce();
  const doel = new URL(`${brug.url}/auth/v1/authorize`);
  doel.searchParams.set("provider", brug.provider);
  doel.searchParams.set("redirect_to", `${basis}${BRUG_PAD}`);
  doel.searchParams.set("scopes", "email openid profile");
  doel.searchParams.set("code_challenge", uitdaging);
  doel.searchParams.set("code_challenge_method", "s256");
  const res = NextResponse.redirect(doel.toString());
  res.cookies.set(BRUG_COOKIE, JSON.stringify({ g: geheim, s: slug, v: veiligVerder(p.get("verder"), "") }), {
    httpOnly: true, secure: basis.startsWith("https://"), sameSite: "lax", path: BRUG_PAD, maxAge: 600,
  });
  return res;
}
