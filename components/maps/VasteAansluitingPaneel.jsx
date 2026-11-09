'use client';

import { useEffect, useState } from 'react';
import Info from './info';
import { bevestig } from './dialoog';
import { sb, BUCKET, publiekeUrl, foutTekst } from './db';
import { SOORTEN, SOORT_NAAM, BEHEERDERS, UITGANG_TYPES, kvaVan, gemeenteBij, bewaarVasteAansluiting, uitgangenTekst } from './vasteAansluitingen';
import { uitgangenBezetting } from './stroom';

const LEEG = { naam: '', soort: 'straatkast', beheerder: 'stad', gemeente: '', adres: '', uitgangen: [], max_ampere: null, kva: null, sleutel: '', contact: '', ean: '', foto: null, opmerking: '', laatst_gecontroleerd: null, actief: true };

// Formulier van één vaste aansluiting (nieuw of bestaand). Bewaart zelf in de tabel.
export default function VasteAansluitingPaneel({ va, knoop = null, schrijven, profielId, onBewaard, onSluit, onZoom = null }) {
  const [v, setV] = useState({ ...LEEG, ...va });
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const [veranderd, setVeranderd] = useState(false);
  useEffect(() => { setV({ ...LEEG, ...va }); setVeranderd(false); setFout(''); }, [va?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Nieuw punt zonder gemeente: opzoeken.
  useEffect(() => {
    if (va?.id || va?.gemeente || !va?.geometrie) return;
    let weg = false;
    gemeenteBij(va.geometrie.coordinates).then((r) => { if (!weg) setV((x) => ({ ...x, gemeente: x.gemeente || r.gemeente || '', adres: x.adres || r.adres || '' })); });
    return () => { weg = true; };
  }, [va?.id, va?.geometrie]); // eslint-disable-line react-hooks/exhaustive-deps
  const zet = (p) => { setV((x) => ({ ...x, ...p })); setVeranderd(true); };
  const getalOf = (s) => (s === '' || s == null ? null : Number(String(s).replace(',', '.')));
  const ro = !schrijven;

  const bewaar = async () => {
    if (!v.naam.trim()) { setFout('Geef een naam (bv. "Kast Markt 1").'); return; }
    setBezig('Bewaren…'); setFout('');
    try {
      const data = await bewaarVasteAansluiting({ ...v, naam: v.naam.trim(), gemeente: v.gemeente || null, adres: v.adres || null, sleutel: v.sleutel || null, contact: v.contact || null, ean: v.ean || null, opmerking: v.opmerking || null, laatst_gecontroleerd: v.laatst_gecontroleerd || null, uitgangen: (v.uitgangen || []).filter((u) => u.type) }, profielId);
      setVeranderd(false);
      onBewaard?.(data);
    } catch (e) { setFout(e.message || String(e)); }
    setBezig('');
  };
  const deactiveer = async () => {
    if (!v.id || !await bevestig(`"${v.naam}" uit het register halen? De aansluiting blijft bewaard, maar wordt niet meer getoond.`, { ok: 'Uit register', gevaar: true })) return;
    setBezig('Bewaren…');
    try { const data = await bewaarVasteAansluiting({ ...v, actief: false }, profielId); onBewaard?.(data, true); } catch (e) { setFout(e.message || String(e)); }
    setBezig('');
  };
  const uploadFoto = async (bestand) => {
    if (!bestand) return;
    setBezig('Foto opladen…');
    try {
      const ext = (bestand.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const pad = `vast/${v.id || 'nieuw'}-${Date.now()}.${ext}`;
      const { error } = await sb().storage.from(BUCKET).upload(pad, bestand, { contentType: bestand.type || 'image/jpeg' });
      if (error) throw error;
      zet({ foto: pad });
    } catch (e) { setFout(foutTekst(e)); }
    setBezig('');
  };
  const zetUitgang = (i, p) => zet({ uitgangen: (v.uitgangen || []).map((u, j) => (j === i ? { ...u, ...p } : u)) });
  const bezetting = knoop ? uitgangenBezetting(v.uitgangen, knoop) : null;
  const kva = kvaVan(v);

  return (
    <div className="fm-paneel-inhoud fm-va-paneel">
      <div className="fm-sectie">
        {knoop && (
          <div className="fm-tellers">
            <div className="fm-kpi"><small>Belasting</small><strong>{knoop.procent != null ? `${Math.round(knoop.procent)} %` : '–'}</strong><small>{knoop.belast ? `${knoop.belast.toFixed(1)} kW` : 'niets aangesloten'}{kva ? ` van ${kva} kVA` : ''}</small></div>
            <div className="fm-kpi"><small>Aangesloten</small><strong>{knoop.kinderen?.length || 0}</strong><small>{knoop.kinderen?.length ? knoop.kinderen.map((k) => k.naam).join(', ').slice(0, 40) : 'kast of verbruiker: kies deze kast als voeding'}</small></div>
          </div>
        )}
        {knoop && (knoop.fase?.L1 || knoop.fase?.L2 || knoop.fase?.L3) ? (
          <div className="fm-fasen">
            {['L1', 'L2', 'L3'].map((f) => { const a = knoop.ampereFase?.[f] || 0; const max = v.max_ampere || 0; return (
              <div key={f} className="fm-fase"><span>{f}</span><div className="balk"><div style={{ width: `${max ? Math.min(100, (a / max) * 100) : 0}%`, background: max && a > max ? '#B91C1C' : '#0E7490' }} /></div><span>{Math.round(a)} A</span></div>
            ); })}
          </div>
        ) : null}
        {bezetting && (
          <div>
            <div className="fm-kop">Uitgangen</div>
            {bezetting.map((u) => <div key={u.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{u.aantal} × {u.type}</span><span style={{ color: u.vrij > 0 ? '#686D76' : '#B91C1C' }}>{u.vrij} vrij</span></div>)}
          </div>
        )}
      </div>
      <div className="fm-sectie">
        <label className="fm-veld">Naam<input value={v.naam} disabled={ro} onChange={(e) => zet({ naam: e.target.value })} placeholder="bv. Kast Markt 1" autoFocus={!v.id} /></label>
        <div className="fm-raster2">
          <label className="fm-veld">Soort
            <select value={v.soort} disabled={ro} onChange={(e) => zet({ soort: e.target.value })}>{SOORTEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          </label>
          <label className="fm-veld">Beheerder
            <select value={BEHEERDERS.some(([k]) => k === v.beheerder) ? v.beheerder : 'prive'} disabled={ro} onChange={(e) => zet({ beheerder: e.target.value })}>{BEHEERDERS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          </label>
        </div>
        <div className="fm-raster2">
          <label className="fm-veld">Gemeente<input value={v.gemeente || ''} disabled={ro} onChange={(e) => zet({ gemeente: e.target.value })} /></label>
          <label className="fm-veld">Adres<input value={v.adres || ''} disabled={ro} onChange={(e) => zet({ adres: e.target.value })} /></label>
        </div>
        <div className="fm-raster2">
          <label className="fm-veld">Hoofdzekering (A)<input inputMode="numeric" value={v.max_ampere ?? ''} disabled={ro} onChange={(e) => zet({ max_ampere: getalOf(e.target.value) })} placeholder="bv. 63" /></label>
          <label className="fm-veld"><span>Vermogen (kVA)<Info>Leeg = afgeleid uit de hoofdzekering (3 fasen, 400 V).</Info></span><input inputMode="numeric" value={v.kva ?? ''} disabled={ro} onChange={(e) => zet({ kva: getalOf(e.target.value) })} placeholder={kva ? `${kva} (afgeleid)` : ''} /></label>
        </div>
        <div className="fm-kop">Uitgangen</div>
        {(v.uitgangen || []).map((u, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input inputMode="numeric" value={u.aantal ?? 1} disabled={ro} onChange={(e) => zetUitgang(i, { aantal: Number(e.target.value) || 1 })} style={{ width: 44, height: 30 }} aria-label="Aantal" />
            <span>×</span>
            <select value={u.type || ''} disabled={ro} onChange={(e) => zetUitgang(i, { type: e.target.value })} style={{ flex: 1, height: 30 }} aria-label="Type">
              <option value="">Kies…</option>{UITGANG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {!ro && <button className="fm-knop klein gevaar" aria-label="Uitgang weg" onClick={() => zet({ uitgangen: v.uitgangen.filter((_, j) => j !== i) })}>×</button>}
          </div>
        ))}
        {!ro && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => zet({ uitgangen: [...(v.uitgangen || []), { type: 'CEE 32A 3F', aantal: 1 }] })}>+ Uitgang</button>}
      </div>
      <div className="fm-sectie">
        <label className="fm-veld">Sleutel of code<input value={v.sleutel || ''} disabled={ro} onChange={(e) => zet({ sleutel: e.target.value })} placeholder="wie heeft de sleutel, code" /></label>
        <label className="fm-veld">Contact<input value={v.contact || ''} disabled={ro} onChange={(e) => zet({ contact: e.target.value })} placeholder="dienst, naam, telefoon" /></label>
        <div className="fm-raster2">
          <label className="fm-veld">EAN / teller<input value={v.ean || ''} disabled={ro} onChange={(e) => zet({ ean: e.target.value })} /></label>
          <label className="fm-veld">Laatst gecontroleerd<input type="date" value={v.laatst_gecontroleerd || ''} disabled={ro} onChange={(e) => zet({ laatst_gecontroleerd: e.target.value || null })} /></label>
        </div>
        <label className="fm-veld">Opmerking<textarea rows={2} value={v.opmerking || ''} disabled={ro} onChange={(e) => zet({ opmerking: e.target.value })} /></label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {v.foto && <a href={publiekeUrl(v.foto)} target="_blank" rel="noreferrer"><img src={publiekeUrl(v.foto)} alt="Foto van de aansluiting" width={56} height={56} style={{ objectFit: 'cover', display: 'block' }} /></a>}
          {!ro && <label className="fm-knop klein" style={{ cursor: 'pointer' }}>{v.foto ? 'Andere foto' : 'Foto opladen'}<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => uploadFoto(e.target.files?.[0])} /></label>}
        </div>
      </div>
      {fout && <div className="fm-sectie"><div className="fm-melding fout">{fout}</div></div>}
      <div className="fm-sectie">
        {!ro && (
          <div className="fm-raster2">
            <button className="fm-knop zwart" disabled={!!bezig || (!veranderd && !!v.id)} onClick={bewaar}>{bezig || (v.id ? 'Bewaren' : 'Toevoegen aan register')}</button>
            <button className="fm-knop" onClick={onSluit}>{v.id && !veranderd ? 'Sluiten' : 'Annuleren'}</button>
          </div>
        )}
        {ro && <button className="fm-knop" onClick={onSluit}>Sluiten</button>}
        <div style={{ display: 'flex', gap: 6 }}>
          {onZoom && v.geometrie && <button className="fm-knop klein" onClick={() => onZoom(v)}>Op kaart</button>}
          {!ro && v.id && <button className="fm-knop klein gevaar" disabled={!!bezig} onClick={deactiveer}>Uit register</button>}
        </div>
        <div className="fm-sub">{SOORT_NAAM[v.soort]}{v.gemeente ? ` · ${v.gemeente}` : ''}{uitgangenTekst(v) ? ` · ${uitgangenTekst(v)}` : ''} · geldt voor alle evenementen.</div>
      </div>
    </div>
  );
}
