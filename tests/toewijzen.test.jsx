import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
vi.mock('../components/maps/db', () => ({ maps: () => ({}), sb: () => ({}), foutTekst: (e) => String(e), wieBenIk: async () => null, magSchrijven: () => true, publiekeUrl: (x) => x }));
vi.mock('../components/maps/dialoog', () => ({ bevestig: async () => true, vraagTekst: async () => 'x', toonTekst: async () => {}, AppDialogen: () => null }));
import Toewijzen, { zonderLeverancier } from '../components/fiche/Toewijzen';

const f = {
  plan: { id: 'p', naam: 'Test', organisatie_id: 'o', instellingen: {} },
  elementen: [{ id: 'h', naam: 'Bouwhek 3,5 m', categorie: 'Hekken en afsluitingen', tekenwijze: 'schaal' }, { id: 'n', naam: 'Nadarbord', categorie: 'Signalisatie', tekenwijze: 'schaal' }],
  lagen: [{ id: 'l', naam: 'Parcours' }],
  items: [
    { id: 'i1', naam: 'Hek start', element_id: 'h', laag_id: 'l', velden: { herkomst: 'D&D' }, geometrie: { type: 'Point', coordinates: [3, 51] }, parameters: {} },
    { id: 'i2', naam: 'Bord 1', element_id: 'n', laag_id: 'l', velden: {}, geometrie: { type: 'Point', coordinates: [3, 51] }, parameters: {} },
  ],
  d: { leveranciers: [{ id: 'd', naam: 'D&D' }] },
  schrijven: true, meld: () => {}, voegToe: async () => null, herkomstZet: async () => true,
};

describe('Leveranciers › Toewijzen', () => {
  it('toont het materiaal per categorie, met vinkjes en de leverancier', () => {
    const html = renderToString(<Toewijzen f={f} />);
    for (const t of ['Bouwhek 3,5 m', 'Nadarbord', 'Hekken en afsluitingen', 'Signalisatie', 'type="checkbox"', 'D&amp;D', 'Hele groep naar']) expect(html).toContain(t);
  });
  it('telt wat zonder leverancier is', () => {
    expect(zonderLeverancier(f)).toEqual({ regels: 1, stuks: 1 });
  });
  it('het gebouw, deuren en spullen van de locatie zijn geen materiaal; een locker in een binnenlocatie wel', () => {
    const g = { ...f, elementen: [...f.elementen, { id: 'b', naam: 'Binnenlocatie', categorie: 'Binnenruimte', eigenschappen: { binnenlocatie: true } }, { id: 'd', naam: 'Dubbele deur', categorie: 'Binnenruimte', eigenschappen: { subgroep: 'Bouwkundig' } }, { id: 'k', naam: 'Locker', categorie: 'Binnenruimte', tekenwijze: 'schaal', eigenschappen: {} }],
      items: [...f.items, { id: 'i3', element_id: 'b', velden: {}, geometrie: { type: 'Point', coordinates: [3, 51] }, parameters: {} }, { id: 'i4', element_id: 'd', velden: {}, geometrie: { type: 'Point', coordinates: [3, 51] }, parameters: {} }, { id: 'i5', element_id: 'k', velden: {}, geometrie: { type: 'Point', coordinates: [3, 51] }, parameters: {} }] };
    const html = renderToString(<Toewijzen f={g} />);
    expect(html).toContain('Locker'); expect(html).not.toContain('Dubbele deur'); expect(html).not.toContain('>Binnenlocatie<');
    expect(zonderLeverancier(g).regels).toBe(2);
  });
  it('enkel zonder leverancier', () => {
    const html = renderToString(<Toewijzen f={f} startZonder />);
    expect(html).toContain('Nadarbord'); expect(html).not.toContain('Bouwhek 3,5 m');
  });
});
