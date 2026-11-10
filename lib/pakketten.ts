// Pakketten, modules en statussen (zie ONTWERP-accounts-pakketten.md).
export const MODULES: { id: string; naam: string; uitleg: string }[] = [
  { id: "stroom", naam: "Stroom", uitleg: "bronnen, kasten, kabels, belasting, eendraadschema" },
  { id: "signalisatie", naam: "Signalisatie", uitleg: "routes, borden, plakpijlen, bestellijst" },
  { id: "stelling", naam: "Stellingbouwer 3D", uitleg: "stellingen, bruggen, tribunes, stuklijst" },
  { id: "branding", naam: "Branding", uitleg: "doeken, totems, vlaggen, brandingplan" },
  { id: "veiligheid", naam: "Veiligheid", uitleg: "brandveiligheid, botsingen, hulpdiensten, attesten" },
  { id: "binnen", naam: "Binnenplan", uitleg: "grondplannen, zalen, meubilair" },
  { id: "groot", naam: "Groot formaat", uitleg: "vrij papier, rasterplan, bladindeling" },
  { id: "terrein", naam: "Terrein", uitleg: "opbouwmodus offline, afvinken, foto's" },
  { id: "leveranciers", naam: "Leveranciers", uitleg: "links en lijsten per leverancier, taal" },
  { id: "huisstijl", naam: "Huisstijl", uitleg: "eigen logo en kleuren in de app, op deellinks, in PDF en mails" },
  { id: "integraties", naam: "Integraties", uitleg: "API" },
];
export const KOPPELINGEN: { id: string; naam: string }[] = [
  { id: "stock", naam: "Stock (Publitool)" },
  { id: "gridlab", naam: "GridLab" },
];

export const PAKKETTEN: { id: string; naam: string; plaatsen: number; lezers: number; modules: string[] }[] = [
  { id: "proef", naam: "Proef", plaatsen: 5, lezers: 25, modules: MODULES.map((m) => m.id).filter((m) => m !== "integraties" && m !== "huisstijl") },
  { id: "event", naam: "Event", plaatsen: 5, lezers: 25, modules: [] },
  { id: "pro", naam: "Pro", plaatsen: 5, lezers: 25, modules: [] },
  { id: "organisatie", naam: "Organisatie", plaatsen: 20, lezers: 100, modules: MODULES.map((m) => m.id).filter((m) => m !== "integraties" && m !== "huisstijl") },
  { id: "maatwerk", naam: "Maatwerk", plaatsen: 50, lezers: 1000, modules: MODULES.map((m) => m.id) },
];

export const STATUSSEN: { id: string; naam: string; pil: string }[] = [
  { id: "proef", naam: "Proef", pil: "blauw" },
  { id: "actief", naam: "Actief", pil: "ok" },
  { id: "achterstallig", naam: "Betaling open", pil: "let-op" },
  { id: "alleen_lezen", naam: "Alleen lezen", pil: "let-op" },
  { id: "geblokkeerd", naam: "Geblokkeerd", pil: "fout" },
  { id: "verwijderd", naam: "Verwijderd", pil: "" },
];
export const statusVan = (id: string) => STATUSSEN.find((s) => s.id === id) || { id, naam: id, pil: "" };
export const pakketVan = (id: string) => PAKKETTEN.find((p) => p.id === id) || { id, naam: id, plaatsen: 5, lezers: 25, modules: [] };

export const ROLLEN: { id: string; naam: string; uitleg: string }[] = [
  { id: "eigenaar", naam: "Eigenaar", uitleg: "alles, ook abonnement en eigenaars" },
  { id: "beheerder", naam: "Beheerder", uitleg: "leden, instellingen, bibliotheek" },
  { id: "bewerker", naam: "Bewerker", uitleg: "plannen maken en delen" },
  { id: "lezer", naam: "Lezer", uitleg: "bekijken, opmerkingen, opbouwmodus (gratis)" },
];
export const rolNaam = (id: string) => ROLLEN.find((r) => r.id === id)?.naam || id;

export function slugVan(naam: string) {
  return naam.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}

export function uitnodigingsAdres(token: string) {
  if (typeof window === "undefined") return `/uitnodiging/${token}`;
  const h = window.location.hostname;
  const dom = process.env.NEXT_PUBLIC_HOOFDDOMEIN || "toolen.be";
  if (h === dom || h.endsWith(`.${dom}`)) return `https://login.${dom}/uitnodiging/${token}`;
  return `${window.location.origin}/uitnodiging/${token}`;
}

export const datum = (t?: string | null) => (t ? new Date(t).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }) : "");
export const tijdstip = (t?: string | null) => (t ? new Date(t).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
