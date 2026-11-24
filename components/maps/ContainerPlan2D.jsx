'use client';

// Containerbouwer · bovenaanzicht: vrij bouwen. Units slepen (kleven aan randen en hoeken van andere units,
// Alt = niet kleven), draaien met de greep (Shift = per 15°), uit de lijst op het plan slepen, en per verdieping
// zien waar je kan stapelen. Werkt in het vaste kader van de bouwer (meter, x naar rechts, y naar boven).
import { useEffect, useMemo, useRef, useState } from 'react';
import { veelhoekenOverlap, gevelLijn, stapelMax, isAutoEl, heeftGlas } from './containerbouw';

const KLEEF_PX = 12;
const ringOm = (mid, L, B, hoek) => {
  const c = Math.cos(hoek); const s = Math.sin(hoek);
  return [[-L / 2, -B / 2], [L / 2, -B / 2], [L / 2, B / 2], [-L / 2, B / 2]].map(([x, y]) => [mid[0] + x * c - y * s, mid[1] + x * s + y * c]);
};
const binnen = (p, ring) => { let i = false; for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) { const [xi, yi] = ring[k]; const [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) i = !i; } return i; };
const opSeg = (p, a, b) => { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return [a[0] + t * dx, a[1] + t * dy]; };

// Hoek van een unit in het kader (radialen, tegen de klok in): de lange as van de ring.
const hoekVan = (ring) => Math.atan2(ring[1][1] - ring[0][1], ring[1][0] - ring[0][0]);

