import { optionLabel, t } from "@/lib/localization";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BackLink, EmptyState, Heading } from "@/components/record-ui";
import { ServiceExternalLink } from "@/components/service-ui";
import { Button } from "@/components/ui/button";
import { listProviders } from "@/lib/service-records";
import type { QueryParams } from "@/lib/validation";

export const metadata = { title: t("Service providers") };
const path = "/service-accounts/providers";

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const [providers, query] = await Promise.all([listProviders(), searchParams]);
  return (
    <>
      <BackLink href="/service-accounts">{t("Service Accounts")}</BackLink>
      <Heading title={t("Service Providers")} description={t("Manage the providers associated with service accounts.")}>
        <Button asChild><Link href={`${path}/new`}><Plus size={17} aria-hidden /> {t("Add provider")}</Link></Button>
      </Heading>
      {query.deleted === "1" && <p className="service-success" role="status">{t("Service provider deleted.")}</p>}
      <section className="panel">
        {providers.length ? <div className="table-scroll">
          <table className="records-table">
            <caption className="sr-only">{t("Service providers")}</caption>
            <thead><tr><th>{t("Provider")}</th><th>{t("Category")}</th><th>{t("Links")}</th></tr></thead>
            <tbody>{providers.map(({ id, name, category, website_url, dashboard_url }) => (
              <tr key={id}>
                <td><Link className="record-link" href={`${path}/${id}`}>{name}</Link></td>
                <td>{optionLabel(category)}</td>
                <td><div className="service-actions">
                  <ServiceExternalLink url={website_url} label={t("Website")} />
                  <ServiceExternalLink url={dashboard_url} label={t("Dashboard")} />
                  <Link className="text-link" href={`${path}/${id}/edit`} aria-label={t("Edit {name}", { name })}>{t("Edit")}</Link>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div> : <EmptyState title={t("No service providers yet")} description={t("Add a provider to start recording accounts for it.")} />}
      </section>
    </>
  );
}
