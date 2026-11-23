import Link from "next/link";
import { Plus } from "lucide-react";
import type { AssetView, Renewal } from "@/lib/database";
import { responsibilityLabels, type AssetKind } from "@/lib/infrastructure-validation";
import { assetDate, assetName, type RenewalRow } from "@/lib/infrastructure-records";
import { calendarLabel, currencyTotalLabel, daysUntil, moneyLabel, renewalBucket, renewalTiming, tracksRenewal, type CurrencyTotal } from "@/lib/renewals";
import { EmptyState, StatusBadge } from "./record-ui";
import { Button } from "./ui/button";

export function InfrastructureNav({ current }: { current: AssetKind | "renewals" }) {
  return (
    <nav className="infrastructure-nav" aria-label="Infrastructure">
      {([["domains", "Domains"], ["hosting", "Hosting"], ["renewals", "Renewals"]] as const).map(([path, label]) => (
        <Link href={`/${path}`} key={path} aria-current={path === current ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

export function Responsibility({ row }: { row: AssetView }) {
  return row.renewal_responsibility ? responsibilityLabels[row.renewal_responsibility] : "Unassigned";
}

export function AccountReference({ row }: { row: AssetView }) {
  const account = row.service_accounts;
  if (!account) return <span className="service-muted">Provider unknown</span>;
  return (
    <>
      <Link className="text-link" href={`/service-accounts/providers/${account.service_providers.id}`}>{account.service_providers.name}</Link>
      <small><Link className="text-link" href={`/service-accounts/${account.id}`}>{account.label}{account.archived_at ? " (archived)" : ""}</Link></small>
    </>
  );
}

function Timing({ days }: { days: number | null }) {
  return <span className="renewal-timing" data-window={renewalBucket(days)}>{renewalTiming(days)}</span>;
}

export function AssetTable({ rows, kind, today, showProject = true }: {
  rows: AssetView[]; kind: AssetKind; today: string; showProject?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="records-table">
        <caption className="sr-only">{kind === "domains" ? "Domains" : "Hosting services"}</caption>
        <thead><tr>
          <th scope="col">{kind === "domains" ? "Domain" : "Hosting service"}</th>
          {showProject && <th scope="col">Project</th>}
          <th scope="col">{kind === "domains" ? "Registrar" : "Provider and account"}</th>
          <th scope="col">{kind === "domains" ? "Expiration" : "Renewal date"}</th>
          <th scope="col">Expected amount</th><th scope="col">Status</th>
        </tr></thead>
        <tbody>{rows.map((row) => {
          const date = assetDate(row);
          return (
            <tr key={row.id}>
              <td>
                <Link className="record-link" href={`/${row.kind}/${row.id}`}>{assetName(row)}</Link>
                {row.kind === "hosting" && <small>{row.hosting_type}{row.billing_cycle ? ` · ${row.billing_cycle}` : ""}</small>}
              </td>
              {showProject && <td><Link className="text-link" href={`/projects/${row.project_id}`}>{row.projects.name}</Link><small>{row.projects.clients.name}</small></td>}
              <td><AccountReference row={row} /></td>
              <td className="date-cell">{calendarLabel(date)}{tracksRenewal(row.status) && <small><Timing days={daysUntil(date, today)} /></small>}</td>
              <td>{moneyLabel(row.renewal_price, row.currency)}</td>
              <td><StatusBadge status={row.status} /></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

export function ProjectInfrastructure({ projectId, domains, hosting, today }: {
  projectId: string; domains: AssetView[]; hosting: AssetView[]; today: string;
}) {
  return (
    <>
      {([["domains", "Domains", "Add domain", domains], ["hosting", "Hosting", "Add hosting service", hosting]] as const).map(([kind, label, add, rows]) => (
        <section className="panel" key={kind}>
          <div className="panel-heading panel-heading-row">
            <h2>{label}</h2>
            <Button asChild variant="outline"><Link href={`/${kind}/new?project=${projectId}`}><Plus size={16} aria-hidden /> {add}</Link></Button>
          </div>
          {rows.length ? <AssetTable kind={kind} rows={rows} today={today} showProject={false} /> :
            <EmptyState title={kind === "domains" ? "No domains" : "No hosting services"} description="Add a record to track its account and next renewal." />}
        </section>
      ))}
    </>
  );
}

export function HistoryTable({ history }: { history: Renewal[] }) {
  if (!history.length) return <EmptyState title="No renewal history" description="Record a manual renewal to retain its dates and payment status." />;
  return (
    <div className="table-scroll">
      <table className="records-table">
        <caption className="sr-only">Renewal history</caption>
        <thead><tr>
          <th scope="col">Renewed on</th><th scope="col">Covered period</th><th scope="col">Payment status</th>
          <th scope="col">Recorded amount</th><th scope="col">Payment date</th><th scope="col">Next renewal set</th><th scope="col">Notes</th>
        </tr></thead>
        <tbody>{history.map((event) => (
          <tr key={event.id}>
            <td className="date-cell">{calendarLabel(event.renewed_on)}</td>
            <td className="date-cell">{event.period_start || event.period_end ? `${event.period_start ? calendarLabel(event.period_start) : "—"} to ${event.period_end ? calendarLabel(event.period_end) : "—"}` : "—"}</td>
            <td><StatusBadge status={event.payment_status} /></td>
            <td>{event.paid_amount === null ? "—" : moneyLabel(event.paid_amount, event.currency)}</td>
            <td className="date-cell">{event.paid_on ? calendarLabel(event.paid_on) : "—"}</td>
            <td className="date-cell">{event.next_renewal_on ? calendarLabel(event.next_renewal_on) : "Unchanged"}</td>
            <td className="renewal-notes">{event.notes || "—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function RenewalTable({ rows, compact = false }: { rows: RenewalRow[]; compact?: boolean }) {
  return (
    <div className="table-scroll">
      <table className="records-table">
        <caption className="sr-only">Renewals</caption>
        <thead><tr>
          <th scope="col">Record</th><th scope="col">Client and project</th>
          {!compact && <th scope="col">Provider and account</th>}
          <th scope="col">Renewal date</th><th scope="col">Expected amount</th>
          {!compact && <><th scope="col">Auto-renew</th><th scope="col">Responsible party</th><th scope="col">Record status</th></>}
        </tr></thead>
        <tbody>{rows.map(({ asset, date, days, amount, currency }) => (
          <tr key={`${asset.kind}/${asset.id}`}>
            <td><Link className="record-link" href={`/${asset.kind}/${asset.id}`}>{assetName(asset)}</Link><small>{asset.kind === "domains" ? "Domain" : "Hosting"}</small></td>
            <td><Link className="text-link" href={`/clients/${asset.projects.clients.id}`}>{asset.projects.clients.name}</Link>
              <small><Link className="text-link" href={`/projects/${asset.project_id}`}>{asset.projects.name}</Link></small></td>
            {!compact && <td><AccountReference row={asset} /></td>}
            <td className="date-cell">{calendarLabel(date)}<small><Timing days={days} /></small></td>
            <td>{moneyLabel(amount, currency)}</td>
            {!compact && <><td>{asset.auto_renew ? "On" : "Off"}</td><td><Responsibility row={asset} /></td><td><StatusBadge status={asset.status} /></td></>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function MoneyTotals({ values }: { values: CurrencyTotal[] }) {
  return values.length ? <ul className="currency-totals">
    {values.map((item) => <li key={item.currency}>{currencyTotalLabel(item)}</li>)}
  </ul> : <span className="service-muted">No amounts recorded</span>;
}
