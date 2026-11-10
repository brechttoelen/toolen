'use client';

import Info from './info';
import { useRef, useState } from 'react';
import { maps, foutTekst } from './db';
import { leesBestand, naarKml, naarGeojsonBestand, download, geocodeer, KLEUREN_STANDAARD } from './uitwisseling';
import { effectieveStijl } from './stijl';

export default function BestandDialoog({ ingebed = false, binnen = null, plan, lagen, items, elementenMap, schrijven, onSluit, onGeimporteerd, kaart, onCad }) {
  const [gelezen, setGelezen] = useState(null);
  const [koppeling, setKoppeling] = useState({});
  const [expLaag, setExpLaag] = useState(''); // '' = alle lagen
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState('');
  const ref = useRef(null);
  const lagenMap = new Map(lagen.map((l) => [l.id, l]));
  const stijlVan = (it) => effectieveStijl(it, lagenMap.get(it.laag_id), elementenMap.get(it.element_id));

  const kies = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFout(''); setGelezen(null);
    try {
      const r = await leesBestand(f);
      if (!r.items.length) throw new Error('Geen punten, lijnen of vlakken gevonden in dit bestand.');
      setGelezen({ ...r, naam: f.name });
      const k = {};
      for (const l of r.lagen) {
        const bestaand = lagen.find((x) => x.naam.toLowerCase() === l.naam.toLowerCase());
        k[l.naam] = bestaand ? bestaand.id : 'nieuw';
      }
      setKoppeling(k);
    } catch (err) {
      setFout(err?.message || String(err));
    }
  };

  const importeer = async () => {
    setBezig('Lagen maken…'); setFout('');
    try {
      if (gelezen.items.some((i) => !i.geometrie && i.adres)) {
        const voor = gelezen.items.length;
        gelezen.items = await geocodeer(gelezen.items, setBezig);
        if (gelezen.items.length < voor) setFout(`${voor - gelezen.items.length} adressen niet gevonden; die rijen zijn overgeslagen.`);
      }
      const laagId = { ...koppeling };
      const nieuweLagen = [];
      let i = 0;
      for (const l of gelezen.lagen) {
        if (laagId[l.naam] === 'overslaan') continue;
        if (laagId[l.naam] !== 'nieuw') continue;
        const { data, error } = await maps().from('lagen').insert({ plan_id: plan.id, naam: l.naam.slice(0, 80), kleur: l.kleur || KLEUREN_STANDAARD[i++ % KLEUREN_STANDAARD.length], volgorde: lagen.length + nieuweLagen.length }).select().single();
        if (error) throw error;
        nieuweLagen.push(data);
        laagId[l.naam] = data.id;
      }
      const rijen = gelezen.items.filter((it) => laagId[it.laag] !== 'overslaan').map((it, j) => ({
        plan_id: plan.id, laag_id: laagId[it.laag] || null, soort: it.soort, geometrie: it.geometrie,
        naam: it.naam ? String(it.naam).slice(0, 200) : null, notitie: it.notitie || null, stijl: it.stijl || {},
        parameters: {}, velden: binnen ? { binnen: { host: binnen.host, verd: binnen.verd || null }, ...(it.geometrie?.type === 'Polygon' && it.naam ? { ruimte: true } : {}) } : {}, volgorde: items.length + j,
      }));
      const nieuw = [];
      for (let k = 0; k < rijen.length; k += 300) {
        setBezig(`Items bewaren… ${Math.min(k + 300, rijen.length)} van ${rijen.length}`);
        const { data, error } = await maps().from('items').insert(rijen.slice(k, k + 300)).select();
        if (error) throw error;
        nieuw.push(...data);
      }
      onGeimporteerd(nieuweLagen, nieuw);
      onSluit();
    } catch (err) {
      setFout(foutTekst(err));
    } finally {
      setBezig('');
    }
  };

  // Eén laag of alles: de items en lagen die mee gaan in KML, KMZ en GeoJSON.
  const expL = expLaag ? lagen.filter((l) => l.id === expLaag) : lagen;
  const expI = expLaag ? items.filter((i) => i.laag_id === expLaag) : items;
  const exporteer = async (soort) => {
    const ln = expLaag ? lagen.find((l) => l.id === expLaag)?.naam : null;
    const naam = [plan.editie_naam, plan.naam, ln, `v${plan.versie}`].filter(Boolean).join(' - ');
    if (soort === 'png') {
      if (!kaart) return;
      kaart.once('render', () => {
        try {
          const a = document.createElement('a');
          a.href = kaart.getCanvas().toDataURL('image/png');
          a.download = `${naam}.png`.replace(/[\\/:*?"<>|]/g, '');
          a.click();
        } catch { setFout('De ondergrond laat geen afbeelding toe (CORS). Zet de ondergrond op Leeg of Lijntekening.'); }
      });
      kaart.triggerRepaint();
      return;
    }
    if (soort === 'kml') download(naarKml({ plan, lagen: expL, items: expI, stijlVan }), `${naam}.kml`, 'application/vnd.google-earth.kml+xml');
    else if (soort === 'kmz') {
      try {
        const JSZip = (await import('jszip')).default; const zip = new JSZip();
        zip.file('doc.kml', naarKml({ plan, lagen: expL, items: expI, stijlVan }));
        download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `${naam}.kmz`, 'application/vnd.google-earth.kmz');
      } catch { setFout('KMZ maken lukte niet. Probeer KML.'); }
    } else download(naarGeojsonBestand({ lagen: expL, items: expI, stijlVan }), `${naam}.geojson`, 'application/geo+json');
  };

  // Ingebed in Exporteren → Importeren: enkel het importeren.
  if (ingebed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input ref={ref} type="file" accept=".kml,.kmz,.gpx,.geojson,.json,.csv,.txt,.xlsx" onChange={kies} style={{ display: 'none' }} />
        <button className="t-knop hoofd" style={{ alignSelf: 'flex-start' }} onClick={() => ref.current?.click()}>{gelezen ? 'Ander bestand kiezen' : 'Bestand kiezen'}</button>
        {fout && <div className="t-melding fout">{fout}</div>}
        {gelezen && (
          <>
            <div className="t-sub" style={{ margin: 0 }}>{gelezen.naam}: {gelezen.items.length} items in {gelezen.lagen.length} {gelezen.lagen.length === 1 ? 'laag' : 'lagen'}.</div>
            <table className="t-tabel">
              <thead><tr><th>Laag in het bestand</th><th>Items</th><th>Komt in</th></tr></thead>
              <tbody>
                {gelezen.lagen.map((l) => (
                  <tr key={l.naam}>
                    <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: l.kleur || '#686D76', marginRight: 6 }} />{l.naam}</td>
                    <td>{gelezen.items.filter((i) => i.laag === l.naam).length}</td>
                    <td>
                      <select className="t-veld" value={koppeling[l.naam]} onChange={(e) => setKoppeling({ ...koppeling, [l.naam]: e.target.value })}>
                        <option value="nieuw">Nieuwe laag</option>
                        {lagen.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
                        <option value="overslaan">Niet importeren</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="t-knop hoofd" style={{ alignSelf: 'flex-start' }} disabled={!!bezig} onClick={importeer}>{bezig || `${gelezen.items.length} items importeren`}</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fm-dialoog-achter" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <section className="fm-dialoog fm" role="dialog" aria-label="Importeren en exporteren" style={{ maxWidth: 640 }}>
        <header><h2>Importeren en exporteren</h2><button className="fm-knop" onClick={onSluit}>Sluiten</button></header>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fout && <div className="fm-melding fout">{fout}</div>}
          {schrijven && onCad && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="fm-kop">CAD-plan van een leverancier<Info>Podium, stellingbouw of VIP-tent als één object op ware grootte: PDF uit AutoCAD/BricsCAD of DXF. Je kiest het bovenaanzicht, schoont op en zet de schaal.</Info></div>
              <button className="fm-knop zwart" style={{ alignSelf: 'flex-start' }} onClick={onCad}>CAD-plan importeren als object</button>
            </div>
          )}
          {schrijven && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="fm-kop">Importeren<Info>KML/KMZ uit Google My Maps, GPX, GeoJSON of CSV (naam + adres of coördinaten, optioneel een kolom laag). Elke map uit My Maps wordt een laag, met kleuren en namen.</Info></div>
              <input ref={ref} type="file" accept=".kml,.kmz,.gpx,.geojson,.json,.csv,.txt,.xlsx" onChange={kies} style={{ display: 'none' }} />
              <button className="fm-knop" style={{ alignSelf: 'flex-start' }} onClick={() => ref.current?.click()}>Bestand kiezen</button>
              {gelezen && (
                <>
                  <div className="fm-sub">{gelezen.naam}: {gelezen.items.length} items in {gelezen.lagen.length} lagen.</div>
                  <table className="fm-tabel">
                    <thead><tr><th>Laag in het bestand</th><th>Items</th><th>Komt in</th></tr></thead>
                    <tbody>
                      {gelezen.lagen.map((l) => (
                        <tr key={l.naam}>
                          <td><span style={{ display: 'inline-block', width: 10, height: 10, background: l.kleur || '#686D76', marginRight: 6 }} />{l.naam}</td>
                          <td>{gelezen.items.filter((i) => i.laag === l.naam).length}</td>
                          <td>
                            <select value={koppeling[l.naam]} onChange={(e) => setKoppeling({ ...koppeling, [l.naam]: e.target.value })}>
                              <option value="nieuw">Nieuwe laag</option>
                              {lagen.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
                              <option value="overslaan">Niet importeren</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="fm-knop rood" style={{ alignSelf: 'flex-start' }} disabled={!!bezig} onClick={importeer}>{bezig || 'Importeren'}</button>
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: schrijven ? '1px solid #e8e8e6' : 0, paddingTop: schrijven ? 16 : 0 }}>
            <div className="fm-kop">Exporteren · {expI.length} items<Info>Per laag. KML en KMZ openen in Google Earth en My Maps, GeoJSON in QGIS.</Info></div>
            <label className="fm-veld">Wat
              <select value={expLaag} onChange={(e) => setExpLaag(e.target.value)}>
                <option value="">Alle lagen ({items.length} items)</option>
                {lagen.map((l) => { const n = items.filter((i) => i.laag_id === l.id).length; return n ? <option key={l.id} value={l.id}>{l.naam} ({n})</option> : null; })}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="fm-knop" disabled={!expI.length} onClick={() => exporteer('kmz')}>KMZ</button>
              <button className="fm-knop" disabled={!expI.length} onClick={() => exporteer('kml')}>KML</button>
              <button className="fm-knop" disabled={!expI.length} onClick={() => exporteer('geojson')}>GeoJSON</button>
              <button className="fm-knop" onClick={() => exporteer('png')}>PNG van het kaartbeeld</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
