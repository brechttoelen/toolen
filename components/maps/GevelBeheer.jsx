'use client';

// Bibliotheekbeheer: vaste deuren en ramen van een unit (zoals de leverancier ze levert), met een bovenaanzicht.
import { GEVEL_SOORTEN, gevelLijn, gevelZijdeLengte } from './containerbouw';

const ZIJ = [['V', 'Voor'], ['A', 'Achter'], ['L', 'Links'], ['R', 'Rechts']];
const nr = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','));
const getal = (t) => { const v = Number(String(t).replace(',', '.')); return Number.isFinite(v) ? v : ''; };

export default function GevelBeheer({ L, B, gevel = [], schrijven, onZet }) {
  const zet = (i, patch) => onZet(gevel.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const W = 220; const s = (W - 40) / Math.max(L, B, 1); const H = B * s + 40;
  const X = (q) => 20 + q[0] * s; const Y = (q) => 20 + (B - q[1]) * s; // y omhoog = achter
  return (
    <div className="fm-sectie fm-gevel">
      <div className="fm-kop">Deuren en ramen</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="fm-gevel-plan" aria-label="Bovenaanzicht van de unit">
        <rect x={20} y={20} width={L * s} height={B * s} fill="#F3F4F6" stroke="#6B7280" strokeWidth={1.5} />
        <text x={20 + (L * s) / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#6B7280">Voor</text>
        <text x={20 + (L * s) / 2} y={13} textAnchor="middle" fontSize={10} fill="#6B7280">Achter</text>
        {gevel.map((o, i) => { const { a, e } = gevelLijn(o, L, B); const raam = o.soort === 'raam'; return <line key={i} x1={X(a)} y1={Y(a)} x2={X(e)} y2={Y(e)} stroke={raam ? '#3B82F6' : '#111827'} strokeWidth={raam ? 4 : 6} strokeLinecap="butt" />; })}
      </svg>
      {gevel.length > 0 && (
        <div className="fm-gevel-rijen">
          <span className="fm-sub">Zijde</span><span className="fm-sub">Soort</span><span className="fm-sub">Vanaf</span><span className="fm-sub">Breed</span><span />
          {gevel.map((o, i) => {
            const S = GEVEL_SOORTEN[o.soort] || GEVEL_SOORTEN.raam; const max = gevelZijdeLengte(o.zijde, L, B);
            return [
              <select key={`z${i}`} value={o.zijde} disabled={!schrijven} onChange={(e) => zet(i, { zijde: e.target.value })}>{ZIJ.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>,
              <select key={`s${i}`} value={o.soort} disabled={!schrijven} onChange={(e) => zet(i, { soort: e.target.value, breedte: undefined })}>{Object.entries(GEVEL_SOORTEN).map(([k, v]) => <option key={k} value={k}>{v.naam}</option>)}</select>,
              <input key={`v${i}`} inputMode="decimal" value={nr(o.van)} disabled={!schrijven} title={`0 tot ${nr(max)} m, vanaf de linkerhoek van buiten bekeken`} onChange={(e) => zet(i, { van: getal(e.target.value) })} />,
              <input key={`b${i}`} inputMode="decimal" value={nr(o.breedte ?? '')} placeholder={nr(S.b)} disabled={!schrijven} onChange={(e) => zet(i, { breedte: getal(e.target.value) || undefined })} />,
              <button key={`x${i}`} type="button" className="fm-knop klein" disabled={!schrijven} aria-label="Weghalen" onClick={() => onZet(gevel.filter((_, j) => j !== i))}>×</button>,
            ];
          })}
        </div>
      )}
      {schrijven && <div className="fm-ws-acties"><button type="button" className="fm-knop klein" onClick={() => onZet([...gevel, { zijde: 'V', soort: 'deur', van: 0.5 }])}>+ Deur</button><button type="button" className="fm-knop klein" onClick={() => onZet([...gevel, { zijde: 'V', soort: 'raam', van: 2 }])}>+ Raam</button></div>}
    </div>
  );
}
