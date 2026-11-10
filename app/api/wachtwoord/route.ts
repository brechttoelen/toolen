import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { controleerWachtwoord } from "@/lib/wachtwoord";
import { fout, foutTekst, json, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

// Nieuw wachtwoord instellen voor de ingelogde gebruiker (na de link uit de mail), met het beleid
// op de server. Wie al een tweede stap heeft, moet die eerst geven (aal2).
export async function POST(req: NextRequest) {
  const b = await json<{ wachtwoord: string }>(req);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fout("Je sessie is verlopen. Vraag een nieuwe link.", 401);
  const { data: niveau } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") return fout("Geef eerst de code uit je app.", 403);
  const pw = String(b.wachtwoord || "");
  const f = await controleerWachtwoord(pw, auth.user.email);
  if (f) return fout(f);
  try {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(auth.user.id, { password: pw });
    if (error) return fout(error.message);
  } catch (e) { return fout(foutTekst(e), 500); }
  return ok();
}
