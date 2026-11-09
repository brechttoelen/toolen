import { ToolenWoordmerk } from "./ToolenLogo";

// Navy vlak links met het merk, inhoud rechts. Voor inloggen, organisatie kiezen en uitnodigingen.
export default function Inlogkader({ titel, children }: { titel?: string; children: React.ReactNode }) {
  return (
    <div className="t-inlog">
      <section className="t-inlog-merk" aria-label="Toolen Maps">
        <ToolenWoordmerk op="navy" product="maps" />
        <h1 className="t-titel" style={{ color: "#fff", fontSize: 42, marginTop: "auto", maxWidth: 520 }}>{titel || "Het plan van je event, op schaal en op één plek."}</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "#C9D6EA", maxWidth: 460 }}>Tekenen op de luchtfoto, stroom en signalisatie berekenen, en delen met de stad, de politie en je leveranciers.</p>
      </section>
      <section className="t-inlog-vak">
        <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
      </section>
    </div>
  );
}
