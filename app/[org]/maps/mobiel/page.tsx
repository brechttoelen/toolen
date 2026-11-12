import MobielApp from "@/components/mobiel/MobielApp";
import { huisstijlVan } from "@/lib/huisstijlServer";

export default async function Page({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <MobielApp huisstijl={await huisstijlVan(org)} />;
}
