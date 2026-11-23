import { AssetEditor, type ListPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: "Add domain" };

export default async function Page({ searchParams }: ListPageProps) {
  const { project } = await searchParams;
  return <AssetEditor kind="domains" projectId={typeof project === "string" ? project : undefined} />;
}
