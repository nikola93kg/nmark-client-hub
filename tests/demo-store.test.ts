import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ProjectAccount, ServiceAccount, ServiceProvider } from "../src/lib/database";
import { changeDemoFile, readDemoFile, saveDemoRecord } from "../src/lib/demo-store";

test("demo upgrades Phase 1 files in place and persists service changes across reads", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "client-hub-demo-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { clients, projects } = readDemoFile(directory);
  clients[0].city = "Example city";
  writeFileSync(join(directory, "data.json"), JSON.stringify({ clients, projects }));

  const upgraded = readDemoFile(directory);
  assert.deepEqual(upgraded.clients.filter(({ id }) => clients.some((row) => row.id === id)), clients);
  assert.deepEqual(upgraded.projects.filter(({ id }) => projects.some((row) => row.id === id)), projects);
  assert.ok(upgraded.providers.some(({ name }) => name === "Hostinger"));
  assert.ok(upgraded.accounts.every((account) => account.email === null && account.username === null && account.vault_item_id === null));
  assert.ok(upgraded.projectAccounts.some((link) => link.project_id === projects[0].id));
  assert.deepEqual(readDemoFile(directory), upgraded);

  const newId = changeDemoFile(directory, (data) => {
    const provider = saveDemoRecord<ServiceProvider>(data.providers, undefined,
      { name: "Example Provider", category: "Other", website_url: null, dashboard_url: null });
    const account = saveDemoRecord<ServiceAccount>(data.accounts, undefined, {
      provider_id: provider.id!, label: "Example account", ownership_type: "mine",
      email: null, username: null, login_url: null, vault_item_id: null, notes: null, archived_at: null,
    });
    saveDemoRecord<ProjectAccount>(data.projectAccounts, undefined,
      { project_id: projects[0].id, service_account_id: account.id!, purpose: "Demo purpose", notes: null });
    return account.id;
  });
  assert.equal(readDemoFile(directory).accounts.find((row) => row.id === newId)?.label, "Example account");
  assert.ok(readDemoFile(directory).projectAccounts.some((row) => row.service_account_id === newId));

  changeDemoFile(directory, (data) => {
    data.projectAccounts = data.projectAccounts.filter((row) => row.service_account_id !== newId);
    data.accounts.find((row) => row.id === newId)!.archived_at = "2026-11-23T12:00:00.000Z";
  });
  assert.equal(readDemoFile(directory).accounts.find((row) => row.id === newId)?.archived_at, "2026-11-23T12:00:00.000Z");
  assert.ok(readDemoFile(directory).projectAccounts.every((row) => row.service_account_id !== newId));
});

test("demo upgrades Phase 2 infrastructure and keeps saved renewal history on disk", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "client-hub-infra-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { clients, projects, providers, accounts, projectAccounts } = readDemoFile(directory);
  writeFileSync(join(directory, "data.json"), JSON.stringify({ clients, projects, providers, accounts, projectAccounts }));
  const data = readDemoFile(directory);
  assert.deepEqual(data.projectAccounts, projectAccounts);
  assert.equal(data.domains.length, 5);
  assert.ok(data.domains.every(({ name, notes }) => name.endsWith(".example") && notes?.includes("demo")));
  assert.equal(data.hosting.length, 3);
  assert.ok(data.hosting.every(({ hosting_account_id }) => accounts.some(({ id }) => id === hosting_account_id)));
  const domain = data.domains[0];
  changeDemoFile(directory, (draft) => {
    draft.renewalHistory.push({
      id: "11111111-1111-4111-8111-111111111111", domain_id: domain.id, hosting_service_id: null,
      renewed_on: "2026-11-23", period_start: null, period_end: null, paid_amount: 20, currency: "EUR",
      paid_on: null, payment_status: "paid", next_renewal_on: "2028-11-23", notes: "Fictional test",
      created_at: "2026-11-23T11:00:00.000Z",
    });
    draft.domains[0].expires_on = "2028-11-23";
  });
  const saved = readDemoFile(directory);
  assert.equal(saved.domains[0].expires_on, "2028-11-23");
  assert.equal(saved.renewalHistory[0].domain_id, domain.id);
  assert.equal(saved.renewalHistory[0].paid_amount, 20);
});

test("project workflow upgrades existing demo once and persists provider-only links without altering infrastructure", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "client-hub-workflow-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const initial = readDemoFile(directory);
  const project = initial.projects.find(({ name }) => name === "Ilić Enterijer (demo)")!;
  const known = initial.projectAccounts.find((row) => row.project_id === project.id)!;
  assert.equal(known.service_account_id, null);
  assert.equal(known.service_kind, "contact_form");
  assert.equal(initial.providers.find(({ id }) => id === known.provider_id)?.name, "Web3Forms");
  assert.equal(known.destination_email, "kontakt@ilic-enterijer.example");
  assert.equal(initial.domains.find((row) => row.project_id === project.id)?.expires_on, null);
  assert.equal(initial.hosting.find((row) => row.project_id === project.id)?.renews_on, null);
  assert.equal(initial.projectAccounts.some((row) => row.project_id === project.id && row.service_kind === "analytics"), false);

  const id = changeDemoFile(directory, (draft) => saveDemoRecord<ProjectAccount>(draft.projectAccounts, undefined, {
    project_id: project.id, service_account_id: null, provider_id: known.provider_id, service_kind: "contact_form",
    purpose: "Test form", destination_email: "second@ilic-enterijer.example", routing_notes: "Drugi demo obrazac.", notes: null,
  }).id);
  const saved = readDemoFile(directory);
  assert.equal(saved.projectAccounts.find((row) => row.id === id)?.routing_notes, "Drugi demo obrazac.");
  assert.deepEqual(saved.domains, initial.domains);
  assert.deepEqual(saved.hosting, initial.hosting);
  assert.equal(saved.projects.filter(({ name }) => name === "Ilić Enterijer (demo)").length, 1);
});

test("adding the fictional project preserves a pre-existing project with the same base name", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "client-hub-demo-name-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { clients, projects, providers, accounts, projectAccounts, domains, hosting, renewalHistory } = readDemoFile(directory);
  const seeded = projects.find(({ name }) => name === "Ilić Enterijer (demo)")!;
  const earlier = { ...seeded, name: "Ilić Enterijer", project_type: "Unlisted custom value", website: "https://existing.example" };
  writeFileSync(join(directory, "data.json"), JSON.stringify({
    clients: clients.map((row) => row.id === seeded.client_id ? { ...row, name: earlier.name } : row),
    projects: projects.map((row) => row.id === earlier.id ? earlier : row),
    providers, accounts, projectAccounts, domains, hosting, renewalHistory,
  }));
  const upgraded = readDemoFile(directory);
  assert.deepEqual(upgraded.projects.find(({ id }) => id === earlier.id), earlier);
  assert.equal(upgraded.projects.filter(({ name }) => name === "Ilić Enterijer (demo)").length, 1);
  assert.equal(upgraded.projects.find(({ name }) => name === "Ilić Enterijer (demo)")?.website, "https://ilic-enterijer.example");
});
