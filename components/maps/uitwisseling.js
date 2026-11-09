'use client';

// Import en export: KML/KMZ (Google My Maps, Google Earth), GPX, GeoJSON.
// Import levert lagen + items (nog niet bewaard); export maakt een bestand.

const KLEUREN_STANDAARD = ['#E11D48', '#2563EB', '#16865C', '#D97706', '#5B21B6', '#0E7490', '#B91C1C', '#DB2777'];

// KML-kleur is aabbggrr.
function kmlKleur(s) {
  const x = String(s || '').trim().replace('#', '');
  if (x.length !== 8) return null;
  return { kleur: `#${x.slice(6, 8)}${x.slice(4, 6)}${x.slice(2, 4)}`.toUpperCase(), dekking: parseInt(x.slice(0, 2), 16) / 255 };
}
function naarKmlKleur(hex, dekking = 1) {
  const x = String(hex || '#000000').replace('#', '');
  const a = Math.round(Math.max(0, Math.min(1, dekking)) * 255).toString(16).padStart(2, '0');
  return `${a}${x.slice(4, 6)}${x.slice(2, 4)}${x.slice(0, 2)}`;
}

const kind = (el, naam) => [...el.children].find((c) => c.localName === naam) || null;
const kinderen = (el, naam) => [...el.children].filter((c) => c.localName === naam);
const tekst = (el, naam) => kind(el, naam)?.textContent?.trim() || '';
const coords = (s) => s.trim().split(/\s+/).map((t) => t.split(',').map(Number)).filter((c) => c.length >= 2 && c.every(Number.isFinite)).map(([x, y]) => [x, y]);

function stripHtml(s) {
  if (!s) return '';
  const d = new DOMParser().parseFromString(`<div>${s.replace(/<br\s*\/?>/gi, '\n')}</div>`, 'text/html');
  return (d.body.textContent || '').trim();
}

function kmlStijlen(doc) {
  const stijlen = new Map();
  for (const st of doc.getElementsByTagNameNS('*', 'Style')) {
    const id = st.getAttribute('id');
    if (!id) continue;
    const ls = kind(st, 'LineStyle');
    const ps = kind(st, 'PolyStyle');
    const is = kind(st, 'IconStyle');
    const lijn = ls ? kmlKleur(tekst(ls, 'color')) : null;
    const vul = ps ? kmlKleur(tekst(ps, 'color')) : null;
    const icoon = is ? kmlKleur(tekst(is, 'color')) : null;
    const s = {};
    if (lijn) { s.kleur = lijn.kleur; if (lijn.dekking < 0.99) s.dekking = Math.round(lijn.dekking * 100) / 100; }
    if (ls && tekst(ls, 'width')) s.dikte = Math.max(1, Math.min(12, Number(tekst(ls, 'width')) || 2));
    if (vul) { s.vulkleur = vul.kleur; s.vuldekking = Math.round(vul.dekking * 100) / 100; if (ps && tekst(ps, 'fill') === '0') s.vulpatroon = 'geen'; }
    if (!s.kleur && icoon) s.kleur = icoon.kleur;
    stijlen.set(`#${id}`, s);
  }
  for (const sm of doc.getElementsByTagNameNS('*', 'StyleMap')) {
    const id = sm.getAttribute('id');
    const normaal = kinderen(sm, 'Pair').find((p) => tekst(p, 'key') === 'normal');
    if (id && normaal) stijlen.set(`#${id}`, stijlen.get(tekst(normaal, 'styleUrl')) || {});
  }
  return stijlen;
}

