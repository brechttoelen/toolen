# ONTWERP — Eventplan

Blauwdruk voor een eigen tool om eventsites te plannen op een kaart, ter vervanging
van Google My Maps. Dit document is de leidraad waar we stap voor stap tegenaan
bouwen, zoals ONTWERP-stockbeheer.md dat was voor het magazijn.

Status: ontwerp ter goedkeuring · Werktaal: Nederlands · Laatst bijgewerkt: 2026-10-30
Wireframes: canvas "Eventplan wireframes" (13 schermen in vier rijen: starten,
tekenen, plannen en delen, afdrukken/terrein/stroom).

---

## 1. Doel

Vandaag maken we eventplannen (finishzones, parkings, hospitality, afsluitingen) in
Google My Maps. Wat daar ontbreekt:

- elementen dupliceren;
- tekenen op schaal (een tent van 6 × 12 m is ook 6 × 12 m op de kaart);
- een gedeelde elementenbibliotheek;
- een deel van het plan apart delen met een externe partij;
- een bruikbare PDF-export.

Het eventplan lost dat op en gaat verder: exacte maten zoals in CAD, stijlen zoals in
Illustrator, capaciteit en stuklijsten zoals in OnePlan, en de eenvoud van My Maps.

## 2. Harde voorwaarden

1. **De parcoursplanner blijft volledig onaangeroerd.** Geen gedeelde code, geen
   gedeelde tabellen, geen wijzigingen in `planner.jsx`. Het eventplan is een eigen
   module.
2. **Gratis.** Open-source bibliotheken, open-data-kaarten, de Supabase en Vercel die we
   al hebben. Geen abonnementen.
3. **Zo gedetailleerd mogelijk.** De scherpste open luchtfoto per regio, plus de
   vectorkaarten van de overheid (GRB, BGT) om op te snappen.
4. **Ook buiten Vlaanderen.** Wallonië en Nederland met luchtfoto, elders een
   stratenkaart.

## 3. Onderzoek — waar we ons op baseren

| Bron | Wat we overnemen |
|---|---|
| **My Maps** | Lagen aan/uit, KML-import, foto's in de pop-up, CSV met adressen inlezen, inbedden, eenvoud |
| **OnePlan** | Elementen op schaal uit een bibliotheek, lengte van hekken meteen in meter, capaciteit per vlak, stuklijst, view-only links, vergrendelen/verbergen |
| **CAD** | Exacte maten intypen, objectsnap, ortho-modus, automatische maatvoering, onderlegger (DWG/DXF/PDF) georefereren, revisies met revisietabel en wolkjes, meerdere kaartvensters per blad, printbare lagen |
| **Illustrator** | Pathfinder (samenvoegen/aftrekken), pipet, benoemde stijlen en paletten, tekst langs een pad, slimme hulplijnen, afgeronde hoeken |
| **Entry** | De rekenwijze voor drukwerk: kader → zoomniveau berekenen → tegels ophalen en plakken → exact snijden → tekenen in Mercator → bewaren met vingerafdruk |

Kernbeslissing: **geo-native.** Alles staat in echte coördinaten (GeoJSON, WGS84). Het
pixelmodel van de parcoursplanner (objecten in pixels op een KMZ-afbeelding) kan niet
meten, niet op schaal tekenen en geen basiskaart wisselen, en wordt dus niet
hergebruikt.

## 4. Architectuur

### 4.1 Plaats in de app
- Naam: **FLCS Maps**. Adres `publitool.flcs.app/flcsmaps`, zonder zichtbare link naar
  Publitool: eigen route-groep `app/flcsmaps/` met een eigen layout (geen Publitool-
  zijbalk, geen Publitool-logo). Routes: `/flcsmaps` (lijst),
  `/flcsmaps/[id]` (editor), publiek `/flcsmaps/p/[token]` voor deel-links.
  Eigen componentenmap `components/flcsmaps/`, opgesplitst in kleinere bestanden
  (geen nieuwe monoliet).
- Zelfde Next.js-app en zelfde login (Microsoft SSO via de toolkit) en rollen; de
  gebruiker merkt daar niets van.
- Stijl volgens de FLCS-regels (rechte knoppen en velden, geen hoofdletterlabels,
  schaduw enkel op zwevende elementen). Deel-links en PDF's dragen *FLCS Maps*.

### 4.2 Bibliotheken (alle gratis, open source)
- **MapLibre GL JS** — de kaart (vector en raster, WebGL, snel met duizenden items).
- **Terra Draw** — tekenen en bewerken (punt, lijn, veelhoek, rechthoek, cirkel, vrije
  hand, selecteren, draaien, schalen, snappen). Eigen modi voor wat ontbreekt.
- **Turf.js** — meten, oppervlakte, buffers, evenwijdige lijnen, samenvoegen en
  aftrekken van vlakken.
- **jsPDF** — PDF-opmaak (hebben we al), met vector voor alle getekende items.
- Voor import: `@tmcw/togeojson` (KML/GPX), SheetJS (CSV/XLSX), een DXF-parser.

### 4.3 Datalaag
Eigen schema **`flcsmaps`** op hetzelfde Supabase-project als Publitool (zie §20b). Geen enkele verwijzing
naar de parcours-tabellen. Wel een optionele koppeling naar `edition_id` (toolkit) en
naar stock-artikels (`publitool.artikels`).

## 5. Basiskaarten

Kiezen per plan; de luchtfoto wisselt automatisch van bron per regio.

