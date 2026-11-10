// Mails versturen. Resend (EU, Ierland) als RESEND_API_KEY er is, anders Brevo (BREVO_API_KEY).
// Resend volgt standaard geen links en geen openingen, Brevo wel.
// Afzender: MAIL_VAN (bv. no-reply@toolen.be), MAIL_VAN_NAAM (standaard "Toolen Maps").
// Elke mail heeft een HTML- en een tekstversie, in dezelfde rustige stijl als de app.

export type Mail = { aan: string; naam?: string | null; onderwerp: string; html: string; tekst: string; antwoordAan?: { email: string; naam?: string | null } | null };

export const mailIngesteld = () => !!(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY);
export const mailDienst = () => (process.env.RESEND_API_KEY ? "Resend" : process.env.BREVO_API_KEY ? "Brevo" : null);

const van = () => ({ email: process.env.MAIL_VAN || "no-reply@toolen.be", naam: process.env.MAIL_VAN_NAAM || "Toolen Maps" });
const adres = (email: string, naam?: string | null) => (naam ? `${naam.replace(/["<>]/g, "")} <${email}>` : email);

async function fout(r: Response) {
  const t = await r.text().catch(() => "");
  throw new Error(`De mail kon niet verstuurd worden (${r.status}). ${t.slice(0, 200)}`);
}

export async function verstuur(m: Mail): Promise<void> {
  const resend = process.env.RESEND_API_KEY; const brevo = process.env.BREVO_API_KEY;
  if (resend) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resend}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: adres(van().email, van().naam),
        to: [adres(m.aan, m.naam)],
        ...(m.antwoordAan ? { reply_to: adres(m.antwoordAan.email, m.antwoordAan.naam) } : {}),
        subject: m.onderwerp, html: m.html, text: m.tekst,
        tags: [{ name: "app", value: "toolen" }],
      }),
    });
    if (!r.ok) await fout(r);
    return;
  }
  if (!brevo) throw new Error("Mails versturen is nog niet ingesteld (RESEND_API_KEY of BREVO_API_KEY ontbreekt).");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevo, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: van().email, name: van().naam },
      to: [{ email: m.aan, ...(m.naam ? { name: m.naam } : {}) }],
      ...(m.antwoordAan ? { replyTo: { email: m.antwoordAan.email, ...(m.antwoordAan.naam ? { name: m.antwoordAan.naam } : {}) } } : {}),
      subject: m.onderwerp, htmlContent: m.html, textContent: m.tekst, tags: ["toolen"],
    }),
  });
  if (!r.ok) await fout(r);
}

import { leesbaar, type Huisstijl } from "./huisstijl";

// ---------- Sjablonen ----------
// Mails in gewone taal, zoals een collega ze zou schrijven, in de stijl van het platform:
// woordmerk of logo, één witte kaart met korte alinea's en één knop, een kleine voetnoot.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAVY = "#022056";
const TEKST = "#1F2328";
const STIL = "#6A717D";
const voornaam = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "";

type Blok = { tekst: string } | { knop: string; link: string };

function mail({ blokken, voet, huisstijl = null }: { blokken: Blok[]; voet: string[]; huisstijl?: Huisstijl }) {
  const kleur = leesbaar(huisstijl?.accent || huisstijl?.primair || NAVY);
  const logo = huisstijl?.logo_licht || huisstijl?.logo_donker;
  const merk = logo
    ? `<img src="${esc(logo)}" alt="${esc(huisstijl?.naam || "")}" height="28" style="display:block;height:28px;width:auto;max-width:200px;border:0;margin:0 0 18px">`
    : `<div style="margin:0 0 18px;font-size:19px;font-weight:700;color:${NAVY};letter-spacing:-.01em">toolen maps</div>`;
  const toolen = huisstijl && !huisstijl.toolen_verbergen ? "Verstuurd via Toolen Maps." : !huisstijl ? "Toolen Maps · toolen.be" : "";
  const regel = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEKST}">${t}</p>`;
  const knop = (k: string, l: string) => `<p style="margin:24px 0 24px"><a href="${esc(l)}" style="display:inline-block;background:${kleur};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:11px 18px;border-radius:6px">${esc(k)}</a></p>`;
  const link = blokken.find((b): b is { knop: string; link: string } => "knop" in b)?.link;
  // Wel het gevoel van het platform: lichtgrijs vlak, witte kaart, woordmerk of logo erboven. Geen grote titel.
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F5F8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F8"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;font-family:'IBM Plex Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px">${merk}</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E3E7ED;border-radius:10px;padding:28px 28px 12px">
${blokken.map((b) => ("knop" in b ? knop(b.knop, b.link) : regel(b.tekst))).join("\n")}
</td></tr>
<tr><td style="padding:16px 6px 0;font-size:12.5px;line-height:1.55;color:${STIL}">
${voet.map((v) => `<p style="margin:0 0 6px">${v}</p>`).join("")}
${link ? `<p style="margin:0 0 6px">Werkt de knop niet? Plak deze link in je browser: <a href="${esc(link)}" style="color:${STIL};word-break:break-all">${esc(link)}</a></p>` : ""}
${toolen ? `<p style="margin:12px 0 0">${toolen}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

function tekstVan(blokken: Blok[], voet: string[]) {
  const kaal = (t: string) => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return `${blokken.map((b) => ("knop" in b ? `${b.knop}: ${b.link}` : kaal(b.tekst))).join("\n\n")}\n\n-- \n${voet.map(kaal).join("\n")}\n`;
}

const DOEN: Record<string, string> = { eigenaar: "mee te beheren", beheerder: "mee te beheren", bewerker: "mee te werken aan", lezer: "mee te kijken naar" };
const WP: Record<string, string> = { sign: "Signalisatie", stroom: "Stroom", veiligheid: "Veiligheid", branding: "Branding", tv: "TV" };
const dag = (d: string | Date) => new Date(d).toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
const lijst = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} en ${l[l.length - 1]}`);

