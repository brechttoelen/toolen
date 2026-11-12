'use client';

// Kaartondergronden van Toolen Maps. Alles gratis en open:
//  - Vlaanderen: orthofoto (winter, meest recent) en GRB-basiskaart grijs van
//    Digitaal Vlaanderen, WMTS in GoogleMapsVL (EPSG:3857, zoom 0–21).
//  - Nederland: luchtfoto Beeldmateriaal via PDOK (8 cm), WMTS-REST. De
//    TileMatrix-namen hebben een voorloopnul ('00'…'09'), daarom een eigen
//    protocol dat het zoomniveau aanvult.
//  - Wallonië: ORTHO van de SPW, enkel als dynamische ArcGIS-export in 3857.
//  - Frankrijk: orthophoto van IGN (Géoplateforme, Licence Ouverte).
//  - Noordrijn-Westfalen: DOP van Geobasis NRW (dl-de/zero-2-0).
//  Vlaanderen, Nederland, Wallonië (ORTHO_LAST), Frankrijk en NRW tonen telkens de
//  meest recente opname: de diensten schakelen zelf over als er een nieuwe is.
//  - Overal, en bij uitzoomen: Sentinel-2 cloudless 2016 van EOX (CC BY 4.0).
//    De regionale luchtfoto's komen pas vanaf zoom 11, zodat uitgezoomd geen
//    lappendeken van overzichtsbeelden en witte vlakken ontstaat.
//  - Stratenkaart: OpenStreetMap, enkel op het scherm (geen drukwerk, geen voorladen).
import maplibregl from 'maplibre-gl';

