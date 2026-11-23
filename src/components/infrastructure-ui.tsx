import { optionLabel, t } from "@/lib/localization";
import Link from "next/link";
import type { AssetView, Renewal } from "@/lib/database";
import { responsibilityLabels, type AssetKind } from "@/lib/infrastructure-validation";
import { assetDate, assetName, type RenewalRow } from "@/lib/infrastructure-records";
import { calendarLabel, currencyTotalLabel, daysUntil, moneyLabel, renewalBucket, renewalTiming, tracksRenewal, type CurrencyTotal } from "@/lib/renewals";
import { EmptyState, StatusBadge } from "./record-ui";

export function InfrastructureNav({ current }: { current: AssetKind | "renewals" }) {
  return (
    <nav className="infrastructure-nav" aria-label={t("Infrastructure")}>
      {([["domains", t("Domains")], ["hosting", t("Hosting")], ["renewals", t("Renewals")]] as const).map(([path, label]) => (
        <Link href={`/${path}`} key={path} aria-current={path === current ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

export function Responsibility({ row }: { row: AssetView }) {
  return row.renewal_responsibility ? responsibilityLabels[row.renewal_responsibility] : t("Unassigned");
}

export function AccountReference({ row }: { row: AssetView }) {
  const account = row.service_accounts;
  if (!account) return <span className="service-muted">{t("Provider unknown")}</span>;
  return (
    <>
      <Link className="text-link" href={`/service-accounts/providers/${account.service_providers.id}`}>{account.service_providers.name}</Link>
      <small><Link className="text-link" href={`/service-accounts/${account.id}`}>{account.archived_at ? t("{name} (archived)", { name: account.label }) : account.label}</Link></small>
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
        <caption className="sr-only">{kind === "domains" ? t("Domains") : t("Hosting services")}</caption>
        <thead><tr>
          <th scope="col">{kind === "domains" ? t("Domain") : t("Hosting service")}</th>
          {showProject && <th scope="col">{t("Project")}</th>}
          <th scope="col">{kind === "domains" ? t("Registrar") : t("Provider and account")}</th>
          <th scope="col">{kind === "domains" ? t("Expiration") : t("Renewal date")}</th>
          <th scope="col">{t("Expected amount")}</th><th scope="col">{t("Status")}</th>
        </tr></thead>
        <tbody>{rows.map((row) => {
          const date = assetDate(row);
          return (
            <tr key={row.id}>
              <td>
                <Link className="record-link" href={`/${row.kind}/${row.id}`}>{assetName(row)}</Link>
                {row.kind === "hosting" && <small>{optionLabel(row.hosting_type)}{row.billing_cycle ? ` · ${optionLabel(row.billing_cycle)}` : ""}</small>}
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

export function HistoryTable({ history }: { history: Renewal[] }) {
  if (!history.length) return <EmptyState title={t("No renewal history")} description={t("Record a manual renewal to retain its dates and payment status.")} />;
  return (
    <div className="table-scroll">
      <table className="records-table">
        <caption className="sr-only">{t("Renewal history")}</caption>
        <thead><tr>
          <th scope="col">{t("Renewed on")}</th><th scope="col">{t("Covered period")}</th><th scope="col">{t("Payment status")}</th>
          <th scope="col">{t("Recorded amount")}</th><th scope="col">{t("Payment date")}</th><th scope="col">{t("Next renewal set")}</th><th scope="col">{t("Notes")}</th>
        </tr></thead>
        <tbody>{history.map((event) => (
          <tr key={event.id}>
            <td className="date-cell">{calendarLabel(event.renewed_on)}</td>
            <td className="date-cell">{event.period_start || event.period_end ? `${event.period_start ? calendarLabel(event.period_start) : "—"} – ${event.period_end ? calendarLabel(event.period_end) : "—"}` : "—"}</td>
            <td><StatusBadge status={event.payment_status} /></td>
            <td>{event.paid_amount === null ? "—" : moneyLabel(event.paid_amount, event.currency)}</td>
            <td className="date-cell">{event.paid_on ? calendarLabel(event.paid_on) : "—"}</td>
            <td className="date-cell">{event.next_renewal_on ? calendarLabel(event.next_renewal_on) : t("Unchanged")}</td>
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
        <caption className="sr-only">{t("Renewals")}</caption>
        <thead><tr>
          <th scope="col">{t("Record")}</th><th scope="col">{t("Client and project")}</th>
          {!compact && <th scope="col">{t("Provider and account")}</th>}
          <th scope="col">{t("Renewal date")}</th><th scope="col">{t("Expected amount")}</th>
          {!compact && <><th scope="col">{t("Auto-renew")}</th><th scope="col">{t("Responsible party")}</th><th scope="col">{t("Record status")}</th></>}
        </tr></thead>
        <tbody>{rows.map(({ asset, date, days, amount, currency }) => (
          <tr key={`${asset.kind}/${asset.id}`}>
            <td><Link className="record-link" href={`/${asset.kind}/${asset.id}`}>{assetName(asset)}</Link><small>{asset.kind === "domains" ? t("Domain") : t("Hosting")}</small></td>
            <td><Link className="text-link" href={`/clients/${asset.projects.clients.id}`}>{asset.projects.clients.name}</Link>
              <small><Link className="text-link" href={`/projects/${asset.project_id}`}>{asset.projects.name}</Link></small></td>
            {!compact && <td><AccountReference row={asset} /></td>}
            <td className="date-cell">{calendarLabel(date)}<small><Timing days={days} /></small></td>
            <td>{moneyLabel(amount, currency)}</td>
            {!compact && <><td>{asset.auto_renew ? t("On") : t("Off")}</td><td><Responsibility row={asset} /></td><td><StatusBadge status={asset.status} /></td></>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function MoneyTotals({ values }: { values: CurrencyTotal[] }) {
  return values.length ? <ul className="currency-totals">
    {values.map((item) => <li key={item.currency}>{currencyTotalLabel(item)}</li>)}
  </ul> : <span className="service-muted">{t("No amounts recorded")}</span>;
}