function geometrieen(pm) {
  const uit = [];
  const loop = (el) => {
    for (const c of el.children) {
      const n = c.localName;
      if (n === 'Point') { const k = coords(tekst(c, 'coordinates')); if (k[0]) uit.push({ type: 'Point', coordinates: k[0] }); }
      else if (n === 'LineString') { const k = coords(tekst(c, 'coordinates')); if (k.length >= 2) uit.push({ type: 'LineString', coordinates: k }); }
      else if (n === 'Polygon') {
        const buiten = kind(c, 'outerBoundaryIs');
        const ring = buiten ? kind(buiten, 'LinearRing') : null;
        const k = ring ? coords(tekst(ring, 'coordinates')) : [];
        if (k.length >= 3) { if (k[0][0] !== k[k.length - 1][0] || k[0][1] !== k[k.length - 1][1]) k.push(k[0]); uit.push({ type: 'Polygon', coordinates: [k] }); }
      } else if (n === 'MultiGeometry') loop(c);
    }
  };
  loop(pm);
  return uit;
}

function soortVoor(g) { return g.type === 'Point' ? 'punt' : g.type === 'LineString' ? 'lijn' : 'vlak'; }

export function leesKml(text, bestandsnaam = 'Import') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Dit KML-bestand is niet leesbaar.');
  const stijlen = kmlStijlen(doc);
  const lagen = new Map();
  const items = [];
  const laagVoor = (naam) => {
    const n = naam || bestandsnaam;
    if (!lagen.has(n)) lagen.set(n, { naam: n, kleur: null });
    return n;
  };
  for (const pm of doc.getElementsByTagNameNS('*', 'Placemark')) {
    // Laag = dichtstbijzijnde Folder (My Maps: één Folder per laag).
    let p = pm.parentElement;
    while (p && p.localName !== 'Folder' && p.localName !== 'Document') p = p.parentElement;
    const laag = laagVoor(p && p.localName === 'Folder' ? tekst(p, 'name') : (p ? tekst(p, 'name') : ''));
    const naam = tekst(pm, 'name');
    const extra = {};
    const ed = kind(pm, 'ExtendedData');
    if (ed) for (const d of kinderen(ed, 'Data')) { const k = d.getAttribute('name'); const v = tekst(d, 'value'); if (k && v && !/^gx_media/.test(k)) extra[k] = v; }
    let notitie = stripHtml(tekst(pm, 'description'));
    const extraTekst = Object.entries(extra).filter(([k]) => k !== 'description' && k !== 'naam' && k !== 'name').map(([k, v]) => `${k}: ${v}`).join('\n');
    if (extraTekst && !notitie.includes(extraTekst)) notitie = [notitie, extraTekst].filter(Boolean).join('\n');
    const stijl = { ...(stijlen.get(tekst(pm, 'styleUrl')) || {}) };
    const inline = kind(pm, 'Style');
    if (inline) {
      const ls = kind(inline, 'LineStyle'); const ps = kind(inline, 'PolyStyle');
      const l = ls ? kmlKleur(tekst(ls, 'color')) : null; const v = ps ? kmlKleur(tekst(ps, 'color')) : null;
      if (l) stijl.kleur = l.kleur; if (v) { stijl.vulkleur = v.kleur; stijl.vuldekking = Math.round(v.dekking * 100) / 100; }
      if (ls && tekst(ls, 'width')) stijl.dikte = Number(tekst(ls, 'width')) || 2;
    }
    for (const g of geometrieen(pm)) {
      items.push({ laag, soort: soortVoor(g), geometrie: g, naam: naam || null, notitie: notitie || null, stijl });
      if (!lagen.get(laag).kleur && stijl.kleur) lagen.get(laag).kleur = stijl.kleur;
    }
  }
  return { lagen: [...lagen.values()], items };
}

