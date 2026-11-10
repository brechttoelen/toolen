'use client';

// Werkruimtes: één plan, vier blikken. Plan toont alles; Signalisatie, Stroom en
// Veiligheid zijn een lens op dezelfde data: eigen gereedschap, eigen paneel links,
// eigen detail rechts, kerncijfers onderaan en de rest van de kaart gedimd.
// Geen aparte data: alles blijft gewone items.

import { isSign, instSign } from './signalisatie';
import { stroomVan, isKastNaam } from './stroom';
import { veiligheidVan, isPubliekeStructuur } from './veiligheid';
import { isVerkeer } from './verkeer';
import { dragerVan, brandingCijfers } from './branding';
import { isKabelcam } from './kabelcam';

export const WR_SLEUTEL = 'fm-werkruimte';
// Module uit het pakket die een werkruimte nodig heeft (Plan heeft er geen nodig).
export const WR_MODULE = { sign: 'signalisatie', stroom: 'stroom', veiligheid: 'veiligheid', branding: 'branding' };

// Gereedschap van een werkruimte. Soorten:
//   { id }                       bestaand gereedschap uit gereedschap.js (selecteer, route, meten, vast …)
//   { id, element: (el) => bool } bibliotheek-element plaatsen; meerdere treffers = keuzelijstje
//   { id, lijn: {…} }            lijn tekenen met vooringevulde velden (kabel)
//   { id, punt: {…} }            punt zetten met vooringevulde naam (PPO)
//   { id, actie: 'signZet' }     bordpunt zetten (bestaande zetmodus van Signalisatie)
//   { id, actie: 'verkeerZet' }  verkeersbord zetten (het bord kies je in het paneel)
//   { id: 'kabel' }              kabel: klik bron/kast, dan verbruiker (eigen klikmodus in de editor)
// Dezelfde filters dienen in het binnenplan (menu Stroom), vandaar export.
export const elStroomBron = (el) => el.categorie !== 'Veiligheid' && Number(el.eigenschappen?.kva) > 0;
// Stekkerdoos of verdeeldoos: kleine kast (ingang Schuko of CEE, n × Schuko) uit de bibliotheek.
export const elStekkerdoos = (el) => !!el.eigenschappen?.stekkerdoos;
export const elKast = (el) => !elStekkerdoos(el) && Number(el.eigenschappen?.ampere) > 0 && (el.eigenschappen?.rol === 'kast' || isKastNaam(el.naam));
// Verwarming (heaters, boilers) als stroomverbruiker: alles uit de categorie Verwarming met een aansluiting of vermogen.
const heeftVerbruik = (el) => (Array.isArray(el.eigenschappen?.aansluitingen) ? el.eigenschappen.aansluitingen.length > 0 : Number(el.eigenschappen?.kw) > 0);
export const elVerwarming = (el) => (el.categorie === 'Verwarming' || /heater|verwarm|boiler/i.test(el.naam || '')) && heeftVerbruik(el);
// Andere verbruikers (podium, koelwagen, laadpaal, scherm …): alles met een vermogen of aansluitingen dat geen bron, kast of verwarming is.
export const elVerbruiker = (el) => heeftVerbruik(el) && !elStroomBron(el) && !elKast(el) && !elStekkerdoos(el) && !elVerwarming(el);
const elVeilig = (soort) => (el) => veiligheidVan(el) === soort;
// TV: camerastelling-sjablonen (stelling met camera), losse camera's, kranen en crane-dekken, compound.
export const elCameraStelling = (el) => !!el.eigenschappen?.stelling && !!el.eigenschappen?.stelling3d?.camera;
export const elTvCamera = (el) => !elCameraStelling(el) && !el.eigenschappen?.kraan && (el.eigenschappen?.subgroep === "Camera's" || !!el.eigenschappen?.tvcamera);
export const elKraan = (el) => !!el.eigenschappen?.kraan || /crane|kraan|jib/i.test(`${el.naam} ${el.eigenschappen?.familie || ''}`) && el.categorie !== 'Veiligheid' && el.tekenwijze !== 'sjabloon';
export const elCompound = (el) => el.categorie === 'TV-compound' && !elTvCamera(el) && !isKabelcam(el) && !el.eigenschappen?.kraan;