| Regio | Luchtfoto | Detail | Vector om op te snappen | Drukken |
|---|---|---|---|---|
| Vlaanderen | Orthofoto middenschalig (winter, jaarlijks) | Grootschalig 10 cm (ouder) | GRB | Toegestaan, met bronvermelding |
| Wallonië | ORTHO van de SPW | — | PICC (na te kijken) | Licentie per dataset na te kijken |
| Nederland | Luchtfoto Beeldmateriaal via PDOK (25 cm landsdekkend, 5–8 cm HR) | HR | BGT | Open data, licentie na te kijken |
| Elders | — | — | — | Stratenkaart |

Stratenkaart:
- **Op het scherm:** OSM-tegels, volgens de OSM-tegelregels (enkel wat de gebruiker
  bekijkt, bronvermelding zichtbaar).
- **In de PDF:** Geoapify `positron` (gratis plan, commercieel toegestaan), met
  bronvermelding. OSM-tegels nooit voor drukwerk.

Plus een **lege** ondergrond (wit) voor schema's.

**Lijntekening als standaard voor drukwerk.** De huidige FLCS-plannen (bv. Aankomst
Oudenaarde 2026, 2,1 × 1,5 m) staan op een CAD-lijntekening: wegranden, gebouwen,
water, bomen, taluds, op wit. Dat is scherper en leesbaarder op groot formaat dan een
luchtfoto. Daarom komt er een vierde ondergrond, **Lijntekening**: het GRB (Vlaanderen)
of de BGT (Nederland) als vector, gestileerd zoals de huidige plannen (grijze lijnen,
lichtblauw water, groene vlakken, boomsymbolen). Vector betekent ook: scherp op elk
formaat, zonder tegels. Een eigen CAD-bestand van de locatie (DXF van een landmeter)
kan dezelfde rol spelen als onderlegger.

Over de grens: een kader dat deels buiten de dekking van een bron valt (Brabantse
Pijl) krijgt de bron van de buurregio eronder, of een waarschuwing.

## 6. Tekenen en bewerken

### 6.1 Punten
- Pin met kleur en icoon.
- Icoon uit de iconenbibliotheek, vaste schermgrootte of in meters.
- Genummerd punt met automatische nummering (seingevers 1, 2, 3 …).
- Tekstlabel.

### 6.2 Lijnen
- Rechte lijn of polylijn, vrije hand, vloeiende curve.
- Pijl (enkel, dubbel) voor rijrichting en looproutes.
- Maatlijn die de afstand toont.
- Dubbele evenwijdige lijn met instelbare tussenafstand (nadars aan beide kanten).
- Lijn-elementen uit de bibliotheek tellen stuks per eenheidslengte
  (heras 3,5 m: 87,5 m = 25 panelen).

### 6.3 Vormen
- Vrije veelhoek, rechthoek, vierkant (ook gedraaid), afgeronde hoeken.
- Cirkel (straal in m), ellips.
- Driehoek, regelmatige veelhoek met n zijden.
- Sector (kijkveld camera, bereik speaker).
- Bufferzone van x m rond een lijn of punt.
- Pathfinder: samenvoegen, aftrekken, snijden.

### 6.4 Bewerken
- Lengte, hoek, straal, breedte/diepte en coördinaat exact intypen.
- Objectsnap op eindpunt, midden, loodrecht, snijpunt; snappen op GRB/BGT en op
  andere items; Shift = hoeken van 15°.
- Slimme hulplijnen tijdens het slepen; uitlijnen en verdelen.
- Draaien, schalen met vaste verhouding, spiegelen, knikpunten toevoegen/verwijderen.
- Dupliceren, kopiëren naar een ander plan, herhalen langs een lijn (om de x m),
  raster (n × m met tussenruimte).
- Groeperen, vergrendelen, verbergen, voor-/achtergrond.
- Ongedaan maken / opnieuw (ook over bewaren heen binnen de sessie).

Een cirkel, sector en element op schaal bewaren we parametrisch (middelpunt, straal,
breedte, diepte, rotatie). De veelhoek die op het scherm en in de PDF staat, rekenen
we daaruit af. Zo blijven maten later aanpasbaar.

## 7. Stijl

- **Lijn:** kleur (palet en vrije hex), dikte in px of in meter, vol / streep / stip,
  pijlen, dekking, witte rand voor leesbaarheid op een luchtfoto.
- **Vlak:** vulkleur en dekking, effen / arcering / raster / geen, rand met kleur,
  dikte en stijl, label in of naast het vlak.
- **Tekst:** grootte, gewicht, kleur, witte achtergrond, tekst langs een pad.
- **Overerving:** bibliotheek-element → laag → item. Een item met een eigen stijl
  wijkt af; de rest volgt de laag.
- **Benoemde stijlen en paletten** (huisstijl, partnerkleuren), plus een pipet om een
  stijl van het ene item op een ander te zetten.
- **Uit de huidige plannen** (Illustrator) moeten minstens mee:
  - streep-punt-lijnen (zonegrenzen) en vrije streeppatronen;
  - **patroonlijn**: een symbool dat zich herhaalt langs een lijn, bv. boarding met
    partnerlogo om de x m, zoals de gele boardinglijn in de huidige plannen;
  - **textuurvulling** (houten vloer, gras, asfalt) naast effen en arcering;
  - tekst in een vorm, ook gedraaid (bv. "Camera VRT" verticaal in een smal vak).

Technisch: stijl als JSON op het item; MapLibre leest ze via data-driven styling
(één laag per geometrietype, niet één laag per item).

## 8. Pop-up, notities en opmerkingen

