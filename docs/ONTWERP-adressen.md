# Adressen per klant — ontwerp

Status: gekozen 9 nov 2026 · Hoort bij ONTWERP-afsplitsing.md en ONTWERP-accounts-pakketten.md.

Keuze: **elke klant een eigen subdomein**, de tool als pad. Toolen is het bedrijf; latere tools komen naast Maps op hetzelfde adres en dezelfde login.

```
vrt.toolen.be                      → startpagina van VRT (de tools van VRT)
vrt.toolen.be/maps                 → plannen van VRT
vrt.toolen.be/maps/ronde-2027      → een plan
vrt.toolen.be/maps/ronde-2027/opbouw
vrt.toolen.be/instellingen/leden   → ledenbeheer (geldt voor alle tools)
vrt.toolen.be/d/Xk7p2Q             → deellink, met de naam en het logo van VRT
login.toolen.be                    → centraal inloggen
toolen.be                          → bedrijfssite (prijzen, contact)
```

Later, voor maatwerk: een eigen domein van de klant (`plannen.vrt.be`, CNAME naar Vercel).

## Hoe het technisch werkt

1. **DNS en Vercel.** De nameservers van `toolen.be` naar Vercel, zodat het wildcard-domein `*.toolen.be` met certificaat werkt. Het domein `toolen.be` zelf en `www` voor de site.
2. **Middleware.** Leest de host, haalt de slug eruit (`vrt`) en herschrijft intern naar `/[org]/…`. De slug wordt de actieve organisatie.
3. **Gereserveerde namen**, nooit als slug: `www`, `app`, `login`, `api`, `admin`, `beheer`, `status`, `docs`, `help`, `mail`, `d`, `maps`, `stock`, `cdn`, `static`, `demo`, `test`, `staging`.
4. **Slugregels.** Kleine letters, cijfers en koppelteken, 3–30 tekens, uniek. Wordt een slug gewijzigd, dan blijft de oude als omleiding staan (tabel `slug_omleidingen`).
5. **Toegang blijft in de databank.** Het subdomein kiest enkel de organisatie. Typt iemand van VRT `flcs.toolen.be`, dan krijgt hij "geen toegang", omdat RLS kijkt naar `leden`, niet naar het adres.

## Inloggen

- **Centraal op `login.toolen.be`.** Microsoft staat geen wildcard-terugkeeradressen toe; met één loginadres volstaat één registratie. Na het inloggen gaat de gebruiker terug naar het subdomein waar hij vandaan kwam, of naar zijn enige organisatie, of naar een kiezer.
- **Sessie-cookie op `.toolen.be`**, zodat één login geldt voor alle subdomeinen. Wie in twee organisaties zit (een freelancer, jij als support), wisselt zonder opnieuw in te loggen.
- **Supabase:** Site URL `https://login.toolen.be`; redirect-URL's `https://*.toolen.be/**`.
- **Terugkeeradres beveiligen.** Na het inloggen enkel doorsturen naar `*.toolen.be` of een geregistreerd klantdomein, nooit naar een vrij adres (geen open redirect).

## Deellinks

- `vrt.toolen.be/d/<token>`: de klant ziet zijn eigen naam en logo, wat professioneler is voor de stad of de politie die de link krijgt.
- Het token werkt ook op een ander subdomein (de databankfunctie zoekt het plan op het token), zodat een verkeerd getypt subdomein niets breekt; de pagina stuurt dan door naar het juiste subdomein.
- Oude FLCS-links: `publitool.flcs.app/flcsmaps/p/<token>` en `maps.flcs.app/p/<token>` worden met een 308 doorgestuurd naar `flcs.toolen.be/d/<token>`.

## Ontwikkelen en testen

- Lokaal: `vrt.localhost:3000` werkt in elke moderne browser.
- Vercel-previews hebben geen subdomeinen: daar valt de middleware terug op `?org=vrt`.

## Eigen domein per klant (maatwerk)

- De klant zet een CNAME (`plannen.vrt.be` → Vercel). Toolen voegt het domein toe via de Vercel-API en koppelt het in de tabel `domeinen` aan de organisatie.
- Inloggen loopt via `login.toolen.be`; daarna een sessie op het klantdomein via een eenmalige code (cookies werken niet over domeinen heen).
