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
  async headers() {
    return [
      { source: "/((?!d/).*)", headers: [...basis, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" }] },
      { source: "/d/:pad*", headers: [...basis, { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'" }] },
    ];
  },
};

export default nextConfig;
