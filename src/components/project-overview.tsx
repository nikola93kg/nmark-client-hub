import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { AssetView, ProjectAccountView } from "@/lib/database";
import { assetDate, assetName } from "@/lib/infrastructure-records";
import { t, type Message } from "@/lib/localization";
import { isMailPurpose, serviceKindFor, servicePurposeLabel } from "@/lib/project-services";
import { calendarLabel, moneyLabel } from "@/lib/renewals";
import { StatusBadge } from "./record-ui";
import { UnlinkAccount } from "./service-controls";
import { ServiceExternalLink, VaultLink } from "./service-ui";
import { Button } from "./ui/button";

function ProjectSection({ heading, children, action }: { heading: Message; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel project-section">
      <div className="panel-heading panel-heading-row"><h2>{t(heading)}</h2>{action}</div>
      {children}
    </section>
  );
}

function AccountLink({ id, label }: { id: string; label: string }) {
  return <Link className="text-link" href={`/service-accounts/${id}`}>{label}</Link>;
}

function ServiceLine({ row }: { row: ProjectAccountView }) {
  const account = row.service_accounts;
  const provider = account?.service_providers ?? row.service_providers;
  const purpose = servicePurposeLabel(row.service_kind, row.purpose);
  return (
    <li className="project-service-line">
      <div className="project-service-data">
        <h3>{purpose}{provider && <> · <Link className="text-link" href={`/service-accounts/providers/${provider.id}`}>{provider.name}</Link></>}</h3>
        {account && <p><AccountLink id={account.id} label={account.label} /> {account.archived_at && <StatusBadge status="archived" />}</p>}
        {account?.email && <p><span className="service-muted">{t("Sign-in email")}</span> {account.email}</p>}
        {account?.username && <p><span className="service-muted">{t("Username")}</span> {account.username}</p>}
        {row.destination_email && <div><span className="service-muted">{t("Destination email")}</span> <a className="text-link" href={`mailto:${encodeURIComponent(row.destination_email).replace("%40", "@")}`}>{row.destination_email}</a></div>}
        {row.routing_notes && <p className="service-notes">{row.routing_notes}</p>}
        {row.notes && <p className="service-notes">{row.notes}</p>}
      </div>
      <div className="service-actions">
        <ServiceExternalLink url={provider?.dashboard_url ?? null} label={t("Open provider dashboard")} />
        {account && <>
          <ServiceExternalLink url={account.login_url} label={t("Open login URL")} />
          <VaultLink account={account} />
        </>}
        <UnlinkAccount projectId={row.project_id} associationId={row.id} label={purpose} service />
      </div>
    </li>
  );
}

function ServiceLines({ rows }: { rows: ProjectAccountView[] }) {
  return rows.length > 0 && <ul className="service-list">{rows.map((row) => <ServiceLine key={row.id} row={row} />)}</ul>;
}

function AssetLine({ row, connections }: { row: AssetView; connections: ProjectAccountView[] }) {
  const account = row.service_accounts;
  const isHost = row.kind === "hosting";
  const dashboard = account?.login_url ?? account?.service_providers.dashboard_url ?? null;
  const assetPath = `/${row.kind}/${row.id}`;
  return (
    <li className="project-service-line">
      <div className="project-service-data">
        <h3><Link className="record-link" href={assetPath}>{assetName(row)}</Link></h3>
        {account && <p>
          <Link href={`/service-accounts/providers/${account.service_providers.id}`} className="text-link">{account.service_providers.name}</Link>
          {" · "}<AccountLink id={account.id} label={account.label} />
        </p>}
        <dl className="project-service-facts">
          <div><dt>{t(isHost ? "Renewal date" : "Expiration date")}</dt><dd>{calendarLabel(assetDate(row))}</dd></div>
          {row.renewal_price !== null && <div><dt>{t("Expected renewal price")}</dt><dd>{moneyLabel(row.renewal_price, row.currency)}</dd></div>}
          {!isHost && <div><dt>{t("Auto-renew")}</dt><dd>{t(row.auto_renew ? "On" : "Off")}</dd></div>}
        </dl>
        {connections.map(({ id, notes }) => notes && <p className="service-notes" key={id}>{notes}</p>)}
      </div>
      <div className="service-actions">
        <ServiceExternalLink url={dashboard} label={t(isHost ? "Hosting dashboard" : "Domain dashboard")} />
        {account && <VaultLink account={account} />}
        <Button asChild variant="ghost"><Link href={assetPath}>{t("View details")} <ArrowUpRight size={15} aria-hidden /></Link></Button>
        {connections.map((link) => <UnlinkAccount key={link.id} projectId={link.project_id} associationId={link.id}
          label={servicePurposeLabel(link.service_kind, link.purpose)} service />)}
      </div>
    </li>
  );
}

