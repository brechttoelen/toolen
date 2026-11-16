# Accounts, pakketten en modules — ontwerp

Status: voorstel · 9 nov 2026 · Hoort bij docs/ONTWERP-afsplitsing.md (fase 2, 3 en 8).

Vier vragen:
1. Hoe beheert een bedrijf zijn eigen gebruikers?
2. Hoe werkt een pakket met bv. 20 plaatsen?
3. Hoe blokkeren we wie niet betaalt?
4. Welke modules verkopen we apart?

Grondregel: **alles wat telt, wordt in de databank afgedwongen, niet enkel in de interface.** De interface verbergt en legt uit; de databank weigert.

---

## 1. Drie niveaus van beheer

| Niveau | Wie | Kan |
|---|---|---|
| **Platform** | jij (en later support) | organisaties aanmaken, pakket en modules zetten, proefperiode verlengen, blokkeren, facturen bekijken |
| **Organisatie** | eigenaar en beheerders van het bedrijf | leden uitnodigen, rollen geven, plaatsen verdelen, SSO en domein instellen, abonnement beheren (enkel de eigenaar) |
| **Plan** | bewerkers | plannen maken, deellinks voor externen |

Je komt niet in de data van een klant. Voor support vraag je toegang aan; de klant keurt goed voor een beperkte tijd, en elke supportsessie komt in het logboek.

## 2. Rollen binnen een organisatie

| Rol | Telt als plaats | Kan |
|---|---|---|
| Eigenaar | ja | alles, ook abonnement, betaling en de organisatie verwijderen; minstens één per organisatie |
| Beheerder | ja | leden en rollen, instellingen, bibliotheek, alle plannen |
| Bewerker | ja | plannen maken en bewerken, delen |
| Lezer | **nee** | plannen bekijken, opmerkingen plaatsen, opbouwmodus (afvinken) |
| Extern via deellink | nee | wat de deellink toelaat; geen account |

**Lezers gratis en onbeperkt** (met een redelijke limiet, bv. 5 × het aantal plaatsen). Dat is je verkoopargument tegenover OnePlan: de opbouwploeg, de politie en de stad kosten niets.

**Optioneel: toegang per plan.** Een eventbureau met verschillende klanten zet een plan op "enkel genoemde leden". Standaard zien alle leden alle plannen van de organisatie.

**Plannen horen bij de organisatie, niet bij een persoon.** Verlaat iemand het bedrijf, dan blijft alles staan en komt zijn plaats vrij.

## 3. Pakket met 20 plaatsen

