// Gereedschap, groepen, panelen en vaste teksten van de editor (geen React).

export const GEREEDSCHAP = [
  { id: 'selecteer', naam: 'Selecteren', toets: 'V', icoon: 'selecteer' },
  { id: 'hand', naam: 'Kaart verschuiven', toets: 'H', icoon: 'hand' },
  { id: 'kader', naam: 'Selecteren met een kader', toets: '', icoon: 'kader' },
  null,
  { id: 'punt', naam: 'Punt', toets: 'P', icoon: 'punt' },
  { id: 'lijn', naam: 'Lijn', toets: 'L', icoon: 'lijn' },
  { id: 'route', naam: 'Route langs de weg', toets: '', icoon: 'navigeer' },
  { id: 'vlak', naam: 'Veelhoek', toets: 'G', icoon: 'vlak' },
  { id: 'rechthoek', naam: 'Rechthoek', toets: 'R', icoon: 'rechthoek' },
  { id: 'cirkel', naam: 'Cirkel', toets: 'C', icoon: 'cirkel' },
  { id: 'vrijehand', naam: 'Vrij tekenen', toets: 'F', icoon: 'vrijehand' },
  { id: 'knip', naam: 'Lijnen knippen', toets: 'X', icoon: 'schaar' },
  { id: 'veelhoek', naam: 'Regelmatige veelhoek', toets: 'N', icoon: 'veelhoek' },
  { id: 'ellips', naam: 'Ellips', toets: 'O', icoon: 'ellips' },
  { id: 'sector', naam: 'Kijkhoek (camera, speaker)', toets: 'K', icoon: 'sector' },
  { id: 'tekst', naam: 'Tekst', toets: 'T', icoon: 'tekst' },
  { id: 'notitie', naam: 'Notitie met pijl', toets: '', icoon: 'tekst' },
  { id: 'binnenlocatie', naam: 'Binnenlocatie', toets: '', icoon: 'gebouw' },
  { id: 'element', naam: 'Element uit de bibliotheek', toets: 'E', icoon: 'element' },
  null,
  { id: 'meten', naam: 'Afstand meten', toets: 'M', icoon: 'meten' },
  { id: 'meten-vlak', naam: 'Oppervlakte meten', toets: '', icoon: 'meten' },
  { id: 'maatlijn', naam: 'Maatlijn (komt op de PDF)', toets: '', icoon: 'meten' },
  { id: 'vast', naam: 'Vaste aansluiting', toets: '', icoon: 'bliksem' },
  { id: 'kabel', naam: 'Kabel', toets: '', icoon: 'lijn' },
];

export const UITLEG = {
  selecteer: 'Klik een item · sleep om te verplaatsen (Alt = kopie) · Shift + slepen = kader · rechtsklik = menu',
  hand: 'Sleep om de kaart te verschuiven',
  kader: 'Sleep een kader: alles wat erin valt wordt geselecteerd · Shift houdt de vorige selectie',
  verleng: 'Klik om de lijn te verlengen · typ een lengte + Enter · dubbelklik, rechtsklik of Klaar om te stoppen',
  evenwijdig: 'Klik op de lijn het begin en het einde van het stuk · Esc stopt',
  knip: 'Klik op een lijn om ze daar te knippen · zoveel als je wil · Enter of Esc om te stoppen',
  punt: 'Klik waar het punt moet komen',
  binnenlocatie: 'Klik op het gebouw · daarna Binnenplan maken',
  bouwer: 'Klik op de kaart waar het moet komen: de bouwer opent meteen · Esc = stoppen',
  lijn: 'Klik de punten · typ een lengte + Enter voor een exact stuk (Shift = per 15°) · dubbelklik of Klaar',
  route: 'Klik start en tussenpunten · de lijn volgt de weg · dubbelklik of Klaar',
  vlak: 'Klik de hoekpunten · klik het eerste punt om te sluiten',
  rechthoek: 'Klik twee hoeken · maten pas je rechts aan',
  cirkel: 'Klik het midden en sleep · straal pas je rechts aan',
  vrijehand: 'Klik en teken · klik opnieuw om te stoppen',
  tekst: 'Klik waar de tekst moet komen',
  veelhoek: 'Klik om te plaatsen · zijden pas je rechts aan',
  ellips: 'Klik om te plaatsen · maten pas je rechts aan',
  sector: 'Klik op de plaats van camera of speaker',
  element: 'Kies een element en klik op de kaart',
  meten: 'Klik de punten · dubbelklik om te stoppen',
  'meten-vlak': 'Klik de hoekpunten · klik het eerste punt om te sluiten',
  notitie: 'Klik op het object · dubbelklik waar de tekst moet komen',
  maatlijn: 'Klik het begin · dubbelklik op het einde',
  kabel: 'Klik de bron of kast, dan de verbruiker: de kabel komt als rechte lijn, versleep de tussenpunten',
  vast: 'Klik waar de stroomkast of het aansluitpunt van de stad staat · geldt voor alle evenementen',
};

