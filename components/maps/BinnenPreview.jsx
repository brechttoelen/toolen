'use client';

// Voorvertoning van een binnenplan als je over het gebouw (icoon of label) zweeft:
// een kleine plattegrond van de ruimtes en wat er staat, met de belangrijkste cijfers.
import * as geo from './geo';
import { zitVan } from './BinnenScherm';

const binnen_ = (p, ring) => { let b = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) b = !b; } return b; };

const verdiepingenVan = (host) => {
  const v = host?.velden?.binnenplan?.verdiepingen;
  return Array.isArray(v) && v.length ? v : [{ id: 'g', naam: 'Gelijkvloers' }];
};

export default function BinnenPreview({ hostId, x, y, items, elementenMap }) {
  const host = items.find((i) => i.id === hostId);
  if (!host) return null;
  const binnen = items.filter((i) => i.velden?.binnen?.host === hostId);
  const vs = verdiepingenVan(host);
  const eerste = vs[0].id;
  const ruimtes = binnen.filter((i) => i.velden?.ruimte);
  const opEerste = binnen.filter((i) => (i.velden.binnen.verd || 'g') === eerste && i.geometrie);
  // Telling per element (zonder de ruimtes zelf).
  const tel = new Map();
  for (const i of binnen) {
    if (i.velden?.ruimte) continue;
    const n = i.element_id ? elementenMap.get(i.element_id)?.naam : null;
    if (n) tel.set(n, (tel.get(n) || 0) + 1);
  }
  const top = [...tel].sort((a, b) => b[1] - a[1]).slice(0, 4);
  // Per ruimte: m² en geplaatste zitplaatsen.
  const inr = binnen.filter((i) => !i.velden?.ruimte && i.geometrie);
  const perRuimte = ruimtes.filter((r) => r.geometrie?.type === 'Polygon').map((r) => {
    const ring = r.geometrie.coordinates[0];
    const zit = inr.filter((i) => (i.velden.binnen.verd || 'g') === (r.velden.binnen.verd || 'g')).reduce((a, i) => { const p = i.parameters?.midden || (i.geometrie.type === 'Point' ? i.geometrie.coordinates : i.geometrie.coordinates.flat(1)[0]); return a + (p && binnen_(p, ring) ? zitVan(elementenMap.get(i.element_id)) : 0); }, 0);
    let m2 = 0; try { m2 = Math.round(geo.oppervlakte ? geo.oppervlakte(r.geometrie) : 0); } catch { m2 = 0; }
    return { id: r.id, naam: r.naam || 'Ruimte', m2, zit, max: Number(r.velden?.max_personen) || 0 };
  });
  // Mini-plattegrond: alles van de eerste verdieping, in een kader van 240 × 140.
  const geoms = opEerste.map((i) => i.geometrie);
  if (host.geometrie?.type === 'Polygon') geoms.push(host.geometrie);
  const k = geoms.length ? geo.kader(geoms) : null;
  let svg = null;
  if (k && k[2] > k[0] && k[3] > k[1]) {
    const mLng = 111320 * Math.cos((((k[1] + k[3]) / 2) * Math.PI) / 180); const mLat = 110574;
    const w = (k[2] - k[0]) * mLng; const h = (k[3] - k[1]) * mLat;
    const s = Math.min(232 / w, 132 / h);
    const P = ([lng, lat]) => `${(((lng - k[0]) * mLng) * s + 4).toFixed(1)},${((((k[3] - lat) * mLat) * s) + 4).toFixed(1)}`;
    const pad = (g) => (g.type === 'Polygon' ? g.coordinates : g.type === 'LineString' ? [g.coordinates] : []).map((r) => `M${r.map(P).join('L')}${g.type === 'Polygon' ? 'Z' : ''}`).join('');
    svg = (
      <svg width={Math.ceil(w * s + 8)} height={Math.ceil(h * s + 8)} aria-hidden="true">
        {host.geometrie?.type === 'Polygon' && <path d={pad(host.geometrie)} fill="#F8FAFC" stroke="#1d1d1b" strokeWidth="1.2" />}
        {opEerste.filter((i) => i.velden?.ruimte).map((i) => <path key={i.id} d={pad(i.geometrie)} fill="#DBEAFE" stroke="#2563EB" strokeWidth="1" />)}
        {opEerste.filter((i) => !i.velden?.ruimte && i.geometrie.type !== 'Point').map((i) => <path key={i.id} d={pad(i.geometrie)} fill={i.geometrie.type === 'Polygon' ? '#94A3B8' : 'none'} stroke="#475569" strokeWidth="0.8" />)}
        {opEerste.filter((i) => i.geometrie.type === 'Point').map((i) => { const [a, b] = P(i.geometrie.coordinates).split(','); return <circle key={i.id} cx={a} cy={b} r="2" fill="#475569" />; })}
      </svg>
    );
  }
  const el = host.element_id ? elementenMap.get(host.element_id) : null;
  const naam = host.naam || (el?.eigenschappen?.binnenlocatie ? 'Binnenlocatie' : el?.naam) || 'Binnenplan';
  return (
    <div className="fm-zweef fm-binnenpreview" style={{ left: x + 16, top: y + 16 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>▦ {naam}</div>
      <div className="fm-sub">{vs.length} {vs.length === 1 ? 'verdieping' : 'verdiepingen'} · {ruimtes.length} {ruimtes.length === 1 ? 'ruimte' : 'ruimtes'} · {binnen.length - ruimtes.length} items</div>
      {svg ? <div className="fm-binnenpreview-plan">{svg}<span className="fm-sub">{vs[0].naam}</span></div> : <div className="fm-sub" style={{ padding: '8px 0' }}>Nog geen grondplan</div>}
      {perRuimte.length > 0 && (
        <div className="fm-binnenpreview-ruimtes">
          {perRuimte.slice(0, 5).map((r) => <div key={r.id}><span>{r.naam}</span><span className="fm-sub">{r.m2 ? `${r.m2} m²` : ''}{r.zit || r.max ? ` · ${r.zit}${r.max ? ` / ${r.max}` : ''} zitpl.` : ''}</span></div>)}
          {perRuimte.length > 5 && <div className="fm-sub">+{perRuimte.length - 5}</div>}
        </div>
      )}
      {top.length > 0 && <div className="fm-sub">{top.map(([n, c]) => `${c}× ${n}`).join(' · ')}</div>}
    </div>
  );
}
