'use client';

// Fijner kiezen wat een ontvanger ziet: per soort element, per eigen tekening en per los item.
// vorm = { laag_ids, fase_ids, opties: { verberg_elementen, verberg_soorten, verberg_items, leverancier } }.
import { useMemo, useState } from 'react';
import { vergelijkCategorie } from './categorieen';
import { herkomstVan } from './stijl';

const SOORT1 = { punt: 'Punt', lijn: 'Lijn', vlak: 'Vlak', rechthoek: 'Rechthoek', cirkel: 'Cirkel', tekst: 'Tekst', veelhoek: 'Veelhoek', ellips: 'Ellips', sector: 'Kijkhoek', notitie: 'Notitie', afstand: 'Maatlijn', element: 'Element' };
const SOORT = { punt: 'Punten', lijn: 'Lijnen', vlak: 'Vlakken', rechthoek: 'Rechthoeken', cirkel: 'Cirkels', tekst: 'Teksten', veelhoek: 'Veelhoeken', ellips: 'Ellipsen', sector: 'Kijkhoeken', notitie: 'Notities met pijl', afstand: 'Maatlijnen' };

// Fijner kiezen: per soort element, per eigen tekening en per los item.
export default function FijnKiezen({ vorm, setVorm, plan, items, elementenMap, lagen }) {
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
        <span className="fm-sub">{verborgenTelling ? `Ontvanger ziet ${aantal} van ${kandidaten.length} items` : `Alles in de gekozen lagen (${kandidaten.length} items)`}</span>
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
                        <span className="fm-fijn-naam">{el.naam}</span><span className="fm-sub">{pv ? 'Verborgen in plan' : n}</span>
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
