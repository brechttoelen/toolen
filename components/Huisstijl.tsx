import { huisstijlCss, toonToolen, type Huisstijl } from "@/lib/huisstijl";

// Kleuren van de organisatie als CSS-variabelen voor de hele pagina (ook dialogen en menu's).
export function HuisstijlStijl({ huisstijl }: { huisstijl: Huisstijl }) {
  const css = huisstijlCss(huisstijl);
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}

// Logo van de organisatie. donker = op een donkere achtergrond (valt terug op het andere logo).
export function OrgLogo({ huisstijl, donker = false, hoogte = 32, style }: { huisstijl: Huisstijl; donker?: boolean; hoogte?: number; style?: React.CSSProperties }) {
  const src = donker ? huisstijl?.logo_donker || huisstijl?.logo_licht : huisstijl?.logo_licht || huisstijl?.logo_donker;
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={huisstijl?.naam || ""} style={{ height: hoogte, width: "auto", maxWidth: hoogte * 6, objectFit: "contain", display: "block", ...style }} />;
}

// Kleine, vaste vermelding van het product bij een eigen huisstijl.
export function MetToolen({ huisstijl, donker = false, style }: { huisstijl: Huisstijl; donker?: boolean; style?: React.CSSProperties }) {
  if (!huisstijl || !toonToolen(huisstijl)) return null;
  return (
    <span style={{ fontSize: 11.5, letterSpacing: ".01em", color: donker ? "rgba(255,255,255,.7)" : "var(--t-tekst-3, #7A828F)", whiteSpace: "nowrap", ...style }}>
      met <b style={{ fontWeight: 700, color: donker ? "#fff" : "var(--t-tekst-2, #3B4558)" }}>toolen maps</b>
    </span>
  );
}
