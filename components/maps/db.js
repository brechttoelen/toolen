'use client';

// Supabase-clients voor Toolen Maps.
// Alle data zit in het schema `maps`.
// createBrowserClient is een singleton per project: sb hier is dezelfde sessie
// als in de rest van de app, alleen het schema verschilt.
import { createBrowserClient } from '@supabase/ssr';
import { cookieOpties } from '@/lib/supabase/cookie';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase/env';
import { fetchMetOrganisatie } from '@/lib/supabase/orgfetch';
import { getOrganisatie } from './merk';

const URL = SUPABASE_URL;
const KEY = SUPABASE_KEY;

// Elke vraag aan de databank draagt de actieve organisatie (header x-organisatie): zie lib/supabase/orgfetch.ts.
let _sb = null;
export function sb() {
  if (!_sb) _sb = createBrowserClient(URL, KEY, { db: { schema: 'maps' }, cookieOptions: cookieOpties(), global: { fetch: fetchMetOrganisatie } });
  return _sb;
}
// Doeken met een event (bibliotheek.event_id) horen enkel in de plannen van dat event. Wat al op het plan staat, blijft altijd.
export function inBereik(els, eventId, items = []) {
  const nodig = new Set((items || []).map((i) => i.element_id).filter(Boolean));
  return (els || []).filter((e) => !e.event_id || e.event_id === eventId || nodig.has(e.id));
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
// Een element uit de centrale bibliotheek van Toolen (van een andere organisatie dan de eigen): enkel lezen.
export const isCentraalElement = (profiel, el) => !!(el?.organisatie_id && profiel?.organisatie?.id && el.organisatie_id !== profiel.organisatie.id);
export function magBibliotheek(profiel, el = null) {
  if (!magSchrijven(profiel)) return false;
  if (isCentraalElement(profiel, el)) return false;
  if (profiel.role === 'admin') return true;
  return !!(el && (el.plan_id || ['Sjablonen', 'Snelstijlen'].includes(el.categorie)));
}

// PostgREST geeft hoogstens 1000 rijen per vraag. Deze helper haalt alles op, in stukken.
// maak() geeft telkens een verse vraag terug; het antwoord heeft dezelfde vorm ({ data, error }).
export async function alles(maak, stap = 1000) {
  const data = [];
  for (let van = 0; ; van += stap) {
    const r = await maak().order('id').range(van, van + stap - 1);
    if (r.error) return { data: null, error: r.error };
    data.push(...(r.data || []));
    if (!r.data || r.data.length < stap) return { data, error: null };
  }
}

// Volledige rijen op id, in stukken (een lange lijst past niet in één adres).
export async function opIds(tabel, ids, stap = 80) {
  const data = [];
  for (let i = 0; i < ids.length; i += stap) {
    const r = await maps().from(tabel).select('*').in('id', ids.slice(i, i + stap));
    if (r.error) return { data: null, error: r.error };
    data.push(...(r.data || []));
  }
  return { data, error: null };
}

// ---------- Bibliotheek met geheugen in de browser ----------
// De bibliotheek is groot en wijzigt zelden. Bij elk plan alles opnieuw ophalen kost tijd en dataverkeer.
// Daarom: eerst een korte lijst (id + laatst gewijzigd), dan enkel de rijen ophalen die nieuw of gewijzigd zijn;
// de rest komt uit IndexedDB. Per organisatie en per gebruiker (de databank beslist wie wat ziet).
// Lukt het geheugen niet (privévenster, oude browser), dan gewoon alles ophalen zoals vroeger.
function bibOpslag(modus, doe) {
  return new Promise((klaar, mis) => {
    let open;
    try { open = indexedDB.open('toolen-bibliotheek', 1); } catch (e) { mis(e); return; }
    open.onupgradeneeded = () => { try { open.result.createObjectStore('rijen'); } catch {} };
    open.onerror = () => mis(open.error);
    open.onsuccess = () => {
      const d = open.result;
      try {
        const tx = d.transaction('rijen', modus);
        const v = doe(tx.objectStore('rijen'));
        tx.oncomplete = () => { d.close(); klaar(v?.result); };
        tx.onerror = tx.onabort = () => { d.close(); mis(tx.error); };
      } catch (e) { try { d.close(); } catch {} mis(e); }
    };
  });
}

export async function haalBibliotheek(planId, { enkelActief = true } = {}) {
  const vraag = (kolommen) => () => {
    let q = maps().from('bibliotheek').select(kolommen);
    if (enkelActief) q = q.eq('actief', true);
    return q.or(`plan_id.is.null,plan_id.eq.${planId}`).order('categorie').order('naam');
  };
  const alles_ = () => alles(vraag('*'));
  let sleutel = null;
  try {
    if (typeof indexedDB === 'undefined') return alles_();
    const { data } = await sb().auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid) return alles_();
    sleutel = `${getOrganisatie()?.slug || '-'}:${uid}`;
  } catch { return alles_(); }

  let bewaard = null;
  try { bewaard = await bibOpslag('readonly', (o) => o.get(sleutel)); } catch { return alles_(); }
  const oud = bewaard?.rijen instanceof Map ? bewaard.rijen : null;
  // Nog niets bewaard: alles in één keer (sneller dan lijst + rijen) en bewaren.
  if (!oud || !oud.size) {
    const r = await alles_();
    if (!r.error && r.data) bibOpslag('readwrite', (o) => o.put({ rijen: new Map(r.data.map((x) => [x.id, x])) }, sleutel)).catch(() => {});
    return r;
  }
  const kort = await alles(vraag('id, updated_at'));
  if (kort.error || !kort.data) return alles_();
  const nodig = kort.data.filter((k) => oud.get(k.id)?.updated_at !== k.updated_at).map((k) => k.id);
  // Bijna alles anders (andere organisatie-inhoud, grote import): dan is één volledige vraag lichter.
  if (nodig.length > 300) {
    const r = await alles_();
    if (!r.error && r.data) bibOpslag('readwrite', (o) => o.put({ rijen: new Map(r.data.map((x) => [x.id, x])) }, sleutel)).catch(() => {});
    return r;
  }
  const vers = nodig.length ? await opIds('bibliotheek', nodig) : { data: [], error: null };
  if (vers.error) return alles_();
  const nieuw = new Map(vers.data.map((x) => [x.id, x]));
  // Volgorde van de databank (categorie, naam) behouden. Een rij die tussen de twee vragen verdween, valt weg.
  const data = kort.data.map((k) => nieuw.get(k.id) || (oud.get(k.id)?.updated_at === k.updated_at ? oud.get(k.id) : null)).filter(Boolean);
  if (nodig.length || data.length !== oud.size) bibOpslag('readwrite', (o) => o.put({ rijen: new Map(data.map((x) => [x.id, x])) }, sleutel)).catch(() => {});
  return { data, error: null };
}
