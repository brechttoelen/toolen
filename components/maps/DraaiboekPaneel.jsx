'use client';

// Draaiboek: opbouw- of afbraakvolgorde per fase met een tijdlijn, berekend uit
// de opbouwtijd en het aantal mensen per stuk in de bibliotheek.
import Info from './info';
import { useMemo, useState } from 'react';
import { maten } from './stijl';
import { download } from './uitwisseling';

const pad2 = (n) => String(n).padStart(2, '0');
const uurTekst = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const duurTekst = (min) => (min >= 60 ? `${Math.floor(min / 60)} u ${min % 60 ? `${Math.round(min % 60)} min` : ''}`.trim() : `${Math.round(min)} min`);

export default function DraaiboekPaneel({ plan, items, elementenMap, fasen, actieveFase, schrijven, onPlan }) {
  const [soort, setSoort] = useState('opbouw');
  const faseId = actieveFase || 'alle';
  const fase = fasen.find((f) => f.id === actieveFase) || null;
  const db = plan.instellingen?.draaiboek || {};
  const cfg = db[`${faseId}:${soort}`] || {};
  const zet = (patch) => onPlan({ instellingen: { ...(plan.instellingen || {}), draaiboek: { ...db, [`${faseId}:${soort}`]: { ...cfg, ...patch } } } });

  // Groepen: per element (en variant) in deze fase.
  const groepen = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.element_id || it.verborgen) continue;
      if (actieveFase && it.fase_ids?.length && !it.fase_ids.includes(actieveFase)) continue;
      const el = elementenMap.get(it.element_id);
      if (!el || el.tekenwijze === 'sjabloon') continue;
      const sleutel = `${el.id}|${it.velden?.variant || ''}`;
      const m = maten(it, el);
      const stuks = el.tekenwijze === 'lijn' ? (m.stuks || 0) : (m.stuks || 1);
      const e = el.eigenschappen || {};
      const perStuk = soort === 'opbouw' ? Number(e.opbouw_min) || 0 : Number(e.afbraak_min) || (Number(e.opbouw_min) ? Math.round(Number(e.opbouw_min) * 0.6) : 0);
      const g = map.get(sleutel) || { sleutel, naam: it.velden?.variant ? `${el.naam} · ${it.velden.variant}` : el.naam, leverancier: el.leverancier || '', stuks: 0, perStuk, mensen: Number(e.mensen) || 1, schatting: soort === 'afbraak' && !e.afbraak_min && !!e.opbouw_min };
      g.stuks += stuks;
      map.set(sleutel, g);
    }
    return [...map.values()];
  }, [items, elementenMap, actieveFase, soort]);

  // Volgorde: bewaarde volgorde eerst, nieuwe groepen achteraan.
  const volgorde = [...(cfg.volgorde || []).filter((k) => groepen.some((g) => g.sleutel === k)), ...groepen.map((g) => g.sleutel).filter((k) => !(cfg.volgorde || []).includes(k))];
  const ploegen = cfg.ploegen || {};
  const parallel = cfg.parallel || {}; // tegelijk met de vorige stap

  // Starttijd: begin van de fase, of de ingestelde start.
  const startBasis = cfg.start ? new Date(cfg.start) : fase?.van ? new Date(fase.van) : (() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; })();
  const rijen = [];
  let klok = startBasis.getTime();
  let vorigeStart = klok;
  for (const k of volgorde) {
    const g = groepen.find((x) => x.sleutel === k);
    const n = Math.max(1, Number(ploegen[k]) || 1);
    const duur = (g.stuks * g.perStuk) / n;
    const begin = parallel[k] ? vorigeStart : klok;
    const einde = begin + duur * 60000;
    rijen.push({ ...g, ploegen: n, duur, begin: new Date(begin), einde: new Date(einde), manuren: (g.stuks * g.perStuk * g.mensen) / 60, parallel: !!parallel[k] });
    vorigeStart = begin;
    klok = Math.max(klok, einde);
  }
  const totaalEinde = rijen.length ? new Date(Math.max(...rijen.map((r) => r.einde.getTime()))) : startBasis;
  const totaalMin = (totaalEinde - startBasis) / 60000;
  const manuren = rijen.reduce((s, r) => s + r.manuren, 0);
  const zonderTijd = rijen.filter((r) => !r.perStuk);
  const maxPloeg = Math.max(0, ...rijen.map((r) => r.mensen * r.ploegen));

  const verplaats = (k, d) => {
    const v = [...volgorde]; const i = v.indexOf(k); const j = i + d;
    if (j < 0 || j >= v.length) return;
    [v[i], v[j]] = [v[j], v[i]];
    zet({ volgorde: v });
  };
  const exporteer = () => {
    const regels = [['Stap', 'Element', 'Leverancier', 'Stuks', 'Min per stuk', 'Mensen per ploeg', 'Ploegen', 'Start', 'Einde', 'Duur (min)', 'Manuren'].join(';')];
    rijen.forEach((r, i) => regels.push([i + 1, r.naam, r.leverancier, r.stuks, r.perStuk, r.mensen, r.ploegen, r.begin.toLocaleString('nl-BE'), r.einde.toLocaleString('nl-BE'), Math.round(r.duur), r.manuren.toFixed(1).replace('.', ',')].join(';')));
    download(`﻿${regels.join('\n')}`, `${plan.naam} - draaiboek ${soort}${fase ? ` - ${fase.naam}` : ''}.csv`, 'text/csv');
  };

  // Tijdlijn
  const W = 228; const span = Math.max(30, totaalMin);
  const x = (d) => ((d - startBasis) / 60000 / span) * W;
  const stapUur = span > 60 * 24 ? 360 : span > 60 * 8 ? 120 : 60;

  return (
    <div>
      <div className="fm-sectie">
        <div className="fm-segment">
          {[['opbouw', 'Opbouw'], ['afbraak', 'Afbraak']].map(([k, t]) => <button key={k} className={soort === k ? 'aan' : ''} onClick={() => setSoort(k)}>{t}</button>)}
        </div>
        <div className="fm-sub">{fase ? `Fase ${fase.naam}` : 'Alle fasen'}<Info>Kies bovenaan een fase om per fase te plannen. Tijden per stuk en mensen komen uit de bibliotheek.</Info></div>
        <label className="fm-veld">Start
          <input type="datetime-local" disabled={!schrijven} value={`${startBasis.getFullYear()}-${pad2(startBasis.getMonth() + 1)}-${pad2(startBasis.getDate())}T${uurTekst(startBasis)}`}
            onChange={(e) => zet({ start: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <div className="fm-kpi"><small>Klaar om</small><strong>{uurTekst(totaalEinde)}</strong>{totaalEinde.toDateString() !== startBasis.toDateString() && <small>{totaalEinde.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })}</small>}</div>
          <div className="fm-kpi"><small>Duur</small><strong>{duurTekst(totaalMin)}</strong></div>
          <div className="fm-kpi"><small>Manuren</small><strong>{manuren.toFixed(1).replace('.', ',')}</strong>{maxPloeg > 0 && <small>max {maxPloeg} p. tegelijk</small>}</div>
        </div>
        {zonderTijd.length > 0 && <div className="fm-melding info" style={{ fontSize: 11.5 }}>{zonderTijd.length} {zonderTijd.length === 1 ? 'element heeft' : 'elementen hebben'} nog geen opbouwtijd: {zonderTijd.map((r) => r.naam).join(', ')}. Vul ze in de bibliotheek in.</div>}
      </div>

      {rijen.length > 0 && (
        <div className="fm-sectie">
          <div className="fm-kop">Tijdlijn</div>
          <svg width={W + 4} height={rijen.length * 16 + 22} style={{ display: 'block' }}>
            {Array.from({ length: Math.floor(span / stapUur) + 1 }, (_, i) => {
              const t = new Date(startBasis.getTime() + i * stapUur * 60000);
              const xx = x(t) + 2;
              return <g key={i}><line x1={xx} y1={0} x2={xx} y2={rijen.length * 16 + 4} stroke="#ececea" /><text x={xx + 2} y={rijen.length * 16 + 16} fontSize={9} fill="#686D76">{uurTekst(t)}</text></g>;
            })}
            {rijen.map((r, i) => (
              <g key={r.sleutel}>
                <rect x={x(r.begin) + 2} y={i * 16 + 3} width={Math.max(2, x(r.einde) - x(r.begin))} height={11} fill={r.perStuk ? '#1d1d1b' : '#D97706'} opacity={r.perStuk ? 0.85 : 0.5}>
                  <title>{`${r.naam}: ${uurTekst(r.begin)}–${uurTekst(r.einde)}`}</title>
                </rect>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className="fm-sectie" style={{ gap: 6 }}>
        <div className="fm-kop">Volgorde</div>
        {!rijen.length && <div className="fm-sub">Nog geen elementen uit de bibliotheek in {fase ? 'deze fase' : 'dit plan'}.</div>}
        {rijen.map((r, i) => (
          <div key={r.sleutel} className="fm-stap">
            <div className="kop">
              <span className="nr">{i + 1}</span>
              <span className="naam">{r.naam}</span>
              {schrijven && <span className="pijlen"><button disabled={i === 0} onClick={() => verplaats(r.sleutel, -1)} aria-label="Eerder">↑</button><button disabled={i === rijen.length - 1} onClick={() => verplaats(r.sleutel, 1)} aria-label="Later">↓</button></span>}
            </div>
            <div className="fm-sub">
              {uurTekst(r.begin)}–{uurTekst(r.einde)} · {r.stuks} st. × {r.perStuk || '?'} min{r.schatting ? ' (geschat)' : ''} · {r.mensen} p. per ploeg{r.leverancier ? ` · ${r.leverancier}` : ''}
            </div>
            {schrijven && (
              <div className="fm-vinkrij" style={{ alignItems: 'center' }}>
                <label className="fm-vink" style={{ gap: 4 }}>Ploegen
                  <select value={r.ploegen} onChange={(e) => zet({ ploegen: { ...ploegen, [r.sleutel]: Number(e.target.value) } })} style={{ height: 24, width: 52 }}>{[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                </label>
                {i > 0 && <label className="fm-vink"><input type="checkbox" checked={r.parallel} onChange={(e) => zet({ parallel: { ...parallel, [r.sleutel]: e.target.checked } })} />Tegelijk met vorige</label>}
              </div>
            )}
          </div>
        ))}
        {rijen.length > 0 && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={exporteer}>Als CSV (Excel)</button>}
      </div>
    </div>
  );
}
