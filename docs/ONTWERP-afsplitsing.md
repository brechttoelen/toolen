# Afsplitsing FLCS Maps — stappenplan

Status: plan · Opgesteld 9 nov 2026 · Gebaseerd op de code van `flanders-classics/flcs-publitool` (commit fb99ebc).

Doel: FLCS Maps wordt een eigen product, met een eigen repo, databank, hosting en login. Andere organisaties kunnen het gebruiken, en FLCS wordt klant nummer 1. Bestaande deellinks en QR-codes blijven werken.

Elke fase is pas af als het **Klaar als**-punt klopt. Pas dan begin je aan de volgende fase.

---

## Fase 0 — Voorbereiding (jij, ± 1 week doorlooptijd)

1. **Naam en domein.** Kies een productnaam zonder "FLCS". Check het merk bij BOIP en EUIPO, en registreer het domein.
2. **Onderneming.** Eenmanszaak of BV, met KBO-nummer en btw-nummer. Kijk je arbeidscontract na op een clausule over nevenactiviteiten.
3. **Afspraak met FLCS** (kort, schriftelijk):
   - de code en de databank verhuizen uit FLCS-infrastructuur (de GitHub-organisatie, Supabase en Vercel van FLCS);
   - FLCS blijft de tool gebruiken (gratis of tegen een prijs);
   - de plannen van FLCS verhuizen mee en blijven van FLCS.
4. **Eigen accounts**, op naam van de onderneming:
   - GitHub (eigen organisatie, privérepo);
   - Supabase: eigen organisatie, Pro-plan, regio Frankfurt;
   - Vercel Pro;
   - Microsoft Entra: app-registratie voor "accounts in any organizational directory" (multi-tenant);
   - Google Cloud: OAuth-client.
   - Stripe pas in fase 8.

**Klaar als:** naam, domein, onderneming en accounts bestaan, en de afspraak met FLCS is getekend.

---

## Fase 1 — Nieuwe repo (± 1 dag)

1. Splits FLCS Maps af met historiek:
   ```bash
   git clone https://github.com/flanders-classics/flcs-publitool maps && cd maps
   git filter-repo \
     --path app/flcsmaps --path components/flcsmaps --path public/flcsmaps-sw.js \
     --path-glob 'supabase/migrations/*flcsmaps*' --path supabase/functions/sync-maps
   ```
2. Maak er een zelfstandige Next.js-app van:
   - `package.json` met enkel wat nodig is: next, react, react-dom, @supabase/ssr, maplibre-gl, terra-draw, terra-draw-maplibre-gl-adapter, @turf/turf, jspdf, qrcode, jszip, proj4, svgpath, three;
   - `app/flcsmaps/*` gaat naar `app/*`; `(intern)` blijft een route-groep, de deellink wordt `app/p/[token]`;
   - alle `href="/flcsmaps…"` en `router.push('/flcsmaps…')` verliezen het prefix;
   - de service worker `flcsmaps-sw.js` krijgt een nieuwe naam en scope `/`;
   - de middleware-herschrijving voor `maps.flcs.app` valt weg.
3. **Merknaam:** vervang "FLCS Maps" en "FLCS" (83 vermeldingen in 36 bestanden) door de nieuwe naam. Het FLCS-titelblok in de PDF wordt een titelblok per organisatie (logo, naam, adres, ondernemingsnummer).
4. Zet de validatiestappen uit `ways-of-working` in een GitHub Action (build, tsc).

**Klaar als:** `npm run build` en `tsc` slagen in de nieuwe repo (de databank wijst nog naar niets).

---

## Fase 2 — Databank: nieuw project, multi-tenant (± 2 dagen)

1. **Eén basismigratie** `0001_basis.sql`: de eindtoestand van de 32 `flcsmaps_`-migraties, gebundeld. Niet de 32 opnieuw afspelen.
2. **Nieuwe tabellen:**
   - `organisaties` (id, naam, slug, logo_pad, adres, ondernemingsnummer, pakket, aangemaakt_op);
   - `leden` (organisatie_id, user_id, rol: eigenaar | beheerder | bewerker | lezer);
   - `uitnodigingen` (organisatie_id, email, rol, token, geldig_tot).
