import { t } from "@/lib/localization";
import { AssetEditor, type ListPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: t("Add domain") };

export default async function Page({ searchParams }: ListPageProps) {
  const { project, account } = await searchParams;
  return <AssetEditor kind="domains" projectId={typeof project === "string" ? project : undefined} accountId={typeof account === "string" ? account : undefined} />;
}
