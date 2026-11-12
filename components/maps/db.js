'use client';

// Supabase-clients voor Toolen Maps.
// Alle data zit in het schema `maps`.
// createBrowserClient is een singleton per project: sb hier is dezelfde sessie
// als in de rest van de app, alleen het schema verschilt.
import { createBrowserClient } from '@supabase/ssr';
import { cookieOpties } from '@/lib/supabase/cookie';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase/env';
import { getOrganisatie } from './merk';

const URL = SUPABASE_URL;
const KEY = SUPABASE_KEY;

// Elke vraag aan de databank draagt de actieve organisatie (header x-organisatie).
// Zo ziet en bewaart de databank enkel in die organisatie (RLS), zonder dat elk scherm
// er rekening mee moet houden. Weigert de browser de header (CORS), dan zonder header
// verder: de databank valt dan terug op je organisaties.
let metHeader = true;
async function fetchMetOrganisatie(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';
  const slug = getOrganisatie()?.slug;
  if (!slug || !metHeader || !url.includes('/rest/v1/')) return fetch(input, init);
  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
  headers.set('x-organisatie', slug);
  try {
    return await fetch(input, { ...init, headers });
  } catch (e) {
    if (!(e instanceof TypeError) || init.signal?.aborted) throw e;
    metHeader = false;
    console.warn('Toolen: header x-organisatie geweigerd, verder zonder', e);
    return fetch(input, init);
  }
}

let _sb = null;
export function sb() {
  if (!_sb) _sb = createBrowserClient(URL, KEY, { db: { schema: 'maps' }, cookieOptions: cookieOpties(), global: { fetch: fetchMetOrganisatie } });
  return _sb;
}
export function maps() {
  return sb().schema('maps');
}

export const BUCKET = 'maps';

// Bestanden uit de opslag via het eigen adres (/b/…), nooit via het adres van de databank.
// Volledige adressen van de opslag (oudere gegevens) worden ook omgezet.
const OPSLAG = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()}/storage/v1/object/public/${BUCKET}/`;
// In een deellink (zonder login) bewijst het token van de link dat de kijker het bestand mag zien.
let deelToken = null;
export function zetDeelToken(t) { deelToken = t && String(t).length >= 20 ? String(t) : null; }
export function eigenAdres(pad) {
  const p = String(pad).split('/').map((d) => encodeURIComponent(decodeURIComponent(d))).join('/');
  const basis = typeof window !== 'undefined' ? window.location.origin : '';
  return `${basis}/b/${p}${deelToken ? `?t=${encodeURIComponent(deelToken)}` : ''}`;
}
export function publiekeUrl(pad) {
  if (!pad) return null;
  if (OPSLAG.length > 40 && String(pad).startsWith(OPSLAG)) return eigenAdres(String(pad).slice(OPSLAG.length));
  // Beelden die met de app meegeleverd worden (public/) of al een volledige URL zijn.
  if (/^(https?:|data:|\/)/.test(pad)) return pad;
  return eigenAdres(pad);
}

// Leesbare foutmelding. PGRST106 = schema niet blootgesteld in de Data API.
export function foutTekst(fout) {
  if (!fout) return '';
  const code = fout.code || '';
  if (code === 'PGRST106' || /schema must be one of/i.test(fout.message || '')) {
    return 'Het schema maps is nog niet vrijgegeven in Supabase (Project Settings → Data API → Exposed schemas).';
  }
  if (code === '42P01') return 'De tabellen van Toolen Maps bestaan nog niet: de migratie 0001_basis is nog niet uitgevoerd.';
  if (code === '42501') return 'Je hebt geen rechten voor deze actie.';
  return fout.message || String(fout);
}

export async function wieBenIk() {
  // Eigen toegang van Toolen Maps (maps.toegang), los van Publitool.
  const { data } = await maps().rpc('ik');
  return data || null;
}

export function magSchrijven(profiel) {
  return !!profiel && (profiel.role === 'admin' || profiel.role === 'editor');
}

// Namen van collega's (maps.toegang), met cache.
const namenCache = new Map();
export async function namenVan(ids) {
  const nodig = [...new Set((ids || []).filter((x) => x && !namenCache.has(x)))];
  if (nodig.length) {
    try {
      const { data } = await maps().from('toegang').select('user_id, naam, email').in('user_id', nodig);
      for (const r of data || []) namenCache.set(r.user_id, r.naam || (r.email || '').split('@')[0] || 'een collega');
    } catch {}
    for (const id of nodig) if (!namenCache.has(id)) namenCache.set(id, 'een collega');
  }
  return Object.fromEntries((ids || []).filter(Boolean).map((id) => [id, namenCache.get(id)]));
}
export const naamUitCache = (id) => (id && namenCache.get(id)) || 'een collega';

// Gedeelde bibliotheek: enkel beheerders. Plan-objecten (CAD), sjablonen en snelstijlen ook editors (zie migratie 006).
export function magBibliotheek(profiel, el = null) {
  if (!magSchrijven(profiel)) return false;
  if (profiel.role === 'admin') return true;
  return !!(el && (el.plan_id || ['Sjablonen', 'Snelstijlen'].includes(el.categorie)));
}
