import type { Metadata } from "next";
import OrgSchil from "@/components/OrgSchil";
import FeedbackKnop from "@/components/maps/Feedback";

// Toolen Maps binnen een organisatie: login, rol en kop via OrgSchil.
export const metadata: Metadata = { title: { default: "Toolen Maps", template: "%s · Toolen Maps" } };

export default async function MapsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  return (
    <OrgSchil org={org} verder="/maps" extra={<span className="fm"><FeedbackKnop klein /></span>}>
      {children}
    </OrgSchil>
  );
}