export const WERKRUIMTES = [
  { id: 'plan', icoon: 'kaart', naam: 'Plan', kleur: '#022056', toets: '1', tab: null, tools: null, exports: [] },
  {
    id: 'sign', icoon: 'bord', naam: 'Signalisatie', beta: true, kleur: '#2563EB', toets: '2', tab: 'sign',
    // Twee modi: wegwijzers (parkings, bestemmingen) en verkeer (C3, E1, afsluitingen, omleidingen met F41).
    modi: [['wegwijzers', 'Wegwijzers'], ['verkeer', 'Verkeer']],
    toolsVerkeer: [
      { id: 'selecteer' },
      { id: 'verkeerbord', naam: 'Bord', icoon: 'bord', actie: 'verkeerZet', uitleg: 'Kies een bord in het paneel en klik op de kaart waar het staat' },
      { id: 'parkeerverbod', naam: 'Parkeerverbod', icoon: 'lijn', lijn: { naam: 'Parkeerverbod', stijl: { kleur: '#0057B8', streep: 'streep', dikte: 3 }, velden: { verkeer: { soort: 'parkeerverbod', onderbord: 'periode' } }, laag: /^verkeer$/i }, uitleg: 'Teken de lijn langs de straat waar niet geparkeerd mag worden · om de N m een E1' },
      { id: 'afsluiting', naam: 'Afsluiting', icoon: 'lijn', lijn: { naam: 'Afsluiting', stijl: { kleur: '#C8102E', dikte: 5 }, velden: { verkeer: { soort: 'afsluiting', onderbord: 'hulpdiensten' } }, laag: /^verkeer$/i }, uitleg: 'Teken de lijn dwars over de weg · nadars van 2,5 m en een C3' },
      { id: 'omleiding', naam: 'Omleiding', icoon: 'navigeer', lijn: { naam: 'Omleiding', stijl: { kleur: '#B45309', dikte: 4 }, velden: { verkeer: { soort: 'omleiding' } }, laag: /^verkeer$/i }, uitleg: 'Teken de omleidingsroute · daarna F41-borden voorstellen in het paneel' },
      { id: 'meten', naam: 'Meten' },
    ],
    exportsVerkeer: [{ id: 'verkeersplan', naam: 'Signalisatieplan PDF', primair: true }, { id: 'verkeerlijst', naam: 'Stuklijst CSV' }],
    tools: [
      { id: 'selecteer' },
      { id: 'bordpunt', naam: 'Bordpunt', icoon: 'bord', actie: 'signZet', uitleg: 'Klik op de kaart om een bordpunt te zetten' },
      { id: 'route', naam: 'Route', icoon: 'navigeer', profiel: 'car' },
      { id: 'ppo', naam: 'PPO', icoon: 'punt', punt: { naam: 'PPO', stijl: { kleur: '#2563EB', icoon: 'vlag' } }, uitleg: 'Klik waar de route begint (PPO-punt)' },
      { id: 'meten', naam: 'Meten' },
    ],
    exports: [{ id: 'drukbestand', naam: 'Drukbestand borden', primair: true }, { id: 'bestellijst', naam: 'Bestellijst CSV' }],
  },
  {
    id: 'stroom', icoon: 'bliksem', naam: 'Stroom', kleur: '#7C3AED', toets: '3', tab: 'stroom',
    tools: [
      { id: 'selecteer' },
      { id: 'bron', naam: 'Bron', icoon: 'bliksem', element: elStroomBron },
      { id: 'kast', naam: 'Kast', icoon: 'rechthoek', element: elKast },
      { id: 'stekkerdoos', naam: 'Stekkerdoos', icoon: 'stekker', element: elStekkerdoos, uitleg: 'Kies een stekkerdoos of verdeeldoos en klik waar ze ligt · daarna met Kabel aansluiten op een kast of bron, en verbruikers erop' },
      { id: 'verwarming', naam: 'Verwarming', icoon: 'vlam', element: elVerwarming, uitleg: 'Kies een heater of boiler en klik waar hij staat · daarna met Kabel aansluiten op een kast of bron' },
      { id: 'kabel', naam: 'Kabel', icoon: 'lijn', uitleg: 'Klik de bron of kast, dan de verbruiker · de kabel komt als rechte lijn, versleep de tussenpunten' },
      { id: 'kabelgoot', naam: 'Kabelgoot', icoon: 'lijn', element: (el) => /kabelgoot|kabelbrug/i.test(el.naam || '') },
      { id: 'vast', naam: 'Vaste aansl.', icoon: 'bliksem' },
      { id: 'meten', naam: 'Meten' },
    ],
    exports: [{ id: 'stroomplan', naam: 'Stroomdossier PDF', primair: true }, { id: 'kabellijst', naam: 'Kabellijst' }],
  },
  {
    id: 'veiligheid', icoon: 'schild', naam: 'Veiligheid', beta: true, kleur: '#DC2626', toets: '4', tab: 'veiligheid',
    tools: [
      { id: 'selecteer' },
      { id: 'uitgang', naam: 'Uitgang', icoon: 'lijn', element: elVeilig('uitgang'), uitleg: 'Trek een lijn over de opening in de tentwand' },
      { id: 'vluchtweg', naam: 'Vluchtweg', icoon: 'navigeer', element: elVeilig('vluchtweg') },
      { id: 'brandweer', naam: 'Brandweer', icoon: 'lijn', element: (el) => ['brandweertoegang', 'opstelplaats'].includes(veiligheidVan(el)) },
      { id: 'blusser', naam: 'Blusser', icoon: 'punt', element: elVeilig('blusser') },
      { id: 'verzamel', naam: 'Verzamel', icoon: 'punt', element: elVeilig('verzamelplaats') },
      { id: 'ehbo', naam: 'EHBO', icoon: 'punt', element: (el) => ['ehbo', 'aed'].includes(veiligheidVan(el)) },
      { id: 'meten', naam: 'Meten' },
    ],
    exports: [{ id: 'veiligheidsplan', naam: 'Veiligheidsplan PDF', primair: true }, { id: 'checklist', naam: 'Checklist brandweer' }],
  },
  {
    id: 'branding', icoon: 'vlag', naam: 'Branding', beta: true, kleur: '#EA580C', toets: '5', tab: 'branding',
    tools: [
      { id: 'selecteer' },
      { id: 'heras', naam: 'Heras + doek', icoon: 'lijn', element: (el) => dragerVan(el) === 'hek', uitleg: 'Teken de hekkenlijn · daarna met het penseel de doeken per hek' },
      { id: 'totem', naam: 'Totem', icoon: 'rechthoek', element: (el) => dragerVan(el) === 'totem', uitleg: 'Klik waar de totem staat · zijde 1 is de voorkant' },
      { id: 'beachvlag', naam: 'Beachvlag', icoon: 'vlag', element: (el) => dragerVan(el) === 'vlag', uitleg: 'Klik waar de vlag staat · draai om de richting van het doek te kiezen' },
      { id: 'truss', naam: 'Truss', icoon: 'rechthoek', element: (el) => dragerVan(el) === 'truss', uitleg: 'Kubus: klik waar hij staat (zijde 1 = voorkant) · Boog: teken de overspanning van toren tot toren' },
      { id: 'frame', naam: 'Frame', icoon: 'rechthoek', element: (el) => dragerVan(el) === 'frame', uitleg: 'Klik waar het frame staat · voorkant = onderkant bij draaiing 0' },
      { id: 'drape', naam: 'Pipe & drape', icoon: 'lijn', element: (el) => dragerVan(el) === 'drape', uitleg: 'Teken de lijn · per sectie van 3 m een gordijn of een bedrukt doek' },
      { id: 'penseel', naam: 'Penseel', icoon: 'penseel', actie: 'brandPenseel', uitleg: 'Kies links een ontwerp en klik of sleep over hekken, totemzijden of vlaggen · Esc stopt' },
      { id: 'meten', naam: 'Meten' },
    ],
    exports: [{ id: 'brandingplan', naam: 'Brandingplan PDF', primair: true }, { id: 'brandinglijst', naam: 'Bestellijst CSV' }],
  },
  {
    // TV: camerastellingen, camera's, kranen, kabelwegen en de compound (wagens, studio's, zones).
    id: 'tv', icoon: 'camera', naam: 'TV', beta: true, kleur: '#0F766E', toets: '6', tab: 'bibliotheek', bibCat: 'TV-compound',
    tools: [
      { id: 'selecteer' },
      { id: 'camerastelling', naam: 'Camerastelling', icoon: 'rechthoek', element: elCameraStelling, perFamilie: true, uitleg: 'Kies een camerastelling en klik waar ze staat · de variant (leuning, trapblok, wielen) kies je daarna rechts · open de stellingbouwer om aan te passen' },
      { id: 'camera', naam: 'Camera', icoon: 'punt', element: elTvCamera, uitleg: 'Klik waar de camera staat · lens en kijkrichting stel je rechts in' },
      { id: 'kabelcam', naam: 'Kabelcam', icoon: 'lijn', element: isKabelcam, uitleg: 'Klik verreiker A en dan verreiker B (dubbelklik = klaar) · de camera hangt aan de kabel; positie en kijkrichting stel je rechts in' },
      { id: 'kraan', naam: 'Kraan', icoon: 'rechthoek', element: elKraan, uitleg: 'Kies een kraan en klik waar de dolly staat · draai het item om de arm te richten · op een stelling: zet eerst een crane-dek' },
      { id: 'kabelweg', naam: 'Kabelweg', icoon: 'lijn', lijn: { naam: 'TV-kabelweg', stijl: { kleur: '#0F766E', streep: 'streep', dikte: 3 }, velden: { tvkabel: { soort: 'glasvezel' } }, laag: /^tv|camera|broadcast/i }, uitleg: 'Teken de kabelweg van camera naar compound · de lengte telt mee in de cijfers onderaan' },
      { id: 'kabelgoot', naam: 'Kabelgoot', icoon: 'lijn', element: (el) => /kabelgoot|kabelbrug/i.test(el.naam || '') },
      { id: 'compound', naam: 'Compound', icoon: 'rechthoek', element: elCompound, groep: true, uitleg: 'Kies een wagen, studio of zone en klik waar hij staat' },
      { id: 'meten', naam: 'Meten' },
    ],
    exports: [],
  },
];
export const werkruimteOp = (id) => WERKRUIMTES.find((w) => w.id === id) || WERKRUIMTES[0];

