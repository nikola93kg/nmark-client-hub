import { t } from "@/lib/localization";
import { z } from "zod";

z.config({ customError(issue) {
  switch (issue.code) {
    case "invalid_value": return t("Validation selection");
    case "invalid_type": return t("Validation type");
    case "too_big": return t("Validation too long", { limit: String(issue.maximum) });
    case "too_small": return t("Validation too short", { limit: String(issue.minimum) });
    case "invalid_format":
      switch (issue.format) {
        case "date": return t("Validation date");
        case "email": return t("Validation email");
        case "uuid": return t("Validation UUID");
        case "url": return t("Validation URL");
      }
      break;
  }
  return t("Validation invalid");
} });

export const clientStatuses = ["active", "prospect", "inactive", "archived"] as const;
export const projectStatuses = ["active", "development", "maintenance", "suspended", "archived"] as const;
export const idSchema = z.uuid();

const name = z.string().trim().min(1, t("Enter a name.")).max(160);
const optional = (limit: number) => z.string().trim().max(limit).transform((value) => value || null);
const url = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return !!parsed.hostname && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, t("Enter an HTTP or HTTPS URL without sign-in credentials.")).transform((value) => value || null);

const emailAddress = z.email();
export const optionalEmail = z.string().trim().max(254)
  .refine((value) => !value || emailAddress.safeParse(value).success, t("Enter a valid email address."))
  .transform((value) => value || null);

export const clientSchema = z.object({
  name,
  company: optional(160),
  contact_person: optional(160),
  email: optionalEmail,
  phone: optional(80),
  website: url,
  country: optional(120),
  city: optional(120),
  address: optional(300),
  status: z.enum(clientStatuses),
  notes: optional(10000),
});

export const projectSchema = z.object({
  client_id: idSchema,
  name,
  website: url,
  project_type: optional(120),
  description: optional(10000),
  status: z.enum(projectStatuses),
  technology_stack: optional(300),
  repository_url: url,
  cms_url: url,
  production_url: url,
  staging_url: url,
  technical_notes: optional(10000),
});

export type ClientInput = z.output<typeof clientSchema>;
export type ProjectInput = z.output<typeof projectSchema>;

export const sorts = ["updated", "name", "name-desc", "created"] as const;
export const pageSize = 10;
const pageSchema = z.coerce.number().int().min(1).max(100_000);

export type ListFilters<Status extends string = string> = {
  q: string;
  status: Status | "";
  sort: (typeof sorts)[number];
  page: number;
};

export type QueryParams = Record<string, string | string[] | undefined>;

export function listFilters<Status extends string>(
  params: QueryParams, statuses: readonly Status[],
): ListFilters<Status> {
  return {
    q: typeof params.q === "string" ? params.q.replace(/[%_*\\]/g, " ").trim().slice(0, 120) : "",
    status: statuses.find((status) => status === params.status) ?? "",
    sort: z.enum(sorts).safeParse(params.sort).data ?? "updated",
    page: pageSchema.safeParse(typeof params.page === "string" ? params.page : undefined).data ?? 1,
  };
}
