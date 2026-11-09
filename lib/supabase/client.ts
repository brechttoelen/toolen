import { createBrowserClient } from "@supabase/ssr";
import { cookieOpties } from "./cookie";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "maps" }, cookieOptions: cookieOpties() },
  );
}
