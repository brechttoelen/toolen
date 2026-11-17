'use client';

// Contacten van de site. Bovenaan het team met een vrije rol en een toegang
// (Lid, Lezer, Deellink of Geen). Daaronder de contactpersonen van de leveranciers op deze site.
// Een persoon hoort bij een organisatie uit de stamlijst; de site bewaart enkel rol en toegang.
import { useState } from 'react';
import { opId } from './data';
import { Bewaarveld, Zoek, TabNotities } from './gedeeld';
import { maps, foutTekst } from '../maps/db';
import { bevestig, toonTekst } from '../maps/dialoog';

const TOEGANG = { lid: 'Logt in, plaats in het pakket', lezer: 'Gsm, kan eigen taken afvinken, gratis', deellink: 'Link met zijn taken, zonder login', geen: 'Enkel in de lijsten' };

export default function TabContacten({ f }) {
  const s = f.schrijven;
  const pers = opId(f.d.personen); const lev = opId(f.d.leveranciers);
  const rollen = [...(f.d.site_rollen || [])].sort((a, b) => a.volgorde - b.volgorde || (pers.get(a.persoon_id)?.naam || '').localeCompare(pers.get(b.persoon_id)?.naam || ''));
  const [zoek, setZoek] = useState('');
  const [nieuw, setNieuw] = useState({ naam: '', rol: '', org: '', tel: '' });
  const [czoek, setCzoek] = useState('');
  const inTeam = new Set(rollen.map((r) => r.persoon_id));
  const q = zoek.trim().toLowerCase();
  const kandidaten = q ? (f.d.personen || []).filter((p) => !inTeam.has(p.id) && p.naam.toLowerCase().includes(q)).slice(0, 6) : [];

  const voegPersoonToe = async (p) => { await f.voegToe('site_rollen', { persoon_id: p.id, rol: null, toegang: p.user_id ? 'lid' : 'geen', volgorde: rollen.length }); setZoek(''); };
  const nieuwePersoon = async () => {
    if (!nieuw.naam.trim()) return;
    const org = nieuw.org ? f.d.leveranciers.find((l) => l.naam.toLowerCase() === nieuw.org.trim().toLowerCase()) : null;
    let orgId = org?.id || null;
    if (nieuw.org.trim() && !org) { const l = await f.voegToe('leveranciers', { naam: nieuw.org.trim(), organisatie_id: f.plan.organisatie_id, soort: 'partner' }); orgId = l?.id || null; }
    const p = await f.voegToe('personen', { naam: nieuw.naam.trim(), leverancier_id: orgId, telefoon: nieuw.tel.trim() || null, organisatie_id: f.plan.organisatie_id });
    if (p) await f.voegToe('site_rollen', { persoon_id: p.id, rol: nieuw.rol.trim() || null, toegang: 'geen', volgorde: rollen.length });
    setNieuw({ naam: '', rol: '', org: '', tel: '' });
  };
  const zetToegang = async (r, p, v) => {
    await f.wijzig('site_rollen', r.id, { toegang: v });
    if (v === 'deellink') {
      const bestaand = await maps().from('deel_links').select('token').eq('plan_id', f.plan.id).eq('persoon_id', p.id).is('ingetrokken_op', null).maybeSingle();
      let token = bestaand.data?.token;
      if (!token) {
        const { data, error } = await maps().from('deel_links').insert({ plan_id: f.plan.id, naam: `Taken ${p.naam}`, live: true, persoon_id: p.id, laag_ids: f.lagen.map((l) => l.id), opties: { taal: 'nl', taken: true } }).select('token').single();
        if (error) return f.meld(foutTekst(error));
        token = data.token;
      }
      await toonTekst(`Deellink voor ${p.naam}: zijn taken, zijn rol en de kaart. Werkt zonder login.`, `${window.location.origin}/d/${token}`, 'Deellink');
    }
    if (v === 'lezer' && !p.user_id) f.meld(`${p.naam} heeft nog geen account. Nodig hem uit als lezer bij Beheer, met hetzelfde e-mailadres.`);
  };
  const weg = async (r, p) => { if (await bevestig(`${p?.naam || 'Deze persoon'} uit het team van deze site halen?`, { ok: 'Weghalen' })) f.wis('site_rollen', r.id); };
  const sleep = async (r, d) => { const i = rollen.indexOf(r); const j = i + d; if (j < 0 || j >= rollen.length) return; await f.wijzig('site_rollen', r.id, { volgorde: j }); await f.wijzig('site_rollen', rollen[j].id, { volgorde: i }); };

  // Contactpersonen van de leveranciers op deze site.
  const opSite = new Set((f.d.site_leveranciers || []).map((x) => x.leverancier_id));
  const cq = czoek.trim().toLowerCase();
  const perLev = [...opSite].map((id) => ({ l: lev.get(id), p: (f.d.personen || []).filter((x) => x.leverancier_id === id && (!cq || `${x.naam} ${x.functie || ''} ${lev.get(id)?.naam || ''}`.toLowerCase().includes(cq))) }))
    .filter((g) => g.l && (g.p.length || !cq)).sort((a, b) => a.l.naam.localeCompare(b.l.naam));
  const [nc, setNc] = useState({});

  return (
    <div className="pf-romp">
      <section className="pf-kaart">
        <div className="pf-kaartkop"><h2>Team op deze site</h2><span className="pf-stil">{rollen.length} mensen</span></div>
        <div className="pf-tabvak" style={{ maxHeight: 'none', border: 0 }}>
          <table className="pf-tabel" style={{ minWidth: 900 }}>
            <thead><tr><th>Naam</th><th>Rol op deze site</th><th>Organisatie</th><th>Telefoon</th><th style={{ width: 230 }}>Toegang</th><th style={{ width: 120 }} /></tr></thead>
            <tbody>
              {!rollen.length && <tr><td colSpan={6} className="pf-leeg">Nog niemand in het team. Zoek iemand of voeg een nieuwe persoon toe.</td></tr>}
              {rollen.map((r) => {
                const p = pers.get(r.persoon_id) || { naam: '?' };
                return (
                  <tr key={r.id}>
                    <td><b>{p.naam}</b>{p.email && <small>{p.email}</small>}</td>
                    <td><Bewaarveld waarde={r.rol || ''} uit={!s} label={`Rol van ${p.naam}`} placeholder="Rol typen" onBewaar={(v) => f.wijzig('site_rollen', r.id, { rol: v.trim() || null })} /></td>
                    <td>{(p.leverancier_id && lev.get(p.leverancier_id)?.naam) || 'Eigen organisatie'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.telefoon ? <a href={`tel:${p.telefoon.replace(/\s/g, '')}`}>{p.telefoon}</a> : <span className="pf-stil">–</span>}</td>
                    <td><select className="t-veld" style={{ height: 30, width: '100%' }} value={r.toegang} disabled={!s} onChange={(e) => zetToegang(r, p, e.target.value)} aria-label={`Toegang van ${p.naam}`}>
                      {(p.user_id ? ['lid', 'lezer'] : ['geen', 'deellink', 'lezer']).map((k) => <option key={k} value={k}>{{ lid: 'Lid', lezer: 'Lezer', deellink: 'Deellink', geen: 'Geen' }[k]}</option>)}</select>
                      <small>{TOEGANG[r.toegang]}</small></td>
                    <td>{s && <span className="pf-rij" style={{ gap: 2, flexWrap: 'nowrap' }}><button className="t-knop klein stil" onClick={() => sleep(r, -1)} aria-label="Hoger">↑</button><button className="t-knop klein stil" onClick={() => sleep(r, 1)} aria-label="Lager">↓</button><button className="t-knop klein stil" onClick={() => weg(r, p)}>Weg</button></span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {s && <div className="pf-rij" style={{ position: 'relative' }}>
          <Zoek waarde={zoek} onChange={setZoek} placeholder="Iemand uit de contacten toevoegen" />
          {kandidaten.map((p) => <button key={p.id} className="pf-chip" onClick={() => voegPersoonToe(p)}>{p.naam}{p.leverancier_id ? ` · ${lev.get(p.leverancier_id)?.naam || ''}` : ''}</button>)}
        </div>}
        {s && <div className="pf-rij">
          <input className="t-veld" style={{ width: 200 }} value={nieuw.naam} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} placeholder="Nieuwe persoon: naam" aria-label="Naam" />
          <input className="t-veld" style={{ width: 220 }} value={nieuw.rol} onChange={(e) => setNieuw({ ...nieuw, rol: e.target.value })} placeholder="Rol op deze site" aria-label="Rol" />
          <input className="t-veld" style={{ width: 200 }} value={nieuw.org} onChange={(e) => setNieuw({ ...nieuw, org: e.target.value })} placeholder="Organisatie (leeg = eigen)" list="pf-orgs" aria-label="Organisatie" />
          <input className="t-veld" style={{ width: 160 }} value={nieuw.tel} onChange={(e) => setNieuw({ ...nieuw, tel: e.target.value })} placeholder="Telefoon" aria-label="Telefoon" />
          <datalist id="pf-orgs">{f.d.leveranciers.map((l) => <option key={l.id} value={l.naam} />)}</datalist>
          <button className="t-knop hoofd" onClick={nieuwePersoon}>Toevoegen</button>
        </div>}
      </section>

      <div className="pf-rij"><h2 style={{ margin: 0, fontFamily: 'var(--font-titel)', fontStretch: '112%', fontSize: 18, flex: 1 }}>Contacten van de leveranciers op deze site</h2><Zoek waarde={czoek} onChange={setCzoek} placeholder="Zoek een contact" /></div>
      <div className="pf-raster">
        {!perLev.length && <div className="pf-leeg">Nog geen leveranciers op deze site.</div>}
        {perLev.map((g) => (
          <section key={g.l.id} className="pf-kaart">
            <div className="pf-kaartkop"><h2>{g.l.naam}</h2><span className="pf-stil">{g.l.soort || ''}</span></div>
            {!g.p.length && <span className="pf-stil">Nog geen contactpersoon.</span>}
            {g.p.map((p) => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <b style={{ fontWeight: 600 }}>{p.naam}</b>
                <span className="pf-stil pf-klein">{[p.functie, p.telefoon, p.email].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
            {s && (nc[g.l.id] ? (
              <div className="pf-velden">
                <input className="t-veld" placeholder="Naam" value={nc[g.l.id].naam} onChange={(e) => setNc({ ...nc, [g.l.id]: { ...nc[g.l.id], naam: e.target.value } })} aria-label="Naam" />
                <input className="t-veld" placeholder="Functie" value={nc[g.l.id].functie} onChange={(e) => setNc({ ...nc, [g.l.id]: { ...nc[g.l.id], functie: e.target.value } })} aria-label="Functie" />
                <input className="t-veld" placeholder="Telefoon" value={nc[g.l.id].telefoon} onChange={(e) => setNc({ ...nc, [g.l.id]: { ...nc[g.l.id], telefoon: e.target.value } })} aria-label="Telefoon" />
                <input className="t-veld" placeholder="E-mail" value={nc[g.l.id].email} onChange={(e) => setNc({ ...nc, [g.l.id]: { ...nc[g.l.id], email: e.target.value } })} aria-label="E-mail" />
                <button className="t-knop klein hoofd" onClick={async () => { const x = nc[g.l.id]; if (!x.naam.trim()) return; await f.voegToe('personen', { naam: x.naam.trim(), functie: x.functie.trim() || null, telefoon: x.telefoon.trim() || null, email: x.email.trim() || null, leverancier_id: g.l.id, organisatie_id: f.plan.organisatie_id }); setNc({ ...nc, [g.l.id]: null }); }}>Bewaren</button>
              </div>
            ) : <button className="pf-link" onClick={() => setNc({ ...nc, [g.l.id]: { naam: '', functie: '', telefoon: '', email: '' } })}>Contact toevoegen</button>)}
          </section>
        ))}
      </div>
      <TabNotities f={f} tab="contacten" />
    </div>
  );
}
