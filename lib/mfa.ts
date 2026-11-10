import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaStap = "code" | "instellen" | null;

// Moet deze aanmelding nog een code uit een app geven?
// Na inloggen met een wachtwoord altijd; voor platformbeheer (altijd = true) ook na Microsoft, Google of een e-mailcode.
export async function mfaStap(supabase: SupabaseClient, altijd = false): Promise<MfaStap> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!data || data.currentLevel === "aal2") return null;
    const methodes = (data.currentAuthenticationMethods || []) as unknown as (string | { method: string })[];
    const wachtwoord = methodes.some((m) => (typeof m === "string" ? m : m.method) === "password");
    if (!altijd && !wachtwoord) return null;
    return data.nextLevel === "aal2" ? "code" : "instellen";
  } catch {
    return null;
  }
}
