import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { admin, openHubPostgres, other } from "./hub-postgres";

const itemId = "11111111-1111-4111-8111-111111111111";
const foreignKeyViolation = (error: Error & { code?: string }) => error.code === "23503" || error.code === "23001";

test("Phase 2 migration retains existing records and secures providers, accounts and project links", async (t) => {
  const { pg, authenticate } = await openHubPostgres(t);
  await pg.query("insert into hub_private.administrator (user_id) values ($1)", [admin]);
  const clientId = (await pg.query<{ id: string }>("insert into public.clients (name) values ('Phase 1 client') returning id")).rows[0].id;
  const [project, otherProject] = (await pg.query<{ id: string }>(
    "insert into public.projects (name,client_id) values ('Project A',$1),('Project B',$1) returning id", [clientId]
  )).rows;
  const oldProvider = (await pg.query<{ id: string }>(
    "insert into public.service_providers (name,category) values ('Legacy host','Hosting') returning id"
  )).rows[0].id;
  const oldAccount = (await pg.query<{ id: string }>(
    "insert into public.service_accounts (provider_id,label,ownership_type) values ($1,'Legacy account','client') returning id", [oldProvider]
  )).rows[0].id;
  await pg.query(
    "insert into public.project_service_accounts (project_id,service_account_id,purpose) values ($1,$2,'Web'),($1,$2,'web')",
    [project.id, oldAccount]
  );

  await pg.exec(await readFile(new URL("../supabase/migrations/20261123010000_service_accounts.sql", import.meta.url), "utf8"));

  await t.test("additive changes keep prior rows, default archive to null and leave later tables private", async () => {
    await authenticate(admin, "aal2");
    assert.equal((await pg.query("select id from public.clients where id = $1", [clientId])).rows.length, 1);
    assert.equal((await pg.query("select id from public.projects")).rows.length, 2);
    assert.deepEqual((await pg.query("select archived_at from public.service_accounts where id = $1", [oldAccount])).rows, [{ archived_at: null }]);
    assert.equal((await pg.query("select id from public.project_service_accounts where service_account_id = $1", [oldAccount])).rows.length, 2);
    await assert.rejects(pg.query("select * from public.domains"), { code: "42501" });
    await assert.rejects(pg.query("select * from public.hosting_services"), { code: "42501" });
  });

  let providerId: string;
  let accountId: string;
  await t.test("MFA admin can create, read and edit providers and accounts with validated identifiers", async () => {
    const provider = await pg.query<{ id: string }>(
      "insert into public.service_providers (name,category,website_url) values ('Example Provider','Hosting','https://example.test') returning id"
    );
    providerId = provider.rows[0].id;
    await assert.rejects(pg.query(
      "insert into public.service_providers (name,category) values (' example provider ','Hosting')"
    ), { code: "23505" });
    await assert.rejects(pg.query(
      "insert into public.service_providers (name,category) values ('Not a category','Bad')"
    ), { code: "23514" });
    assert.equal((await pg.query("update public.service_providers set category = 'Deployment' where id = $1", [providerId])).affectedRows, 1);
    const account = await pg.query<{ id: string; search_text: string }>(
      "insert into public.service_accounts (provider_id,label,username,ownership_type,vault_item_id) values ($1,'Main account','Support_Team+Ops','shared',$2) returning id,search_text",
      [providerId, itemId]
    );
    accountId = account.rows[0].id;
    assert.match(account.rows[0].search_text, /Main account.*Support_Team/);
    assert.equal((await pg.query("select id from public.service_accounts where search_text ~* $1", ["***=support_team+ops"])).rows.length, 1);
    assert.equal((await pg.query("select id from public.service_accounts where search_text ~* $1", ["***=support.team+ops"])).rows.length, 0);
    assert.deepEqual((await pg.query("select vault_item_id, email from public.service_accounts where id = $1", [accountId])).rows,
      [{ vault_item_id: itemId, email: null }]);
    assert.equal((await pg.query("update public.service_accounts set label = 'Edited label' where id = $1", [accountId])).affectedRows, 1);
    await assert.rejects(pg.query("update public.service_accounts set vault_item_id = 'wrong' where id = $1", [accountId]), { code: "22P02" });
    await assert.rejects(pg.query("update public.service_accounts set login_url = 'https://example.test/?token=example' where id = $1", [accountId]), { code: "23514" });
    await assert.rejects(pg.query("update public.service_providers set dashboard_url = 'https://user:example@example.test' where id = $1", [providerId]), { code: "23514" });
  });

  await t.test("only an MFA-verified allowlisted admin can read or mutate the three tables", async () => {
    const tables = ["service_providers", "service_accounts", "project_service_accounts"];
    await pg.exec("reset role; set role anon;");
    for (const table of tables) await assert.rejects(pg.query(`select id from public.${table}`), { code: "42501" });
    for (const [user, aal, anonymous] of [[other, "aal2", false], [admin, "aal1", false], [admin, "aal2", true]] as const) {
      await authenticate(user, aal, anonymous);
      for (const table of tables) {
        assert.equal((await pg.query(`select id from public.${table}`)).rows.length, 0);
        assert.equal((await pg.query(`delete from public.${table}`)).affectedRows, 0);
      }
      await assert.rejects(pg.query("insert into public.service_providers (name,category) values ('Blocked','Other')"), { code: "42501" });
      await assert.rejects(pg.query("insert into public.service_accounts (provider_id,label,ownership_type) values ($1,'Blocked','mine')", [providerId]), { code: "42501" });
      await assert.rejects(pg.query("insert into public.project_service_accounts (project_id,service_account_id,purpose) values ($1,$2,'Blocked')",
        [project.id, accountId]), { code: "42501" });
    }
  });

  await t.test("many-to-many links prevent duplicate purposes, protect referenced rows and only unlink the relationship", async () => {
    await authenticate(admin, "aal2");
    const link = (projectId: string, account: string, purpose: string) => pg.query(
      "insert into public.project_service_accounts (project_id,service_account_id,purpose,notes) values ($1,$2,$3,'Example note')",
      [projectId, account, purpose]
    );
    await link(project.id, accountId, "Hosting");
    await link(otherProject.id, accountId, "Hosting");
    await link(project.id, oldAccount, "Deployment");
    await link(project.id, accountId, "Email");
    await assert.rejects(link(project.id, accountId, "Hosting"), { code: "23505" });
    await assert.rejects(link(project.id, accountId, " hosting "), { code: "23505" });
    assert.equal((await pg.query("select id from public.project_service_accounts where project_id = $1", [project.id])).rows.length, 5);
    assert.equal((await pg.query("select id from public.project_service_accounts where service_account_id = $1", [accountId])).rows.length, 3);
    await assert.rejects(pg.query("delete from public.service_providers where id = $1", [providerId]), foreignKeyViolation);
    await assert.rejects(pg.query("delete from public.service_accounts where id = $1", [accountId]), foreignKeyViolation);
    await assert.rejects(pg.query("delete from public.projects where id = $1", [otherProject.id]), foreignKeyViolation);

    await pg.query("update public.service_accounts set archived_at = now() where id = $1", [accountId]);
    await assert.rejects(link(project.id, accountId, "Database"), { code: "23514" });
    assert.equal((await pg.query("select id from public.project_service_accounts where service_account_id = $1", [accountId])).rows.length, 3);
    await pg.query("update public.service_accounts set archived_at = null where id = $1", [accountId]);
    await link(project.id, accountId, "Database");
    await pg.query("delete from public.project_service_accounts where service_account_id = $1", [accountId]);
    assert.equal((await pg.query("select id from public.service_accounts where id = $1", [accountId])).rows.length, 1);
    assert.equal((await pg.query("delete from public.service_accounts where id = $1", [accountId])).affectedRows, 1);
    assert.equal((await pg.query("delete from public.service_providers where id = $1", [providerId])).affectedRows, 1);
  });
});
