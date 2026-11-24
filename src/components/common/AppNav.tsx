"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { 
  Users, 
  Network, 
  Calendar, 
  FolderKanban, 
  Clock, 
  Receipt, 
  Target, 
  Sparkles,
  ExternalLink,
  LayoutDashboard
} from "lucide-react";

interface AppNavProps {
  role: Role;
}

export function AppNav({ role }: AppNavProps) {
  const pathname = usePathname();
  const isClient = role === Role.CLIENT;

  if (isClient) {
    return (
      <header className="border-b border-[#22302A] bg-[#0F1613] px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2DB6A8]/20 border border-[#2DB6A8]/40 flex items-center justify-center text-[#2DB6A8] font-bold">
            W
          </div>
          <div>
            <div className="text-sm font-semibold text-[#E8F1EC] tracking-tight">Brightwave Client Portal</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#93A59B]">Acme Global Industries</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/portal"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30"
          >
            <span>My Projects & Invoices</span>
          </Link>
        </nav>
      </header>
    );
  }

  const navSections = [
    {
      name: "People",
      color: "text-[#34D399]",
      dotColor: "bg-[#34D399]",
      links: [
        { href: "/directory", label: "Directory", icon: Users },
        { href: "/directory/org-chart", label: "Org Chart", icon: Network },
        { href: "/leave", label: "Leave", icon: Calendar },
        { href: "/onboarding", label: "Onboarding", icon: Sparkles },
        { href: "/documents", label: "Documents", icon: Receipt },
      ],
    },
    {
      name: "Work",
      color: "text-[#2DB6A8]",
      dotColor: "bg-[#2DB6A8]",
      links: [
        { href: "/projects", label: "Projects", icon: FolderKanban },
        { href: "/timesheets", label: "Timesheets", icon: Clock },
        { href: "/billing", label: "Billing", icon: Receipt },
      ],
    },
    {
      name: "Performance",
      color: "text-[#B5E35B]",
      dotColor: "bg-[#B5E35B]",
      links: [
        { href: "/performance", label: "Talent & OKRs", icon: Target },
      ],
    },
  ];

  return (
    <header className="border-b border-[#22302A] bg-[#0F1613] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#34D399]/15 border border-[#34D399]/40 flex items-center justify-center text-[#34D399] font-bold shadow-[0_0_12px_rgba(52,211,153,0.2)]">
            W
          </div>
          <span className="font-serif-display italic text-2xl font-normal text-[#F4FAF7]">
            work<span className="text-[#34D399]">Well</span>
          </span>
        </Link>

        <nav className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              pathname === "/dashboard"
                ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Dashboard</span>
          </Link>
          {navSections.map((section) => (
            <div key={section.name} className="flex items-center gap-2 border-l border-[#22302A] pl-5 first:border-0 first:pl-0">
              <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${section.color}`}>
                {section.name}
              </span>
              <div className="flex items-center gap-1">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || (link.href !== "/directory" && pathname?.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#34D399]/10 text-[#F4FAF7] border border-[#34D399]/30 shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                          : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
                      }`}
                    >
                      {isActive && <div className={`w-1.5 h-1.5 rounded-full ${section.dotColor} animate-pulse`} />}
                      <Icon className="w-3.5 h-3.5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/portal"
          target="_blank"
          className="flex items-center gap-1.5 text-xs text-[#93A59B] hover:text-[#34D399] transition-colors font-mono"
        >
          <span>Client Portal</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </header>
  );
}
