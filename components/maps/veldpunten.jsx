'use client';

// Veldpunten: een opmerking op een plek (niet op een item), bv. tijdens een terreinbezoek met de deellink op een tablet:
// "camera 3 hier". Komt in maps.opmerkingen (plan_id + punt) en is achteraf zichtbaar in de editor om in te tekenen.
import { useEffect, useState } from 'react';

export const VP_TEKST = {
  nl: { mijnPunten: 'Je punten (tik om aan te passen)', zoek: 'Locatie zoeken…', nauw: 'Nauwkeurigheid', bij: 'Tik op de kaart om bij te stellen.', aanpas: 'Tekst aanpassen', verplaats: 'Verplaatsen', verplaatsUitleg: 'Tik op de nieuwe plek, of gebruik je locatie.', weg: 'Weghalen', wegVraag: 'Dit punt weghalen?', nietEigen: 'Enkel de organisator kan dit punt nog aanpassen.', knop: 'Punt zetten', uitleg: 'Tik op de kaart waar het moet komen, of gebruik je locatie.', mijn: 'Waar ik sta', wat: 'Wat komt hier?', voorbeeld: 'bv. camera 3, kabel naar hier', naam: 'Je naam', bewaar: 'Bewaren', annuleer: 'Annuleren', klaar: 'Bewaard. Het staat nu op het plan voor de organisator.', fout: 'Bewaren lukte niet. Probeer opnieuw.', geenGps: 'Je locatie is niet beschikbaar.', stop: 'Klaar' },
  fr: { mijnPunten: 'Vos points (touchez pour modifier)', zoek: 'Recherche de la position…', nauw: 'Précision', bij: 'Touchez la carte pour ajuster.', aanpas: 'Modifier le texte', verplaats: 'Déplacer', verplaatsUitleg: 'Touchez le nouvel endroit, ou utilisez votre position.', weg: 'Supprimer', wegVraag: 'Supprimer ce point ?', nietEigen: "Seul l'organisateur peut encore modifier ce point.", knop: 'Placer un point', uitleg: "Touchez la carte à l'endroit voulu, ou utilisez votre position.", mijn: 'Ma position', wat: "Qu'est-ce qui vient ici ?", voorbeeld: 'p.ex. caméra 3, câble jusqu’ici', naam: 'Votre nom', bewaar: 'Enregistrer', annuleer: 'Annuler', klaar: "Enregistré. L'organisateur le voit sur le plan.", fout: "L'enregistrement a échoué. Réessayez.", geenGps: "Votre position n'est pas disponible.", stop: 'Terminé' },
  en: { mijnPunten: 'Your points (tap to edit)', zoek: 'Finding location…', nauw: 'Accuracy', bij: 'Tap the map to adjust.', aanpas: 'Edit text', verplaats: 'Move', verplaatsUitleg: 'Tap the new spot, or use your location.', weg: 'Delete', wegVraag: 'Delete this point?', nietEigen: 'Only the organiser can still change this point.', knop: 'Drop a point', uitleg: 'Tap the map where it should go, or use your location.', mijn: 'Where I am', wat: 'What goes here?', voorbeeld: 'e.g. camera 3, cable to here', naam: 'Your name', bewaar: 'Save', annuleer: 'Cancel', klaar: 'Saved. The organiser now sees it on the plan.', fout: 'Saving failed. Please try again.', geenGps: 'Your location is not available.', stop: 'Done' },
};

