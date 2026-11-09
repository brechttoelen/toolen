// URL en publieke sleutel van Supabase. De Vercel-koppeling van Supabase zet afhankelijk van
// de versie NEXT_PUBLIC_SUPABASE_ANON_KEY of NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: beide werken.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
export const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
export const supabaseIngesteld = () => /^https:\/\/\S+$/.test(SUPABASE_URL) && !!SUPABASE_KEY;
