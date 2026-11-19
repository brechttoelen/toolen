'use client';

// Bestellingen op de kaart: per leverancier de bestelregels met hoeveel er al geplaatst is.
// Een klik op een regel selecteert dat materiaal op de kaart; Plaats kiest het element om verder te plaatsen.
// BestelBlok toont hetzelfde voor de selectie, in het rechtermenu.
import { useMemo } from 'react';
import { samenvatting, stand, momentKort, momentNaam, locatieTekst } from './bestelling';
import { useKaartStand, useBestelData } from './kaartStand';
import './fiche.css';
import { SkeletRijen } from '../Skelet';

const cijfer = (n) => new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 1 }).format(n);
function Balk({ n, tot, st }) {
  const p = tot ? Math.min(100, Math.round((100 * n) / tot)) : n ? 100 : 0;
  return <span className={`pf-balk ${st || ''}`}><span className="spoor"><span style={{ width: `${p}%` }} /></span><span className="tel">{cijfer(n)} / {cijfer(tot)}</span></span>;
}
// Per leverancier op de site: samenvatting met de rijen, geteld met wat de kaart nu toont.
function useBestellingen(planId) {
  const k = useKaartStand();
  const { d, herlaad } = useBestelData(planId, k?.plan?.organisatie_id);
  const lijst = useMemo(() => {
    if (!k || !d) return null;
    const f = { plan: k.plan, items: k.items, lagen: k.lagen, elementen: k.elementen, d };
    return d.site_leveranciers.map((sl) => ({ sl, f, lev: d.leveranciers.find((l) => l.id === sl.leverancier_id) || { naam: '?' }, s: samenvatting(f, sl) }))
      .filter((x) => x.s.rijen.length).sort((a, b) => a.lev.naam.localeCompare(b.lev.naam));
  }, [k, d]);
  return { lijst, herlaad, k };
}
const idsVan = (x, rij) => { const ids = x.s.mat.get(rij.k)?.ids || []; if (!rij.r.locatie_laag_id) return ids; const s = new Set(x.f.items.filter((i) => i.laag_id === rij.r.locatie_laag_id).map((i) => i.id)); return ids.filter((id) => s.has(id)); };
const tekort = (rij) => { const st = stand(rij); return st === 'weinig' ? `nog ${cijfer(rij.besteld - rij.geplaatst)}` : st === 'veel' ? `${cijfer(rij.geplaatst - rij.besteld)} te veel` : st === 'klaar' ? 'klaar' : ''; };

