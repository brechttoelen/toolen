'use client';

// Overzicht van de feedback (beta). Beheerders zien alles en zetten de status; anderen zien hun eigen feedback.
// Per melding: wie, wanneer, soort, tekst, waar het over gaat (scherm, werkruimte, item, aangewezen knop) en een
// knop die het plan opent op die plek met dat item geselecteerd.
import { useEffect, useMemo, useState } from 'react';
import { maps, publiekeUrl, foutTekst, wieBenIk } from './db';
import { SOORTEN } from './Feedback';
import './maps.css';

const STATUS = [['nieuw', 'Nieuw'], ['bekeken', 'Bekeken'], ['gepland', 'Gepland'], ['opgelost', 'Opgelost'], ['niet', 'Niet doen']];
const SOORT_NAAM = Object.fromEntries(SOORTEN.map(([k, n]) => [k, n]));
const tijd = (t) => new Date(t).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function waarTekst(c = {}) {
  return [c.scherm, c.werkruimte && c.werkruimte !== 'Plan' ? c.werkruimte : null, c.gereedschap && c.gereedschap !== 'Selecteren' ? `gereedschap ${c.gereedschap}` : null,
    c.plaatsen ? `plaatsen: ${c.plaatsen}` : null, c.item ? `${c.item.familie ? `${c.item.familie} · ` : ''}${c.item.naam || c.item.element || c.item.soort}` : null, c.tab ? `tab ${c.tab}` : null].filter(Boolean).join(' › ');
}
function gaNaar(f) {
  const c = f.context || {};
  if (!f.plan_id) return c.url || null;
  const q = new URLSearchParams();
  if (f.item_id) q.set('item', f.item_id);
  if (c.centrum) q.set('c', c.centrum.join(','));
  if (c.zoom) q.set('z', String(c.zoom));
  return `/maps/${f.plan_id}${q.toString() ? `?${q}` : ''}`;
}

