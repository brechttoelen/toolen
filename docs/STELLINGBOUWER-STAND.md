# Stellingbouwer — stand van de bouw

Hoort bij docs/ONTWERP-stellingbouwer.md (het plan). Bijgewerkt 8 nov 2026 (avond): alle fases af.

| Onderdeel | Stand | Commit |
|---|---|---|
| 0 Fundament | `stelling/scene.js` (één bron voor 3D en stuklijst), `stelling/opschonen.js`, kantplank weg | e4953bb |
| 1 Interactielaag | hover-gloed, liggers slepen/toevoegen/Delete, vloer- en tussenvloerhoogte, helling per uiteinde | 61d8b1e |
| 2 Studio + Bouwen | drie stappen (1/2/3), raster en 3D naast elkaar, startscherm, Delete op rand = geen leuning | e64ff30, 5cafc9d |
| Dek slepen in 3D | vlak dek bij een helling: hele vlakke deel schuift, hellingen volgen (max 1 m per vak) | b8d38e9 |
| 3 Branding | zijdekiezer, slepen = doek, kant uit kijkrichting, klik = kiezen, grepen op de hoeken, Delete, ontwerptegel → gekozen doek, Boven = doek bovenop | 5aa18f8, 42da04e |
| Helling | doeken onder het dek en op de leuning volgen de schuine lijn, ontwerp rechtop en bijgesneden | 11febf6 |
| 4 Nakijken | maattekening per zijde (voor/achter/links/rechts), alleen-lezen, afdrukken (A4 liggend) | b8d38e9 |
| Staanders | `st.staanders`: klik een staander → weghalen; stippellijn onder een overspanning → plaatsen; Automatisch | 8e0f171 |
| Schoren | `st.schoren[rand] = [[za, zb], …]`: schoor kiezen + Delete; Shift + twee rozetten op naburige staanders = schoor (even hoog = ligger) | d9e79b3 |
| 5 Opruimen | zijaanzicht-bewerken en doek tekenen in het zijaanzicht weg, perVak weg, hover raster → 3D | 3fcb927 |

Model, nieuw: `st.staanders` (hoek → true/false), `st.schoren[rand]` mag ook een lijst rozettenparen zijn (za op staander a van de rand, zb op staander b).

Let op: de commits hierboven staan in de historiek van Publitool (flanders-classics/flcs-publitool), niet in deze repo.