Klik op een item:
- **Kop:** naam, laag, type, maten (lengte, oppervlakte, aantal stuks).
- **Info:** vrije notitie, plus vaste velden waar nuttig: verantwoordelijke, contact,
  opbouw en afbraak (datum + uur), fasen.
- **Foto's:** opgeladen of uit de opbouwmodus.
- **Opmerkingen:** draadje met naam en tijdstip, status open/opgelost.
- **Navigeer hierheen:** opent Google Maps, Apple Maps of Waze.

Externen via een deel-link zien de notitie alleen als dat bij het delen is aangevinkt,
en kunnen opmerkingen plaatsen als die optie aan staat (met hun naam, zonder account).

## 9. Bibliotheek

- Gedeeld over alle plannen. Per element: naam, categorie, tekenwijze (punt / lijn /
  op schaal), maten of eenheidslengte, standaardlaag, standaardstijl, icoon (SVG).
- Optionele koppeling aan een stock-artikel. Een geplaatst element telt dan mee in de
  **stuklijst** van het plan. Het eventplan schrijft niets in de stock- of
  laadlijsttabellen; de stuklijst is een rapport dat je kan exporteren of naast de
  laadlijst legt.
- Aanmaken in het bibliotheekscherm of met *Bewaar als element* op een getekend item.
- **Sjablonen:** een groep items als geheel bewaren (standaard finishzone, standaard
  bevoorrading) en in één keer plaatsen.

## 10. Lagen, fasen en revisies

- **Lagen:** kleur, zichtbaar, vergrendeld, printbaar, volgorde.
- **Fasen:** opbouw (D-1), wedstrijddag, afbraak, of eigen fasen. Een item bestaat in
  één of meer fasen. De editor toont één fase of alles; de PDF kan per fase.
- **Revisies:** elke keer bewaren = een versie. Vergelijken toont wat erbij kwam,
  verdween of verschoof (wolkjes in de PDF), met een revisietabel in het titelblok.
- **Plan overnemen:** *Ronde 2026 → 2027* kopieert het hele plan naar een nieuwe
  editie, met de vergelijking als controle.

## 11. Meten en capaciteit

- Lengte van elke lijn, oppervlakte en omtrek van elk vlak, live tijdens het tekenen.
- **Capaciteit:** per vlak een dichtheid (personen per m²) → aantal personen. Nuttig
  voor veiligheidsdossiers.
- **Stuklijst:** alle elementen met aantallen, per laag of per fase, als CSV of als
  PDF-pagina.
- Meetlint-tool die niet bewaard wordt.

## 12. Stroom en generatoren

Een eigen laag *Stroom* met slimme elementen die met elkaar verbonden zijn.

### 12.1 Elementen
- **Bron:** generator (kVA, brandstof, verbruik per uur bij x % belasting) of
  netaansluiting (ampère, aantal fasen).
- **Verdeelkast:** ingang en uitgangen met hun ampère en type (bv. 63A naar 2 × 32A +
  4 × 16A, CEE of schuko). Elke uitgang is een aansluitpunt.
- **Kabel:** een lijn van aansluitpunt naar aansluitpunt, met kabeltype (5G16, 5G6,
  3G2,5 …). Lengte = getekende lengte + marge (instelbaar, standaard 10 %), afgerond op
  standaardlengtes (25 / 50 m) in de stuklijst.
- **Verbruiker:** elk item of bibliotheek-element kan een vermogen (kW), een
  aansluiting (16A, 32A, …) en een fase (L1/L2/L3 of drie fasen) krijgen. Een tent,
  podium, foodtruck of TV-wagen wordt zo een verbruiker zonder apart symbool.

### 12.2 Wat de tool berekent
- **Belasting per bron:** som van de verbruikers met gelijktijdigheid (instelbaar),
  tegenover kVA × cos φ (standaard 0,8). Overbelast = rood.
- **Belasting per kast en per fase**, met een voorstel om fasen te herverdelen.
- **Kabel tegenover zijn uitgang:** een 16A-kabel op een 32A-verbruiker = melding.
- **Kruisingen:** een kabel die het parcours, een looproute of een rijweg kruist,
  krijgt automatisch een melding en telt mee als kabelbrug in de stuklijst.
- **Brandstof per fase:** verbruik × duur van de fase.
- **Eendraadschema:** bron → kast → verbruiker, automatisch uit de verbindingen, als
  paneel in de editor en als extra PDF-pagina.

Dit is een planningshulp, geen keuring: spanningsval, beveiliging en keuring blijven bij
de elektricien of de verhuurder. Dat staat ook zo op de PDF.

### 12.3 Datamodel
Geen nieuwe tabellen nodig:
- vermogen, aansluiting en fase van een verbruiker in `items.velden.stroom`;
- bron- en kastgegevens in `bibliotheek` (per type) en `items.parameters` (per stuk);
- een kabel is een lijn-item met `parameters.van = {item_id, uitgang}` en
  `parameters.naar = {item_id, uitgang}`. Verplaats je een kast, dan volgen de kabels.

### 12.4 Startbibliotheek: Intermetal Motor
FLCS huurt stroom bij Intermetal Motor. Hun publieke assortiment (stand 30/10/2026)
wordt de startbibliotheek; per type vullen we maten, uitgangen en verbruik aan uit
hun technische fiches.

