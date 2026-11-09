// OVERGENOMEN UIT GRIDLAB (flanders-classics/gridlab, commit 6c8b283) — niet hier aanpassen.
// Bron: dev/gridlab/src/utils/logoUrl.js. Zo tekent Toolen Maps een GridLab-ontwerp exact zoals de JPEG-export van GridLab.
// Wijzigt GridLab de export, kopieer dan dit bestand opnieuw (zelfde inhoud, enkel de imports zijn aangepast).
export const LOGO_BUCKET = 'gridlab-logos'

import { SUPABASE_URL } from '@/lib/supabase/env'

const STORAGE_BASE = SUPABASE_URL
  + `/storage/v1/object/public/${LOGO_BUCKET}/`

// Cache-buster-tokens per logo (filename → token, uit de bucket-listing). Module-scope omdat
// logo's globaal en gedeeld zijn; gevuld door useAppData/LogosSection via setLogoVersions().
let _versions = {}

/** Zet de cache-buster-tokens (map filename → token). Zie buildLogoVersions in normalizeStorage.js. */
export function setLogoVersions(map) {
  _versions = map || {}
}

/**
 * Geeft de URL van een logo terug.
 * Volgorde: custom override → Supabase Storage (+ `?v=` cache-buster) → fallback null (BLANK)
 */
export function logoUrl(filename, customSrc) {
  if (customSrc) return customSrc
  if (!filename || filename === 'BLANK') return null
  const v = _versions[filename]
  return STORAGE_BASE + filename + '.png' + (v ? `?v=${v}` : '')
}

/** Canonieke Storage-bestandsnaam voor een sponsornaam (spaties → underscores). */
export function filenameForName(name) {
  return (name || '').replace(/ /g, '_')
}

/**
 * Centrale logo-resolutie voor een sponsornaam — één plek i.p.v. de vroegere
 * duplicatie over preview/thumbnail/export/bibliotheek/picker.
 *
 * Geeft terug: { src, isPlaceholder, isBlank }
 *   - isBlank      → leeg slot (BLANK of leeg)
 *   - isPlaceholder → de naam is als placeholder geregistreerd en heeft nog geen
 *                     echt (override-)logo; renderers tonen dan de placeholder-tegel
 *   - src          → override-dataURL of Storage-URL (zoals voorheen; de img-onError
 *                     valt nog steeds terug op naam-als-tekst wanneer het bestand 404't)
 *
 * `placeholders` mag een Set of array van namen zijn. Een placeholder wordt
 * opgeruimd zodra het echte logo geüpload is, dus de registratie is leidend.
 */
export function resolveLogoSrc(name, { customLogos = {}, placeholders = null } = {}) {
  if (!name || name === 'BLANK') return { src: null, isPlaceholder: false, isBlank: true }
  const override = customLogos[name]
  const isPlaceholder = !override && !!placeholders && (
    placeholders instanceof Set ? placeholders.has(name) : placeholders.indexOf(name) !== -1
  )
  if (isPlaceholder) return { src: null, isPlaceholder: true, isBlank: false }
  return { src: override || logoUrl(filenameForName(name)), isPlaceholder: false, isBlank: false }
}

export { STORAGE_BASE }
