import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ProjectConfiguration } from "@/components/project-overview";
import { RecordMenu } from "@/components/record-menu";
import { BackLink, DetailGrid, ExternalUrl, Heading, StatusBadge } from "@/components/record-ui";
import { Button } from "@/components/ui/button";
import { projectAssets } from "@/lib/infrastructure-records";
import { t } from "@/lib/localization";
import { projectTypeLabel } from "@/lib/project-types";
import { getProject } from "@/lib/records";
import { listProjectAccounts } from "@/lib/service-records";
import { idSchema } from "@/lib/validation";

export const metadata = { title: t("Project details") };

export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ service?: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [project, services, infrastructure, query] = await Promise.all([
    getProject(id), listProjectAccounts(id), projectAssets(id), searchParams,
  ]);
  if (!project) notFound();
  const overview: Parameters<typeof DetailGrid>[0]["items"] = [
    [t("Client"), <Link className="text-link" key="client" href={`/clients/${project.client_id}`}>{project.clients.name}</Link>],
    [t("Project type"), projectTypeLabel(project.project_type)],
    [t("Technology stack"), project.technology_stack],
    [t("Primary website"), project.website && <ExternalUrl url={project.website} />],
    [t("Repository"), project.repository_url && <ExternalUrl url={project.repository_url} />],
    [t("CMS or admin"), project.cms_url && <ExternalUrl url={project.cms_url} />],
    [t("Production"), project.production_url && project.production_url !== project.website && <ExternalUrl url={project.production_url} />],
    [t("Staging"), project.staging_url && <ExternalUrl url={project.staging_url} />],
        ];
  return (
    <>
      <BackLink href="/projects">{t("Projects")}</BackLink>
      <Heading title={project.name} description={projectTypeLabel(project.project_type) ?? undefined}>
        <Button asChild><Link href={`/projects/${id}/services/new`}><Plus size={16} aria-hidden /> {t("Add service")}</Link></Button>
        <Button asChild variant="outline"><Link href={`/projects/${id}/edit`}><Pencil size={16} aria-hidden /> {t("Edit project")}</Link></Button>
      </Heading>
      {query.service === "1" && <p className="service-success" role="status">{t("Service added.")}</p>}
      <section className="panel">
        <div className="panel-heading panel-heading-row"><h2>{t("Overview")}</h2><StatusBadge status={project.status} /></div>
        <DetailGrid items={overview.filter(([, value]) => !!value)} />
        {project.description && <div className="detail-notes"><h3>{t("Description")}</h3><p>{project.description}</p></div>}
        {project.technical_notes && <div className="detail-notes"><h3>{t("Technical notes")}</h3><p>{project.technical_notes}</p></div>}
      </section>
      <ProjectConfiguration projectId={id} {...infrastructure} rows={services} />
      <RecordMenu collection="projects" id={id} name={project.name} archived={project.status === "archived"} />
    </>
  );
}
