// Merk en organisatie. Het product heet Toolen Maps; de organisatie (bv. Flanders Classics)
// wordt gezet door de layout van de organisatie (setOrganisatie) en komt in titelblokken en deellinks.
export const PRODUCT = 'Toolen Maps';
export const BEDRIJF = 'Toolen';

let organisatie = null; // { slug, naam, kort }
export function setOrganisatie(o) { organisatie = o || null; }
export function getOrganisatie() { return organisatie; }
// Korte naam voor het titelblok van een PDF: de organisatie, anders het product.
export function merkKort() { return organisatie?.kort || organisatie?.naam || PRODUCT; }
