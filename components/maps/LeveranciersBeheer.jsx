'use client';

// Leverancierslijst: wie levert wat (categorieën uit dezelfde lijst als de bibliotheek), regio, contact en projecten.
// Bibliotheek en plannen verwijzen op naam; hernoemen past alles mee aan (maps.leverancier_hernoem).
import { useEffect, useMemo, useRef, useState } from 'react';
import { maps, foutTekst, wieBenIk, magSchrijven } from './db';
import { CATEGORIEEN } from './categorieen';
import { laadLeveranciers } from './leveranciers';
import { AppDialogen, bevestig } from './dialoog';
import './maps.css';

const REGIOS = ['O-VL', 'W-VL', 'ANT', 'VB', 'LIM'];
const SOORTEN = [['extern', 'Leverancier'], ['eigen', 'Eigen materiaal'], ['stad', 'Stad of gemeente']];
const LEEG = { naam: '', soort: 'extern', categorieen: [], regios: [], gemeente: '', contactpersoon: '', email: '', email2: '', telefoon: '', projecten: '', opmerkingen: '', actief: true };

export default function LeveranciersBeheer() {
  const [lijst, setLijst] = useState(null);
  const [gebruik, setGebruik] = useState(new Map());
  const [ik, setIk] = useState(null);
  const [fout, setFout] = useState(''); const [melding, setMelding] = useState('');
  const [zoek, setZoek] = useState(''); const [cat, setCat] = useState(''); const [regio, setRegio] = useState(''); const [ookInactief, setOokInactief] = useState(false);
  const [gekozen, setGekozen] = useState(null); const [vorm, setVorm] = useState(null);
  const schrijven = magSchrijven(ik);

  const laad = async () => {
    const [w, l, b] = await Promise.all([wieBenIk(), maps().from('leveranciers').select('*').order('naam'), maps().from('bibliotheek').select('leverancier').eq('actief', true).is('plan_id', null)]);
    setIk(w);
    if (l.error) { setFout(foutTekst(l.error)); setLijst([]); return; }
    setLijst(l.data || []);
    const g = new Map(); for (const r of b.data || []) if (r.leverancier) g.set(r.leverancier, (g.get(r.leverancier) || 0) + 1); setGebruik(g);
  };
  useEffect(() => { laad(); }, []);

  const zichtbaar = useMemo(() => (lijst || []).filter((l) => (ookInactief || l.actief !== false)
    && (!cat || (l.categorieen || []).includes(cat)) && (!regio || (l.regios || []).includes(regio))
    && (!zoek || [l.naam, l.gemeente, l.contactpersoon, l.email, l.projecten, l.opmerkingen, ...(l.categorieen || [])].join(' ').toLowerCase().includes(zoek.toLowerCase()))), [lijst, cat, regio, zoek, ookInactief]);
  const catTelling = useMemo(() => { const m = new Map(); for (const l of lijst || []) for (const c of l.categorieen || []) m.set(c, (m.get(c) || 0) + 1); return m; }, [lijst]);

  // Bestaande leverancier: alles bewaart vanzelf (even na het typen); de naam bij het verlaten van het veld, want
  // hernoemen past ook de bibliotheek en de plannen aan. Nieuwe leverancier: knop Toevoegen.
  const [status, setStatus] = useState(''); // '' | 'wacht' | 'bezig' | 'ok' | 'fout'
  const vuil = useRef(false); const timer = useRef(null);
  const kies = async (l) => { await bewaarNu(); setGekozen(l ? l.id : 'nieuw'); setVorm(l ? { ...LEEG, ...l } : { ...LEEG }); setFout(''); setMelding(''); setStatus(''); };
  const zet = (patch) => { if (!('naam' in patch)) vuil.current = true; setVorm((v) => ({ ...v, ...patch })); };
  const wissel = (k, w) => { vuil.current = true; setVorm((v) => ({ ...v, [k]: v[k].includes(w) ? v[k].filter((x) => x !== w) : [...v[k], w] })); };
  const velden = (v) => { const rij = { soort: v.soort, categorieen: v.categorieen, regios: v.regios, actief: v.actief !== false }; for (const k of ['gemeente', 'contactpersoon', 'email', 'email2', 'telefoon', 'projecten', 'opmerkingen']) rij[k] = String(v[k] || '').trim() || null; return rij; };
  const vormRef = useRef(vorm); vormRef.current = vorm;
  const bewaarNu = async () => {
    clearTimeout(timer.current);
    const v = vormRef.current; if (!vuil.current || !v?.id || gekozen === 'nieuw') return;
    vuil.current = false; setStatus('bezig');
    const r = await maps().from('leveranciers').update(velden(v)).eq('id', v.id).select().single();
    if (r.error) { setStatus('fout'); setFout(foutTekst(r.error)); vuil.current = true; return; }
    setStatus('ok'); setLijst((l) => (l || []).map((x) => (x.id === r.data.id ? r.data : x))); laadLeveranciers(true);
  };
  useEffect(() => {
    if (!vuil.current || !vorm?.id || gekozen === 'nieuw') return undefined;
    setStatus('wacht'); clearTimeout(timer.current); timer.current = setTimeout(bewaarNu, 700);
    return () => clearTimeout(timer.current);
  }, [vorm]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wegklikken of de pagina sluiten: eerst bewaren.
  useEffect(() => { const f = (e) => { if (vuil.current) { bewaarNu(); e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hernoem = async () => {
    const oud = lijst.find((l) => l.id === gekozen); const naam = vorm.naam.trim();
    if (!oud || gekozen === 'nieuw' || naam === oud.naam) return;
    if (!naam) { zet({ naam: oud.naam }); return; }
    setFout(''); setStatus('bezig');
    const h = await maps().rpc('leverancier_hernoem', { p_oud: oud.naam, p_nieuw: naam });
    if (h.error) { setStatus('fout'); setFout(h.error.code === '23505' ? `Er bestaat al een leverancier "${naam}".` : foutTekst(h.error)); return; }
    setStatus('ok'); setMelding(`Hernoemd: ${h.data || 0} elementen en items gaan mee.`); await laad(); laadLeveranciers(true);
  };

  const opslaan = async () => {
    setFout(''); setMelding('');
    const naam = vorm.naam.trim(); if (!naam) { setFout('Geef de leverancier een naam.'); return; }
    const r = await maps().from('leveranciers').insert({ naam, ...velden(vorm) }).select().single();
    if (r.error) { setFout(r.error.code === '23505' ? `Er bestaat al een leverancier "${naam}".` : foutTekst(r.error)); return; }
    setGekozen(r.data.id); setVorm({ ...LEEG, ...r.data }); setMelding('Leverancier toegevoegd. Wat je nu nog aanpast, bewaart vanzelf.');
    await laad(); laadLeveranciers(true);
  };
  const wissen = async () => {
    const l = lijst.find((x) => x.id === gekozen); if (!l) return;
    const n = gebruik.get(l.naam) || 0;
    if (n) { setFout(`${l.naam} levert nog ${n} elementen in de bibliotheek. Zet de leverancier op "niet actief" in plaats van te wissen.`); return; }
    if (!await bevestig(`Leverancier "${l.naam}" wissen?`)) return;
    const r = await maps().from('leveranciers').delete().eq('id', l.id);
    if (r.error) { setFout(foutTekst(r.error)); return; }
    setGekozen(null); setVorm(null); await laad(); laadLeveranciers(true);
  };

  return (
    <div className="fm fm-levb">
      <AppDialogen />
      <header className="fm-levb-kop">
        <div style={{ flex: '1 1 280px' }}>
          <h1 className="t-titel">Leveranciers</h1>
          <p className="fm-sub">Wie levert wat, waar en met wie je contact hebt. Dezelfde categorieën als de bibliotheek. <a href="/maps/bibliotheek">Naar de bibliotheek</a></p>
        </div>
        <input type="search" className="fm-levb-zoek" placeholder="Zoek op naam, gemeente, contact of project" aria-label="Zoek leverancier" value={zoek} onChange={(e) => setZoek(e.target.value)} />
        {schrijven && <button className="fm-knop rood" style={{ height: 40 }} onClick={() => kies(null)}>Nieuwe leverancier</button>}
      </header>
      <div className="fm-levb-body">
        <aside className="fm-levb-filter">
          <div className="fm-mat-lab">Categorie</div>
          <button className={`fm-mat-levknop${!cat ? ' aan' : ''}`} onClick={() => setCat('')}><b>Alle categorieën</b><span>{(lijst || []).length}</span></button>
          {CATEGORIEEN.filter((c) => catTelling.get(c)).map((c) => <button key={c} className={`fm-mat-levknop${cat === c ? ' aan' : ''}`} onClick={() => setCat(cat === c ? '' : c)}><b>{c}</b><span>{catTelling.get(c)}</span></button>)}
          <div className="fm-mat-lab" style={{ marginTop: 10 }}>Regio</div>
          <div className="fm-segment" style={{ flexWrap: 'wrap' }}>{['', ...REGIOS].map((r) => <button key={r || 'alle'} className={regio === r ? 'aan' : ''} onClick={() => setRegio(r)}>{r || 'Alle'}</button>)}</div>
          <label className="fm-vink" style={{ marginTop: 8 }}><input type="checkbox" checked={ookInactief} onChange={(e) => setOokInactief(e.target.checked)} /> Ook niet-actieve</label>
        </aside>
        <main className="fm-levb-lijst">
          {fout && !vorm && <div className="fm-melding fout" style={{ margin: 12 }}>{fout}</div>}
          {lijst === null ? <div className="fm-sub" style={{ padding: 16 }}>Laden…</div> : (
            <table className="fm-mat-tabel">
              <thead><tr><th>Leverancier</th><th>Categorieën</th><th>Gemeente</th><th>Contact</th><th className="r">Elementen</th></tr></thead>
              <tbody>
                {zichtbaar.map((l) => (
                  <tr key={l.id} className={`fm-mat-rij${gekozen === l.id ? ' open' : ''}`} onClick={() => kies(l)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') kies(l); }}>
                    <td><b>{l.naam}</b>{l.soort !== 'extern' && <span className="fm-tag" style={{ marginLeft: 6 }}>{SOORTEN.find(([k]) => k === l.soort)?.[1]}</span>}{l.actief === false && <span className="fm-tag" style={{ marginLeft: 6 }}>niet actief</span>}</td>
                    <td>{(l.categorieen || []).length ? (l.categorieen || []).join(', ') : <span className="fm-sub">nog geen categorie</span>}</td>
                    <td>{l.gemeente || ''}</td>
                    <td>{[l.contactpersoon, l.email, l.telefoon].filter(Boolean).join(' · ') || <span className="fm-sub">contact aanvullen</span>}</td>
                    <td className="r">{gebruik.get(l.naam) || ''}</td>
                  </tr>
                ))}
                {!zichtbaar.length && <tr><td colSpan={5} className="fm-sub">Geen leveranciers voor deze filter.</td></tr>}
              </tbody>
            </table>
          )}
        </main>
        {vorm && (
          <aside className="fm-levb-vorm">
            <div className="fm-ws-rkop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>{gekozen === 'nieuw' ? 'Nieuwe leverancier' : vorm.naam}</strong><button className="fm-knop klein" onClick={async () => { await bewaarNu(); setGekozen(null); setVorm(null); }}>Sluiten</button></div>
            {fout && <div className="fm-melding fout">{fout}</div>}{melding && <div className="fm-melding info">{melding}</div>}
            <label className="fm-veld">Naam<input value={vorm.naam} disabled={!schrijven} onChange={(e) => zet({ naam: e.target.value })} onBlur={hernoem} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
            <div className="fm-veld">Soort<div className="fm-segment">{SOORTEN.map(([k, n]) => <button key={k} type="button" disabled={!schrijven} className={vorm.soort === k ? 'aan' : ''} onClick={() => zet({ soort: k })}>{n}</button>)}</div></div>
            <div className="fm-veld">Categorieën · wat ze leveren<div className="fm-levb-chips">{CATEGORIEEN.map((c) => <button key={c} type="button" disabled={!schrijven} className={vorm.categorieen.includes(c) ? 'aan' : ''} onClick={() => wissel('categorieen', c)}>{c}</button>)}</div></div>
            <div className="fm-veld">Regio<div className="fm-levb-chips">{REGIOS.map((r) => <button key={r} type="button" disabled={!schrijven} className={vorm.regios.includes(r) ? 'aan' : ''} onClick={() => wissel('regios', r)}>{r}</button>)}</div></div>
            <div className="fm-raster2">
              <label className="fm-veld">Gemeente<input value={vorm.gemeente || ''} disabled={!schrijven} onChange={(e) => zet({ gemeente: e.target.value })} /></label>
              <label className="fm-veld">Contactpersoon<input value={vorm.contactpersoon || ''} disabled={!schrijven} onChange={(e) => zet({ contactpersoon: e.target.value })} /></label>
              <label className="fm-veld">E-mail<input type="email" value={vorm.email || ''} disabled={!schrijven} onChange={(e) => zet({ email: e.target.value })} /></label>
              <label className="fm-veld">E-mail 2<input type="email" value={vorm.email2 || ''} disabled={!schrijven} onChange={(e) => zet({ email2: e.target.value })} /></label>
              <label className="fm-veld">Telefoon<input value={vorm.telefoon || ''} disabled={!schrijven} onChange={(e) => zet({ telefoon: e.target.value })} /></label>
              <label className="fm-veld">Projecten<input value={vorm.projecten || ''} disabled={!schrijven} onChange={(e) => zet({ projecten: e.target.value })} placeholder="bv. CX, RVV, GW" /></label>
            </div>
            <label className="fm-veld">Opmerkingen<textarea rows={3} value={vorm.opmerkingen || ''} disabled={!schrijven} onChange={(e) => zet({ opmerkingen: e.target.value })} /></label>
            <label className="fm-vink"><input type="checkbox" checked={vorm.actief !== false} disabled={!schrijven} onChange={(e) => zet({ actief: e.target.checked })} /> Actief (te kiezen in plannen en bibliotheek)</label>
            {gekozen !== 'nieuw' && <span className="fm-sub">{gebruik.get(vorm.naam) || 0} elementen in de bibliotheek van deze leverancier. Een nieuwe naam past de bibliotheek, de plannen en hun standaardleveranciers mee aan.</span>}
            {schrijven && (
              <div className="fm-levb-acties">
                {gekozen === 'nieuw'
                  ? <button className="fm-knop zwart" onClick={opslaan}>Toevoegen</button>
                  : <span className={`fm-levb-status ${status}`} role="status">{status === 'bezig' || status === 'wacht' ? 'Bewaren…' : status === 'fout' ? 'Niet bewaard' : status === 'ok' ? 'Bewaard ✓' : 'Wijzigingen bewaren vanzelf'}</span>}
                {gekozen !== 'nieuw' && ik?.role === 'admin' && <button className="fm-knop gevaar" onClick={wissen}>Wissen</button>}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
