import { t } from "@/lib/localization";
import type { ReactNode } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/auth-actions";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";

export default async function HubLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="hub-shell">
      <a className="skip-link" href="#workspace-content">{t("Skip to content")}</a>
      <Sidebar />
      <div className="workspace">
        <header className="topbar">
          <div className="workspace-label"><ShieldCheck size={17} aria-hidden /> {t("Private workspace")}</div>
          <div className="topbar-user">
            <span className="user-email">{session.email}</span>
            <form action={signOut}>
              <Button variant="ghost" className="logout" aria-label={t("Sign out")} title={t("Sign out")}>
                <LogOut size={17} aria-hidden /><span>{t("Sign out")}</span>
              </Button>
            </form>
          </div>
        </header>
        <main className="workspace-main" id="workspace-content">
          {session.kind === "demo" && <div className="demo-notice">{t("Local demo · fictional records")}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
