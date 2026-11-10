import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verstuur, wachtwoordMail } from "@/lib/mail";
import { basisAdres, fout, foutTekst, json, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

// Platform: leden zonder wachtwoord (vroeger Microsoft, Google of een e-mailcode) een mail sturen
// om er een in te stellen. Zonder lijst: iedereen zonder wachtwoord.
export async function POST(req: NextRequest) {
  const b = await json<{ user_ids: string[] }>(req);
  const sb = await supabaseServer();
  const { data: platform } = await sb.rpc("is_platformbeheerder");
  if (!platform) return fout("Enkel voor platformbeheer, met tweede stap.", 403);
  const { data: rijen, error } = await sb.rpc("platform_zonder_wachtwoord");
  if (error) return fout(foutTekst(error));
  const lijst = (rijen as { user_id: string; email: string; naam: string | null }[]).filter((r) => !b.user_ids?.length || b.user_ids.includes(r.user_id));
  let n = 0; const mislukt: string[] = [];
  try {
    const admin = supabaseAdmin();
    for (const r of lijst) {
      const { data, error: e } = await admin.auth.admin.generateLink({ type: "recovery", email: r.email });
      if (e || !data?.properties?.hashed_token) { mislukt.push(r.email); continue; }
      const link = `${basisAdres(req)}/auth/bevestig?type=recovery&token_hash=${encodeURIComponent(data.properties.hashed_token)}&verder=${encodeURIComponent("/wachtwoord?nieuw=1")}`;
      try { await verstuur({ aan: r.email, naam: r.naam, ...wachtwoordMail({ naam: r.naam, link, nieuw: true }) }); n++; } catch { mislukt.push(r.email); }
    }
  } catch (e) { return fout(foutTekst(e), 500); }
  return ok({ verstuurd: n, mislukt });
}
