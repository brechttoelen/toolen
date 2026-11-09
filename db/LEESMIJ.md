# Databank Toolen

Project: `toolen` (hlpurcdeouegvphvwygu). Migraties staan hier in `db/`, niet in `supabase/migrations/`, zodat niets automatisch draait. Elke migratie voer je zelf uit in de SQL Editor.

## 0001_basis.sql

Schema `maps`, multi-tenant:
- `organisaties`, `leden`, `uitnodigingen`, `profielen`, `platform_beheerders`, `logboek_organisatie`
- alle tabellen van FLCS Maps (eindtoestand van flcsmaps_001 … 032) met `organisatie_id`
- RLS per organisatie en per status (proef, actief, achterstallig, alleen_lezen, geblokkeerd, verwijderd)
- plaatsen en lezers per pakket, laatste eigenaar beschermd, pakket enkel via Toolen te wijzigen
- deellinks zonder login, met de organisatie erbij
- bucket `maps` (publiek lezen), realtime op items, prullenbak, lagen, opmerkingen, plannen

Getest op een lokale Postgres met Supabase-stubs: `test_0001.sql` (41 controles, alle geslaagd).

De app stuurt de actieve organisatie mee in de header `x-organisatie` (slug uit het adres). Zonder header ziet een gebruiker de organisaties waarvan hij lid is, en komt een nieuwe rij in zijn enige organisatie.

### Uitvoeren

1. SQL Editor → inhoud van `0001_basis.sql` plakken → Run.
2. Project Settings → Data API → Exposed schemas: `maps` toevoegen → Save.
3. Authentication → URL Configuration:
   - Site URL: `https://login.toolen.be`
   - Redirect URLs: `https://*.toolen.be/**` en `https://toolen-theta.vercel.app/**`

### FLCS als eerste organisatie (na je eerste login)

Eerst één keer inloggen op `login.toolen.be` met een link per mail, zodat je gebruiker bestaat. Daarna in de SQL Editor (e-mailadres aanpassen):

```sql
insert into maps.organisaties (slug, naam, kort, status, plaatsen, lezers_max, pakket)
values ('flcs', 'Flanders Classics', 'FLCS', 'actief', 25, 100, 'organisatie');

insert into maps.leden (organisatie_id, user_id, rol)
select o.id, u.id, 'eigenaar' from maps.organisaties o, auth.users u
where o.slug = 'flcs' and u.email = 'JOUW@ADRES';

insert into maps.platform_beheerders (user_id)
select id from auth.users where email = 'JOUW@ADRES';
```

Dan werkt `flcs.toolen.be/maps` (nog leeg: de FLCS-data verhuist in fase 5).

## 0002_import_flcs.sql

Kopieert FLCS Maps uit het Publitool-project naar de organisatie `flcs` in Toolen. De FLCS-databank wordt enkel gelezen; Publitool blijft werken. Mag opnieuw gedraaid worden (wist eerst de vorige import van flcs).

1. In het **Publitool-project**: Connect → Session pooler → noteer de host (bv. `aws-0-eu-central-1.pooler.supabase.com`). Het databankwachtwoord vind je onder Database settings.
2. In de SQL Editor van **Toolen**: `0002_import_flcs.sql` plakken, `HOST` en `WACHTWOORD` invullen (stap 1 van het script), Run.
3. Onderaan staat de controle: per tabel bron = toolen → `ok`. Op het einde worden de verbinding en het wachtwoord weer verwijderd.
4. Bestanden: open `flcs.toolen.be/maps/beheer/import` (of `toolen-theta.vercel.app/maps/beheer/import?org=flcs`) → Kopiëren. Enkel voor platformbeheerders.

Lokaal getest met een nagebootste FLCS-bron (adressen omgezet, gebruikers gekoppeld, twee keer na elkaar gedraaid).

Koppelingen met stock en GridLab staan enkel aan voor organisaties met de module `stock` of `gridlab` (in `organisaties.modules`). In Toolen bestaan die schema's niet, dus voorlopig uit.

### Nog open

- Bestanden: lezen is publiek, opladen kan iedereen die in een organisatie mag schrijven, wijzigen en wissen enkel wie het bestand opleverde of een beheerder. Paden per organisatie (`<organisatie_id>/…`) volgen bij de dataverhuis.
- Stock (`logistiek.artikels`) en GridLab bestaan niet in dit project: die schermen tonen voorlopig niets (fase 4).
