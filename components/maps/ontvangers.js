// Ontvangers: wie iets van dit plan krijgt (tentenbouwer, politie, stad) en wat precies.
// Een ontvanger is een deellink (maps.deel_links) met onderdelen in opties.onderdelen.
// Uit die onderdelen volgen zowel de deellink als de PDF. Zie db/0008_ontvangers.sql.
import { heeftModule } from './merk';

export const nieuwId = () => Math.random().toString(36).slice(2, 10);

// Snelkeuze bij een nieuwe ontvanger: wat hij standaard mag in de link.
export const SOORTEN = [
  { id: 'Hulpdiensten', uitleg: 'Notities en keuringsattesten zien, opmerkingen plaatsen', opties: { notities: true, attesten: true, opmerkingen: true, materialen: false, pdf: true } },
  { id: 'Leverancier', uitleg: 'Enkel hun materiaal, met materiaallijst', opties: { notities: true, attesten: false, opmerkingen: true, materialen: true, pdf: true } },
  { id: 'Gemeente', uitleg: 'Het plan bekijken en opmerkingen plaatsen', opties: { notities: true, attesten: false, opmerkingen: true, materialen: false, pdf: true } },
  { id: 'Stroom', module: 'stroom', uitleg: 'Stroompunten, aansluitschema en wat mee moet', opties: { stroom: true, notities: false, attesten: false, opmerkingen: false, materialen: false, pdf: true } },
  { id: 'Team', uitleg: 'Het plan bekijken en afdrukken', opties: { notities: true, attesten: false, opmerkingen: false, materialen: false, pdf: true } },
  { id: 'Publiek', uitleg: 'Enkel de kaart: geen notities, attesten of aantallen', opties: { notities: false, attesten: false, opmerkingen: false, materialen: false, pdf: true } },
];
export const soortenVoorPakket = () => SOORTEN.filter((s) => !s.module || heeftModule(s.module));

// Plannen per werkplek die in de PDF van een ontvanger kunnen.
export const WERKPLEKKEN = [
  { id: 'stroomplan', naam: 'Stroomdossier', module: 'stroom' },
  { id: 'veiligheidsplan', naam: 'Veiligheidsplan', module: 'veiligheid' },
  { id: 'brandingplan', naam: 'Brandingplan', module: 'branding' },
];

export const SOORT_NAAM = { plan: 'Plan', drie: '3D', binnen: 'Binnenplan', werkplek: 'Werkplek' };

// Oude deellinks (zonder onderdelen) als één onderdeel.
function afgeleid(l) {
  const o = l.opties || {};
  if (o.drie) return [{ id: 'd1', soort: 'drie', naam: 'In 3D', item: o.drie }];
  if (o.binnen) return [{ id: 'b1', soort: 'binnen', naam: 'Binnenplan', item: o.binnen }];
  return [{
    id: 'p1', soort: 'plan', naam: 'Plan', laag_ids: l.laag_ids || [], fase: l.fase_ids?.[0] || null,
    verberg_elementen: o.verberg_elementen, verberg_soorten: o.verberg_soorten, verberg_items: o.verberg_items, beeld: o.beeld || undefined,
  }];
}

export function onderdelenVan(l) {
  const o = l?.opties?.onderdelen;
  return Array.isArray(o) ? o : afgeleid(l || {});
}

export const linkAan = (l) => !l.ingetrokken_op && !(l.geldig_tot && new Date(l.geldig_tot) < new Date());

// Lagen van een plan-onderdeel: gekozen lagen plus alles in de gekozen mappen. Niets gekozen = alles wat afgedrukt mag.
export function laagIdsVan(d, lagen) {
  if (!Array.isArray(d?.laag_ids) && !Array.isArray(d?.mappen)) return lagen.filter((l) => l.printbaar !== false).map((l) => l.id);
  const ids = new Set(d.laag_ids || []); const mappen = new Set(d.mappen || []);
  return lagen.filter((l) => ids.has(l.id) || (l.map && mappen.has(l.map))).map((l) => l.id);
}

// Wat van een plan-onderdeel op de kaart en in de PDF komt.
export function itemsVanOnderdeel(d, items, lagen) {
  const lg = new Set(laagIdsVan(d, lagen));
  const vEl = new Set(d.verberg_elementen || []); const vSo = new Set(d.verberg_soorten || []); const vIt = new Set(d.verberg_items || []);
  return items.filter((i) => !i.verborgen && (!i.laag_id || lg.has(i.laag_id))
    && (!d.fase || !i.fase_ids?.length || i.fase_ids.includes(d.fase))
    && !vIt.has(i.id) && (i.element_id ? !vEl.has(i.element_id) : !vSo.has(i.soort)));
}

// Korte omschrijving van een onderdeel voor de lijst.
export function onderdeelMeta(d, { lagen, fasen }) {
  if (d.soort === 'plan') {
    const n = laagIdsVan(d, lagen).length;
    const f = d.fase ? fasen.find((x) => x.id === d.fase)?.naam : null;
    const i = d.inst || {};
    const papier = i.papier === 'vrij' ? 'Vrij formaat' : i.papier || 'A3';
    const fijn = ['verberg_elementen', 'verberg_soorten', 'verberg_items'].some((k) => d[k]?.length);
    return [`${n} van ${lagen.length} lagen${d.mappen?.length ? ` (${d.mappen.length === 1 ? 'map' : 'mappen'} ${d.mappen.join(', ')})` : ''}`, fijn ? 'deels verborgen' : null, f ? `Fase ${f}` : 'Alle fasen', `${papier} · ${i.schaal ? `1:${Number(i.schaal).toLocaleString('nl-BE')}` : 'Passend'}`].filter(Boolean).join(' · ');
  }
  if (d.soort === 'werkplek') return 'Eigen PDF, niet in de link';
  if (d.soort === 'drie') return 'In de link: draaien en zoomen. Niet in de PDF.';
  if (d.soort === 'binnen') return 'In de link: alle verdiepingen en inrichting. Niet in de PDF.';
  return '';
}

// Rij voor maps.deel_links bij het bewaren van onderdelen. laag_ids blijft gevuld voor oudere schermen.
export function rijMetOnderdelen(link, onderdelen, lagen) {
  const o = { ...(link.opties || {}) };
  delete o.binnen; delete o.drie; delete o.verberg_elementen; delete o.verberg_soorten; delete o.verberg_items; delete o.beeld;
  const laag = new Set(); for (const d of onderdelen) if (d.soort === 'plan') laagIdsVan(d, lagen).forEach((x) => laag.add(x));
  return { opties: { ...o, onderdelen }, laag_ids: [...laag], fase_ids: null };
}

export const pdfVerouderd = (link, plan) => !!link.opties?.laatste_pdf && Number(link.opties.laatste_pdf.versie) < Number(plan.versie);
export const pdfOnderdelen = (lijst) => lijst.filter((d) => d.soort === 'plan' || d.soort === 'werkplek');
