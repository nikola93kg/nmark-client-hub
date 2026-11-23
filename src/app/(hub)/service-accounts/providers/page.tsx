import Link from "next/link";
import { Plus } from "lucide-react";
import { BackLink, EmptyState, Heading } from "@/components/record-ui";
import { ServiceExternalLink } from "@/components/service-ui";
import { Button } from "@/components/ui/button";
import { listProviders } from "@/lib/service-records";
import type { QueryParams } from "@/lib/validation";

export const metadata = { title: "Service providers" };
const path = "/service-accounts/providers";

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const [providers, query] = await Promise.all([listProviders(), searchParams]);
  return (
    <>
      <BackLink href="/service-accounts">Service Accounts</BackLink>
      <Heading title="Service Providers" description="Manage the providers associated with service accounts.">
        <Button asChild><Link href={`${path}/new`}><Plus size={17} aria-hidden /> Add provider</Link></Button>
      </Heading>
      {query.deleted === "1" && <p className="service-success" role="status">Service provider deleted.</p>}
      <section className="panel">
        {providers.length ? <div className="table-scroll">
          <table className="records-table">
            <caption className="sr-only">Service providers</caption>
            <thead><tr><th>Provider</th><th>Category</th><th>Links</th></tr></thead>
            <tbody>{providers.map(({ id, name, category, website_url, dashboard_url }) => (
              <tr key={id}>
                <td><Link className="record-link" href={`${path}/${id}`}>{name}</Link></td>
                <td>{category}</td>
                <td><div className="service-actions">
                  <ServiceExternalLink url={website_url} label="Website" />
                  <ServiceExternalLink url={dashboard_url} label="Dashboard" />
                  <Link className="text-link" href={`${path}/${id}/edit`} aria-label={`Edit ${name}`}>Edit</Link>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div> : <EmptyState title="No service providers yet" description="Add a provider to start recording accounts for it." />}
      </section>
    </>
  );
}
