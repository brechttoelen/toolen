// Eigen huisstijl van een organisatie (module "huisstijl", ingesteld door het platform).
// Kleuren worden bijgestuurd tot witte tekst erop leesbaar is (WCAG AA, 4,5:1), zodat geen
// enkele huisstijl de app onleesbaar maakt. Functionele kleuren (fout, ok, werkplekken) blijven.

export type Huisstijl = {
  naam?: string; kort?: string;
  primair?: string; accent?: string;
  logo_licht?: string; logo_donker?: string;
  toolen_verbergen?: boolean;
} | null;

const hexNaarRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbNaarHex = (r: number[]) => `#${r.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const lum = (rgb: number[]) => { const c = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a: string, b: string) => { const x = hexNaarRgb(a); const y = hexNaarRgb(b); if (!x || !y) return 21; const l1 = lum(x); const l2 = lum(y); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
export const meng = (a: string, b: string, t: number) => { const x = hexNaarRgb(a)!; const y = hexNaarRgb(b)!; return rgbNaarHex(x.map((v, i) => v + (y[i] - v) * t)); };

// Donkerder tot wit erop leesbaar is.
export function leesbaar(kleur: string, min = 4.5): string {
  if (!hexNaarRgb(kleur)) return kleur;
  let k = kleur.toUpperCase();
  for (let i = 0; i < 30 && contrast(k, "#FFFFFF") < min; i++) k = meng(k, "#000000", 0.06);
  return k;
}

// CSS-variabelen van de app (app/toolen.css) voor deze huisstijl.
export function huisstijlVars(h: Huisstijl): Record<string, string> {
  if (!h) return {};
  const v: Record<string, string> = {};
  if (h.primair && hexNaarRgb(h.primair)) v["--t-navy"] = leesbaar(h.primair);
  if (h.accent && hexNaarRgb(h.accent)) {
    const a = leesbaar(h.accent);
    v["--t-blauw"] = a;
    v["--t-blauw-donker"] = meng(a, "#000000", 0.16);
    v["--t-blauw-zacht"] = meng(a, "#FFFFFF", 0.9);
  }
  return v;
}

export function huisstijlCss(h: Huisstijl): string {
  const v = huisstijlVars(h);
  const regels = Object.entries(v).map(([k, w]) => `${k}:${w}`).join(";");
  return regels ? `:root{${regels}}` : "";
}

export const toonToolen = (h: Huisstijl) => !h?.toolen_verbergen;
