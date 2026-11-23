import { readFile } from "node:fs/promises";
import type { TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";

export const admin = "b6174942-23d6-405a-b4c1-f167199cc386";
export const other = "e0fe88d0-8437-4693-aaee-cd7b5bb3ee5f";

export async function openHubPostgres(t: TestContext) {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select (auth.jwt()->>'sub')::uuid $$;
    insert into auth.users values ('${admin}'), ('${other}');
  `);
  await pg.exec(await readFile(new URL("../supabase/migrations/20261123000000_client_hub.sql", import.meta.url), "utf8"));

  async function authenticate(user: string, aal: string, isAnonymous = false) {
    await pg.exec("reset role; set role authenticated;");
    await pg.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: user, aal, is_anonymous: isAnonymous }),
    ]);
  }

  return { pg, authenticate };
}
