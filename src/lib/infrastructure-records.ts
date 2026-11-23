import { optionLabel, t } from "@/lib/localization";
import "server-only";
import { requireAdmin } from "./auth";
import { readDemo, changeDemo } from "./demo-data";
import { saveDemoRecord, type DemoData } from "./demo-store";
import { readAll } from "./paged-query";
import { canonicalDomain, domainStatuses, hostingStatuses, type AssetFilters, type AssetKind, type DomainInput, type HostingInput, type RenewalInput } from "./infrastructure-validation";
import { businessDate, businessTimezone, daysUntil, tracksRenewal } from "./renewals";
import type { AssetAccount, AssetProject, AssetView, Domain, DomainView, Hosting, HostingView, Renewal } from "./database";
import { pageSize } from "./validation";

const projectEmbed = "projects!inner(id,name,clients!inner(id,name))";
const accountFields = "id,label,archived_at,login_url,vault_item_id,service_providers!inner(id,name,dashboard_url)";
const domainFields = "id,project_id,registrar_account_id,name,registered_on,expires_on,renewal_price,currency,auto_renew,status,renewal_responsibility,notes,created_at,updated_at";
const hostingFields = "id,project_id,hosting_account_id,hosting_type,plan_name,server_notes,billing_cycle,renews_on,renewal_price,currency,auto_renew,status,renewal_responsibility,notes,created_at,updated_at";
const domainSelect = `${domainFields},${projectEmbed},service_accounts(${accountFields})` as const;
const hostingSelect = `${hostingFields},${projectEmbed},service_accounts!inner(${accountFields})` as const;
const historyFields = "id,domain_id,hosting_service_id,renewed_on,period_start,period_end,paid_amount,currency,paid_on,payment_status,next_renewal_on,notes,created_at";
const missing = { error: t("This record is no longer available.") };
const nameConflict = { error: t("A non-archived record already exists for this domain.") };
const referenceError = { error: t("The selected project or service account is no longer available.") };
const historyBlocked = { error: t("This record has renewal history. Archive it to preserve its history.") };
const renewalConflict = { error: t("This submission was already used. Reload the renewal form to record another event.") };
const isForeignKey = (code?: string) => code === "23503" || code === "23001";
type Result = { error?: string };
type SaveResult = { id: string } | { error: string };

const domainView = (row: Omit<DomainView, "kind">): DomainView => ({ ...row, kind: "domains" });
const hostingView = (row: Omit<HostingView, "kind">): HostingView => ({ ...row, kind: "hosting" });

function demoViews(data: DemoData) {
  const clients = new Map(data.clients.map(({ id, name }) => [id, { id, name }]));
  const projects = new Map(data.projects.map(({ id, name, client_id }) => [id, { id, name, clients: clients.get(client_id)! } satisfies AssetProject]));
  const providers = new Map(data.providers.map(({ id, name, dashboard_url }) => [id, { id, name, dashboard_url }]));
  const accounts = new Map(data.accounts.map(({ id, label, archived_at, provider_id, login_url, vault_item_id }) =>
    [id, { id, label, archived_at, login_url, vault_item_id, service_providers: providers.get(provider_id)! } satisfies AssetAccount]));
  return {
    domains: data.domains.map((row) => domainView({
      ...row, projects: projects.get(row.project_id)!, service_accounts: accounts.get(row.registrar_account_id ?? "") ?? null,
    })),
    hosting: data.hosting.map((row) => hostingView({
      ...row, projects: projects.get(row.project_id)!, service_accounts: accounts.get(row.hosting_account_id)!,
    })),
  };
}

const sortFields = { updated: "updated_at", created: "created_at", name: "name", "name-desc": "name" } as const;

