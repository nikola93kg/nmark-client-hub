import { t } from "@/lib/localization";
import Link from "next/link";
import { ProjectForm } from "@/components/record-form";
import { BackLink, EmptyState, Heading } from "@/components/record-ui";
import { Button } from "@/components/ui/button";
import { clientOptions } from "@/lib/records";

export const metadata = { title: t("Add project") };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [clients, query] = await Promise.all([clientOptions(), searchParams]);
  const clientId = clients.find(({ id }) => id === query.client)?.id;

  return (
    <>
      <BackLink href={clientId ? `/clients/${clientId}` : "/projects"}>{clientId ? t("Client details") : t("Projects")}</BackLink>
      <Heading title={t("Add project")} description={t("Connect a website, application, or digital product to a client.")} />
      {clients.length ? <ProjectForm clients={clients} clientId={clientId} /> : (
        <section className="panel">
          <EmptyState title={t("Add a client first")} description={t("Every project belongs to one client.")}>
            <Button asChild><Link href="/clients/new">{t("Add client")}</Link></Button>
          </EmptyState>
        </section>
      )}
    </>
  );
}
