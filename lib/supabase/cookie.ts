// Sessie-cookie op het hoofddomein (bv. .toolen.be), zodat één login geldt voor
// login.toolen.be en alle organisaties (flcs.toolen.be, vrt.toolen.be ...).
// Lokaal en op Vercel-previews leeg: dan geldt de cookie enkel voor de eigen host.
export function cookieOpties() {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  return domain ? { domain, path: "/", sameSite: "lax" as const, secure: true } : undefined;
}
