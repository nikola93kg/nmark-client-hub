import { t } from "@/lib/localization";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { RecordMenu } from "@/components/record-menu";
import { ProjectTable } from "@/components/record-tables";
import { BackLink, DetailGrid, EmptyState, ExternalUrl, Heading, Pagination, StatusBadge } from "@/components/record-ui";
import { Button } from "@/components/ui/button";
import { getClient, listProjects } from "@/lib/records";
import { dateLabel } from "@/lib/utils";
import { idSchema, listFilters, projectStatuses } from "@/lib/validation";

export const metadata = { title: t("Client details") };

export default async function ClientPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const filters = listFilters({ page: (await searchParams).page }, projectStatuses);
  const [client, projects] = await Promise.all([getClient(id), listProjects(filters, id)]);
  if (!client) notFound();

  return (
    <>
      <BackLink href="/clients">{t("Clients")}</BackLink>
      <Heading title={client.name} description={client.company ?? undefined}>
        <Button asChild variant="outline"><Link href={`/clients/${id}/edit`}><Pencil size={16} aria-hidden /> {t("Edit client")}</Link></Button>
        <RecordMenu collection="clients" id={id} name={client.name} archived={client.status === "archived"} />
      </Heading>
      <section className="panel detail-panel">
        <div className="panel-heading panel-heading-row"><h2>{t("Client information")}</h2><StatusBadge status={client.status} /></div>
        <DetailGrid items={[
          [t("Contact person"), client.contact_person], [t("Email"), client.email], [t("Phone"), client.phone],
          [t("Website"), client.website && <ExternalUrl key="website" url={client.website} />],
          [t("Location"), [client.city, client.country].filter(Boolean).join(", ")],
          [t("Address"), client.address], [t("Created"), dateLabel(client.created_at)], [t("Updated"), dateLabel(client.updated_at)],
        ]} />
        {client.notes && <div className="detail-notes"><h3>{t("General notes")}</h3><p>{client.notes}</p></div>}
      </section>
      <section className="panel">
        <div className="panel-heading panel-heading-row">
          <h2>{t("Projects")}</h2>
          <Button asChild><Link href={`/projects/new?client=${id}`}><Plus size={17} aria-hidden /> {t("Add project")}</Link></Button>
        </div>
        {projects.rows.length ? <ProjectTable rows={projects.rows} showClient={false} />
          : <EmptyState title={filters.page > 1 ? t("No projects on this page") : t("No projects for this client")} description={filters.page > 1 ? t("Return to the first page to see available projects.") : t("Add a project to start tracking this client’s work.")} />}
        <Pagination path={`/clients/${id}`} filters={filters} count={projects.count} />
      </section>
    </>
  );
}
