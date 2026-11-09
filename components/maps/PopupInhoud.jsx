'use client';

import { tvCamTekst } from './tvcamera';
import { AttestenLijst } from './attesten';
import { useEffect, useState } from 'react';
import { maps, foutTekst, magSchrijven, publiekeUrl } from './db';
import { maten, matenTekst } from './stijl';
import { middelpunt } from './geo';
import { isSign } from './signalisatie';

const SOORT = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', element: 'Element', notitie: 'Notitie', veelhoek: 'Veelhoek', ellips: 'Ellips', sector: 'Kijkhoek' };

export function navigatieUrl(geometrie) {
  const [lng, lat] = middelpunt(geometrie) || [];
  return lat ? `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}` : null;
}

export function navLinks(geometrie) {
  const [lng, lat] = middelpunt(geometrie) || [];
  if (!lat) return [];
  const c = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return [['Google', `https://www.google.com/maps/dir/?api=1&destination=${c}`], ['Apple', `https://maps.apple.com/?daddr=${c}`], ['Waze', `https://waze.com/ul?ll=${c}&navigate=yes`]];
}

export function NavKnoppen({ geometrie, tekst = 'Navigeer' }) {
  const l = navLinks(geometrie);
  if (!l.length) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#686D76' }}>{tekst}:</span>
      {l.map(([n, u]) => <a key={n} className="fm-knop klein" href={u} target="_blank" rel="noreferrer">{n}</a>)}
    </div>
  );
}

export function PopupKop({ item, laag, element }) {
  const m = matenTekst(maten(item, element));
  const titel = item.naam || element?.naam || SOORT[item.soort] || 'Item';
  return (
    <div className="kop">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, background: laag?.kleur || '#686D76', flex: 'none' }} />
        <span style={{ fontSize: 12, color: '#686D76' }}>{laag?.naam || 'Zonder laag'}{element && element.naam !== titel ? ` · ${element.naam}` : ''}</span>
      </div>
      <strong style={{ fontSize: 16 }}>{titel}</strong>
      {tvCamTekst(item, element) && <span style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{tvCamTekst(item, element)}</span>}
      {m && <span style={{ fontSize: 13, color: '#444' }}>{m}</span>}
    </div>
  );
}

export function PopupInfo({ item }) {
  const v = item.velden || {};
  const rijen = [['Plaatsen', v.opbouw], ['Weghalen', v.afbraak], ['Verantwoordelijke', v.verantwoordelijke], ['Contact', v.contact]].filter(([, w]) => w);
  if (!item.notitie && !rijen.length) return null;
  return (
    <div className="blok">
      {item.notitie && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.notitie}</p>}
      {rijen.length > 0 && (
        <div className="velden">{rijen.map(([k, w]) => <div key={k}><span>{k}</span><strong>{w}</strong></div>)}</div>
      )}
    </div>
  );
}

export default function PopupInhoud({ item, laag, element, profiel }) {
  const [opm, setOpm] = useState([]);
  const [tekst, setTekst] = useState('');
  const [fout, setFout] = useState('');
  const schrijven = magSchrijven(profiel);

  useEffect(() => {
    let weg = false;
    maps().from('opmerkingen').select('*').eq('item_id', item.id).order('created_at').then(({ data, error }) => {
      if (weg) return;
      if (error) setFout(foutTekst(error)); else setOpm(data || []);
    });
    return () => { weg = true; };
  }, [item.id]);

  const plaats = async () => {
    const t = tekst.trim();
    if (!t) return;
    const { data, error } = await maps().from('opmerkingen').insert({
      item_id: item.id, tekst: t, auteur_id: profiel?.id || null, auteur_naam: profiel?.display_name || profiel?.email || null,
    }).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    setOpm((o) => [...o, data]);
    setTekst('');
  };

  const wissel = async (o) => {
    const status = o.status === 'open' ? 'opgelost' : 'open';
    const { error } = await maps().from('opmerkingen').update({ status }).eq('id', o.id);
    if (error) { setFout(foutTekst(error)); return; }
    setOpm((lijst) => lijst.map((x) => (x.id === o.id ? { ...x, status } : x)));
  };

  const nav = navigatieUrl(item.geometrie);
  const [fotos, setFotos] = useState([]);
  useEffect(() => {
    maps().from('bestanden').select('pad').eq('item_id', item.id).eq('soort', 'foto').then(({ data }) => setFotos((data || []).map((f) => publiekeUrl(f.pad))));
  }, [item.id]);
  const open = opm.filter((o) => o.status === 'open').length;

  return (
    <div className="fm-pop">
      <PopupKop item={item} laag={laag} element={element} />
      <PopupInfo item={item} />
      {item.velden?.attesten?.length > 0 && <div className="blok"><div className="fm-kop">Attesten</div><AttestenLijst attesten={item.velden.attesten} /></div>}
      <div className="blok" style={{ background: '#FAFAFB' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#686D76' }}>Opmerkingen{opm.length ? ` · ${open} open` : ''}</div>
        {fout && <div className="fm-melding fout">{fout}</div>}
        {opm.map((o) => (
          <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 12 }}><strong>{o.auteur_naam || 'Onbekend'}</strong>{o.deel_link_id ? ' (via deel-link)' : ''} <span style={{ color: '#686D76' }}>· {new Date(o.created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
            <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{o.tekst}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={`fm-tag ${o.status === 'open' ? 'oranje' : 'groen'}`}>{o.status === 'open' ? 'Open' : 'Opgelost'}</span>
              {schrijven && <button className="fm-knop klein" onClick={() => wissel(o)}>{o.status === 'open' ? 'Markeer opgelost' : 'Heropen'}</button>}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{ flex: 1, display: 'flex' }}><span style={{ position: 'absolute', left: -9999 }}>Opmerking</span>
            <input value={tekst} onChange={(e) => setTekst(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') plaats(); }} placeholder="Opmerking toevoegen"
              style={{ flex: 1, height: 34, border: '1px solid #DADDE3', padding: '0 8px', fontSize: 13 }} />
          </label>
          <button className="fm-knop rood klein" style={{ height: 34 }} onClick={plaats}>Plaats</button>
        </div>
        {fotos.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {fotos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Foto" width={56} height={56} style={{ objectFit: 'cover', display: 'block' }} /></a>)}
          </div>
        )}
        {nav && isSign(item) && <NavKnoppen geometrie={item.geometrie} />}
      </div>
    </div>
  );
}
