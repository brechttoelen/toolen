'use client';

// Bordmaker: tekent een signalisatiebord als SVG, voor de voorvertoning (zweefkaartje,
// paneel, opbouwmodus) en voor het drukbestand (PDF).
//
// Bordtypes (plan.instellingen.signalisatie.bord):
//   paneel  los paneel zonder pijl; de pijl is een plakpijl (gestippeld vak ernaast)
//   strook  liggend bord: logo · paneel · geprinte pijl (zoals de Excel-wizard)
//   staand  staand bord: logo boven, paneel, geprinte pijl onder (bv. klassement)
//
// Bestemming: { naam, boventitel, kleur, tekstkleur, soort: 'sjabloon' | 'beeld', beeld }

import { pijlVorm } from './signalisatie';

export const BORDTYPES = [
  ['strook', 'Liggend', 'Logo, tekst en pijl naast elkaar, zoals de wegwijzers op het terrein.'],
  ['staand', 'Staand', 'Logo boven, tekst of logo in het midden, pijl onder (bv. klassement).'],
];

export const PIJLCODE = { rechtdoor: 'RD', 'schuin-rechts': 'SR', rechts: 'R', 'schuin-links': 'SL', links: 'L', terug: 'T', 'u-bocht': 'U', geen: '' };
export const CODE_PIJL = Object.fromEntries(Object.entries(PIJLCODE).filter(([, c]) => c).map(([k, c]) => [c, k]));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Maten van één bord in mm (verhouding telt, niet de absolute maat).
export function bordMaat(type) {
  if (type === 'staand') return { w: 300, h: 400 };
  if (type === 'strook') return { w: 480, h: 125 };
  return { w: 420, h: 140 }; // paneel (+ plakpijl ernaast in de voorvertoning)
}

// Tekst over max. 2 regels verdelen, met een lettergrootte die past.
function tekstBlok(tekst, w, h, maxGrootte) {
  const woorden = String(tekst || '').trim().split(/\s+/).filter(Boolean);
  const regelsVan = (n) => {
    if (n === 1 || woorden.length < 2) return [woorden.join(' ')];
    let best = null;
    for (let i = 1; i < woorden.length; i++) {
      const a = woorden.slice(0, i).join(' '); const b = woorden.slice(i).join(' ');
      const m = Math.max(a.length, b.length);
      if (!best || m < best.m) best = { m, r: [a, b] };
    }
    return best.r;
  };
  const passend = (regels) => {
    const lang = Math.max(1, ...regels.map((r) => r.length));
    return Math.min(maxGrootte, (w * 0.92) / (lang * 0.58), (h * 0.86) / (regels.length * 1.12));
  };
  const een = regelsVan(1); const twee = regelsVan(2);
  const g1 = passend(een); const g2 = passend(twee);
  return g2 > g1 * 1.15 ? { regels: twee, grootte: g2 } : { regels: een, grootte: g1 };
}

function paneelSvg(best, x, y, w, h, { rond = 0, beeldSrc, rand = true } = {}) {
  const b = best || { naam: '?', kleur: '#ffffff', tekstkleur: '#1d1d1b' };
  const out = [];
  if (b.soort === 'beeld' && (beeldSrc || b.beeld)) {
    out.push(`<image href="${esc(beeldSrc || b.beeld)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`);
    return out.join('');
  }
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rond}" fill="${esc(b.kleur || '#ffffff')}"${rand ? ' stroke="#1d1d1b" stroke-width="1.5"' : ''}/>`);
  const kleur = esc(b.tekstkleur || '#1d1d1b');
  let ty = y; let th = h;
  if (b.boventitel) {
    const gb = Math.min(h * 0.2, (w * 0.9) / (b.boventitel.length * 0.6));
    out.push(`<text x="${x + w / 2}" y="${y + h * 0.06 + gb}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${gb.toFixed(1)}" fill="${kleur}" text-anchor="middle">${esc(b.boventitel)}</text>`);
    ty = y + h * 0.1 + gb; th = h - (ty - y);
  }
  const { regels, grootte } = tekstBlok(b.naam, w - 8, th, b.boventitel ? th * 0.95 : h * 0.42);
  const lh = grootte * 1.08;
  const start = ty + th / 2 - ((regels.length - 1) * lh) / 2 + grootte * 0.36;
  regels.forEach((r, i) => {
    out.push(`<text x="${x + w / 2}" y="${(start + i * lh).toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${grootte.toFixed(1)}" fill="${kleur}" text-anchor="middle">${esc(r)}</text>`);
  });
  return out.join('');
}

