// DWG → DXF-tekst (enkel wat de eigen DXF-lezer kent: lijnen, polylijnen, cirkels, bogen, tekst en blokken).
// Draait enkel op de server: LibreDWG is GPL en gaat zo niet mee naar de browser.

type P = { x: number; y: number };
type Ent = Record<string, unknown> & { type: string; layer?: string; isVisible?: boolean };
type Blok = { name?: string; basePoint?: P; entities?: Ent[] };
type Db = { header?: Record<string, unknown>; entities?: Ent[]; tables?: { BLOCK_RECORD?: { entries?: Blok[] } } };

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const g = (v: number) => String(Math.round(v * 1e6) / 1e6);
const schoon = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
const graden = (rad: unknown) => (n(rad) * 180) / Math.PI;

// Een bocht in een polylijn (bulge) als punten: tan(hoek / 4) tussen twee hoekpunten.
function boog(a: P, b: P, bulge: number): P[] {
  const hoek = 4 * Math.atan(bulge);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (!d || Math.abs(hoek) < 1e-6) return [];
  const r = d / (2 * Math.sin(hoek / 2));
  const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
  const h = r * Math.cos(hoek / 2);
  const cx = mx - (h * (b.y - a.y)) / d; const cy = my + (h * (b.x - a.x)) / d;
  const a0 = Math.atan2(a.y - cy, a.x - cx);
  const stappen = Math.max(2, Math.ceil(Math.abs(hoek) / (Math.PI / 12)));
  const uit: P[] = [];
  for (let k = 1; k < stappen; k++) { const t = a0 + (hoek * k) / stappen; uit.push({ x: cx + Math.abs(r) * Math.cos(t), y: cy + Math.abs(r) * Math.sin(t) }); }
  return uit;
}

function poly(uit: string[], laag: string, pts: P[], dicht: boolean) {
  if (pts.length < 2) return;
  uit.push("0", "LWPOLYLINE", "8", laag, "70", dicht ? "1" : "0");
  for (const p of pts) uit.push("10", g(p.x), "20", g(p.y));
}

