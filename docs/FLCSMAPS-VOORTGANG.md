# FLCS Maps: voortgang en testlijst

Adres: publitool.flcs.app/flcsmaps (geen zichtbare link vanuit Publitool).
Ontwerp: docs/ONTWERP-eventplan.md. Code: components/flcsmaps/, app/flcsmaps/, public/flcsmaps-sw.js.
Databank: schema `flcsmaps`. Migraties 001 t.e.m. 025 zijn uitgevoerd (laatste: 7/11/2026).

## Stellingbouwer (7 nov 2026)

**Stap 1 (klaar): 3D als echte stelling** (`StellingDrieGL.jsx`, three.js 0.169, pas geladen bij het openen van een groot 3D-beeld)
- Eén scène voor alle weergaven: `bouwScene()` in `StellingStudio.jsx` roept per onderdeel een tekenfunctie aan (quad, lijn, voet, rozet, beeld, label, ladder, vloerligger). Het kleine SVG-voorbeeld (paneel, bibliotheek) en de 3D tekenen allebei daaruit.
- 3D: verzinkte buizen Ø 48 mm, rozetten om de 0,5 m, liggers en kruisen die op de rozetten uitkomen met een wigkop, U-liggers met uitsparingen onder de platen, insteekpen bovenaan de staanders, voetplaat met spindel en onderlegplank, aluminium ladder die tegen een doorlopende leuning staat, doeken met hun ontwerp, licht en schaduw. InstancedMesh per soort onderdeel.
- **Wielen**: vinkje "Op wielen" (st.wielen): zwenkwiel 200 mm met spindel en rem in 3D; in de stuklijst "Zwenkwiel 200 mm met spindel en rem (800 kg)" i.p.v. voetplaat en onderlegplank; het wiel neemt 0,35 m in (WIEL_H).
- **Halve vakken**: maatlat boven en links van het raster, klik wisselt een kolom of rij tussen 2,07 en 1,04 m. Rennersbrug-breedtes 1,04 / 2,07 / 3,11 / 4,14 / 5,18 / 6,22 m.
- De kantplank (grijs) en de bruine dekrand zijn uit de tekening gehaald (verzonnen). **Open vraag**: de stuklijst telt nog "Afrokstrook … (kantplank)"; navragen of die bij Gigant echt meekomt.

**Stap 2 (te doen): het bouwen zelf**
- Starten vanuit een type (rennersbrug, voetgangersbrug met trappen, camerastelling, podium, tribune) met de maten van het plan: vrije doorgang, brugbreedte, helling, aanloop.
- Zijaanzicht als hoofdscherm met maatlijnen zoals op de Gigant-plannen; slepen klikt vast op vakken (2,07 / 1,04) en rozetten (0,5 m). Bovenaanzicht voor uitzonderingen; vakgereedschap achter "Vakken aanpassen".
- Een vak in 3D aanklikken = kiezen in het bovenaanzicht.
- **Diagonalen** volgens Gigant plaatsen (nu in elk buitenvak, terwijl de stuklijst er minder telt) en het 3D-beeld uit dezelfde onderdelenlijst als de stuklijst halen.
- **Schuine liggers in de leuning van camerastellingen** (van de leuningstaander schuin naar de rozet op dekhoogte, zoals op de Gigant-plannen): goed nadenken hoe je die tekent en kiest.

## UX-ombouw (7 nov 2026)

Uitgewerkt vanuit de wireframes (artifact "FLCS Maps wireframes", per familie).

