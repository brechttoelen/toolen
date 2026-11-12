'use client';

// Meer: op het beginscherm zetten (een knop, nooit een pop-up), opbouwmodus, account en de volledige versie.
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { centraalAdres } from '@/lib/adres';
import { MetToolen } from '../Huisstijl';
import { Ic } from './iconen';
import { initialen } from './MobielApp';

// Android/Chrome geeft een installatievraag die we bewaren tot iemand op de knop tikt.
let bewaardeVraag = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); bewaardeVraag = e; });
}

const isIos = () => typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const alGeinstalleerd = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

export default function Meer({ huisstijl, profiel, planId, onDelen }) {
  const [uitleg, setUitleg] = useState(false);
  const [toestel, setToestel] = useState('iphone');
  const [geinstalleerd, setGeinstalleerd] = useState(true);
  const [melding, setMelding] = useState('');

  useEffect(() => {
    setGeinstalleerd(alGeinstalleerd());
    setToestel(isIos() ? 'iphone' : 'android');
    const klaar = () => setGeinstalleerd(true);
    window.addEventListener('appinstalled', klaar);
    return () => window.removeEventListener('appinstalled', klaar);
  }, []);

  const installeer = async () => {
    if (bewaardeVraag) {
      bewaardeVraag.prompt();
      const k = await bewaardeVraag.userChoice.catch(() => null);
      bewaardeVraag = null;
      if (k?.outcome === 'accepted') setGeinstalleerd(true);
      return;
    }
    setUitleg(true);
  };
  const naarComputer = async () => {
    const url = `${location.origin}/maps${planId ? `/${planId}` : ''}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Toolen Maps', text: 'Open op een computer', url }); return; }
      await navigator.clipboard.writeText(url); setMelding('Link gekopieerd. Plak hem in een mail aan jezelf.');
    } catch { /* geannuleerd */ }
  };
  const volledig = () => { try { sessionStorage.setItem('fm-volledig', '1'); } catch { /* */ } location.href = '/maps'; };
  const afmelden = async () => { await supabaseBrowser().auth.signOut(); location.href = centraalAdres('/login'); };
  const beheerder = profiel?.role === 'admin';

  if (uitleg) {
    return (
      <>
        <header className="mb-kop terug"><button type="button" className="mb-terug" aria-label="Terug" onClick={() => setUitleg(false)}><Ic.terug /></button><h1>Op je beginscherm</h1></header>
        <main className="mb-inhoud">
          <div className="mb-pad" style={{ paddingTop: 24 }}>
            <div className="mb-segment" role="group" aria-label="Toestel">
              <button type="button" className={toestel === 'iphone' ? 'aan' : ''} onClick={() => setToestel('iphone')}>iPhone</button>
              <button type="button" className={toestel === 'android' ? 'aan' : ''} onClick={() => setToestel('android')}>Android</button>
            </div>
            {toestel === 'iphone' ? (
              <ol className="mb-stappen">
                <li><span>Open deze pagina in Safari.</span></li>
                <li><span>Tik onderaan op Deel (het vierkant met de pijl omhoog).</span></li>
                <li><span>Kies Zet op beginscherm en tik op Voeg toe.</span></li>
                <li><span>Open Toolen voortaan via het icoon.</span></li>
              </ol>
            ) : (
              <ol className="mb-stappen">
                <li><span>Open deze pagina in Chrome.</span></li>
                <li><span>Tik rechtsboven op de drie puntjes.</span></li>
                <li><span>Kies App installeren of Toevoegen aan startscherm.</span></li>
                <li><span>Open Toolen voortaan via het icoon.</span></li>
              </ol>
            )}
            <button type="button" className="mb-knop vol" onClick={() => setUitleg(false)}>Klaar</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="mb-kop"><h1>Meer</h1></header>
      <main className="mb-inhoud">
        <div className="mb-pad">
          {melding && <div className="mb-melding ok" role="status">{melding}</div>}
          <div className="mb-lijst">
            {!geinstalleerd && (
              <button type="button" className="mb-rij licht" onClick={installeer}>
                <span className="mb-blok blauw"><Ic.thuis /></span>
                <span><b>Zet Toolen op je beginscherm</b><small>Opent als app, ook zonder bereik</small></span>
                <span className="mb-pijl">›</span>
              </button>
            )}
            {planId && (
              <a className="mb-rij" href={`/maps/${planId}/opbouw`}>
                <span className="mb-blok"><Ic.opbouw /></span>
                <span><b>Opbouwmodus</b><small>Afvinken per item en zone offline bewaren</small></span>
                <span className="mb-pijl">›</span>
              </a>
            )}
            {planId && (profiel?.role === 'admin' || profiel?.role === 'editor') && (
              <button type="button" className="mb-rij" onClick={onDelen}>
                <span className="mb-blok"><Ic.deel /></span>
                <span><b>Deellinks</b><small>Van het laatst geopende plan</small></span>
                <span className="mb-pijl">›</span>
              </button>
            )}
            <button type="button" className="mb-rij" onClick={naarComputer}>
              <span className="mb-blok"><Ic.scherm /></span>
              <span><b>Open op een computer</b><small>Stuur de link naar jezelf</small></span>
              <span className="mb-pijl">›</span>
            </button>
            {beheerder && (
              <a className="mb-rij" href="/instellingen">
                <span className="mb-blok"><Ic.wie /></span>
                <span><b>Mensen uitnodigen</b><small>In de instellingen</small></span>
                <span className="mb-pijl">›</span>
              </a>
            )}
          </div>
          <div className="mb-lijst">
            <a className="mb-rij" href={centraalAdres('/account')}>
              <span className="mb-blok" style={{ fontSize: 13, fontWeight: 600 }}>{profiel ? initialen(profiel) : <Ic.account />}</span>
              <span><b>{profiel?.display_name || profiel?.email || 'Account'}</b><small>Account en tweestapsverificatie</small></span>
              <span className="mb-pijl">›</span>
            </a>
            <button type="button" className="mb-rij" onClick={volledig}>
              <span className="mb-blok"><Ic.plannen /></span>
              <span><b>Volledige versie</b><small>Tekenen en bouwers, beter op een computer</small></span>
              <span className="mb-pijl">›</span>
            </button>
            <button type="button" className="mb-rij" onClick={afmelden}><span style={{ color: 'var(--t-tekst-2)' }}>Afmelden</span></button>
          </div>
          {huisstijl && <div className="mb-voet"><MetToolen huisstijl={huisstijl} /></div>}
        </div>
      </main>
    </>
  );
}
