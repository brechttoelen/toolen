'use client';

// Wat de kaart nu toont (items, lagen, elementen), gedeeld met de blokken van de fiche op de kaart,
// en de bestellingen van het plan uit de databank. Zo tellen paneel en rechtermenu met dezelfde gegevens,
// live terwijl je plaatst.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { maps } from '../maps/db';

let stand = null;
const luisteraars = new Set();
const abonneer = (l) => { luisteraars.add(l); return () => luisteraars.delete(l); };
export function zetKaartStand(s) { stand = s; luisteraars.forEach((l) => l()); }
export const useKaartStand = () => useSyncExternalStore(abonneer, () => stand, () => null);

const cache = new Map();   // planId → { op, d }
const dataLuisteraars = new Set();
async function haal(planId, orgId) {
  const t = (naam) => maps().from(naam).select('*').eq('plan_id', planId);
  const [sl, br, lv, lev] = await Promise.all([t('site_leveranciers'), t('bestelregels'), t('leveringen'), maps().from('leveranciers').select('id, naam').eq('organisatie_id', orgId)]);
  const d = { site_leveranciers: sl.data || [], bestelregels: br.data || [], leveringen: lv.data || [], leveranciers: lev.data || [], taken: [] };
  cache.set(planId, { op: Date.now(), d });
  dataLuisteraars.forEach((l) => l());
  return d;
}
// Bestellingen van een plan; herlaadt als de gegevens ouder zijn dan een halve minuut.
export function useBestelData(planId, orgId) {
  const [, tik] = useState(0);
  useEffect(() => { const l = () => tik((n) => n + 1); dataLuisteraars.add(l); return () => dataLuisteraars.delete(l); }, []);
  const herlaad = useCallback(() => { if (planId && orgId) haal(planId, orgId).catch(() => {}); }, [planId, orgId]);
  useEffect(() => { const c = cache.get(planId); if (!c || Date.now() - c.op > 30000) herlaad(); }, [planId, herlaad]);
  return { d: cache.get(planId)?.d || null, herlaad };
}
