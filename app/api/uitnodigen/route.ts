import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { mailIngesteld, uitnodigingMail, verstuur } from "@/lib/mail";
import { basisAdres, fout, foutTekst, json, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

type Vraag = { organisatie_id: string; email: string; naam: string; rol: string; event_ids: string[] | null; opnieuw: string };
type Gegevens = { email: string; naam: string | null; rol: string; organisatie: string; code: string; geldig_tot: string; door: string | null; door_email: string | null; evenementen: string[] };

// Uitnodigen (of opnieuw versturen) en de mail sturen. De rechten controleert de database
// (enkel beheerders van de organisatie of het platform).
export async function POST(req: NextRequest) {
  const b = await json<Vraag>(req);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fout("Niet ingelogd.", 401);

  let id: string; let token: string;
  if (b.opnieuw) {
    const { data, error } = await sb.rpc("uitnodiging_vernieuwen", { p_id: b.opnieuw });
    if (error) return fout(foutTekst(error));
    ({ id, token } = data as { id: string; token: string });
  } else {
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fout("Geef een geldig e-mailadres.");
    if (!["eigenaar", "beheerder", "bewerker", "lezer"].includes(String(b.rol))) return fout("Kies een rol.");
    const { data, error } = await sb.rpc("uitnodiging_maken", {
      p_org: b.organisatie_id, p_email: email, p_naam: String(b.naam || "").trim() || null, p_rol: b.rol,
      p_event_ids: Array.isArray(b.event_ids) && b.event_ids.length ? b.event_ids : null,
    });
    if (error) return fout(foutTekst(error));
    ({ id, token } = data as { id: string; token: string });
  }

  const link = `${basisAdres(req)}/uitnodiging/${token}`;
  if (!mailIngesteld()) return ok({ id, link, verstuurd: false, melding: "Mails versturen is nog niet ingesteld: stuur de link zelf door." });
  const { data: g } = await sb.rpc("uitnodiging_mailgegevens", { p_id: id });
  const gg = g as Gegevens | null;
  if (!gg) return ok({ id, link, verstuurd: false });
  try {
    const m = uitnodigingMail({ ...gg, link });
    await verstuur({ aan: gg.email, naam: gg.naam, ...m, antwoordAan: gg.door_email ? { email: gg.door_email, naam: gg.door } : null });
    await sb.rpc("uitnodiging_verstuurd", { p_id: id });
    return ok({ id, link, verstuurd: true });
  } catch (e) {
    return ok({ id, link, verstuurd: false, melding: `${foutTekst(e)} Stuur de link zelf door.` });
  }
}
