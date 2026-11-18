import { describe, it, expect } from 'vitest';
import { bestelRijen, samenvatting, stand, materiaalVan } from '../components/fiche/bestelling';

const punt = { type: 'Point', coordinates: [3, 51] };
function fiche(regels = [], vast = false, leveringen = []) {
  const plaat = (id, laag) => ({ id, naam: 'Plaat', element_id: 'plaat', laag_id: laag, velden: { herkomst: 'Ebema' }, geometrie: punt, parameters: {} });
  return {
    plan: { id: 'p', organisatie_id: 'o', wedstrijd_van: '2027-01-31', wedstrijd_tot: '2027-01-31', instellingen: {} },
    items: [plaat('a', 'L1'), plaat('b', 'L1'), plaat('c', 'L1'), plaat('d', 'L2'), { id: 'h', naam: 'Hek', element_id: 'hek', laag_id: 'L1', velden: { herkomst: 'D&D' }, geometrie: punt, parameters: {} }],
    lagen: [{ id: 'L1', naam: 'Aankomstzone' }, { id: 'L2', naam: "Extra's" }],
    elementen: [{ id: 'plaat', naam: 'Betonplaat', categorie: 'Grondbescherming', tekenwijze: 'schaal' }, { id: 'hek', naam: 'Bouwhek', categorie: 'Hekken', tekenwijze: 'schaal' }],
    d: { leveranciers: [{ id: 'ebema', naam: 'Ebema' }, { id: 'dd', naam: 'D&D' }], bestelregels: regels, leveringen, taken: [] },
  };
}
const sl = (vast) => ({ id: 's1', leverancier_id: 'ebema', status: 'nog_niets', vastgezet_op: vast ? '2026-11-18T10:00:00Z' : null });
const regel = (id, extra) => ({ id, site_leverancier_id: 's1', wat: 'Betonplaat', kaart_naam: 'Betonplaat', eenheid: 'st', aantal: null, volgorde: 0, created_at: id, ...extra });

describe('bestelling tegenover de kaart', () => {
  it('telt per leverancier', () => {
    expect(materiaalVan(fiche(), 'ebema').find((m) => m.naam === 'Betonplaat').aantal).toBe(4);
  });
  it('koppelt via het element, niet via de naam', () => {
    const f = fiche([regel('r1', { aantal: 4, kaart_sleutel: 'plaat|', kaart_naam: 'Oude naam' })], true);
    expect(materiaalVan(f, 'ebema')[0].sleutel).toBe('plaat|');
    const b = bestelRijen(f, sl(true));
    expect(b.rijen[0]).toMatchObject({ geplaatst: 4, weg: false, kaartNaam: 'Betonplaat' });
    expect(b.nietBesteld).toEqual([]);
  });
  it('toont de namen van de items bij de regel', () => {
    const f = fiche(); f.items[0].naam = 'CAM 2'; f.items[1].naam = 'CAM 1'; f.items[2].naam = 'Betonplaat';
    expect(bestelRijen(f, sl(false)).rijen[0].namen).toEqual(['CAM 1', 'CAM 2', 'Plaat']);
  });
  it('loopt mee: materiaal van de kaart staat er vanzelf, zonder verschil', () => {
    const b = bestelRijen(fiche(), sl(false));
    expect(b.rijen).toHaveLength(1);
    expect(b.rijen[0]).toMatchObject({ virtueel: true, besteld: 4, geplaatst: 4 });
    expect(stand(b.rijen[0])).toBe('klaar');
  });
  it('vastgezet: verschil tussen besteld en geplaatst', () => {
    const b = bestelRijen(fiche([regel('r1', { aantal: 6 })], true), sl(true));
    expect(b.rijen[0]).toMatchObject({ besteld: 6, geplaatst: 4 });
    expect(stand(b.rijen[0])).toBe('weinig');
    expect(stand(bestelRijen(fiche([regel('r1', { aantal: 3 })], true), sl(true)).rijen[0])).toBe('veel');
  });
  it('een regel met een laag telt enkel die laag, de regel zonder laag de rest', () => {
    const b = bestelRijen(fiche([regel('r1', { aantal: 3, locatie_laag_id: 'L1' }), regel('r2', { aantal: 2 })], true), sl(true));
    expect(b.rijen.map((x) => x.geplaatst)).toEqual([3, 1]);
  });
  it('twee regels zonder laag verdelen de telling in volgorde', () => {
    const b = bestelRijen(fiche([regel('r1', { aantal: 3 }), regel('r2', { aantal: 3, volgorde: 1 })], true), sl(true));
    expect(b.rijen.map((x) => x.geplaatst)).toEqual([3, 1]);
  });
  it('vrije regel: niet getekend, en vastgezet materiaal zonder regel wordt gemeld', () => {
    const b = bestelRijen(fiche([{ id: 'v', site_leverancier_id: 's1', wat: 'Toiletrollen', kaart_naam: null, eenheid: 'st', aantal: 200 }], true), sl(true));
    expect(b.rijen[0]).toMatchObject({ vrij: true, besteld: 200, geplaatst: null });
    expect(stand(b.rijen[0])).toBe(null);
    expect(b.nietBesteld.map((m) => m.naam)).toEqual(['Betonplaat']);
  });
  it('samenvatting: cijfers, punten en periode', () => {
    const lv = [{ id: 'l1', site_leverancier_id: 's1', soort: 'levering', anker: 'start', dag: -8, uur_van: '08:00:00' }, { id: 'l2', site_leverancier_id: 's1', soort: 'ophaling', anker: 'einde', dag: 2 }];
    const s = samenvatting(fiche([regel('r1', { aantal: 6, levering_id: 'l1' })], true, lv), sl(true));
    expect(s).toMatchObject({ regels: 1, besteld: 6, geplaatst: 4 });
    expect(s.punten.map((p) => p.t)).toEqual(['nog 2 te plaatsen', '1 regel zonder ophaling']);
    expect(s.eerste.id).toBe('l1'); expect(s.laatste.id).toBe('l2');
    expect(samenvatting(fiche(), sl(false)).punten).toEqual([]);
  });
});
