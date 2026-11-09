// Zoeken in de bibliotheek: alle woorden moeten passen (naam, leverancier, categorie, subgroep,
// familie of zoekwoorden), zonder accenten en hoofdletters, met één tikfout per woord toegestaan.

export const normaal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.,×x/ -]+/g, ' ');

// Afstand van Levenshtein, afgebroken zodra ze groter wordt dan `max`.
function afstand(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vorige = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const rij = [i]; let min = i;
    for (let j = 1; j <= b.length; j++) {
      rij[j] = Math.min(vorige[j] + 1, rij[j - 1] + 1, vorige[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (rij[j] < min) min = rij[j];
    }
    if (min > max) return max + 1;
    vorige = rij;
  }
  return vorige[b.length];
}

const cache = new WeakMap();
function woordenVan(el) {
  let w = cache.get(el);
  if (w) return w;
  const e = el.eigenschappen || {};
  const tekst = normaal([el.naam, el.leverancier, el.categorie, e.subgroep, e.familie, e.variant, ...(e.tags || [])].filter(Boolean).join(' '));
  w = { tekst, woorden: [...new Set(tekst.split(/[\s,/·-]+/).filter(Boolean))] };
  cache.set(el, w);
  return w;
}

// 0 = geen treffer; hoger = beter (naam die begint met de zoekterm wint).
export function zoekScore(el, zoek) {
  const q = normaal(zoek).trim();
  if (!q) return 1;
  const { tekst, woorden } = woordenVan(el);
  const delen = q.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const d of delen) {
    if (tekst.includes(d)) { score += woorden.some((w) => w.startsWith(d)) ? 3 : 2; continue; }
    // Tikfout: één letter fout bij woorden vanaf 4 letters, twee vanaf 8.
    const max = d.length >= 8 ? 2 : d.length >= 4 ? 1 : 0;
    if (max && woorden.some((w) => afstand(d, w.slice(0, Math.max(d.length, Math.min(w.length, d.length + 1))), max) <= max || afstand(d, w, max) <= max)) { score += 1; continue; }
    return 0;
  }
  if (normaal(el.naam).startsWith(delen[0])) score += 2;
  return score;
}

// Natuurlijke volgorde van varianten: 20 kVA < 100 kVA, h 0,5 m < h 1,0 m.
export const vergelijkVariant = (a, b) => String(a).replace(',', '.').localeCompare(String(b).replace(',', '.'), 'nl', { numeric: true });
