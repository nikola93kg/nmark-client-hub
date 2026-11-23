import { randomUUID } from "node:crypto";
import type { Domain, Hosting, Project, ProjectAccount } from "./database";
import { t } from "./localization";
import { businessDate, businessTimezone, dateOffset } from "./renewals";

export function seedInfrastructure(projects: Project[], projectAccounts: ProjectAccount[]) {
  const now = new Date();
  const today = businessDate(now, businessTimezone(process.env.CLIENT_HUB_BUSINESS_TIMEZONE));
  const notes = t("Fictional demo dates and prices.");
  const date = (days: number | null) => days === null ? null : dateOffset(today, days);
  const stamps = () => ({ id: randomUUID(), created_at: now.toISOString(), updated_at: now.toISOString() });
  const domains: Domain[] = [];
  const hosting: Hosting[] = [];
  const examples = [
    ["Powder Brows Vienna", "powder-brows-vienna.example", -3, 19.90, "EUR", "nmark"],
    ["Cool Fridge Guys", "cool-fridge-guys.example", 5, 22, "USD", "client"],
    ["Casovi Francuskog", "casovi-francuskog.example", 12, 2400, "RSD", "nmark"],
    ["Dulova Skola", "dulova-skola.example", 44, null, null, "other"],
    ["Frankultura", "frankultura.example", null, null, null, "client"],
  ] as const;
  for (const [projectName, name, days, renewal_price, currency, renewal_responsibility] of examples) {
    const project = projects.find((row) => row.name === projectName);
    if (!project) continue;
    domains.push({
      ...stamps(), project_id: project.id, name, registrar_account_id: null, registered_on: null,
      expires_on: date(days), renewal_price, currency, auto_renew: false,
      status: "active", renewal_responsibility, notes,
    });
  }
  const hostingExamples = [
    ["Powder Brows Vienna", "Shared Hosting", "Demo Shared Plan", "Annual", 24, 79.90, "EUR"],
    ["Dulova Skola", "Shared Hosting", "Demo Education Plan", "Quarterly", 75, 2900, "RSD"],
    ["Frankultura", "Serverless", "Demo Web Plan", "Monthly", 6, 20, "USD"],
  ] as const;
  for (const [projectName, hosting_type, plan_name, billing_cycle, days, renewal_price, currency] of hostingExamples) {
    const project = projects.find((row) => row.name === projectName);
    if (!project) continue;
    const link = projectAccounts.find((row) => row.project_id === project.id &&
      (row.purpose === "Website hosting" || row.purpose === "Website deployment"));
    if (!link?.service_account_id) continue;
    hosting.push({
      ...stamps(), project_id: project.id, hosting_account_id: link.service_account_id,
      hosting_type, plan_name, server_notes: null, billing_cycle, renews_on: date(days), renewal_price,
      currency, auto_renew: true, status: "active", renewal_responsibility: "nmark", notes,
    });
  }
  return { domains, hosting };
}