### Hoe het werkt
- Het pakket bepaalt: plaatsen inbegrepen, modules inbegrepen, limieten (plannen, opslag, grote PDF's).
- **Plaats = lid met rol eigenaar, beheerder of bewerker die niet gedeactiveerd is.**
- Extra plaatsen bijkopen per stuk (aantal in Stripe), zonder pakketwissel.
- Een openstaande uitnodiging voor een bewerker houdt een plaats vast, zodat je niet 25 uitnodigingen kan sturen voor 20 plaatsen.

### Wat de beheerder ziet (scherm *Leden*)
- Een balk "17 van 20 plaatsen in gebruik · 43 lezers".
- Een lijst van leden met rol, laatste login, status en login via (Microsoft, Google, e-mail).
- Knoppen: *Uitnodigen* (e-mail + rol, of meerdere tegelijk via plakken of CSV), *Rol wijzigen*, *Deactiveren* (plaats vrij, historiek blijft), *Verwijderen*.
- Vol: *Uitnodigen als bewerker* is grijs, met "Plaatsen bijkopen" (enkel de eigenaar) of "Iemand een lezer maken".

### Sneller voor grote bedrijven
- **Domein claimen:** de organisatie bewijst via een DNS TXT-record dat `@bedrijf.be` van haar is. Wie zich met dat domein aanmeldt, komt automatisch als **lezer** binnen (of wacht op goedkeuring, naar keuze). Een beheerder promoveert naar bewerker als er plaats is.
- **SSO verplichten** (pakket Organisatie en hoger): leden van dat domein kunnen enkel via Microsoft of Google van het bedrijf binnen. Wie het bedrijf verlaat en zijn Microsoft-account kwijt is, kan dus niet meer inloggen.
- **Later:** SCIM (automatisch aanmaken en verwijderen vanuit Entra) voor maatwerkklanten.

## 4. Wie mag accounts aanmaken

- **De eerste eigenaar:** bij een zelf afgesloten abonnement wordt wie betaalt de eigenaar. Bij een offerte maak jij in het platformbeheer de organisatie aan en nodig je de eigenaar uit.
- **Eigenaar en beheerders** nodigen leden uit en geven rollen. Een beheerder kan geen eigenaar maken en geen eigenaar verwijderen.
- **Een bewerker** kan lezers uitnodigen voor een plan (als de organisatie dat toelaat), geen bewerkers.
- **Iemand in meerdere organisaties** (een freelancer, een leverancier): één login, een organisatiekiezer in de balk, en hij telt als plaats in elke organisatie waar hij bewerker is.

## 5. Niet betaald = stap voor stap dicht

De status komt uit Stripe (webhook naar de databank) en volgt deze ladder:

| Status | Wanneer | Gevolg |
|---|---|---|
| **proef** | 14 of 30 dagen | alles van het gekozen pakket; banner met de resterende dagen |
| **actief** | betaald | normaal |
| **achterstallig** | betaling mislukt, 14 dagen | alles werkt; rode banner voor de eigenaar en beheerders; Stripe probeert opnieuw en stuurt mails |
| **alleen-lezen** | na 14 dagen achterstallig, of opgezegd na het einde van de periode | niemand kan bewerken; bekijken, PDF en export blijven; deellinks blijven werken (een event in volle opbouw zet je niet zomaar op zwart) |
| **geblokkeerd** | 60 dagen na alleen-lezen | enkel de eigenaar kan inloggen om te betalen of de data te exporteren; deellinks uit |
| **verwijderd** | 90 dagen na geblokkeerd, met mails vooraf | data en bestanden weg (GDPR) |

Afgedwongen in de databank:
- `mag_schrijven(org)` geeft enkel `true` als de status `proef`, `actief` of `achterstallig` is. Elke schrijfactie, ook via de API, loopt daarlangs.
- `mag_lezen(org)` geeft `false` bij `geblokkeerd`, behalve voor de eigenaar.
- `deel_link_lezen(token)` controleert de status van de organisatie van het plan.
- Storage-policies gebruiken dezelfde functies.

Bij een te klein pakket blokkeren we niets wat al bestaat: is er na een downgrade een plaats te veel, dan kiest de eigenaar wie lezer wordt. Tot dan kan niemand nieuwe bewerkers toevoegen.

## 6. Modules

FLCS Maps heeft al werkruimtes (Plan · Signalisatie · Stroom · Veiligheid · Branding) en een aantal grote onderdelen. Dat zijn de natuurlijke grenzen.

### Basis (in elk betalend pakket)
- tekenen, maten, snappen, lagen, fasen, versies, live samenwerken;
- bibliotheek (eigen en publieke leverancierscatalogus);
- luchtfoto's en lijntekening;
- deellinks met QR, opmerkingen;
- PDF tot A3 met titelblok, stuklijst als CSV;
- import van KML, GPX en CSV.

### Modules om apart te verkopen

| Module | Wat erin zit | Voor wie |
|---|---|---|
| **Stroom en nutsvoorzieningen** | bronnen, kasten, kabels, belasting per fase, brandstof, eendraadschema, later water en data | finishzones, festivals |
| **Signalisatie** | routes, gestapelde borden, plakpijlen, signalisatie-PDF, bestellijst, verkeerssignalisatie, afsluitingslijst voor de politie | koersen, grote publieksevents |
| **Stellingbouwer 3D** | stellingen, bruggen, tribunes, stuklijst, maattekeningen, 3D-deellink | wie stellingen huurt |
| **Branding** | doeken, totems, beachvlaggen, penseel, brandingplan-PDF, bestellijst drukwerk, koppeling met GridLab | sponsorwerking, partners |
| **Veiligheid** | brandveiligheid per hulpverleningszone, botsingscontrole, hulpdienstenroutes, doorrijhoogte, capaciteit, controlelijst vóór definitief, keuringsattesten, draaiboek | veiligheidsdossiers, steden |
| **Binnenplan** | grondplannen, zalen, meubilair, huismateriaal, zitplaatsen | congressen, hospitality |
| **Groot formaat** | vrij papierformaat tot ± 2,1 × 1,5 m, rasterplan met index, bladindeling, meerdere kaartvensters per blad | wie plannen laat drukken |
| **Terrein** | opbouwmodus offline, foto's, afvinken per item, afbraaklijst | opbouwploegen |
| **Leveranciers** | lijst en deellink per leverancier, taal per deellink (NL/FR/EN) | eventbureaus met veel leveranciers |
| **Integraties** | API, koppeling met stock, Entry, eigen huisstijl op deellinks en PDF (white label) | maatwerk |

### In de pakketten

| | Event | Pro | Organisatie | Maatwerk |
|---|---|---|---|---|
| Plaatsen | 5 | 5 | 20 | op maat |
| Lezers | 25 | 25 | 100 | onbeperkt |
| Inbegrepen modules | 2 naar keuze | 2 naar keuze | alle behalve Integraties | alle |
| SSO verplichten, domein claimen | – | – | ✓ | ✓ |
| Extra plaats | – | per stuk | per stuk | in offerte |
| Extra module | per stuk | per stuk | – | – |

"2 naar keuze" is eenvoudiger te verkopen dan vaste combinaties: een koers neemt Signalisatie en Veiligheid, een festival Stroom en Groot formaat.

### Wat er gebeurt als een module wegvalt
- Items van die module blijven zichtbaar en staan mee in de PDF, maar zijn vergrendeld (niet bewerken, niet toevoegen).
- De werkruimte toont "Module Stroom niet actief" met een knop voor de eigenaar.
- Afgedwongen met `heeft_module(org, 'stroom')` in een trigger op `items` (insert/update van items met `velden.stroom` of familie Stroom) en op de RPC's van die module.

## 7. Datamodel (voorstel)

```sql
create table organisaties (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  slug text unique not null,
  logo_pad text, adres text, ondernemingsnummer text, land text default 'BE',
  status text not null default 'proef'
    check (status in ('proef','actief','achterstallig','alleen_lezen','geblokkeerd','verwijderd')),
  status_sinds timestamptz not null default now(),
  proef_tot timestamptz,
  pakket text not null default 'proef',          -- 'event' | 'pro' | 'organisatie' | 'maatwerk'
  plaatsen int not null default 5,                -- inbegrepen + bijgekocht
  lezers_max int not null default 25,
  modules text[] not null default '{}',           -- 'stroom','signalisatie','stelling','branding','veiligheid','binnen','groot','terrein','leveranciers','integraties'
  limieten jsonb not null default '{}',           -- plannen_max, opslag_gb, ...
  sso_verplicht boolean not null default false,
  stripe_klant_id text, stripe_abonnement_id text,
  aangemaakt_op timestamptz not null default now()
);

create table leden (
  organisatie_id uuid references organisaties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  rol text not null check (rol in ('eigenaar','beheerder','bewerker','lezer')),
  actief boolean not null default true,
  uitgenodigd_door uuid, sinds timestamptz not null default now(),
  laatste_login timestamptz,
  primary key (organisatie_id, user_id)
);

create table uitnodigingen (
  id uuid primary key default gen_random_uuid(),
  organisatie_id uuid references organisaties(id) on delete cascade,
  email text not null, rol text not null,
  token text unique not null, geldig_tot timestamptz not null,
  uitgenodigd_door uuid, aanvaard_op timestamptz
);

create table domeinen (
  organisatie_id uuid references organisaties(id) on delete cascade,
  domein text primary key,                         -- 'bedrijf.be'
  verificatie_token text, geverifieerd_op timestamptz,
  nieuwe_leden text not null default 'lezer'       -- 'lezer' | 'aanvraag'
);

create table plan_leden (                          -- optioneel: toegang per plan
  plan_id uuid, user_id uuid, rol text,
  primary key (plan_id, user_id)
);

create table platform_beheerders (user_id uuid primary key);   -- jij

create table logboek_organisatie (                 -- wie gaf wie welke rol, statuswissels, support
  id bigserial primary key, organisatie_id uuid, door uuid,
  actie text, details jsonb, op timestamptz default now()
);
```

Hulpfuncties (security definer, vaste `search_path`):
- `plaatsen_in_gebruik(org)`: actieve leden met een betalende rol, plus openstaande uitnodigingen voor zo'n rol.
- `mag_lezen(org)`, `mag_schrijven(org)`: lid, actief, en de status laat het toe.
- `heeft_module(org, module)`.
- Een trigger op `leden` en `uitnodigingen` weigert een betalende rol als `plaatsen_in_gebruik(org) >= plaatsen`. Hetzelfde voor lezers.
- `stripe-webhook` (edge function) zet `status`, `pakket`, `plaatsen` en `modules` uit het abonnement. Enkel de webhook en het platformbeheer schrijven die kolommen (RLS + kolomrechten).
- Een dagelijkse taak zet de statussen door (achterstallig → alleen-lezen → geblokkeerd → verwijderd) en stuurt de mails.

## 8. Schermen

1. **Organisatie → Leden:** plaatsenbalk, lijst, uitnodigen (ook in bulk), rol, deactiveren.
2. **Organisatie → Abonnement** (enkel de eigenaar): pakket, plaatsen, modules, facturen; *Wijzigen* opent het Stripe-klantenportaal.
3. **Organisatie → Beveiliging:** domeinen, SSO verplichten, toegang per plan aan of uit, logboek.
4. **Platformbeheer (jij):** lijst van organisaties met status, pakket en gebruik; organisatie aanmaken voor een offerte; proefperiode verlengen; modules en plaatsen manueel zetten (factuur buiten Stripe); blokkeren en deblokkeren.
5. **Banners:** proef (dagen over), achterstallig (betaal nu), alleen-lezen (wat kan nog), module niet actief.

## 9. Volgorde van bouwen

1. `organisaties`, `leden`, `uitnodigingen`, `mag_lezen` en `mag_schrijven` met status (meteen in fase 2 van de afsplitsing).
2. Het ledenscherm en uitnodigingen met de plaatsenteller.
3. `heeft_module` en de vergrendeling per werkruimte.
4. Het platformbeheer (nodig zodra de eerste pilotklant er is).
5. De Stripe-webhook, het klantenportaal en de statusladder (vóór de eerste betalende klant).
6. Domein claimen en SSO verplichten.
7. Toegang per plan.

## 10. Open punten

- Lezers echt gratis, of een plafond per pakket? (Voorstel: plafond, ruim gezet.)
- Proefperiode van 14 of 30 dagen, met of zonder kaart vooraf?
- Factureren per jaar alleen, of ook per maand (dan duurder)?
- Kan een lezer in de opbouwmodus foto's opladen? (Voorstel: ja, dat is net het nut.)
- Externe bewerker op één plan (een freelancer): een volle plaats, of een goedkopere "gastplaats"?
