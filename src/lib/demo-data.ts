import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { isDemoMode } from "./env";
import type { Client, Project } from "./database";

type DemoData = { clients: Client[]; projects: Project[] };

function seed(): DemoData {
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

const directory = join(process.cwd(), ".client-hub-demo");
const filename = join(directory, "data.json");

function writeDemo(data: DemoData) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, randomUUID() + ".tmp");
  writeFileSync(temporary, JSON.stringify(data), { mode: 0o600, flag: "wx" });
  renameSync(temporary, filename);
}

export function readDemo(): DemoData {
  if (!isDemoMode()) throw new Error("Demo data requires local development mode.");
  try {
    return JSON.parse(readFileSync(filename, "utf8")) as DemoData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const data = seed();
    writeDemo(data);
    return data;
  }
}

export function changeDemo<T>(operation: (data: DemoData) => T): T {
  const data = readDemo();
  const result = operation(data);
  writeDemo(data);
  return result;
}
