import { geldigeSlug } from "@/lib/org";
import { huisstijlVan } from "@/lib/huisstijlServer";
import { leesbaar } from "@/lib/huisstijl";

// Manifest van de app op het beginscherm, per organisatie: naam, kleur en icoon uit de huisstijl.
export async function GET(_req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  if (!geldigeSlug(org)) return new Response("Niet gevonden", { status: 404 });
  const h = await huisstijlVan(org);
  const kleur = h?.primair ? leesbaar(h.primair) : "#022056";
  const naam = h?.naam ? `${h.naam} · Toolen Maps` : "Toolen Maps";
  const icoon = (m: number, doel: string) => ({ src: `/pwa/icoon/${m}${doel === "maskable" ? "?m=1" : ""}`, sizes: `${m}x${m}`, type: "image/png", purpose: doel });
  const body = {
    id: "/maps/mobiel",
    name: naam,
    short_name: h?.kort || h?.naam || "Toolen",
    description: "Je eventplannen op schaal, ook ter plaatse.",
    lang: "nl",
    start_url: "/maps/mobiel",
    scope: "/maps/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F7FA",
    theme_color: kleur,
    icons: [icoon(192, "any"), icoon(512, "any"), icoon(192, "maskable"), icoon(512, "maskable")],
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } });
}
