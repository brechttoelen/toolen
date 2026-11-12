import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Inlogkader from "@/components/Inlogkader";
import MfaScherm from "@/components/MfaScherm";
import { mfaStap } from "@/lib/mfa";
import { huisstijlVan } from "@/lib/huisstijlServer";
import { leesbaar } from "@/lib/huisstijl";

// Toolen Maps op de gsm: eigen schil zonder zijbalk. Login en 2FA zoals de rest van de app.
export const metadata: Metadata = {
  title: "Toolen Maps",
  manifest: "/pwa/manifest",
  appleWebApp: { capable: true, title: "Toolen", statusBarStyle: "black-translucent" },
  icons: { apple: "/pwa/icoon/180" },
};

export async function generateViewport({ params }: { params: Promise<{ org: string }> }): Promise<Viewport> {
  const { org } = await params;
  const h = await huisstijlVan(org);
  return { themeColor: h?.primair ? leesbaar(h.primair) : "#022056", width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function MobielLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  const supabase = await supabaseServer(org);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?verder=${encodeURIComponent("/maps/mobiel")}`);
  const stap = await mfaStap(supabase);
  if (stap) return <Inlogkader huisstijl={await huisstijlVan(org)}><MfaScherm stap={stap} /></Inlogkader>;
  return <>{children}</>;
}
