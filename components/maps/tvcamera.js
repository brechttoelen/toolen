// TV-camera's op een camerastelling: welke camera (lens, bv. 86x of 24x) en hoe ze staat (op statief of los).
// velden.tvcamera = { lens: '86x', opstelling: 'statief' | 'los' (handheld) | 'kraan' }
// Een camerastelling is een bibliotheekstelling met de tag "camerastelling", of een gebouwde stelling met een
// camera op het dek (velden.stelling.camera, zie stellingbouw.js). Lens en opstelling staan altijd in velden.tvcamera.
import { cameraPlek, stellingKader, stellingMaten } from './stellingbouw';

export const LENZEN = ['86x', '100x', '24x', '22x', '14x', '7x', 'Groothoek', 'Super slow motion', 'Marshall'];
export const OPSTELLINGEN = [['statief', 'Op statief'], ['los', 'Handheld (schouder)'], ['kraan', 'Op een kraan']];
// Losse camera uit de bibliotheek (op statief, handheld, Marshal): eigenschappen.tvcamera met de vaste opstelling.
export const isLosseTvCamera = (el) => !!el?.eigenschappen?.tvcamera;
export const isCameraStelling = (el, it = null) => (!!el && ((el.eigenschappen?.tags || []).includes('camerastelling') || /camerastelling/i.test(el.naam || ''))) || !!it?.velden?.stelling?.camera;
// Vanaf dit zoomniveau tekent de kaart een camerastelling zelf; daaronder is ze een bolletje met label.
export const CAMERA_ZOOM = 18.5;
// Verder uitgezoomd dan dit verdwijnt ook het bolletje (anders hangt de kaart vol camera's op overzichtsniveau).
export const CAMERA_MIN = 16;

const r1 = (v) => (Math.round(Number(v) * 10) / 10).toLocaleString('nl-BE');
// Hoogte van het dek onder de camera: gebouwd uit de stelling, anders uit het element (hoogte_m of "h 1,5 m" in de naam).
export function camHoogte(it, el) {
  const p = it?.velden?.stelling?.camera ? cameraPlek(it.velden.stelling) : null;
  if (p) return p.h;
  return Number(el?.hoogte_m) || Number(/h\s*(\d+[,.]?\d*)/i.exec(el?.naam || '')?.[1]?.replace(',', '.')) || null;
}
// Korte maat van de stelling: "Stelling 2 × 2 m · h 1,5 m".
function stellingMaat(el, it) {
  const st = it?.velden?.stelling;
  if (st?.camera) {
    const p = cameraPlek(st); const K = stellingKader(st, true); const M = stellingMaten(st);
    const b = K.leeg ? null : Math.round(M.x(K.i1) - M.x(K.i0)); const d = K.leeg ? null : Math.round(M.y(K.j1) - M.y(K.j0));
    return [b && d ? `Stelling ${b} × ${d} m` : 'Stelling', p ? `h ${r1(p.h)} m` : ''].filter(Boolean).join(' · ');
  }
  const m = /(\d+[,.]?\d*)\s*×\s*(\d+[,.]?\d*)/.exec(el?.naam || '');
  const b = m ? Math.round(Number(m[1].replace(',', '.'))) : null; const d = m ? Math.round(Number(m[2].replace(',', '.'))) : null;
  const h = camHoogte(it, el);
  return [b && d ? `Stelling ${b} × ${d} m` : 'Stelling', h ? `h ${r1(h)} m` : ''].filter(Boolean).join(' · ');
}
// "Stelling 2 × 2 m · h 1,5 m · Camera 86x · op statief"
export function tvCamTekst(it, el) {
  if (isLosseTvCamera(el) && !isCameraStelling(el, it)) {
    const c = { ...el.eigenschappen.tvcamera, ...(it?.velden?.tvcamera || {}) };
    return [c.lens ? `Camera ${c.lens}` : 'Camera', OPSTELLINGEN.find(([k]) => k === c.opstelling)?.[1]?.toLowerCase() || ''].filter(Boolean).join(' · ');
  }
  if (!isCameraStelling(el, it)) return '';
  const c = it?.velden?.tvcamera || {};
  const op = OPSTELLINGEN.find(([k]) => k === c.opstelling)?.[1];
  return [stellingMaat(el, it), c.lens ? `Camera ${c.lens}` : '', op ? op.toLowerCase() : ''].filter(Boolean).join(' · ');
}
// Label van het bolletje op de kaart (uitgezoomd), zoals een camerapunt: "CAM4 86x op 1,5 m".
export function camStipTekst(it, el) {
  const c = { ...(el?.eigenschappen?.tvcamera || {}), ...(it?.velden?.tvcamera || {}) }; const h = camHoogte(it, el);
  return [it?.naam || el?.naam || 'Camera', c.lens || '', h ? `op ${r1(h)} m` : ''].filter(Boolean).join(' ');
}
