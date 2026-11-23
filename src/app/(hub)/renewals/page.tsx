import { t } from "@/lib/localization";
import Link from "next/link";
import { InfrastructureNav, MoneyTotals, RenewalTable } from "@/components/infrastructure-ui";
import { Heading } from "@/components/record-ui";
import { paidRenewals, renewalOverview } from "@/lib/infrastructure-records";
import { calendarLabel, currencyTotals, expectedCosts, renewalBucket, renewalBuckets } from "@/lib/renewals";
import type { QueryParams } from "@/lib/validation";

export const metadata = { title: t("Renewals") };

export default async function Page({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const [query, { today, rows }, payments] = await Promise.all([searchParams, renewalOverview(), paidRenewals()]);
  const windows = query.window === "30" ? renewalBuckets.filter(([key]) => key === "7" || key === "14" || key === "30")
    : query.window === "overdue" ? renewalBuckets.filter(([key]) => key === "overdue") : renewalBuckets;
  const costs = expectedCosts(rows);
  return (
    <>
      <InfrastructureNav current="renewals" />
      <Heading title={t("Renewals")} description={t("Domain and hosting schedules as of {date}.", { date: calendarLabel(today) })}>
        {windows.length < renewalBuckets.length && <Link className="text-link" href="/renewals">{t("Show all renewal windows")}</Link>}
      </Heading>
      <section className="panel">
        <div className="panel-heading"><h2>{t("Renewal costs")}</h2><p className="service-muted">{t("Expected costs cover today through the next 60 days. Recorded payments cover all history.")}</p></div>
        <div className="renewal-costs">
          <div><h3>{t("Total expected")}</h3><MoneyTotals values={costs.total} /></div>
          <div><h3>{t("Domains expected")}</h3><MoneyTotals values={costs.domains} /></div>
          <div><h3>{t("Hosting expected")}</h3><MoneyTotals values={costs.hosting} /></div>
          <div><h3>{t("Recorded payments")}</h3><MoneyTotals values={currencyTotals(payments)} /></div>
        </div>
        {costs.unknownAmounts > 0 && <p className="detail-notes service-muted">{t("Upcoming records with an unknown amount: {count}.", { count: costs.unknownAmounts })}</p>}
      </section>
      <div className="renewal-breakdown">
        {([[t("Expected costs by client"), costs.client, "/clients"], [t("Expected costs by provider"), costs.provider, "/service-accounts/providers"]] as const).map(([label, groups, path]) => (
          <section className="panel" key={label}>
            <div className="panel-heading"><h2>{label}</h2></div>
            {groups.length ? <dl className="renewal-breakdown-list">
              {groups.map(({ id, name, totals }) => <div key={id}>
                <dt>{id ? <Link className="text-link" href={`${path}/${id}`}>{name}</Link> : name}</dt>
                <dd><MoneyTotals values={totals} /></dd>
              </div>)}
            </dl> : <p className="detail-notes service-muted">{t("No renewals due in this period.")}</p>}
          </section>
        ))}
      </div>
      {windows.map(([bucket, title]) => {
        const matching = rows.filter(({ days }) => renewalBucket(days) === bucket);
        return (
          <section className="panel" key={bucket} id={`renewals-${bucket}`}>
            <div className="panel-heading panel-heading-row">
              <h2>{title}</h2><span className="service-muted">{t("{count} records", { count: matching.length })}</span>
            </div>
            {matching.length ? <RenewalTable rows={matching} /> : <p className="detail-notes service-muted">{t("No renewals in this window.")}</p>}
          </section>
        );
      })}
    </>
  );
}
