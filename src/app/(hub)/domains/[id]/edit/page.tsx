import { t } from "@/lib/localization";
import { AssetEditor, type IdPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: t("Edit domain") };

export default async function Page({ params }: IdPageProps) {
  const { id } = await params;
  return <AssetEditor kind="domains" id={id} />;
}
