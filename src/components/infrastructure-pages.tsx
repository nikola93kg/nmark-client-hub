import { optionLabel, t } from "@/lib/localization";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Pencil, Plus } from "lucide-react";
import { assetDate, assetName, assetOptions, configuredToday, getAsset, listAssets, renewalHistory } from "@/lib/infrastructure-records";
import { assetFilters, domainStatuses, hostingStatuses, type AssetKind } from "@/lib/infrastructure-validation";
import { calendarLabel, moneyLabel } from "@/lib/renewals";
import { dateLabel } from "@/lib/utils";
import { idSchema, type QueryParams } from "@/lib/validation";
import { AssetControls, DomainForm, HostingForm, RenewalForm } from "./infrastructure-forms";
import { AccountReference, AssetTable, HistoryTable, InfrastructureNav, Responsibility } from "./infrastructure-ui";
import { BackLink, DetailGrid, EmptyState, Heading, ListToolbar, Pagination, StatusBadge } from "./record-ui";
import { Button } from "./ui/button";

export type ListPageProps = { searchParams: Promise<QueryParams> };
export type DetailPageProps = { params: Promise<{ id: string }>; searchParams: Promise<QueryParams> };
export type IdPageProps = Pick<DetailPageProps, "params">;

export async function AssetIndex({ kind, searchParams }: ListPageProps & { kind: AssetKind }) {
  const query = await searchParams;
  const filters = assetFilters(query, kind);
  const [{ rows, count }, { projects }] = await Promise.all([listAssets(kind, filters), assetOptions()]);
  const domains = kind === "domains";
  const label = domains ? t("Domains") : t("Hosting");
  const title = domains ? t("Add domain") : t("Add hosting service");
  return (
    <>
      <InfrastructureNav current={kind} />
      <Heading title={label} description={domains ? t("Track project domains, registrars and expiration dates.") : t("Track project hosting plans, service accounts and billing cycles.")}>
        <Button asChild><Link href={`/${kind}/new`}><Plus size={16} aria-hidden /> {title}</Link></Button>
      </Heading>
      {query.deleted === "1" && <p className="service-success" role="status">{t(domains ? "Domain deleted." : "Hosting service deleted.")}</p>}
      <section className="panel">
        <ListToolbar path={`/${kind}`} collection={kind} filters={filters}
          statuses={domains ? domainStatuses : hostingStatuses} extraFiltered={!!filters.project}>
          <div className="toolbar-field">
            <select aria-label={t("Project")} name="project" className="field-control" defaultValue={filters.project}>
              <option value="">{t("All projects")}</option>
              {projects.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
            </select>
          </div>
        </ListToolbar>
        {rows.length ? <AssetTable rows={rows} kind={kind} today={configuredToday()} /> :
          <EmptyState title={domains ? t("No domains found") : t("No hosting services found")} description={t("Change the filters or add a new record.")} />}
        <Pagination path={`/${kind}`} filters={filters} count={count} extra={{ project: filters.project }} />
      </section>
    </>
  );
}

export async function AssetEditor({ kind, id, projectId, accountId }: { kind: AssetKind; id?: string; projectId?: string; accountId?: string }) {
  if (id && !idSchema.safeParse(id).success) notFound();
  const [choices, row] = await Promise.all([assetOptions(), id ? getAsset(kind, id) : null]);
  if (id && !row) notFound();
  const domains = kind === "domains";
  const account = choices.accounts.find(({ id: value }) => value === accountId);
  const project = choices.projects.find(({ id: value }) => value === projectId);
  const title = t(domains ? row ? "Edit domain" : "Add domain" : row ? "Edit hosting service" : "Add hosting service");
  const back = row ? `/${kind}/${row.id}` : project ? `/projects/${project.id}` : `/${kind}`;
  const needsAccount = !domains && !row && !choices.accounts.length;
  return (
    <>
      <BackLink href={back}>{row ? assetName(row) : project?.name ?? (domains ? t("Domains") : t("Hosting"))}</BackLink>
      <Heading title={title} />
      {!choices.projects.length || needsAccount ? (
        <section className="panel"><EmptyState
          title={needsAccount ? t("Add a service account first") : t("Add a project first")}
          description={needsAccount ? t("Each hosting record uses an existing service account.") : t("Each infrastructure record belongs to a project.")}>
          <Button asChild><Link href={needsAccount ? "/service-accounts/new" : "/projects/new"}>{needsAccount ? t("Add account") : t("Add project")}</Link></Button>
        </EmptyState></section>
      ) : domains ? <DomainForm row={row?.kind === "domains" ? row : undefined} choices={choices} projectId={project?.id} accountId={account?.id} />
        : <HostingForm row={row?.kind === "hosting" ? row : undefined} choices={choices} projectId={project?.id} accountId={account?.id} />}
    </>
  );
}

export async function AssetDetails({ kind, params, searchParams }: DetailPageProps & { kind: AssetKind }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [row, history, query] = await Promise.all([getAsset(kind, id), renewalHistory(kind, id), searchParams]);
  if (!row) notFound();
  const name = assetName(row);
  const domains = row.kind === "domains";
  const overview: Parameters<typeof DetailGrid>[0]["items"] = domains
    ? [[t("Registration date"), calendarLabel(row.registered_on)], [t("Expiration date"), calendarLabel(row.expires_on)]]
    : [[t("Hosting type"), optionLabel(row.hosting_type)], [t("Billing cycle"), row.billing_cycle && optionLabel(row.billing_cycle)], [t("Renewal date"), calendarLabel(row.renews_on)]];

  return (
    <>
      <BackLink href={`/${kind}`}>{domains ? t("Domains") : t("Hosting")}</BackLink>
      <Heading title={name}>
        <Button asChild><Link href={`/${kind}/${id}/renew`}><CalendarPlus size={16} aria-hidden /> {t("Record renewal")}</Link></Button>
        <Button asChild variant="outline"><Link href={`/${kind}/${id}/edit`}><Pencil size={16} aria-hidden /> {t("Edit")}</Link></Button>
        <AssetControls kind={kind} id={id} name={name} archived={row.status === "archived"} />
      </Heading>
      {query.saved === "1" && <p className="service-success" role="status">{t(domains ? "Domain saved." : "Hosting service saved.")}</p>}
      {query.renewed === "1" && <p className="service-success" role="status">{t("Renewal recorded.")}</p>}
      <section className="panel">
        <div className="panel-heading panel-heading-row"><h2>{domains ? t("Domain information") : t("Hosting information")}</h2><StatusBadge status={row.status} /></div>
        <DetailGrid items={[
          [t("Project"), <Link key="project" className="text-link" href={`/projects/${row.project_id}`}>{row.projects.name}</Link>],
          [t("Client"), <Link key="client" className="text-link" href={`/clients/${row.projects.clients.id}`}>{row.projects.clients.name}</Link>],
          [domains ? t("Registrar and account") : t("Provider and account"), <AccountReference key="account" row={row} />],
          ...overview, [t("Expected renewal price"), moneyLabel(row.renewal_price, row.currency)],
          [t("Currency"), row.currency], [t("Auto-renew"), row.auto_renew ? t("On") : t("Off")],
          [t("Renewal responsibility"), <Responsibility key="owner" row={row} />],
          [t("Created"), dateLabel(row.created_at)], [t("Updated"), dateLabel(row.updated_at)],
        ]} />
        {!domains && row.server_notes && <div className="detail-notes"><h3>{t("Server or location notes")}</h3><p>{row.server_notes}</p></div>}
        {row.notes && <div className="detail-notes"><h3>{t("Notes")}</h3><p>{row.notes}</p></div>}
      </section>
      <section className="panel" id="renewal-history">
        <div className="panel-heading"><h2>{t("Renewal history")}</h2></div>
        <HistoryTable history={history} />
      </section>
    </>
  );
}

export async function RenewalEditor({ kind, params }: IdPageProps & { kind: AssetKind }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const row = await getAsset(kind, id);
  if (!row) notFound();
  return (
    <>
      <BackLink href={`/${kind}/${id}`}>{assetName(row)}</BackLink>
      <Heading title={t("Record renewal")} description={t("Current renewal date is {date}.", { date: calendarLabel(assetDate(row)) })} />
      <RenewalForm kind={kind} id={id} eventId={randomUUID()} today={configuredToday()} currency={row.currency} />
    </>
  );
}
