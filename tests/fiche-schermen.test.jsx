import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../components/maps/db', () => ({ maps: () => ({}), sb: () => ({}), foutTekst: (e) => String(e?.message || e), wieBenIk: async () => null, magSchrijven: () => true }));
vi.mock('../components/maps/dialoog', () => ({ bevestig: async () => true, vraagTekst: async () => 'x', toonTekst: async () => {}, AppDialogen: () => null }));

import TabPlanning from '../components/fiche/TabPlanning';
import TaakPaneel from '../components/fiche/TaakPaneel';
import TabLeveranciers from '../components/fiche/TabLeveranciers';
import TabLaadlijst from '../components/fiche/TabLaadlijst';
import TabCatering from '../components/fiche/TabCatering';
import TabBudget from '../components/fiche/TabBudget';
import TabContacten from '../components/fiche/TabContacten';
import { TabLocaties, TabMobiliteit } from '../components/fiche/TabLocaties';
import { TabOverzicht, TabNotitiesPagina, TabInfo } from '../components/fiche/TabOverig';

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fiche(wedstrijd = true) {
  const plan = { id: id(1), naam: 'Wevelgem', organisatie_id: id(2), locatie: 'Wevelgem', ...(wedstrijd ? { wedstrijd_van: '2026-03-29', wedstrijd_tot: '2026-03-29' } : {}),
    instellingen: { fiche: { locaties: [{ id: 'l1', naam: 'CC Guldenberg', item_id: id(30), ruimtes: [{ naam: 'Zaal', functie: 'Jury' }] }], parkings: [{ id: 'p1', nr: '5', voor: 'Teams', locatie: 'Kortrijkstraat', wanneer: 'Zondag' }] } } };
  const leveranciers = [{ id: id(10), naam: 'Delrue' }, { id: id(11), naam: 'Nammielicious' }, { id: id(12), naam: 'Gigant' }];
  const items = [{ id: id(30), naam: 'Aankomstzone', laag_id: id(40), element_id: id(50), velden: {} }, { id: id(31), naam: 'Trailer', element_id: id(51), velden: { herkomst: 'Delrue' }, groep_id: id(60) }];
  const d = {
    taken: [{ id: id(100), titel: 'Plaatsen hekken', soort: 'Levering', wie_leverancier_id: id(10), status: 'open' }, { id: id(101), titel: 'Vergunning', voorbereiding: true, status: 'open', deadline_anker: 'start', deadline_dag: -30 }, { id: id(102), titel: 'Afbraak hekken', ouder_id: id(100), relatie: 'afbraak', status: 'open' }],
    taak_dagen: [{ id: id(200), taak_id: id(100), anker: 'start', dag: -2, uur_van: '07:00:00', status: 'open' }, { id: id(201), taak_id: id(100), anker: 'start', dag: -1, status: 'klaar' }, { id: id(202), taak_id: id(102), anker: 'einde', dag: 1, status: 'open' }],
    taak_koppelingen: [{ id: id(300), taak_id: id(100), soort: 'item', item_id: id(31), label: 'Trailer' }, { id: id(301), taak_id: id(100), soort: 'item', item_id: null, label: 'Weg' }],
    programma: [{ id: id(400), anker: 'start', dag: 0, uur_van: '14:10:00', wat: 'Start' }],
    site_leveranciers: [{ id: id(500), leverancier_id: id(10), status: 'offerte', wat: 'hekken' }, { id: id(501), leverancier_id: id(11), status: 'nog_niets' }],
    leveringen: [{ id: id(600), site_leverancier_id: id(500), soort: 'levering', anker: 'start', dag: -3, uur_van: '08:00:00', leverpunt_item_id: id(30), status: 'open', wat: '3 trailers' }],
    offertes: [{ id: id(700), site_leverancier_id: id(500), bedrag_excl: 1000, status: 'ontvangen' }],
    facturen: [{ id: id(701), site_leverancier_id: id(500), bedrag_excl: 1100, status: 'ontvangen' }],
    budgetposten: [{ id: id(702), omschrijving: 'Drukwerk', budget: 500, vennootschap_id: id(800) }],
    laadregels: [{ id: id(900), bron_id: id(910), aantal: 24, wat: 'Krijtspray', status: 'te_pakken' }, { id: id(901), aantal: 2, wat: 'Pijlen', status: 'gepakt' }],
    cateringregels: [{ id: id(1000), soort: 'crew', product: 'Warme maaltijd', eenheid: 'pers', voor_tekst: 'Gemeente', anker: 'start', dag: -2, aantal: 10, leverancier_id: id(11) },
      { id: id(1001), soort: 'crew', product: 'Warme maaltijd', eenheid: 'pers', voor_leverancier_id: id(12), anker: 'start', dag: -1, aantal: 6 },
      { id: id(1002), soort: 'wedstrijddag', product: 'Lunchpakket', eenheid: 'st', voor_tekst: 'Vrijwilligers', groep: 'Vrijwilligers', anker: 'start', dag: 0, uur: '06:30:00', leverplaats_tekst: 'Porseleinhallen', aantal: 210, leverancier_id: id(11) },
      { id: id(1003), soort: 'wedstrijddag', product: 'Maaltijd', eenheid: 'pers', voor_tekst: 'TV', anker: 'start', dag: 0, aantal: 59, rechtstreeks: true }],
    catering_prijzen: [{ id: id(1100), leverancier_id: id(11), product: 'Lunchpakket', eenheid: 'st', prijs: 8.5 }],
    notities: [{ id: id(1200), tekst: 'Soep was te kort', tab: 'catering', klaar: false, created_at: '2026-11-17T08:00:00Z' }],
    site_rollen: [{ id: id(1300), persoon_id: id(1400), rol: 'Projectmanager', toegang: 'lid', volgorde: 0 }, { id: id(1301), persoon_id: id(1401), rol: 'Parking', toegang: 'geen', volgorde: 1 }],
    plan_vennootschappen: [{ id: id(1500), vennootschap_id: id(800), standaard: true }],
    leveranciers, personen: [{ id: id(1400), naam: 'Brecht Toelen', user_id: id(3) }, { id: id(1401), naam: 'Tom', leverancier_id: id(12), telefoon: '+32 4' }],
    vennootschappen: [{ id: id(800), naam: 'Flanders Classics NV' }], laad_bronnen: [{ id: id(910), naam: 'Magazijn Vilvoorde', brengt_tekst: 'Eigen bus' }], laadpakketten: [],
  };
  const nop = async () => null;
  return { plan, event: { naam: 'IFF 2026', datum: '2026-03-29' }, items, lagen: [{ id: id(40), naam: 'Zones', map: 'Aankomst' }], elementen: [{ id: id(50), naam: 'Zone' }, { id: id(51), naam: 'Trailer schuine hekken', leverancier: 'Delrue' }], d,
    profiel: { display_name: 'Brecht' }, financieel: true, schrijven: true, planLev: [{ leverancier_id: id(12), items: 3 }], melding: '', meld: () => {}, herlaad: nop, voegToe: nop, wijzig: nop, wis: nop, planWijzig: nop, itemWijzig: nop, rpc: nop };
}

