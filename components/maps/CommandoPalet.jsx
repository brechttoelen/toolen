'use client';

// Ctrl K: snel zoeken naar acties, gereedschap, elementen, lagen en items.
import { useEffect, useMemo, useRef, useState } from 'react';

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function CommandoPalet({ open, onSluit, bronnen }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const invoer = useRef(null);
  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => invoer.current?.focus(), 0); } }, [open]);

  const resultaten = useMemo(() => {
    if (!open) return [];
    const w = norm(q).split(/\s+/).filter(Boolean);
    const past = (r) => w.every((x) => norm(`${r.titel} ${r.groep} ${r.extra || ''}`).includes(x));
    const lijst = bronnen().filter((r) => !w.length ? r.standaard : past(r));
    // Begint de titel met de zoekterm: hoger.
    if (w.length) lijst.sort((a, b) => (norm(b.titel).startsWith(w[0]) ? 1 : 0) - (norm(a.titel).startsWith(w[0]) ? 1 : 0));
    return lijst.slice(0, 40);
  }, [open, q, bronnen]);

  if (!open) return null;
  const voer = (r) => { onSluit(); setTimeout(() => r.doe(), 0); };
  const toets = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(resultaten.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (resultaten[i]) voer(resultaten[i]); }
    else if (e.key === 'Escape') { e.preventDefault(); onSluit(); }
  };
  let vorige = null;
  return (
    <div className="fm-palet-achter" onMouseDown={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <div className="fm-palet" role="dialog" aria-label="Snel zoeken">
        <input ref={invoer} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={toets}
          placeholder="Zoek een actie, element, laag of item… bv. heras, pdf, laag stroom" aria-label="Zoeken" />
        <div className="fm-palet-lijst" role="listbox">
          {resultaten.map((r, k) => {
            const kop = r.groep !== vorige ? r.groep : null; vorige = r.groep;
            return (
              <div key={`${r.groep}-${r.titel}-${k}`}>
                {kop && <div className="fm-palet-kop">{kop}</div>}
                <button role="option" aria-selected={k === i} className={k === i ? 'aan' : ''} onMouseEnter={() => setI(k)} onClick={() => voer(r)}>
                  <span>{r.titel}</span>{r.extra && <small>{r.extra}</small>}
                </button>
              </div>
            );
          })}
          {!resultaten.length && <div className="fm-sub" style={{ padding: 12 }}>Niets gevonden. Adressen zoek je bovenaan.</div>}
        </div>
        <div className="fm-palet-voet"><span>↑↓ kiezen</span><span>Enter uitvoeren</span><span>Esc sluiten</span></div>
      </div>
    </div>
  );
}
