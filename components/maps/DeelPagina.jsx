'use client';

// Deelpagina van een ontvanger: elk onderdeel (plan, 3D, binnenplan) als tab onderaan, en de laatste PDF.
// Een oude link zonder onderdelen toont gewoon de kaart.
import { useState } from 'react';
import DeelWeergave from './DeelWeergave';
import { publiekeUrl } from './db';

const T = {
  nl: { pdf: 'Alles als PDF', delen: 'Onderdelen', plan: 'Plan', drie: '3D', binnen: 'Binnenplan' },
  fr: { pdf: 'Tout en PDF', delen: 'Parties', plan: 'Plan', drie: '3D', binnen: 'Plan intérieur' },
  en: { pdf: 'Everything as PDF', delen: 'Parts', plan: 'Plan', drie: '3D', binnen: 'Floor plan' },
};

export default function DeelPagina({ token }) {
  const [deel, setDeel] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('deel') : null));
  const [info, setInfo] = useState(null); // { lijst, huidig, pdf, taal }
  const kies = (id) => {
    setDeel(id);
    try { const u = new URL(window.location.href); u.searchParams.set('deel', id); window.history.replaceState(null, '', u); } catch {}
  };
  const t = T[info?.taal] || T.nl;
  const toonBalk = info && (info.lijst.length > 1 || info.pdf?.pad);
  return (
    <>
      <DeelWeergave key={deel || '-'} token={token} deel={deel} onData={(d) => setInfo(d ? { lijst: d.onderdelen || [], huidig: d.deel || null, pdf: d.pdf || null, taal: d.link?.opties?.taal } : null)} />
      {toonBalk && (
        <nav className="fm-deelbalk" aria-label={t.delen}>
          {info.lijst.length > 1 && info.lijst.map((o) => (
            <button key={o.id} aria-current={o.id === info.huidig ? 'page' : undefined} className={o.id === info.huidig ? 'aan' : ''} onClick={() => o.id !== info.huidig && kies(o.id)}>
              <small>{t[o.soort] || o.soort}</small>{o.naam}
            </button>
          ))}
          {info.pdf?.pad && <a className="pdf" href={publiekeUrl(info.pdf.pad)} target="_blank" rel="noreferrer">{t.pdf}</a>}
        </nav>
      )}
    </>
  );
}
