import MijnTaken from "@/components/fiche/MijnTaken";
import ModuleSlot from "@/components/maps/ModuleSlot";

export const metadata = { title: "Mijn taken" };

export default function Page() {
  return <ModuleSlot module="fiche"><MijnTaken /></ModuleSlot>;
}
