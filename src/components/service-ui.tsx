import Link from "next/link";
import { ArrowUpRight, Pencil, Vault } from "lucide-react";
import { serviceUrls } from "@/lib/env";
import type { ListedAccount, ProjectAccountView } from "@/lib/database";
import { accountOwnership, safeServiceUrl, vaultItemUrl } from "@/lib/service-validation";
import { EmptyState, StatusBadge } from "./record-ui";
import { AccountControls, LinkAccountForm, UnlinkAccount } from "./service-controls";
import { Button } from "./ui/button";

export function ServiceExternalLink({ url, label }: { url: string | null; label: string }) {
  const href = safeServiceUrl(url);
  return href ? <Button asChild variant="ghost">
    <a href={href} target="_blank" rel="noopener noreferrer">{label} <ArrowUpRight size={15} aria-hidden /></a>
  </Button> : null;
}

export function VaultLink({ account }: { account: Pick<ListedAccount, "id" | "vault_item_id"> }) {
  const href = vaultItemUrl(serviceUrls.vault, account.vault_item_id);
  if (href) return <Button asChild variant="outline">
    <a href={href} target="_blank" rel="noopener noreferrer"><Vault size={16} aria-hidden /> Open in Pass Vault</a>
  </Button>;
  if (account.vault_item_id) return <span className="service-muted">Pass Vault URL unavailable</span>;
  return <span className="service-muted">Not linked <Link className="text-link" href={`/service-accounts/${account.id}/edit`}>Edit Vault reference</Link></span>;
}

function AccountLinks({ account }: { account: ListedAccount }) {
  return (
    <div className="service-actions">
      <ServiceExternalLink url={account.service_providers.dashboard_url} label="Open provider dashboard" />
      <ServiceExternalLink url={account.login_url} label="Open login URL" />
      <VaultLink account={account} />
    </div>
  );
}

export function ServiceAccountList({ rows }: { rows: ListedAccount[] }) {
  return (
    <ul className="service-list">
      {rows.map((account) => (
        <li className="service-row" key={account.id}>
          <div className="service-row-top">
            <div className="service-identity">
              <Link className="record-link" href={`/service-accounts/${account.id}`}>{account.label}</Link>
              <p>{account.service_providers.name} · {accountOwnership[account.ownership_type]}</p>
              {(account.email || account.username) && <p>{[account.email, account.username].filter(Boolean).join(" · ")}</p>}
            </div>
            <StatusBadge status={account.archived_at ? "archived" : "active"} />
          </div>
          <AccountLinks account={account} />
          <div className="service-actions">
            <Button asChild variant="outline"><Link href={`/service-accounts/${account.id}`}>View details</Link></Button>
            <Button asChild variant="ghost"><Link href={`/service-accounts/${account.id}/edit`}><Pencil size={15} aria-hidden /> Edit</Link></Button>
            <AccountControls id={account.id} label={account.label} archived={!!account.archived_at} compact />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectServices({ projectId, rows, options }: {
  projectId: string; rows: ProjectAccountView[]; options: { id: string; label: string; provider: string }[];
}) {
  return (
    <section className="panel" aria-labelledby="project-services">
      <div className="panel-heading"><h2 id="project-services">Services &amp; Accounts</h2></div>
      {rows.length ? (
        <ul className="service-list">
          {rows.map(({ id, purpose, notes, service_accounts: account }) => (
            <li className="service-row" key={id}>
              <div className="service-row-top">
                <div className="service-identity">
                  <Link className="record-link" href={`/service-accounts/${account.id}`}>{account.label}</Link>
                  <p>{account.service_providers.name} · {purpose}</p>
                  <p>{[account.email, account.username].filter(Boolean).join(" · ") || "No email or username recorded"}</p>
                  {notes && <p className="service-notes">{notes}</p>}
                </div>
                {account.archived_at && <StatusBadge status="archived" />}
              </div>
              <AccountLinks account={account} />
              <UnlinkAccount projectId={projectId} associationId={id} label={account.label} />
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No connected accounts" description="Link a service account to record what it’s used for on this project." />}
      {options.length ? <LinkAccountForm projectId={projectId} accounts={options} /> : (
        <div className="detail-notes"><Link className="text-link" href="/service-accounts/new">Add a service account</Link> to link it here.</div>
      )}
    </section>
  );
}
