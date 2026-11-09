"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToolenTeken } from "./ToolenLogo";
import { supabaseBrowser } from "@/lib/supabase/client";
import { orgAdres, centraalAdres } from "@/lib/adres";

export type KopOrg = { slug: string; naam: string; rol?: string };
export type KopProps = {
  product?: string;
  organisatie?: { slug: string; naam: string } | null;
  links?: { href: string; tekst: string }[];
  gebruiker?: { naam?: string | null; email?: string | null } | null;
  organisaties?: KopOrg[];
  platform?: boolean;
  instellingen?: boolean;
  extra?: React.ReactNode;
};

const ROL: Record<string, string> = { eigenaar: "Eigenaar", beheerder: "Beheerder", bewerker: "Bewerker", lezer: "Lezer" };

function initialen(naam?: string | null, email?: string | null) {
  const bron = (naam || email || "?").trim();
  const delen = bron.split(/[\s.@]+/).filter(Boolean);
  return ((delen[0]?.[0] || "") + (delen[1]?.[0] || "")).toUpperCase() || "?";
}

// De navy kop van Toolen: merk, organisatie, navigatie, en rechts het accountmenu
// (organisatie wisselen, instellingen, platformbeheer, uitloggen).
export default function Kop({ product = "maps", organisatie, links = [], gebruiker, organisaties = [], platform, instellingen, extra }: KopProps) {
  const pad = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dicht = (e: MouseEvent) => { if (menu.current && !menu.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", dicht);
    return () => document.removeEventListener("mousedown", dicht);
  }, []);

  async function uitloggen() {
    await supabaseBrowser().auth.signOut();
    window.location.href = centraalAdres("/login");
  }

  const actief = (href: string) => (href === "/maps" ? pad === "/maps" || /^\/[^/]+\/maps\/?$/.test(pad || "") : (pad || "").includes(href.replace(/^\/maps/, "")) && href !== "/maps");

  return (
    <header className="t-kop">
      <Link href={organisatie ? "/maps" : "/kies"} className="merk" style={{ color: "#fff" }}>
        <ToolenTeken grootte={24} />
        <span>toolen <span style={{ fontWeight: 400, opacity: 0.75 }}>{product}</span></span>
      </Link>
      {organisatie && <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>{organisatie.naam}</span>}
      <nav style={{ display: "flex", gap: 18, marginLeft: 12 }}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={actief(l.href) ? "aan" : ""}>{l.tekst}</Link>
        ))}
      </nav>
      <div className="rechts">
        {extra}
        {gebruiker && (
          <div ref={menu} style={{ position: "relative" }}>
            <button className="t-kop-knop" onClick={() => setOpen(!open)} aria-expanded={open}>
              <span className="t-avatar">{initialen(gebruiker.naam, gebruiker.email)}</span>
              <span>{gebruiker.naam || gebruiker.email}</span>
            </button>
            {open && (
              <div className="t-menu">
                <div className="kop">{gebruiker.email}</div>
                {organisaties.length > 0 && (
                  <>
                    <hr />
                    <div className="kop">Organisaties</div>
                    {organisaties.map((o) => (
                      <a key={o.slug} href={orgAdres(o.slug)} style={o.slug === organisatie?.slug ? { fontWeight: 600 } : undefined}>
                        <span style={{ flex: 1 }}>{o.naam}</span>
                        {o.rol && <span className="t-stil" style={{ fontSize: 12 }}>{ROL[o.rol] || o.rol}</span>}
                      </a>
                    ))}
                  </>
                )}
                <hr />
                {organisatie && instellingen && <Link href="/instellingen" onClick={() => setOpen(false)}>Instellingen van {organisatie.naam}</Link>}
                {platform && <a href={centraalAdres("/beheer")}>Platformbeheer</a>}
                <button onClick={uitloggen}>Uitloggen</button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