function InfrastructureSection({ projectId, kind, assets, rows }: {
  projectId: string; kind: "domains" | "hosting"; assets: AssetView[]; rows: ProjectAccountView[];
}) {
  const isHost = kind === "hosting";
  // A connection already shown by its infrastructure record stays editable there.
  const matching = (link: ProjectAccountView, row: AssetView) => {
    const expected = row.kind === "hosting" ? "hosting" : "registrar";
    return link.service_account_id !== null && link.service_account_id === row.service_accounts?.id &&
      serviceKindFor(link.service_kind, link.purpose) === expected && assets.find((asset) => asset.service_accounts?.id === link.service_account_id)?.id === row.id;
  };
  const extra = rows.filter((link) => !assets.some((asset) => matching(link, asset)));
  const suggestedAccount = rows.find((row) => row.service_account_id && !row.service_accounts?.archived_at &&
    serviceKindFor(row.service_kind, row.purpose) === (isHost ? "hosting" : "registrar"))?.service_account_id;
  const query = new URLSearchParams({ project: projectId });
  if (suggestedAccount) query.set("account", suggestedAccount);
  return (
    <ProjectSection heading={isHost ? "Hosting" : "Domains"}
      action={<Button asChild variant="outline"><Link href={`/${kind}/new?${query}`}><Plus size={16} aria-hidden /> {t(isHost ? "Add hosting service" : "Add domain")}</Link></Button>}>
      {assets.length > 0 && <ul className="service-list">
        {assets.map((row) => <AssetLine key={row.id} row={row} connections={rows.filter((link) => matching(link, row))} />)}
      </ul>}
      <ServiceLines rows={extra} />
      {assets.length === 0 && extra.length === 0 && <p className="project-empty">{t(isHost ? "No hosting recorded." : "No domain recorded.")}</p>}
    </ProjectSection>
  );
}

export function ProjectConfiguration({ projectId, domains, hosting, rows }: {
  projectId: string; domains: AssetView[]; hosting: AssetView[]; rows: ProjectAccountView[];
}) {
  const classified = rows.map((row) => ({ row, kind: serviceKindFor(row.service_kind, row.purpose) }));
  const mail = classified.filter(({ kind }) => isMailPurpose(kind)).map(({ row }) => row);
  const other = classified.filter(({ kind }) => !isMailPurpose(kind) && kind !== "hosting" && kind !== "registrar" && kind !== "dns").map(({ row }) => row);
  const hasAnalytics = classified.some(({ kind }) => kind === "analytics");
  const servicePath = `/projects/${projectId}/services/new`;

  if (!rows.length && !domains.length && !hosting.length) {
    const query = new URLSearchParams({ project: projectId });
    return (
      <ProjectSection heading="Service connections">
        <div className="project-empty">
          <p>{t("No project services yet")}</p>
          <div className="service-actions">
            <Button asChild variant="ghost"><Link href={`/hosting/new?${query}`}>{t("Add hosting service")}</Link></Button>
            <Button asChild variant="ghost"><Link href={`/domains/new?${query}`}>{t("Add domain")}</Link></Button>
          </div>
        </div>
      </ProjectSection>
    );
  }

  return (
    <>
      <InfrastructureSection projectId={projectId} kind="hosting" assets={hosting} rows={classified.filter(({ kind }) => kind === "hosting").map(({ row }) => row)} />
      <InfrastructureSection projectId={projectId} kind="domains" assets={domains} rows={classified.filter(({ kind }) => kind === "registrar" || kind === "dns").map(({ row }) => row)} />
      <ProjectSection heading="Email and contact forms" action={<Button asChild variant="ghost"><Link href={servicePath + "?kind=contact_form"}>{t("Add service")}</Link></Button>}>
        <ServiceLines rows={mail} />
        {mail.length === 0 && <p className="project-empty">{t("No email or contact form service recorded.")}</p>}
      </ProjectSection>
      <ProjectSection heading="Analytics and other services" action={<Button asChild variant="ghost"><Link href={servicePath + "?kind=analytics"}>{t("Add service")}</Link></Button>}>
        <ServiceLines rows={other} />
        {!hasAnalytics && <p className="project-empty">{t(other.length ? "Analytics not configured." : "No analytics or other service recorded.")}</p>}
      </ProjectSection>
    </>
  );
}
