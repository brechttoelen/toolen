// Lichtmasten: hoe ver het licht draagt, als lichtvlek op de kaart (editor, deellink).
// Element: eigenschappen.licht = { spots: 4, watt: 320 (per spot), bereik_m?: vaste straal, soort: 'spots' | 'ballon' }
// Item:    velden.licht = { aan: true, modus: '360' | '180', richting: graden (kompas, met de klok mee, 0 = noord), bereik?: m }
// Richtwaarde: een LED-mast van 4 × 320 W verlicht ± 5.000 m² bruikbaar (± 20 lux gemiddeld, technische fiches
// van gelijkaardige masten). Dat is ± 3,9 m² per watt. Bij 180° gaat hetzelfde licht naar een halve cirkel: verder bereik.
export const M2_PER_W = 3.9;
export const BEAM = 50; // halve bundelbreedte van een brede spot (graden)

export const lichtVan = (el) => {
  const l = el?.eigenschappen?.licht; if (l) return l;
  // Lichtmasten zonder instelling: herkennen aan de naam (bv. uit de bibliotheek van de leverancier).
  const n = `${el?.naam || ''} ${(el?.eigenschappen?.tags || []).join(' ')}`.toLowerCase();
  if (/lichtballon/.test(n)) return { soort: 'ballon', spots: 1, watt: 3000, bereik_m: 30 };
  if (/lichtmast/.test(n)) { const m = /(\d)\s*[×x]\s*(\d{3,4})\s*w/i.exec(el?.eigenschappen?.omschrijving || ''); return { soort: 'spots', spots: m ? Number(m[1]) : 4, watt: m ? Number(m[2]) : 320 }; }
  return null;
};
export const isLichtmast = (el) => !!lichtVan(el);

// Straal (m) en oppervlakte (m²) voor deze mast in deze stand.
export function lichtBereik(it, el) {
  const l = lichtVan(el); if (!l) return null;
  const v = it?.velden?.licht || {}; const half = v.modus === '180' && l.soort !== 'ballon';
  const opp = Number(l.bereik_m) > 0 ? Math.PI * Number(l.bereik_m) ** 2 : M2_PER_W * (Number(l.spots) || 4) * (Number(l.watt) || 320);
  const R = Number(v.bereik) > 0 ? Number(v.bereik) : Math.sqrt(opp / (Math.PI * (half ? 0.5 : 1)));
  return { R: Math.round(R), opp: Math.round(opp / 100) * 100, half, spots: l.soort === 'ballon' ? 0 : Number(l.spots) || 4 };
}

// Richting van elke spot (kompasgraden). 360°: rondom verdeeld; 180°: allemaal naar één kant, breed open.
export function spotRichtingen(it, el) {
  const b = lichtBereik(it, el); if (!b || !b.spots) return [];
  const r0 = Number(it?.velden?.licht?.richting) || 0; const n = b.spots;
  if (b.half) return Array.from({ length: n }, (_, k) => r0 - 90 + BEAM + ((180 - 2 * BEAM) * (n === 1 ? 0.5 : k / (n - 1))));
  return Array.from({ length: n }, (_, k) => r0 + (360 * k) / n);
}

const M_LAT = 110574; const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
// GeoJSON-vlakken: per spot een waaier in ringen die naar buiten toe zwakker worden (overlap = feller).
export function lichtVlekken(it, el) {
  const b = lichtBereik(it, el); const m = it?.parameters?.midden || (it?.geometrie?.type === 'Point' ? it.geometrie.coordinates : null);
  if (!b || !m) return [];
  const naar = (a, r) => { const t = (a * Math.PI) / 180; return [m[0] + (Math.sin(t) * r) / mLng(m[1]), m[1] + (Math.cos(t) * r) / M_LAT]; };
  const ringen = 10; const uit = [];
  // Rondom: vier brede spots sluiten naadloos aan (± 45°); naar één kant overlappen ze (feller in het midden).
  const hw = b.half ? BEAM : 180 / Math.max(1, b.spots);
  const waaiers = b.spots ? spotRichtingen(it, el).map((a) => [a - hw, a + hw]) : [[0, 360]];
  const sterkte = b.half ? 0.16 : 0.34;
  for (const [a0, a1] of waaiers) {
    const n = Math.max(8, Math.round((a1 - a0) / 6));
    for (let j = 0; j < ringen; j++) {
      const r0 = (b.R * j) / ringen; const r1 = (b.R * (j + 1)) / ringen;
      const buiten = Array.from({ length: n + 1 }, (_, k) => naar(a0 + ((a1 - a0) * k) / n, r1));
      const binnen = j === 0 ? [m] : Array.from({ length: n + 1 }, (_, k) => naar(a1 - ((a1 - a0) * k) / n, r0));
      const ring = [...buiten, ...binnen, buiten[0]];
      uit.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id: it.id, vorm: 'licht', soort: 'lichtvlek', vuldekking: Math.round((sterkte * (1 - j / ringen) ** 0.9 + 0.03) * 1000) / 1000 } });
    }
  }
  // Rand van het bereik (stippellijn) en de straal als label.
  const omtrek = b.half ? [m, ...Array.from({ length: 37 }, (_, k) => naar((Number(it.velden?.licht?.richting) || 0) - 90 + 5 * k, b.R)), m] : Array.from({ length: 73 }, (_, k) => naar(5 * k, b.R));
  uit.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: omtrek }, properties: { id: it.id, vorm: 'licht', soort: 'lichtrand', label: `± ${b.R} m` } });
  return uit;
}
