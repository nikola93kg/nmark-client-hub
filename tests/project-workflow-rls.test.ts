import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { admin, openHubPostgres, other } from "./hub-postgres";

test("project service migration extends existing links and retains single-admin MFA protection", async (t) => {
  const { pg, authenticate } = await openHubPostgres(t);
  const migrate = async (name: string) => pg.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
  await migrate("20261123010000_service_accounts.sql");
  await migrate("20261123020000_domains_hosting.sql");
  await pg.query("insert into hub_private.administrator (user_id) values ($1)", [admin]);
  const project = (await pg.query<{ id: string }>(`
    with client as (insert into public.clients (name) values ('Client') returning id)
    insert into public.projects (name,client_id,project_type) select 'Project',id,'Original custom value' from client returning id
  `)).rows[0].id;
  const [registrar, forms] = (await pg.query<{ id: string }>(`
    insert into public.service_providers (name, category)
    values ('Example Registrar', 'Domain Registrar'), ('Web3Forms', 'Other') returning id
  `)).rows.map(({ id }) => id);
  const account = (await pg.query<{ id: string }>("insert into public.service_accounts (provider_id,label,ownership_type) values ($1,'Account','client') returning id", [registrar])).rows[0].id;
  const legacy = (await pg.query<{ id: string }>(
    "insert into public.project_service_accounts (project_id,service_account_id,purpose,notes) values ($1,$2,'Domain registrar','Legacy notes') returning id",
    [project, account])).rows[0].id;
  await pg.query("insert into public.domains (project_id,registrar_account_id,name,status) values ($1,$2,'owner.example','active')", [project, account]);

  await migrate("20261123030000_project_services.sql");
  const createConfig = (kind = "contact_form", purpose = "Contact form", email = "contact@owner.example") => pg.query<{ id: string }>(
    "insert into public.project_service_accounts (project_id,provider_id,service_kind,purpose,destination_email,routing_notes) values ($1,$2,$3,$4,$5,'To mailbox') returning id",
    [project, forms, kind, purpose, email]);
  let configuration: string;

  await t.test("MFA admin can retain old links and add a provider-only contact form", async () => {
    await authenticate(admin, "aal2");
    assert.deepEqual((await pg.query("select project_type from public.projects where id = $1", [project])).rows, [{ project_type: "Original custom value" }]);
    assert.deepEqual((await pg.query(
      "select service_account_id,provider_id,service_kind,notes from public.project_service_accounts where id=$1", [legacy])).rows,
      [{ service_account_id: account, provider_id: null, service_kind: null, notes: "Legacy notes" }]);
    assert.equal((await pg.query("select registrar_account_id from public.domains where project_id=$1", [project])).rows.length, 1);
    configuration = (await createConfig()).rows[0].id;
    assert.deepEqual((await pg.query(
      "select provider_id,service_account_id,destination_email,routing_notes from public.project_service_accounts where id=$1", [configuration])).rows,
      [{ provider_id: forms, service_account_id: null, destination_email: "contact@owner.example", routing_notes: "To mailbox" }]);
    await pg.query("insert into public.project_service_accounts (project_id,service_account_id,service_kind,purpose) values ($1,$2,'dns','DNS')", [project, account]);
  });

  await t.test("source, routing, duplicate and delete constraints protect logical relationships", async () => {
    await assert.rejects(createConfig("contact_form", " contact FORM "), { code: "23505" });
    await assert.rejects(createConfig("analytics", "Analytics"), { code: "23514" });
    await assert.rejects(createConfig("contact_form", "Second contact", "invalid"), { code: "23514" });
    await assert.rejects(pg.query(
      "insert into public.project_service_accounts (project_id,service_account_id,provider_id,purpose) values ($1,$2,$3,'Both')",
      [project, account, forms]), { code: "23514" });
    await assert.rejects(pg.query("insert into public.project_service_accounts (project_id,purpose) values ($1,'Neither')", [project]), { code: "23514" });
    await assert.rejects(pg.query("delete from public.service_providers where id=$1", [forms]),
      (error: Error & { code?: string }) => error.code === "23503" || error.code === "23001");
    assert.equal((await pg.query("delete from public.project_service_accounts where id=$1", [configuration])).affectedRows, 1);
    assert.equal((await pg.query("select id from public.service_providers where id=$1", [forms])).rows.length, 1);
    assert.equal((await pg.query("select id from public.service_accounts where id=$1", [account])).rows.length, 1);
  });

  await t.test("unauthorized callers cannot read or write either connection kind", async () => {
    await pg.exec("reset role; set role anon");
    await assert.rejects(pg.query("select * from public.project_service_accounts"), { code: "42501" });
    await assert.rejects(createConfig(), { code: "42501" });
    for (const [user, aal, anon] of [[other, "aal2", false], [admin, "aal1", false], [admin, "aal2", true]] as const) {
      await authenticate(user, aal, anon);
      assert.equal((await pg.query("select id from public.project_service_accounts")).rows.length, 0);
      await assert.rejects(createConfig(), { code: "42501" });
      assert.equal((await pg.query("delete from public.project_service_accounts where id=$1", [legacy])).affectedRows, 0);
    }
  });
});
