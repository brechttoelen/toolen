import type { Metadata, Viewport } from "next";
// Lettertype in de app zelf (geen Google Fonts tijdens de build).
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource-variable/archivo/wdth.css";
import "./toolen.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Toolen", template: "%s · Toolen" },
  description: "Eventsites plannen op schaal",
};

export const viewport: Viewport = {
  themeColor: "#022056",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