export default function FeedbackLijst() {
  const [rijen, setRijen] = useState(null);
  const [fout, setFout] = useState('');
  const [ik, setIk] = useState(null);
  const [filter, setFilter] = useState({ status: 'open', soort: '', zoek: '' });
  const [plannen, setPlannen] = useState({});
  const [groot, setGroot] = useState(null);
  const beheer = ik?.role === 'admin';

  const laad = async () => {
    const [w, r] = await Promise.all([wieBenIk(), maps().from('feedback').select('*').order('created_at', { ascending: false }).limit(500)]);
    setIk(w);
    if (r.error) { setFout(foutTekst(r.error)); setRijen([]); return; }
    setRijen(r.data || []);
    const ids = [...new Set((r.data || []).map((x) => x.plan_id).filter(Boolean))];
    if (ids.length) { const { data } = await maps().from('plannen').select('id, naam').in('id', ids); setPlannen(Object.fromEntries((data || []).map((p) => [p.id, p.naam]))); }
  };
  useEffect(() => { laad(); }, []);

  const zet = async (f, patch) => {
    const extra = patch.status && ['opgelost', 'niet'].includes(patch.status) ? { afgehandeld_op: new Date().toISOString() } : {};
    setRijen((l) => l.map((x) => (x.id === f.id ? { ...x, ...patch, ...extra } : x)));
    const { error } = await maps().from('feedback').update({ ...patch, ...extra }).eq('id', f.id);
    if (error) setFout(foutTekst(error));
  };

  const lijst = useMemo(() => (rijen || []).filter((f) => {
    if (filter.status === 'open' && ['opgelost', 'niet'].includes(f.status)) return false;
    if (filter.status && filter.status !== 'open' && f.status !== filter.status) return false;
    if (filter.soort && f.soort !== filter.soort) return false;
    if (filter.zoek) { const z = filter.zoek.toLowerCase(); if (!`${f.tekst} ${f.auteur_naam || ''} ${waarTekst(f.context)} ${f.context?.aangewezen?.pad || ''} ${f.context?.aangewezen?.label || ''} ${plannen[f.plan_id] || ''}`.toLowerCase().includes(z)) return false; }
    return true;
  }), [rijen, filter, plannen]);
  // Per scherm/functie geteld: waar komt de meeste feedback vandaan?
  const perPlek = useMemo(() => {
    const m = new Map();
    for (const f of lijst) { const k = f.context?.aangewezen?.pad || f.context?.item?.familie || f.context?.scherm || 'Onbekend'; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [lijst]);

  return (
    <div className="fm fm-fblijst">
      <div className="fm-fblijst-kop">
        <h1>Feedback <span className="fm-sub">beta</span></h1>
        <span className="fm-sub">{beheer ? 'Alle feedback van testers.' : 'Je eigen feedback.'} Geef feedback met de knop Feedback in elk scherm.</span>
      </div>
      <div className="fm-fblijst-filter">
        <div className="fm-segment">{[['open', 'Open'], ['', 'Alles'], ...STATUS].map(([k, n]) => <button key={k || 'alles'} type="button" className={filter.status === k ? 'aan' : ''} onClick={() => setFilter((x) => ({ ...x, status: k }))}>{n}</button>)}</div>
        <div className="fm-segment">{[['', 'Alle soorten'], ...SOORTEN.map(([k, n]) => [k, n])].map(([k, n]) => <button key={k || 'alle'} type="button" className={filter.soort === k ? 'aan' : ''} onClick={() => setFilter((x) => ({ ...x, soort: k }))}>{n}</button>)}</div>
        <input type="search" placeholder="Zoeken in tekst, scherm, functie, plan" value={filter.zoek} onChange={(e) => setFilter((x) => ({ ...x, zoek: e.target.value }))} aria-label="Zoeken" />
      </div>
      {fout && <div className="fm-melding fout">{fout}</div>}
      {perPlek.length > 1 && <div className="fm-fblijst-plekken">{perPlek.map(([k, n]) => <button key={k} type="button" className="fm-chip" onClick={() => setFilter((x) => ({ ...x, zoek: k }))} title="Filter hierop">{k} · {n}</button>)}</div>}
      {rijen === null ? <div className="fm-sub">Laden…</div> : !lijst.length ? <div className="fm-sub" style={{ padding: 20 }}>Geen feedback{filter.status === 'open' ? ' die nog open staat' : ''}.</div> : (
        <div className="fm-fbrijen">
          {lijst.map((f) => {
            const c = f.context || {}; const link = gaNaar(f);
            return (
              <article key={f.id} className={`fm-fbrij s-${f.status}`}>
                <div className="kop">
                  <span className={`fm-tag ${f.soort === 'probleem' ? 'oranje' : f.soort === 'idee' ? 'groen' : ''}`}>{SOORT_NAAM[f.soort] || f.soort}</span>
                  <b>{f.auteur_naam || 'Onbekend'}</b><span className="fm-sub">{tijd(f.created_at)}{c.bron === 'deellink' ? ' · via deellink' : ''}{c.versie ? ` · versie ${c.versie}` : ''}</span>
                  <span className="rechts">
                    {beheer ? (
                      <select value={f.status} onChange={(e) => zet(f, { status: e.target.value })} aria-label="Status">{STATUS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                    ) : <span className="fm-tag">{STATUS.find(([k]) => k === f.status)?.[1]}</span>}
                  </span>
                </div>
                <p className="tekst">{f.tekst}</p>
                <div className="waar">
                  {f.plan_id && <span><span className="fm-sub">Plan</span> {plannen[f.plan_id] || c.plan?.naam || 'plan'}</span>}
                  {waarTekst(c) && <span><span className="fm-sub">Scherm</span> {waarTekst(c)}</span>}
                  {c.aangewezen && <span><span className="fm-sub">Aangewezen</span> {c.aangewezen.pad ? `${c.aangewezen.pad} › ` : ''}<b>{c.aangewezen.label}</b></span>}
                  {c.scherm && c.scherm !== 'Plan bewerken' && c.url && !f.plan_id && <span className="fm-sub">{c.url}</span>}
                </div>
                <div className="voet">
                  {f.schermafdruk && <button type="button" className="fm-fbbeeld" onClick={() => setGroot(publiekeUrl(f.schermafdruk))} title="Schermafdruk vergroten"><img src={publiekeUrl(f.schermafdruk)} alt="Schermafdruk van de kaart" loading="lazy" /></button>}
                  {link && <a className="fm-knop klein" href={link} target="_blank" rel="noreferrer">Ga naar {f.item_id ? 'het item' : 'de plek'}</a>}
                  {beheer && (
                    <input className="antwoord" defaultValue={f.antwoord || ''} placeholder="Antwoord of notitie (de tester ziet dit)" onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (f.antwoord || null)) zet(f, { antwoord: v }); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                  )}
                  {!beheer && f.antwoord && <span><span className="fm-sub">Antwoord</span> {f.antwoord}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {groot && <div className="fm-dialoog-achter" onClick={() => setGroot(null)}><img src={groot} alt="Schermafdruk" style={{ maxWidth: '100%', maxHeight: '90vh', background: '#fff' }} /></div>}
    </div>
  );
}