const VL = 'https://geo.api.vlaanderen.be';
// Wallonië: transparant buiten het gewest, anders legt het een wit vlak over de buren.
export const WA_TEGEL = (bbox) => `https://geoservices.wallonie.be/arcgis/rest/services/IMAGERIE/ORTHO_LAST/MapServer/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`;
const KVP = (dienst, laag) =>
  `${VL}/${dienst}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${laag}&STYLE=&FORMAT=image/png&TILEMATRIXSET=GoogleMapsVL&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;

// [west, zuid, oost, noord]
export const GEBIED = {
  vl: [2.52, 50.67, 5.95, 51.51],
  wa: [2.8, 49.45, 6.45, 50.85],
  nl: [3.2, 50.72, 7.25, 53.6],
  fr: [-5.2, 41.3, 9.6, 51.1],
  nrw: [5.86, 50.32, 9.46, 52.53],
  lu: [5.73, 49.44, 6.53, 50.19],
  ch: [5.95, 45.81, 10.5, 47.81],
  at: [9.5, 46.37, 17.17, 49.03],
  es: [-9.4, 35.9, 4.35, 43.8],
};

// Optioneel: Esri World Imagery (scherp wereldwijd) met een gratis sleutel van
// ArcGIS Location Platform. Zonder sleutel blijft Sentinel-2 de achtergrond.
const ESRI = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_ESRI_SLEUTEL : null;
const ESRI_MINZOOM = 14;

// Ligt dit punt in een gebied met een eigen (gratis) luchtfoto? Dan geen Esri-tegels.
export function eigenLuchtfoto([lng, lat]) {
  const in_ = (g) => lng >= g[0] && lng <= g[2] && lat >= g[1] && lat <= g[3];
  if (in_(GEBIED.vl) || in_(GEBIED.wa) || in_(GEBIED.nl) || in_(GEBIED.nrw) || in_(GEBIED.lu) || in_(GEBIED.ch) || in_(GEBIED.at)) return true;
  if (in_(GEBIED.fr) && !(lat > 50.25 && lng < 1.55)) return true; // niet Zuid-Engeland
  if (in_(GEBIED.es) && !(lng < -6.9 && lat < 42.1)) return true; // niet Portugal
  return false;
}

// Esri enkel tonen waar geen eigen luchtfoto is en dicht genoeg ingezoomd.
function regelEsri(map) {
  if (!map.getLayer('og-esri')) return;
  const aan = map._fmFotoAan && map.getZoom() >= ESRI_MINZOOM - 0.5 && !eigenLuchtfoto(map.getCenter().toArray());
  const nu = map.getLayoutProperty('og-esri', 'visibility') === 'visible';
  if (aan !== nu) map.setLayoutProperty('og-esri', 'visibility', aan ? 'visible' : 'none');
}

// Vanaf deze zoom nemen de scherpe regionale luchtfoto's over van Sentinel-2.
export const REGIO_MINZOOM = 11;

export const BRONNEN = {
  'vl-ortho': {
    type: 'raster', tiles: [KVP('OMWRGBMRVL', 'omwrgbmrvl')], tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 21,
    bounds: GEBIED.vl, attribution: '© Digitaal Vlaanderen – Luchtopnamen Vlaanderen',
  },
  'vl-grb': {
    type: 'raster', tiles: [KVP('GRB', 'grb_bsk_grijs')], tileSize: 256, maxzoom: 21,
    bounds: GEBIED.vl, attribution: '© Digitaal Vlaanderen – GRB',
  },
  'nl-ortho': {
    type: 'raster', tiles: ['pdok://Actueel_orthoHR/{z}/{x}/{y}'], tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 21,
    bounds: GEBIED.nl, attribution: '© Beeldmateriaal Nederland / PDOK',
  },
  'wa-ortho': {
    type: 'raster', tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 20, bounds: GEBIED.wa,
    tiles: [WA_TEGEL('{bbox-epsg-3857}')],
    attribution: '© SPW – ORTHO (meest recente opname)',
  },
  'fr-ortho': {
    type: 'raster', tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 20, bounds: GEBIED.fr,
    tiles: ['wit://https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'],
    attribution: '© IGN – BD ORTHO',
  },
  'nrw-ortho': {
    type: 'raster', tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 20, bounds: GEBIED.nrw,
    tiles: ['https://www.wms.nrw.de/geobasis/wms_nw_dop?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=nw_dop_rgb&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE'],
    attribution: '© Geobasis NRW (dl-de/zero-2-0)',
  },
  'lu-ortho': {
    type: 'raster', tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 20, bounds: GEBIED.lu,
    tiles: ['wit://https://wmts1.geoportail.lu/opendata/wmts/ortho_latest/GLOBAL_WEBMERCATOR_4_V3/{z}/{x}/{y}.jpeg'],
    attribution: '© Geoportail Luxembourg',
  },
  'ch-ortho': {
    type: 'raster', tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 20, bounds: GEBIED.ch,
    tiles: ['wit://https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg'],
    attribution: '© swisstopo',
  },
  'at-ortho': {
    type: 'raster', tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 19, bounds: GEBIED.at,
    tiles: ['wit://https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg'],
    attribution: '© basemap.at',
  },
  'es-ortho': {
    type: 'raster', tileSize: 256, minzoom: REGIO_MINZOOM, maxzoom: 20, bounds: GEBIED.es,
    tiles: ['wit://https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}'],
    attribution: 'PNOA © scne.es',
  },
  ...(ESRI ? { esri: {
    // Pas vanaf zoom 14 (± 6 m per pixel): daarboven is Sentinel-2 even scherp.
    type: 'raster', tileSize: 256, minzoom: ESRI_MINZOOM, maxzoom: 19,
    tiles: [`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ESRI}`],
    attribution: 'Esri, Maxar, Earthstar Geographics',
  } } : {}),
  s2: {
    type: 'raster', tileSize: 256, maxzoom: 15,
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'],
    attribution: 'Sentinel-2 cloudless 2016 © EOX IT Services (Copernicus Sentinel-gegevens 2016)',
  },
  osm: {
    type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19,
    attribution: '© OpenStreetMap-bijdragers',
  },
};

// Luchtfoto Vlaanderen: de wintervlucht is het recentst maar heeft lange schaduwen (lage zon);
// de zomervlucht is een jaar ouder maar met korte schaduwen. Keuze per plan (instellingen.fotoVl).
// De server (GeoWebCache) heeft de oudere jaren enkel tot zoom 19 klaarstaan; dieper wordt elke tegel
// op aanvraag gerenderd (± 1,5 s per tegel). Ook zit er geen extra detail meer in (25 cm). Daarom
// stopt de bron op zoom 19 en vergroot MapLibre zelf. De meest recente opname staat tot zoom 20 klaar.
const OMW = (j) => ({ naam: `Winter ${j}`, groep: 'Winter', max: 19, tegel: KVP('OMW', `omwrgb${String(j).slice(2)}vl`) });
const OMZ = (j) => ({ naam: `Zomer ${j}`, groep: 'Zomer', max: 19, tegel: KVP('OMZ', `omzrgb${String(j).slice(2)}vl`) });
export const FOTO_VL = {
  winter: { naam: 'Winter · meest recent', groep: 'Winter', max: 20, tegel: KVP('OMWRGBMRVL', 'omwrgbmrvl') },
  ...Object.fromEntries([2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((j) => [`w${j}`, OMW(j)])),
  zomer: OMZ(2024),
  ...Object.fromEntries([2021, 2018, 2015].map((j) => [`z${j}`, OMZ(j)])),
};
let fotoVl = 'winter';
let schaduw = 0;
// Schaduw ophelderen: 0 = uit, 0.6 = lichter, 1 = sterk.
export const SCHADUW = [[0, 'Uit'], [0.6, 'Lichter'], [1, 'Sterk']];
export const fotoVlTegel = (z, x, y) => FOTO_VL[fotoVl].tegel.replace('{z}', z).replace('{y}', y).replace('{x}', x);
const vlTegel = () => (schaduw ? `fmschaduw://${schaduw}/${FOTO_VL[fotoVl].tegel}` : FOTO_VL[fotoVl].tegel);
// Kies opname en schaduwcorrectie (uit plan.instellingen); met een kaart erbij meteen toepassen.
export function kiesFotoVl(inst, map = null) {
  fotoVl = FOTO_VL[inst?.fotoVl] ? inst.fotoVl : 'winter';
  schaduw = SCHADUW.some(([k]) => k === Number(inst?.schaduw)) ? Number(inst.schaduw) : 0;
  const bron = map?.getSource?.('vl-ortho');
  if (!bron || (bron.tiles?.[0] === vlTegel() && bron.maxzoom === FOTO_VL[fotoVl].max)) return;
  // Maxzoom van een bron is vast: laag en bron opnieuw toevoegen op dezelfde plek.
  const lagen = map.getStyle()?.layers || [];
  const i = lagen.findIndex((l) => l.id === 'og-vl-ortho');
  if (i < 0) return;
  const laag = lagen[i]; const voor = lagen[i + 1]?.id;
  map.removeLayer('og-vl-ortho'); map.removeSource('vl-ortho');
  map.addSource('vl-ortho', vlBron());
  map.addLayer(laag, voor);
}
const vlBron = () => ({ ...BRONNEN['vl-ortho'], tiles: [vlTegel()], maxzoom: FOTO_VL[fotoVl].max });
export const inVlaanderen = (c) => Array.isArray(c) && c[0] >= GEBIED.vl[0] && c[0] <= GEBIED.vl[2] && c[1] >= GEBIED.vl[1] && c[1] <= GEBIED.vl[3];

