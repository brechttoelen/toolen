import OpbouwModus from "@/components/maps/OpbouwModus";

export const metadata = { title: "Opbouw" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpbouwModus planId={id} />;
}