| Groep | Typen volgens hun site | Nog op te vragen |
|---|---|---|
| Generator standaard | 10, 15, 20, 30, 40, 60, 100, 130, 150, 200, 300, 400, 500, 630 kVA | afmetingen (op schaal), gewicht, tank, verbruik, uitgangen |
| Generator supersilent | 60, 100, 150, 300 kVA | idem |
| Generator long run | 10, 15, 20 kVA (met ondergebouwde tank) | idem |
| Generator draagbaar | 3 tot 20 kVA | idem |
| Hybride (generator + batterij) | 24/25/13-385, 30/30/18-385, 30/30/18-1000, 30/60/18-385, 30/60/18-1000 | betekenis van de codes, uitgangen |
| Verdeelkast | 32A, 63A, 125A, 250A, 400A; automatische omschakelkast 63A en 125A | uitgangen per kast (aantal en type) |
| Kabel | 16A eenfasig 5, 10, 20, 50 m; driefasig 32A, 63A, 125A; Powerlock | lengtes driefasig, kabeltype |
| Kabelgoot | 90 cm, 5x25 (standaard) en 90 cm, 3x25 (dikke kabels) | — (wordt het element *kabelbrug*) |
| Lichtmast | ± 50 masten in hun vloot | type, vermogen, hoogte |

Generatoren van 100 kVA en meer hebben volgens hen elektronische toerentalregeling,
wat telt voor geluid- en TV-apparatuur. De tool kan dat als eigenschap tonen bij de
keuze van een bron.

### 12.5 Hetzelfde netwerkmodel voor andere nutsvoorzieningen
Het patroon bron → verdeler → verbinding → verbruiker is algemeen. Na stroom kan het
zonder nieuw mechanisme voor:
- **Water:** aansluiting, verdeler, slang, tappunt, toilet- of douche-unit.
- **Data en verbindingen:** glasvezel en coax van TV-wagen naar camera's, netwerk,
  radio-relais.

## 13. Controles, leveranciers en plaatsfiche

### 13.1 Botsingscontrole
Meldingen (geen blokkades) bij:
- een item op een **hulpdienstenroute** die daardoor smaller wordt dan de ingestelde
  breedte (standaard 4 m);
- een tent of structuur over een gebouw, boom of ander item;
- een kabel onder een tentvloer of door een looproute zonder kabelbrug;
- een object hoger dan de **doorrijhoogte** onder een boog, LED-boog of kabelbrug
  (hoogte is een eigenschap van bibliotheek-elementen en van items op de plaatsfiche).

### 13.2 Controlelijst vóór *Definitief*
Een versie markeren als definitief toont eerst de lijst: open opmerkingen, overbelaste
bronnen of kasten, geblokkeerde hulpdienstenroutes, items zonder fase, botsingen.
Doorgaan mag, maar de lijst komt in de revisietabel.

### 13.3 Per leverancier
Elk bibliotheek-element hangt aan een leverancier. Per plan maakt de tool per
leverancier:
- een eigen deel-link met enkel zijn items (en de lagen die hij nodig heeft om ze te
  vinden);
- een lijst *wat, hoeveel, waar, wanneer leveren en ophalen*, als PDF of Excel.
Intermetal krijgt zo het stroomplan met de stuklijst, de tentenverhuurder de tenten.

### 13.4 Plaatsfiche
Vaste kennis van een locatie die over edities en events heen blijft:
- stroomkasten en waterpunten van de stad, putten, bomen, paaltjes, verkeerslichten;
- doorrijhoogtes (bruggen, takken, tramdraden);
- ondergrond per vlak (gras, asfalt, kasseien) met de gevolgen voor verankering
  (haringen of betonblokken);
- contactpersonen van de stad of de site.
Een nieuw plan op die plek krijgt de plaatsfiche als vergrendelde laag. Wijzigingen aan
de fiche gelden voor alle volgende plannen op die plek.

### 13.5 Werken in de grond
Vlakken of items waar in de grond gewerkt wordt (haringen, grondpennen, aarding)
krijgen een markering. Of en wanneer een KLIP-planaanvraag (Vlaanderen) of
KLIC-melding (Nederland) verplicht is voor zulke ingrepen, kijken we na vóór dit
onderdeel gebouwd wordt; de tool geeft dan een herinnering met de zone als kader.

### 13.6 Koppeling met Entry
Zones met een toegangsniveau en parkings worden in FLCS Maps getekend en door Entry
gelezen (accreditatiekaart, parkeerpas, terreinkaart op de QR-pagina), zodat ze maar
één keer getekend worden. Richting: Entry leest, FLCS Maps schrijft. Af te stemmen hoe
Entry de zones ophaalt (gedeelde view of API).

### 13.7 Taal van deel-links
Deel-links en hun PDF in NL, FR of EN, per link te kiezen. Vaste teksten worden
vertaald; namen en notities van items blijven zoals ingevuld, met een optioneel veld
per taal voor de belangrijkste (bv. afsluitingen voor een Waalse politiezone).

## 14. Signalisatie

Gebaseerd op het signalisatieplan Zonhoven 2025: per punt een kaartuitsnede, een foto met
de plek van de borden en het bordontwerp met pijl, twee punten per A4, gegroepeerd per
aanrijroute.

### 14.1 In de editor
- **Route eerst:** per aanrijroute (bv. afrit 30 naar parking A) teken je de route.
- **Punten op de route:** klik op de route om een punt te zetten. Nummering volgt de
  route en schuift mee als je een punt tussenvoegt (of vaste nummers, naar keuze).
- **Kijkrichting:** de richting van waaruit de weggebruiker het bord ziet, met een greep
  op de kaart en een kijkhoek. De tool leidt ze af uit de route.
