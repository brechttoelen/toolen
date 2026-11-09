'use client';

import { useEffect, useRef, useState } from 'react';

// Uitleg achter een info-bolletje: hover of klik toont ze, Esc of ernaast klikken sluit.
export default function Info({ children, label = 'Uitleg' }) {
  const [open, setOpen] = useState(false);
  const [vast, setVast] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  // Vast gepositioneerd (niet afgeknipt door een scrollend paneel), binnen het scherm.
  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const B = 240;
    const left = Math.max(8, Math.min(window.innerWidth - B - 8, r.left + r.width / 2 - B / 2));
    const onder = r.bottom + 6 + 120 < window.innerHeight;
    setPos(onder ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 });
  }, [open]);
  useEffect(() => {
    if (!vast) return undefined;
    const weg = (e) => { if (!ref.current?.contains(e.target)) { setVast(false); setOpen(false); } };
    const esc = (e) => { if (e.key === 'Escape') { setVast(false); setOpen(false); } };
    document.addEventListener('mousedown', weg); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', esc); };
  }, [vast]);
  return (
    <span className="fm-info" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!vast) setOpen(false); }}>
      {/* Een span i.p.v. button: mag dan ook in een knop of summary staan. */}
      <span className="fm-info-knop" role="button" tabIndex={0} aria-label={label} aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVast(!vast); setOpen(!vast); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setVast(!vast); setOpen(!vast); } }}>i</span>
      {open && pos && <span className="fm-info-tekst" role="tooltip" style={pos}>{children}</span>}
    </span>
  );
}
