import { SUPABASE_URL, SUPABASE_KEY } from "./supabase/env";
import type { Huisstijl } from "./huisstijl";

// Huisstijl ophalen op de server, zonder sessie (ook voor het inlogscherm en deellinks). 5 minuten bewaard.
async function rpc(naam: string, body: Record<string, unknown>): Promise<Huisstijl> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${naam}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Content-Profile": "maps", "Accept-Profile": "maps" },
      body: JSON.stringify(body),
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    return ((await r.json()) as Huisstijl) || null;
  } catch { return null; }
}

export const huisstijlVan = (slug: string | null | undefined) => (slug ? rpc("huisstijl", { p_slug: slug }) : Promise.resolve(null));
export const huisstijlVanDeellink = (token: string) => rpc("huisstijl_deellink", { p_token: token });
