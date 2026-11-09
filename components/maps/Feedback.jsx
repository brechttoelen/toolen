'use client';

// Feedback van testers: een knop in de topbalk, een kort formulier (probleem · idee · vraag) en de context die de
// app zelf invult: scherm, werkruimte, gereedschap, geselecteerd item, actieve tab, kaartbeeld, een schermafdruk
// van de kaart en (met Aanwijzen) de knop of het veld waar het over gaat. Beheerders zien alles op /maps/feedback.
import { useEffect, useRef, useState } from 'react';
import { maps, sb, BUCKET, foutTekst } from './db';
import { Icoon } from './iconen';
// Eerst de MapLibre-stijl: deze knop zit in de layout, dus zijn CSS laadt vóór die van de kaart. Anders wint
// .maplibregl-map { position: relative } van .fm-kaart en heeft de kaart geen hoogte.
import 'maplibre-gl/dist/maplibre-gl.css';
import './maps.css';

// Elk scherm meldt wat er op dat moment te zien is (zie Editor, bibliotheek, plannenlijst, deellink).
let contextBron = null;
export function zetFeedbackContext(fn) { contextBron = fn; return () => { if (contextBron === fn) contextBron = null; }; }

export const SOORTEN = [['probleem', 'Probleem', 'Iets werkt niet of loopt fout'], ['idee', 'Idee', 'Iets dat beter of handiger kan'], ['vraag', 'Vraag', 'Hoe werkt …?']];

// Leesbaar pad naar een element op het scherm: paneel › tab › sectie › veld › knop.
function padVan(el) {
  const delen = [];
  const tekst = (x) => { if (!x) return ''; const k = x.cloneNode(true); k.querySelectorAll?.('.fm-info, b, .teller').forEach((n) => n.remove()); return (k.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60); };
  const eigen = el.getAttribute('aria-label') || tekst(el) || el.getAttribute('title');
  for (let x = el; x && x !== document.body; x = x.parentElement) {
    if (x.matches?.('details') && x.querySelector(':scope > summary')) delen.unshift(tekst(x.querySelector(':scope > summary')).replace(/^[+–-]\s*/, ''));
    else if (x.matches?.('.fm-veld, .fm-kiesrij, .fm-plaatsrij') && x !== el) { const l = x.querySelector('.l, span'); if (l && tekst(l)) delen.unshift(tekst(l)); }
    if (x.matches?.('.fm-eigenschappen, .fm-paneel, .fm-dialoog, .fm-topbalk, .fm-gereedschap, .fm-statusbalk, .fm-menu, .fm-contextbalk')) {
      const naam = { 'fm-eigenschappen': 'Detailpaneel', 'fm-paneel': 'Linkerpaneel', 'fm-dialoog': 'Venster', 'fm-topbalk': 'Topbalk', 'fm-gereedschap': 'Gereedschap', 'fm-statusbalk': 'Statusbalk', 'fm-menu': 'Menu', 'fm-contextbalk': 'Werkbalk' };
      const k = Object.keys(naam).find((c) => x.classList.contains(c));
      const kop = x.querySelector('.fm-paneelkop span, header h2, .fm-paneelnaam');
      const tab = x.querySelector('.fm-paneeltabs .aan, .fm-tabs .aan');
      delen.unshift([naam[k], kop && tekst(kop), tab && tekst(tab)].filter(Boolean).join(' › '));
      break;
    }
    if (x.matches?.('.fm-kaart')) { delen.unshift('Kaart'); break; }
  }
  return { label: eigen, pad: [...new Set(delen.filter(Boolean))].join(' › ') };
}

