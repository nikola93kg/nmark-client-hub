import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { RecordMenu } from "@/components/record-menu";
import { BackLink, DetailGrid, ExternalUrl, Heading, StatusBadge } from "@/components/record-ui";
import { Button } from "@/components/ui/button";
import { getProject } from "@/lib/records";
import { dateLabel } from "@/lib/utils";
import { idSchema } from "@/lib/validation";

export const metadata = { title: "Project details" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <>
      <BackLink href="/projects">Projects</BackLink>
      <Heading title={project.name} description={project.project_type ?? undefined}>
        <Button asChild variant="outline"><Link href={`/projects/${id}/edit`}><Pencil size={16} aria-hidden /> Edit project</Link></Button>
        <RecordMenu collection="projects" id={id} name={project.name} archived={project.status === "archived"} />
      </Heading>
      <section className="panel detail-panel">
        <div className="panel-heading panel-heading-row"><h2>Overview</h2><StatusBadge status={project.status} /></div>
        <DetailGrid items={[
          ["Client", <Link className="text-link" key="client" href={`/clients/${project.client_id}`}>{project.clients.name}</Link>],
          ["Project type", project.project_type], ["Technology stack", project.technology_stack],
          ["Primary website", project.website && <ExternalUrl key="website" url={project.website} />],
          ["Repository", project.repository_url && <ExternalUrl key="repository" url={project.repository_url} />],
          ["CMS or admin", project.cms_url && <ExternalUrl key="cms" url={project.cms_url} />],
          ["Production", project.production_url && <ExternalUrl key="production" url={project.production_url} />],
          ["Staging", project.staging_url && <ExternalUrl key="staging" url={project.staging_url} />],
          ["Created", dateLabel(project.created_at)], ["Updated", dateLabel(project.updated_at)],
        ]} />
        {project.description && <div className="detail-notes"><h3>Description</h3><p>{project.description}</p></div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Technical notes</h2></div>
        <div className="detail-notes"><p>{project.technical_notes || "No technical notes yet."}</p></div>
      </section>
    </>
  );
}