describe('schermen van de fiche renderen zonder fouten', () => {
  for (const w of [true, false]) {
    const f = fiche(w);
    const tabs = { TabPlanning, TabLeveranciers, TabLaadlijst, TabCatering, TabBudget, TabContacten, TabLocaties, TabMobiliteit, TabOverzicht, TabNotitiesPagina, TabInfo };
    for (const [naam, C] of Object.entries(tabs)) {
      it(`${naam}${w ? '' : ' zonder wedstrijddag'}`, () => {
        const html = renderToString(<C f={f} planId={f.plan.id} naar={() => {}} />);
        expect(html.length).toBeGreaterThan(100);
      });
    }
    it(`TaakPaneel${w ? '' : ' zonder wedstrijddag'}`, () => {
      expect(renderToString(<TaakPaneel f={f} taakId={id(100)} onSluit={() => {}} />)).toContain('Plaatsen hekken');
      expect(renderToString(<TaakPaneel f={f} taakId={id(101)} onSluit={() => {}} />)).toContain('Deadline');
    });
  }
  it('planning toont taak, levering en programma op de juiste dag', () => {
    const f = fiche(true);
    const html = renderToString(<TabPlanning f={f} planId={f.plan.id} />);
    expect(html).toContain('Wedstrijddag');
  });
  it('budget telt facturen en catering', () => {
    const html = renderToString(<TabBudget f={fiche(true)} />);
    expect(html).toContain('Drukwerk');
    expect(html).toContain('Catering');
  });
  it('catering per dag toont de groepen', () => {
    const html = renderToString(<TabCatering f={fiche(true)} />);
    expect(html).toContain('Gemeente');
    expect(html).toContain('Gigant');
  });
});

import FicheSelectieBlok from '../components/fiche/SelectieBlok';
import FicheItemBlok from '../components/fiche/ItemBlok';
describe('fiche op de kaart', () => {
  const f = fiche(true);
  it('selectieblok toont de knop voor alle items', () => {
    const html = renderToString(<FicheSelectieBlok items={f.items.map((x) => ({ ...x, plan_id: f.plan.id }))} plan={f.plan} schrijven />);
    expect(html.replace(/<!-- -->/g, '')).toContain('Taak maken voor 2 items');
  });
  it('itemblok biedt de hele groep aan', () => {
    const html = renderToString(<FicheItemBlok item={{ ...f.items[1], plan_id: f.plan.id }} plan={f.plan} schrijven groepAantal={3} groepNaam="Trailers" />);
    expect(html.replace(/<!-- -->/g, '')).toContain('Voor de hele groep (3 items)');
  });
});
