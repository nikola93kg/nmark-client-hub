import { Brand } from "@/components/brand";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-brand"><Brand /></section>
      <section className="auth-main"><div className="auth-card">{children}</div></section>
    </main>
  );
}
