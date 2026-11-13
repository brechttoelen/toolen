'use client';

// Deellink "Stroom": de lijst met stroompunten (generatoren, vaste aansluitingen) en binnenlocaties. Een punt openen
// toont wat er moet staan, wat mee moet, het aansluitschema en de aandachtspunten (zoals het stroomdossier, zonder
// controlelijst). "Toon op de kaart" zoomt in op dat net; de nummers staan als bolletjes op de kaart.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import './kaartwerker';
import { berekenStroom } from './stroom';
import { dossierGegevens, meeRijen } from './stroomDossier';
import { kader as bbox } from './geo';

const g1 = (x, d = 0) => Number(x || 0).toLocaleString('nl-BE', { maximumFractionDigits: d });
const basisId = (id) => String(id).split('#')[0];
const kaartUrl = (pos) => (pos ? `https://www.google.com/maps?q=${pos[1].toFixed(6)},${pos[0].toFixed(6)}` : null);
const KLEUR = { bron: '#E11D48', vast: '#15803D', kast: '#5B21B6', verbruiker: '#0369A1', tank: '#B45309' };

export function useStroomDossier(data, items, elementenMap) {
  return useMemo(() => {
    if (!data?.link?.opties?.stroom) return null;
    try {
      const stroom = berekenStroom(items, elementenMap, { gelijktijdigheid: data.plan?.instellingen?.stroom?.gelijktijdigheid ?? 0.8, vast: data.vast || [] });
      return { stroom, d: dossierGegevens({ stroom, items, elementenMap, plan: data.plan, fasen: [] }) };
    } catch (e) { console.warn('stroom', e); return null; }
  }, [data, items, elementenMap]);
}

function bolEl(tekst, kleur, groot) {
  const e = document.createElement('div');
  e.className = `fm-stroombol${groot ? ' groot' : ''}`; e.style.background = kleur; e.textContent = tekst;
  return e;
}

