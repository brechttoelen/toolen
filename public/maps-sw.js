/* Toolen Maps: offline voor de opbouwmodus.
   Enkel binnen /maps/. Kaarttegels (luchtfoto's, Sentinel-2, OpenFreeMap) worden bewaard voor offline gebruik,
   een bewaarde tegel komt meteen op het scherm en wordt op de achtergrond vernieuwd.
   Ook
   de glyphs, de bestanden van Toolen Maps en de app-bestanden worden bewaard.
   OpenStreetMap-tegels nooit (gebruiksvoorwaarden). */
const TEGELS = 'maps-tegels-v3';
const APP = 'maps-app-v1';
const tegelHost = (u) => u.hostname === 'geo.api.vlaanderen.be' || u.hostname === 'service.pdok.nl' || u.hostname === 'geoservices.wallonie.be' || u.hostname === 'tiles.maps.eox.at' || u.hostname === 'data.geopf.fr' || u.hostname === 'www.wms.nrw.de' || u.hostname === 'wmts1.geoportail.lu' || u.hostname === 'wmts.geo.admin.ch' || u.hostname === 'mapsneu.wien.gv.at' || u.hostname === 'www.ign.es' || u.hostname === 'tiles.openfreemap.org' || u.hostname === 'demotiles.maplibre.org'
  || (u.hostname.endsWith('.supabase.co') && u.pathname.includes('/storage/v1/object/public/maps/'));

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // Oude tegelcaches weg (bv. vaste luchtfotojaren).
  for (const k of await caches.keys()) if (k.startsWith('maps-tegels-') && k !== TEGELS) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'tile.openstreetmap.org') return;
  if (tegelHost(u)) {
    // Bewaarde tegel meteen tonen. Enkel een tegel ouder dan 14 dagen wordt op de achtergrond vernieuwd
    // (zo gaat niet elke tegel twee keer over het netwerk en wachten nieuwe tegels niet op vernieuwingen).
    // Zonder bewaarde tegel: ophalen, bij een netwerkfout nog één keer proberen (niet als de kaart ze al afbrak).
    e.respondWith(caches.open(TEGELS).then(async (c) => {
      const hit = await c.match(r);
      const haal = async () => {
        let res;
        try { res = await fetch(r); } catch (err) { if (r.signal?.aborted) throw err; await new Promise((ok) => setTimeout(ok, 400)); res = await fetch(r); }
        // Bewaren met het tijdstip erbij (een gewone CORS-respons toont geen datum aan de service worker).
        if (res.ok && res.type !== 'opaque') res.clone().blob().then((b) => c.put(r, new Response(b, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'image/png', 'x-fm-tijd': String(Date.now()) } }))).catch(() => {});
        else if (res.type === 'opaque') c.put(r, res.clone()).catch(() => {});
        return res;
      };
      if (hit) {
        const d = Number(hit.headers.get('x-fm-tijd')) || 0;
        if (d && Date.now() - d > 14 * 864e5) e.waitUntil(haal().catch(() => {}));
        return hit;
      }
      return haal();
    }));
    return;
  }
  if (u.origin === self.location.origin && u.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.open(APP).then(async (c) => (await c.match(r)) || fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; })));
    return;
  }
  if (u.origin === self.location.origin && r.mode === 'navigate' && u.pathname.startsWith('/maps/')) {
    e.respondWith(fetch(r).then((res) => { const k = res.clone(); caches.open(APP).then((c) => c.put(r, k)); return res; }).catch(() => caches.match(r)));
  }
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'leeg') caches.delete(TEGELS);
});
