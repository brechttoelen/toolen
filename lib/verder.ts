import { HOOFDDOMEIN } from "./org";

// Waar mag een gebruiker na het inloggen naartoe? Enkel een pad op dezelfde host of een
// adres onder het eigen hoofddomein (geen open redirect).
export function veiligVerder(verder: string | null | undefined, standaard = "/maps"): string {
  if (!verder) return standaard;
  if (verder.startsWith("/") && !verder.startsWith("//")) return verder;
  try {
    const u = new URL(verder);
    const h = u.hostname.toLowerCase();
    if (u.protocol === "https:" && (h === HOOFDDOMEIN || h.endsWith(`.${HOOFDDOMEIN}`))) return u.toString();
  } catch {}
  return standaard;
}
