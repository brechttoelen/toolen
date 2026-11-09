// Eén lijst met categorieën voor de bibliotheek én de leveranciers (een leverancier heeft er één of meer).
// Vaste volgorde: van wat het terrein bepaalt (tenten, structuren) naar toebehoren, techniek en wat er rond rijdt.
// Een categorie die hier niet in staat (bv. "Eigen") komt achteraan, alfabetisch.
export const CATEGORIEEN = [
  'Tenten en vloeren',
  'Mobiele structuren',
  'Podium',
  'Stellingbouw',
  'Truss',
  'Units en containers',
  'Hekken en afsluitingen',
  'Fietsenstalling',
  'Doeken en drukwerk',
  'Wegmarkering',
  'Grondbescherming',
  'Elektriciteit',
  'Data en telecom',
  'Licht en geluid',
  'Verwarming',
  'Schermen',
  'Catering',
  'Meubilair',
  'Toiletten',
  'Afval',
  'Veiligheid',
  'Beveiliging',
  'Personeel',
  'Vervoer',
  'Machines',
  'TV-compound',
  'Andere',
];
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