const NAAM_SLEUTEL = 'fm-deel-naam';
// GPS zo nauwkeurig mogelijk: een tablet geeft eerst een ruwe plek (wifi/gsm-mast, tientallen meters) en pas na
// enkele seconden de echte GPS-fix. Tot 20 s luisteren, de beste houden, stoppen zodra het op ± 6 m zit.
export function preciezePlek(opBeter, opKlaar, opFout) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) { opFout?.(); return () => {}; }
  let best = null; let klaar = false;
  const stop = (id) => { if (klaar) return; klaar = true; navigator.geolocation.clearWatch(id); clearTimeout(tm); if (best) opKlaar?.(best); else opFout?.(); };
  const id = navigator.geolocation.watchPosition((p) => {
    const b = { punt: [p.coords.longitude, p.coords.latitude], acc: Math.round(p.coords.accuracy || 999) };
    if (!best || b.acc <= best.acc) { best = b; opBeter?.(b); }
    if (b.acc <= 6) stop(id);
  }, () => { if (!best) stop(id); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  const tm = setTimeout(() => stop(id), 20000);
  return () => stop(id);
}
const leesNaam = () => { try { return localStorage.getItem(NAAM_SLEUTEL) || ''; } catch { return ''; } };
const zetNaam = (n) => { try { localStorage.setItem(NAAM_SLEUTEL, n); } catch { /* */ } };

// Kaartlagen voor veldpunten (oranje speld met tekst). Werkt in de deellink en in de editor.
export function zorgVoorVeldpuntLagen(map) {
  if (!map || map.getSource('fm-veldpunt')) return;
  map.addSource('fm-veldpunt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'fm-veldpunt', type: 'circle', source: 'fm-veldpunt', paint: { 'circle-radius': ['case', ['get', 'concept'], 9, 7], 'circle-color': ['case', ['==', ['get', 'status'], 'open'], '#EA580C', '#9CA3AF'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 } });
  map.addLayer({ id: 'fm-veldpunt-t', type: 'symbol', source: 'fm-veldpunt', layout: { 'text-field': ['get', 't'], 'text-size': 12, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false }, paint: { 'text-color': '#7C2D12', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } });
}
export function zetVeldpunten(map, lijst, concept = null) {
  const bron = map?.getSource('fm-veldpunt'); if (!bron) return;
  const f = (lijst || []).filter((o) => Array.isArray(o.punt)).map((o) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: o.punt }, properties: { id: o.id || '', t: String(o.tekst || '').slice(0, 40), status: o.status || 'open', concept: false } }));
  if (concept) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: concept }, properties: { id: '', t: '', status: 'open', concept: true } });
  bron.setData({ type: 'FeatureCollection', features: f });
}

// Paneel in de deellink om een punt te zetten. plek = [lng, lat] (getikt of GPS) of null.
export function VeldpuntPaneel({ taal = 'nl', plek, setPlek, onBewaar, onSluit, eigen = [], onKies = null }) {
  const t = VP_TEKST[taal] || VP_TEKST.nl;
  const [tekst, setTekst] = useState(''); const [naam, setNaamS] = useState(leesNaam); const [status, setStatus] = useState('');
  useEffect(() => { if (plek) setStatus(''); }, [plek]);
  const gps = () => {
    setStatus(t.zoek);
    preciezePlek((b) => { setPlek(b.punt); setTimeout(() => setStatus(`${t.zoek} ± ${b.acc} m`), 0); }, (b) => setTimeout(() => setStatus(`${t.nauw} ± ${b.acc} m. ${t.bij}`), 0), () => setStatus(t.geenGps));
  };
  const bewaar = async () => {
    if (!plek || !tekst.trim()) return;
    zetNaam(naam.trim()); setStatus('…');
    const ok = await onBewaar({ punt: plek, tekst: tekst.trim(), naam: naam.trim() });
    if (ok) { setTekst(''); setStatus(t.klaar); setPlek(null); } else setStatus(t.fout);
  };
  return (
    <div className="fm fm-vp-paneel" role="dialog" aria-label={t.knop}>
      <div className="fm-vp-kop"><strong>{t.knop}</strong><button type="button" className="fm-knop klein" onClick={onSluit}>{t.stop}</button></div>
      <div className="fm-sub">{t.uitleg}</div>
      <button type="button" className="fm-knop klein" onClick={gps}>◎ {t.mijn}</button>
      {plek && <>
        <label className="fm-veld">{t.wat}<textarea rows={2} value={tekst} placeholder={t.voorbeeld} maxLength={2000} onChange={(e) => setTekst(e.target.value)} autoFocus /></label>
        <label className="fm-veld">{t.naam}<input value={naam} maxLength={80} onChange={(e) => setNaamS(e.target.value)} /></label>
        <div className="fm-vp-knoppen"><button type="button" className="fm-knop" onClick={() => setPlek(null)}>{t.annuleer}</button><button type="button" className="fm-knop zwart" disabled={!tekst.trim()} onClick={bewaar}>{t.bewaar}</button></div>
      </>}
      {status && <div className="fm-sub" style={{ color: status === t.klaar ? '#166534' : undefined }}>{status}</div>}
      {!plek && eigen.length > 0 && onKies && (
        <div className="fm-vp-eigen">
          <div className="fm-sub">{t.mijnPunten}</div>
          {eigen.slice(-8).reverse().map((o) => <button key={o.id} type="button" onClick={() => onKies(o)}>📍 {o.tekst}</button>)}
        </div>
      )}
    </div>
  );
}

