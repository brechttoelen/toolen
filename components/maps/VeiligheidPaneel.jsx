'use client';

import { useEffect, useMemo, useState } from 'react';
import Info from './info';
import { tentChecklist, controleBrand, instBrand, zoneVoorTekst } from './veiligheid';
import { opDeGrond, afstand } from './controle';
import { Brandveiligheid } from './ControlePaneel';

// Linkerpaneel van de werkruimte Veiligheid: zone (automatisch), checklist per publieke tent, terrein.
export default function VeiligheidPaneel({ plan, items, elementenMap, schrijven, onPlan, onKiesItem, geselecteerd, onUitgangTekenen, onTool }) {
  const ib = instBrand(plan);
  const b = plan.instellingen?.brandveiligheid || {};
  const zet = (patch) => onPlan({ instellingen: { ...(plan.instellingen || {}), brandveiligheid: { ...b, ...patch } } });
  const check = useMemo(() => tentChecklist({ plan, items, elementenMap, opDeGrond, afstand }), [plan, items, elementenMap]);
  const meldingen = useMemo(() => controleBrand({ plan, items, elementenMap, opDeGrond, afstand }), [plan, items, elementenMap]);
  const R = check.R;

  // Zone automatisch: gemeente uit de kaart (Nominatim) → zone; de keuze blijft aanpasbaar.
  const [gekozenOp, setGekozenOp] = useState(null);
  const punt = useMemo(() => {
    const ps = items.filter((i) => i.geometrie).map((i) => (i.geometrie.type === 'Point' ? i.geometrie.coordinates : i.geometrie.type === 'Polygon' ? i.geometrie.coordinates[0][0] : i.geometrie.coordinates[0]));
    if (ps.length) return [ps.reduce((a, p) => a + p[0], 0) / ps.length, ps.reduce((a, p) => a + p[1], 0) / ps.length].map((v) => Math.round(v * 1000) / 1000);
    return Array.isArray(plan.centrum) ? plan.centrum : null;
  }, [items, plan.centrum]);
  useEffect(() => {
    if (b.zone || !punt || !schrijven || ib.aan === false) return undefined;
    let weg = false;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=nl&lon=${punt[0]}&lat=${punt[1]}`)
      .then((r) => r.json()).then((j) => {
        if (weg) return;
        const namen = [j.name, j.address?.municipality, j.address?.city, j.address?.town, j.address?.village].filter(Boolean);
        const v = namen.map((g) => zoneVoorTekst(g)).find(Boolean) || zoneVoorTekst(`${plan.locatie || ''} ${plan.naam || ''}`);
        if (v) { zet({ zone: v.zone.id }); setGekozenOp(v.gemeente); }
      }).catch(() => {});
    return () => { weg = true; };
  }, [b.zone, punt?.[0], punt?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const terrein = [
    { id: 'toegang', label: 'Brandweertoegang', ok: check.soort('brandweertoegang').length + check.soort('opstelplaats').length > 0, tekst: check.soort('brandweertoegang').length ? `${check.soort('brandweertoegang').length} getekend${R.brandweer?.breedte_m ? ` · ${R.brandweer.breedte_m} m vrij` : ''}` : 'nog niet getekend', tool: 'brandweer', meld: meldingen.filter((m) => /brandweertoegang|opstelplaats/.test(m.tekst) && m.soort !== 'info') },
    { id: 'verzamel', label: 'Verzamelplaats', ok: check.soort('verzamelplaats').length > 0, tekst: check.soort('verzamelplaats').length ? `${check.soort('verzamelplaats').length} aangeduid` : 'nog geen', tool: 'verzamel', meld: [] },
    { id: 'generator', label: 'Generatoren buiten de tent', ok: !meldingen.some((m) => /generatoren|gasflessen/.test(m.tekst)), tekst: meldingen.some((m) => /generatoren|gasflessen/.test(m.tekst)) ? 'staat in of tegen een tent' : 'in orde', meld: meldingen.filter((m) => /generatoren|gasflessen/.test(m.tekst)) },
    { id: 'vluchtweg', label: 'Vluchtwegen vrij', ok: !meldingen.some((m) => /vluchtweg/.test(m.tekst)), tekst: check.soort('vluchtweg').length ? `${check.soort('vluchtweg').length} getekend` : 'geen vluchtweg getekend', tool: 'vluchtweg', meld: meldingen.filter((m) => /vluchtweg/.test(m.tekst)) },
  ];
  const Vink = ({ ok, ernst = 'fout' }) => <span className={`fm-vink-status ${ok ? 'ok' : ernst === 'fout' ? 'fout' : 'waarsch'}`} aria-label={ok ? 'in orde' : ernst}>{ok ? '✓' : ernst === 'fout' ? '✕' : '!'}</span>;
  const regelsZone = R.uitgangen?.tabel
    ? `${R.uitgangen.tabel.map(([max, n], i, a) => `${n} ${max == null ? `vanaf ${(a[i - 1]?.[0] ?? 0) + 1}` : `tot ${max}`} p`).join(', ')}`
    : `min. ${R.min_uitgangen} uitgangen`;

  return (
    <div>
      <div className="fm-sectie">
        <div className="fm-kop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1 }}>{ib.zone ? ib.zone.kort || ib.zone.naam : 'Geen brandweerzone'}</span>
          {ib.zone?.bron_url && <a className="fm-sub" href={ib.zone.bron_url} target="_blank" rel="noreferrer">reglement</a>}
          <Info>De zone wordt gekozen op basis van de plek op de kaart. Anders kiezen of waarden aanpassen: open "Zone en waarden" hieronder.</Info>
        </div>
        <div className="fm-sub">{gekozenOp ? `Gekozen op basis van de kaart (${gekozenOp}) · ` : ''}{regelsZone} · {R.cm_per_persoon} cm per persoon · {R.max_afstand_uitgang_m} m tot een uitgang · 1 blusser per {R.blusser_per_m2} m²</div>
        {ib.zone?.zonder_reglement && <div className="fm-sub" style={{ color: '#B45309' }}>Geen zonaal reglement gevonden: richtwaarden tot de brandweer bevestigt.</div>}
        <details className="fm-meer"><summary>Zone en waarden</summary><Brandveiligheid plan={plan} items={items} schrijven={schrijven} onPlan={onPlan} /></details>
      </div>

      <div className="fm-sectie">
        <div className="fm-kop">Tenten en publieke ruimtes · {check.tenten.length}</div>
        {!check.tenten.length && <div className="fm-leeglijst"><strong>Geen publieke tent</strong>Zet een tent op de kaart; tenten gelden standaard als publiek toegankelijk (rechts bij Veiligheid aan of uit te zetten).</div>}
        {check.tenten.map((c) => {
          const open = c.id === geselecteerd;
          return (
            <div key={c.id} className={`fm-tentkaart${open ? ' aan' : ''}`}>
              <button className="kop" onClick={() => onKiesItem(c.id)}>
                <Vink ok={!c.fouten} ernst={c.fouten ? 'fout' : c.waarschuwingen ? 'waarschuwing' : 'fout'} />
                <span className="naam">{c.naam}</span>
                <span className="fm-sub">{c.personen} p</span>
              </button>
              {(open || c.fouten > 0 || c.waarschuwingen > 0) && (
                <div className="regels">
                  {c.regels.map((r) => <div key={r.id} className="regel"><Vink ok={r.ok} ernst={r.ernst} /><span style={{ flex: 1 }}>{r.label}</span><span>{r.waarde}</span></div>)}
                  {!c.fouten && !c.waarschuwingen && <div className="fm-sub">Alles in orde.</div>}
                  {schrijven && open && (c.regels.find((r) => r.id === 'uitgangen' && !r.ok) || c.regels.find((r) => r.id === 'breedte' && !r.ok)) && (
                    <button className="fm-knop klein" style={{ background: '#DC2626', color: '#fff', borderColor: '#DC2626' }} onClick={() => onUitgangTekenen(c.it)}>Uitgang tekenen</button>
                  )}
                  {schrijven && open && c.regels.find((r) => r.id === 'blussers' && !r.ok) && <button className="fm-knop klein" onClick={() => onTool?.('blusser')}>Blusser plaatsen</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fm-sectie">
        <div className="fm-kop">Terrein</div>
        {terrein.map((t) => (
          <div key={t.id} className="fm-terreinregel">
            <div className="regel"><Vink ok={t.ok} ernst={t.id === 'verzamel' ? 'waarschuwing' : 'fout'} /><span style={{ flex: 1 }}>{t.label}</span><span className="fm-sub">{t.tekst}</span></div>
            {t.meld.map((m, i) => <button key={i} className="meld" onClick={() => m.id && onKiesItem(m.id)}>{m.tekst}</button>)}
            {schrijven && !t.ok && t.tool && <button className="fm-knop klein" style={{ alignSelf: 'flex-start' }} onClick={() => onTool?.(t.tool)}>{t.id === 'toegang' ? 'Brandweertoegang tekenen' : t.id === 'verzamel' ? 'Verzamelplaats zetten' : 'Vluchtweg tekenen'}</button>}
          </div>
        ))}
      </div>
      <div className="fm-sectie fm-sub">Hulp bij de aanvraag, geen goedkeuring.<Info>De brandweer beslist. Dit paneel volgt het zonaal evenementenreglement; het veiligheidsplan (PDF) bevat de bron.</Info></div>
    </div>
  );
}

// Rechterpaneel in de werkruimte Veiligheid voor een publieke tent: wat er is, wat ontbreekt, uitgang tekenen.
export function VeiligheidDetail({ c, R, ib, schrijven, onUitgang, onPersonen, onPubliek }) {
  const ontbreekt = [];
  const u = c.regels.find((r) => r.id === 'uitgangen'); const b = c.regels.find((r) => r.id === 'breedte'); const bl = c.regels.find((r) => r.id === 'blussers'); const af = c.regels.find((r) => r.id === 'afstand');
  if (u && !u.ok) ontbreekt.push(`${u.tekort} uitgang${u.tekort === 1 ? '' : 'en'} extra (min. ${R.min_breedte_uitgang_cm} cm)`);
  if (b && !b.ok) ontbreekt.push(`samen ${b.tekort} cm uitgangsbreedte erbij`);
  if (c.bredeNodig && !c.bredeOk) ontbreekt.push(`één uitgang van ${R.brede_route.breedte_cm} cm`);
  if (af && !af.ok) ontbreekt.push(`een uitgang dichterbij: verste plek ${af.waarde}`);
  if (bl && !bl.ok) ontbreekt.push(`${bl.tekort} blustoestel${bl.tekort === 1 ? '' : 'len'} extra`);
  const uitgangenTabel = R.uitgangen?.tabel ? R.uitgangen.tabel.map(([max, n], i, a) => `${n} ${max == null ? `vanaf ${(a[i - 1]?.[0] ?? 0) + 1}` : `tot ${max}`} p`).join(', ') : `min. ${R.min_uitgangen}`;
  return (
    <div className="fm-paneel-inhoud">
      <div className="fm-sectie">
        <label className="fm-vink"><input type="checkbox" checked={c.it.velden?.publiek ?? true} disabled={!schrijven} onChange={(e) => onPubliek(e.target.checked)} />Publiek toegankelijk</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input key={`p-${c.id}-${c.it.velden?.personen ?? ''}`} inputMode="numeric" disabled={!schrijven} style={{ width: 70 }} defaultValue={c.it.velden?.personen ?? ''} placeholder={String(c.personen)}
            onBlur={(e) => { const v = e.target.value.trim() === '' ? null : Math.round(Number(e.target.value)); if (v === null || v >= 0) onPersonen(v); }} />
          <span className="fm-sub">personen ({Math.round(c.opp)} m²{c.it.velden?.personen != null ? '' : `, ${R.personen_per_m2} p/m²`})</span>
        </div>
      </div>
      <div className="fm-sectie">
        <div className="fm-kop">Checklist</div>
        {c.regels.map((r) => <div key={r.id} className="regel" style={{ display: 'flex', gap: 6, fontSize: 12 }}><span className={`fm-vink-status ${r.ok ? 'ok' : r.ernst === 'fout' ? 'fout' : 'waarsch'}`}>{r.ok ? '✓' : r.ernst === 'fout' ? '✕' : '!'}</span><span style={{ flex: 1 }}>{r.label}</span><span>{r.waarde}</span></div>)}
      </div>
      {ontbreekt.length > 0 && (
        <div className="fm-sectie" style={{ background: '#FEF2F2' }}>
          <div className="fm-kop">Wat ontbreekt</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{ontbreekt.map((t, i) => <li key={i}>{t}</li>)}</ul>
          {schrijven && (u && !u.ok || b && !b.ok || af && !af.ok) && <button className="fm-knop" style={{ background: '#DC2626', color: '#fff', borderColor: '#DC2626', fontWeight: 600 }} onClick={onUitgang}>Uitgang tekenen op de tentwand</button>}
        </div>
      )}
      {!ontbreekt.length && <div className="fm-sectie"><div className="fm-sub" style={{ color: '#0E6B48' }}>Alles in orde voor deze tent.</div></div>}
      <div className="fm-sectie fm-sub">
        {ib.zone ? `Zone ${ib.zone.kort || ib.zone.naam}` : 'Richtwaarden'}: {uitgangenTabel} · {R.cm_per_persoon} cm per persoon · {R.max_afstand_uitgang_m} m tot een uitgang · 1 blusser per {R.blusser_per_m2} m²
        {ib.zone?.bron_url && <> · <a href={ib.zone.bron_url} target="_blank" rel="noreferrer">bron</a></>}
      </div>
    </div>
  );
}
