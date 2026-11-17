'use client';

// Op een deellink van een persoon (lokale ploeg, zonder login): zijn taken per dag, boven de kaart.
import { useEffect, useState } from 'react';
import { sb } from '../maps/db';
import { dagNaam, uurKort, canoniek, sleutel, volgorde } from './dagen';
import './fiche.css';

export default function DeelTaken({ token }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(true);
  useEffect(() => { sb().schema('maps').rpc('deel_link_taken', { p_token: token }).then(({ data }) => setD(data || null)); }, [token]);
  if (!d || !d.persoon) return null;
  const plan = { wedstrijd_van: d.wedstrijd_van, wedstrijd_tot: d.wedstrijd_tot };
  const per = new Map();
  for (const t of d.taken || []) { const c = canoniek(plan, t.anker, t.dag); const k = sleutel(c.anker, c.dag); (per.get(k) || per.set(k, { ...c, taken: [] }).get(k)).taken.push(t); }
  const dagen = [...per.values()].sort((a, b) => volgorde(plan, a, b));
  return (
    <aside style={{ position: 'fixed', right: 12, top: 64, zIndex: 30, width: 'min(380px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 140px)', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: 'var(--t-schaduw-zweef)', fontFamily: 'var(--font-sans)', fontSize: 13.5 }} aria-label="Taken">
      <button onClick={() => setOpen(!open)} aria-expanded={open} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', display: 'flex', gap: 8, alignItems: 'center', padding: '12px 14px', borderBottom: open ? '1px solid var(--t-rand)' : 0 }}>
        <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>Taken van {d.persoon}</b>{d.rol && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--t-tekst-2)' }}>{d.rol}</span>}</span>
        <span style={{ fontSize: 12.5, color: 'var(--t-tekst-2)' }}>{(d.taken || []).length} · {open ? 'verbergen' : 'tonen'}</span>
      </button>
      {open && <div style={{ padding: '6px 14px 12px' }}>
        {!dagen.length && <p style={{ color: 'var(--t-tekst-2)' }}>Nog geen taken.</p>}
        {dagen.map((x) => (
          <div key={sleutel(x.anker, x.dag)} style={{ padding: '6px 0' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t-tekst-2)', margin: '4px 0' }}>{dagNaam(plan, x.anker, x.dag)}</div>
            {x.taken.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: '1px solid #EEF1F5', opacity: t.status === 'klaar' ? 0.6 : 1 }}>
                <span style={{ width: 44, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--t-navy)' }}>{uurKort(t.uur_van) || '–'}</span>
                <span style={{ flex: 1 }}><span style={{ textDecoration: t.status === 'klaar' ? 'line-through' : 'none' }}>{t.titel}</span>
                  {(t.waar || t.info) && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--t-tekst-2)' }}>{[t.waar, t.info].filter(Boolean).join(' · ')}</span>}</span>
              </div>
            ))}
          </div>
        ))}
      </div>}
    </aside>
  );
}
