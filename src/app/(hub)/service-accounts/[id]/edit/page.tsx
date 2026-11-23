import { t } from "@/lib/localization";
import { notFound } from "next/navigation";
import { BackLink, Heading } from "@/components/record-ui";
import { AccountForm } from "@/components/service-forms";
import { getAccount, listProviders } from "@/lib/service-records";
import { idSchema } from "@/lib/validation";

export const metadata = { title: t("Edit service account") };

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [account, providers] = await Promise.all([getAccount(id), listProviders()]);
  if (!account) notFound();
  return (
    <>
      <BackLink href={`/service-accounts/${id}`}>{account.label}</BackLink>
      <Heading title={t("Edit service account")} />
      <AccountForm account={account} providers={providers} />
    </>
  );
}
