// Brug: adressen van de organisatie zelf melden zich enkel aan via Microsoft (via de eigen omgeving van de organisatie),
// niet met een wachtwoord. Per bedrijfscode het domein van die adressen. Ook in de browser bruikbaar (geen geheimen).
const DOMEIN: Record<string, string> = { flcs: "flandersclassics.be" };

export function enkelViaBrug(slug: string | null | undefined, email: string | null | undefined): boolean {
  const d = slug ? DOMEIN[slug.toLowerCase()] : null;
  return !!d && !!email && email.trim().toLowerCase().endsWith(`@${d}`);
}
