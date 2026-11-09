// Een GeoJSON-kaartbron bijwerken met enkel het verschil.
//
// naarGeojson (stijl.js) geeft per item dezelfde feature-objecten terug zolang het item niet verandert, elk met een
// eigen id. Daardoor is het verschil met de vorige keer snel te bepalen: features die een ander object zijn, zijn
// nieuw of gewijzigd; ids die weg zijn, zijn verwijderd. MapLibre bouwt dan enkel de geraakte tegels opnieuw
// (updateData) in plaats van het hele plan opnieuw te indexeren (setData) — bij een plan met duizend items
// scheelt dat honderden milliseconden per verplaatsing.
const vorige = new WeakMap(); // map -> { [bronId]: Map<featureId, feature> | null }

export function bronBijwerken(map, bronId, fc) {
  const bron = map?.getSource(bronId);
  if (!bron) return;
  let per = vorige.get(map);
  if (!per) { per = {}; vorige.set(map, per); }
  per[`${bronId}#weg`] = null; // wat tijdens een sleep verborgen was, komt hieronder vanzelf terug (zit niet in 'oud')
  const oud = per[bronId];
  const nieuw = new Map();
  let ok = true;
  for (const f of fc.features) {
    if (f.id == null || nieuw.has(f.id)) { ok = false; break; }
    nieuw.set(f.id, f);
  }
  // Zonder (unieke) ids kan de bron niet bijgewerkt worden: dan helemaal opnieuw.
  if (!ok || !oud || typeof bron.updateData !== 'function') { bron.setData(fc); per[bronId] = ok ? nieuw : null; return; }
  const add = []; const remove = [];
  for (const [id, f] of nieuw) if (oud.get(id) !== f) add.push(f);
  for (const id of oud.keys()) if (!nieuw.has(id)) remove.push(id);
  per[bronId] = nieuw;
  if (!add.length && !remove.length) return;
  // Veel verschil (bv. alles gedimd, laag verborgen): dan is opnieuw laden even snel en eenvoudiger.
  if (add.length + remove.length > Math.max(300, nieuw.size * 0.4)) { bron.setData(fc); return; }
  try { bron.updateData({ remove, add }); } catch { bron.setData(fc); }
}

// De bron helemaal vergeten (bv. als een andere code setData gebruikt heeft).
export function bronVergeten(map, bronId) {
  const per = vorige.get(map);
  if (per) per[bronId] = null;
}

// Tijdens een sleep: de features van deze items even uit de bron halen (enkel de geraakte tegels worden herbouwd),
// het sleepvoorbeeld tekent ze op hun nieuwe plek. bronHerstel zet ze terug als er daarna niets veranderd is.
export function bronVerberg(map, bronId, itemIds) {
  const per = vorige.get(map); const bron = map?.getSource(bronId);
  const huidig = per?.[bronId];
  if (!huidig || !bron || typeof bron.updateData !== 'function') return false;
  const weg = []; const pre = itemIds.map((id) => `${id}#`);
  for (const [fid, f] of huidig) if (typeof fid === 'string' && pre.some((p) => fid.startsWith(p))) weg.push(f);
  if (!weg.length) return true;
  for (const f of weg) huidig.delete(f.id);
  per[`${bronId}#weg`] = [...(per[`${bronId}#weg`] || []), ...weg];
  try { bron.updateData({ remove: weg.map((f) => f.id) }); } catch { return false; }
  return true;
}
export function bronHerstel(map, bronId) {
  const per = vorige.get(map); const bron = map?.getSource(bronId);
  const weg = per?.[`${bronId}#weg`];
  if (!weg || !bron) return;
  per[`${bronId}#weg`] = null;
  const huidig = per[bronId]; if (!huidig) return;
  for (const f of weg) huidig.set(f.id, f);
  try { bron.updateData({ add: weg }); } catch { per[bronId] = null; }
}
