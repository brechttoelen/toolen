'use client';

// Werk verdelen en terugvinden: een werkruimte claimen, wie wijzigde wat, en
// aankondigingen van grote acties (versie terugzetten, definitief maken).
import { useEffect, useState } from 'react';
import { maps, namenVan } from './db';
import { Avatar } from './Aanwezigheid';

const tijd = (d) => new Date(d).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
const dagTijd = (d) => {
  const t = new Date(d); const v = new Date();
  return t.toDateString() === v.toDateString() ? tijd(d) : `${t.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })} ${tijd(d)}`;
};

// Een claim geldt tot het einde van de dag.
export const geldigeClaim = (c) => (c && c.tot && new Date(c.tot) > new Date() ? c : null);
export function nieuweClaim(uid, naam, kleur) {
  const tot = new Date(); tot.setHours(23, 59, 0, 0);
  return { uid, naam, kleur, sinds: new Date().toISOString(), tot: tot.toISOString() };
}

// "Ik doe Stroom" naast de werkruimteschakelaar.
export function ClaimKnop({ wr, claim, mijnUid, schrijven, onClaim, onVrij }) {
  if (!wr || wr.id === 'plan') return null;
  const c = geldigeClaim(claim);
  if (!c) return schrijven ? <button className="fm-knop klein fm-claim" title={`Laat collega's weten dat jij ${wr.naam} doet (tot het einde van de dag)`} onClick={onClaim}>Ik doe dit</button> : null;
  const ik = c.uid === mijnUid;
  return (
    <span className="fm-claim aan" title={`${c.naam} doet ${wr.naam} sinds ${tijd(c.sinds)}. Bewerken mag; het is een afspraak.`}>
      <Avatar p={{ naam: c.naam, kleur: c.kleur, werkruimte: wr.id }} maat={20} rand={false} />
      <span className="tekst">{ik ? `Jij doet ${wr.naam}` : `${c.naam} doet ${wr.naam}`}</span>
      {(ik || schrijven) && <button className="fm-knop klein" onClick={onVrij}>{ik ? 'Vrijgeven' : 'Overnemen'}</button>}
    </span>
  );
}

// Laatste wijzigingen van één item (Info).
const VELD = { geometrie: 'plaats/vorm', parameters: 'maten', stijl: 'opmaak', naam: 'naam', laag_id: 'laag', fase_ids: 'fasen', velden: 'gegevens' };
const veldTekst = (v) => [...new Set((v || []).map((p) => VELD[p.split('.')[0]] || p.split('.')[0]))].join(', ');
export function ItemGeschiedenis({ item }) {
  const [open, setOpen] = useState(false);
  const [rijen, setRijen] = useState(null);
  const [namen, setNamen] = useState({});
  useEffect(() => { if (item?.bewerkt_door) namenVan([item.bewerkt_door]).then(setNamen); }, [item?.bewerkt_door]);
  useEffect(() => {
    if (!open || !item?.id) return;
    let weg = false;
    maps().from('wijzigingen').select('actie, velden, door, op').eq('rij_id', item.id).order('op', { ascending: false }).limit(12)
      .then(async ({ data }) => { if (weg) return; const n = await namenVan((data || []).map((r) => r.door)); setNamen((o) => ({ ...o, ...n })); setRijen(data || []); });
    return () => { weg = true; };
  }, [open, item?.id, item?.rev]);
  if (!item?.updated_at) return null;
  return (
    <div className="fm-geschiedenis">
      <button className="fm-geschiedenis-kop" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Laatst gewijzigd{item.bewerkt_door ? ` door ${namen[item.bewerkt_door] || '…'}` : ''} · {dagTijd(item.updated_at)} <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul>
          {rijen === null && <li className="fm-sub">Laden…</li>}
          {rijen?.map((r, i) => (
            <li key={i}><span>{dagTijd(r.op)}</span> {namen[r.door] || 'onbekend'}: {r.actie === 'nieuw' ? 'geplaatst' : r.actie === 'verwijder' ? 'verwijderd' : veldTekst(r.velden)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Bij het openen: wat collega's deden sinds je vorige bezoek.
export async function sindsVorigBezoek(planId, mijnUid) {
  let vorig = null;
  try { vorig = localStorage.getItem(`fm-bezoek-${planId}`); localStorage.setItem(`fm-bezoek-${planId}`, new Date().toISOString()); } catch { return null; }
  if (!vorig) return null;
  const { data } = await maps().from('wijzigingen').select('rij_id, tabel, actie, door, op').eq('plan_id', planId).gt('op', vorig).limit(2000);
  const rijen = (data || []).filter((r) => r.door && r.door !== mijnUid);
  if (!rijen.length) return null;
  const namen = await namenVan(rijen.map((r) => r.door));
  const per = new Map();
  for (const r of rijen) per.set(namen[r.door], (per.get(namen[r.door]) || 0) + 1);
  const items = [...new Set(rijen.filter((r) => r.tabel === 'items' && r.actie !== 'verwijder').map((r) => r.rij_id))];
  return { totaal: rijen.length, per: [...per], items, sinds: vorig };
}

// Aftelbalk bij een aangekondigde grote actie van een collega.
export function Aankondiging({ a, onKlaar }) {
  const [nu, setNu] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNu(Date.now()), 500); return () => clearInterval(t); }, []);
  const rest = Math.max(0, Math.ceil((a.op - nu) / 1000));
  useEffect(() => { if (rest === 0) { const t = setTimeout(onKlaar, 4000); return () => clearTimeout(t); } return undefined; }, [rest]); // eslint-disable-line react-hooks/exhaustive-deps
  const wat = a.actie === 'terugzetten' ? `zet versie ${a.versie} terug` : 'maakt het plan definitief';
  return (
    <div className="fm-aankondiging" role="alert">
      <span><b>{a.naam}</b> {wat} {rest ? `over ${rest} s` : 'nu'}.{a.eigen ? ' Je collega\'s zijn verwittigd.' : ` Je wijzigingen worden eerst bewaard${a.actie === 'terugzetten' ? '; de huidige stand blijft terug te vinden bij de versies' : ''}.`}</span>
    </div>
  );
}
