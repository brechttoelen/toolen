// OVERGENOMEN UIT GRIDLAB (flanders-classics/gridlab, commit 6c8b283) — niet hier aanpassen.
// Bron: dev/gridlab/src/utils/exportJpeg.js. Zo tekent Toolen Maps een GridLab-ontwerp exact zoals de JPEG-export van GridLab.
// Wijzigt GridLab de export, kopieer dan dit bestand opnieuw (zelfde inhoud, enkel de imports zijn aangepast).
import { parseBarPosition } from './barPosition'
import { effectiveHeaderOff } from './formatGeometry'
import { resolveLogoSrc } from './logoUrl'
import { headerHasContent, zoneTextLayout } from './headerContent'

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Tekent een ruwe tekst-indruk van zone-inhoud (header of divider) in de band.
// Geeft false terug als er geen inhoud is (dan tekent de caller de placeholder).
function drawZoneContent(ctx, content, hx, hy, hw, hh) {
  if (!headerHasContent(content)) return false
  const cx = hx + hw / 2
  const cy = hy + hh / 2
  const { centerLines, gap, totalH, sideSize, lineH, leftExtras, rightExtras } = zoneTextLayout(content, hw, hh)

  // Centrale kolom: tekstvakken + onder-extra's, verticaal gecentreerd
  let y = cy - totalH / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  centerLines.forEach(l => {
    y += l.size / 2
    ctx.font = `${l.weight} ${l.size}px system-ui, sans-serif`
    ctx.fillStyle = l.color
    ctx.fillText(l.text, cx, y)
    y += l.size / 2 + gap
  })

  // Extra's links / rechts (verticaal gestapeld, verticaal gecentreerd)
  ctx.font = `${sideSize}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  if (leftExtras.length > 0) {
    ctx.textAlign = 'left'
    const startY = cy - ((leftExtras.length - 1) * lineH) / 2
    leftExtras.forEach((e, i) => ctx.fillText(e.text, hx + hw * 0.02, startY + i * lineH))
  }
  if (rightExtras.length > 0) {
    ctx.textAlign = 'right'
    const startY = cy - ((rightExtras.length - 1) * lineH) / 2
    rightExtras.forEach((e, i) => ctx.fillText(e.text, hx + hw * 0.98, startY + i * lineH))
  }
  return true
}

// Rendert het canvas naar een JPEG-Blob, zonder download te triggeren.
// Hergebruikt door exportJpeg() (losse download) en de ZIP-bulk-export.
export async function renderJpegBlob(format, slots, customLogos = {}, header = null, divider = null) {
  const {
    Cols, Rows,
    CellW_mm, CellAspect, CellH_mm,
    GutterX_mm, GutterY_mm,
    MarginLeft_mm, MarginTop_mm, MarginRight_mm, MarginBottom_mm,
    CanvasWidth_mm, CanvasHeight_mm,
    BackgroundColor_Hex,
    HeaderType, HeaderHeight_mm, HeaderMargin_mm,
    DefaultBarType, DefaultBarPosition,
    DefaultBarHeight_mm, DefaultBarGapTop_mm, DefaultBarGapBottom_mm,
  } = format

  const cellH = CellH_mm || (CellW_mm && CellAspect ? CellW_mm / CellAspect : 100)
  const hasHeader = HeaderType && HeaderType !== 'NONE'
  const hasBar = DefaultBarType && DefaultBarType !== 'NONE'
  const barPos = parseBarPosition(DefaultBarPosition)

  // Scale to max 3000px on longest side, max 2px/mm
  const maxPx = 3000
  const scale = Math.min(maxPx / CanvasWidth_mm, maxPx / CanvasHeight_mm, 2)

  const canvasEl = document.createElement('canvas')
  canvasEl.width = Math.round(CanvasWidth_mm * scale)
  canvasEl.height = Math.round(CanvasHeight_mm * scale)
  const ctx = canvasEl.getContext('2d')

  // Background
  ctx.fillStyle = BackgroundColor_Hex || '#000000'
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height)

  const s = scale
  // Zelfde geometrie als de editor-preview (CanvasViewport): header-offset via effectiveHeaderOff
  // (rekent HeaderCellsPriority mee), de header-band krimpt navenant, en het grid wordt
  // horizontaal gecentreerd binnen de marges. Zo is de export identiek aan wat je in de editor ziet.
  const headerOffset = effectiveHeaderOff(format)
  const effectiveHeaderH = hasHeader ? Math.min(HeaderHeight_mm || 0, Math.max(0, headerOffset - (GutterY_mm || 0))) : 0
  const totalGridW = Cols * CellW_mm + (Cols - 1) * (GutterX_mm || 0)
  const gridLeft = MarginLeft_mm + Math.max(0, ((CanvasWidth_mm - MarginLeft_mm - MarginRight_mm) - totalGridW) / 2)

  // Header band — ruwe tekst-indruk als er inhoud is, anders subtiele placeholder
  if (hasHeader && effectiveHeaderH) {
    const hx = MarginLeft_mm * s
    const hy = MarginTop_mm * s
    const hw = (CanvasWidth_mm - MarginLeft_mm - MarginRight_mm) * s
    const hh = effectiveHeaderH * s
    if (!drawZoneContent(ctx, header, hx, hy, hw, hh)) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(hx, hy, hw, hh)
    }
  }

  // Bar band
  let barY = null
  if (hasBar) {
    if (barPos.type === 'TOP') barY = MarginTop_mm + headerOffset
    else if (barPos.type === 'BOTTOM') barY = CanvasHeight_mm - MarginBottom_mm - (DefaultBarHeight_mm || 0)
    else if (barPos.type === 'AFTER_ROW') {
      // De balk vervangt de gutter tussen de twee groepen (− GutterY), net als de preview.
      barY = MarginTop_mm + headerOffset
        + barPos.row * (cellH + GutterY_mm)
        - (GutterY_mm || 0)
        + (DefaultBarGapTop_mm || 0)
    }
  }
  if (hasBar && barY !== null && DefaultBarHeight_mm) {
    const bx = MarginLeft_mm * s
    const by = barY * s
    const bw = (CanvasWidth_mm - MarginLeft_mm - MarginRight_mm) * s
    const bh = DefaultBarHeight_mm * s
    if (!drawZoneContent(ctx, divider, bx, by, bw, bh)) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(bx, by, bw, bh)
    }
  }

  // Pre-load all unique logo images
  const uniqueSponsors = [...new Set(slots.filter(v => v && v !== 'BLANK'))]
  const imgCache = {}
  await Promise.all(uniqueSponsors.map(async name => {
    const { src } = resolveLogoSrc(name, { customLogos })
    const img = await loadImage(src)
    if (img) imgCache[name] = img
  }))

  // Draw cells
  for (let i = 0; i < slots.length; i++) {
    const col = i % Cols
    const row = Math.floor(i / Cols)
    const value = slots[i]

    const x = gridLeft + col * (CellW_mm + GutterX_mm)
    let y = MarginTop_mm + headerOffset + row * (cellH + GutterY_mm)

    if (hasBar && barPos.type === 'AFTER_ROW' && row >= barPos.row) {
      y += (DefaultBarGapTop_mm || 0) + (DefaultBarHeight_mm || 0) + (DefaultBarGapBottom_mm || 0) - (GutterY_mm || 0)
    }

    const px = x * s
    const py = y * s
    const pw = CellW_mm * s
    const ph = cellH * s

    if (!value || value === 'BLANK') continue

    const img = imgCache[value]
    if (!img) continue

    // Draw logo: object-fit contain within cell
    const imgRatio = img.naturalWidth / img.naturalHeight
    const cellRatio = pw / ph
    let dw, dh, dx, dy
    if (imgRatio > cellRatio) {
      dw = pw; dh = pw / imgRatio
      dx = px; dy = py + (ph - dh) / 2
    } else {
      dh = ph; dw = ph * imgRatio
      dy = py; dx = px + (pw - dw) / 2
    }
    ctx.drawImage(img, dx, dy, dw, dh)
  }

  return new Promise(resolve => canvasEl.toBlob(resolve, 'image/jpeg', 0.92))
}

// (exportJpeg met download is weggelaten: Toolen Maps gebruikt enkel renderJpegBlob.)
