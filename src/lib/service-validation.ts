import { z } from "zod";
import { idSchema, listFilters, type ListFilters, type QueryParams } from "./validation";

export const providerCategories = [
  "Hosting", "Deployment", "Domain Registrar", "DNS / CDN", "Email", "Transactional Email",
  "Source Control", "Database", "CMS", "Analytics", "Marketing", "Other",
] as const;

export const accountOwnership = {
  mine: "My account",
  client: "Client-owned account",
  shared: "Shared/managed account",
} as const;
const ownershipSchema = z.enum(["mine", "client", "shared"]);
export const accountStatuses = ["active", "archived"] as const;

const optional = (limit: number) => z.string().trim().max(limit).transform((value) => value || null);

function serviceUrl(value: string) {
  if (!/^https?:\/\/[^/@\\?#]+(?:\/|$)/i.test(value) || /[\s\p{Cc}\\?#]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function safeServiceUrl(value: string | null) {
  return value ? serviceUrl(value)?.href ?? null : null;
}

const optionalUrl = z.string().trim().max(2048)
  .refine((value) => !value || serviceUrl(value) !== null, "Enter a plain HTTP or HTTPS URL without credentials, query parameters or fragments.")
  .transform((value) => value || null);

export const vaultItemSchema = z.string().trim()
  .refine((value) => !value || idSchema.safeParse(value).success, "Enter the Vault item UUID.")
  .transform((value) => value ? value.toLowerCase() : null);

export function vaultItemUrl(base: string | undefined, itemId: string | null): string | null {
  if (!base || !itemId || !idSchema.safeParse(itemId).success) return null;
  const url = serviceUrl(base.trim());
  if (!url || url.pathname !== "/") return null;
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocal) return null;
  return new URL(`/item/${itemId.toLowerCase()}`, url).href;
}

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Enter a provider name.").max(160),
  category: z.enum(providerCategories),
  website_url: optionalUrl,
  dashboard_url: optionalUrl,
});

export const accountSchema = z.object({
  provider_id: z.uuid("Choose a service provider."),
  label: z.string().trim().min(1, "Enter an account label.").max(160),
  email: z.string().trim().max(254).pipe(z.union([z.literal(""), z.email("Enter a valid email address.")]))
    .transform((value) => value || null),
  username: optional(160),
  login_url: optionalUrl,
  vault_item_id: vaultItemSchema,
  ownership_type: ownershipSchema,
  notes: optional(10000),
});

export const associationSchema = z.object({
  service_account_id: z.uuid("Choose a service account."),
  purpose: z.string().trim().min(1, "Enter the purpose of this connection.").max(160),
  notes: optional(10000),
});

export type ProviderInput = z.output<typeof providerSchema>;
export type AccountInput = z.output<typeof accountSchema>;
export type AssociationInput = z.output<typeof associationSchema>;

export type AccountFilters = ListFilters<(typeof accountStatuses)[number]> & {
  provider: string;
  ownership: keyof typeof accountOwnership | "";
};

export function accountFilters(params: QueryParams): AccountFilters {
  return {
    ...listFilters(params, accountStatuses),
    q: typeof params.q === "string" ? params.q.replace(/\p{Cc}+/gu, " ").trim().slice(0, 120) : "",
    provider: idSchema.safeParse(params.provider).data ?? "",
    ownership: ownershipSchema.safeParse(params.ownership).data ?? "",
  };
}