export default function KaartBestellingen({ planId, schrijven, onKiesItems, onPlaats }) {
  const { lijst, herlaad, k } = useBestellingen(planId);
  if (!lijst) return <div className="fm-paneel-inhoud"><SkeletRijen rijen={6} kop={false} kolommen={['1fr', 40]} rijHoogte={40} /></div>;
  return (
    <div className="fm-paneel-inhoud" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 6 }}>
        <span className="fm-sub" style={{ flex: 1 }}>Klik een regel om dat materiaal op de kaart te selecteren.</span>
        <button className="fm-knop klein" onClick={herlaad} title="Bestellingen opnieuw ophalen uit de fiche">Vernieuw</button>
      </div>
      {!lijst.length && <p className="fm-sub">Nog geen bestellingen. Ze verschijnen zodra er materiaal van een leverancier op de kaart staat, of als je in de fiche regels toevoegt.</p>}
      {lijst.map((x) => (
        <section key={x.sl.id} style={{ borderTop: '1px solid var(--t-rand, #E3E8EF)', padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <b style={{ flex: 1, fontWeight: 600 }}>{x.lev.naam}</b>
            <span className="fm-sub">{x.s.vast ? 'vastgezet' : 'loopt mee'}</span>
            <a className="fm-sub" href={`/maps/${planId}/fiche?tab=leveranciers&lev=${x.sl.id}`}>Open</a>
          </div>
          {x.s.rijen.map((rij) => {
            const ids = rij.vrij ? [] : idsVan(x, rij);
            const el = !rij.vrij && rij.k ? k.elementen.find((e) => e.id === rij.k.split('|')[0]) : null;
            const st = rij.volgt ? 'volgt' : stand(rij);
            return (
              <div key={rij.id} style={{ padding: '5px 0' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <button className="fm-linkknop" style={{ all: 'unset', cursor: ids.length ? 'pointer' : 'default', flex: 1, minWidth: 0, fontSize: 13 }} disabled={!ids.length} onClick={() => onKiesItems(ids)} title={ids.length ? `${ids.length} items selecteren op de kaart` : undefined}>
                    {rij.r.wat}{locatieTekst(x.f, rij.r) ? <span className="fm-sub"> · {locatieTekst(x.f, rij.r)}</span> : null}
                  </button>
                  {x.s.vast && !rij.vrij && tekort(rij) && <span className={`fm-sub ${st === 'veel' ? 'pf-fout' : st === 'weinig' ? 'pf-let' : 'pf-ok'}`} style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{tekort(rij)}</span>}
                  {schrijven && el && <button className="fm-knop klein" onClick={() => onPlaats(el)} title={`${el.naam} kiezen om te plaatsen`}>Plaats</button>}
                </div>
                {rij.vrij ? <span className="fm-sub">{rij.besteld != null ? `${cijfer(rij.besteld)} · ` : ''}niet getekend</span>
                  : rij.besteld == null ? <span className="fm-sub">{cijfer(rij.geplaatst)} op de kaart</span> : <Balk n={rij.geplaatst} tot={rij.besteld} st={st} />}
              </div>
            );
          })}
          {x.s.nietBesteld.length > 0 && <div className="fm-sub pf-let">Niet in de bestelling: {x.s.nietBesteld.map((m) => `${m.aantal} × ${m.naam}`).join(', ')}</div>}
        </section>
      ))}
    </div>
  );
}

// Rechtermenu: bij welke bestelregel horen de geselecteerde items?
export function BestelBlok({ planId, items }) {
  const { lijst } = useBestellingen(planId);
  if (!lijst || !items?.length) return null;
  const sel = new Set(items.map((i) => i.id));
  const treffers = [];
  for (const x of lijst) for (const rij of x.s.rijen) if (!rij.vrij && idsVan(x, rij).some((id) => sel.has(id))) treffers.push({ x, rij });
  if (!treffers.length) return null;
  const lv = new Map((treffers[0].x.f.d.leveringen || []).map((l) => [l.id, l]));
  return (
    <div className="fm-sectie" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="fm-mat-lab">Bestelling</div>
      {treffers.slice(0, 4).map(({ x, rij }) => {
        const l = lv.get(rij.r.levering_id), o = lv.get(rij.r.ophaling_id); const st = rij.volgt ? 'volgt' : stand(rij);
        return (
          <div key={rij.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 13 }}><b style={{ fontWeight: 600 }}>{x.lev.naam}</b> · {rij.r.wat}</div>
            {rij.besteld == null ? <span className="fm-sub">{cijfer(rij.geplaatst)} op de kaart</span> : <Balk n={rij.geplaatst} tot={rij.besteld} st={st} />}
            <span className="fm-sub">{[x.s.vast ? tekort(rij) : 'loopt mee met de kaart', locatieTekst(x.f, rij.r), l && `${momentNaam(l).toLowerCase()} ${momentKort(x.f.plan, l)}`, o && `${momentNaam(o).toLowerCase()} ${momentKort(x.f.plan, o)}`].filter(Boolean).join(' · ')}</span>
            <a className="fm-sub" href={`/maps/${planId}/fiche?tab=leveranciers&lev=${x.sl.id}`}>Open de bestelling</a>
          </div>
        );
      })}
      {treffers.length > 4 && <span className="fm-sub">en nog {treffers.length - 4} regels</span>}
    </div>
  );
}
