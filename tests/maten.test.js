import { describe, it, expect } from 'vitest';
import * as geo from '../components/maps/geo';
import { maten, matenTekst } from '../components/maps/stijl';

const M = [4.4, 51.2];
const lijn = (meter) => ({ type: 'LineString', coordinates: [M, geo.verschuif({ type: 'Point', coordinates: M }, meter, 0).coordinates] });
const hek = { tekenwijze: 'lijn', eenheid_m: 2.5, eigenschappen: {} };

describe('maten: wat er besteld wordt', () => {
  it('25 m dranghek van 2,5 m is 10 stuks', () => {
    const m = maten({ soort: 'lijn', geometrie: lijn(25) }, hek);
    expect(m.stuks).toBe(10);
    expect(m.lengte).toBeCloseTo(25, 1);
  });
  it('26 m dranghek rondt naar boven af: 11 stuks', () => {
    expect(maten({ soort: 'lijn', geometrie: lijn(26) }, hek).stuks).toBe(11);
  });
  it('Een dubbele rij telt dubbel', () => {
    expect(maten({ soort: 'lijn', geometrie: lijn(25), stijl: { dubbel: 1 } }, hek).stuks).toBe(20);
  });
  it('Een vlak met een dichtheid geeft een capaciteit', () => {
    const m = maten({ soort: 'vlak', geometrie: geo.elementVeelhoek(M, 20, 10, 0), velden: { dichtheid: 2 } }, null);
    expect(m.capaciteit).toBeGreaterThanOrEqual(398); expect(m.capaciteit).toBeLessThanOrEqual(400);
  });
  it('Een tent toont breedte × diepte', () => {
    const it0 = { soort: 'element', geometrie: geo.elementVeelhoek(M, 10, 25, 0), parameters: { midden: M, breedte: 10, diepte: 25, rot: 0 } };
    expect(matenTekst(maten(it0, { tekenwijze: 'vorm', eigenschappen: {} }))).toContain('10 × 25 m');
  });
  it('De tekst van een hek toont lengte en stuks', () => {
    expect(matenTekst(maten({ soort: 'lijn', geometrie: lijn(25) }, hek))).toBe('25 m · 10 st.');
  });
});
