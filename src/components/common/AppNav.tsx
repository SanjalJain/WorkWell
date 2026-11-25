"use client";

import { useState } from "react";
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
  LayoutDashboard,
  Menu,
  X,
  Building2,
  FileText,
  ShieldCheck,
} from "lucide-react";

interface AppNavProps {
  role: Role;
}

export function AppNav({ role }: AppNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isClient = role === Role.CLIENT;

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
        { href: "/documents", label: "Documents", icon: FileText },
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

  const clientLinks = [
    { href: "/portal", label: "Portal Overview", icon: LayoutDashboard },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#080D0B] border-b border-[#22302A]">
        <Link href={isClient ? "/portal" : "/dashboard"} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#34D399]/15 border border-[#34D399]/40 flex items-center justify-center text-[#34D399] font-bold text-xs shadow-[0_0_8px_rgba(52,211,153,0.2)]">
            W
          </div>
          <span className="font-serif-display italic text-xl text-[#F4FAF7]">
            work<span className="text-[#34D399]">Well</span>
          </span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg bg-[#16201B] border border-[#2F4239] text-[#93A59B] hover:text-[#E8F1EC] transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown / Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#080D0B]/95 backdrop-blur-md border-b border-[#22302A] px-4 py-4 space-y-4">
          {isClient ? (
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#2DB6A8] font-semibold">
                Client Portal
              </span>
              {clientLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30"
                        : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
                    }`}
                  >
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399] shrink-0" />
                    )}
                    <Icon className="w-4 h-4 text-[#2DB6A8]" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  pathname === "/dashboard"
                    ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                    : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
                }`}
              >
                {pathname === "/dashboard" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399] shrink-0" />
                )}
                <LayoutDashboard className="w-4 h-4 text-[#34D399]" />
                <span>Dashboard</span>
              </Link>

              {navSections.map((section) => (
                <div key={section.name} className="space-y-1 pt-2 border-t border-[#22302A]">
                  <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${section.color}`}>
                    {section.name}
                  </span>
                  <div className="space-y-1">
                    {section.links.map((link) => {
                      const Icon = link.icon;
                      const isActive =
                        pathname === link.href ||
                        (link.href !== "/directory" && pathname?.startsWith(link.href));
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            isActive
                              ? "bg-[#34D399]/10 text-[#F4FAF7] border border-[#34D399]/30 shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                              : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
                          }`}
                        >
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399] shrink-0" />
                          )}
                          <Icon className="w-4 h-4" />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 bg-[#080D0B] border-r border-[#22302A] p-4 min-h-[calc(100vh-45px)] sticky top-0">
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <Link
            href={isClient ? "/portal" : "/dashboard"}
            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#16201B]/40 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#34D399]/15 border border-[#34D399]/40 flex items-center justify-center text-[#34D399] font-bold shadow-[0_0_15px_rgba(52,211,153,0.2)] group-hover:scale-105 transition-transform">
              W
            </div>
            <div>
              <div className="font-serif-display italic text-2xl font-normal text-[#F4FAF7] leading-none">
                work<span className="text-[#34D399]">Well</span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#5F6F66] mt-1">
                {isClient ? "Client Portal" : "Brightwave Studio"}
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          {isClient ? (
            <div className="space-y-1.5">
              <div className="px-2.5 pb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#2DB6A8] font-semibold">
                  External Portal
                </span>
              </div>
              {clientLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]"
                        : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-[#2DB6A8]" />
                      <span>{link.label}</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Dashboard Link */}
              <div>
                <Link
                  href="/dashboard"
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    pathname === "/dashboard"
                      ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]"
                      : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutDashboard className="w-4 h-4 text-[#34D399]" />
                    <span>Dashboard</span>
                  </div>
                  {pathname === "/dashboard" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
                  )}
                </Link>
              </div>

              {/* Functional Modules */}
              {navSections.map((section) => (
                <div key={section.name} className="space-y-1">
                  <div className="px-2.5 pb-1">
                    <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${section.color}`}>
                      {section.name}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {section.links.map((link) => {
                      const Icon = link.icon;
                      const isActive =
                        pathname === link.href ||
                        (link.href !== "/directory" && pathname?.startsWith(link.href));
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            isActive
                              ? "bg-[#34D399]/10 text-[#F4FAF7] border border-[#34D399]/25 shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                              : "text-[#93A59B] hover:text-[#E8F1EC] hover:bg-[#16201B]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4" />
                            <span>{link.label}</span>
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-[#22302A] space-y-2">
          {!isClient && (
            <Link
              href="/portal"
              target="_blank"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-[#93A59B] hover:text-[#34D399] hover:bg-[#16201B] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-[#2DB6A8]" />
                <span>Client Portal View</span>
              </div>
              <ExternalLink className="w-3 h-3 text-[#5F6F66] group-hover:text-[#34D399] transition-colors" />
            </Link>
          )}

          <div className="px-3 py-2 rounded-lg bg-[#0F1613] border border-[#22302A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
              <span className="text-[11px] font-mono text-[#93A59B]">Tenant Guard</span>
            </div>
            <span className="text-[10px] font-mono text-[#34D399] uppercase">{role}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
