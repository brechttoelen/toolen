import { describe, it, expect } from 'vitest';
import { metTrappen, trapKeuze } from '../components/maps/tekening';
import movico from '../components/maps/tekeningen/movico.json';

const tek = movico['mv-movico-mu5-multi-unit-15-6-m'];
const trapVlakken = (t) => t.vlakken.filter((v) => v.trap).map((v) => v.trap).sort();
describe('trappen van een multi unit', () => {
  it('standaard twee vooraan, zoals de tekening', () => {
    expect(trapKeuze(tek, {})).toEqual(['voor-links', 'voor-rechts']);
    expect(trapVlakken(metTrappen(tek, {}))).toEqual(['voor-links', 'voor-rechts']);
  });
  it('gekozen plaatsen: opzij erbij, vooraan weg', () => {
    const t = metTrappen(tek, { velden: { trappen: ['links', 'voor-rechts'] } });
    expect(trapVlakken(t)).toEqual(['links', 'voor-rechts']);
    const links = t.vlakken.find((v) => v.trap === 'links').r[0];
    expect(Math.max(...links.map((q) => q[0]))).toBe(-7.5);   // tegen de linkerwand
    expect(t.lijnen.filter((l) => l.trap === 'voor-links')).toHaveLength(0);
  });
  it('geen trappen kan ook', () => {
    expect(trapVlakken(metTrappen(tek, { velden: { trappen: [] } }))).toEqual([]);
  });
});
