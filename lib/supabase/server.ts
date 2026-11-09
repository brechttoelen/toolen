import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookieOpties } from "./cookie";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";

// Serverclient met sessie in cookies. Standaardschema maps.
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      db: { schema: "maps" },
      cookieOptions: cookieOpties(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Aanroep vanuit een server component: de middleware ververst de
            // sessie al, dus dit mag stil falen.
          }
        },
      },
    },
  );
}
