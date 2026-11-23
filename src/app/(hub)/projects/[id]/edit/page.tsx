import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/record-form";
import { BackLink, Heading } from "@/components/record-ui";
import { clientOptions, getProject } from "@/lib/records";
import { idSchema } from "@/lib/validation";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [project, clients] = await Promise.all([getProject(id), clientOptions()]);
  if (!project) notFound();

  return (
    <>
      <BackLink href={`/projects/${id}`}>{project.name}</BackLink>
      <Heading title="Edit project" />
      <ProjectForm project={project} clients={clients} />
    </>
  );
}
