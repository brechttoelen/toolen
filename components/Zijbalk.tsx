"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToolenTeken } from "./ToolenLogo";
import { supabaseBrowser } from "@/lib/supabase/client";
import { orgAdres, centraalAdres } from "@/lib/adres";
import SessieWacht from "./SessieWacht";
import { MetToolen, OrgLogo } from "./Huisstijl";
import type { Huisstijl } from "@/lib/huisstijl";

type Org = { slug: string; naam: string; kort?: string; pakket?: string };
type Props = {
  organisatie: Org;
  organisaties: { slug: string; naam: string; rol: string }[];
  gebruiker: { naam?: string | null; email?: string | null };
  rol?: string;
  platform: boolean;
  plaatsen?: number | null;
  melding?: string | null;
  extra?: React.ReactNode;
  huisstijl?: Huisstijl;
  feedback?: boolean;
  branding?: boolean;
  children: React.ReactNode;
};

const ROL: Record<string, string> = { eigenaar: "Eigenaar", beheerder: "Beheerder", bewerker: "Bewerker", lezer: "Lezer" };
const PAKKET: Record<string, string> = { proef: "Proef", event: "Event", pro: "Pro", organisatie: "Organisatie", maatwerk: "Maatwerk" };

// De editor, de opbouwmodus en de export krijgen het volledige scherm.
const VOL_SCHERM = /\/maps\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i;

function initialen(naam?: string | null, email?: string | null) {
  const delen = (naam || email || "?").trim().split(/[\s.@]+/).filter(Boolean);
  return ((delen[0]?.[0] || "") + (delen[1]?.[0] || "")).toUpperCase() || "?";
}

// Schil van Toolen Maps binnen een organisatie: navy kolom links, licht werkvlak rechts.
export default function Zijbalk({ organisatie, organisaties, gebruiker, rol, platform, plaatsen, melding, extra, huisstijl = null, feedback = false, branding = false, children }: Props) {
  const pad = usePathname() || "";
  const [orgOpen, setOrgOpen] = useState(false);
  const [ikOpen, setIkOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const ikRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dicht = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false);
      if (ikRef.current && !ikRef.current.contains(e.target as Node)) setIkOpen(false);
    };
    document.addEventListener("mousedown", dicht);
    return () => document.removeEventListener("mousedown", dicht);
  }, []);

  if (VOL_SCHERM.test(pad)) return <><SessieWacht />{children}</>;

  const beheerder = rol === "eigenaar" || rol === "beheerder";
  const p = pad.replace(/^\/[^/]+(?=\/maps|\/instellingen)/, ""); // /flcs/maps/x → /maps/x (preview zonder subdomein)
  const actief = (href: string) => (href === "/maps" ? p === "/maps" || p === "/maps/" : p.startsWith(href));
  const links = [
    { href: "/maps", tekst: "Overzicht" },
    { href: "/maps/plannen", tekst: "Plannen" },
    { href: "/maps/bibliotheek", tekst: "Bibliotheek" },
    ...(branding ? [{ href: "/maps/branding", tekst: "Branding" }] : []),
    { href: "/maps/leveranciers", tekst: "Leveranciers" },
  ];

  async function uitloggen() {
    await supabaseBrowser().auth.signOut();
    window.location.href = centraalAdres("/login");
  }

  return (
    <div className="t-schil">
      <SessieWacht />
      <nav className="t-zij" aria-label="Hoofdmenu">
        {huisstijl && (huisstijl.logo_donker || huisstijl.logo_licht) ? (
          <Link href="/maps" className="t-zij-merk t-zij-eigen" aria-label={huisstijl.naam || organisatie.naam}>
            <OrgLogo huisstijl={huisstijl} donker hoogte={34} />
          </Link>
        ) : (
          <Link href="/maps" className="t-zij-merk">
            <ToolenTeken grootte={30} />
            <span>toolen<small>maps</small></span>
          </Link>
        )}

        <div ref={orgRef} style={{ position: "relative" }}>
          <button className="t-zij-org" onClick={() => setOrgOpen(!orgOpen)} aria-expanded={orgOpen}>
            <span className="t-zij-orgteken">{(organisatie.kort || organisatie.naam).slice(0, 4).toUpperCase()}</span>
            <span className="t-zij-orgnaam">
              <b>{organisatie.naam}</b>
              <small>{[PAKKET[organisatie.pakket || ""] || organisatie.pakket, plaatsen ? `${plaatsen} plaatsen` : null].filter(Boolean).join(" · ")}</small>
            </span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 5.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
          </button>
          {orgOpen && (
            <div className="t-menu" style={{ left: 0, right: 0, minWidth: 0, top: "calc(100% + 6px)" }}>
              <div className="kop">Organisaties</div>
              {organisaties.map((o) => (
                <a key={o.slug} href={orgAdres(o.slug)} style={o.slug === organisatie.slug ? { fontWeight: 600 } : undefined}>
                  <span style={{ flex: 1 }}>{o.naam}</span>
                  <span className="t-stil" style={{ fontSize: 12 }}>{ROL[o.rol] || o.rol}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="t-zij-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={actief(l.href) ? "aan" : ""} aria-current={actief(l.href) ? "page" : undefined}>{l.tekst}</Link>
          ))}
        </div>

        {(beheerder || platform) && (
          <div className="t-zij-links">
            <span className="t-zij-kop">Organisatie</span>
            {beheerder && <Link href="/instellingen" className={p.startsWith("/instellingen") ? "aan" : ""}>Leden en pakket</Link>}
            {feedback && beheerder && <Link href="/maps/feedback" className={p.startsWith("/maps/feedback") ? "aan" : ""}>Alle feedback</Link>}
            {platform && <a href={centraalAdres("/beheer")}>Platformbeheer</a>}
          </div>
        )}

        <div className="t-zij-voet" ref={ikRef}>
          {feedback && extra}
          <button className="t-zij-ik" onClick={() => setIkOpen(!ikOpen)} aria-expanded={ikOpen}>
            <span className="t-avatar" style={{ background: "#28B571" }}>{initialen(gebruiker.naam, gebruiker.email)}</span>
            <span className="t-zij-orgnaam"><b>{gebruiker.naam || gebruiker.email}</b><small>{ROL[rol || ""] || rol}</small></span>
          </button>
          {ikOpen && (
            <div className="t-menu" style={{ left: 0, right: 0, minWidth: 0, top: "auto", bottom: "calc(100% + 6px)" }}>
              <div className="kop">{gebruiker.email}</div>
              <a href={centraalAdres(`/account?verder=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`)}>Mijn account</a>
              <a href={centraalAdres("/wachtwoord")}>Wachtwoord wijzigen</a>
              <a href={centraalAdres("/mfa")}>Tweestapsverificatie</a>
              <hr />
              <button onClick={uitloggen}>Uitloggen</button>
            </div>
          )}
          {huisstijl && <MetToolen huisstijl={huisstijl} donker style={{ padding: "4px 10px 0" }} />}
        </div>
      </nav>
      <div className="t-werk">
        {melding && <div className="t-melding" style={{ borderRadius: 0, background: "var(--t-let-op-zacht)", color: "var(--t-let-op)", padding: "8px 20px" }}>{melding}</div>}
        {children}
      </div>
    </div>
  );
}