export function onthoudWerkruimte(id) { try { localStorage.setItem(WR_SLEUTEL, id); } catch {} }
export function laatsteWerkruimte() { try { const v = localStorage.getItem(WR_SLEUTEL); return WERKRUIMTES.some((w) => w.id === v) ? v : 'plan'; } catch { return 'plan'; } }

// Welke items horen bij een werkruimte (de rest wordt gedimd, blijft wel selecteerbaar).
export function relevanteItems(wrId, { plan, items, lagenMap, elementenMap, modus = null }) {
  if (wrId === 'plan') return null;
  const laagNaam = (it) => (lagenMap.get(it.laag_id)?.naam || '').toLowerCase();
  const el = (it) => (it.element_id ? elementenMap.get(it.element_id) : null);
  const set = new Set();
  if (wrId === 'sign' && modus === 'verkeer') {
    for (const it of items) if (isVerkeer(it) || /^verkeer$/.test(laagNaam(it))) set.add(it.id);
  } else if (wrId === 'sign') {
    const inst = instSign(plan);
    const routeIds = new Set(inst.routes.flatMap((r) => [r.lijn_id, r.ppo_id].filter(Boolean)));
    for (const it of items) if (!isVerkeer(it) && (isSign(it) || routeIds.has(it.id) || /signali|bord|parking/.test(laagNaam(it)) || /^ppo\b/i.test(it.naam || ''))) set.add(it.id);
  } else if (wrId === 'stroom') {
    for (const it of items) if (stroomVan(it, el(it)).rol || /stroom|elektr/.test(laagNaam(it)) || /kabelgoot|kabelbrug/i.test(el(it)?.naam || '')) set.add(it.id);
  } else if (wrId === 'branding') {
    for (const it of items) if (dragerVan(el(it)) || /branding|doek|sponsor/.test(laagNaam(it))) set.add(it.id);
  } else if (wrId === 'tv') {
    for (const it of items) {
      const e = el(it);
      if (isTvItem(it, e) || /^tv|camera|broadcast|compound/.test(laagNaam(it))) set.add(it.id);
    }
  } else if (wrId === 'veiligheid') {
    for (const it of items) {
      const e = el(it);
      if (veiligheidVan(e) || isPubliekeStructuur(it, e) || Number(e?.eigenschappen?.kva) > 0 || /veiligheid|ehbo|hulpdienst|nood|evacuatie|brandweer/.test(laagNaam(it))) set.add(it.id);
    }
  }
  return set;
}

