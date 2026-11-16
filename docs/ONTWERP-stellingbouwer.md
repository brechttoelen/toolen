# Stellingbouwer herdenken — plan (8 nov 2026)

Status: **plan goedgekeurd op 8 nov 2026, keuzes in §12.** Bouwen in fases (§11). Halve aanpassingen van vóór het plan staan opzij (git stash "stelling herbouw stap1 (onaf)").

---

## 1. Waarvoor dient de stellingbouwer

Een eventmanager zet een stelling op het plan en wil weten: **past ze, wat moet er besteld worden, hoe ziet ze eruit met branding, en wat is er vrij voor de hulpdiensten.** Het is een indicatie voor de leverancier (Gigant, Layher-bouwers …), niet het bindende werkplan.

Wie gebruikt het resultaat:
- **FLCS-ploeg**: ontwerpt en past aan op een laptop (geen iPad nodig).
- **Stellingbouwer**: stuklijst, maattekeningen, 3D; levert zelf het bindende plan (upload).
- **Hulpdiensten**: vrije doorgangen (breedte × hoogte, functie).
- **Partners / branding**: 3D met doeken (deellink "Enkel een 3D").

## 2. Wat het moet kunnen (inventaris van vandaag)

**Constructie**
- Raster van vakken (2,07 of 1,04 m per kolom en rij), delen met een knik.
- Soorten vak: vloer, helling (0,5 / 1 m per vak), rennerstrap, voetgangerstrap (modules), bordes, tribune, toren (zonder dek), trapblok.
- Hoogtes op de rozetten (om de 0,5 m); grond onder een vak en hellende grond.
- Doorgangen met vrije maten en functie; vrije overspanning met liggertype (tralie, rooster, IPE, vakwerk).
- Platen hout (kleur) of metaal; tussenvloeren in een toren; portaal boven het dek; op wielen; ballast.
- Per wand: leuningsoort (ook tussen twee vakken), horizontale liggers, schoren. Per hoek: staanderhoogte.
- Vanzelf: ladder, aanloop- en uitloopplaten, leuning bij hoogteverschil, schoren aan de buitenkant.
- TV-camera op het dek (lens, opstelling, kijkhoek).
- Starttypes: rennersbrug, voetgangersbrug, camerastelling, platform, tribune, toren.

**Branding**
- Doeken op wanden tussen rozetten, bovenop een toren, met een ontwerp uit de bibliotheek of als wit canvas.

**Nakijken en delen**
- Stuklijst, doorgangen, meldingen (dek niet op rozet), plannen van de stellingbouwer (upload).
- Op de kaart: omtrek, ankerpunt, camerapunt. In het paneel: klein 3D-voorbeeld. Materiaallijst: korte omschrijving.
- Deellink "Enkel een 3D", PDF's.

## 3. Wat er nu misloopt

1. **Drie stappen in één scherm**: bouwen, branding en nakijken staan door elkaar (doekinstellingen naast leuning en schoren, stuklijst als tab naast de selectie).
2. **Drie aanzichten met elk andere regels**: in het bovenaanzicht klik je randen, in het zijaanzicht sleep je hoogtes en teken je doeken, in 3D klik je cellen. Wat waar kan, is niet te raden.
3. **Half klikken, half slepen, half paneel**: een ligger verplaats je via een keuzelijst in het paneel, een vloerhoogte via een getal of een greep in het zijaanzicht, een doek via van/tot-lijsten.
4. **Kant en richting zijn abstract**: "buitenkant/binnenkant", "voor-/achterzijde", "doorlopend/per vak", "samenvoegen/splitsen" zonder te zien waar je bent.
5. **Ongeldige toestanden zijn mogelijk**: een dek dat niet op de rozetten van de staander ernaast past, doeken van −99 tot 99 m, restjes onder een dek die je niet meer kan aanklikken. De 3D verzint dan rozetten of buizen om het te tonen.
6. **3D en stuklijst rekenen apart**: de tekening en de telling volgen elk hun eigen regels; wat je ziet en wat besteld wordt, kunnen verschillen.
7. **Eén bestand van 1.800 regels** (StellingStudio.jsx) met scène, drie aanzichten, alle panelen en alle acties: elke aanpassing raakt iets anders.

## 4. Principes voor de nieuwe versie