export default function StroomDeel({ sd, map, items, onSluit, onBinnen, gsm = false }) {
  const [open, setOpenS] = useState(null); // nr van het geopende punt (S1, B1)
  // Gsm: onderaan een blad dat lijst, detail of (na "Toon op de kaart") enkel een balkje toont.
  const [stand, setStand] = useState('lijst');
  const setOpen = (nr) => { setOpenS(nr); setStand(nr ? 'detail' : 'lijst'); };
  const markers = useRef([]);
  const { d } = sd;
  const punt = open ? d.punten.find((p) => p.nr === open) || d.binnen.find((b) => b.nr === open) : null;

  // Bolletjes op de kaart: alle stroompunten; van het geopende punt ook de kasten en verbruikers.
  useEffect(() => {
    if (!map) return undefined;
    for (const m of markers.current) m.remove();
    markers.current = [];
    const zet = (pos, tekst, kleur, groot, klik) => {
      if (!pos) return; const el = bolEl(tekst, kleur, groot);
      if (klik) el.addEventListener('click', (e) => { e.stopPropagation(); klik(); });
      markers.current.push(new maplibregl.Marker({ element: el, offset: groot ? [14, -14] : [10, -10] }).setLngLat(pos).addTo(map));
    };
    for (const p of d.punten) zet(p.pos, p.nr, p.vast ? KLEUR.vast : KLEUR.bron, true, () => setOpen(p.nr));
    for (const t of d.tanks) zet(t.pos, t.nr, KLEUR.tank, true, null);
    if (punt && punt.rijen && !punt.host) {
      const gedaan = new Set();
      for (const r of punt.rijen) {
        const id = basisId(r.k.id); if (gedaan.has(id) || r.k.s.rol === 'bron' || r.k.item.velden?.binnen) continue; gedaan.add(id);
        const it = items.find((x) => x.id === id); const pos = it?.geometrie ? middenVan(it.geometrie) : null;
        zet(pos, r.code, r.k.s.rol === 'kast' ? KLEUR.kast : KLEUR.verbruiker, false, null);
      }
    }
    return () => { for (const m of markers.current) m.remove(); markers.current = []; };
  }, [map, d, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toon = (p) => {
    if (!map) return;
    const ids = p.ids || new Set([p.host?.id]);
    const geoms = items.filter((i) => ids.has(i.id) && !i.velden?.binnen).map((i) => i.geometrie).filter(Boolean);
    if (p.b?.item?.geometrie) geoms.push(p.b.item.geometrie);
    if (p.host?.geometrie) geoms.push(p.host.geometrie);
    const b = bbox(geoms); if (!b) return;
    if (gsm) setStand('kaart');
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: gsm ? { top: 50, bottom: 140, left: 40, right: 40 } : { top: 60, bottom: 60, left: 420, right: 60 }, maxZoom: 20, duration: 400 });
  };
  // Bij het openen: alle stroompunten in beeld, vrij van het paneel.
  const eersteKeer = useRef(true);
  useEffect(() => {
    if (!map || !eersteKeer.current) return; eersteKeer.current = false;
    const pts = [...d.punten, ...d.tanks].map((p) => p.pos).filter(Boolean); if (!pts.length) return;
    const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
    const h = map.getContainer().clientHeight;
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: gsm ? { top: 50, bottom: Math.round(h * 0.55), left: 40, right: 40 } : { top: 60, bottom: 60, left: 420, right: 60 }, maxZoom: 19, duration: 0 });
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`fm-zwevend fm-stroomdeel${gsm ? ` gsm ${stand}` : ''}`}>
      {gsm && <div className="fm-stroomgreep" aria-hidden="true" />}
      {gsm && punt && stand === 'kaart' ? (
        <button className="fm-stroompeek" onClick={() => setStand('detail')}>
          <span className="nr" style={{ background: punt.host ? '#1d1d1b' : punt.vast ? KLEUR.vast : KLEUR.bron }}>{punt.nr}</span>
          <span className="tekst"><b>{punt.host ? punt.naam : punt.titel}</b><span>Tik voor wat mee moet en het aansluitschema</span></span>
          <span className="pijl">▲</span>
        </button>
      ) : !punt ? (
        <>
          <div className="fm-stroomdeel-kop"><strong>Stroompunten</strong><button className="fm-x" aria-label="Sluiten" onClick={onSluit}>×</button></div>
          <div className="fm-sub" style={{ padding: '0 12px 8px' }}>Klik een punt voor wat er moet staan, wat mee moet en hoe het aangesloten wordt.</div>
          {d.punten.map((p) => (
            <button key={p.nr} className="fm-stroomkaart" onClick={() => { setOpen(p.nr); toon(p); }}>
              <span className="nr" style={{ background: p.vast ? KLEUR.vast : KLEUR.bron }}>{p.nr}</span>
              <span className="tekst"><b>{p.titel}</b><span>{[p.lev, p.vast ? null : `${p.kva || '?'} kVA`, `${p.kasten.reduce((t, k) => t + k.aantal, 0)} kast(en)`, `${p.rijen.filter((r) => r.k.s.rol === 'verbruiker').length} verbruiker(s)`].filter(Boolean).join(' · ')}</span></span>
              {p.meldingen.some((m) => m.soort === 'fout') && <span className="fm-tag rood">let op</span>}
            </button>
          ))}
          {d.tanks.map((t) => (
            <div key={t.nr} className="fm-stroomkaart stil"><span className="nr" style={{ background: KLEUR.tank }}>{t.nr}</span><span className="tekst"><b>{t.titel}</b><span>{t.lev}</span></span></div>
          ))}
          {d.binnen.length > 0 && <div className="fm-mat-lab" style={{ padding: '10px 12px 4px' }}>Binnenlocaties</div>}
          {d.binnen.map((g) => (
            <button key={g.nr} className="fm-stroomkaart" onClick={() => { setOpen(g.nr); toon(g); }}>
              <span className="nr" style={{ background: '#1d1d1b' }}>{g.nr}</span>
              <span className="tekst"><b>{g.naam}</b><span>gevoed vanuit {g.punten.join(', ')} · {g.rijen.length} aansluitingen</span></span>
            </button>
          ))}
        </>
      ) : (
        <PuntDetail p={punt} gsm={gsm} gelijk={d.gelijktijdigheid} onTerug={() => setOpen(null)} onToon={() => toon(punt)} onBinnen={onBinnen} />
      )}
    </div>
  );
}

