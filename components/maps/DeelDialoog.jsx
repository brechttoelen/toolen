'use client';

import { bevestig, toonTekst } from './dialoog';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { maps, foutTekst } from './db';
import { vergelijkCategorie } from './categorieen';
import { herkomstVan } from './stijl';
import { heeft3d } from './drie3d';

// Snelkeuze voor wie de link is: zet de vinkjes zoals meestal nodig (achteraf aan te passen).
const PROFIELEN = [
  { id: 'hulpdiensten', label: 'Hulpdiensten', naam: 'Politie en brandweer', uitleg: 'Notities en keuringsattesten zien, opmerkingen plaatsen', opties: { notities: true, attesten: true, opmerkingen: true, materialen: false, pdf: true } },
  { id: 'leverancier', label: 'Leverancier of gemeente', naam: '', uitleg: 'Enkel hun materiaal (te kiezen), met materiaallijst', opties: { notities: true, attesten: false, opmerkingen: true, materialen: true, pdf: true } },
  { id: 'stroom', label: 'Stroom', naam: 'Stroom', uitleg: 'Elektricien en chauffeur: lijst met stroompunten, per punt wat er moet staan, het aansluitschema en wat mee moet', opties: { stroom: true, notities: false, attesten: false, opmerkingen: false, materialen: false, pdf: true } },
  { id: 'partner', label: 'Partner of team', naam: '', uitleg: 'Het plan bekijken en afdrukken', opties: { notities: true, attesten: false, opmerkingen: false, materialen: false, pdf: true } },
  { id: 'publiek', label: 'Publiek', naam: 'Publiek', uitleg: 'Enkel de kaart: geen notities, attesten of aantallen', opties: { notities: false, attesten: false, opmerkingen: false, materialen: false, pdf: true } },
];
const leeg = (lagen) => ({ live: false, naam: '', laag_ids: lagen.map((l) => l.id), fase_ids: [], opties: { notities: true, opmerkingen: false, pdf: true, attesten: true, materialen: true, taal: 'nl' }, geldig_tot: '' });

const SOORT1 = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', veelhoek: 'Veelhoek', ellips: 'Ellips', sector: 'Kijkhoek', notitie: 'Notitie', afstand: 'Maatlijn', element: 'Element' };
const SOORT = { punt: 'Punten', lijn: 'Lijnen', vlak: 'Vlakken', rechthoek: 'Rechthoeken', cirkel: 'Cirkels', tekst: 'Teksten', veelhoek: 'Veelhoeken', ellips: 'Ellipsen', sector: 'Kijkhoeken', notitie: 'Notities met pijl', afstand: 'Maatlijnen' };

