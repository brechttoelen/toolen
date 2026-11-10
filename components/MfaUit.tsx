"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

// Tweestapsverificatie weer uitzetten (bv. nieuwe gsm: uitzetten en opnieuw instellen).
export default function MfaUit({ factorId }: { factorId: string }) {
  return (
    <button type="button" className="t-knop" onClick={async () => {
      if (!window.confirm("Tweestapsverificatie uitzetten? Met een wachtwoord inloggen vraagt dan meteen opnieuw om ze in te stellen.")) return;
      const { error } = await supabaseBrowser().auth.mfa.unenroll({ factorId });
      if (error) { window.alert(error.message); return; }
      window.location.reload();
    }}>Uitzetten of nieuwe gsm</button>
  );
}
