// Dagen van de fiche. Een dag wordt bewaard als anker + verschil:
//   anker 'start' = eerste wedstrijddag, anker 'einde' = laatste wedstrijddag.
// Canoniek: vóór en tijdens de wedstrijd tegenover de start, na de wedstrijd tegenover het einde.
// Zo schuift de afbraak mee als een volgende editie langer of korter is.
// Labels: D-3 … D (één wedstrijddag) of D1, D2 (meerdere) … D+1.

const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const naarDatum = (s) => (s ? new Date(`${s}T12:00:00`) : null);
export const isoDag = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDagen = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const verschil = (a, b) => Math.round((a - b) / 864e5);

// Wedstrijddagen van een plan: { van, tot, lengte } of null.
export function wedstrijd(plan) {
  const van = naarDatum(plan?.wedstrijd_van);
  if (!van) return null;
  const tot = naarDatum(plan?.wedstrijd_tot) || van;
  return { van, tot: tot < van ? van : tot, lengte: Math.max(1, verschil(tot < van ? van : tot, van) + 1) };
}

// Datum (Date) van anker + dag, of null zonder wedstrijddag.
export function datumVan(plan, anker, dag) {
  const w = wedstrijd(plan); if (!w) return null;
  return plusDagen(anker === 'einde' ? w.tot : w.van, Number(dag) || 0);
}

// Canonieke vorm van een dag.
export function canoniek(plan, anker, dag) {
  const w = wedstrijd(plan);
  dag = Number(dag) || 0;
  if (!w) return { anker: anker || 'start', dag };
  const d = datumVan(plan, anker, dag);
  return vanDatum(plan, d);
}

// Datum → { anker, dag }.
export function vanDatum(plan, d) {
  const w = wedstrijd(plan);
  if (!w) return { anker: 'start', dag: 0 };
  if (typeof d === 'string') d = naarDatum(d);
  if (d > w.tot) return { anker: 'einde', dag: verschil(d, w.tot) };
  return { anker: 'start', dag: verschil(d, w.van) };
}

export const sleutel = (anker, dag) => `${anker || 'start'}:${Number(dag) || 0}`;
export const uitSleutel = (k) => { const [a, d] = String(k).split(':'); return { anker: a === 'einde' ? 'einde' : 'start', dag: Number(d) || 0 }; };

// Label: D-3, D, D1, D2, D+1.
export function label(plan, anker, dag) {
  const w = wedstrijd(plan);
  dag = Number(dag) || 0;
  const meer = w && w.lengte > 1;
  if (anker === 'einde') {
    if (dag > 0) return `D+${dag}`;
    if (!w) return dag === 0 ? 'D' : `D${dag}`;
    const c = canoniek(plan, anker, dag); return label(plan, c.anker, c.dag);
  }
  if (dag < 0) return `D${dag}`;
  if (!w) return dag === 0 ? 'D' : `D+${dag}`;
  if (dag < w.lengte) return meer ? `D${dag + 1}` : 'D';
  return `D+${dag - w.lengte + 1}`;
}

// Fase van een dag: 'opbouw', 'wedstrijd', 'afbraak'.
export function fase(plan, anker, dag) {
  const w = wedstrijd(plan); dag = Number(dag) || 0;
  if (anker === 'einde') return dag > 0 ? 'afbraak' : 'wedstrijd';
  if (dag < 0) return 'opbouw';
  if (!w || dag < w.lengte) return 'wedstrijd';
  return 'afbraak';
}
export const FASE_NAAM = { opbouw: 'Opbouw', wedstrijd: 'Wedstrijd', afbraak: 'Afbraak' };

// "vr 27 mrt"
export function datumTekst(d, metJaar = false) {
  if (!d) return '';
  return `${DAG[d.getDay()]} ${d.getDate()} ${MAAND[d.getMonth()]}${metJaar ? ` ${d.getFullYear()}` : ''}`;
}
export const isWeekend = (d) => !!d && (d.getDay() === 0 || d.getDay() === 6);
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n);
  const j = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - j) / 864e5 + 1) / 7);
}

// Volgorde van dagen: zonder wedstrijddag op anker en dag, anders op datum.
export function volgorde(plan, a, b) {
  const da = datumVan(plan, a.anker, a.dag), db = datumVan(plan, b.anker, b.dag);
  if (da && db) return da - db;
  if (a.anker !== b.anker) return a.anker === 'start' ? -1 : 1;
  return (Number(a.dag) || 0) - (Number(b.dag) || 0);
}

// Doorlopende lijst van dagen van de eerste tot de laatste gebruikte dag (minstens de wedstrijddagen).
export function dagLijst(plan, gebruikt = []) {
  const w = wedstrijd(plan);
  const lijst = gebruikt.map((x) => canoniek(plan, x.anker, x.dag));
  if (!w) {
    const set = new Map(lijst.map((x) => [sleutel(x.anker, x.dag), x]));
    if (!set.size) set.set('start:0', { anker: 'start', dag: 0 });
    return [...set.values()].sort((a, b) => volgorde(plan, a, b)).map((x) => ({ ...x, k: sleutel(x.anker, x.dag), datum: null }));
  }
  const datums = lijst.map((x) => datumVan(plan, x.anker, x.dag));
  let min = w.van, max = w.tot;
  for (const d of datums) { if (d < min) min = d; if (d > max) max = d; }
  const uit = [];
  for (let d = new Date(min); d <= max; d = plusDagen(d, 1)) {
    const c = vanDatum(plan, d);
    uit.push({ ...c, k: sleutel(c.anker, c.dag), datum: new Date(d) });
  }
  return uit;
}

// "vr 27 mrt · D-2" of enkel "D-2" zonder wedstrijddag.
export function dagNaam(plan, anker, dag) {
  const d = datumVan(plan, anker, dag);
  const l = label(plan, anker, dag);
  return d ? `${datumTekst(d)} · ${l}` : l;
}

// Uur 'HH:MM:SS' → 'HH:MM'.
export const uurKort = (u) => (u ? String(u).slice(0, 5) : '');
// Vrij ingegeven uur ('7u', '07.30', '730') → 'HH:MM' of null.
export function leesUur(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})(?:[:u.h ]?(\d{2}))?\s*u?$/i);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] || 0);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}
