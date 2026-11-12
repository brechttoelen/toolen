import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Bestanden uit de (privé) opslag van Toolen Maps via het eigen adres (bv. flcs.toolen.be/b/<plan>/fotos/…),
// zodat nergens in de app, een PDF of een deellink het adres van de databank verschijnt.
// De databank beslist per pad wie het mag zien (maps.bestand_mag): ingelogde leden van de organisatie,
// of wie een geldige deellink heeft (?t=<token>). De server haalt het bestand daarna op met de geheime sleutel.
const BUCKET = "maps";

export async function GET(req: NextRequest, { params }: { params: Promise<{ pad: string[] }> }) {
  const { pad } = await params;
  if (!pad?.length || pad.some((d) => !d || d === "." || d === ".." || d.includes("\\"))) return new Response("Niet gevonden", { status: 404 });
  const naam = pad.map((d) => decodeURIComponent(d)).join("/");
  const token = req.nextUrl.searchParams.get("t");

  let mag = false;
  try {
    const sb = await supabaseServer();
    const { data } = await sb.rpc("bestand_mag", { p_pad: naam, p_token: token && token.length >= 20 ? token : null });
    mag = data === true;
  } catch { mag = false; }
  // Zelfde antwoord voor "bestaat niet" en "mag niet": geen hint of een pad bestaat.
  if (!mag) return new Response("Niet gevonden", { status: 404, headers: { "cache-control": "no-store" } });

  let blob: Blob | null = null;
  try {
    const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(naam);
    if (error) return new Response("Niet gevonden", { status: 404, headers: { "cache-control": "no-store" } });
    blob = data;
  } catch { return new Response("Bestand tijdelijk niet bereikbaar", { status: 502 }); }
  if (!blob) return new Response("Niet gevonden", { status: 404 });

  const h = new Headers();
  let type = blob.type || "application/octet-stream";
  // Opgeladen bestanden tonen, nooit als pagina van deze site uitvoeren.
  if (/html|xml|javascript/i.test(type)) type = "text/plain; charset=utf-8";
  h.set("content-type", type);
  h.set("content-length", String(blob.size));
  h.set("x-content-type-options", "nosniff");
  h.set("content-security-policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
  // Huisstijl (logo's op de loginpagina) mag gedeeld bewaard worden; al de rest enkel in de eigen browser.
  h.set("cache-control", naam.startsWith("huisstijl/") ? "public, max-age=3600, s-maxage=86400" : "private, max-age=600");
  h.set("vary", "Cookie");
  return new Response(blob.stream(), { status: 200, headers: h });
}