3. **`organisatie_id`** (not null) op alle tabellen die rechtstreeks door gebruikers gelezen worden: plannen, items, lagen, fasen, versies, opmerkingen, bestanden, deel_links, plekken, bibliotheek, leveranciers, feedback. Items krijgen de kolom ook zelf, voor snelle RLS zonder join.
4. **Bibliotheek op twee niveaus:**
   - `organisatie_id` leeg = publieke catalogus (leveranciers zoals Intermetal, Gigant), voor iedereen leesbaar, enkel door jou te beheren;
   - ingevuld = eigen catalogus van die organisatie.
5. **RLS** via `mag_lezen(org uuid)` en `mag_schrijven(org uuid)`: security definer, vaste `search_path`, lezen uit `leden`. Dit vervangt alle verwijzingen naar `publitool.access` en de tabel `flcsmaps.toegang`.
6. **`ik()`** geeft voortaan de gebruiker plus zijn organisaties en rollen terug.
7. **Deellinks:** de RPC's `deel_link_lezen`, `deel_link_punt`, `deel_link_punt_wijzig`, `deel_link_opmerking` en `deel_link_feedback` blijven werken met hetzelfde token; ze lezen enkel binnen de organisatie van het plan.
8. **Storage:** bucket met paden `<organisatie_id>/…`, policies op het eerste padsegment.
9. **Exposed schemas:** voeg het schema toe in de Supabase-instellingen. Zet ook Point-in-Time Recovery aan.
10. Code: `components/…/db.js` wijst naar het nieuwe project. Elke insert vult `organisatie_id` met de actieve organisatie.

**Klaar als:** een testgebruiker in organisatie A ziet niets van organisatie B, ook niet via de API of storage. Test met twee accounts en een privévenster.

---

## Fase 3 — Login (± 1 dag)

1. Een eigen loginpagina met:
   - **magic link** per e-mail;
   - **Microsoft** (multi-tenant, zodat FLCS en andere bedrijven met hun eigen account inloggen);
   - **Google**.
2. Na het inloggen:
   - geen organisatie → "Nieuwe organisatie" (wordt eigenaar) of wachten op een uitnodiging;
   - meerdere organisaties → een organisatiekiezer in de balk.
3. Beheerders nodigen leden uit met een rol. Een uitnodiging werkt via een link per mail (SMTP via Resend op het eigen domein).
4. Valt weg: `sync-maps`, `toegang-scherm`, `lib/hub`, de toolkit-sleutels.

**Klaar als:** een nieuw e-mailadres kan zich registreren, een organisatie maken en iemand uitnodigen. Een FLCS-account logt in met Microsoft.

---

## Fase 4 — Koppelingen met Publitool doorknippen (± 1 dag)

| Koppeling | Nu | Na de afsplitsing |
|---|---|---|
| Leveranciers | `publitool.leveranciers` (`LeveranciersBeheer.jsx`, `leveranciers.js`) | eigen tabel `leveranciers` per organisatie; FLCS-leveranciers worden in fase 5 meegekopieerd |
| Stock | `logistiek.artikels` (`Stuklijst.jsx`, `BibliotheekBeheer.jsx`) | voorlopig uit; `artikel_id` blijft als losse verwijzing staan; later een integratie met een API-sleutel per organisatie |
| GridLab | schema `gridlab` (`gridlab.js`, `gridlabdoek.jsx`, `WandStudio.jsx`, `BrandingPaneel.jsx`, `doekupload.jsx`) | voorlopig enkel zelf een doek opladen; reeds gemaakte doeken blijven als beeld in storage; later een integratie |
| Editie | `edition_id` van de toolkit (`Eigenschappen.jsx`) | vrij tekstveld "event / editie" |
| Entry | leest zones (gepland) | later een API met een sleutel per organisatie |

**Klaar als:** `grep -rnE "publitool|logistiek|gridlab|toolkit|sbHub" .` levert niets meer op, behalve in de integratiemap.

---

## Fase 5 — Dataverhuis testen op een kopie (± 1–2 dagen)

1. **Export** uit het Publitool-project:
   ```bash
   pg_dump "$OUD_DB_URL" --schema=flcsmaps --data-only --column-inserts > flcsmaps_data.sql
   ```