// Schaduw ophelderen. Een schaduw is donker én blauw (enkel licht van de hemel). Op een vervaagde
// versie van de tegel (zodat auto's en strepen in de schaduw hun contrast houden) wordt per plek
// bepaald hoeveel schaduw er is; daar gaat de blauwe zweem eruit en wordt het beeld versterkt tot
// een gewone helderheid. Zonnige delen blijven ongemoeid. Een echte schaduw wegrekenen kan niet:
// wat eronder ligt, wordt enkel weer zichtbaar.
function vervaag(v, w, h, r = 4) {
  const t = new Float32Array(v.length);
  const pas = (bron, doel, hor) => {
    const len = hor ? w : h; const rijen = hor ? h : w;
    for (let a = 0; a < rijen; a++) {
      const at = hor ? (b) => a * w + b : (b) => b * w + a;
      let som = 0; let cnt = 0;
      for (let b = 0; b <= r && b < len; b++) { som += bron[at(b)]; cnt++; }
      for (let b = 0; b < len; b++) {
        doel[at(b)] = som / cnt;
        if (b + r + 1 < len) { som += bron[at(b + r + 1)]; cnt++; }
        if (b - r >= 0) { som -= bron[at(b - r)]; cnt--; }
      }
    }
  };
  pas(v, t, true); pas(t, v, false); pas(v, t, true); pas(t, v, false);
  return v;
}
function helderSchaduw(img, k) {
  const { width: w, height: h, data: d } = img; const n = w * h;
  const Y = new Float32Array(n); const cR = new Float32Array(n); const cG = new Float32Array(n); const cB = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const r = d[j] / 255; const g = d[j + 1] / 255; const b = d[j + 2] / 255;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    Y[i] = y; cR[i] = r - y; cG[i] = g - y; cB[i] = b - y;
  }
  vervaag(Y, w, h); vervaag(cR, w, h); vervaag(cG, w, h); vervaag(cB, w, h);
  const glad = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const lb = Y[i];
    const md = (0.38 - lb) / 0.22;
    const mb = Math.min(1, Math.max(0, (cB[i] - cR[i] - 0.04) / 0.1)) * Math.min(1, Math.max(0, (0.8 - lb) / 0.2));
    const m = glad(Math.max(md, mb)) * k;
    if (m <= 0) continue;
    const g = 1 + (Math.min(2.4, Math.max(1, (0.42 + 0.25 * mb) / Math.max(lb, 0.08))) - 1) * m;
    const R = (d[j] / 255 - cR[i] * m) * g * 255; const G = (d[j + 1] / 255 - cG[i] * m) * g * 255; const B = (d[j + 2] / 255 - cB[i] * m) * g * 255;
    d[j] = R < 0 ? 0 : R > 255 ? 255 : R; d[j + 1] = G < 0 ? 0 : G > 255 ? 255 : G; d[j + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
  }
  return img;
}
async function schaduwTegel(url, k, abort) {
  const res = await fetch(url, { signal: abort.signal });
  if (res.status === 404 || res.status === 204) return leegPng();
  if (!res.ok) throw new Error(`Tegel ${res.status}`);
  const blob = await res.blob();
  if (typeof OffscreenCanvas === 'undefined') return blob.arrayBuffer();
  const bm = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bm.width, bm.height); const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bm, 0, 0);
  ctx.putImageData(helderSchaduw(ctx.getImageData(0, 0, c.width, c.height), k), 0, 0);
  return (await c.convertToBlob({ type: 'image/png' })).arrayBuffer();
}

