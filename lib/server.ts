import { NextResponse, type NextRequest } from "next/server";
import { HOOFDDOMEIN } from "./org";

// Hulp voor API-routes.

// Basisadres voor links in mails: op toolen.be altijd login.toolen.be, anders de eigen host (preview, lokaal).
export function basisAdres(req: NextRequest): string {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  const h = host.split(":")[0];
  if (h === HOOFDDOMEIN || h.endsWith(`.${HOOFDDOMEIN}`)) return `https://login.${HOOFDDOMEIN}`;
  // In productie nooit een host uit de aanvraag in een mail (anders kan een vervalste host een herstellink kapen).
  if (process.env.VERCEL_ENV === "production" || !host) return `https://login.${HOOFDDOMEIN}`;
  const proto = req.headers.get("x-forwarded-proto") || (h === "localhost" || h.endsWith(".localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const fout = (tekst: string, status = 400) => NextResponse.json({ fout: tekst }, { status });
export const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });

// Een fout uit Postgres of Supabase als leesbare tekst.
export function foutTekst(e: unknown): string {
  return (e as { message?: string })?.message || String(e);
}

export async function json<T>(req: NextRequest): Promise<Partial<T>> {
  try { return (await req.json()) as Partial<T>; } catch { return {}; }
}
