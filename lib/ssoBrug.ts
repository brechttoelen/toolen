import { createHash, randomBytes } from "crypto";
import { GRIDLAB_URL, GRIDLAB_PUBLIEK } from "./gridlabBron";

// Brug: leden van een organisatie melden zich aan met de Microsoft-koppeling van hun eigen omgeving
// (een ander Supabase-project), zonder eigen registratie van Toolen bij Microsoft.
// Per bedrijfscode: het project waar de aanmelding loopt. Adres en publieke sleutel zijn niet geheim.
// In dat project moet https://login.toolen.be/auth/brug bij de toegelaten terugkeeradressen staan
// (Authentication › URL Configuration › Redirect URLs).
export type Brug = { url: string; sleutel: string; provider: "azure" };
const BRUGGEN: Record<string, Brug> = {
  flcs: { url: GRIDLAB_URL, sleutel: GRIDLAB_PUBLIEK, provider: "azure" },
};
export const brugVoor = (slug: string | null | undefined): Brug | null => (slug && BRUGGEN[slug.toLowerCase()]) || null;

export const BRUG_COOKIE = "toolen_brug";
export const BRUG_PAD = "/auth/brug";

// PKCE: de code die terugkomt is enkel in te wisselen met het geheim dat in een eigen cookie staat.
export function pkce() {
  const geheim = randomBytes(48).toString("base64url");
  const uitdaging = createHash("sha256").update(geheim).digest("base64url");
  return { geheim, uitdaging };
}

type BrugGebruiker = { email?: string; identities?: { provider?: string; identity_data?: { email?: string } }[] };

// Wissel de code in bij het project van de brug. Geeft het e-mailadres van het Microsoft-account terug,
// of null als de aanmelding niet van Microsoft komt. De sessie daar wordt meteen weer afgemeld: Toolen heeft ze niet nodig.
export async function brugEmail(brug: Brug, code: string, geheim: string): Promise<string | null> {
  const r = await fetch(`${brug.url}/auth/v1/token?grant_type=pkce`, {
    method: "POST", cache: "no-store",
    headers: { apikey: brug.sleutel, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: geheim }),
  });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { access_token?: string; user?: BrugGebruiker } | null;
  const token = j?.access_token; const u = j?.user;
  if (token) {
    fetch(`${brug.url}/auth/v1/logout?scope=local`, { method: "POST", cache: "no-store", headers: { apikey: brug.sleutel, authorization: `Bearer ${token}` } }).catch(() => {});
  }
  if (!token || !u?.email) return null;
  // Enkel een aanmelding via Microsoft telt: de sessie moet met OAuth gemaakt zijn en het adres moet dat van
  // de Microsoft-identiteit zijn (niet van een account met wachtwoord in dat project).
  let methodes: string[] = [];
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { amr?: ({ method?: string } | string)[] };
    methodes = (p.amr || []).map((m) => (typeof m === "string" ? m : m.method || ""));
  } catch { return null; }
  if (!methodes.includes("oauth")) return null;
  const email = u.email.trim().toLowerCase();
  const id = (u.identities || []).find((i) => i.provider === brug.provider);
  if (!id || (id.identity_data?.email || "").trim().toLowerCase() !== email) return null;
  return email;
}
