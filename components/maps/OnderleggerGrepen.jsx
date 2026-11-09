'use client';

// Een achtergrondtekening (onderlegger) rechtstreeks op de kaart aanpassen:
// slepen = verschuiven, hoekjes = groter of kleiner (verhouding blijft), bolletje = draaien
// (Shift = per 15°). Tijdens het slepen beweegt de tekening live mee; loslaten bewaart.
import { useEffect, useRef, useState } from 'react';
import { hoeken, toonLive } from './onderlegger';

const MPG = 111320;
const getal = (v, d = 1) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: d });

export default function OnderleggerGrepen({ map, o, onKlaar, onStop, onDekking }) {
  const [, setTik] = useState(0);
  const [live, setLive] = useState(null); // aangepaste onderlegger tijdens het slepen
  const sleep = useRef(null);
  const nu = live || o;
  const schaalVast = o.vast || (o.soort === 'dxf' && o.natuur); // echte maten: enkel verschuiven en draaien

  useEffect(() => {
    if (!map) return undefined;
    const f = () => setTik((t) => t + 1);
    map.on('move', f); map.on('resize', f);
    return () => { map.off('move', f); map.off('resize', f); };
  }, [map]);
  useEffect(() => { setLive(null); }, [o]);
  useEffect(() => {
    const t = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onStop?.(); };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [onStop]);

  if (!map || !nu?.midden) return null;
  const pt = (ll) => { const p = map.project(ll); return [p.x, p.y]; };
  const h = hoeken(nu).map(pt); // linksboven, rechtsboven, rechtsonder, linksonder
  const c = pt(nu.midden);
  const boven = [(h[0][0] + h[1][0]) / 2, (h[0][1] + h[1][1]) / 2];
  const len = Math.hypot(boven[0] - c[0], boven[1] - c[1]) || 1;
  const greep = [boven[0] + ((boven[0] - c[0]) / len) * 28, boven[1] + ((boven[1] - c[1]) / len) * 28];

  const start = (e, soort) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = map.getCanvasContainer().getBoundingClientRect();
    sleep.current = { soort, x0: e.clientX - r.left, y0: e.clientY - r.top, o0: { ...nu }, c0: c };
  };
  const beweeg = (e) => {
    const s = sleep.current; if (!s) return;
    const r = map.getCanvasContainer().getBoundingClientRect();
    const x = e.clientX - r.left; const y = e.clientY - r.top;
    let n = s.o0;
    if (s.soort === 'schuif') {
      const a = map.unproject([s.c0[0] + (x - s.x0), s.c0[1] + (y - s.y0)]);
      n = { ...s.o0, midden: [a.lng, a.lat] };
    } else if (s.soort === 'schaal') {
      const k = Math.hypot(x - s.c0[0], y - s.c0[1]) / Math.max(1, Math.hypot(s.x0 - s.c0[0], s.y0 - s.c0[1]));
      n = { ...s.o0, breedte: Math.max(2, (Number(s.o0.breedte) || 100) * k) };
    } else if (s.soort === 'draai') {
      const a0 = Math.atan2(s.y0 - s.c0[1], s.x0 - s.c0[0]); const a1 = Math.atan2(y - s.c0[1], x - s.c0[0]);
      let rot = (Number(s.o0.rot) || 0) + ((a1 - a0) * 180) / Math.PI;
      rot = e.shiftKey ? Math.round(rot / 15) * 15 : Math.round(rot * 10) / 10;
      n = { ...s.o0, rot: ((rot % 360) + 360) % 360 };
    }
    s.n = n;
    toonLive(map, n);
    setLive(n);
  };
  const los = () => {
    const s = sleep.current; sleep.current = null;
    if (s?.n) onKlaar(s.n);
  };

  const ev = { onPointerMove: beweeg, onPointerUp: los, onPointerCancel: los };
  const pad = h.map((p) => p.join(',')).join(' ');
  return (
    <div className="fm-olgrepen">
      <svg className="fm-olgrepen-svg">
        <polygon points={pad} className="fm-olgrepen-vlak" onPointerDown={(e) => start(e, 'schuif')} {...ev} />
        <line x1={boven[0]} y1={boven[1]} x2={greep[0]} y2={greep[1]} className="fm-olgrepen-steel" />
        <circle cx={greep[0]} cy={greep[1]} r={7} className="fm-olgrepen-draai" onPointerDown={(e) => start(e, 'draai')} {...ev} />
        {!schaalVast && h.map((p, i) => (
          <rect key={i} x={p[0] - 6} y={p[1] - 6} width={12} height={12} className="fm-olgrepen-hoek" style={{ cursor: i % 2 ? 'nesw-resize' : 'nwse-resize' }}
            onPointerDown={(e) => start(e, 'schaal')} {...ev} />
        ))}
      </svg>
      <div className="fm-olgrepen-balk">
        <strong className="fm-afkap">{o.naam || 'Achtergrondtekening'}</strong>
        <span className="fm-sub">{schaalVast ? 'echte maat' : `${getal(nu.breedte, 0)} m breed`} · {getal(nu.rot, 0)}°</span>
        {onDekking && <label className="fm-sub" title="Doorzichtigheid">Dekking <input type="range" min="0.1" max="1" step="0.05" value={o.dekking ?? 0.7} onChange={(e) => onDekking(Number(e.target.value))} /></label>}
        <button className="fm-knop klein zwart" onClick={onStop}>Klaar</button>
      </div>
    </div>
  );
}

// Startbreedte zodat een nieuwe tekening ongeveer het zichtbare kaartbeeld vult.
export function zichtbareBreedte(map, aandeel = 0.6) {
  const b = map.getBounds(); const lat = map.getCenter().lat;
  return Math.max(20, Math.round((b.getEast() - b.getWest()) * MPG * Math.cos((lat * Math.PI) / 180) * aandeel));
}
