import OpbouwModus from "@/components/maps/OpbouwModus";
import ModuleSlot from "@/components/maps/ModuleSlot";

export const metadata = { title: "Opbouw" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModuleSlot module="terrein"><OpbouwModus planId={id} /></ModuleSlot>;
}
