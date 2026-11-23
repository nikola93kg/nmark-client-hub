import { t } from "@/lib/localization";
import Link from "next/link";
import { BackLink, EmptyState, Heading } from "@/components/record-ui";
import { AccountForm } from "@/components/service-forms";
import { Button } from "@/components/ui/button";
import { listProviders } from "@/lib/service-records";

export const metadata = { title: t("Add service account") };

export default async function NewAccountPage() {
  const providers = await listProviders();
  return (
    <>
      <BackLink href="/service-accounts">{t("Service Accounts")}</BackLink>
      <Heading title={t("Add service account")} />
      {providers.length ? <AccountForm providers={providers} /> : (
        <section className="panel"><EmptyState title={t("Add a provider first")} description={t("Each service account belongs to a provider.")}>
          <Button asChild><Link href="/service-accounts/providers/new">{t("Add provider")}</Link></Button>
        </EmptyState></section>
      )}
    </>
  );
}
