import "server-only";
import { saveDemoRecord } from "./demo-store";
import { requireAdmin } from "./auth";
import { readDemo, changeDemo } from "./demo-data";
import { clientColumns, listedProjectColumns, type Client, type ListedProject, type Project } from "./database";
import { pageSize, type ClientInput, type ListFilters, type ProjectInput } from "./validation";

const orderColumns = { updated: "updated_at", name: "name", "name-desc": "name", created: "created_at" } as const;
type Rows<T> = { rows: T[]; count: number };

function sortLocal<T extends Client | Project>(rows: T[], filters: ListFilters) {
  const column = orderColumns[filters.sort];
  const multiplier = filters.sort === "name" ? 1 : -1;
  return rows.sort((a, b) => multiplier * a[column].localeCompare(b[column]) || a.id.localeCompare(b.id));
}

function paginateLocal<T extends Client | Project>(rows: T[], filters: ListFilters): Rows<T> {
  const start = (filters.page - 1) * pageSize;
  return { rows: sortLocal(rows, filters).slice(start, start + pageSize), count: rows.length };
}

export async function listClients(filters: ListFilters<Client["status"]>): Promise<Rows<Client>> {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const rows = readDemo().clients.filter((row) =>
      (!filters.status || row.status === filters.status) &&
      [row.name, row.company, row.contact_person, row.email].join(" ").toLowerCase().includes(filters.q.toLowerCase())
    );
    return paginateLocal(rows, filters);
  }

  const query = session.supabase.from("clients").select(clientColumns, { count: "exact" });
  if (filters.q) query.ilike("search_text", `%${filters.q}%`);
  if (filters.status) query.eq("status", filters.status);
  const start = (filters.page - 1) * pageSize;
  const { data, count, error } = await query
    .order(orderColumns[filters.sort], { ascending: filters.sort === "name" })
    .order("id").range(start, start + pageSize - 1);
  if (error?.code === "PGRST103" && filters.page > 1) return { rows: [], count: 0 };
  if (error) throw new Error("Could not load clients.");
  return { rows: data, count: count ?? 0 };
}

export async function listProjects(filters: ListFilters<Project["status"]>, clientId?: string): Promise<Rows<ListedProject>> {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const data = readDemo();
    const matches = data.projects.filter((row) =>
      (!clientId || row.client_id === clientId) &&
      (!filters.status || row.status === filters.status) &&
      [row.name, row.website, row.project_type, row.technology_stack].join(" ").toLowerCase().includes(filters.q.toLowerCase())
    );
    const { rows, count } = paginateLocal(matches, filters);
    const clients = new Map(data.clients.map((client) => [client.id, client.name]));
    return {
      rows: rows.map((row) => ({ ...row, clients: { id: row.client_id, name: clients.get(row.client_id) ?? "" } })),
      count,
    };
  }

  const query = session.supabase.from("projects").select(listedProjectColumns, { count: "exact" });
  if (filters.q) query.ilike("search_text", `%${filters.q}%`);
  if (filters.status) query.eq("status", filters.status);
  if (clientId) query.eq("client_id", clientId);
  const start = (filters.page - 1) * pageSize;
  const { data, count, error } = await query
    .order(orderColumns[filters.sort], { ascending: filters.sort === "name" })
    .order("id").range(start, start + pageSize - 1);
  if (error?.code === "PGRST103" && filters.page > 1) return { rows: [], count: 0 };
  if (error) throw new Error("Could not load projects.");
  return { rows: data, count: count ?? 0 };
}

export async function getClient(id: string): Promise<Client | null> {
  const session = await requireAdmin();
  if (session.kind === "demo") return readDemo().clients.find((row) => row.id === id) ?? null;
  const { data, error } = await session.supabase.from("clients").select(clientColumns).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the client.");
  return data;
}

export async function getProject(id: string): Promise<ListedProject | null> {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    const data = readDemo();
    const project = data.projects.find((row) => row.id === id);
    const client = data.clients.find((row) => row.id === project?.client_id);
    return project && client ? { ...project, clients: { id: client.id, name: client.name } } : null;
  }
  const { data, error } = await session.supabase.from("projects").select(listedProjectColumns).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the project.");
  return data;
}

