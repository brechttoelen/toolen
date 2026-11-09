'use client';

// Verkeerssignalisatie (Wegcode): borden als punten, parkeerverbod en afsluiting
// als lijn, omleiding als lijn met F41-borden op de echte afslagen.
//
// item.velden.verkeer = {
//   soort: 'bord' | 'parkeerverbod' | 'afsluiting' | 'omleiding',
//   bord, waarde (C43), pijl (D1, F41), tekst (F41, A51),      — enkel bij 'bord'
//   onderbord: '' | 'hulpdiensten' | 'plaatselijk' | 'fietsers' | 'periode' | 'tekst', onderbord_tekst,
//   van, tot (ISO 'YYYY-MM-DDTHH:MM'), kijkrichting (graden, 0 = noord), nr, straat,
//   interval (parkeerverbod, m), auto: { omleiding_id, anker, plek, pijl, controleren? } (F41-voorstel)
// }
// plan.instellingen.verkeer = { interval, van, tot }

import * as turf from '@turf/turf';
import { norm, pijlUitHoek } from './signalisatie';

const M = { units: 'meters' };
export const VERKEER_LAAG = { naam: 'Verkeer', kleur: '#B45309' };
export const NADAR_M = 2.5;
export const KLEUR = { rood: '#C8102E', blauw: '#0057B8', geel: '#F7D117', zwart: '#111111', grijs: '#5B6168' };

export const BORDEN = [
  { code: 'C3', naam: 'Verboden toegang, in beide richtingen', groep: 'Verbod' },
  { code: 'C1', naam: 'Verboden richting', groep: 'Verbod' },
  { code: 'C31a', naam: 'Verboden links af te slaan', groep: 'Verbod' },
  { code: 'C31b', naam: 'Verboden rechts af te slaan', groep: 'Verbod' },
  { code: 'C43', naam: 'Snelheidsbeperking', groep: 'Verbod', waarde: true },
  { code: 'D1', naam: 'Verplichte richting', groep: 'Gebod', pijl: true },
  { code: 'E1', naam: 'Parkeerverbod', groep: 'Parkeren' },
  { code: 'E3', naam: 'Stilstaan en parkeren verboden', groep: 'Parkeren' },
  { code: 'F41', naam: 'Omleiding', groep: 'Aanwijzing', pijl: true, tekst: true },
  { code: 'F45', naam: 'Doodlopende weg', groep: 'Aanwijzing' },
  { code: 'A31', naam: 'Werken', groep: 'Gevaar' },
  { code: 'A51', naam: 'Gevaar', groep: 'Gevaar', tekst: true },
  { code: 'NADAR', naam: 'Nadar', groep: 'Afsluiting' },
];
export const BORD_MAP = new Map(BORDEN.map((b) => [b.code, b]));
export const SNELHEDEN = [20, 30, 50, 70, 90];
export const BORD_PIJLEN = [['rechtdoor', 'Rechtdoor'], ['rechts', 'Rechts'], ['links', 'Links'], ['schuin-rechts', 'Schuin rechts'], ['schuin-links', 'Schuin links']];
export const ONDERBORDEN = [
  ['', 'Geen'], ['hulpdiensten', 'Uitgezonderd hulpdiensten'], ['plaatselijk', 'Uitgezonderd plaatselijk verkeer'],
  ['fietsers', 'Uitgezonderd fietsers'], ['periode', 'Datum en uur'], ['tekst', 'Eigen tekst'],
];
const ONDERBORD_TEKST = { hulpdiensten: 'UITGEZONDERD\nHULPDIENSTEN', plaatselijk: 'UITGEZONDERD\nPLAATSELIJK VERKEER', fietsers: 'UITGEZONDERD\nFIETSERS' };

export const isVerkeer = (it) => !!it?.velden?.verkeer?.soort;
export const isVerkeerBord = (it) => it?.velden?.verkeer?.soort === 'bord' && it.geometrie?.type === 'Point';
export const isVerkeerLijn = (it) => ['parkeerverbod', 'afsluiting', 'omleiding'].includes(it?.velden?.verkeer?.soort) && it.geometrie?.type === 'LineString';
export const SOORTEN = { bord: 'Borden', parkeerverbod: 'Parkeerverbod', afsluiting: 'Afsluitingen', omleiding: 'Omleidingen' };