export function uitnodigingMail(g: { naam?: string | null; door?: string | null; organisatie: string; code: string; rol: string; evenementen?: string[]; werkplekken?: string[] | null; geldig_tot: string; link: string; huisstijl?: Huisstijl }) {
  const wie = g.door ? esc(g.door) : "Een collega";
  const wat = g.rol === "eigenaar" || g.rol === "beheerder"
    ? `om ${esc(g.organisatie)} mee te beheren in Toolen Maps`
    : `om ${DOEN[g.rol] || "mee te werken aan"} de plannen van ${esc(g.organisatie)}${g.huisstijl?.toolen_verbergen ? "" : " in Toolen Maps"}`;
  const ev = g.evenementen?.length ? `toegang tot ${lijst(g.evenementen.map(esc))}` : "";
  const wp = g.werkplekken?.length ? `werkt in ${lijst(g.werkplekken.map((w) => WP[w] || esc(w)))}` : "";
  const waar = ev && wp ? `Je hebt ${ev} en ${wp}.` : ev ? `Je hebt ${ev}.` : wp ? `Je ${wp}.` : "";
  const blokken: Blok[] = [
    { tekst: voornaam(g.naam) ? `Dag ${esc(voornaam(g.naam))},` : "Dag," },
    { tekst: `${wie} nodigt je uit ${wat}.${waar ? ` ${waar}` : ""}` },
    { knop: "Account aanmaken", link: g.link },
    { tekst: "Je kiest zelf een wachtwoord. Daarna stel je een code in met een app op je gsm, zoals Microsoft Authenticator of Google Authenticator. Hou je gsm dus even bij de hand." },
    { tekst: `Om later in te loggen gebruik je de bedrijfscode <strong>${esc(g.code.toUpperCase())}</strong>, samen met dit e-mailadres.` },
  ];
  const voet = [`De link werkt tot ${dag(g.geldig_tot)} en maar één keer. Verwachtte je deze uitnodiging niet? Dan mag je deze mail negeren.`];
  const onderwerp = `${g.door ? voornaam(g.door) : "Je collega"} nodigt je uit voor ${g.organisatie}`;
  return { onderwerp, html: mail({ blokken, voet, huisstijl: g.huisstijl }), tekst: tekstVan(blokken, voet) };
}

export function wachtwoordMail(g: { naam?: string | null; link: string; nieuw?: boolean }) {
  const aanhef = { tekst: voornaam(g.naam) ? `Dag ${esc(voornaam(g.naam))},` : "Dag," };
  const blokken: Blok[] = g.nieuw
    ? [aanhef,
       { tekst: "Inloggen in Toolen Maps gaat voortaan met je bedrijfscode, je e-mailadres en een eigen wachtwoord, en daarbij een code uit een app op je gsm." },
       { tekst: "Kies je wachtwoord via deze knop. Daarna stel je meteen de code op je gsm in." },
       { knop: "Wachtwoord instellen", link: g.link }]
    : [aanhef,
       { tekst: "Je vroeg een nieuw wachtwoord aan voor Toolen Maps. Kies het via deze knop." },
       { knop: "Nieuw wachtwoord kiezen", link: g.link },
       { tekst: "Daarna geef je zoals altijd de code uit de app op je gsm." }];
  const voet = [g.nieuw ? "De link werkt een uur en maar één keer. Is hij verlopen? Kies dan op het inlogscherm voor Wachtwoord vergeten." : "De link werkt een uur. Vroeg je niets aan? Dan hoef je niets te doen: je wachtwoord blijft hetzelfde."];
  return { onderwerp: g.nieuw ? "Stel je wachtwoord in voor Toolen Maps" : "Je nieuwe wachtwoord voor Toolen Maps", html: mail({ blokken, voet }), tekst: tekstVan(blokken, voet) };
}

export function mfaResetMail(g: { naam?: string | null; door?: string | null; organisatie: string; link: string }) {
  const wie = g.door ? esc(g.door) : "Een beheerder";
  const blokken: Blok[] = [
    { tekst: voornaam(g.naam) ? `Dag ${esc(voornaam(g.naam))},` : "Dag," },
    { tekst: `${wie} heeft de code op je gsm voor Toolen Maps gewist, bij ${esc(g.organisatie)}. Dat gebeurt meestal als je een nieuwe gsm hebt of de app kwijt bent.` },
    { tekst: "De volgende keer dat je inlogt, stel je de code opnieuw in." },
    { knop: "Inloggen", link: g.link },
  ];
  const voet = [`Vroeg je dit niet? Laat het ${g.door ? esc(voornaam(g.door)) : "je beheerder"} dan meteen weten en kies een nieuw wachtwoord.`];
  return { onderwerp: "De code op je gsm voor Toolen Maps is gewist", html: mail({ blokken, voet }), tekst: tekstVan(blokken, voet) };
}
