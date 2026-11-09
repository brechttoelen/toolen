'use client';

// Een doekontwerp op een vlak van W × H (meter, in het assenstelsel van `transform`).
// Plaatsing: vullen (bijsnijden tot het vlak vol is), passend (heel het ontwerp zichtbaar) of
// herhalen (passend in de hoogte, naast elkaar herhaald). Bij een doek over meerdere frames is
// het hele doek TW × TH en ligt dit vlak op (ox, oy) erin.
import { useEffect, useState } from 'react';

export const STARTEN = [['links', 'Links'], ['midden', 'Midden'], ['rechts', 'Rechts']];
export const PLAATSINGEN = [['vullen', 'Vullen', 'Het ontwerp vult het doek, de randen vallen eventueel weg'], ['passend', 'Passend', 'Het hele ontwerp is zichtbaar'], ['herhalen', 'Herhalen', 'Passend in de hoogte, naast elkaar herhaald']];

const cache = new Map();
export function useVerhouding(src, gegeven) {
  const [, setTik] = useState(0);
  useEffect(() => {
    if (!src || gegeven || cache.has(src)) return undefined;
    let weg = false; cache.set(src, null);
    const i = new Image(); i.onload = () => { cache.set(src, i.naturalWidth / Math.max(1, i.naturalHeight)); if (!weg) setTik((x) => x + 1); }; i.src = src;
    return () => { weg = true; };
  }, [src, gegeven]);
  return Number(gegeven) || cache.get(src) || null;
}

let teller = 0;
export function DoekBeeld({ src, W, H, wijze = 'vullen', start = 'rechts', verhouding = null, transform, ox = 0, oy = 0, TW = null, TH = null }) {
  const r = useVerhouding(src, verhouding);
  const [id] = useState(() => `db${++teller}`);
  if (!src) return null;
  const tw = TW || W; const th = TH || H;
  let beelden;
  if (wijze === 'herhalen' && r) {
    const stuk = th * r; const n = Math.max(1, Math.min(200, Math.ceil(tw / stuk - 1e-6)));
    // Waar de herhaling begint (een volledig ontwerp tegen die rand); het stuk dat niet past valt aan de andere kant weg.
    const x0 = start === 'links' ? 0 : start === 'midden' ? (tw - n * stuk) / 2 : tw - n * stuk;
    beelden = Array.from({ length: n }, (_, k) => <image key={k} href={src} x={-ox + x0 + k * stuk} y={-oy} width={stuk} height={th} preserveAspectRatio="none" />);
  } else {
    beelden = <image href={src} x={-ox} y={-oy} width={tw} height={th} preserveAspectRatio={wijze === 'passend' || wijze === 'herhalen' ? 'xMidYMid meet' : 'xMidYMid slice'} />;
  }
  return (
    <g transform={transform} clipPath={`url(#${id})`} pointerEvents="none">
      <clipPath id={id}><rect x={0} y={0} width={W} height={H} /></clipPath>
      {beelden}
    </g>
  );
}