1. **Wat je ziet, pak je vast.** Elk onderdeel in 3D (vak, ligger, schoor, leuning, staander, tussenvloer, doek) is aan te klikken. **Onder de muis gloeit het op** (zacht blauw), zodat je ziet wat een klik zal kiezen. Gekozen = blauw met **grepen**. Slepen aan een greep gaat langs de enige zinvolle richting en klikt vast op het raster (rozetten om de 0,5 m, vakken van 2,07 / 1,04 m). **Delete** = weg. **Toevoegen** gebeurt op de plek zelf ("+" in een leeg wandvak).
2. **Eén manier van werken overal**: klik = kiezen, Shift = meer kiezen, greep slepen = aanpassen, leeg slepen = draaien, scrollen = zoomen, Ctrl+Z = ongedaan.
3. **Altijd geldig**: alles ligt op het rozettenraster. Wat niet kan, laat het slepen niet toe of meldt het met één klik om recht te zetten. Nooit iets tekenen dat er niet is.
4. **Eén bron**: één lijst van onderdelen (elk stuk met plaats en soort). Uit die lijst komen de 3D, de stuklijst en het aanklikken. Wat je ziet, wordt besteld.
5. **Drie stappen, elk met zijn eigen gereedschap**: 1 Bouwen · 2 Branding · 3 Nakijken. In Bouwen zijn doeken verborgen; in Branding ligt de constructie vast.
6. **Paneel rechts = eigenschappen van wat gekozen is**, altijd in dezelfde volgorde. Zeldzame instellingen onder "Meer". Geen tweede manier om iets te doen dat in 3D kan, tenzij het met een getal sneller gaat (hoogte typen mag).

## 5. Interactie per onderdeel (Bouwen)

| Onderdeel | Kiezen | Greep / slepen | Toevoegen | Weghalen | Paneel |
|---|---|---|---|---|---|
| **Vak** | klik op het dek (of in het raster) | pijl omhoog/omlaag: dekhoogte per rozet; bij een helling per uiteinde (geen zijaanzicht meer nodig) | blok slepen in het raster | Delete | soort, platen, grond, doorgang, Meer |
| **Ligger (horizontaal)** | klik op de buis | slepen omhoog/omlaag naar een andere rozet | "+" in een leeg wandvak tussen twee liggers | Delete | — (enkel de hoogte) |
| **Schoor** | klik op de buis | — | "+" in een wandvak zonder schoor | Delete | richting omkeren |
| **Leuning** (apart onderdeel met een soort) | klik op de leuning | — | klik op een open rand → "+ Leuning" | Delete | soort (buis, stelling 1,30, spijlen, laag, ladder) |
| **Staander** | klik op de staander | top omhoog/omlaag (leuninghoogte) | "+" op een ligger of overspanning: extra staander | Delete (enkel een zelf toegevoegde of een die niets draagt) | hoogte laag/midden/hoog |
| **Tussenvloer** | klik op de vloer | omhoog/omlaag per rozet | in een torenvak: "+ Vloer" | Delete | platen, leuning rond |
| **Doorgang** | klik op het groene vlak | — | vak kiezen → Doorgang | — | vrije maten, functie, liggertype |
| **TV-camera** | klik | slepen over het dek, draaigreep | knop "Camera" | Delete | lens, opstelling |

Het raster (bovenaanzicht) staat naast de 3D en dient enkel voor de plattegrond: vakken plaatsen, kolommen en rijen van maat wisselen, delen met een knik. Klikken in het raster of in 3D kiest hetzelfde (en hover in het ene gloeit ook in het andere).

## 6. Branding

- 3D groot, met een **zijdekiezer**: Vrij · Voorkant · Achterkant · Links · Rechts · Boven. De camera draait recht voor die zijde.
- **Een doek hangt aan de kant waar je naar kijkt.** De kant volgt uit de kijkrichting; geen keuze binnen/buiten. De achterkant is wit.
- **Tekenen**: sleep een rechthoek over de wandvakken; die klikt vast op staanders en rozetten. Eén rechthoek = één doek = één doorlopend ontwerp.
- **Aanpassen**: klik een doek. Grepen op de hoeken en zijden verslepen hem over meer of minder vakken; in het midden slepen = verplaatsen. Links twee samen en rechts twee samen = twee rechthoeken.
- **Ontwerpen** links als tegels (eerste tegel = wit canvas). Een tegel klikken zet het ontwerp op het gekozen doek, en is het penseel voor het volgende doek. Uploaden gaat daar ook.
- **Boven**: klik een torenvak om er een doek bovenop te leggen.
- Rechts: lijst van de doeken (zijde, maat, ontwerp), × om weg te halen. Oogje om de doeken te verbergen.
- Doeken onder een dek of achter iets anders blijven bereikbaar via de lijst.

## 7. Nakijken

- **Maattekeningen**: bovenaanzicht en een zijaanzicht per zijde (voor, achter, links, rechts), met maatlijnen in mm, vrije hoogtes en rozetten; afdrukbaar (enkel bekijken, niet bewerken).
- **Stuklijst** (uit dezelfde onderdelenlijst als de 3D; zonder kantplank/afrokstrook), **doorgangen**, **meldingen** (met "Rechtzetten" of "Toon in 3D").
- **Plannen van de stellingbouwer** (upload), **delen** (deellink 3D, PDF).

## 8. Schermindeling

