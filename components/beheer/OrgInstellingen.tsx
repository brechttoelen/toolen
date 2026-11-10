"use client";

import { useEffect, useState } from "react";
import { sb } from "@/components/maps/db";
import { MODULES, ROLLEN, statusVan, pakketVan, rolNaam, uitnodigingsAdres, datum } from "@/lib/pakketten";

type Ik = { id: string; rol: string; organisatie: { id: string; slug: string; naam: string } };
type Lid = { user_id: string; email: string; naam: string | null; rol: string; actief: boolean; sinds: string; ik: boolean };
type Uitn = { id: string; email: string; rol: string; token: string; geldig_tot: string };
type Org = { id: string; naam: string; kort: string | null; adres: string | null; ondernemingsnummer: string | null; land: string;
  status: string; pakket: string; plaatsen: number; lezers_max: number; modules: string[]; proef_tot: string | null };
type Gebruik = { plaatsen: number; plaatsen_max: number; lezers: number; lezers_max: number };

const db = () => sb().schema("maps");

function Kopieer({ tekst }: { tekst: string }) {
  const [ok, setOk] = useState(false);
  return <button className="t-knop klein" onClick={async () => { await navigator.clipboard.writeText(tekst); setOk(true); setTimeout(() => setOk(false), 1500); }}>{ok ? "Gekopieerd" : "Kopieer link"}</button>;
}

type Limieten = { events_jaar: number; max_events_jaar: number | null; deellinks: number; max_deellinks: number | null; opslag_mb: number; max_opslag_mb: number | null };