export default function ContainerPlan2D({ groep, A, sel, onKies, verd, schrijven, lijstEl, onWijzig, onPlaats, onMelding }) {
  const svgRef = useRef(null);
  const [maat, setMaat] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = svgRef.current?.parentElement; if (!el) return undefined;
    const ro = new ResizeObserver(() => setMaat({ w: el.clientWidth || 800, h: el.clientHeight || 600 })); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Units met hun ring en midden in het kader.
  const units = useMemo(() => groep.filter((g) => g.hk && g.T).map((g) => ({ g, ring: g.hk, mid: g.T([g.Lu / 2, g.Bu / 2]), L: g.Lu, B: g.Bu, trap: !!g.trap, auto: !!g.auto })), [groep]);

  // Beeld: in het begin passend rond alle units.
  const [beeld, setBeeld] = useState(null);
  useEffect(() => {
    if (beeld || !units.length || !maat.w) return;
    const xs = units.flatMap((u) => u.ring.map((q) => q[0])); const ys = units.flatMap((u) => u.ring.map((q) => q[1]));
    const w = Math.max(12, Math.max(...xs) - Math.min(...xs)) + 16; const h = Math.max(8, Math.max(...ys) - Math.min(...ys)) + 16;
    setBeeld({ cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, s: Math.min(maat.w / w, maat.h / h) });
  }, [units.length, maat.w, maat.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const B = beeld || { cx: 0, cy: 0, s: 20 };
  const naarS = ([x, y]) => [(x - B.cx) * B.s + maat.w / 2, (B.cy - y) * B.s + maat.h / 2];
  const naarW = (e) => { const r = svgRef.current.getBoundingClientRect(); return [B.cx + (e.clientX - r.left - maat.w / 2) / B.s, B.cy - (e.clientY - r.top - maat.h / 2) / B.s]; };
  const pad = (ring) => `M${ring.map((q) => naarS(q).join(',')).join('L')}Z`;

  // Stapelen: een unit op verdieping v moet met zijn midden op een unit van v − 1 staan die zo hoog gestapeld mag worden.
  const draagt = (u, v) => !u.trap && !u.auto && !u.g.it.velden?.dakterras && u.g.v === v - 1 && v + 1 <= stapelMax(u.g.el);
  // Gedragen als het midden op een unit staat, of als beide kopse kanten op een unit rusten (overbruggen, zoals bij hoekgietstukken).
  const steunt = (p, v, weg) => units.some((u) => u.g.it.id !== weg && draagt(u, v) && binnen(p, u.ring));
  const magOp = (mid, v, weg, ring = null) => {
    if (v === 0 || steunt(mid, v, weg)) return true;
    if (!ring) return false;
    const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [a, b, c, e] = ring; const langAB = d(a, b) >= d(b, c);
    // De twee kopse kanten als [hoek1, hoek2] met hun binnenrichting.
    const koppen = langAB ? [[b, c, a], [e, a, b]] : [[a, b, e], [c, e, b]];
    const L = langAB ? d(a, b) : d(b, c); const inz = Math.min(0.3, L / 4);
    const draagtKop = ([p1, p2, ver]) => {
      const lx = (ver[0] - p1[0]) / d(p1, ver); const ly = (ver[1] - p1[1]) / d(p1, ver);
      return [0.08, 0.5, 0.92].some((f) => steunt([p1[0] + (p2[0] - p1[0]) * f + lx * inz, p1[1] + (p2[1] - p1[1]) * f + ly * inz], v, weg));
    };
    return draagtKop(koppen[0]) && draagtKop(koppen[1]);
  };
  // Een wagen mag in een container met glazen wand staan (showroom); verder botst alles.
  const botst = (ring, v, weg, auto = false) => units.some((u) => u.g.it.id !== weg && u.g.v === v && !(auto && !u.auto && !u.trap && heeftGlas(u.g)) && veelhoekenOverlap(ring, u.ring, 0.05));
  const isA = (s) => (s.el ? isAutoEl(s.el) : !!units.find((u) => u.g.it.id === s.id)?.auto);

  // Kleven: een hoek van de bewegende unit op een rand of hoek van een andere unit (zelfde verdieping, of die eronder).
  const kleef = (ring, v, weg) => {
    const tol = KLEEF_PX / B.s; let best = null;
    for (const u of units) {
      if (u.g.it.id === weg || (u.g.v !== v && u.g.v !== v - 1)) continue;
      for (const c of ring) {
        for (const h of u.ring) { const d = Math.hypot(h[0] - c[0], h[1] - c[1]); if (d < tol && (!best || d - tol * 0.5 < best.d)) best = { d: d - tol * 0.5, dx: h[0] - c[0], dy: h[1] - c[1] }; }
        for (let k = 0; k < 4; k++) { const q = opSeg(c, u.ring[k], u.ring[(k + 1) % 4]); const d = Math.hypot(q[0] - c[0], q[1] - c[1]); if (d < tol && (!best || d < best.d)) best = { d, dx: q[0] - c[0], dy: q[1] - c[1] }; }
      }
    }
    return best ? [best.dx, best.dy] : [0, 0];
  };

  const [sleep, setSleep] = useState(null); // { soort: 'verplaats'|'draai'|'pan'|'nieuw', ... , ring, mid, hoek, ok }
  const sleepRef = useRef(null); sleepRef.current = sleep;

  const voorbeeld = (s, p, e) => {
    if (s.soort === 'pan') { setBeeld({ ...B, cx: s.c0[0] - (e.clientX - s.x0) / B.s, cy: s.c0[1] + (e.clientY - s.y0) / B.s }); return s; }
    if (s.soort === 'verplaats' || s.soort === 'nieuw') {
      let mid = s.soort === 'nieuw' ? p : [s.mid0[0] + p[0] - s.p0[0], s.mid0[1] + p[1] - s.p0[1]];
      let ring = ringOm(mid, s.L, s.Bm, s.hoek);
      if (!e.altKey) { const [dx, dy] = kleef(ring, verd, s.id); mid = [mid[0] + dx, mid[1] + dy]; ring = ringOm(mid, s.L, s.Bm, s.hoek); }
      const ok = !botst(ring, verd, s.id, isA(s)) && magOp(mid, verd, s.id, ring);
      return { ...s, mid, ring, ok };
    }
    if (s.soort === 'draai') {
      let a = Math.atan2(p[1] - s.mid0[1], p[0] - s.mid0[0]) - s.a0 + s.hoek0;
      if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
      else for (const u of units) { if (u.g.it.id === s.id) continue; const h = hoekVan(u.ring); for (let k = 0; k < 4; k++) { const w = h + (k * Math.PI) / 2; const d = Math.atan2(Math.sin(a - w), Math.cos(a - w)); if (Math.abs(d) < 0.035) a = w; } }
      const ring = ringOm(s.mid0, s.L, s.Bm, a);
      return { ...s, hoek: a, ring, mid: s.mid0, ok: !botst(ring, verd, s.id, isA(s)) && magOp(s.mid0, verd, s.id, ring) };
    }
    return s;
  };

  const omlaag = (e, u, soort = 'verplaats') => {
    if (e.button !== 0) return;
    e.stopPropagation(); onKies(u.g.it.id);
    if (!schrijven || u.g.v !== verd) return;
    const p = naarW(e); const hoek = hoekVan(u.ring);
    const s = soort === 'draai'
      ? { soort, id: u.g.it.id, mid0: u.mid, a0: Math.atan2(p[1] - u.mid[1], p[0] - u.mid[0]), hoek0: hoek, hoek, L: u.L, Bm: u.B, rot0: Number(u.g.it.parameters?.rot) || 0, ring: u.ring, mid: u.mid, ok: true, bewogen: false }
      : { soort, id: u.g.it.id, p0: p, mid0: u.mid, hoek, L: u.L, Bm: u.B, rot0: Number(u.g.it.parameters?.rot) || 0, ring: u.ring, mid: u.mid, ok: true, bewogen: false };
    setSleep(s);
  };
  const achtergrond = (e) => { if (e.button !== 0 && e.button !== 1) return; setSleep({ soort: 'pan', x0: e.clientX, y0: e.clientY, c0: [B.cx, B.cy] }); };
  useEffect(() => {
    const beweeg = (e) => { const s = sleepRef.current; if (!s || !svgRef.current) return; const n = voorbeeld(s, naarW(e), e); n.bewogen = true; setSleep(n); };
    const los = () => {
      const s = sleepRef.current; if (!s) return; setSleep(null);
      if (s.soort === 'pan' || !s.bewogen) return;
      if (!s.ok) { onMelding(s.soort === 'draai' ? (botst(s.ring, verd, s.id, isA(s)) ? 'Zo draaien kan niet: de unit komt over een andere unit.' : 'Zo draaien kan niet: de unit rust dan niet meer op de units eronder.') : (botst(s.ring, verd, s.id, isA(s)) ? 'Daar staat al een unit.' : 'Hier kan je niet stapelen: zet het midden of beide kopse kanten op een unit die zo hoog gestapeld mag worden.')); return; }
      // Geografische draaiing: met de klok mee, dus tegengesteld aan de hoek in het kader.
      const dRot = s.soort === 'draai' ? -((s.hoek - s.hoek0) * 180) / Math.PI : 0;
      const rot = Math.round(((((s.rot0 + dRot) % 360) + 360) % 360) * 10) / 10;
      onWijzig(s.id, { midden: A.naarGeo(s.mid), rot });
    };
    window.addEventListener('pointermove', beweeg); window.addEventListener('pointerup', los);
    return () => { window.removeEventListener('pointermove', beweeg); window.removeEventListener('pointerup', los); };
  });
  const wiel = (e) => { const p = naarW(e); const f = Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0015); const s = Math.max(2, Math.min(200, B.s * f)); setBeeld({ s, cx: p[0] - (p[0] - B.cx) * (B.s / s), cy: p[1] - (p[1] - B.cy) * (B.s / s) }); };
  useEffect(() => { const el = svgRef.current; if (!el) return undefined; const h = (e) => { e.preventDefault(); wiel(e); }; el.addEventListener('wheel', h, { passive: false }); return () => el.removeEventListener('wheel', h); });

  // Uit de lijst op het plan slepen.
  const nieuwS = (e) => {
    const el = lijstEl(); if (!el) return null;
    const L = Number(el.breedte_m) || 6; const Bm = Number(el.diepte_m) || 2.44;
    const s0 = sleepRef.current?.soort === 'nieuw' ? sleepRef.current : { soort: 'nieuw', id: null, el, L, Bm, hoek: 0, rot0: Number(A.rot) || 0 };
    return voorbeeld(s0, naarW(e), e);
  };
  const overSlepen = (e) => { if (!schrijven) return; e.preventDefault(); const s = nieuwS(e); if (s) setSleep(s); };
  const neerzetten = (e) => {
    e.preventDefault(); const s = nieuwS(e); setSleep(null); if (!s) return;
    if (!s.ok) { onMelding(botst(s.ring, verd, null, isA(s)) ? 'Daar staat al een unit.' : 'Hier kan je niet stapelen.'); return; }
    onPlaats(s.el, { midden: A.naarGeo(s.mid), rot: Math.round(((((s.rot0) % 360) + 360) % 360) * 10) / 10, verdieping: verd });
  };

  const getoond = units.filter((u) => u.g.v <= verd).sort((a, b) => a.g.v - b.g.v || Number(a.auto) - Number(b.auto));
  const kleur = (u) => {
    const n = String(u.g.el?.naam || '');
    if (u.trap) return '#D6D3D1';
    if (u.auto) return '#FDE68A';
    if (/glas/i.test(n)) return '#DBEAFE';
    if (/bar/i.test(n)) return '#FEF3C7';
    return '#E5E7EB';
  };
  const s = sleep && sleep.soort !== 'pan' ? sleep : null;
  const geselecteerd = units.find((u) => u.g.it.id === sel && u.g.v === verd);
  const greep = (u) => { const h = hoekVan(u.ring); const r = u.B / 2 + 18 / B.s; return [u.mid[0] - Math.sin(h) * r, u.mid[1] + Math.cos(h) * r]; };

  return (
    <svg ref={svgRef} className="fm-cb-plan" width={maat.w} height={maat.h} onPointerDown={achtergrond} onDragOver={overSlepen} onDragLeave={(e) => { if (sleepRef.current?.soort === 'nieuw' && !svgRef.current?.contains(e.relatedTarget)) setSleep(null); }} onDrop={neerzetten} onContextMenu={(e) => e.preventDefault()}>
      <defs>
        <pattern id="cb-niet" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#DC2626" strokeWidth="2" opacity="0.35" /></pattern>
      </defs>
      {/* Raster per meter (licht) en per 5 m. */}
      {B.s > 6 && (() => {
        const l = []; const x0 = Math.floor(B.cx - maat.w / 2 / B.s); const x1 = Math.ceil(B.cx + maat.w / 2 / B.s); const y0 = Math.floor(B.cy - maat.h / 2 / B.s); const y1 = Math.ceil(B.cy + maat.h / 2 / B.s);
        for (let x = x0; x <= x1; x++) { const [sx] = naarS([x, 0]); l.push(<line key={`x${x}`} x1={sx} x2={sx} y1={0} y2={maat.h} stroke="#CBD5E1" strokeWidth={x % 5 ? 0.4 : 0.9} />); }
        for (let y = y0; y <= y1; y++) { const [, sy] = naarS([0, y]); l.push(<line key={`y${y}`} y1={sy} y2={sy} x1={0} x2={maat.w} stroke="#CBD5E1" strokeWidth={y % 5 ? 0.4 : 0.9} />); }
        return <g pointerEvents="none">{l}</g>;
      })()}
      {getoond.map((u) => {
        const op = u.g.v === verd; const weg = s && s.id === u.g.it.id;
        const onder = verd > 0 && u.g.v === verd - 1;
        const kan = onder && draagt(u, verd);
        return (
          <g key={u.g.it.id} pointerEvents={sleep?.soort === 'nieuw' ? 'none' : undefined} opacity={op ? (weg ? 0.25 : 1) : 0.55} style={{ cursor: op && schrijven ? 'move' : 'pointer' }} onPointerDown={(e) => omlaag(e, u)}>
            <path d={pad(u.ring)} fill={onder ? (kan ? '#BBF7D0' : '#FEE2E2') : kleur(u)} stroke={u.g.it.id === sel && op ? '#2563EB' : '#1F2937'} strokeWidth={u.g.it.id === sel && op ? 2.5 : 1.2} />
            {onder && !kan && <path d={pad(u.ring)} fill="url(#cb-niet)" pointerEvents="none" />}
            {u.g.it.velden?.dakterras && <path d={pad(u.ring.map((q) => [q[0] + (u.mid[0] - q[0]) * 0.06, q[1] + (u.mid[1] - q[1]) * 0.12]))} fill="none" stroke="#1F2328" strokeWidth={2} strokeDasharray="2 3" pointerEvents="none" />}
            {/* Deuren, ramen, glas en klep op de wanden. */}
            {op && !u.trap && (u.g.it.velden?.gevel || u.g.el?.eigenschappen?.gevel || []).map((o, k) => {
              const { a, e } = gevelLijn(o, u.L, u.B); const p1 = naarS(u.g.T(a)); const p2 = naarS(u.g.T(e));
              const kl = o.soort === 'glas' ? '#2563EB' : o.soort === 'klep' ? '#D97706' : o.soort === 'raam' ? '#60A5FA' : o.soort === 'open' || o.soort === 'neerklap' ? '#16A34A' : '#111827';
              return <line key={k} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={kl} strokeWidth={o.soort === 'glas' ? 3 : 4} strokeLinecap="butt" pointerEvents="none" />;
            })}
            {B.s > 8 && (() => { const [x, y] = naarS(u.mid); const h = (-hoekVan(u.ring) * 180) / Math.PI; const t = u.trap ? 'Trap' : String(u.g.it.naam || u.g.el?.naam || 'Unit').replace(/\s*\(.*\)\s*$/, ''); return <text x={x} y={y} transform={`rotate(${((h + 90) % 180) - 90} ${x} ${y})`} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(13, B.s * 0.9)} fill="#111827" pointerEvents="none">{t}{u.g.v ? ` · V${u.g.v}` : ''}</text>; })()}
          </g>
        );
      })}
      {s && s.ring && <path d={pad(s.ring)} fill={s.ok ? 'rgba(37,99,235,0.18)' : 'rgba(220,38,38,0.25)'} stroke={s.ok ? '#2563EB' : '#DC2626'} strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />}
      {s && s.soort === 'draai' && (() => { const [x, y] = naarS(s.mid0); return <text x={x} y={y - 22} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1D4ED8" pointerEvents="none">{Math.round(((((s.rot0 - ((s.hoek - s.hoek0) * 180) / Math.PI) % 360) + 360) % 360) * 10) / 10}°</text>; })()}
      {schrijven && geselecteerd && !s && !geselecteerd.trap && (() => {
        const [gx, gy] = naarS(greep(geselecteerd)); const [mx, my] = naarS(geselecteerd.mid);
        return <g style={{ cursor: 'grab' }} onPointerDown={(e) => omlaag(e, geselecteerd, 'draai')}>
          <line x1={mx} y1={my} x2={gx} y2={gy} stroke="#2563EB" strokeWidth="1.2" strokeDasharray="3 3" pointerEvents="none" />
          <circle cx={gx} cy={gy} r="8" fill="#fff" stroke="#2563EB" strokeWidth="2" />
        </g>;
      })()}
    </svg>
  );
}
