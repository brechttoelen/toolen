import { ToolenTeken } from "../ToolenLogo";

// Zijbalk van het platformbeheer: donkerder dan die van een organisatie, zodat je altijd ziet waar je zit.
export default function PlatformZij({ blad, gebruiker }: { blad: "organisaties" | "pakketten" | "bibliotheek" | "systeem"; gebruiker: string }) {
  return (
    <nav className="t-zij" aria-label="Platform" style={{ background: "#0B1B33" }}>
      <a href="/beheer" className="t-zij-merk"><ToolenTeken grootte={30} /><span>toolen<small>platform</small></span></a>
      <div className="t-zij-links">
        <a href="/beheer" className={blad === "organisaties" ? "aan" : ""} aria-current={blad === "organisaties" ? "page" : undefined}>Organisaties</a>
        <a href="/beheer?blad=pakketten" className={blad === "pakketten" ? "aan" : ""} aria-current={blad === "pakketten" ? "page" : undefined}>Pakketten</a>
        <a href="/beheer?blad=bibliotheek" className={blad === "bibliotheek" ? "aan" : ""} aria-current={blad === "bibliotheek" ? "page" : undefined}>Bibliotheek</a>
        <a href="/beheer?blad=systeem" className={blad === "systeem" ? "aan" : ""} aria-current={blad === "systeem" ? "page" : undefined}>Systeem</a>
      </div>
      <div className="t-zij-voet">
        <a href="/account?verder=/beheer" style={{ color: "#DCE6F5", fontSize: 13.5, padding: "6px 10px" }}>Mijn account</a>
        <a href="/mfa" style={{ color: "#DCE6F5", fontSize: 13.5, padding: "6px 10px" }}>Tweestapsverificatie</a>
        <a href="/kies" style={{ color: "#DCE6F5", fontSize: 13.5, padding: "6px 10px" }}>Naar je organisaties</a>
        <span style={{ fontSize: 12.5, opacity: 0.7, padding: "0 10px" }}>{gebruiker}</span>
      </div>
    </nav>
  );
}
