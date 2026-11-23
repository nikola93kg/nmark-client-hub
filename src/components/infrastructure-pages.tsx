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
  const label = domains ? "Domains" : "Hosting";
  const title = domains ? "Add domain" : "Add hosting service";
  return (
    <>
      <InfrastructureNav current={kind} />
      <Heading title={label} description={domains ? "Track project domains, registrars and expiration dates." : "Track project hosting plans, service accounts and billing cycles."}>
        <Button asChild><Link href={`/${kind}/new`}><Plus size={16} aria-hidden /> {title}</Link></Button>
      </Heading>
      {query.deleted === "1" && <p className="service-success" role="status">{domains ? "Domain" : "Hosting service"} deleted.</p>}
      <section className="panel">
        <ListToolbar path={`/${kind}`} collection={kind} filters={filters}
          statuses={domains ? domainStatuses : hostingStatuses} extraFiltered={!!filters.project}>
          <div className="toolbar-field">
            <select aria-label="Project" name="project" className="field-control" defaultValue={filters.project}>
              <option value="">All projects</option>
              {projects.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
            </select>
          </div>
        </ListToolbar>
        {rows.length ? <AssetTable rows={rows} kind={kind} today={configuredToday()} /> :
          <EmptyState title={domains ? "No domains found" : "No hosting services found"} description="Change the filters or add a new record." />}
        <Pagination path={`/${kind}`} filters={filters} count={count} extra={{ project: filters.project }} />
      </section>
    </>
  );
}

export async function AssetEditor({ kind, id, projectId }: { kind: AssetKind; id?: string; projectId?: string }) {
  if (id && !idSchema.safeParse(id).success) notFound();
  const [choices, row] = await Promise.all([assetOptions(), id ? getAsset(kind, id) : null]);
  if (id && !row) notFound();
  const domains = kind === "domains";
  const project = choices.projects.find(({ id: value }) => value === projectId);
  const title = `${row ? "Edit" : "Add"} ${domains ? "domain" : "hosting service"}`;
  const back = row ? `/${kind}/${row.id}` : project ? `/projects/${project.id}` : `/${kind}`;
  const needsAccount = !domains && !row && !choices.accounts.length;
  return (
    <>
      <BackLink href={back}>{row ? assetName(row) : project?.name ?? (domains ? "Domains" : "Hosting")}</BackLink>
      <Heading title={title} />
      {!choices.projects.length || needsAccount ? (
        <section className="panel"><EmptyState
          title={needsAccount ? "Add a service account first" : "Add a project first"}
          description={needsAccount ? "Each hosting record uses an existing service account." : "Each infrastructure record belongs to a project."}>
          <Button asChild><Link href={needsAccount ? "/service-accounts/new" : "/projects/new"}>{needsAccount ? "Add account" : "Add project"}</Link></Button>
        </EmptyState></section>
      ) : domains ? <DomainForm row={row?.kind === "domains" ? row : undefined} choices={choices} projectId={project?.id} />
        : <HostingForm row={row?.kind === "hosting" ? row : undefined} choices={choices} projectId={project?.id} />}
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
    ? [["Registration date", calendarLabel(row.registered_on)], ["Expiration date", calendarLabel(row.expires_on)]]
    : [["Hosting type", row.hosting_type], ["Billing cycle", row.billing_cycle], ["Renewal date", calendarLabel(row.renews_on)]];

  return (
    <>
      <BackLink href={`/${kind}`}>{domains ? "Domains" : "Hosting"}</BackLink>
      <Heading title={name}>
        <Button asChild><Link href={`/${kind}/${id}/renew`}><CalendarPlus size={16} aria-hidden /> Record renewal</Link></Button>
        <Button asChild variant="outline"><Link href={`/${kind}/${id}/edit`}><Pencil size={16} aria-hidden /> Edit</Link></Button>
        <AssetControls kind={kind} id={id} name={name} archived={row.status === "archived"} />
      </Heading>
      {query.saved === "1" && <p className="service-success" role="status">{domains ? "Domain" : "Hosting service"} saved.</p>}
      {query.renewed === "1" && <p className="service-success" role="status">Renewal recorded.</p>}
      <section className="panel">
        <div className="panel-heading panel-heading-row"><h2>{domains ? "Domain information" : "Hosting information"}</h2><StatusBadge status={row.status} /></div>
        <DetailGrid items={[
          ["Project", <Link key="project" className="text-link" href={`/projects/${row.project_id}`}>{row.projects.name}</Link>],
          ["Client", <Link key="client" className="text-link" href={`/clients/${row.projects.clients.id}`}>{row.projects.clients.name}</Link>],
          [domains ? "Registrar and account" : "Provider and account", <AccountReference key="account" row={row} />],
          ...overview, ["Expected renewal price", moneyLabel(row.renewal_price, row.currency)],
          ["Currency", row.currency], ["Auto-renew", row.auto_renew ? "On" : "Off"],
          ["Renewal responsibility", <Responsibility key="owner" row={row} />],
          ["Created", dateLabel(row.created_at)], ["Updated", dateLabel(row.updated_at)],
        ]} />
        {!domains && row.server_notes && <div className="detail-notes"><h3>Server or location notes</h3><p>{row.server_notes}</p></div>}
        {row.notes && <div className="detail-notes"><h3>Notes</h3><p>{row.notes}</p></div>}
      </section>
      <section className="panel" id="renewal-history">
        <div className="panel-heading"><h2>Renewal history</h2></div>
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
      <Heading title="Record renewal" description={`Current renewal date: ${calendarLabel(assetDate(row))}.`} />
      <RenewalForm kind={kind} id={id} eventId={randomUUID()} today={configuredToday()} currency={row.currency} />
    </>
  );
}
