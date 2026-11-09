'use client';

// Keuringsattesten per item (eetkraam, tent, generator…): een geüpload bestand of
// een link naar een externe plek, met keuringsdatum en geldig tot. Ze staan in
// items.velden.attesten, zodat ook een deel-link (brandweer) ze kan tonen.
import Info from './info';
import { bevestig } from './dialoog';
import { useState } from 'react';
import { sb, BUCKET, publiekeUrl, foutTekst } from './db';
import { sorteerCategorieen } from './categorieen';

export const ATTEST_TYPES = ['Elektrische keuring', 'Gasinstallatie', 'Brandblusser', 'Tent of constructie', 'Attractie', 'Brandveiligheid (doeken, materialen)', 'Verzekering', 'Andere'];

const dag = 86400000;
export function attestStatus(a, nu = Date.now()) {
  if (!a.geldig_tot) return { code: 'onbekend', tekst: 'geen vervaldatum', kleur: '#686D76' };
  const t = new Date(a.geldig_tot).getTime();
  if (t < nu) return { code: 'vervallen', tekst: `vervallen sinds ${new Date(a.geldig_tot).toLocaleDateString('nl-BE')}`, kleur: '#B91C1C' };
  if (t - nu < 30 * dag) return { code: 'bijna', tekst: `geldig tot ${new Date(a.geldig_tot).toLocaleDateString('nl-BE')} (bijna vervallen)`, kleur: '#B45309' };
  return { code: 'geldig', tekst: `geldig tot ${new Date(a.geldig_tot).toLocaleDateString('nl-BE')}`, kleur: '#0E6B48' };
}
export const attestUrl = (a) => (a.url ? a.url : a.pad ? publiekeUrl(a.pad) : null);

// Alleen lezen: in de pop-up en op de deel-link.
export function AttestenLijst({ attesten, klein = false }) {
  if (!attesten?.length) return null;
  return (
    <div className="fm-attesten">
      {attesten.map((a) => {
        const st = attestStatus(a); const u = attestUrl(a);
        return (
          <a key={a.id} className="fm-attest" href={u || undefined} target="_blank" rel="noreferrer" style={{ borderLeftColor: st.kleur }}>
            <strong>{a.type}{a.naam ? ` · ${a.naam}` : ''}</strong>
            <span style={{ color: st.kleur }}>{st.tekst}{a.datum ? ` · gekeurd ${new Date(a.datum).toLocaleDateString('nl-BE')}` : ''}</span>
            {!klein && u && <span className="open">Openen ↗</span>}
          </a>
        );
      })}
    </div>
  );
}

