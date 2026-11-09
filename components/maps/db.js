'use client';

// Supabase-clients voor Toolen Maps.
// Alle data zit in het schema `maps`.
// createBrowserClient is een singleton per project: sb hier is dezelfde sessie
// als in de rest van de app, alleen het schema verschilt.
import { createBrowserClient } from '@supabase/ssr';
import { cookieOpties } from '@/lib/supabase/cookie';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _sb = null;
export function sb() {
  if (!_sb) _sb = createBrowserClient(URL, KEY, { db: { schema: 'maps' }, cookieOptions: cookieOpties() });
  return _sb;
}
export function maps() {
  return sb().schema('maps');
}

export const BUCKET = 'maps';

export function publiekeUrl(pad) {
  if (!pad) return null;
  // Beelden die met de app meegeleverd worden (public/) of al een volledige URL zijn.
  if (/^(https?:|data:|\/)/.test(pad)) return pad;
  return sb().storage.from(BUCKET).getPublicUrl(pad).data.publicUrl;
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
