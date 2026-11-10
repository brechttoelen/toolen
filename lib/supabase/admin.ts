import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Serverclient met de geheime sleutel (service role): enkel in API-routes, nooit in de browser.
// Nodig om accounts aan te maken met een wachtwoord, inloglinks te maken en de tweede stap te wissen.
export function supabaseAdmin() {
  const sleutel = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!SUPABASE_URL || !sleutel) throw new Error("De geheime sleutel van Supabase (SUPABASE_SERVICE_ROLE_KEY) ontbreekt op de server.");
  return createClient(SUPABASE_URL, sleutel, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "maps" } });
}

export const adminIngesteld = () => !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
