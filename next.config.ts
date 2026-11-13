import type { NextConfig } from "next";

// Beveiligingskoppen voor alle pagina's. Deellinks (/d/...) mogen ingebed worden (inbedcode),
// al de rest niet (geen clickjacking).
const basis = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Versie van de app voor de foutmonitoring.
  env: {
    NEXT_PUBLIC_VERSIE: (process.env.VERCEL_GIT_COMMIT_SHA || "lokaal").slice(0, 7),
    // De browser heeft het adres van Supabase nodig; staat NEXT_PUBLIC_SUPABASE_URL niet in deze omgeving
    // (bv. de testomgeving), dan het gewone SUPABASE_URL. Geen geheim: het staat ook in elke aanvraag.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  },
  // Oude paden uit FLCS Maps (/flcsmaps/...) heten in Toolen /m/... (zelfde bestanden), bv. in oude versies of PDF's.
  async redirects() {
    return [{ source: "/flcsmaps/:pad*", destination: "/m/:pad*", permanent: true }];
  },
  async headers() {
    return [
      { source: "/((?!d/).*)", headers: [...basis, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" }] },
      { source: "/d/:pad*", headers: [...basis, { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'" }] },
    ];
  },
};

export default nextConfig;
