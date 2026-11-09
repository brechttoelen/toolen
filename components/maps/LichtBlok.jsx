'use client';

// Zijpaneel van een lichtmast: licht aan/uit, rondom (360°) of alle spots naar één kant (180°), richting en bereik.
import { lichtBereik, lichtVan } from './licht';

const KOMPAS = [['N', 0], ['NO', 45], ['O', 90], ['ZO', 135], ['Z', 180], ['ZW', 225], ['W', 270], ['NW', 315]];
const getal = (v) => Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 0 });

export function LichtBlok({ item, el, schrijven, onWijzig, onActie }) {
  const l = item.velden?.licht || {}; const soort = lichtVan(el); const b = lichtBereik(item, el); const ballon = soort?.soort === 'ballon';
  const zet = (p) => onWijzig({ ...l, ...p });
  const r = Number(l.richting) || 0;
  return (
    <div className="fm-sectie fm-licht">
      <div className="fm-kop">Licht</div>
      {/* Eén keuze voor de toestand: uit, rondom of naar één kant (een lichtballon: uit of aan). */}
      <div className="fm-segment" role="group" aria-label="Licht">
        <button type="button" disabled={!schrijven} className={!l.aan ? 'aan' : ''} onClick={() => zet({ aan: false })}>Uit</button>
        {ballon ? (
          <button type="button" disabled={!schrijven} className={l.aan ? 'aan geel' : ''} onClick={() => zet({ aan: true })}>Aan</button>
        ) : (
          <>
            <button type="button" disabled={!schrijven} className={l.aan && l.modus !== '180' ? 'aan geel' : ''} onClick={() => zet({ modus: '360', aan: true })} title={`360°: ${b?.spots || 4} spots breed rondom`}>Rondom</button>
            <button type="button" disabled={!schrijven} className={l.aan && l.modus === '180' ? 'aan geel' : ''} onClick={() => zet({ modus: '180', aan: true })} title="180°: alle spots naar één kant, breed open">Eén kant</button>
          </>
        )}
      </div>
      {!ballon && (
        <>
          {l.modus === '180' && (
            <div className="fm-licht-richting">
              <div className="fm-licht-kompas">{KOMPAS.map(([n, g]) => <button key={n} type="button" disabled={!schrijven} className={Math.round(r) === g ? 'aan' : ''} onClick={() => zet({ richting: g })}>{n}</button>)}</div>
              <label className="fm-licht-graden">Richting<input type="number" min="0" max="359" step="5" disabled={!schrijven} value={Math.round(r)} onChange={(e) => zet({ richting: ((Number(e.target.value) % 360) + 360) % 360 })} />°</label>
              {schrijven && <button type="button" className="fm-knop klein" onClick={() => onActie?.('licht-richten')} title="Klik daarna op de kaart waar het licht naartoe moet">Richting aanwijzen op de kaart</button>}
            </div>
          )}
        </>
      )}
      {b && <div className="fm-sub">Bereik ± {getal(b.R)} m{b.half ? ' naar één kant' : ' rondom'} · ± {getal(b.opp)} m² bij ± 20 lux. Richtwaarde: {soort.spots && !ballon ? `${soort.spots} × ${soort.watt} W LED` : 'lichtballon'}, zie de fiche van de leverancier.</div>}
      <div className="fm-licht-alle"><span className="fm-sub">Alle lichtmasten op dit plan</span>
        <button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => onActie?.('licht-alle-aan')}>Aan</button>
        <button type="button" className="fm-knop klein" disabled={!schrijven} onClick={() => onActie?.('licht-alle-uit')}>Uit</button>
      </div>
      <label className="fm-veld">Bereik zelf instellen (m, leeg = richtwaarde)<input type="number" min="5" max="150" step="1" disabled={!schrijven} value={l.bereik ?? ''} placeholder={b ? String(b.R) : ''} onChange={(e) => zet({ bereik: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} /></label>
    </div>
  );
}
