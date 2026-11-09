// OVERGENOMEN UIT GRIDLAB (flanders-classics/gridlab, commit 6c8b283) — niet hier aanpassen.
// Bron: dev/gridlab/src/utils/formatGeometry.js. Zo tekent Toolen Maps een GridLab-ontwerp exact zoals de JPEG-export van GridLab.
// Wijzigt GridLab de export, kopieer dan dit bestand opnieuw (zelfde inhoud, enkel de imports zijn aangepast).
// ─── Formaat-geometrie: fit, centreren en effectieve marges ───────────────────
//
// Één bron van waarheid voor de raster-/marge-wiskunde. Zowel de in-editor toolbar
// (components/toolbar), de admin-formaateditor (admin/sections) als de design-state
// (hooks/useDesignState) rekenen hiermee, zodat het gedrag overal identiek is.
//
// Pure functies — geen React, geen side effects. Ze nemen een `format`-object en
// geven een nieuw object terug (spread), nooit muterend.

// Effectieve verticale uitlijning: gebruik expliciete instelling of auto-default o.b.v. header.
export function effectiveVAlign(fmt) {
  return fmt.VerticalAlign || ((fmt.HeaderType && fmt.HeaderType !== 'NONE') ? 'top' : 'center')
}

// Herberekent de effectieve header-offset met HeaderCellsPriority.
// Toggle AAN  → vakjes hebben voorrang; header krimpt als er te weinig ruimte is.
// Toggle UIT  → header blijft op ingestelde hoogte (default gedrag).
export function effectiveHeaderOff(fmt) {
  const hasHeader = fmt.HeaderType && fmt.HeaderType !== 'NONE'
  if (!hasHeader) return 0
  const headerH = fmt.HeaderHeight_mm || 0
  const headerM = fmt.HeaderMargin_mm || 0
  const full = headerH + headerM
  if (!fmt.HeaderCellsPriority) return full
  const gy = fmt.GutterY_mm || 0
  const rows = fmt.Rows || 1
  const cellH = fmt.CellH_mm || 0
  const gridH = rows * cellH + Math.max(0, rows - 1) * gy
  const isAfterRow = fmt.DefaultBarType && fmt.DefaultBarType !== 'NONE'
    && /^AFTER_ROW=\d+$/.test(fmt.DefaultBarPosition || '')
  const dividerExtra = isAfterRow
    ? Math.max(0, (fmt.DefaultBarGapTop_mm || 0) + (fmt.DefaultBarHeight_mm || 0) + (fmt.DefaultBarGapBottom_mm || 0) - gy)
    : 0
  const totalAvail = (fmt.CanvasHeight_mm || 0) - (fmt.AbsMarginTop_mm || 0) - (fmt.AbsMarginBottom_mm || 0)
  const forHeader = Math.max(0, totalAvail - gridH - dividerExtra)
  return Math.min(full, forHeader)
}