- **Borden per punt:** één of meer bordontwerpen uit de bibliotheek (bv. *UCI World Cup
  900×1200*, *Publiek afrit 29*, *Parking A*), elk met een **pijl**: rechtdoor, links,
  rechts, schuin, terug, U-bocht of geen.
- **Pijlvoorstel en controle:** uit de hoek tussen de kijkrichting en het vervolg van de
  route stelt de tool de pijl voor, en waarschuwt als de gekozen pijl er niet mee klopt.
- **Plaatsing:** kant van de weg, bevestiging (heras, paal, schraag), fase.
- **Foto: uitzondering, niet de regel.** Standaard is een punt gewoon een punt op de
  kaart. Waar het nodig is (een moeilijk kruispunt), voeg je een foto toe: opgeladen of
  genomen met de gsm, met rode vakken waar de panelen komen. Street View blijft een link:
  Google laat niet toe die beelden in onze PDF te zetten.

### 14.2 Bestemmingen, pijlen en gestapelde borden
- **Bestemming:** een paneel zonder pijl, bv. *UCI World Cup*, *Parking 01*, *Parking 07*,
  *Publiek afrit 29*. Opladen als afbeelding of PDF, of genereren uit een sjabloon
  (achtergrondkleur + tekst + nummer, bv. geel *PARKING 01*, zwart *PARKING 07*).
- **Pijl:** niet opladen. De tool tekent één vaste pijlvorm en draait die (rechtdoor,
  links, rechts, schuin, terug) plus een U-bocht. Wie een eigen huisstijl-pijl wil, laadt
  die één keer op als SVG; die vorm wordt dan gedraaid.
- **Gestapeld bord per punt:** een lijst van rijen, elke rij = bestemming + pijl (zoals
  punt 12 in Zonhoven: UCI rechtdoor, Parking 01, 02 en 07 rechts). Rijen toevoegen,
  verwijderen en verslepen. Op de PDF komen ze onder elkaar, zoals nu.
- **Pijl per bestemming uit de route:** elke bestemming heeft haar eigen route (afrit →
  parking 01, afrit → parking 07). Op elk punt berekent de tool per rij de pijl uit de
  route naar die bestemming, en waarschuwt als een rij afwijkt.
- **Zo werkt het in de praktijk (FLCS):** losse bestemmingspanelen zonder pijl, samen
  opgehangen, met **plakpijlen** die je in de juiste richting kleeft. De pijl is dus geen
  deel van het paneel.
- **Bestellijst:**
  - panelen per bestemming, los van de pijl (bv. *Parking 01: 14*);
  - plakpijlen: één type dat in elke richting gekleefd wordt, dus één totaal, plus
    eventueel aparte U-bochtpijlen; met een instelbare reserve (bv. 10 %);
  - bevestigingsmateriaal per punt.
- **Plaatsingslijst per punt** (voor de ploeg ter plaatse en in de opbouwmodus): de
  panelen van boven naar onder, met per paneel de richting van de plakpijl als
  tekening.

### 14.3 PDF-export
- Voorblad met eventlogo, versie en QR naar het digitale plan.
- Per route een tussenblad en een overzichtskaart met alle genummerde punten.
- Per punt: kaartuitsnede met kijkrichting, de panelen met de stand van de plakpijl,
  straat, kant, bevestiging. Standaard 4 punten per A4; heeft een punt een foto, dan
  krijgt het automatisch een groter blok.
- **Bestellijst:** panelen per bestemming, aantal plakpijlen (met reserve) en
  bevestigingsmateriaal. Ook als Excel voor de drukker.
- Optioneel een afbraaklijst in omgekeerde volgorde.

### 14.4 Op het terrein
In de opbouwmodus volgt de plaatser de route punt per punt: navigeer, foto, *geplaatst*.
Bij de afbraak dezelfde lijst om alles weer op te halen.

## 15. Onderlegger

- Een venueplan, bouwplan of podiumplan als **PDF, afbeelding, DWG of DXF** inladen.
- Ook de **bestaande Illustrator-PDF's** van vorige edities: als onderlegger, zodat je ze
  overtekent. Automatisch omzetten naar bewerkbare items is niet betrouwbaar (geen
  coördinaten, geen betekenis per vorm) en doen we niet.
- Georefereren met 2 à 3 referentiepunten (punt op de onderlegger ↔ punt op de kaart).
- Dekking en zichtbaarheid instelbaar; bewaard als aparte laag.
- DXF wordt vector (lijnen om op te snappen); PDF en afbeelding worden raster. DWG
  vraagt een omzetting naar DXF; of dat gratis in de browser kan, is na te kijken.

## 16. Delen

- **Deel-link per ontvanger:** naam, welke lagen, welke fasen, opties (notities
  verbergen, materiaallijst tonen, PDF toestaan, opmerkingen toestaan, kaartuitsnede
  vastzetten), vervaldatum, intrekken, aantal keer geopend.
- Read-only kaart op `publitool.flcs.app/flcsmaps/p/<token>`, mobielvriendelijk, met eigen
  locatie en *Navigeer hierheen*.
- **QR-code** van de link.
- **Inbedden:** een iframe-code van een deel-link voor een website of draaiboek.

De token-link loopt via een databankfunctie (security definer) die enkel de toegelaten
lagen en velden teruggeeft. Zo lekt een verborgen laag nooit via de API.

## 17. PDF-export

- Formaten A4 tot A1, liggend of staand; schaal 1:500 / 1:1000 / 1:2000 / passend.
- Ook **vrij papierformaat** tot het formaat van de huidige plannen (± 2,1 × 1,5 m).
  Op dat formaat is de luchtfoto geen optie (te veel pixels); de lijntekening en alle
  items zijn vector.
