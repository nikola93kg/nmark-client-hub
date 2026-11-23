import { t } from "@/lib/localization";
import { RenewalEditor, type IdPageProps } from "@/components/infrastructure-pages";

export const metadata = { title: t("Record hosting service renewal") };

export default function Page(props: IdPageProps) {
  return <RenewalEditor kind="hosting" {...props} />;
}
