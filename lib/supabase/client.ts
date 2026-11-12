import { createBrowserClient } from "@supabase/ssr";
import { cookieOpties } from "./cookie";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";
import { fetchMetOrganisatie } from "./orgfetch";

export function supabaseBrowser() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    { db: { schema: "maps" }, cookieOptions: cookieOpties(), global: { fetch: fetchMetOrganisatie } },
  );
}
