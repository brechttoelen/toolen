import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fout, json, ok } from "@/lib/server";
import { PADEN } from "./paden";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Eenmalig, enkel voor platformbeheer: bestanden uit de oude (publieke) opslag van FLCS Maps naar de opslag van Toolen,
// op hetzelfde pad. Per aanvraag enkele bestanden (tijdslimiet). Wat er al staat, blijft staan.
const BRON = "https://vojkrpenkqsphaflsdfh.supabase.co/storage/v1/object/public/flcsmaps/";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: platform } = await sb.rpc("is_platformbeheerder");
  if (!platform) return fout("Enkel voor platformbeheer, met tweede stap.", 403);
  const b = await json<{ van: number; aantal: number }>(req);
  const van = Math.max(0, Number(b.van) || 0); const aantal = Math.min(4, Math.max(1, Number(b.aantal) || 1));
  const admin = supabaseAdmin();
  const uit: { pad: string; stand: string }[] = [];
  for (const pad of PADEN.slice(van, van + aantal)) {
    try {
      const r = await fetch(BRON + pad.split("/").map(encodeURIComponent).join("/"), { cache: "no-store" });
      if (!r.ok) { uit.push({ pad, stand: `bron ${r.status}` }); continue; }
      const blob = await r.blob();
      const { error } = await admin.storage.from("maps").upload(pad, blob, { contentType: r.headers.get("content-type") || "application/octet-stream", upsert: false });
      uit.push({ pad, stand: !error ? "ok" : /exists|duplicate/i.test(error.message) ? "stond er al" : `fout: ${error.message}` });
    } catch (e) { uit.push({ pad, stand: `fout: ${(e as Error).message}` }); }
  }
  return ok({ totaal: PADEN.length, volgende: van + aantal < PADEN.length ? van + aantal : null, uit });
}