function Teller({ label, n, max, eenheid = "" }: { label: string; n: number; max: number | null; eenheid?: string }) {
  const pct = max == null ? 0 : max ? Math.min(100, (n / max) * 100) : 100;
  return (
    <div className="t-kaart" style={{ padding: "14px 16px", flex: 1 }}>
      <div className="t-rij" style={{ justifyContent: "space-between" }}>
        <span className="t-stil" style={{ fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--font-titel)", fontStretch: "125%", fontWeight: 800, fontSize: 28, marginTop: 4 }}>{n}{eenheid} <span style={{ fontSize: 18, color: "var(--t-tekst-3)" }}>/ {max == null ? "Onbeperkt" : `${max}${eenheid}`}</span></div>
      <div className={`t-balk${max != null && n >= max ? " vol" : ""}`} style={{ marginTop: 10 }}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function OrgInstellingen() {
  const [ik, setIk] = useState<Ik | null>(null);
  const [tab, setTab] = useState<"leden" | "organisatie" | "abonnement">("leden");
  const [leden, setLeden] = useState<Lid[]>([]);
  const [uitn, setUitn] = useState<Uitn[]>([]);
  const [org, setOrg] = useState<Org | null>(null);
  const [gebruik, setGebruik] = useState<Gebruik | null>(null);
  const [limieten, setLimieten] = useState<Limieten | null>(null);
  const [pakketNaam, setPakketNaam] = useState<string | null>(null);
  useEffect(() => { if (org?.pakket) db().from("pakketten").select("naam").eq("id", org.pakket).maybeSingle().then(({ data }: { data: unknown }) => setPakketNaam((data as { naam: string } | null)?.naam || null)); }, [org?.pakket]);
  const [melding, setMelding] = useState<{ soort: "ok" | "fout"; tekst: string } | null>(null);
  const [mail, setMail] = useState("");
  const [rol, setRol] = useState("bewerker");
  const [nieuweLink, setNieuweLink] = useState<{ email: string; link: string } | null>(null);

  const beheer = ik?.rol === "eigenaar" || ik?.rol === "beheerder";
  const eigenaar = ik?.rol === "eigenaar";

  async function laad() {
    const { data: w } = await db().rpc("ik");
    const me = w as Ik | null;
    setIk(me);
    if (!me?.organisatie) return;
    const id = me.organisatie.id;
    db().rpc("gebruik", { p_org: id }).then((r: { data: unknown }) => setLimieten(r.data as Limieten | null));
    const [l, u, o, g] = await Promise.all([
      db().rpc("leden_van", { p_org: id }),
      db().from("uitnodigingen").select("id, email, rol, token, geldig_tot").eq("organisatie_id", id).is("aanvaard_op", null).gt("geldig_tot", new Date().toISOString()).order("created_at"),
      db().from("organisaties").select("*").eq("id", id).single(),
      db().rpc("plaatsen_in_gebruik", { p_org: id }),
    ]);
    setLeden((l.data || []) as Lid[]); setUitn((u.data || []) as Uitn[]); setOrg(o.data as Org); setGebruik(g.data as Gebruik);
  }
  useEffect(() => { laad(); }, []);

  const toon = (soort: "ok" | "fout", tekst: string) => setMelding({ soort, tekst });

  async function nodigUit(e: React.FormEvent) {
    e.preventDefault(); setMelding(null); setNieuweLink(null);
    const { data, error } = await db().from("uitnodigingen").insert({ organisatie_id: ik!.organisatie.id, email: mail, rol }).select("email, token").single();
    if (error) return toon("fout", error.message);
    setNieuweLink({ email: data.email, link: uitnodigingsAdres(data.token) });
    setMail(""); laad();
  }
  async function wijzigLid(l: Lid, velden: Partial<Pick<Lid, "rol" | "actief">>) {
    setMelding(null);
    const { error } = await db().from("leden").update(velden).eq("organisatie_id", ik!.organisatie.id).eq("user_id", l.user_id);
    if (error) toon("fout", error.message); else laad();
  }
  async function verwijderLid(l: Lid) {
    if (!confirm(`${l.naam || l.email} uit ${ik!.organisatie.naam} verwijderen? Plannen blijven bij de organisatie.`)) return;
    const { error } = await db().from("leden").delete().eq("organisatie_id", ik!.organisatie.id).eq("user_id", l.user_id);
    if (error) toon("fout", error.message); else laad();
  }
  async function trekIn(id: string) {
    const { error } = await db().from("uitnodigingen").delete().eq("id", id);
    if (error) toon("fout", error.message); else laad();
  }
  async function bewaarOrg(e: React.FormEvent) {
    e.preventDefault(); if (!org) return;
    const { error } = await db().from("organisaties").update({ naam: org.naam, kort: org.kort || null, adres: org.adres || null,
      ondernemingsnummer: org.ondernemingsnummer || null, land: org.land || "BE" }).eq("id", org.id);
    if (error) toon("fout", error.message); else { toon("ok", "Bewaard."); laad(); }
  }

  if (!ik) return <main className="t-inhoud t-stil">Laden…</main>;
  const st = org ? statusVan(org.status) : null;

  return (
    <main className="t-inhoud">
      <h1 className="t-titel">{ik.organisatie.naam}</h1>
      <p className="t-sub">Leden, organisatie en abonnement · Je bent {rolNaam(ik.rol).toLowerCase()}</p>
      <div className="t-tabs">
        <button className={tab === "leden" ? "aan" : ""} onClick={() => { setTab("leden"); setMelding(null); }}>Leden</button>
        <button className={tab === "organisatie" ? "aan" : ""} onClick={() => { setTab("organisatie"); setMelding(null); }}>Organisatie</button>
        <button className={tab === "abonnement" ? "aan" : ""} onClick={() => { setTab("abonnement"); setMelding(null); }}>Abonnement</button>
      </div>
      {melding && <p className={`t-melding ${melding.soort}`} style={{ margin: "0 0 16px" }}>{melding.tekst}</p>}

      {tab === "leden" && (
        <div className="t-stapel" style={{ gap: 20 }}>
          {gebruik && (
            <div className="t-rij" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
              <Teller label="Plaatsen (eigenaars, beheerders, bewerkers)" n={gebruik.plaatsen} max={gebruik.plaatsen_max} />
              <Teller label="Lezers (gratis)" n={gebruik.lezers} max={gebruik.lezers_max} />
            </div>
          )}

          {beheer && (
            <div className="t-kaart" style={{ padding: 16 }}>
              <form onSubmit={nodigUit} className="t-rij" style={{ flexWrap: "wrap" }}>
                <input className="t-veld" style={{ flex: "1 1 240px" }} type="email" required placeholder="naam@bedrijf.be" value={mail} onChange={(e) => setMail(e.target.value)} />
                <select className="t-veld" style={{ width: 170 }} value={rol} onChange={(e) => setRol(e.target.value)}>
                  {ROLLEN.filter((r) => r.id !== "eigenaar" || eigenaar).map((r) => <option key={r.id} value={r.id}>{r.naam}</option>)}
                </select>
                <button className="t-knop hoofd">Uitnodigen</button>
              </form>
              <p className="t-stil" style={{ fontSize: 12.5, margin: "8px 0 0" }}>{ROLLEN.find((r) => r.id === rol)?.uitleg}</p>
              {nieuweLink && (
                <div className="t-stapel" style={{ marginTop: 12, gap: 8 }}>
                  <span style={{ fontSize: 13.5 }}>Stuur deze link naar {nieuweLink.email} (14 dagen geldig):</span>
                  <div className="t-rij"><input className="t-veld" readOnly value={nieuweLink.link} /><Kopieer tekst={nieuweLink.link} /></div>
                </div>
              )}
            </div>
          )}

          <div className="t-kaart" style={{ overflowX: "auto" }}>
            <table className="t-tabel">
              <thead><tr><th>Naam</th><th>Rol</th><th>Sinds</th>{beheer && <th style={{ width: 1 }} />}</tr></thead>
              <tbody>
                {leden.map((l) => {
                  const magRol = beheer && !l.ik && (l.rol !== "eigenaar" || eigenaar);
                  return (
                    <tr key={l.user_id} style={l.actief ? undefined : { opacity: 0.55 }}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.naam || l.email}{l.ik && <span className="t-stil" style={{ fontWeight: 400 }}> (jij)</span>}</div>
                        {l.naam && <div className="t-stil" style={{ fontSize: 12.5 }}>{l.email}</div>}
                      </td>
                      <td>
                        {magRol ? (
                          <select className="t-veld" style={{ width: 150, height: 30 }} value={l.rol} onChange={(e) => wijzigLid(l, { rol: e.target.value })}>
                            {ROLLEN.filter((r) => r.id !== "eigenaar" || eigenaar).map((r) => <option key={r.id} value={r.id}>{r.naam}</option>)}
                          </select>
                        ) : rolNaam(l.rol)}
                        {!l.actief && <span className="t-pil" style={{ marginLeft: 8 }}>Gedeactiveerd</span>}
                      </td>
                      <td className="t-stil">{datum(l.sinds)}</td>
                      {beheer && (
                        <td style={{ whiteSpace: "nowrap" }}>
                          {magRol && (
                            <div className="t-rij" style={{ gap: 6 }}>
                              <button className="t-knop klein" onClick={() => wijzigLid(l, { actief: !l.actief })}>{l.actief ? "Deactiveren" : "Activeren"}</button>
                              <button className="t-knop klein gevaar" onClick={() => verwijderLid(l)}>Verwijderen</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {uitn.length > 0 && (
            <div>
              <span className="t-label">Openstaande uitnodigingen</span>
              <div className="t-kaart">
                {uitn.map((u, i) => (
                  <div key={u.id} className="t-rij" style={{ padding: "10px 14px", borderTop: i ? "1px solid var(--t-rand)" : 0, fontSize: 13.5 }}>
                    <span style={{ flex: 1 }}>{u.email} <span className="t-stil">· {rolNaam(u.rol)} · geldig tot {datum(u.geldig_tot)}</span></span>
                    {beheer && <><Kopieer tekst={uitnodigingsAdres(u.token)} /><button className="t-knop klein gevaar" onClick={() => trekIn(u.id)}>Intrekken</button></>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "organisatie" && org && (
        <form onSubmit={bewaarOrg} className="t-kaart t-stapel" style={{ padding: 20, maxWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <label><span className="t-label">Naam</span><input className="t-veld" disabled={!eigenaar} value={org.naam} onChange={(e) => setOrg({ ...org, naam: e.target.value })} /></label>
            <label><span className="t-label">Korte naam (titelblok)</span><input className="t-veld" disabled={!eigenaar} value={org.kort || ""} onChange={(e) => setOrg({ ...org, kort: e.target.value })} /></label>
          </div>
          <label><span className="t-label">Adres</span><input className="t-veld" disabled={!eigenaar} value={org.adres || ""} onChange={(e) => setOrg({ ...org, adres: e.target.value })} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <label><span className="t-label">Ondernemingsnummer</span><input className="t-veld" disabled={!eigenaar} value={org.ondernemingsnummer || ""} onChange={(e) => setOrg({ ...org, ondernemingsnummer: e.target.value })} /></label>
            <label><span className="t-label">Land</span><input className="t-veld" disabled={!eigenaar} value={org.land || ""} onChange={(e) => setOrg({ ...org, land: e.target.value })} /></label>
          </div>
          <p className="t-stil" style={{ fontSize: 12.5, margin: 0 }}>Naam, adres en ondernemingsnummer komen in het titelblok van je plannen. {!eigenaar && "Enkel een eigenaar past ze aan."}</p>
          {eigenaar && <div className="t-rij" style={{ justifyContent: "flex-end" }}><button className="t-knop hoofd">Bewaren</button></div>}
        </form>
      )}

      {tab === "abonnement" && org && st && (
        <div className="t-stapel" style={{ maxWidth: 720 }}>
          <div className="t-kaart" style={{ padding: 20 }}>
            <div className="t-rij">
              <div style={{ flex: 1 }}>
                <div className="t-stil" style={{ fontSize: 13 }}>Pakket</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{pakketNaam || pakketVan(org.pakket).naam}</div>
              </div>
              <span className={`t-pil ${st.pil}`}>{st.naam}</span>
            </div>
            {org.status === "proef" && org.proef_tot && <p className="t-sub" style={{ marginTop: 12 }}>Proefperiode tot {datum(org.proef_tot)}.</p>}
            <p className="t-sub" style={{ marginTop: 8 }}>{org.plaatsen} plaatsen · {org.lezers_max} lezers</p>
          </div>
          {limieten && (
            <div className="t-rij" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
              <Teller label={`Events in ${new Date().getFullYear()}`} n={limieten.events_jaar} max={limieten.max_events_jaar} />
              <Teller label="Actieve deellinks" n={limieten.deellinks} max={limieten.max_deellinks} />
              <Teller label="Opslag" n={Math.round(limieten.opslag_mb)} max={limieten.max_opslag_mb} eenheid=" MB" />
            </div>
          )}
          <div className="t-kaart" style={{ padding: 20 }}>
            <span className="t-label">Modules</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 8 }}>
              {MODULES.map((m) => {
                const aan = (org.modules || []).includes(m.id);
                return (
                  <div key={m.id} className="t-rij" style={{ alignItems: "flex-start", gap: 10, opacity: aan ? 1 : 0.55 }}>
                    <span className={`t-pil ${aan ? "ok" : ""}`} style={{ minWidth: 42, justifyContent: "center" }}>{aan ? "Aan" : "Uit"}</span>
                    <span style={{ fontSize: 13.5 }}>{m.naam}<span className="t-stil" style={{ display: "block", fontSize: 12 }}>{m.uitleg}</span></span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="t-stil" style={{ fontSize: 13 }}>
            Pakket, plaatsen of modules wijzigen? <a href="mailto:hallo@toolen.be" style={{ color: "var(--t-blauw)" }}>hallo@toolen.be</a>
          </p>
        </div>
      )}
    </main>
  );
}
