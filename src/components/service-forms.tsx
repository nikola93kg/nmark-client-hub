"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { saveServiceAccount, saveServiceProvider } from "@/app/(hub)/service-actions";
import type { ServiceAccount, ServiceProvider } from "@/lib/database";
import { accountOwnership, accountSchema, providerCategories, providerSchema } from "@/lib/service-validation";
import { RecordForm, type FieldGroup } from "./record-form";

type ProviderValues = z.input<typeof providerSchema>;
type AccountValues = z.input<typeof accountSchema>;

const providerGroups: FieldGroup<ProviderValues>[] = [{ title: "Provider information", fields: [
  { name: "name", label: "Provider name", maxLength: 160 },
  { name: "category", label: "Category", options: providerCategories.map((value) => ({ value, label: value })) },
  { name: "website_url", label: "Website URL", kind: "url", optional: true, maxLength: 2048 },
  { name: "dashboard_url", label: "Dashboard URL", kind: "url", optional: true, maxLength: 2048 },
] }];

export function ProviderForm({ provider }: { provider?: ServiceProvider }) {
  const values: ProviderValues = {
    name: provider?.name ?? "", category: provider?.category ?? "Other",
    website_url: provider?.website_url ?? "", dashboard_url: provider?.dashboard_url ?? "",
  };
  return <RecordForm onSave={(input) => saveServiceProvider(provider?.id, input)} submitLabel="Save provider"
    groups={providerGroups} defaultValues={values} resolver={zodResolver(providerSchema, undefined, { raw: true })}
    cancelUrl={provider ? `/service-accounts/providers/${provider.id}` : "/service-accounts/providers"} />;
}

export function AccountForm({ account, providers }: { account?: ServiceAccount; providers: Pick<ServiceProvider, "id" | "name">[] }) {
  const groups: FieldGroup<AccountValues>[] = [
    { title: "Account information", fields: [
      { name: "label", label: "Account label", maxLength: 160 },
      { name: "provider_id", label: "Provider", options: providers.map(({ id, name }) => ({ value: id, label: name })) },
      { name: "ownership_type", label: "Ownership", options: Object.entries(accountOwnership).map(([value, label]) => ({ value, label })) },
      { name: "email", label: "Email", kind: "email", optional: true, maxLength: 254 },
      { name: "username", label: "Username", optional: true, maxLength: 160 },
      { name: "login_url", label: "Login URL", kind: "url", optional: true, maxLength: 2048,
        hint: "Use the service’s sign-in page URL without query parameters or fragments." },
    ] },
    { title: "Pass Vault and notes", fields: [
      { name: "vault_item_id", label: "Vault item UUID", optional: true, maxLength: 36,
        hint: "Copy the Stable Vault Item ID from the entry in Pass Vault." },
      { name: "notes", label: "Notes", kind: "textarea", optional: true, wide: true, maxLength: 10000,
        hint: "Keep passwords, API keys, recovery codes and tokens in Pass Vault." },
    ] },
  ];
  const values: AccountValues = {
    label: account?.label ?? "", provider_id: account?.provider_id ?? "", ownership_type: account?.ownership_type ?? "mine",
    email: account?.email ?? "", username: account?.username ?? "", login_url: account?.login_url ?? "",
    vault_item_id: account?.vault_item_id ?? "", notes: account?.notes ?? "",
  };
  return <RecordForm onSave={(input) => saveServiceAccount(account?.id, input)} submitLabel="Save account"
    groups={groups} defaultValues={values} resolver={zodResolver(accountSchema, undefined, { raw: true })}
    cancelUrl={account ? `/service-accounts/${account.id}` : "/service-accounts"} />;
}
