// Street View in een nieuw tabblad (een link naar Google Maps; de beelden zelf komen niet in de kaart of de PDF).
// Google springt vanzelf naar het dichtste beeld op de weg als er op dat punt geen is.
export function streetViewUrl([lng, lat], kijkrichting = null) {
  const h = kijkrichting != null && Number.isFinite(Number(kijkrichting)) ? `&heading=${Math.round(((Number(kijkrichting) % 360) + 360) % 360)}` : '';
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}${h}`;
}
export function openStreetView(p, kijkrichting = null) {
  if (!p || typeof window === 'undefined') return;
  window.open(streetViewUrl(p, kijkrichting), '_blank', 'noopener');
}
