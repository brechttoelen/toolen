// Rennersbrug in stellingbouw (Gigant / Layher), zoals op de plannen van de stellingbouwer:
// aanloop – helling – doorgang – helling – aanloop. Vakken van 2,07 m in de lengte.
// Breedte 5,18 m = 2,07 + 1,04 + 2,07 (of 4,14 m = 2,07 + 2,07).
//   Helling: in de buitenste banen liggen de elementen dwars (1,04 m in de lengte),
//            in de middenbaan van 1,04 m in de lengte (2,07 m).
//   Doorgang: overal elementen van 2,07 m in de lengte, 1,04 m naast elkaar.
// De hellingshoek volgt uit de hoogte van de doorgang en de lengte van de helling.

export const VAK = 2.072;
export const HALF = 1.036;
export const AANLOOP = 1.76; // op de grond, aan elk uiteinde
const DEK = 0.15; // vloerdikte boven de vrije hoogte

export const BREEDTES = { '5.18': [VAK, HALF, VAK], '4.14': [VAK, VAK] };

export function brugCfg(p = {}) {
  const b = p.brug || {};
  return {
    doorgang: Math.max(1, Math.min(8, Math.round(Number(b.doorgang) || 3))),
    helling: Math.max(2, Math.min(12, Math.round(Number(b.helling) || 6))),
    breedte: BREEDTES[b.breedte] ? b.breedte : '5.18',
    hoogte: Math.max(1.5, Math.min(6, Number(b.hoogte) || 2.81)),
  };
}

export function brugMaten(cfg) {
  const banen = BREEDTES[cfg.breedte];
  const W = banen.reduce((a, b) => a + b, 0);
  const Lh = cfg.helling * VAK;
  const L = 2 * AANLOOP + 2 * Lh + cfg.doorgang * VAK;
  const stijg = cfg.hoogte + DEK;
  const graden = (Math.atan(stijg / Lh) * 180) / Math.PI;
  return { banen, W, Lh, L, breedte: L, diepte: W + 0.3, stijg, graden, procent: (stijg / Lh) * 100 };
}

// Aantallen voor de stuklijst.
export function brugStukken(cfg) {
  const { banen } = brugMaten(cfg);
  const perVakHelling = banen.reduce((n, b) => n + (b > 1.5 ? 2 : 1), 0); // dwarse elementen: 2 per baan van 2,07
  const perVakVloer = Math.round(banen.reduce((a, b) => a + b, 0) / HALF);
  return { vloer: cfg.doorgang * perVakVloer, helling: 2 * cfg.helling * perVakHelling, staanders: 2 * (2 * cfg.helling + cfg.doorgang + 1) };
}

