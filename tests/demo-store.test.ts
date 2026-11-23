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
  assert.deepEqual(upgraded.clients, clients);
  assert.deepEqual(upgraded.projects, projects);
  assert.equal(upgraded.providers.length, 11);
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
