import { describe, it, expect } from 'vitest';
import { kabelStukken, kabelBestelling, kabelVoor, standaardUitgangen, isKastNaam, berekenStroom } from '../components/maps/stroom';

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

describe('stroom: twin van twee stroomgroepen', () => {
  const punt = { type: 'Point', coordinates: [4, 51] };
  const bron = (id, kva, extra = {}) => ({ id, naam: id, geometrie: punt, velden: { stroom: { rol: 'bron', kva, liter_per_uur: 10, ...extra } } });
  const last = (id, kw, voeding) => ({ id, naam: id, geometrie: punt, velden: { stroom: { rol: 'verbruiker', kw, ampere: 63, voeding } } });
  const reken = (items) => berekenStroom(items, new Map(), { gelijktijdigheid: 1 });
  it('Samen leveren: één bron met het opgetelde vermogen', () => {
    const r = reken([bron('a', 100, { twin: 'b' }), bron('b', 100), last('x', 60, 'a'), last('y', 60, 'b')]);
    expect(r.bronnen.map((b) => b.id)).toEqual(['a']);
    expect(r.bronnen[0].s.kva).toBe(200);
    expect(r.bronnen[0].kw).toBe(120);
    expect(Math.round(r.bronnen[0].procent)).toBe(75);
    expect(r.meldingen.filter((m) => /niet aangesloten/.test(m.tekst))).toEqual([]);
  });
  it('Reserve: het vermogen van één groep telt', () => {
    const r = reken([bron('a', 100, { twin: 'b', twinWijze: 'reserve' }), bron('b', 100), last('x', 60, 'a'), last('y', 60, 'b')]);
    expect(r.bronnen[0].s.kva).toBe(100);
    expect(r.bronnen[0].procent).toBeGreaterThan(100);
  });
  it('Zonder twin blijven het twee bronnen', () => {
    expect(reken([bron('a', 100), bron('b', 100)]).bronnen.length).toBe(2);
  });
});

describe('materiaal op een plek zonder tekening', () => {
  const punt = { type: 'Point', coordinates: [4, 51] };
  const els = new Map([['doos', { id: 'doos', naam: 'Stekkerdoos', categorie: 'Elektriciteit', familie: 'stroom', tekenwijze: 'punt', eigenschappen: { stekkerdoos: true, ampere: 16 } }], ['frigo', { id: 'frigo', naam: 'Frigo', categorie: 'Horeca', tekenwijze: 'schaal', eigenschappen: { kw: 0.5 } }], ['tafel', { id: 'tafel', naam: 'Tafel', categorie: 'Meubilair', tekenwijze: 'schaal', eigenschappen: {} }]]);
  it('Telt mee in de materiaallijst', async () => {
    const { berekenStuklijst } = await import('../components/maps/Stuklijst.jsx');
    const s = berekenStuklijst([{ id: 'p', soort: 'punt', naam: 'Perszaal', geometrie: punt, velden: { materiaal: [{ element_id: 'doos', aantal: 10 }, { element_id: 'tafel', aantal: 1 }] } }], els, new Map());
    expect(s.elementen.find((e) => e.naam === 'Stekkerdoos').aantal).toBe(10);
    expect(s.elementen.find((e) => e.naam === 'Tafel').aantal).toBe(1);
  });
  it('Het vermogen van het materiaal telt in de stroom en de plek wordt een verbruiker', async () => {
    const { metMateriaal } = await import('../components/maps/materiaalHier.js');
    const it0 = { id: 'p', soort: 'punt', naam: 'Perszaal', geometrie: punt, velden: {} };
    const velden = metMateriaal(it0, [{ element_id: 'doos', aantal: 10 }, { element_id: 'frigo', aantal: 4 }], els);
    expect(velden.stroom.rol).toBe('verbruiker'); expect(velden.stroom.kwMateriaal).toBe(2);
    const bron = { id: 'g', naam: 'Generator', geometrie: punt, velden: { stroom: { rol: 'bron', kva: 20 } } };
    const r = berekenStroom([bron, { ...it0, velden: { ...velden, stroom: { ...velden.stroom, voeding: 'g' } } }], els, { gelijktijdigheid: 1 });
    expect(r.bronnen[0].kw).toBe(2);
    // lijstje leeg: het vermogen verdwijnt weer
    expect(metMateriaal({ ...it0, velden }, [], els).stroom.kwMateriaal).toBeUndefined();
  });
});
