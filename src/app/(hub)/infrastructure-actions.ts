"use server";

import { t } from "@/lib/localization";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { addRenewal, changeAsset, saveDomain, saveHosting } from "@/lib/infrastructure-records";
import { assetKinds, domainSchema, hostingSchema, renewalSchema } from "@/lib/infrastructure-validation";
import { idSchema } from "@/lib/validation";

const kinds = z.enum(assetKinds);

export async function saveInfrastructure(kind: unknown, id: string | undefined, values: unknown) {
  await requireAdmin();
  const target = kinds.safeParse(kind);
  if (!target.success || (id !== undefined && !idSchema.safeParse(id).success)) return { error: t("Invalid record.") };
  const result = target.data === "domains"
    ? await parseAndSave(domainSchema, saveDomain, id, values)
    : await parseAndSave(hostingSchema, saveHosting, id, values);
  if ("error" in result) return result;
  revalidatePath("/", "layout");
  redirect(`/${target.data}/${result.id}?saved=1`);
}

async function parseAndSave<T>(
  schema: z.ZodType<T>,
  persist: (id: string | undefined, input: T) => Promise<{ id: string } | { error: string }>,
  id: string | undefined,
  values: unknown,
) {
  const parsed = schema.safeParse(values);
  return parsed.success ? persist(id, parsed.data) : { error: parsed.error.issues[0].message };
}

export async function manageInfrastructure(kind: unknown, id: string, operation: unknown): Promise<{ error?: string }> {
  await requireAdmin();
  const target = kinds.safeParse(kind);
  const action = z.enum(["archive", "delete"]).safeParse(operation);
  if (!target.success || !idSchema.safeParse(id).success || !action.success) return { error: t("Invalid record or action.") };
  const result = await changeAsset(target.data, id, action.data);
  if (result.error) return result;
  revalidatePath("/", "layout");
  if (action.data === "delete") redirect(`/${target.data}?deleted=1`);
  return {};
}

export async function saveAssetRenewal(kind: unknown, id: string, eventId: string, values: unknown) {
  await requireAdmin();
  const target = kinds.safeParse(kind);
  if (!target.success || !idSchema.safeParse(id).success || !idSchema.safeParse(eventId).success) return { error: t("Invalid renewal target.") };
  const parsed = renewalSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await addRenewal(target.data, id, eventId, parsed.data);
  if (result.error) return result;
  revalidatePath("/", "layout");
  redirect(`/${target.data}/${id}?renewed=1`);
}
