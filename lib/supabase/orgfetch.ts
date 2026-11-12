import { getOrganisatie } from "@/components/maps/merk";

// Elke vraag aan de databank draagt de actieve organisatie (header x-organisatie). Zo ziet en bewaart de databank
// enkel in die organisatie (RLS), en weet ze voor wie lid is van meerdere organisaties welke bedoeld is.
// De browserclient van Supabase is één gedeeld exemplaar: wie hem het eerst aanmaakt, bepaalt zijn instellingen.
// Daarom gebruikt elke plek die hem aanmaakt (lib/supabase/client.ts en components/maps/db.js) deze fetch.
// Weigert de browser de header (CORS), dan zonder header verder: de databank valt dan terug op je organisaties.
let metHeader = true;
export async function fetchMetOrganisatie(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || "";
  const slug = (getOrganisatie() as { slug?: string } | null)?.slug;
  if (!slug || !metHeader || !url.includes("/rest/v1/")) return fetch(input, init);
  const headers = new Headers(init.headers || (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined));
  headers.set("x-organisatie", slug);
  try {
    return await fetch(input, { ...init, headers });
  } catch (e) {
    if (!(e instanceof TypeError) || init.signal?.aborted) throw e;
    metHeader = false;
    console.warn("Toolen: header x-organisatie geweigerd, verder zonder", e);
    return fetch(input, init);
  }
}
