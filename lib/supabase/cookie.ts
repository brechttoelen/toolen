// Sessie-cookie op het hoofddomein (bv. .toolen.be), zodat één login geldt voor
// login.toolen.be en alle organisaties (flcs.toolen.be, vrt.toolen.be ...).
// Lokaal en op Vercel-previews leeg: dan geldt de cookie enkel voor de eigen host.
// De testomgeving (.test.toolen.be) krijgt een eigen cookienaam: de cookie van live (.toolen.be)
// wordt ook naar test.toolen.be gestuurd, en met dezelfde naam raakten de twee sessies door elkaar.
export function cookieOpties() {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (!domain) return undefined;
  const test = /(^|\.)test\./.test(domain.replace(/^\./, ""));
  return { domain, path: "/", sameSite: "lax" as const, secure: true, ...(test ? { name: "sb-toolen-test" } : {}) };
}
