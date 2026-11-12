"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { HOOFDDOMEIN } from "@/lib/org";
import { contrast, huisstijlVars, leesbaar, type Huisstijl } from "@/lib/huisstijl";

type H = { primair?: string; accent?: string; logo_licht?: string; logo_donker?: string; toolen_verbergen?: boolean };
const sb = () => supabaseBrowser();
const BUCKET = "maps";

// Logo omzetten naar PNG (SVG, JPG, WEBP of PNG in), 240 px hoog: scherp in de app, bruikbaar in PDF en mail.
async function naarPng(f: File): Promise<Blob> {
  const url = URL.createObjectURL(f);
  try {
    const im = await new Promise<HTMLImageElement>((ok, nok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => nok(new Error("Dit bestand is geen afbeelding.")); i.src = url; });
    const h = 240; const w = Math.max(1, Math.round((im.naturalWidth || 480) * (h / (im.naturalHeight || 240))));
    const c = document.createElement("canvas"); c.width = Math.min(w, 1440); c.height = h;
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, nok) => c.toBlob((b) => (b ? ok(b) : nok(new Error("Omzetten mislukt."))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

function Kleur({ label, waarde, onWaarde }: { label: string; waarde?: string; onWaarde: (v: string | undefined) => void }) {
  const geldig = !!waarde && /^#[0-9A-Fa-f]{6}$/.test(waarde);
  const bij = geldig && contrast(waarde!, "#FFFFFF") < 4.5 ? leesbaar(waarde!) : null;
  return (
    <label>
      <span className="t-label">{label}</span>
      <span className="t-rij" style={{ gap: 8 }}>
        <input type="color" value={geldig ? waarde : "#022056"} onChange={(e) => onWaarde(e.target.value.toUpperCase())} style={{ width: 44, height: 36, padding: 2, border: "1px solid var(--t-rand)", borderRadius: 6, background: "#fff" }} />
        <input className="t-veld" style={{ width: 120, fontFamily: "monospace" }} value={waarde || ""} placeholder="Standaard" onChange={(e) => onWaarde(e.target.value.trim() || undefined)} />
        {waarde && <button type="button" className="t-knop klein stil" onClick={() => onWaarde(undefined)}>Standaard</button>}
      </span>
      {bij && <span className="t-stil" style={{ display: "block", fontSize: 12, marginTop: 4 }}>Te licht voor witte tekst: de app gebruikt {bij}.</span>}
    </label>
  );
}

function Logo({ label, uitleg, waarde, donker, org, soort, onWaarde }: { label: string; uitleg: string; waarde?: string; donker: boolean; org: string; soort: string; onWaarde: (v: string | undefined) => void }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  async function kies(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setFout("Hoogstens 4 MB."); return; }
    setBezig(true); setFout("");
    try {
      const png = await naarPng(f);
      const pad = `huisstijl/${org}/${soort}-${Date.now()}.png`;
      const { error } = await sb().storage.from(BUCKET).upload(pad, png, { contentType: "image/png", cacheControl: "31536000" });
      if (error) throw error;
      // De opslag is privé: logo's gaan via /b op het eigen hoofddomein (ook bruikbaar in mails).
      const h = window.location.hostname;
      const basis = h === HOOFDDOMEIN || h.endsWith(`.${HOOFDDOMEIN}`) ? `https://login.${HOOFDDOMEIN}` : window.location.origin;
      onWaarde(`${basis}/b/${pad}`);
    } catch (x) { setFout((x as Error).message); }
    setBezig(false);
  }
  return (
    <div>
      <span className="t-label">{label}</span>
      <div style={{ height: 76, borderRadius: 8, border: "1px solid var(--t-rand)", background: donker ? "var(--voorbeeld-navy, #022056)" : "#fff", display: "grid", placeItems: "center", padding: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {waarde ? <img src={waarde} alt="" style={{ maxHeight: 52, maxWidth: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 12.5, color: donker ? "rgba(255,255,255,.6)" : "var(--t-tekst-3)" }}>Geen logo</span>}
      </div>
      <p className="t-stil" style={{ fontSize: 12, margin: "6px 0" }}>{uitleg}</p>
      <div className="t-rij" style={{ gap: 6 }}>
        <label className="t-knop klein" style={{ cursor: "pointer" }}>{bezig ? "Bezig…" : waarde ? "Ander logo" : "Logo opladen"}<input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" hidden onChange={kies} /></label>
        {waarde && <button type="button" className="t-knop klein stil" onClick={() => onWaarde(undefined)}>Weghalen</button>}
      </div>
      {fout && <p className="t-melding fout" style={{ marginTop: 6 }}>{fout}</p>}
    </div>
  );
}

// Huisstijl van een organisatie, enkel door het platform in te stellen. Werkt pas met de module Huisstijl.
export default function HuisstijlBeheer({ org, naam, kort, modules, onModule }: { org: string; naam: string; kort: string | null; modules: string[]; onModule: () => void }) {
  const [h, setH] = useState<H>({});
  const [melding, setMelding] = useState<{ soort: "ok" | "fout"; tekst: string } | null>(null);
  useEffect(() => { sb().schema("maps").from("organisaties").select("huisstijl").eq("id", org).single().then(({ data }) => setH(((data as { huisstijl?: H } | null)?.huisstijl) || {})); }, [org]);
  const zet = (k: keyof H, v: unknown) => setH((x) => { const n = { ...x, [k]: v } as H; if (v === undefined || v === false) delete n[k]; return n; });
  async function bewaar() {
    setMelding(null);
    const { error } = await sb().schema("maps").from("organisaties").update({ huisstijl: h }).eq("id", org);
    setMelding(error ? { soort: "fout", tekst: error.message } : { soort: "ok", tekst: "Huisstijl bewaard. Het kan tot 5 minuten duren voor ze overal zichtbaar is." });
  }
  const aan = modules.includes("huisstijl");
  const v = huisstijlVars({ ...h, naam } as Huisstijl);
  const navy = v["--t-navy"] || "#022056"; const blauw = v["--t-blauw"] || "#108AED";
  const logoD = h.logo_donker || h.logo_licht; const logoL = h.logo_licht || h.logo_donker;

  return (
    <div className="t-stapel" style={{ gap: 16 }}>
      {!aan && (
        <div className="t-melding" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>De module Huisstijl staat niet aan voor {naam}. Je kan alles al instellen; zichtbaar wordt het pas met de module.</span>
          <button className="t-knop klein" onClick={onModule}>Naar Abonnement</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <Kleur label="Hoofdkleur (zijbalk, inlogscherm, kop van deellinks)" waarde={h.primair} onWaarde={(x) => zet("primair", x)} />
        <Kleur label="Accentkleur (knoppen en selectie)" waarde={h.accent} onWaarde={(x) => zet("accent", x)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, ["--voorbeeld-navy" as string]: navy }}>
        <Logo label="Logo op donker" uitleg="Wit of licht logo, op de hoofdkleur (zijbalk, inlogscherm, deellink)." waarde={h.logo_donker} donker org={org} soort="donker" onWaarde={(x) => zet("logo_donker", x)} />
        <Logo label="Logo op licht" uitleg="Gekleurd logo, op wit (PDF-titelblok, mails)." waarde={h.logo_licht} donker={false} org={org} soort="licht" onWaarde={(x) => zet("logo_licht", x)} />
      </div>
      <label className="t-rij" style={{ gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={!!h.toolen_verbergen} onChange={(e) => zet("toolen_verbergen", e.target.checked)} />
        Vermelding "met toolen maps" verbergen (enkel op afspraak)
      </label>

      <div>
        <span className="t-label">Voorbeeld</span>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", border: "1px solid var(--t-rand)", borderRadius: 10, overflow: "hidden", minHeight: 170 }}>
          <div style={{ background: navy, color: "#fff", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoD ? <img src={logoD} alt="" style={{ height: 28, width: "auto", maxWidth: 150, objectFit: "contain", alignSelf: "flex-start" }} /> : <b>toolen maps</b>}
            <span style={{ fontSize: 12.5, opacity: .9 }}>Evenementen</span>
            <span style={{ fontSize: 12.5, background: "rgba(255,255,255,.14)", borderRadius: 6, padding: "4px 8px" }}>Plannen</span>
            {!h.toolen_verbergen && <span style={{ marginTop: "auto", fontSize: 11, opacity: .7 }}>met <b>toolen maps</b></span>}
          </div>
          <div style={{ background: "#F5F7FA", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <b style={{ fontSize: 17, color: "#0E1A33" }}>Ronde van Vlaanderen</b>
            <div className="t-rij" style={{ gap: 8 }}>
              <span style={{ background: blauw, color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600 }}>Nieuw plan</span>
              <span style={{ border: `1px solid ${blauw}`, color: blauw, borderRadius: 8, padding: "6px 12px", fontSize: 13 }}>Delen</span>
            </div>
            <div style={{ marginTop: "auto", background: "#fff", border: "1px solid var(--t-rand)", borderRadius: 8, padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoL ? <img src={logoL} alt="" style={{ height: 22, width: "auto", maxWidth: 110, objectFit: "contain" }} /> : <b style={{ fontSize: 12 }}>{kort || naam}</b>}
              <span style={{ fontSize: 12, color: "#4A5A75" }}>Titelblok van de PDF{h.toolen_verbergen ? "" : " · Gemaakt met Toolen Maps"}</span>
            </div>
          </div>
        </div>
      </div>
      {melding && <p className={`t-melding ${melding.soort}`} style={{ margin: 0 }}>{melding.tekst}</p>}
      <div className="t-rij" style={{ justifyContent: "flex-end" }}><button className="t-knop hoofd" style={{ flex: "none" }} onClick={bewaar}>Bewaren</button></div>
    </div>
  );
}
