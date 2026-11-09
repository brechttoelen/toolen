import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FeedbackKnop from "@/components/maps/Feedback";

// Toolen Maps binnen een organisatie. De rol komt uit maps.ik() (fase 2: uit de tabel leden
// van deze organisatie). Zonder login naar het centrale inlogscherm.
export const metadata: Metadata = { title: { default: "Toolen Maps", template: "%s · Toolen Maps" } };

type Ik = { role?: string; email?: string; display_name?: string } | null;

export default async function MapsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?verder=/maps");
  const profiel = (await supabase.schema("maps").rpc("ik")).data as Ik;
  if (!profiel || !profiel.role) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Geen toegang</h1>
        <p style={{ color: "#555" }}>
          {auth.user.email} heeft nog geen toegang tot deze organisatie. Vraag een beheerder om je uit te nodigen.
        </p>
      </main>
    );
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F7F6" }}>
      <nav className="fm-merkbalk" style={{ display: "flex", alignItems: "center", gap: 20, height: 48, padding: "0 20px", background: "#1d1d1b", color: "#fff", flex: "0 0 auto" }}>
        <Link href="/maps" style={{ color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ width: 14, height: 14, background: "#E11D48", display: "inline-block" }} />
          Toolen Maps
        </Link>
        <Link href="/maps" style={{ color: "#d6d6d3", textDecoration: "none", fontSize: 14 }}>Plannen</Link>
        <Link href="/maps/bibliotheek" style={{ color: "#d6d6d3", textDecoration: "none", fontSize: 14 }}>Bibliotheek</Link>
        <Link href="/maps/leveranciers" style={{ color: "#d6d6d3", textDecoration: "none", fontSize: 14 }}>Leveranciers</Link>
        <Link href="/maps/feedback" style={{ color: "#d6d6d3", textDecoration: "none", fontSize: 14 }}>Feedback</Link>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#a9a9a5" }}>{profiel?.display_name || profiel?.email}</span>
        <span className="fm"><FeedbackKnop klein /></span>
      </nav>
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
