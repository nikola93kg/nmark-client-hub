import { t } from "@/lib/localization";
import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import type { Client, ListedProject } from "@/lib/database";
import { projectTypeLabel } from "@/lib/project-types";
import { dateLabel } from "@/lib/utils";
import { StatusBadge } from "./record-ui";
import { RecordMenu } from "./record-menu";
import { Button } from "./ui/button";

export function ClientTable({ rows }: { rows: Client[] }) {
  return (
    <div className="table-scroll">
      <table className="records-table">
        <caption className="sr-only">{t("Clients")}</caption>
        <thead><tr><th>{t("Client")}</th><th>{t("Contact")}</th><th>{t("Status")}</th><th>{t("Updated")}</th><th><span className="sr-only">{t("Actions")}</span></th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link className="record-link" href={`/clients/${row.id}`}>{row.name}</Link>
              {row.company && <small>{row.company}</small>}
            </td>
            <td>{row.contact_person || row.email || "—"}{row.email && row.contact_person && <small>{row.email}</small>}</td>
            <td><StatusBadge status={row.status} /></td>
            <td className="date-cell">{dateLabel(row.updated_at)}</td>
            <td>
              <div className="table-actions">
                <Button asChild variant="ghost" className="icon-button">
                  <Link href={`/clients/${row.id}/edit`} aria-label={t("Edit {name}", { name: row.name })} title={t("Edit {name}", { name: row.name })}><Pencil size={15} aria-hidden /></Link>
                </Button>
                <RecordMenu collection="clients" id={row.id} name={row.name} archived={row.status === "archived"} compact />
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function ProjectTable({ rows, showClient = true }: { rows: ListedProject[]; showClient?: boolean }) {
  return (
    <div className="table-scroll">
      <table className="records-table">
        <caption className="sr-only">{t("Projects")}</caption>
        <thead><tr><th>{t("Project")}</th>{showClient && <th>{t("Client")}</th>}<th>{t("Status")}</th><th>{t("Updated")}</th><th><span className="sr-only">{t("Open project")}</span></th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link className="record-link" href={`/projects/${row.id}`}>{row.name}</Link>
              {row.project_type && <small>{projectTypeLabel(row.project_type)}</small>}
            </td>
            {showClient && <td><Link className="text-link" href={`/clients/${row.clients.id}`}>{row.clients.name}</Link></td>}
            <td><StatusBadge status={row.status} /></td>
            <td className="date-cell">{dateLabel(row.updated_at)}</td>
            <td className="end-cell">
              <Button asChild variant="ghost" className="icon-button">
                <Link href={`/projects/${row.id}`} aria-label={t("Open {name}", { name: row.name })}><ChevronRight size={17} aria-hidden /></Link>
              </Button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
