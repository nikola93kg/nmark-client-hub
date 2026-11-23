"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { t } from "@/lib/localization";
import { guidedServiceSchema } from "@/lib/project-services";
import { getAccount, linkProjectAccount, saveAccount, saveProvider } from "@/lib/service-records";
import { accountSchema, providerSchema } from "@/lib/service-validation";
import { idSchema } from "@/lib/validation";

type CreateResult = { id: string } | { error: string };

export async function createProjectServiceProvider(values: unknown): Promise<CreateResult> {
  await requireAdmin();
  const parsed = providerSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await saveProvider(undefined, parsed.data);
  if ("id" in result && result.id) {
    revalidatePath("/", "layout");
    return { id: result.id };
  }
  return { error: "error" in result ? result.error ?? t("Could not save the record.") : t("Could not save the record.") };
}

export async function createProjectServiceAccount(values: unknown): Promise<CreateResult> {
  await requireAdmin();
  const parsed = accountSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await saveAccount(undefined, parsed.data);
  if ("id" in result && result.id) {
    revalidatePath("/", "layout");
    return { id: result.id };
  }
  return { error: "error" in result ? result.error ?? t("Could not save the record.") : t("Could not save the record.") };
}

export async function saveProjectService(projectId: string, values: unknown) {
  await requireAdmin();
  if (!idSchema.safeParse(projectId).success) return { error: t("Invalid project.") };
  const parsed = guidedServiceSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { provider_id, service_account_id, ...details } = parsed.data;
  if (service_account_id) {
    const account = await getAccount(service_account_id);
    if (!account || account.archived_at || account.provider_id !== provider_id) {
      return { error: t("The selected account does not belong to this provider.") };
    }
  }
  const result = await linkProjectAccount(projectId, {
    ...details, service_account_id, provider_id: service_account_id ? null : provider_id,
  });
  if (!result.error) revalidatePath("/", "layout");
  return result;
}
