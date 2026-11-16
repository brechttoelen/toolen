import { describe, it, expect } from 'vitest';
import * as T from '../components/maps/trussbouw';

const metI = (l) => l.map((s, i) => ({ ...s, id: s.id || `s${i}`, i, e: undefined }));
const fouten = (l) => T.trussAnalyse(metI(l)).meldingen.filter((m) => m.soort === 'fout');

describe('trussbouwer: geen onmogelijke constructies', () => {
  it('Een portaal is in orde', () => {
    expect(fouten(T.portaal(4, 3))).toHaveLength(0);
  });
  it('Een blok in één poot zet ook een blok in de andere: beide blijven op de vloer', () => {
    const P = metI(T.portaal(4, 3)); const r = T.splitsTruss(P, P[0], 1);
    expect(r.mee).toBe(1);
    expect(fouten(r.lijst)).toHaveLength(0);
    expect(r.lijst.filter((s) => s.op && s.a[2] < 0)).toHaveLength(2);
  });
  it('Een poot langer maken tilt de andere poot niet van de vloer', () => {
    const P = metI(T.portaal(4, 3)); const r = T.rekTruss(P, P[0], 4);
    expect(fouten(r.lijst)).toHaveLength(0);
    expect(r.lijst.filter((s) => s.op).every((s) => s.L === 4)).toBe(true);
  });
  it('Een blok in een ligger van een kubus houdt de kubus gesloten', () => {
    const K = metI(T.kubus(3, 3)); const r = T.splitsTruss(K, K.find((s) => !s.op), 1.5);
    expect(r.mee).toBe(3);
    expect(fouten(r.lijst)).toHaveLength(0);
  });
  it('Een staander die de vloer niet raakt en stukken in elkaar worden gemeld', () => {
    const l = [{ L: 3, a: [0, 0, 1], r: 0, op: true }, { L: 1, a: [0, 0, 3], r: 0, op: true }];
    const f = fouten(l).map((m) => m.tekst).join(' ');
    expect(f).toMatch(/raakt de vloer niet/);
    expect(f).toMatch(/zitten in elkaar/);
  });
  it('Een recht blok zonder dwarsstuk kan weer weg', () => {
    const l = metI([{ L: 0.5, a: [0, 0, -0.145], r: 0, op: true }, { L: 2.5, a: [0, 0, 0.645], r: 0, op: true }]);
    const m = T.trussAnalyse(l).meldingen.find((x) => x.fix?.soort === 'blok');
    const r = T.sluitBlok(l, m.fix.p);
    expect(r.lijst[1].a[2]).toBeCloseTo(0.355, 3);
  });
});
