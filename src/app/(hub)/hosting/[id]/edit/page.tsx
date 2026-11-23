import { AssetEditor, type IdPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Edit hosting service" };

export default async function Page({ params }: IdPageProps) {
  const { id } = await params;
  return <AssetEditor kind="hosting" id={id} />;
}