- **Titelblok volgens het huidige FLCS-plan:** logo, titel (wedstrijd – zone), locatie,
  datum, tekenaar, versie, organisatie met ondernemingsnummer en adres. De
  organisatie hangt aan de reeks (bv. RIA vzw bij de Ronde), zodat ze vanzelf juist
  staat.
- **Rasterplan** (zoals Zonhoven 2025): één kaart met een coördinatenraster, kolommen
  A, B, C … en rijen 1, 2, 3 … langs de randen, zodat iedereen naar een vak kan
  verwijzen ("EHBO in C12"). Instelbaar: papier, kader, vakgrootte in meter of aantal
  kolommen en rijen, rasterkleur, raster draaien met het terrein. De tool maakt
  automatisch een **index** (naam → vak) van de gekozen lagen, naast de kaart en in de
  deel-link. In de editor en de pop-up toont elk item zijn vak.
- **Bladindeling** (los daarvan): een groot gebied op vaste schaal verdelen over
  genummerde bladen, met overlap, indexpagina en verwijzingen naar buurbladen.
- Titelblok (plan, editie, versie, datum), legende, schaalbalk, noordpijl,
  maatvoering, rasterverwijzingen, revisietabel, bronvermelding van de basiskaart.
- **Meerdere kaartvensters per blad** (overzicht plus detailinzet).
- Per fase of per deel-link-selectie.
- Stuklijst als extra pagina.

Werkwijze (Entry-recept, in de browser):
1. Kader en schaal bepalen de afmeting in meter en het zoomniveau (200 dpi doel, max.
   het hoogste niveau met echte beelden).
2. Tegels ophalen, op een canvas plakken, exact snijden.
3. Het canvas als onderlaag in jsPDF; alle items, labels en legende als **vector**
   erover. Lijnen en tekst blijven scherp, ook als de luchtfoto lager uitvalt.
4. Bewaren in Storage met een vingerafdruk (items, lagen, kader, schaal, bron,
   opnamejaar). Verandert het plan, dan staat de export als verouderd gemarkeerd.

Grote formaten (A1 op 200 dpi) raken de canvaslimiet van iOS-Safari. Als dat in de
praktijk nodig blijkt, verhuist enkel stap 2 naar een serverroute.

## 18. Opbouwmodus (gsm)

- Het plan als PWA op de gsm, met eigen positie op de kaart.
- Per item **geplaatst** aanvinken, met optionele foto. De editor kleurt het item mee.
- Filter "nog te plaatsen" per laag of fase.
- Navigeer hierheen per item.
- Werkt met een zwakke verbinding: het plan en de tegels van de zone worden bij het
  openen bewaard. Enkel bronnen waarvan de licentie dat toelaat (Vlaanderen,
  Nederland); OSM nooit offline.

## 19. Import en export

- **Import:** KML/KMZ (My Maps, met lagen, kleuren, beschrijvingen), GPX (parcours,
  met kilometrering en afstand tot de finish), GeoJSON, CSV/XLSX met adressen
  (geocoding via Geoapify, stijl per kolom), DXF.
- **Export:** PDF, KML (terug naar Google Earth), GeoJSON, CSV-stuklijst, PNG.
- **Wegafsluitingen:** lijn of punt met tijdvenster → automatische lijst voor de
  politievergunning (straat, van–tot, soort afsluiting).

## 20. Datamodel (voorstel)

