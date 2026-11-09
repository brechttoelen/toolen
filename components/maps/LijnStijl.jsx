'use client';

// Stijl van lijnen en vlakken: snelstijlen bovenaan (één klik), daaronder een
// visueel paneel waar elke keuze toont wat ze doet.
import { useState } from 'react';

export const STANDAARD_SNELSTIJLEN = [
  { id: 's-nadar', naam: 'Afsluiting Nadar', voor: 'lijn', stijl: { kleur: '#D97706', dikte: 3, dikte_eenheid: 'px', streep: 'vol', wit_rand: true, dekking: 1 } },
  { id: 's-heras', naam: 'Heras', voor: 'lijn', stijl: { kleur: '#1d1d1b', dikte: 3, dikte_eenheid: 'px', streep: 'streep', wit_rand: true, dekking: 1 } },
  { id: 's-parcours', naam: 'Parcours', voor: 'lijn', stijl: { kleur: '#E11D48', dikte: 6, dikte_eenheid: 'px', streep: 'vol', wit_rand: false, dekking: 0.9 } },
  { id: 's-zonegrens', naam: 'Zonegrens', voor: 'lijn', stijl: { kleur: '#2563EB', dikte: 2.5, dikte_eenheid: 'px', streep: 'streeppunt', wit_rand: true, dekking: 1 } },
  { id: 's-brandweg', naam: 'Brandweg 4 m', voor: 'lijn', stijl: { kleur: '#16865C', dikte: 4, dikte_eenheid: 'm', streep: 'vol', wit_rand: false, dekking: 0.45 } },
  { id: 's-wandel', naam: 'Wandelroute publiek', voor: 'lijn', stijl: { kleur: '#ffffff', dikte: 3, dikte_eenheid: 'px', streep: 'stip', wit_rand: false, dekking: 1 } },
  { id: 's-route', naam: 'Route met pijl', voor: 'lijn', stijl: { kleur: '#1d1d1b', dikte: 3, dikte_eenheid: 'px', streep: 'vol', pijl: 'einde', wit_rand: true, dekking: 1 } },
  { id: 's-kabel', naam: 'Stroomkabel', voor: 'lijn', stijl: { kleur: '#5B21B6', dikte: 2, dikte_eenheid: 'px', streep: 'streep', wit_rand: true, dekking: 1 } },
  { id: 's-publiek', naam: 'Publiekszone', voor: 'vlak', stijl: { kleur: '#2563EB', dikte: 2, dikte_eenheid: 'px', streep: 'vol', vulkleur: '#2563EB', vuldekking: 0.15, vulpatroon: 'effen', dekking: 1 } },
  { id: 's-vip', naam: 'VIP-zone', voor: 'vlak', stijl: { kleur: '#5B21B6', dikte: 2, dikte_eenheid: 'px', streep: 'vol', vulkleur: '#5B21B6', vuldekking: 0.18, vulpatroon: 'effen', dekking: 1 } },
  { id: 's-verboden', naam: 'Verboden zone', voor: 'vlak', stijl: { kleur: '#B91C1C', dikte: 2, dikte_eenheid: 'px', streep: 'streep', vulkleur: '#B91C1C', vuldekking: 0.35, vulpatroon: 'arcering', dekking: 1 } },
  { id: 's-werf', naam: 'Werfzone / opbouw', voor: 'vlak', stijl: { kleur: '#D97706', dikte: 2, dikte_eenheid: 'px', streep: 'streeppunt', vulkleur: '#D97706', vuldekking: 0.2, vulpatroon: 'arcering', dekking: 1 } },
  { id: 's-teams', naam: 'Teamzone', voor: 'vlak', stijl: { kleur: '#EAB308', dikte: 2, dikte_eenheid: 'px', streep: 'vol', vulkleur: '#EAB308', vuldekking: 0.22, vulpatroon: 'effen', dekking: 1 } },
  { id: 's-groen', naam: 'Gras / groen', voor: 'vlak', stijl: { kleur: '#16865C', dikte: 1, dikte_eenheid: 'px', streep: 'vol', vulkleur: '#16865C', vuldekking: 0.25, vulpatroon: 'effen', dekking: 1 } },
];