export default function DeelDialoog({ plan, lagen, fasen, items = [], elementenMap = new Map(), leveranciers = [], onSluit, kaartBeeld = null }) {
  const [versies, setVersies] = useState({}); // id -> { versie, created_at }
  const [links, setLinks] = useState([]);
  const [bezig, setBezig] = useState(null); // id of 'nieuw'
  const [vorm, setVorm] = useState(leeg(lagen));
  const [fout, setFout] = useState('');
  const [qr, setQr] = useState('');
  const [gekopieerd, setGekopieerd] = useState(false);
  const [start, setStart] = useState(''); // vorm bij openen of laatste bewaring (om wijzigingen te zien)
  const [bewaren, setBewaren] = useState(false);
  const [bewaardOp, setBewaardOp] = useState(null);

  // Elementen met een 3D (stelling, wand, truss, tent) om enkel die 3D te delen.
  const drieLijst = items.filter((i) => heeft3d(i, elementenMap.get(i.element_id)));
  // Gebouwen met een binnenplan (om enkel dat binnenplan te delen).
  const gebouwen = items.filter((i) => i.velden?.binnenplan && items.some((x) => x.velden?.binnen?.host === i.id));
  // Deellinks op het adres van de organisatie: <org>.toolen.be/d/<token>.
  const url = (token) => `${window.location.origin}/d/${token}`;

  useEffect(() => {
    maps().from('deel_links').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setFout(foutTekst(error)); else setLinks(data || []);
    });
    maps().from('versies').select('id, versie, created_at, opmerking').eq('plan_id', plan.id).then(({ data }) => setVersies(Object.fromEntries((data || []).map((v) => [v.id, v]))));
  }, [plan.id]);

  const huidig = links.find((l) => l.id === bezig);
  useEffect(() => {
    setQr('');
    setGekopieerd(false);
    if (huidig) QRCode.toDataURL(url(huidig.token), { margin: 1, width: 220 }).then(setQr).catch(() => {});
  }, [huidig?.token]); // eslint-disable-line react-hooks/exhaustive-deps

 const open = (l) => {
    setBezig(l ? l.id : 'nieuw'); setFout(''); setBewaardOp(null);
    const v = l ? { live: !!l.live, naam: l.naam, laag_ids: l.laag_ids || [], fase_ids: l.fase_ids || [], opties: { notities: true, opmerkingen: false, pdf: true, attesten: true, materialen: true, taal: 'nl', ...(l.opties || {}) }, geldig_tot: l.geldig_tot ? l.geldig_tot.slice(0, 10) : '' } : leeg(lagen);
    setVorm(v); setStart(l ? JSON.stringify(v) : '');
  };
  const gewijzigd = bezig && JSON.stringify(vorm) !== start;

  // De huidige stand vastleggen als versie die de ontvanger ziet.
  const publiceer = async (naam) => {
    const { data, error } = await maps().from('versies').insert({
      plan_id: plan.id, versie: plan.versie || 1, opmerking: `Gedeeld met ${naam}`,
      momentopname: { items, lagen, fasen },
    }).select('id, versie, created_at, opmerking').single();
    if (error) { setFout(foutTekst(error)); return null; }
    setVersies((v) => ({ ...v, [data.id]: data }));
    return data.id;
  };

  const bewaar = async (opnieuwPubliceren = false) => {
    if (bewaren) return;
    if (!vorm.naam.trim()) { setFout('Geef de link een naam, bv. de ontvanger.'); return; }
    if (!vorm.laag_ids.length && !vorm.opties.binnen && !vorm.opties.drie) { setFout('Kies minstens één laag.'); return; }
    setBewaren(true); setFout('');
    try { await bewaarEcht(opnieuwPubliceren); } finally { setBewaren(false); }
  };
  const bewaarEcht = async (opnieuwPubliceren) => {
    const rij = { plan_id: plan.id, naam: vorm.naam.trim(), laag_ids: vorm.laag_ids, fase_ids: vorm.fase_ids.length ? vorm.fase_ids : null, opties: vorm.opties, geldig_tot: vorm.geldig_tot ? new Date(vorm.geldig_tot + 'T23:59:59').toISOString() : null, live: !!vorm.live };
    if (!vorm.live && (opnieuwPubliceren === true || !huidig?.versie_id)) {
      const id = await publiceer(vorm.naam.trim());
      if (!id) return;
      rij.versie_id = id;
    }
    const r = bezig === 'nieuw'
      ? await maps().from('deel_links').insert(rij).select().single()
      : await maps().from('deel_links').update(rij).eq('id', bezig).select().single();
    if (r.error) { setFout(foutTekst(r.error)); return; }
    setFout('');
    setLinks((ls) => (bezig === 'nieuw' ? [r.data, ...ls] : ls.map((x) => (x.id === r.data.id ? r.data : x))));
    setBezig(r.data.id); setStart(JSON.stringify(vorm)); setBewaardOp(new Date());
  };

  const intrekken = async () => {
    if (!huidig || !await bevestig('Deze link intrekken? Wie hem heeft, ziet daarna niets meer.')) return;
    const { data, error } = await maps().from('deel_links').update({ ingetrokken_op: new Date().toISOString() }).eq('id', huidig.id).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    setLinks((ls) => ls.map((x) => (x.id === data.id ? data : x)));
  };

  const kopieer = async () => {
    try { await navigator.clipboard.writeText(url(huidig.token)); setGekopieerd(true); } catch { await toonTekst('Kopieer de link', url(huidig.token)); }
  };

  const wissel = (lijst, id) => (lijst.includes(id) ? lijst.filter((x) => x !== id) : [...lijst, id]);
  const status = (l) => (l.ingetrokken_op ? ['Ingetrokken', ''] : l.geldig_tot && new Date(l.geldig_tot) < new Date() ? ['Verlopen', ''] : ['Actief', 'groen']);

  useEffect(() => { const t = (e) => { if (e.key === 'Escape' && !document.querySelector('.fm-dialoog-achter')) onSluit(); }; window.addEventListener('keydown', t, true); return () => window.removeEventListener('keydown', t, true); }, [onSluit]);
  const scherm = (
    <div className="fm fm-volscherm" role="dialog" aria-label="Delen">
      <header className="fm-volscherm-kop"><button className="fm-knop" onClick={onSluit}>‹ Terug naar het plan</button><h2>Delen met externen</h2></header>
      <div className="fm-volscherm-lijf">
          <aside className="fm-volscherm-links">
            <div style={{ padding: 12 }}><button className="fm-knop zwart vol" onClick={() => open(null)}>Nieuwe link</button></div>
            {links.map((l) => {
              const [st, kl] = status(l);
              return (
                <button key={l.id} onClick={() => open(l)} style={{ textAlign: 'left', border: 0, borderTop: '1px solid #f0f0ee', borderLeft: `3px solid ${bezig === l.id ? '#1d1d1b' : 'transparent'}`, background: bezig === l.id ? '#F2F3F5' : '#fff', padding: '10px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 14 }}>{l.naam}</strong><span className={`fm-tag ${kl}`}>{st}</span></span>
                  <span className="fm-sub">{l.live ? 'Live' : 'Vaste versie'} · {l.opties?.binnen ? 'binnenplan' : `${(l.laag_ids || []).length} lagen`}{['verberg_elementen', 'verberg_soorten', 'verberg_items'].some((k) => l.opties?.[k]?.length) ? ' · fijn gekozen' : ''} · {l.keer_geopend || 0} keer geopend</span>
                </button>
              );
            })}
            {!links.length && <div className="fm-sub" style={{ padding: 12 }}>Nog geen deel-links voor dit plan.</div>}
          </aside>
          <div className="fm-volscherm-inhoud fm-deel-raster"><div className="fm-volscherm-kolom">
            {fout && <div className="fm-melding fout">{fout}</div>}
            {!bezig && <div className="fm-sub">Kies links een link of maak een nieuwe.</div>}
            {bezig && (
              <>
                <div className="fm-kop"><b className="fm-stap">1</b>Voor wie</div>
                <div className="fm-vinkrij" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {PROFIELEN.map((pr) => (
                    <button key={pr.id} className={`fm-knop klein ${vorm.opties.profiel === pr.id ? 'zwart' : ''}`} title={pr.uitleg}
                      onClick={() => setVorm({ ...vorm, naam: vorm.naam || pr.naam, opties: { ...vorm.opties, stroom: false, ...pr.opties, profiel: pr.id, leverancier: pr.id === 'leverancier' ? vorm.opties.leverancier : null } })}>{pr.label}</button>
                  ))}
                </div>
                <label className="fm-veld">Naam van de link<input value={vorm.naam} onChange={(e) => setVorm({ ...vorm, naam: e.target.value })} placeholder="bv. Politie en brandweer, Gemeente Wevelgem" /></label>
                {leveranciers.length > 0 && (vorm.opties.profiel === 'leverancier' || vorm.opties.leverancier) && (
                  <label className="fm-veld">Enkel het materiaal van
                    <select value={vorm.opties.leverancier || ''} onChange={(e) => { const v = e.target.value || null; setVorm({ ...vorm, naam: vorm.naam || v || '', opties: { ...vorm.opties, leverancier: v } }); }}>
                      <option value="">Alles in de gekozen lagen</option>
                      {leveranciers.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <span className="fm-sub">Volgt "Geleverd door" op het plan. Zonder keuze zien ze alles en kunnen ze zelf filteren.</span>
                  </label>
                )}
                <div className="fm-kop"><b className="fm-stap">2</b>Wat zien ze</div>
                {(gebouwen.length > 0 || drieLijst.length > 0) && (
                  <div className="fm-deel-wat">
                    <div className="fm-segment" style={{ width: 'auto' }}>
                      <button className={!vorm.opties.binnen && !vorm.opties.drie ? 'aan' : ''} onClick={() => setVorm({ ...vorm, opties: { ...vorm.opties, binnen: null, drie: null } })}>De kaart</button>
                      {gebouwen.length > 0 && <button className={vorm.opties.binnen ? 'aan' : ''} onClick={() => setVorm({ ...vorm, opties: { ...vorm.opties, drie: null, binnen: vorm.opties.binnen || gebouwen[0].id } })}>Enkel een binnenplan</button>}
                      {drieLijst.length > 0 && <button className={vorm.opties.drie ? 'aan' : ''} onClick={() => setVorm({ ...vorm, opties: { ...vorm.opties, binnen: null, drie: vorm.opties.drie || drieLijst[0].id } })}>Enkel een 3D</button>}
                    </div>
                    {vorm.opties.drie && (
                      <select aria-label="Element in 3D" value={vorm.opties.drie} onChange={(e) => setVorm({ ...vorm, opties: { ...vorm.opties, drie: e.target.value } })}>
                        {drieLijst.map((g) => { const host = g.velden?.binnen?.host ? items.find((x) => x.id === g.velden.binnen.host) : null; const naam = g.naam || elementenMap.get(g.element_id)?.naam || 'Element'; const waar = host ? (host.naam || elementenMap.get(host.element_id)?.naam || 'binnenplan') : null; const fn = g.velden?.functie; return <option key={g.id} value={g.id}>{naam}{fn && fn !== naam ? ` · ${fn}` : ''}{waar ? ` · in ${waar}` : ''}</option>; })}
                      </select>
                    )}
                    {vorm.opties.binnen && (
                      <select aria-label="Gebouw" value={vorm.opties.binnen} onChange={(e) => setVorm({ ...vorm, opties: { ...vorm.opties, binnen: e.target.value } })}>
                        {gebouwen.map((g) => <option key={g.id} value={g.id}>{g.naam || 'Gebouw'}</option>)}
                      </select>
                    )}
                  </div>
                )}
                {vorm.opties.drie ? <div className="fm-sub">Ze zien enkel dit element in 3D, over het hele scherm, zonder de kaart: draaien, zoomen en de doeken verbergen. Bij een stelling ook de plannen van de stellingbouwer.</div> : vorm.opties.binnen ? <div className="fm-sub">Ze zien enkel het binnenplan van dit gebouw (alle verdiepingen, zalen en inrichting), zonder de kaart.</div> : <>
                <div>
                  <div className="fm-sub" style={{ marginBottom: 4 }}>Lagen</div>
                  <div className="fm-rij" style={{ gap: 6, marginBottom: 6 }}>
                    <button className="fm-knop klein" onClick={() => setVorm({ ...vorm, laag_ids: lagen.map((l) => l.id) })}>Alles</button>
                    <button className="fm-knop klein" onClick={() => setVorm({ ...vorm, laag_ids: [] })}>Niets</button>
                  </div>
                  {(() => {
                    // Lagen per map (zoals in het lagenpaneel), met een vinkje voor de hele map.
                    const groepen = []; const gezien = new Set();
                    for (const l of lagen) { if (!l.map) groepen.push({ lagen: [l] }); else if (!gezien.has(l.map)) { gezien.add(l.map); groepen.push({ map: l.map, lagen: lagen.filter((x) => x.map === l.map) }); } }
                    const los = groepen.filter((g) => !g.map).flatMap((g) => g.lagen); const mappen = groepen.filter((g) => g.map);
                    const vink = (l) => <label key={l.id} className="fm-vink"><input type="checkbox" checked={vorm.laag_ids.includes(l.id)} onChange={() => setVorm({ ...vorm, laag_ids: wissel(vorm.laag_ids, l.id) })} /><span style={{ width: 10, height: 10, background: l.kleur, flex: 'none' }} /><span className="fm-afkap">{l.naam}</span></label>;
                    return (
                      <div className="fm-deel-lagen">
                        {mappen.map((g) => {
                          const ids = g.lagen.map((l) => l.id); const n = ids.filter((id) => vorm.laag_ids.includes(id)).length;
                          return (
                            <div key={g.map} className="fm-deel-map">
                              <label className="fm-vink fm-deel-mapkop"><input type="checkbox" checked={n === ids.length} ref={(el) => { if (el) el.indeterminate = n > 0 && n < ids.length; }}
                                onChange={() => setVorm({ ...vorm, laag_ids: n === ids.length ? vorm.laag_ids.filter((id) => !ids.includes(id)) : [...new Set([...vorm.laag_ids, ...ids])] })} /><strong className="fm-afkap">{g.map}</strong><span className="fm-sub">{n}/{ids.length}</span></label>
                              <div className="fm-deel-maplagen">{g.lagen.map(vink)}</div>
                            </div>
                          );
                        })}
                        {los.length > 0 && <div className="fm-deel-maplagen los">{los.map(vink)}</div>}
                      </div>
                    );
                  })()}
                </div>
                {fasen.length > 0 && (
                  <div>
                    <div className="fm-sub" style={{ marginBottom: 4 }}>Fasen (geen vinkje = alle)</div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {fasen.map((f) => <label key={f.id} className="fm-vink"><input type="checkbox" checked={vorm.fase_ids.includes(f.id)} onChange={() => setVorm({ ...vorm, fase_ids: wissel(vorm.fase_ids, f.id) })} />{f.naam}</label>)}
                    </div>
                  </div>
                )}
                <FijnKiezen vorm={vorm} setVorm={setVorm} plan={plan} items={items} elementenMap={elementenMap} lagen={lagen} />
                <div>
                  <div className="fm-sub" style={{ marginBottom: 4 }}>Startbeeld</div>
                  <label className="fm-vink"><input type="radio" name="startbeeld" checked={!vorm.opties.beeld} onChange={() => setVorm({ ...vorm, opties: { ...vorm.opties, beeld: null } })} />Alles in beeld <span className="fm-sub">(de kaart past zich aan wat er gedeeld wordt)</span></label>
                  <label className="fm-vink"><input type="radio" name="startbeeld" checked={!!vorm.opties.beeld} disabled={!kaartBeeld} onChange={() => { const b = kaartBeeld?.(); if (b) setVorm({ ...vorm, opties: { ...vorm.opties, beeld: b } }); }} />Zoals nu op mijn kaart</label>
                  {vorm.opties.beeld && (
                    <div className="fm-rij" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <span className="fm-sub">Zoom {Math.round(vorm.opties.beeld.z * 10) / 10}{vorm.opties.beeld.b ? ` · gedraaid ${Math.round(vorm.opties.beeld.b)}°` : ''}</span>
                      <button className="fm-knop klein" disabled={!kaartBeeld} title="Neemt de kaart over zoals ze stond toen je Delen opende" onClick={() => { const b = kaartBeeld?.(); if (b) setVorm({ ...vorm, opties: { ...vorm.opties, beeld: b } }); }}>Huidig beeld overnemen</button>
                    </div>
                  )}
                </div>
                </>}
                <div>
                  <div className="fm-kop" style={{ marginBottom: 4 }}><b className="fm-stap">3</b>Welke stand</div>
                  <label className="fm-vink"><input type="radio" name="stand" checked={!vorm.live} onChange={() => setVorm({ ...vorm, live: false })} />Vaste versie <span className="fm-sub">(aanbevolen: geen werk in uitvoering)</span></label>
                  {!vorm.live && huidig?.versie_id && versies[huidig.versie_id] && (
                    <div className="fm-sub" style={{ marginLeft: 24, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      Toont de stand van {new Date(versies[huidig.versie_id].created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  <label className="fm-vink"><input type="radio" name="stand" checked={!!vorm.live} onChange={() => setVorm({ ...vorm, live: true })} />Live <span className="fm-sub">(toont meteen elke wijziging, ook wat nog niet af is)</span></label>
                </div>
                <div>
                  <div className="fm-kop" style={{ marginBottom: 4 }}><b className="fm-stap">4</b>Wat mogen ze</div>
                  {[['notities', 'Notities, tijden en contact zien'], ['opmerkingen', 'Opmerkingen lezen en plaatsen'], ['attesten', 'Keuringsattesten zien en openen (bv. brandweer)'], ['materialen', 'Materiaallijst zien (aantallen per leverancier)'], ['pdf', 'PDF afdrukken']].map(([k, t]) => (
                    <label key={k} className="fm-vink"><input type="checkbox" checked={!!vorm.opties[k]} onChange={(e) => setVorm({ ...vorm, opties: { ...vorm.opties, [k]: e.target.checked } })} />{t}</label>
                  ))}
                </div>
                <div className="fm-kop"><b className="fm-stap">5</b>Hoe lang en in welke taal</div>
                <div className="fm-raster2">
                  <label className="fm-veld">Geldig tot (leeg = geen einde)<input type="date" value={vorm.geldig_tot} onChange={(e) => setVorm({ ...vorm, geldig_tot: e.target.value })} /></label>
                  <label className="fm-veld">Taal
                    <select value={vorm.opties.taal || 'nl'} onChange={(e) => setVorm({ ...vorm, opties: { ...vorm.opties, taal: e.target.value } })}>
                      <option value="nl">Nederlands</option><option value="fr">Frans</option><option value="en">Engels</option>
                    </select>
                  </label>
                </div>
                <div className="fm-deel-bewaar">
                  <span className={`fm-sub${fout ? ' fout' : ''}`} style={{ flex: 1, minWidth: 0 }}>
                    {bewaren ? 'Bezig met bewaren…' : fout || (bezig === 'nieuw' ? 'Nog niet gemaakt' : gewijzigd ? 'Niet bewaarde wijzigingen' : bewaardOp ? `Bewaard om ${bewaardOp.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}` : 'Alles bewaard')}
                  </span>
                  {!vorm.live && huidig && <button className="fm-knop" disabled={bewaren} title="De ontvanger ziet vanaf nu de huidige stand van het plan" onClick={() => bewaar(true)}>Huidige stand publiceren</button>}
                  <button className="fm-knop rood" disabled={bewaren || (bezig !== 'nieuw' && !gewijzigd)} onClick={() => bewaar(false)}>{bewaren ? 'Bewaren…' : bezig === 'nieuw' ? 'Link maken' : 'Wijzigingen bewaren'}</button>
                </div>
              </>
            )}
          </div>
          {bezig && huidig && <aside className="fm-deel-rechts">
                {huidig && (
                  <div className="fm-deel-link">
                    <div className="fm-kop">De link</div>
                    {qr && <img src={qr} alt="QR-code van de link" width={140} height={140} />}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                      <div style={{ display: 'flex', border: '1px solid #DADDE3' }}>
                        <span style={{ flex: 1, padding: '8px 10px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url(huidig.token)}</span>
                        <button className="fm-knop rood" style={{ border: 0 }} onClick={kopieer}>{gekopieerd ? 'Gekopieerd' : 'Kopiëren'}</button>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <a className="fm-knop klein" href={url(huidig.token)} target="_blank" rel="noreferrer">Openen</a>
                        <button className="fm-knop klein" onClick={() => toonTekst('Plak deze code in een webpagina om de kaart te tonen.', `<iframe src="${url(huidig.token)}" width="100%" height="600" style="border:0" loading="lazy"></iframe>`, 'Inbedcode')}>Inbedcode</button>
                        {!huidig.ingetrokken_op && <button className="fm-knop klein gevaar" onClick={intrekken}>Intrekken</button>}
                      </div>
                      <div className="fm-sub">Ingetrokken of verlopen links tonen niets meer.</div>
                    </div>
                  </div>
                )}
          </aside>}
          </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(scherm, document.body) : scherm;
}

// Fijner kiezen: per soort element, per eigen tekening en per los item.
function FijnKiezen({ vorm, setVorm, plan, items, elementenMap, lagen }) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const o = vorm.opties;
  const vEl = o.verberg_elementen || [];
  const vSo = o.verberg_soorten || [];
  const vIt = o.verberg_items || [];
  const planVerborgen = new Set(plan.instellingen?.verborgen_elementen || []);
  const lagenMap = new Map(lagen.map((l) => [l.id, l]));
  const zet = (k, lijst) => setVorm({ ...vorm, opties: { ...o, [k]: lijst.length ? lijst : undefined } });
  const wissel = (lijst, id, aan) => (aan ? [...new Set([...lijst, id])] : lijst.filter((x) => x !== id));

  // Kandidaten: wat de ontvanger met de huidige lagen, fasen en leverancier zou zien.
  const kandidaten = useMemo(() => items.filter((i) => {
    if (i.verborgen || !vorm.laag_ids.includes(i.laag_id)) return false;
    if (vorm.fase_ids.length && i.fase_ids?.length && !i.fase_ids.some((f) => vorm.fase_ids.includes(f))) return false;
    if (o.leverancier && (!i.element_id || herkomstVan(i, elementenMap.get(i.element_id), plan?.instellingen?.leveranciers) !== o.leverancier)) return false;
    return true;
  }), [items, vorm.laag_ids, vorm.fase_ids, o.leverancier, elementenMap]);

  const { categorieen, soorten } = useMemo(() => {
    const cat = new Map(); const so = new Map();
    for (const i of kandidaten) {
      const el = i.element_id && elementenMap.get(i.element_id);
      if (el) {
        const c = el.categorie || 'Overig';
        if (!cat.has(c)) cat.set(c, new Map());
        const m = cat.get(c); m.set(el.id, { el, n: (m.get(el.id)?.n || 0) + 1 });
      } else if (!i.element_id) so.set(i.soort, (so.get(i.soort) || 0) + 1);
    }
    return { categorieen: [...cat.entries()].sort((a, b) => vergelijkCategorie(a[0], b[0])), soorten: [...so.entries()] };
  }, [kandidaten, elementenMap]);

  const zichtbaar = (i) => !vIt.includes(i.id) && (i.element_id ? !vEl.includes(i.element_id) && !planVerborgen.has(i.element_id) : !vSo.includes(i.soort));
  const aantal = kandidaten.filter(zichtbaar).length;
  const verborgenTelling = vEl.length + vSo.length + vIt.length;
  const naamVan = (i) => i.naam || elementenMap.get(i.element_id)?.naam || (SOORT1[i.soort] || i.soort);
  const q = zoek.trim().toLowerCase();
  const losse = kandidaten.filter((i) => (i.element_id ? !vEl.includes(i.element_id) && !planVerborgen.has(i.element_id) : !vSo.includes(i.soort)))
    .filter((i) => !q || naamVan(i).toLowerCase().includes(q) || (lagenMap.get(i.laag_id)?.naam || '').toLowerCase().includes(q));

  return (
    <div className="fm-fijn">
      <button type="button" className="fm-fijn-kop" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        <span className="fm-kop">Wat precies</span>
        <span className="fm-sub">{verborgenTelling ? `ontvanger ziet ${aantal} van ${kandidaten.length} items` : `alles in de gekozen lagen (${kandidaten.length} items)`}</span>
        <span aria-hidden style={{ marginLeft: 'auto' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="fm-fijn-inhoud">
          {categorieen.length > 0 && <div className="fm-sub">Vink uit wat de ontvanger niet mag zien.</div>}
          {categorieen.map(([c, m]) => {
            const ids = [...m.keys()].filter((id) => !planVerborgen.has(id));
            const aan = ids.filter((id) => !vEl.includes(id)).length;
            return (
              <div key={c} className="fm-fijn-groep">
                <label className="fm-vink fm-fijn-cat">
                  <input type="checkbox" checked={aan === ids.length && ids.length > 0} disabled={!ids.length}
                    ref={(r) => { if (r) r.indeterminate = aan > 0 && aan < ids.length; }}
                    onChange={(e) => zet('verberg_elementen', e.target.checked ? vEl.filter((x) => !ids.includes(x)) : [...new Set([...vEl, ...ids])])} />
                  <strong>{c}</strong>
                </label>
                <div className="fm-fijn-rij">
                  {[...m.values()].sort((a, b) => a.el.naam.localeCompare(b.el.naam)).map(({ el, n }) => {
                    const pv = planVerborgen.has(el.id);
                    const aanEl = !pv && !vEl.includes(el.id);
                    return (
                      <label key={el.id} className="fm-vink" title={pv ? 'Verborgen in het plan (Lagen > Tonen per soort element)' : ''} style={pv ? { opacity: 0.5 } : null}>
                        <input type="checkbox" checked={aanEl} disabled={pv} onChange={() => zet('verberg_elementen', wissel(vEl, el.id, aanEl))} />
                        <span className="fm-fijn-naam">{el.naam}</span><span className="fm-sub">{pv ? 'verborgen in plan' : n}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {soorten.length > 0 && (
            <div className="fm-fijn-groep">
              <div className="fm-fijn-cat"><strong>Eigen tekeningen</strong></div>
              <div className="fm-fijn-rij">
                {soorten.map(([so, n]) => {
                  const aanSo = !vSo.includes(so);
                  return (
                    <label key={so} className="fm-vink">
                      <input type="checkbox" checked={aanSo} onChange={() => zet('verberg_soorten', wissel(vSo, so, aanSo))} />
                      <span className="fm-fijn-naam">{SOORT[so] || so}</span><span className="fm-sub">{n}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {kandidaten.length > 0 && (
            <div className="fm-fijn-groep">
              <div className="fm-fijn-cat" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Losse items</strong>
                {vIt.length > 0 && <span className="fm-tag">{vIt.length} verborgen</span>}
              </div>
              <input className="fm-fijn-zoek" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek op naam of laag" aria-label="Zoek items" />
              <div className="fm-fijn-lijst">
                {losse.slice(0, 300).map((i) => {
                  const aanIt = !vIt.includes(i.id);
                  const l = lagenMap.get(i.laag_id);
                  return (
                    <label key={i.id} className="fm-vink">
                      <input type="checkbox" checked={aanIt} onChange={() => zet('verberg_items', wissel(vIt, i.id, aanIt))} />
                      <span style={{ width: 8, height: 8, background: l?.kleur || '#999', flex: '0 0 8px' }} />
                      <span className="fm-fijn-naam">{naamVan(i)}</span><span className="fm-sub">{l?.naam}</span>
                    </label>
                  );
                })}
                {!losse.length && <div className="fm-sub">Niets gevonden.</div>}
                {losse.length > 300 && <div className="fm-sub">Eerste 300 getoond, zoek om te verfijnen.</div>}
              </div>
            </div>
          )}
          {verborgenTelling > 0 && (
            <button type="button" className="fm-knop klein" style={{ alignSelf: 'flex-start' }}
              onClick={() => setVorm({ ...vorm, opties: { ...o, verberg_elementen: undefined, verberg_soorten: undefined, verberg_items: undefined } })}>Alles weer tonen</button>
          )}
          <div className="fm-sub">Wat in het plan verborgen staat (per item of per soort) wordt nooit gedeeld.</div>
        </div>
      )}
    </div>
  );
}
