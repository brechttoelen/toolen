'use client';

// Waar je bent in een scherm (tab, open bestelling, weergave …) staat in de adresbalk, zodat vorige, volgende
// en vernieuwen je terugbrengen naar dezelfde plek. Elke stap die je zelf zet, is een stap in de geschiedenis.
import { useCallback, useEffect, useState } from 'react';

const EVENT = 'toolen-url';
const lees = (k) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k));

// Meerdere sleutels tegelijk; null of '' haalt een sleutel weg. vervang = geen nieuwe stap in de geschiedenis.
export function zetUrl(waarden, { vervang = false } = {}) {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(waarden)) { if (v == null || v === '') u.searchParams.delete(k); else u.searchParams.set(k, String(v)); }
  if (u.href === window.location.href) return;
  if (vervang) window.history.replaceState(null, '', u.href); else window.history.pushState(null, '', u.href);
  window.dispatchEvent(new Event(EVENT));
}

// Eén waarde uit de adresbalk, met een standaard die er niet in komt te staan.
export function useUrlStaat(sleutel, standaard = null, { geldig = null, vervang = false } = {}) {
  const uit = useCallback(() => { const v = lees(sleutel); return v != null && (!geldig || geldig(v)) ? v : standaard; }, [sleutel, standaard, geldig]);
  const [w, setW] = useState(uit);
  useEffect(() => {
    const f = () => setW(uit());
    window.addEventListener('popstate', f); window.addEventListener(EVENT, f);
    return () => { window.removeEventListener('popstate', f); window.removeEventListener(EVENT, f); };
  }, [uit]);
  const zet = useCallback((v, opties = {}) => { setW(v ?? standaard); zetUrl({ [sleutel]: v === standaard ? null : v }, { vervang: opties.vervang ?? vervang }); }, [sleutel, standaard, vervang]);
  return [w, zet];
}
