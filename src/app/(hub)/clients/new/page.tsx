import { t } from "@/lib/localization";
import { ClientForm } from "@/components/record-form";
import { BackLink, Heading } from "@/components/record-ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: t("Add client") };

export default async function NewClientPage() {
  await requireAdmin();
  return (
    <>
      <BackLink href="/clients">{t("Clients")}</BackLink>
      <Heading title={t("Add client")} description={t("Record a client’s details to start tracking their work.")} />
      <ClientForm />
    </>
  );
}
