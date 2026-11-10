'use client';

// Lagen kiezen per map, overal hetzelfde (delen, PDF, kaartbestanden).
// Een hele map aanvinken bewaart de map zelf: lagen die er later bijkomen, zitten er dan ook in.
// Gebruik met { laag_ids, mappen } (waarde/onChange) of enkel met een lijst laag-id's (ids/onIds).
import { useMemo, useState } from 'react';

function groepeer(lagen) {
  const groepen = []; const per = new Map();
  for (const l of lagen) {
    if (!l.map) { groepen.push({ los: true, lagen: [l] }); continue; }
    if (!per.has(l.map)) { const g = { map: l.map, lagen: [] }; per.set(l.map, g); groepen.push(g); }
    per.get(l.map).lagen.push(l);
  }
  return groepen;
}

export default function LagenKiezer({ lagen, waarde, onChange, ids, onIds, compact = false }) {
  const [zoek, setZoek] = useState('');
  const [dicht, setDicht] = useState(() => new Set());
  const metMappen = !!onChange;
  const mappen = new Set(metMappen ? waarde?.mappen || [] : []);
  const gekozen = useMemo(() => {
    if (!metMappen) return new Set(ids || []);
    if (!Array.isArray(waarde?.laag_ids) && !Array.isArray(waarde?.mappen)) return new Set(lagen.filter((l) => l.printbaar !== false).map((l) => l.id));
    const s = new Set(waarde.laag_ids || []);
    for (const l of lagen) if (l.map && mappen.has(l.map)) s.add(l.id);
    return s;
  }, [metMappen, ids, waarde, lagen]); // eslint-disable-line react-hooks/exhaustive-deps

  const zet = (nieuw, nieuweMappen) => {
    if (!metMappen) { onIds([...nieuw]); return; }
    const m = new Set(nieuweMappen);
    // Een map die niet meer volledig aan staat, valt terug op losse lagen.
    for (const naam of [...m]) if (!lagen.some((l) => l.map === naam) || lagen.some((l) => l.map === naam && !nieuw.has(l.id))) m.delete(naam);
    onChange({ laag_ids: lagen.filter((l) => nieuw.has(l.id) && !(l.map && m.has(l.map))).map((l) => l.id), mappen: [...m] });
  };
  const wisselLaag = (l) => { const s = new Set(gekozen); if (s.has(l.id)) s.delete(l.id); else s.add(l.id); zet(s, mappen); };
  const wisselMap = (g) => {
    const s = new Set(gekozen); const alle = g.lagen.every((l) => s.has(l.id));
    const m = new Set(mappen);
    if (alle) { g.lagen.forEach((l) => s.delete(l.id)); m.delete(g.map); } else { g.lagen.forEach((l) => s.add(l.id)); m.add(g.map); }
    zet(s, m);
  };
  const alles = (aan) => zet(new Set(aan ? lagen.map((l) => l.id) : []), aan ? [...new Set(lagen.filter((l) => l.map).map((l) => l.map))] : []);

  const q = zoek.trim().toLowerCase();
  const groepen = groepeer(lagen.filter((l) => !q || l.naam.toLowerCase().includes(q) || (l.map || '').toLowerCase().includes(q)));
  const laagRij = (l, inMap) => (
    <label key={l.id} className={`fm-lk-laag${inMap ? ' in' : ''}${gekozen.has(l.id) ? '' : ' uit'}`}>
      <input type="checkbox" checked={gekozen.has(l.id)} onChange={() => wisselLaag(l)} />
      <span className="fm-lk-kleur" style={{ background: l.kleur }} />
      <span className="fm-lk-naam">{l.naam}</span>
      {l.printbaar === false && <span className="fm-lk-tag" title="Deze laag staat op Niet afdrukken">Niet afdrukken</span>}
    </label>
  );
  return (
    <div className={`fm-lk${compact ? ' compact' : ''}`}>
      <div className="fm-lk-kop">
        <span className="fm-lk-tel">{gekozen.size} van {lagen.length} lagen</span>
        <button type="button" className="fm-lk-snel" onClick={() => alles(true)}>Alles</button>
        <button type="button" className="fm-lk-snel" onClick={() => alles(false)}>Niets</button>
      </div>
      {lagen.length > 8 && <input className="fm-lk-zoek" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een laag of map" aria-label="Zoek een laag of map" />}
      <div className="fm-lk-lijst">
        {groepen.map((g) => {
          if (g.los) return laagRij(g.lagen[0], false);
          const alle = lagen.filter((l) => l.map === g.map);
          const n = alle.filter((l) => gekozen.has(l.id)).length;
          const open = !dicht.has(g.map) || !!q;
          return (
            <div key={g.map} className="fm-lk-map">
              <div className="fm-lk-mapkop">
                <input type="checkbox" aria-label={`Map ${g.map}`} checked={n === alle.length} ref={(el) => { if (el) el.indeterminate = n > 0 && n < alle.length; }} onChange={() => wisselMap({ map: g.map, lagen: alle })} />
                <button type="button" className="fm-lk-mapnaam" aria-expanded={open} onClick={() => setDicht((d) => { const s = new Set(d); if (s.has(g.map)) s.delete(g.map); else s.add(g.map); return s; })}>
                  <span className="fm-lk-pijl" aria-hidden>{open ? '▾' : '▸'}</span>{g.map}
                </button>
                {metMappen && mappen.has(g.map) && <span className="fm-lk-tag blauw" title="Lagen die later in deze map komen, zitten er ook in">Hele map</span>}
                <span className="fm-lk-n">{n}/{alle.length}</span>
              </div>
              {open && g.lagen.map((l) => laagRij(l, true))}
            </div>
          );
        })}
        {!groepen.length && <div className="fm-sub">Niets gevonden.</div>}
      </div>
    </div>
  );
}
