# Toolen

Toolen Maps: eventsites plannen op schaal (tekenen, bibliotheek, stroom, signalisatie, stellingen, branding, deellinks, PDF).

Afgesplitst van FLCS Maps in Publitool (`flanders-classics/flcs-publitool`, commit fb99ebc). De FLCS-versie blijft daar draaien tot de overschakeling.

## Adressen

| Adres | Wat |
|---|---|
| `toolen.be` | bedrijfssite |
| `login.toolen.be` | centraal inloggen |
| `<org>.toolen.be/maps` | plannen van een organisatie |
| `<org>.toolen.be/d/<token>` | deellink |

De middleware herschrijft `<org>.toolen.be/...` intern naar `/<org>/...`. Lokaal: `vrt.localhost:3000/maps`, of `localhost:3000/maps?org=vrt`.

## Opbouw

- `app/[org]/maps/...` routes van Maps, `app/[org]/d/[token]` deellink
- `app/login`, `app/auth/callback` inloggen (link per mail, Microsoft, Google)
- `components/maps/` de editor en alle modules
- `lib/org.ts` subdomein → organisatie, gereserveerde namen
- `public/m/` iconen, borden, doeken, structuren, `public/maps-sw.js` offline voor de opbouwmodus
- `docs/referentie-flcsmaps-migraties/` de 32 migraties uit Publitool, enkel als referentie voor de nieuwe basismigratie (fase 2)

## Stand van de afsplitsing

Zie `claude/ONTWERP-afsplitsing.md` in het project.

- [x] Fase 1: zelfstandige app, routes onder `/maps`, adressen per organisatie, merknaam Toolen Maps
- [ ] Fase 2: basismigratie (schema `maps`) multi-tenant met organisaties en leden
- [ ] Fase 3: inloggen afwerken (Entra- en Google-app, uitnodigingen)
- [ ] Fase 4: koppelingen met Publitool doorknippen: leveranciers (`maps.leveranciers`), stock (`logistiek.artikels`), GridLab (`gridlab`), `edition_id`
- [ ] FLCS-eigen inhoud (iconen, borden, doeken in `public/m` en `bordenset.js`) naar de bibliotheek van de organisatie FLCS
- [ ] Fase 5–6: dataverhuis en overschakelen

## Omgevingsvariabelen

Zie `.env.example`.
