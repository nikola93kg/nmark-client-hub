import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CircleCheck, FolderKanban, Plus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/record-ui";
import { ProjectTable } from "@/components/record-tables";
import { Button } from "@/components/ui/button";
import { dashboardData } from "@/lib/records";

export default async function DashboardPage() {
  const { totalClients, activeClients, activeProjects, recent } = await dashboardData();
  const stats = [
    { label: "Total clients", count: totalClients, href: "/clients", icon: UsersRound },
    { label: "Active clients", count: activeClients, href: "/clients?status=active", icon: CircleCheck },
    { label: "Active projects", count: activeProjects, href: "/projects?status=active", icon: BriefcaseBusiness },
  ];

  return (
    <>
      <section className="dashboard-header">
        <div><h1>Dashboard</h1><p>Manage your clients and the projects you build for them.</p></div>
        <Button asChild><Link href="/clients/new"><Plus size={18} aria-hidden /> Add client</Link></Button>
      </section>
      <section className="stats-grid" aria-label="Workspace totals">
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
          <div className="panel-title"><FolderKanban size={20} aria-hidden /><h2>Recently updated projects</h2></div>
          <Button asChild variant="outline"><Link href="/projects">View all projects</Link></Button>
        </div>
        {recent.length ? <ProjectTable rows={recent} /> : (
          <EmptyState title="No projects yet" description="Add a project to start tracking work for a client.">
            <Button asChild><Link href="/projects/new"><Plus size={17} aria-hidden /> Add project</Link></Button>
          </EmptyState>
        )}
      </section>
    </>
  );
}
