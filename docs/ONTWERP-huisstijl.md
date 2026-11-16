# Toolen — huisstijl

Status: vastgelegd 9 nov 2026 · bron: Toolen design DNA (beeld van Brecht) · code: `app/toolen.css` (tokens), `components/ToolenLogo.tsx`.

Toolen is het bedrijf; **Toolen Maps** is het eerste product. Licht werkscherm, navy kop. Geen FLCS-stijl meer (zwart `#1d1d1b`, rood `#E11D48`, rechte hoeken).

## DNA

- afgeronde geometrie
- magnetische balans
- precies ritme en spacing
- diepe navy materie
- motion met intentie

## Kleuren

| Token | Waarde | Gebruik |
|---|---|---|
| `--t-navy` | `#022056` | kop van de app, sterke tekst, actieve toestand in de editor |
| `--t-blauw` | `#108AED` | hoofdknop, selectie, links, focus |
| `--t-groen` | `#28B571` | bevestiging, "ok", tweede accent in het logo |
| `--t-wit` | `#FFFFFF` | kaarten, velden |
| `--t-vlak` | `#F5F7FA` | pagina |
| `--t-vlak-2` | `#EEF2F7` | hover, geselecteerd |
| `--t-rand` / `--t-rand-2` | `#E3E8EF` / `#CFD7E3` | lijnen, randen van velden |
| `--t-tekst` / `-2` / `-3` | `#0E1A33` / `#4A5A75` / `#8492A8` | tekst, secundair, stil |
| `--t-fout`, `--t-let-op` | `#D93A3A`, `#C77700` | enkel voor betekenis |

Eén accent per actie. Blauw en groen nooit samen op dezelfde knop of in een verloop.

## Letter

IBM Plex Sans (in de app zelf, niet via Google). Titels SemiBold (600), tekst Regular, labels Medium (500). Geen hoofdletterlabels.

## Vorm en ritme

- Hoeken: 6 px knoppen en velden, 10 px kaarten, 14 px dialogen en grote vlakken. Pillen volledig rond.
- Spacing in stappen van 4: 4, 8, 12, 16, 24, 32, 48.
- Hoogtes: kop 52 px, knop 34 px, kleine knop 28 px.
- Schaduw enkel op wat zweeft (menu, dialoog, zwevend paneel). Kaarten hebben een rand, geen schaduw.

## Wat niet (niet "vibe coded")

- Geen gloed, verlopen, 3D-bollen of lichtsporen in de app. Die horen bij marketing (site, app-icoon) als ze er al komen.
- Geen emoji of icoontekens als versiering; iconen enkel waar ze iets doen.
- Geen kleur zonder betekenis: grijs tenzij het een actie, een status of een selectie is.
- Geen tekst die vertelt wat je al ziet.

## Logo

Vier afgeronde vierkanten in een ruit: boven blauw, rechts groen, links en onder in de grondkleur (wit op navy, navy op licht). Woordmerk "toolen" in kleine letters, SemiBold. Product erachter in Regular: "toolen maps".

## Kaart en drukwerk

Kaartsymbolen, tekenkleuren en de kleuren van lagen zijn inhoud, geen huisstijl: die blijven zoals de gebruiker ze kiest. In PDF's komt de naam van de organisatie in het titelblok; "Gemaakt met Toolen Maps" klein in de bronregel.

## In de code

- `app/toolen.css`: tokens (`--t-*`) en basisonderdelen (`.t-knop`, `.t-veld`, `.t-kaart`, `.t-tabel`, `.t-pil`, `.t-tabs`, `.t-kop`, `.t-menu`, `.t-dialoog`).
- De editor (`components/maps/maps.css`) leest dezelfde tokens via `--fm-zwart` (navy), `--fm-rood` (blauw), `--fm-aan-bg`, `--fm-rood-zacht`.
- Nog te doen: vaste kleurcodes in losse editorschermen (inline `#1d1d1b`) stap voor stap naar tokens.