// Kerncijfers voor de balk onderaan.
export const isTvItem = (it, e) => !!(it.velden?.tvcamera || it.velden?.stelling?.camera || it.velden?.tvkabel || (e && (isKabelcam(e) || elCameraStelling(e) || elTvCamera(e) || elKraan(e) || e.categorie === 'TV-compound')));
// Cijfers voor TV: camera's (los en op stellingen), stellingen, kranen en meters kabelweg.
export function tvTelling(items, elementenMap, lengte) {
  let cam = 0; let stel = 0; let kraan = 0; let kabel = 0; let wagens = 0;
  for (const it of items) {
    const e = it.element_id ? elementenMap.get(it.element_id) : null;
    if (it.velden?.stelling?.camera) { stel += 1; cam += 1; } else if (it.velden?.tvcamera || (e && (elTvCamera(e) || isKabelcam(e)))) cam += 1;
    if (e && elKraan(e)) kraan += 1;
    if (e && elCompound(e)) wagens += 1;
    if (it.velden?.tvkabel && it.geometrie?.type === 'LineString') kabel += lengte(it.geometrie);
  }
  return { cam, stel, kraan, kabel: Math.round(kabel), wagens };
}

export function kerncijfers(wrId, { items, stroom, sign, veilig, verkeer, branding, tv }) {
  if (wrId === 'tv' && tv) return [`${tv.cam} camera's`, `${tv.stel} camerastelling${tv.stel === 1 ? '' : 'en'}`, tv.kraan ? `${tv.kraan} kra${tv.kraan === 1 ? 'an' : 'nen'}` : null, `${tv.kabel} m kabelweg`, tv.wagens ? `${tv.wagens} in de compound` : null].filter(Boolean).join(' · ');
  if (wrId === 'branding') return brandingCijfers(branding);
  if (wrId === 'sign' && verkeer) return [`${verkeer.punten} borden`, `${verkeer.e1} E1`, `${verkeer.nadars} nadars`, verkeer.controleren ? `${verkeer.controleren} te controleren` : null].filter(Boolean).join(' · ');
  if (wrId === 'sign' && sign) return [`${sign.punten} punten`, `${sign.panelen} panelen`, sign.controleren ? `${sign.controleren} te controleren` : null].filter(Boolean).join(' · ');
  if (wrId === 'stroom' && stroom) {
    const verbr = [...stroom.knopen.values()].filter((k) => k.s.rol === 'verbruiker');
    const kw = verbr.reduce((t, k) => t + (Number(k.s.kw) || 0), 0);
    const m = stroom.kabelLijst.reduce((t, c) => t + c.meter, 0);
    return [`${kw.toFixed(0)} kW gevraagd`, `gelijktijdigheid ${String(stroom.gelijktijdigheid).replace('.', ',')}`, `${m} m kabel`, stroom.kabelbruggen ? `${stroom.kabelbruggen} kabelbruggen` : null].filter(Boolean).join(' · ');
  }
  if (wrId === 'veiligheid' && veilig) {
    const p = veilig.tenten.reduce((t, c) => t + c.personen, 0);
    const u = veilig.tenten.reduce((t, c) => t + c.uitgangen.length, 0);
    const f = veilig.tenten.reduce((t, c) => t + c.fouten, 0); const w = veilig.tenten.reduce((t, c) => t + c.waarschuwingen, 0);
    return [`${veilig.tenten.length} publieke tenten`, `${p} personen`, `${u} uitgangen`, f ? `${f} fout${f === 1 ? '' : 'en'}` : null, w ? `${w} waarschuwing${w === 1 ? '' : 'en'}` : null].filter(Boolean).join(' · ');
  }
  return `${items.length} items`;
}
