import assert from "node:assert/strict";
import { test } from "node:test";
import { admin, openHubPostgres, other } from "./hub-postgres";

test("migration enforces the single-admin MFA boundary and relational integrity", async (t) => {
  const { pg, authenticate } = await openHubPostgres(t);

  await t.test("database permits exactly one admin row and rejects anonymous table access", async () => {
    await pg.query("insert into hub_private.administrator (user_id) values ($1)", [admin]);
    await assert.rejects(pg.query("insert into hub_private.administrator (user_id) values ($1)", [other]), { code: "23505" });
    await pg.exec("set role anon");
    await assert.rejects(pg.query("select * from public.clients"), { code: "42501" });
    await assert.rejects(pg.query("select public.is_hub_admin()"), { code: "42501" });
    await pg.exec("reset role");
  });

  let clientId: string;
  let projectId: string;
  await t.test("the MFA-verified admin can create a client and project and edit their records", async () => {
    await authenticate(admin, "aal2");
    const client = await pg.query<{ id: string; created_at: Date }>(
      "insert into public.clients (name, company, status) values ('Example', 'Example Co', 'active') returning id, created_at",
    );
    clientId = client.rows[0].id;
    const project = await pg.query<{ id: string }>(
      "insert into public.projects (name, client_id) values ('Demo project', $1) returning id", [clientId],
    );
    projectId = project.rows[0].id;
    const updated = await pg.query<{ created_at: Date; updated_at: Date; search_text: string }>(
      "update public.clients set name = 'Updated client', created_at = '2000-01-01' where id = $1 returning created_at, updated_at, search_text", [clientId],
    );
    assert.deepEqual(updated.rows[0].created_at, client.rows[0].created_at);
    assert.ok(updated.rows[0].updated_at >= updated.rows[0].created_at);
    assert.match(updated.rows[0].search_text, /Updated client Example Co/);
    await assert.rejects(pg.query("select * from public.service_accounts"), { code: "42501" });
  });

  await t.test("non-admin, password-only admin and anonymous claims cannot read or mutate rows", async () => {
    for (const [user, aal, isAnonymous] of [
      [other, "aal2", false], [admin, "aal1", false], [admin, "aal2", true],
    ] as const) {
      await authenticate(user, aal, isAnonymous);
      assert.equal((await pg.query("select * from public.clients")).rows.length, 0);
      assert.equal((await pg.query("select * from public.projects")).rows.length, 0);
      assert.equal((await pg.query("update public.clients set name = 'Blocked' where id = $1", [clientId])).affectedRows, 0);
      assert.equal((await pg.query("delete from public.projects where id = $1", [projectId])).affectedRows, 0);
      await assert.rejects(pg.query("insert into public.clients (name) values ('Blocked')"), { code: "42501" });
      await assert.rejects(pg.query("insert into public.projects (name, client_id) values ('Blocked', $1)", [clientId]), { code: "42501" });
    }
  });

  await t.test("archiving preserves relationships and permanent deletion respects foreign keys", async () => {
    await authenticate(admin, "aal2");
    await assert.rejects(pg.query("delete from public.clients where id = $1", [clientId]), (error: Error & { code?: string }) =>
      error.code === "23001" || error.code === "23503"
    );
    await pg.query("update public.clients set status = 'archived' where id = $1", [clientId]);
    await pg.query("update public.projects set status = 'archived' where id = $1", [projectId]);
    assert.equal((await pg.query("select id from public.projects where client_id = $1 and status = 'archived'", [clientId])).rows.length, 1);
    assert.equal((await pg.query("delete from public.projects where id = $1", [projectId])).affectedRows, 1);
    assert.equal((await pg.query("delete from public.clients where id = $1", [clientId])).affectedRows, 1);
  });
});
