"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { orgAdres } from "@/lib/adres";

type Collectie = { id: string; naam: string; standaard: boolean; elementen: number };
type Org = { id: string; naam: string; slug: string; eigen: number; collecties: string[] };

// Centrale bibliotheek: welke klant krijgt welke collecties. De elementen zelf beheer je in de organisatie
// "Toolen bibliotheek" met het gewone bibliotheekscherm; een element zit in de collectie van zijn categorie.
export default function Collecties() {
  const [collecties, setCollecties] = useState<Collectie[] | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [org, setOrg] = useState<string>("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const sb = useMemo(() => supabaseBrowser(), []);

  const laad = async () => {
    const { data, error } = await sb.rpc("platform_collecties");
    if (error || !data) { setFout(error?.message || "Laden mislukt."); setCollecties([]); return; }
    const d = data as { collecties: Collectie[]; organisaties: Org[] };
    setCollecties(d.collecties); setOrgs(d.organisaties); setOrg((o) => o || d.organisaties[0]?.id || "");
  };
  useEffect(() => { laad(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gekozen = orgs.find((o) => o.id === org) || null;
  const heeft = new Set(gekozen?.collecties || []);
  const totaal = (collecties || []).filter((c) => heeft.has(c.id)).reduce((n, c) => n + c.elementen, 0);

  const zet = async (ids: string[], aan: boolean) => {
    if (!gekozen || bezig) return;
    setBezig(true); setFout("");
    const r = aan
      ? await sb.from("organisatie_collecties").upsert(ids.map((collectie_id) => ({ organisatie_id: gekozen.id, collectie_id })), { onConflict: "organisatie_id,collectie_id", ignoreDuplicates: true })
      : await sb.from("organisatie_collecties").delete().eq("organisatie_id", gekozen.id).in("collectie_id", ids);
    if (r.error) setFout(r.error.message);
    else setOrgs((l) => l.map((o) => (o.id !== gekozen.id ? o : { ...o, collecties: aan ? [...new Set([...o.collecties, ...ids])] : o.collecties.filter((c) => !ids.includes(c)) })));
    setBezig(false);
  };
  const zetStandaard = async (c: Collectie) => {
    const { error } = await sb.from("collecties").update({ standaard: !c.standaard }).eq("id", c.id);
    if (error) { setFout(error.message); return; }
    setCollecties((l) => (l || []).map((x) => (x.id === c.id ? { ...x, standaard: !c.standaard } : x)));
  };
  const hernoem = async (c: Collectie, naam: string) => {
    const n = naam.trim(); if (!n || n === c.naam) return;
    const { error } = await sb.from("collecties").update({ naam: n }).eq("id", c.id);
    if (error) { setFout(/duplicate|unique/i.test(error.message) ? `Er bestaat al een collectie "${n}".` : error.message); return; }
    setCollecties((l) => (l || []).map((x) => (x.id === c.id ? { ...x, naam: n } : x)));
  };

  return (
    <main className="t-inhoud">
      <div className="t-rij" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <h1 className="t-titel">Bibliotheek</h1>
          <p className="t-sub">De centrale bibliotheek van Toolen, in collecties. Per klant kies je welke collecties hij krijgt.</p>
        </div>
        <a className="t-knop hoofd" href={orgAdres("toolen", "/maps/bibliotheek")}>Elementen beheren</a>
      </div>
      {fout && <p className="t-melding fout" style={{ marginTop: 16 }}>{fout}</p>}
      {collecties === null ? <p className="t-sub" style={{ marginTop: 24 }}>Laden…</p> : (
        <section className="t-kaart" style={{ marginTop: 24, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="t-rij" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="t-label">Klant</span>
              <select className="t-veld" style={{ minWidth: 260 }} value={org} onChange={(e) => setOrg(e.target.value)}>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
              </select>
            </label>
            {gekozen && <span className="t-stil" style={{ fontSize: 13.5, paddingBottom: 8 }}>{heeft.size} van {collecties.length} collecties · {totaal} elementen van Toolen · {gekozen.eigen} eigen elementen</span>}
            <span style={{ flex: 1 }} />
            <button type="button" className="t-knop klein" disabled={!gekozen || bezig} onClick={() => zet(collecties.map((c) => c.id), true)}>Alles geven</button>
            <button type="button" className="t-knop klein" disabled={!gekozen || bezig} onClick={() => zet(collecties.map((c) => c.id), false)}>Niets geven</button>
          </div>
          <table className="t-tabel">
            <thead><tr><th style={{ width: 90 }}>Krijgt</th><th>Collectie</th><th style={{ width: 110 }}>Elementen</th><th style={{ width: 200 }}>Standaard voor nieuwe klanten</th></tr></thead>
            <tbody>
              {collecties.map((c) => (
                <tr key={c.id}>
                  <td><input type="checkbox" aria-label={`${gekozen?.naam || "Klant"} krijgt ${c.naam}`} checked={heeft.has(c.id)} disabled={!gekozen || bezig} onChange={() => zet([c.id], !heeft.has(c.id))} style={{ width: 18, height: 18 }} /></td>
                  <td><input className="t-veld" defaultValue={c.naam} aria-label={`Naam van collectie ${c.naam}`} onBlur={(e) => hernoem(c, e.target.value)} style={{ maxWidth: 320 }} /></td>
                  <td>{c.elementen}</td>
                  <td><input type="checkbox" aria-label={`${c.naam} standaard voor nieuwe klanten`} checked={c.standaard} onChange={() => zetStandaard(c)} style={{ width: 18, height: 18 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="t-stil" style={{ margin: 0, fontSize: 12.5 }}>Een nieuw element in de bibliotheek van Toolen komt vanzelf in de collectie van zijn categorie. Neem je een collectie weg bij een klant, dan blijven zijn plannen bestaan, maar de elementen uit die collectie tonen er als gewone vorm tot hij ze terugkrijgt.</p>
        </section>
      )}
    </main>
  );
}
