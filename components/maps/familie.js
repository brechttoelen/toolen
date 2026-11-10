// Families: de indeling van de bibliotheek naar hoe je met een element werkt (welk detailscherm, welke tab in
// de bibliotheek). Een element heeft een vaste familie (kolom `familie`, migratie 024); ontbreekt ze, dan wordt
// ze afgeleid van de categorie. Items zonder element zijn vrije vormen.
import { isTentBouw } from './tentbouw';
import { isWand } from './framewand';
import { isLichtmast } from './licht';

export const FAMILIES = [
  { k: 'hekken', naam: 'Hekken', uitleg: 'Hekken en afsluitingen, barriers, paal en net, fietsenrekken' },
  { k: 'tenten', naam: 'Tenten', uitleg: 'Kadertenten, booghallen, pagodes, stretch- en sailclothtenten: met de tentbouwer in 3D' },
  { k: 'structuren', naam: 'Stellingen en truss', uitleg: 'Stellingbouw, truss en B-matrix wanden: met een bouwer in 3D' },
  { k: 'units', naam: 'Units', uitleg: 'Units en containers, mobiele structuren, toiletten, catering en afval' },
  { k: 'meubilair', naam: 'Meubilair', uitleg: 'Tafels, stoelen, statafels, lounge, binnenruimte en huismateriaal' },
  { k: 'stroom', naam: 'Stroom', uitleg: 'Generatoren, verdeelkasten, kabels, licht en geluid, verwarming' },
  { k: 'vloeren', naam: 'Vloeren', uitleg: 'Rijplaten, vloeren en cassettes, podiumelementen' },
  { k: 'schermen', naam: 'Schermen', uitleg: 'LED-wanden, LED-trailers, LCD, boarding en ledbogen' },
  { k: 'branding', naam: 'Branding', uitleg: 'Doeken, totems, vlaggen, frames, wegwijzers en borden' },
  { k: 'tv', naam: 'TV en telecom', uitleg: 'TV-compound, OB-wagens, data en telecom' },
  { k: 'voertuigen', naam: 'Voertuigen', uitleg: 'Vervoer, heftrucks, verreikers, hoogwerkers en andere machines' },
  { k: 'veiligheid', naam: 'Veiligheid', uitleg: 'Blusmiddelen, EHBO, nooduitgangen en vluchtwegaanduiding' },
  { k: 'sjablonen', naam: 'Sjablonen', uitleg: 'Vaste opstellingen van meerdere elementen samen' },
  { k: 'vormen', naam: 'Vrije vormen', uitleg: 'Lijn, vlak, rechthoek, cirkel, punt, tekst, notitie, maatlijn' },
];
export const FAMILIE_NAAM = Object.fromEntries(FAMILIES.map((f) => [f.k, f.naam]));
// Families met een bouwer in 3D (tent, stelling, truss, wand).
export const BOUWFAMILIES = ['tenten', 'structuren'];

// Familie uit de categorie (voor elementen zonder vaste familie, en als standaard in het beheer).
export function familieUitCategorie(categorie = '', el = null) {
  const c = String(categorie || '').toLowerCase();
  if (/hek|afsluit|barrier|fietsenstalling/.test(c)) return 'hekken';
  if (/tent/.test(c)) return 'tenten';
  if (/stellingbouw|truss|frame-?wand/.test(c)) return 'structuren';
  if (/elektric|verlichting|licht en geluid|verwarming|stroom/.test(c)) return 'stroom';
  if (/grondbescherming|vloer|podium/.test(c)) return 'vloeren';
  if (/scherm|^led/.test(c)) return 'schermen';
  if (/doek|drukwerk|vlag|totem|frames|communicatie|branding|signal|wegmarkering/.test(c)) return 'branding';
  if (/meubilair|meubel|binnenruimte|huismateriaal|interieur/.test(c)) return 'meubilair';
  if (/veiligheid|beveiliging|ehbo|brand/.test(c)) return 'veiligheid';
  if (/tv-compound|telecom|data|omroep/.test(c)) return 'tv';
  if (/voertuig|vervoer|machine/.test(c)) return 'voertuigen';
  if (/sjabloon|sjablonen/.test(c)) return 'sjablonen';
  if (el?.tekenwijze === 'sjabloon') return 'sjablonen';
  if (el?.tekenwijze === 'lijn') return 'hekken';
  return 'units';
}

const OUD_VERZAMEL = new Set(['units', 'veiligheid']);

// Familie van een element (vaste kolom, anders afgeleid).
export function familieVanElement(el) {
  if (!el) return 'vormen';
  // De vroegere verzamelfamilies (bouwers, units, veiligheid) kunnen nog uit een import komen: daar beslist de categorie.
  if (el.familie && FAMILIE_NAAM[el.familie] && !OUD_VERZAMEL.has(el.familie)) return el.familie;
  if (el.familie && OUD_VERZAMEL.has(el.familie) && el.categorie) { const c = familieUitCategorie(el.categorie, el); if (c !== 'units' || el.familie === 'units') return c; }
  if (isWand(el)) return 'structuren';
  if (isTentBouw(el)) return 'tenten';
  if (el.eigenschappen?.stelling) return 'structuren';
  if (isLichtmast(el)) return 'stroom';
  return familieUitCategorie(el.categorie, el);
}

// Familie van een item op het plan.
export function familieVan(item, el) {
  if (!item) return 'vormen';
  if (item.velden?.sign || item.velden?.verkeer) return 'branding';
  if (item.soort === 'element' && el) return familieVanElement(el);
  return 'vormen';
}