// Herberekent cel- of grid-afmetingen na een canvas-wijziging.
//
// fmt.FixedCellSize === false (standaard):
//   Cols/Rows blijven vast, celgrootte krimpt als ze niet meer passen.
//   TargetCellW_mm onthoudt de originele breedte zodat cellen kunnen
//   terugspringen als het canvas weer groeit.
//
// fmt.FixedCellSize === true:
//   Celgrootte blijft vast, Cols/Rows worden verminderd (of vermeerderd)
//   als cellen buiten het canvas zouden vallen.
export function withFittedAndCentered(fmt) {
  if (!fmt.CanvasWidth_mm || !fmt.CanvasHeight_mm) return fmt

  const gx   = fmt.GutterX_mm || 0
  const gy   = fmt.GutterY_mm || 0
  const absL = fmt.AbsMarginLeft_mm   || 0
  const absR = fmt.AbsMarginRight_mm  || 0
  const absT = fmt.AbsMarginTop_mm    || 0
  const absB = fmt.AbsMarginBottom_mm || 0
  const hasHeader = fmt.HeaderType && fmt.HeaderType !== 'NONE'
  const headerOffset = hasHeader
    ? (fmt.HeaderHeight_mm || 0) + (fmt.HeaderMargin_mm || 0)
    : 0

  const availW = fmt.CanvasWidth_mm  - absL - absR
  const availH = fmt.CanvasHeight_mm - absT - absB - headerOffset
  if (availW <= 0 || availH <= 0) return fmt

  const result = { ...fmt }

  if (fmt.FixedCellSize) {
    // ── Modus: vaste celgrootte — cols/rows aanpassen ──────────────────
    const cw = fmt.CellW_mm || 0
    const ch = fmt.CellH_mm || 0
    if (!cw || !ch) return fmt

    const maxCols = Math.max(1, Math.floor((availW + gx) / (cw + gx)))
    const maxRows = Math.max(1, Math.floor((availH + gy) / (ch + gy)))

    const cols = Math.min(fmt.Cols || 1, maxCols)
    const rows = Math.min(fmt.Rows || 1, maxRows)
    result.Cols = cols
    result.Rows = rows

    const gridW = cols * cw + (cols - 1) * gx
    const gridH = rows * ch + (rows - 1) * gy
    const dividerExtra = (fmt.DefaultBarType && fmt.DefaultBarType !== 'NONE' && /^AFTER_ROW=\d+$/.test(fmt.DefaultBarPosition || ''))
      ? Math.max(0, (fmt.DefaultBarGapTop_mm || 0) + (fmt.DefaultBarHeight_mm || 0) + (fmt.DefaultBarGapBottom_mm || 0) - gy)
      : 0
    const effHdrOff = effectiveHeaderOff({ ...fmt, Rows: rows })
    const leftoverW = Math.max(0, availW - gridW)
    const leftoverH = Math.max(0, (fmt.CanvasHeight_mm - absT - absB) - effHdrOff - gridH - dividerExtra)
    const topExtra = effectiveVAlign(fmt) === 'top' ? 0 : leftoverH / 2
    result.MarginLeft_mm   = absL + Math.round(leftoverW / 2 * 100) / 100
    result.MarginRight_mm  = absR + Math.round(leftoverW / 2 * 100) / 100
    result.MarginTop_mm    = absT + Math.round(topExtra * 100) / 100
    result.MarginBottom_mm = absB + Math.round((leftoverH - topExtra) * 100) / 100
  } else {
    // ── Modus: vaste cols/rows — celgrootte aanpassen ──────────────────
    const cols   = fmt.Cols || 1
    const rows   = fmt.Rows || 1
    const aspect = fmt.CellAspect || 1.667

    const maxCellW = (availW - (cols - 1) * gx) / cols
    const maxCellH = (availH - (rows - 1) * gy) / rows

    let cw = fmt.TargetCellW_mm ?? fmt.CellW_mm ?? 0
    let ch = cw / aspect

    if (maxCellW > 0 && cw > maxCellW) { cw = maxCellW; ch = cw / aspect }
    if (maxCellH > 0 && ch > maxCellH) { ch = maxCellH; cw = ch * aspect }

    result.TargetCellW_mm = fmt.TargetCellW_mm ?? fmt.CellW_mm ?? 0
    result.CellW_mm = Math.round(cw * 100) / 100
    result.CellH_mm = Math.round(ch * 1000) / 1000

    const gridW = cols * result.CellW_mm + (cols - 1) * gx
    const gridH = rows * result.CellH_mm + (rows - 1) * gy
    const dividerExtra = (fmt.DefaultBarType && fmt.DefaultBarType !== 'NONE' && /^AFTER_ROW=\d+$/.test(fmt.DefaultBarPosition || ''))
      ? Math.max(0, (fmt.DefaultBarGapTop_mm || 0) + (fmt.DefaultBarHeight_mm || 0) + (fmt.DefaultBarGapBottom_mm || 0) - gy)
      : 0
    const effHdrOff = effectiveHeaderOff({ ...fmt, CellH_mm: result.CellH_mm })
    const leftoverW = Math.max(0, availW - gridW)
    const leftoverH = Math.max(0, (fmt.CanvasHeight_mm - absT - absB) - effHdrOff - gridH - dividerExtra)
    const topExtra = effectiveVAlign(fmt) === 'top' ? 0 : leftoverH / 2
    result.MarginLeft_mm   = absL + Math.round(leftoverW / 2 * 100) / 100
    result.MarginRight_mm  = absR + Math.round(leftoverW / 2 * 100) / 100
    result.MarginTop_mm    = absT + Math.round(topExtra * 100) / 100
    result.MarginBottom_mm = absB + Math.round((leftoverH - topExtra) * 100) / 100
  }

  return result
}

// Herberekent alleen effectieve marges op basis van AbsMargin + huidig grid.
// Cols/Rows en celgrootte worden NIET aangepast.
// Gebruik dit exclusief wanneer alleen AbsMargin-velden wijzigen.
export function withRecalcMargins(fmt) {
  // Een portiek gebruikt Margin*_mm als DIRECTE invoer (niet afgeleid van AbsMargin + grid),
  // dus nooit herberekenen — anders worden de ingevulde portiek-marges genuld bij het laden/opslaan.
  if (fmt?.type === 'portiek') return fmt
  const cols  = fmt.Cols || 1
  const rows  = fmt.Rows || 1
  const cellW = fmt.CellW_mm || 0
  const cellH = fmt.CellH_mm || 0
  const gx    = fmt.GutterX_mm || 0
  const gy    = fmt.GutterY_mm || 0
  const cw    = fmt.CanvasWidth_mm  || 0
  const ch    = fmt.CanvasHeight_mm || 0
  const absL  = fmt.AbsMarginLeft_mm   || 0
  const absR  = fmt.AbsMarginRight_mm  || 0
  const absT  = fmt.AbsMarginTop_mm    || 0
  const absB  = fmt.AbsMarginBottom_mm || 0
  const headerOffset = effectiveHeaderOff(fmt)
  if (!cw || !ch) return fmt

  const gridW     = cols * cellW + (cols - 1) * gx
  const gridH     = rows * cellH + (rows - 1) * gy
  const dividerExtra = (fmt.DefaultBarType && fmt.DefaultBarType !== 'NONE' && /^AFTER_ROW=\d+$/.test(fmt.DefaultBarPosition || ''))
    ? Math.max(0, (fmt.DefaultBarGapTop_mm || 0) + (fmt.DefaultBarHeight_mm || 0) + (fmt.DefaultBarGapBottom_mm || 0) - gy)
    : 0
  const leftoverW = Math.max(0, cw - absL - absR - gridW)
  const leftoverH = Math.max(0, ch - absT - absB - headerOffset - gridH - dividerExtra)

  const topExtra = effectiveVAlign(fmt) === 'top' ? 0 : leftoverH / 2
  return {
    ...fmt,
    MarginLeft_mm:   absL + Math.round(leftoverW / 2 * 100) / 100,
    MarginRight_mm:  absR + Math.round(leftoverW / 2 * 100) / 100,
    MarginTop_mm:    absT + Math.round(topExtra * 100) / 100,
    MarginBottom_mm: absB + Math.round((leftoverH - topExtra) * 100) / 100,
  }
}
