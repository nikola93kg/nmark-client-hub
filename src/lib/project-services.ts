import { z } from "zod";
import { t, type Message } from "./localization";
import { idSchema, optionalEmail } from "./validation";
import type { ProviderInput } from "./service-validation";

const purposes = {
  hosting: ["Service purpose hosting", "Website hosting", "Hosting"],
  registrar: ["Service purpose registrar", "Domain registrar", "Domain Registrar"],
  dns: ["Service purpose DNS", "DNS / CDN", "DNS / CDN"],
  mailbox: ["Service purpose mailbox", "Email hosting", "Email"],
  contact_form: ["Service purpose contact form", "Contact form", "Other"],
  transactional_email: ["Service purpose transactional email", "Transactional email", "Transactional Email"],
  analytics: ["Service purpose analytics", "Analytics", "Analytics"],
  search_console: ["Service purpose search console", "Search Console", "Analytics"],
  source_control: ["Service purpose source control", "Source control", "Source Control"],
  deployment: ["Service purpose deployment", "Website deployment", "Deployment"],
  database: ["Service purpose database", "Database", "Database"],
  cms: ["Service purpose CMS", "CMS", "CMS"],
  other: ["Service purpose other", "Other", "Other"],
} as const satisfies Record<string, readonly [Message, string, ProviderInput["category"]]>;

export type ServiceKind = keyof typeof purposes;
const kinds = Object.keys(purposes) as ServiceKind[];

export const servicePurposeOptions = kinds.map((value) => ({ value, label: t(purposes[value][0]) }));
export const purposeCategory = (kind: ServiceKind) => purposes[kind][2];
export const isMailPurpose = (kind: ServiceKind) => kind === "mailbox" || kind === "contact_form" || kind === "transactional_email";

export function serviceKindFor(value: ServiceKind | null | undefined, legacyPurpose: string) {
  if (value) return value;
  const legacy = legacyPurpose.trim().toLowerCase();
  if (legacy === "project email" || legacy === "mailbox") return "mailbox";
  if (legacy === "web hosting" || legacy === "hosting") return "hosting";
  return kinds.find((kind) => purposes[kind][1].toLowerCase() === legacy) ?? "other";
}

export function servicePurposeLabel(kind: ServiceKind | null | undefined, legacyPurpose: string) {
  const effective = serviceKindFor(kind, legacyPurpose);
  return effective === "other" && legacyPurpose.toLowerCase() !== "other" ? legacyPurpose : t(purposes[effective][0]);
}

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
export const guidedServiceSchema = z.object({
  service_kind: z.enum(kinds, t("Choose a service purpose.")),
  provider_id: z.uuid(t("Choose a service provider.")),
  service_account_id: z.union([idSchema, z.literal("")]).transform((value) => value || null),
  custom_purpose: optionalText(160),
  destination_email: optionalEmail,
  routing_notes: optionalText(2000),
  notes: optionalText(10000),
}).refine(({ service_kind, destination_email, routing_notes }) =>
  isMailPurpose(service_kind) || (!destination_email && !routing_notes), {
  path: ["destination_email"], message: t("Email routing is only available for email or contact form services."),
}).transform(({ custom_purpose, ...input }) => ({
  ...input, purpose: (input.service_kind === "other" && custom_purpose) || purposes[input.service_kind][1],
}));

export type GuidedServiceInput = z.output<typeof guidedServiceSchema>;
