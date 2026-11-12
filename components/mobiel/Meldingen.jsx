'use client';

// Open meldingen van alle plannen: van het terrein (een plek) en bij items. Tikken opent de plek op de kaart.
import { useEffect, useState } from 'react';
import { maps, foutTekst, magSchrijven } from '../maps/db';
import { Ic } from './iconen';

const tijd = (t) => new Date(t).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Meldingen({ profiel, onOpen, onAantal }) {
  const [lijst, setLijst] = useState(null);
  const [plannen, setPlannen] = useState(new Map());
  const [fout, setFout] = useState('');
  const [toon, setToon] = useState('open');
  const schrijven = magSchrijven(profiel);

  useEffect(() => {
    (async () => {
      try {
        let q = maps().from('opmerkingen').select('id, tekst, auteur_naam, status, punt, item_id, plan_id, created_at').order('created_at', { ascending: false }).limit(200);
        if (toon === 'open') q = q.eq('status', 'open');
        const r = await q;
        if (r.error) throw r.error;
        const rijen = r.data || [];
        // Plan van meldingen bij een item (oudere meldingen hebben geen plan_id).
        const zonder = [...new Set(rijen.filter((o) => !o.plan_id && o.item_id).map((o) => o.item_id))];
        const items = new Map();
        if (zonder.length) {
          const it = await maps().from('items').select('id, plan_id, naam, geometrie').in('id', zonder.slice(0, 300));
          for (const x of it.data || []) items.set(x.id, x);
        }
        const metPlan = rijen.map((o) => ({ ...o, plan_id: o.plan_id || items.get(o.item_id)?.plan_id || null, itemNaam: items.get(o.item_id)?.naam || null }));
        const ids = [...new Set(metPlan.map((o) => o.plan_id).filter(Boolean))];
        const p = ids.length ? await maps().from('plannen').select('id, naam').in('id', ids) : { data: [] };
        setPlannen(new Map((p.data || []).map((x) => [x.id, x.naam])));
        setLijst(metPlan.filter((o) => o.plan_id));
        if (toon === 'open') onAantal?.(metPlan.length);
      } catch (err) { setFout(foutTekst(err)); setLijst([]); }
    })();
  }, [toon]); // eslint-disable-line react-hooks/exhaustive-deps

  const zet = async (o, status) => {
    const { error } = await maps().from('opmerkingen').update({ status }).eq('id', o.id);
    if (error) { setFout(foutTekst(error)); return; }
    setLijst((l) => (toon === 'open' ? l.filter((x) => x.id !== o.id) : l.map((x) => (x.id === o.id ? { ...x, status } : x))));
    if (toon === 'open') onAantal?.((lijst?.length || 1) - 1);
  };

  return (
    <>
      <header className="mb-kop"><h1>Meldingen</h1></header>
      <main className="mb-inhoud">
        <div className="mb-pad">
          <div className="mb-segment" role="group" aria-label="Welke meldingen">
            <button type="button" className={toon === 'open' ? 'aan' : ''} onClick={() => setToon('open')}>Open</button>
            <button type="button" className={toon === 'alle' ? 'aan' : ''} onClick={() => setToon('alle')}>Alle</button>
          </div>
          {fout && <div className="mb-melding fout">{fout}</div>}
          {lijst === null && <p className="mb-sub">Laden…</p>}
          {lijst && !lijst.length && <p className="mb-leeg">{toon === 'open' ? 'Geen open meldingen.' : 'Nog geen meldingen.'}</p>}
          {lijst && lijst.length > 0 && (
            <div className="mb-lijst">
              {lijst.map((o) => (
                <div key={o.id} className="mb-rij" style={{ alignItems: 'flex-start', cursor: 'default', opacity: o.status === 'open' ? 1 : 0.6 }}>
                  <span className="mb-blok" style={{ background: o.status === 'open' ? 'var(--t-let-op-zacht)' : 'var(--t-vlak-2)', color: 'var(--t-let-op)' }}><Ic.melden /></span>
                  <span>
                    <b style={{ whiteSpace: 'normal' }}>{o.tekst}</b>
                    <small>{[plannen.get(o.plan_id), o.itemNaam, o.auteur_naam, tijd(o.created_at)].filter(Boolean).join(' · ')}</small>
                    <span style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="mb-knop" style={{ height: 36 }} onClick={() => onOpen(o.plan_id, o.punt ? { punt: o.punt, id: o.id } : o.item_id ? { item: o.item_id } : null)}>Op de kaart</button>
                      {schrijven && <button type="button" className={`mb-knop${o.status === 'open' ? ' ok' : ''}`} style={{ height: 36 }} onClick={() => zet(o, o.status === 'open' ? 'opgelost' : 'open')}>{o.status === 'open' ? 'Opgelost' : 'Terug open'}</button>}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