export async function clientOptions() {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    return readDemo().clients.sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name, status }) => ({ id, name, status }));
  }

  const options: Pick<Client, "id" | "name" | "status">[] = [];
  const batchSize = 250;
  for (let start = 0; ; start += batchSize) {
    const { data, error } = await session.supabase.from("clients").select("id,name,status")
      .order("name").order("id").range(start, start + batchSize - 1);
    if (error?.code === "PGRST103" && start > 0) return options;
    if (error) throw new Error("Could not load client options.");
    options.push(...data);
    if (data.length < batchSize) return options;
  }
}

export async function dashboardData() {
  const session = await requireAdmin();
  const filters = { q: "", status: "", sort: "updated", page: 1 } as const;
  const recent = listProjects(filters);
  if (session.kind === "demo") {
    const data = readDemo();
    return {
      totalClients: data.clients.length,
      activeClients: data.clients.filter(({ status }) => status === "active").length,
      activeProjects: data.projects.filter(({ status }) => status === "active").length,
      recent: (await recent).rows.slice(0, 5),
    };
  }

  const { supabase } = session;
  const [total, active, projects, activity] = await Promise.all([
    supabase.from("clients").select("id", { head: true, count: "exact" }),
    supabase.from("clients").select("id", { head: true, count: "exact" }).eq("status", "active"),
    supabase.from("projects").select("id", { head: true, count: "exact" }).eq("status", "active"),
    recent,
  ]);
  if (total.error || active.error || projects.error) throw new Error("Could not load dashboard totals.");
  return {
    totalClients: total.count ?? 0, activeClients: active.count ?? 0,
    activeProjects: projects.count ?? 0, recent: activity.rows.slice(0, 5),
  };
}

export async function saveClient(id: string | undefined, input: ClientInput) {
  const session = await requireAdmin();
  if (session.kind === "demo") return changeDemo((data) => saveDemoRecord<Client>(data.clients, id, input));
  const table = session.supabase.from("clients");
  const result = await (id ? table.update(input).eq("id", id) : table.insert(input)).select("id").maybeSingle();
  if (result.error) return { error: "Could not save the client. Try again." };
  return result.data ?? { error: "This client is no longer available." };
}

export async function saveProject(id: string | undefined, input: ProjectInput) {
  const session = await requireAdmin();
  if (session.kind === "demo") {
    return changeDemo((data) => data.clients.some(({ id }) => id === input.client_id)
      ? saveDemoRecord<Project>(data.projects, id, input)
      : { error: "The selected client is no longer available." });
  }

  const table = session.supabase.from("projects");
  const result = await (id ? table.update(input).eq("id", id) : table.insert(input)).select("id").maybeSingle();
  if (result.error?.code === "23503") return { error: "The selected client is no longer available." };
  if (result.error) return { error: "Could not save the project. Try again." };
  return result.data ?? { error: "This project is no longer available." };
}

export async function changeRecord(tableName: "clients" | "projects", id: string, action: "archive" | "delete") {
  const session = await requireAdmin();
  const label = tableName === "clients" ? "client" : "project";
  if (session.kind === "demo") {
    return changeDemo((data) => {
      const rows = data[tableName];
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return { error: "This record is no longer available." };
      if (action === "archive") {
        rows[index].status = "archived";
        rows[index].updated_at = new Date().toISOString();
      } else {
        if (tableName === "projects" && data.projectAccounts.some((row) => row.project_id === id)) {
          return { error: "This project has related records. Remove the links before deleting the project." };
        }
        if (tableName === "clients" && data.projects.some((row) => row.client_id === id)) {
          return { error: "This client still has projects. Move or delete them before deleting the client." };
        }
        rows.splice(index, 1);
      }
      return {};
    });
  }

  const table = session.supabase.from(tableName);
  const query = action === "archive" ? table.update({ status: "archived" }) : table.delete();
  const { data, error } = await query.eq("id", id).select("id").maybeSingle();
  if (error && ["23001", "23503"].includes(error.code)) return {
    error: tableName === "clients"
      ? "This client still has projects. Move or delete them before deleting the client."
      : "This project has related records. Remove the links before deleting the project.",
  };
  if (error) return { error: `Could not ${action} the ${label}. Try again.` };
  return data ? {} : { error: "This record is no longer available." };
}
