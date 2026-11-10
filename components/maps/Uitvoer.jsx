'use client';
import TerugKnop from './TerugKnop';

// Snel exporteren en importeren, zonder ontvanger: plannen per werkplek, lijsten en kaartbestanden.
// Wat een vaste ontvanger krijgt (deellink en PDF), staat in Delen en exporteren (Delen.jsx).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { heeftModule, nietInPakket } from './merk';
import { bestandMaken } from './uitvoer';
import LagenKiezer from './LagenKiezer';
import BestandDialoog from './BestandDialoog';
import { afsluitingenVan, afsluitingenCsv, afsluitingenPdf } from './afsluitingen';

const GROEPEN = [
  { id: 'werkplek', naam: 'Plannen per werkplek' },
  { id: 'lijst', naam: 'Lijsten' },
  { id: 'bestand', naam: 'Kaartbestanden' },
];

export default function Uitvoer({
  plan, lagen, fasen, items, elementenMap, actieveFase, schrijven, binnenHosts = [], kaart, startTab = 'exporteren', startId = null,
  onSluit, onPlan, onPdf, onExport, onSignPdf, onBinnenPdf, onMateriaal, onCad, onGeimporteerd, binnen = null,
}) {
  const [tab, setTab] = useState(startTab);
  const fase = fasen.find((f) => f.id === actieveFase) || null;

  const lijst = useMemo(() => {
    const l = [];
    const m = (mod) => !mod || heeftModule(mod);
    l.push({ id: 'stroomplan', groep: 'werkplek', naam: 'Stroomdossier', uitleg: 'Kaart met bronnen, kasten en kabels, eendraadschema en belasting per kast.', module: 'stroom', soort: 'export' });
    l.push({ id: 'veiligheidsplan', groep: 'werkplek', naam: 'Veiligheidsplan', uitleg: 'Kaart met nooduitgangen, blusmiddelen, hulpdienstenroutes en de toets aan het brandweerreglement.', module: 'veiligheid', soort: 'export' });
    l.push({ id: 'checklist', groep: 'werkplek', naam: 'Checklist brandweer', uitleg: 'Lijst om af te vinken bij de keuring ter plaatse.', module: 'veiligheid', soort: 'export' });
    l.push({ id: 'brandingplan', groep: 'werkplek', naam: 'Brandingplan', uitleg: 'Kaart met doeken, totems en vlaggen, met per plek het ontwerp.', module: 'branding', soort: 'export' });
    l.push({ id: 'signpdf', groep: 'werkplek', naam: 'Wegwijzers', uitleg: 'Per bordpunt de borden en de richting, om te plaatsen.', module: 'signalisatie', soort: 'sign' });
    l.push({ id: 'drukbestand', groep: 'werkplek', naam: 'Drukbestand borden', uitleg: 'Elk bord op ware grootte, klaar voor de drukker.', module: 'signalisatie', soort: 'export' });
    l.push({ id: 'verkeersplan', groep: 'werkplek', naam: 'Verkeersplan', uitleg: 'Afsluitingen en verkeersborden voor de politie en de gemeente.', module: 'signalisatie', soort: 'export' });
    binnenHosts.forEach((b) => l.push({ id: `binnen:${b.host}:${b.verd}`, groep: 'werkplek', naam: `Binnenplan ${b.naam}`, uitleg: 'Grondplan met inrichting, op A3.', module: 'binnen', soort: 'binnen', b }));
    l.push({ id: 'materiaal', groep: 'lijst', naam: 'Materiaal per leverancier', uitleg: 'Wat er nodig is, per leverancier, categorie of laag. Als Excel of PDF, met bestellijsten en leverlijsten.', soort: 'materiaal' });
    l.push({ id: 'bestellijst', groep: 'lijst', naam: 'Bestellijst borden', uitleg: 'Aantallen per bord en formaat, met reserve (CSV).', module: 'signalisatie', soort: 'export' });
    l.push({ id: 'verkeerlijst', groep: 'lijst', naam: 'Stuklijst verkeer', uitleg: 'Verkeersborden, nadars en afsluitingen (CSV).', module: 'signalisatie', soort: 'export' });
    l.push({ id: 'kabellijst', groep: 'lijst', naam: 'Kabellijst', uitleg: 'Elke kabel met type, lengte, van en naar (CSV).', module: 'stroom', soort: 'export' });
    l.push({ id: 'brandinglijst', groep: 'lijst', naam: 'Bestellijst branding', uitleg: 'Ontwerpen en aantallen voor de drukker (CSV).', module: 'branding', soort: 'export' });
    l.push({ id: 'wegafsluitingen', groep: 'lijst', naam: 'Wegafsluitingen', uitleg: 'Elke afgesloten straat met soort en tijdvenster: de lijst voor de politievergunning. Een afsluiting stel je in bij een lijn of punt, rechts bij Info.', soort: 'afsluitingen' });
    l.push({ id: 'kaartbestand', groep: 'bestand', naam: 'Google Earth, My Maps of QGIS', uitleg: 'De gekozen lagen of mappen, met kleuren en namen. KMZ en KML openen in Google Earth en My Maps, GeoJSON in QGIS.', soort: 'bestand' });
    l.push({ id: 'png', groep: 'bestand', naam: 'Afbeelding van het kaartbeeld', uitleg: 'Een PNG van wat je nu op het scherm ziet.', soort: 'png' });
    return l.map((x) => ({ ...x, slot: !m(x.module) }));
  }, [binnenHosts]);

  const [kies, setKies] = useState(() => (startId && lijst.some((x) => x.id === startId) ? startId : lijst[0].id));
  const gekozen = lijst.find((x) => x.id === kies) || lijst[0];
  const [bezig, setBezig] = useState('');
  const [melding, setMelding] = useState(null);
  const [kaartLagen, setKaartLagen] = useState(() => lagen.map((l) => l.id));
  useEffect(() => { setMelding(null); }, [kies]);

  const sluitRef = useRef(onSluit); sluitRef.current = onSluit;
  useEffect(() => {
    const t = (e) => { if (e.key === 'Escape' && !e.target?.closest?.('.fm-appdialoog-achter')) sluitRef.current(); };
    window.addEventListener('keydown', t); return () => window.removeEventListener('keydown', t);
  }, []);

  const doe = async (f, klaar = 'Klaar. Het bestand staat in je downloads.') => {
    setBezig('Bezig…'); setMelding(null);
    try { const r = await f(); setMelding({ soort: typeof r === 'string' ? '' : 'ok', tekst: typeof r === 'string' ? r : klaar }); }
    catch (e) { setMelding({ soort: 'fout', tekst: e?.message || String(e) }); }
    setBezig('');
  };
  const hoofdknop = (() => {
    const g = gekozen;
    if (g.slot) return null;
    if (g.soort === 'export') return { tekst: g.id.endsWith('lijst') ? 'Lijst maken' : 'PDF maken', doe: () => doe(() => onExport(g.id)) };
    if (g.soort === 'sign') return { tekst: 'PDF maken', doe: () => doe(() => onSignPdf()) };
    if (g.soort === 'binnen') return { tekst: 'PDF maken', doe: () => onBinnenPdf(g.b.host, g.b.verd) };
    if (g.soort === 'materiaal') return { tekst: 'Materiaal openen', doe: () => onMateriaal() };
    if (g.soort === 'png') return { tekst: 'Afbeelding maken', doe: () => doe(() => bestandMaken('png', { plan, lagen, items, elementenMap, kaart })) };
    return null;
  })();
  const fasenaam = fase ? fase.naam : 'Alle fasen';
  const toontFase = ['export', 'sign', 'binnen'].includes(gekozen.soort) && !gekozen.id.endsWith('lijst') && fasen.length > 0;

  return createPortal((
    <div className="fm fm-uitvoer-achter" onMouseDown={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <section className="fm-uitvoer" role="dialog" aria-label={tab === 'exporteren' ? 'Exporteren' : 'Importeren'}>
        <header className="fm-uitvoer-kop">
          <TerugKnop onClick={onSluit} />
          <div role="tablist" aria-label="Exporteren of importeren" className="fm-uitvoer-tabs">
            <button role="tab" aria-selected={tab === 'exporteren'} className={tab === 'exporteren' ? 'aan' : ''} onClick={() => setTab('exporteren')}>Exporteren</button>
            {schrijven && <button role="tab" aria-selected={tab === 'importeren'} className={tab === 'importeren' ? 'aan' : ''} onClick={() => setTab('importeren')}>Importeren</button>}
          </div>
          <span className="fm-uitvoer-plan">{plan.naam}</span>
        </header>

        {tab === 'exporteren' && (
          <div className="fm-uitvoer-romp">
            <nav className="fm-uitvoer-lijst" aria-label="Wat wil je maken">
              {GROEPEN.map((g) => {
                const rij = lijst.filter((x) => x.groep === g.id);
                if (!rij.length) return null;
                return (
                  <div key={g.id} className="fm-uitvoer-groep">
                    <div className="fm-uitvoer-groepnaam">{g.naam}</div>
                    {rij.map((x) => (
                      <button key={x.id} className={`${x.id === kies ? 'aan' : ''}${x.slot ? ' slot' : ''}`} aria-current={x.id === kies ? 'true' : undefined} onClick={() => setKies(x.id)}>
                        <span className="naam">{x.naam}</span>
                        {x.sub && <span className="sub">{x.sub}</span>}
                        {x.slot && <span className="sub">Niet in pakket</span>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>

            <div className="fm-uitvoer-detail">
              <h2>{gekozen.naam}</h2>
              <p className="fm-uitvoer-uitleg">{gekozen.uitleg}</p>

              {gekozen.slot && <p className="t-melding">{nietInPakket(gekozen.module)}</p>}
              {toontFase && <p className="fm-uitvoer-fase">Fase: <b>{fasenaam}</b>. Wissel van fase in het plan om een andere fase te exporteren.</p>}

              {gekozen.soort === 'bestand' && (
                <div className="fm-uitvoer-keuze">
                  <LagenKiezer lagen={lagen} ids={kaartLagen} onIds={setKaartLagen} compact />
                  <div className="t-rij" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {[['kmz', 'KMZ'], ['kml', 'KML'], ['geojson', 'GeoJSON']].map(([k, n]) => (
                      <button key={k} className="t-knop hoofd" disabled={!!bezig} onClick={() => doe(() => bestandMaken(k, { plan, lagen, items, elementenMap, laagIds: kaartLagen }))}>{n}</button>
                    ))}
                  </div>
                </div>
              )}

              {gekozen.soort === 'afsluitingen' && (() => {
                const n = afsluitingenVan(items).length;
                return n ? (
                  <div className="t-rij" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <button className="t-knop hoofd" disabled={!!bezig} onClick={() => doe(() => afsluitingenCsv(plan, items))}>Excel (CSV)</button>
                    <button className="t-knop" disabled={!!bezig} onClick={() => doe(() => afsluitingenPdf(plan, items))}>PDF</button>
                    <span className="fm-sub" style={{ alignSelf: 'center' }}>{n} {n === 1 ? 'afsluiting' : 'afsluitingen'}</span>
                  </div>
                ) : <p className="t-melding">Nog geen wegafsluitingen in dit plan.</p>;
              })()}
              {hoofdknop && (
                <div className="t-rij" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button className="t-knop hoofd fm-uitvoer-hoofd" disabled={!!bezig} onClick={hoofdknop.doe}>{bezig || hoofdknop.tekst}</button>
                </div>
              )}
              {melding && <p className={`t-melding ${melding.soort}`} style={{ marginTop: 12 }}>{melding.tekst}</p>}
            </div>
          </div>
        )}

        {tab === 'importeren' && (
          <div className="fm-uitvoer-import">
            <div className="fm-uitvoer-kaarten">
              <div className="fm-uitvoer-kaart">
                <h2>Kaartbestand</h2>
                <p>KML of KMZ uit Google My Maps, GPX, GeoJSON, of een lijst (CSV, Excel) met adressen of coördinaten. Elke map wordt een laag, met kleuren en namen.</p>
                <BestandDialoog ingebed binnen={binnen} plan={plan} lagen={lagen} items={items} elementenMap={elementenMap} schrijven={schrijven} onSluit={onSluit} onGeimporteerd={onGeimporteerd} />
              </div>
              {onCad && (
                <div className="fm-uitvoer-kaart">
                  <h2>Plan van een leverancier</h2>
                  <p>Een podium, stelling of VIP-tent uit AutoCAD of BricsCAD (PDF of DXF), als één object op ware grootte. Je kiest het bovenaanzicht, ruimt op en zet de schaal.</p>
                  <button className="t-knop hoofd" style={{ alignSelf: 'flex-start' }} onClick={onCad}>CAD-plan kiezen</button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  ), document.body);
}
