import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { seedInfrastructure } from "./demo-infrastructure";
import type { Client, Domain, Hosting, Project, ProjectAccount, Renewal, ServiceAccount, ServiceProvider, Stamps } from "./database";

type PhaseOneDemo = { clients: Client[]; projects: Project[] };
export type DemoData = PhaseOneDemo & {
  providers: ServiceProvider[];
  accounts: ServiceAccount[];
  projectAccounts: ProjectAccount[];
  domains: Domain[];
  hosting: Hosting[];
  renewalHistory: Renewal[];
};

function seed(): PhaseOneDemo {
  const created_at = new Date().toISOString();
  const fixtures = [
    ["Powder Brows Vienna", "Website", "active"],
    ["Cool Fridge Guys", "Website", "maintenance"],
    ["Casovi Francuskog", "Education site", "development"],
    ["Dulova Skola", "Education site", "active"],
    ["Frankultura", "Website", "active"],
  ] as const;
  const clients: Client[] = fixtures.map(([name], index) => ({
    id: randomUUID(), name, company: null, contact_person: null, email: null, phone: null,
    website: null, country: null, city: null, address: null, notes: "Local demo record.",
    status: index === 2 ? "prospect" : "active", created_at, updated_at: created_at,
  }));
  const projects: Project[] = fixtures.map(([name, project_type, status], index) => ({
    id: randomUUID(), client_id: clients[index].id, name, website: null, project_type, status,
    description: "Local demo record.", technology_stack: null, repository_url: null, cms_url: null,
    production_url: null, staging_url: null, technical_notes: null, created_at, updated_at: created_at,
  }));
  return { clients, projects };
}

function seedServices({ projects }: PhaseOneDemo) {
  const date = new Date().toISOString();
  const standardProviders = [
    ["Hostinger", "Hosting", "https://www.hostinger.com", "https://hpanel.hostinger.com"],
    ["Vercel", "Deployment", "https://vercel.com", "https://vercel.com/dashboard"],
    ["WebHostingSerbia", "Hosting", null, null],
    ["Cloudflare", "DNS / CDN", "https://www.cloudflare.com", "https://dash.cloudflare.com"],
    ["GitHub", "Source Control", "https://github.com", "https://github.com/dashboard"],
    ["GitLab", "Source Control", "https://about.gitlab.com", "https://gitlab.com"],
    ["Gmail", "Email", "https://mail.google.com", "https://mail.google.com"],
    ["YouTube", "Marketing", "https://www.youtube.com", "https://studio.youtube.com"],
    ["Resend", "Transactional Email", "https://resend.com", "https://resend.com/overview"],
    ["Supabase", "Database", "https://supabase.com", "https://supabase.com/dashboard"],
    ["WordPress", "CMS", "https://wordpress.org", null],
  ] as const;
  const stamps = () => ({ id: randomUUID(), created_at: date, updated_at: date });
  const providers: ServiceProvider[] = standardProviders.map(([name, category, website_url, dashboard_url]) =>
    ({ ...stamps(), name, category, website_url, dashboard_url })
  );
  const samples = [
    ["Hostinger", "Shared hosting", "shared", ["Powder Brows Vienna", "Dulova Skola"], "Website hosting"],
    ["Resend", "Project email", "client", ["Cool Fridge Guys"], "Transactional email"],
    ["Vercel", "Studio deployments", "mine", ["Frankultura"], "Website deployment"],
    ["Gmail", "Classroom email", "client", ["Casovi Francuskog"], "Project email"],
  ] as const;
  const accounts: ServiceAccount[] = [];
  const projectAccounts: ProjectAccount[] = [];
  for (const [providerName, label, ownership_type, names, purpose] of samples) {
    const provider = providers.find(({ name }) => name === providerName)!;
    const account: ServiceAccount = {
      ...stamps(), provider_id: provider.id, label: `${label} (demo)`, ownership_type,
      email: null, username: null, login_url: null, vault_item_id: null,
      notes: "Fictional demo account.", archived_at: null,
    };
    accounts.push(account);
    for (const project of projects.filter(({ name }) => (names as readonly string[]).includes(name))) {
      projectAccounts.push({
        ...stamps(), project_id: project.id, service_account_id: account.id, purpose, notes: null,
      });
    }
  }
  return { providers, accounts, projectAccounts };
}

function writeDemo(directory: string, data: DemoData) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, randomUUID() + ".tmp");
  writeFileSync(temporary, JSON.stringify(data), { mode: 0o600, flag: "wx" });
  renameSync(temporary, join(directory, "data.json"));
}

export function readDemoFile(directory: string): DemoData {
  let data: PhaseOneDemo & Partial<DemoData>;
  try {
    data = JSON.parse(readFileSync(join(directory, "data.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    data = seed();
  }
  if (data.providers && data.accounts && data.projectAccounts && data.domains && data.hosting && data.renewalHistory) {
    return {
      ...data, providers: data.providers, accounts: data.accounts, projectAccounts: data.projectAccounts,
      domains: data.domains, hosting: data.hosting, renewalHistory: data.renewalHistory,
    };
  }

  const fixtures = data.providers || data.accounts || data.projectAccounts
    ? { providers: [], accounts: [], projectAccounts: [] }
    : seedServices(data);
  const projectAccounts = data.projectAccounts ?? fixtures.projectAccounts;
  const infrastructure = data.domains || data.hosting || data.renewalHistory
    ? { domains: [], hosting: [] }
    : seedInfrastructure(data.projects, projectAccounts);
  const upgraded = {
    ...data, providers: data.providers ?? fixtures.providers, accounts: data.accounts ?? fixtures.accounts,
    projectAccounts, domains: data.domains ?? infrastructure.domains, hosting: data.hosting ?? infrastructure.hosting,
    renewalHistory: data.renewalHistory ?? [],
  };
  writeDemo(directory, upgraded);
  return upgraded;
}

export function changeDemoFile<T>(directory: string, operation: (data: DemoData) => T): T {
  const data = readDemoFile(directory);
  const result = operation(data);
  writeDemo(directory, data);
  return result;
}

export function saveDemoRecord<T extends Stamps>(rows: T[], id: string | undefined, input: Omit<T, keyof Stamps>) {
  const now = new Date().toISOString();
  if (id) {
    const existing = rows.find((row) => row.id === id);
    if (!existing) return { error: "This record is no longer available." };
    Object.assign(existing, input, { updated_at: now });
    return { id };
  }
  const next = { ...input, id: randomUUID(), created_at: now, updated_at: now } as T;
  rows.push(next);
  return { id: next.id };
}
