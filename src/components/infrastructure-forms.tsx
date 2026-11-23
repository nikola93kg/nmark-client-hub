"use client";

import { optionLabel, t } from "@/lib/localization";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Trash2 } from "lucide-react";
import type { z } from "zod";
import { manageInfrastructure, saveAssetRenewal, saveInfrastructure } from "@/app/(hub)/infrastructure-actions";
import type { Domain, Hosting } from "@/lib/database";
import {
  billingCycles, domainSchema, domainStatuses, hostingSchema, hostingStatuses, hostingTypes, paymentStatuses,
  renewalSchema, responsibilityLabels, type AssetKind,
} from "@/lib/infrastructure-validation";
import { RecordForm, type FieldGroup } from "./record-form";
import { ConfirmAction } from "./service-controls";
import { Button } from "./ui/button";

type DomainValues = z.input<typeof domainSchema>;
type HostingValues = z.input<typeof hostingSchema>;
type RenewalValues = z.input<typeof renewalSchema>;
type Options = {
  projects: { id: string; name: string }[];
  accounts: { id: string; label: string; provider: string; archived_at: string | null }[];
};

const options = (values: readonly string[]) => values.map((value) => ({ value, label: optionLabel(value) }));
const projectChoices = (projects: Options["projects"]) => projects.map(({ id, name }) => ({ value: id, label: name }));
const accountChoices = (accounts: Options["accounts"]) =>
  accounts.map(({ id, label, provider, archived_at }) => ({
    value: id, label: `${archived_at ? t("{name} (archived)", { name: label }) : label} · ${provider}`,
  }));
const owners = Object.entries(responsibilityLabels).map(([value, label]) => ({ value, label }));

const priceAndResponsibility = [
  { name: "renewal_price", label: t("Expected renewal price"), optional: true, inputMode: "decimal", maxLength: 13 },
  { name: "currency", label: t("Currency"), optional: true, maxLength: 3, hint: t("Three-letter code, such as EUR, USD or RSD.") },
  { name: "auto_renew", label: t("Auto-renew"), options: options(["yes", "no"]) },
  { name: "renewal_responsibility", label: t("Renewal responsibility"), options: owners },
] as const;

export function DomainForm({ row, choices, projectId, accountId }: { row?: Domain; choices: Options; projectId?: string; accountId?: string }) {
  const groups: FieldGroup<DomainValues>[] = [
    { title: t("Domain information"), fields: [
      { name: "name", label: t("Domain name"), maxLength: 254, hint: t("Enter the hostname, for example example.com.") },
      { name: "project_id", label: t("Project"), options: projectChoices(choices.projects) },
      { name: "registrar_account_id", label: t("Registrar account"), optional: true, emptyLabel: t("No registrar account"),
        options: accountChoices(choices.accounts) },
      { name: "status", label: t("Status"), options: options(domainStatuses) },
      { name: "registered_on", label: t("Registration date"), kind: "date", optional: true },
      { name: "expires_on", label: t("Expiration date"), kind: "date", optional: true },
    ] },
    { title: t("Renewal and notes"), fields: [
      ...priceAndResponsibility,
      { name: "notes", label: t("Notes"), kind: "textarea", optional: true, wide: true, maxLength: 10000 },
    ] },
  ];
  const values: DomainValues = {
    name: row?.name ?? "", project_id: row?.project_id ?? projectId ?? "", registrar_account_id: row?.registrar_account_id ?? accountId ?? "",
    registered_on: row?.registered_on ?? "", expires_on: row?.expires_on ?? "", status: row?.status ?? "active",
    renewal_price: row?.renewal_price?.toString() ?? "", currency: row?.currency ?? "",
    auto_renew: row?.auto_renew ? "yes" : "no", renewal_responsibility: row?.renewal_responsibility ?? "",
    notes: row?.notes ?? "",
  };
  return <RecordForm onSave={(value) => saveInfrastructure("domains", row?.id, value)} submitLabel={t("Save domain")}
    groups={groups} defaultValues={values} resolver={zodResolver(domainSchema, undefined, { raw: true })}
    cancelUrl={row ? `/domains/${row.id}` : projectId ? `/projects/${projectId}` : "/domains"} />;
}

