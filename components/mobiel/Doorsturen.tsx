"use client";

import { useEffect } from "react";

// Op een gsm gaat de startpagina van Maps naar de mobiele versie, tenzij iemand in deze sessie
// zelf de volledige versie koos (Meer → Volledige versie).
export default function MobielDoorsturen() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("fm-volledig")) return;
      const gsm = window.matchMedia("(max-width: 720px) and (pointer: coarse)").matches;
      if (gsm && /^\/maps\/?$|^\/maps\/plannen\/?$/.test(location.pathname)) location.replace("/maps/mobiel");
    } catch { /* */ }
  }, []);
  return null;
}