// Aanwijzen: de volgende klik kiest een knop, veld of plek; hoveren tekent een kader.
function useAanwijzen(actief, onKies) {
  useEffect(() => {
    if (!actief) return undefined;
    const kader = document.createElement('div');
    kader.className = 'fm-aanwijskader';
    document.body.appendChild(kader);
    const doel = (e) => e.target.closest?.('button, a, input, select, textarea, label, summary, .fm-chip, .fm-tbchip, [role=tab], .fm-veld, .fm-sectie, canvas') || e.target;
    const beweeg = (e) => {
      if (e.target.closest?.('.fm-feedback')) { kader.style.display = 'none'; return; }
      const r = doel(e).getBoundingClientRect();
      Object.assign(kader.style, { display: 'block', left: `${r.left - 2}px`, top: `${r.top - 2}px`, width: `${r.width + 4}px`, height: `${r.height + 4}px` });
    };
    const klik = (e) => {
      if (e.target.closest?.('.fm-feedback')) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
      const d = doel(e);
      const info = d.tagName === 'CANVAS' ? { label: 'Plek op de kaart', pad: 'Kaart' } : padVan(d);
      const kaart = d.tagName === 'CANVAS' ? contextBron?.()?.kaart : null;
      if (kaart) { try { const ll = kaart.unproject([e.clientX - d.getBoundingClientRect().left, e.clientY - d.getBoundingClientRect().top]); info.lngLat = [Number(ll.lng.toFixed(6)), Number(ll.lat.toFixed(6))]; } catch {} }
      onKies(info);
    };
    const stop = (e) => { if (!e.target.closest?.('.fm-feedback')) { e.preventDefault(); e.stopPropagation(); } };
    const esc = (e) => { if (e.key === 'Escape') onKies(null); };
    document.addEventListener('mousemove', beweeg, true);
    document.addEventListener('click', klik, true);
    document.addEventListener('mousedown', stop, true);
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('keydown', esc, true);
    document.body.classList.add('fm-aanwijzen');
    return () => {
      document.removeEventListener('mousemove', beweeg, true); document.removeEventListener('click', klik, true);
      document.removeEventListener('mousedown', stop, true); document.removeEventListener('pointerdown', stop, true);
      document.removeEventListener('keydown', esc, true); document.body.classList.remove('fm-aanwijzen'); kader.remove();
    };
  }, [actief, onKies]);
}

// Schermafdruk van de kaart: in het render-event is de tekening nog niet gewist.
function kaartBeeld(kaart) {
  return new Promise((ok) => {
    if (!kaart) { ok(null); return; }
    let klaar = false;
    const t = setTimeout(() => { if (!klaar) { klaar = true; ok(null); } }, 1500);
    kaart.once('render', () => {
      if (klaar) return; klaar = true; clearTimeout(t);
      try { kaart.getCanvas().toBlob((b) => ok(b), 'image/jpeg', 0.72); } catch { ok(null); }
    });
    kaart.triggerRepaint();
  });
}

