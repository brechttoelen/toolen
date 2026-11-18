import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
vi.mock('../components/maps/db', () => ({ maps: () => ({ from: () => ({ select: () => ({ order: async () => ({ data: [] }), in: async () => ({ data: [] }), eq: async () => ({ data: [] }) }) }) }), sb: () => ({}), foutTekst: (e) => String(e), wieBenIk: async () => null, magSchrijven: () => true, publiekeUrl: (x) => x, BUCKET: 'maps' }));
vi.mock('../components/maps/leveranciers', () => ({ useLeveranciers: () => [{ id: 'd', naam: 'Manutan' }], juisteNaam: (n) => n, zorgLeverancier: async () => {}, leveranciersVoor: () => [], laadLeveranciers: async () => [] }));
import BinnenScherm from '../components/maps/BinnenScherm';

const host = { id: 'h1', naam: 'Thermae Palace', plan_id: 'p1', soort: 'element', geometrie: { type: 'Point', coordinates: [2.9, 51.2] }, parameters: {}, velden: { binnenplan: { verdiepingen: [{ id: 'g', naam: 'Gelijkvloers' }] } } };
const zaal = { id: 'r1', plan_id: 'p1', soort: 'vlak', naam: 'Elisabeth', geometrie: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, velden: { ruimte: true, binnen: { host: 'h1', verd: 'g', lokaal: { geometrie: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]] } } } } };
const props = (schrijven) => ({ host, verdiepingen: host.velden.binnenplan.verdiepingen, verd: 'g', onVerd: () => {}, onderlegger: null, items: [host, zaal], elementen: [], elementenMap: new Map(), schrijven, onMaak: () => {}, onWijzig: () => {}, onVerwijder: () => {}, onGrondplan: () => {}, onPassen: () => {}, onOnderlegger: () => {}, onSluit: () => {} });

describe('binnenscherm', () => {
  it('bewerken: zijbalk met panelen en gereedschap, geen zwevende knoppenrij', () => {
    const html = renderToString(<BinnenScherm {...props(true)} />).replace(/<!-- -->/g, '');
    expect(html).toContain('fm-gereedschap fm-bs-rail');
    expect(html).toContain('Van het huis');
    expect(html).toContain('Bibliotheek');
    expect(html).toContain('Elisabeth');
    expect(html).not.toContain('fm-bs-zweef links');
    expect(html).not.toContain('fm-bs-tabs');
  });
  it('bewerken: tafel van het huis geselecteerd toont blokken, leverancier en Rij maken', () => {
    const el = { id: 'e1', naam: 'Smalle registratietafel', categorie: 'Huismateriaal', tekenwijze: 'schaal', breedte_m: 1.4, diepte_m: 0.45, eigenschappen: { huis: { locatie: 'thermae-palace', aantal: 140 } } };
    const kast = { id: 'e2', naam: 'Dossierkast', categorie: 'Binnenruimte', tekenwijze: 'schaal', breedte_m: 0.9, diepte_m: 0.4, leverancier: 'Manutan', eigenschappen: {} };
    const lok = (x) => ({ geometrie: { type: 'Polygon', coordinates: [[[x, 1], [x + 1.4, 1], [x + 1.4, 1.45], [x, 1.45], [x, 1]]] }, midden: [x + 0.7, 1.225], rot: 0 });
    const tafel = { id: 't1', plan_id: 'p1', soort: 'element', element_id: 'e1', geometrie: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, parameters: {}, velden: { meubel: { type: 'tafel', vorm: 'rechthoek', b: 1.4, d: 0.45, stoelen: { boven: 2 } }, binnen: { host: 'h1', verd: 'g', lokaal: lok(2) } } };
    const k = { id: 'k1', plan_id: 'p1', soort: 'element', element_id: 'e2', geometrie: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, parameters: {}, velden: { binnen: { host: 'h1', verd: 'g', lokaal: lok(5) } } };
    const p = { ...props(true), items: [host, zaal, tafel, k], elementen: [el, kast], elementenMap: new Map([['e1', el], ['e2', kast]]) };
    const html = renderToString(<BinnenScherm {...p} beginSel={['t1']} />).replace(/<!-- -->/g, '');
    expect(html).toContain('fm-bs-eig');
    expect(html).toContain('Rij maken');
    expect(html).toContain('fm-bs-huislabel');
    expect(html).toContain('Geleverd door');
    const html2 = renderToString(<BinnenScherm {...p} beginSel={['k1']} />).replace(/<!-- -->/g, '');
    expect(html2).toContain('Leverancier');
    expect(html2).toContain('placeholder="Manutan"');
  });
  it('vergrendeld item: knop toont slot en Wissen staat uit', () => {
    const el = { id: 'e2', naam: 'Dossierkast', categorie: 'Binnenruimte', tekenwijze: 'schaal', breedte_m: 0.9, diepte_m: 0.4, eigenschappen: {} };
    const k = { id: 'k1', plan_id: 'p1', soort: 'element', element_id: 'e2', vergrendeld: true, geometrie: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, parameters: {}, velden: { binnen: { host: 'h1', verd: 'g', lokaal: { geometrie: { type: 'Polygon', coordinates: [[[5, 1], [5.9, 1], [5.9, 1.4], [5, 1.4], [5, 1]]] }, midden: [5.45, 1.2], rot: 0 } } } };
    const p = { ...props(true), items: [host, zaal, k], elementen: [el], elementenMap: new Map([['e2', el]]) };
    const html = renderToString(<BinnenScherm {...p} beginSel={['k1']} />).replace(/<!-- -->/g, '');
    expect(html).toContain('Vergrendeld');
    expect(html).toMatch(/disabled=""[^>]*>.*?Wissen/);
  });
  it('lezen: zelfde weergave als voorheen, zonder zijbalk', () => {
    const html = renderToString(<BinnenScherm {...props(false)} />).replace(/<!-- -->/g, '');
    expect(html).not.toContain('fm-bs-rail');
    expect(html).toContain('Elisabeth');
  });
});
