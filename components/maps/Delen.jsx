'use client';

// Delen en exporteren op één scherm. Links de ontvangers (tentenbouwer, politie, stad), in het midden wat
// een ontvanger krijgt (plannen met eigen lagen en kader, 3D, binnenplannen, plannen per werkplek), rechts
// de deellink en de PDF die daaruit volgen. Bovenaan snel exporteren zonder ontvanger.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { heeftModule } from './merk';
import { maps, foutTekst, publiekeUrl } from './db';
import { bevestig, toonTekst } from './dialoog';
import { startExport, EXPORT_KANAAL } from './planLaden';
import { heeft3d } from './drie3d';
import { bestandsnaam } from './uitvoer';
import PdfDialoog from './PdfDialoog';
import { PlanVoorbeeld } from './PlanVoorbeeld';
import {
  nieuwId, soortenVoorPakket, WERKPLEKKEN, SOORT_NAAM, onderdelenVan, linkAan, onderdeelMeta,
  rijMetOnderdelen, pdfVerouderd, pdfOnderdelen, itemsVanOnderdeel,
} from './ontvangers';

const RECHTEN = [
  ['notities', 'Notities, tijden en contact zien'],
  ['opmerkingen', 'Opmerkingen lezen en plaatsen'],
  ['attesten', 'Keuringsattesten zien en openen'],
  ['materialen', 'Materiaallijst zien'],
  ['pdf', 'PDF downloaden en afdrukken'],
];
const datum = (d, uur = false) => new Date(d).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'long', ...(uur ? { hour: '2-digit', minute: '2-digit' } : {}) }).replace(/^./, (c) => c.toUpperCase());

