import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fout, ok } from "@/lib/server";
import { geldigeSlug } from "@/lib/org";
import { brugVoor, hubRolNaar } from "@/lib/ssoBrug";

export const dynamic = "force-dynamic";

// Wie heeft in het toegangsbeheer van de organisatie (de hub) een rol voor Toolen Maps? Voor het scherm Leden.
// De hub geeft die lijst enkel met de sleutel van de app (TOOLEN_BRUG_SLEUTEL_<CODE>, op de server). Zonder sleutel
// toont Leden enkel wie zich al via de hub aanmeldde.
export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("org") || "").toLowerCase();
  if (!geldigeSlug(slug)) return fout("Onbekende organisatie.", 404);
  const sb = await supabaseServer(slug);
  const { data: ik } = await sb.rpc("ik");
  const w = ik as { rol?: string; organisatie?: { slug?: string } } | null;
  if (w?.organisatie?.slug !== slug || !["eigenaar", "beheerder"].includes(w?.rol || "")) return fout("Enkel voor beheerders.", 403);
  const brug = brugVoor(slug);
  if (!brug?.hubApp) return ok({ brug: false });
  const sleutel = (process.env[`TOOLEN_BRUG_SLEUTEL_${slug.toUpperCase().replace(/-/g, "_")}`] || "").trim();
  if (!sleutel) return ok({ brug: true, sleutel: false });
  try {
    const r = await fetch(`${brug.url}/rest/v1/rpc/app_members`, {
      method: "POST", cache: "no-store",
      headers: { apikey: brug.sleutel, authorization: `Bearer ${brug.sleutel}`, "content-type": "application/json" },
      body: JSON.stringify({ p_slug: brug.hubApp, p_key: sleutel }),
    });
    if (!r.ok) return ok({ brug: true, sleutel: true, fout: r.status === 401 || r.status === 403 ? "De sleutel van de hub klopt niet." : "De hub antwoordt niet." });
    const rijen = (await r.json()) as { email: string; naam: string | null; rol: string | null; status: string | null }[];
    return ok({ brug: true, sleutel: true, leden: rijen.filter((x) => x.email && x.rol && x.rol !== "geen").map((x) => ({ email: x.email.toLowerCase(), naam: x.naam, rol: hubRolNaar(x.rol!), status: x.status })) });
  } catch { return ok({ brug: true, sleutel: true, fout: "De hub antwoordt niet." }); }
}