// Tekening in meter, midden = (0, 0), lengte langs x.
export function rennersbrugTekening(p = {}) {
  const cfg = brugCfg(p);
  const m = brugMaten(cfg);
  const { banen, W, Lh, L } = m;
  const vlakken = []; const lijnen = []; const teksten = [];
  const rect = (x0, y0, x1, y1, vul, lijn = '#6B4423', d = 0.025) => vlakken.push({ r: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]], vul, lijn, d });
  const lijn = (a, b, k = '#6B4423', d = 0.02) => lijnen.push({ c: [a, b], k, d });
  const y0 = -W / 2; const y1 = W / 2;
  const xs = -L / 2;
  const xH1 = xs + AANLOOP; const xD0 = xH1 + Lh; const xD1 = xD0 + cfg.doorgang * VAK; const xH2 = xD1 + Lh;
  // Aanloopstukken op de grond
  rect(xs, y0, xH1, y1, '#CBB08A');
  rect(xH2, y0, L / 2, y1, '#CBB08A');
  lijn([xs + AANLOOP / 2, y0], [xs + AANLOOP / 2, y1], '#8A6A45', 0.015);
  lijn([xH2 + AANLOOP / 2, y0], [xH2 + AANLOOP / 2, y1], '#8A6A45', 0.015);
  // Hellingen (licht) en doorgang (donker)
  rect(xH1, y0, xD0, y1, '#C08A55');
  rect(xD1, y0, xH2, y1, '#C08A55');
  rect(xD0, y0, xD1, y1, '#9A6A3A', '#3F2A14', 0.05);
  // Banen
  const grenzen = [y0]; for (const b of banen) grenzen.push(grenzen[grenzen.length - 1] + b);
  for (const g of grenzen.slice(1, -1)) { lijn([xH1, g], [xD0, g]); lijn([xD1, g], [xH2, g]); }
  // Doorgang: elementen van 2,07 in de lengte, om de 1,04 naast elkaar
  for (let y = y0 + HALF; y < y1 - 0.01; y += HALF) lijn([xD0, y], [xD1, y]);
  for (let i = 1; i < cfg.doorgang; i++) lijn([xD0 + i * VAK, y0], [xD0 + i * VAK, y1], '#3F2A14', 0.03);
  // Hellingen: vaklijnen om de 2,07; in de brede banen dwarse elementen (lijn om de 1,04)
  for (const [a, richting] of [[xH1, 1], [xD1, -1]]) {
    for (let i = 0; i <= cfg.helling; i++) lijn([a + i * VAK, y0], [a + i * VAK, y1], '#5B3A1A', 0.03);
    banen.forEach((b, k) => {
      if (b < 1.5) return;
      for (let i = 0; i < cfg.helling; i++) lijn([a + i * VAK + HALF, grenzen[k]], [a + i * VAK + HALF, grenzen[k + 1]], '#A9743F', 0.015);
    });
    // Overgangsplaat bovenaan de helling
    const xb = richting === 1 ? xD0 - VAK * 0.62 : xD1 + VAK * 0.38;
    vlakken.push({ r: [[[xb, y0 + 0.05], [xb + 0.48, y0 + 0.05], [xb + 0.48, y1 - 0.05], [xb, y1 - 0.05], [xb, y0 + 0.05]]], vul: '#93C5FD', lijn: '#3B82F6', d: 0.01 });
    // Pijlen in de rijrichting
    for (const yc of [y0 + banen[0] / 2, y1 - banen[banen.length - 1] / 2]) {
      const xm = richting === 1 ? (xH1 + xD0) / 2 : (xD1 + xH2) / 2;
      // Rijrichting: de renners rijden de brug op en weer af, dus beide pijlen dezelfde kant uit.
      const p0 = xm - 1.2; const p1 = xm + 1.2;
      lijnen.push({ c: [[p0, yc], [p1, yc]], k: '#ffffff', d: 0.08 });
      lijnen.push({ c: [[p1 - 0.4, yc - 0.35], [p1, yc], [p1 - 0.4, yc + 0.35]], k: '#ffffff', d: 0.08 });
    }
  }
  // Staanders op de vaklijnen langs beide randen, koppelingen op de baangrenzen
  const staander = (x, y, z = 0.22) => rect(x - z / 2, y - z / 2, x + z / 2, y + z / 2, '#5B3A1A', '#1d1d1b', 0.01);
  for (let x = xH1 + VAK; x <= xH2 - VAK + 0.01; x += VAK) {
    staander(x, y0 - 0.06); staander(x, y1 + 0.06);
    for (const g of grenzen.slice(1, -1)) staander(x, g, 0.12);
  }
  teksten.push({ p: [(xD0 + xD1) / 2, 0], t: `doorgang ${(cfg.doorgang * VAK).toFixed(2).replace('.', ',')} m · h ${cfg.hoogte.toFixed(2).replace('.', ',')} m`, k: '#ffffff', h: 0.32 });
  teksten.push({ p: [(xH1 + xD0) / 2, 0], t: `${m.graden.toFixed(1).replace('.', ',')}° · ${Math.round(m.procent)} %`, k: '#5B3A1A', h: 0.3 });
  teksten.push({ p: [(xD1 + xH2) / 2, 0], t: `${m.graden.toFixed(1).replace('.', ',')}° · ${Math.round(m.procent)} %`, k: '#5B3A1A', h: 0.3 });
  return { b: m.breedte, h: m.diepte, vlakken, lijnen, teksten };
}
