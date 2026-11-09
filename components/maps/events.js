// Events: plannen horen bij een event (datum, kleur). Zie db/0007_events.sql.
// Zolang die migratie niet gedraaid is, valt alles terug op de editie_naam van de plannen.
import { maps } from './db';

// Vaste reeks eventkleuren: goed te onderscheiden, ook in lichtheid.
export const EVENT_KLEUREN = ['#108AED', '#E8833A', '#6C5CE0', '#12A5A0', '#D94878', '#28B571', '#B8860B', '#022056'];
export const kleurVoor = (i) => EVENT_KLEUREN[((i % EVENT_KLEUREN.length) + EVENT_KLEUREN.length) % EVENT_KLEUREN.length];

export async function laadEvents() {
  const r = await maps().from('events').select('*').order('datum', { ascending: true, nullsFirst: false });
  if (r.error) return { events: [], ok: false };
  return { events: r.data || [], ok: true };
}

export async function maakEvent({ naam, datum, kleur, plek }) {
  const r = await maps().from('events').insert({ naam: naam.trim(), datum: datum || null, kleur, plek: plek || null }).select().single();
  if (r.error) throw r.error;
  return r.data;
}

const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const MAAND_KORT = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

// "Za 27 februari"
export function eventDatum(d) {
  if (!d) return 'Nog geen datum';
  const t = new Date(`${d}T12:00:00`);
  const s = `${DAG[t.getDay()]} ${t.getDate()} ${MAAND[t.getMonth()]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// Dagen tot de datum (negatief = voorbij).
export function dagenTot(d) {
  if (!d) return null;
  const nu = new Date(); nu.setHours(12, 0, 0, 0);
  return Math.round((new Date(`${d}T12:00:00`) - nu) / 864e5);
}

// Plannen per event groeperen. Zonder events-tabel: per editie_naam, met een vaste kleur per naam.
export function groepeer(plannen, events, ok) {
  const groepen = new Map();
  if (ok) {
    events.forEach((e) => groepen.set(e.id, { ...e, plannen: [] }));
    for (const p of plannen) {
      if (p.event_id && groepen.has(p.event_id)) groepen.get(p.event_id).plannen.push(p);
    }
  } else {
    let i = 0;
    for (const p of plannen) {
      const naam = (p.editie_naam || '').trim();
      if (!naam) continue;
      if (!groepen.has(naam)) groepen.set(naam, { id: naam, naam, datum: null, kleur: kleurVoor(i++), plannen: [] });
      groepen.get(naam).plannen.push(p);
    }
  }
  return [...groepen.values()];
}
