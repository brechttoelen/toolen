'use client';

import { useMemo, useState } from 'react';
import { SOORT_NAAM, uitgangenTekst, KLEUR } from './vasteAansluitingen';

// Lijst van vaste aansluitingen met filter op gemeente. In het Stroom-paneel en op de beheerpagina.
export default function VasteAansluitingenLijst({ lijst, inBeeld = null, gekozen = null, onKies, onNieuw = null, compact = false }) {
  const [gemeente, setGemeente] = useState('');
  const [zoek, setZoek] = useState('');
  const gemeenten = useMemo(() => [...new Set(lijst.map((v) => v.gemeente).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [lijst]);
  const q = zoek.trim().toLowerCase();
  const zicht = lijst.filter((v) => (!gemeente || v.gemeente === gemeente) && (!q || `${v.naam} ${v.adres || ''} ${v.gemeente || ''}`.toLowerCase().includes(q)));
  const beeld = inBeeld ? zicht.filter((v) => inBeeld.has(v.id)) : [];
  const rest = inBeeld ? zicht.filter((v) => !inBeeld.has(v.id)) : zicht;
  const rij = (v) => (
    <button key={v.id} className={`fm-va-rij${v.id === gekozen ? ' aan' : ''}`} onClick={() => onKies(v)} title={[v.adres, v.sleutel ? `sleutel: ${v.sleutel}` : null].filter(Boolean).join(' · ')}>
      <i style={{ background: KLEUR, borderRadius: v.soort === 'putkast' ? '50%' : 0 }} />
      <span className="naam">{v.naam}</span>
      <span className="fm-sub">{v.max_ampere ? `${v.max_ampere} A` : SOORT_NAAM[v.soort]}</span>
      {!compact && <span className="fm-sub extra">{[v.gemeente, uitgangenTekst(v)].filter(Boolean).join(' · ')}</span>}
    </button>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {gemeenten.length > 1 && (
          <select value={gemeente} onChange={(e) => setGemeente(e.target.value)} aria-label="Gemeente" style={{ flex: '1 1 0', width: 0, height: 28, minWidth: 0 }}>
            <option value="">Alle gemeenten ({lijst.length})</option>
            {gemeenten.map((g) => <option key={g} value={g}>{g} ({lijst.filter((v) => v.gemeente === g).length})</option>)}
          </select>
        )}
        <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek" aria-label="Zoek een aansluiting" style={{ flex: '1 1 0', width: 0, height: 28, minWidth: 0 }} />
      </div>
      {inBeeld && beeld.length > 0 && <div className="fm-lijstkop">In beeld · {beeld.length}</div>}
      {beeld.map(rij)}
      {inBeeld && beeld.length > 0 && rest.length > 0 && <div className="fm-lijstkop">Elders · {rest.length}</div>}
      {rest.slice(0, compact ? 30 : 500).map(rij)}
      {!zicht.length && <div className="fm-sub">{lijst.length ? 'Niets gevonden.' : 'Nog geen vaste aansluitingen. Zet er een op de kaart met het gereedschap "Vaste aansluiting".'}</div>}
      {onNieuw && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={onNieuw}>+ Vaste aansluiting op de kaart</button>}
    </div>
  );
}