// Een eigen veldpunt (van deze link) aanpassen: tekst, plek (verplaatsen: tik op de kaart of GPS) of weghalen.
export function VeldpuntBewerk({ o, taal = 'nl', verplaatsen, setVerplaatsen, onWijzig, onSluit }) {
  const t = VP_TEKST[taal] || VP_TEKST.nl;
  const [bewerk, setBewerk] = useState(false); const [tekst, setTekst] = useState(o.tekst || ''); const [status, setStatus] = useState('');
  useEffect(() => { setTekst(o.tekst || ''); setBewerk(false); setStatus(''); }, [o.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const wijzig = async (patch) => { setStatus('…'); const ok = await onWijzig(o, patch); setStatus(ok ? '' : t.fout); return ok; };
  const gps = () => {
    setStatus(t.zoek);
    preciezePlek((b) => setStatus(`${t.zoek} ± ${b.acc} m`), async (b) => { setVerplaatsen(false); if (await wijzig({ punt: b.punt })) setStatus(`${t.nauw} ± ${b.acc} m`); }, () => setStatus(t.geenGps));
  };
  const datum = new Date(o.op).toLocaleString(taal === 'fr' ? 'fr-BE' : taal === 'en' ? 'en-GB' : 'nl-BE', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <div className="fm fm-vp-paneel" role="dialog">
      <div className="fm-vp-kop"><strong>📍 {o.tekst}</strong><button type="button" className="fm-x" aria-label="Sluiten" onClick={onSluit}>×</button></div>
      <div className="fm-sub">{o.auteur} · {datum}{o.status !== 'open' ? ' · ✓' : ''}</div>
      {o.eigen && o.status === 'open' ? <>
        {bewerk
          ? <><textarea rows={2} value={tekst} maxLength={2000} onChange={(e) => setTekst(e.target.value)} autoFocus />
            <div className="fm-vp-knoppen"><button type="button" className="fm-knop" onClick={() => { setBewerk(false); setTekst(o.tekst || ''); }}>{t.annuleer}</button><button type="button" className="fm-knop zwart" disabled={!tekst.trim()} onClick={async () => { if (await wijzig({ tekst: tekst.trim() })) setBewerk(false); }}>{t.bewaar}</button></div></>
          : verplaatsen
            ? <><div className="fm-sub" style={{ color: '#C2410C' }}>{t.verplaatsUitleg}</div>
              <div className="fm-vp-knoppen"><button type="button" className="fm-knop" onClick={() => setVerplaatsen(false)}>{t.annuleer}</button><button type="button" className="fm-knop" onClick={gps}>◎ {t.mijn}</button></div></>
            : <div className="fm-vp-knoppen" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <button type="button" className="fm-knop klein" onClick={() => setBewerk(true)}>{t.aanpas}</button>
              <button type="button" className="fm-knop klein" onClick={() => setVerplaatsen(true)}>{t.verplaats}</button>
              <button type="button" className="fm-knop klein rood" onClick={() => { if (window.confirm(t.wegVraag)) wijzig({ weg: true }); }}>{t.weg}</button>
            </div>}
      </> : o.status === 'open' ? <div className="fm-sub">{t.nietEigen}</div> : null}
      {status && <div className="fm-sub">{status}</div>}
    </div>
  );
}
