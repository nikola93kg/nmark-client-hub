import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { admin, openHubPostgres, other } from "./hub-postgres";

const fk = (error: Error & { code?: string }) => error.code === "23001" || error.code === "23503";
const renewedOn = "2026-11-23";

test("Phase 3 preserves existing assets and protects CRUD and atomic renewal history", async (t) => {
  const { pg, authenticate } = await openHubPostgres(t);
  await pg.exec(await readFile(new URL("../supabase/migrations/20261123010000_service_accounts.sql", import.meta.url), "utf8"));
  await pg.query("insert into hub_private.administrator (user_id) values ($1)", [admin]);
  const [project, secondProject] = (await pg.query<{ id: string }>(`
    with client as (insert into public.clients (name) values ('Client') returning id)
    insert into public.projects (client_id,name) select id, unnest(array['Project','Second project']) from client returning id
  `)).rows;
  const [registrar, hostingAccount] = (await pg.query<{ id: string }>(`
    with provider as (insert into public.service_providers (name,category) values ('Example co','Hosting') returning id)
    insert into public.service_accounts (provider_id,label,ownership_type)
      select id,unnest(array['Registrar account','Hosting account']),'shared' from provider returning id
  `)).rows;
  const legacy = (await pg.query<{ id: string }>(
    "insert into public.domains (name,project_id,status) values ('Legacy.EXAMPLE.',$1,'active') returning id", [project.id]
  )).rows[0];

  await pg.exec(await readFile(new URL("../supabase/migrations/20261123020000_domains_hosting.sql", import.meta.url), "utf8"));

  let domainId: string;
  let hostingId: string;
  const eventId = randomUUID();
  const hostEventId = randomUUID();
  const record = (id: string, kind: string, target: string, next: string | null = null, notes = "Manual test") => pg.query<{ id: string }>(
    "select public.record_asset_renewal($1,$2,$3,$4,'2026-11-23','2027-11-23',20.50,'EUR','2026-11-23','paid',$5,$6) as id",
    [id, kind, target, renewedOn, next, notes]
  );
  const dateFor = async (table: "domains" | "hosting_services", column: "expires_on" | "renews_on", id: string) =>
    (await pg.query<{ date: string }>(`select ${column}::text as date from public.${table} where id = $1`, [id])).rows[0]?.date;

  await t.test("domains and hosting can be created, read and edited by the MFA administrator", async () => {
    await authenticate(admin, "aal2");
    const existing = await pg.query("select name,renewal_responsibility from public.domains where id = $1", [legacy.id]);
    assert.deepEqual(existing.rows, [{ name: "Legacy.EXAMPLE.", renewal_responsibility: null }]);
    const domain = await pg.query<{ id: string }>(
      "insert into public.domains (name,project_id,registrar_account_id,status,renewal_responsibility,expires_on,renewal_price,currency) values ('new.example',$1,$2,'active','client','2026-11-22',25,'USD') returning id",
      [project.id, registrar.id]
    );
    domainId = domain.rows[0].id;
    const host = await pg.query<{ id: string }>(
      "insert into public.hosting_services (project_id,hosting_account_id,hosting_type,plan_name,billing_cycle,status,renewal_responsibility,renews_on) values ($1,$2,'VPS','Production','Monthly','active','nmark','2027-01-01') returning id",
      [project.id, hostingAccount.id]
    );
    hostingId = host.rows[0].id;
    assert.equal((await pg.query("update public.domains set renewal_responsibility = 'other' where id = $1", [domainId])).affectedRows, 1);
    assert.equal((await pg.query("update public.hosting_services set plan_name = 'Production VPS' where id = $1", [hostingId])).affectedRows, 1);
    assert.equal((await pg.query<{ registrar_account_id: string }>("select registrar_account_id from public.domains where id = $1", [domainId])).rows[0].registrar_account_id, registrar.id);
    assert.equal((await pg.query<{ hosting_account_id: string }>("select hosting_account_id from public.hosting_services where id = $1", [hostingId])).rows[0].hosting_account_id, hostingAccount.id);
    await pg.query("insert into public.hosting_services (project_id,hosting_account_id,hosting_type,status) values ($1,$2,'Cloud Hosting','active')",
      [secondProject.id, hostingAccount.id]);
    assert.equal((await pg.query("select id from public.hosting_services where hosting_account_id = $1", [hostingAccount.id])).rows.length, 2);
    await assert.rejects(pg.query("delete from public.service_accounts where id = $1", [hostingAccount.id]), fk);
    await assert.rejects(pg.query("delete from public.projects where id = $1", [project.id]), fk);
  });

  await t.test("normalized names stay unique until archived and SQL rejects invalid references and fields", async () => {
    await assert.rejects(pg.query("insert into public.domains (name,project_id,status) values ('NEW.example.',$1,'active')", [project.id]), { code: "23505" });
    await assert.rejects(pg.query("insert into public.domains (name,project_id,status) values ('https://invalid.example',$1,'active')", [project.id]), { code: "23514" });
    await assert.rejects(pg.query("update public.hosting_services set billing_cycle = 'weekly' where id = $1", [hostingId]), { code: "23514" });
    await assert.rejects(pg.query("update public.hosting_services set hosting_account_id = $1 where id = $2", [randomUUID(), hostingId]), fk);
    await pg.query("update public.domains set status = 'archived' where id = $1", [legacy.id]);
    const replacement = await pg.query<{ id: string }>("insert into public.domains (name,project_id,status) values ('legacy.example',$1,'active') returning id", [project.id]);
    await assert.rejects(pg.query("update public.domains set status = 'active' where id = $1", [legacy.id]), { code: "23505" });
    assert.equal((await pg.query("delete from public.domains where id = $1", [replacement.rows[0].id])).affectedRows, 1);
    assert.equal((await pg.query("delete from public.hosting_services where project_id = $1", [secondProject.id])).affectedRows, 1);
  });

  await t.test("a renewal appends history and changes the schedule only when explicitly requested", async () => {
    await record(eventId, "domains", domainId, "2027-11-23");
    assert.equal(await dateFor("domains", "expires_on", domainId), "2027-11-23");
    assert.equal((await record(eventId, "domains", domainId, "2027-11-23")).rows[0].id, eventId);
    await assert.rejects(record(eventId, "domains", domainId, "2027-11-23", "Different notes"), { code: "23505" });
    await record(hostEventId, "hosting", hostingId);
    assert.equal(await dateFor("hosting_services", "renews_on", hostingId), "2027-01-01");
    const history = await pg.query("select domain_id,hosting_service_id,paid_amount,currency from public.renewal_history where id = $1", [eventId]);
    assert.deepEqual(history.rows, [{ domain_id: domainId, hosting_service_id: null, paid_amount: "20.50", currency: "EUR" }]);
    await assert.rejects(pg.query("delete from public.domains where id = $1", [domainId]), fk);
    await assert.rejects(pg.query("delete from public.hosting_services where id = $1", [hostingId]), fk);
    await pg.query("update public.hosting_services set status = 'archived' where id = $1", [hostingId]);
    assert.equal((await pg.query("select id from public.renewal_history where hosting_service_id = $1", [hostingId])).rows.length, 1);
    await assert.rejects(pg.query("delete from public.renewal_history where id = $1", [eventId]), { code: "42501" });
    await assert.rejects(pg.query("insert into public.renewal_history (id,domain_id,renewed_on,payment_status) values ($1,$2,$3,'unpaid')",
      [randomUUID(), domainId, renewedOn]), { code: "42501" });
  });

  await t.test("a failed schedule update rolls back the history insert", async () => {
    const future = (await pg.query<{ id: string }>(
      "insert into public.domains (name,project_id,status,registered_on,expires_on) values ('future.example',$1,'pending','2027-01-01','2028-01-01') returning id",
      [project.id]
    )).rows[0].id;
    const id = randomUUID();
    await assert.rejects(record(id, "domains", future, "2026-12-05"), { code: "23514" });
    assert.equal((await pg.query("select id from public.renewal_history where id = $1", [id])).rows.length, 0);
    assert.equal(await dateFor("domains", "expires_on", future), "2028-01-01");
  });

  await t.test("anonymous, other account and password-only tokens cannot read assets or append renewals", async () => {
    await pg.exec("reset role; set role anon");
    for (const table of ["domains", "hosting_services", "renewal_history"]) {
      await assert.rejects(pg.query(`select id from public.${table}`), { code: "42501" });
    }
    await assert.rejects(record(randomUUID(), "domains", domainId), { code: "42501" });
    for (const [user, aal, anonymous] of [[other, "aal2", false], [admin, "aal1", false], [admin, "aal2", true]] as const) {
      await authenticate(user, aal, anonymous);
      for (const table of ["domains", "hosting_services", "renewal_history"]) {
        assert.equal((await pg.query(`select id from public.${table}`)).rows.length, 0);
      }
      assert.equal((await pg.query("update public.domains set status = 'archived' where id = $1", [domainId])).affectedRows, 0);
      await assert.rejects(record(randomUUID(), "domains", domainId), { code: "42501" });
    }
  });
});