export default function Delen({
  plan, lagen, fasen, items, elementenMap, leveranciers = [], schrijven, eventNaam = '', eventKleur = '#108AED',
  onSluit, onSnel, onPdfBeeld, kaartBeeld = null,
}) {
  const [links, setLinks] = useState(null);
  const [versies, setVersies] = useState({});
  const [kies, setKies] = useState(null);
  const [zoek, setZoek] = useState('');
  const [fout, setFout] = useState('');
  const [nieuw, setNieuw] = useState(false);
  const [bewerk, setBewerk] = useState(null); // { onderdeel } in PdfDialoog
  const [kiezer, setKiezer] = useState(null); // 'drie' | 'binnen' | 'werkplek'
  const [kop, setKop] = useState(false); // naam en contact wijzigen
  const [qr, setQr] = useState('');
  const [gekopieerd, setGekopieerd] = useState(false);
  const [melding, setMelding] = useState('');

  const laad = () => maps().from('deel_links').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) { setFout(foutTekst(error)); setLinks([]); return; }
    setLinks(data || []);
    setKies((k) => k || data?.[0]?.id || null);
  });
  useEffect(() => {
    laad();
    maps().from('versies').select('id, versie, created_at').eq('plan_id', plan.id).then(({ data }) => setVersies(Object.fromEntries((data || []).map((v) => [v.id, v]))));
  }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Een PDF die klaar is (in het andere tabblad) verandert de stand van de ontvanger.
  useEffect(() => {
    let k = null; try { k = new BroadcastChannel(EXPORT_KANAAL); k.onmessage = (e) => { if (e.data?.klaar) setTimeout(laad, 800); }; } catch {}
    return () => k?.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sluitRef = useRef(onSluit); sluitRef.current = onSluit;
  useEffect(() => {
    const t = (e) => { if (e.key === 'Escape' && !bewerk && !document.querySelector('.fm-appdialoog-achter, .fm-dialoog-achter, .fm-uitvoer-achter, .fm-pdfscherm')) sluitRef.current(); };
    window.addEventListener('keydown', t); return () => window.removeEventListener('keydown', t);
  }, [bewerk]);

  const link = links?.find((l) => l.id === kies) || null;
  const onderdelen = link ? onderdelenVan(link) : [];
  const url = (t) => `${window.location.origin}/d/${t}`;
  useEffect(() => {
    setQr(''); setGekopieerd(false); setKop(false); setKiezer(null); setMelding('');
    if (link && linkAan(link)) QRCode.toDataURL(url(link.token), { margin: 1, width: 200, color: { dark: '#022056' } }).then(setQr).catch(() => {});
  }, [link?.id, link?.token, link?.ingetrokken_op]); // eslint-disable-line react-hooks/exhaustive-deps

  const drieLijst = useMemo(() => items.filter((i) => heeft3d(i, elementenMap.get(i.element_id))), [items, elementenMap]);
  const gebouwen = useMemo(() => items.filter((i) => i.velden?.binnenplan && items.some((x) => x.velden?.binnen?.host === i.id)), [items]);
  const naamVan = (it) => it?.naam || elementenMap.get(it?.element_id)?.naam || 'Element';
  const zonderBinnen = useMemo(() => items.filter((i) => !i.velden?.binnen), [items]);

  // ---------- Bewaren ----------
  const bewaar = async (id, patch) => {
    const { data, error } = await maps().from('deel_links').update(patch).eq('id', id).select().single();
    if (error) { setFout(foutTekst(error)); return null; }
    setFout(''); setLinks((ls) => ls.map((x) => (x.id === id ? data : x)));
    return data;
  };
  const zetOnderdelen = (lijst) => link && bewaar(link.id, rijMetOnderdelen(link, lijst, lagen));
  const zetOptie = (k, v) => link && bewaar(link.id, { opties: { ...(link.opties || {}), [k]: v } });
  const publiceer = async (naam) => {
    const { data, error } = await maps().from('versies').insert({ plan_id: plan.id, versie: plan.versie || 1, opmerking: `Gedeeld met ${naam}`, momentopname: { items, lagen, fasen } }).select('id, versie, created_at').single();
    if (error) { setFout(foutTekst(error)); return null; }
    setVersies((v) => ({ ...v, [data.id]: data }));
    return data.id;
  };

  const maak = async (naam, soort) => {
    const s = soortenVoorPakket().find((x) => x.id === soort) || soortenVoorPakket()[0];
    const versie_id = await publiceer(naam); if (!versie_id) return;
    const onderdeel = { id: nieuwId(), soort: 'plan', naam: plan.naam };
    const rij = { plan_id: plan.id, naam, live: false, versie_id, ...rijMetOnderdelen({ opties: { ...s.opties, taal: 'nl', ontvanger: { soort: s.id } } }, [onderdeel], lagen) };
    const { data, error } = await maps().from('deel_links').insert(rij).select().single();
    if (error) { setFout(foutTekst(error)); return; }
    setLinks((ls) => [data, ...ls]); setKies(data.id); setNieuw(false);
  };
  const verwijder = async () => {
    if (!await bevestig(`Ontvanger "${link.naam}" verwijderen? Zijn link werkt daarna niet meer.`, { ok: 'Verwijderen', gevaar: true })) return;
    const { error } = await maps().from('deel_links').delete().eq('id', link.id);
    if (error) { setFout(foutTekst(error)); return; }
    setLinks((ls) => ls.filter((x) => x.id !== link.id)); setKies(null);
  };

  // ---------- PDF ----------
  const maakPdf = () => {
    if (!pdfOnderdelen(onderdelen).length) { setMelding('Voeg eerst een plan of een plan per werkplek toe. 3D en binnenplannen staan enkel in de link.'); return; }
    const ok = startExport(plan.id, { soort: 'ontvanger', linkId: link.id, bestandsnaam: bestandsnaam(plan, link.naam) }, link.naam);
    setMelding(ok ? 'De PDF wordt gemaakt in een eigen tabblad. Je ziet de voortgang rechtsonder en kan intussen verder werken.' : 'Je browser blokkeerde het nieuwe tabblad. Sta pop-ups toe voor deze site en probeer opnieuw.');
  };

  const kopieer = async () => { try { await navigator.clipboard.writeText(url(link.token)); setGekopieerd(true); } catch { await toonTekst('Kopieer de link', url(link.token)); } };

  const zichtbaar = (links || []).filter((l) => !zoek.trim() || `${l.naam} ${l.opties?.ontvanger?.soort || ''}`.toLowerCase().includes(zoek.trim().toLowerCase()));
  const pil = (tekst, soort = '') => <span className={`fm-dl-pil ${soort}`}>{tekst}</span>;
  const lp = link?.opties?.laatste_pdf;
  const vp = link?.opties?.vorige_pdf;

  const scherm = (
    <div className="fm fm-dl" role="dialog" aria-label="Delen en exporteren">
      <header className="fm-dl-kop">
        <button className="fm-dl-terug" aria-label="Terug naar het plan" title="Terug naar het plan (Esc)" onClick={onSluit}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 4L6 9l5 5" stroke="#fff" strokeWidth="2" fill="none" /></svg>
        </button>
        <div className="fm-dl-titel">
          <span className="fm-dl-event"><i style={{ background: eventKleur }} />{[eventNaam, plan.naam, `v${plan.versie}`].filter(Boolean).join(' · ')}</span>
          <h1>Delen en exporteren</h1>
        </div>
        <nav className="fm-dl-snel" aria-label="Snel exporteren">
          <span>Snel exporteren</span>
          <button className="t-knop" onClick={onPdfBeeld}>PDF van het beeld</button>
          <button className="t-knop" onClick={() => onSnel({ tab: 'exporteren', id: heeftModule('stroom') ? 'stroomplan' : heeftModule('veiligheid') ? 'veiligheidsplan' : 'materiaal' })}>Plannen per werkplek</button>
          <button className="t-knop" onClick={() => onSnel({ tab: 'exporteren', id: 'materiaal' })}>Lijsten</button>
          <button className="t-knop" onClick={() => onSnel({ tab: 'exporteren', id: 'kaartbestand' })}>Kaartbestand</button>
          {schrijven && <button className="t-knop stil" onClick={() => onSnel({ tab: 'importeren' })}>Importeren</button>}
        </nav>
      </header>

      <div className="fm-dl-romp">
        <nav className="fm-dl-lijst" aria-label="Ontvangers">
          <div className="fm-dl-lijstkop">
            <h2>Ontvangers</h2>
            {schrijven && <button className="t-knop hoofd klein" onClick={() => setNieuw(true)}>Nieuwe ontvanger</button>}
          </div>
          {(links?.length || 0) > 5 && <input className="t-veld fm-dl-zoek" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een ontvanger" aria-label="Zoek een ontvanger" />}
          {links === null && <p className="fm-sub" style={{ padding: '4px 8px' }}>Laden…</p>}
          {zichtbaar.map((l) => {
            const p = l.opties?.laatste_pdf;
            return (
              <button key={l.id} className={`fm-dl-ontv${l.id === kies ? ' aan' : ''}`} aria-current={l.id === kies ? 'true' : undefined} onClick={() => { setKies(l.id); setNieuw(false); }}>
                <span className="fm-dl-ontvkop"><b>{l.naam}</b><small>{l.opties?.ontvanger?.soort || 'Deellink'}</small></span>
                <span className="fm-dl-pillen">
                  {linkAan(l) ? pil(`Link · ${l.keer_geopend || 0}×`, 'ok') : pil('Link uit')}
                  {p ? pil(`PDF v${p.versie}`, pdfVerouderd(l, plan) ? 'oud' : 'ok') : null}
                </span>
              </button>
            );
          })}
          {links && !links.length && !nieuw && <p className="fm-dl-leeg">Nog niemand. Maak een ontvanger voor wie iets van dit plan krijgt, bv. de tentenbouwer of de politie.</p>}
        </nav>

        <main className="fm-dl-werk">
          {fout && <p className="t-melding fout">{fout}</p>}
          {nieuw && <NieuweOntvanger onMaak={maak} onAnnuleer={() => setNieuw(false)} />}
          {!nieuw && !link && links && (
            <div className="fm-dl-uitleg">
              <h2>Eén keer vastleggen wat iemand krijgt</h2>
              <p>Een ontvanger krijgt een of meer plannen met eigen lagen en kader, 3D-structuren, binnenplannen of plannen per werkplek. Daaruit volgen een deellink en een PDF. Je ziet meteen of die nog bij de laatste versie van het plan horen.</p>
              {schrijven && <button className="t-knop hoofd" onClick={() => setNieuw(true)}>Nieuwe ontvanger</button>}
            </div>
          )}
          {!nieuw && link && (
            <>
              <div className="fm-dl-ontvkop2">
                <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                  <p className="fm-dl-meta">{[link.opties?.ontvanger?.soort || 'Deellink', link.opties?.ontvanger?.contact].filter(Boolean).join(' · ')}</p>
                  <h2>{link.naam}</h2>
                </div>
                {schrijven && <button className="t-knop" onClick={() => setKop((x) => !x)} aria-expanded={kop}>Naam en contact</button>}
                {schrijven && <button className="t-knop stil gevaar" onClick={verwijder}>Verwijderen</button>}
              </div>
              {kop && <KopVorm link={link} onBewaar={async (p) => { if (await bewaar(link.id, p)) setKop(false); }} />}

              <div className="fm-dl-raster">
                <div className="fm-dl-kolom">
                  <section className="fm-dl-kaart" aria-labelledby="dl-inhoud">
                    <div className="fm-dl-kaartkop"><h3 id="dl-inhoud">Wat krijgt {link.opties?.ontvanger?.soort === 'Team' ? 'het team' : 'hij'}</h3><span>{onderdelen.length} {onderdelen.length === 1 ? 'onderdeel' : 'onderdelen'}</span></div>
                    {onderdelen.map((d, i) => {
                      const it = d.item ? items.find((x) => x.id === d.item) : null;
                      const wp = d.soort === 'werkplek' ? WERKPLEKKEN.find((w) => w.id === d.werkplek) : null;
                      const weg = (d.soort === 'drie' || d.soort === 'binnen') && !it;
                      return (
                        <div key={d.id} className="fm-dl-deel">
                          <div className={`fm-dl-beeld ${d.soort}`}>
                            {d.soort === 'plan' ? <PlanVoorbeeld items={itemsVanOnderdeel(d, zonderBinnen, lagen)} kleur={eventKleur} hoogte={252} label={`Voorbeeld van ${d.naam}`} /> : <span>{SOORT_NAAM[d.soort]}</span>}
                          </div>
                          <div className="fm-dl-deeltekst">
                            <small>{SOORT_NAAM[d.soort]}</small>
                            <b>{d.soort === 'plan' ? d.naam || 'Plan' : d.soort === 'werkplek' ? wp?.naam || d.naam : naamVan(it) || d.naam}</b>
                            <span>{weg ? 'Dit element bestaat niet meer in het plan.' : onderdeelMeta(d, { lagen, fasen })}</span>
                          </div>
                          {schrijven && (
                            <div className="fm-dl-deelknoppen">
                              {d.soort === 'plan' && <button className="t-knop klein" onClick={() => setBewerk({ onderdeel: d })}>Wijzigen</button>}
                              {i > 0 && <button className="t-knop klein stil" title="Hoger zetten" aria-label="Hoger zetten" onClick={() => { const l = [...onderdelen]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; zetOnderdelen(l); }}>↑</button>}
                              <button className="t-knop klein stil" title="Weghalen" aria-label={`${d.naam || SOORT_NAAM[d.soort]} weghalen`} onClick={() => zetOnderdelen(onderdelen.filter((x) => x.id !== d.id))}>×</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!onderdelen.length && <p className="fm-sub">Nog niets. Voeg een plan, 3D of binnenplan toe.</p>}
                    {schrijven && (
                      <div className="fm-dl-toevoegen">
                        <button className="fm-dl-plus" onClick={() => setBewerk({ onderdeel: { id: nieuwId(), soort: 'plan', naam: '' }, nieuw: true })}>+ Plan</button>
                        {drieLijst.length > 0 && <button className="fm-dl-plus" aria-expanded={kiezer === 'drie'} onClick={() => setKiezer((k) => (k === 'drie' ? null : 'drie'))}>+ 3D</button>}
                        {heeftModule('binnen') && gebouwen.length > 0 && <button className="fm-dl-plus" aria-expanded={kiezer === 'binnen'} onClick={() => setKiezer((k) => (k === 'binnen' ? null : 'binnen'))}>+ Binnenplan</button>}
                        {WERKPLEKKEN.some((w) => heeftModule(w.module)) && <button className="fm-dl-plus" aria-expanded={kiezer === 'werkplek'} onClick={() => setKiezer((k) => (k === 'werkplek' ? null : 'werkplek'))}>+ Plan per werkplek</button>}
                      </div>
                    )}
                    {kiezer && (
                      <div className="fm-dl-kiezer" role="listbox" aria-label="Kies wat je toevoegt">
                        {kiezer === 'drie' && drieLijst.map((x) => {
                          const host = x.velden?.binnen?.host ? items.find((y) => y.id === x.velden.binnen.host) : null;
                          const al = onderdelen.some((d) => d.item === x.id);
                          return <button key={x.id} disabled={al} onClick={() => { zetOnderdelen([...onderdelen, { id: nieuwId(), soort: 'drie', naam: naamVan(x), item: x.id }]); setKiezer(null); }}>{naamVan(x)}{host ? <small> · In {naamVan(host)}</small> : null}{al ? <small> · Al toegevoegd</small> : null}</button>;
                        })}
                        {kiezer === 'binnen' && gebouwen.map((x) => {
                          const al = onderdelen.some((d) => d.item === x.id);
                          return <button key={x.id} disabled={al} onClick={() => { zetOnderdelen([...onderdelen, { id: nieuwId(), soort: 'binnen', naam: naamVan(x), item: x.id }]); setKiezer(null); }}>{naamVan(x)}{al ? <small> · Al toegevoegd</small> : null}</button>;
                        })}
                        {kiezer === 'werkplek' && WERKPLEKKEN.filter((w) => heeftModule(w.module)).map((w) => {
                          const al = onderdelen.some((d) => d.werkplek === w.id);
                          return <button key={w.id} disabled={al} onClick={() => { zetOnderdelen([...onderdelen, { id: nieuwId(), soort: 'werkplek', naam: w.naam, werkplek: w.id }]); setKiezer(null); }}>{w.naam}{al ? <small> · Al toegevoegd</small> : null}</button>;
                        })}
                      </div>
                    )}
                  </section>

                  <section className="fm-dl-kaart" aria-labelledby="dl-mag">
                    <div className="fm-dl-kaartkop"><h3 id="dl-mag">Wat mag hij in de link</h3></div>
                    <div className="fm-dl-rechten">
                      {RECHTEN.map(([k, t]) => (
                        <label key={k} className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={link.opties?.[k] !== false && (k === 'pdf' || !!link.opties?.[k])} onChange={(e) => zetOptie(k, e.target.checked)} />{t}</label>
                      ))}
                      {heeftModule('stroom') && <label className="fm-vink"><input type="checkbox" disabled={!schrijven} checked={!!link.opties?.stroom} onChange={(e) => zetOptie('stroom', e.target.checked)} />Stroompunten en aansluitschema</label>}
                    </div>
                    <div className="fm-dl-velden">
                      <label><span className="t-label">Taal</span>
                        <select className="t-veld" disabled={!schrijven} value={link.opties?.taal || 'nl'} onChange={(e) => zetOptie('taal', e.target.value)}><option value="nl">Nederlands</option><option value="fr">Frans</option><option value="en">Engels</option></select>
                      </label>
                      <label><span className="t-label">Geldig tot</span>
                        <input className="t-veld" type="date" disabled={!schrijven} value={link.geldig_tot ? link.geldig_tot.slice(0, 10) : ''} onChange={(e) => bewaar(link.id, { geldig_tot: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null })} />
                      </label>
                      {heeftModule('leveranciers') && leveranciers.length > 0 && (
                        <label><span className="t-label">Enkel het materiaal van</span>
                          <select className="t-veld" disabled={!schrijven} value={link.opties?.leverancier || ''} onChange={(e) => zetOptie('leverancier', e.target.value || null)}>
                            <option value="">Alles in de gekozen lagen</option>
                            {leveranciers.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  </section>
                </div>

                <div className="fm-dl-kolom">
                  <section className="fm-dl-kaart" aria-labelledby="dl-link">
                    <div className="fm-dl-kaartkop"><h3 id="dl-link">Deellink</h3>{linkAan(link) ? pil(link.live ? 'Live' : 'Vaste versie', 'ok') : pil(link.ingetrokken_op ? 'Uit' : 'Verlopen')}</div>
                    {linkAan(link) ? (
                      <>
                        <div className="fm-dl-link">
                          {qr ? <img src={qr} alt="QR-code van de link" width={88} height={88} /> : <span className="fm-dl-qrleeg" />}
                          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="fm-dl-url">{url(link.token).replace(/^https?:\/\//, '')}</span>
                            <div className="t-rij" style={{ gap: 8, flexWrap: 'wrap' }}>
                              <button className="t-knop hoofd klein" onClick={kopieer}>{gekopieerd ? 'Gekopieerd' : 'Link kopiëren'}</button>
                              <a className="t-knop klein" href={`mailto:?subject=${encodeURIComponent(`${plan.naam}: plan voor ${link.naam}`)}&body=${encodeURIComponent(url(link.token))}`}>Mailen</a>
                              <a className="t-knop klein stil" href={url(link.token)} target="_blank" rel="noreferrer">Openen</a>
                            </div>
                          </div>
                        </div>
                        <dl className="fm-dl-feiten">
                          <dt>Geopend</dt><dd>{link.keer_geopend ? `${link.keer_geopend} keer` : 'Nog niet'}</dd>
                          <dt>Stand</dt><dd>{link.live ? 'Live: elke wijziging meteen zichtbaar' : link.versie_id && versies[link.versie_id] ? `Vaste versie van ${datum(versies[link.versie_id].created_at, true)}` : 'Vaste versie'}</dd>
                          <dt>Geldig</dt><dd>{link.geldig_tot ? `Tot ${datum(link.geldig_tot)}` : 'Zonder einddatum'}</dd>
                        </dl>
                        {schrijven && (
                          <div className="t-rij" style={{ gap: 8, flexWrap: 'wrap' }}>
                            {!link.live && <button className="t-knop klein" title="De ontvanger ziet vanaf nu de huidige stand" onClick={async () => { const id = await publiceer(link.naam); if (id) bewaar(link.id, { versie_id: id }); }}>Huidige stand publiceren</button>}
                            <button className="t-knop klein stil" onClick={() => bewaar(link.id, link.live ? { live: false } : { live: true })}>{link.live ? 'Vaste versie' : 'Live maken'}</button>
                            <button className="t-knop klein stil" onClick={() => toonTekst('Plak deze code in een webpagina om de kaart te tonen.', `<iframe src="${url(link.token)}" width="100%" height="600" style="border:0" loading="lazy"></iframe>`, 'Inbedcode')}>Inbedcode</button>
                            <button className="t-knop klein stil gevaar" onClick={async () => { if (await bevestig('De link uitzetten? Wie hem heeft, ziet daarna niets meer. Je kan hem later weer aanzetten.', { ok: 'Uitzetten', gevaar: true })) bewaar(link.id, { ingetrokken_op: new Date().toISOString() }); }}>Uitzetten</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="fm-dl-tekst">{link.ingetrokken_op ? 'Deze ontvanger krijgt geen link, enkel een PDF.' : `De link verliep op ${datum(link.geldig_tot)}.`}</p>
                        {schrijven && <button className="t-knop klein" style={{ alignSelf: 'flex-start' }} onClick={async () => {
                          const p = { ingetrokken_op: null }; if (link.geldig_tot && new Date(link.geldig_tot) < new Date()) p.geldig_tot = null;
                          if (!link.live && !link.versie_id) { const id = await publiceer(link.naam); if (!id) return; p.versie_id = id; }
                          bewaar(link.id, p);
                        }}>Link aanzetten</button>}
                      </>
                    )}
                  </section>

                  <section className="fm-dl-kaart" aria-labelledby="dl-pdf">
                    <div className="fm-dl-kaartkop"><h3 id="dl-pdf">PDF</h3>{lp ? (pdfVerouderd(link, plan) ? pil('Verouderd', 'oud') : pil('Bij de laatste versie', 'ok')) : null}</div>
                    {lp
                      ? <p className="fm-dl-tekst">Laatst gemaakt op {datum(lp.op, true)}, bij versie {lp.versie}.{pdfVerouderd(link, plan) ? ` Het plan staat nu op versie ${plan.versie}.` : ''}</p>
                      : <p className="fm-dl-tekst">Nog geen PDF gemaakt voor deze ontvanger.</p>}
                    <p className="fm-sub">{(() => {
                      const p = onderdelen.filter((d) => d.soort === 'plan').length; const w = onderdelen.filter((d) => d.soort === 'werkplek').length; const rest = onderdelen.length - p - w;
                      return [p ? `${p} ${p === 1 ? 'plan' : 'plannen'} in één PDF` : null, w ? `${w} ${w === 1 ? 'werkplek als eigen PDF' : 'werkplekken als eigen PDF'}` : null, rest ? `${rest} enkel in de link (3D of binnenplan)` : null].filter(Boolean).join(' · ') || 'Niets om af te drukken.';
                    })()}</p>
                    <div className="t-rij" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button className="t-knop hoofd" onClick={maakPdf}>{lp ? 'PDF opnieuw maken' : 'PDF maken'}</button>
                      {lp?.pad && <a className="t-knop" href={publiekeUrl(lp.pad)} target="_blank" rel="noreferrer">Laatste PDF (v{lp.versie})</a>}
                      {vp?.pad && <a className="t-knop stil" href={publiekeUrl(vp.pad)} target="_blank" rel="noreferrer">Vorige (v{vp.versie})</a>}
                    </div>
                    {melding && <p className="t-melding" style={{ margin: 0 }}>{melding}</p>}
                  </section>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {bewerk && (
        <PdfDialoog plan={plan} lagen={lagen} fasen={fasen} items={zonderBinnen} elementenMap={elementenMap} actieveFase={null}
          kaart={null} onSluit={() => setBewerk(null)}
          onderdeel={{
            ontvanger: link?.naam || '', waarde: bewerk.onderdeel, leverancier: link?.opties?.leverancier || null,
            onBewaar: (d) => zetOnderdelen(bewerk.nieuw ? [...onderdelen, d] : onderdelen.map((x) => (x.id === d.id ? d : x))),
          }} />
      )}
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(scherm, document.body) : scherm;
}

function NieuweOntvanger({ onMaak, onAnnuleer }) {
  const soorten = soortenVoorPakket();
  const [naam, setNaam] = useState('');
  const [soort, setSoort] = useState(soorten[0].id);
  const [bezig, setBezig] = useState(false);
  const s = soorten.find((x) => x.id === soort);
  return (
    <form className="fm-dl-kaart fm-dl-nieuw" onSubmit={async (e) => { e.preventDefault(); if (!naam.trim() || bezig) return; setBezig(true); await onMaak(naam.trim(), soort); setBezig(false); }}>
      <h2>Nieuwe ontvanger</h2>
      <label><span className="t-label">Naam</span><input className="t-veld" autoFocus value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. Tentenbouwer, Politie, Stad" /></label>
      <div>
        <span className="t-label">Wie is het</span>
        <div className="fm-dl-soorten">
          {soorten.map((x) => <button type="button" key={x.id} aria-pressed={soort === x.id} className={soort === x.id ? 'aan' : ''} onClick={() => setSoort(x.id)}>{x.id}</button>)}
        </div>
        <p className="fm-sub" style={{ margin: '6px 0 0' }}>{s?.uitleg}. Achteraf aan te passen.</p>
      </div>
      <p className="fm-sub" style={{ margin: 0 }}>Hij krijgt eerst het hele plan. Daarna kies je de lagen, het kader en wat er nog bij moet.</p>
      <div className="t-rij" style={{ gap: 8 }}>
        <button type="button" className="t-knop" onClick={onAnnuleer}>Annuleren</button>
        <button type="submit" className="t-knop hoofd" disabled={!naam.trim() || bezig}>{bezig ? 'Bezig…' : 'Ontvanger maken'}</button>
      </div>
    </form>
  );
}

function KopVorm({ link, onBewaar }) {
  const [naam, setNaam] = useState(link.naam);
  const [soort, setSoort] = useState(link.opties?.ontvanger?.soort || '');
  const [contact, setContact] = useState(link.opties?.ontvanger?.contact || '');
  return (
    <form className="fm-dl-kaart fm-dl-kopvorm" onSubmit={(e) => { e.preventDefault(); if (!naam.trim()) return; onBewaar({ naam: naam.trim(), opties: { ...(link.opties || {}), ontvanger: { ...(link.opties?.ontvanger || {}), soort: soort.trim() || null, contact: contact.trim() || null } } }); }}>
      <label><span className="t-label">Naam</span><input className="t-veld" value={naam} onChange={(e) => setNaam(e.target.value)} /></label>
      <label><span className="t-label">Soort</span><input className="t-veld" list="dl-soorten" value={soort} onChange={(e) => setSoort(e.target.value)} placeholder="bv. Leverancier" /></label>
      <datalist id="dl-soorten">{soortenVoorPakket().map((s) => <option key={s.id} value={s.id} />)}</datalist>
      <label><span className="t-label">Contact</span><input className="t-veld" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Naam, telefoon of e-mail" /></label>
      <button type="submit" className="t-knop hoofd" style={{ alignSelf: 'end' }}>Bewaren</button>
    </form>
  );
}