const FOTO_BASIS = ESRI ? ['s2', 'esri'] : ['s2'];

// Welke rasterlagen bij welke ondergrond horen (onder → boven).
export const ONDERGRONDEN = {
  luchtfoto:    { naam: 'Luchtfoto',     lagen: [...FOTO_BASIS, 'fr-ortho', 'es-ortho', 'ch-ortho', 'at-ortho', 'lu-ortho', 'nrw-ortho', 'nl-ortho', 'wa-ortho', 'vl-ortho', 'namen'] },
  luchtfoto_straten: { naam: 'Luchtfoto met straten', lagen: [...FOTO_BASIS, 'fr-ortho', 'es-ortho', 'ch-ortho', 'at-ortho', 'lu-ortho', 'nrw-ortho', 'nl-ortho', 'wa-ortho', 'vl-ortho', 'straten', 'namen'] },
  lijntekening: { naam: 'Lijntekening',  lagen: ['osm-grijs', 'vl-grb'] },
  stratenkaart: { naam: 'Stratenkaart',  lagen: ['osm'] },
  leeg:         { naam: 'Leeg',          lagen: [] },
};

let protocolKlaar = false;
export function registreerProtocollen() {
  if (protocolKlaar || typeof window === 'undefined') return;
  protocolKlaar = true;
  maplibregl.addProtocol('pdok', async (params, abort) => {
    const [, laag, z, x, y] = params.url.match(/^pdok:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/) || [];
    const zz = String(z).padStart(2, '0');
    const url = `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/${laag}/EPSG:3857/${zz}/${x}/${y}.jpeg`;
    return { data: await witWeg(url, abort) };
  });
  // Tegels die buiten hun gebied wit zijn: wit doorzichtig maken.
  maplibregl.addProtocol('wit', async (params, abort) => ({ data: await witWeg(params.url.slice(6), abort) }));
  maplibregl.addProtocol('ofmjson', async (params, abort) => {
    const r = await fetch('https://tiles.openfreemap.org/planet', { signal: abort.signal });
    if (!r.ok) throw new Error(`TileJSON ${r.status}`);
    const j = await r.json();
    return { data: { ...j, attribution: OFM_TEKST } };
  });
  maplibregl.addProtocol('fmschaduw', async (params, abort) => {
    const [, k, url] = params.url.match(/^fmschaduw:\/\/([\d.]+)\/(.*)$/) || [];
    return { data: await schaduwTegel(url, Number(k) || 1, abort) };
  });
}

