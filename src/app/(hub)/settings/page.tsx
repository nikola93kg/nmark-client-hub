import { t } from "@/lib/localization";
import { DetailGrid, ExternalUrl, Heading } from "@/components/record-ui";
import { requireAdmin } from "@/lib/auth";
import { serviceUrls } from "@/lib/env";

export const metadata = { title: t("Settings") };

export default async function SettingsPage() {
  const session = await requireAdmin();
  return (
    <>
      <Heading title={t("Settings")} />
      <section className="panel detail-panel">
        <div className="panel-heading"><h2>{t("Workspace access")}</h2></div>
        <DetailGrid items={[
          [t("Signed in as"), session.email],
          [t("Authentication"), session.kind === "demo" ? t("Local demo session") : t("Administrator · MFA verified")],
        ]} />
      </section>
      <section className="panel detail-panel">
        <div className="panel-heading"><h2>{t("Configured service URLs")}</h2></div>
        <DetailGrid items={[
          ["Client Hub", serviceUrls.app ? <ExternalUrl key="hub" url={serviceUrls.app} /> : t("Not configured")],
          [t("Admin Portal"), serviceUrls.admin ? <ExternalUrl key="admin" url={serviceUrls.admin} /> : t("Not configured")],
          ["Pass Vault", serviceUrls.vault ? <ExternalUrl key="vault" url={serviceUrls.vault} /> : t("Not configured")],
        ]} />
      </section>
    </>
  );
}