```sql
create schema if not exists flcsmaps;

create table flcsmaps.plannen (
  id            uuid primary key default gen_random_uuid(),
  naam          text not null,
  edition_id    text,                 -- optioneel: toolkit season_event
  plek_id       uuid,                 -- optioneel: flcsmaps.plekken
  basiskaart    text not null default 'luchtfoto',
  kader         jsonb,                -- startbeeld (bbox)
  versie        integer not null default 1,
  aangemaakt_door uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table flcsmaps.fasen (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references flcsmaps.plannen(id) on delete cascade,
  naam      text not null,           -- 'Opbouw', 'Wedstrijddag', 'Afbraak'
  van       timestamptz,
  tot       timestamptz,
  volgorde  integer not null default 0
);

create table flcsmaps.lagen (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references flcsmaps.plannen(id) on delete cascade,
  naam        text not null,
  stijl       jsonb not null default '{}',
  zichtbaar   boolean not null default true,
  vergrendeld boolean not null default false,
  printbaar   boolean not null default true,
  volgorde    integer not null default 0
);

create table flcsmaps.bibliotheek (
  id            uuid primary key default gen_random_uuid(),
  naam          text not null,
  categorie     text,
  tekenwijze    text not null,        -- 'punt' | 'lijn' | 'schaal'
  breedte_m     numeric,
  diepte_m      numeric,
  eenheid_m     numeric,              -- lijn: lengte per stuk
  stijl         jsonb not null default '{}',
  icoon_pad     text,
  standaardlaag text,
  artikel_id    uuid,                 -- optioneel: publitool.artikels
  leverancier_id uuid,                -- optioneel: publitool.leveranciers (alleen lezen)
  hoogte_m      numeric,              -- voor doorrijhoogte-controle
  eigenschappen jsonb not null default '{}',  -- stroom (kVA, uitgangen), capaciteit, ...
  varianten     jsonb not null default '[]',
  created_at    timestamptz not null default now()
);

-- Plaatsfiche: vaste kennis van een locatie, gedeeld over plannen heen
create table flcsmaps.plekken (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null,          -- 'Markt Oudenaarde'
  kader       jsonb,                  -- bbox
  contacten   jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
-- items van de fiche zelf: flcsmaps.items met plek_id gevuld en plan_id leeg

create table flcsmaps.items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid references flcsmaps.plannen(id) on delete cascade,  -- leeg = item van een plaatsfiche
  plek_id      uuid references flcsmaps.plekken(id) on delete cascade,
  laag_id      uuid references flcsmaps.lagen(id) on delete set null,
  element_id   uuid references flcsmaps.bibliotheek(id) on delete set null,
  groep_id     uuid,
  soort        text not null,         -- 'punt' | 'lijn' | 'vlak' | 'cirkel' | 'sector' | 'tekst' | 'element' | ...
  geometrie    jsonb not null,        -- GeoJSON geometry (WGS84)
  parameters   jsonb,                 -- middelpunt, straal, breedte, diepte, rotatie, ...
  stijl        jsonb,                 -- enkel afwijkingen van laag/element
  naam         text,
  notitie      text,
  velden       jsonb,                 -- verantwoordelijke, contact, opbouw, afbraak, ...
  fase_ids     uuid[],
  vergrendeld  boolean not null default false,
  verborgen    boolean not null default false,
  volgorde     integer not null default 0,
  geplaatst_op timestamptz,           -- opbouwmodus
  geplaatst_door uuid,
  updated_at   timestamptz not null default now()
);
create index on flcsmaps.items (plan_id);

create table flcsmaps.opmerkingen (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references flcsmaps.items(id) on delete cascade,
  auteur_id  uuid,                    -- intern
  auteur_naam text,                   -- extern via deel-link
  deel_link_id uuid,
  tekst      text not null,
  status     text not null default 'open',  -- 'open' | 'opgelost'
  created_at timestamptz not null default now()
);

create table flcsmaps.bestanden (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references flcsmaps.plannen(id) on delete cascade,
  item_id    uuid references flcsmaps.items(id) on delete cascade,
  soort      text not null,           -- 'foto' | 'onderlegger' | 'export'
  pad        text not null,           -- bucket 'flcsmaps'
  meta       jsonb,                   -- referentiepunten, vingerafdruk, ...
  created_at timestamptz not null default now()
);

create table flcsmaps.deel_links (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references flcsmaps.plannen(id) on delete cascade,
  token         text not null unique,
  naam          text not null,
  laag_ids      uuid[] not null,
  fase_ids      uuid[],
  opties        jsonb not null default '{}',
  geldig_tot    timestamptz,
  ingetrokken_op timestamptz,
  keer_geopend  integer not null default 0,
  created_at    timestamptz not null default now()
);

create table flcsmaps.versies (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references flcsmaps.plannen(id) on delete cascade,
  versie     integer not null,
  momentopname jsonb not null,        -- alle items en lagen op dat moment
  opmerking  text,
  created_at timestamptz not null default now()
);
```

RLS: lezen voor alle ingelogde rollen, schrijven voor admin en editor, zelfde
security-definer-patroon als elders. Deel-links lezen enkel via een functie.

## 20b. Databank: twee tools op dezelfde server

FLCS Maps en Publitool delen het Supabase-project en de login, maar niet hun data.

- **Eigen schema `flcsmaps`.** Alle tabellen, functies en views van FLCS Maps zitten daar.
  Niets in `publitool`, niets in `public`. Een drop of reset van het ene schema raakt het
  andere niet.
- **Geen harde koppelingen naar Publitool-tabellen.** Verwijzingen naar een artikel, een
  leverancier of een editie zijn losse uuid's of tekst, zonder foreign key (zelfde
  regel als bij de toolkit). Publitool kan zo een artikel verwijderen zonder dat
  FLCS Maps blokkeert, en omgekeerd. Lezen van Publitool-data gebeurt met de gewone
  Publitool-client en zijn eigen rechten.
- **RLS op elke tabel**, via twee hulpfuncties in `flcsmaps` (security definer, vaste
  `search_path`): `flcsmaps.mag_lezen()` en `flcsmaps.mag_schrijven()`. Ze lezen de rol
  uit `publitool.access`, zodat er één plek is waar rechten beheerd worden. Zelfde
  patroon als de opgeloste recursie op `hub_apps`.
- **Deel-links zonder login** lopen enkel via `flcsmaps.deel_link_lezen(token)` (security
  definer), die alleen de toegelaten lagen, fasen en velden teruggeeft. Anon heeft geen
  directe toegang tot de tabellen.
