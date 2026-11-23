import { optionLabel, t } from "@/lib/localization";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { pageSize, type ListFilters } from "@/lib/validation";

export function StatusBadge({ status }: { status: string }) {
  return <span className="status-badge" data-status={status}>{optionLabel(status)}</span>;
}

export function Heading({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="page-heading">
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="back-link" href={href}><ArrowLeft size={16} aria-hidden />{children}</Link>;
}

export function ListToolbar({ path, filters, statuses, collection, children, extraFiltered }: {
  path: string;
  filters: ListFilters;
  statuses: readonly string[];
  collection: "clients" | "projects" | "service accounts" | "domains" | "hosting";
  children?: ReactNode;
  extraFiltered?: boolean;
}) {
  const searches = {
    clients: "Search clients", projects: "Search projects", "service accounts": "Search service accounts",
    domains: "Search domains", hosting: "Search hosting",
  } as const;
  const search = t(searches[collection]);
  return (
    <form className="list-toolbar" method="get" action={path} role="search" aria-label={t("Filter records")}>
      <label className="search-field">
        <Search size={17} aria-hidden />
        <Input type="search" name="q" aria-label={search} placeholder={search + "…"}
          defaultValue={filters.q} maxLength={120} />
      </label>
      <div className="toolbar-field">
        <select aria-label={t("Status")} name="status" className="field-control" defaultValue={filters.status}>
          <option value="">{t("All statuses")}</option>
          {statuses.map((status) => <option key={status} value={status}>{optionLabel(status)}</option>)}
        </select>
      </div>
      <div className="toolbar-field">
        <select aria-label={t("Sort")} name="sort" className="field-control" defaultValue={filters.sort}>
          <option value="updated">{t("Recently updated")}</option>
          <option value="created">{t("Newest first")}</option>
          <option value="name">{t("Name A–Z")}</option>
          <option value="name-desc">{t("Name Z–A")}</option>
        </select>
      </div>
      {children}
      <Button variant="outline">{t("Apply")}</Button>
      {(filters.q || filters.status || filters.sort !== "updated" || extraFiltered) && (
        <Link className="text-link" href={path}>{t("Reset")}</Link>
      )}
    </form>
  );
}

export function Pagination({ path, filters, count, extra }: {
  path: string; filters: ListFilters; count: number; extra?: Record<string, string>;
}) {
  const { page, q, status, sort } = filters;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const link = (target: number) => {
    const params = new URLSearchParams();
    if (extra) for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (sort !== "updated") params.set("sort", sort);
    if (target > 1) params.set("page", String(target));
    return params.size ? `${path}?${params}` : path;
  };

  return (
    <div className="pagination">
      <span>{page > pages ? t("Page out of range") : count ? t("{start}–{end} of {count}", { start: (page - 1) * pageSize + 1, end: Math.min(page * pageSize, count), count }) : t("0 records")}</span>
      {pages > 1 || page > 1 ? (
        <nav aria-label={t("Pagination")}>
          {page > 1 && <Button asChild variant="outline"><Link href={link(page > pages ? 1 : page - 1)}><ChevronLeft size={16} />{page > pages ? t("First page") : t("Previous")}</Link></Button>}
          {page < pages && <Button asChild variant="outline"><Link href={link(page + 1)}>{t("Next")} <ChevronRight size={16} /></Link></Button>}
        </nav>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><h2>{title}</h2><p>{description}</p>{children}</div>;
}

export function DetailGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="detail-grid">
      {items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
    </dl>
  );
}

export function ExternalUrl({ url }: { url: string | null | undefined }) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
}
