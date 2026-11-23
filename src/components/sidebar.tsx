"use client";

import { t } from "@/lib/localization";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, CalendarClock, Globe2, LayoutDashboard, Settings2, UsersRound, Vault } from "lucide-react";
import { Brand } from "./brand";

const links = [
  { href: "/", label: t("Dashboard"), icon: LayoutDashboard },
  { href: "/clients", label: t("Clients"), icon: UsersRound },
  { href: "/projects", label: t("Projects"), icon: BriefcaseBusiness },
  { href: "/service-accounts", label: t("Service Accounts"), icon: Vault },
  { href: "/domains", label: t("Domains & Hosting"), icon: Globe2 },
  { href: "/renewals", label: t("Renewals"), icon: CalendarClock },
  { href: "/settings", label: t("Settings"), icon: Settings2 },
] as const;

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <Link className="brand-link" href="/" aria-label={t("Client Hub dashboard")}><Brand /></Link>
      <nav aria-label={t("Workspace")}>
        {links.map(({ href, label, icon: Icon }) => {
          const section = href === "/domains" && (path === "/hosting" || path.startsWith("/hosting/"));
          const current = href === "/" ? path === "/" : section || path === href || path.startsWith(href + "/");
          return (
            <Link key={href} className="nav-item" aria-current={current ? "page" : undefined} href={href}>
              <Icon size={18} aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
