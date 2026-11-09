'use client';

// Vaste aansluitingen: stroomkasten en aansluitpunten van steden, Fluvius of privé,
// over alle evenementen heen (tabel maps.vaste_aansluitingen). Elk plan toont
// wat in zijn kaartbeeld ligt; in de stroomplanning tellen ze als bron.
//
// Een vaste aansluiting krijgt in de stroomboom het id 'va:<uuid>', zodat
// velden.stroom.voeding en kabels (van) ernaar kunnen verwijzen.

import { maps, foutTekst } from './db';

export const VA = 'va:';
export const isVaId = (id) => typeof id === 'string' && id.startsWith(VA);
export const vaId = (va) => `${VA}${va.id}`;
export const vaUuid = (id) => (isVaId(id) ? id.slice(VA.length) : null);

export const SOORTEN = [
  ['putkast', 'Putkast', 'Ondergrondse evenementenkast, deksel in het wegdek'],
  ['straatkast', 'Straatkast', 'Bovengrondse kast of marktkast'],
  ['losse_aansluiting', 'Losse aansluiting', 'Aansluitpunt aan een gevel of paal'],
  ['gebouw', 'Vaste aansluiting gebouw', 'Aansluiting in of aan een gebouw'],
];
export const SOORT_NAAM = Object.fromEntries(SOORTEN.map(([k, t]) => [k, t]));
export const BEHEERDERS = [['stad', 'Stad of gemeente'], ['fluvius', 'Fluvius'], ['prive', 'Privé']];
export const UITGANG_TYPES = ['CEE 16A mono', 'Schuko', 'CEE 16A 3F', 'CEE 32A 3F', 'CEE 63A', 'CEE 125A', 'Powerlock'];
// Ampère per uitgangstype, om vrije uitgangen te matchen met aansluitingen van verbruikers.
export const UITGANG_A = { 'CEE 16A mono': 16, Schuko: 16, 'CEE 16A 3F': 16, 'CEE 32A 3F': 32, 'CEE 63A': 63, 'CEE 125A': 125, Powerlock: 400 };
export const KLEUR = '#0E7490';

// Vermogen van de kast: opgegeven kVA, anders uit de hoofdzekering (3 fasen, 400 V).
export const kvaVan = (va) => (Number(va.kva) > 0 ? Number(va.kva) : Number(va.max_ampere) > 0 ? Math.round((Math.sqrt(3) * 400 * Number(va.max_ampere)) / 1000) : null);

// Pseudo-item voor stroom.js: dezelfde vorm als een item met velden.stroom.
export function alsStroomItem(va) {
  return {
    id: vaId(va), naam: va.naam, geometrie: va.geometrie, vast: va,
    velden: { stroom: { rol: 'bron', kva: kvaVan(va), cosphi: 1, ampere: va.max_ampere ?? null, vast: true, ...(Array.isArray(va.uitgangen) && va.uitgangen.some((u) => u.type) ? { uitgangen: va.uitgangen } : {}) } },
  };
}

export const uitgangenTekst = (va) => (va.uitgangen || []).filter((u) => u.type).map((u) => `${u.aantal || 1} × ${u.type}`).join(', ');

export function naarGeojsonVa(lijst, { gekozen = null } = {}) {
  return {
    type: 'FeatureCollection',
    features: lijst.filter((v) => v.actief !== false && v.geometrie?.type === 'Point').map((v) => ({
      type: 'Feature', geometry: v.geometrie,
      properties: { id: v.id, soort: v.soort, naam: v.naam, label: `${v.naam}${v.max_ampere ? ` · ${v.max_ampere} A` : ''}`, gekozen: v.id === gekozen },
    })),
  };
}

