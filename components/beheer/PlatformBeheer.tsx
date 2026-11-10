"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { orgAdres } from "@/lib/adres";
import {
  MODULES, KOPPELINGEN, PAKKETTEN, STATUSSEN, ROLLEN, statusVan, pakketVan, rolNaam, slugVan,
  uitnodigingsAdres, datum, tijdstip,
} from "@/lib/pakketten";
import { HOOFDDOMEIN } from "@/lib/org";

type Org = {
  id: string; slug: string; naam: string; kort: string | null; status: string; status_sinds: string; proef_tot: string | null;
  pakket: string; plaatsen: number; plaatsen_gebruikt: number; lezers_max: number; lezers_gebruikt: number; modules: string[];
  plannen: number; eigenaars: string | null; laatste_wijziging: string | null; created_at: string;
};
type Lid = { user_id: string; email: string; naam: string | null; rol: string; actief: boolean; sinds: string };
type Uitn = { id: string; email: string; rol: string; token: string; geldig_tot: string; aanvaard_op: string | null; created_at: string };
type Log = { id: number; actie: string; details: Record<string, unknown>; op: string };
export type Pakket = {
  id: string; naam: string; omschrijving: string | null; plaatsen: number; lezers: number; modules: string[]; modules_keuze: number;
  prijs_jaar: number | null; prijs_plaats: number | null; prijs_module: number | null; proef_dagen: number | null; sso: boolean; actief: boolean; volgorde: number;
  max_events_jaar?: number | null; max_deellinks?: number | null; max_opslag_mb?: number | null;
};

const sb = () => supabaseBrowser();
const KOPPELING_IDS = KOPPELINGEN.map((k) => k.id);

// Pakketten uit de databank (0005_pakketten.sql); zolang die tabel er niet is, de vaste lijst uit de code.
function vastePakketten(): Pakket[] {
  return PAKKETTEN.map((p, i) => ({ ...p, omschrijving: null, modules_keuze: 0, prijs_jaar: null, prijs_plaats: null, prijs_module: null,
    proef_dagen: p.id === "proef" ? 30 : null, sso: false, actief: true, volgorde: i }));
}
function usePakketten() {
  const [lijst, setLijst] = useState<Pakket[]>(vastePakketten());
  const [uitDb, setUitDb] = useState(false);
  async function laad() {
    const { data, error } = await sb().from("pakketten").select("*").order("volgorde").order("naam");
    if (!error && data) { setLijst(data as Pakket[]); setUitDb(true); }
  }
  useEffect(() => { laad(); }, []);
  const van = (id: string) => lijst.find((p) => p.id === id) || { ...pakketVan(id), omschrijving: null, modules_keuze: 0, prijs_jaar: null, prijs_plaats: null, prijs_module: null, proef_dagen: null, sso: false, actief: true, volgorde: 0 };
  return { lijst, uitDb, laad, van };
}
const limietTekst = (p: Pakket) => [p.max_events_jaar != null ? `${p.max_events_jaar} events/jaar` : null, p.max_deellinks != null ? `${p.max_deellinks} links` : null, p.max_opslag_mb != null ? `${p.max_opslag_mb >= 1000 ? `${p.max_opslag_mb / 1000} GB` : `${p.max_opslag_mb} MB`}` : null].filter(Boolean).join(" · ") || "Onbeperkt";
// Modules van een pakket, met de koppelingen die de organisatie al had.
const metKoppelingen = (p: Pakket, huidig: string[]) => [...new Set([...p.modules, ...huidig.filter((m) => KOPPELING_IDS.includes(m))])];
const moduleNaam = (id: string) => [...MODULES, ...KOPPELINGEN].find((m) => m.id === id)?.naam || id;
const euro = (n: number | null) => (n == null ? "–" : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));

function Kopieer({ tekst, label = "Kopieer link" }: { tekst: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="t-knop klein" onClick={async () => { await navigator.clipboard.writeText(tekst); setOk(true); setTimeout(() => setOk(false), 1500); }}>
      {ok ? "Gekopieerd" : label}
    </button>
  );
}

