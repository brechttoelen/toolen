'use client';

// Laadschermen met pulserende vakken in de vorm van wat er komt, in plaats van "Laden…".
export function Skelet({ b = '100%', h = 14, r = 6, style }) {
  return <span className="t-sk" style={{ width: b, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

// Breedtes wisselen per rij, zodat het op echte inhoud lijkt.
const BREED = ['62%', '48%', '71%', '55%', '66%', '44%', '58%', '69%'];

export function SkeletRijen({ rijen = 7, kolommen = [28, '1fr', '18%', '14%', 96], rijHoogte = 44, kop = true }) {
  const sjabloon = kolommen.map((k) => (typeof k === 'number' ? `${k}px` : k)).join(' ');
  return (
    <div className="t-sk-tabel" role="status" aria-label="Laden">
      {kop && <div className="t-sk-rij kop" style={{ gridTemplateColumns: sjabloon }}>{kolommen.map((_, i) => <Skelet key={i} h={10} b={i === 0 ? 14 : '40%'} />)}</div>}
      {Array.from({ length: rijen }, (_, n) => (
        <div key={n} className="t-sk-rij" style={{ gridTemplateColumns: sjabloon, height: rijHoogte, animationDelay: `${n * 60}ms` }}>
          {kolommen.map((k, i) => <Skelet key={i} h={i === 0 ? 14 : 12} b={i === 0 ? 14 : i === 1 ? BREED[n % BREED.length] : i === kolommen.length - 1 ? '80%' : '70%'} style={{ animationDelay: `${n * 60}ms` }} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletKaarten({ n = 3, hoogte = 150 }) {
  return (
    <div className="t-sk-kaarten" role="status" aria-label="Laden">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="t-sk-kaart" style={{ minHeight: hoogte }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><Skelet b="60%" h={16} /><Skelet b={32} h={22} /></div>
          <Skelet b="40%" h={11} />
          <Skelet h={44} r={8} style={{ marginTop: 6 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}><Skelet b="30%" h={11} /><span style={{ flex: 1 }} /><Skelet b={70} h={26} r={6} /></div>
        </div>
      ))}
    </div>
  );
}

// De fiche: kop met titel en tabs, een balk en een tabel.
export function SkeletFiche() {
  return (
    <div className="pf" role="status" aria-label="Fiche laden">
      <div className="pf-kop compact">
        <Skelet b={160} h={20} />
        <div style={{ display: 'flex', gap: 22, flex: 1, alignItems: 'center' }}>{[70, 64, 84, 66, 60, 56, 70, 64].map((b, i) => <Skelet key={i} b={b} h={12} />)}</div>
        <Skelet b={120} h={32} r={8} />
      </div>
      <div className="pf-plan">
        <div className="pf-planbalk"><Skelet b={360} h={32} r={8} /><Skelet b={240} h={32} r={10} /><Skelet b={70} h={32} r={8} /><span className="pf-vul" /><Skelet b={90} h={32} r={8} /><Skelet b={80} h={32} r={8} /></div>
        <div style={{ display: 'flex', gap: 4 }}>{Array.from({ length: 14 }, (_, i) => <Skelet key={i} b={62} h={44} r={8} />)}</div>
        <div className="pf-tabvak" style={{ maxHeight: 'none' }}><SkeletRijen rijen={9} kolommen={[28, 56, '1fr', '20%', '16%', 110]} /></div>
      </div>
    </div>
  );
}
