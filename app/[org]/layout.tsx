import { notFound } from "next/navigation";
import { geldigeSlug } from "@/lib/org";
import OrganisatieZetter from "@/components/maps/OrganisatieZetter";

// Alles onder <org>.toolen.be. Fase 2: naam, logo en pakket uit de tabel organisaties.
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  if (!geldigeSlug(org)) notFound();
  const organisatie = { slug: org, naam: org.toUpperCase(), kort: org.toUpperCase() };
  return (
    <>
      <OrganisatieZetter organisatie={organisatie} />
      {children}
    </>
  );
}
