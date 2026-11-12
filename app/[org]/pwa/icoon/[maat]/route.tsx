import { ImageResponse } from "next/og";
import { geldigeSlug } from "@/lib/org";
import { huisstijlVan } from "@/lib/huisstijlServer";
import { leesbaar } from "@/lib/huisstijl";

const MATEN = new Set([180, 192, 512]);

// Icoon van de app: grondkleur van de huisstijl met het logo, anders het Toolen-teken op navy.
// ?m=1: met extra rand voor Android (maskable), zodat niets wegvalt in een rond icoon.
export async function GET(req: Request, { params }: { params: Promise<{ org: string; maat: string }> }) {
  const { org, maat } = await params;
  const m = Number(maat);
  if (!geldigeSlug(org) || !MATEN.has(m)) return new Response("Niet gevonden", { status: 404 });
  const h = await huisstijlVan(org);
  const grond = h?.primair ? leesbaar(h.primair) : "#022056";
  const logo = h?.logo_donker || h?.logo_licht || null;
  const rand = new URL(req.url).searchParams.get("m") ? 0.26 : 0.16;
  const binnen = Math.round(m * (1 - 2 * rand));
  const s = binnen * 0.27; const r = binnen * 0.07;
  const vak = (cx: number, cy: number, kleur: string) => (
    <div style={{ position: "absolute", left: cx - s / 2, top: cy - s / 2, width: s, height: s, borderRadius: r, background: kleur, transform: "rotate(45deg)" }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: m, height: m, background: grond, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" width={binnen} height={binnen} style={{ objectFit: "contain" }} />
        ) : (
          <div style={{ width: binnen, height: binnen, position: "relative", display: "flex" }}>
            {vak(binnen * 0.5, binnen * 0.22, "#108AED")}
            {vak(binnen * 0.78, binnen * 0.5, "#28B571")}
            {vak(binnen * 0.22, binnen * 0.5, "#FFFFFF")}
            {vak(binnen * 0.5, binnen * 0.78, "#FFFFFF")}
          </div>
        )}
      </div>
    ),
    { width: m, height: m, headers: { "cache-control": "public, max-age=86400" } },
  );
}
