import { t } from "@/lib/localization";
import "server-only";
import { requireAdmin } from "./auth";
import { readAll } from "./paged-query";
import { changeDemo, readDemo } from "./demo-data";
import { saveDemoRecord, type DemoData } from "./demo-store";
import type {
  AccountProjectView, ListedAccount, ProjectAccount, ProjectAccountView, ProjectServiceAssociation, ServiceAccount, ServiceProvider,
} from "./database";
import type { AccountFilters, AccountInput, ProviderInput } from "./service-validation";
import { pageSize } from "./validation";

const providerColumns = "id,name,category,website_url,dashboard_url,created_at,updated_at";
const accountColumns = "id,provider_id,label,email,username,login_url,vault_item_id,ownership_type,notes,archived_at,created_at,updated_at";
const listedColumns = `${accountColumns},service_providers!inner(id,name,dashboard_url)` as const;
const associationColumns = "id,project_id,service_account_id,provider_id,service_kind,destination_email,routing_notes,purpose,notes,created_at,updated_at";
const projectAccountColumns = `${associationColumns},service_accounts(${listedColumns}),service_providers(id,name,dashboard_url)` as const;
const accountProjectColumns = `${associationColumns},projects!inner(id,name,status)` as const;
const sortColumns = { updated: "updated_at", name: "label", "name-desc": "label", created: "created_at" } as const;
type MutationResult = { error?: string };
const missing = { error: t("This record is no longer available.") };
const foreignKeyError = (code?: string) => code === "23503" || code === "23001";
const canonicalName = (value: string) => value.trim().toLowerCase();

function listedAccount(account: ServiceAccount, providers: Map<string, ServiceProvider>): ListedAccount {
  const provider = providers.get(account.provider_id);
  if (!provider) throw new Error("An account is missing its provider.");
  return {
    ...account, service_providers: { id: provider.id, name: provider.name, dashboard_url: provider.dashboard_url },
  };
}

function providerMap(data: DemoData) {
  return new Map(data.providers.map((row) => [row.id, row]));
}

export async function listProviders() {
  const session = await requireAdmin();
  if (session.kind === "demo") return readDemo().providers.sort((a, b) => a.name.localeCompare(b.name));
  return readAll((start, end) => session.supabase.from("service_providers").select(providerColumns)
    .order("name").order("id").range(start, end), t("Could not load providers."));
}