// Scherm uit het adres, voor pagina's zonder eigen context.
function schermUitPad() {
  const p = typeof location !== 'undefined' ? location.pathname : '';
  if (/\/bibliotheek\/teken/.test(p)) return 'Element tekenen';
  if (/\/bibliotheek/.test(p)) return 'Bibliotheek beheren';
  if (/\/feedback/.test(p)) return 'Feedbackoverzicht';
  if (/^\/d\//.test(p)) return 'Deellink';
  if (/\/opbouw/.test(p)) return 'Opbouwmodus';
  if (/^\/maps\/?$/.test(p)) return 'Plannenlijst';
  return 'Toolen Maps';
}
const omgeving = () => ({
  url: typeof location !== 'undefined' ? location.pathname + location.search : '',
  venster: typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '',
  browser: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : '',
  versie: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
  tijd: new Date().toISOString(),
});

export default function FeedbackKnop({ deelToken = null, klein = false }) {
  const [open, setOpen] = useState(false);
  const [soort, setSoort] = useState('probleem');
  const [tekst, setTekst] = useState('');
  const [naam, setNaam] = useState('');
  const [aanwijzen, setAanwijzen] = useState(false);
  const [aangewezen, setAangewezen] = useState(null);
  const [metBeeld, setMetBeeld] = useState(true);
  const [ctx, setCtx] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState(false);
  const [fout, setFout] = useState('');
  const veld = useRef(null);

  const openen = () => {
    const c = contextBron?.() || { scherm: schermUitPad() };
    setCtx(c); setOpen(true); setKlaar(false); setFout(''); setAangewezen(null);
    try { setNaam(localStorage.getItem('fm-feedback-naam') || ''); } catch {}
    setTimeout(() => veld.current?.focus(), 30);
  };
  useAanwijzen(aanwijzen, (info) => { setAanwijzen(false); if (info) setAangewezen(info); setTimeout(() => veld.current?.focus(), 30); });

  const verstuur = async () => {
    if (!tekst.trim()) { setFout('Schrijf kort wat er is.'); return; }
    setBezig(true); setFout('');
    const { kaart, ...rest } = ctx || {};
    const context = { ...rest, ...omgeving(), ...(aangewezen ? { aangewezen } : {}) };
    try {
      if (deelToken) {
        try { localStorage.setItem('fm-feedback-naam', naam); } catch {}
        const { data, error } = await maps().rpc('deel_link_feedback', { p_token: deelToken, p_naam: naam, p_soort: soort, p_tekst: tekst.trim(), p_context: context });
        if (error || !data) throw error || new Error('De feedback kon niet bewaard worden.');
      } else {
        let schermafdruk = null;
        if (metBeeld && kaart) {
          const blob = await kaartBeeld(kaart);
          if (blob) {
            const pad = `feedback/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
            const up = await sb().storage.from(BUCKET).upload(pad, blob, { contentType: 'image/jpeg' });
            if (!up.error) schermafdruk = pad;
          }
        }
        const { data: u } = await sb().auth.getUser();
        const { error } = await maps().from('feedback').insert({
          auteur_id: u?.user?.id, auteur_naam: rest.gebruiker || u?.user?.email || null, soort, tekst: tekst.trim(),
          plan_id: rest.plan?.id || null, item_id: rest.item?.id || null, context, schermafdruk,
        });
        if (error) throw error;
      }
      setKlaar(true); setTekst(''); setAangewezen(null);
      setTimeout(() => { setOpen(false); setKlaar(false); }, 1600);
    } catch (e) { setFout(foutTekst(e) || 'De feedback kon niet bewaard worden.'); }
    setBezig(false);
  };

  const samenvatting = ctx ? [ctx.scherm, ctx.werkruimte && ctx.werkruimte !== 'Plan' ? ctx.werkruimte : null, ctx.item ? `${ctx.item.naam || ctx.item.element || ctx.item.soort}${ctx.item.familie ? ` (${ctx.item.familie})` : ''}` : null, ctx.tab ? `tab ${ctx.tab}` : null, ctx.gereedschap && ctx.gereedschap !== 'Selecteren' ? ctx.gereedschap : null].filter(Boolean).join(' · ') : '';

  return (
    <>
      <button type="button" className={`fm-knop${klein ? ' klein' : ''} fm-feedbackknop`} title="Feedback geven: probleem, idee of vraag (de app noteert waar je bent)" onClick={() => (open ? setOpen(false) : openen())}>
        <Icoon naam="feedback" maat={16} />{!klein && <span className="lbl">Feedback</span>}
      </button>
      {open && (
        <div className={`fm fm-feedback${aanwijzen ? ' wijst' : ''}`} role="dialog" aria-label="Feedback geven">
          <div className="fm-fb-kop"><strong>Feedback</strong><span className="fm-sub">beta</span><button type="button" className="fm-sluit" aria-label="Sluiten" onClick={() => { setOpen(false); setAanwijzen(false); }}>×</button></div>
          {klaar ? <div className="fm-fb-klaar">Bedankt, je feedback is bewaard.</div> : (
            <>
              <div className="fm-segment fm-fb-soort" role="group" aria-label="Soort">
                {SOORTEN.map(([k, n, uitleg]) => <button key={k} type="button" title={uitleg} className={soort === k ? 'aan' : ''} onClick={() => setSoort(k)}>{n}</button>)}
              </div>
              <textarea ref={veld} rows={4} value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder={soort === 'probleem' ? 'Wat liep er fout? Wat deed je net?' : soort === 'idee' ? 'Wat zou beter of handiger zijn?' : 'Wat wil je weten?'}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) verstuur(); }} />
              {deelToken && <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Je naam (optioneel)" aria-label="Je naam" />}
              <div className="fm-fb-waar">
                <span className="fm-sub">Gaat over</span>
                <span className="fm-fb-ctx" title={samenvatting}>{samenvatting || 'dit scherm'}</span>
                {aangewezen ? (
                  <span className="fm-fb-aangewezen" title={aangewezen.pad}>→ {aangewezen.pad ? `${aangewezen.pad} › ` : ''}<b>{aangewezen.label}</b><button type="button" className="fm-link" onClick={() => setAangewezen(null)}>weg</button></span>
                ) : null}
                <button type="button" className={`fm-knop klein${aanwijzen ? ' zwart' : ''}`} onClick={() => setAanwijzen((a) => !a)} title="Klik daarna op de knop, het veld of de plek op de kaart waar het over gaat">{aanwijzen ? 'Klik nu op de knop of plek… (Esc)' : aangewezen ? 'Iets anders aanwijzen' : 'Aanwijzen op het scherm'}</button>
              </div>
              {!deelToken && ctx?.kaart && <label className="fm-vink"><input type="checkbox" checked={metBeeld} onChange={(e) => setMetBeeld(e.target.checked)} />Schermafdruk van de kaart meesturen</label>}
              {fout && <div className="fm-melding fout">{fout}</div>}
              <div className="fm-fb-knoppen"><a className="fm-link" href="/maps/feedback" target="_blank" rel="noreferrer" hidden={!!deelToken}>Mijn feedback</a><button type="button" className="fm-knop rood" disabled={bezig || !tekst.trim()} onClick={verstuur}>{bezig ? 'Bewaren…' : 'Versturen'}</button></div>
            </>
          )}
        </div>
      )}
    </>
  );
}