function pijlSvg(pijl, cx, cy, maat, kleur = '#1d1d1b') {
  if (!pijl || pijl === 'geen') return '';
  const hoek = { rechtdoor: 0, 'schuin-rechts': 45, rechts: 90, terug: 180, links: -90, 'schuin-links': -45 }[pijl];
  const v = hoek == null ? pijlVorm(pijl) : (() => {
    // Dikke pijl voor geprinte borden.
    const r = (hoek * Math.PI) / 180;
    const vorm = [[-0.16, 0.46], [0.16, 0.46], [0.16, 0.02], [0.42, 0.02], [0, -0.46], [-0.42, 0.02], [-0.16, 0.02]];
    return { vlak: vorm.map(([x, y]) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]) };
  })();
  const p = (pts) => pts.map(([a, b]) => `${(cx + a * maat).toFixed(1)},${(cy + b * maat).toFixed(1)}`).join(' ');
  let s = '';
  if (v.vlak) s += `<polygon points="${p(v.vlak)}" fill="${kleur}" stroke="${kleur}" stroke-width="${(maat * 0.04).toFixed(1)}" stroke-linejoin="round"/>`;
  if (v.lijn) s += `<polyline points="${p(v.lijn)}" fill="none" stroke="${kleur}" stroke-width="${(maat * 0.18).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (v.punt) s += `<polygon points="${p(v.punt)}" fill="${kleur}"/>`;
  return s;
}

// FLCS-logo (wit bestand) zwart maken met een filter.
const LOGO_FILTER = '<filter id="fm-zwart"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>';
function logoSvg(src, x, y, w, h, draai = false) {
  if (!src) return '';
  if (draai) {
    // verticaal, van onder naar boven leesbaar
    const cx = x + w / 2; const cy = y + h / 2;
    return `<g transform="rotate(-90 ${cx} ${cy})"><image href="${esc(src)}" x="${cx - h / 2}" y="${cy - w / 2}" width="${h}" height="${w}" preserveAspectRatio="xMidYMid meet" filter="url(#fm-zwart)"/></g>`;
  }
  return `<image href="${esc(src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" filter="url(#fm-zwart)"/>`;
}

export const LOGO_URL = '/brand/flcs-wit.svg';

// Eén bord als SVG-tekst.
export function bordSvg({ best, pijl, type = 'paneel', logo = true, logoSrc = LOGO_URL, beeldSrc, rand = true, voorbeeld = false }) {
  // Bord uit de bordenbibliotheek: het echte ontwerp, met de plakpijl in het pijlvak.
  if (best?.soort === 'set') {
    const W = Number(best.b_mm) || 800; const H = Number(best.h_mm) || 400;
    const z = best.zone;
    const pijlDeel = z && pijl && pijl !== 'geen' ? pijlSvg(pijl, z[0] * W, z[1] * H, z[2] * H * 1.15) : '';
    const kader = rand ? `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#c8c8c4" stroke-width="2"/>` : '';
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><image href="${esc(beeldSrc || best.beeld)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>${pijlDeel}${kader}</svg>`, w: W, h: H };
  }
  const { w, h } = bordMaat(type);
  const delen = [];
  let W = w; let H = h;
  if (type === 'paneel') {
    const pv = voorbeeld ? h * 0.8 : 0; // plakpijl-vak ernaast in de voorvertoning
    W = w + (pv ? pv + 16 : 0);
    delen.push(paneelSvg(best, 0, 0, w, h, { beeldSrc, rand: true }));
    if (pv) {
      const x0 = w + 16; const y0 = (h - pv) / 2;
      delen.push(`<rect x="${x0}" y="${y0}" width="${pv}" height="${pv}" fill="#fff" stroke="#9BA0A8" stroke-width="2" stroke-dasharray="7 5"/>`);
      delen.push(pijlSvg(pijl, x0 + pv / 2, y0 + pv / 2, pv * 0.86));
    }
  } else if (type === 'strook') {
    const lw = logo ? 34 : 0;
    const pw = (w - lw - 18) * 0.64; const ph = h - 16;
    if (logo) delen.push(logoSvg(logoSrc, 4, 8, lw - 6, h - 16, true));
    delen.push(paneelSvg(best, lw + 6, 8, pw, ph, { rond: 12, beeldSrc, rand: false }));
    const aw = w - (lw + 6 + pw) - 8;
    delen.push(pijlSvg(pijl, lw + 6 + pw + 4 + aw / 2, h / 2, Math.min(aw, h) * 1.02));
  } else {
    const lh = logo ? 62 : 0;
    if (logo) delen.push(logoSvg(logoSrc, w * 0.3, 14, w * 0.4, lh - 18));
    const ph = 175;
    delen.push(paneelSvg(best, 14, lh + 10, w - 28, ph, { rond: 16, beeldSrc, rand: false }));
    const ay = lh + 10 + ph + 8; const ah = h - ay - 8;
    delen.push(pijlSvg(pijl, w / 2, ay + ah / 2, ah * 1.05));
  }
  const kader = rand && type !== 'paneel' ? `<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" fill="none" stroke="#1d1d1b" stroke-width="1.5"/>` : '';
  const bg = type !== 'paneel' ? `<rect width="${W}" height="${H}" fill="#ffffff"/>` : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${LOGO_FILTER}</defs>${bg}${delen.join('')}${kader}</svg>`, w: W, h: H };
}

// React: één bord of een stapel borden (van boven naar onder).
export function BordVoorbeeld({ rijen, bestMap, inst, breedte = 220, gap = 4 }) {
  const type = inst?.bord || 'paneel';
  const logo = inst?.logo !== false;
  return (
    <div className="fm-bordstapel" style={{ width: breedte, display: 'flex', flexDirection: 'column', gap }}>
      {(rijen || []).map((r, i) => {
        const { svg, w, h } = bordSvg({ best: bestMap.get(r.bestemming_id), pijl: r.pijl, type, logo, voorbeeld: true });
        const bb = h > w ? breedte * 0.55 : breedte; // staande borden smaller tonen
        return <div key={i} style={{ width: bb, height: (bb * h) / w, lineHeight: 0, alignSelf: 'center' }} dangerouslySetInnerHTML={{ __html: svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="100%" height="100%"') }} />;
      })}
    </div>
  );
}

export function EenBord({ best, pijl, type = 'paneel', logo = true, breedte = 200 }) {
  const { svg, w, h } = bordSvg({ best, pijl, type, logo, voorbeeld: true });
  const bb = h > w ? breedte * 0.55 : breedte;
  return <div style={{ width: bb, height: (bb * h) / w, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg.replace(/width="[\d.]+" height="[\d.]+"/, 'width="100%" height="100%"') }} />;
}

// ---------- Drukbestand ----------

export async function naarDataUrl(url) {
  if (!url || url.startsWith('data:')) return url;
  const r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  return await new Promise((ok, nee) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = nee; f.readAsDataURL(blob); });
}

export async function svgNaarPng(svg, pxB, pxH) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise((ok, nee) => { img.onload = ok; img.onerror = () => nee(new Error('SVG laden mislukt')); img.src = url; });
    const c = document.createElement('canvas'); c.width = pxB; c.height = pxH;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, pxB, pxH);
    x.drawImage(img, 0, 0, pxB, pxH);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

// Unieke borden met aantallen: per bestemming (paneel) of per bestemming + pijl (geprint).
export function bordenLijst(items, inst, isSign) {
  const geprint = (inst.bord || 'paneel') !== 'paneel';
  const m = new Map();
  for (const it of items) {
    if (!isSign(it)) continue;
    for (const r of it.velden.sign.rijen || []) {
      const k = geprint ? `${r.bestemming_id}|${r.pijl || 'geen'}` : r.bestemming_id;
      const x = m.get(k) || { bestemming_id: r.bestemming_id, pijl: geprint ? r.pijl || 'geen' : null, stuks: 0, punten: [] };
      x.stuks += 1; x.punten.push(it.velden.sign.nr);
      m.set(k, x);
    }
  }
  return [...m.values()];
}

// PDF met één bord per blad, op het gekozen papierformaat, met het aantal in de rand.
export async function bordenPdf({ plan, items, inst, isSign, formaat = 'A4', alleBestemmingen = false, voortgang = () => {} }) {
  const { jsPDF } = await import('jspdf');
  const type = inst.bord || 'paneel';
  const bestMap = new Map(inst.bestemmingen.map((b) => [b.id, b]));
  let lijst = bordenLijst(items, inst, isSign);
  if (alleBestemmingen || !lijst.length) {
    const al = new Set(lijst.map((x) => x.bestemming_id));
    lijst = [...lijst, ...inst.bestemmingen.filter((b) => !al.has(b.id)).map((b) => ({ bestemming_id: b.id, pijl: type === 'paneel' ? null : 'rechtdoor', stuks: 0, punten: [] }))];
  }
  const meldingen = [];
  const uitSet = lijst.filter((x) => bestMap.get(x.bestemming_id)?.soort === 'set');
  if (uitSet.length) {
    const namen = [...new Set(uitSet.map((x) => bestMap.get(x.bestemming_id)))].map((b) => `${b.naam} (${b.bron || b.set_id})`);
    meldingen.push(`${namen.length} borden komen uit de bordenbibliotheek en staan niet in dit drukbestand: druk die van het originele ontwerp: ${namen.join(', ')}.`);
    lijst = lijst.filter((x) => bestMap.get(x.bestemming_id)?.soort !== 'set');
  }
  if (!lijst.length) return { doc: null, meldingen };
  let logoSrc = null;
  if (type !== 'paneel' && inst.logo !== false) {
    try { logoSrc = await naarDataUrl(LOGO_URL); } catch { meldingen.push('Het logo kon niet geladen worden.'); }
  }
  const beelden = new Map();
  for (const b of inst.bestemmingen) {
    if (b.soort !== 'beeld' || !b.beeld) continue;
    try { beelden.set(b.id, await naarDataUrl(b.beeld)); } catch { meldingen.push(`Afbeelding van ${b.naam} kon niet in de PDF (de website laat dat niet toe). Laad het bestand op in plaats van een link.`); }
  }
  const staand = type === 'staand';
  const doc = new jsPDF({ orientation: staand ? 'portrait' : 'landscape', unit: 'mm', format: formaat.toLowerCase(), compress: true });
  const PW = doc.internal.pageSize.getWidth(); const PH = doc.internal.pageSize.getHeight();
  const marge = 8; const voet = 8;
  const reserve = inst.reserve ?? 0.1;
  lijst.sort((a, b) => (bestMap.get(a.bestemming_id)?.naam || '').localeCompare(bestMap.get(b.bestemming_id)?.naam || '', 'nl', { numeric: true }) || String(a.pijl).localeCompare(String(b.pijl)));
  for (let i = 0; i < lijst.length; i++) {
    const x = lijst[i];
    voortgang(`Bord ${i + 1} van ${lijst.length}…`);
    if (i) doc.addPage();
    const best = bestMap.get(x.bestemming_id);
    const { svg, w, h } = bordSvg({ best, pijl: x.pijl, type, logo: inst.logo !== false, logoSrc, beeldSrc: beelden.get(x.bestemming_id) || (best?.soort === 'beeld' ? '' : undefined), rand: true });
    const maxB = PW - 2 * marge; const maxH = PH - 2 * marge - voet;
    const s = Math.min(maxB / w, maxH / h);
    const bw = w * s; const bh = h * s;
    const png = await svgNaarPng(svg, Math.round(bw * 8), Math.round(bh * 8));
    doc.addImage(png, 'PNG', (PW - bw) / 2, marge + (maxH - bh) / 2, bw, bh, undefined, 'FAST');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(104, 109, 118);
    const aantal = x.stuks ? `${x.stuks} nodig · ${Math.ceil(x.stuks * (1 + reserve))} drukken` : 'reserve';
    const punten = x.punten.length ? ` · punten ${[...new Set(x.punten)].join(', ')}` : '';
    doc.text(`${plan.naam} · ${best?.naam || '?'}${x.pijl && x.pijl !== 'geen' ? ` · ${PIJLCODE[x.pijl] || x.pijl}` : ''} · ${aantal}${punten}`.slice(0, 160), marge, PH - 4);
    doc.setTextColor(0, 0, 0);
  }
  return { doc, meldingen };
}
