// Eén plek die de muiscursor van de kaart bepaalt. Elke bron (slepen, penseel, greep,
// spookpunt, gereedschap, oplichten …) zegt wat ze wil; de bron met de hoogste voorrang wint.
// Zo blijft de cursor nergens 'hangen' doordat de ene bron die van een andere overschrijft.
const VOORRANG = ['sleep', 'penseel', 'route', 'greep', 'spook', 'modus', 'vast', 'gereedschap', 'va', 'licht'];

export function zetCursor(map, bron, waarde) {
  if (!map) return;
  const w = (map._fmCursor = map._fmCursor || {});
  if ((w[bron] || '') === (waarde || '')) return;
  if (waarde) w[bron] = waarde; else delete w[bron];
  const c = VOORRANG.map((b) => w[b]).find(Boolean) || '';
  const el = map.getCanvas();
  if (el.style.cursor !== c) el.style.cursor = c;
}
