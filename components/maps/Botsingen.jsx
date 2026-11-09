'use client';

// Kaartjes bij een botsing met een collega: twee mensen wijzigden hetzelfde, of
// een collega verwijderde iets dat jij nog aanpaste. Nooit stil verlies.

const LEESBAAR = {
  geometrie: 'plaats en vorm', parameters: 'maten', stijl: 'opmaak', naam: 'naam', notitie: 'notitie',
  laag_id: 'laag', fase_ids: 'fasen', verborgen: 'zichtbaarheid', vergrendeld: 'vergrendeling', groep_id: 'groep',
  element_id: 'element', volgorde: 'volgorde',
};
const VELD = { sign: 'bordpunt', stroom: 'elektriciteit', doeken: 'doeken', inrichting: 'inrichting', verdieping: 'verdieping', personen: 'personen', publiek: 'publiek', attesten: 'attesten', toebehoren: 'toebehoren' };
export function padTekst(paden) {
  const t = (paden || []).map((p) => {
    const [k, s] = p.split('.');
    if (k === 'velden') return VELD[s] || s;
    return LEESBAAR[k] || k;
  });
  return [...new Set(t)].join(', ') || 'dit item';
}

export default function Botsingen({ lijst, naamVan, onKies, onToon }) {
  if (!lijst.length) return null;
  return (
    <div className="fm-botsingen" role="alert" aria-live="polite">
      {lijst.map((b) => (
        <div key={b.id} className="fm-botsing">
          <div className="fm-botsing-tekst">
            {b.soort === 'botsing'
              ? <><b>{b.naam}</b> wijzigde ook de {padTekst(b.paden)} van <b>{naamVan(b.mijn)}</b>. Welke versie houden?</>
              : <><b>{b.naam}</b> verwijderde <b>{naamVan(b.mijn)}</b> terwijl jij het aanpaste.</>}
          </div>
          <div className="fm-botsing-knoppen">
            <button className="fm-knop klein" onClick={() => onToon(b)}>Toon</button>
            {b.soort === 'botsing' ? (
              <>
                <button className="fm-knop klein" onClick={() => onKies(b, 'hun')}>Versie van {b.naam}</button>
                <button className="fm-knop klein zwart" onClick={() => onKies(b, 'mijn')}>Mijn versie</button>
              </>
            ) : (
              <>
                <button className="fm-knop klein" onClick={() => onKies(b, 'hun')}>Verwijderd laten</button>
                <button className="fm-knop klein zwart" onClick={() => onKies(b, 'mijn')}>Terugzetten</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
