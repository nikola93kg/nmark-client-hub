import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { pageSize, type ListFilters } from "@/lib/validation";

export function StatusBadge({ status }: { status: string }) {
  return <span className="status-badge" data-status={status}>{status}</span>;
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

export function ListToolbar({ path, filters, statuses, collection }: {
  path: string;
  filters: ListFilters;
  statuses: readonly string[];
  collection: "clients" | "projects";
}) {
  return (
    <form className="list-toolbar" method="get" action={path} role="search" aria-label={`Filter ${collection}`}>
      <label className="search-field">
        <Search size={17} aria-hidden />
        <Input type="search" name="q" aria-label={`Search ${collection}`} placeholder={`Search ${collection}…`}
          defaultValue={filters.q} maxLength={120} />
      </label>
      <div className="toolbar-field">
        <select aria-label="Status" name="status" className="field-control" defaultValue={filters.status}>
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{capitalize(status)}</option>)}
        </select>
      </div>
      <div className="toolbar-field">
        <select aria-label="Sort" name="sort" className="field-control" defaultValue={filters.sort}>
          <option value="updated">Recently updated</option>
          <option value="created">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </select>
      </div>
      <Button variant="outline">Apply</Button>
      {(filters.q || filters.status || filters.sort !== "updated") && (
        <Link className="text-link" href={path}>Reset</Link>
      )}
    </form>
  );
}

export function Pagination({ path, filters, count }: { path: string; filters: ListFilters; count: number }) {
  const { page, q, status, sort } = filters;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const link = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (sort !== "updated") params.set("sort", sort);
    if (target > 1) params.set("page", String(target));
    return params.size ? `${path}?${params}` : path;
  };

  return (
    <div className="pagination">
      <span>{page > pages ? "Page out of range" : count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${count}` : "0 records"}</span>
      {pages > 1 || page > 1 ? (
        <nav aria-label="Pagination">
          {page > 1 && <Button asChild variant="outline"><Link href={link(page > pages ? 1 : page - 1)}><ChevronLeft size={16} />{page > pages ? "First page" : "Previous"}</Link></Button>}
          {page < pages && <Button asChild variant="outline"><Link href={link(page + 1)}>Next <ChevronRight size={16} /></Link></Button>}
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

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
