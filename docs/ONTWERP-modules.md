# Modules van Toolen Maps — afbakening en testlijst

Status: gebouwd · 9 nov 2026 · repo `brechttoelen/toolen`, commit d049907. Hoort bij docs/ONTWERP-accounts-pakketten.md.

## Hoe het werkt

- **Eén register:** `components/maps/modules.js`. Per module staat daar wat erbij hoort: werkruimte, panelen, tabs in de eigenschappen, elementen uit de bibliotheek, exports, deellinkprofiel en de velden die de databank bewaakt.
- **Editor:** elk scherm vraagt aan `heeftModule` / `magModule` / `elementMag` / `tabMag` of iets mag. Wat niet in het pakket zit, staat grijs met "niet in pakket" of verdwijnt.
- **Databank:** trigger `items_zz_module` weigert het toevoegen of wijzigen van modulegegevens (zelfde sleutels als het register). Bestaande items blijven zichtbaar, verplaatsbaar en verwijderbaar.
- **Pakketten:** tabel `maps.pakketten`, te beheren in `/beheer` → Pakketten. Een pakket kiezen bij een organisatie neemt plaatsen, lezers en modules over; daarna kan je per organisatie afwijken. Koppelingen (stock, GridLab) blijven staan.

## Grens tussen basis en module

| Onderwerp | Basis | Module |
|---|---|---|
| Controle | gewone meldingen: overlap, hoogte, afstandsregels, lagen, fasen, opmerkingen | **Veiligheid:** brandveiligheid, hulpdienstenroutes en doorrijhoogte, keuringsattesten |
| Stroom | generator of kast als element plaatsen, lichtmast richten | **Stroom:** kabels, belasting, eendraadschema, vaste aansluitingen, stroom in het binnenplan, stroomdeellink |
| Branding | hek met een gewone doekkleur | **Branding:** ontwerpen opladen, doeken met beeld, totems, vlaggen, panelen |

## Velden die de databank bewaakt

| Velden | Module |
|---|---|
| `sign`, `verkeer` | Signalisatie |
| `stroom` | Stroom |
| `stelling` | Stellingbouwer 3D |
| `binnen`, `binnenplan` | Binnenplan |
| `doeken`, `vlaggen`, `ontwerp`, `paneel_1` … `paneel_4` | Branding |

## Testlijst per module

Zet in `/beheer` bij een testorganisatie telkens één module uit en loop de lijst af.

**Signalisatie**
- Werkruimte Signalisatie grijs met "niet in pakket".
- Panelen Borden ontbreken; geen Signalisatie-PDF in menu en Ctrl K.
- Bestaand bord blijft zichtbaar; een bord wijzigen geeft een melding.

**Stroom**
- Generator of kast plaatsen lukt.
- Werkruimte Stroom grijs; paneel Elektriciteit weg; geen kabel- of vaste-aansluitinggereedschap.
- Eigenschappen van een generator: geen tab Stroom; bij andere items geen stroomblok.
- Binnenplan: knop Stroom ontbreekt.
- Deellink: profiel Stroom ontbreekt. Controle: geen stroommeldingen.

**Stellingbouwer 3D**
- Stelling openen toont "niet in pakket".
- Stellingsjablonen (camerastellingen) in de bibliotheek grijs.

**Branding**
- Hek met gewone doekkleur kan nog.
- Werkruimte Branding grijs; geen tab Branding in de eigenschappen.
- Totems, vlaggen en ontwerpen in de bibliotheek grijs.
- Geen "ontwerp opladen" in de studio's; tab Doeken weg in het bibliotheekbeheer.

**Veiligheid**
- Controlepaneel: gewone meldingen blijven; brandveiligheid, hulpdiensten en attesten verdwijnen.
- Eigenschappen: geen keuringsattesten. Ctrl K: geen Brandveiligheid of Keuringsattesten.

**Binnenplan**
- Tab Binnen weg; binnenplan openen geeft "niet in pakket".
- Menu: geen pdf per verdieping. Adres met `?binnen=` opent gewoon het plan.

**Groot formaat**
- Pdf: geen vrij formaat, raster of bladindeling; A4 en A3 blijven.

**Terrein**
- Geen link Opbouwmodus; `/opbouw` toont "niet in pakket".

**Leveranciers**
- Materiaalscherm: geen bestellijst en leverlijst per leverancier; deellinkprofiel Leverancier ontbreekt.

**Integraties**
- Stock en GridLab enkel zichtbaar met de koppeling `stock` of `gridlab`.

## Migraties

- `0004_modules.sql`: eerste modulebewaking.
- `0005_pakketten.sql`: pakkettentabel, gekende modules, pakket toepassen, verfijnde bewaking. Getest met `test_0005.sql` (lokaal, alle controles geslaagd).
