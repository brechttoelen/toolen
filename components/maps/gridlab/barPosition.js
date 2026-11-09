// OVERGENOMEN UIT GRIDLAB (flanders-classics/gridlab, commit 6c8b283) — niet hier aanpassen.
// Bron: dev/gridlab/src/utils/barPosition.js. Zo tekent Toolen Maps een GridLab-ontwerp exact zoals de JPEG-export van GridLab.
// Wijzigt GridLab de export, kopieer dan dit bestand opnieuw (zelfde inhoud, enkel de imports zijn aangepast).
// Shared helper: parse DefaultBarPosition string → { type, row }
// row is always an integer (for coordinate calculations)
export function parseBarPosition(val) {
  if (!val || val === 'NONE') return { type: 'NONE', row: 0 }
  if (val === 'TOP') return { type: 'TOP', row: 0 }
  if (val === 'BOTTOM') return { type: 'BOTTOM', row: 0 }
  const m = val.match(/^AFTER_ROW=(\d+)$/)
  if (m) return { type: 'AFTER_ROW', row: parseInt(m[1]) }
  return { type: 'NONE', row: 0 }
}