- **Eigen storage-bucket `flcsmaps`** (foto's, onderleggers, panelen, exports), met
  eigen policies.
- **API:** het schema `flcsmaps` toevoegen aan de *Exposed schemas* in de Supabase-
  instellingen; in de code een eigen client `sbMaps = sb.schema('flcsmaps')`.
- **Migraties** in `supabase/migrations/` met prefix `flcsmaps_`, elk met bovenaan het
  project waarop hij hoort en een terugdraai-blok in commentaar.
- **Code:** alles onder `app/flcsmaps/` en `components/flcsmaps/`, geen import uit
  `components/planner/` of `components/stock/`.

## 21. Rollen

| Rol | Plannen bekijken | Plannen bewerken | Bibliotheek beheren | Delen |
|---|---|---|---|---|
| admin | ✓ | ✎ | ✎ | ✎ |
| editor | ✓ | ✎ | ✎ | ✎ |
| tv / viewer | ✓ | – | – | – |
| extern (deel-link) | enkel de gedeelde lagen | opmerkingen indien toegestaan | – | – |

Opbouwmodus: wie het plan kan bewerken, kan ook *geplaatst* aanvinken. Of een aparte
rol nodig is voor de opbouwploeg, beslissen we tijdens fase 6.

## 22. Bouwplan

Elke stap is af als: de build en `tsc` slagen, de validatie uit WERKWIJZE/ways-of-working
is doorlopen, de stap op `main` staat, en een korte testlijst in
`docs/FLCSMAPS-VOORTGANG.md` klaar staat. `/flcsmaps` is nergens gelinkt in Publitool,
dus een half afgewerkte stap is onzichtbaar voor gewone gebruikers.

| Stap | Inhoud | Migratie | Test door Brecht |
|---|---|---|---|
| 0 · Testopstelling | Kaartdiensten nakijken (laagnamen, matrixsets, CORS, hoogste zoom) voor luchtfoto VL, NL, WA, GRB-lijntekening, OSM; MapLibre + Terra Draw; één tent op schaal; één PDF op schaal | geen | Kaart wisselen, tent tekenen, PDF meten met een lat |
| 1 · Fundament | Schema `flcsmaps`, plannen, lagen, items, fasen, versies; layout `/flcsmaps`; lijst; nieuw plan; editor met lagen, punt, lijn, vlak, stijl, pop-up, notities; bewaren | 001 schema, tabellen, RLS, bucket | Plan maken, tekenen, herladen, rechten als viewer |
| 2 · Precisie | Maat-invoer, objectsnap, GRB-snap, ortho, hulplijnen, uitlijnen, draaien, schalen, dupliceren, raster, herhaal langs lijn, ongedaan maken, sneltoetsen | geen | Nadarlijn van 180 m op een stoeprand |
| 3 · Bibliotheek | Elementen op schaal, lijn-elementen met telling, eigen omtrek, varianten, iconen, import Excel/CSV, sjablonen, stuklijst, koppeling stock (lezen) | 002 bibliotheek | Intermetal-lijst importeren, tent plaatsen, stuklijst |
| 4 · Delen en PDF | Deel-links per ontvanger, publieke kaart, QR, inbedden; PDF op schaal, vrij formaat, FLCS-titelblok, legende, meerdere vensters; rasterplan met index; bladindeling | 003 deel-links + functie | Link openen in privévenster, PDF A3 en groot formaat |
| 5 · Planning | Fasen, revisies vergelijken, plan overnemen naar nieuwe editie, capaciteit, opmerkingen met status, onderlegger (PDF/afbeelding/DXF) | 004 opmerkingen, bestanden | Ronde 2026 → 2027, onderlegger Oudenaarde |
| 6 · Stroom | Bronnen, kasten, kabels met aansluitpunten, belasting per bron/kast/fase, kruisingen, brandstof, eendraadschema | geen (velden in items/bibliotheek) | Stroomplan finish met G1 en K1 |
| 7 · Signalisatie | Routes, punten, kijkrichting, gestapelde panelen, plakpijlen, pijlvoorstel en controle, signalisatie-PDF, bestellijst | 005 bestemmingen | Zonhoven afrit 30 natekenen |
| 8 · Controles en plaatsfiche | Botsingen, doorrijhoogte, controlelijst vóór definitief, plaatsfiche, werken in de grond | 006 plekken | Tent op hulpdienstenroute |
| 9 · Terrein | Opbouwmodus op gsm, geplaatst + foto, navigeer, offline voor de zone | 007 opbouwstatus | Op gsm items afvinken |
| 10 · Partners | Lijsten en links per leverancier, taal per deel-link, koppeling Entry (lezen) | 008 view voor Entry | Lijst Intermetal, link in FR |
| 11 · Afwerking | Pathfinder, tekst langs pad, patroonlijnen, texturen, revisiewolkjes, import KML/GPX/DXF, export KML/GeoJSON, afsluitingslijst politie | geen | My Maps-KML van vorig jaar importeren |

Volgorde van werken binnen elke stap: migratie klaarzetten → na akkoord uitvoeren →
code → validatie → push → testlijst. Migraties worden nooit uitgevoerd zonder akkoord.

## 23. Na te kijken vóór de bouw

- Vlaanderen: exacte WMTS (winteropnamen meest recent), laagnaam, matrixset EPSG:3857,
  hoogste zoom met echte beelden; welke jaren er grootschalig (10 cm) zijn.
- Nederland: PDOK-tegeldienst voor de luchtfoto, licentie, Web Mercator, hoogste zoom.
- Wallonië: licentie ORTHO en de vectorkaart om op te snappen.
- CORS op alle drie de luchtfotodiensten (anders kan de PDF in de browser niet).
- GRB en BGT: als vectortegels beschikbaar, of zelf per zone ophalen als GeoJSON.
- Geoapify: verbruik van de PDF-stratenkaart binnen het gratis plan.
- DWG in de browser: gratis omzetting naar DXF mogelijk, of enkel DXF ondersteunen.
- GRB en BGT als lijntekening: welke lagen (wegranden, gebouwen, water, bomen) en in
  welke vorm (vectortegels of per zone als GeoJSON).
- KLIP/KLIC: wanneer is een planaanvraag verplicht voor haringen en grondpennen.
- Entry: hoe Entry zones en parkings uit FLCS Maps leest (gedeelde view of API).
- Intermetal Motor: technische fiches (maten, uitgangen, verbruik) van de typen die we huren.

---

*Volgende stap na goedkeuring: fase 0 — de testopstelling, om de kaartdiensten en de
PDF op schaal te bevestigen voor er een tabel bestaat.*
