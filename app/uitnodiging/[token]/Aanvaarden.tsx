"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { orgAdres } from "@/lib/adres";

export default function Aanvaarden({ token }: { token: string }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  async function ja() {
    setBezig(true); setFout("");
    const { data, error } = await supabaseBrowser().rpc("uitnodiging_aanvaarden", { p_token: token });
    if (error) { setFout(error.message); setBezig(false); return; }
    window.location.href = orgAdres((data as { slug: string }).slug);
  }
  return (
    <>
      <button className="t-knop hoofd" onClick={ja} disabled={bezig}>{bezig ? "Bezig…" : "Uitnodiging aanvaarden"}</button>
      {fout && <p className="t-melding fout" style={{ marginTop: 12 }}>{fout}</p>}
    </>
  );
}