export function HostingForm({ row, choices, projectId, accountId }: { row?: Hosting; choices: Options; projectId?: string; accountId?: string }) {
  const groups: FieldGroup<HostingValues>[] = [
    { title: t("Hosting information"), fields: [
      { name: "project_id", label: t("Project"), options: projectChoices(choices.projects) },
      { name: "hosting_account_id", label: t("Hosting account"), options: accountChoices(choices.accounts),
        hint: t("The provider comes from the selected service account.") },
      { name: "hosting_type", label: t("Hosting type"), options: options(hostingTypes) },
      { name: "plan_name", label: t("Hosting plan"), optional: true, maxLength: 160 },
      { name: "billing_cycle", label: t("Billing cycle"), options: options(billingCycles) },
      { name: "status", label: t("Status"), options: options(hostingStatuses) },
      { name: "server_notes", label: t("Server or location notes"), kind: "textarea", optional: true, wide: true, maxLength: 10000 },
    ] },
    { title: t("Renewal and notes"), fields: [
      { name: "renews_on", label: t("Renewal date"), kind: "date", optional: true },
      ...priceAndResponsibility,
      { name: "notes", label: t("Notes"), kind: "textarea", optional: true, wide: true, maxLength: 10000 },
    ] },
  ];
  const values: HostingValues = {
    project_id: row?.project_id ?? projectId ?? "", hosting_account_id: row?.hosting_account_id ?? accountId ?? "",
    hosting_type: row?.hosting_type ?? "Shared Hosting", plan_name: row?.plan_name ?? "", status: row?.status ?? "active",
    server_notes: row?.server_notes ?? "", billing_cycle: row?.billing_cycle ?? "", renews_on: row?.renews_on ?? "",
    renewal_price: row?.renewal_price?.toString() ?? "", currency: row?.currency ?? "",
    auto_renew: row?.auto_renew ? "yes" : "no", renewal_responsibility: row?.renewal_responsibility ?? "",
    notes: row?.notes ?? "",
  };
  return <RecordForm onSave={(value) => saveInfrastructure("hosting", row?.id, value)} submitLabel={t("Save hosting service")}
    groups={groups} defaultValues={values} resolver={zodResolver(hostingSchema, undefined, { raw: true })}
    cancelUrl={row ? `/hosting/${row.id}` : projectId ? `/projects/${projectId}` : "/hosting"} />;
}

const renewalGroups: FieldGroup<RenewalValues>[] = [
  { title: t("Renewal information"), fields: [
    { name: "renewed_on", label: t("Renewal date"), kind: "date" },
    { name: "next_renewal_on", label: t("Next renewal date"), kind: "date", optional: true,
      hint: t("Leave blank to keep the current schedule.") },
    { name: "period_start", label: t("Covered period start"), kind: "date", optional: true },
    { name: "period_end", label: t("Covered period end"), kind: "date", optional: true },
  ] },
  { title: t("Payment and notes"), fields: [
    { name: "payment_status", label: t("Payment status"), options: options(paymentStatuses) },
    { name: "paid_amount", label: t("Paid amount"), inputMode: "decimal", optional: true, maxLength: 13 },
    { name: "currency", label: t("Currency"), optional: true, maxLength: 3 },
    { name: "paid_on", label: t("Payment date"), kind: "date", optional: true },
    { name: "notes", label: t("Notes"), kind: "textarea", optional: true, wide: true, maxLength: 10000 },
  ] },
];

export function RenewalForm({ kind, id, eventId, today, currency }: {
  kind: AssetKind; id: string; eventId: string; today: string; currency: string | null;
}) {
  const values: RenewalValues = {
    renewed_on: today, next_renewal_on: "", period_start: "", period_end: "", payment_status: "unpaid",
    paid_amount: "", currency: currency ?? "", paid_on: "", notes: "",
  };
  return <RecordForm onSave={(value) => saveAssetRenewal(kind, id, eventId, value)} submitLabel={t("Record renewal")}
    groups={renewalGroups} defaultValues={values} resolver={zodResolver(renewalSchema, undefined, { raw: true })}
    cancelUrl={`/${kind}/${id}`} />;
}

export function AssetControls({ kind, id, name, archived }: { kind: AssetKind; id: string; name: string; archived: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <div className="record-menu">
        {!archived && <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
          setError((await manageInfrastructure(kind, id, "archive")).error);
        })}><Archive size={16} aria-hidden /> {pending ? t("Archiving…") : t("Archive")}</Button>}
        <ConfirmAction title={t("Delete {name}?", { name })} description={t("Archive this record to keep it available. Records with renewal history must be kept.")}
          confirm={kind === "domains" ? t("Delete domain") : t("Delete hosting service")} action={() => manageInfrastructure(kind, id, "delete")}
          trigger={<Button type="button" variant="outline" disabled={pending}><Trash2 size={16} aria-hidden /> {t("Delete")}</Button>} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
