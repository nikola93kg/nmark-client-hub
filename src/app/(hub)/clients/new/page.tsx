import { ClientForm } from "@/components/record-form";
import { BackLink, Heading } from "@/components/record-ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Add client" };

export default async function NewClientPage() {
  await requireAdmin();
  return (
    <>
      <BackLink href="/clients">Clients</BackLink>
      <Heading title="Add client" description="Record a client’s details to start tracking their work." />
      <ClientForm />
    </>
  );
}
