// Adressen van de externe kaartdiensten, op één plek: de kaart (ondergronden.js) tekent ermee en de
// dagelijkse controle (lib/kaartbronnen.ts) vraagt er één tegel van op. Geen imports: ook bruikbaar op de server.
// {z} {x} {y} = tegelnummers, {bbox-epsg-3857} = de rand van de tegel in Web Mercator.

const VL = 'https://geo.api.vlaanderen.be';
export const VL_KVP = (dienst, laag) =>
  `${VL}/${dienst}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${laag}&STYLE=&FORMAT=image/png&TILEMATRIXSET=GoogleMapsVL&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;

export const ADRES = {
  'vl-ortho': VL_KVP('OMWRGBMRVL', 'omwrgbmrvl'),
  'vl-grb': VL_KVP('GRB', 'grb_bsk_grijs'),
  // Nederland: het zoomniveau krijgt een voorloopnul ({zz}).
  'nl-ortho': 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{zz}/{x}/{y}.jpeg',
  'wa-ortho': 'https://geoservices.wallonie.be/arcgis/rest/services/IMAGERIE/ORTHO_LAST/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image',
  'fr-ortho': 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  'nrw-ortho': 'https://www.wms.nrw.de/geobasis/wms_nw_dop?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=nw_dop_rgb&STYLES=&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE',
  'lu-ortho': 'https://wmts1.geoportail.lu/opendata/wmts/ortho_latest/GLOBAL_WEBMERCATOR_4_V3/{z}/{x}/{y}.jpeg',
  'ch-ortho': 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
  'at-ortho': 'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg',
  'es-ortho': 'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}',
  s2: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  // Straten en plaatsnamen over de luchtfoto (vectortegels).
  ofm: 'https://tiles.openfreemap.org/planet',
};

// Naam en een punt (lengte, breedte) binnen het gebied van elke bron, voor de controle.
export const BRON_INFO = {
  'vl-ortho': { naam: 'Luchtfoto Vlaanderen', punt: [3.7250, 51.0540] },
  'vl-grb': { naam: 'GRB-basiskaart Vlaanderen (lijntekening)', punt: [3.7250, 51.0540] },
  'nl-ortho': { naam: 'Luchtfoto Nederland (PDOK)', punt: [5.1214, 52.0907] },
  'wa-ortho': { naam: 'Luchtfoto Wallonië (SPW)', punt: [4.8670, 50.4650] },
  'fr-ortho': { naam: 'Luchtfoto Frankrijk (IGN)', punt: [2.3522, 48.8566] },
  'nrw-ortho': { naam: 'Luchtfoto Noordrijn-Westfalen', punt: [6.9603, 50.9375] },
  'lu-ortho': { naam: 'Luchtfoto Luxemburg', punt: [6.1296, 49.6116] },
  'ch-ortho': { naam: 'Luchtfoto Zwitserland (swisstopo)', punt: [7.4474, 46.9480] },
  'at-ortho': { naam: 'Luchtfoto Oostenrijk (basemap.at)', punt: [16.3738, 48.2082] },
  'es-ortho': { naam: 'Luchtfoto Spanje (PNOA)', punt: [-3.7038, 40.4168] },
  s2: { naam: 'Satellietbeeld wereld (Sentinel-2, EOX)', punt: [4.3517, 50.8503], zoom: 10 },
  osm: { naam: 'Stratenkaart (OpenStreetMap)', punt: [4.3517, 50.8503] },
  ofm: { naam: 'Straten en namen over de luchtfoto (OpenFreeMap)', soort: 'json' },
};

// Diensten die geen kaartlaag zijn maar waar functies op steunen.
export const DIENSTEN = {
  zoeken: { naam: 'Adres zoeken (Nominatim)', adres: 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=nl&q=Grote%20Markt%20Brussel' },
  route: { naam: 'Route langs de weg (OSRM)', adres: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/4.3517,50.8503;4.4025,51.2194?overview=false' },
};
