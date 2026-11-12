import { ToolenWoordmerk } from "@/components/ToolenLogo";
import { PlanScene, Momenten } from "@/components/Inlogkader";

// toolen.be: bedrijfssite (voorlopig een eenvoudige startpagina), met hetzelfde plan dat zich opbouwt als op de loginpagina.
export default function Home() {
  return (
    <div className="t-home">
      <header className="t-home-kop">
        <ToolenWoordmerk op="navy" product="maps" grootte={26} />
        <a href="/login" className="t-knop" style={{ marginLeft: "auto", background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>Inloggen</a>
      </header>
      <main className="t-home-hero">
        <div className="t-home-tekst">
          <h1 className="t-titel t-inlog-titel" style={{ marginTop: 0 }}>Uitgetekend.</h1>
          <p className="t-inlog-onder" style={{ margin: 0 }}>Van eerste lijn tot laatste spandoek.</p>
          <p className="t-home-uitleg">Je eventsite op schaal, op luchtfoto en lijntekening. Met stroom, signalisatie, branding en bouwers, gedeeld met iedereen die het moet weten.</p>
          <p style={{ margin: "8px 0 0" }}><a href="/login" className="t-knop hoofd">Inloggen</a></p>
          <Momenten />
        </div>
        <PlanScene className="t-scene-home" />
      </main>
    </div>
  );
}