function middenVan(g) {
  if (g.type === 'Point') return g.coordinates;
  const c = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates;
  const n = c.length - (g.type === 'Polygon' ? 1 : 0) || 1;
  return [c.slice(0, n).reduce((t, p) => t + p[0], 0) / n, c.slice(0, n).reduce((t, p) => t + p[1], 0) / n];
}

function PuntDetail({ p, gsm, gelijk, onTerug, onToon, onBinnen }) {
  const binnen = !!p.host;
  const mee = binnen
    ? [...p.kasten.map((k) => [k.aantal, `${k.naam} (${k.codes.join(', ')})`, k.leverancier]), ...p.kabelTypes.map((c) => [Object.values(c.stukken).reduce((a, q) => a + q, 0), `Kabel ${c.type}: ${Object.entries(c.stukken).sort((a, b) => b[0] - a[0]).map(([l, n]) => `${n} × ${l} m`).join(' + ')}`, c.leverancier])]
    : meeRijen(p);
  const url = kaartUrl(p.pos);
  return (
    <div className="fm-stroomdetail">
      <div className="fm-stroomdeel-kop"><button className="fm-knop klein" onClick={onTerug}>‹ Alle punten</button>{gsm && <button className="fm-knop klein zwart" onClick={onToon}>Kaart</button>}</div>
      <div style={{ padding: '0 12px' }}>
        <div className="fm-stroomtitel"><span className="nr" style={{ background: binnen ? '#1d1d1b' : p.vast ? KLEUR.vast : KLEUR.bron }}>{p.nr}</span><h3>{binnen ? p.naam : p.titel}</h3></div>
        <div className="fm-sub">
          {binnen ? `Binnen · gevoed vanuit ${p.punten.join(', ')}`
            : p.vast ? [p.lev, p.vast.adres, p.vast.max_ampere ? `max ${p.vast.max_ampere} A` : null].filter(Boolean).join(' · ')
              : [`${p.kva || '?'} kVA`, p.lev, `belasting ± ${g1(p.belast || 0, 1)} kW${p.procent != null ? ` (${Math.round(p.procent)} % bij ${Math.round(gelijk * 100)} % gelijktijdigheid)` : ''}`].join(' · ')}
        </div>
        <div className="fm-stroomknoppen">
          {!gsm && <button className="fm-knop klein zwart" onClick={onToon}>Toon op de kaart</button>}
          {url && <a className={`fm-knop${gsm ? ' rood fm-stroomroute' : ' klein'}`} href={url} target="_blank" rel="noreferrer">{gsm ? 'Navigeer hierheen' : 'Route (Google Maps)'}</a>}
          {binnen && onBinnen && <button className="fm-knop klein" onClick={() => onBinnen(p.host.id)}>Binnen bekijken</button>}
        </div>

        <h4>Mee te nemen</h4>
        <table className="fm-tabel fm-stroomtabel"><tbody>
          {mee.length ? mee.map(([n, w, l], i) => <tr key={i}><td className="getal">{g1(n)}</td><td>{w}{l ? <div className="fm-sub">{l}</div> : null}</td></tr>) : <tr><td colSpan={2} className="fm-sub">Niets</td></tr>}
        </tbody></table>
        {!binnen && !p.vast && (p.tank || p.lph) && (
          <><h4>Brandstof</h4><div className="fm-sub">{[p.tank ? `Tank ${g1(p.tank)} L` : '', p.lph ? `± ${g1(p.lph, 1)} L/u bij vollast` : '', p.tank && p.lph ? `± ${g1(p.tank / p.lph)} u zonder bijtanken` : ''].filter(Boolean).join(' · ')}</div></>
        )}

        <h4>Aansluitschema</h4>
        <div className="fm-stroomschema">
          {p.rijen.map((r, i) => {
            const rol = r.k.s.rol; const kl = rol === 'bron' ? (p.vast ? KLEUR.vast : KLEUR.bron) : rol === 'kast' ? KLEUR.kast : KLEUR.verbruiker;
            return (
              <div key={i} className="rij" style={{ marginLeft: Math.max(0, r.diepte - (binnen ? Math.min(...p.rijen.map((x) => x.diepte)) : 0)) * 14 }}>
                {r.kabels.map((c) => (
                  <div key={c.code} className="kabel"><span className="k" style={{ background: c.spanning === 230 ? '#2563EB' : '#DC2626' }}>{c.code}</span>{(c.eigen ? [r.uitgang ? `op ${r.uitgang}` : null, `eigen kabel van ${c.eigenLev} (${c.eigenL} m)`, `${g1(c.lengte)} m nodig`] : [r.uitgang ? `op ${r.uitgang}` : null, c.type, `${g1(c.lengte)} m → ${c.stukkenTekst}`, c.kruisingen ? `${c.kruisingen}× kabelbrug` : null]).filter(Boolean).join(' · ')}</div>
                ))}
                {r.geenUitgang && <div className="kabel fout">geen passende uitgang: verdeelkast ertussen</div>}
                {!r.kabels.length && r.eigenKabel && <div className={`kabel${r.eigenKabel.past ? ' ok' : ' fout'}`}>eigen kabel van {r.eigenKabel.lev} ({r.eigenKabel.lengte} m){r.eigenKabel.afstand != null ? ` · ± ${g1(r.eigenKabel.afstand)} m tot de kast` : ''}</div>}
                {!r.kabels.length && !r.eigenKabel && r.diepte > 0 && !binnen && <div className="kabel fout">geen kabel getekend</div>}
                <div className="knoop" style={{ borderColor: kl }}>
                  <span className="c" style={{ background: kl }}>{rol === 'bron' ? (p.nr.startsWith('B') ? r.p?.nr : p.nr) : binnen ? `${r.p.nr}.${r.code}` : r.code}</span>
                  <span><b>{r.k.naam}</b><span className="fm-sub">{knoopInfo(r)}</span></span>
                </div>
              </div>
            );
          })}
        </div>

        {(p.meldingen || []).length > 0 && (
          <><h4>Aandacht</h4>{p.meldingen.map((m, i) => <div key={i} className={`fm-sub${m.soort === 'fout' ? ' fm-rood' : ''}`} style={{ marginBottom: 4 }}>{m.tekst}</div>)}</>
        )}
        <div className="fm-sub" style={{ margin: '14px 0' }}>Planningshulp, geen keuring: beveiliging, spanningsval en keuring liggen bij de elektricien of verhuurder.</div>
      </div>
    </div>
  );
}

function knoopInfo(r) {
  const s = r.k.s;
  if (s.rol === 'bron') return [s.kva ? `${s.kva} kVA` : null, `± ${g1(r.k.belast || 0, 1)} kW`, (r.k.bezetting || []).map((u) => `${u.bezet}/${u.aantal} × ${u.type}`).join(', ')].filter(Boolean).join(' · ');
  if (s.rol === 'kast') return [s.ampere ? `${s.ampere} A` : null, `${g1(r.k.kw || 0, 1)} kW`, (r.k.bezetting || []).map((u) => `${u.bezet}/${u.aantal} × ${u.type}`).join(', ')].filter(Boolean).join(' · ');
  return [s.kw ? `${s.kw} kW` : 'kW onbekend', s.fase === '3F' ? '3 fasen' : s.fase, s.ampere ? `${s.ampere} A` : null].filter(Boolean).join(' · ');
}
