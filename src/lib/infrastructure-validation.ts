import { z } from "zod";
import { idSchema, listFilters, type QueryParams } from "./validation";

export const domainStatuses = ["active", "pending", "expired", "inactive", "archived"] as const;
export const hostingStatuses = ["active", "pending", "suspended", "inactive", "archived"] as const;
export const hostingTypes = ["Shared Hosting", "VPS", "Cloud Hosting", "Managed WordPress", "Serverless", "Static Hosting", "Dedicated Server", "Other"] as const;
export const billingCycles = ["Monthly", "Quarterly", "Semiannual", "Annual", "Custom"] as const;
export const responsibilityLabels = { nmark: "NMark Designs", client: "Client", other: "Other" } as const;
export const paymentStatuses = ["unpaid", "pending", "paid"] as const;
export const assetKinds = ["domains", "hosting"] as const;

export type AssetKind = (typeof assetKinds)[number];
export type Responsibility = keyof typeof responsibilityLabels;

const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const calendarDate = z.iso.date("Enter a valid calendar date.").refine((value) => !value.startsWith("0000"), "Enter a valid calendar year.");
const date = z.union([z.literal(""), calendarDate]).transform((value) => value || null);
const currency = z.string().trim().toUpperCase().refine((value) => !value || /^[A-Z]{3}$/.test(value), "Enter a three-letter currency code.").transform((value) => value || null);
const money = z.string().trim()
  .refine((value) => !value || /^\d{1,10}(?:[.,]\d{1,2})?$/.test(value), "Enter a non-negative amount with up to two decimal places.")
  .transform((value) => value ? Number(value.replace(",", ".")) : null);
const responsibility = z.string().pipe(z.enum(["nmark", "client", "other"], "Choose who handles renewals."));

export function canonicalDomain(value: string): string | null {
  const input = value.trim().replace(/\.$/, "");
  if (!/^[\p{L}\p{N}\p{M}.-]+$/u.test(input)) return null;
  try {
    const name = new URL("https://" + input).hostname;
    const labels = name.split(".");
    if (name.length > 253 || labels.length < 2 || !/^[a-z]/.test(labels.at(-1)!)) return null;
    return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ? name : null;
  } catch {
    return null;
  }
}

const renewalFields = {
  project_id: z.uuid("Choose a project."),
  renewal_price: money,
  currency,
  auto_renew: z.enum(["yes", "no"]).transform((value) => value === "yes"),
  renewal_responsibility: responsibility,
  notes: optional(10000),
};

export const domainSchema = z.object({
  ...renewalFields,
  name: z.string().trim().max(254).transform((value, context) => {
    const name = canonicalDomain(value);
    if (name) return name;
    context.issues.push({ code: "custom", message: "Enter a domain name without a URL, such as example.com.", input: value });
    return z.NEVER;
  }),
  registrar_account_id: z.union([z.literal(""), idSchema]).transform((value) => value || null),
  registered_on: date,
  expires_on: date,
  status: z.enum(domainStatuses),
}).refine((value) => value.renewal_price === null || value.currency !== null, {
  path: ["currency"], message: "Enter a currency for the renewal price.",
}).refine((value) => !value.registered_on || !value.expires_on || value.registered_on <= value.expires_on, {
  path: ["expires_on"], message: "Expiration must be on or after registration.",
});

export const hostingSchema = z.object({
  ...renewalFields,
  hosting_account_id: z.uuid("Choose a hosting account."),
  hosting_type: z.enum(hostingTypes),
  plan_name: optional(160),
  server_notes: optional(10000),
  billing_cycle: z.string().pipe(z.enum(billingCycles, "Choose a billing cycle.")),
  renews_on: date,
  status: z.enum(hostingStatuses),
}).refine((value) => value.renewal_price === null || value.currency !== null, {
  path: ["currency"], message: "Enter a currency for the renewal price.",
});

export const renewalSchema = z.object({
  renewed_on: calendarDate,
  period_start: date,
  period_end: date,
  paid_amount: money,
  currency,
  paid_on: date,
  payment_status: z.enum(paymentStatuses),
  next_renewal_on: date,
  notes: optional(10000),
}).refine((value) => !value.period_start || !value.period_end || value.period_start <= value.period_end, {
  path: ["period_end"], message: "The covered period cannot end before it starts.",
}).refine((value) => value.paid_amount === null || value.currency !== null, {
  path: ["currency"], message: "Enter a currency for the payment amount.",
}).refine((value) => value.payment_status !== "paid" || value.paid_amount !== null, {
  path: ["paid_amount"], message: "Enter the paid amount for a paid renewal.",
}).refine((value) => !value.paid_on || value.payment_status === "paid", {
  path: ["paid_on"], message: "Set the payment status to Paid to record a payment date.",
}).refine((value) => !value.next_renewal_on || value.next_renewal_on > value.renewed_on, {
  path: ["next_renewal_on"], message: "The next renewal date must be after the renewal event.",
});

export type DomainInput = z.output<typeof domainSchema>;
export type HostingInput = z.output<typeof hostingSchema>;
export type RenewalInput = z.output<typeof renewalSchema>;

export function assetFilters(params: QueryParams, kind: AssetKind) {
  return {
    ...listFilters(params, kind === "domains" ? domainStatuses : hostingStatuses),
    q: typeof params.q === "string" ? params.q.replace(/\p{Cc}+/gu, " ").trim().slice(0, 120) : "",
    project: idSchema.safeParse(params.project).data ?? "",
  };
}

export type AssetFilters = ReturnType<typeof assetFilters>;
