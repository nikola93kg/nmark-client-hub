import { optionLabel, t } from "@/lib/localization";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { BackLink, DetailGrid, EmptyState, Heading, StatusBadge } from "@/components/record-ui";
import { AccountControls, UnlinkAccount } from "@/components/service-controls";
import { ServiceExternalLink, VaultLink } from "@/components/service-ui";
import { Button } from "@/components/ui/button";
import { getAccount, listAccountProjects } from "@/lib/service-records";
import { servicePurposeLabel } from "@/lib/project-services";
import { dateLabel } from "@/lib/utils";
import { idSchema, type QueryParams } from "@/lib/validation";

export const metadata = { title: t("Service account details") };

export default async function ServiceAccountPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<QueryParams>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [account, projects, query] = await Promise.all([getAccount(id), listAccountProjects(id), searchParams]);
  if (!account) notFound();
  return (
    <>
      <BackLink href="/service-accounts">{t("Service Accounts")}</BackLink>
      <Heading title={account.label} description={account.service_providers.name}>
        <Button asChild variant="outline"><Link href={`/service-accounts/${id}/edit`}><Pencil size={16} aria-hidden /> {t("Edit account")}</Link></Button>
        <AccountControls id={id} label={account.label} archived={!!account.archived_at} />
      </Heading>
      {query.saved === "1" && <p className="service-success" role="status">{t("Service account saved.")}</p>}
      <section className="panel">
        <div className="panel-heading panel-heading-row"><h2>{t("Account information")}</h2><StatusBadge status={account.archived_at ? "archived" : "active"} /></div>
        <DetailGrid items={[
          [t("Provider"), <Link className="text-link" key="provider" href={`/service-accounts/providers/${account.provider_id}`}>{account.service_providers.name}</Link>],
          [t("Ownership"), optionLabel(account.ownership_type)], [t("Sign-in email"), account.email], [t("Username"), account.username],
          [t("Created"), dateLabel(account.created_at)], [t("Updated"), dateLabel(account.updated_at)],
        ]} />
        <div className="detail-notes service-actions">
          <ServiceExternalLink url={account.service_providers.dashboard_url} label={t("Open provider dashboard")} />
          <ServiceExternalLink url={account.login_url} label={t("Open login URL")} />
          <VaultLink account={account} />
        </div>
        {account.notes && <div className="detail-notes"><h3>{t("Notes")}</h3><p>{account.notes}</p></div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>{t("Connected projects")}</h2></div>
        {projects.length ? <ul className="service-list">{projects.map(({ id, project_id, service_kind, purpose, notes, projects: project }) => (
          <li className="service-row" key={id}>
            <div className="service-row-top">
              <div className="service-identity">
                <Link href={`/projects/${project.id}`} className="record-link">{project.name}</Link>
                <p>{servicePurposeLabel(service_kind, purpose)}</p>{notes && <p className="service-notes">{notes}</p>}
              </div>
              <StatusBadge status={project.status} />
            </div>
            <UnlinkAccount projectId={project_id} associationId={id} label={t("{name} from {project}", { name: account.label, project: project.name })} />
          </li>
        ))}</ul> : <EmptyState title={t("No connected projects")} description={t("Open a project to link this account and describe its purpose.")} />}
      </section>
    </>
  );
}
