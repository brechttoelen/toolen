// Eigen foutmonitoring: een fout uit de browser naar de databank (maps.fout_melden), zonder externe dienst.
// Enkel de melding, de plek in de code, de pagina zonder zoekdeel, de versie en het toestel. Geen inhoud van plannen.

const RUIS = /ResizeObserver loop|^Script error\.?$|Load failed|Failed to fetch|NetworkError|AbortError|The operation was aborted|cancelled|Non-Error promise rejection|chrome-extension:|moz-extension:|safari-web-extension:/i;
let aantal = 0;
const gezien = new Set<string>();

export function meldFout(fout: unknown, extra = "") {
  try {
    if (typeof window === "undefined") return;
    const e = fout as { message?: string; stack?: string } | string | null;
    const bericht = (typeof e === "string" ? e : e?.message || String(e || "")).slice(0, 500);
    const stapel = (typeof e === "object" && e?.stack ? String(e.stack) : "").slice(0, 4000);
    if (!bericht || RUIS.test(bericht) || RUIS.test(stapel)) return;
    // Hoogstens 5 per paginabezoek en elke melding één keer: een fout in een lus mag niets overspoelen.
    const sleutel = bericht + stapel.split("\n")[1];
    if (aantal >= 5 || gezien.has(sleutel)) return;
    aantal++; gezien.add(sleutel);
    const host = window.location.hostname;
    const p = {
      bericht: extra ? `${extra}: ${bericht}` : bericht, stapel,
      adres: window.location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id").replace(/\/d\/[^/]+/, "/d/:token"),
      versie: process.env.NEXT_PUBLIC_VERSIE || "", toestel: navigator.userAgent.slice(0, 200),
      organisatie: host.split(".").length > 2 ? host.split(".")[0] : "",
    };
    import("./supabase/client").then(({ supabaseBrowser }) => supabaseBrowser().rpc("fout_melden", { p })).then(() => {}, () => {});
  } catch { /* melden mag zelf nooit iets breken */ }
}
