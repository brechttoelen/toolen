import { ADRES, BRON_INFO, DIENSTEN } from "@/components/maps/bronadressen";

// Dagelijkse controle van de externe kaartdiensten: van elke bron één tegel (of één antwoord) opvragen.
// Die diensten zijn gratis en geven geen garantie; zo weet platformbeheer het vóór een klant het merkt.

export type BronUitslag = { bron: string; naam: string; soort: string; ok: boolean; status: number | null; ms: number; fout: string };

const R = 20037508.342789244;
function tegel([lng, lat]: number[], z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  const maat = (2 * R) / n;
  const west = -R + x * maat; const noord = R - y * maat;
  return { x, y, bbox: `${west},${noord - maat},${west + maat},${noord}` };
}

export function testAdres(bron: string): string {
  const info = (BRON_INFO as Record<string, { punt?: number[]; zoom?: number }>)[bron];
  const sjabloon = (ADRES as Record<string, string>)[bron];
  if (!info?.punt) return sjabloon;
  const z = info.zoom || 15;
  const t = tegel(info.punt, z);
  return sjabloon.replace("{zz}", String(z).padStart(2, "0")).replace("{z}", String(z)).replace("{x}", String(t.x)).replace("{y}", String(t.y)).replace("{bbox-epsg-3857}", t.bbox);
}

async function vraag(bron: string, naam: string, soort: string, adres: string): Promise<BronUitslag> {
  const start = Date.now();
  const stop = new AbortController(); const klok = setTimeout(() => stop.abort(), 12000);
  try {
    // De diensten van OpenStreetMap vragen een herkenbare afzender.
    const r = await fetch(adres, { signal: stop.signal, cache: "no-store", headers: { "user-agent": "ToolenMaps-bronnencontrole/1.0 (+https://toolen.be)", referer: "https://toolen.be/" } });
    const type = r.headers.get("content-type") || "";
    const lijf = await r.arrayBuffer();
    const ms = Date.now() - start;
    let fout = "";
    if (!r.ok) fout = `Antwoord ${r.status}`;
    else if (soort === "tegel" && !type.startsWith("image/")) fout = `Geen afbeelding (${type.split(";")[0] || "onbekend type"})`;
    else if (soort === "tegel" && lijf.byteLength < 200) fout = "Lege tegel";
    else if (soort === "json") { try { JSON.parse(new TextDecoder().decode(lijf)); } catch { fout = "Geen geldig antwoord"; } }
    return { bron, naam, soort, ok: !fout, status: r.status, ms, fout };
  } catch (e) {
    const afgebroken = (e as { name?: string })?.name === "AbortError";
    return { bron, naam, soort, ok: false, status: null, ms: Date.now() - start, fout: afgebroken ? "Geen antwoord binnen 12 s" : "Niet bereikbaar" };
  } finally { clearTimeout(klok); }
}

export async function controleerKaartbronnen(): Promise<BronUitslag[]> {
  const lijst: { bron: string; naam: string; soort: string; adres: string }[] = [];
  for (const [bron, info] of Object.entries(BRON_INFO as Record<string, { naam: string; soort?: string }>)) lijst.push({ bron, naam: info.naam, soort: info.soort || "tegel", adres: testAdres(bron) });
  for (const [bron, d] of Object.entries(DIENSTEN as Record<string, { naam: string; adres: string }>)) lijst.push({ bron, naam: d.naam, soort: "json", adres: d.adres });
  const doe = (l: typeof lijst) => Promise.all(l.map((b) => vraag(b.bron, b.naam, b.soort, b.adres)));
  const uit = await doe(lijst);
  // Eén mislukte poging is nog geen storing: wat faalde, na een korte pauze nog één keer proberen.
  const mis = lijst.filter((b) => !uit.find((u) => u.bron === b.bron)?.ok);
  if (mis.length) {
    await new Promise((r) => setTimeout(r, 2500));
    for (const n of await doe(mis)) { const i = uit.findIndex((u) => u.bron === n.bron); if (i >= 0) uit[i] = n; }
  }
  return uit;
}
