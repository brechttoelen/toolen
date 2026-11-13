'use client';

// Knop "Uit GridLab": een sponsor-backdrop uit GridLab kiezen en als doek gebruiken (alle soorten doeken).
// Toont alle ontwerpen die je in GridLab mag zien, ook die in bewerking, met status en versie.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { heeftKoppeling } from './merk';
import { gridlabOntwerpen, tekenGridlab, gridlabAlsDoek, gridlabAllesOvernemen, statusVan, afmetingVan } from './gridlab';
import { foutTekst, wieBenIk } from './db';
import { dragerOp } from './branding';

export function GridlabKnop({ planId, drager = 'hek', onNieuw, klein = false }) {
  const [open, setOpen] = useState(false);
  if (!planId || !heeftKoppeling('gridlab')) return null;
  return (
    <>
      <button type="button" className={`fm-knop${klein ? ' klein' : ''} fm-gl-knop`} title="Een backdrop uit GridLab als doek gebruiken (ook ontwerpen in bewerking)" onClick={() => setOpen(true)}>Uit GridLab</button>
      {open && <GridlabKiezer planId={planId} drager={drager} onSluit={() => setOpen(false)} onNieuw={(d) => { setOpen(false); onNieuw?.(d); }} />}
    </>
  );
}

function GridlabKiezer({ planId, drager, onSluit, onNieuw }) {
  const [lijst, setLijst] = useState(undefined); const [fout, setFout] = useState('');
  const [zoek, setZoek] = useState(''); const [event, setEvent] = useState('');
  const [keuze, setKeuze] = useState(null); const [canvasId, setCanvasId] = useState(null);
  const [voorbeeld, setVoorbeeld] = useState(null); const [bezig, setBezig] = useState('');
  const [waar, setWaar] = useState('event'); const [admin, setAdmin] = useState(false);
  useEffect(() => { let weg = false; gridlabOntwerpen().then((l) => { if (!weg) setLijst(l); }).catch((e) => { if (!weg) { setLijst([]); setFout(foutTekst(e)); } }); wieBenIk().then((p) => { if (!weg) setAdmin(p?.role === 'admin'); }).catch(() => {}); return () => { weg = true; }; }, []);
  useEffect(() => { const t = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onSluit(); } }; window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true); }, [onSluit]);
  const events = useMemo(() => [...new Set((lijst || []).map((o) => o.event).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl')), [lijst]);
  const zichtbaar = (lijst || []).filter((o) => (!event || o.event === event) && (!zoek || `${o.name} ${o.event || ''} ${o.format_code || ''} ${o.folder || ''}`.toLowerCase().includes(zoek.toLowerCase())));
  // Voorbeeld tekenen met de exportcode van GridLab.
  useEffect(() => {
    if (!keuze) { setVoorbeeld(null); return undefined; }
    let weg = false; let url = null; setBezig('Voorbeeld tekenen…'); setFout('');
    tekenGridlab(keuze, canvasId).then((r) => { if (weg) return; url = URL.createObjectURL(r.blob); setVoorbeeld({ url, afmeting: r.afmeting }); setBezig(''); }).catch((e) => { if (!weg) { setFout(e?.message || 'Tekenen mislukt.'); setBezig(''); } });
    return () => { weg = true; if (url) URL.revokeObjectURL(url); };
  }, [keuze, canvasId]);
  const toevoegen = async () => {
    setBezig('Toevoegen…'); setFout('');
    try { const d = await gridlabAlsDoek({ ontwerp: keuze, canvasId, planId, alle: waar === 'alle' && admin, drager }); onNieuw(d); } catch (e) { setFout(foutTekst(e)); setBezig(''); }
  };
  const alles = async () => {
    setFout('');
    try {
      const r = await gridlabAllesOvernemen((n, tot, naam) => setBezig(tot ? `Overnemen ${n} van ${tot}${naam ? ` · ${naam}` : ''}` : ''));
      setBezig(''); setFout(r.fouten.length ? `${r.nieuw} doeken toegevoegd, ${r.fouten.length} mislukt: ${r.fouten.slice(0, 3).join(' · ')}` : `${r.nieuw} doeken toegevoegd aan de organisatiebibliotheek.`);
      window.dispatchEvent(new CustomEvent('fm-ontwerp-nieuw', { detail: null }));
    } catch (e) { setBezig(''); setFout(foutTekst(e)); }
  };
  const cs = keuze?.canvases || [];
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fm fm-appdialoog-achter" onMouseDown={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <div className="fm-appdialoog fm-gl" role="dialog" aria-modal="true" aria-label="Uit GridLab">
        <div className="fm-gl-kop"><span className="titel">Uit GridLab</span><span className="fm-sub">Voor {dragerOp(drager).naam.toLowerCase()} · {dragerOp(drager).afmeting}</span><span style={{ flex: 1 }} />{admin && lijst?.length > 0 && <button type="button" className="fm-knop klein" disabled={!!bezig} title="Elk ontwerp (elk canvas) als doek in de organisatiebibliotheek; wat er al staat, wordt overgeslagen" onClick={alles}>{bezig.startsWith('Overnemen') ? bezig : 'Alles overnemen'}</button>}<button type="button" className="fm-sluit" aria-label="Sluiten" onClick={onSluit}>×</button></div>
        {lijst === undefined && <div className="fm-sub">Ontwerpen laden…</div>}
        {lijst === null && <div className="fm-melding">De koppeling met GridLab staat niet aan voor deze organisatie.</div>}
        {lijst && (
          <div className="fm-gl-lijf">
            <div className="fm-gl-lijst">
              <div className="fm-gl-filter">
                <input type="search" placeholder="Zoek op naam of formaat" value={zoek} onChange={(e) => setZoek(e.target.value)} />
                <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Event"><option value="">Alle events</option>{events.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              </div>
              <div className="fm-gl-rijen">
                {zichtbaar.map((o) => (
                  <button key={o.id} type="button" className={keuze?.id === o.id ? 'aan' : ''} onClick={() => { setKeuze(o); setCanvasId(o.canvases?.[0]?.id || null); }}>
                    <strong>{o.name}</strong>
                    <span className="fm-sub">{[o.event, o.season, afmetingVan(o.canvases?.[0]?.format), (o.canvases || []).length > 1 ? `${o.canvases.length} canvassen` : null].filter(Boolean).join(' · ')}</span>
                    <span className={`fm-gl-status${o.approval_locked ? ' goed' : ''}`}>{statusVan(o)} · v{o.version ?? 1}</span>
                  </button>
                ))}
                {!zichtbaar.length && <div className="fm-sub">Geen ontwerpen gevonden.</div>}
              </div>
            </div>
            <div className="fm-gl-voorbeeld">
              {!keuze && <div className="fm-sub">Kies links een ontwerp.</div>}
              {keuze && <>
                {cs.length > 1 && <div className="fm-segment">{cs.map((c) => <button key={c.id} type="button" className={canvasId === c.id ? 'aan' : ''} onClick={() => setCanvasId(c.id)}>{c.label || 'Canvas'}</button>)}</div>}
                <div className="fm-gl-beeld">{voorbeeld ? <img src={voorbeeld.url} alt={keuze.name} /> : <span className="fm-sub">{bezig || ''}</span>}</div>
                <div className="fm-sub">{statusVan(keuze)} · versie {keuze.version ?? 1}{voorbeeld?.afmeting ? ` · ${voorbeeld.afmeting}` : ''}. Het doek volgt GridLab: wijzig je het ontwerp daar, dan wordt het hier vanzelf bijgewerkt.</div>
                <div className="fm-segment">
                  <button type="button" className={waar !== 'alle' ? 'aan' : ''} onClick={() => setWaar('event')} title="In de bibliotheek in de map Dit event">Enkel dit event</button>
                  <button type="button" className={waar === 'alle' ? 'aan' : ''} disabled={!admin} onClick={() => setWaar('alle')} title={admin ? 'In de organisatiebibliotheek, voor alle events' : 'Enkel beheerders zetten iets in de organisatiebibliotheek'}>Alle events</button>
                </div>
                <div className="knoppen"><button type="button" className="fm-knop" onClick={onSluit}>Annuleren</button><button type="button" className="fm-knop rood" disabled={!voorbeeld || !!bezig} onClick={toevoegen}>{bezig === 'Toevoegen…' ? bezig : 'Als doek gebruiken'}</button></div>
              </>}
            </div>
          </div>
        )}
        {fout && <div className="fm-melding fout">{fout}</div>}
      </div>
    </div>,
    document.body,
  );
}
