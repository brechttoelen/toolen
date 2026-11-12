"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { orgAdres } from "@/lib/adres";

type Collectie = { id: string; naam: string; standaard: boolean; elementen: number };
type Org = { id: string; naam: string; slug: string; eigen: number; collecties: string[] };

// Centrale bibliotheek: één overzicht met de collecties als rijen en de klanten als kolommen.
// Een vinkje = die klant ziet de elementen van die collectie in zijn bibliotheek.
// De elementen zelf beheer je in de werkruimte "Toolen bibliotheek" (geen klant, enkel jouw opslag).
export default function Collecties() {
  const [collecties, setCollecties] = useState<Collectie[] | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState("");
  const [lege, setLege] = useState(false);
  const sb = useMemo(() => supabaseBrowser(), []);

  const laad = async () => {
    const { data, error } = await sb.rpc("platform_collecties");
    if (error || !data) { setFout(error?.message || "Laden mislukt."); setCollecties([]); return; }
    const d = data as { collecties: Collectie[]; organisaties: Org[] };
    setCollecties(d.collecties); setOrgs(d.organisaties);
  };
  useEffect(() => { laad(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Groeperen per categorie: "Meubilair" met daaronder "Meubilair · Levi", "Meubilair · Nima Rent" …
  const groepen = useMemo(() => {
    const m = new Map<string, Collectie[]>();
    for (const c of collecties || []) {
      if (!lege && c.elementen === 0) continue;
      const k = c.naam.split(" · ")[0];
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    for (const l of m.values()) l.sort((a, b) => (a.naam === a.naam.split(" · ")[0] ? -1 : b.naam === b.naam.split(" · ")[0] ? 1 : a.naam.localeCompare(b.naam, "nl")));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "nl"));
  }, [collecties, lege]);
  const zichtbaar = groepen.flatMap(([, l]) => l);
  const aantalLeeg = (collecties || []).filter((c) => c.elementen === 0).length;

  const zet = async (o: Org, ids: string[], aan: boolean) => {
    if (bezig || !ids.length) return;
    setBezig(o.id); setFout("");
    const r = aan
      ? await sb.from("organisatie_collecties").upsert(ids.map((collectie_id) => ({ organisatie_id: o.id, collectie_id })), { onConflict: "organisatie_id,collectie_id", ignoreDuplicates: true })
      : await sb.from("organisatie_collecties").delete().eq("organisatie_id", o.id).in("collectie_id", ids);
    if (r.error) setFout(r.error.message);
    else setOrgs((l) => l.map((x) => (x.id !== o.id ? x : { ...x, collecties: aan ? [...new Set([...x.collecties, ...ids])] : x.collecties.filter((c) => !ids.includes(c)) })));
    setBezig("");
  };
  const zetStandaard = async (c: Collectie) => {
    const { error } = await sb.from("collecties").update({ standaard: !c.standaard }).eq("id", c.id);
    if (error) { setFout(error.message); return; }
    setCollecties((l) => (l || []).map((x) => (x.id === c.id ? { ...x, standaard: !c.standaard } : x)));
  };
  const telVan = (o: Org) => (collecties || []).filter((c) => o.collecties.includes(c.id)).reduce((n, c) => n + c.elementen, 0);
  const vink = { width: 18, height: 18, cursor: "pointer" } as const;

  return (
    <main className="t-inhoud">
      <div className="t-rij" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <h1 className="t-titel">Bibliotheek</h1>
          <p className="t-sub">Vink aan welke klant welke collectie krijgt. Wat aangevinkt is, staat meteen in de bibliotheek van die klant.</p>
        </div>
        <a className="t-knop" href={orgAdres("toolen", "/maps/bibliotheek")}>Elementen toevoegen of wijzigen</a>
      </div>

      <ol className="t-stil" style={{ margin: "16px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
        <li>Elementen maak en wijzig je in <b>Toolen bibliotheek</b>. Dat is geen klant, maar jouw centrale opslag.</li>
        <li>Elk element valt vanzelf in een collectie: zijn categorie, of categorie · verhuurder (bv. Meubilair · Levi).</li>
        <li>Hieronder kies je per klant welke collecties hij ziet. Klanten kunnen daarnaast hun eigen elementen maken.</li>
      </ol>

      {fout && <p className="t-melding fout" style={{ marginTop: 16 }}>{fout}</p>}
      {collecties === null ? <p className="t-sub" style={{ marginTop: 24 }}>Laden…</p> : !orgs.length ? <p className="t-sub" style={{ marginTop: 24 }}>Nog geen klanten.</p> : (
        <section className="t-kaart" style={{ marginTop: 20, padding: 0, overflowX: "auto" }}>
          <table className="t-tabel">
            <thead>
              <tr>
                <th>Collectie</th>
                <th style={{ width: 90, textAlign: "right" }}>Elementen</th>
                {orgs.map((o) => <th key={o.id} style={{ width: 130, textAlign: "center" }}>{o.naam}</th>)}
                <th style={{ width: 130, textAlign: "center" }} title="Een nieuwe klant krijgt deze collectie meteen">Nieuwe klanten</th>
              </tr>
              <tr>
                <td className="t-stil" style={{ fontSize: 12.5 }}>Totaal</td>
                <td />
                {orgs.map((o) => {
                  const alles = zichtbaar.every((c) => o.collecties.includes(c.id));
                  return (
                    <td key={o.id} style={{ textAlign: "center", fontSize: 12.5 }}>
                      <div className="t-stil">{telVan(o)} van Toolen · {o.eigen} eigen</div>
                      <button type="button" className="t-knop klein" style={{ marginTop: 6 }} disabled={!!bezig} onClick={() => zet(o, zichtbaar.map((c) => c.id), !alles)}>{alles ? "Niets" : "Alles"}</button>
                    </td>
                  );
                })}
                <td />
              </tr>
            </thead>
            <tbody>
              {groepen.map(([cat, lijst]) => (
                <Fragment key={cat}>
                  {lijst.map((c) => {
                    const sub = c.naam.includes(" · ");
                    return (
                      <tr key={c.id}>
                        <td style={sub ? { paddingLeft: 32 } : { fontWeight: 500 }}>{sub ? <span className="t-stil">Van </span> : null}{sub ? c.naam.split(" · ").slice(1).join(" · ") : c.naam}</td>
                        <td style={{ textAlign: "right" }} className="t-stil">{c.elementen}</td>
                        {orgs.map((o) => (
                          <td key={o.id} style={{ textAlign: "center" }}>
                            <input type="checkbox" style={vink} aria-label={`${o.naam} krijgt ${c.naam}`} checked={o.collecties.includes(c.id)} disabled={bezig === o.id} onChange={(e) => zet(o, [c.id], e.target.checked)} />
                          </td>
                        ))}
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" style={vink} aria-label={`${c.naam} standaard voor nieuwe klanten`} checked={c.standaard} onChange={() => zetStandaard(c)} />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {collecties !== null && (
        <div className="t-rij" style={{ marginTop: 12, gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
          <p className="t-stil" style={{ margin: 0, fontSize: 12.5, maxWidth: 720 }}>Neem je een collectie weg, dan blijven de plannen van die klant bestaan. De elementen uit die collectie tonen er als gewone vorm tot hij ze terugkrijgt.</p>
          {aantalLeeg > 0 && <button type="button" className="t-knop klein" onClick={() => setLege((v) => !v)}>{lege ? "Lege collecties verbergen" : `Lege collecties tonen (${aantalLeeg})`}</button>}
        </div>
      )}
    </main>
  );
}
