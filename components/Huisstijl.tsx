import { huisstijlCss, toonToolen, type Huisstijl } from "@/lib/huisstijl";
import { ToolenTeken } from "./ToolenLogo";

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

// Vaste vermelding van het product bij een eigen huisstijl: "Powered by" met het mini-logo.
export function MetToolen({ huisstijl, donker = false, style }: { huisstijl: Huisstijl; donker?: boolean; style?: React.CSSProperties }) {
  if (!huisstijl || !toonToolen(huisstijl)) return null;
  return (
    <a className="t-powered" href="https://toolen.be" target="_blank" rel="noreferrer" style={{ color: donker ? "rgba(255,255,255,.82)" : "var(--t-tekst-2, #4A5A75)", ...style }}>
      Powered by <ToolenTeken op={donker ? "navy" : "licht"} grootte={16} /><b style={{ color: donker ? "#fff" : "var(--t-tekst, #0E1A33)" }}>Toolen Maps</b>
    </a>
  );
}