export async function getProvider(id: string): Promise<ServiceProvider | null> {
  const session = await requireAdmin();
  if (session.kind === "demo") return readDemo().providers.find((row) => row.id === id) ?? null;
  const { data, error } = await session.supabase.from("service_providers").select(providerColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(t("Could not load the provider."));
  return data;
}

export async function saveProvider(id: string | undefined, input: ProviderInput) {
  const session = await requireAdmin();
  const duplicate = { error: t("A provider with that name already exists.") };
  if (session.kind === "demo") return changeDemo((data) => {
    if (data.providers.some((row) => row.id !== id && canonicalName(row.name) === canonicalName(input.name))) return duplicate;
    return saveDemoRecord<ServiceProvider>(data.providers, id, input);
  });
  const table = session.supabase.from("service_providers");
  const { data, error } = await (id ? table.update(input).eq("id", id) : table.insert(input)).select("id").maybeSingle();
  if (error?.code === "23505") return duplicate;
  if (error) return { error: t("Could not save the provider. Try again.") };
  return data ?? missing;
}

export async function deleteProvider(id: string): Promise<MutationResult> {
  const session = await requireAdmin();
  const blocked = { error: t("This provider is referenced by accounts. Move or delete those accounts first.") };
  if (session.kind === "demo") return changeDemo((data) => {
    if (data.accounts.some((row) => row.provider_id === id)) return blocked;
    if (data.projectAccounts.some((row) => row.provider_id === id)) {
      return { error: t("This provider is linked to a project service. Unlink the service first.") };
    }
    const index = data.providers.findIndex((row) => row.id === id);
    if (index < 0) return missing;
    data.providers.splice(index, 1);
    return {};
  });
  const { data, error } = await session.supabase.from("service_providers").delete().eq("id", id).select("id").maybeSingle();
  if (foreignKeyError(error?.code)) return { error: t("This provider is linked to accounts or project services. Remove those references first.") };
  if (error) return { error: t("Could not delete the provider. Try again.") };
  return data ? {} : missing;
}

export async function listAccounts(filters: AccountFilters): Promise<{ rows: ListedAccount[]; count: number }> {
  const session = await requireAdmin();
  const column = sortColumns[filters.sort];
  const ascending = filters.sort === "name";
  const start = (filters.page - 1) * pageSize;

  if (session.kind === "demo") {
    const data = readDemo();
    const search = filters.q.toLowerCase();
    const matches = data.accounts.filter((row) =>
      (!filters.status || (row.archived_at ? "archived" : "active") === filters.status) &&
      (!filters.provider || row.provider_id === filters.provider) &&
      (!filters.ownership || row.ownership_type === filters.ownership) &&
      [row.label, row.email, row.username].join(" ").toLowerCase().includes(search)
    );
    matches.sort((a, b) => (ascending ? 1 : -1) * a[column].localeCompare(b[column]) || a.id.localeCompare(b.id));
    const providers = providerMap(data);
    return { rows: matches.slice(start, start + pageSize).map((row) => listedAccount(row, providers)), count: matches.length };
  }

  const query = session.supabase.from("service_accounts").select(listedColumns, { count: "exact" });
  // PostgreSQL's ***= director treats all remaining characters as literal text.
  if (filters.q) query.filter("search_text", "imatch", `***=${filters.q}`);
  if (filters.provider) query.eq("provider_id", filters.provider);
  if (filters.ownership) query.eq("ownership_type", filters.ownership);
  if (filters.status === "active") query.is("archived_at", null);
  if (filters.status === "archived") query.not("archived_at", "is", null);
  const { data, count, error } = await query.order(column, { ascending }).order("id").range(start, start + pageSize - 1);
  if (error?.code === "PGRST103" && filters.page > 1) return { rows: [], count: 0 };
  if (error) throw new Error(t("Could not load service accounts."));
  return { rows: data, count: count ?? 0 };
}

export async function getAccount(id: string): Promise<ListedAccount | null> {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const data = readDemo();
    const account = data.accounts.find((row) => row.id === id);
    return account ? listedAccount(account, providerMap(data)) : null;
  }
  const { data, error } = await session.supabase.from("service_accounts").select(listedColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(t("Could not load the service account."));
  return data;
}

export async function linkableAccounts(): Promise<{ id: string; label: string; provider_id: string }[]> {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const data = readDemo();
    return data.accounts.filter((row) => !row.archived_at).sort((a, b) => a.label.localeCompare(b.label))
      .map(({ id, label, provider_id }) => ({ id, label, provider_id }));
  }
  const rows = await readAll((start, end) => session.supabase.from("service_accounts").select("id,label,provider_id")
    .is("archived_at", null).order("label").order("id").range(start, end), t("Could not load available accounts."));
  return rows;
}

export async function saveAccount(id: string | undefined, input: AccountInput) {
  const session = await requireAdmin();
  const invalidProvider = { error: t("The selected provider is no longer available.") };
  if (session.kind === "demo") return changeDemo((data) => {
    if (!data.providers.some((row) => row.id === input.provider_id)) return invalidProvider;
    const current = data.accounts.find((row) => row.id === id);
    return saveDemoRecord<ServiceAccount>(data.accounts, id, { ...input, archived_at: current?.archived_at ?? null });
  });
  const table = session.supabase.from("service_accounts");
  const { data, error } = await (id ? table.update(input).eq("id", id) : table.insert(input)).select("id").maybeSingle();
  if (foreignKeyError(error?.code)) return invalidProvider;
  if (error) return { error: t("Could not save the service account. Try again.") };
  return data ?? missing;
}

