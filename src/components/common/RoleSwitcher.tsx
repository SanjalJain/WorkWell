"use client";

import { useTransition } from "react";
import { Role } from "@prisma/client";
import { switchRoleAction } from "@/app/actions/auth-actions";
import { Shield, User, Users, Briefcase, Building2, Check } from "lucide-react";

interface RoleSwitcherProps {
  currentRole: Role;
  currentName: string;
  currentEmail: string;
}

const ROLES: { role: Role; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { role: Role.OWNER, label: "Owner", icon: Shield, desc: "CEO: Full access & salaries" },
  { role: Role.HR, label: "HR", icon: Users, desc: "People Ops: Directory & comp" },
  { role: Role.MANAGER, label: "Manager", icon: Briefcase, desc: "Lead: Team & approvals" },
  { role: Role.EMPLOYEE, label: "Employee", icon: User, desc: "Engineer: Personal tasks & time" },
  { role: Role.CLIENT, label: "Client", icon: Building2, desc: "External: Invoices & project view" },
];

export function RoleSwitcher({ currentRole, currentName, currentEmail }: RoleSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (role: Role) => {
    if (role === currentRole || isPending) return;
    startTransition(async () => {
      await switchRoleAction(role);
      window.location.reload();
    });
  };

  return (
    <div className="bg-[#0b120f] border-b border-[#22302A] px-4 py-2 flex flex-wrap items-center justify-between text-xs text-[#93A59B] z-50">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
        <span className="font-mono uppercase tracking-wider text-[11px] text-[#5F6F66]">Simulate Persona:</span>
        <span className="text-[#E8F1EC] font-medium">{currentName}</span>
        <span className="bg-[#16201B] border border-[#2F4239] text-[#34D399] px-2 py-0.5 rounded-full font-mono text-[10px]">
          {currentRole}
        </span>
        <span className="text-[#5F6F66]">({currentEmail})</span>
      </div>

      <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
        {ROLES.map(({ role, label, icon: Icon, desc }) => {
          const isActive = currentRole === role;
          return (
            <button
              key={role}
              onClick={() => handleSwitch(role)}
              disabled={isPending}
              title={desc}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all font-medium ${
                isActive
                  ? "bg-[#34D399] text-[#04130C] font-semibold shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                  : "bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#22302A] hover:border-[#34D399]/40"
              } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {isActive && <Check className="w-3 h-3 ml-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