// Bewerken in het eigenschappenpaneel.
export function AttestenBewerken({ item, planId, ro, onZet }) {
  const lijst = item.velden?.attesten || [];
  const [nieuw, setNieuw] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const bewaar = (l) => onZet(l.length ? l : null);
  const start = () => {
    const vandaag = new Date().toISOString().slice(0, 10);
    const jaar = new Date(Date.now() + 365 * dag).toISOString().slice(0, 10);
    setNieuw({ id: Math.random().toString(36).slice(2, 10), type: ATTEST_TYPES[0], naam: '', datum: vandaag, geldig_tot: jaar, url: '', bestand: null });
  };
  const toevoegen = async () => {
    setFout('');
    if (!nieuw.bestand && !nieuw.url.trim()) { setFout('Kies een bestand of plak een link.'); return; }
    setBezig(true);
    try {
      let pad = null;
      if (nieuw.bestand) {
        const ext = (nieuw.bestand.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
        pad = `${planId}/attest/${item.id}-${Date.now()}.${ext}`;
        const { error } = await sb().storage.from(BUCKET).upload(pad, nieuw.bestand, { contentType: nieuw.bestand.type || 'application/pdf' });
        if (error) throw error;
      }
      const a = { id: nieuw.id, type: nieuw.type, naam: nieuw.naam || (nieuw.bestand?.name ?? ''), datum: nieuw.datum || null, geldig_tot: nieuw.geldig_tot || null, ...(pad ? { pad } : { url: nieuw.url.trim() }), toegevoegd: new Date().toISOString() };
      bewaar([...lijst, a]);
      setNieuw(null);
    } catch (e) { setFout(foutTekst(e)); }
    setBezig(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lijst.map((a) => {
        const st = attestStatus(a); const u = attestUrl(a);
        return (
          <div key={a.id} className="fm-attest" style={{ borderLeftColor: st.kleur }}>
            <strong>{a.type}{a.naam ? ` · ${a.naam}` : ''}</strong>
            <span style={{ color: st.kleur }}>{st.tekst}</span>
            {!ro && (
              <div className="fm-vinkrij" style={{ alignItems: 'center' }}>
                <label className="fm-vink" style={{ gap: 4 }}>Geldig tot<input type="date" value={a.geldig_tot || ''} onChange={(e) => bewaar(lijst.map((x) => (x.id === a.id ? { ...x, geldig_tot: e.target.value || null } : x)))} style={{ height: 24 }} /></label>
              </div>
            )}
            <div className="fm-vinkrij">
              {u && <a className="fm-knop klein" href={u} target="_blank" rel="noreferrer">Openen</a>}
              {!ro && <button className="fm-knop klein gevaar" onClick={async () => { if (await bevestig('Dit attest weghalen?', { ok: 'Weghalen', gevaar: true })) bewaar(lijst.filter((x) => x.id !== a.id)); }}>Weghalen</button>}
            </div>
          </div>
        );
      })}
      {!lijst.length && !nieuw && <div className="fm-sub">Nog geen attest.</div>}
      {!ro && !nieuw && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={start}>Attest toevoegen</button>}
      {nieuw && (
        <div className="fm-aansluiting">
          <label className="fm-veld">Soort<select value={nieuw.type} onChange={(e) => setNieuw({ ...nieuw, type: e.target.value })}>{ATTEST_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="fm-veld">Omschrijving (optioneel)<input value={nieuw.naam} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} placeholder="bv. Vincotte, nr. 2026-1234" /></label>
          <div className="fm-raster2">
            <label className="fm-veld">Gekeurd op<input type="date" value={nieuw.datum} onChange={(e) => setNieuw({ ...nieuw, datum: e.target.value })} /></label>
            <label className="fm-veld">Geldig tot<input type="date" value={nieuw.geldig_tot} onChange={(e) => setNieuw({ ...nieuw, geldig_tot: e.target.value })} /></label>
          </div>
          <label className="fm-knop klein" style={{ alignSelf: 'flex-start' }}>{nieuw.bestand ? nieuw.bestand.name : 'Bestand kiezen (PDF, foto)'}
            <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => setNieuw({ ...nieuw, bestand: e.target.files?.[0] || null, url: '' })} />
          </label>
          {!nieuw.bestand && <label className="fm-veld">Of link (OneDrive, Dropbox, website)<input value={nieuw.url} onChange={(e) => setNieuw({ ...nieuw, url: e.target.value })} placeholder="https://…" /></label>}
          {fout && <div className="fm-melding fout">{fout}</div>}
          <div className="fm-vinkrij">
            <button className="fm-knop klein zwart" disabled={bezig} onClick={toevoegen}>{bezig ? 'Uploaden…' : 'Toevoegen'}</button>
            <button className="fm-knop klein" onClick={() => setNieuw(null)}>Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Overzicht voor het hele plan (tab in Lijsten) + verplichte categorieën.
// Overzicht in het paneel Controle (blok Keuringsattesten).
export function AttestenOverzicht({ plan, items, elementenMap, lagenMap, schrijven, onPlan, onKiesItem }) {
  const inst = plan.instellingen?.attesten || {};
  const verplicht = inst.verplicht || [];
  const cats = sorteerCategorieen(new Set([...elementenMap.values()].map((e) => e.categorie).filter(Boolean)));
  const rijen = items.filter((i) => !i.verborgen && i.soort !== 'tekst').map((i) => {
    const el = i.element_id ? elementenMap.get(i.element_id) : null;
    const lijst = i.velden?.attesten || [];
    const nodig = !!el && verplicht.includes(el.categorie);
    const slechtste = lijst.map((a) => attestStatus(a)).sort((a, b) => ['vervallen', 'bijna', 'onbekend', 'geldig'].indexOf(a.code) - ['vervallen', 'bijna', 'onbekend', 'geldig'].indexOf(b.code))[0];
    return { i, el, lijst, nodig, status: lijst.length ? slechtste : nodig ? { code: 'ontbreekt', tekst: 'ontbreekt', kleur: '#B91C1C' } : null };
  }).filter((r) => r.lijst.length || r.nodig);
  const tel = (c) => rijen.filter((r) => r.status?.code === c).length;
  const exporteer = () => {
    const regels = [['Item', 'Element', 'Laag', 'Soort attest', 'Omschrijving', 'Gekeurd op', 'Geldig tot', 'Status', 'Link'].join(';')];
    for (const r of rijen) {
      const naam = r.i.naam || r.el?.naam || r.i.soort;
      if (!r.lijst.length) regels.push([naam, r.el?.naam || '', lagenMap.get(r.i.laag_id)?.naam || '', '', '', '', '', 'ontbreekt', ''].join(';'));
      for (const a of r.lijst) regels.push([naam, r.el?.naam || '', lagenMap.get(r.i.laag_id)?.naam || '', a.type, a.naam || '', a.datum || '', a.geldig_tot || '', attestStatus(a).code, attestUrl(a) || ''].join(';'));
    }
    const blob = new Blob([`﻿${regels.join('\n')}`], { type: 'text/csv' });
    const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `${plan.naam} - attesten.csv`; l.click(); URL.revokeObjectURL(u);
  };
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <div className="fm-kpi"><small>In orde</small><strong style={{ color: '#0E6B48' }}>{tel('geldig')}</strong></div>
        <div className="fm-kpi"><small>Bijna vervallen</small><strong style={{ color: '#B45309' }}>{tel('bijna')}</strong></div>
        <div className="fm-kpi"><small>Vervallen of ontbreekt</small><strong style={{ color: '#B91C1C' }}>{tel('vervallen') + tel('ontbreekt')}</strong></div>
      </div>
      {!rijen.length && <div className="fm-sub">Nog geen attesten. Selecteer een item en voeg rechts bij Keuringsattesten een bestand of link toe.</div>}
      {rijen.map((r) => (
        <button key={r.i.id} className="fm-attestrij" onClick={() => onKiesItem(r.i.id)} style={{ borderLeftColor: r.status?.kleur || '#DADDE3' }}>
          <strong>{r.i.naam || r.el?.naam || r.i.soort}</strong>
          <span>{r.lijst.length ? r.lijst.map((a) => a.type).join(', ') : 'geen attest'} · <span style={{ color: r.status?.kleur }}>{r.status?.tekst}</span></span>
        </button>
      ))}
      {rijen.length > 0 && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={exporteer}>Als CSV (Excel)</button>}
      <details className="fm-meer" open={verplicht.length > 0}>
        <summary>Verplicht voor · {verplicht.length} categorieën<Info>Categorieën waarvoor elk item een attest moet hebben. Ontbrekende komen bij de meldingen.</Info></summary>
        {cats.map((c) => (
          <label key={c} className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={verplicht.includes(c)}
            onChange={() => onPlan({ instellingen: { ...(plan.instellingen || {}), attesten: { ...inst, verplicht: verplicht.includes(c) ? verplicht.filter((x) => x !== c) : [...verplicht, c] } } })} />{c}</label>
        ))}
      </details>
    </>
  );
}
