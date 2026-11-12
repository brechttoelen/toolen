import type { Metadata } from "next";
import OrgSchil from "@/components/OrgSchil";
import FeedbackKnop from "@/components/maps/Feedback";
import MobielDoorsturen from "@/components/mobiel/Doorsturen";

// Toolen Maps binnen een organisatie: login, rol en kop via OrgSchil.
export const metadata: Metadata = { title: { default: "Toolen Maps", template: "%s · Toolen Maps" }, manifest: "/pwa/manifest", icons: { apple: "/pwa/icoon/180" } };

export default async function MapsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  return (
    <OrgSchil org={org} verder="/maps" extra={<span className="fm"><FeedbackKnop zij /></span>}>
      <MobielDoorsturen />
      {children}
    </OrgSchil>
  );
}
