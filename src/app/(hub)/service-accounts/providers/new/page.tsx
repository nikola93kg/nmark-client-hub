import { t } from "@/lib/localization";
import { BackLink, Heading } from "@/components/record-ui";
import { ProviderForm } from "@/components/service-forms";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: t("Add service provider") };

export default async function NewProviderPage() {
  await requireAdmin();
  return (
    <>
      <BackLink href="/service-accounts/providers">{t("Service Providers")}</BackLink>
      <Heading title={t("Add service provider")} />
      <ProviderForm />
    </>
  );
}
