"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { centraalAdres } from "@/lib/adres";

// Een account mag op twee apparaten tegelijk aangemeld zijn. Meldt iemand zich op een derde aan,
// dan vervalt de oudste aanmelding in de databank; dit apparaat merkt dat hier en meldt zich af.
export default function SessieWacht() {
  useEffect(() => {
    let weg = false;
    const kijk = async () => {
      if (weg || document.visibilityState === "hidden") return;
      try {
        const sb = supabaseBrowser();
        const { data, error } = await sb.rpc("sessie_geldig");
        if (!error && data === false) {
          weg = true;
          await sb.auth.signOut({ scope: "local" });
          window.location.href = centraalAdres(`/login?fout=${encodeURIComponent("Je bent afgemeld omdat dit account op twee andere apparaten aangemeld werd. Een account mag op twee apparaten tegelijk.")}`);
        }
      } catch {}
    };
    const t = setInterval(kijk, 60000);
    document.addEventListener("visibilitychange", kijk);
    kijk();
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", kijk); };
  }, []);
  return null;
}