// Eenvoudige modus: minder gereedschap en opties, voor wie er voor het eerst mee werkt.
export const UITGEBREID_TOOLS = ['vrijehand', 'veelhoek', 'ellips', 'sector'];
// De stuklijst zit in het materiaalscherm (knop Materiaal); hier enkel nog het draaiboek.
export const LIJST_TABS = [['draaiboek', 'Draaiboek']];
export const LIJST_IDS = LIJST_TABS.map(([k]) => k);

export const TD_MODUS = { punt: 'point', tekst: 'point', lijn: 'linestring', meten: 'linestring', 'meten-vlak': 'polygon', notitie: 'linestring', maatlijn: 'linestring', vlak: 'polygon', rechthoek: 'rectangle', cirkel: 'circle', vrijehand: 'freehand', selecteer: 'select', kader: 'select', hand: 'select' }; // kader en hand: selectie blijft staan

export const GROEPEN = [
  // Volgorde: Selectie, Meten, Tekenen, Element (daarna Bouwers). Selectie en Meten klappen open bij erover gaan;
  // Tekenen, Element en Bouwers openen een paneel.
  { id: 'selectie', label: 'Selectie', tools: ['selecteer', 'kader', 'hand'] },
  { id: 'meten', label: 'Meten', tools: ['meten', 'meten-vlak', 'maatlijn'] },
  { id: 'tekenen', label: 'Tekenen', icoon: 'tekenen', paneel: true, tools: ['lijn', 'route', 'vrijehand', 'knip', 'rechthoek', 'cirkel', 'vlak', 'veelhoek', 'ellips', 'sector', 'punt', 'tekst', 'notitie', 'binnenlocatie'] },
  { id: 'element', label: 'Element', tools: ['element'] },
];
export const PANELEN = [
  // Stroom en Borden enkel in hun eigen werkplek (generatoren en borden plaats je in Plan gewoon als element).
  ['lagen', 'Lagen', 'lagen'],
  ['materiaal', 'Materiaal', 'lijstje'], ['controle', 'Controle', 'vink'],
];
// Het plan zelf (gegevens, fasen, achtergrond, regels, geschiedenis) staat rechts als niets geselecteerd is.
// Delen van het paneel Tekenen.
export const TEKEN_DELEN = [
  { naam: 'Lijnen', tools: ['lijn', 'route', 'vrijehand', 'knip'] },
  { naam: 'Vormen', tools: ['rechthoek', 'cirkel', 'vlak', 'veelhoek', 'ellips', 'sector'] },
  { naam: 'Punten en tekst', tools: ['punt', 'tekst', 'notitie', 'binnenlocatie'] },
];

export const PANEELNAAM = { tekenen: 'Tekenen', bouwers: 'Bouwers', lagen: 'Lagen', bibliotheek: 'Bibliotheek', lijsten: 'Lijsten', materiaal: 'Materiaal', stuklijst: 'Materiaal', stroom: 'Elektriciteit', sign: 'Signalisatie', draaiboek: 'Draaiboek', controle: 'Controle', plan: 'Plan', veiligheid: 'Veiligheid', branding: 'Branding' };

export const PANEELTIP = {
  bibliotheek: 'Tenten, hekken, podia… kies een element en zet het op de kaart',
  lagen: 'Lagen tonen, verbergen, vergrendelen en hun stijl instellen',
  stroom: 'Elektriciteit: bronnen, kasten, kabels en verbruik',
  sign: 'Signalisatie: borden, routes en bordpunten',
  materiaal: 'Materiaal per leverancier, categorie of laag: wat er nodig is en waar het staat',
  draaiboek: 'Opbouw en afbraak: wie doet wat en wanneer',
  controle: 'Nakijken voor je deelt: wat botst, ontbreekt of te dicht staat',
};

export const nieuwId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));
