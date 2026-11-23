"use client";

import { useActionState } from "react";
import { ArrowRight, QrCode, ShieldCheck } from "lucide-react";
import { enrollMfa, signIn, verifyMfa, type AuthState } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: AuthState = {};

export function SignInForm({ destination }: { destination: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="next" value={destination} />
      <label className="field">Email address
        <Input name="email" type="email" autoComplete="username" required maxLength={254} />
      </label>
      <label className="field">Password
        <Input name="password" type="password" autoComplete="current-password" required maxLength={1024} />
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Signing in…" : "Sign in"} <ArrowRight size={16} aria-hidden /></Button>
    </form>
  );
}

function VerifyForm({ factorId, destination }: { factorId: string; destination: string }) {
  const [state, action, pending] = useActionState(verifyMfa, initial);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="next" value={destination} />
      <label className="field">Authenticator code
        <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          pattern="[0-9]{6}" required />
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Verifying…" : "Verify code"} <ShieldCheck size={17} aria-hidden /></Button>
    </form>
  );
}

export function MfaForm({ factorId, destination }: { factorId?: string; destination: string }) {
  const [state, action, pending] = useActionState(enrollMfa, initial);
  if (factorId) return <VerifyForm factorId={factorId} destination={destination} />;
  if (state.enrollment) {
    return (
      <>
        <p>Scan this QR code in your authenticator app, then enter the six-digit code.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- The enrollment image is an ephemeral data URI. */}
        <img className="mfa-qr" src={state.enrollment.qr} alt="QR code for authenticator setup" width={180} height={180} />
        <VerifyForm key={state.enrollment.id} factorId={state.enrollment.id} destination={destination} />
        <form action={action}><Button variant="ghost" disabled={pending}>Generate a new QR code</Button></form>
      </>
    );
  }
  return (
    <form action={action} className="auth-form">
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Preparing…" : "Set up authenticator"} <QrCode size={17} aria-hidden /></Button>
    </form>
  );
}
