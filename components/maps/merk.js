// Merk en organisatie. Het product heet Toolen Maps; de organisatie (bv. Flanders Classics)
// wordt gezet door de layout van de organisatie (setOrganisatie) en komt in titelblokken en deellinks.
export const PRODUCT = 'Toolen Maps';
export const BEDRIJF = 'Toolen';

let organisatie = null; // { slug, naam, kort, modules }
export function setOrganisatie(o) { organisatie = o || null; }
export function getOrganisatie() { return organisatie; }
// Korte naam voor het titelblok van een PDF: de organisatie, anders het product.
// Koppelingen met andere systemen (stock, GridLab) staan als module bij de organisatie.
export function heeftKoppeling(naam) { return !!organisatie?.modules?.includes(naam); }
// Modules uit het pakket (zie lib/pakketten.ts). Zonder gekende organisatie (bv. deellink): niets afschermen;
// de databank weigert wat niet mag.
export function heeftModule(id) { return !organisatie || !Array.isArray(organisatie.modules) || organisatie.modules.includes(id); }
export const MODULE_NAAM = { stroom: 'Stroom', signalisatie: 'Signalisatie', stelling: 'Stellingbouwer 3D', branding: 'Branding', veiligheid: 'Veiligheid',
  binnen: 'Binnenplan', groot: 'Groot formaat', terrein: 'Terrein', leveranciers: 'Leveranciers', integraties: 'Integraties', huisstijl: 'Huisstijl' };
export const nietInPakket = (id) => `${MODULE_NAAM[id] || id} zit niet in het pakket van ${organisatie?.naam || 'je organisatie'}.`;
export function merkKort() { return organisatie?.kort || organisatie?.naam || PRODUCT; }
