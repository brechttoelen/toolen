'use client';

// Bestanden van FLCS Maps (Publitool, publieke bucket flcsmaps) naar Toolen kopiëren.
// De lijst komt uit maps.import_bestanden (gevuld door db/0002_import_flcs.sql) en is enkel
// zichtbaar voor platformbeheerders. Kopiëren gebeurt in de browser met je eigen login:
// ophalen via de publieke URL van FLCS, opladen in de bucket maps onder hetzelfde pad.
import { useEffect, useState } from 'react';
import { maps, sb, BUCKET, foutTekst } from './db';
import './maps.css';

const BRON = 'https://vojkrpenkqsphaflsdfh.supabase.co/storage/v1/object/public/flcsmaps/';
const TEGELIJK = 4;

export default function ImportBestanden() {
  const [rijen, setRijen] = useState(null);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  const laad = async () => {
    const { data, error } = await maps().from('import_bestanden').select('*').order('naam');
    if (error) setFout(foutTekst(error)); else setRijen(data || []);
  };
  useEffect(() => { laad(); }, []);

  async function kopieer(rij) {
    try {
      const pad = rij.naam.split('/').map(encodeURIComponent).join('/');
      const r = await fetch(BRON + pad);
      if (!r.ok) throw new Error(`ophalen: HTTP ${r.status}`);
      const blob = await r.blob();
      const { error } = await sb().storage.from(BUCKET).upload(rij.naam, blob, {
        upsert: true, contentType: r.headers.get('content-type') || blob.type || undefined,
      });
      if (error) throw error;
      await maps().from('import_bestanden').update({ gekopieerd_op: new Date().toISOString(), fout: null }).eq('naam', rij.naam);
      return { ...rij, gekopieerd_op: new Date().toISOString(), fout: null };
    } catch (e) {
      const tekst = e?.message || String(e);
      await maps().from('import_bestanden').update({ fout: tekst }).eq('naam', rij.naam);
      return { ...rij, fout: tekst };
    }
  }

  async function start() {
    setBezig(true);
    const open = (rijen || []).filter((r) => !r.gekopieerd_op);
    let i = 0;
    const werker = async () => {
      while (i < open.length) {
        const rij = open[i++];
        const nieuw = await kopieer(rij);
        setRijen((oud) => oud.map((x) => (x.naam === nieuw.naam ? nieuw : x)));
      }
    };
    await Promise.all(Array.from({ length: TEGELIJK }, werker));
    setBezig(false);
  }

  if (fout) return <div className="fm" style={{ padding: 24 }}><p>{fout}</p></div>;
  if (!rijen) return <div className="fm" style={{ padding: 24 }}>Laden…</div>;
  const klaar = rijen.filter((r) => r.gekopieerd_op).length;
  const mis = rijen.filter((r) => r.fout && !r.gekopieerd_op).length;

  return (
    <div className="fm" style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>Bestanden importeren</h1>
      <p style={{ color: '#686D76', margin: '0 0 16px' }}>
        {rijen.length === 0 ? 'Er staan geen bestanden klaar (enkel zichtbaar voor platformbeheerders).' : `${klaar} van ${rijen.length} gekopieerd${mis ? ` · ${mis} met een fout` : ''}.`}
      </p>
      {rijen.length > 0 && (
        <button className="fm-knop zwart" disabled={bezig || klaar === rijen.length} onClick={start}>
          {bezig ? 'Bezig…' : klaar === rijen.length ? 'Alles gekopieerd' : mis ? 'Opnieuw proberen' : 'Kopiëren'}
        </button>
      )}
      <div style={{ marginTop: 16, borderTop: '1px solid #E7E9ED' }}>
        {rijen.map((r) => (
          <div key={r.naam} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #F0F1F3', fontSize: 13 }}>
            <span style={{ flex: 1, wordBreak: 'break-all' }}>{r.naam}</span>
            <span style={{ width: 160, color: r.gekopieerd_op ? '#16865C' : r.fout ? '#B91C1C' : '#686D76' }}>
              {r.gekopieerd_op ? 'gekopieerd' : r.fout ? r.fout : 'wacht'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