async function leegPng() {
  const c = new OffscreenCanvas(1, 1);
  return (await c.convertToBlob({ type: 'image/png' })).arrayBuffer();
}

// Haalt een tegel op; is ze grotendeels puur wit (buiten de dekking), dan
// wordt dat wit doorzichtig zodat de laag eronder (Sentinel-2) zichtbaar blijft.
async function witWeg(url, abort) {
  // Een haperende tegelserver: nog één keer proberen voor de tegel leeg blijft.
  let res;
  for (let k = 0; ; k++) {
    try { res = await fetch(url, { signal: abort.signal }); if (res.ok || res.status < 500 || k >= 1) break; } catch (err) { if (abort.signal.aborted || k >= 1) throw err; }
    await new Promise((ok) => setTimeout(ok, 500 * (k + 1)));
  }
  if (res.status === 404 || res.status === 204) return leegPng();
  if (!res.ok) throw new Error(`Tegel ${res.status}`);
  const blob = await res.blob();
  if (typeof OffscreenCanvas === 'undefined') return blob.arrayBuffer();
  const bm = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bm.width, bm.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(bm, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let wit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] >= 250 && d[i + 1] >= 250 && d[i + 2] >= 250) wit++;
  if (wit < (d.length / 4) * 0.03) return blob.arrayBuffer();
  if (wit === d.length / 4) return leegPng();
  for (let i = 0; i < d.length; i += 4) if (d[i] >= 250 && d[i + 1] >= 250 && d[i + 2] >= 250) d[i + 3] = 0;
  ctx.putImageData(img, 0, 0);
  return (await c.convertToBlob({ type: 'image/png' })).arrayBuffer();
}

// Basisstijl met alle rasterbronnen; de zichtbaarheid regelt welke ondergrond.
export function basisStijl(ondergrond = 'luchtfoto', centrum = null) {
  const zicht = new Set(ONDERGRONDEN[ondergrond]?.lagen || []);
  // Geen Esri waar een eigen luchtfoto is (bv. PDF in Vlaanderen).
  // Zonder centrum (kaart in de editor) start Esri uit; zetOndergrond zet hem aan waar nodig.
  if (!centrum || eigenLuchtfoto(centrum)) zicht.delete('esri');
  const raster = (id, bron, extra = {}) => ({
    id: `og-${id}`, type: 'raster', source: bron,
    layout: { visibility: zicht.has(id) ? 'visible' : 'none' },
    paint: extra,
  });
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { ...Object.fromEntries(Object.entries(BRONNEN).map(([k, v]) => [k, k === 'vl-ortho' ? vlBron() : { ...v }])), ...(zicht.has('straten') || zicht.has('namen') ? { ofm: OFM } : {}) },
    layers: [
      { id: 'og-achtergrond', type: 'background', paint: { 'background-color': '#f4f4f2' } },
      // Straten en straatnamen over de luchtfoto (OpenStreetMap-data via OpenFreeMap, vrij te gebruiken).
      raster('osm-grijs', 'osm', { 'raster-saturation': -1, 'raster-opacity': 0.45 }),
      raster('osm', 'osm'),
      raster('s2', 's2'),
      ...(ESRI ? [raster('esri', 'esri')] : []),
      raster('fr-ortho', 'fr-ortho'),
      raster('es-ortho', 'es-ortho'),
      raster('ch-ortho', 'ch-ortho'),
      raster('at-ortho', 'at-ortho'),
      raster('lu-ortho', 'lu-ortho'),
      raster('nrw-ortho', 'nrw-ortho'),
      raster('nl-ortho', 'nl-ortho'),
      raster('wa-ortho', 'wa-ortho'),
      raster('vl-ortho', 'vl-ortho'),
      raster('vl-grb', 'vl-grb'),
      ...(zicht.has('straten') || zicht.has('namen') ? [...stratenLagen(zicht.has('straten')), ...namenLagen(zicht.has('namen'))] : []),
    ],
  };
}

