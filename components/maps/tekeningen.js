// Vaste tekeningen voor bibliotheek-elementen die met de app meegeleverd worden
// (bv. generatoren, verdeelkasten, verwarming). Een element verwijst ernaar met
// eigenschappen.tekening_ref; zo blijft de database klein en kan de tekening
// met de code mee verbeteren. Wie het element zelf aanpast in de elementeditor,
// bewaart een eigen tekening en die heeft dan voorrang.
import elektriciteit from './tekeningen/elektriciteit.json';
import schermen from './tekeningen/schermen.json';
import movico from './tekeningen/movico.json';
import eurotech from './tekeningen/eurotech.json';
import machines from './tekeningen/machines.json';
import stellingbouw from './tekeningen/stellingbouw.json';
import tenten from './tekeningen/tenten.json';
import podium from './tekeningen/podium.json';
import truss from './tekeningen/truss.json';
import portix from './tekeningen/portix.json';
import portix2 from './tekeningen/portix2.json';
import portix3 from './tekeningen/portix3.json';
import stihl from './tekeningen/stihl.json';
import hekken from './tekeningen/hekken.json';
import toiletten from './tekeningen/toiletten.json';
import units from './tekeningen/units.json';
import meubilair from './tekeningen/meubilair.json';
import voertuigen from './tekeningen/voertuigen.json';
import stellingbouw2 from './tekeningen/stellingbouw2.json';
import telecom from './tekeningen/telecom.json';
import fietsenstalling from './tekeningen/fietsenstalling.json';
import branding from './tekeningen/branding.json';
import bevers from './tekeningen/bevers.json';
import rennersbruggen from './tekeningen/rennersbruggen.json';
import binnen from './tekeningen/binnen.json';
import tvcompound from './tekeningen/tvcompound.json';
import { rennersbrugTekening } from './rennersbrug';
import { kraanTekening } from './kraan';

const ALLE = { ...elektriciteit, ...schermen, ...movico, ...eurotech, ...machines, ...stellingbouw, ...tenten, ...podium, ...truss, ...portix, ...portix2, ...portix3, ...stihl, ...hekken, ...toiletten, ...units, ...meubilair, ...voertuigen, ...stellingbouw2, ...telecom, ...fietsenstalling, ...branding, ...bevers, ...rennersbruggen, ...binnen, ...tvcompound, 'sb-rennersbrug': rennersbrugTekening() };

export function metTekening(el) {
  // Camerakranen: tekening uit de specificaties.
  if (el?.eigenschappen?.kraan && !el.eigenschappen.tekening) return { ...el, eigenschappen: { ...el.eigenschappen, tekening: kraanTekening(el.eigenschappen.kraan) } };
  const ref = el?.eigenschappen?.tekening_ref;
  if (!ref || el.eigenschappen.tekening || !ALLE[ref]) return el;
  return { ...el, eigenschappen: { ...el.eigenschappen, tekening: ALLE[ref] } };
}
export const metTekeningen = (rijen) => (rijen || []).map(metTekening);
