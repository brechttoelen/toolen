import ExportScherm from "@/components/maps/ExportScherm";

export const metadata = { title: "Exporteren" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExportScherm planId={id} />;
}
