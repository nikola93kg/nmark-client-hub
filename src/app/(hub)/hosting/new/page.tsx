import { AssetEditor, type ListPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Add hosting service" };

export default async function Page({ searchParams }: ListPageProps) {
  const { project } = await searchParams;
  return <AssetEditor kind="hosting" projectId={typeof project === "string" ? project : undefined} />;
}
