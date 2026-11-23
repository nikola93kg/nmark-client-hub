import { t } from "@/lib/localization";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/record-form";
import { BackLink, Heading } from "@/components/record-ui";
import { getClient } from "@/lib/records";
import { idSchema } from "@/lib/validation";

export const metadata = { title: t("Edit client") };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <>
      <BackLink href={`/clients/${id}`}>{client.name}</BackLink>
      <Heading title={t("Edit client")} />
      <ClientForm client={client} />
    </>
  );
}
