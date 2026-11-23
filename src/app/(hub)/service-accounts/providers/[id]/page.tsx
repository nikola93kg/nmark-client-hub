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

export const metadata = { title: "Service provider details" };

export default async function ProviderPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<QueryParams>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [provider, query] = await Promise.all([getProvider(id), searchParams]);
  if (!provider) notFound();
  return (
    <>
      <BackLink href="/service-accounts/providers">Service Providers</BackLink>
      <Heading title={provider.name} description={provider.category}>
        <Button asChild variant="outline"><Link href={`/service-accounts/providers/${id}/edit`}><Pencil size={16} aria-hidden /> Edit provider</Link></Button>
        <ProviderDelete id={id} name={provider.name} />
      </Heading>
      {query.saved === "1" && <p className="service-success" role="status">Service provider saved.</p>}
      <section className="panel">
        <div className="panel-heading"><h2>Provider information</h2></div>
        <DetailGrid items={[
          ["Category", provider.category],
          ["Website", safeServiceUrl(provider.website_url) && <ServiceExternalLink key="website" url={provider.website_url} label="Open website" />],
          ["Dashboard", safeServiceUrl(provider.dashboard_url) && <ServiceExternalLink key="dashboard" url={provider.dashboard_url} label="Open provider dashboard" />],
          ["Created", dateLabel(provider.created_at)], ["Updated", dateLabel(provider.updated_at)],
        ]} />
        <div className="detail-notes"><Link className="text-link" href={`/service-accounts?provider=${id}`}>View accounts using this provider</Link></div>
      </section>
    </>
  );
}
