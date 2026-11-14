'use client';

// Paneelblok "Materiaal hier": een lijstje uit de bibliotheek op een punt of zone, zonder het uit te tekenen.
import { useMemo, useState } from 'react';
import Blok from './blok';
import { materiaalVan, metMateriaal, kwVanMateriaal, vraagtStroom } from './materiaalHier';
import { stroomVan } from './stroom';
import { alsStroomItem } from './vasteAansluitingen';
import { getal } from './geo';

export default function MateriaalHierBlok({ item, elementen, elementenMap, items, vast = [], ro, metStroom, onWijzig, onUittekenen }) {
  const [zoek, setZoek] = useState('');
  const rijen = materiaalVan(item, elementenMap);
  const lijst = Array.isArray(item.velden?.materiaal) ? item.velden.materiaal : [];
  const zet = (nieuw) => onWijzig({ velden: metMateriaal(item, nieuw, elementenMap) });
  const kies = useMemo(() => {
    const q = zoek.trim().toLowerCase(); if (q.length < 2) return [];
    const woorden = q.split(/\s+/);
    return elementen.filter((e) => e.actief !== false && !['sjabloon'].includes(e.tekenwijze) && e.familie !== 'branding' && !e.eigenschappen?.doek_soort
      && woorden.every((w) => `${e.naam} ${e.categorie || ''} ${(e.eigenschappen?.tags || []).join(' ')}`.toLowerCase().includes(w))).slice(0, 8);
  }, [zoek, elementen]);
  const voegToe = (e) => { const i = lijst.findIndex((r) => r.element_id === e.id); zet(i >= 0 ? lijst.map((r, j) => (j === i ? { ...r, aantal: (Number(r.aantal) || 0) + 1 } : r)) : [...lijst, { element_id: e.id, aantal: 1 }]); setZoek(''); };
  const kw = kwVanMateriaal(rijen); const stroom = metStroom && vraagtStroom(rijen);
  const st = stroomVan(item, null);
  const voedingen = stroom ? [...vast.map(alsStroomItem), ...items.filter((i) => i.id !== item.id && ['bron', 'kast'].includes(stroomVan(i, elementenMap.get(i.element_id)).rol))] : [];
  const naamV = (i) => (i.vast ? `${i.naam} (vast)` : i.naam || elementenMap.get(i.element_id)?.naam || 'Zonder naam');
  const totaal = rijen.reduce((s, r) => s + r.aantal, 0);
  if (ro && !rijen.length) return null;
  return (
    <Blok titel={`Materiaal hier${rijen.length ? ` · ${totaal} ${totaal === 1 ? 'stuk' : 'stuks'}` : ''}`} open info="Materiaal dat op deze plek moet komen, zonder het uit te tekenen. Telt mee in de materiaallijst en in de bestelling per leverancier.">
      {rijen.length > 0 && (
        <div className="fm-mh-lijst">
          {rijen.map((r) => (
            <div key={r.element_id} className="fm-mh-rij">
              <span className="fm-afkap" title={r.el.naam}>{r.el.naam}</span>
              <input type="number" min="1" step="1" aria-label={`Aantal ${r.el.naam}`} disabled={ro} defaultValue={r.aantal} key={`${r.element_id}:${r.aantal}`}
                onBlur={(e) => { const n = Math.round(Number(e.target.value) || 0); if (n !== r.aantal) zet(n > 0 ? lijst.map((x) => (x.element_id === r.element_id ? { ...x, aantal: n } : x)) : lijst.filter((x) => x.element_id !== r.element_id)); }}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
              {!ro && <button className="fm-mh-weg" aria-label={`${r.el.naam} weghalen`} onClick={() => zet(lijst.filter((x) => x.element_id !== r.element_id))}>×</button>}
            </div>
          ))}
        </div>
      )}
      {!ro && (
        <div className="fm-mh-zoek">
          <input type="search" value={zoek} placeholder="Zoek in de bibliotheek, bv. stekkerdoos" aria-label="Materiaal toevoegen" onChange={(e) => setZoek(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && kies[0]) voegToe(kies[0]); }} />
          {kies.length > 0 && (
            <div className="fm-mh-keuze">
              {kies.map((e) => <button key={e.id} onClick={() => voegToe(e)}><span className="fm-afkap">{e.naam}</span><small>{e.categorie || ''}</small></button>)}
            </div>
          )}
          {zoek.trim().length >= 2 && !kies.length && <div className="fm-sub">Niets gevonden in de bibliotheek.</div>}
        </div>
      )}
      {stroom && (
        <div className="fm-mh-stroom">
          <label className="fm-veld">Stroom voor deze plek{kw > 0 ? ` · ${getal(kw, 1)} kW uit het materiaal` : ''}
            <select value={st.voeding || ''} disabled={ro} onChange={(e) => onWijzig({ velden: { ...(item.velden || {}), stroom: { ...(item.velden?.stroom || {}), rol: 'verbruiker', voeding: e.target.value || null } } })}>
              <option value="">Nog niet aangesloten</option>
              {voedingen.map((v) => <option key={v.id} value={v.id}>{naamV(v)}</option>)}
            </select>
          </label>
          {kw === 0 && <div className="fm-sub">Stekkerdozen zonder vermogen: vul het verwachte verbruik in onder Meer › Elektriciteit.</div>}
        </div>
      )}
      {!ro && rijen.length > 0 && onUittekenen && <button className="fm-knop klein" title="De stuks als echte elementen onder deze plek zetten; het lijstje verdwijnt, zodat niets dubbel telt" onClick={onUittekenen}>Uittekenen op de kaart</button>}
    </Blok>
  );
}
