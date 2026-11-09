'use client';

// Vragen in de stijl van de app, in plaats van de grijze browservensters
// (window.confirm / window.prompt). Gebruik: `if (await bevestig('…')) …` en
// `const naam = await vraagTekst('…', 'standaard')`. Zonder <AppDialogen /> op
// de pagina vallen ze terug op het browservenster.
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

let zetter = null;

export function bevestig(tekst, { titel = '', ok = 'OK', annuleer = 'Annuleren', gevaar = false } = {}) {
  if (!zetter) return Promise.resolve(typeof window !== 'undefined' && window.confirm(tekst));
  return new Promise((res) => zetter({ soort: 'bevestig', tekst, titel, ok, annuleer, gevaar, res }));
}

export function vraagTekst(tekst, standaard = '', { titel = '', ok = 'OK', annuleer = 'Annuleren', alleenLezen = false, lang = false } = {}) {
  if (!zetter) return Promise.resolve(typeof window !== 'undefined' ? window.prompt(tekst, standaard) : null);
  return new Promise((res) => zetter({ soort: 'tekst', tekst, titel, ok, annuleer, standaard: standaard ?? '', alleenLezen, lang, res }));
}

// Tekst tonen om te kopiëren (bv. een inbedcode).
export function toonTekst(tekst, waarde, titel = '') {
  return vraagTekst(tekst, waarde, { titel, ok: 'Kopiëren en sluiten', annuleer: 'Sluiten', alleenLezen: true, lang: waarde.length > 80 });
}

export function AppDialogen() {
  const [d, setD] = useState(null);
  const [waarde, setWaarde] = useState('');
  const invoer = useRef(null);
  const okKnop = useRef(null);
  useEffect(() => { zetter = (x) => { setWaarde(x.standaard ?? ''); setD(x); }; return () => { zetter = null; }; }, []);
  useEffect(() => {
    if (!d) return;
    const t = setTimeout(() => { if (invoer.current) { invoer.current.focus(); invoer.current.select?.(); } else okKnop.current?.focus(); }, 0);
    return () => clearTimeout(t);
  }, [d]);
  if (!d) return null;
  const klaar = async (ja) => {
    const x = d; setD(null);
    if (x.soort === 'bevestig') x.res(ja);
    else {
      if (ja && x.alleenLezen) { try { await navigator.clipboard.writeText(waarde); } catch {} }
      x.res(ja ? waarde : null);
    }
  };
  // Via een portal op de body: zo staat de vraag ook boven het binnenplan en andere vensters.
  const inhoud = (
    <div className="fm fm-appdialoog-achter" onMouseDown={(e) => { if (e.target === e.currentTarget) klaar(false); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); klaar(false); } if (e.key === 'Enter' && !(d.lang && e.target.tagName === 'TEXTAREA')) { e.preventDefault(); klaar(true); } }}>
      <div className="fm-appdialoog" role="dialog" aria-modal="true" aria-label={d.titel || d.tekst}>
        {d.titel && <strong className="titel">{d.titel}</strong>}
        <p>{d.tekst}</p>
        {d.soort === 'tekst' && (d.lang
          ? <textarea ref={invoer} rows={4} value={waarde} readOnly={d.alleenLezen} onChange={(e) => setWaarde(e.target.value)} />
          : <input ref={invoer} value={waarde} readOnly={d.alleenLezen} onChange={(e) => setWaarde(e.target.value)} />)}
        <div className="knoppen">
          <button className="fm-knop" onClick={() => klaar(false)}>{d.annuleer}</button>
          <button ref={okKnop} className={`fm-knop ${d.gevaar ? 'rood' : 'zwart'}`} onClick={() => klaar(true)}>{d.ok}</button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(inhoud, document.body) : inhoud;
}

// Een open menu sluiten bij een klik ernaast of Escape. Knoppen die het menu
// openen krijgen data-menuknop, zodat ze het gewoon kunnen open- en dichtklikken.
export function useSluitBuiten(open, sluit) {
  const ref = useRef(sluit); ref.current = sluit;
  useEffect(() => {
    if (!open) return;
    const neer = (e) => { if (e.target?.closest?.('.fm-menu, .fm-uitklap, .fm-evenwijdig, .fm-puntkiezer, .fm-palet, [data-menuknop], .fm-appdialoog-achter')) return; ref.current(); };
    const toets = (e) => { if (e.key === 'Escape') ref.current(); };
    document.addEventListener('pointerdown', neer, true);
    document.addEventListener('keydown', toets);
    return () => { document.removeEventListener('pointerdown', neer, true); document.removeEventListener('keydown', toets); };
  }, [open]);
}
