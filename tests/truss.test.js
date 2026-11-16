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

import * as R from '../components/maps/trussraster';
const nazicht = (r) => { const st = R.rasterStukken(r).map((x, i) => ({ ...x, i })); return { st, fout: T.trussAnalyse(st).meldingen.filter((m) => m.soort === 'fout'), tel: T.trussTelling(st) }; };
describe('trussbouwer met lijnen', () => {
  it('De vormen kloppen: stukken, blokken en baseplates', () => {
    const p = nazicht(R.vormPortaal(8, 4)); expect(p.fout).toHaveLength(0); expect(p.tel.stukken['4']).toBe(4); expect(p.tel.hoek).toBe(2); expect(p.tel.voet).toBe(2);
    const k = nazicht(R.vormKubus(3, 3, 3)); expect(k.fout).toHaveLength(0); expect(k.tel.hoek).toBe(8); expect(k.tel.voet).toBe(4);
    expect(nazicht(R.vormWand(3, 4, 2.5, true)).fout).toHaveLength(0);
  });
  it('Een onderligger op 3 m zet in beide poten een blok en verdwijnt weer netjes', () => {
    const s = R.asTussen(R.vormPortaal(8, 4), 'z', 0, 3); const Q = R.voegLijn(s.R, 'x', [0, 0, 1], 1);
    const n = nazicht(Q); expect(n.fout).toHaveLength(0); expect(n.tel.hoek).toBe(4); expect(Q.z).toEqual([3, 1]);
    const d = R.rasterDoeken(Q, [{ id: 'd', vak: { as: 'x', vast: 0, i0: 0, i1: 1, k: 2 }, wijze: 'in' }]);
    expect(d[0].z1 - d[0].z0).toBeCloseTo(1, 2); expect(d[0].s1 - d[0].s0).toBeCloseTo(8, 2);
    const w = R.haalWeg(Q, ['x,0,0,1'], d); expect(w.R.z).toEqual([4]); expect(w.doeken[0].vak.k).toBe(1);
  });
  it('Een poot ervoor bijtekenen verschuift de rest niet', () => {
    const v = R.asBuiten(R.vormPortaal(8, 4), 'x', 'voor', 2); let V = R.voegLijn(v.R, 'x', [1, 0, 1], 0); V = R.voegLijn(V, 'z', [0, 0, 1], 0);
    expect(V.o[0]).toBeCloseTo(-2.29, 2); expect(nazicht(V).fout).toHaveLength(0); expect(nazicht(V).tel.voet).toBe(3);
  });
  it('Een portaal uit de oude bouwer wordt hetzelfde portaal in lijnen', () => {
    const oud = T.portaal(4, 3).map((s) => ({ L: s.L, p: [s.a[0], s.a[1]], z: s.a[2], r: 0, op: s.op }));
    const r = R.ruimOp(R.rasterUitOud(oud).R).R; expect(r.x).toEqual([4]); expect(r.z).toEqual([3]); expect(r.lijnen).toHaveLength(3);
  });
});
