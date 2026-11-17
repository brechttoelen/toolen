import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
vi.mock('../components/maps/db', () => ({ maps: () => ({}), sb: () => ({}), foutTekst: (e) => String(e), wieBenIk: async () => null, magSchrijven: () => true, publiekeUrl: (x) => x }));
vi.mock('../components/maps/leveranciers', () => ({ useLeveranciers: () => [{ id: 'd', naam: 'D&D' }], juisteNaam: (n) => n, zorgLeverancier: async () => {}, leveranciersVoor: () => [] }));
import MateriaalScherm from '../components/maps/MateriaalScherm';

describe('materiaalscherm', () => {
  it('rendert met selectievakjes per regel', () => {
    const el = { id: 'h', naam: 'Bouwhek 3,5 m', categorie: 'Hekken en afsluitingen', tekenwijze: 'schaal' };
    const items = [{ id: 'i1', element_id: 'h', laag_id: 'l', velden: {}, geometrie: { type: 'Point', coordinates: [3, 51] }, parameters: {} }];
    const html = renderToString(<MateriaalScherm plan={{ naam: 'Test', instellingen: { leveranciers: { 'Hekken en afsluitingen': 'D&D' } } }} items={items} elementenMap={new Map([['h', el]])} lagenMap={new Map([['l', { id: 'l', naam: 'Laag' }]])} fasen={[]} actieveFase={null} schrijven onWijzigItems={() => {}} onStd={() => {}} onToon={() => {}} onSluit={() => {}} />);
    expect(html).toContain('Bouwhek 3,5 m');
    expect(html).toContain('type="checkbox"');
  });
});