import { PALET_HEX as KLEUREN, kleurNaam } from './kleuren';
const STREEP = { vol: null, streep: '9 5', stip: '0.1 6', streeppunt: '10 4 2 4' };

// Klein voorbeeld van een stijl op een luchtfoto-achtige ondergrond.
export function StijlVoorbeeld({ s, vlak = false, w = 140, h = 34 }) {
  const dik = s.dikte_eenheid === 'm' ? Math.min(16, (Number(s.dikte) || 1) * 3) : Math.min(12, Number(s.dikte) || 2);
  const d = vlak ? `M10 ${h - 6} L${w * 0.35} 6 L${w - 10} 9 L${w - 22} ${h - 5} Z` : `M8 ${h - 10} C${w * 0.3} ${h * 0.25} ${w * 0.55} ${h * 0.85} ${w - 8} ${h * 0.3}`;
  const kleur = s.kleur || '#2563EB';
  const dash = STREEP[s.streep || 'vol'];
  const pijl = !vlak && (s.pijl === 'einde' || s.pijl === 'beide');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      <rect width={w} height={h} fill="#7c8a68" />
      <path d={`M0 ${h * 0.75} C${w * 0.4} ${h * 0.55} ${w * 0.6} ${h * 0.95} ${w} ${h * 0.6}`} stroke="#93a07e" strokeWidth="9" fill="none" />
      {vlak && <path d={d} fill={s.vulkleur || kleur} fillOpacity={s.vulpatroon === 'geen' ? 0 : (s.vuldekking ?? 0.2)} stroke="none" />}
      {vlak && s.vulpatroon === 'arcering' && <path d={d} fill="url(#fm-arc)" stroke="none" />}
      <defs><pattern id="fm-arc" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke={s.vulkleur || kleur} strokeWidth="1.5" /></pattern></defs>
      {s.wit_rand && <path d={d} fill="none" stroke="#fff" strokeWidth={dik + 4} strokeLinecap="round" strokeLinejoin="round" />}
      {Number(s.dubbel) > 0 && !vlak ? (
        <>
          <path d={d} fill="none" stroke={kleur} strokeWidth={dik} strokeDasharray={dash || undefined} strokeLinecap="round" transform="translate(0,-3)" opacity={s.dekking ?? 1} />
          <path d={d} fill="none" stroke={kleur} strokeWidth={dik} strokeDasharray={dash || undefined} strokeLinecap="round" transform="translate(0,3)" opacity={s.dekking ?? 1} />
        </>
      ) : <path d={d} fill="none" stroke={kleur} strokeWidth={dik} strokeDasharray={dash || undefined} strokeLinecap="round" strokeLinejoin="round" opacity={s.dekking ?? 1} />}
      {pijl && <path d={`M${w - 4} ${h * 0.3} l-10 -4 l2 10 z`} fill={kleur} />}
    </svg>
  );
}

function Lijntje({ dash, dik = 3, dubbel }) {
  return (
    <svg width="100%" height="10" viewBox="0 0 40 10" aria-hidden="true">
      {dubbel ? <path d="M0 2H40M0 8H40" stroke="#1d1d1b" strokeWidth="2" /> : <path d="M1 5H39" stroke="#1d1d1b" strokeWidth={dik} strokeDasharray={dash || undefined} strokeLinecap={dash === '0.1 6' ? 'round' : 'butt'} />}
    </svg>
  );
}

