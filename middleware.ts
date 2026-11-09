import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { HOOFDDOMEIN, geldigeSlug, isEigenDomein, subdomein } from "@/lib/org";
import { cookieOpties } from "@/lib/supabase/cookie";
import { SUPABASE_URL, SUPABASE_KEY, supabaseIngesteld } from "@/lib/supabase/env";

// Adressen:
//   <org>.toolen.be/...   → intern /<org>/...  (bv. flcs.toolen.be/maps → /flcs/maps)
//   login.toolen.be       → /login
//   toolen.be, www        → bedrijfssite (geen herschrijving)
// Lokaal en op Vercel-previews: ?org=<slug> (onthouden in de cookie toolen_org) of TOOLEN_STANDAARD_ORG.

const ORG_COOKIE = "toolen_org";
const ZONDER_ORG = ["/login", "/auth"]; // centraal, nooit onder een organisatie

export async function middleware(req: NextRequest) {
  // Een fout hier mag nooit de hele site laten vallen: dan gewoon zonder herschrijving verder.
  try {
    return await route(req);
  } catch (e) {
    console.error("middleware", e);
    return NextResponse.next();
  }
}

async function route(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const pad = url.pathname;
  const sub = subdomein(host);

  let doel: URL | null = null;
  let zetOrg: string | null = null;

  if (sub === "login") {
    if (!ZONDER_ORG.some((p) => pad.startsWith(p))) { url.pathname = `/login${pad === "/" ? "" : pad}`; doel = url; }
  } else if (sub && sub !== "www") {
    if (!geldigeSlug(sub)) return new NextResponse("Onbekend adres", { status: 404 });
    if (pad.startsWith("/login")) {
      // Inloggen gebeurt centraal; daarna terug naar deze organisatie.
      const terug = `https://${host}${url.searchParams.get("verder") || "/maps"}`;
      return NextResponse.redirect(`https://login.${HOOFDDOMEIN}/login?verder=${encodeURIComponent(terug)}`);
    }
    if (!ZONDER_ORG.some((p) => pad.startsWith(p))) { url.pathname = `/${sub}${pad === "/" ? "" : pad}`; doel = url; }
  } else if (!isEigenDomein(host) || host.startsWith("localhost")) {
    // Preview of lokaal zonder subdomein.
    const gevraagd = url.searchParams.get("org");
    const org = (geldigeSlug(gevraagd) && gevraagd) || req.cookies.get(ORG_COOKIE)?.value || process.env.TOOLEN_STANDAARD_ORG || null;
    if (gevraagd && geldigeSlug(gevraagd)) zetOrg = gevraagd;
    const orgPad = /^\/(maps|d|instellingen)(\/|$)/.test(pad) || (pad === "/" && !!org);
    if (org && geldigeSlug(org) && orgPad) { url.pathname = `/${org}${pad === "/" ? "" : pad}`; doel = url; }
  }

  const res = doel ? NextResponse.rewrite(doel) : NextResponse.next();
  if (zetOrg) res.cookies.set(ORG_COOKIE, zetOrg, { path: "/", sameSite: "lax" });

  // Sessie verversen (Supabase SSR), enkel als er een sessie-cookie is.
  const heeftSessie = req.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (heeftSessie && supabaseIngesteld()) {
    try {
      // Dynamisch geladen: een fout in de Supabase-bibliotheek kan de site nooit laten vallen.
      const { createServerClient } = await import("@supabase/ssr");
      const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
        cookieOptions: cookieOpties(),
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (lijst: { name: string; value: string; options: CookieOptions }[]) => {
            lijst.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      });
      await sb.auth.getUser();
    } catch (e) {
      console.error("sessie verversen", e);
    }
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|maps-sw.js|m/|fonts/|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|map|pdf|webmanifest)$).*)",
  ],
};
