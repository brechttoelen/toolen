import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fout } from "@/lib/server";
import { dwgNaarDxf } from "@/lib/dwgNaarDxf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Groter dan dit laat het platform niet door in één aanvraag.
const MAX = 4 * 1024 * 1024;

// Een DWG omzetten naar DXF-tekst; de browser leest die verder zoals een gewone DXF.
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fout("Niet ingelogd.", 401);
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) return fout("Leeg bestand.");
  if (buf.byteLength > MAX) return fout("Deze DWG is groter dan 4 MB. Bewaar ze in je CAD-programma als DXF, of zet overbodige lagen uit.", 413);
  if (new TextDecoder("latin1").decode(buf.slice(0, 2)) !== "AC") return fout("Dit is geen DWG-bestand.");
  try {
    const { LibreDwg, Dwg_File_Type } = await import("@mlightcad/libredwg-web");
    const lib = await LibreDwg.create();
    const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
    if (!dwg) return fout("Deze DWG kon niet gelezen worden. Bewaar ze in je CAD-programma als DXF.");
    const db = lib.convert(dwg);
    lib.dwg_free(dwg);
    const { tekst, aantal } = dwgNaarDxf(db as never);
    if (!aantal) return fout("Geen lijnen of teksten gevonden in deze DWG (misschien staat alles in een gekoppelde tekening).");
    return new Response(tekst, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return fout("Deze DWG kon niet gelezen worden. Bewaar ze in je CAD-programma als DXF.");
  }
}
