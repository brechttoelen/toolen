# Bouwplan projectfiche in Toolen Maps

Stand 17 nov 2026. Eén bouw, één push naar main. Prototype: canvas "Toolen Maps · Planning (wireframe)", bord Prototype.

## Beslissingen

- De projectfiche hoort bij een plan (site), niet bij het event.
- Facturen en offertes per site. Een factuur hoort bij één site.
- Kostendragers (vennootschappen): meerdere per site mogelijk, te kiezen per budgetregel, offerte, factuur en bestelling.
- Contacten: een persoon hoort bij een organisatie uit de stamlijst. Gemeente, politie en diensten zitten in dezelfde lijst, met een soort.
- Lokale ploeg zonder account: toegang Geen, Deellink of Lezer. Lezer gebeurt niet automatisch.
- Geen Peppol. Geen koppeling met Publitool (stock en laadlijsten blijven daar los).
- Badges: geen module. Bewonersbrieven: een notitie bij Mobiliteit.
- Wedstrijden kunnen meerdere dagen duren.
- Locaties en parkings zijn vaste items van de plaatsfiche (plekken). Ze blijven over edities heen; beschikbaarheid en gebruik zijn per site.

## Dagen tellen bij wedstrijden over meerdere dagen

Een site krijgt een eerste en een laatste wedstrijddag. Een dag wordt bewaard als anker plus verschil:
- vóór de eerste wedstrijddag: anker start, D-3;
- tijdens: anker start, D1, D2 (bij één dag: D);
- na de laatste wedstrijddag: anker einde, D+1.
Afbraak blijft zo goed staan als een volgende editie een dag langer of korter is.

## Volgorde

### Stap 0 · Voorbereiding
- Schrijftoegang tot brechttoelen/toolen.
- Een werktak `bouw/fiche`. `scripts/bouwen-nodig.sh` slaat elke andere tak dan main over, zodat tussentijdse pushes als back-up geen Vercel-build kosten.
- Een module `fiche` in lib/pakketten.ts. De fiche is pas zichtbaar als de module aan staat.

### Stap 1 · Migraties (alleen toevoegen, de live app blijft werken)
Alleen db/-wijzigingen geven geen Vercel-build. De migraties draaien vóór de push van de code.

| Nr | Inhoud |
|---|---|
| 0043_leveranciers_sleutels | leveranciers: btw, adres, factuurmail; tabel leverancier_contacten (meerdere personen); bibliotheek.leverancier_id gevuld via de naam, met een lijst van wat niet past; items.leverancier_id als overschrijving per item |
| 0044_site_dagen | plannen: wedstrijd_van, wedstrijd_tot; event_id verplicht voor nieuwe plannen; per-site instellingen (tabs, soorten taken) in plannen.instellingen |
| 0045_vennootschappen | vennootschappen (org): naam, btw, adres, factuurmail; plan_vennootschappen (welke op deze site, welke standaard) |
| 0046_team_en_rechten | personen (zonder login, bij een organisatie); site_rollen (persoon of lid, vrije rol, toegang); deel_links.persoon_id; recht financieel bij leden |
| 0047_site_leveranciers | site_leveranciers (status, aanspreekpunt); leveringen (levering of ophaling, anker en dag, uur van en tot, leverpunt = item, wat); offertes; facturen; budgetposten |
| 0048_taken | taken (soort, info, wie, ouder_id + relatie afbraak of plaatsing, levering_id, voorbereiding met deadline); taak_dagen (anker, dag, uur van en tot, status, uitvoerder); taak_koppelingen (item, groep, laag, laaggroep, selectie); programma |
| 0049_laadlijst_catering | laad_bronnen (org); laadregels (bron, aantal, wat, waar = item, status, pakket); laadpakketten; cateringregels (leverancier, soort, product, eenheid, voor wie, anker en dag, uur, leverplaats = item, aantal, prijs, vennootschap, rechtstreeks) |
| 0050_notities | notities (site, tekst, auteur, klaar, tab of object, meenemen naar volgende editie) |

Elke tabel heeft RLS volgens het bestaande patroon: organisatie_id en leden. Offertes, facturen, budgetposten en prijzen vragen het recht financieel. Lezers mogen alleen de status van hun eigen taakdagen wijzigen.

### Stap 2 · Basis in de code
- lib/fiche: types, dagen rekenen (anker en dag naar datum en label), sommen voor budget en catering, voorstellen (wie is er die dag), overnemen.
- Gedeelde onderdelen: tabel met vaste kop, vaste groepsrij en vaste totaalrij; bulkbalk; dagkeuze met reeks en losse dagen; statuskeuze in de tabel.

### Stap 3 · Sitescherm
Route app/[org]/maps/(intern)/[id]/fiche met tabs:
Overzicht, Planning (Dag, Week, Alles; taakpaneel; voorbereiding; programma), Leveranciers (opvolging, leveringen, offertes, facturen, Excel per leverancier), Laadlijst, Catering (per dag, per leverplaats, per leverancier), Budget (per kostendrager), Contacten (team, rollen, toegang), Locaties, Mobiliteit, Notities, Info.
Tabs aan of uit per site. Notities per tab onderaan.

### Stap 4 · Kaart
- Werkruimte Planning: vanuit selectie, groep, laag of laaggroep een taak maken of koppelen.
- Eigenschappen: leverancier per item, leverpunt.
- Vanuit de fiche naar de kaart springen op item en dag.

### Stap 5 · Stamlijst leveranciers
Btw, adres, contacten, soort (leverancier, gemeente, dienst, partner), sites per leverancier, het samenvoegen van dubbele namen.

### Stap 6 · Overnemen naar een volgende editie
Bij het kopiëren van een plan wordt bijgehouden welk nieuw item bij welk oud item hoort. Taken, leveringen, laadregels en catering komen mee op dezelfde dag tegenover de wedstrijd, zonder bedragen en facturen. Notities met "meenemen" staan bovenaan.

### Stap 7 · Delen en gsm
Deellink per persoon (zijn taken, rol, zone). Lezers vinken af op de gsm in de bestaande route maps/mobiel.

### Stap 8 · Controle en push
- npm run typecheck, npm test (nieuwe tests voor dagen rekenen, sommen en overnemen), npm run build.
- RLS getest met SQL als lid, lezer en zonder het recht financieel.
- Eén push naar main. De module fiche staat eerst alleen aan voor Flanders Classics.

## Niet in deze bouw
Verdeling per dag (Gators, sleutelbox, walkies), hotels, personeelsplanning, het importeren van de Excel-fiche.
