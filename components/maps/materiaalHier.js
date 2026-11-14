// Materiaal op een plek zonder het uit te tekenen: een punt of zone met een lijstje uit de bibliotheek.
//   item.velden.materiaal = [{ element_id, aantal }]
// Telt mee in de materiaallijst en in de bestelling per leverancier alsof het getekend was. Verbruik (kW) van
// dat materiaal telt mee in de stroomplanning: de plek is dan één verbruiker met één voeding.

export const kanMateriaalHier = (item, el) => !!item && !el && item.geometrie?.type !== 'LineString' && !['tekst', 'notitie', 'afstand', 'sector'].includes(item.soort) && !item.velden?.meubel;

export function materiaalVan(item, elementenMap) {
  const l = Array.isArray(item?.velden?.materiaal) ? item.velden.materiaal : [];
  return l.map((r) => ({ ...r, aantal: Math.max(0, Math.round(Number(r.aantal) || 0)), el: elementenMap?.get(r.element_id) || null })).filter((r) => r.el && r.aantal > 0);
}

// Vermogen van één stuk: zijn kW, of de som van zijn aansluitingen.
export function kwVanElement(el) {
  const e = el?.eigenschappen || {};
  if (Number(e.kw) > 0) return Number(e.kw);
  if (Array.isArray(e.aansluitingen)) return e.aansluitingen.reduce((s, a) => s + (Number(a.kw) || 0), 0);
  return 0;
}
export const kwVanMateriaal = (rijen) => Math.round(rijen.reduce((s, r) => s + kwVanElement(r.el) * r.aantal, 0) * 100) / 100;
// Heeft dit materiaal stroom nodig (verbruiker, stekkerdoos of iets uit de familie stroom)?
export const vraagtStroom = (rijen) => rijen.some((r) => kwVanElement(r.el) > 0 || r.el.eigenschappen?.stekkerdoos || (r.el.familie === 'stroom' && !r.el.eigenschappen?.kva));

export const materiaalTekst = (rijen, max = 4) => {
  const t = rijen.slice(0, max).map((r) => `${r.aantal} × ${r.el.naam}`);
  if (rijen.length > max) t.push(`+ ${rijen.length - max}`);
  return t.join(' · ');
};

// Nieuwe velden na een wijziging van het lijstje: het lijstje zelf, en voor de stroom het vermogen dat erbij hoort.
export function metMateriaal(item, lijst, elementenMap) {
  const schoon = lijst.filter((r) => r.element_id).map((r) => ({ element_id: r.element_id, aantal: Math.max(0, Math.round(Number(r.aantal) || 0)) }));
  const velden = { ...(item.velden || {}) };
  if (schoon.length) velden.materiaal = schoon; else delete velden.materiaal;
  const rijen = materiaalVan({ velden }, elementenMap);
  const kw = kwVanMateriaal(rijen);
  const stroom = { ...(velden.stroom || {}) };
  if (kw > 0) stroom.kwMateriaal = kw; else delete stroom.kwMateriaal;
  // Een plek met stekkerdozen of verbruikers is een verbruiker (mono 16 A tot er iets anders gekozen wordt).
  if (vraagtStroom(rijen) && !stroom.rol) { stroom.rol = 'verbruiker'; if (!stroom.fase) stroom.fase = kw > 3.6 ? '3F' : 'L1'; if (!stroom.ampere) stroom.ampere = 16; }
  if (Object.keys(stroom).length) velden.stroom = stroom; else delete velden.stroom;
  return velden;
}

// Uittekenen: per stuk een plek in een raster net onder het punt of de zone. Geeft [{ el, c }]; elementen die
// als lijn getekend worden (hekken, kabels) kunnen niet als los stuk op de kaart en blijven in het lijstje.
export const kanUittekenen = (el) => el.tekenwijze !== 'lijn' && el.tekenwijze !== 'sjabloon';
export function rasterPlekken(rijen, midden) {
  const uit = []; const mLat = 110574; const mLng = 111320 * Math.cos((midden[1] * Math.PI) / 180);
  let y = 0;
  for (const r of rijen.filter((x) => kanUittekenen(x.el))) {
    const b = Number(r.el.breedte_m) || 1; const d = Number(r.el.diepte_m) || 1; const perRij = Math.max(1, Math.min(r.aantal, Math.floor(12 / (b + 0.3)) || 1));
    for (let i = 0; i < r.aantal; i++) {
      const kol = i % perRij; const rij = Math.floor(i / perRij);
      uit.push({ el: r.el, c: [midden[0] + ((kol - (perRij - 1) / 2) * (b + 0.3)) / mLng, midden[1] - (y + rij * (d + 0.3) + d / 2 + 1) / mLat] });
    }
    y += Math.ceil(r.aantal / perRij) * (d + 0.3) + 0.4;
  }
  return uit;
}