// Kaarticonen per soort: vierkant (straatkast), rond met deksel (putkast), driehoek (losse), huisje (gebouw).
export function zorgVoorVaIconen(map) {
  if (map.hasImage('fm-va-straatkast')) return;
  const maak = (soort) => {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const x = c.getContext('2d');
    x.lineWidth = 3; x.strokeStyle = '#fff'; x.fillStyle = KLEUR;
    x.beginPath();
    if (soort === 'putkast') { x.arc(24, 24, 17, 0, Math.PI * 2); }
    else if (soort === 'losse_aansluiting') { x.moveTo(24, 5); x.lineTo(43, 41); x.lineTo(5, 41); x.closePath(); }
    else if (soort === 'gebouw') { x.moveTo(24, 5); x.lineTo(43, 20); x.lineTo(43, 42); x.lineTo(5, 42); x.lineTo(5, 20); x.closePath(); }
    else { x.rect(7, 7, 34, 34); }
    x.fill(); x.stroke();
    // Bliksem
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(26, 13); x.lineTo(17, 27); x.lineTo(23, 27); x.lineTo(21, 37); x.lineTo(31, 22); x.lineTo(25, 22); x.closePath(); x.fill();
    if (soort === 'putkast') { x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(24, 24, 12, 0, Math.PI * 2); x.stroke(); }
    map.addImage(`fm-va-${soort}`, x.getImageData(0, 0, 48, 48), { pixelRatio: 2 });
  };
  for (const [k] of SOORTEN) maak(k);
}

export function vaKaartLagen() {
  return [
    { id: 'fm-va-kring', type: 'circle', source: 'fm-va', filter: ['get', 'gekozen'], paint: { 'circle-radius': 19, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#1d1d1b', 'circle-stroke-width': 2 } },
    { id: 'fm-va', type: 'symbol', source: 'fm-va', layout: { 'icon-image': ['concat', 'fm-va-', ['get', 'soort']], 'icon-size': 1, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'text-field': ['get', 'label'], 'text-size': 10.5, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': KLEUR, 'text-halo-color': '#fff', 'text-halo-width': 1.5, 'icon-opacity': 1, 'text-opacity': 1 } },
  ];
}

// Dempen buiten de werkruimte Stroom: wel zichtbaar, maar bescheiden.
export function zetVaDekking(map, vol) {
  if (!map.getLayer('fm-va')) return;
  map.setPaintProperty('fm-va', 'icon-opacity', vol ? 1 : 0.55);
  map.setPaintProperty('fm-va', 'text-opacity', vol ? 1 : 0.55);
  map.setLayoutProperty('fm-va', 'text-field', vol ? ['get', 'label'] : ['get', 'naam']);
}

// ---------- Data ----------
export async function laadVasteAansluitingen() {
  const { data, error } = await maps().from('vaste_aansluitingen').select('*').eq('actief', true).order('gemeente').order('naam');
  if (error) throw error;
  return data || [];
}

export async function bewaarVasteAansluiting(va, profielId) {
  const { id, created_at, updated_at, ...rest } = va;
  const rij = { ...rest, bewerkt_door: profielId || null };
  const q = id ? maps().from('vaste_aansluitingen').update(rij).eq('id', id) : maps().from('vaste_aansluitingen').insert({ ...rij, aangemaakt_door: profielId || null });
  const { data, error } = await q.select().single();
  if (error) throw new Error(foutTekst(error));
  return data;
}

// Gemeente uit de coördinaten (Nominatim), zoals bij de brandweerzone.
export async function gemeenteBij(punt) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=nl&lon=${punt[0]}&lat=${punt[1]}`);
    const j = await r.json();
    const a = j.address || {};
    const gemeente = a.municipality || a.city || a.town || a.village || null;
    const adres = [a.road, a.house_number].filter(Boolean).join(' ') || null;
    return { gemeente, adres };
  } catch { return { gemeente: null, adres: null }; }
}

// Plaatsfiche-item (stroomkast) omzetten naar een vaste aansluiting. Het item blijft bestaan.
export function uitPlekItem(it, el, middelpunt) {
  const s = it.velden?.stroom || {};
  const eig = el?.eigenschappen || {};
  return {
    naam: it.naam || el?.naam || 'Stroomkast', soort: 'straatkast', beheerder: 'stad', geometrie: { type: 'Point', coordinates: middelpunt },
    uitgangen: [], max_ampere: s.ampere ?? eig.ampere ?? null, kva: s.kva ?? eig.kva ?? null, opmerking: it.notitie || null, bron_item_id: it.id,
  };
}
