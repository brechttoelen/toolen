// Moduleregister van Toolen Maps: wat hoort bij welke module uit het pakket.
// Elk scherm vraagt hier of iets mag (magModule, elementModule, veldenModule, tabModule).
// De databank (db/0004_modules.sql, db/0005_pakketten.sql) bewaakt dezelfde velden met dezelfde sleutels.
//
// Afspraken over de grens tussen basis en module:
//  - Controle: gewone meldingen (overlap, buiten de lijnen, ontbrekende gegevens) zijn basis. Brandveiligheid,
//    hulpdienstenroutes met botsingen en keuringsattesten horen bij Veiligheid.
//  - Stroom: een generator of kast als element op het plan zetten is basis. Rekenen hoort bij Stroom: kabels,
//    belasting, eendraadschema, vaste aansluitingen, stroomdeellink.
//  - Branding: een hek met een gewone doekkleur is basis. Ontwerpen opladen, doeken met beeld, totems en vlaggen
//    horen bij Branding.
import { heeftModule, nietInPakket, MODULE_NAAM } from './merk';
import { isTotem, isVlag } from './stijl';

export const MODULE_REGISTER = {
  signalisatie: {
    naam: 'Signalisatie',
    werkruimte: 'sign',
    panelen: ['sign', 'verkeer'],
    velden: ['sign', 'verkeer'],
    elementen: 'Borden uit de bordenset',
    export: ['Signalisatieplan (pdf)', 'Verkeersplan (pdf)'],
    test: [
      'Werkruimte Signalisatie staat grijs met "niet in pakket"',
      'Paneel Signalisatie en Verkeer ontbreken in de zijbalk',
      'Een bestaand bord blijft zichtbaar; wijzigen geeft een melding van de databank',
    ],
  },
  stroom: {
    naam: 'Stroom',
    werkruimte: 'stroom',
    panelen: ['stroom'],
    tabs: ['stroom'],
    velden: ['stroom'],
    deelprofiel: 'stroom',
    export: ['Eendraadschema', 'Stroomdossier', 'Stroomdeellink'],
    test: [
      'Generator of kast plaatsen lukt (basis)',
      'Werkruimte Stroom staat grijs; geen kabelgereedschap',
      'Eigenschappen van een generator: geen tab Stroom of Licht',
      'Binnenplan: geen stroomtoewijzing; geen vaste aansluitingen',
      'Deellink: profiel Stroom ontbreekt',
    ],
  },
  stelling: {
    naam: 'Stellingbouwer 3D',
    velden: ['stelling'],
    elementen: 'Stellingen uit een sjabloon (camerastellingen)',
    test: [
      'Stelling openen toont "niet in pakket" in plaats van de bouwer',
      'Stellingsjablonen in de bibliotheek staan grijs',
    ],
  },
  branding: {
    naam: 'Branding',
    werkruimte: 'branding',
    panelen: ['branding'],
    tabs: ['branding'],
    velden: ['doeken', 'vlaggen', 'ontwerp', 'paneel_1', 'paneel_2', 'paneel_3', 'paneel_4'],
    elementen: 'Totems, beachvlaggen en ontwerpen (doeken met beeld)',
    export: ['Brandingplan (pdf)', 'Doekenlijst'],
    test: [
      'Hek met een gewone doekkleur kan nog (basis)',
      'Werkruimte Branding grijs; geen tab Branding in de eigenschappen',
      'Totems, vlaggen en ontwerpen in de bibliotheek grijs',
      'Geen ontwerpen opladen in het bibliotheekbeheer',
    ],
  },
  veiligheid: {
    naam: 'Veiligheid',
    werkruimte: 'veiligheid',
    panelen: ['veiligheid'],
    tabs: ['attesten'],
    export: ['Veiligheidsplan (pdf)'],
    test: [
      'Controlepaneel: gewone meldingen blijven, brandveiligheid, hulpdienstenroutes en attesten verdwijnen',
      'Eigenschappen: geen keuringsattesten',
    ],
  },
  binnen: {
    naam: 'Binnenplan',
    tabs: ['binnen'],
    velden: ['binnen', 'binnenplan'],
    test: [
      'Tab Binnen ontbreekt; binnenplan openen geeft "niet in pakket"',
      'Menu: geen pdf per verdieping',
      'Adres met ?binnen= opent gewoon het plan',
    ],
  },
  groot: {
    naam: 'Groot formaat',
    export: ['Vrij papierformaat', 'Rasterplan', 'Bladindeling over meerdere bladen'],
    test: ['Pdf: geen vrij formaat, raster of bladindeling; A4 en A3 blijven'],
  },
  terrein: {
    naam: 'Terrein',
    export: ['Opbouwmodus op gsm'],
    test: ['Geen link Opbouwmodus; /opbouw toont "niet in pakket"'],
  },
  leveranciers: {
    naam: 'Leveranciers',
    deelprofiel: 'leverancier',
    export: ['Leverlijst per leverancier', 'Deellink per leverancier'],
    test: ['Geen leverlijst per leverancier; deellinkprofiel Leverancier ontbreekt'],
  },
  integraties: {
    naam: 'Integraties',
    export: ['Koppeling stock', 'Koppeling GridLab'],
    test: ['Koppelingen enkel zichtbaar met stock of gridlab in de modules'],
  },
};

export const magModule = (id) => !id || heeftModule(id);
export { nietInPakket, MODULE_NAAM };

// Welke module een element uit de bibliotheek nodig heeft (null = basis).
export function elementModule(el) {
  if (!el) return null;
  if (el.tekenwijze === 'sjabloon' && el.eigenschappen?.stelling && el.eigenschappen?.stelling3d) return 'stelling';
  if (el.tekenwijze === 'doek') return 'branding';
  if (isTotem(el) || isVlag(el)) return 'branding';
  return null;
}
export const elementMag = (el) => magModule(elementModule(el));

// Welke module een tab in de eigenschappen nodig heeft.
const TAB_MODULE = { stroom: 'stroom', branding: 'branding', binnen: 'binnen', attesten: 'veiligheid' };
export const tabMag = (k) => magModule(TAB_MODULE[k]);

// Modules die een set velden van een item raakt (zelfde regels als de databank).
const VELD_MODULE = Object.fromEntries(Object.entries(MODULE_REGISTER).flatMap(([m, r]) => (r.velden || []).map((v) => [v, m])));
export function veldenModules(velden) {
  if (!velden || typeof velden !== 'object') return [];
  return [...new Set(Object.keys(velden).filter((k) => velden[k] != null).map((k) => VELD_MODULE[k]).filter(Boolean))];
}
// Eerste module die ontbreekt voor deze velden (om een melding te tonen), anders null.
export const ontbrekendVoorVelden = (velden) => veldenModules(velden).find((m) => !heeftModule(m)) || null;