export default function PlatformBeheer({ blad = "organisaties" }: { blad?: "organisaties" | "pakketten" }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [fout, setFout] = useState("");
  const [zoek, setZoek] = useState("");
  const [nieuw, setNieuw] = useState(false);
  const [open, setOpen] = useState<Org | null>(null);
  const pk = usePakketten();

  async function laad() {
    const { data, error } = await sb().rpc("platform_overzicht");
    if (error) setFout(error.message); else setOrgs((data || []) as Org[]);
  }
  useEffect(() => { laad(); }, []);

  const lijst = useMemo(() => (orgs || []).filter((o) => !zoek || `${o.naam} ${o.slug} ${o.eigenaars || ""}`.toLowerCase().includes(zoek.toLowerCase())), [orgs, zoek]);
  const tel = (s: string) => (orgs || []).filter((o) => o.status === s).length;

  return (
    <main className="t-inhoud" style={{ maxWidth: 1240, margin: 0, padding: "28px 32px 64px" }}>
      <div className="t-rij" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px" }}>
          <h1 className="t-titel">{blad === "pakketten" ? "Pakketten" : "Organisaties"}</h1>
          <p className="t-sub">{blad === "pakketten" ? "Standaardwaarden voor nieuwe organisaties: plaatsen, lezers, modules en prijzen." : "Abonnementen en gebruik. Je ziet hier nooit de plannen van klanten."}</p>
        </div>
        {blad === "organisaties" && <button className="t-knop hoofd" onClick={() => setNieuw(true)}>Nieuwe organisatie</button>}
      </div>

<div style={{ height: 16 }} />

      {blad === "pakketten" && <PakkettenBeheer pk={pk} orgs={orgs || []} />}
      {blad === "organisaties" && <>

      {fout && <p className="t-melding fout" style={{ marginTop: 16 }}>{fout}</p>}

      <div className="t-kaart" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", overflow: "hidden", marginTop: 8 }}>
        {STATUSSEN.filter((st) => st.id !== "verwijderd").map((st, i) => {
          const wie = (orgs || []).filter((o) => o.status === st.id);
          const kleur = { proef: "var(--t-blauw)", actief: "var(--t-groen)", achterstallig: "var(--t-let-op)", alleen_lezen: "var(--t-let-op)", geblokkeerd: "var(--t-fout)" }[st.id] || "var(--t-rand-2)";
          return (
            <div key={st.id} style={{ padding: "14px 18px", borderTop: `4px solid ${kleur}`, borderLeft: i ? "1px solid var(--t-rand)" : 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="t-stil" style={{ fontSize: 12.5 }}>{st.naam}</span>
              <span style={{ fontFamily: "var(--font-titel)", fontStretch: "125%", fontWeight: 800, fontSize: 28 }}>{wie.length}</span>
              <span className="t-sub" style={{ margin: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wie.map((o) => o.kort || o.naam).join(", ") || "–"}</span>
            </div>
          );
        })}
      </div>
      <p className="t-sub" style={{ marginTop: 10 }}>{(orgs || []).length} organisaties · {(orgs || []).reduce((t, o) => t + Number(o.plaatsen_gebruikt || 0), 0)} plaatsen in gebruik</p>

      <div className="t-rij" style={{ marginTop: 28, marginBottom: 12 }}>
        <input className="t-veld" style={{ maxWidth: 320 }} placeholder="Zoek op naam, adres of eigenaar" value={zoek} onChange={(e) => setZoek(e.target.value)} />
      </div>

      <div className="t-kaart" style={{ overflowX: "auto" }}>
        <table className="t-tabel">
          <thead>
            <tr><th>Organisatie</th><th>Status</th><th>Pakket</th><th>Plaatsen</th><th>Lezers</th><th>Plannen</th><th>Eigenaar</th><th>Laatst actief</th></tr>
          </thead>
          <tbody>
            {orgs === null && <tr><td colSpan={8} className="t-stil">Laden…</td></tr>}
            {orgs && lijst.length === 0 && <tr><td colSpan={8} className="t-stil">Geen organisaties.</td></tr>}
            {lijst.map((o) => {
              const st = statusVan(o.status);
              return (
                <tr key={o.id} className="klik" onClick={() => setOpen(o)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{o.naam}</div>
                    <div className="t-stil" style={{ fontSize: 12.5 }}>{o.slug}.{HOOFDDOMEIN}</div>
                  </td>
                  <td>
                    <span className={`t-pil ${st.pil}`}>{st.naam}</span>
                    {o.status === "proef" && o.proef_tot && <div className="t-stil" style={{ fontSize: 12, marginTop: 4 }}>tot {datum(o.proef_tot)}</div>}
                  </td>
                  <td>{pk.van(o.pakket).naam}</td>
                  <td>{o.plaatsen_gebruikt} / {o.plaatsen}</td>
                  <td>{o.lezers_gebruikt} / {o.lezers_max}</td>
                  <td>{o.plannen}</td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.eigenaars || <span className="t-stil">Uitgenodigd</span>}</td>
                  <td className="t-stil">{o.laatste_wijziging ? tijdstip(o.laatste_wijziging) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      </>}

      {nieuw && <NieuweOrganisatie pk={pk} onSluit={() => setNieuw(false)} onKlaar={() => laad()} />}
      {open && <OrganisatieDetail pk={pk} org={open} onSluit={() => setOpen(null)} onGewijzigd={() => laad()} />}
    </main>
  );
}

function ModuleKeuze({ waarde, onWijzig, zonderKoppelingen = false }: { waarde: string[]; onWijzig: (m: string[]) => void; zonderKoppelingen?: boolean }) {
  const zet = (id: string, aan: boolean) => onWijzig(aan ? [...new Set([...waarde, id])] : waarde.filter((x) => x !== id));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
      {[...MODULES, ...(zonderKoppelingen ? [] : KOPPELINGEN.map((k) => ({ ...k, uitleg: "koppeling" })))].map((m) => (
        <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, cursor: "pointer" }}>
          <input type="checkbox" checked={waarde.includes(m.id)} onChange={(e) => zet(m.id, e.target.checked)} style={{ marginTop: 3 }} />
          <span>{m.naam}<span className="t-stil" style={{ display: "block", fontSize: 12 }}>{m.uitleg}</span></span>
        </label>
      ))}
    </div>
  );
}

function NieuweOrganisatie({ pk, onSluit, onKlaar }: { pk: ReturnType<typeof usePakketten>; onSluit: () => void; onKlaar: () => void }) {
  const [naam, setNaam] = useState("");
  const [slug, setSlug] = useState("");
  const [slugAangepast, setSlugAangepast] = useState(false);
  const [kort, setKort] = useState("");
  const [pakket, setPakket] = useState("proef");
  const [plaatsen, setPlaatsen] = useState(5);
  const [lezers, setLezers] = useState(25);
  const [modules, setModules] = useState<string[]>(pakketVan("proef").modules);
  const [status, setStatus] = useState("proef");
  const [dagen, setDagen] = useState(30);
  const [eigenaar, setEigenaar] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [klaar, setKlaar] = useState<{ slug: string; token: string | null; lid: boolean } | null>(null);

  function kiesPakket(id: string) {
    const p = pk.van(id);
    setPakket(id); setPlaatsen(p.plaatsen); setLezers(p.lezers); setModules(p.modules);
    setStatus(p.proef_dagen ? "proef" : "actief"); if (p.proef_dagen) setDagen(p.proef_dagen);
  }
  const gekozen = pk.van(pakket);

  async function maak(e: React.FormEvent) {
    e.preventDefault();
    setBezig(true); setFout("");
    const { data, error } = await sb().rpc("platform_organisatie_aanmaken", {
      p_naam: naam, p_slug: slug, p_kort: kort || null, p_pakket: pakket, p_plaatsen: plaatsen, p_lezers: lezers,
      p_modules: modules, p_status: status, p_proef_tot: status === "proef" ? new Date(Date.now() + dagen * 864e5).toISOString() : null,
      p_eigenaar_email: eigenaar || null,
    });
    setBezig(false);
    if (error) { setFout(error.message); return; }
    const d = data as { slug: string; token: string | null; eigenaar_lid: boolean };
    setKlaar({ slug: d.slug, token: d.token, lid: d.eigenaar_lid });
    onKlaar();
  }

  return (
    <div className="t-dialoog-achter" onMouseDown={(e) => e.target === e.currentTarget && onSluit()}>
      <div className="t-dialoog" style={{ maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}>
        {klaar ? (
          <>
            <h2>{naam} is aangemaakt</h2>
            <p className="t-sub">Adres: {klaar.slug}.{HOOFDDOMEIN}</p>
            {klaar.token ? (
              <div className="t-stapel" style={{ marginTop: 16 }}>
                <p style={{ margin: 0 }}>{eigenaar} heeft nog geen account. Stuur deze uitnodigingslink (14 dagen geldig):</p>
                <div className="t-rij"><input className="t-veld" readOnly value={uitnodigingsAdres(klaar.token)} /><Kopieer tekst={uitnodigingsAdres(klaar.token)} /></div>
              </div>
            ) : klaar.lid ? <p style={{ marginTop: 16 }}>{eigenaar} is meteen eigenaar.</p> : <p style={{ marginTop: 16 }} className="t-stil">Nog geen eigenaar: nodig er een uit via de organisatie.</p>}
            <div className="t-rij" style={{ marginTop: 24, justifyContent: "flex-end" }}>
              <a className="t-knop" href={orgAdres(klaar.slug)}>Openen</a>
              <button className="t-knop hoofd" onClick={onSluit}>Klaar</button>
            </div>
          </>
        ) : (
          <form onSubmit={maak} className="t-stapel">
            <h2 style={{ margin: 0 }}>Nieuwe organisatie</h2>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <label><span className="t-label">Naam</span>
                <input className="t-veld" required value={naam} onChange={(e) => { setNaam(e.target.value); if (!slugAangepast) setSlug(slugVan(e.target.value)); }} placeholder="Golazo Sports" /></label>
              <label><span className="t-label">Korte naam</span>
                <input className="t-veld" value={kort} onChange={(e) => setKort(e.target.value)} placeholder="Golazo" /></label>
            </div>
            <label><span className="t-label">Adres</span>
              <div className="t-rij" style={{ gap: 6 }}>
                <input className="t-veld" required value={slug} onChange={(e) => { setSlug(slugVan(e.target.value)); setSlugAangepast(true); }} style={{ maxWidth: 220 }} />
                <span className="t-stil">.{HOOFDDOMEIN}</span>
              </div></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <label><span className="t-label">Pakket</span>
                <select className="t-veld" value={pakket} onChange={(e) => kiesPakket(e.target.value)}>{pk.lijst.filter((p) => p.actief || p.id === pakket).map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}</select></label>
              <label><span className="t-label">Plaatsen</span>
                <input className="t-veld" type="number" min={1} value={plaatsen} onChange={(e) => setPlaatsen(Number(e.target.value))} /></label>
              <label><span className="t-label">Lezers</span>
                <input className="t-veld" type="number" min={0} value={lezers} onChange={(e) => setLezers(Number(e.target.value))} /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label><span className="t-label">Status</span>
                <select className="t-veld" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSSEN.filter((s) => s.id === "proef" || s.id === "actief").map((s) => <option key={s.id} value={s.id}>{s.naam}</option>)}</select></label>
              {status === "proef" && <label><span className="t-label">Proef (dagen)</span>
                <input className="t-veld" type="number" min={1} value={dagen} onChange={(e) => setDagen(Number(e.target.value))} /></label>}
            </div>
            <div><span className="t-label">Modules</span>
              <Afwijking p={gekozen} plaatsen={plaatsen} lezers={lezers} modules={modules} />
              <ModuleKeuze waarde={modules} onWijzig={setModules} /></div>
            <label><span className="t-label">Eerste eigenaar (e-mail)</span>
              <input className="t-veld" type="email" value={eigenaar} onChange={(e) => setEigenaar(e.target.value)} placeholder="naam@bedrijf.be" /></label>
            {fout && <p className="t-melding fout" style={{ margin: 0 }}>{fout}</p>}
            <div className="t-rij" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="t-knop" onClick={onSluit}>Annuleren</button>
              <button className="t-knop hoofd" disabled={bezig}>{bezig ? "Bezig…" : "Aanmaken"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function OrganisatieDetail({ pk, org, onSluit, onGewijzigd }: { pk: ReturnType<typeof usePakketten>; org: Org; onSluit: () => void; onGewijzigd: () => void }) {
  const [tab, setTab] = useState<"abonnement" | "leden" | "logboek">("abonnement");
  const [v, setV] = useState({ naam: org.naam, kort: org.kort || "", pakket: org.pakket, plaatsen: org.plaatsen, lezers_max: org.lezers_max,
    modules: org.modules || [], status: org.status, proef_tot: org.proef_tot ? org.proef_tot.slice(0, 10) : "" });
  const [leden, setLeden] = useState<Lid[]>([]);
  const [uitn, setUitn] = useState<Uitn[]>([]);
  const [log, setLog] = useState<Log[]>([]);
  const [melding, setMelding] = useState<{ soort: "ok" | "fout"; tekst: string } | null>(null);
  const [nieuwMail, setNieuwMail] = useState("");
  const [nieuwRol, setNieuwRol] = useState("eigenaar");

  async function laad() {
    const [l, u, g] = await Promise.all([
      sb().rpc("leden_van", { p_org: org.id }),
      sb().from("uitnodigingen").select("*").eq("organisatie_id", org.id).is("aanvaard_op", null).order("created_at", { ascending: false }),
      sb().from("logboek_organisatie").select("id, actie, details, op").eq("organisatie_id", org.id).order("op", { ascending: false }).limit(50),
    ]);
    setLeden((l.data || []) as Lid[]); setUitn((u.data || []) as Uitn[]); setLog((g.data || []) as Log[]);
  }
  useEffect(() => { laad(); }, [org.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function bewaar() {
    setMelding(null);
    const { error } = await sb().from("organisaties").update({
      naam: v.naam, kort: v.kort || null, pakket: v.pakket, plaatsen: v.plaatsen, lezers_max: v.lezers_max, modules: v.modules,
      status: v.status, proef_tot: v.proef_tot ? new Date(v.proef_tot + "T23:59:59").toISOString() : null,
    }).eq("id", org.id);
    if (error) setMelding({ soort: "fout", tekst: error.message });
    else { setMelding({ soort: "ok", tekst: "Bewaard." }); onGewijzigd(); laad(); }
  }

  async function nodigUit(e: React.FormEvent) {
    e.preventDefault(); setMelding(null);
    const { error } = await sb().from("uitnodigingen").insert({ organisatie_id: org.id, email: nieuwMail, rol: nieuwRol });
    if (error) setMelding({ soort: "fout", tekst: error.message }); else { setNieuwMail(""); laad(); onGewijzigd(); }
  }
  async function trekIn(id: string) {
    await sb().from("uitnodigingen").delete().eq("id", id); laad(); onGewijzigd();
  }

  return (
    <div className="t-dialoog-achter" onMouseDown={(e) => e.target === e.currentTarget && onSluit()}>
      <div className="t-dialoog" style={{ maxWidth: 760, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="t-rij">
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>{org.naam}</h2>
            <p className="t-sub">{org.slug}.{HOOFDDOMEIN} · sinds {datum(org.created_at)}</p>
          </div>
          <a className="t-knop klein" href={orgAdres(org.slug)}>Openen</a>
          <button className="t-knop klein stil" onClick={onSluit}>Sluiten</button>
        </div>
        <div className="t-tabs" style={{ marginTop: 16 }}>
          {(["abonnement", "leden", "logboek"] as const).map((t) => (
            <button key={t} className={tab === t ? "aan" : ""} onClick={() => setTab(t)}>
              {t === "abonnement" ? "Abonnement" : t === "leden" ? `Leden (${leden.filter((l) => l.actief).length})` : "Logboek"}
            </button>
          ))}
        </div>
        {melding && <p className={`t-melding ${melding.soort}`} style={{ margin: "0 0 16px" }}>{melding.tekst}</p>}

        {tab === "abonnement" && (
          <div className="t-stapel">
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <label><span className="t-label">Naam</span><input className="t-veld" value={v.naam} onChange={(e) => setV({ ...v, naam: e.target.value })} /></label>
              <label><span className="t-label">Korte naam</span><input className="t-veld" value={v.kort} onChange={(e) => setV({ ...v, kort: e.target.value })} /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <label><span className="t-label">Pakket</span>
                <select className="t-veld" value={v.pakket} onChange={(e) => { const p = pk.van(e.target.value); setV({ ...v, pakket: p.id, plaatsen: Math.max(p.plaatsen, org.plaatsen_gebruikt || 1), lezers_max: p.lezers, modules: metKoppelingen(p, v.modules) }); }}>
                  {pk.lijst.filter((p) => p.actief || p.id === v.pakket).map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}</select></label>
              <label><span className="t-label">Plaatsen ({org.plaatsen_gebruikt} in gebruik)</span>
                <input className="t-veld" type="number" min={1} value={v.plaatsen} onChange={(e) => setV({ ...v, plaatsen: Number(e.target.value) })} /></label>
              <label><span className="t-label">Lezers ({org.lezers_gebruikt} in gebruik)</span>
                <input className="t-veld" type="number" min={0} value={v.lezers_max} onChange={(e) => setV({ ...v, lezers_max: Number(e.target.value) })} /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label><span className="t-label">Status (sinds {datum(org.status_sinds)})</span>
                <select className="t-veld" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{STATUSSEN.map((s) => <option key={s.id} value={s.id}>{s.naam}</option>)}</select></label>
              <label><span className="t-label">Proef tot</span>
                <input className="t-veld" type="date" value={v.proef_tot} onChange={(e) => setV({ ...v, proef_tot: e.target.value })} /></label>
            </div>
            <div><span className="t-label">Modules</span>
              <Afwijking p={pk.van(v.pakket)} plaatsen={v.plaatsen} lezers={v.lezers_max} modules={v.modules}
                onHerstel={() => { const p = pk.van(v.pakket); setV({ ...v, plaatsen: Math.max(p.plaatsen, org.plaatsen_gebruikt || 1), lezers_max: p.lezers, modules: metKoppelingen(p, v.modules) }); }} />
              <ModuleKeuze waarde={v.modules} onWijzig={(m) => setV({ ...v, modules: m })} /></div>
            <p className="t-stil" style={{ margin: 0, fontSize: 12.5 }}>Een ander pakket kiezen neemt plaatsen, lezers en modules van dat pakket over. Daarna kan je per organisatie afwijken. Koppelingen blijven staan.</p>
            <div className="t-rij" style={{ justifyContent: "flex-end" }}><button className="t-knop hoofd" onClick={bewaar}>Bewaren</button></div>
          </div>
        )}

        {tab === "leden" && (
          <div className="t-stapel">
            <table className="t-tabel">
              <thead><tr><th>Naam</th><th>Rol</th><th>Sinds</th></tr></thead>
              <tbody>
                {leden.length === 0 && <tr><td colSpan={3} className="t-stil">Nog geen leden.</td></tr>}
                {leden.map((l) => (
                  <tr key={l.user_id} style={l.actief ? undefined : { opacity: 0.5 }}>
                    <td><div>{l.naam || l.email}</div>{l.naam && <div className="t-stil" style={{ fontSize: 12.5 }}>{l.email}</div>}</td>
                    <td>{rolNaam(l.rol)}{!l.actief && " (gedeactiveerd)"}</td>
                    <td className="t-stil">{datum(l.sinds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {uitn.length > 0 && (
              <>
                <span className="t-label" style={{ marginTop: 8 }}>Openstaande uitnodigingen</span>
                {uitn.map((u) => (
                  <div key={u.id} className="t-rij" style={{ fontSize: 13.5 }}>
                    <span style={{ flex: 1 }}>{u.email} <span className="t-stil">· {rolNaam(u.rol)} · tot {datum(u.geldig_tot)}</span></span>
                    <Kopieer tekst={uitnodigingsAdres(u.token)} />
                    <button className="t-knop klein gevaar" onClick={() => trekIn(u.id)}>Intrekken</button>
                  </div>
                ))}
              </>
            )}
            <form onSubmit={nodigUit} className="t-rij" style={{ marginTop: 8 }}>
              <input className="t-veld" type="email" required placeholder="naam@bedrijf.be" value={nieuwMail} onChange={(e) => setNieuwMail(e.target.value)} />
              <select className="t-veld" style={{ width: 150 }} value={nieuwRol} onChange={(e) => setNieuwRol(e.target.value)}>{ROLLEN.map((r) => <option key={r.id} value={r.id}>{r.naam}</option>)}</select>
              <button className="t-knop">Uitnodigen</button>
            </form>
          </div>
        )}

        {tab === "logboek" && (
          <table className="t-tabel">
            <tbody>
              {log.length === 0 && <tr><td className="t-stil">Nog niets.</td></tr>}
              {log.map((g) => (
                <tr key={g.id}>
                  <td className="t-stil" style={{ width: 150 }}>{tijdstip(g.op)}</td>
                  <td>{g.actie.replace(/_/g, " ")}</td>
                  <td className="t-stil" style={{ fontSize: 12.5 }}>
                    {Object.entries(g.details || {}).map(([k, w]) => `${k}: ${Array.isArray(w) ? w.map((x) => (Array.isArray(x) ? x.join(", ") : String(x ?? "–"))).join(" → ") : String(w)}`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Toont waar een organisatie afwijkt van haar pakket.
function Afwijking({ p, plaatsen, lezers, modules, onHerstel }: { p: Pakket; plaatsen: number; lezers: number; modules: string[]; onHerstel?: () => void }) {
  const eigen = modules.filter((m) => !KOPPELING_IDS.includes(m));
  const extra = eigen.filter((m) => !p.modules.includes(m));
  const min = p.modules.filter((m) => !eigen.includes(m));
  const verschil = [
    plaatsen !== p.plaatsen && `${plaatsen} plaatsen (pakket ${p.plaatsen})`,
    lezers !== p.lezers && `${lezers} lezers (pakket ${p.lezers})`,
    extra.length > 0 && `extra: ${extra.map(moduleNaam).join(", ")}`,
    min.length > 0 && `zonder: ${min.map(moduleNaam).join(", ")}`,
  ].filter(Boolean) as string[];
  const keuze = p.modules_keuze > 0 ? `${p.modules_keuze} naar keuze, ${extra.length} gekozen` : "";
  if (!verschil.length && !keuze) return <p className="t-stil" style={{ margin: "0 0 8px", fontSize: 12.5 }}>Zoals het pakket {p.naam}.</p>;
  return (
    <p className="t-stil" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
      {keuze && <span className={`t-pil ${p.modules_keuze && extra.length > p.modules_keuze ? "let-op" : "blauw"}`} style={{ marginRight: 8 }}>{keuze}</span>}
      {verschil.length > 0 && <>Afwijkend van {p.naam}: {verschil.join(" · ")}</>}
      {verschil.length > 0 && onHerstel && <> · <button type="button" className="t-knop klein stil" onClick={onHerstel}>Terug naar pakket</button></>}
    </p>
  );
}

function PakkettenBeheer({ pk, orgs }: { pk: ReturnType<typeof usePakketten>; orgs: Org[] }) {
  const [open, setOpen] = useState<Pakket | "nieuw" | null>(null);
  const gebruik = (id: string) => orgs.filter((o) => o.pakket === id).length;
  return (
    <div className="t-stapel" style={{ marginTop: 8 }}>
      {!pk.uitDb && <p className="t-melding let-op" style={{ margin: 0 }}>De tabel met pakketten bestaat nog niet. Voer <code>db/0005_pakketten.sql</code> uit in de SQL Editor; tot dan zie je de vaste lijst uit de code.</p>}
      <div className="t-rij">
        <p className="t-sub" style={{ flex: 1, margin: 0 }}>Een pakket geeft de standaardwaarden voor een nieuwe organisatie. Per organisatie kan je daarna afwijken.</p>
        {pk.uitDb && <button className="t-knop hoofd" onClick={() => setOpen("nieuw")}>Nieuw pakket</button>}
      </div>
      <div className="t-kaart" style={{ overflowX: "auto" }}>
        <table className="t-tabel">
          <thead><tr><th>Pakket</th><th>Plaatsen</th><th>Lezers</th><th>Modules</th><th>Limieten</th><th>Prijs per jaar</th><th>Organisaties</th></tr></thead>
          <tbody>
            {pk.lijst.map((p) => (
              <tr key={p.id} className={pk.uitDb ? "klik" : ""} onClick={() => pk.uitDb && setOpen(p)}>
                <td>
                  <div style={{ fontWeight: 500 }}>{p.naam} {!p.actief && <span className="t-pil">Niet actief</span>}</div>
                  {p.omschrijving && <div className="t-stil" style={{ fontSize: 12.5 }}>{p.omschrijving}</div>}
                </td>
                <td>{p.plaatsen}</td>
                <td>{p.lezers}</td>
                <td style={{ maxWidth: 320 }}>
                  {p.modules.length === MODULES.length - 1 && !p.modules.includes("integraties") ? "Alle behalve Integraties"
                    : p.modules.length === MODULES.length ? "Alle" : p.modules.map(moduleNaam).join(", ") || <span className="t-stil">Basis</span>}
                  {p.modules_keuze > 0 && <span className="t-stil"> + {p.modules_keuze} naar keuze</span>}
                </td>
                <td className="t-stil" style={{ fontSize: 12.5 }}>{limietTekst(p)}</td>
                <td>{euro(p.prijs_jaar)}</td>
                <td>{gebruik(p.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <PakketBewerker p={open === "nieuw" ? null : open} inGebruik={open === "nieuw" ? 0 : gebruik(open.id)} onSluit={() => setOpen(null)} onKlaar={() => { setOpen(null); pk.laad(); }} />}
    </div>
  );
}

function PakketBewerker({ p, inGebruik, onSluit, onKlaar }: { p: Pakket | null; inGebruik: number; onSluit: () => void; onKlaar: () => void }) {
  const [v, setV] = useState<Pakket>(p || { id: "", naam: "", omschrijving: "", plaatsen: 5, lezers: 25, modules: [], modules_keuze: 0,
    prijs_jaar: null, prijs_plaats: null, prijs_module: null, proef_dagen: null, sso: false, actief: true, volgorde: 100 });
  const [fout, setFout] = useState("");
  const getal = (x: string) => (x === "" ? null : Number(x));
  async function bewaar(e: React.FormEvent) {
    e.preventDefault(); setFout("");
    const rij = { ...v, omschrijving: v.omschrijving || null, modules: v.modules.filter((m) => !KOPPELING_IDS.includes(m)) };
    const { error } = p ? await sb().from("pakketten").update(rij).eq("id", p.id) : await sb().from("pakketten").insert(rij);
    if (error) setFout(error.message); else onKlaar();
  }
  async function wis() {
    const { error } = await sb().from("pakketten").delete().eq("id", p!.id);
    if (error) setFout(error.message); else onKlaar();
  }
  return (
    <div className="t-dialoog-achter" onMouseDown={(e) => e.target === e.currentTarget && onSluit()}>
      <form className="t-dialoog t-stapel" style={{ maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }} onSubmit={bewaar}>
        <h2 style={{ margin: 0 }}>{p ? `Pakket ${p.naam}` : "Nieuw pakket"}</h2>
        {p && inGebruik > 0 && <p className="t-stil" style={{ margin: 0, fontSize: 12.5 }}>{inGebruik} organisatie{inGebruik === 1 ? "" : "s"} met dit pakket. Wijzigingen gelden voor nieuwe organisaties en wanneer je het pakket opnieuw kiest; bestaande organisaties houden hun eigen plaatsen en modules.</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <label><span className="t-label">Code</span>
            <input className="t-veld" required pattern="[a-z0-9_]{2,30}" value={v.id} onChange={(e) => setV({ ...v, id: e.target.value.toLowerCase() })} placeholder="koers" /></label>
          <label><span className="t-label">Naam</span><input className="t-veld" required value={v.naam} onChange={(e) => setV({ ...v, naam: e.target.value })} /></label>
        </div>
        <label><span className="t-label">Omschrijving</span><input className="t-veld" value={v.omschrijving || ""} onChange={(e) => setV({ ...v, omschrijving: e.target.value })} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <label><span className="t-label">Plaatsen</span><input className="t-veld" type="number" min={1} value={v.plaatsen} onChange={(e) => setV({ ...v, plaatsen: Number(e.target.value) })} /></label>
          <label><span className="t-label">Lezers</span><input className="t-veld" type="number" min={0} value={v.lezers} onChange={(e) => setV({ ...v, lezers: Number(e.target.value) })} /></label>
          <label><span className="t-label">Naar keuze</span><input className="t-veld" type="number" min={0} value={v.modules_keuze} onChange={(e) => setV({ ...v, modules_keuze: Number(e.target.value) })} /></label>
          <label><span className="t-label">Proef (dagen)</span><input className="t-veld" type="number" min={1} value={v.proef_dagen ?? ""} onChange={(e) => setV({ ...v, proef_dagen: getal(e.target.value) })} placeholder="geen" /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label><span className="t-label">Prijs per jaar (€)</span><input className="t-veld" type="number" min={0} step="0.01" value={v.prijs_jaar ?? ""} onChange={(e) => setV({ ...v, prijs_jaar: getal(e.target.value) })} /></label>
          <label><span className="t-label">Extra plaats (€/jaar)</span><input className="t-veld" type="number" min={0} step="0.01" value={v.prijs_plaats ?? ""} onChange={(e) => setV({ ...v, prijs_plaats: getal(e.target.value) })} /></label>
          <label><span className="t-label">Extra module (€/jaar)</span><input className="t-veld" type="number" min={0} step="0.01" value={v.prijs_module ?? ""} onChange={(e) => setV({ ...v, prijs_module: getal(e.target.value) })} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label><span className="t-label">Events per jaar</span><input className="t-veld" type="number" min={0} value={v.max_events_jaar ?? ""} onChange={(e) => setV({ ...v, max_events_jaar: getal(e.target.value) })} placeholder="Onbeperkt" /></label>
          <label><span className="t-label">Actieve deellinks</span><input className="t-veld" type="number" min={0} value={v.max_deellinks ?? ""} onChange={(e) => setV({ ...v, max_deellinks: getal(e.target.value) })} placeholder="Onbeperkt" /></label>
          <label><span className="t-label">Opslag (MB)</span><input className="t-veld" type="number" min={0} value={v.max_opslag_mb ?? ""} onChange={(e) => setV({ ...v, max_opslag_mb: getal(e.target.value) })} placeholder="Onbeperkt" /></label>
        </div>
        <p className="t-stil" style={{ margin: 0, fontSize: 12.5 }}>Leeg = onbeperkt. Een plan zonder event telt als één event. Opslag wordt enkel getoond, niet geblokkeerd.</p>
        <div><span className="t-label">Vaste modules</span><ModuleKeuze zonderKoppelingen waarde={v.modules} onWijzig={(m) => setV({ ...v, modules: m })} /></div>
        <div className="t-rij" style={{ gap: 20 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={v.sso} onChange={(e) => setV({ ...v, sso: e.target.checked })} /> SSO verplichten mogelijk</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={v.actief} onChange={(e) => setV({ ...v, actief: e.target.checked })} /> Te kiezen voor nieuwe organisaties</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>Volgorde <input className="t-veld" style={{ width: 70 }} type="number" value={v.volgorde} onChange={(e) => setV({ ...v, volgorde: Number(e.target.value) })} /></label>
        </div>
        {fout && <p className="t-melding fout" style={{ margin: 0 }}>{fout.includes("foreign key") ? "Dit pakket is nog in gebruik. Zet het op niet actief in plaats van het te verwijderen." : fout}</p>}
        <div className="t-rij">
          {p && inGebruik === 0 && <button type="button" className="t-knop gevaar" onClick={wis}>Verwijderen</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="t-knop" onClick={onSluit}>Annuleren</button>
          <button className="t-knop hoofd">Bewaren</button>
        </div>
      </form>
    </div>
  );
}