```
┌ Stellingbouwer · naam ─── [1 Bouwen] [2 Branding] [3 Nakijken] ─── ↶ ↷ ─ Klaar ┐
│ Bouwen:   [blokken] │ raster (plattegrond) │ 3D (werkvlak, grepen)   │ paneel  │
│ Branding: [ontwerp- │ 3D groot + zijdekiezer + oogje                 │ doeken  │
│            tegels]  │                                                │         │
│ Nakijken:           │ maattekening per zijde / bovenaanzicht        │ stuklijst│
│                     │                                                │ doorg.  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Een lege stelling opent op een startscherm met de types (met maten) in plaats van een inklapbaar paneel.

## 9. Gegevens

Het opgeslagen model (`velden.stelling`) blijft, met opschoning bij het openen (eenmalig, zonder migratie in de databank):
- **Dekken** op het rozettenraster van hun staanders (zoals "Rechtzetten" nu).
- **Doeken**: alles wordt `{ soort: 'vlak', randen, van, tot, kant, voor }` (oude soorten zoals leuning, band, zijkant, onder en doorgang omgezet naar rozethoogtes). Waarden buiten grond en top worden begrensd, lege restjes weggehaald, `perVak` wordt aparte doeken.
- **Liggers** (`st.liggers`) en **schoren** (`st.schoren`) per wand blijven; tussenvloeren als rozethoogtes.
- **Nieuw**: `st.staanders` = zelf toegevoegde staanders (op een rand, op een afstand) en weggehaalde (sleutel van de hoek).

Nieuw in de code: **`onderdelen(st)`** geeft elk fysiek stuk (staander met lengte, ligger, U-ligger, schoor, plaat of vloerdeel, leuning, voetplaat, ballast, doek) met een vaste id, soort, plaats en de wand of het vak waar het bij hoort. De 3D tekent die lijst, de stuklijst telt die lijst, en het aanklikken en de hover-gloed gebruiken die id's.

## 10. Opbouw van de code

`components/flcsmaps/stelling/`
- `model.js`: maten, afgeleid (nu stellingbouw.js), opschoning, `onderdelen()`, stuklijst.
- `scene.js`: van onderdelen naar tekenopdrachten (3D en SVG).
- `Drie.jsx`: three.js-weergave + interactielaag: hover-gloed, kiezen (raycast), grepen, slepen langs een as met vastklikken, voorbeeld tijdens het slepen.
- `Studio.jsx`: kop, stappen, ongedaan/opnieuw.
- `Bouwen.jsx`, `Branding.jsx`, `Nakijken.jsx`: elk de eigen linkerkolom, middenstuk en paneel.
- `Raster.jsx`, `Maattekening.jsx`.

De oude StellingStudio blijft werken tot de nieuwe klaar is. Kaart, paneel, deellink en materiaallijst blijven dezelfde functies aanroepen.

## 11. Fases (elke fase apart gepusht en bruikbaar)

| Fase | Inhoud | Klaar als |
|---|---|---|
| **0. Fundament** | `onderdelen()`, opschoning, stuklijst uit onderdelen, kantplank weg; geen zichtbare verandering | stuklijst = wat de 3D tekent (test op alle starttypes + jouw plan) |
| **1. Interactielaag 3D** | hover-gloed, kiezen per onderdeel, grepen, slepen langs een as met vastklikken, Delete, "+" in een wandvak; eerst liggers, vloerhoogte (ook helling per uiteinde), tussenvloer | ligger verslepen, toevoegen, weghalen in 3D; vloer per rozet verslepen |
| **2. Studio + Bouwen** | drie stappen, raster + 3D naast elkaar, startscherm, paneel per keuze; rest van de onderdelen in de interactielaag (schoor, leuning, staander, camera) | alles uit tabel §5 werkt in 3D en raster |
| **3. Branding** | zijdekiezer, rechthoek tekenen, grepen, kant uit kijkrichting, ontwerptegels, boven, doekenlijst | links twee / rechts twee in één minuut, zonder het woord "binnenkant" |
| **4. Nakijken** | maattekeningen per zijde, stuklijst, doorgangen, meldingen, delen | afdruk per zijde |
| **5. Opruimen** | oude studio, zijaanzicht-bewerken, oude doeksoorten weg; tests en documentatie | één pad per handeling |

Schatting: fase 0–1 is de grootste stap (de rest bouwt daarop).

## 12. Keuzes (8 nov 2026)

1. **Helling**: in 3D, met grepen op de uiteinden. Het zijaanzicht wordt geen werkaanzicht meer.
2. **Leuning**: een apart onderdeel met een soort (niet gewoon de bovenste liggers).
3. **Staanders**: volgen vanzelf uit de vakken, maar je kan er ook zelf toevoegen en weghalen.
4. **iPad**: niet nodig; laptop met muis.
5. **Kantplank (afrokstrook)**: weg uit de stuklijst.
6. **Hover**: wat je kan kiezen, gloeit op onder de muis.
7. Nog open: moet het raster de delen met een knik tonen, of volstaat dat in 3D? (Voorlopig: in 3D.)
