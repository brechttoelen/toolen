import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { adminIngesteld, supabaseAdmin } from "@/lib/supabase/admin";
import { fout, foutTekst, ok } from "@/lib/server";
import { controleerKaartbronnen } from "@/lib/kaartbronnen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Controle van de externe kaartdiensten. Loopt elke dag vanzelf (Vercel Cron, zie vercel.json) en op vraag van platformbeheer.
// Zonder login mag het ook (de dagelijkse taak heeft er geen), maar dan hoogstens één keer per 20 uur:
// de controle doet altijd hetzelfde en geeft niets terug behalve een telling.
async function draai(vers: boolean) {
  if (!adminIngesteld()) return fout("De geheime sleutel van Supabase ontbreekt op de server.", 500);
  const admin = supabaseAdmin();
  if (!vers) {
    const { data: laatst } = await admin.rpc("kaartbronnen_laatst");
    if (laatst && Date.now() - new Date(laatst as string).getTime() < 20 * 3600e3) return ok({ overgeslagen: true });
  }
  try {
    const uitslag = await controleerKaartbronnen();
    const { error } = await admin.rpc("kaartbronnen_bewaren", { p_rijen: uitslag });
    if (error) return fout(error.message, 500);
    return ok({ gecontroleerd: uitslag.length, uitval: uitslag.filter((u) => !u.ok).length });
  } catch (e) { return fout(foutTekst(e), 500); }
}

export async function GET(req: NextRequest) {
  const geheim = process.env.CRON_SECRET;
  const vanCron = !!geheim && req.headers.get("authorization") === `Bearer ${geheim}`;
  return draai(vanCron);
}

// Platformbeheer: nu controleren.
export async function POST() {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("is_platformbeheerder");
  if (!data) return fout("Enkel voor platformbeheer, met tweede stap.", 403);
  return draai(true);
}
