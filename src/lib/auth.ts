import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "./env";
import { serverSupabase, type HubSupabase } from "./supabase";
import { safeDestination } from "./navigation";

export const demoCookie = "nmark-client-hub-demo";

type HubSession =
  | { kind: "unconfigured" | "signed-out" | "denied" }
  | { kind: "demo"; email: string }
  | { kind: "mfa" | "admin"; email: string; supabase: HubSupabase };

export const hubSession = cache(async (): Promise<HubSession> => {
  if (isDemoMode()) {
    return (await cookies()).get(demoCookie)?.value === "active"
      ? { kind: "demo", email: "Local demo" }
      : { kind: "signed-out" };
  }

  const supabase = await serverSupabase();
  if (!supabase) return { kind: "unconfigured" };
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { kind: "signed-out" };
  const allowed = await supabase.rpc("is_hub_admin");
  if (allowed.error) throw new Error("Could not verify workspace access.");
  if (!allowed.data) return { kind: "denied" };
  return {
    kind: claims.aal === "aal2" ? "admin" : "mfa",
    email: typeof claims.email === "string" ? claims.email : "Administrator",
    supabase,
  };
});

export async function requireAdmin() {
  const session = await hubSession();
  if (session.kind === "admin" || session.kind === "demo") return session;
  const destination = safeDestination((await headers()).get("x-client-hub-path"));
  const query = new URLSearchParams({ next: destination });
  if (session.kind === "mfa") redirect(`/mfa?${query}`);
  if (session.kind === "denied") query.set("denied", "1");
  redirect(`/login?${query}`);
}
