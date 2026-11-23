"use client";

import { optionLabel, t } from "@/lib/localization";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { saveServiceAccount, saveServiceProvider } from "@/app/(hub)/service-actions";
import type { ServiceAccount, ServiceProvider } from "@/lib/database";
import { accountOwnership, accountSchema, providerCategories, providerSchema } from "@/lib/service-validation";
import { RecordForm, type FieldGroup } from "./record-form";

type ProviderValues = z.input<typeof providerSchema>;
type AccountValues = z.input<typeof accountSchema>;

const providerGroups: FieldGroup<ProviderValues>[] = [{ title: t("Provider information"), fields: [
  { name: "name", label: t("Provider name"), maxLength: 160 },
  { name: "category", label: t("Category"), options: providerCategories.map((value) => ({ value, label: optionLabel(value) })) },
  { name: "website_url", label: t("Website URL"), kind: "url", optional: true, maxLength: 2048 },
  { name: "dashboard_url", label: t("Dashboard URL"), kind: "url", optional: true, maxLength: 2048 },
] }];

export function ProviderForm({ provider }: { provider?: ServiceProvider }) {
  const values: ProviderValues = {
    name: provider?.name ?? "", category: provider?.category ?? "Other",
    website_url: provider?.website_url ?? "", dashboard_url: provider?.dashboard_url ?? "",
  };
  return <RecordForm onSave={(input) => saveServiceProvider(provider?.id, input)} submitLabel={t("Save provider")}
    groups={providerGroups} defaultValues={values} resolver={zodResolver(providerSchema, undefined, { raw: true })}
    cancelUrl={provider ? `/service-accounts/providers/${provider.id}` : "/service-accounts/providers"} />;
}

export function AccountForm({ account, providers }: { account?: ServiceAccount; providers: Pick<ServiceProvider, "id" | "name">[] }) {
  const groups: FieldGroup<AccountValues>[] = [
    { title: t("Account information"), fields: [
      { name: "label", label: t("Account label"), maxLength: 160 },
      { name: "provider_id", label: t("Provider"), options: providers.map(({ id, name }) => ({ value: id, label: name })) },
      { name: "ownership_type", label: t("Ownership"), options: Object.entries(accountOwnership).map(([value]) => ({ value, label: optionLabel(value) })) },
      { name: "email", label: t("Sign-in email"), kind: "email", optional: true, maxLength: 254 },
      { name: "username", label: t("Username"), optional: true, maxLength: 160 },
      { name: "login_url", label: t("Login URL"), kind: "url", optional: true, maxLength: 2048,
        hint: t("Use the service’s sign-in page URL without query parameters or fragments.") },
    ] },
    { title: t("Pass Vault and notes"), fields: [
      { name: "vault_item_id", label: t("Vault item UUID"), optional: true, maxLength: 36,
        hint: t("Copy the Stable Vault Item ID from the entry in Pass Vault.") },
      { name: "notes", label: t("Notes"), kind: "textarea", optional: true, wide: true, maxLength: 10000,
        hint: t("Keep passwords, API keys, recovery codes and tokens in Pass Vault.") },
    ] },
  ];
  const values: AccountValues = {
    label: account?.label ?? "", provider_id: account?.provider_id ?? "", ownership_type: account?.ownership_type ?? "mine",
    email: account?.email ?? "", username: account?.username ?? "", login_url: account?.login_url ?? "",
    vault_item_id: account?.vault_item_id ?? "", notes: account?.notes ?? "",
  };
  return <RecordForm onSave={(input) => saveServiceAccount(account?.id, input)} submitLabel={t("Save account")}
    groups={groups} defaultValues={values} resolver={zodResolver(accountSchema, undefined, { raw: true })}
    cancelUrl={account ? `/service-accounts/${account.id}` : "/service-accounts"} />;
}
