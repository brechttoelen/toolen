'use client';

import Info from './info';

// Inklapbaar blok met een kop, voor alle panelen (eigenschappen, plan, controle).
// Zonder onWissel regelt de browser het open- en dichtklappen zelf (open = beginstand).
// Met onWissel is het blok gestuurd: de inhoud wordt pas gemaakt als het open staat.
export default function Blok({ titel, open = true, onWissel = null, rechts = null, info = null, children }) {
  const gestuurd = typeof onWissel === 'function';
  return (
    <details className="fm-blok" open={open}
      onToggle={gestuurd ? (e) => { if (e.currentTarget.open !== open) onWissel(e.currentTarget.open); } : undefined}>
      <summary><span>{titel}{info && <Info>{info}</Info>}</span>{rechts}</summary>
      {(!gestuurd || open) && <div className="fm-blok-inhoud">{children}</div>}
    </details>
  );
}
