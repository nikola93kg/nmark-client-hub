import { t } from "@/lib/localization";
import { AssetIndex, type ListPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: t("Hosting") };

export default function Page(props: ListPageProps) {
  return <AssetIndex kind="hosting" {...props} />;
}
