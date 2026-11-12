import { describe, it, expect } from 'vitest';
import { kabelStukken, kabelBestelling, kabelVoor, standaardUitgangen, isKastNaam } from '../components/maps/stroom';

const totaal = (s) => Object.entries(s).reduce((t, [l, n]) => t + Number(l) * n, 0);
const stuks = (s) => Object.values(s).reduce((t, n) => t + n, 0);

describe('stroom: kabels en kasten', () => {
  it('63 m uit stukken van 5, 10, 25 en 50 m: één van 50 en één van 25', () => {
    expect(kabelStukken(63, [5, 10, 25, 50])).toEqual({ 50: 1, 25: 1 });
  });
  it('De stukken zijn samen altijd lang genoeg, met zo weinig mogelijk stukken', () => {
    for (const L of [1, 4.9, 5, 12, 26, 49, 51, 99, 100, 137, 260, 512]) {
      const s = kabelStukken(L, [5, 10, 25, 50]);
      expect(totaal(s)).toBeGreaterThanOrEqual(L);
      expect(stuks(s)).toBeLessThanOrEqual(Math.ceil(L / 50) + 1);
    }
  });
  it('Zonder lengte of zonder stukken: niets', () => {
    expect(kabelStukken(0, [5, 10])).toEqual({});
    expect(kabelStukken(20, [])).toEqual({});
  });
  it('Een onbekend kabeltype gaat per 25 m', () => {
    const b = kabelBestelling(30, 'Onbekend');
    expect(b.meter).toBe(50); expect(b.standaard).toBe(false);
  });
  it('De kabel volgt de stroomsterkte', () => {
    expect(kabelVoor(16)).toBe('5G2,5 (16A)');
    expect(kabelVoor(32)).toBe('5G6 (32A)');
    expect(kabelVoor(63)).toBe('5G16 (63A)');
    expect(kabelVoor(125)).toBe('5G35 (125A)');
    expect(kabelVoor(16, null, 'L1')).toBe('3G2,5 (16A)');
    expect(kabelVoor(0)).toBe(null);
  });
  it('Een grotere stroomgroep heeft grotere uitgangen', () => {
    expect(standaardUitgangen(20)[0].type).toBe('CEE 32A 3F');
    expect(standaardUitgangen(45)[0].type).toBe('CEE 63A');
    expect(standaardUitgangen(150)[0].type).toBe('Powerlock');
    expect(standaardUitgangen(0)).toBe(null);
  });
  it('Een verdeelkast is een kast, een koelkast niet', () => {
    expect(isKastNaam('Verdeelkast 63 A')).toBe(true);
    expect(isKastNaam('Koelkast')).toBe(false);
  });
});
