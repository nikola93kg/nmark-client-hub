"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProjectServiceAccount, createProjectServiceProvider, saveProjectService } from "@/app/(hub)/project-service-actions";
import { optionLabel, t } from "@/lib/localization";
import { isMailPurpose, purposeCategory, servicePurposeOptions, type ServiceKind } from "@/lib/project-services";
import { accountOwnership } from "@/lib/service-validation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Provider = { id: string; name: string };
type Account = { id: string; label: string; provider_id: string };

export function ProjectServiceWizard({ projectId, providers: availableProviders, accounts: availableAccounts, initialKind }: {
  projectId: string; providers: Provider[]; accounts: Account[]; initialKind?: ServiceKind;
}) {
  const router = useRouter();
  const [providers, setProviders] = useState(availableProviders);
  const [accounts, setAccounts] = useState(availableAccounts);
  const [kind, setKind] = useState<ServiceKind | "">(initialKind ?? "");
  const [providerId, setProviderId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [editor, setEditor] = useState<"provider" | "account" | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [providerName, setProviderName] = useState("");
  const [providerDashboard, setProviderDashboard] = useState("");
  const [accountDraft, setAccountDraft] = useState({ label: "", ownership_type: "mine", email: "", username: "", login_url: "", vault_item_id: "" });
  const projectPath = `/projects/${projectId}`;

  function chooseProvider(value: string) {
    setProviderId(value);
    setAccountId("");
    setEditor(null);
    setError(undefined);
  }

  function saveProvider() {
    if (!kind) return;
    setError(undefined);
    startTransition(async () => {
      const result = await createProjectServiceProvider({ name: providerName, category: purposeCategory(kind), website_url: "", dashboard_url: providerDashboard });
      if ("error" in result) return setError(result.error);
      setProviders((current) => [...current, { id: result.id, name: providerName.trim() }]);
      setProviderName("");
      setProviderDashboard("");
      chooseProvider(result.id);
    });
  }

  function saveAccount() {
    setError(undefined);
    startTransition(async () => {
      const result = await createProjectServiceAccount({ ...accountDraft, provider_id: providerId, notes: "" });
      if ("error" in result) return setError(result.error);
      setAccounts((current) => [...current, { id: result.id, label: accountDraft.label.trim(), provider_id: providerId }]);
      setAccountId(result.id);
      setAccountDraft({ label: "", ownership_type: "mine", email: "", username: "", login_url: "", vault_item_id: "" });
      setEditor(null);
    });
  }

  function linkService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor || !kind || !providerId) return;
    const fields = new FormData(event.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const result = await saveProjectService(projectId, {
        service_kind: kind, provider_id: providerId, service_account_id: accountId,
        custom_purpose: fields.get("custom_purpose") ?? "", notes: fields.get("notes") ?? "",
        destination_email: fields.get("destination_email") ?? "", routing_notes: fields.get("routing_notes") ?? "",
      });
      if (result.error) return setError(result.error);
      router.push(projectPath + "?service=1");
    });
  }

  return (
    <form className="record-form" noValidate onSubmit={linkService}>
      <fieldset className="panel form-panel" disabled={pending}>
        <div className="panel-heading"><h2>{t("Service purpose")}</h2></div>
        <div className="form-grid">
          <label className="field">
            <span>{t("Service purpose")}</span>
            <select aria-label={t("Service purpose")} className="field-control" value={kind} onChange={(event) => {
              setKind(event.target.value as ServiceKind | ""); setError(undefined);
            }} required>
              <option value="">{t("Choose a purpose")}</option>
              {servicePurposeOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      {kind && <fieldset className="panel form-panel" disabled={pending}>
        <div className="panel-heading"><h2>{t("Provider")}</h2></div>
        <div className="form-grid">
          <label className="field">
            <span>{t("Provider")}</span>
            <select aria-label={t("Provider")} className="field-control" value={providerId} onChange={(event) => chooseProvider(event.target.value)} required>
              <option value="">{t("Choose a provider")}</option>
              {[...providers].sort((a, b) => a.name.localeCompare(b.name)).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <div className="wizard-inline-action">
            <Button type="button" variant="outline" onClick={() => { setEditor(editor === "provider" ? null : "provider"); setError(undefined); }}>
              {t(editor === "provider" ? "Cancel" : "Add a new provider")}
            </Button>
          </div>
          {editor === "provider" && <>
            <label className="field">{t("Provider name")}<Input value={providerName} maxLength={160} onChange={(event) => setProviderName(event.target.value)} /></label>
            <label className="field">{t("Dashboard URL")}<Input type="url" value={providerDashboard} maxLength={2048} onChange={(event) => setProviderDashboard(event.target.value)} /></label>
            <div className="field-wide wizard-inline-action"><Button type="button" onClick={saveProvider}>{t("Save provider")}</Button></div>
          </>}
        </div>
      </fieldset>}
      {kind && providerId && editor !== "provider" && <fieldset className="panel form-panel" disabled={pending}>
        <div className="panel-heading"><h2>{t("Optional account")}</h2></div>
        <div className="form-grid">
          <label className="field">
            <span>{t("Optional account")}</span>
            <select aria-label={t("Optional account")} className="field-control" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">{t("Provider only")}</option>
              {accounts.filter((account) => account.provider_id === providerId).map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <div className="wizard-inline-action">
            <Button type="button" variant="outline" onClick={() => { setEditor(editor === "account" ? null : "account"); setError(undefined); }}>
              {t(editor === "account" ? "Cancel" : "Add a new account")}
            </Button>
          </div>
          {editor === "account" && <>
            <label className="field">{t("Account label")}<Input value={accountDraft.label} maxLength={160} onChange={(event) => setAccountDraft({ ...accountDraft, label: event.target.value })} /></label>
            <label className="field">
              <span>{t("Ownership")}</span>
              <select aria-label={t("Ownership")} className="field-control" value={accountDraft.ownership_type}
                onChange={(event) => setAccountDraft({ ...accountDraft, ownership_type: event.target.value })}>
                {Object.keys(accountOwnership).map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}
              </select>
            </label>
            <details className="field-wide wizard-details">
              <summary>{t("Optional account details")}</summary>
              <div className="form-grid">
                {([["email", "Sign-in email", "email"], ["username", "Username", "text"], ["login_url", "Login URL", "url"], ["vault_item_id", "Vault item UUID", "text"]] as const)
                  .map(([key, label, type]) => <label key={key} className="field">{t(label)}
                    <Input type={type} value={accountDraft[key]} onChange={(event) => setAccountDraft({ ...accountDraft, [key]: event.target.value })} />
                  </label>)}
              </div>
              <p className="field-hint">{t("Keep passwords, API keys, recovery codes and tokens in Pass Vault.")}</p>
            </details>
            <div className="field-wide wizard-inline-action"><Button type="button" onClick={saveAccount}>{t("Save account")}</Button></div>
          </>}
        </div>
      </fieldset>}
      {kind && providerId && <fieldset className="panel form-panel" disabled={pending} hidden={!!editor}>
        <div className="panel-heading"><h2>{t("Service details")}</h2></div>
        <div className="form-grid">
          {kind === "other" && <label className="field">{t("Other purpose")}<Input name="custom_purpose" maxLength={160} /></label>}
          {isMailPurpose(kind) && <>
            <label className="field">{t("Destination email")}<Input type="email" name="destination_email" maxLength={254} /></label>
            <label className="field field-wide">{t("Message routing")}<textarea name="routing_notes" className="field-control" rows={2} maxLength={2000} /></label>
          </>}
          <label className="field field-wide">{t("Service purpose notes")}<textarea name="notes" className="field-control" rows={2} maxLength={10000} />
            <span className="field-hint">{t("Keep passwords, API keys, recovery codes and tokens in Pass Vault.")}</span></label>
        </div>
      </fieldset>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-footer">
        <Button asChild variant="outline"><Link href={projectPath}>{t("Cancel")}</Link></Button>
        <Button disabled={pending || !kind || !providerId || !!editor}>{t(pending ? "Saving…" : "Save service")}</Button>
      </div>
    </form>
  );
}
