import { BackLink, Heading } from "@/components/record-ui";
import { ProviderForm } from "@/components/service-forms";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Add service provider" };

export default async function NewProviderPage() {
  await requireAdmin();
  return (
    <>
      <BackLink href="/service-accounts/providers">Service Providers</BackLink>
      <Heading title="Add service provider" />
      <ProviderForm />
    </>
  );
}
