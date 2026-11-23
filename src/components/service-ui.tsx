import { optionLabel, t } from "@/lib/localization";
import Link from "next/link";
import { ArrowUpRight, Pencil, Vault } from "lucide-react";
import { serviceUrls } from "@/lib/env";
import type { ListedAccount } from "@/lib/database";
import { safeServiceUrl, vaultItemUrl } from "@/lib/service-validation";
import { StatusBadge } from "./record-ui";
import { AccountControls } from "./service-controls";
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
    <a href={href} target="_blank" rel="noopener noreferrer"><Vault size={16} aria-hidden /> {t("Open in Pass Vault")}</a>
  </Button>;
  if (account.vault_item_id) return <span className="service-muted">{t("Pass Vault URL unavailable")}</span>;
  return <span className="service-muted">{t("Not linked")} <Link className="text-link" href={`/service-accounts/${account.id}/edit`}>{t("Edit Vault reference")}</Link></span>;
}

function AccountLinks({ account }: { account: ListedAccount }) {
  return (
    <div className="service-actions">
      <ServiceExternalLink url={account.service_providers.dashboard_url} label={t("Open provider dashboard")} />
      <ServiceExternalLink url={account.login_url} label={t("Open login URL")} />
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
              <p>{account.service_providers.name} · {optionLabel(account.ownership_type)}</p>
              {(account.email || account.username) && <p>{[account.email, account.username].filter(Boolean).join(" · ")}</p>}
            </div>
            <StatusBadge status={account.archived_at ? "archived" : "active"} />
          </div>
          <AccountLinks account={account} />
          <div className="service-actions">
            <Button asChild variant="outline"><Link href={`/service-accounts/${account.id}`}>{t("View details")}</Link></Button>
            <Button asChild variant="ghost"><Link href={`/service-accounts/${account.id}/edit`}><Pencil size={15} aria-hidden /> {t("Edit")}</Link></Button>
            <AccountControls id={account.id} label={account.label} archived={!!account.archived_at} compact />
          </div>
        </li>
      ))}
    </ul>
  );
}
