import { HOOFDDOMEIN } from "./org";

// Adressen tussen organisaties en de centrale pagina's. Op toolen.be met subdomeinen,
// lokaal en op previews met ?org= (zie middleware).
function opEigenDomein(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === HOOFDDOMEIN || h.endsWith(`.${HOOFDDOMEIN}`);
}

export function orgAdres(slug: string, pad = "/maps"): string {
  if (opEigenDomein()) return `https://${slug}.${HOOFDDOMEIN}${pad}`;
  return `${pad}${pad.includes("?") ? "&" : "?"}org=${encodeURIComponent(slug)}`;
}

export function centraalAdres(pad: string): string {
  if (opEigenDomein()) return `https://login.${HOOFDDOMEIN}${pad}`;
  return pad;
}
