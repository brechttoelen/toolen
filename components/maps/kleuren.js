// Eén FLCS-kleurenpalet voor punten, lijnen, vlakken, lagen en borden.
export const PALET = [
  ['#1d1d1b', 'Zwart'], ['#E11D48', 'Rood'], ['#B91C1C', 'Donkerrood'], ['#D97706', 'Oranje'],
  ['#EAB308', 'Geel'], ['#16865C', 'Groen'], ['#0E7490', 'Petrol'], ['#2563EB', 'Blauw'],
  ['#5B21B6', 'Paars'], ['#DB2777', 'Roze'], ['#686D76', 'Grijs'], ['#ffffff', 'Wit'],
];
export const PALET_HEX = PALET.map(([k]) => k);
export const kleurNaam = (hex) => PALET.find(([k]) => k.toLowerCase() === String(hex || '').toLowerCase())?.[1] || hex;
