import { ToolenWoordmerk } from "@/components/ToolenLogo";

// toolen.be: bedrijfssite (voorlopig een eenvoudige startpagina).
export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--t-navy)", color: "#fff" }}>
      <header style={{ maxWidth: 1120, margin: "0 auto", padding: "24px", display: "flex", alignItems: "center" }}>
        <ToolenWoordmerk op="navy" />
        <a href="/login" className="t-knop" style={{ marginLeft: "auto", background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>Inloggen</a>
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "96px 24px" }}>
        <p style={{ color: "var(--t-groen)", fontWeight: 500, margin: 0 }}>Toolen Maps</p>
        <h1 style={{ fontSize: 48, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.02em", margin: "12px 0 0", maxWidth: 720 }}>
          Je eventsite op schaal. Elke zone, elke kabel, elk bord op zijn plek.
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.72)", maxWidth: 620, marginTop: 20 }}>
          Plannen op luchtfoto en lijntekening, met stroom, signalisatie, stellingen en branding. Gedeeld met iedereen die het moet weten.
        </p>
        <p style={{ marginTop: 32 }}><a href="/login" className="t-knop hoofd">Inloggen</a></p>
      </main>
    </div>
  );
}
