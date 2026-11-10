import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaStap = "code" | "instellen" | null;

// Moet deze aanmelding nog een code uit een app geven? Altijd, behalve na Microsoft of Google
// van een organisatie die dat toelaat (die doen zelf de tweede stap; de database controleert dat).
// Platformbeheer (altijd = true) vraagt ze ook na Microsoft of Google.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mfaStap(supabase: SupabaseClient<any, any, any>, altijd = false): Promise<MfaStap> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!data || data.currentLevel === "aal2") return null;
    const methodes = (data.currentAuthenticationMethods || []) as unknown as (string | { method: string })[];
    const sso = methodes.some((m) => (typeof m === "string" ? m : m.method) === "oauth");
    if (!altijd && sso) return null;
    return data.nextLevel === "aal2" ? "code" : "instellen";
  } catch {
    return null;
  }
}
