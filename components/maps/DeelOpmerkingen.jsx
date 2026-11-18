'use client';

// Opmerkingen bij een item op een deellink (zonder login): lezen en er een bijzetten.
// Gebruikt door het binnenplan in leesweergave; wie de link heeft, mag reageren als de link dat toelaat.
import { useState } from 'react';
import { sb } from './db';

const extra = new Map();   // item → opmerkingen die in deze sessie zijn geplaatst

export default function DeelOpmerkingen({ token, itemId, begin = [], t }) {
  const [naam, setNaam] = useState(() => { try { return window.localStorage.getItem('fm-deel-naam') || ''; } catch { return ''; } });
  const [tekst, setTekst] = useState('');
  const [stand, setStand] = useState('');
  const [, tik] = useState(0);
  const lijst = [...begin, ...(extra.get(itemId) || [])];
  const plaats = async () => {
    const tk = tekst.trim(); if (!tk || stand === 'bezig') return;
    setStand('bezig');
    const { data, error } = await sb().schema('maps').rpc('deel_link_opmerking', { p_token: token, p_item: itemId, p_naam: naam, p_tekst: tk });
    if (error || !data) { setStand('fout'); return; }
    try { window.localStorage.setItem('fm-deel-naam', naam); } catch { /* geen opslag */ }
    extra.set(itemId, [...(extra.get(itemId) || []), { auteur: naam || '—', tekst: tk, op: new Date().toISOString() }]);
    setTekst(''); setStand('dank'); tik((n) => n + 1);
  };
  return (
    <div className="fm-bs-lees-blok fm-deel-opm">
      <div className="fm-bs-lees-label">{t.opm}{lijst.length ? ` · ${lijst.length}` : ''}</div>
      {lijst.map((o, i) => <div key={i} className="fm-deel-opm-rij"><strong>{o.auteur}</strong> {o.tekst}</div>)}
      <input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={80} placeholder={t.naam} aria-label={t.naam} />
      <textarea rows={2} value={tekst} onChange={(e) => setTekst(e.target.value)} maxLength={2000} placeholder={t.tekst} aria-label={t.tekst} />
      <button className="fm-knop zwart" disabled={!tekst.trim() || stand === 'bezig'} onClick={plaats}>{t.plaats}</button>
      {stand === 'dank' && <div className="fm-sub">{t.dank}</div>}
      {stand === 'fout' && <div className="fm-sub" style={{ color: '#B91C1C' }}>✕</div>}
    </div>
  );
}