function entiteit(uit: string[], e: Ent) {
  if (e.isVisible === false) return;
  const laag = schoon(e.layer) || "0";
  const pt = (k: string): P => { const p = (e[k] || {}) as P; return { x: n(p.x), y: n(p.y) }; };
  switch (e.type) {
    case "LINE": { const a = pt("startPoint"); const b = pt("endPoint"); uit.push("0", "LINE", "8", laag, "10", g(a.x), "20", g(a.y), "11", g(b.x), "21", g(b.y)); break; }
    case "LWPOLYLINE": case "POLYLINE2D": case "POLYLINE3D": case "POLYLINE": {
      const v = ((e.vertices as (P & { bulge?: number })[]) || []).map((q) => ({ x: n(q.x), y: n(q.y), bulge: n(q.bulge) }));
      const dicht = (n(e.flag) & 1) === 1 || (n(e.flag) & 512) === 512;
      const pts: P[] = [];
      for (let i = 0; i < v.length; i++) {
        pts.push(v[i]);
        const volgende = i + 1 < v.length ? v[i + 1] : dicht ? v[0] : null;
        if (volgende && v[i].bulge) pts.push(...boog(v[i], volgende, v[i].bulge));
      }
      poly(uit, laag, pts, dicht);
      break;
    }
    case "CIRCLE": { const c = pt("center"); uit.push("0", "CIRCLE", "8", laag, "10", g(c.x), "20", g(c.y), "40", g(n(e.radius))); break; }
    case "ARC": { const c = pt("center"); uit.push("0", "ARC", "8", laag, "10", g(c.x), "20", g(c.y), "40", g(n(e.radius)), "50", g(graden(e.startAngle)), "51", g(graden(e.endAngle))); break; }
    case "ELLIPSE": {
      const c = pt("center"); const as = pt("majorAxisEndPoint"); const ratio = n(e.axisRatio, 1);
      const a0 = n(e.startAngle); let a1 = n(e.endAngle, Math.PI * 2); if (a1 <= a0) a1 += Math.PI * 2;
      const vol = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
      const stappen = Math.max(12, Math.ceil((a1 - a0) / (Math.PI / 24)));
      const pts: P[] = [];
      for (let k = 0; k <= stappen - (vol ? 1 : 0); k++) { const t = a0 + ((a1 - a0) * k) / stappen; pts.push({ x: c.x + as.x * Math.cos(t) - as.y * ratio * Math.sin(t), y: c.y + as.y * Math.cos(t) + as.x * ratio * Math.sin(t) }); }
      poly(uit, laag, pts, vol);
      break;
    }
    case "SPLINE": {
      // Benadering: de lijn door de paspunten (of de stuurpunten als er geen paspunten zijn).
      const fit = (e.fitPoints as P[]) || []; const stuur = (e.controlPoints as P[]) || [];
      poly(uit, laag, (fit.length > 1 ? fit : stuur).map((q) => ({ x: n(q.x), y: n(q.y) })), (n(e.flag) & 1) === 1);
      break;
    }
    case "SOLID": case "3DFACE": {
      const k = ["corner1", "corner2", "corner4", "corner3"].filter((x) => e[x]).map(pt);
      poly(uit, laag, k, true);
      break;
    }
    case "TEXT": case "ATTRIB": { const t = schoon(e.text); if (!t) break; const p = pt("startPoint"); uit.push("0", "TEXT", "8", laag, "1", t, "10", g(p.x), "20", g(p.y), "40", g(n(e.textHeight, 1)), "50", g(graden(e.rotation))); break; }
    case "MTEXT": {
      const t = schoon(e.text); if (!t) break; const p = pt("insertionPoint");
      const dir = e.direction as P | undefined;
      const rot = dir && (n(dir.x) || n(dir.y)) ? (Math.atan2(n(dir.y), n(dir.x)) * 180) / Math.PI : graden(e.rotation);
      uit.push("0", "MTEXT", "8", laag, "1", t, "10", g(p.x), "20", g(p.y), "40", g(n(e.textHeight, 1)), "50", g(rot));
      break;
    }
    case "INSERT": {
      const naam = schoon(e.name); if (!naam) break; const p = pt("insertionPoint");
      uit.push("0", "INSERT", "8", laag, "2", naam, "10", g(p.x), "20", g(p.y), "41", g(n(e.xScale, 1)), "42", g(n(e.yScale, 1)), "50", g(graden(e.rotation)),
        "70", String(Math.max(1, n(e.columnCount, 1))), "71", String(Math.max(1, n(e.rowCount, 1))), "44", g(n(e.columnSpacing)), "45", g(n(e.rowSpacing)));
      for (const a of (e.attribs as Ent[]) || []) entiteit(uit, a);
      break;
    }
    default: break;
  }
}

export function dwgNaarDxf(db: Db): { tekst: string; aantal: number } {
  const uit: string[] = [];
  uit.push("0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(n(db.header?.INSUNITS)), "0", "ENDSEC");
  const blokken = db.tables?.BLOCK_RECORD?.entries || [];
  uit.push("0", "SECTION", "2", "BLOCKS");
  for (const b of blokken) {
    const naam = schoon(b.name);
    if (!naam || /^\*(model|paper)_space/i.test(naam)) continue;
    uit.push("0", "BLOCK", "2", naam, "10", g(n(b.basePoint?.x)), "20", g(n(b.basePoint?.y)));
    for (const e of b.entities || []) entiteit(uit, e);
    uit.push("0", "ENDBLK");
  }
  uit.push("0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
  const model = blokken.find((b) => /^\*model_space$/i.test(schoon(b.name)));
  const lijst = model?.entities?.length ? model.entities : db.entities || [];
  const voor = uit.length;
  for (const e of lijst) entiteit(uit, e);
  const aantal = uit.length - voor;
  uit.push("0", "ENDSEC", "0", "EOF");
  return { tekst: uit.join("\n") + "\n", aantal };
}