export async function listAssets(kind: AssetKind, filters: AssetFilters): Promise<{ rows: AssetView[]; count: number }> {
  const session = await requireAdmin();
  const start = (filters.page - 1) * pageSize;
  const sort = sortFields[filters.sort];
  const ascending = filters.sort === "name";
  if (session.kind === "demo") {
    const q = filters.q.toLowerCase();
    const rows = demoViews(readDemo())[kind].filter((row) =>
      (!filters.project || row.project_id === filters.project) && (!filters.status || row.status === filters.status) &&
      (row.kind === "domains" ? row.name : [row.hosting_type, row.plan_name].join(" ")).toLowerCase().includes(q)
    );
    const sortValue = (row: AssetView) => sort !== "name" ? row[sort] : row.kind === "domains" ? row.name : row.plan_name;
    rows.sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      if (left === null || right === null) return Number(left === null) - Number(right === null) || a.id.localeCompare(b.id);
      return (ascending ? 1 : -1) * left.localeCompare(right) || a.id.localeCompare(b.id);
    });
    return { rows: rows.slice(start, start + pageSize), count: rows.length };
  }
  if (kind === "domains") {
    const query = session.supabase.from("domains").select(domainSelect, { count: "exact" });
    const status = domainStatuses.find((value) => value === filters.status);
    if (status) query.eq("status", status);
    if (filters.project) query.eq("project_id", filters.project);
    if (filters.q) query.filter("name", "imatch", `***=${filters.q}`);
    const { data, error, count } = await query.order(sort, { ascending }).order("id").range(start, start + pageSize - 1);
    if (error?.code === "PGRST103" && start) return { rows: [], count: 0 };
    if (error) throw new Error(t("Could not load domains."));
    return { rows: data.map(domainView), count: count ?? 0 };
  }
  const query = session.supabase.from("hosting_services").select(hostingSelect, { count: "exact" });
  const status = hostingStatuses.find((value) => value === filters.status);
  if (status) query.eq("status", status);
  if (filters.project) query.eq("project_id", filters.project);
  if (filters.q) query.filter("search_text", "imatch", `***=${filters.q}`);
  const { data, error, count } = await query.order(sort === "name" ? "plan_name" : sort, { ascending, nullsFirst: false })
    .order("id").range(start, start + pageSize - 1);
  if (error?.code === "PGRST103" && start) return { rows: [], count: 0 };
  if (error) throw new Error(t("Could not load hosting services."));
  return { rows: data.map(hostingView), count: count ?? 0 };
}

export async function getAsset(kind: AssetKind, id: string): Promise<AssetView | null> {
  const session = await requireAdmin();
  if (session.kind === "demo") return demoViews(readDemo())[kind].find((row) => row.id === id) ?? null;
  if (kind === "domains") {
    const { data, error } = await session.supabase.from("domains").select(domainSelect).eq("id", id).maybeSingle();
    if (error) throw new Error(t("Could not load this domain."));
    return data ? domainView(data) : null;
  }
  const { data, error } = await session.supabase.from("hosting_services").select(hostingSelect).eq("id", id).maybeSingle();
  if (error) throw new Error(t("Could not load this hosting service."));
  return data ? hostingView(data) : null;
}

export async function assetOptions() {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const data = readDemo();
    const providers = new Map(data.providers.map((row) => [row.id, row.name]));
    return {
      projects: data.projects.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      accounts: data.accounts.map(({ id, label, archived_at, provider_id }) =>
        ({ id, label, archived_at, provider: providers.get(provider_id)! })).sort((a, b) => a.label.localeCompare(b.label)),
    };
  }
  const [projects, accounts] = await Promise.all([
    readAll((start, end) => session.supabase.from("projects").select("id,name").order("name").order("id").range(start, end),
      t("Could not load projects.")),
    readAll((start, end) => session.supabase.from("service_accounts").select("id,label,archived_at,service_providers!inner(name)")
      .order("label").order("id").range(start, end), t("Could not load service accounts.")),
  ]);
  return { projects, accounts: accounts.map(({ id, label, archived_at, service_providers }) => ({ id, label, archived_at, provider: service_providers.name })) };
}

