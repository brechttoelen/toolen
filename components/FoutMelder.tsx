"use client";

import { useEffect } from "react";
import { meldFout } from "@/lib/foutmelden";

// Vangt fouten in de browser die nergens anders opgevangen worden en meldt ze aan het platform.
export default function FoutMelder() {
  useEffect(() => {
    const fout = (e: ErrorEvent) => meldFout(e.error || e.message);
    const belofte = (e: PromiseRejectionEvent) => meldFout(e.reason, "Onafgehandeld");
    window.addEventListener("error", fout);
    window.addEventListener("unhandledrejection", belofte);
    return () => { window.removeEventListener("error", fout); window.removeEventListener("unhandledrejection", belofte); };
  }, []);
  return null;
}
