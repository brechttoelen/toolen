import { SUPABASE_URL } from "@/lib/supabase/env";

// Bestanden uit de opslag van Toolen Maps via het eigen adres (bv. flcs.toolen.be/b/ontwerpen/…),
// zodat nergens in de app, een PDF of een deellink het adres van de databank verschijnt.
// Enkel de publieke bucket "maps"; wat daar niet staat, geeft 404.
const BUCKET = "maps";

export async function GET(_req: Request, { params }: { params: Promise<{ pad: string[] }> }) {
  const { pad } = await params;
  if (!pad?.length || pad.some((d) => !d || d === "." || d === ".." || d.includes("\\"))) return new Response("Niet gevonden", { status: 404 });
  const bron = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${pad.map(encodeURIComponent).join("/")}`;
  let r: Response;
  try { r = await fetch(bron, { cache: "no-store" }); } catch { return new Response("Bestand tijdelijk niet bereikbaar", { status: 502 }); }
  if (!r.ok || !r.body) return new Response("Niet gevonden", { status: r.status === 400 ? 404 : r.status || 404 });
  const h = new Headers();
  for (const k of ["content-type", "content-length", "last-modified", "etag"]) { const v = r.headers.get(k); if (v) h.set(k, v); }
  h.set("cache-control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  h.set("x-content-type-options", "nosniff");
  // Opgeladen bestanden tonen, nooit als pagina van deze site uitvoeren.
  if (/html|xml|javascript/i.test(h.get("content-type") || "")) h.set("content-type", "text/plain; charset=utf-8");
  return new Response(r.body, { status: 200, headers: h });
}
