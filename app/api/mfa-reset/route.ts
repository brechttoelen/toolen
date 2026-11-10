import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mailIngesteld, mfaResetMail, verstuur } from "@/lib/mail";
import { basisAdres, fout, foutTekst, json, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

// Tweestapsverificatie van een lid wissen (gsm kwijt). De database beslist wie dat mag en logt het;
// daarna wist de server de codes en meldt het lid de wijziging per mail.
export async function POST(req: NextRequest) {
  const b = await json<{ user_id: string; organisatie_id: string }>(req);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fout("Niet ingelogd.", 401);
  const { data, error } = await sb.rpc("mfa_reset_toestaan", { p_user: b.user_id, p_org: b.organisatie_id });
  if (error) return fout(foutTekst(error), 403);
  const g = data as { email: string; organisatie: string; door: string | null };
  try {
    const admin = supabaseAdmin();
    const { data: f, error: e1 } = await admin.auth.admin.mfa.listFactors({ userId: String(b.user_id) });
    if (e1) return fout(e1.message, 500);
    for (const x of f?.factors || []) {
      const { error: e2 } = await admin.auth.admin.mfa.deleteFactor({ userId: String(b.user_id), id: x.id });
      if (e2) return fout(e2.message, 500);
    }
    if (mailIngesteld() && g.email) {
      const { data: p } = await admin.from("profielen").select("naam").eq("id", b.user_id).maybeSingle();
      await verstuur({ aan: g.email, naam: (p as { naam?: string } | null)?.naam, ...mfaResetMail({ naam: (p as { naam?: string } | null)?.naam, door: g.door, organisatie: g.organisatie, link: `${basisAdres(req)}/login` }) }).catch(() => {});
    }
  } catch (e) { return fout(foutTekst(e), 500); }
  return ok();
}