export function zetOndergrond(map, ondergrond) {
  const zicht = new Set(ONDERGRONDEN[ondergrond]?.lagen || []);
  map._fmFotoAan = zicht.has('esri');
  if (ESRI && !map._fmEsriLuister) { map._fmEsriLuister = true; map.on('moveend', () => regelEsri(map)); }
  for (const id of ['osm-grijs', 'osm', 's2', 'esri', 'fr-ortho', 'es-ortho', 'ch-ortho', 'at-ortho', 'lu-ortho', 'nrw-ortho', 'nl-ortho', 'wa-ortho', 'vl-ortho', 'vl-grb']) {
    if (map.getLayer(`og-${id}`)) map.setLayoutProperty(`og-${id}`, 'visibility', zicht.has(id) ? 'visible' : 'none');
  }
  regelEsri(map);
  // Straten en plaatsnamen pas laden als iemand ze kiest.
  if ((zicht.has('straten') || zicht.has('namen')) && !map.getSource('ofm')) {
    map.addSource('ofm', OFM);
    const eersteEigen = (map.getStyle()?.layers || []).find((l) => l.id.startsWith('fm-'))?.id;
    for (const l of [...stratenLagen(zicht.has('straten')), ...namenLagen(zicht.has('namen'))]) map.addLayer(l, eersteEigen);
  }
  for (const l of stratenLagen(false)) if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', zicht.has('straten') ? 'visible' : 'none');
  for (const l of namenLagen(false)) if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', zicht.has('namen') ? 'visible' : 'none');
}

// De TileJSON van OpenFreeMap via een eigen protocol: de bronvermelding uit die (externe) TileJSON wordt
// vervangen door een vaste tekst. Zo komt er nooit HTML van een derde in de kaart (MapLibre 5: GHSA-jrc7-96c5-q579).
const OFM_TEKST = '© OpenStreetMap-bijdragers · OpenFreeMap';
const OFM = { type: 'vector', url: 'ofmjson://planet', attribution: OFM_TEKST };