export function instVerkeer(plan) {
  const v = plan?.instellingen?.verkeer || {};
  return { interval: Number(v.interval) > 0 ? Number(v.interval) : 15, van: v.van || '', tot: v.tot || '' };
}

// ---------- Datum en uur ----------
const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const uurTekst = (d) => (d.getMinutes() ? `${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}` : `${d.getHours()}`);
const dagTekst = (d) => `${DAGEN[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
// "zo 5/4 van 8 tot 18 u" of "van zo 5/4 8 u tot ma 6/4 18 u".
export function periodeTekst(van, tot) {
  const a = van ? new Date(van) : null; const b = tot ? new Date(tot) : null;
  if (a && Number.isNaN(a.getTime())) return '';
  if (b && Number.isNaN(b.getTime())) return '';
  if (a && b) {
    if (a.toDateString() === b.toDateString()) return `${dagTekst(a)} van ${uurTekst(a)} tot ${uurTekst(b)} u`;
    return `van ${dagTekst(a)} ${uurTekst(a)} u tot ${dagTekst(b)} ${uurTekst(b)} u`;
  }
  if (a) return `vanaf ${dagTekst(a)} ${uurTekst(a)} u`;
  if (b) return `tot ${dagTekst(b)} ${uurTekst(b)} u`;
  return '';
}

// Tekst van het onderbord (regels), of '' als er geen is.
export function onderbordTekst(v) {
  if (!v?.onderbord) return '';
  if (v.onderbord === 'periode') return periodeTekst(v.van, v.tot);
  if (v.onderbord === 'tekst') return (v.onderbord_tekst || '').trim();
  return ONDERBORD_TEKST[v.onderbord] || '';
}

export const bordNaam = (code) => BORD_MAP.get(code)?.naam || code;
// Omschrijving van één bord: "C43 50", "F41 rechts · Omleiding".
export function bordOmschrijving(v) {
  const b = BORD_MAP.get(v.bord);
  const p = b?.pijl && v.pijl ? ` ${BORD_PIJLEN.find(([k]) => k === v.pijl)?.[1]?.toLowerCase() || v.pijl}` : '';
  const w = b?.waarde && v.waarde ? ` ${v.waarde}` : '';
  return `${v.bord}${w}${p}${b?.tekst && v.tekst ? ` · ${v.tekst}` : ''}`;
}
// Sleutel voor het kaarticoon / de PNG: C43-50, D1-rechts, F41-links.
export function icoonSleutel(v) {
  const b = BORD_MAP.get(v?.bord);
  if (!b) return 'C3';
  if (b.waarde) return `${b.code}-${SNELHEDEN.includes(Number(v.waarde)) ? v.waarde : 50}`;
  if (b.pijl) return `${b.code}-${BORD_PIJLEN.some(([k]) => k === v.pijl) ? v.pijl : 'rechtdoor'}`;
  return b.code;
}
export function alleIcoonSleutels() {
  const uit = [];
  for (const b of BORDEN) {
    if (b.waarde) for (const s of SNELHEDEN) uit.push(`${b.code}-${s}`);
    else if (b.pijl) for (const [p] of BORD_PIJLEN) uit.push(`${b.code}-${p}`);
    else uit.push(b.code);
  }
  return uit;
}

// ---------- SVG van de borden (Belgische vormgeving, vereenvoudigd) ----------
const PIJL_HOEK = { rechtdoor: 0, rechts: 90, links: -90, 'schuin-rechts': 45, 'schuin-links': -45 };
const pijl = (kleur, hoek) => `<path transform="rotate(${hoek} 50 50)" d="M50 16 L70 42 H58 V84 H42 V42 H30 Z" fill="${kleur}"/>`;
const ring = (fill) => `<circle cx="50" cy="50" r="46" fill="${fill}" stroke="${KLEUR.rood}" stroke-width="8"/>`;
const driehoek = (inhoud) => `<path d="M50 5 L96 92 H4 Z" fill="#fff" stroke="${KLEUR.rood}" stroke-width="8" stroke-linejoin="round"/>${inhoud}`;
const bocht = (kant) => {
  // Zwarte pijl die afslaat, met rode schuine balk erdoor (C31a links, C31b rechts).
  const p = `<path d="M62 82 V50 Q62 42 54 42 H42 V32 L22 46 L42 60 V50 H52 V82 Z" fill="${KLEUR.zwart}"/>`;
  return `${ring('#fff')}<g transform="${kant === 'rechts' ? 'translate(100 0) scale(-1 1)' : ''}">${p}</g><path d="M24 22 L78 76" stroke="${KLEUR.rood}" stroke-width="8" stroke-linecap="round"/>`;
};
export function bordSvgInhoud(sleutel) {
  const [code, var1] = String(sleutel).split('-');
  switch (code) {
    case 'C3': return ring('#fff');
    case 'C1': return `<circle cx="50" cy="50" r="46" fill="${KLEUR.rood}" stroke="#fff" stroke-width="3"/><rect x="18" y="42" width="64" height="16" fill="#fff"/>`;
    case 'C31a': return bocht('links');
    case 'C31b': return bocht('rechts');
    case 'C43': return `${ring('#fff')}<text x="50" y="66" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${String(var1 || '50').length > 2 ? 36 : 44}" fill="${KLEUR.zwart}">${var1 || '50'}</text>`;
    case 'D1': return `<circle cx="50" cy="50" r="46" fill="${KLEUR.blauw}" stroke="#fff" stroke-width="3"/>${pijl('#fff', PIJL_HOEK[var1] ?? 0)}`;
    case 'E1': return `<circle cx="50" cy="50" r="46" fill="${KLEUR.blauw}" stroke="${KLEUR.rood}" stroke-width="8"/><path d="M20 20 L80 80" stroke="${KLEUR.rood}" stroke-width="8"/>`;
    case 'E3': return `<circle cx="50" cy="50" r="46" fill="${KLEUR.blauw}" stroke="${KLEUR.rood}" stroke-width="8"/><path d="M20 20 L80 80 M80 20 L20 80" stroke="${KLEUR.rood}" stroke-width="8"/>`;
    case 'F41': {
      const h = PIJL_HOEK[var1] ?? 0;
      const zij = var1 === 'links' || var1 === 'schuin-links';
      // Geel bord, zwarte pijl en OMLEIDING; bij links/rechts staat de pijl aan die kant.
      return `<rect x="2" y="22" width="96" height="56" fill="${KLEUR.geel}" stroke="${KLEUR.zwart}" stroke-width="3"/>`
        + `<g transform="translate(${zij ? -30 : var1 === 'rechtdoor' ? 0 : 30} 0) translate(50 50) scale(0.42) translate(-50 -50)">${pijl(KLEUR.zwart, h)}</g>`
        + `<text x="${zij ? 60 : var1 === 'rechtdoor' ? 50 : 40}" y="${var1 === 'rechtdoor' ? 74 : 56}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${var1 === 'rechtdoor' ? 11 : 13}" fill="${KLEUR.zwart}">OMLEIDING</text>`;
    }
    case 'F45': return `<rect x="4" y="4" width="92" height="92" rx="4" fill="${KLEUR.blauw}" stroke="#fff" stroke-width="3"/><rect x="42" y="36" width="16" height="52" fill="#fff"/><rect x="22" y="20" width="56" height="14" fill="${KLEUR.rood}"/>`;
    case 'A31': return driehoek(`<circle cx="56" cy="40" r="6" fill="${KLEUR.zwart}"/><path d="M50 48 H62 L66 72 H46 Z" fill="${KLEUR.zwart}"/><path d="M50 72 L46 86 M62 72 L66 86" stroke="${KLEUR.zwart}" stroke-width="5"/><path d="M40 52 L72 82" stroke="${KLEUR.zwart}" stroke-width="4"/><path d="M68 78 Q78 72 86 86 H60 Z" fill="${KLEUR.zwart}"/>`);
    case 'A51': return driehoek(`<rect x="45" y="32" width="10" height="36" fill="${KLEUR.zwart}"/><circle cx="50" cy="80" r="6" fill="${KLEUR.zwart}"/>`);
    case 'NADAR': return `<rect x="6" y="28" width="88" height="6" fill="${KLEUR.grijs}"/><rect x="6" y="64" width="88" height="6" fill="${KLEUR.grijs}"/>${[16, 28, 40, 52, 64, 76, 88].map((x) => `<rect x="${x - 2}" y="26" width="4" height="48" fill="${KLEUR.grijs}"/>`).join('')}<path d="M8 74 L4 92 M14 74 L22 92 M92 74 L96 92 M86 74 L78 92" stroke="${KLEUR.grijs}" stroke-width="4"/>`;
    default: return ring('#fff');
  }
}
export function bordSvg(sleutel, px = 100) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}">${bordSvgInhoud(sleutel)}</svg>`;
}
// Onderbord: wit vlak met zwarte rand en tekst (regels).
export function onderbordSvg(tekst, breedte = 100) {
  const regels = String(tekst || '').split('\n').filter(Boolean);
  if (!regels.length) return '';
  const h = 10 + regels.length * 14;
  const maxLen = Math.max(...regels.map((r) => r.length));
  const fs = Math.max(6, Math.min(11, Math.floor((breedte - 10) / (maxLen * 0.6))));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breedte} ${h}" width="${breedte}" height="${h}"><rect x="1.5" y="1.5" width="${breedte - 3}" height="${h - 3}" fill="#fff" stroke="${KLEUR.zwart}" stroke-width="2"/>${regels.map((r, i) => `<text x="${breedte / 2}" y="${12 + i * 14 + fs * 0.35}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fs}" fill="${KLEUR.zwart}">${r.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`).join('')}</svg>`;
}
export const bordPng = (sleutel) => `/m/verkeer/${sleutel}.png`;

