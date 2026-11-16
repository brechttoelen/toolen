import { createHash, randomBytes } from "crypto";

// Brug: leden van een organisatie melden zich aan met de Microsoft-koppeling van hun eigen omgeving
// (een ander Supabase-project), zonder eigen registratie van Toolen bij Microsoft.
// Per bedrijfscode: het project waar de aanmelding loopt. Adres en publieke sleutel zijn niet geheim.
// In dat project moet https://login.toolen.be/auth/brug bij de toegelaten terugkeeradressen staan
// (Authentication › URL Configuration › Redirect URLs).
// hubApp: de app in het toegangsbeheer van die omgeving (tabellen apps, user_access, group_access). Staat ze er, dan
// bepaalt de rol daar wie in Toolen binnen mag en met welke rol; anders geldt de ledenlijst in Toolen.
export type Brug = { url: string; sleutel: string; provider: "azure"; hubApp?: string; hubNaam?: string };
const BRUGGEN: Record<string, Brug> = {
  flcs: { url: "https://ecqfvrxbvmznxxsykgxp.supabase.co", sleutel: "sb_publishable_LsBUtiRF2oGCMQcatC3DHQ_1OaNZPeR", provider: "azure", hubApp: "flcs-maps", hubNaam: "de hub" },
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

type BrugGebruiker = { id?: string; email?: string; user_metadata?: { full_name?: string; name?: string }; identities?: { provider?: string; identity_data?: { email?: string } }[] };
export type BrugWie = { email: string; naam: string; rol: ToolenRol | null };

export type ToolenRol = "eigenaar" | "beheerder" | "bewerker" | "lezer";
// Rollen van de hub naar Toolen. Een rol die Toolen niet kent, telt als lezer.
const ROL: Record<string, ToolenRol> = { superadmin: "eigenaar", admin: "beheerder", editor: "bewerker", viewer: "lezer" };
export const hubRolNaar = (rol: string): ToolenRol => ROL[rol] || "lezer";

// De rol van de aangemelde gebruiker voor de app in het toegangsbeheer, gelezen met zijn eigen sessie (hij ziet enkel
// zijn eigen toegang). Zelfde regel als daar: een eigen rol gaat voor, anders de hoogste rol van zijn groepen.
async function hubRol(brug: Brug, token: string, uid: string): Promise<ToolenRol | null> {
  const lees = async <T>(pad: string): Promise<T[]> => {
    const r = await fetch(`${brug.url}/rest/v1/${pad}`, { cache: "no-store", headers: { apikey: brug.sleutel, authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`hub ${r.status}`);
    return (await r.json()) as T[];
  };
  const id = encodeURIComponent(uid);
  const [apps, profiel] = await Promise.all([
    lees<{ id: string; rollen: string[] | null }>(`apps?slug=eq.${encodeURIComponent(brug.hubApp!)}&select=id,rollen`),
    lees<{ geblokkeerd: boolean | null; goedgekeurd: boolean | null }>(`profiles?id=eq.${id}&select=geblokkeerd,goedgekeurd`),
  ]);
  const app = apps[0];
  if (!app || !profiel[0] || profiel[0].geblokkeerd || profiel[0].goedgekeurd === false) return null;
  const eigen = await lees<{ rol: string }>(`user_access?app_id=eq.${app.id}&user_id=eq.${id}&select=rol`);
  let rol: string | null = null;
  if (eigen.length) rol = eigen[0].rol === "geen" ? null : eigen[0].rol;
  else {
    const groepen = (await lees<{ group_id: string }>(`group_members?user_id=eq.${id}&select=group_id`)).map((g) => g.group_id);
    if (groepen.length) {
      const via = await lees<{ rol: string }>(`group_access?app_id=eq.${app.id}&group_id=in.(${groepen.join(",")})&select=rol`);
      const orde = app.rollen || [];
      rol = via.map((g) => g.rol).sort((a, b) => orde.indexOf(b) - orde.indexOf(a))[0] || null;
    }
  }
  if (!rol) return null;
  return hubRolNaar(rol);
}

// Wissel de code in bij het project van de brug. Geeft terug wie zich met Microsoft aanmeldde (en zijn rol, als de brug
// een toegangsbeheer heeft), of null als de aanmelding niet van Microsoft komt. De sessie daar wordt meteen weer
// afgemeld: Toolen heeft ze niet nodig.
export async function brugWie(brug: Brug, code: string, geheim: string): Promise<BrugWie | null> {
  const r = await fetch(`${brug.url}/auth/v1/token?grant_type=pkce`, {
    method: "POST", cache: "no-store",
    headers: { apikey: brug.sleutel, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: geheim }),
  });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { access_token?: string; user?: BrugGebruiker } | null;
  const token = j?.access_token; const u = j?.user;
  if (!token) return null;
  try {
    if (!u?.email || !u.id) return null;
    // Enkel een aanmelding via Microsoft telt: de sessie moet met OAuth gemaakt zijn en het adres moet dat van
    // de Microsoft-identiteit zijn (niet van een account met wachtwoord in dat project).
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { amr?: ({ method?: string } | string)[] };
    const methodes = (p.amr || []).map((m) => (typeof m === "string" ? m : m.method || ""));
    if (!methodes.includes("oauth")) return null;
    const email = u.email.trim().toLowerCase();
    const idt = (u.identities || []).find((i) => i.provider === brug.provider);
    if (!idt || (idt.identity_data?.email || "").trim().toLowerCase() !== email) return null;
    const naam = (u.user_metadata?.full_name || u.user_metadata?.name || "").trim();
    return { email, naam, rol: brug.hubApp ? await hubRol(brug, token, u.id) : null };
  } catch { return null; }
  finally {
    await fetch(`${brug.url}/auth/v1/logout?scope=local`, { method: "POST", cache: "no-store", headers: { apikey: brug.sleutel, authorization: `Bearer ${token}` } }).catch(() => {});
  }
}