async function readAssets(projectId?: string) {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const { domains, hosting } = demoViews(readDemo());
    return {
      domains: projectId ? domains.filter((row) => row.project_id === projectId) : domains,
      hosting: projectId ? hosting.filter((row) => row.project_id === projectId) : hosting,
    };
  }
  const [domains, hosting] = await Promise.all([
    readAll((start, end) => {
      const query = session.supabase.from("domains").select(domainSelect);
      if (projectId) query.eq("project_id", projectId);
      return query.order("name").order("id").range(start, end);
    }, t("Could not load domains.")),
    readAll((start, end) => {
      const query = session.supabase.from("hosting_services").select(hostingSelect);
      if (projectId) query.eq("project_id", projectId);
      return query.order("plan_name").order("id").range(start, end);
    }, t("Could not load hosting services.")),
  ]);
  return { domains: domains.map(domainView), hosting: hosting.map(hostingView) };
}

export async function projectAssets(projectId: string) {
  return readAssets(projectId);
}

export function assetName(row: AssetView) {
  return row.kind === "domains" ? row.name : row.plan_name || optionLabel(row.hosting_type);
}
export function assetDate(row: AssetView) {
  return row.kind === "domains" ? row.expires_on : row.renews_on;
}
export function configuredToday() {
  return businessDate(new Date(), businessTimezone(process.env.CLIENT_HUB_BUSINESS_TIMEZONE));
}

export async function renewalOverview() {
  const { domains, hosting } = await readAssets();
  const today = configuredToday();
  const rows = [...domains, ...hosting].filter(({ status }) => tracksRenewal(status)).map((asset) => {
    const date = assetDate(asset);
    return {
      asset, date, days: daysUntil(date, today),
      kind: asset.kind, client: asset.projects.clients, provider: asset.service_accounts?.service_providers ?? null,
      amount: asset.renewal_price, currency: asset.currency,
    };
  }).sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity) || assetName(a.asset).localeCompare(assetName(b.asset)));
  return {
    today, rows,
    totalDomains: domains.length,
    activeHosting: hosting.filter(({ status }) => status === "active").length,
  };
}

export type RenewalRow = Awaited<ReturnType<typeof renewalOverview>>["rows"][number];

export async function paidRenewals() {
  const session = await requireAdmin();
  if (session.kind === "demo") return readDemo().renewalHistory.filter(({ payment_status }) => payment_status === "paid")
    .map(({ paid_amount, currency }) => ({ amount: paid_amount, currency }));
  const rows = await readAll((start, end) => session.supabase.from("renewal_history").select("paid_amount,currency")
    .eq("payment_status", "paid").order("id").range(start, end), t("Could not load recorded payments."));
  return rows.map(({ paid_amount, currency }) => ({ amount: paid_amount, currency }));
}

export async function renewalHistory(kind: AssetKind, id: string): Promise<Renewal[]> {
  const session = await requireAdmin();
  const column = kind === "domains" ? "domain_id" : "hosting_service_id";
  if (session.kind === "demo") return readDemo().renewalHistory.filter((row) => row[column] === id)
    .sort((a, b) => b.renewed_on.localeCompare(a.renewed_on) || a.id.localeCompare(b.id));
  return readAll((start, end) => session.supabase.from("renewal_history").select(historyFields)
    .eq(column, id).order("renewed_on", { ascending: false }).order("id").range(start, end), t("Could not load renewal history."));
}

export async function saveDomain(id: string | undefined, input: DomainInput): Promise<SaveResult> {
  const session = await requireAdmin();
  if (session.kind === "demo") return changeDemo((data) => {
    if (!demoReferences(data, input.project_id, input.registrar_account_id)) return referenceError;
    if (input.status !== "archived" && data.domains.some((row) =>
      row.id !== id && row.status !== "archived" && canonicalDomain(row.name) === input.name
    )) return nameConflict;
    const saved = saveDemoRecord<Domain>(data.domains, id, input);
    return saved.id ? { id: saved.id } : missing;
  });
  const table = session.supabase.from("domains");
  const { data, error } = await (id ? table.update(input).eq("id", id) : table.insert(input)).select("id").maybeSingle();
  if (error?.code === "23505") return nameConflict;
  if (isForeignKey(error?.code)) return referenceError;
  return error ? { error: t("Could not save the domain. Try again.") } : data ?? missing;
}