- **Families** (`familie.js`, kolom `bibliotheek.familie`, migratie 024): Hekken · Bouwers · Units · Stroom · Schermen · Vloeren · Branding · Veiligheid · Vrije vormen. Ontbreekt de kolom, dan afgeleid uit de categorie. Let op: `eigenschappen.familie` is iets anders: de **variantgroep** (één rij met knopjes per variant, bv. Generator 20 · 30 · 45 kVA). In het beheer heet dat veld nu ook "Variantgroep".
- **Detailpaneel** (`Paneel.jsx`, `Eigenschappen.jsx`): kop met Naam / Element / Laag / Fase / Leverancier en een ⋯-menu (dit item, volgorde, groep, lijn, bewaren, verwijderen); daaronder het kerngetal per familie en tabs. Tabs per familie: Bouwer (tenten, stellingen, truss, wand) of Camera (camerastelling), Panelen/Doeken (totem, frame, truss-doek, drape), Licht of Stroom, Instellen (heet Leggen bij vloeren), Binnen (tenten, units, vrije vlakken), Stijl (enkel zonder eigen tekening; bij een punt heet ze Icoon), Meer. Nooit meer dan vier of vijf tabs, zodat ze op één rij passen.
- **Bibliotheek in het plan** (`BibliotheekPaneel.jsx`): zoeken bovenaan over alles (resultaten per familie, tabs verdwijnen); familietabs met ★ Start (in dit plan, favorieten, recent); binnen een familie de categorieën als inklapbare koppen, opstellingen van een partner en "Dit event" onderaan. Categorie-keuzelijst enkel bij meer dan 6 categorieën; leveranciersfilter enkel als er binnen de keuze iets te kiezen valt.
- **Beheer** (`BibliotheekBeheer.jsx`): standaard tabelweergave met kolom Familie, familietabs en daaronder categoriechips, familie in de bulkbewerking. Bij een nieuw element is Familie de eerste keuze (een hek zet de tekenwijze op lijn). Het stroomblok volgt de familie Stroom, niet meer de categorienaam.
- **Plaatsen**: de opties (draaien, naast elkaar, fractie, leg-richting, per klik) staan in een eigen paneel, niet meer in de zwarte balk.
- **Keuzes knoppen vs. keuzelijsten**: segmentknoppen voor 2–3 korte, vaak gebruikte keuzes (licht Uit · Rondom · Eén kant; camera Op statief · Los); keuzelijsten voor lange of zelden gewijzigde keuzes (familie, element, laag, categorie bij veel categorieën). Acties die ook in het ⋯-menu staan, krijgen in het paneel enkel de twee meest gebruikte (Evenwijdige kopie, Verder tekenen). "Alle lichtmasten aan/uit" staat als kleine regel onder het licht. Label op de kaart staat onderaan Instellen.

## Feedback van testers (7 nov 2026, migratie 025)

- Knop **Feedback** in elk scherm (editor, lijsten, deellink): soort (probleem, idee, vraag), tekst, **Aanwijzen** (klik op de knop of het veld waar het over gaat), schermafdruk van de kaart. De context gaat automatisch mee: scherm, werkruimte, gereedschap, geselecteerd item (familie, element, tab), kaartbeeld, versie, venstergrootte.
- Overzicht op **/flcsmaps/feedback**: filters op status en soort, zoeken, telling per plek, status en antwoord voor beheerders, knop "Ga naar het item" die het plan opent op die plek met het item geselecteerd (`?item`, `?c`, `?z`).
- Tabel `flcsmaps.feedback` met RLS (iedereen met leesrecht geeft feedback en ziet de eigen; beheerders zien en behandelen alles). Deellinks via RPC `deel_link_feedback`.
- Valkuil (opgelost): de knop zit in de layout en laadde `flcsmaps.css` vóór de MapLibre-CSS, waardoor `.maplibregl-map { position: relative }` won en de kaart geen hoogte had. `Feedback.jsx` laadt daarom eerst `maplibre-gl.css`.

## Bewerken (7 nov 2026)

- **Gebogen lijn**: selecteren, slepen en een punt toevoegen gebeurt op de bocht zelf (`slimSlepen.js`, `geo.splitsBoog`); een punt op de bocht verdeelt de bocht over de twee helften, zodat de vorm gelijk blijft.
- **Stellingen en bruggen**: grijpen op het hele dek, draaien rond het midden van de constructie (greep aan de kant van het dek, draait mee), de tekening en het kader draaien zichtbaar mee. Geen bocht- of verdergrepen op een stelling.
- **Hekken** (bouwplan stap 1): marathonhek 2,5 m, pootjes spiegelen en naar buiten langs het parcours, nadardriehoek als eigen hek, nadar zonder klem (migratie 023). Stukken van lijnelementen pas vanaf zoom 16,5.

## Performance (7 nov 2026)

De editor was traag geworden bij plaatsen, tekenen en verslepen in grote plannen (WK-plan: ~1.000 items). Oorzaken en oplossing:

