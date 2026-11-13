// MapLibre 6 laadt zijn rekenwerk (worker) als apart bestand. Dat bestand staat in public/m/ (gekopieerd bij het bouwen,
// zie package.json "prebuild"), zodat het van het eigen adres komt en met de versie van de bibliotheek meegaat.
import { setWorkerUrl, getVersion } from 'maplibre-gl';

if (typeof window !== 'undefined') {
  try { setWorkerUrl(`/m/maplibre-worker.mjs?v=${getVersion()}`); } catch { /* oudere versie: niet nodig */ }
}
