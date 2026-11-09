// Camerakraan (Eurogrip): de tekening volgt uit de specificaties in eigenschappen.kraan, zodat er geen
// handgetekende tekening per kraan nodig is. Voorkant (arm, kop, kijkhoek) naar -y = onderkant bij draaiing 0.
// kraan = { payload_kg, bereik_max, bereik_min, achter, lens_max, dolly: { l, b }, gewicht_kg, footprint_360, footprint_180, tracks }
const r3 = (x) => Math.round(x * 1000) / 1000;
const cirkel = (r, n = 40) => { const p = []; for (let i = 0; i <= n; i++) { const a = (2 * Math.PI * i) / n; p.push([r3(r * Math.cos(a)), r3(r * Math.sin(a))]); } return p; };
const rect = (x0, y0, x1, y1, vul, lijn = '#111827') => ({ d: 0.01, r: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]], vul, lijn });

export const isKraanElement = (el) => !!el?.eigenschappen?.kraan;

export function kraanMaat(k) {
  const R = Number(k?.bereik_max) || 3;
  const L = Number(k?.dolly?.l) || (R < 2.5 ? 0.9 : R < 8 ? 1.3 : 1.8);
  const B = Number(k?.dolly?.b) || (R < 2.5 ? 0.7 : R < 8 ? 0.9 : 1.4);
  return { R, L, B, A: Number(k?.achter) || 0 };
}

export function kraanTekening(k) {
  const { R, L, B, A } = kraanMaat(k);
  const arm = Math.max(0.12, Math.min(0.5, R / 30));
  return {
    b: r3(B), h: r3(L), teksten: [],
    // Zwaaibereik van de kop (groen) en van het tegengewicht (grijs).
    lijnen: [{ c: cirkel(R), d: 0.04, k: '#0F766E' }, ...(A ? [{ c: cirkel(A, 28), d: 0.03, k: '#94A3B8' }] : [])],
    vlakken: [
      { d: 0.003, r: [cirkel(R)], op: 0.05, vul: '#0F766E', lijn: '#0F766E' },
      rect(-B / 2, -L / 2, B / 2, L / 2, '#4B5563'), // dolly
      rect(-arm / 2, A, arm / 2, -R, '#9CA3AF', '#374151'), // arm
      rect(-arm * 1.4, A, arm * 1.4, A - Math.max(0.3, A * 0.35), '#1F2937'), // tegengewicht
      rect(-0.18, -R + 0.05, 0.18, -R - 0.3, '#111827'), // kop met camera
      { d: 0.003, r: [[[0, -R - 0.3], [-0.9, -R - 2.2], [0.9, -R - 2.2], [0, -R - 0.3]]], op: 0.35, vul: '#F59E0B', lijn: '#B45309' }, // kijkrichting
    ],
  };
}