- **Tekening per item gecachet** (`stijl.js`, `naarGeojson`): features per item-object onthouden; features van één item met dezelfde stijl samengevoegd (43.000 → ~4.800). `losseFeatures()` splitst ze weer voor de pdf. Feature-id `itemId#n`.
- **Kaartbron bijwerken met enkel het verschil** (`kaartbron.js`, MapLibre `updateData`); terugval op `setData` als > 40 % verandert.
- **Sleepvoorbeeld**: originelen tijdens het slepen uit de bron (`bronVerberg`/`bronHerstel`). Bij draaien wordt het voorbeeld opnieuw getekend (eerste én laatste punt vergeleken).
- **Terra Draw houdt enkel de selectie vast** (`slimTd`); snappen zelf in `snapMidden`.
- **Controle** (`controle.js`): voorselectie met omhullende rechthoeken, in `requestIdleCallback`.
- **Editor hertekent minder**: meldingstekst via `useSyncExternalStore`, `StellingDrie` gememoiseerd.

Meting (prod-build, testplan 1.026 items, JS-tijd zonder GPU): tent slepen 20× 1.398 → 411 ms, lijn tekenen 2.288 → 290 ms, 5 elementen plaatsen 1.602 → 177 ms, langste blokkering 716 → 124–268 ms.

Testgereedschap in de scratchpad van de sessie: `perf/nepbase3.js` (nep-Supabase), `perf/smoke.js`, `perf/boogtest.js`, `perf/stelltest.js`, `perf/bibtest.js`, `perf/famfoto.js`, `perf/studiofoto.js` en `perf/ladder.js` (3D-schermafdrukken).

## Stand (1 nov 2026)

**Werkruimtes** (Alt+1 … Alt+5): Plan · Signalisatie (wegwijzers en verkeer) · Stroom · Veiligheid · Branding.

**Samenwerken** (migraties 006–010)
- Bewaren per veld met rev, botsingskaart bij hetzelfde veld, live wijzigingen en aanwezigheid, zacht slot, prullenbak, logboek, werkruimte claimen, aankondiging bij versie terugzetten, offline wachtrij.
- Nog te doen: praktijktest met twee echte gebruikers. Nog manueel: cron-SQL voor het opkuisen van de prullenbak na 90 dagen (migratie 006).

**Branding** (werkruimte 5): Heras met bedrukt doek, infototem, beachvlaggen; ontwerpen als bibliotheekrijen met tekenwijze `doek`; penseel; brandingplan PDF en bestellijst CSV.

**Eerder**: tekenen, bibliotheek, controle, keuringsattesten, draaiboek, versies, ondergrond, brandveiligheid per hulpverleningszone, vaste aansluitingen, verkeerssignalisatie.

## Geparkeerd (bouwplan, artifact "FLCS Maps · Bouwplan zaterdag")

- Stap 2: werkruimte Spandoeken en partners (bibliotheek per partner, dragers, koppeling met de stock, teller).
- Stap 3: kijkhoek van een camera van bovenaf, met hoogtes.
- Stap 4: camerabeeld in 3D met doeken, inflatables en led-loops (tab "Loop" bij schermen komt dan).
- Stap 5: kabelcamera en camerakraan (Eurogrip en anderen).

## Bewust niet
- Personeelsplanning en kosten. Geen gewicht/transport-berekening in de stuklijst.
- DWG rechtstreeks: eerst als DXF bewaren.
- Groot-Brittannië: geen gratis open luchtfoto op hoge resolutie.

## Testlijst (open)
- [ ] Stelling 3D op een gewone laptop en een iPad (vlot draaien, schaduw)
- [ ] Afrokstrook (kantplank) in de stuklijst: komt die bij Gigant echt mee?
- [ ] Nieuw paneel en bibliotheek met de testers (via de feedbackknop)
- [ ] Gebogen lijn en brug draaien op het WK-plan
- [ ] Praktijktest samenwerken met twee echte gebruikers
- [ ] Performance in de praktijk op het WK-plan (slepen, tekenen, snappen op hekken, pdf-export)
- [ ] Branding: doek uploaden als pdf, penseel over een Heras-lijn met hoeken, brandingplan PDF afdrukken
- [ ] Signalisatieplan PDF in de praktijk
- [ ] Afmetingen Ericsson Mobile Truck bevestigen (nu 8 × 2,5 m geschat)
- [ ] Beachvlaggen: echte types en maten van FLCS
- [ ] Luchtfoto's VL, NL, Wallonië, Frankrijk, NRW; deel-link in privévenster en op gsm
