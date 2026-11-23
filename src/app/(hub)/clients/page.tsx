import Link from "next/link";
import { Plus } from "lucide-react";
import { ClientTable } from "@/components/record-tables";
import { EmptyState, Heading, ListToolbar, Pagination } from "@/components/record-ui";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/records";
import { clientStatuses, listFilters } from "@/lib/validation";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = listFilters(await searchParams, clientStatuses);
  const { rows, count } = await listClients(filters);
  const filtered = Boolean(filters.q || filters.status || filters.page > 1);

  return (
    <>
      <Heading title="Clients" description="Find client details and the projects associated with each account.">
        <Button asChild><Link href="/clients/new"><Plus size={18} aria-hidden /> Add client</Link></Button>
      </Heading>
      <section className="panel">
        <ListToolbar path="/clients" collection="clients" filters={filters} statuses={clientStatuses} />
        {rows.length ? <ClientTable rows={rows} /> : (
          <EmptyState title={filtered ? "No matching clients" : "No clients yet"}
            description={filtered ? "Adjust the filters or return to the first page." : "Add your first client to organize their contact details and projects."} />
        )}
        <Pagination path="/clients" filters={filters} count={count} />
      </section>
    </>
  );
}
