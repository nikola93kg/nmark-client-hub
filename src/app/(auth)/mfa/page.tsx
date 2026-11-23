import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { MfaForm } from "@/components/auth-forms";
import { Button } from "@/components/ui/button";
import { hubSession } from "@/lib/auth";
import { safeDestination } from "@/lib/navigation";

export const metadata = { title: "Verify sign-in" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [query, session] = await Promise.all([searchParams, hubSession()]);
  const destination = safeDestination(query.next);
  if (session.kind === "admin" || session.kind === "demo") redirect(destination);
  if (session.kind !== "mfa") redirect(`/login?${new URLSearchParams({ next: destination })}`);

  const { data, error } = await session.supabase.auth.mfa.listFactors();
  const factorId = data?.totp[0]?.id;
  const unsupportedFactor = !factorId && data?.all.some((factor) => factor.status === "verified");
  return (
    <>
      <span className="auth-icon"><ShieldCheck size={23} aria-hidden /></span>
      <h1>{factorId ? "Verify your sign-in" : "Set up two-factor authentication"}</h1>
      {error ? <p className="form-error">Could not load your authenticator. Refresh and try again.</p>
        : unsupportedFactor ? <p className="form-error">This workspace uses an authenticator app. Review the account’s MFA factors in Supabase Auth.</p>
        : <>
          <p>{factorId ? "Enter the six-digit code from your authenticator app." : "An authenticator app is required to access workspace data."}</p>
          <MfaForm factorId={factorId} destination={destination} />
        </>}
      <form action={signOut}><Button variant="ghost">Sign out</Button></form>
    </>
  );
}
