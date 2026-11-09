'use client';

// Plannen van de stellingbouwer (Gigant…) bij een stelling: de 3D in de bouwer is een visuele voorstelling,
// deze plannen (PDF, DWG, beeld) zijn de echte. Bewaard in de bucket en in de tabel bestanden (soort 'stellingplan').
import { useEffect, useRef, useState } from 'react';
import { sb, maps, BUCKET, publiekeUrl, foutTekst } from './db';
import { bevestig } from './dialoog';

export async function laadPlannen(itemId) {
  if (!itemId) return [];
  const { data } = await maps().from('bestanden').select('*').eq('item_id', itemId).eq('soort', 'stellingplan').order('created_at');
  return data || [];
}

async function bewaarPlan(planId, itemId, bestand) {
  const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  const ext = (bestand.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const pad = `${planId}/stellingplannen/${itemId}/${id}.${ext}`;
  const r = await sb().storage.from(BUCKET).upload(pad, bestand, { contentType: bestand.type || 'application/octet-stream', cacheControl: '31536000' });
  if (r.error) throw r.error;
  const rij = { plan_id: planId, item_id: itemId, soort: 'stellingplan', pad, meta: { naam: bestand.name, kb: Math.round(bestand.size / 1024) } };
  const { data, error } = await maps().from('bestanden').insert(rij).select().single();
  if (error) throw error;
  return data;
}

async function verwijderPlan(rij) {
  await sb().storage.from(BUCKET).remove([rij.pad]);
  const { error } = await maps().from('bestanden').delete().eq('id', rij.id);
  if (error) throw error;
}

// Melding + lijst van de plannen, met opladen voor wie mag schrijven.
// vast = lijst die al geladen is (bv. via een deellink: [{ pad, naam }]); dan geen database en niets opladen.
export function StellingPlannen({ planId, itemId, schrijven, compact = false, vast = null }) {
  const [lijst, setLijst] = useState(vast || []); const [bezig, setBezig] = useState(false); const [fout, setFout] = useState(null);
  const inp = useRef(null);
  useEffect(() => { if (vast) { setLijst(vast); return undefined; } let weg = false; laadPlannen(itemId).then((l) => { if (!weg) setLijst(l); }).catch(() => {}); return () => { weg = true; }; }, [itemId, vast]);
  const op = async (files) => {
    setBezig(true); setFout(null);
    try { for (const f of files) { const r = await bewaarPlan(planId, itemId, f); setLijst((l) => [...l, r]); } } catch (e) { setFout(foutTekst(e)); }
    setBezig(false);
  };
  return (
    <div className={`fm-stplan${compact ? ' compact' : ''}`}>
      <div className="fm-stplan-melding">Indicatieve weergave. Enkel de plannen van de stellingbouwer zijn bindend.</div>
      {lijst.map((r) => (
        <div key={r.id || r.pad} className="fm-stplan-rij">
          <a href={publiekeUrl(r.pad)} target="_blank" rel="noreferrer" title="Plan openen">📄 {r.meta?.naam || 'Plan'}</a>
          {schrijven && !vast && <button type="button" aria-label="Plan weghalen" onClick={async () => { if (!(await bevestig(`"${r.meta?.naam || 'Plan'}" weghalen?`))) return; try { await verwijderPlan(r); setLijst((l) => l.filter((x) => x.id !== r.id)); } catch (e) { setFout(foutTekst(e)); } }}>×</button>}
        </div>
      ))}
      {!lijst.length && <div className="fm-sub">Nog geen plan van de stellingbouwer opgeladen.</div>}
      {schrijven && !vast && planId && itemId && <>
        <input ref={inp} type="file" multiple accept=".pdf,.dwg,.dxf,image/*" hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) op(f); }} />
        <button type="button" className="fm-knop klein" disabled={bezig} onClick={() => inp.current?.click()}>{bezig ? 'Bezig met opladen…' : '+ Plan van de stellingbouwer opladen'}</button>
      </>}
      {fout && <div className="fm-melding fout">{fout}</div>}
    </div>
  );
}
