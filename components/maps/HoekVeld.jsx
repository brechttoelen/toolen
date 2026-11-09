'use client';

import { useEffect, useRef, useState } from 'react';
import { Icoon } from './iconen';

// Draaihoek in de actiebalk: de huidige hoek, meteen aanpasbaar.
// Typ een hoek + Enter, of pijltjes (1°, Shift = 15°).
export default function HoekVeld({ waarde, onDraai }) {
  const norm = (v) => Math.round((((v % 360) + 360) % 360) * 10) / 10;
  const [tekst, setTekst] = useState(String(norm(waarde)).replace('.', ','));
  const [bezig, setBezig] = useState(false);
  const annuleer = useRef(false);
  useEffect(() => { if (!bezig) setTekst(String(norm(waarde)).replace('.', ',')); }, [waarde, bezig]);
  const pas = () => {
    const n = parseFloat(String(tekst).replace(',', '.'));
    if (!Number.isFinite(n)) { setTekst(String(norm(waarde)).replace('.', ',')); return; }
    let d = norm(n) - norm(waarde);
    if (d > 180) d -= 360; if (d < -180) d += 360;
    if (Math.abs(d) > 0.01) onDraai(d);
  };
  return (
    <label className="fm-hoekveld" title="Draaihoek in graden (met de klok mee). Typ een hoek, of pijltjes: 1°, Shift 15°">
      <Icoon naam="draairechts" maat={14} />
      <input value={tekst} inputMode="decimal" aria-label="Draaihoek in graden"
        onFocus={(e) => { setBezig(true); e.target.select(); }}
        onBlur={() => { setBezig(false); if (annuleer.current) { annuleer.current = false; return; } pas(); }}
        onChange={(e) => setTekst(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') { annuleer.current = true; setTekst(String(norm(waarde)).replace('.', ',')); e.currentTarget.blur(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const st = (e.shiftKey ? 15 : 1) * (e.key === 'ArrowUp' ? 1 : -1); onDraai(st); setBezig(false); }
        }} />
      <span>°</span>
    </label>
  );
}
