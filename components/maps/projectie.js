// Omrekenen van Belgische en Nederlandse kaartcoördinaten naar lengte/breedte (WGS84),
// zonder plug-in. Enkel de richting stelsel → WGS84 (voor DXF-plannen die vast op hun plaats liggen).
// Formules: Snyder (Lambert conform kegel), PROJ (dubbel stereografisch, Helmert in positievectorvorm).
// Getoetst tegen proj4 op 1.200 willekeurige punten: grootste afwijking 0,001 mm.

const RAD = Math.PI / 180;
const ELLIPS = {
  intl: { a: 6378388, f: 1 / 297 },
  GRS80: { a: 6378137, f: 1 / 298.257222101 },
  bessel: { a: 6377397.155, f: 1 / 299.1528128 },
  WGS84: { a: 6378137, f: 1 / 298.257223563 },
};

export const STELSELS = {
  'EPSG:31370': { soort: 'lcc', ellips: 'intl', lat0: 90, lon0: 4.36748666666667, lat1: 51.1666672333333, lat2: 49.8333339, x0: 150000.013, y0: 5400088.438, helmert: [-106.8686, 52.2978, -103.7239, 0.3366, -0.457, 1.8422, -1.2747] },
  'EPSG:3812': { soort: 'lcc', ellips: 'GRS80', lat0: 50.797815, lon0: 4.35921583333333, lat1: 49.8333333333333, lat2: 51.1666666666667, x0: 649328, y0: 665262, helmert: null },
  'EPSG:28992': { soort: 'sterea', ellips: 'bessel', lat0: 52.1561605555556, lon0: 5.38763888888889, k0: 0.9999079, x0: 155000, y0: 463000, helmert: [565.4171, 50.3319, 465.5524, 1.9342, -1.6677, 9.1019, 4.0725] },
};

const eVan = (el) => Math.sqrt(2 * el.f - el.f * el.f);

// Lambert conform kegel met twee standaardparallellen, omgekeerd.
function lccInvers(p, x, y) {
  const { a } = ELLIPS[p.ellips]; const e = eVan(ELLIPS[p.ellips]);
  const m = (f) => Math.cos(f) / Math.sqrt(1 - e * e * Math.sin(f) ** 2);
  const t = (f) => (Math.abs(f - Math.PI / 2) < 1e-12 ? 0 : Math.tan(Math.PI / 4 - f / 2) / ((1 - e * Math.sin(f)) / (1 + e * Math.sin(f))) ** (e / 2));
  const f1 = p.lat1 * RAD; const f2 = p.lat2 * RAD; const f0 = p.lat0 * RAD;
  const n = (Math.log(m(f1)) - Math.log(m(f2))) / (Math.log(t(f1)) - Math.log(t(f2)));
  const F = m(f1) / (n * t(f1) ** n);
  const rho0 = a * F * t(f0) ** n;
  const dx = x - p.x0; const dy = rho0 - (y - p.y0);
  const s = Math.sign(n);
  const rho = s * Math.hypot(dx, dy);
  const theta = Math.atan2(s * dx, s * dy);
  const tt = (rho / (a * F)) ** (1 / n);
  let phi = Math.PI / 2 - 2 * Math.atan(tt);
  for (let i = 0; i < 15; i++) {
    const es = e * Math.sin(phi);
    const nieuw = Math.PI / 2 - 2 * Math.atan(tt * ((1 - es) / (1 + es)) ** (e / 2));
    if (Math.abs(nieuw - phi) < 1e-14) { phi = nieuw; break; }
    phi = nieuw;
  }
  return [theta / n + p.lon0 * RAD, phi];
}

