import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { controleerWachtwoord } from "@/lib/wachtwoord";
import { fout, foutTekst, json, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

type Info = { email: string; geldig: boolean; account: boolean; slug: string } | null;

// Account aanmaken vanuit een uitnodiging: het token bewijst het e-mailadres.
// Daarna logt de browser in met het nieuwe wachtwoord en stelt de tweede stap in.
export async function POST(req: NextRequest) {
  const b = await json<{ token: string; naam: string; wachtwoord: string }>(req);
  const token = String(b.token || ""); const naam = String(b.naam || "").trim(); const pw = String(b.wachtwoord || "");
  if (naam.length < 2) return fout("Vul je naam in.");
  let admin;
  try { admin = supabaseAdmin(); } catch (e) { return fout(foutTekst(e), 500); }

  const { data } = await admin.rpc("uitnodiging_info", { p_token: token });
  const info = data as Info;
  if (!info?.geldig) return fout("Deze uitnodiging is verlopen of al gebruikt. Vraag een nieuwe.");
  if (info.account) return fout("Er bestaat al een account voor dit adres. Log in om de uitnodiging te aanvaarden.");
  const f = await controleerWachtwoord(pw, info.email);
  if (f) return fout(f);

  const { data: u, error } = await admin.auth.admin.createUser({
    email: info.email, password: pw, email_confirm: true, user_metadata: { full_name: naam },
  });
  if (error || !u.user) return fout(error?.message || "Het account kon niet aangemaakt worden.");
  const r = await admin.rpc("uitnodiging_aanvaarden_door", { p_token: token, p_user: u.user.id });
  if (r.error) {
    await admin.auth.admin.deleteUser(u.user.id).catch(() => {});
    return fout(foutTekst(r.error));
  }
  return ok({ email: info.email, slug: info.slug });
}
