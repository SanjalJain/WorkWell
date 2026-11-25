import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getEmployeeProfile } from "@/modules/people/service";
import { canViewCompensation, canEditEmployee } from "@/modules/people/policies";
import { rawPrisma } from "@/lib/db";
import { ArrowLeft, User, DollarSign, Lock, ShieldCheck, Calendar, Briefcase, GitBranch } from "lucide-react";
import { Role } from "@prisma/client";
import { EditEmployeeModal } from "../DirectoryClientComponents";

interface EmployeeProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeProfilePage({ params }: EmployeeProfilePageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const { id } = await params;
  const employee = await getEmployeeProfile(id, user);

  if (!employee) {
    notFound();
  }

  const canSeeComp = canViewCompensation(user);
  const canEdit = canEditEmployee(user);

  let departments: Array<{ id: string; name: string }> = [];
  let managers: Array<{ id: string; firstName: string; lastName: string; jobTitle: string }> = [];

  if (canEdit) {
    [departments, managers] = await Promise.all([
      rawPrisma.department.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      rawPrisma.employee.findMany({
        where: { organizationId: user.organizationId, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, jobTitle: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href="/directory"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#93A59B] hover:text-[#34D399] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Directory</span>
        </Link>

        {canEdit && (
          <EditEmployeeModal
            employee={employee}
            departments={departments}
            managers={managers}
          />
        )}
      </div>

      {/* Header Card */}
      <div className="surface-card p-6 spotlight-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#1D2A24] border border-[#2F4239] flex items-center justify-center font-mono text-xl font-bold text-[#34D399] shadow-[0_0_15px_rgba(52,211,153,0.15)]">
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-[#F4FAF7]">{employee.fullName}</h1>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#34D399] bg-[#34D399]/15 border border-[#34D399]/30 px-2 py-0.5 rounded-full">
                {employee.role}
              </span>
            </div>
            <p className="text-sm text-[#93A59B] mt-0.5">{employee.jobTitle}</p>
            <p className="text-xs text-[#5F6F66] mt-0.5 font-mono">{employee.email}</p>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5 font-mono text-xs text-[#93A59B]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Joined: {employee.startDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-[#2DB6A8]" />
            <span>Dept: {employee.department?.name ?? "General"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reporting Lines */}
        <div className="surface-card p-5 space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#93A59B] flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#2DB6A8]" />
            <span>Reporting Hierarchy</span>
          </h2>

          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-mono text-[#5F6F66]">Direct Manager:</span>
              {employee.manager ? (
                <div className="mt-1 p-2.5 rounded-lg bg-[#16201B] border border-[#22302A] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-[#E8F1EC]">{employee.manager.name}</div>
                    <div className="text-[10px] text-[#93A59B]">{employee.manager.jobTitle}</div>
                  </div>
                  <Link
                    href={`/directory/${employee.manager.id}`}
                    className="text-[11px] font-mono text-[#34D399] hover:underline"
                  >
                    View
                  </Link>
                </div>
              ) : (
                <div className="mt-1 p-2.5 rounded-lg bg-[#16201B] border border-[#22302A] text-xs text-[#5F6F66] italic">
                  Top-level executive (Reports to Board)
                </div>
              )}
            </div>

            <div>
              <span className="text-[11px] font-mono text-[#5F6F66]">
                Direct Reports ({employee.directReports?.length ?? 0}):
              </span>
              {employee.directReports && employee.directReports.length > 0 ? (
                <div className="mt-1 space-y-1.5">
                  {employee.directReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-2 rounded-lg bg-[#16201B] border border-[#22302A] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="text-[#E8F1EC]">{report.name}</div>
                        <div className="text-[10px] text-[#93A59B]">{report.jobTitle}</div>
                      </div>
                      <Link
                        href={`/directory/${report.id}`}
                        className="text-[11px] font-mono text-[#34D399] hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 p-2 rounded-lg bg-[#16201B] border border-[#22302A] text-xs text-[#5F6F66] italic">
                  No direct reports
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compensation & Policy Security */}
        <div className="surface-card p-5 space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#93A59B] flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#34D399]" />
            <span>Compensation & Rates</span>
          </h2>

          {canSeeComp && employee.compensation ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#16201B] border border-[#2F4239]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#5F6F66]">Hourly Cost</span>
                  <div className="text-xl font-mono text-[#E8F1EC] font-semibold mt-1">
                    ${employee.compensation.hourlyCost}
                    <span className="text-xs text-[#5F6F66]">/hr</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#16201B] border border-[#2F4239]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#5F6F66]">Billable Rate</span>
                  <div className="text-xl font-mono text-[#34D399] font-semibold mt-1">
                    ${employee.compensation.billableRate}
                    <span className="text-xs text-[#5F6F66]">/hr</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#34D399]/10 border border-[#34D399]/30 text-xs text-[#93A59B] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#34D399] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[#34D399] font-medium">Audit Log Emitted: </span>
                  Your read of this compensation record as <strong className="text-[#E8F1EC]">{user.role}</strong> has
                  been permanently recorded in the immutable audit trail.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-[#16201B] border border-[#2F4239] text-xs space-y-2">
              <div className="flex items-center gap-2 text-[#F2B84B] font-medium">
                <Lock className="w-4 h-4" />
                <span>Confidential Record</span>
              </div>
              <p className="text-[#93A59B]">
                Compensation, hourly cost rates, and billable rates are strictly restricted to the{" "}
                <span className="text-[#E8F1EC] font-mono">OWNER</span> and{" "}
                <span className="text-[#E8F1EC] font-mono">HR</span> roles.
              </p>
              <p className="text-[#5F6F66] text-[11px] font-mono">
                Active persona: {user.role} — field-level DTO filter active.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
