import { Suspense } from "react";
import InlogScherm from "@/components/InlogScherm";
import { huisstijlVan } from "@/lib/huisstijlServer";
import { geldigeSlug, subdomein } from "@/lib/org";

export const metadata = { title: "Inloggen" };

// Bedrijfscode uit ?code= of uit het adres waar je naartoe gaat (flcs.toolen.be).
function codeVan(code?: string, verder?: string): string | null {
  const c = code?.toLowerCase();
  if (geldigeSlug(c)) return c;
  try { const s = verder ? subdomein(new URL(verder).host) : null; if (geldigeSlug(s)) return s; } catch {}
  return null;
}

// Centraal inloggen (login.toolen.be). Na het inloggen terug naar ?verder=.
// Met een bedrijfscode in het adres: in de huisstijl van dat bedrijf.
export default async function Login({ searchParams }: { searchParams: Promise<{ code?: string; verder?: string }> }) {
  const z = await searchParams;
  const huisstijl = await huisstijlVan(codeVan(z.code, z.verder));
  return (
    <Suspense>
      <InlogScherm huisstijl={huisstijl} />
    </Suspense>
  );
}