// Snelstijlen: standaard + die van FLCS (bibliotheek) + die van dit plan.
export function Snelstijlen({ soort, eigen = [], plan = [], huidig, uitgeschakeld, onKies }) {
  const [zoek, setZoek] = useState('');
  const q = zoek.trim().toLowerCase();
  const alle = [
    ...eigen.map((x) => ({ id: x.id, naam: x.naam, voor: x.eigenschappen?.voor || 'lijn', stijl: x.stijl || {}, flcs: true })),
    ...STANDAARD_SNELSTIJLEN,
    ...plan.map((x) => ({ id: `p-${x.naam}`, naam: x.naam, voor: x.voor || soort, stijl: x.stijl || {}, plan: true })),
  ].filter((x) => x.voor === soort && (!q || x.naam.toLowerCase().includes(q)));
  const zelfde = (a) => ['kleur', 'dikte', 'streep', 'vulkleur', 'vulpatroon'].every((k) => String(a[k] ?? '') === String(huidig?.[k] ?? ''));
  return (
    <div className="fm-snelstijlen">
      <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een snelstijl" aria-label="Zoek een snelstijl" />
      <div className="fm-snelraster">
        {alle.map((x) => (
          <button key={x.id} className={zelfde(x.stijl) ? 'aan' : ''} disabled={uitgeschakeld} onClick={() => onKies(x)} title={x.flcs ? 'Snelstijl van de organisatie' : x.plan ? 'Stijl van dit plan' : 'Standaard snelstijl'}>
            <StijlVoorbeeld s={x.stijl} vlak={soort === 'vlak'} />
            <span>{x.naam}</span>
          </button>
        ))}
        {!alle.length && <div className="fm-sub">Niets gevonden.</div>}
      </div>
    </div>
  );
}

