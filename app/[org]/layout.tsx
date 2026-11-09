import { notFound } from "next/navigation";
import { geldigeSlug } from "@/lib/org";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseIngesteld } from "@/lib/supabase/env";
import OrganisatieZetter from "@/components/maps/OrganisatieZetter";

// Alles onder <org>.toolen.be. Naam en korte naam uit maps.organisaties (enkel zichtbaar
// voor leden); voor bezoekers van een deellink komt de naam uit de deellink zelf.
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  if (!geldigeSlug(org)) notFound();
  let organisatie = { slug: org, naam: org.toUpperCase(), kort: org.toUpperCase() };
  if (supabaseIngesteld()) {
    try {
      const sb = await supabaseServer(org);
      const { data } = await sb.from("organisaties").select("slug, naam, kort").eq("slug", org).maybeSingle();
      if (data) organisatie = { slug: data.slug, naam: data.naam, kort: data.kort || data.naam };
    } catch {}
  }
  return (
    <>
      <OrganisatieZetter organisatie={organisatie} />
      {children}
    </>
  );
}
