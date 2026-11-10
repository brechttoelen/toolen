import { ToolenWoordmerk } from "./ToolenLogo";

// Momenten uit een eventweek, wisselend onder de titel.
const MOMENTEN = [
  ["Vrijdag 14:10", "De tentenbouwer opent zijn link."],
  ["Vrijdag 15:32", "De elektricien controleert zijn stroomplan."],
  ["Zaterdag 07:45", "De eerste ploeg bouwt volgens plan."],
  ["Zondag 15:42", "De renners komen binnen."],
];

// Een plan dat zichzelf tekent: wegen, parcours, hekken, tenten, stroom en een maat. Enkel CSS, stopt bij "minder beweging".
function PlanScene() {
  return (
    <svg className="t-scene" viewBox="0 0 600 400" role="img" aria-label="Een eventplan dat zich opbouwt: parcours, hekken, tenten en stroom">
      <defs>
        <pattern id="t-scene-raster" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#0B2C6B" strokeWidth="1" /></pattern>
        <pattern id="t-scene-dam" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#fff" /><rect x="4" y="4" width="4" height="4" fill="#fff" /></pattern>
      </defs>
      <rect width="600" height="400" fill="url(#t-scene-raster)" />
      <path d="M-20 250 C 120 230, 220 280, 360 250 S 560 200, 640 215" stroke="#0E3170" strokeWidth="34" fill="none" strokeLinecap="round" />
      <path d="M300 -20 L 330 420" stroke="#0E3170" strokeWidth="22" fill="none" />
      <path className="t-sc-parcours" pathLength="100" d="M-20 250 C 120 230, 220 280, 360 250 S 560 200, 640 215" stroke="#108AED" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect className="t-sc-finish" x="452" y="214" width="8" height="40" fill="url(#t-scene-dam)" transform="rotate(-8 456 234)" />
      <path className="t-sc-hek" pathLength="100" d="M70 214 C 170 200, 240 246, 360 222 S 520 180, 600 186" stroke="#F2A33A" strokeWidth="2.5" strokeDasharray="6 4" fill="none" />
      <path className="t-sc-hek t-sc-hek2" pathLength="100" d="M70 290 C 170 270, 240 316, 360 284 S 520 244, 600 250" stroke="#F2A33A" strokeWidth="2.5" strokeDasharray="6 4" fill="none" />
      <g className="t-sc-tent" style={{ animationDelay: "2.2s" }}><rect x="380" y="70" width="120" height="76" rx="3" /><path d="M380 108 H500" /></g>
      <g className="t-sc-tent" style={{ animationDelay: "2.6s" }}><rect x="400" y="300" width="84" height="56" rx="3" /></g>
      <g className="t-sc-tent" style={{ animationDelay: "3s" }}><rect x="120" y="96" width="70" height="70" rx="3" /><circle cx="155" cy="131" r="12" /></g>
      <path className="t-sc-kabel" pathLength="100" d="M90 360 L 150 330 L 250 330 L 330 300 L 420 300" stroke="#28B571" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" fill="none" />
      <g className="t-sc-kast"><rect x="82" y="352" width="16" height="16" rx="3" fill="#28B571" /><rect x="242" y="322" width="16" height="16" rx="3" fill="#28B571" /></g>
      <g className="t-sc-maat"><path d="M380 56 H500 M380 50 V62 M500 50 V62" stroke="#DCE6F5" strokeWidth="1.2" /><text x="440" y="46" textAnchor="middle">25,0 m</text></g>
      <g className="t-sc-label" style={{ animationDelay: "3.4s" }}><rect x="384" y="150" width="98" height="22" rx="5" fill="#fff" /><text x="394" y="165" fill="#022056">VIP 15 × 25</text></g>
      <g className="t-sc-label" style={{ animationDelay: "3.8s" }}><rect x="430" y="176" width="58" height="22" rx="5" fill="#108AED" /><text x="440" y="191" fill="#fff">Finish</text></g>
      <g className="t-sc-label" style={{ animationDelay: "4.2s" }}><rect x="100" y="372" width="82" height="22" rx="5" fill="#28B571" /><text x="110" y="387" fill="#fff">Kast 63 A</text></g>
    </svg>
  );
}

// Navy vlak links met een plan dat zich opbouwt, inhoud rechts. Voor inloggen, organisatie kiezen, uitnodigingen en MFA.
export default function Inlogkader({ titel, children }: { titel?: string; children: React.ReactNode }) {
  return (
    <div className="t-inlog">
      <section className="t-inlog-merk" aria-label="Toolen Maps">
        <ToolenWoordmerk op="navy" product="maps" grootte={26} />
        <PlanScene />
        <h1 className="t-titel t-inlog-titel">{titel || "Uitgetekend."}</h1>
        {!titel && <p className="t-inlog-onder">Van eerste lijn tot laatste stroomkabel.</p>}
        <div className="t-momenten" aria-live="off">
          {MOMENTEN.map(([wanneer, wat], i) => (
            <p key={wanneer} className="t-moment" style={{ animationDelay: `${i * 4}s` }}><b>{wanneer}</b>{wat}</p>
          ))}
        </div>
      </section>
      <section className="t-inlog-vak">
        <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
      </section>
    </div>
  );
}
