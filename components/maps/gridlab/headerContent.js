// OVERGENOMEN UIT GRIDLAB (flanders-classics/gridlab, commit 6c8b283) — niet hier aanpassen.
// Bron: dev/gridlab/src/utils/headerContent.js. Zo tekent Toolen Maps een GridLab-ontwerp exact zoals de JPEG-export van GridLab.
// Wijzigt GridLab de export, kopieer dan dit bestand opnieuw (zelfde inhoud, enkel de imports zijn aangepast).
// Gedeelde normalisatie voor header-inhoud, gebruikt door de editor, de preview-render
// en de JPEG-export. Zorgt voor achterwaartse compatibiliteit met oudere vormen.

let _uidCounter = 0
export function headerBlockId() {
  _uidCounter += 1
  return 'b-' + Date.now().toString(36) + '-' + _uidCounter
}

// Tekstblokken: geordende lijst { id, text, level } met level 'title' | 'sub'.
// Migreert oudere { title, subtitle, extra }-vorm.
export function normHeaderBlocks(header) {
  if (header && Array.isArray(header.blocks)) {
    return header.blocks.map(b => ({ id: b.id, text: b.text || '', level: b.level === 'title' ? 'title' : 'sub' }))
  }
  const out = []
  if (header?.title) out.push({ id: 'b-title', text: header.title, level: 'title' })
  if (header?.subtitle) out.push({ id: 'b-sub', text: header.subtitle, level: 'sub' })
  if (header?.extra) out.push({ id: 'b-extra', text: header.extra, level: 'sub' })
  return out
}

// Extra logo's / elementen: { text, pos } met pos 'left' | 'right' | 'under'.
export function normHeaderExtras(header) {
  return (header?.extras || []).map(x =>
    typeof x === 'string' ? { text: x, pos: 'under' } : { text: x.text, pos: x.pos || 'under' }
  )
}

export function headerHasContent(header) {
  return normHeaderBlocks(header).some(b => b.text) || normHeaderExtras(header).length > 0
}

// Gedeelde tekstlayout voor een header-/dividerzone als "ruwe tekst-indruk": de centrale kolom
// (tekstblokken + onder-extra's als één gejoinde regel) en de links/rechts gestapelde extra's,
// met alle maten proportioneel aan de zonehoogte. Puur rekenwerk, mediumonafhankelijk — gebruikt
// door zowel de JPEG-export (canvas) als de thumbnail (SVG), die exact dezelfde proporties moeten
// tonen. De editor-preview (HeaderContentDisplay) rendert bewust rijker (omrande chips) en
// gebruikt dit niet. `zw`/`zh` zijn de zonebreedte/-hoogte in dezelfde eenheid als de caller tekent.
export function zoneTextLayout(content, zw, zh) {
  const titleSize = Math.min(zh * 0.30, zh)
  const subSize = titleSize * 0.5
  const extras = normHeaderExtras(content)
  const underExtras = extras.filter(e => e.pos === 'under')
  const leftExtras = extras.filter(e => e.pos === 'left')
  const rightExtras = extras.filter(e => e.pos === 'right')

  // Centrale kolom: tekstvakken (in volgorde), dan de onder-extra's samengevoegd tot één regel.
  const centerLines = normHeaderBlocks(content).filter(b => b.text).map(b => ({
    text: b.text,
    size: b.level === 'title' ? titleSize : subSize,
    weight: b.level === 'title' ? 800 : 600,
    color: b.level === 'title' ? '#ffffff' : 'rgba(255,255,255,0.85)',
  }))
  if (underExtras.length) {
    centerLines.push({ text: underExtras.map(e => e.text).join('   ·   '), size: titleSize * 0.35, weight: 400, color: 'rgba(255,255,255,0.9)' })
  }

  const gap = titleSize * 0.22
  const totalH = centerLines.reduce((s, l) => s + l.size, 0) + gap * Math.max(0, centerLines.length - 1)
  const sideSize = titleSize * 0.35
  const lineH = sideSize * 1.4

  return { centerLines, gap, totalH, sideSize, lineH, leftExtras, rightExtras }
}
