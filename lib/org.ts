// Organisatie uit het adres halen.
//   flcs.toolen.be/maps      → org "flcs"
//   login.toolen.be          → geen org (centraal inloggen)
//   toolen.be, www.toolen.be → geen org (bedrijfssite)
// Lokaal en op Vercel-previews (geen subdomein per klant): ?org=flcs, onthouden in een cookie,
// anders TOOLEN_STANDAARD_ORG.

export const HOOFDDOMEIN = process.env.NEXT_PUBLIC_HOOFDDOMEIN || "toolen.be";

// Nooit als slug van een organisatie.
export const GERESERVEERD = new Set([
  "www", "app", "login", "api", "admin", "beheer", "status", "docs", "help", "mail", "d",
  "maps", "stock", "cdn", "static", "demo", "test", "staging", "auth", "m", "_next",
]);

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function geldigeSlug(s: string | null | undefined): s is string {
  return !!s && SLUG.test(s) && !GERESERVEERD.has(s);
}

// Subdomein vóór het hoofddomein, of null.
export function subdomein(host: string): string | null {
  const h = host.toLowerCase().split(":")[0];
  if (h === HOOFDDOMEIN || !h.endsWith(`.${HOOFDDOMEIN}`)) {
    // vrt.localhost voor lokaal testen
    if (h.endsWith(".localhost")) return h.slice(0, -".localhost".length) || null;
    return null;
  }
  const sub = h.slice(0, -(HOOFDDOMEIN.length + 1));
  return sub.includes(".") ? null : sub;
}

export function isEigenDomein(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return h === HOOFDDOMEIN || h.endsWith(`.${HOOFDDOMEIN}`) || h === "localhost" || h.endsWith(".localhost");
}