export function leesGpx(text, bestandsnaam = 'GPX') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Dit GPX-bestand is niet leesbaar.');
  const items = [];
  const pt = (el) => [Number(el.getAttribute('lon')), Number(el.getAttribute('lat'))];
  for (const trk of doc.getElementsByTagNameNS('*', 'trk')) {
    const naam = tekst(trk, 'name') || bestandsnaam;
    for (const seg of kinderen(trk, 'trkseg')) {
      const k = kinderen(seg, 'trkpt').map(pt).filter((c) => c.every(Number.isFinite));
      if (k.length >= 2) items.push({ laag: 'Parcours', soort: 'lijn', geometrie: { type: 'LineString', coordinates: k }, naam, stijl: {} });
    }
  }
  for (const rte of doc.getElementsByTagNameNS('*', 'rte')) {
    const k = kinderen(rte, 'rtept').map(pt).filter((c) => c.every(Number.isFinite));
    if (k.length >= 2) items.push({ laag: 'Parcours', soort: 'lijn', geometrie: { type: 'LineString', coordinates: k }, naam: tekst(rte, 'name') || bestandsnaam, stijl: {} });
  }
  for (const w of doc.getElementsByTagNameNS('*', 'wpt')) {
    items.push({ laag: 'Punten', soort: 'punt', geometrie: { type: 'Point', coordinates: pt(w) }, naam: tekst(w, 'name') || null, notitie: tekst(w, 'desc') || null, stijl: {} });
  }
  const lagen = [...new Set(items.map((i) => i.laag))].map((naam) => ({ naam, kleur: naam === 'Parcours' ? '#E11D48' : null }));
  return { lagen, items };
}

export function leesGeojson(text, bestandsnaam = 'GeoJSON') {
  const j = JSON.parse(text);
  const features = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [{ type: 'Feature', geometry: j, properties: {} }];
  const items = [];
  const plat = (g) => (g.type?.startsWith('Multi') ? g.coordinates.map((c) => ({ type: g.type.slice(5), coordinates: c })) : g.type === 'GeometryCollection' ? g.geometries.flatMap(plat) : [g]);
  for (const f of features) {
    if (!f?.geometry) continue;
    const p = f.properties || {};
    for (const g of plat(f.geometry)) {
      if (!['Point', 'LineString', 'Polygon'].includes(g.type)) continue;
      const geom = g.type === 'Polygon' ? { type: 'Polygon', coordinates: [g.coordinates[0].map(([x, y]) => [x, y])] } : g.type === 'LineString' ? { type: 'LineString', coordinates: g.coordinates.map(([x, y]) => [x, y]) } : { type: 'Point', coordinates: g.coordinates.slice(0, 2) };
      items.push({
        laag: p.laag || p.layer || p.folder || bestandsnaam, soort: p.soort || soortVoor(geom), geometrie: geom,
        naam: p.naam || p.name || p.title || null, notitie: p.notitie || p.description || null,
        stijl: p.stijl || (p.stroke || p.fill ? { kleur: p.stroke, vulkleur: p.fill, vuldekking: p['fill-opacity'], dikte: p['stroke-width'] } : {}),
      });
    }
  }
  const lagen = [...new Set(items.map((i) => i.laag))].map((naam) => ({ naam, kleur: null }));
  return { lagen, items };
}

// CSV of geplakte Excel-rijen: naam, adres of breedte-/lengtegraad, laag, notitie.
export function leesCsv(text, bestandsnaam = 'CSV') {
  const regels = text.replace(/^\ufeff/, '').split(/\r?\n/).filter((r) => r.trim());
  if (regels.length < 2) throw new Error('Geen rijen gevonden.');
  const sch = regels[0].includes('\t') ? '\t' : regels[0].includes(';') ? ';' : ',';
  const splits = (r) => {
    const uit = []; let cur = ''; let q = false;
    for (const ch of r) { if (ch === '"') q = !q; else if (ch === sch && !q) { uit.push(cur); cur = ''; } else cur += ch; }
    uit.push(cur); return uit.map((x) => x.trim());
  };
  const kop = splits(regels[0]).map((k) => k.toLowerCase());
  const k = (namen) => kop.findIndex((x) => namen.some((n) => x === n || x.startsWith(n)));
  const ix = { naam: k(['naam', 'name', 'titel']), lat: k(['lat', 'breedte', 'y']), lon: k(['lon', 'lng', 'lengte', 'x']), adres: k(['adres', 'address', 'locatie']), laag: k(['laag', 'layer', 'categorie']), notitie: k(['notitie', 'beschrijving', 'description', 'opmerking']) };
  const items = regels.slice(1).map((r) => {
    const c = splits(r);
    const lat = Number(String(c[ix.lat] ?? '').replace(',', '.'));
    const lon = Number(String(c[ix.lon] ?? '').replace(',', '.'));
    const geldig = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon);
    return {
      laag: (ix.laag >= 0 && c[ix.laag]) || bestandsnaam, soort: 'punt', naam: (ix.naam >= 0 && c[ix.naam]) || null,
      notitie: (ix.notitie >= 0 && c[ix.notitie]) || null, stijl: {},
      geometrie: geldig ? { type: 'Point', coordinates: [lon, lat] } : null, adres: !geldig && ix.adres >= 0 ? c[ix.adres] : null,
    };
  }).filter((i) => i.geometrie || i.adres);
  if (!items.length) throw new Error('Geen bruikbare rijen: geef kolommen naam en adres, of breedtegraad en lengtegraad.');
  const lagen = [...new Set(items.map((i) => i.laag))].map((naam) => ({ naam, kleur: null }));
  return { lagen, items };
}

