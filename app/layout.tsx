import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: { default: "Toolen", template: "%s · Toolen" },
  description: "Eventsites plannen op schaal",
};

export const viewport: Viewport = {
  themeColor: "#1d1d1b",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={sans.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
