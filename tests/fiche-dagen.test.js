import { describe, it, expect } from 'vitest';
import { label, canoniek, vanDatum, dagLijst, datumVan, fase, leesUur, isoDag } from '../components/fiche/dagen';

const een = { wedstrijd_van: '2026-03-29', wedstrijd_tot: '2026-03-29' };
const twee = { wedstrijd_van: '2026-12-19', wedstrijd_tot: '2026-12-20' };

describe('dagen van de fiche', () => {
  it('labels bij één wedstrijddag', () => {
    expect(label(een, 'start', -2)).toBe('D-2');
    expect(label(een, 'start', 0)).toBe('D');
    expect(label(een, 'einde', 1)).toBe('D+1');
    expect(label(een, 'start', 1)).toBe('D+1');
  });
  it('labels bij twee wedstrijddagen', () => {
    expect(label(twee, 'start', 0)).toBe('D1');
    expect(label(twee, 'start', 1)).toBe('D2');
    expect(label(twee, 'einde', 1)).toBe('D+1');
    expect(label(twee, 'start', -1)).toBe('D-1');
  });
  it('canonieke vorm: na de wedstrijd tegenover het einde', () => {
    expect(canoniek(twee, 'start', 3)).toEqual({ anker: 'einde', dag: 2 });
    expect(canoniek(twee, 'einde', 0)).toEqual({ anker: 'start', dag: 1 });
    expect(vanDatum(een, '2026-03-27')).toEqual({ anker: 'start', dag: -2 });
  });
  it('afbraak schuift mee met een langere editie', () => {
    const langer = { wedstrijd_van: '2027-12-18', wedstrijd_tot: '2027-12-20' };
    expect(isoDag(datumVan(langer, 'einde', 1))).toBe('2027-12-21');
    expect(fase(langer, 'start', 2)).toBe('wedstrijd');
  });
  it('dagLijst loopt door van eerste tot laatste dag', () => {
    const l = dagLijst(een, [{ anker: 'start', dag: -3 }, { anker: 'einde', dag: 2 }]);
    expect(l.map((d) => d.k)).toEqual(['start:-3', 'start:-2', 'start:-1', 'start:0', 'einde:1', 'einde:2']);
  });
  it('zonder wedstrijddag enkel de gebruikte dagen', () => {
    const l = dagLijst({}, [{ anker: 'start', dag: -1 }, { anker: 'start', dag: -1 }, { anker: 'einde', dag: 1 }]);
    expect(l.map((d) => d.k)).toEqual(['start:-1', 'einde:1']);
  });
  it('uren lezen', () => {
    expect(leesUur('7u')).toBe('07:00');
    expect(leesUur('07.30')).toBe('07:30');
    expect(leesUur('1730')).toBe('17:30');
    expect(leesUur('25:00')).toBe(null);
  });
});
