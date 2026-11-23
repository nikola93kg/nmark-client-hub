import { optionLabel, t } from "@/lib/localization";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { BackLink, DetailGrid, Heading } from "@/components/record-ui";
import { ProviderDelete } from "@/components/service-controls";
import { ServiceExternalLink } from "@/components/service-ui";
import { Button } from "@/components/ui/button";
import { getProvider } from "@/lib/service-records";
import { safeServiceUrl } from "@/lib/service-validation";
import { dateLabel } from "@/lib/utils";
import { idSchema, type QueryParams } from "@/lib/validation";

export const metadata = { title: t("Service provider details") };

export default async function ProviderPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<QueryParams>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [provider, query] = await Promise.all([getProvider(id), searchParams]);
  if (!provider) notFound();
  return (
    <>
      <BackLink href="/service-accounts/providers">{t("Service Providers")}</BackLink>
      <Heading title={provider.name} description={optionLabel(provider.category)}>
        <Button asChild variant="outline"><Link href={`/service-accounts/providers/${id}/edit`}><Pencil size={16} aria-hidden /> {t("Edit provider")}</Link></Button>
        <ProviderDelete id={id} name={provider.name} />
      </Heading>
      {query.saved === "1" && <p className="service-success" role="status">{t("Service provider saved.")}</p>}
      <section className="panel">
        <div className="panel-heading"><h2>{t("Provider information")}</h2></div>
        <DetailGrid items={[
          [t("Category"), optionLabel(provider.category)],
          [t("Website"), safeServiceUrl(provider.website_url) && <ServiceExternalLink key="website" url={provider.website_url} label={t("Open website")} />],
          [t("Dashboard"), safeServiceUrl(provider.dashboard_url) && <ServiceExternalLink key="dashboard" url={provider.dashboard_url} label={t("Open provider dashboard")} />],
          [t("Created"), dateLabel(provider.created_at)], [t("Updated"), dateLabel(provider.updated_at)],
        ]} />
        <div className="detail-notes"><Link className="text-link" href={`/service-accounts?provider=${id}`}>{t("View accounts using this provider")}</Link></div>
      </section>
    </>
  );
}
