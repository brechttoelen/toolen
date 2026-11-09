// Kabelcamera (Eurogrip Flyline): een kabel tussen twee verreikers (Manitou), nooit aan eigen masten.
// Het item is een lijn van verreiker A naar verreiker B; de camera hangt aan de kabel op velden.kabelcam.t (0..1)
// en kijkt velden.kabelcam.kijk graden (met de klok mee) naast de richting A → B. Elk uiteinde krijgt de tekening
// van de gekozen verreiker (velden.kabelcam.verreiker, anders eigenschappen.kabelcam.verreiker van het element),
// met de voorkant naar de overkant: de kabel hangt aan de top van de giek.
import { tekeningFeatures } from './tekening';

export const isKabelcam = (el) => !!el?.eigenschappen?.kabelcam;
const KX = (lat) => 111320 * Math.cos((lat * Math.PI) / 180); const KY = 110574;
export const KABELCAM_SECTOR = { r: 12, hoek: 30 };

export function kabelcamInst(it, el) {
  const e = el?.eigenschappen?.kabelcam || {}; const v = it?.velden?.kabelcam || {};
  const t = Number.isFinite(Number(v.t)) ? Math.max(0, Math.min(1, Number(v.t))) : 0.5;
  return { t, kijk: Number(v.kijk) || 0, verreiker: v.verreiker || e.verreiker || null, hoogte: Number(v.hoogte) || Number(e.hoogte) || null, maxSpan: Number(e.max_span) || null };
}

// Geometrie in meters rond het eerste punt: uiteinden, span, camerapunt en kijkrichting.
export function kabelcamGeo(it, el) {
  const c = it?.geometrie?.type === 'LineString' ? it.geometrie.coordinates : null;
  if (!c || c.length < 2) return null;
  const A = c[0]; const B = c[c.length - 1]; const kx = KX(A[1]);
  const dx = (B[0] - A[0]) * kx; const dy = (B[1] - A[1]) * KY; const span = Math.hypot(dx, dy);
  if (span < 0.5) return null;
  const u = [dx / span, dy / span]; const inst = kabelcamInst(it, el);
  const naar = ([x, y]) => [A[0] + x / kx, A[1] + y / KY];
  const cam = naar([u[0] * span * inst.t, u[1] * span * inst.t]);
  const r = (inst.kijk * Math.PI) / 180; const d = [u[0] * Math.cos(r) + u[1] * Math.sin(r), -u[0] * Math.sin(r) + u[1] * Math.cos(r)]; // met de klok mee
  const peiling = (v) => (Math.atan2(v[0], v[1]) * 180) / Math.PI; // 0 = noord, met de klok mee
  return { A, B, span, u, cam, d, kx, naar, inst, peiling };
}

export function kabelcamTekst(it, el) {
  const g = kabelcamGeo(it, el); if (!g) return '';
  const n = Math.round(g.span);
  return [`Kabelcam · span ${n} m`, g.inst.hoogte ? `kabel op ${String(g.inst.hoogte).replace('.', ',')} m` : '', `camera op ${Math.round(g.inst.t * n)} m van A`].filter(Boolean).join(' · ');
}

export function kabelcamMeldingen(it, el, elementenMap) {
  const g = kabelcamGeo(it, el); if (!g) return [];
  const m = [];
  if (g.inst.maxSpan && g.span > g.inst.maxSpan) m.push(`Span ${Math.round(g.span)} m is langer dan ${g.inst.maxSpan} m: vraag na bij Eurogrip.`);
  if (!g.inst.verreiker || !elementenMap?.get(g.inst.verreiker)) m.push('Geen verreiker gekozen voor de uiteinden.');
  return m;
}

// Kaartfeatures: verreikers aan beide kanten, de camera op de kabel met haar kijkhoek en een label.
export function kabelcamFeatures(it, el, elementenMap, basis) {
  const g = kabelcamGeo(it, el); if (!g) return { vormen: [], labels: [] };
  const vormen = []; const labels = [];
  const vr = g.inst.verreiker ? elementenMap.get(g.inst.verreiker) : null;
  const tek = vr?.eigenschappen?.tekening;
  for (const [P, richting] of [[g.A, g.u], [g.B, [-g.u[0], -g.u[1]]]]) {
    const b = Number(vr?.breedte_m) || 7.5; const dpt = Number(vr?.diepte_m) || 2.4;
    const kx = KX(P[1]);
    const midden = [P[0] - (richting[0] * b) / 2 / kx, P[1] - (richting[1] * b) / 2 / KY];
    const rot = g.peiling(richting) - 90; // +x van de tekening (voorkant) naar de overkant
    if (tek) vormen.push(...tekeningFeatures(tek, { id: it.id, parameters: { midden, rot, breedte: b, diepte: dpt } }, { breedte_m: tek.b || b, diepte_m: tek.h || dpt }, basis).vormen);
    else {
      const hb = b / 2; const hd = dpt / 2; const ex = [richting[0], richting[1]]; const ny = [-richting[1], richting[0]];
      const hoek = (sx, sy) => [midden[0] + (ex[0] * sx * hb + ny[0] * sy * hd) / kx, midden[1] + (ex[1] * sx * hb + ny[1] * sy * hd) / KY];
      vormen.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[hoek(-1, -1), hoek(1, -1), hoek(1, 1), hoek(-1, 1), hoek(-1, -1)]] }, properties: { ...basis, vorm: 'vlak', kleur: '#7F1D1D', vulkleur: '#C8102E', vuldekking: 0.85, dikte: 1, dikte_m: 0, streep: 'vol', patroon: '' } });
    }
  }
  // Kijkhoek van de camera (op de grond geprojecteerd) en de camera zelf.
  const sec = [g.cam]; const n = 12; const R = KABELCAM_SECTOR.r; const kx = KX(g.cam[1]);
  for (let k = 0; k <= n; k++) {
    const a = ((-KABELCAM_SECTOR.hoek + (2 * KABELCAM_SECTOR.hoek * k) / n) * Math.PI) / 180;
    const v = [g.d[0] * Math.cos(a) + g.d[1] * Math.sin(a), -g.d[0] * Math.sin(a) + g.d[1] * Math.cos(a)];
    sec.push([g.cam[0] + (v[0] * R) / kx, g.cam[1] + (v[1] * R) / KY]);
  }
  sec.push(g.cam);
  vormen.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [sec] }, properties: { ...basis, vorm: 'vlak', kleur: '#B45309', vulkleur: '#FDE68A', vuldekking: 0.35, dikte: 1, dikte_m: 0, streep: 'vol', dekking: 0.9, patroon: '' } });
  vormen.push({ type: 'Feature', geometry: { type: 'Point', coordinates: g.cam }, properties: { ...basis, vorm: 'punt', soort: 'kabelcam', kleur: '#0F766E', dekking: 1, icoon: 'camera', icoon_m: 0, nr: '' } });
  labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: g.cam }, properties: { id: it.id, soort: 'label', punt: true, label: [it.naam || 'Kabelcam', `span ${Math.round(g.span)} m`].join('\n'), maat: '', kleur: '#0F766E', tekstgrootte: 12, tekst_rot: 0, vet: true, cursief: false, achtergrond: false } });
  return { vormen, labels };
}
