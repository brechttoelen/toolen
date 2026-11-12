import type { Metadata, Viewport } from "next";
// Lettertypes in de repo zelf (app/lettertypes): geen plug-in en geen Google Fonts tijdens de build.
import "./lettertypes.css";
import "./toolen.css";
import "./globals.css";
import FoutMelder from "@/components/FoutMelder";

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
      <body><FoutMelder />{children}</body>
    </html>
  );
}
