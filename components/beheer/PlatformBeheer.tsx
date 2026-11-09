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

const sb = () => supabaseBrowser();

function Kopieer({ tekst, label = "Kopieer link" }: { tekst: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="t-knop klein" onClick={async () => { await navigator.clipboard.writeText(tekst); setOk(true); setTimeout(() => setOk(false), 1500); }}>
      {ok ? "Gekopieerd" : label}
    </button>
  );
}

export default function PlatformBeheer() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [fout, setFout] = useState("");
  const [zoek, setZoek] = useState("");
  const [nieuw, setNieuw] = useState(false);
  const [open, setOpen] = useState<Org | null>(null);

  async function laad() {
    const { data, error } = await sb().rpc("platform_overzicht");
    if (error) setFout(error.message); else setOrgs((data || []) as Org[]);
  }
  useEffect(() => { laad(); }, []);

  const lijst = useMemo(() => (orgs || []).filter((o) => !zoek || `${o.naam} ${o.slug} ${o.eigenaars || ""}`.toLowerCase().includes(zoek.toLowerCase())), [orgs, zoek]);
  const tel = (s: string) => (orgs || []).filter((o) => o.status === s).length;

  return (
    <main className="t-inhoud">
      <div className="t-rij" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <h1 className="t-titel">Platformbeheer</h1>
          <p className="t-sub">Organisaties, pakketten en toegang. Je ziet hier geen plannen van klanten.</p>
        </div>
        <button className="t-knop hoofd" onClick={() => setNieuw(true)}>Nieuwe organisatie</button>
      </div>

      {fout && <p className="t-melding fout" style={{ marginTop: 16 }}>{fout}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 24 }}>
        {[["Organisaties", (orgs || []).length], ["Actief", tel("actief")], ["In proef", tel("proef")], ["Aandacht nodig", tel("achterstallig") + tel("alleen_lezen") + tel("geblokkeerd")],
          ["Plaatsen in gebruik", (orgs || []).reduce((t, o) => t + Number(o.plaatsen_gebruikt || 0), 0)]].map(([k, v]) => (
          <div key={k as string} className="t-kaart" style={{ padding: "14px 16px" }}>
            <div className="t-stil" style={{ fontSize: 12.5 }}>{k}</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 2 }}>{v as number}</div>
          </div>
        ))}
      </div>

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
                  <td>{pakketVan(o.pakket).naam}</td>
                  <td>{o.plaatsen_gebruikt} / {o.plaatsen}</td>
                  <td>{o.lezers_gebruikt} / {o.lezers_max}</td>
                  <td>{o.plannen}</td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.eigenaars || <span className="t-stil">uitgenodigd</span>}</td>
                  <td className="t-stil">{o.laatste_wijziging ? tijdstip(o.laatste_wijziging) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nieuw && <NieuweOrganisatie onSluit={() => setNieuw(false)} onKlaar={() => laad()} />}
      {open && <OrganisatieDetail org={open} onSluit={() => setOpen(null)} onGewijzigd={() => laad()} />}
    </main>
  );
}

function ModuleKeuze({ waarde, onWijzig }: { waarde: string[]; onWijzig: (m: string[]) => void }) {
  const zet = (id: string, aan: boolean) => onWijzig(aan ? [...new Set([...waarde, id])] : waarde.filter((x) => x !== id));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
      {[...MODULES, ...KOPPELINGEN.map((k) => ({ ...k, uitleg: "koppeling" }))].map((m) => (
        <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, cursor: "pointer" }}>
          <input type="checkbox" checked={waarde.includes(m.id)} onChange={(e) => zet(m.id, e.target.checked)} style={{ marginTop: 3 }} />
          <span>{m.naam}<span className="t-stil" style={{ display: "block", fontSize: 12 }}>{m.uitleg}</span></span>
        </label>
      ))}
    </div>
  );
}

function NieuweOrganisatie({ onSluit, onKlaar }: { onSluit: () => void; onKlaar: () => void }) {
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
    const p = pakketVan(id);
    setPakket(id); setPlaatsen(p.plaatsen); setLezers(p.lezers); setModules(p.modules);
    setStatus(id === "proef" ? "proef" : "actief");
  }

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
                <select className="t-veld" value={pakket} onChange={(e) => kiesPakket(e.target.value)}>{PAKKETTEN.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}</select></label>
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
            <div><span className="t-label">Modules</span><ModuleKeuze waarde={modules} onWijzig={setModules} /></div>
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

function OrganisatieDetail({ org, onSluit, onGewijzigd }: { org: Org; onSluit: () => void; onGewijzigd: () => void }) {
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
                <select className="t-veld" value={v.pakket} onChange={(e) => setV({ ...v, pakket: e.target.value })}>{PAKKETTEN.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}</select></label>
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
            <div><span className="t-label">Modules</span><ModuleKeuze waarde={v.modules} onWijzig={(m) => setV({ ...v, modules: m })} /></div>
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
