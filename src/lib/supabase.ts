import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookieOptions, supabaseConfig } from "./env";
import type { Database } from "./database";

export async function serverSupabase() {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) store.set(name, value, options);
        } catch {
          // Server Components are read-only. The proxy refreshes sessions first.
        }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export type HubSupabase = NonNullable<Awaited<ReturnType<typeof serverSupabase>>>;
