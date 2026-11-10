// Wachtwoordbeleid (NIST SP 800-63B-4): lang genoeg, geen verplichte tekens, niet uit een datalek,
// geen e-mailadres of naam van de app erin. Zelfde regels in de browser (meter) en op de server.

export const MIN_LENGTE = 12;
export const MAX_LENGTE = 128;

const ZWAK = ["wachtwoord", "password", "toolen", "azerty", "qwerty", "123456", "welkom", "flanders"];

export function beleidFout(pw: string, email?: string | null): string | null {
  if (pw.length < MIN_LENGTE) return `Kies minstens ${MIN_LENGTE} tekens. Een zin van een paar woorden is makkelijk te onthouden.`;
  if (pw.length > MAX_LENGTE) return `Hoogstens ${MAX_LENGTE} tekens.`;
  const klein = pw.toLowerCase();
  const lokaal = (email || "").toLowerCase().split("@")[0];
  if (lokaal.length >= 4 && klein.includes(lokaal)) return "Je e-mailadres mag niet in je wachtwoord staan.";
  if (new Set(klein).size < 5) return "Dit wachtwoord is te eenvoudig: gebruik meer verschillende tekens.";
  if (ZWAK.some((w) => klein.replace(/[^a-z0-9]/g, "").startsWith(w) && klein.length < w.length + 6)) return "Dit wachtwoord is te voorspelbaar.";
  return null;
}

// Sterkte voor de meter (0 tot 4), enkel als hulp.
export function sterkte(pw: string): number {
  if (!pw) return 0;
  let s = pw.length >= MIN_LENGTE ? 2 : pw.length >= 8 ? 1 : 0;
  if (pw.length >= 16) s++;
  const soorten = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (soorten >= 3 || pw.split(/\s+/).length >= 3) s++;
  return Math.min(4, s);
}

// Komt dit wachtwoord voor in een gekend datalek? (Have I Been Pwned, k-anonimiteit: enkel de
// eerste 5 tekens van de SHA-1-hash gaan over het net.) Geen antwoord: niet blokkeren.
export async function inDatalek(pw: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const r = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, cache: "no-store" });
    if (!r.ok) return false;
    const rest = hex.slice(5);
    return (await r.text()).split("\n").some((l) => { const [h, n] = l.trim().split(":"); return h === rest && Number(n) > 0; });
  } catch {
    return false;
  }
}

export async function controleerWachtwoord(pw: string, email?: string | null): Promise<string | null> {
  const f = beleidFout(pw, email);
  if (f) return f;
  if (await inDatalek(pw)) return "Dit wachtwoord staat in een gekend datalek. Kies een ander.";
  return null;
}
