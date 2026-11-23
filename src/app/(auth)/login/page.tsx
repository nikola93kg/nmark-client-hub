import { t } from "@/lib/localization";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { enterDemo } from "@/app/auth-actions";
import { SignInForm } from "@/components/auth-forms";
import { Button } from "@/components/ui/button";
import { hubSession } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { safeDestination } from "@/lib/navigation";

export const metadata = { title: t("Sign in") };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; denied?: string }> }) {
  const [query, session] = await Promise.all([searchParams, hubSession()]);
  const destination = safeDestination(query.next);
  if (session.kind === "admin" || session.kind === "demo") redirect(destination);
  if (session.kind === "mfa") redirect(`/mfa?${new URLSearchParams({ next: destination })}`);

  return (
    <>
      <span className="auth-icon"><LockKeyhole size={22} aria-hidden /></span>
      <h1>{isDemoMode() ? t("Try the local demo") : t("Sign in to Client Hub")}</h1>
      {isDemoMode() ? (
        <>
          <p>{t("Explore the workspace with fictional records stored on this machine.")}</p>
          <form action={enterDemo} className="auth-form">
            <input type="hidden" name="next" value={destination} />
            <Button>{t("Open demo")} <ArrowRight size={16} aria-hidden /></Button>
          </form>
        </>
      ) : session.kind === "unconfigured" ? (
        <p className="form-error">{t("Set the Supabase URL and publishable key to enable administrator sign-in.")}</p>
      ) : (
        <>
          <p>{t("Use your administrator account to access the workspace.")}</p>
          {(query.denied === "1" || session.kind === "denied") &&
            <p className="form-error" role="alert">{t("This account does not have workspace access.")}</p>}
          <SignInForm destination={destination} />
        </>
      )}
    </>
  );
}
