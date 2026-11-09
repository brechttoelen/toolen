'use client';

// Centrale leverancierslijst (maps.leveranciers): één keer geladen en gedeeld door alle schermen.
// Bibliotheek, items (velden.herkomst) en de standaardleveranciers van een plan verwijzen op naam.
import { useEffect, useState } from 'react';
import { maps } from './db';

let cache = null; let bezig = null; const luisteraars = new Set();
const meld = () => { for (const f of luisteraars) f(cache || []); };

export async function laadLeveranciers(opnieuw = false) {
  if (cache && !opnieuw) return cache;
  if (bezig && !opnieuw) return bezig;
  bezig = maps().from('leveranciers').select('*').order('naam').then(({ data, error }) => {
    bezig = null;
    if (error) return cache || [];
    cache = data || []; meld(); return cache;
  });
  return bezig;
}

export function useLeveranciers() {
  const [lijst, setLijst] = useState(cache || []);
  useEffect(() => { luisteraars.add(setLijst); laadLeveranciers().then(setLijst); return () => { luisteraars.delete(setLijst); }; }, []);
  return lijst;
}

// De naam zoals hij in de lijst staat (hoofdletters, spaties), of de getypte naam als hij er (nog) niet in staat.
export function juisteNaam(naam, lijst = cache || []) {
  const n = String(naam || '').trim(); if (!n) return '';
  const k = n.toLowerCase().replace(/\s+/g, ' ');
  return lijst.find((l) => l.naam.toLowerCase().replace(/\s+/g, ' ') === k)?.naam || n;
}

// Een nieuwe naam meteen in de lijst zetten (enkel de naam; contactgegevens vul je aan in Leveranciers).
export async function zorgLeverancier(naam) {
  const n = String(naam || '').trim(); if (!n) return '';
  const lijst = await laadLeveranciers();
  const juist = juisteNaam(n, lijst);
  if (lijst.some((l) => l.naam === juist)) return juist;
  const { error } = await maps().from('leveranciers').insert({ naam: n });
  if (!error) await laadLeveranciers(true);
  return n;
}

export const leveranciersVoor = (lijst, categorie) => lijst.filter((l) => l.actief !== false && (l.categorieen || []).includes(categorie));
