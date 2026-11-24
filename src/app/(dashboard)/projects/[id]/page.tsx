import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getProjectDetails } from "@/modules/work/service";
import { rawPrisma } from "@/lib/db";
import { KanbanBoard } from "./KanbanBoard";
import { AddProjectMemberModal } from "../ProjectClientComponents";
import { ArrowLeft, Building2, Users, DollarSign, Clock, ShieldCheck } from "lucide-react";
import { Role } from "@prisma/client";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const { id } = await params;
  const project = await getProjectDetails(id, user);

  if (!project) {
    notFound();
  }

  const allEmployees = await rawPrisma.employee.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, firstName: true, lastName: true, jobTitle: true },
    orderBy: { lastName: "asc" },
  });

  const canManage =
    user.role === Role.OWNER ||
    user.role === Role.HR ||
    (user.role === Role.MANAGER && project.leadId === user.employeeId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#93A59B] hover:text-[#2DB6A8] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Projects</span>
        </Link>
      </div>

      {/* Project Banner Card */}
      <div className="surface-card p-6 spotlight-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#93A59B]">
              <Building2 className="w-3.5 h-3.5 text-[#2DB6A8]" />
              <span className="font-medium">{project.client.name}</span>
              <span className="text-[#5F6F66]">•</span>
              <span className="font-mono">{project.type.replace("_", " ")}</span>
            </div>
            <h1 className="text-2xl font-bold text-[#F4FAF7] mt-1">{project.name}</h1>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <AddProjectMemberModal
                projectId={project.id}
                employees={allEmployees.map((e) => ({
                  id: e.id,
                  name: `${e.firstName} ${e.lastName}`,
                  jobTitle: e.jobTitle,
                }))}
              />
            )}
            <Link
              href="/timesheets"
              className="px-3.5 py-1.5 rounded-lg bg-[#2DB6A8]/15 hover:bg-[#2DB6A8]/25 text-[#2DB6A8] border border-[#2DB6A8]/30 text-xs font-medium transition-all"
            >
              Log Time
            </Link>
          </div>
        </div>

        {/* Project Metrics & Team Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#22302A] text-xs font-mono">
          <div className="p-3 rounded-lg bg-[#16201B] border border-[#22302A]">
            <span className="text-[10px] text-[#5F6F66] block">Project Lead</span>
            <span className="text-[#E8F1EC] font-medium truncate block">
              {project.lead ? `${project.lead.firstName} ${project.lead.lastName}` : "Unassigned"}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#16201B] border border-[#22302A]">
            <span className="text-[10px] text-[#5F6F66] block">Contract Budget</span>
            <span className="text-[#E8F1EC] font-semibold">${Number(project.budget).toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-lg bg-[#16201B] border border-[#22302A]">
            <span className="text-[10px] text-[#5F6F66] block">Logged Hours</span>
            <span className="text-[#2DB6A8] font-semibold">{project.totalLoggedHours}h</span>
          </div>

          <div className="p-3 rounded-lg bg-[#16201B] border border-[#22302A]">
            <span className="text-[10px] text-[#5F6F66] block">Team Members</span>
            <span className="text-[#34D399] font-semibold">{project.members.length} Assigned</span>
          </div>
        </div>

        {/* Members Avatar Avatars */}
        {project.members.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#22302A]">
            <span className="text-[11px] font-mono text-[#5F6F66]">Team:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {project.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#16201B] border border-[#2F4239] text-[11px] text-[#93A59B]"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-[#1D2A24] text-[9px] font-bold text-[#34D399] flex items-center justify-center">
                    {m.employee.firstName[0]}
                  </div>
                  <span>
                    {m.employee.firstName} {m.employee.lastName}
                  </span>
                  <span className="text-[9px] font-mono text-[#5F6F66]">({m.allocationPct}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Kanban Board */}
      <KanbanBoard
        projectId={project.id}
        initialTasks={project.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          estimateHours: Number(t.estimateHours).toFixed(1),
          position: t.position,
          assignee: t.assignee,
        }))}
        members={project.members.map((m) => ({
          id: m.employee.id,
          name: `${m.employee.firstName} ${m.employee.lastName}`,
        }))}
      />
    </div>
  );
}
