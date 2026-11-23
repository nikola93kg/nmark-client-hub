import { t } from "@/lib/localization";
import { AssetEditor, type ListPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: t("Add hosting service") };

export default async function Page({ searchParams }: ListPageProps) {
  const { project, account } = await searchParams;
  return <AssetEditor kind="hosting" projectId={typeof project === "string" ? project : undefined} accountId={typeof account === "string" ? account : undefined} />;
}
