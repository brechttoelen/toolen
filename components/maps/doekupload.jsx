'use client';

// "Nieuw doek" vanuit een bouwer (stelling, truss, frame-wand, tent): hetzelfde venster als overal
// (opladen of uit GridLab, en het bereik: dit event of de organisatie). Zie doekkiezer.jsx.
import { NieuwDoekKnop, NIEUW_ONTWERP } from './doekkiezer';

export { NIEUW_ONTWERP };

export function DoekUpload({ planId, drager = 'hek', onNieuw, klein = false }) {
  if (!planId) return null;
  return <NieuwDoekKnop planId={planId} drager={drager} onNieuw={onNieuw} klein={klein} tekst="Nieuw doek" />;
}
