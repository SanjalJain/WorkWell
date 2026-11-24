import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listProjects } from "@/modules/work/service";
import { rawPrisma } from "@/lib/db";
import { CreateProjectModal } from "./ProjectClientComponents";
import { FolderKanban, Users, Clock, DollarSign, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { Role, ProjectStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const [projects, clients, employees] = await Promise.all([
    listProjects(user),
    rawPrisma.client.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
    }),
    rawPrisma.employee.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const canCreate = user.role === Role.OWNER || user.role === Role.HR || user.role === Role.MANAGER;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Agency <span className="italic text-[#2DB6A8]">projects</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Active client engagements, team allocations, kanban delivery boards, and billable hour tracking.
          </p>
        </div>

        {canCreate && (
          <CreateProjectModal
            clients={clients}
            leads={employees.map((e) => ({
              id: e.id,
              name: `${e.firstName} ${e.lastName}`,
            }))}
          />
        )}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.length === 0 ? (
          <div className="col-span-full surface-card p-12 text-center space-y-3">
            <FolderKanban className="w-8 h-8 text-[#2DB6A8] mx-auto opacity-60" />
            <h3 className="font-serif-display text-2xl text-pearl">
              No active <span className="italic text-[#2DB6A8]">projects</span>
            </h3>
            <p className="text-xs text-[#93A59B] max-w-sm mx-auto">
              Create your first project to start organizing team members and tracking client milestones.
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="surface-card p-5 spotlight-card flex flex-col justify-between hover:border-[#2DB6A8]/50 transition-all space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-[#93A59B]">
                    <Building2 className="w-3.5 h-3.5 text-[#2DB6A8]" />
                    <span className="font-medium truncate max-w-[180px]">{project.clientName}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                      project.status === ProjectStatus.ACTIVE
                        ? "bg-[#2DB6A8]/15 text-[#2DB6A8] border border-[#2DB6A8]/30"
                        : "bg-[#1D2A24] text-[#93A59B] border border-[#2F4239]"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-[#F4FAF7] hover:text-[#2DB6A8] transition-colors">
                    <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  </h3>
                  <div className="text-[11px] font-mono text-[#5F6F66] mt-0.5">
                    Contract: {project.type.replace("_", " ")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#22302A] text-xs font-mono">
                  <div className="p-2 rounded bg-[#16201B] border border-[#22302A]">
                    <span className="text-[10px] text-[#5F6F66] block">Budget</span>
                    <span className="text-[#E8F1EC] font-semibold">${Number(project.budget).toLocaleString()}</span>
                  </div>

                  <div className="p-2 rounded bg-[#16201B] border border-[#22302A]">
                    <span className="text-[10px] text-[#5F6F66] block">Logged Hours</span>
                    <span className="text-[#2DB6A8] font-semibold">{project.totalLoggedHours}h</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#22302A] text-xs">
                <div className="flex items-center gap-3 text-[11px] font-mono text-[#93A59B]">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-[#2DB6A8]" />
                    {project.memberCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <FolderKanban className="w-3 h-3 text-[#34D399]" />
                    {project.taskCount} tasks
                  </span>
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex items-center gap-1 text-xs font-mono text-[#2DB6A8] hover:underline"
                >
                  <span>Kanban Board</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
