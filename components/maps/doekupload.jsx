'use client';

// Een doekontwerp opladen vanuit een bouwer (stelling, truss, frame-wand), zonder eerst naar de bibliotheek te gaan.
// Keuze: enkel voor dit event (map "Dit event" in de bibliotheek, plan_id) of voor alle events (FLCS-bibliotheek, enkel beheerders).
// Na het opladen krijgt de editor het nieuwe ontwerp via het venster-event 'fm-ontwerp-nieuw', zodat alle lijsten het meteen kennen.
import { useEffect, useState } from 'react';
import { maps, sb, BUCKET, foutTekst, wieBenIk } from './db';
import { dragerOp, voorbeeldVan } from './branding';
import { GridlabKnop } from './gridlabdoek';
import { heeftModule } from './merk';

const pad = (map, ext) => `ontwerpen/${map}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
export const NIEUW_ONTWERP = 'fm-ontwerp-nieuw';

// Ontwerpen opladen hoort bij de module Branding.
export function DoekUpload(props) { return heeftModule('branding') ? <DoekUploadKnop {...props} /> : null; }
function DoekUploadKnop({ planId, drager = 'hek', onNieuw, klein = false }) {
  const [nieuw, setNieuw] = useState(null); const [bezig, setBezig] = useState(''); const [fout, setFout] = useState('');
  const [admin, setAdmin] = useState(false);
  useEffect(() => { let weg = false; wieBenIk().then((p) => { if (!weg) setAdmin(p?.role === 'admin'); }).catch(() => {}); return () => { weg = true; }; }, []);
  const dr = dragerOp(drager);
  const kies = async (f) => {
    if (!f) return; setFout(''); setBezig('Voorbeeld maken…');
    try { const v = await voorbeeldVan(f); setNieuw((n) => ({ waar: 'event', ...(n || {}), naam: n?.naam || f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), afmeting: n?.afmeting || dr.afmeting, bestand: f, voorbeeld: v, kleur: v.kleur, url: URL.createObjectURL(v.blob) })); } catch (e) { setFout(e?.message || 'Dit bestand kan niet gelezen worden.'); }
    setBezig('');
  };
  const bewaar = async () => {
    if (!nieuw?.naam?.trim()) { setFout('Geef het doek een naam.'); return; }
    setFout(''); setBezig('Opladen…');
    try {
      const alle = nieuw.waar === 'alle' && admin; const map = alle ? 'flcs' : planId;
      const ext = (nieuw.bestand.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const origineel = pad(map, ext); const beeld = pad(map, 'jpg');
      const a = await sb().storage.from(BUCKET).upload(origineel, nieuw.bestand, { contentType: nieuw.bestand.type || undefined }); if (a.error) throw a.error;
      const b = await sb().storage.from(BUCKET).upload(beeld, nieuw.voorbeeld.blob, { contentType: 'image/jpeg' }); if (b.error) throw b.error;
      const rij = { naam: nieuw.naam.trim(), categorie: 'Doeken en drukwerk', tekenwijze: 'doek', stijl: {}, actief: true, plan_id: alle ? null : planId,
        eigenschappen: { kleur: nieuw.kleur, afmeting: nieuw.afmeting || dr.afmeting, beeld, bestand: origineel, bestandsnaam: nieuw.bestand.name, ...(drager !== 'hek' ? { drager } : {}) } };
      const { data, error } = await maps().from('bibliotheek').insert(rij).select().single(); if (error) throw error;
      window.dispatchEvent(new CustomEvent(NIEUW_ONTWERP, { detail: data }));
      if (nieuw.url) URL.revokeObjectURL(nieuw.url); setNieuw(null); onNieuw?.(data);
    } catch (e) { setFout(foutTekst(e)); }
    setBezig('');
  };
  const invoer = (lbl) => (
    <label className={`fm-knop${klein ? ' klein' : ''} fm-doekup-knop`}>{bezig || lbl}
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setNieuw((n) => n || {}); kies(f); } }} />
    </label>
  );
  if (!planId) return null;
  return (
    <div className="fm-doekup">
      {!nieuw && <div className="fm-doekup-rij">{invoer('+ Doek opladen (jpg, png, pdf)')}<GridlabKnop planId={planId} drager={drager} klein={klein} onNieuw={onNieuw} /></div>}
      {nieuw && (
        <div className="fm-upload-vorm">
          <div className="beeld" style={{ background: nieuw.kleur || '#F4F4F5' }}>{nieuw.url ? <img src={nieuw.url} alt="Voorbeeld" /> : <span className="fm-sub">{bezig || 'Bestand kiezen…'}</span>}</div>
          <label className="fm-veld">Naam<input value={nieuw.naam || ''} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} placeholder="bv. Sponsor X · brug" /></label>
          <label className="fm-veld">Afmeting<input value={nieuw.afmeting || ''} onChange={(e) => setNieuw({ ...nieuw, afmeting: e.target.value })} placeholder={dr.afmeting} /></label>
          <div className="fm-segment">
            <button type="button" className={nieuw.waar !== 'alle' ? 'aan' : ''} onClick={() => setNieuw({ ...nieuw, waar: 'event' })} title="In de bibliotheek in de map Dit event">Enkel dit event</button>
            <button type="button" className={nieuw.waar === 'alle' ? 'aan' : ''} disabled={!admin} onClick={() => setNieuw({ ...nieuw, waar: 'alle' })} title={admin ? 'In de organisatiebibliotheek, voor alle events' : 'Enkel beheerders zetten iets in de organisatiebibliotheek'}>Alle events</button>
          </div>
          <div className="fm-vinkrij" style={{ gap: 6 }}>
            <button type="button" className="fm-knop rood" disabled={!!bezig || !nieuw.bestand} onClick={bewaar}>{bezig || 'Toevoegen'}</button>
            {invoer('Ander bestand')}
            <button type="button" className="fm-knop" onClick={() => { if (nieuw.url) URL.revokeObjectURL(nieuw.url); setNieuw(null); setFout(''); }}>Annuleren</button>
          </div>
        </div>
      )}
      {fout && <div className="fm-melding fout">{fout}</div>}
    </div>
  );
}
