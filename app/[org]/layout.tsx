import { notFound } from "next/navigation";
import { geldigeSlug } from "@/lib/org";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseIngesteld } from "@/lib/supabase/env";
import OrganisatieZetter from "@/components/maps/OrganisatieZetter";
import { HuisstijlStijl } from "@/components/Huisstijl";
import { huisstijlVan } from "@/lib/huisstijlServer";

// Alles onder <org>.toolen.be. Naam en korte naam uit maps.organisaties (enkel zichtbaar
// voor leden); voor bezoekers van een deellink komt de naam uit de deellink zelf.
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  if (!geldigeSlug(org)) notFound();
  let organisatie: { slug: string; naam: string; kort: string; modules: string[] } = { slug: org, naam: org.toUpperCase(), kort: org.toUpperCase(), modules: [] };
  if (supabaseIngesteld()) {
    try {
      const sb = await supabaseServer(org);
      const { data } = await sb.from("organisaties").select("slug, naam, kort, modules").eq("slug", org).maybeSingle();
      if (data) organisatie = { slug: data.slug, naam: data.naam, kort: data.kort || data.naam, modules: data.modules || [] };
    } catch {}
  }
  // Eigen huisstijl (module huisstijl): kleuren voor de hele organisatie, ook op deellinks.
  const huisstijl = supabaseIngesteld() ? await huisstijlVan(org) : null;
  return (
    <>
      <HuisstijlStijl huisstijl={huisstijl} />
      <OrganisatieZetter organisatie={{ ...organisatie, huisstijl }} />
      {children}
    </>
  );
}
