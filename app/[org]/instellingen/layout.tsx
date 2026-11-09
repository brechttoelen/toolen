import OrgSchil from "@/components/OrgSchil";

export const metadata = { title: "Instellingen" };

export default async function InstellingenLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <OrgSchil org={org} verder="/instellingen">{children}</OrgSchil>;
}