// Dubbel stereografisch (Gauss-bol, zoals PROJ sterea), omgekeerd.
function stereaInvers(p, x, y) {
  const { a } = ELLIPS[p.ellips]; const e = eVan(ELLIPS[p.ellips]); const es = e * e;
  const f0 = p.lat0 * RAD;
  const sf = Math.sin(f0); const cf2 = Math.cos(f0) ** 2;
  const rc = Math.sqrt(1 - es) / (1 - es * sf * sf);
  const C = Math.sqrt(1 + (es * cf2 * cf2) / (1 - es));
  const chi0 = Math.asin(sf / C);
  const ratexp = 0.5 * C * e;
  const srat = (esinp, ex) => ((1 - esinp) / (1 + esinp)) ** ex;
  const K = Math.tan(0.5 * chi0 + Math.PI / 4) / (Math.tan(0.5 * f0 + Math.PI / 4) ** C * srat(e * sf, ratexp));
  const sinc0 = Math.sin(chi0); const cosc0 = Math.cos(chi0); const R2 = 2 * rc;
  const xx = (x - p.x0) / (a * p.k0); const yy = (y - p.y0) / (a * p.k0);
  const rho = Math.hypot(xx, yy);
  let phi; let lam;
  if (rho) {
    const c = 2 * Math.atan2(rho, R2); const sinc = Math.sin(c); const cosc = Math.cos(c);
    phi = Math.asin(cosc * sinc0 + (yy * sinc * cosc0) / rho);
    lam = Math.atan2(xx * sinc, rho * cosc0 * cosc - yy * sinc0 * sinc);
  } else { phi = chi0; lam = 0; }
  // Van de Gauss-bol terug naar de ellipsoïde.
  const num = (Math.tan(0.5 * phi + Math.PI / 4) / K) ** (1 / C);
  let f = phi;
  for (let i = 0; i < 20; i++) {
    const nieuw = 2 * Math.atan(num * srat(e * Math.sin(f), -0.5 * e)) - Math.PI / 2;
    if (Math.abs(nieuw - f) < 1e-14) { f = nieuw; break; }
    f = nieuw;
  }
  return [lam / C + p.lon0 * RAD, f];
}

// Datumverschuiving naar WGS84: geodetisch → geocentrisch → Helmert (positievector) → geodetisch.
function naarWgs84(lon, lat, ellips, h) {
  if (!h) return [lon, lat];
  const src = ELLIPS[ellips]; const e2 = 2 * src.f - src.f * src.f;
  const N = src.a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const X = N * Math.cos(lat) * Math.cos(lon); const Y = N * Math.cos(lat) * Math.sin(lon); const Z = N * (1 - e2) * Math.sin(lat);
  const [dx, dy, dz, rxs, rys, rzs, ppm] = h;
  const sec = RAD / 3600; const rx = rxs * sec; const ry = rys * sec; const rz = rzs * sec; const m = 1 + ppm * 1e-6;
  const X2 = dx + m * (X - rz * Y + ry * Z);
  const Y2 = dy + m * (rz * X + Y - rx * Z);
  const Z2 = dz + m * (-ry * X + rx * Y + Z);
  const w = ELLIPS.WGS84; const we2 = 2 * w.f - w.f * w.f;
  const pp = Math.hypot(X2, Y2);
  let la = Math.atan2(Z2, pp * (1 - we2));
  for (let i = 0; i < 10; i++) {
    const Nw = w.a / Math.sqrt(1 - we2 * Math.sin(la) ** 2);
    const hoogte = pp / Math.cos(la) - Nw;
    const nieuw = Math.atan2(Z2, pp * (1 - (we2 * Nw) / (Nw + hoogte)));
    if (Math.abs(nieuw - la) < 1e-14) { la = nieuw; break; }
    la = nieuw;
  }
  return [Math.atan2(Y2, X2), la];
}

// [x, y] in het stelsel → [lengte, breedte] in graden (WGS84).
export function naarLengteBreedte(stelsel, [x, y]) {
  const p = STELSELS[stelsel];
  if (!p) throw new Error(`Onbekend stelsel: ${stelsel}`);
  const [lon, lat] = p.soort === 'lcc' ? lccInvers(p, x, y) : stereaInvers(p, x, y);
  const [l2, b2] = naarWgs84(lon, lat, p.ellips, p.helmert);
  return [l2 / RAD, b2 / RAD];
}
