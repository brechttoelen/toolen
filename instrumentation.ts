// Fouten op de server (pagina's en API-routes) naar de eigen foutmonitoring (maps.fout_melden).
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string }) {
  try {
    const e = err as { message?: string; stack?: string; digest?: string };
    const bericht = String(e?.message || err || "").slice(0, 500);
    // Doorverwijzingen en "niet gevonden" zijn geen fouten.
    if (!bericht || /NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/.test(bericht + (e?.digest || ""))) return;
    const { adminIngesteld, supabaseAdmin } = await import("@/lib/supabase/admin");
    if (!adminIngesteld()) return;
    await supabaseAdmin().rpc("fout_melden", { p: {
      bron: "server", bericht: `${request.method} ${context.routeType || ""}: ${bericht}`.slice(0, 500), stapel: String(e?.stack || "").slice(0, 4000),
      adres: context.routePath || request.path.split("?")[0], versie: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7),
    } });
  } catch { /* melden mag zelf nooit iets breken */ }
}
