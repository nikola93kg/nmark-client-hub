"use server";

import { t } from "@/lib/localization";
import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { demoCookie, hubSession } from "@/lib/auth";
import { cookieOptions, isDemoMode } from "@/lib/env";
import { safeDestination } from "@/lib/navigation";
import { serverSupabase } from "@/lib/supabase";
import { idSchema } from "@/lib/validation";

export type AuthState = { error?: string; enrollment?: { id: string; qr: string } };

const credentials = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  password: z.string().min(1).max(1024),
});

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const input = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { error: t("Enter your email and password.") };

  const supabase = await serverSupabase();
  if (!supabase || isDemoMode()) return { error: t("Sign-in is unavailable.") };
  const { error } = await supabase.auth.signInWithPassword(input.data);
  if (error) return { error: t("Could not sign in with those details. Try again.") };

  const allowed = await supabase.rpc("is_hub_admin");
  if (allowed.error || !allowed.data) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: t("Could not sign in with those details. Try again.") };
  }

  redirect(`/mfa?${new URLSearchParams({ next: safeDestination(form.get("next")) })}`);
}

export async function enterDemo(form: FormData) {
  if (!isDemoMode()) redirect("/login");
  (await cookies()).set(demoCookie, "active", { path: "/", httpOnly: true, sameSite: "strict" });
  redirect(safeDestination(form.get("next")));
}

export async function signOut() {
  if (isDemoMode()) {
    (await cookies()).delete(demoCookie);
  } else {
    const supabase = await serverSupabase();
    await supabase?.auth.signOut({ scope: "local" });
    // Clear this host's session even when the upstream revocation request fails.
    const store = await cookies();
    for (const { name } of store.getAll()) {
      if (name === cookieOptions.name || name.startsWith(cookieOptions.name + ".")) {
        store.set(name, "", { ...cookieOptions, maxAge: 0 });
      }
    }
  }
  redirect("/login");
}

export async function enrollMfa(): Promise<AuthState> {
  const session = await hubSession();
  if (session.kind !== "mfa") return { error: t("Sign in again to set up MFA.") };
  const { mfa } = session.supabase.auth;
  const existing = await mfa.listFactors();
  if (existing.error || existing.data.all.some((factor) => factor.status === "verified")) {
    return { error: t("Refresh the page to use your existing authenticator.") };
  }

  for (const factor of existing.data.all.filter((item) => item.factor_type === "totp")) {
    if ((await mfa.unenroll({ factorId: factor.id })).error) {
      return { error: t("Could not restart authenticator setup. Try again.") };
    }
  }

  const enrollment = await mfa.enroll({ factorType: "totp", friendlyName: "NMark Client Hub", issuer: "NMark Designs" });
  if (enrollment.error) return { error: t("Could not start authenticator setup. Try again.") };

  const { id, totp } = enrollment.data;
  const svg = totp.qr_code.slice(totp.qr_code.indexOf(",") + 1);
  return { enrollment: { id, qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` } };
}

export async function verifyMfa(_: AuthState, form: FormData): Promise<AuthState> {
  const session = await hubSession();
  if (session.kind !== "mfa") return { error: t("Sign in again to verify your code.") };
  const invalid = { error: t("Could not verify that code. Use the latest code from your authenticator.") };
  const factorId = idSchema.safeParse(form.get("factorId"));
  const code = z.string().regex(/^\d{6}$/).safeParse(form.get("code"));
  if (!factorId.success || !code.success) return invalid;

  const { mfa } = session.supabase.auth;
  const factors = await mfa.listFactors();
  if (factors.error) return invalid;
  const factor = factors.data.all.find((item) => item.id === factorId.data && item.factor_type === "totp");
  if (!factor || (factor.status !== "verified" && factors.data.all.some((item) => item.status === "verified"))) return invalid;
  if ((await mfa.challengeAndVerify({ factorId: factor.id, code: code.data })).error) return invalid;
  redirect(safeDestination(form.get("next")));
}
