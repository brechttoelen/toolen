// Families: de indeling van de bibliotheek naar hoe je met een element werkt (welk detailscherm, welke tab in
// de bibliotheek). Een element heeft een vaste familie (kolom `familie`, migratie 024); ontbreekt ze, dan wordt
// ze afgeleid van de categorie. Items zonder element zijn vrije vormen.
import { isTentBouw } from './tentbouw';
import { isWand } from './framewand';
import { isLichtmast } from './licht';

export const FAMILIES = [
  { k: 'hekken', naam: 'Hekken', uitleg: 'Hekken en afsluitingen, barriers, paal en net, fietsenrekken' },
  { k: 'bouwers', naam: 'Bouwers', uitleg: 'Tenten, stellingen, truss en wanden: met een bouwer in 3D' },
  { k: 'units', naam: 'Units', uitleg: 'Units en containers, mobiele structuren, catering, toiletten, voertuigen, machines, telecom, afval' },
  { k: 'stroom', naam: 'Stroom', uitleg: 'Generatoren, verdeelkasten, kabels, verlichting, verwarming' },
  { k: 'schermen', naam: 'Schermen', uitleg: 'LED-wanden, LED-trailers, LCD, boarding en ledbogen' },
  { k: 'vloeren', naam: 'Vloeren', uitleg: 'Rijplaten, vloeren en cassettes, podiumelementen' },
  { k: 'branding', naam: 'Branding', uitleg: 'Doeken, totems, vlaggen, frames, wegwijzers en borden' },
  { k: 'veiligheid', naam: 'Veiligheid', uitleg: 'Veiligheid, vluchtwegen, binnenruimte, meubilair en huismateriaal' },
  { k: 'vormen', naam: 'Vrije vormen', uitleg: 'Lijn, vlak, rechthoek, cirkel, punt, tekst, notitie, maatlijn' },
];
export const FAMILIE_NAAM = Object.fromEntries(FAMILIES.map((f) => [f.k, f.naam]));

// Familie uit de categorie (voor elementen zonder vaste familie, en als standaard in het beheer).
export function familieUitCategorie(categorie = '', el = null) {
  const c = String(categorie || '').toLowerCase();
  if (/hek|afsluit|barrier|fietsenstalling/.test(c)) return 'hekken';
  if (/tent|stellingbouw|truss/.test(c)) return 'bouwers';
  if (/elektric|verlichting|licht en geluid|verwarming|stroom/.test(c)) return 'stroom';
  if (/grondbescherming|vloer|podium/.test(c)) return 'vloeren';
  if (/scherm|^led/.test(c)) return 'schermen';
  if (/doek|drukwerk|communicatie|branding|signal|wegmarkering/.test(c)) return 'branding';
  if (/veiligheid|beveiliging|binnenruimte|meubilair|huismateriaal/.test(c)) return 'veiligheid';
  if (/unit|container|mobiele|catering|toilet|voertuig|vervoer|machine|telecom|afval|tv-compound|personeel|sjabloon|overig|andere/.test(c)) return 'units';
  if (el?.tekenwijze === 'lijn') return 'hekken';
  return 'units';
}

// Familie van een element (vaste kolom, anders afgeleid).
export function familieVanElement(el) {
  if (!el) return 'vormen';
  if (el.familie && FAMILIE_NAAM[el.familie]) return el.familie;
  if (isWand(el)) return 'bouwers';
  if (isTentBouw(el)) return 'bouwers';
  if (el.eigenschappen?.stelling) return 'bouwers';
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
