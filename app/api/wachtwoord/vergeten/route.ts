import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verstuur, wachtwoordMail } from "@/lib/mail";
import { basisAdres, json, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

// Wachtwoord vergeten: altijd hetzelfde antwoord, of het adres nu bestaat of niet.
// Hoogstens 3 mails per uur per adres.
export async function POST(req: NextRequest) {
  const b = await json<{ email: string }>(req);
  const email = String(b.email || "").trim().toLowerCase();
  const antwoord = ok({ melding: "Als dit adres bij ons gekend is, krijg je binnen enkele minuten een mail om een nieuw wachtwoord te kiezen." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return antwoord;
  try {
    const admin = supabaseAdmin();
    const { data: mag } = await admin.rpc("mail_toegestaan", { p_email: email, p_soort: "wachtwoord", p_max: 3 });
    if (!mag) return antwoord;
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (error || !data?.properties?.hashed_token) return antwoord;
    const link = `${basisAdres(req)}/auth/bevestig?type=recovery&token_hash=${encodeURIComponent(data.properties.hashed_token)}&verder=${encodeURIComponent("/wachtwoord")}`;
    const naam = (data.user?.user_metadata as { full_name?: string } | undefined)?.full_name || null;
    await verstuur({ aan: email, naam, ...wachtwoordMail({ naam, link }) });
  } catch (e) {
    console.error("wachtwoord vergeten", e);
  }
  return antwoord;
}
