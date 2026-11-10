"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

// Nieuwe gsm: de huidige code wissen en meteen opnieuw instellen (uitzetten kan niet: ze is verplicht).
export default function MfaUit({ factorId }: { factorId: string }) {
  return (
    <button type="button" className="t-knop" onClick={async () => {
      if (!window.confirm("Op een nieuwe gsm instellen? De code op je huidige gsm werkt daarna niet meer.")) return;
      const { error } = await supabaseBrowser().auth.mfa.unenroll({ factorId });
      if (error) { window.alert(error.message); return; }
      window.location.reload();
    }}>Nieuwe gsm instellen</button>
  );
}
