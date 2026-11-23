import { randomUUID } from "node:crypto";
import type { ServiceProvider } from "./database";
import type { DemoData } from "./demo-store";
import { t } from "./localization";

const exampleName = "Ilić Enterijer (demo)";

export function seedProjectWorkflow(data: DemoData) {
  if (data.projectWorkspaceSeeded) return;
  data.projectWorkspaceSeeded = true;
  const now = new Date().toISOString();
  const stamps = () => ({ id: randomUUID(), created_at: now, updated_at: now });

  function provider(name: string, category: ServiceProvider["category"]) {
    const existing = data.providers.find((row) => row.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const row = { ...stamps(), name, category, website_url: null, dashboard_url: null };
    data.providers.push(row);
    return row;
  }

  const forms = provider("Web3Forms", "Other");
  provider("Google Analytics", "Analytics");
  provider("Google Search Console", "Analytics");

  if (data.projects.some(({ name }) => name === exampleName) || data.clients.some(({ name }) => name === exampleName)) return;
  const host = provider("Hostinger", "Hosting");
  const registrar = provider("WebHostingSerbia", "Domain Registrar");
  const client = {
    ...stamps(), name: exampleName, status: "active" as const, company: null, contact_person: null,
    email: null, phone: null, website: null, country: null, city: null, address: null, notes: t("Fictional project note"),
  };
  data.clients.push(client);
  const project = {
    ...stamps(), name: exampleName, client_id: client.id, project_type: "website", status: "active" as const,
    website: "https://ilic-enterijer.example", production_url: null, staging_url: null, technology_stack: null,
    repository_url: null, cms_url: null, description: t("Website project description"), technical_notes: t("Fictional project note"),
  };
  data.projects.push(project);

  function createDemoAccount(providerId: string, label: string) {
    const row = {
      ...stamps(), label, provider_id: providerId, ownership_type: "client" as const,
      email: null, username: null, login_url: null, vault_item_id: null, archived_at: null, notes: t("Fictional service note"),
    };
    data.accounts.push(row);
    return row.id;
  }

  const hostAccount = data.accounts.find((row) => row.provider_id === host.id && row.label === "Shared hosting (demo)" && !row.archived_at);
  const hostAccountId = hostAccount?.id ?? createDemoAccount(host.id, t("Fictional hosting account"));
  const registrarAccountId = createDemoAccount(registrar.id, t("Fictional registrar account"));
  const asset = { project_id: project.id, auto_renew: false, status: "active" as const,
    renewal_price: null, currency: null, renewal_responsibility: null, notes: t("Fictional project note") };
  data.domains.push({ ...stamps(), ...asset, name: "ilic-enterijer.example", registrar_account_id: registrarAccountId,
    registered_on: null, expires_on: null });
  data.hosting.push({ ...stamps(), ...asset, hosting_account_id: hostAccountId, hosting_type: "Shared Hosting",
    plan_name: null, billing_cycle: null, server_notes: null, renews_on: null });
  data.projectAccounts.push({
    ...stamps(), project_id: project.id, provider_id: forms.id, service_account_id: null, service_kind: "contact_form",
    purpose: "Contact form", destination_email: "kontakt@ilic-enterijer.example", routing_notes: t("Demo contact form routing"), notes: null,
  });
}
