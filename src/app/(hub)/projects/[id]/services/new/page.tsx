import { notFound } from "next/navigation";
import { ProjectServiceWizard } from "@/components/project-service-wizard";
import { BackLink, Heading } from "@/components/record-ui";
import { t } from "@/lib/localization";
import { servicePurposeOptions } from "@/lib/project-services";
import { getProject } from "@/lib/records";
import { linkableAccounts, listProviders } from "@/lib/service-records";
import { idSchema } from "@/lib/validation";

export const metadata = { title: t("Add service") };

export default async function NewServicePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(id).success) notFound();
  const [project, providers, accounts] = await Promise.all([getProject(id), listProviders(), linkableAccounts()]);
  if (!project) notFound();
  return (
    <>
      <BackLink href={`/projects/${id}`}>{project.name}</BackLink>
      <Heading title={t("Add service")} description={t("Service purpose setup")} />
      <ProjectServiceWizard projectId={id} providers={providers.map(({ id, name }) => ({ id, name }))}
        accounts={accounts} initialKind={servicePurposeOptions.find(({ value }) => value === query.kind)?.value} />
    </>
  );
}
