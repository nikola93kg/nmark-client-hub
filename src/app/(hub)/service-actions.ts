"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { changeAccount, deleteProvider, linkProjectAccount, saveAccount, saveProvider, unlinkProjectAccount } from "@/lib/service-records";
import { accountSchema, associationSchema, providerSchema } from "@/lib/service-validation";
import { idSchema } from "@/lib/validation";

export async function saveServiceProvider(id: string | undefined, values: unknown) {
  await requireAdmin();
  if (id !== undefined && !idSchema.safeParse(id).success) return { error: "Invalid provider." };
  const parsed = providerSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await saveProvider(id, parsed.data);
  if ("error" in result) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(`/service-accounts/providers/${result.id}?saved=1`);
}

export async function removeServiceProvider(id: string) {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { error: "Invalid provider." };
  const result = await deleteProvider(id);
  if (result.error) return result;
  revalidatePath("/", "layout");
  redirect("/service-accounts/providers?deleted=1");
}

export async function saveServiceAccount(id: string | undefined, values: unknown) {
  await requireAdmin();
  if (id !== undefined && !idSchema.safeParse(id).success) return { error: "Invalid account." };
  const parsed = accountSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await saveAccount(id, parsed.data);
  if ("error" in result) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(`/service-accounts/${result.id}?saved=1`);
}

export async function manageServiceAccount(id: string, operation: unknown) {
  await requireAdmin();
  const action = z.enum(["archive", "restore", "delete"]).safeParse(operation);
  if (!idSchema.safeParse(id).success || !action.success) return { error: "Invalid account or action." };
  const result = await changeAccount(id, action.data);
  if (result.error) return result;
  revalidatePath("/", "layout");
  if (action.data === "delete") redirect("/service-accounts?deleted=1");
  return {};
}

export async function addProjectAccount(projectId: string, values: unknown) {
  await requireAdmin();
  if (!idSchema.safeParse(projectId).success) return { error: "Invalid project." };
  const parsed = associationSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const result = await linkProjectAccount(projectId, parsed.data);
  if (!result.error) revalidatePath("/", "layout");
  return result;
}

export async function removeProjectAccount(projectId: string, associationId: string) {
  await requireAdmin();
  if (!idSchema.safeParse(projectId).success || !idSchema.safeParse(associationId).success) {
    return { error: "Invalid account connection." };
  }
  const result = await unlinkProjectAccount(projectId, associationId);
  if (!result.error) revalidatePath("/", "layout");
  return result;
}
