import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { EmptyState, Heading, ListToolbar, Pagination } from "@/components/record-ui";
import { ServiceAccountList } from "@/components/service-ui";
import { Button } from "@/components/ui/button";
import { listAccounts, listProviders } from "@/lib/service-records";
import { accountFilters, accountOwnership, accountStatuses } from "@/lib/service-validation";
import type { QueryParams } from "@/lib/validation";

export const metadata = { title: "Service accounts" };
const path = "/service-accounts";

export default async function ServiceAccountsPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const params = await searchParams;
  const filters = accountFilters(params);
  const [{ rows, count }, providers] = await Promise.all([listAccounts(filters), listProviders()]);
  const extra = { provider: filters.provider, ownership: filters.ownership };
  const extraFiltered = !!(filters.provider || filters.ownership);
  const filtered = !!(filters.q || filters.status || filters.page > 1 || extraFiltered);
  return (
    <>
      <Heading title="Service Accounts" description="Track service sign-ins and the projects that use them.">
        <Button variant="outline" asChild><Link href={`${path}/providers`}><Settings2 size={16} aria-hidden /> Manage providers</Link></Button>
        <Button asChild><Link href={`${path}/new`}><Plus size={17} aria-hidden /> Add account</Link></Button>
      </Heading>
      {params.deleted === "1" && <p className="service-success" role="status">Service account deleted.</p>}
      <section className="panel">
        <ListToolbar path={path} collection="service accounts" filters={filters} statuses={accountStatuses} extraFiltered={extraFiltered}>
          <div className="toolbar-field"><select className="field-control" name="provider" aria-label="Provider" defaultValue={filters.provider}>
            <option value="">All providers</option>
            {providers.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select></div>
          <div className="toolbar-field"><select className="field-control" name="ownership" aria-label="Ownership" defaultValue={filters.ownership}>
            <option value="">All ownership types</option>
            {Object.entries(accountOwnership).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>
        </ListToolbar>
        {rows.length ? <ServiceAccountList rows={rows} /> : (
          <EmptyState title={filtered ? "No matching service accounts" : "No service accounts yet"}
            description={filtered ? "Adjust the filters or return to the first page." : "Add an account to connect a service to your projects."} />
        )}
        <Pagination path={path} filters={filters} count={count} extra={extra} />
      </section>
    </>
  );
}
