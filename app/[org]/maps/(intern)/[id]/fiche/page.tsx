import FicheScherm from "@/components/fiche/FicheScherm";
import ModuleSlot from "@/components/maps/ModuleSlot";

export const metadata = { title: "Fiche" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModuleSlot module="fiche"><FicheScherm planId={id} /></ModuleSlot>;
}
