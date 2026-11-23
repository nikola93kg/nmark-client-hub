import { t } from "@/lib/localization";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, CircleCheck, FolderKanban, Plus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/record-ui";
import { ProjectTable } from "@/components/record-tables";
import { Button } from "@/components/ui/button";
import { dashboardData } from "@/lib/records";
import { renewalOverview } from "@/lib/infrastructure-records";
import { RenewalTable } from "@/components/infrastructure-ui";

export default async function DashboardPage() {
  const [{ totalClients, activeClients, activeProjects, recent }, { totalDomains, activeHosting, rows }] = await Promise.all([
    dashboardData(), renewalOverview(),
  ]);
  const overdue = rows.filter(({ days }) => days !== null && days < 0).length;
  const upcoming = rows.filter(({ days }) => days !== null && days >= 0 && days <= 30);
  const stats = [
    { label: t("Total clients"), count: totalClients, href: "/clients", icon: UsersRound },
    { label: t("Active clients"), count: activeClients, href: "/clients?status=active", icon: CircleCheck },
    { label: t("Active projects"), count: activeProjects, href: "/projects?status=active", icon: BriefcaseBusiness },
  ];

  return (
    <>
      <section className="dashboard-header">
        <div><h1>{t("Dashboard")}</h1><p>{t("Manage your clients and the projects you build for them.")}</p></div>
        <Button asChild><Link href="/clients/new"><Plus size={18} aria-hidden /> {t("Add client")}</Link></Button>
      </section>
      <section className="stats-grid" aria-label={t("Workspace totals")}>
        {stats.map(({ label, count, href, icon: Icon }) => (
          <Link className="stat" href={href} key={label}>
            <span className="stat-icon"><Icon size={19} aria-hidden /></span>
            <ArrowUpRight className="stat-arrow" size={16} aria-hidden />
            <span className="stat-value">{count}</span>
            <span className="stat-label">{label}</span>
          </Link>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading panel-heading-row">
          <div className="panel-title"><CalendarClock size={20} aria-hidden /><h2>{t("Upcoming renewals")}</h2></div>
          <Button asChild variant="outline"><Link href="/renewals">{t("View all renewals")}</Link></Button>
        </div>
        <div className="dashboard-renewal-stats">
          <Link href="/domains"><strong>{totalDomains}</strong><span>{t("Total domains")}</span></Link>
          <Link href="/hosting?status=active"><strong>{activeHosting}</strong><span>{t("Active hosting services")}</span></Link>
          <Link href="/renewals?window=30"><strong>{upcoming.length}</strong><span>{t("Due within 30 days")}</span></Link>
          <Link href="/renewals?window=overdue"><strong>{overdue}</strong><span>{t("Overdue renewals")}</span></Link>
        </div>
        {upcoming.length ? <RenewalTable rows={upcoming.slice(0, 5)} compact /> :
          <EmptyState title={t("Nothing due within 30 days")} description={t("Open Renewals to review the full schedule.")} />}
      </section>
      <section className="panel">
        <div className="panel-heading panel-heading-row">
          <div className="panel-title"><FolderKanban size={20} aria-hidden /><h2>{t("Recently updated projects")}</h2></div>
          <Button asChild variant="outline"><Link href="/projects">{t("View all projects")}</Link></Button>
        </div>
        {recent.length ? <ProjectTable rows={recent} /> : (
          <EmptyState title={t("No projects yet")} description={t("Add a project to start tracking work for a client.")}>
            <Button asChild><Link href="/projects/new"><Plus size={17} aria-hidden /> {t("Add project")}</Link></Button>
          </EmptyState>
        )}
      </section>
    </>
  );
}
