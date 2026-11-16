# Ontwerp: binnenplan (FLCS Maps)

Status: gebouwd op 2 november 2026 (commit 715c9c7). Instelbaar meubilair is bijgekomen op 3 november 2026 (commit 7eb9ec0), naar het voorbeeld van Floorplanner en Social Tables. Alles staat op main. Het ontwerp komt uit een review met Fable.

## Flow
- **Kaart.** Zweven over het gebouw toont een voorvertoning: plattegrond, ruimtes met m² en zitplaatsen. Klikken opent het binnenscherm met een "naar binnen"-overgang.
- **Eerste keer (geen grondplan).** Een setupkaart in drie stappen:
  1. Grondplan laden. Een DXF of PDF komt op ware grootte binnen, met de zalen erbij.
  2. Schaal. Enkel bij een foto of PDF: klik twee punten en geef de afstand.
  3. Zalen. Uit het grondplan, of zelf tekenen.
  - Met "Zonder grondplan verder" teken je de zalen meteen als rechthoek.
- **Werkscherm.** Hier plaats en schik je enkel nog. Het grondplan ligt vast. Het menu "Grondplan" bevat: Vervangen · Schaal opnieuw · Zalen herkennen · Zaal aanklikken · Zaal tekenen · Op de kaart leggen.

## Layout
- **Kop:** "Terug naar de kaart" · naam · verdiepingen als tabs · menu Grondplan.
- **Links:** ruimtes met m² en "zitpl. / max" (rood als het maximum overschreden is), daaronder wat op deze verdieping staat, gesplitst in Eigen materiaal en Van het huis.
- **Canvas:** zwevende knoppen Selecteren / Meten (linksboven) en + / − / Passend (rechtsonder). Boven de selectie staat de maat.
- **Rechts:**
  - een selectiekaart (draaien, Dupliceren, Rij maken, Wissen, Opmerking, plus de instellingen van het meubel) of een ruimtekaart (naam, Max. personen);
  - daaronder de tabs Inrichten / Van het huis / Bibliotheek.

## Instelbaar meubilair (`meubel.js`, `item.velden.meubel`)
- **Tafel:**
  - vorm: rond, ovaal, rechthoek of halfrond;
  - maat;
  - stoelen: bij een rechthoek per zijde (boven, onder, links, rechts), bij rond of ovaal "rondom" of "één kant" (cabaret, een boog van 240°, open naar het podium);
  - knoppen Automatisch, Eén kant en Geen.
  - Automatisch = 60 cm tafelrand per stoel, 12 cm tussen tafelrand en stoel, zitvlak 45 cm.
- **Rijen (theater of klas):** rijen, stoelen per rij, gang na x stoelen, gangbreedte, rijafstand (0,9 m theater, 1,2 m klas), stoelbreedte, met of zonder tafels.
- **Verder:** stoel, podium, bar en buffet (breedte × diepte).
- **Deur en raam:**
  - klikken in de dichtste muur (lijn van het grondplan of een getekende muur);
  - bij een dubbele muurlijn komen ze in het midden en nemen ze de muurdikte over;
  - bij slepen schuiven ze langs de muur;
  - de deur heeft een knop om het scharnier om te keren, een knop voor de draairichting en de optie Dubbel.
- **Huismateriaal koppelen:** een meubel kan verwijzen naar een tafel van het huis (`element_id`) en naar stoelen van het huis (`meubel.stoel_huis`). De tellers houden daar rekening mee.
- **Gewone bibliotheekelementen:** breedte × diepte intikken.

## Huismateriaal
- Een element in `bibliotheek` met categorie "Huismateriaal" en `eigenschappen.huis = { locatie, aantal }`. Daarnaast `zitplaatsen`, `tafel {vorm, b, d}` en een sjabloon `meubel`.
- De koppeling loopt via de slug van de locatie in `host.velden.binnenplan.locatie`. Daardoor is het materiaal herbruikbaar over plannen heen.
- Een geplaatst item krijgt `velden.binnen.huis = true`. Stuklijst en leverlijst slaan het over. De gewone bibliotheek toont geen huismateriaal.
- Teller per element: "n / max". Is alles geplaatst, dan wordt de teller rood. Plaatsen blijft mogelijk, want het huis kan bijhuren.
- **Thermae Palace** (`thermae-palace`, ingevoerd op 3 november 2026):
  - 45 brede registratietafels (140 × 80 cm) en 40 smalle (140 × 45 cm);
  - 600 groene stoelen en 80 blauwe stoelen (zaal Elisabeth);
  - 25 podiumstukken (maat aangenomen: 2 × 1 m);
  - 30 ronde tafels Ø 1,8 m (10 zitplaatsen);
  - statafels (Ø 0,8 m aangenomen): 35 met zwart onderstel, 16 met wit onderstel, 20 met zwarte hoes;
  - 3 pupiters (0,6 × 0,5 m aangenomen).

## Later
- Meubels die we zelf meebrengen, op de stuklijst zetten.
- Gebogen rijen.
- Een zaal automatisch vullen.
- Uitlijnen en verdelen.
- Kopiëren tussen verdiepingen.
- PDF per zaal.
- Een lijst "Vragen aan het huis".
