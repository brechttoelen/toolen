import type { Metadata } from "next";
import LeverficheDeel from "@/components/fiche/LeverficheDeel";

export const metadata: Metadata = { title: "Leverfiche · Toolen Maps", robots: { index: false, follow: false } };

// Leverfiche voor een leverancier, zonder login: het token van de link bewijst de toegang.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LeverficheDeel token={token} />;
}
