import { describe, it, expect } from 'vitest';
import * as geo from '../components/maps/geo';

const M = [4.4, 51.2]; // Antwerpen
const ongeveer = (a, b, marge) => expect(Math.abs(a - b)).toBeLessThan(marge);

describe('geo: vormen op schaal', () => {
  it('Een element van 10 × 5 m heeft die omtrek en oppervlakte', () => {
    const g = geo.elementVeelhoek(M, 10, 5, 0);
    ongeveer(geo.oppervlakte(g), 50, 0.2);
    ongeveer(geo.lengte(g), 30, 0.1);
  });
  it('Draaien verandert de maat niet', () => {
    for (const rot of [15, 45, 90, 213]) {
      const g = geo.elementVeelhoek(M, 12, 3, rot);
      ongeveer(geo.oppervlakte(g), 36, 0.2);
    }
  });
  it('Een cirkel met straal 10 m heeft ongeveer 314 m²', () => {
    ongeveer(geo.oppervlakte(geo.cirkel(M, 10)), Math.PI * 100, 4);
  });
  it('Verschuiven over 100 m oost legt 100 m af', () => {
    const lijn = { type: 'LineString', coordinates: [M, geo.verschuif({ type: 'Point', coordinates: M }, 100, 0).coordinates] };
    ongeveer(geo.lengte(lijn), 100, 0.2);
  });
  it('VerschuifGraden houdt de vorm en de maat', () => {
    const g = geo.elementVeelhoek(M, 8, 4, 30);
    const v = geo.verschuifGraden(g, 0.001, 0.0005);
    ongeveer(geo.oppervlakte(v), geo.oppervlakte(g), 0.05);
    expect(v.coordinates[0].length).toBe(g.coordinates[0].length);
  });
  it('Het middelpunt van een element is het opgegeven midden', () => {
    const c = geo.middelpunt(geo.elementVeelhoek(M, 10, 6, 40));
    ongeveer(c[0], M[0], 1e-6); ongeveer(c[1], M[1], 1e-6);
  });
  it('Het kader omvat alle vormen', () => {
    const k = geo.kader([geo.elementVeelhoek(M, 10, 10, 0), { type: 'Point', coordinates: [4.5, 51.3] }]);
    expect(k[0]).toBeLessThan(M[0]); expect(k[2]).toBeCloseTo(4.5); expect(k[3]).toBeCloseTo(51.3);
  });
  it('Punten langs een lijn van 10 m om de 2,5 m: 5 punten', () => {
    const b = geo.verschuif({ type: 'Point', coordinates: M }, 10, 0).coordinates;
    expect(geo.puntenLangs({ type: 'LineString', coordinates: [M, b] }, 2.5).length).toBe(5);
  });
  it('Getallen in Belgische notatie', () => {
    expect(geo.getal(12.34, 1)).toBe('12,3');
    expect(geo.getal(1500, 0)).toMatch(/^1.?500$/);
  });
});
