import { DetailGrid, ExternalUrl, Heading } from "@/components/record-ui";
import { requireAdmin } from "@/lib/auth";
import { serviceUrls } from "@/lib/env";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireAdmin();
  return (
    <>
      <Heading title="Settings" />
      <section className="panel detail-panel">
        <div className="panel-heading"><h2>Workspace access</h2></div>
        <DetailGrid items={[
          ["Signed in as", session.email],
          ["Authentication", session.kind === "demo" ? "Local demo session" : "Administrator · MFA verified"],
        ]} />
      </section>
      <section className="panel detail-panel">
        <div className="panel-heading"><h2>Configured service URLs</h2></div>
        <DetailGrid items={[
          ["Client Hub", serviceUrls.app ? <ExternalUrl key="hub" url={serviceUrls.app} /> : "Not configured"],
          ["Admin Portal", serviceUrls.admin ? <ExternalUrl key="admin" url={serviceUrls.admin} /> : "Not configured"],
          ["Pass Vault", serviceUrls.vault ? <ExternalUrl key="vault" url={serviceUrls.vault} /> : "Not configured"],
        ]} />
      </section>
    </>
  );
}
