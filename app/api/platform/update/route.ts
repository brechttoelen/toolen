import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fout, foutTekst, json, ok } from "@/lib/server";
import { stand, terugzetten, vrijgaveIngesteld, vrijgeven } from "@/lib/vrijgave";

export const dynamic = "force-dynamic";

// Platform: wat wacht er in de testomgeving, vrijgeven voor klanten, of terug naar de vorige versie.
async function magHet() {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("is_platformbeheerder");
  return !!data;
}

export async function GET() {
  if (!(await magHet())) return fout("Enkel voor platformbeheer, met tweede stap.", 403);
  if (!vrijgaveIngesteld()) return ok({ ingesteld: false });
  try { return ok({ ingesteld: true, stand: await stand() }); } catch (e) { return fout(foutTekst(e), 502); }
}

export async function POST(req: NextRequest) {
  if (!(await magHet())) return fout("Enkel voor platformbeheer, met tweede stap.", 403);
  if (!vrijgaveIngesteld()) return fout("Vrijgeven is nog niet ingesteld (TOOLEN_GITHUB_TOKEN ontbreekt).", 400);
  const b = await json<{ actie: string; test: string }>(req);
  try {
    if (b.actie === "vrijgeven" && b.test) return ok({ stand: await vrijgeven(b.test) });
    if (b.actie === "terugzetten") return ok({ stand: await terugzetten() });
    return fout("Onbekende actie.");
  } catch (e) { return fout(foutTekst(e), 409); }
}
