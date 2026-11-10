// Mails versturen via Brevo (Europees). Sleutel en afzender staan in de omgeving van de server:
//   BREVO_API_KEY, MAIL_VAN (bv. no-reply@toolen.be), MAIL_VAN_NAAM (standaard "Toolen Maps").
// Elke mail heeft een HTML- en een tekstversie, in dezelfde rustige stijl als de app.

export type Mail = { aan: string; naam?: string | null; onderwerp: string; html: string; tekst: string; antwoordAan?: { email: string; naam?: string | null } | null };

export const mailIngesteld = () => !!process.env.BREVO_API_KEY;

export async function verstuur(m: Mail): Promise<void> {
  const sleutel = process.env.BREVO_API_KEY;
  if (!sleutel) throw new Error("Mails versturen is nog niet ingesteld (BREVO_API_KEY ontbreekt).");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": sleutel, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: process.env.MAIL_VAN || "no-reply@toolen.be", name: process.env.MAIL_VAN_NAAM || "Toolen Maps" },
      to: [{ email: m.aan, ...(m.naam ? { name: m.naam } : {}) }],
      ...(m.antwoordAan ? { replyTo: { email: m.antwoordAan.email, ...(m.antwoordAan.naam ? { name: m.antwoordAan.naam } : {}) } } : {}),
      subject: m.onderwerp,
      htmlContent: m.html,
      textContent: m.tekst,
      tags: ["toolen"],
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`De mail kon niet verstuurd worden (${r.status}). ${t.slice(0, 200)}`);
  }
}

// ---------- Sjablonen ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAVY = "#022056";

// Eén kader voor alle mails: woordmerk, titel, tekst, één knop, de link als tekst, voetnoot.
function kader({ titel, alineas, knop, link, voet }: { titel: string; alineas: string[]; knop?: string; link?: string; voet: string }) {
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#22262E">${t}</p>`;
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titel)}</title></head>
<body style="margin:0;padding:0;background:#F3F5F8;font-family:'IBM Plex Sans',Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F8;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 18px;font-size:21px;font-weight:700;letter-spacing:-.01em;color:${NAVY}">toolen maps</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E3E7ED;border-radius:10px;padding:30px 28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${NAVY};font-weight:700">${esc(titel)}</h1>
${alineas.map(p).join("\n")}
${knop && link ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 18px"><tr><td style="background:${NAVY};border-radius:8px">
<a href="${esc(link)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none">${esc(knop)}</a></td></tr></table>
<p style="margin:0;font-size:12.5px;line-height:1.5;color:#6B7380">Werkt de knop niet? Kopieer deze link in je browser:<br><a href="${esc(link)}" style="color:${NAVY};word-break:break-all">${esc(link)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 6px 0;font-size:12px;line-height:1.5;color:#7A828F">${voet}</td></tr>
</table></td></tr></table></body></html>`;
}

const tekstVan = (titel: string, alineas: string[], link?: string, voet?: string) =>
  [titel, "", ...alineas.map((a) => a.replace(/<[^>]+>/g, "")), ...(link ? ["", link] : []), "", (voet || "").replace(/<[^>]+>/g, ""), "", "Toolen Maps"].join("\n");

const ROL: Record<string, string> = { eigenaar: "eigenaar", beheerder: "beheerder", bewerker: "bewerker", lezer: "lezer" };
const dag = (d: string | Date) => new Date(d).toLocaleDateString("nl-BE", { day: "numeric", month: "long" });

export function uitnodigingMail(g: { naam?: string | null; door?: string | null; organisatie: string; code: string; rol: string; evenementen?: string[]; geldig_tot: string; link: string }) {
  const titel = `Je bent uitgenodigd voor ${g.organisatie}`;
  const wie = g.door ? `<strong>${esc(g.door)}</strong> nodigt je uit` : "Je bent uitgenodigd";
  const ev = g.evenementen?.length ? ` voor ${g.evenementen.map(esc).join(", ")}` : "";
  const alineas = [
    `${g.naam ? `Dag ${esc(g.naam.split(" ")[0])},` : "Dag,"}`,
    `${wie} om als ${ROL[g.rol] || esc(g.rol)} mee te werken aan de plannen van <strong>${esc(g.organisatie)}</strong>${ev} in Toolen Maps.`,
    `Maak je account aan met een eigen wachtwoord. Daarna stel je een code in op je gsm (tweestapsverificatie): zo kan niemand anders met je wachtwoord binnen.`,
    `Je bedrijfscode is <strong>${esc(g.code.toUpperCase())}</strong>. Die heb je later nodig om in te loggen.`,
  ];
  const voet = `Deze uitnodiging is geldig tot ${dag(g.geldig_tot)} en werkt één keer. Verwachtte je deze mail niet? Dan mag je ze negeren.`;
  return { onderwerp: `${g.door || "Je collega"} nodigt je uit voor ${g.organisatie} in Toolen Maps`, html: kader({ titel, alineas, knop: "Account aanmaken", link: g.link, voet }), tekst: tekstVan(titel, alineas, g.link, voet) };
}

export function wachtwoordMail(g: { naam?: string | null; link: string; nieuw?: boolean }) {
  const titel = g.nieuw ? "Stel je wachtwoord in" : "Nieuw wachtwoord kiezen";
  const alineas = g.nieuw
    ? [`${g.naam ? `Dag ${esc(g.naam.split(" ")[0])},` : "Dag,"}`, "Inloggen in Toolen Maps gebeurt voortaan met je bedrijfscode, je e-mailadres en een eigen wachtwoord, telkens met een code uit een app op je gsm.", "Kies hieronder je wachtwoord. Daarna stel je de code op je gsm in."]
    : [`${g.naam ? `Dag ${esc(g.naam.split(" ")[0])},` : "Dag,"}`, "Je vroeg om een nieuw wachtwoord voor Toolen Maps. Kies het via de knop hieronder.", "Na het nieuwe wachtwoord vraagt Toolen nog altijd de code uit je app."];
  const voet = "Deze link is 1 uur geldig en werkt één keer. Vroeg je dit niet aan? Dan mag je deze mail negeren: je wachtwoord blijft hetzelfde.";
  return { onderwerp: titel, html: kader({ titel, alineas, knop: g.nieuw ? "Wachtwoord instellen" : "Nieuw wachtwoord kiezen", link: g.link, voet }), tekst: tekstVan(titel, alineas, g.link, voet) };
}

export function mfaResetMail(g: { naam?: string | null; door?: string | null; organisatie: string; link: string }) {
  const titel = "Je tweestapsverificatie werd gewist";
  const alineas = [
    `${g.naam ? `Dag ${esc(g.naam.split(" ")[0])},` : "Dag,"}`,
    `${g.door ? esc(g.door) : "Een beheerder"} van <strong>${esc(g.organisatie)}</strong> heeft de code op je gsm voor Toolen Maps gewist.`,
    "Bij je volgende aanmelding stel je ze opnieuw in met een app zoals Microsoft Authenticator of Google Authenticator.",
  ];
  const voet = "Vroeg je dit niet? Neem dan meteen contact op met je beheerder, en verander je wachtwoord.";
  return { onderwerp: "Je tweestapsverificatie voor Toolen Maps werd gewist", html: kader({ titel, alineas, knop: "Inloggen", link: g.link, voet }), tekst: tekstVan(titel, alineas, g.link, voet) };
}