// Adressen omzetten via Nominatim (OpenStreetMap), één per seconde.
export async function geocodeer(items, voortgang = () => {}) {
  let n = 0;
  for (const it of items) {
    if (it.geometrie || !it.adres) continue;
    n += 1;
    voortgang(`Adres ${n} zoeken: ${it.adres}`);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be,nl,fr,lu,de&q=${encodeURIComponent(it.adres)}`, { headers: { 'Accept-Language': 'nl' } });
      const j = await r.json();
      if (j[0]) it.geometrie = { type: 'Point', coordinates: [Number(j[0].lon), Number(j[0].lat)] };
    } catch {}
    await new Promise((ok) => setTimeout(ok, 1100));
  }
  return items.filter((i) => i.geometrie);
}

// Ingelezen lijnen (GPS-sporen uit GPX/KML/KMZ) hebben vaak honderden punten op een paar meter van elkaar:
// op de kaart onbewerkbaar (punten en bochtbolletjes over elkaar). Dubbele punten eruit en vereenvoudigen
// (Douglas-Peucker, standaard 0,4 m afwijking): de vorm blijft, de punten worden hanteerbaar.
export function vereenvoudigLijn(c, tol = 0.4) {
  if (!Array.isArray(c) || c.length < 3) return c;
  const lat0 = c[0][1]; const kx = 111320 * Math.cos((lat0 * Math.PI) / 180); const ky = 110574;
  const p = c.map(([x, y]) => [x * kx, y * ky]);
  const zonder = [0]; for (let i = 1; i < p.length; i++) { const q = p[zonder[zonder.length - 1]]; if (Math.hypot(p[i][0] - q[0], p[i][1] - q[1]) > 0.05) zonder.push(i); }
  if (zonder.length < 3) return zonder.map((i) => c[i]);
  const houd = new Uint8Array(zonder.length); houd[0] = 1; houd[zonder.length - 1] = 1;
  const stapel = [[0, zonder.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop(); const A = p[zonder[a]]; const B = p[zonder[b]]; const dx = B[0] - A[0]; const dy = B[1] - A[1]; const l2 = dx * dx + dy * dy;
    let max = -1; let k = -1;
    for (let i = a + 1; i < b; i++) {
      const P = p[zonder[i]]; let d;
      if (l2 < 1e-9) d = Math.hypot(P[0] - A[0], P[1] - A[1]);
      else { const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / l2)); d = Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy)); }
      if (d > max) { max = d; k = i; }
    }
    if (k > 0 && max > tol) { houd[k] = 1; stapel.push([a, k], [k, b]); }
  }
  return zonder.filter((_, i) => houd[i]).map((i) => [c[i][0], c[i][1]]);
}
const netjes = (r) => {
  const items = (r?.items || r || []);
  for (const it of Array.isArray(items) ? items : []) {
    const g = it.geometrie; if (!g) continue;
    if (g.type === 'LineString') it.geometrie = { type: 'LineString', coordinates: vereenvoudigLijn(g.coordinates) };
    else if (g.type === 'Polygon') { const ring = vereenvoudigLijn(g.coordinates[0]); if (ring.length >= 4) it.geometrie = { type: 'Polygon', coordinates: [ring] }; }
  }
  return r;
};

export async function leesBestand(bestand) {
  return netjes(await leesBestand0(bestand));
}
async function leesBestand0(bestand) {
  const naam = bestand.name.replace(/\.[^.]+$/, '');
  const ext = (bestand.name.split('.').pop() || '').toLowerCase();
  if (ext === 'kmz') {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await bestand.arrayBuffer());
    const kml = Object.values(zip.files).find((f) => /\.kml$/i.test(f.name));
    if (!kml) throw new Error('Geen KML gevonden in dit KMZ-bestand.');
    return leesKml(await kml.async('string'), naam);
  }
  const text = await bestand.text();
  if (ext === 'kml') return leesKml(text, naam);
  if (ext === 'gpx') return leesGpx(text, naam);
  if (ext === 'geojson' || ext === 'json') return leesGeojson(text, naam);
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') return leesCsv(text, naam);
  if (ext === 'xlsx' || ext === 'xls') throw new Error('Bewaar het Excel-blad als CSV (Bestand → Opslaan als → CSV) en kies dat bestand.');
  throw new Error('Kies een KML, KMZ, GPX, GeoJSON of CSV-bestand.');
}

// ---------- Export ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kc = (c) => c.map(([x, y]) => `${x},${y},0`).join(' ');

export function naarKml({ plan, lagen, items, stijlVan }) {
  const delen = [];
  delen.push('<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>');
  delen.push(`<name>${esc(plan.naam)}</name>`);
  const perLaag = new Map();
  for (const it of items) { const k = it.laag_id || ''; if (!perLaag.has(k)) perLaag.set(k, []); perLaag.get(k).push(it); }
  for (const [laagId, lijst] of perLaag) {
    const laag = lagen.find((l) => l.id === laagId);
    delen.push(`<Folder><name>${esc(laag?.naam || 'Zonder laag')}</name>`);
    for (const it of lijst) {
      const s = stijlVan(it);
      const g = it.geometrie;
      let geo = '';
      if (g.type === 'Point') geo = `<Point><coordinates>${kc([g.coordinates])}</coordinates></Point>`;
      else if (g.type === 'LineString') geo = `<LineString><tessellate>1</tessellate><coordinates>${kc(g.coordinates)}</coordinates></LineString>`;
      else if (g.type === 'Polygon') geo = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${kc(g.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      else continue;
      const stijl = `<Style><LineStyle><color>${naarKmlKleur(s.kleur, s.dekking ?? 1)}</color><width>${Number(s.dikte) || 2}</width></LineStyle><PolyStyle><color>${naarKmlKleur(s.vulkleur || s.kleur, s.vulpatroon === 'geen' ? 0 : (s.vuldekking ?? 0.2))}</color></PolyStyle><IconStyle><color>${naarKmlKleur(s.kleur)}</color></IconStyle></Style>`;
      delen.push(`<Placemark><name>${esc(it.naam || '')}</name>${it.notitie ? `<description>${esc(it.notitie)}</description>` : ''}${stijl}${geo}</Placemark>`);
    }
    delen.push('</Folder>');
  }
  delen.push('</Document></kml>');
  return delen.join('\n');
}

export function naarGeojsonBestand({ lagen, items, stijlVan }) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: items.map((it) => {
      const s = stijlVan(it);
      return {
        type: 'Feature', geometry: it.geometrie,
        properties: { naam: it.naam, laag: lagen.find((l) => l.id === it.laag_id)?.naam || null, soort: it.soort, notitie: it.notitie, stroke: s.kleur, 'stroke-width': Number(s.dikte) || 2, fill: s.vulkleur || s.kleur, 'fill-opacity': s.vuldekking ?? 0.2, velden: it.velden || {} },
      };
    }),
  }, null, 1);
}

export function download(inhoud, naam, type) {
  const blob = new Blob([inhoud], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = naam.replace(/[\\/:*?"<>|]/g, '');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export { KLEUREN_STANDAARD };
