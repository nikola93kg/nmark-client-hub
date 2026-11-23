import { notFound } from "next/navigation";
import { BackLink, Heading } from "@/components/record-ui";
import { ProviderForm } from "@/components/service-forms";
import { getProvider } from "@/lib/service-records";
import { idSchema } from "@/lib/validation";

export const metadata = { title: "Edit service provider" };

export default async function EditProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const provider = await getProvider(id);
  if (!provider) notFound();
  return (
    <>
      <BackLink href={`/service-accounts/providers/${id}`}>{provider.name}</BackLink>
      <Heading title="Edit service provider" />
      <ProviderForm provider={provider} />
    </>
  );
}
