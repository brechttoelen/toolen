'use client';

// Blok in de eigenschappen van een item op de kaart: de taken die aan dit item (of zijn groep of laag)
// hangen, een taak maken voor dit item, en de leverancier van dit item (overschrijft de bibliotheek).
import { useEffect, useState } from 'react';
import Blok from '../maps/blok';
import { maps, foutTekst } from '../maps/db';
import { label, uurKort } from './dagen';

export default function FicheItemBlok({ item, plan, schrijven, groepAantal = 0, groepNaam = '' }) {
  const [taken, setTaken] = useState([]);
  const [lev, setLev] = useState([]);
  const [levId, setLevId] = useState(item.leverancier_id || '');
  const [fout, setFout] = useState('');
  const [titel, setTitel] = useState('');
  const [heleGroep, setHeleGroep] = useState(true);
  const laad = async () => {
    const of = [`item_id.eq.${item.id}`, item.laag_id && `laag_id.eq.${item.laag_id}`, item.groep_id && `groep_id.eq.${item.groep_id}`].filter(Boolean).join(',');
    const k = await maps().from('taak_koppelingen').select('taak_id, soort').or(of);
    const ids = [...new Set((k.data || []).map((x) => x.taak_id))];
    if (!ids.length) { setTaken([]); return; }
    const [t, d] = await Promise.all([maps().from('taken').select('id, titel, soort').in('id', ids), maps().from('taak_dagen').select('taak_id, anker, dag, uur_van, status').in('taak_id', ids)]);
    setTaken((t.data || []).map((x) => ({ ...x, via: (k.data || []).find((y) => y.taak_id === x.id)?.soort, dagen: (d.data || []).filter((y) => y.taak_id === x.id).sort((a, b) => (a.anker === b.anker ? a.dag - b.dag : a.anker === 'start' ? -1 : 1)) })));
  };
  useEffect(() => { setLevId(item.leverancier_id || ''); laad(); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { maps().from('leveranciers').select('id, naam').order('naam').then((r) => setLev(r.data || [])); }, []);

  const zetLev = async (v) => {
    setLevId(v);
    // Zelfde plek als de leverancier in de eigenschappen en het materiaalscherm: velden.herkomst (op naam), plus de sleutel.
    const naam = lev.find((l) => l.id === v)?.naam || null;
    const velden = { ...(item.velden || {}) }; if (naam) velden.herkomst = naam; else delete velden.herkomst;
    const r = await maps().from('items').update({ leverancier_id: v || null, velden }).eq('id', item.id);
    if (r.error) setFout(foutTekst(r.error));
  };
  const maakTaak = async () => {
    const t = titel.trim() || `Plaatsen ${item.naam || 'item'}`;
    const n = await maps().from('taken').insert({ plan_id: item.plan_id, titel: t }).select().single();
    if (n.error) return setFout(foutTekst(n.error));
    const [a, b] = await Promise.all([
      maps().from('taak_dagen').insert({ taak_id: n.data.id, anker: 'start', dag: -1 }),
      maps().from('taak_koppelingen').insert(item.groep_id && groepAantal > 1 && heleGroep
        ? { taak_id: n.data.id, soort: 'groep', groep_id: item.groep_id, label: `${groepNaam || item.naam || 'groep'} (${groepAantal})` }
        : { taak_id: n.data.id, soort: 'item', item_id: item.id, label: item.naam || null }),
    ]);
    if (a.error || b.error) return setFout(foutTekst(a.error || b.error));
    setTitel(''); laad();
  };
  return (
    <Blok titel={`Fiche${taken.length ? ` · ${taken.length} ${taken.length === 1 ? 'taak' : 'taken'}` : ''}`} open={taken.length > 0} info="Taken van de projectfiche die over dit item gaan, en de leverancier van dit item.">
      {taken.map((t) => (
        <a key={t.id} className="fm-sub" style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '4px 0', borderBottom: '1px solid #EEF1F5' }} href={`/maps/${item.plan_id}/fiche?tab=planning`}>
          <b style={{ fontWeight: 600, color: 'var(--t-tekst)' }}>{t.titel}</b>
          <span style={{ display: 'block' }}>{t.dagen.map((d) => `${label(plan, d.anker, d.dag)}${d.uur_van ? ` ${uurKort(d.uur_van)}` : ''}${d.status === 'klaar' ? ' ✓' : ''}`).join(', ') || 'Voorbereiding'}{t.via && t.via !== 'item' ? ` · via ${t.via}` : ''}</span>
        </a>
      ))}
      {!taken.length && <div className="fm-sub">Nog geen taken over dit item.</div>}
      {schrijven && item.groep_id && groepAantal > 1 && <label className="fm-vink"><input type="checkbox" checked={heleGroep} onChange={() => setHeleGroep(!heleGroep)} />Voor de hele groep ({groepAantal} items)</label>}
      {schrijven && <div style={{ display: 'flex', gap: 6 }}><input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={`Plaatsen ${item.naam || 'item'}`} aria-label="Nieuwe taak" style={{ flex: 1, minWidth: 0 }} /><button className="fm-knop klein" onClick={maakTaak}>Taak maken</button></div>}
      <label className="fm-veld">Leverancier van dit item
        <select value={levId} disabled={!schrijven} onChange={(e) => zetLev(e.target.value)}>
          <option value="">Zoals de bibliotheek</option>
          {lev.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
        </select>
      </label>
      {fout && <div className="t-melding fout">{fout}</div>}
    </Blok>
  );
}
