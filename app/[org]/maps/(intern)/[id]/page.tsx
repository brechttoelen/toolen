import Editor from "@/components/maps/Editor";

export const metadata = { title: "Plan" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editor planId={id} />;
}
