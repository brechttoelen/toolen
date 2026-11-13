import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { geldigeSlug } from "@/lib/org";
import { GRIDLAB_URL, GRIDLAB_PUBLIEK } from "@/lib/gridlabBron";
import { fout, json, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

// GridLab-ontwerpen voor de koppeling in Toolen Maps (alleen lezen).
// Enkel voor ingelogde leden van een organisatie met de koppeling "gridlab".
export async function POST(req: NextRequest) {
  const b = await json<{ org: string; ids: string[] }>(req);
  const org = String(b.org || "");
  if (!geldigeSlug(org)) return fout("Onbekende organisatie.");
  const sb = await supabaseServer(org);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fout("Niet ingelogd.", 401);
  const { data: o } = await sb.from("organisaties").select("modules").eq("slug", org).maybeSingle();
  if (!o || !(o.modules || []).includes("gridlab")) return fout("De koppeling met GridLab staat niet aan.", 403);
  const sleutel = process.env.TOOLEN_GRIDLAB_SLEUTEL;
  if (!sleutel) return fout("De koppeling met GridLab is nog niet ingesteld (sleutel ontbreekt op de server).", 503);
  const ids = Array.isArray(b.ids) ? b.ids.filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 500) : null;
  const r = await fetch(`${GRIDLAB_URL}/rest/v1/rpc/toolen_lezen`, {
    method: "POST", cache: "no-store",
    headers: { apikey: GRIDLAB_PUBLIEK, "content-type": "application/json", "content-profile": "gridlab", "accept-profile": "gridlab" },
    body: JSON.stringify({ p_sleutel: sleutel, p_ids: ids && ids.length ? ids : null }),
  });
  if (!r.ok) return fout("GridLab is niet bereikbaar.", 502);
  const d = await r.json().catch(() => null);
  if (!d) return fout("De sleutel voor GridLab klopt niet.", 403);
  return ok(d as Record<string, unknown>);
}
