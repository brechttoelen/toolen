'use client';

// Toolen Maps op de gsm: eerst kijken, een paar dingen doen ter plaatse.
// Vier tabbladen: Plannen, Kaart, Meldingen, Meer. Het gekozen plan blijft bewaard op dit toestel.
import { useCallback, useEffect, useRef, useState } from 'react';
import '../maps/maps.css';
import './mobiel.css';
import { wieBenIk, maps } from '../maps/db';
import { Ic } from './iconen';
import Start from './Start';
import Kaart from './Kaart';
import Meldingen from './Meldingen';
import Meer from './Meer';

const TABS = [['plannen', 'Plannen'], ['kaart', 'Kaart'], ['meldingen', 'Meldingen'], ['meer', 'Meer']];
const PLAN_SLEUTEL = 'fm-mob-plan';
const lees = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const zet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* */ } };

export const initialen = (p) => {
  const n = String(p?.display_name || p?.naam || p?.email || '?').replace(/@.*/, '').trim();
  const d = n.split(/[\s._-]+/).filter(Boolean);
  return ((d[0]?.[0] || '?') + (d[1]?.[0] || '')).toUpperCase();
};

/** @param {{ huisstijl?: any }} props */
export default function MobielApp({ huisstijl = null }) {
  const [tab, setTab] = useState('plannen');
  const [planId, setPlanId] = useState(null);
  const [doel, setDoel] = useState(null); // { punt } of { item } om naartoe te gaan op de kaart
  const [profiel, setProfiel] = useState(null);
  const [aantalOpen, setAantalOpen] = useState(0);

  // De app volgt altijd het zichtbare deel van het scherm (visualViewport): ook als Safari de pagina ingezoomd
  // of verschoven heeft, als de werkbalk van Safari in beeld schuift of als het toetsenbord open staat.
  // Zo valt er nooit iets buiten beeld. Knijpen zoomt de kaart, niet de app; staat de pagina toch ingezoomd,
  // dan mag knijpen wel, zodat je weer kan uitzoomen.
  const schilRef = useRef(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const ingezoomd = () => !!vv && vv.scale > 1.02;
    const pas = () => {
      const el = schilRef.current; if (!el || !vv) return;
      el.style.left = `${vv.offsetLeft}px`; el.style.top = `${vv.offsetTop}px`;
      el.style.width = `${vv.width}px`; el.style.height = `${vv.height}px`; el.style.right = 'auto'; el.style.bottom = 'auto';
      // Toetsenbord open (het zichtbare deel is veel lager dan normaal): de onderbalk verbergen, anders schuift ze mee omhoog.
      const h = vv.height * vv.scale; hoogst = Math.max(hoogst, h);
      el.classList.toggle('toets', h < hoogst - 140);
    };
    let hoogst = 0;
    // Ingezoomd blijven hangen (bv. na een tik in een veld): de schaal terugzetten via de viewport-instelling.
    const herstel = () => {
      if (!ingezoomd() || document.activeElement?.matches?.('input, textarea, select')) return;
      const meta = document.querySelector('meta[name="viewport"]'); if (!meta) return;
      const c = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
      meta.setAttribute('content', `${c}, shrink-to-fit=no`); requestAnimationFrame(() => meta.setAttribute('content', c));
    };
    const stop = (e) => { if (!ingezoomd()) e.preventDefault(); };
    const tweeVingers = (e) => { if (!ingezoomd() && e.touches && e.touches.length > 1 && !e.target.closest?.('.maplibregl-canvas-container, .fm-deel-binnen, canvas')) e.preventDefault(); };
    pas(); herstel();
    vv?.addEventListener('resize', pas); vv?.addEventListener('scroll', pas);
    document.addEventListener('focusout', herstel);
    document.addEventListener('gesturestart', stop, { passive: false });
    document.addEventListener('gesturechange', stop, { passive: false });
    document.addEventListener('touchmove', tweeVingers, { passive: false });
    return () => {
      vv?.removeEventListener('resize', pas); vv?.removeEventListener('scroll', pas);
      document.removeEventListener('focusout', herstel);
      document.removeEventListener('gesturestart', stop); document.removeEventListener('gesturechange', stop); document.removeEventListener('touchmove', tweeVingers);
    };
  }, []);

  useEffect(() => {
    setPlanId(lees(PLAN_SLEUTEL));
    try { sessionStorage.removeItem('fm-volledig'); } catch { /* */ }
    wieBenIk().then((p) => { setProfiel(p); try { if (p) localStorage.setItem('fm-mob-ik', JSON.stringify(p)); } catch { /* */ } }).catch(() => {
      try { setProfiel(JSON.parse(lees('fm-mob-ik') || 'null')); } catch { /* */ }
    });
    maps().from('opmerkingen').select('id', { count: 'exact', head: true }).eq('status', 'open').then(({ count }) => setAantalOpen(count || 0), () => {});
    // Service worker: app en kaarttegels offline (dezelfde als de opbouwmodus).
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/maps-sw.js', { scope: '/maps/' }).catch(() => {});
    // Terugknop van de gsm: terug naar het vorige tabblad.
    const terug = (e) => { const t = e.state?.mbTab; if (t) setTab(t); };
    window.addEventListener('popstate', terug);
    history.replaceState({ mbTab: 'plannen' }, '');
    return () => window.removeEventListener('popstate', terug);
  }, []);

  const naar = useCallback((t) => {
    setTab((oud) => { if (oud !== t) history.pushState({ mbTab: t }, ''); return t; });
  }, []);
  const openPlan = useCallback((id, d = null) => { setPlanId(id); zet(PLAN_SLEUTEL, id); setDoel(d); naar('kaart'); }, [naar]);

  return (
    <div className="mb" ref={schilRef}>
      {tab === 'plannen' && <Start huisstijl={huisstijl} profiel={profiel} planId={planId} onPlan={openPlan} onMeer={() => naar('meer')} />}
      {tab === 'kaart' && <Kaart planId={planId} profiel={profiel} doel={doel} onKiesPlan={() => naar('plannen')} />}
      {tab === 'meldingen' && <Meldingen profiel={profiel} onOpen={openPlan} onAantal={setAantalOpen} />}
      {tab === 'meer' && <Meer huisstijl={huisstijl} profiel={profiel} planId={planId} onDelen={() => openPlan(planId, { paneel: 'delen' })} />}
      <nav className="mb-tab" aria-label="Hoofdmenu">
        {TABS.map(([k, n]) => {
          const I = Ic[k];
          return (
            <button key={k} type="button" className={tab === k ? 'aan' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => naar(k)}>
              <I />{n}{k === 'meldingen' && aantalOpen > 0 && <span className="tel">{aantalOpen > 99 ? '99+' : aantalOpen}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
