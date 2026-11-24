import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listEmployees } from "@/modules/people/service";
import { canViewCompensation } from "@/modules/people/policies";
import { rawPrisma } from "@/lib/db";
import { Users, Building2, ShieldAlert, ArrowRight, Network, Lock, DollarSign } from "lucide-react";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

interface DirectoryPageProps {
  searchParams: Promise<{ search?: string; departmentId?: string; page?: string }>;
}

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;
  const search = resolvedParams.search ?? "";
  const departmentId = resolvedParams.departmentId ?? "";

  const [data, departments] = await Promise.all([
    listEmployees({ search, departmentId: departmentId || undefined, page, limit: 12 }, user),
    rawPrisma.department.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  const canSeeComp = canViewCompensation(user);

  return (
    <div className="space-y-8">
      {/* Page Title with Signature Verdant Night emerald italic word */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Your <span className="italic text-[#34D399]">people</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Staff directory, organizational reporting lines, and role-governed profiles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/directory/org-chart"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] text-xs font-medium transition-all"
          >
            <Network className="w-4 h-4 text-[#34D399]" />
            <span>Interactive Org Chart</span>
          </Link>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card p-5 spotlight-card">
          <span className="font-mono-label">Active Headcount</span>
          <div className="font-serif-display text-3xl text-pearl mt-2">{data.total}</div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Brightwave Studio staff</span>
          </div>
        </div>

        <div className="surface-card p-5">
          <span className="font-mono-label">Departments</span>
          <div className="font-serif-display text-3xl text-pearl mt-2">{departments.length}</div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#2DB6A8]" />
            <span>Functional divisions</span>
          </div>
        </div>

        <div className="surface-card p-5">
          <span className="font-mono-label">Compensation Access</span>
          <div className="font-serif-display text-3xl mt-2">
            {canSeeComp ? (
              <span className="text-[#34D399]">Granted</span>
            ) : (
              <span className="text-[#93A59B]">Restricted</span>
            )}
          </div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5">
            {canSeeComp ? (
              <>
                <DollarSign className="w-3.5 h-3.5 text-[#34D399]" />
                <span className="text-[#34D399]">Visible as {user.role}</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-[#F2B84B]" />
                <span className="text-[#F2B84B]">Protected by RBAC policy</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <form method="GET" className="surface-card p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by employee name or job title..."
            className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3.5 py-2 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399] focus:ring-1 focus:ring-[#34D399]"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            name="departmentId"
            defaultValue={departmentId}
            className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-[#34D399] hover:bg-[#34D399]/90 text-[#04130C] text-xs font-semibold rounded-lg transition-all"
        >
          Filter Directory
        </button>
      </form>

      {/* Directory Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16201B]/60 border-b border-[#22302A]">
              <tr>
                <th className="px-5 py-3 font-mono-label">Employee</th>
                <th className="px-5 py-3 font-mono-label">Department</th>
                <th className="px-5 py-3 font-mono-label">Reports To</th>
                <th className="px-5 py-3 font-mono-label">System Role</th>
                <th className="px-5 py-3 font-mono-label">
                  {canSeeComp ? "Rates (Cost / Billable)" : "Compensation"}
                </th>
                <th className="px-5 py-3 text-right font-mono-label">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22302A]">
              {data.employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#16201B]/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1D2A24] border border-[#2F4239] flex items-center justify-center font-mono font-medium text-[#34D399]">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-[#E8F1EC]">{emp.fullName}</div>
                        <div className="text-[11px] text-[#93A59B]">{emp.jobTitle}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-[#1D2A24] text-[#93A59B] border border-[#2F4239]">
                      {emp.department?.name ?? "General"}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-[#93A59B]">
                    {emp.manager ? (
                      <div>
                        <span className="text-[#E8F1EC]">{emp.manager.name}</span>
                        <div className="text-[10px] text-[#5F6F66]">{emp.manager.jobTitle}</div>
                      </div>
                    ) : (
                      <span className="text-[#5F6F66] italic">None (Executive)</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded border border-[#34D399]/20">
                      {emp.role}
                    </span>
                  </td>

                  <td className="px-5 py-3.5">
                    {canSeeComp && emp.compensation ? (
                      <div className="font-mono text-[11px] text-[#E8F1EC]">
                        <span className="text-[#93A59B]">${emp.compensation.hourlyCost}/h</span>
                        <span className="text-[#5F6F66] mx-1">/</span>
                        <span className="text-[#34D399] font-semibold">${emp.compensation.billableRate}/h</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5F6F66]">
                        <Lock className="w-3 h-3 text-[#F2B84B]" />
                        <span>Restricted</span>
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/directory/${emp.id}`}
                      className="inline-flex items-center gap-1 text-[#34D399] hover:underline font-medium text-xs"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
