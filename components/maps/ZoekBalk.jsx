'use client';

import { useState } from 'react';

// Zoeken: items in dit plan (meteen) en adressen of plaatsen (Enter, via OpenStreetMap).
export default function ZoekBalk({ items, elementenMap, lagenMap, kaart, onKiesItem }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [plaatsen, setPlaatsen] = useState(null);
  const [bezig, setBezig] = useState(false);
  const z = q.trim().toLowerCase();
  const treffers = z.length < 2 ? [] : items.filter((i) => {
    const el = i.element_id ? elementenMap.get(i.element_id) : null;
    return [i.naam, el?.naam, i.notitie, lagenMap.get(i.laag_id)?.naam, i.velden?.nr].some((t) => t != null && String(t).toLowerCase().includes(z));
  }).slice(0, 8);
  const zoekPlaats = async () => {
    if (z.length < 3) return;
    setBezig(true);
    try {
      const c = kaart()?.getCenter();
      const vb = c ? `&viewbox=${c.lng - 0.6},${c.lat + 0.4},${c.lng + 0.6},${c.lat - 0.4}` : '';
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=nl${vb}&q=${encodeURIComponent(q.trim())}`);
      setPlaatsen(r.ok ? await r.json() : []);
    } catch { setPlaatsen([]); }
    setBezig(false);
  };
  const naam = (i) => i.naam || elementenMap.get(i.element_id)?.naam || i.soort;
  return (
    <div className="fm-zoek" onClick={(e) => e.stopPropagation()}>
      <input type="search" value={q} placeholder="Zoek in plan of adres…" aria-label="Zoeken"
        onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setPlaatsen(null); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter') zoekPlaats(); if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); } }}
        onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && z.length >= 2 && (
        <div className="fm-zoek-lijst">
          {treffers.length > 0 && <div className="kop">In dit plan</div>}
          {treffers.map((i) => (
            <button key={i.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onKiesItem(i.id); setOpen(false); }}>
              <span>{naam(i)}</span><small>{lagenMap.get(i.laag_id)?.naam || ''}</small>
            </button>
          ))}
          <div className="kop">Adres of plaats</div>
          {plaatsen === null && <button onMouseDown={(e) => e.preventDefault()} onClick={zoekPlaats}>{bezig ? 'Zoeken…' : `Zoek "${q.trim()}" op de kaart (Enter)`}</button>}
          {plaatsen?.length === 0 && <div className="leeg">Niets gevonden.</div>}
          {plaatsen?.map((p) => (
            <button key={p.place_id} onMouseDown={(e) => e.preventDefault()} onClick={() => {
              const m = kaart(); if (!m) return;
              const b = p.boundingbox?.map(Number);
              if (b) m.fitBounds([[b[2], b[0]], [b[3], b[1]]], { padding: 40, maxZoom: 18 });
              else m.flyTo({ center: [Number(p.lon), Number(p.lat)], zoom: 17 });
              setOpen(false);
            }}>
              <span>{p.display_name.split(',').slice(0, 2).join(',')}</span><small>{p.display_name.split(',').slice(2, 4).join(',')}</small>
            </button>
          ))}
          <div className="bron">Adressen © OpenStreetMap-bijdragers</div>
        </div>
      )}
    </div>
  );
}
