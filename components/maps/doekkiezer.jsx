'use client';

// Doeken kiezen en toevoegen, overal op dezelfde manier (Branding, hekken, stelling, truss, frame-wand, tent).
// - DoekTegels: tegels met beeld, zoeken, filter op bereik (dit event, organisatie, Toolen) en op soort.
//   Als strook in het scherm (Branding, hekken, frame-wand, stelling) of in een venster via DoekKnop.
// - NieuwDoekVenster: opladen of uit GridLab, soort en afmeting, en het bereik (dit event of de organisatie).
// Bereik van een doek: bibliotheek.event_id = enkel in de plannen van dat event; leeg = de hele organisatie.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { maps, sb, BUCKET, publiekeUrl, foutTekst, wieBenIk } from './db';
import { DRAGERS, dragerOp, ontwerpDrager, voorbeeldVan } from './branding';
import { heeftModule, heeftKoppeling, getOrganisatie } from './merk';
import { gridlabOntwerpen, tekenGridlab, gridlabAlsDoek, statusVan, afmetingVan } from './gridlab';

export const NIEUW_ONTWERP = 'fm-ontwerp-nieuw';
const pad = (ext) => `ontwerpen/${getOrganisatie()?.slug || 'organisatie'}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

// Het event van een plan (één keer per plan opgehaald).
const _events = new Map();
export function usePlanEvent(planId) {
  const [ev, setEv] = useState(() => (planId ? _events.get(planId) ?? null : null));
  useEffect(() => {
    if (!planId) { setEv(null); return undefined; }
    if (_events.has(planId)) { setEv(_events.get(planId)); return undefined; }
    let weg = false;
    (async () => {
      const { data: p } = await maps().from('plannen').select('event_id').eq('id', planId).maybeSingle();
      let r = null;
      if (p?.event_id) { const { data: e } = await maps().from('events').select('id, naam').eq('id', p.event_id).maybeSingle(); r = e || { id: p.event_id, naam: 'Dit event' }; }
      _events.set(planId, r); if (!weg) setEv(r);
    })().catch(() => {});
    return () => { weg = true; };
  }, [planId]);
  return ev;
}

let _ik = null;
function useIk() {
  const [p, setP] = useState(_ik);
  useEffect(() => { let weg = false; if (!_ik) wieBenIk().then((x) => { _ik = x; if (!weg) setP(x); }).catch(() => {}); return () => { weg = true; }; }, []);
  return p;
}

// Waar hoort een doek: event, organisatie of de centrale bibliotheek van Toolen.
export function bereikVan(d, profiel = _ik, ev = null) {
  if (profiel?.organisatie?.id && d?.organisatie_id && d.organisatie_id !== profiel.organisatie.id) return { k: 'toolen', naam: 'Toolen' };
  if (d?.event_id) return { k: 'event', naam: ev && ev.id === d.event_id ? ev.naam : 'Event' };
  if (d?.plan_id) return { k: 'event', naam: 'Dit plan' };
  return { k: 'org', naam: 'Organisatie' };
}

function Beeld({ d, groot = false }) {
  const src = d?.eigenschappen?.beeld ? publiekeUrl(d.eigenschappen.beeld) : null;
  return (
    <span className={`fm-dk-beeld${groot ? ' groot' : ''}`} style={{ background: d?.eigenschappen?.kleur || dragerOp(ontwerpDrager(d)).kleur }}>
      {src && <img src={src} alt="" loading="lazy" />}
    </span>
  );
}

// Tegels om een doek te kiezen. strook = vast in het scherm (compacter), anders in een venster.
export function DoekTegels({ doeken = [], drager = null, waarde = null, onKies, planId = null, schrijven = true, geenLabel = 'Geen doek', metGeen = true, strook = false, telling = null, onNieuw = null }) {
  const ev = usePlanEvent(planId); const ik = useIk();
  const [zoek, setZoek] = useState(''); const [map, setMap] = useState('alle'); const [alleSoorten, setAlleSoorten] = useState(!drager);
  const [nieuw, setNieuw] = useState(false);
  const metBereik = useMemo(() => doeken.map((d) => ({ d, b: bereikVan(d, ik, ev) })), [doeken, ik, ev]);
  const soortOk = (d) => alleSoorten || !drager || ontwerpDrager(d) === drager;
  const tel = (k) => metBereik.filter((x) => soortOk(x.d) && (k === 'alle' || x.b.k === k)).length;
  const z = zoek.trim().toLowerCase();
  const lijst = metBereik.filter((x) => soortOk(x.d) && (map === 'alle' || x.b.k === map) && (!z || `${x.d.naam} ${x.d.eigenschappen?.afmeting || ''}`.toLowerCase().includes(z)))
    .sort((a, b) => (a.d.id === waarde ? -1 : b.d.id === waarde ? 1 : 0) || ({ event: 0, org: 1, toolen: 2 }[a.b.k] - { event: 0, org: 1, toolen: 2 }[b.b.k]) || a.d.naam.localeCompare(b.d.naam, 'nl', { numeric: true }));
  const mappen = [['alle', 'Alle'], ['event', ev ? ev.naam : 'Dit event'], ['org', 'Organisatie'], ['toolen', 'Toolen']].filter(([k]) => k === 'alle' || tel(k) > 0 || (k === 'event' && ev));
  return (
    <div className={`fm-dk${strook ? ' strook' : ''}`}>
      <div className="fm-dk-balk">
        <input type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een doek" aria-label="Zoek een doek" />
        {schrijven && heeftModule('branding') && <button type="button" className="fm-knop klein zwart" onClick={() => setNieuw(true)}>Nieuw doek</button>}
      </div>
      <div className="fm-dk-filter" role="group" aria-label="Bereik">
        {mappen.map(([k, n]) => <button key={k} type="button" aria-pressed={map === k} className={map === k ? 'aan' : ''} onClick={() => setMap(k)}>{n} · {tel(k)}</button>)}
        {drager && <label className="fm-dk-soorten"><input type="checkbox" checked={alleSoorten} onChange={(e) => setAlleSoorten(e.target.checked)} />Andere soorten</label>}
      </div>
      <div className="fm-dk-tegels">
        {metGeen && <button type="button" className={`fm-dk-tegel geen${!waarde ? ' aan' : ''}`} disabled={!schrijven} onClick={() => onKies?.(null)}><span className="fm-dk-beeld leeg" /><b>{geenLabel}</b></button>}
        {lijst.map(({ d, b }) => {
          const n = telling ? telling(d.id) : null;
          return (
            <button key={d.id} type="button" className={`fm-dk-tegel${waarde === d.id ? ' aan' : ''}`} disabled={!schrijven} title={d.naam} onClick={() => onKies?.(d.id, d)}>
              <Beeld d={d} />
              <b>{d.naam}</b>
              <small>{[b.naam, d.eigenschappen?.afmeting, n != null ? (n ? `${n}× op plan` : 'niet gebruikt') : null].filter(Boolean).join(' · ')}</small>
            </button>
          );
        })}
        {!lijst.length && <div className="fm-sub" style={{ gridColumn: '1 / -1', padding: 8 }}>{z ? 'Niets gevonden.' : drager && !alleSoorten ? `Nog geen ${dragerOp(drager).naam.toLowerCase()}. Voeg er een toe of toon andere soorten.` : 'Nog geen doeken.'}</div>}
      </div>
      {nieuw && <NieuwDoekVenster planId={planId} drager={drager || 'hek'} onSluit={() => setNieuw(false)} onNieuw={(d) => { setNieuw(false); onNieuw?.(d); onKies?.(d.id, d); }} />}
    </div>
  );
}

// Knop met het gekozen doek; een klik opent de tegels in een venster.
export function DoekKnop({ doeken = [], waarde = null, drager = null, onKies, planId = null, schrijven = true, titel = 'Doek kiezen', geenLabel = 'Geen doek' }) {
  const [open, setOpen] = useState(false);
  const d = waarde ? doeken.find((x) => x.id === waarde) : null;
  const ev = usePlanEvent(planId); const ik = useIk();
  useEffect(() => {
    if (!open) return undefined;
    const t = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true);
  }, [open]);
  return (
    <>
      <button type="button" className={`fm-dk-knop${d ? ' gekozen' : ''}`} disabled={!schrijven && !d} aria-haspopup="dialog" onClick={() => schrijven && setOpen(true)}>
        {d ? <Beeld d={d} /> : <span className="fm-dk-beeld leeg" />}
        <span className="tekst"><b>{d ? d.naam : waarde ? 'Onbekend doek' : geenLabel}</b>{d && <small>{[bereikVan(d, ik, ev).naam, d.eigenschappen?.afmeting].filter(Boolean).join(' · ')}</small>}</span>
        {schrijven && <span className="actie">{d ? 'Wijzigen' : 'Kiezen'}</span>}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fm fm-appdialoog-achter" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="fm-appdialoog fm-dk-venster" role="dialog" aria-modal="true" aria-label={titel}>
            <div className="fm-dk-kop"><span className="titel">{titel}</span><span style={{ flex: 1 }} /><button type="button" className="fm-sluit" aria-label="Sluiten" onClick={() => setOpen(false)}>×</button></div>
            <DoekTegels doeken={doeken} drager={drager} waarde={waarde} planId={planId} schrijven={schrijven} geenLabel={geenLabel} onKies={(id, x) => { onKies?.(id, x); setOpen(false); }} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// Knop "Nieuw doek" (in bouwers en panelen): opent het venster; het nieuwe doek gaat naar onNieuw.
export function NieuwDoekKnop({ planId = null, drager = 'hek', onNieuw, klein = false, tekst = 'Nieuw doek' }) {
  const [open, setOpen] = useState(false);
  if (!heeftModule('branding')) return null;
  return (
    <>
      <button type="button" className={`fm-knop${klein ? ' klein' : ''}`} onClick={() => setOpen(true)}>{tekst}</button>
      {open && <NieuwDoekVenster planId={planId} drager={drager} onSluit={() => setOpen(false)} onNieuw={(d) => { setOpen(false); onNieuw?.(d); }} />}
    </>
  );
}

// Het venster Nieuw doek. event = { id, naam } om een event op te leggen (Branding-scherm met een event-map open).
export function NieuwDoekVenster({ planId = null, event: evIn = null, drager: dr0 = 'hek', onNieuw, onSluit }) {
  const evPlan = usePlanEvent(planId); const ev = evIn || evPlan;
  const ik = useIk(); const admin = ik?.role === 'admin';
  const [bron, setBron] = useState('opladen');
  const [drager, setDrager] = useState(dr0);
  const [v, setV] = useState({ naam: '', afmeting: dragerOp(dr0).afmeting });
  const [bereik, setBereik] = useState(null);
  const [bezig, setBezig] = useState(''); const [fout, setFout] = useState('');
  const dr = dragerOp(drager);
  const kanGl = heeftKoppeling('gridlab');
  // Standaard: dit event als het plan er een heeft; anders de organisatie (enkel beheerders).
  const b = bereik || (ev ? 'event' : 'org');
  useEffect(() => {
    const t = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onSluit?.(); } };
    window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true);
  }, [onSluit]);
  useEffect(() => () => { if (v.url) URL.revokeObjectURL(v.url); }, [v.url]);

  const bestand = async (f) => {
    if (!f) return; setFout(''); setBezig('Voorbeeld maken…');
    try { const vb = await voorbeeldVan(f); setV((o) => ({ ...o, naam: o.naam || f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), bestand: f, voorbeeld: vb, kleur: vb.kleur, url: URL.createObjectURL(vb.blob) })); }
    catch (e) { setFout(e?.message || 'Dit bestand kan niet gelezen worden.'); }
    setBezig('');
  };
  // GridLab
  const [gl, setGl] = useState(undefined); const [glZoek, setGlZoek] = useState(''); const [keuze, setKeuze] = useState(null); const [canvasId, setCanvasId] = useState(null); const [glBeeld, setGlBeeld] = useState(null);
  useEffect(() => { if (bron !== 'gridlab' || gl !== undefined) return; gridlabOntwerpen().then(setGl).catch((e) => { setGl([]); setFout(foutTekst(e)); }); }, [bron, gl]);
  useEffect(() => {
    if (!keuze) { setGlBeeld(null); return undefined; }
    let weg = false; let url = null; setBezig('Voorbeeld tekenen…');
    tekenGridlab(keuze, canvasId).then((r) => { if (weg) return; url = URL.createObjectURL(r.blob); setGlBeeld({ url, afmeting: r.afmeting }); setBezig(''); }).catch((e) => { if (!weg) { setFout(e?.message || 'Tekenen mislukt.'); setBezig(''); } });
    return () => { weg = true; if (url) URL.revokeObjectURL(url); };
  }, [keuze, canvasId]);

  const magBewaren = (b === 'event' ? !!ev : admin) && (bron === 'opladen' ? !!v.bestand && !!v.naam.trim() : !!keuze && !!glBeeld) && !bezig;
  const bewaar = async () => {
    setFout(''); setBezig('Toevoegen…');
    try {
      const eventId = b === 'event' ? ev?.id || null : null;
      let data;
      if (bron === 'gridlab') {
        data = await gridlabAlsDoek({ ontwerp: keuze, canvasId, drager, eventId, alle: !eventId, naam: v.naam.trim() || null });
      } else {
        const ext = (v.bestand.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const origineel = pad(ext); const beeld = pad('jpg');
        const a = await sb().storage.from(BUCKET).upload(origineel, v.bestand, { contentType: v.bestand.type || undefined }); if (a.error) throw a.error;
        const c = await sb().storage.from(BUCKET).upload(beeld, v.voorbeeld.blob, { contentType: 'image/jpeg' }); if (c.error) throw c.error;
        const rij = { naam: v.naam.trim(), categorie: drager === 'vlag' ? 'Vlaggen' : 'Doeken en drukwerk', tekenwijze: 'doek', stijl: {}, actief: true, plan_id: null, event_id: eventId,
          eigenschappen: { kleur: v.kleur, afmeting: v.afmeting || dr.afmeting, beeld, bestand: origineel, bestandsnaam: v.bestand.name, ...(drager !== 'hek' ? { drager } : {}) } };
        const r = await maps().from('bibliotheek').insert(rij).select().single(); if (r.error) throw r.error;
        data = r.data;
        window.dispatchEvent(new CustomEvent(NIEUW_ONTWERP, { detail: data }));
      }
      try { new BroadcastChannel('fm-bibliotheek').postMessage({ t: Date.now() }); } catch {}
      setBezig(''); onNieuw?.(data);
    } catch (e) { setFout(foutTekst(e)); setBezig(''); }
  };

  const glLijst = (gl || []).filter((o) => !glZoek || `${o.name} ${o.event || ''}`.toLowerCase().includes(glZoek.toLowerCase()));
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fm fm-appdialoog-achter" onMouseDown={(e) => { if (e.target === e.currentTarget) onSluit?.(); }}>
      <div className="fm-appdialoog fm-dk-nieuw" role="dialog" aria-modal="true" aria-label="Nieuw doek">
        <div className="fm-dk-kop"><span className="titel">Nieuw doek</span><span className="fm-sub">{dr.naam} · {v.afmeting || dr.afmeting}</span><span style={{ flex: 1 }} /><button type="button" className="fm-sluit" aria-label="Sluiten" onClick={onSluit}>×</button></div>
        {kanGl && (
          <div className="fm-segment fm-dk-bron" role="tablist">
            <button type="button" role="tab" aria-selected={bron === 'opladen'} className={bron === 'opladen' ? 'aan' : ''} onClick={() => setBron('opladen')}>Opladen</button>
            <button type="button" role="tab" aria-selected={bron === 'gridlab'} className={bron === 'gridlab' ? 'aan' : ''} onClick={() => setBron('gridlab')}>Uit GridLab</button>
          </div>
        )}
        {bron === 'opladen' ? (
          <div className="fm-dk-vorm">
            <label className="fm-dk-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); bestand(e.dataTransfer.files?.[0]); }}>
              {v.url ? <img src={v.url} alt="Voorbeeld" /> : <><b>{bezig || 'Sleep een bestand'}</b><span>of kies een PDF, JPG of PNG</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; bestand(f); }} />
            </label>
            <div className="fm-dk-velden">
              <label className="fm-veld">Naam<input value={v.naam} onChange={(e) => setV({ ...v, naam: e.target.value })} placeholder="bv. Sponsor X · brug" /></label>
              <div className="fm-dk-twee">
                <label className="fm-veld">Soort<select value={drager} onChange={(e) => { const n = e.target.value; setDrager(n); setV((o) => ({ ...o, afmeting: !o.afmeting || o.afmeting === dragerOp(drager).afmeting ? dragerOp(n).afmeting : o.afmeting })); }}>{DRAGERS.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</select></label>
                <label className="fm-veld">Afmeting<input value={v.afmeting} onChange={(e) => setV({ ...v, afmeting: e.target.value })} placeholder={dr.afmeting} /></label>
              </div>
            </div>
          </div>
        ) : (
          <div className="fm-dk-gl">
            <div className="fm-dk-gl-lijst">
              <input type="search" value={glZoek} onChange={(e) => setGlZoek(e.target.value)} placeholder="Zoek in GridLab" aria-label="Zoek in GridLab" />
              {gl === undefined && <div className="fm-sub">Ontwerpen laden…</div>}
              {gl === null && <div className="fm-melding">De koppeling met GridLab staat niet aan.</div>}
              {glLijst.map((o) => (
                <button key={o.id} type="button" className={keuze?.id === o.id ? 'aan' : ''} onClick={() => { setKeuze(o); setCanvasId(o.canvases?.[0]?.id || null); setV((x) => ({ ...x, naam: o.name })); }}>
                  <b>{o.name}</b><small>{[o.event, afmetingVan(o.canvases?.[0]?.format), `${statusVan(o)} · v${o.version ?? 1}`].filter(Boolean).join(' · ')}</small>
                </button>
              ))}
            </div>
            <div className="fm-dk-gl-beeld">
              {keuze && (keuze.canvases || []).length > 1 && <div className="fm-segment">{keuze.canvases.map((c) => <button key={c.id} type="button" className={canvasId === c.id ? 'aan' : ''} onClick={() => setCanvasId(c.id)}>{c.label || 'Canvas'}</button>)}</div>}
              <div className="fm-dk-drop">{glBeeld ? <img src={glBeeld.url} alt={keuze?.name || ''} /> : <span>{bezig || 'Kies links een ontwerp.'}</span>}</div>
              {keuze && <label className="fm-veld">Soort<select value={drager} onChange={(e) => setDrager(e.target.value)}>{DRAGERS.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</select></label>}
              {keuze && <div className="fm-sub">Het doek volgt GridLab: wijzig je het ontwerp daar, dan wordt het hier vanzelf bijgewerkt.</div>}
            </div>
          </div>
        )}
        <fieldset className="fm-dk-bereik">
          <legend>Waar komt het</legend>
          <label className={b === 'event' ? 'aan' : ''} aria-disabled={!ev}>
            <input type="radio" name="dk-bereik" checked={b === 'event'} disabled={!ev} onChange={() => setBereik('event')} />
            <span><b>{ev ? `Dit event · ${ev.naam}` : 'Dit event'}</b><small>{ev ? 'In alle plannen van dit event' : 'Koppel dit plan aan een event om doeken per event te bewaren.'}</small></span>
          </label>
          <label className={b === 'org' ? 'aan' : ''} aria-disabled={!admin}>
            <input type="radio" name="dk-bereik" checked={b === 'org'} disabled={!admin} onChange={() => setBereik('org')} />
            <span><b>Organisatie</b><small>{admin ? `In alle plannen van ${getOrganisatie()?.naam || 'de organisatie'}` : 'Enkel beheerders zetten iets in de organisatiebibliotheek.'}</small></span>
          </label>
        </fieldset>
        {fout && <div className="fm-melding fout">{fout}</div>}
        <div className="knoppen"><button type="button" className="fm-knop" onClick={onSluit}>Annuleren</button><button type="button" className="fm-knop rood" disabled={!magBewaren} onClick={bewaar}>{bezig === 'Toevoegen…' ? bezig : 'Doek toevoegen'}</button></div>
      </div>
    </div>,
    document.body,
  );
}
