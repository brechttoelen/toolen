'use client';

// Uitgangen van een bron, kast of vaste aansluiting: één regel per soort stopcontact.
// Nr (zoals op het etiket), aantal, type en, bij driefasig, het net (3 × 400 V + N of 3 × 230 V zonder N).
import { UITGANG_TYPES, DRIEFASE_TYPES, netVan } from './vasteAansluitingen';

const NET_KORT = [['3N400', '400 V + N'], ['3x230', '3 × 230 V']];

export default function UitgangenLijst({ waarde, onZet, ro = false, titel = 'Uitgangen', uitleg = null }) {
  const lijst = Array.isArray(waarde) ? waarde : [];
  const zet = (i, p) => onZet(lijst.map((u, j) => (j === i ? { ...u, ...p } : u)));
  return (
    <div className="fm-uitgangen">
      <div className="fm-kop">{titel}</div>
      {uitleg && <div className="fm-sub">{uitleg}</div>}
      {lijst.length > 0 && (
        <div className="fm-uitgang kop" aria-hidden="true"><span>Nr</span><span>Aantal</span><span>Type</span><span>Net</span><span /></div>
      )}
      {lijst.map((u, i) => {
        const drie = DRIEFASE_TYPES.has(u.type);
        return (
          <div key={i} className={`fm-uitgang${netVan(u) === '3x230' ? ' zonder-n' : ''}`}>
            <input value={u.naam || ''} disabled={ro} placeholder="–" onChange={(e) => zet(i, { naam: e.target.value || undefined })} aria-label={`Nummer van uitgang ${i + 1}`} />
            <input inputMode="numeric" value={u.aantal ?? 1} disabled={ro} onChange={(e) => zet(i, { aantal: Number(e.target.value) || 1 })} aria-label={`Aantal van uitgang ${i + 1}`} />
            <select value={u.type || ''} disabled={ro} onChange={(e) => zet(i, { type: e.target.value })} aria-label={`Type van uitgang ${i + 1}`}>
              <option value="">Kies…</option>{UITGANG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {drie ? (
              <select value={netVan(u)} disabled={ro} onChange={(e) => zet(i, { net: e.target.value === '3x230' ? '3x230' : undefined })} aria-label={`Net van uitgang ${i + 1}`} title={netVan(u) === '3x230' ? '3 × 230 V zonder nul: enkel toestellen voor 3 × 230 V' : '3 × 400 V met nul'}>
                {NET_KORT.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            ) : <span className="fm-uitgang-mono">230 V</span>}
            {!ro ? <button type="button" className="fm-x" aria-label={`Uitgang ${i + 1} weg`} onClick={() => onZet(lijst.filter((_, j) => j !== i))}>×</button> : <span />}
          </div>
        );
      })}
      {!ro && <button type="button" className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onZet([...lijst, { type: 'CEE 32A 3F', aantal: 1 }])}>+ Uitgang</button>}
    </div>
  );
}
