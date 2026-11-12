"use client";

import { useEffect } from "react";
import { meldFout } from "@/lib/foutmelden";

// Een scherm dat crasht: de fout gaat naar het platform, de gebruiker kan opnieuw proberen.
export default function Fout({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { meldFout(error, "Scherm gecrasht"); }, [error]);
  return (
    <div className="t-pagina">
      <main className="t-inhoud" style={{ maxWidth: 560 }}>
        <h1 className="t-titel">Er ging iets mis</h1>
        <p className="t-sub">Dit scherm kon niet getoond worden. De fout is automatisch gemeld; je werk dat al bewaard was, is veilig.</p>
        <p style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="t-knop hoofd" onClick={reset}>Opnieuw proberen</button>
          <a className="t-knop" href="/maps">Naar het overzicht</a>
        </p>
      </main>
    </div>
  );
}
