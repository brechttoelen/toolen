import type { Metadata } from "next";
import DeelPagina from "@/components/maps/DeelPagina";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase/env";

type Kop = { naam?: string | null; plan?: string | null; editie?: string | null; locatie?: string | null; taal?: string | null; binnen?: string | null };

const SOORT: Record<string, { binnen: string; kaart: string }> = {
  nl: { binnen: "Binnenplan", kaart: "Sitekaart" },
  fr: { binnen: "Plan intérieur", kaart: "Plan du site" },
  en: { binnen: "Floor plan", kaart: "Site map" },
};

// Kop van de deel-link (naam, event, gebouw) zonder het openen mee te tellen.
async function leesKop(token: string): Promise<Kop | null> {
  const url = SUPABASE_URL; const key = SUPABASE_KEY;
  if (!url || !key || !token || token.length < 20) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/deel_link_kop`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Profile": "maps", "Accept-Profile": "maps" },
      body: JSON.stringify({ p_token: token }),
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    return (await r.json()) as Kop | null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const k = await leesKop(token);
  const robots = { index: false, follow: false };
  if (!k) return { title: "Toolen Maps", description: "Gedeeld plan", robots };
  const s = SOORT[k.taal || "nl"] || SOORT.nl;
  const event = [k.plan, k.editie].filter(Boolean).join(" · ");
  const titel = [k.naam, event].filter((x, i, l) => x && l.indexOf(x) === i).join(" · ") || "Toolen Maps";
  const omschrijving = [k.binnen ? `${s.binnen} ${k.binnen}` : s.kaart, k.locatie].filter(Boolean).join(" · ");
  return {
    title: titel,
    description: omschrijving,
    robots,
    openGraph: { title: titel, description: omschrijving, siteName: "Toolen Maps", type: "website", locale: k.taal === "fr" ? "fr_BE" : k.taal === "en" ? "en_GB" : "nl_BE" },
    twitter: { card: "summary", title: titel, description: omschrijving },
  };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DeelPagina token={token} />;
}
