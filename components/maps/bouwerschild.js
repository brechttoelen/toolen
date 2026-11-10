'use client';
// Bouwers (tent, stelling, truss, wand) liggen als scherm over de editor. Niets mag erdoor naar de kaart lekken:
// - de focus gaat weg van het kaartcanvas (anders verwijdert Delete/Backspace het geselecteerde item op de kaart);
// - toetsen in de bouwer gaan niet verder naar de kaart;
// - muis- en toetsgebeurtenissen van de bouwer borrelen niet op naar de panelen van de editor (React-portal).
import { useEffect } from 'react';

const LEK = new Set(['Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', ' ']);
export function useBouwerSchild() {
  useEffect(() => {
    try { document.activeElement?.blur?.(); } catch { /* */ }
    const stop = (e) => { if (LEK.has(e.key) || e.ctrlKey || e.metaKey) { const t = e.target; if (t?.closest?.('.fm-ws')) return; e.stopPropagation(); } };
    // In de bubbelfase op window: de eigen sneltoetsen van de bouwer (capture) zijn dan al gebeurd.
    document.addEventListener('keydown', stop, true);
    return () => document.removeEventListener('keydown', stop, true);
  }, []);
}
// pointerup laten we door: de 3D-besturing (three.js) luistert daar op het document naar; anders blijft draaien hangen.
export const schildProps = {
  onPointerDown: (e) => e.stopPropagation(), onMouseDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation(),
  onKeyDown: (e) => e.stopPropagation(), onWheel: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(),
};
