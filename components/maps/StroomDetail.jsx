'use client';

import { StroomSectie } from './Eigenschappen';
import { stroomVan, uitgangenBezetting, uitgangVoorKind, isMonoKnoop } from './stroom';
import { getal } from './geo';

// Rechterpaneel in de werkruimte Stroom: belasting, fasen en vrije uitgangen van het gekozen item,
// daaronder de gewone elektriciteitsvelden (rol, voeding, kW, kabel).
export default function StroomDetail({ item, el, stroom, items, elementenMap, vast, schrijven, onZet, onKabel, onKiesItem }) {
  const s = stroomVan(item, el);
  const knoop = stroom?.knopen?.get(item.id) || null;
  const deel = stroom ? [...stroom.knopen.values()].filter((k) => k.item.id === item.id) : [];
  const meld = (stroom?.meldingen || []).filter((m) => m.id === item.id);
  const kinderen = knoop?.kinderen || [];
  const fasen = knoop?.ampereFase;
  const max = s.rol === 'kast' ? Number(s.ampere) || 0 : s.rol === 'bron' && s.kva ? (Number(s.kva) * 1000) / (Math.sqrt(3) * 400) : 0;
  const vals = fasen ? [fasen.L1, fasen.L2, fasen.L3] : [0, 0, 0];
  const hoog = Math.max(...vals); const laag = Math.min(...vals);
  // Een mono kast (stekkerdoos, invoer op een mono-stekker) heeft maar één fase: niets te verdelen.
  const mono = s.rol === 'kast' && isMonoKnoop(s);
  const ongelijk = !mono && hoog > 0 && (hoog - laag) / hoog > 0.4;
  const vol = ['L1', 'L2', 'L3'][vals.indexOf(hoog)]; const leeg = ['L1', 'L2', 'L3'][vals.indexOf(laag)];
  const bezetting = knoop && (s.rol === 'kast' || s.rol === 'bron') ? knoop.bezetting ?? uitgangenBezetting(s.uitgangen, knoop) : null;
  const voedingKnoop = (k) => (k.s.voeding ? stroom?.knopen?.get(k.s.voeding) : null);
  // Op welke uitgang van zijn voeding een aansluiting hangt (voor de lijst van verbruikers en per aansluiting).
  const uitgangVan = (k) => { const v = voedingKnoop(k); return v ? uitgangVoorKind(v.bezetting, k.id) : null; };
  return (
    <div className="fm-paneel-inhoud">
      {(s.rol === 'kast' || s.rol === 'bron') && (
        <div className="fm-sectie">
          <div className="fm-tellers">
            <div className="fm-kpi"><small>{s.rol === 'bron' ? 'Belasting' : 'Hoogste fase'}</small><strong>{s.rol === 'bron' ? (knoop?.procent != null ? `${Math.round(knoop.procent)} %` : '–') : `${Math.round(hoog)} A`}</strong><small>{s.rol === 'bron' ? `${getal(knoop?.belast || 0, 1)} kW van ${getal(knoop?.capaciteit || 0, 0)} kW` : s.ampere ? `van ${s.ampere} A` : 'ingang onbekend'}</small></div>
            <div className="fm-kpi"><small>Aangesloten</small><strong>{kinderen.length}</strong><small>{getal(knoop?.kw || 0, 1)} kW samen</small></div>
          </div>
          {fasen && (
            <div className="fm-fasen">
              {(mono ? [s.fase && s.fase !== '3F' ? s.fase : 'L1'] : ['L1', 'L2', 'L3']).map((f) => <div key={f} className="fm-fase"><span>{f}</span><div className="balk"><div style={{ width: `${max ? Math.min(100, (fasen[f] / max) * 100) : 0}%`, background: max && fasen[f] > max ? '#B91C1C' : '#7C3AED' }} /></div><span>{Math.round(fasen[f])} A</span></div>)}
              {ongelijk && <div className="fm-sub" style={{ color: '#B45309' }}>Fasen ongelijk: zet een verbruiker van {vol} op {leeg}.</div>}
            </div>
          )}
          {bezetting ? (
            <div>
              <div className="fm-kop">Uitgangen{s.uitgangenStandaard ? <span className="fm-sub" style={{ fontWeight: 400 }}> · standaard voor {s.kva} kVA</span> : ''}</div>
              {s.ingang && <div className="fm-sub">Ingang {s.ingang}{s.ampere ? ` · ${s.ampere} A` : ''}</div>}
              {bezetting.map((u, i) => <div key={`${u.type}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12 }}><span>{u.aantal} × {u.type}{u.doorlus ? <span className="fm-sub"> · doorlus</span> : ''}</span><span style={{ color: u.vrij > 0 ? '#686D76' : '#B91C1C', whiteSpace: 'nowrap' }}>{u.bezet ? `${u.bezet} bezet · ` : ''}{u.vrij} vrij</span></div>)}
              {s.afzekering && <div className="fm-sub">Afzekering: {s.afzekering}</div>}
            </div>
          ) : s.rol === 'kast' && schrijven ? <div className="fm-sub">Geen uitgangen bekend: vul ze hieronder in (bv. 2 × CEE 32A 3F) om vrije uitgangen te zien.</div> : null}
          {kinderen.length > 0 && (
            <div>
              <div className="fm-kop">Hierop aangesloten</div>
              <div className="fm-net-verbr">{kinderen.map((k) => { const u = bezetting ? uitgangVoorKind(bezetting, k.id) : null; return <button key={k.id} onClick={() => onKiesItem(k.item.id)} title={u ? `Op ${u}` : bezetting ? 'Geen vrije uitgang' : undefined} style={bezetting && !u ? { borderColor: '#B91C1C', color: '#B91C1C' } : undefined}>{k.naam}{k.s.kw ? ` · ${k.s.kw} kW` : ''}{k.s.fase && k.s.fase !== '3F' ? ` · ${k.s.fase}` : ''}{u ? ` → ${u}` : ''}</button>; })}</div>
            </div>
          )}
        </div>
      )}
      {s.rol === 'kast' && knoop && (
        // Waar deze kast zelf op hangt, en op welke uitgang daar (bv. de stroominvoer op de generator buiten).
        <div className="fm-sectie">
          {(() => { const v = voedingKnoop(knoop); const u = uitgangVan(knoop); return (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12 }}>
              <span>{s.invoer ? 'Kabel van buiten' : 'Gevoed door'}{s.ingang ? <span className="fm-sub"> · {s.ingang}</span> : ''}{v && u ? <span className="fm-sub"> · op {u}</span> : ''}</span>
              {v ? <button className="fm-knop klein" onClick={() => onKiesItem(v.item.id)}>← {v.naam}</button> : <span style={{ color: '#B45309' }}>niet aangesloten</span>}
            </div>
          ); })()}
        </div>
      )}
      {s.rol === 'verbruiker' && deel.length > 0 && (
        <div className="fm-sectie">
          {deel.map((k) => { const v = voedingKnoop(k); return (
            <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12 }}>
              <span>{deel.length > 1 ? k.naam.split(' · ').slice(1).join(' · ') || k.naam : `${k.s.kw || '?'} kW · ${k.s.fase === '3F' ? '3 fasen' : k.s.fase}${k.s.ampere ? ` · ${k.s.ampere} A` : ''}`}{v && uitgangVan(k) ? <span className="fm-sub"> · {uitgangVan(k)}</span> : ''}</span>
              {v ? <button className="fm-knop klein" onClick={() => onKiesItem(v.item.id)}>← {v.naam}</button> : <span style={{ color: '#B45309' }}>niet aangesloten</span>}
            </div>
          ); })}
        </div>
      )}
      {meld.length > 0 && (
        <div className="fm-sectie">
          {meld.map((m, i) => <div key={i} style={{ fontSize: 12, borderLeft: `3px solid ${m.soort === 'fout' ? '#B91C1C' : m.soort === 'tip' ? '#2563EB' : '#D97706'}`, paddingLeft: 6 }}>{m.tekst}</div>)}
        </div>
      )}
      <StroomSectie item={item} el={el} items={items} elementenMap={elementenMap} ro={!schrijven} isLijn={item.geometrie?.type === 'LineString'} onZet={onZet} onKabel={onKabel} vast={vast} open />
      {(s.rol === 'kast' || s.rol === 'bron') && schrijven && (
        <div className="fm-sectie">
          <UitgangenVeld waarde={s.uitgangen || []} standaard={s.uitgangenStandaard} rol={s.rol} onZet={(l) => onZet({ uitgangen: l })} />
        </div>
      )}
    </div>
  );
}

function UitgangenVeld({ waarde, onZet, standaard = false, rol = 'kast' }) {
  const TYPES = ['CEE 16A mono', 'Schuko', 'CEE 16A 3F', 'CEE 32A 3F', 'CEE 63A', 'CEE 125A', 'Powerlock'];
  const lijst = Array.isArray(waarde) ? waarde : [];
  const zet = (i, p) => onZet(lijst.map((u, j) => (j === i ? { ...u, ...p } : u)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="fm-kop">Uitgangen van de {rol === 'bron' ? 'bron' : 'kast'}</div>
      {standaard && <div className="fm-sub">Standaard volgens het vermogen; pas aan als deze stroomgroep andere stopcontacten heeft.</div>}
      {lijst.map((u, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input inputMode="numeric" value={u.aantal ?? 1} onChange={(e) => zet(i, { aantal: Number(e.target.value) || 1 })} style={{ width: 44, height: 30 }} aria-label="Aantal" />
          <span>×</span>
          <select value={u.type || ''} onChange={(e) => zet(i, { type: e.target.value })} style={{ flex: 1, height: 30 }} aria-label="Type"><option value="">Kies…</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <button className="fm-knop klein gevaar" aria-label="Uitgang weg" onClick={() => onZet(lijst.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onZet([...lijst, { type: 'CEE 32A 3F', aantal: 1 }])}>+ Uitgang</button>
    </div>
  );
}
