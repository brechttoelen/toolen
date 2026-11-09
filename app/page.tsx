import Link from "next/link";

// toolen.be: bedrijfssite (voorlopig een eenvoudige startpagina).
export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}>
      <h1 style={{ fontSize: 40, fontWeight: 600, margin: 0 }}>Toolen</h1>
      <p style={{ fontSize: 18, color: "#555", marginTop: 12 }}>
        Toolen Maps: eventsites plannen op schaal, met stroom, signalisatie, stellingen en branding.
      </p>
      <p style={{ marginTop: 32 }}>
        <Link href="/login" style={{ background: "#1d1d1b", color: "#fff", padding: "10px 18px", textDecoration: "none" }}>
          Inloggen
        </Link>
      </p>
    </main>
  );
}