// Visueel paneel: kleur, dikte, lijn, uiteinden, aan/uit, dekking (en vulling bij vlakken).
export function StijlVisueel({ s, soort, uitgeschakeld: ro, onStijl, VULLINGEN = [] }) {
  const vlak = soort === 'vlak';
  const dikPx = s.dikte_eenheid !== 'm';
  const kies = (k, v) => onStijl({ [k]: v });
  return (
    <div className="fm-stijlvis">
      <StijlVoorbeeld s={s} vlak={vlak} w={300} h={64} />
      <div className="fm-stijlrij">
        <span>Kleur</span>
        <div className="fm-rondkleuren">
          {KLEUREN.map((k) => <button key={k} aria-label={kleurNaam(k)} title={kleurNaam(k)} disabled={ro} className={String(s.kleur).toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} onClick={() => kies('kleur', k)} />)}
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.kleur || '') ? s.kleur : '#1d1d1b'} disabled={ro} onChange={(e) => kies('kleur', e.target.value)} aria-label="Eigen kleur" />
        </div>
      </div>
      <div className="fm-stijlrij">
        <span>Dikte</span>
        <div className="fm-keuzes">
          {[1, 2, 4, 7].map((d) => <button key={d} aria-label={`${d} px`} disabled={ro} className={dikPx && Number(s.dikte) === d ? 'aan' : ''} onClick={() => onStijl({ dikte: d, dikte_eenheid: 'px' })}><span style={{ display: 'block', width: '100%', height: d, background: '#1d1d1b' }} /></button>)}
          <button disabled={ro} className={!dikPx ? 'aan' : ''} title="Op ware breedte, in meter (bv. een brandweg van 4 m)" onClick={() => onStijl({ dikte_eenheid: 'm', dikte: dikPx ? 4 : s.dikte })}>meter</button>
        </div>
        <label className="fm-stijlgetal">
          <input type="number" min="0.5" step="0.5" value={s.dikte ?? ''} disabled={ro} onChange={(e) => Number(e.target.value) > 0 && kies('dikte', Number(e.target.value))} aria-label="Dikte" />
          {dikPx ? 'px' : 'm'}
        </label>
      </div>
      <div className="fm-stijlrij">
        <span>{vlak ? 'Rand' : 'Lijn'}</span>
        <div className="fm-keuzes">
          {[['vol', 'Vol'], ['streep', 'Streep'], ['stip', 'Stip'], ['streeppunt', 'Streep-punt']].map(([k, t]) => <button key={k} aria-label={t} title={t} disabled={ro} className={(s.streep || 'vol') === k && !(Number(s.dubbel) > 0) ? 'aan' : ''} onClick={() => onStijl({ streep: k, ...(vlak ? {} : { dubbel: null }) })}><Lijntje dash={STREEP[k]} /></button>)}
          {!vlak && <button aria-label="Dubbele lijn" title="Dubbele lijn" disabled={ro} className={Number(s.dubbel) > 0 ? 'aan' : ''} onClick={() => kies('dubbel', Number(s.dubbel) > 0 ? null : 1)}><Lijntje dubbel /></button>}
        </div>
      </div>
      {!vlak && (
        <div className="fm-stijlrij">
          <span>Uiteinden</span>
          <div className="fm-keuzes">
            {[['geen', 'Geen', 'M2 5H38'], ['einde', 'Pijl op het einde', 'M2 5H31'], ['begin', 'Pijl aan het begin', 'M9 5H38'], ['beide', 'Pijl aan beide kanten', 'M9 5H31']].map(([k, t, d]) => (
              <button key={k} aria-label={t} title={t} disabled={ro} className={(s.pijl || 'geen') === k && !s.maatlijn ? 'aan' : ''} onClick={() => onStijl({ pijl: k, maatlijn: false })}>
                <svg width="100%" height="10" viewBox="0 0 40 10" aria-hidden="true"><path d={d} stroke="#1d1d1b" strokeWidth="2" />{(k === 'einde' || k === 'beide') && <path d="M30 1L38 5L30 9Z" fill="#1d1d1b" />}{(k === 'begin' || k === 'beide') && <path d="M10 1L2 5L10 9Z" fill="#1d1d1b" />}</svg>
              </button>
            ))}
            <button aria-label="Maatlijn" title="Maatlijn (met lengte)" disabled={ro} className={s.maatlijn ? 'aan' : ''} onClick={() => onStijl({ maatlijn: !s.maatlijn, pijl: 'geen' })}>
              <svg width="100%" height="10" viewBox="0 0 40 10" aria-hidden="true"><path d="M2 5H38M2 0V10M38 0V10" stroke="#1d1d1b" strokeWidth="1.5" /></svg>
            </button>
          </div>
        </div>
      )}
      <div className="fm-aanuit">
        <button aria-pressed={!!s.wit_rand} disabled={ro} className={s.wit_rand ? 'aan' : ''} onClick={() => kies('wit_rand', !s.wit_rand)} title="Leesbaar op de luchtfoto">Witte rand</button>
        {!vlak && <button aria-pressed={!!s.vloeiend} disabled={ro} className={s.vloeiend ? 'aan' : ''} onClick={() => kies('vloeiend', !s.vloeiend)}>Vloeiend</button>}
        {!vlak && <button aria-pressed={!!s.tekst_langs} disabled={ro} className={s.tekst_langs ? 'aan' : ''} onClick={() => kies('tekst_langs', !s.tekst_langs)}>Naam langs de lijn</button>}
      </div>
      <label className="fm-stijlschuif">
        <span>Dekking</span>
        <input type="range" min="0.1" max="1" step="0.05" value={s.dekking ?? 1} disabled={ro} onChange={(e) => kies('dekking', Number(e.target.value))} />
        <b>{Math.round((s.dekking ?? 1) * 100)} %</b>
      </label>
      {vlak && (
        <>
          <div className="fm-stijlrij">
            <span>Vulling</span>
            <div className="fm-rondkleuren">
              {KLEUREN.map((k) => <button key={k} aria-label={`Vulling ${k}`} disabled={ro} className={String(s.vulkleur || s.kleur).toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} onClick={() => kies('vulkleur', k)} />)}
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.vulkleur || '') ? s.vulkleur : (s.kleur || '#2563EB')} disabled={ro} onChange={(e) => kies('vulkleur', e.target.value)} aria-label="Eigen vulkleur" />
            </div>
          </div>
          <div className="fm-stijlrij">
            <span>Patroon</span>
            <select value={s.vulpatroon || 'effen'} disabled={ro} onChange={(e) => kies('vulpatroon', e.target.value)} aria-label="Vulpatroon">
              {VULLINGEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </div>
          <label className="fm-stijlschuif">
            <span>Vulling</span>
            <input type="range" min="0" max="1" step="0.05" value={s.vuldekking ?? 0.2} disabled={ro} onChange={(e) => kies('vuldekking', Number(e.target.value))} />
            <b>{Math.round((s.vuldekking ?? 0.2) * 100)} %</b>
          </label>
        </>
      )}
    </div>
  );
}
