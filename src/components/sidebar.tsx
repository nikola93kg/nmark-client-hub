"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Globe2, LayoutDashboard, Settings2, UsersRound, Vault } from "lucide-react";
import { Brand } from "./brand";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/projects", label: "Projects", icon: BriefcaseBusiness },
  { href: "/service-accounts", label: "Service Accounts", icon: Vault },
  { href: null, label: "Domains & Hosting", icon: Globe2 },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <Link className="brand-link" href="/" aria-label="Client Hub dashboard"><Brand /></Link>
      <nav aria-label="Workspace">
        {links.map(({ href, label, icon: Icon }) => {
          if (!href) return (
            <span key={label} className="nav-item nav-unavailable" aria-disabled="true">
              <Icon size={18} aria-hidden /> {label}<span className="nav-phase">Later</span>
            </span>
          );
          const current = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
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