export async function changeAccount(id: string, action: "archive" | "restore" | "delete"): Promise<MutationResult> {
  const session = await requireAdmin();
  const date = new Date().toISOString();
  const blocked = { error: t("This account still has related records. Unlink it before deleting it, or archive it to keep its history.") };
  if (session.kind === "demo") return changeDemo((data) => {
    const index = data.accounts.findIndex((row) => row.id === id);
    if (index < 0) return missing;
    const account = data.accounts[index];
    if (action === "delete") {
      if (data.projectAccounts.some((row) => row.service_account_id === id) ||
          data.domains.some((row) => row.registrar_account_id === id) ||
          data.hosting.some((row) => row.hosting_account_id === id)) return blocked;
      data.accounts.splice(index, 1);
    } else if (action === "restore" || account.archived_at === null) {
      account.archived_at = action === "archive" ? date : null;
      account.updated_at = date;
    }
    return {};
  });

  const table = session.supabase.from("service_accounts");
  const query = action === "delete" ? table.delete() : table.update({ archived_at: action === "archive" ? date : null });
  if (action === "archive") query.is("archived_at", null);
  const { data, error } = await query.eq("id", id).select("id").maybeSingle();
  if (foreignKeyError(error?.code)) return blocked;
  if (error) return { error: t("The action could not be completed. Try again.") };
  if (!data && action === "archive") return (await getAccount(id))?.archived_at ? {} : missing;
  return data ? {} : missing;
}

export async function listProjectAccounts(projectId: string): Promise<ProjectAccountView[]> {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const data = readDemo();
    const providers = providerMap(data);
    const accounts = new Map(data.accounts.map((row) => [row.id, row]));
    return data.projectAccounts.filter((row) => row.project_id === projectId)
      .map((row) => {
        const account = row.service_account_id ? accounts.get(row.service_account_id) : null;
        return { ...row, service_accounts: account ? listedAccount(account, providers) : null,
          service_providers: row.provider_id ? providers.get(row.provider_id) ?? null : null };
      });
  }
  return readAll((start, end) => session.supabase.from("project_service_accounts").select(projectAccountColumns)
    .eq("project_id", projectId).order("created_at").order("id").range(start, end), t("Could not load connected accounts."));
}

export async function listAccountProjects(accountId: string): Promise<AccountProjectView[]> {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const data = readDemo();
    const projects = new Map(data.projects.map((row) => [row.id, row]));
    return data.projectAccounts.filter((row) => row.service_account_id === accountId).map((row) => {
      const { id, name, status } = projects.get(row.project_id)!;
      return { ...row, projects: { id, name, status } };
    });
  }
  return readAll((start, end) => session.supabase.from("project_service_accounts").select(accountProjectColumns)
    .eq("service_account_id", accountId).order("created_at").order("id").range(start, end), t("Could not load connected projects."));
}

export async function linkProjectAccount(projectId: string, input: ProjectServiceAssociation): Promise<MutationResult> {
  const session = await requireAdmin();
  const duplicate = { error: t("This service is already linked to the project for that purpose.") };
  const invalid = { error: t("The project, provider or active account is no longer available.") };
  if (session.kind === "demo") return changeDemo((data) => {
    const sourceExists = input.service_account_id
      ? !input.provider_id && data.accounts.some((row) => row.id === input.service_account_id && !row.archived_at)
      : data.providers.some((row) => row.id === input.provider_id);
    if (!data.projects.some((row) => row.id === projectId) || !sourceExists) return invalid;
    if (data.projectAccounts.some((row) => row.project_id === projectId && row.service_account_id === input.service_account_id &&
        (row.provider_id ?? null) === (input.provider_id ?? null) && canonicalName(row.purpose) === canonicalName(input.purpose))) return duplicate;
    return saveDemoRecord<ProjectAccount>(data.projectAccounts, undefined, { ...input, project_id: projectId });
  });
  const { error } = await session.supabase.from("project_service_accounts").insert({ ...input, project_id: projectId });
  if (error?.code === "23505") return duplicate;
  if (foreignKeyError(error?.code) || error?.code === "23514") return invalid;
  return error ? { error: t("Could not link the account. Try again.") } : {};
}

export async function unlinkProjectAccount(projectId: string, associationId: string): Promise<MutationResult> {
  const session = await requireAdmin();
  if (session.kind === "demo") return changeDemo((data) => {
    const index = data.projectAccounts.findIndex((row) => row.id === associationId && row.project_id === projectId);
    if (index < 0) return missing;
    data.projectAccounts.splice(index, 1);
    return {};
  });
  const { data, error } = await session.supabase.from("project_service_accounts").delete()
    .eq("id", associationId).eq("project_id", projectId).select("id").maybeSingle();
  if (error) return { error: t("Could not unlink the account. Try again.") };
  return data ? {} : missing;
}