// Wegen als dunne witte lijnen en straatnamen langs de weg (OpenMapTiles-schema).
function stratenLagen(zichtbaar) {
  const v = zichtbaar ? 'visible' : 'none';
  const breed = ['interpolate', ['exponential', 1.6], ['zoom'], 8, 0.5, 13, 0.8, 16, 2, 19, 6];
  return [
    { id: 'og-straten-lijn', type: 'line', source: 'ofm', 'source-layer': 'transportation', minzoom: 8,
      filter: ['any',
        ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
        ['all', ['>=', ['zoom'], 11], ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false]],
        ['all', ['>=', ['zoom'], 13], ['match', ['get', 'class'], ['minor', 'service'], true, false]]],
      layout: { visibility: v, 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': breed } },
    { id: 'og-straten-naam', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name', minzoom: 14,
      layout: { visibility: v, 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:nl'], ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 19, 13], 'text-max-angle': 30 },
      paint: { 'text-color': '#1d1d1b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } },
  ];
}

// Grenzen (land, gewest, provincie, gemeente) en plaatsnamen, zodat je bij het
// uitzoomen weet waar je bent. OpenMapTiles-schema van OpenFreeMap.
function namenLagen(zichtbaar) {
  const v = zichtbaar ? 'visible' : 'none';
  const naam = ['coalesce', ['get', 'name:nl'], ['get', 'name']];
  return [
    { id: 'og-grens-gemeente', type: 'line', source: 'ofm', 'source-layer': 'boundary', minzoom: 10,
      filter: ['all', ['==', ['get', 'admin_level'], 8], ['!=', ['get', 'maritime'], 1]],
      layout: { visibility: v }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': 1, 'line-dasharray': [3, 2] } },
    { id: 'og-grens-provincie', type: 'line', source: 'ofm', 'source-layer': 'boundary', minzoom: 6,
      filter: ['all', ['in', ['get', 'admin_level'], ['literal', [4, 6]]], ['!=', ['get', 'maritime'], 1]],
      layout: { visibility: v, 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 2], 'line-dasharray': [4, 2, 1, 2] } },
    { id: 'og-grens-land', type: 'line', source: 'ofm', 'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { visibility: v, 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 12, 3] } },
    { id: 'og-plaats', type: 'symbol', source: 'ofm', 'source-layer': 'place', maxzoom: 17,
      filter: ['match', ['get', 'class'], ['country', 'state', 'province', 'city', 'town', 'village', 'suburb', 'hamlet'], true, false],
      layout: {
        visibility: v,
        'text-field': naam, 'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'],
          6, ['match', ['get', 'class'], 'country', 15, ['state', 'province'], 13, 'city', 12, 'town', 11, 11],
          12, ['match', ['get', 'class'], 'country', 15, ['state', 'province'], 13, 'city', 17, 'town', 14, 'village', 12, 11],
          14, ['match', ['get', 'class'], 'country', 15, ['state', 'province'], 13, 'city', 18, 'town', 15, 'village', 13, 11]],
        'text-transform': ['match', ['get', 'class'], ['country', 'state', 'province'], 'uppercase', 'none'],
        'text-letter-spacing': ['match', ['get', 'class'], ['country', 'state', 'province'], 0.12, 0],
        'symbol-sort-key': ['get', 'rank'], 'text-max-width': 8,
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.6 },
    },
  ];
}

// Bronvermelding voor het titelblok, afhankelijk van ondergrond en plaats.
export function bronvermelding(ondergrond, [lng, lat] = [4.4, 50.9]) {
  const in_ = (g) => lng >= g[0] && lng <= g[2] && lat >= g[1] && lat <= g[3];
  const delen = [];
  if (ondergrond === 'luchtfoto' || ondergrond === 'luchtfoto_straten') {
    delen.push(ondergrond === 'luchtfoto_straten' ? 'Straten en namen © OpenStreetMap-bijdragers' : 'Namen © OpenStreetMap-bijdragers');
    if (in_(GEBIED.vl)) delen.push('Luchtfoto © Digitaal Vlaanderen');
    if (in_(GEBIED.wa)) delen.push('ORTHO © SPW');
    if (in_(GEBIED.nl)) delen.push('Luchtfoto © Beeldmateriaal Nederland / PDOK');
    if (in_(GEBIED.fr)) delen.push('Orthophoto © IGN');
    if (in_(GEBIED.nrw)) delen.push('Luftbild © Geobasis NRW');
    if (in_(GEBIED.lu)) delen.push('Ortho © Geoportail Luxembourg');
    if (in_(GEBIED.ch)) delen.push('SWISSIMAGE © swisstopo');
    if (in_(GEBIED.at)) delen.push('Orthofoto © basemap.at');
    if (in_(GEBIED.es)) delen.push('PNOA © scne.es');
    delen.push(ESRI ? 'Esri, Maxar, Earthstar Geographics' : 'Sentinel-2 cloudless 2016 © EOX');
  } else if (ondergrond === 'lijntekening') {
    delen.push(in_(GEBIED.vl) ? 'GRB © Digitaal Vlaanderen' : '© OpenStreetMap-bijdragers');
  } else if (ondergrond === 'stratenkaart') {
    delen.push('© OpenStreetMap-bijdragers');
  }
  return delen.join(' · ');
}

// Mag deze ondergrond in een PDF? OSM-tegels niet (gebruiksvoorwaarden).
export function drukbaar(ondergrond, [lng, lat]) {
  if (ondergrond === 'leeg') return true;
  if (ondergrond === 'stratenkaart') return false;
  const in_ = (g) => lng >= g[0] && lng <= g[2] && lat >= g[1] && lat <= g[3];
  if (ondergrond === 'lijntekening') return in_(GEBIED.vl);
  return true; // Luchtfoto: Sentinel-2 (CC BY 4.0) dekt overal.
}

// Bronvermelding (©) ingeklapt starten: enkel het i-knopje, openklikken kan altijd.
// MapLibre klapt ze open zodra de eerste bronnen geladen zijn; dat vangen we de eerste 20 s af.
export function klapBronvermeldingIn(map) {
  const el = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
  if (!el) return;
  let zelf = false;
  // In de capture-fase: vóór MapLibre zelf openklapt, anders klapt de observer het meteen weer dicht.
  el.addEventListener('click', () => { zelf = true; }, true);
  const klap = () => {
    if (zelf || !el.classList.contains('maplibregl-compact-show')) return;
    el.classList.remove('maplibregl-compact-show');
    el.setAttribute('open', '');
  };
  const obs = new MutationObserver(klap);
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  klap();
  setTimeout(() => obs.disconnect(), 20000);
}