// ---------- Tellen ----------
export const lengteVan = (it) => (it.geometrie?.type === 'LineString' ? turf.length(turf.lineString(it.geometrie.coordinates), M) : 0);
export const aantalE1 = (it, interval) => { const L = lengteVan(it); return L > 0 ? Math.floor(L / (interval > 0 ? interval : 15)) + 1 : 0; };
export const aantalNadars = (it) => Math.ceil(lengteVan(it) / NADAR_M);

// Stuklijst: borden per code (met variant), onderborden, nadars; E1 van de parkeerverboden en C3 van de afsluitingen tellen mee.
export function verkeerStuklijst(items, inst) {
  const borden = new Map(); const onderborden = new Map();
  let nadars = 0; let e1 = 0; let c3 = 0; let punten = 0;
  const telBord = (sleutel, naam, n = 1) => { const r = borden.get(sleutel) || { sleutel, naam, n: 0 }; r.n += n; borden.set(sleutel, r); };
  const telOnder = (v, n = 1) => { const t = onderbordTekst(v); if (!t) return; const r = onderborden.get(t) || { tekst: t, n: 0 }; r.n += n; onderborden.set(t, r); };
  for (const it of items) {
    const v = it.velden?.verkeer;
    if (!v?.soort || it.verborgen) continue;
    if (v.soort === 'bord') { punten += 1; telBord(icoonSleutel(v), bordOmschrijving(v)); telOnder(v); }
    else if (v.soort === 'parkeerverbod') { const n = aantalE1(it, Number(v.interval) || inst?.interval || 15); e1 += n; telBord('E1', 'E1 parkeerverbod', n); telOnder({ ...v, onderbord: v.onderbord || 'periode' }, n); }
    else if (v.soort === 'afsluiting') { nadars += aantalNadars(it); c3 += 1; telBord('C3', 'C3', 1); telOnder(v, 1); }
  }
  if (nadars) telBord('NADAR', 'Nadar (2,5 m)', nadars);
  const volg = (s) => BORDEN.findIndex((b) => s.startsWith(b.code));
  return { punten, nadars, e1, c3, borden: [...borden.values()].sort((a, b) => volg(a.sleutel) - volg(b.sleutel) || a.sleutel.localeCompare(b.sleutel)), onderborden: [...onderborden.values()], totaal: [...borden.values()].reduce((t, b) => t + b.n, 0) };
}
export function verkeerStuklijstCsv(s) {
  const r = [['Soort', 'Omschrijving', 'Aantal']];
  for (const b of s.borden) r.push(['Bord', b.naam, b.n]);
  for (const o of s.onderborden) r.push(['Onderbord', o.tekst.replace(/\n/g, ' '), o.n]);
  return r.map((rij) => rij.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

// Items per soort, voor de lijst in het paneel.
export function verkeerGroepen(items) {
  const g = { bord: [], parkeerverbod: [], afsluiting: [], omleiding: [] };
  for (const it of items) { const s = it.velden?.verkeer?.soort; if (g[s]) g[s].push(it); }
  g.bord.sort((a, b) => (Number(a.velden.verkeer.nr) || 0) - (Number(b.velden.verkeer.nr) || 0));
  return g;
}
export function volgendVerkeerNr(items) {
  let max = 0;
  for (const it of items) if (isVerkeerBord(it)) max = Math.max(max, Number(it.velden.verkeer.nr) || 0);
  return max + 1;
}

// ---------- Kaart ----------
// Punt 4 m rechts van de rijrichting (borden staan rechts van de weg).
export function rechtsVanWeg(punt, richting, m = 4) {
  if (richting == null) return punt;
  return turf.destination(turf.point(punt), m, norm(richting + 90), M).geometry.coordinates;
}
export function verkeerGeojson(items, verborgenLagen, inst) {
  const f = [];
  for (const it of items) {
    const v = it.velden?.verkeer;
    if (!v?.soort || it.verborgen) continue;
    if (it.laag_id && verborgenLagen?.has(it.laag_id)) continue;
    if (v.soort === 'bord' && it.geometrie?.type === 'Point') {
      f.push({ type: 'Feature', geometry: it.geometrie, properties: { id: it.id, soort: 'bord', icoon: `vk-${icoonSleutel(v)}`, richting: Number(v.kijkrichting) || 0, heeftRichting: v.kijkrichting != null, nr: String(v.nr ?? ''), controleren: !!v.auto?.controleren } });
    } else if (it.geometrie?.type === 'LineString' && it.geometrie.coordinates.length > 1) {
      const lijn = turf.lineString(it.geometrie.coordinates);
      const L = turf.length(lijn, M);
      if (v.soort === 'parkeerverbod') {
        const stap = Number(v.interval) || inst?.interval || 15;
        const n = aantalE1(it, stap);
        for (let i = 0; i < n; i++) f.push({ type: 'Feature', geometry: turf.along(lijn, Math.min(L, i * stap), M).geometry, properties: { id: it.id, soort: 'herhaal', icoon: 'vk-E1', nr: '' } });
      } else if (v.soort === 'afsluiting') {
        f.push({ type: 'Feature', geometry: turf.along(lijn, L / 2, M).geometry, properties: { id: it.id, soort: 'afsluiting', icoon: 'vk-C3', nr: `${aantalNadars(it)}× nadar` } });
      }
    }
  }
  return { type: 'FeatureCollection', features: f };
}
// PNG's van de borden in de kaart laden (één keer).
export async function laadVerkeerIconen(map) {
  const todo = alleIcoonSleutels().filter((s) => !map.hasImage(`vk-${s}`));
  await Promise.all(todo.map(async (s) => {
    try {
      const r = await map.loadImage(bordPng(s));
      if (!map.hasImage(`vk-${s}`)) map.addImage(`vk-${s}`, r.data, { pixelRatio: 2 });
    } catch {}
  }));
}
export function verkeerKaartLagen() {
  return [
    { id: 'fm-vk-kijk', type: 'symbol', source: 'fm-verkeer', filter: ['all', ['==', ['get', 'soort'], 'bord'], ['get', 'heeftRichting']],
      layout: { 'icon-image': 'fm-kijk', 'icon-rotate': ['get', 'richting'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 1.1, 'icon-offset': [0, -22] } },
    { id: 'fm-vk-herhaal', type: 'symbol', source: 'fm-verkeer', filter: ['==', ['get', 'soort'], 'herhaal'],
      layout: { 'icon-image': ['get', 'icoon'], 'icon-size': 0.22, 'icon-allow-overlap': true, 'icon-ignore-placement': true } },
    { id: 'fm-vk-bord', type: 'symbol', source: 'fm-verkeer', filter: ['!=', ['get', 'soort'], 'herhaal'],
      layout: { 'icon-image': ['get', 'icoon'], 'icon-size': ['case', ['==', ['get', 'soort'], 'afsluiting'], 0.4, 0.5], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'viewport',
        'text-field': ['get', 'nr'], 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 2.1], 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#1d1d1b', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } },
  ];
}

// ---------- Omleiding: F41-borden op de echte afslagen ----------
// Zet de manoeuvres van signVoorstel (osrmManoeuvres / knikken) om in F41-punten:
// 30 m vóór het kruispunt, rechts van de weg, pijl volgens de manoeuvre.
const MOD = { uturn: 'links', 'sharp right': 'rechts', right: 'rechts', 'slight right': 'schuin-rechts', straight: 'rechtdoor', 'slight left': 'schuin-links', left: 'links', 'sharp left': 'links' };
const ROTONDE = new Set(['roundabout', 'rotary', 'roundabout turn']);
const BORD_TYPES = new Set(['turn', 'end of road', 'fork', 'on ramp', 'off ramp', 'roundabout', 'rotary', 'roundabout turn', 'continue']);
const naarPijl = (p) => (['terug', 'u-bocht'].includes(p) ? 'links' : p);
export function f41Kandidaten(omleiding, coords, res) {
  const lijn = turf.lineString(coords);
  const uit = [];
  for (const m of res.manoeuvres) {
    if (m.type === 'depart' || m.type === 'arrive') continue;
    if (!m.pijl && !BORD_TYPES.has(m.type)) continue;
    if (!m.pijl && m.type === 'continue' && !['left', 'right', 'sharp left', 'sharp right', 'uturn'].includes(m.modifier)) continue;
    const p = m.pijl || (ROTONDE.has(m.type) ? (m.na != null && m.voor != null ? pijlUitHoek(norm(m.na - m.voor)) : 'rechtdoor') : MOD[m.modifier] || (m.na != null && m.voor != null ? pijlUitHoek(norm(m.na - m.voor)) : 'rechtdoor'));
    const terug = ROTONDE.has(m.type) ? 50 : 30;
    const opLijn = turf.along(lijn, Math.max(0, m.pos - terug), M).geometry.coordinates;
    const richting = m.voor != null ? ((Math.round(m.voor) % 360) + 360) % 360 : null;
    uit.push({ anker: m.loc, plek: rechtsVanWeg(opLijn, richting), pijl: naarPijl(p), richting, pos: m.pos, controleren: !!m.controleren, rotonde: ROTONDE.has(m.type) ? m.exit || null : null });
  }
  return uit;
}
const afstand = (a, b) => turf.distance(a, b, M);
export function f41Status(it) {
  const a = it?.velden?.verkeer?.auto;
  if (!a) return 'eigen';
  const p = it.geometrie?.coordinates;
  if (a.plek && p && afstand(a.plek, p) > 1) return 'aangepast';
  if (a.pijl && it.velden.verkeer.pijl !== a.pijl) return 'aangepast';
  return 'voorstel';
}
// Nieuw voorstel vergelijken met de F41's die er al staan voor deze omleiding.
export function f41Plannen(omleiding, kand, items) {
  const bestaand = items.filter((it) => isVerkeerBord(it) && it.velden.verkeer.bord === 'F41' && it.velden.verkeer.auto?.omleiding_id === omleiding.id);
  const gebruikt = new Set();
  const acties = { nieuw: [], bijwerken: [], vervalt: [] };
  for (const k of kand) {
    const m = bestaand.find((it) => !gebruikt.has(it.id) && afstand(it.velden.verkeer.auto.anker, k.anker) < 30);
    const auto = { omleiding_id: omleiding.id, anker: k.anker, plek: k.plek, pijl: k.pijl, ...(k.controleren ? { controleren: true } : {}) };
    if (!m) { acties.nieuw.push({ k, auto }); continue; }
    gebruikt.add(m.id);
    if (f41Status(m) !== 'voorstel') continue; // jouw versie blijft staan
    const v = m.velden.verkeer;
    if (v.pijl !== k.pijl || afstand(v.auto.plek, k.plek) > 1 || v.kijkrichting !== k.richting) {
      acties.bijwerken.push({ id: m.id, patch: { geometrie: { type: 'Point', coordinates: k.plek }, velden: { ...m.velden, verkeer: { ...v, pijl: k.pijl, kijkrichting: k.richting, auto } } } });
    }
  }
  for (const it of bestaand) if (!gebruikt.has(it.id) && f41Status(it) === 'voorstel') acties.vervalt.push(it.id);
  return acties;
}

// Straatnaam bij een punt (Nominatim, zoals bij de vaste aansluitingen). Max. 1 per seconde.
let laatsteNominatim = 0;
export async function straatBij(punt) {
  const wacht = laatsteNominatim + 1100 - Date.now();
  if (wacht > 0) await new Promise((r) => setTimeout(r, wacht));
  laatsteNominatim = Date.now();
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=nl&lon=${punt[0]}&lat=${punt[1]}`);
    const j = await r.json();
    const a = j.address || {};
    const straat = a.road || a.pedestrian || a.footway || a.path || null;
    const gemeente = a.municipality || a.city || a.town || a.village || null;
    return straat ? (gemeente ? `${straat}, ${gemeente}` : straat) : null;
  } catch { return null; }
}
