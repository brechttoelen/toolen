// Eén lijst met categorieën voor de bibliotheek én de leveranciers (een leverancier heeft er één of meer).
// Vaste volgorde: van wat het terrein bepaalt (tenten, structuren) naar toebehoren, techniek en wat er rond rijdt.
// Een categorie die hier niet in staat (bv. "Eigen") komt achteraan, alfabetisch.
export const SECTIES = [
  ['Structuren', ['Tenten en vloeren', 'Mobiele structuren', 'Podium', 'Stellingbouw', 'Truss', 'Units en containers']],
  ['Terrein', ['Hekken en afsluitingen', 'Fietsenstalling', 'Grondbescherming', 'Doeken en drukwerk', 'Wegmarkering']],
  ['Techniek', ['Elektriciteit', 'Licht en geluid', 'Verwarming', 'Data en telecom', 'Schermen', 'TV-compound']],
  ['Voorzieningen', ['Catering', 'Meubilair', 'Toiletten', 'Afval', 'Veiligheid', 'Beveiliging', 'Personeel']],
  ['Logistiek', ['Vervoer', 'Machines']],
  ['Overig', ['Andere']],
];
export const CATEGORIEEN = SECTIES.flatMap(([, l]) => l);
// Categorieën zonder leverancier: materiaal van de locatie zelf of hulpmiddelen van de app.
export const ZONDER_LEVERANCIER = ['Binnenruimte', 'Huismateriaal', 'Sjablonen'];
// Tenten heette vroeger "Tenten"; beide namen tellen (overgang).
export const isTentCategorie = (c) => c === 'Tenten en vloeren' || c === 'Tenten';


const RANG = new Map(CATEGORIEEN.map((c, i) => [c.toLowerCase(), i]));

// Sorteerfunctie voor categorienamen.
export function vergelijkCategorie(a, b) {
  const ra = RANG.get(String(a || '').toLowerCase()); const rb = RANG.get(String(b || '').toLowerCase());
  if (ra != null && rb != null) return ra - rb;
  if (ra != null) return -1;
  if (rb != null) return 1;
  return String(a || '').localeCompare(String(b || ''), 'nl');
}

export const sorteerCategorieen = (lijst) => [...lijst].sort(vergelijkCategorie);

// Rubrieken in de bibliotheek van het plan: één rubriek per categorie, dezelfde indeling als bij de leveranciers
// (de standaardleverancier van een plan geldt ook per categorie). Materiaal van de locatie zelf staat samen.
export const LOCATIE = 'Locatie';
export const rubriekVan = (categorie) => {
  const c = categorie || 'Andere';
  if (c === 'Binnenruimte' || c === 'Huismateriaal') return LOCATIE;
  if (c === 'Tenten') return 'Tenten en vloeren';
  return c;
};
// Rubrieken per sectie, in vaste volgorde; onbekende categorieën onder Overig.
export function rubriekSecties(rubrieken) {
  const alle = new Set(rubrieken); const uit = [];
  for (const [naam, l] of SECTIES) {
    const r = l.filter((c) => alle.has(c));
    if (naam === 'Overig') { r.unshift(...[...alle].filter((c) => !CATEGORIEEN.includes(c) && c !== 'Andere').sort((x, y) => (x === LOCATIE ? -1 : y === LOCATIE ? 1 : x.localeCompare(y, 'nl')))); }
    if (r.length) uit.push([naam, r]);
  }
  return uit;
}
export const rubriekNaam = (r) => (r === 'Tenten en vloeren' ? 'Tenten' : r === 'Doeken en drukwerk' ? 'Branding' : r === LOCATIE ? 'Locatie (binnenruimte, huismateriaal)' : r);