export async function saveHosting(id: string | undefined, input: HostingInput): Promise<SaveResult> {
  const session = await requireAdmin();
  if (session.kind === "demo") return changeDemo((data) => {
    if (!demoReferences(data, input.project_id, input.hosting_account_id)) return referenceError;
    const saved = saveDemoRecord<Hosting>(data.hosting, id, input);
    return saved.id ? { id: saved.id } : missing;
  });
  const table = session.supabase.from("hosting_services");
  const { data, error } = await (id ? table.update(input).eq("id", id) : table.insert(input)).select("id").maybeSingle();
  if (isForeignKey(error?.code)) return referenceError;
  return error ? { error: t("Could not save the hosting service. Try again.") } : data ?? missing;
}

function demoReferences(data: DemoData, projectId: string, accountId: string | null) {
  return data.projects.some(({ id }) => id === projectId) && (!accountId || data.accounts.some(({ id }) => id === accountId));
}

export async function changeAsset(kind: AssetKind, id: string, operation: "archive" | "delete"): Promise<Result> {
  const session = await requireAdmin();
  if (session.kind === "demo") return changeDemo((data) => {
    const rows = data[kind];
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return missing;
    if (operation === "archive") {
      rows[index].status = "archived";
      rows[index].updated_at = new Date().toISOString();
    } else {
      const column = kind === "domains" ? "domain_id" : "hosting_service_id";
      if (data.renewalHistory.some((row) => row[column] === id)) return historyBlocked;
      rows.splice(index, 1);
    }
    return {};
  });
  const table = session.supabase.from(kind === "domains" ? "domains" : "hosting_services");
  const query = operation === "archive" ? table.update({ status: "archived" }) : table.delete();
  const { data, error } = await query.eq("id", id).select("id").maybeSingle();
  if (isForeignKey(error?.code)) return historyBlocked;
  if (error) return { error: t("The action could not be completed. Try again.") };
  return data ? {} : missing;
}

export async function addRenewal(kind: AssetKind, id: string, eventId: string, input: RenewalInput): Promise<Result> {
  const session = await requireAdmin();
  if (session.kind === "demo") return changeDemo((data) => {
    const row = data[kind].find((record) => record.id === id);
    if (!row) return missing;
    const targets = { domain_id: kind === "domains" ? id : null, hosting_service_id: kind === "hosting" ? id : null };
    const previous = data.renewalHistory.find((event) => event.id === eventId);
    if (previous) {
      const same = Object.entries({ ...input, ...targets }).every(([key, value]) => previous[key as keyof Renewal] === value);
      return same ? {} : renewalConflict;
    }
    if (input.next_renewal_on && "registered_on" in row && row.registered_on && input.next_renewal_on < row.registered_on) {
      return { error: t("The next expiration date cannot be before domain registration.") };
    }
    const created_at = new Date().toISOString();
    data.renewalHistory.push({ ...input, ...targets, id: eventId, created_at });
    if (input.next_renewal_on) {
      if ("expires_on" in row) row.expires_on = input.next_renewal_on;
      else row.renews_on = input.next_renewal_on;
      row.updated_at = created_at;
    }
    return {};
  });
  const { error } = await session.supabase.rpc("record_asset_renewal", {
    p_kind: kind, p_record_id: id, p_event_id: eventId, p_renewed_on: input.renewed_on,
    p_period_start: input.period_start, p_period_end: input.period_end, p_paid_amount: input.paid_amount,
    p_currency: input.currency, p_paid_on: input.paid_on, p_payment_status: input.payment_status,
    p_next_renewal_on: input.next_renewal_on, p_notes: input.notes,
  });
  if (isForeignKey(error?.code)) return missing;
  if (error?.code === "23505") return renewalConflict;
  if (error?.code === "23514") return { error: t("Check the renewal and payment dates and amounts.") };
  return error ? { error: t("Could not record this renewal. Try again.") } : {};
}
