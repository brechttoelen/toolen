'use client';

import { useState } from 'react';
import { PALET_HEX, kleurNaam } from './kleuren';

// Iconen voor punten op de kaart (24×24, wit getekend op een gekleurde cirkel).
// Eenvoudige eigen vormen; geen merklogo's.
export const KAARTICONEN = {
  gebouw: { naam: 'Gebouw / binnenlocatie', pad: 'M4 21V5l8-3 8 3v16h-6v-5h-4v5zm3-14v2h2V7zm4 0v2h2V7zm4 0v2h2V7zM7 11v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2z' },
  ehbo: { naam: 'EHBO', pad: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' },
  info: { naam: 'Info', pad: 'M11 10h3v9h-3zM12.5 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z' },
  wc: { naam: 'Toilet', pad: 'M6 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm12 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM4 9h4v6H7v6H5v-6H4zm12 0h4l2 7h-2v5h-4v-5h-2z' },
  parking: { naam: 'Parking', pad: 'M7 3h6a5 5 0 0 1 0 10h-3v8H7zm3 3v4h3a2 2 0 0 0 0-4z' },
  camera: { naam: 'Camera', pad: 'M3 7h12v10H3zm13 3 5-3v10l-5-3z' },
  micro: { naam: 'Micro / speaker', pad: 'M9 3h6v10a3 3 0 0 1-6 0zM6 11h2a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.9V20h3v2H8v-2h3v-3.1A6 6 0 0 1 6 11z' },
  vlag: { naam: 'Vlag', pad: 'M5 3h2v18H5zm3 1h11l-3 4 3 4H8z' },
  finish: { naam: 'Finish', pad: 'M5 3h2v18H5zm3 1h4v4H8zm4 4h4v4h-4zm4-4h4v4h-4zM8 12h4v4H8z' },
  stroom: { naam: 'Stroom', pad: 'M13 2 5 14h6l-2 8 8-12h-6z' },
  water: { naam: 'Water', pad: 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z' },
  eten: { naam: 'Eten', pad: 'M6 2h2v6h1V2h2v6h1V2h2v7a3 3 0 0 1-3 3v10H9V12a3 3 0 0 1-3-3zm11 0c2 0 3 3 3 7v4h-2v9h-2V2z' },
  drank: { naam: 'Drank', pad: 'M5 3h14l-2 18H7zm2.2 2 .4 4h8.8l.4-4z' },
  tent: { naam: 'Tent', pad: 'M12 3 2 21h20zm0 6 5 10h-3l-2-5-2 5H7z' },
  podium: { naam: 'Podium', pad: 'M2 14h20v3H2zm2 3h2v4H4zm14 0h2v4h-2zM6 8h12v6H6z' },
  politie: { naam: 'Politie', pad: 'M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z' },
  brandweer: { naam: 'Brandweer', pad: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z' },
  afval: { naam: 'Afval', pad: 'M9 2h6v2h5v2H4V4h5zM5 7h14l-1 15H6z' },
  toegang: { naam: 'Toegang', pad: 'M5 2h11v20H5zm8 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4-7h2v16h-2z' },
  verboden: { naam: 'Verboden', pad: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-6.3 5.1A8 8 0 0 0 16.9 18.3zM7.1 5.7l11.2 11.2A8 8 0 0 0 7.1 5.7z' },
  wifi: { naam: 'Netwerk', pad: 'M12 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM6 13a8.5 8.5 0 0 1 12 0l-1.8 1.8a6 6 0 0 0-8.4 0zM2.5 9.5a13.5 13.5 0 0 1 19 0l-1.8 1.8a11 11 0 0 0-15.4 0z' },
  bus: { naam: 'Bus', pad: 'M4 3h16v15h-2v3h-3v-3H9v3H6v-3H4zm2 2v6h12V5zm1 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' },
  fiets: { naam: 'Fiets', pad: 'M5 12a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm14 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM5 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 7h5l3 6-1.7.9L11.8 9 9 15.5 7.2 14.7z' },
  pijl: { naam: 'Pijl', pad: 'M12 2 20 12h-5v10H9V12H4z' },
  ster: { naam: 'Ster', pad: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z' },
};

// FLCS-iconengalerij (FLCS_ICONS.pdf): wit symbool, de cirkel krijgt de kleur van het punt.
// Bestanden: /public/m/iconen/<sleutel>.png (wit op transparant, 96 px).
const F = [["parking","Parking","Parking"],["klim","Klim / helling","Parcours"],["kasseien","Kasseien","Parcours"],["start","Start","Parcours"],["locatie","Locatie","Algemeen"],["finish","Finish","Parcours"],["breedte","Breedte / afstand","Parcours"],["steilte","Max. stijgingspercentage","Parcours"],["bol","Bol (leeg)","Algemeen"],["hq","HQ","Organisatie"],["info","Info","Algemeen"],["ppo","PPO","Organisatie"],["driehoek","Driehoek (laatste km)","Parcours"],["ronde","Ronde","Parcours"],["catering","Catering","Voorzieningen"],["afval","Afval","Voorzieningen"],["ehbo","EHBO","Veiligheid"],["persoon","Persoon","Algemeen"],["media","Media","Pers"],["vip","VIP","Organisatie"],["medisch","Medisch","Veiligheid"],["jury","Jury","Organisatie"],["podium","Podium","Organisatie"],["interview","Interview","Pers"],["vestiaire","Vestiaire","Voorzieningen"],["fiets","Fiets","Mobiliteit"],["foto","Fotografen","Pers"],["tv","TV","Pers"],["rc","Race convoy (RC)","Organisatie"],["parking-m","Parking M","Parking"],["toiletten","Toiletten","Voorzieningen"],["led","LED-scherm","Organisatie"],["gevaar","Gevaar","Veiligheid"],["parking-a","Parking A","Parking"],["facebook","Facebook","Sociale media"],["instagram","Instagram","Sociale media"],["x","X","Sociale media"],["youtube","YouTube","Sociale media"],["linkedin","LinkedIn","Sociale media"],["website","Website","Sociale media"],["presentatie","Presentatie","Organisatie"],["ingang","Ingang","Toegang"],["oversteek","Oversteekplaats","Toegang"],["uitgang","Uitgang","Toegang"],["tiktok","TikTok","Sociale media"],["bus","Bus / shuttle","Mobiliteit"],["mindervaliden","Mindervaliden","Voorzieningen"],["nooduitgang","Nooduitgang","Veiligheid"],["technisch","Technische zone","Organisatie"],["verboden","Verboden toegang","Toegang"],["teams","Teams","Organisatie"],["inschrijving","Inschrijving","Organisatie"],["brandblusser","Brandblusser","Veiligheid"],["douches","Douches","Voorzieningen"],["boog","Boog / portiek","Parcours"],["drempel","Verkeersdrempel","Parcours"],["rijplaten","Balkjes","Parcours"],["ticket","Ticket","Toegang"],["led-2","LED-scherm (2)","Organisatie"],["stijging","Stijging","Parcours"],["daling","Afdaling","Parcours"],["trappen","Trappen","Parcours"],["pijl","Pijl","Algemeen"],["flcs","FLCS-logo","Algemeen"],["timing","Timing","Organisatie"],["accreditatie","Accreditatiekaart","Toegang"],["auto","Auto","Mobiliteit"],["telefoon","Telefoon","Algemeen"],["email","E-mail","Algemeen"],["sleutel","Moersleutel","Organisatie"],["bidon","Bevoorrading (bidon)","Parcours"],["trein","Trein","Mobiliteit"],["niet-roken","Niet roken","Veiligheid"],["logo-swirl","IFF-logo","Algemeen"],["koffie","Koffie","Voorzieningen"],["erkenning","Accreditaties","Toegang"],["medaille","Medaille","Organisatie"],["kledij","Kledij","Voorzieningen"],["speaker","Speaker / micro","Pers"],["neutrale-service","Bottle zone","Parcours"],["wiel","Wielen","Parcours"],["whatsapp","WhatsApp","Sociale media"],["branddeken","Branddeken","Veiligheid"],["verzamelplaats","Verzamelplaats","Veiligheid"],["aed","AED","Veiligheid"],["noodverlichting","Noodverlichting","Veiligheid"],["brandkraan","Brandkraan / hydrant","Veiligheid"],["gasfles","Gasflessen","Veiligheid"],["brandweer","Brand","Veiligheid"],["brandweerwagen","Brandweerwagen","Veiligheid"]];
export const FLCS_ICONEN = F.map(([k, naam, groep]) => ({ id: `f-${k}`, naam, groep, src: `/m/iconen/${k}.png` }));
const FLCS_MAP = new Map(FLCS_ICONEN.map((i) => [i.id, i]));
export const ICOONGROEPEN = [...new Set(FLCS_ICONEN.map((i) => i.groep))];
export const icoonNaam = (k) => FLCS_MAP.get(k)?.naam || KAARTICONEN[k]?.naam || '';

const beeldCache = new Map(); // id -> HTMLImageElement (geladen)
export function laadIcoon(k) {
  const ic = FLCS_MAP.get(k);
  if (!ic || typeof Image === 'undefined') return Promise.resolve(null);
  if (beeldCache.has(k)) return beeldCache.get(k);
  const p = new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = ic.src; });
  beeldCache.set(k, p);
  p.then((im) => { if (im) beeldCache.set(k, Promise.resolve(im)); geladen.set(k, im); });
  return p;
}
const geladen = new Map();
export const laadIconen = (lijst) => Promise.all([...new Set(lijst)].filter((k) => FLCS_MAP.has(k)).map(laadIcoon));

function glyphData(im, px) {
  const c = document.createElement('canvas'); c.width = px; c.height = px;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, px, px);
  return x.getImageData(0, 0, px, px);
}

// Icoon in MapLibre zetten (FLCS-iconen laden asynchroon).
export function zetIcoonInKaart(map, k, px = 48) {
  const id = `ic-${k}`;
  if (map.hasImage(id)) return;
  if (FLCS_MAP.has(k)) {
    laadIcoon(k).then((im) => { if (im && !map.hasImage(id)) { try { map.addImage(id, glyphData(im, px), { sdf: true }); map.triggerRepaint(); } catch {} } });
    return;
  }
  const b = icoonBeeld(k, px);
  if (b) map.addImage(id, b, { sdf: true });
}

// Wit icoon (alfa) als ImageData voor MapLibre (sdf → kleurbaar).
export function icoonBeeld(naam, px = 48) {
  if (FLCS_MAP.has(naam)) { const im = geladen.get(naam); return im && typeof document !== 'undefined' ? glyphData(im, px) : null; }
  const ic = KAARTICONEN[naam];
  if (!ic || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const x = c.getContext('2d');
  x.scale(px / 24, px / 24);
  x.fillStyle = '#ffffff';
  x.fill(new Path2D(ic.pad), 'evenodd');
  return x.getImageData(0, 0, px, px);
}

// PNG (data-URL) met een gekleurde cirkel en wit icoon, voor de PDF.
const pngCache = new Map();
export function icoonPng(naam, kleur = '#1d1d1b', px = 96) {
  const sleutel = `${naam}${kleur}${px}`;
  if (pngCache.has(sleutel)) return pngCache.get(sleutel);
  const ic = KAARTICONEN[naam];
  const fl = geladen.get(naam);
  if ((!ic && !fl) || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const x = c.getContext('2d');
  if (fl) {
    x.fillStyle = kleur; x.beginPath(); x.arc(px / 2, px / 2, px / 2 - 1, 0, Math.PI * 2); x.fill();
    x.drawImage(fl, 0, 0, px, px);
    const u = c.toDataURL('image/png'); pngCache.set(sleutel, u); return u;
  }
  x.fillStyle = kleur; x.beginPath(); x.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#ffffff'; x.lineWidth = px / 24; x.stroke();
  x.save(); x.translate(px * 0.2, px * 0.2); x.scale((px * 0.6) / 24, (px * 0.6) / 24);
  x.fillStyle = '#ffffff'; x.fill(new Path2D(ic.pad), 'evenodd'); x.restore();
  const url = c.toDataURL('image/png');
  pngCache.set(sleutel, url);
  return url;
}

export function IcoonSvg({ naam, maat = 18, kleur = 'currentColor' }) {
  const fl = FLCS_MAP.get(naam);
  if (fl) return <span aria-hidden style={{ display: 'inline-block', width: maat, height: maat, background: kleur, WebkitMaskImage: `url(${fl.src})`, maskImage: `url(${fl.src})`, WebkitMaskSize: 'contain', maskSize: 'contain' }} />;
  const ic = KAARTICONEN[naam];
  if (!ic) return null;
  return <svg width={maat} height={maat} viewBox="0 0 24 24" aria-hidden><path d={ic.pad} fill={kleur} fillRule="evenodd" /></svg>;
}

// Icoon zoals op de kaart: gekleurde cirkel met wit symbool.
export function IcoonBol({ naam, maat = 28, kleur = '#1d1d1b' }) {
  const fl = FLCS_MAP.get(naam);
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: maat, height: maat, borderRadius: '50%', background: kleur, flex: '0 0 auto' }}>
      {fl ? <img src={fl.src} alt="" width={maat} height={maat} style={{ display: 'block' }} /> : <IcoonSvg naam={naam} maat={maat * 0.6} kleur="#fff" />}
    </span>
  );
}

const RECENT = 'fm-iconen-recent';
export function recenteIconen() { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch { return []; } }
export function onthoudIcoon(k) { try { localStorage.setItem(RECENT, JSON.stringify([k, ...recenteIconen().filter((x) => x !== k)].slice(0, 12))); } catch {} }

export const PUNTKLEUREN = PALET_HEX;

// Kiezer: zoeken, recent, per groep, en de kleur van de bol.
export function IcoonKiezer({ waarde, kleur = '#1d1d1b', onKies, onKleur, uitgeschakeld, compact = false }) {
  const [zoek, setZoek] = useState('');
  const [groep, setGroep] = useState('');
  const q = zoek.trim().toLowerCase();
  const recent = recenteIconen().filter((k) => FLCS_MAP.has(k));
  const lijst = FLCS_ICONEN.filter((i) => (!groep || (groep === 'recent' ? recent.includes(i.id) : i.groep === groep)) && (!q || i.naam.toLowerCase().includes(q) || i.groep.toLowerCase().includes(q)));
  const kies = (k) => { if (k) onthoudIcoon(k); onKies(k); };
  return (
    <div className="fm-icoonkiezer">
      {onKleur && (
        <div className="fm-icoonkleuren" role="radiogroup" aria-label="Kleur">
          {PUNTKLEUREN.map((k) => <button key={k} role="radio" aria-checked={kleur === k} aria-label={kleurNaam(k)} title={kleurNaam(k)} disabled={uitgeschakeld} className={kleur?.toLowerCase() === k.toLowerCase() ? 'aan' : ''} style={{ background: k }} onClick={() => onKleur(k)} />)}
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(kleur || '') ? kleur : '#1d1d1b'} disabled={uitgeschakeld} onChange={(e) => onKleur(e.target.value)} aria-label="Eigen kleur" />
        </div>
      )}
      <div className="fm-icoonfilter">
        <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek icoon" aria-label="Zoek icoon" />
        <select value={groep} onChange={(e) => setGroep(e.target.value)} aria-label="Groep">
          <option value="">Alle</option>
          {recent.length > 0 && <option value="recent">Recent</option>}
          {ICOONGROEPEN.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className={`fm-icoonraster${compact ? ' compact' : ''}`}>
        <button className={!waarde ? 'aan' : ''} disabled={uitgeschakeld} onClick={() => kies(null)} title="Geen icoon"><span className="fm-icoon-geen" style={{ background: kleur }} /></button>
        {(!groep && !q ? [...recent.map((k) => FLCS_MAP.get(k)), ...lijst.filter((i) => !recent.includes(i.id))] : lijst).map((i) => (
          <button key={i.id} className={waarde === i.id ? 'aan' : ''} disabled={uitgeschakeld} onClick={() => kies(i.id)} title={i.naam} aria-label={i.naam}>
            <IcoonBol naam={i.id} maat={compact ? 24 : 28} kleur={kleur} />
          </button>
        ))}
      </div>
    </div>
  );
}
