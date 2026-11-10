'use client';

// Werkruimte Branding, paneel links: ontwerpen per soort drager (Heras, totem, vlag, truss),
// event-eigen ontwerpen uploaden, penseel kiezen, en wat nog leeg is.
import { useId, useMemo, useState } from 'react';
import { maps, sb, BUCKET, publiekeUrl, foutTekst } from './db';
import { GridlabKnop } from './gridlabdoek';
import { DRAGERS, dragerOp, ontwerpDrager, brandingTelling, plekNaam, voorbeeldVan } from './branding';
import Info from './info';

const pad = (map, ext) => `ontwerpen/${map}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

export default function BrandingPaneel({ plan, items, doeken, elementenMap, schrijven, beheerder, penseel, onPenseel, onOntwerp, onKiesItem, onTool }) {
  const [soort, setSoort] = useState(penseel?.drager || 'hek');
  const [zoek, setZoek] = useState('');
  const [nieuw, setNieuw] = useState(null); // { naam, afmeting, bestand, voorbeeld, kleur }
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const telling = useMemo(() => brandingTelling(items, elementenMap), [items, elementenMap]);
  const dr = dragerOp(soort);
  const lijst = doeken.filter((d) => ontwerpDrager(d) === soort && (!zoek || d.naam.toLowerCase().includes(zoek.toLowerCase())));
  const eigen = lijst.filter((d) => d.plan_id);
  const vast = lijst.filter((d) => !d.plan_id);
  const aantal = (id) => telling.perOntwerp.get(id) || 0;

  const kies = (d) => {
    const id = d ? d.id : null;
    if (penseel && penseel.id === id && penseel.drager === soort) onPenseel(null);
    else onPenseel({ id, drager: soort });
  };

  const bestandGekozen = async (f) => {
    if (!f) return;
    setFout(''); setBezig('Voorbeeld maken…');
    try {
      const v = await voorbeeldVan(f);
      setNieuw((n) => ({ ...(n || {}), naam: n?.naam || f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), afmeting: n?.afmeting || dr.afmeting, bestand: f, voorbeeld: v, kleur: v.kleur, url: URL.createObjectURL(v.blob) }));
    } catch (e) { setFout(e?.message || 'Dit bestand kan niet gelezen worden.'); }
    setBezig('');
  };

  const bewaarNieuw = async () => {
    if (!nieuw?.naam?.trim()) { setFout('Geef het ontwerp een naam.'); return; }
    if (!nieuw.bestand) { setFout('Kies een jpg, png of pdf.'); return; }
    setFout(''); setBezig('Uploaden…');
    try {
      const ext = (nieuw.bestand.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const origineel = pad(plan.id, ext);
      const beeld = pad(plan.id, 'jpg');
      const a = await sb().storage.from(BUCKET).upload(origineel, nieuw.bestand, { contentType: nieuw.bestand.type || undefined });
      if (a.error) throw a.error;
      const b = await sb().storage.from(BUCKET).upload(beeld, nieuw.voorbeeld.blob, { contentType: 'image/jpeg' });
      if (b.error) throw b.error;
      const rij = {
        naam: nieuw.naam.trim(), categorie: soort === 'vlag' ? 'Vlaggen' : 'Doeken en drukwerk', tekenwijze: 'doek', stijl: {}, actief: true, plan_id: plan.id,
        eigenschappen: { kleur: nieuw.kleur, afmeting: nieuw.afmeting || dr.afmeting, beeld, bestand: origineel, bestandsnaam: nieuw.bestand.name, ...(soort !== 'hek' ? { drager: soort } : {}) },
      };
      const { data, error } = await maps().from('bibliotheek').insert(rij).select().single();
      if (error) throw error;
      onOntwerp(data, 'nieuw');
      if (nieuw.url) URL.revokeObjectURL(nieuw.url);
      setNieuw(null);
      onPenseel({ id: data.id, drager: soort });
    } catch (e) { setFout(foutTekst(e)); }
    setBezig('');
  };

  const naarBibliotheek = async (d) => {
    const { data, error } = await maps().from('bibliotheek').update({ plan_id: null }).eq('id', d.id).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    onOntwerp(data, 'wijzig');
  };

  const kaart = (d) => {
    const aan = penseel && penseel.id === d.id;
    const n = aantal(d.id);
    return (
      <div key={d.id} className={`fm-ontwerp ${aan ? 'aan' : ''}`}>
        <button className="fm-ontwerp-knop" onClick={() => kies(d)} disabled={!schrijven} title={schrijven ? (aan ? 'Penseel uitzetten' : 'Met dit ontwerp hekken, zijden of vlaggen aanklikken') : d.naam}>
          {soort === 'vlag' ? (
            <span className="beeld vlag"><Beachvlag src={d.eigenschappen?.beeld ? publiekeUrl(d.eigenschappen.beeld) : null} kleur={d.eigenschappen?.kleur} hoogte={64} /></span>
          ) : (
            <span className={`beeld${soort === 'frame' || soort === 'totem' ? ' staand' : ''}`} style={{ background: d.eigenschappen?.kleur || dr.kleur }}>
              {d.eigenschappen?.beeld && <img src={publiekeUrl(d.eigenschappen.beeld)} alt="" loading="lazy" />}
            </span>
          )}
          <span className="tekst">
            <b>{d.naam}</b>
            <small>{[d.eigenschappen?.afmeting, n ? `${n}× op plan` : 'niet gebruikt'].filter(Boolean).join(' · ')}</small>
            {aan && <em>Penseel actief</em>}
          </span>
        </button>
        {(d.eigenschappen?.bestand || (d.plan_id && beheerder)) && (
          <span className="fm-ontwerp-extra">
            {d.eigenschappen?.bestand && <a href={publiekeUrl(d.eigenschappen.bestand)} target="_blank" rel="noreferrer">Drukbestand</a>}
            {d.plan_id && beheerder && <button className="fm-link" onClick={() => naarBibliotheek(d)} title="Ook beschikbaar maken voor andere events">Naar de organisatiebibliotheek</button>}
          </span>
        )}
      </div>
    );
  };

  const leeg = telling.leeg.filter((x) => x.drager === soort);
  return (
    <div className="fm-branding">
      <div className="fm-sectie">
        <div className="fm-kop">Ontwerpen<Info>Kies een ontwerp: het penseel staat aan. Klik of sleep op de kaart over hekken, totemzijden of vlaggen. Op hekken kies je in de gele balk Een stuk (eerste en laatste hek) of Losse hekken. Weghalen doe je met de Gom. Esc of Klaar zet het penseel uit.</Info></div>
        <div className="fm-segment" role="tablist">
          {DRAGERS.map((d) => (
            <button key={d.id} title={d.naam} role="tab" aria-selected={soort === d.id} className={soort === d.id ? 'aan' : ''} onClick={() => { setSoort(d.id); setNieuw(null); if (penseel && penseel.drager !== d.id) onPenseel(null); }}>
              <span className="lbl">{d.kort || d.naam.split(/[- ]/)[0]}</span><small>{doeken.filter((x) => ontwerpDrager(x) === d.id).length}</small>
            </button>
          ))}
        </div>
        <input className="fm-ontwerpzoek" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek ontwerp of sponsor…" aria-label="Zoek ontwerp" />
        {soort === 'vlag' && <div className="fm-sub">Klik met het penseel op een Heras-hek: de vlag komt aan de staander van dat hek. Een losse vlag op kruisvoet plaats je met Beachvlag.</div>}
        {fout && <div className="fm-melding fout">{fout}</div>}

        <div className="fm-ctxkop">Alleen dit event</div>
        {schrijven && !nieuw && (
          <label className="fm-upload">
            {bezig || `+ ${dr.enkel === 'vlag' ? 'Vlagontwerp' : dr.enkel === 'paneel' ? 'Paneel' : 'Doek'} uploaden (jpg, png, pdf)`}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; setNieuw({}); bestandGekozen(f); }} />
          </label>
        )}
        {schrijven && !nieuw && <GridlabKnop planId={plan.id} drager={soort} onNieuw={(d) => onPenseel({ id: d.id, drager: soort })} />}
        {nieuw && (
          <div className="fm-upload-vorm">
            <div className="beeld" style={{ background: soort === 'vlag' ? '#F4F4F5' : nieuw.kleur || '#F4F4F5' }}>{nieuw.url ? (soort === 'vlag' ? <Beachvlag src={nieuw.url} kleur={nieuw.kleur} hoogte={110} /> : <img src={nieuw.url} alt="Voorbeeld" />) : <span className="fm-sub">{bezig || 'Bestand kiezen…'}</span>}</div>
            <label className="fm-veld">Naam<input value={nieuw.naam || ''} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} placeholder="bv. Sponsor X · Koppenberg" /></label>
            <label className="fm-veld">Afmeting<input value={nieuw.afmeting || ''} onChange={(e) => setNieuw({ ...nieuw, afmeting: e.target.value })} placeholder={dr.afmeting} /></label>
            <label className="fm-veld">Kleur op de kaart<input type="color" value={nieuw.kleur || dr.kleur} onChange={(e) => setNieuw({ ...nieuw, kleur: e.target.value })} /></label>
            <div className="fm-vinkrij" style={{ gap: 6 }}>
              <button className="fm-knop rood" disabled={!!bezig || !nieuw.bestand} onClick={bewaarNieuw}>{bezig || 'Toevoegen'}</button>
              <label className="fm-knop">Ander bestand<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; bestandGekozen(f); }} /></label>
              <button className="fm-knop" onClick={() => { if (nieuw.url) URL.revokeObjectURL(nieuw.url); setNieuw(null); setFout(''); }}>Annuleren</button>
            </div>
          </div>
        )}
        {eigen.map(kaart)}
        {!eigen.length && !nieuw && <div className="fm-sub">Nog geen eigen ontwerpen voor dit event.</div>}

        <div className="fm-ctxkop">Organisatiebibliotheek</div>
        {vast.map(kaart)}
        {!vast.length && <div className="fm-sub">{zoek ? 'Niets gevonden.' : 'Nog niets in de bibliotheek.'}</div>}

        {schrijven && (
          <button className={`fm-knop ${penseel && penseel.id === null ? 'zwart' : ''}`} onClick={() => kies(null)}>
            {penseel && penseel.id === null ? 'Gom actief: klik om te stoppen' : `Gom: ${dr.enkel === 'vlag' ? 'ontwerp weghalen' : `geen ${dr.enkel}`}`}
          </button>
        )}
      </div>

      <div className="fm-sectie">
        <div className="fm-kop">Nog leeg</div>
        {!leeg.length && <div className="fm-sub">{telling[soort].items ? 'Alles heeft een ontwerp.' : `Nog geen ${dr.naam.toLowerCase()} op het plan.`}</div>}
        {leeg.map(({ it, el, leeg: n, totaal }) => (
          <button key={it.id} className="fm-lijstknop" onClick={() => onKiesItem(it.id)}>
            <b>{it.naam || el.naam}</b>
            <small>{soort === 'hek' ? `${n} van ${totaal} hekken` : soort === 'drape' ? `${n} van ${totaal} secties` : soort === 'totem' || soort === 'frame' ? plekkenLeeg(it) : soort === 'truss' ? `${n} van ${totaal} ${totaal === 2 ? 'kanten' : 'zijden'} leeg` : 'geen ontwerp'}</small>
          </button>
        ))}
        {schrijven && !telling[soort].items && soort !== 'vlag' && (
          <button className="fm-knop" onClick={() => onTool(soort === 'hek' ? 'heras' : soort === 'totem' ? 'totem' : soort === 'truss' ? 'truss' : soort === 'frame' ? 'frame' : soort === 'drape' ? 'drape' : 'beachvlag')}>{soort === 'hek' ? 'Hekkenlijn tekenen' : soort === 'totem' ? 'Totem plaatsen' : soort === 'truss' ? 'Truss plaatsen' : soort === 'frame' ? 'Frame plaatsen' : soort === 'drape' ? 'Pipe & drape tekenen' : 'Beachvlag plaatsen'}</button>
        )}
      </div>
    </div>
  );
}

function plekkenLeeg(it) {
  const z = [1, 2, 3, 4].filter((k) => !it.velden?.[`paneel_${k}`]);
  return z.length === 4 ? 'alle zijden' : z.map((k) => plekNaam('totem', k - 1)).join(', ');
}

// Voorbeeld van een vlagontwerp in de vorm van onze beachvlaggen (feather): de mast zit in de
// koker aan de linkerkant en volgt de bolle bovenkant; onder de vlag loopt hij door tot de kruisvoet.
export function Beachvlag({ src, kleur = '#94A3B8', hoogte = 70 }) {
  const id = `fm-vlag-${useId().replace(/:/g, '')}`;
  const doek = 'M1.6 22 C1.6 10 12 3 28.6 1.2 L28.6 98 L1.6 98 Z';
  return (
    <svg width={hoogte * 0.27} height={hoogte} viewBox="0 0 30 120" aria-hidden="true" style={{ flex: 'none', overflow: 'visible' }}>
      <defs><clipPath id={id}><path d={doek} /></clipPath></defs>
      <path d={doek} fill={kleur} />
      {src && <image href={src} x="1.6" y="1.2" width="27" height="96.8" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />}
      <path d={doek} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="0.5" />
      {/* koker met de mast erin: linkerrand en bolle bovenkant */}
      <path d="M2.6 98 L2.6 22 C2.6 11 12.5 4.2 27 2.4" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1.6" />
      <rect x="1.7" y="97" width="1.8" height="19" rx="0.9" fill="#2B2D31" />
      <path d="M-4 119 L2.6 114 L9.2 119 M-0.8 117.5 L2.6 114 L6 117.5" fill="none" stroke="#2B2D31" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