2. **Organisatie 1** = Flanders Classics, met hun logo, adres en ondernemingsnummer voor het titelblok.
3. **Gebruikers:** maak de FLCS-gebruikers aan in het nieuwe project (via uitnodiging), bouw een tabel `id_oud → id_nieuw` op e-mailadres, en herschrijf daarmee: `aangemaakt_door`, `auteur_id`, `geplaatst_door`, `uitgevoerd_door`, de feedback-auteur en de rev/log-kolommen.
4. **Laden:** `organisatie_id` = FLCS op alle rijen. De bibliotheek splitsen: leverancierselementen (Intermetal, Gigant …) naar de publieke catalogus, de rest naar FLCS.
5. **Storage:** een script dat elk bestand uit bucket `flcsmaps` kopieert naar `<flcs_org_id>/<oud pad>` en de paden in `bestanden.pad` en de doekverwijzingen aanpast.
6. **Deellinks:** tokens ongewijzigd overnemen.
7. **Controle:**
   - aantallen rijen per tabel oud = nieuw;
   - het WK-plan openen: items, stroom, stellingen in 3D, branding;
   - een PDF-export op schaal;
   - een oude deellink openen op het nieuwe domein.

**Klaar als:** het WK-plan en twee andere plannen zijn in het nieuwe project identiek aan het origineel.

---

## Fase 6 — Overschakelen (een halve dag + een week opvolging)

1. **Aankondigen** aan de FLCS-gebruikers en de testers: datum, uur, en dat ze kort niet kunnen bewerken.
2. **Bevriezen:** in Publitool `flcsmaps` op alleen-lezen zetten (een RLS-policy of een vlag in de layout).
3. **Finale export en import** (de stappen uit fase 5, nu op de echte data).
4. **Domein live** op Vercel.
5. **Omleidingen in Publitool** (`next.config.ts`), 308:
   - `publitool.flcs.app/flcsmaps/:pad*` → `nieuwdomein/:pad*`;
   - `maps.flcs.app/:pad*` → `nieuwdomein/:pad*`;
   - de deellinks `…/flcsmaps/p/:token` → `nieuwdomein/p/:token`.
6. **Testen:** een QR-code van een afgedrukt plan scannen; een oude deellink openen op de gsm; de opbouwmodus (PWA) opnieuw installeren.

**Klaar als:** na een week geen enkele melding van een gebroken link, en de FLCS-gebruikers werken op het nieuwe domein.

---

## Fase 7 — Publitool opruimen (na minstens een seizoen)

1. De omleidingen blijven staan; dat kost niets.
2. Haal `components/flcsmaps`, `app/flcsmaps`, de middleware-regels, `flcsmaps-sw.js` en de functie `sync-maps` weg.
3. **Het schema `flcsmaps` droppen als allerlaatste:**
   - eerst een back-up;
   - dan policies, views, functies en edge functions nakijken op afhankelijkheden (OVERDRACHT, valkuil 1);
   - de bucket `flcsmaps` pas weg na een tweede controle.

---

## Fase 8 — Klaar om te verkopen

- **Juridisch:** algemene voorwaarden, privacyverklaring, verwerkersovereenkomst (GDPR, hosting in de EU), lijst van subverwerkers (Supabase, Vercel, Resend, Geoapify, Stripe).
- **Facturatie:** Stripe Billing met de pakketten (Gratis, Event, Pro, Organisatie) en limieten per organisatie (bewerkers, plannen, modules).
- **Kaarten:**
  - stratenkaart via eigen PMTiles (Protomaps op Cloudflare R2), geen OSM-tegels;
  - een cache vóór de luchtfotodiensten;
  - een mail aan Digitaal Vlaanderen over commercieel gebruik van de WMTS;
  - de volumes van het Geoapify-plan nakijken.
- **Werking:** Sentry, een statuspagina, een supportadres, een onboarding voor nieuwe organisaties.
- **Pilot:** 2–3 bevriende organisatoren, met de feedbackknop.

---

## Overzicht

| Fase | Wie | Duur |
|---|---|---|
| 0 Voorbereiding | jij | ± 1 week doorlooptijd |
| 1 Nieuwe repo | Claude | 1 dag |
| 2 Databank multi-tenant | Claude, migratie met jouw akkoord | 2 dagen |
| 3 Login | Claude + jij (Entra, Google) | 1 dag |
| 4 Koppelingen doorknippen | Claude | 1 dag |
| 5 Dataverhuis testen | Claude + jij | 1–2 dagen |
| 6 Overschakelen | samen | een halve dag |
| 7 Publitool opruimen | Claude | na een seizoen |
| 8 Verkoopklaar | jij + Claude | parallel aan 4–6 |

Regels die blijven gelden: migraties nooit zonder akkoord, eerst testen op een kopie, nooit iets droppen zonder een controle op afhankelijkheden.
