'use client';

import Info from './info';
import { useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { berekenStroom, schemaIndeling, knoopTekst, kabellijstCsv, stukkenTekst, isKabelgoot, isRolstoelGoot } from './stroom';
import { getal } from './geo';
import VasteAansluitingenLijst from './VasteAansluitingenLijst';
import { isVaId, vaUuid } from './vasteAansluitingen';

const KLEUR = { bron: '#1d1d1b', kast: '#5B21B6', verbruiker: '#2563EB' };

function Schema({ rijen }) {
  const rh = 46;
  const ind = 22;
  const h = rijen.length * rh + 8;
  return (
    <svg width="100%" viewBox={`0 0 300 ${h}`} style={{ display: 'block', background: '#FAFAFB', border: '1px solid #e8e8e6' }} role="img" aria-label="Eendraadschema">
      {rijen.map(({ k, diepte }, i) => {
        const x = 8 + diepte * ind;
        const y = 6 + i * rh;
        // verbindingslijn naar de ouder
        let lijn = null;
        if (diepte > 0) {
          let j = i - 1;
          while (j >= 0 && rijen[j].diepte >= diepte) j--;
          if (j >= 0) {
            const px = 8 + rijen[j].diepte * ind + 6;
            const py = 6 + j * rh + 34;
            lijn = <path d={`M${px} ${py} V${y + 15} H${x}`} fill="none" stroke="#9BA0A8" strokeWidth="1.2" />;
          }
        }
        const over = k.s.rol === 'bron' ? k.procent > 100 : k.s.rol === 'kast' && k.s.ampere && k.maxA > k.s.ampere;
        return (
          <g key={k.id}>
            {lijn}
            <rect x={x} y={y} width={300 - x - 6} height={34} fill="#fff" stroke={over ? '#B91C1C' : KLEUR[k.s.rol]} strokeWidth={over ? 2 : 1} />
            <rect x={x} y={y} width={4} height={34} fill={KLEUR[k.s.rol]} />
            <text x={x + 10} y={y + 14} fontSize="11" fontWeight="600" fill="#1d1d1b">{k.naam.slice(0, 34)}</text>
            <text x={x + 10} y={y + 27} fontSize="9.5" fill={over ? '#B91C1C' : '#686D76'}>{knoopTekst(k).slice(0, 52)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function schemaPdf(plan, r) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  schemaInPdf(doc, plan, r);
  doc.save(`Eendraadschema - ${plan.naam}.pdf`.replace(/[\\/:*?"<>|]/g, ''));
}

// Eendraadschema, kabellijst en meldingen op de huidige pagina van een bestaand document (A4 liggend).
export function schemaInPdf(doc, plan, r) {
  const rijen = schemaIndeling(r.bronnen.filter((b) => b.kinderen.length || !b.s.vast));
  let y = 16;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(`Eendraadschema · ${plan.naam}`, 12, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(104, 109, 118);
  doc.text(`${plan.editie_naam || ''}  versie ${plan.versie} · gelijktijdigheid ${Math.round(r.gelijktijdigheid * 100)} % · planningshulp, geen keuring: spanningsval, beveiliging en keuring liggen bij de elektricien of verhuurder.`, 12, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 12;
  const rh = 11; const ind = 10;
  rijen.forEach(({ k, diepte }, i) => {
    if (y > 190) { doc.addPage(); y = 16; }
    const x = 12 + diepte * ind;
    if (diepte > 0) { doc.setDrawColor(155, 160, 168); doc.line(x - ind + 3, y - 3, x - ind + 3, y + 4); doc.line(x - ind + 3, y + 4, x, y + 4); }
    const over = k.s.rol === 'bron' ? k.procent > 100 : k.s.rol === 'kast' && k.s.ampere && k.maxA > k.s.ampere;
    doc.setDrawColor(...(over ? [185, 28, 28] : [29, 29, 27]));
    doc.setLineWidth(over ? 0.5 : 0.2);
    doc.rect(x, y, 160, 8.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(k.naam, x + 2, y + 3.6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(knoopTekst(k), x + 2, y + 7.2);
    y += rh;
    void i;
  });
  if (r.kabels.length || r.meldingen.length) {
    doc.addPage('a4', 'landscape'); y = 16;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Kabellijst', 12, y); y += 7;
    doc.setFontSize(8);
    const kol = [12, 62, 112, 162, 190, 210, 228];
    ['Kabel', 'Van', 'Naar', 'Type', 'Spanning', 'Lengte', 'Bestellen'].forEach((t, i) => doc.text(t, kol[i], y));
    doc.setDrawColor(29, 29, 27); doc.line(12, y + 1.5, 285, y + 1.5); y += 6;
    doc.setFont('helvetica', 'normal');
    for (const c of r.kabels) {
      if (y > 195) { doc.addPage('a4', 'landscape'); y = 16; }
      [String(c.naam).slice(0, 32), String(c.van || '').slice(0, 30), String(c.naar || '').slice(0, 30), c.type, `${c.spanning} V`, `${c.lengte.toFixed(0)} m`, `${c.stukkenTekst}${c.kruisingen ? ` · ${c.kruisingen} brug` : ''}`].forEach((t, i) => doc.text(t, kol[i], y));
      y += 4.5;
    }
    y += 4; doc.setFont('helvetica', 'bold');
    for (const c of r.kabelLijst) { doc.text(`${c.type}${c.aders > 1 ? ` (${c.aders} enkeladers per verbinding)` : ''}: ${stukkenTekst(c.lengtes)} = ${c.stuks} stuks, samen ${c.meter} m (incl. marge${c.standaard ? ', standaardlengtes' : ', per 25 m'})`, 12, y); y += 5; }
    if (r.kabelbruggen) { doc.text(`Kabelbruggen: ${r.kabelbruggen}`, 12, y); y += 5; }
    y += 4; doc.setFont('helvetica', 'normal');
    for (const m of r.meldingen) { if (y > 195) { doc.addPage('a4', 'landscape'); y = 16; } doc.text(`${m.soort === 'fout' ? '!' : '·'} ${m.tekst}`, 12, y); y += 5; }
  }
}

// Netwerk als boom met belastingsbalken: bron → kast → verbruikers. Klik = selecteren op de kaart.
function Netwerk({ bronnen, geselecteerd, onKies }) {
  const kleurVan = (p) => (p > 100 ? '#B91C1C' : p > 80 ? '#D97706' : '#7C3AED');
  const Knoop = ({ k, diepte }) => {
    const sel = k.item.id === geselecteerd;
    let pct = null; let rechts = '';
    if (k.s.rol === 'bron') { pct = k.procent; rechts = k.procent != null ? `${Math.round(k.procent)} %` : `${getal(k.belast || 0, 1)} kW`; }
    else if (k.s.rol === 'kast') { const a = Math.max(k.ampereFase?.L1 || 0, k.ampereFase?.L2 || 0, k.ampereFase?.L3 || 0); pct = k.s.ampere ? (a / k.s.ampere) * 100 : null; rechts = `${Math.round(a)} A`; }
    else rechts = `${k.s.kw || '?'} kW`;
    const kinderen = k.kinderen || [];
    const verbr = kinderen.filter((c) => c.s.rol === 'verbruiker');
    const kasten = kinderen.filter((c) => c.s.rol !== 'verbruiker');
    return (
      <div className={`fm-net-knoop d${Math.min(diepte, 2)}${sel ? ' aan' : ''}`}>
        <button className="fm-net-kop" onClick={() => onKies(k.item.id)}>
          <span className="naam">{k.naam}{k.s.rol === 'kast' && k.s.ampere ? ` · ${k.s.ampere} A` : k.s.rol === 'bron' && k.s.kva ? ` · ${k.s.kva} kVA` : ''}</span>
          <span className="getal">{rechts}</span>
        </button>
        {pct != null && <div className="fm-net-balk"><div style={{ width: `${Math.min(100, pct)}%`, background: kleurVan(pct) }} /></div>}
        {verbr.length > 0 && <div className="fm-net-verbr">{verbr.map((c) => <button key={c.id} className={c.item.id === geselecteerd ? 'aan' : ''} onClick={() => onKies(c.item.id)}>{c.naam}</button>)}</div>}
        {kasten.map((c) => <Knoop key={c.id} k={c} diepte={diepte + 1} />)}
      </div>
    );
  };
  return <div className="fm-net">{bronnen.map((b) => <Knoop key={b.id} k={b} diepte={0} />)}</div>;
}

export default function StroomPaneel({ plan, items, lagen, fasen, elementenMap, schrijven, onPlan, onKiesItem, onKabelgoten = null, vast = [], inBeeld = null, gekozenVa = null, onKiesVa = null, onNieuweVa = null, geselecteerd = null, werkruimte = false }) {
  const inst = plan.instellingen?.stroom || {};
  const gelijktijdigheid = inst.gelijktijdigheid ?? 0.8;
  const routeKey = JSON.stringify(inst.routeLagen ?? lagen.filter((l) => /parcours|route|hulpdienst|weg/i.test(l.naam)).map((l) => l.id));
  const routeLagen = useMemo(() => JSON.parse(routeKey), [routeKey]);
  const r = useMemo(() => berekenStroom(items, elementenMap, { gelijktijdigheid, fasen, routeLagen, vast }), [items, elementenMap, gelijktijdigheid, fasen, routeLagen, vast]);
  const kies = (id) => (isVaId(id) && onKiesVa ? onKiesVa(vast.find((v) => v.id === vaUuid(id))) : onKiesItem(id));
  const csv = () => {
    const blob = new Blob(['\ufeff' + kabellijstCsv(r)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Kabellijst - ${plan.naam}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const rijen = schemaIndeling(r.bronnen);
  const zet = (patch) => onPlan({ instellingen: { ...(plan.instellingen || {}), stroom: { ...inst, ...patch } } });
  const leeg = !r.knopen.size;

  const verbruikers = [...r.knopen.values()].filter((k) => k.s.rol === 'verbruiker');
  const losLijst = verbruikers.filter((k) => !k.s.voeding || !r.knopen.has(k.s.voeding));
  const los = losLijst.length;
  const vastSectie = (
    <div className="fm-sectie">
      <div className="fm-kop" style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>Vaste aansluitingen · {vast.length}</span><Info>Stroomkasten van steden, Fluvius of privé, over alle evenementen heen. Wat in beeld ligt, kun je als voeding kiezen.</Info></div>
      <VasteAansluitingenLijst lijst={vast} inBeeld={inBeeld} gekozen={gekozenVa} onKies={(v) => onKiesVa?.(v)} onNieuw={schrijven && onNieuweVa ? onNieuweVa : null} compact />
    </div>
  );
  const totaalKw = verbruikers.reduce((t, k) => t + (Number(k.s.kw) || 0), 0);
  const kabelM = r.kabelLijst.reduce((t, c) => t + c.meter, 0);
  const fouten = r.meldingen.filter((m) => m.soort === 'fout').length;

  return (
    <div>
      <div className="fm-sectie">
        <div className="fm-tellers">
          <div className="fm-kpi"><small>Bronnen</small><strong>{r.bronnen.filter((b) => b.kinderen.length || !b.s.vast).length}</strong>{vast.length > 0 && <small>{inBeeld ? [...inBeeld].length : vast.length} vast in beeld</small>}</div>
          <div className="fm-kpi"><small>Verbruikers</small><strong>{verbruikers.length}</strong>{los > 0 && <small style={{ color: '#B45309' }}>{los} niet aangesloten</small>}</div>
          <div className="fm-kpi"><small>Vermogen</small><strong>{getal(totaalKw * gelijktijdigheid, 0)} kW</strong><small>{Math.round(gelijktijdigheid * 100)} % tegelijk</small></div>
          <div className="fm-kpi"><small>Kabels</small><strong>{kabelM} m</strong>{fouten > 0 && <small style={{ color: '#B91C1C' }}>{fouten} fout{fouten > 1 ? 'en' : ''}</small>}</div>
        </div>
        <details className="fm-meer"><summary>Instellingen</summary>
          <label className="fm-veld">Gelijktijdigheid · {Math.round(gelijktijdigheid * 100)} %
            <input type="range" min="0.4" max="1" step="0.05" value={gelijktijdigheid} disabled={!schrijven} onChange={(e) => zet({ gelijktijdigheid: Number(e.target.value) })} style={{ padding: 0, border: 0, height: 22 }} />
          </label>
          <div className="fm-sub">Lagen waar kabels niet zomaar over mogen ({routeLagen.length})</div>
          {lagen.map((l) => (
            <label key={l.id} className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={routeLagen.includes(l.id)} onChange={() => zet({ routeLagen: routeLagen.includes(l.id) ? routeLagen.filter((x) => x !== l.id) : [...routeLagen, l.id] })} />{l.naam}</label>
          ))}
        </details>
      </div>
      {leeg || !r.knopen.size || [...r.knopen.values()].every((k) => k.s.vast) ? (
        <>
          <div className="fm-sectie">
            <div className="fm-leeglijst"><strong>Nog geen stroom in dit plan</strong>Zet een generator op de kaart of kies een vaste aansluiting, klik dan een tent of podium en kies rechts bij Elektriciteit de voeding.</div>
          </div>
          {vastSectie}
        </>
      ) : (
        <>
          {r.meldingen.length > 0 && (
            <div className="fm-sectie">
              <div className="fm-kop">Meldingen · {r.meldingen.length}</div>
              {r.meldingen.map((m, i) => (
                <button key={i} onClick={() => onKiesItem(m.id)} style={{ textAlign: 'left', border: 0, borderLeft: `3px solid ${m.soort === 'fout' ? '#B91C1C' : m.soort === 'tip' ? '#2563EB' : '#D97706'}`, background: '#FAFAFB', padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>{m.tekst}</button>
              ))}
            </div>
          )}
          <div className="fm-sectie">
            <div className="fm-kop" style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>Net · {r.bronnen.filter((b) => b.kinderen.length || !b.s.vast).length} bronnen</span><Info>Bron → kast → verbruiker, met de belasting. Klik om op de kaart te selecteren. Vaste aansluitingen zonder verbruiker staan niet in de boom.</Info></div>
            <Netwerk bronnen={r.bronnen.filter((b) => b.kinderen.length || !b.s.vast)} geselecteerd={geselecteerd} onKies={kies} />
            {!r.bronnen.length && <div className="fm-sub">Geen bron. Zet een generator op de kaart of kies een vaste aansluiting.</div>}
            {los > 0 && (
              <div className="fm-los">
                <strong>{los} niet aangesloten</strong>
                {losLijst.map((k) => <button key={k.id} onClick={() => kies(k.item.id)}>{k.naam}</button>)}
              </div>
            )}
          </div>
          {vastSectie}
          <div className="fm-sectie">
            <details className="fm-meer" open={rijen.length <= 12}><summary>Eendraadschema · {rijen.length}</summary>
              {rijen.length ? <Schema rijen={rijen} /> : <div className="fm-sub">Verbind kasten en verbruikers met een bron.</div>}
              {rijen.length > 0 && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => schemaPdf(plan, r)}>Als PDF</button>}
            </details>
          </div>
          {(r.kabelLijst.length > 0 || r.brandstof.length > 0) && (
            <div className="fm-sectie">
              {r.kabelLijst.length > 0 && <div className="fm-kop" style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>Kabels (met 10 % marge)</span><Info>Elke kabel wordt een combinatie van de standaardlengtes uit de bibliotheek ({r.kabelLijst.filter((c) => c.standaardLengtes).map((c) => `${c.type}: ${c.standaardLengtes.join('/')} m`).join(' · ') || 'mono 5/10/20/50 m, 32 A tot Powerlock 5/10/25/50 m'}): zo weinig mogelijk stukken, daarna zo weinig mogelijk overlengte. Dezelfde lengtes als op de stuklijst.</Info></div>}
              {r.kabelLijst.map((c) => <div key={c.type} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{c.type}{c.aders > 1 && <span className="fm-sub"> · {c.aders} enkeladers per verbinding</span>}<br /><span className="fm-sub">{stukkenTekst(c.lengtes)}</span></span><span style={{ whiteSpace: 'nowrap' }}>{c.stuks} st. · {c.meter} m</span></div>)}
              {(r.kabelbruggen > 0 || r.kruispunten?.length > 0) && (() => {
                const gedekt = (r.kruispunten || []).filter((k) => k.gedekt).length;
                const open = (r.kruispunten || []).filter((k) => !k.gedekt);
                const gewoon = [...elementenMap.values()].find((e) => isKabelgoot(e) && !isRolstoelGoot(e)); const rolstoel = [...elementenMap.values()].find((e) => isRolstoelGoot(e));
                return (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>Kabelgoten nodig: {r.kabelbruggen}{gedekt ? <span className="fm-sub"> · {gedekt} gelegd</span> : null}<Info>Elke kruising van een kabel met het parcours of een route (looproute, weg) vraagt een kabelgoot. Ligt er al een goot binnen 1,2 m, dan telt die kruising als gelegd. Kies gewoon of rolstoeltoegankelijk (brede, lage oprijplaten): de goot komt over de kabel, 2 stukken breed.</Info></span>
                    {schrijven && onKabelgoten && open.length > 0 && (
                      <div className="fm-vinkrij" style={{ gap: 4 }}>
                        {gewoon && <button className="fm-knop klein" title={`${gewoon.naam} op elke open kruising`} onClick={() => onKabelgoten(gewoon, open)}>Gewone goot leggen</button>}
                        {rolstoel && <button className="fm-knop klein" title={`${rolstoel.naam} op elke open kruising`} onClick={() => onKabelgoten(rolstoel, open)}>Rolstoelgoot leggen</button>}
                      </div>
                    )}
                  </div>
                );
              })()}
              {r.kabels.length > 0 && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={csv}>Kabellijst CSV</button>}
              {r.brandstof.length > 0 && <div className="fm-kop" style={{ marginTop: 6 }}>Brandstof</div>}
              {r.brandstof.map((b) => <div key={b.fase} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}><span>{b.fase} ({getal(b.uren, 0)} u)</span><span>{getal(b.liter, 0)} l</span></div>)}
            </div>
          )}
          <div className="fm-sectie fm-sub">Planningshulp, geen keuring.<Info>Spanningsval, beveiliging en keuring blijven bij de elektricien of Intermetal.</Info></div>
        </>
      )}
    </div>
  );
}
