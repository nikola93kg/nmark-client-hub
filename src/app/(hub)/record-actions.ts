"use server";

import { t } from "@/lib/localization";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { changeRecord, saveClient, saveProject } from "@/lib/records";
import { clientSchema, idSchema, projectSchema } from "@/lib/validation";

const collections = z.enum(["clients", "projects"]);

export async function saveRecord(collection: string, id: string | undefined, values: unknown) {
  await requireAdmin();
  const target = collections.safeParse(collection);
  if (!target.success || (id !== undefined && !idSchema.safeParse(id).success)) {
    return { error: t("Invalid record.") };
  }

  let result;
  if (target.data === "clients") {
    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("Review the client details.") };
    result = await saveClient(id, parsed.data);
  } else {
    const parsed = projectSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("Review the project details.") };
    result = await saveProject(id, parsed.data);
  }

  if ("error" in result) return { error: result.error ?? t("Could not save the record.") };
  revalidatePath("/", "layout");
  redirect(`/${target.data}/${result.id}`);
}

export async function manageRecord(collection: string, id: string, action: string) {
  await requireAdmin();
  const target = collections.safeParse(collection);
  const operation = z.enum(["archive", "delete"]).safeParse(action);
  if (!target.success || !idSchema.safeParse(id).success || !operation.success) return { error: t("Invalid record or action.") };

  const result = await changeRecord(target.data, id, operation.data);
  if (result.error) return { error: result.error };
  revalidatePath("/", "layout");
  if (operation.data === "delete") redirect(`/${target.data}`);
  return {};
}
