import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectTable } from "@/components/record-tables";
import { EmptyState, Heading, ListToolbar, Pagination } from "@/components/record-ui";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/records";
import { listFilters, projectStatuses } from "@/lib/validation";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = listFilters(await searchParams, projectStatuses);
  const { rows, count } = await listProjects(filters);
  const filtered = Boolean(filters.q || filters.status || filters.page > 1);

  return (
    <>
      <Heading title="Projects" description="Track websites, applications, and digital products across clients.">
        <Button asChild><Link href="/projects/new"><Plus size={18} aria-hidden /> Add project</Link></Button>
      </Heading>
      <section className="panel">
        <ListToolbar path="/projects" collection="projects" filters={filters} statuses={projectStatuses} />
        {rows.length ? <ProjectTable rows={rows} /> : (
          <EmptyState title={filtered ? "No matching projects" : "No projects yet"}
            description={filtered ? "Adjust the filters or return to the first page." : "Add a project to start tracking work for a client."} />
        )}
        <Pagination path="/projects" filters={filters} count={count} />
      </section>
    </>
  );
}
