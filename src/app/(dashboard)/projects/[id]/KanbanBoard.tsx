"use client";

import { useState, useTransition } from "react";
import { createTaskAction, moveTaskAction } from "@/app/actions/work-actions";
import { TaskStatus } from "@prisma/client";
import { Plus, X, ArrowLeft, ArrowRight, Clock, User, CheckCircle2 } from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  estimateHours: string;
  position: number;
  assignee?: { id: string; firstName: string; lastName: string; jobTitle: string } | null;
}

interface KanbanBoardProps {
  projectId: string;
  initialTasks: TaskItem[];
  members: { id: string; name: string }[];
  currentEmployeeId?: string | null;
}

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: TaskStatus.BACKLOG, label: "Backlog", color: "text-[#5F6F66]" },
  { status: TaskStatus.TODO, label: "To Do", color: "text-[#93A59B]" },
  { status: TaskStatus.IN_PROGRESS, label: "In Progress", color: "text-[#2DB6A8]" },
  { status: TaskStatus.IN_REVIEW, label: "In Review", color: "text-[#F2B84B]" },
  { status: TaskStatus.DONE, label: "Done", color: "text-[#4ADE80]" },
];

export function KanbanBoard({
  projectId,
  initialTasks,
  members,
  currentEmployeeId,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [isPending, startTransition] = useTransition();
  const [activeModalCol, setActiveModalCol] = useState<TaskStatus | null>(null);
  const [filterMode, setFilterMode] = useState<"ALL" | "MY_TASKS">("ALL");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");

  const visibleTasks = tasks.filter((t) => {
    if (filterMode === "MY_TASKS" && currentEmployeeId) {
      return t.assignee?.id === currentEmployeeId;
    }
    if (selectedAssignee !== "ALL") {
      return t.assignee?.id === selectedAssignee;
    }
    return true;
  });

  const getNextStatus = (current: TaskStatus): TaskStatus | null => {
    const idx = COLUMNS.findIndex((c) => c.status === current);
    return idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].status : null;
  };

  const getPrevStatus = (current: TaskStatus): TaskStatus | null => {
    const idx = COLUMNS.findIndex((c) => c.status === current);
    return idx > 0 ? COLUMNS[idx - 1].status : null;
  };

  const handleMove = (taskId: string, targetStatus: TaskStatus) => {
    const colTasks = tasks.filter((t) => t.status === targetStatus && t.id !== taskId);
    const maxPos = colTasks.length > 0 ? Math.max(...colTasks.map((t) => t.position)) : 0;
    const newPosition = maxPos + 1.0;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus, position: newPosition } : t))
    );

    startTransition(async () => {
      await moveTaskAction(taskId, targetStatus, newPosition, projectId);
    });
  };

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("projectId", projectId);
    formData.append("status", activeModalCol || "TODO");

    startTransition(async () => {
      const res = await createTaskAction(formData);
      if (res.success) {
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#22302A] pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono-label text-[#2DB6A8]">Project Kanban</span>
          <span className="text-xs font-mono text-[#5F6F66]">
            ({visibleTasks.length} / {tasks.length} Tasks)
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {currentEmployeeId && (
            <div className="flex items-center rounded-lg bg-[#16201B] p-0.5 border border-[#22302A] text-xs font-mono">
              <button
                onClick={() => {
                  setFilterMode("ALL");
                  setSelectedAssignee("ALL");
                }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterMode === "ALL" && selectedAssignee === "ALL"
                    ? "bg-[#2DB6A8]/20 text-[#2DB6A8] font-semibold"
                    : "text-[#93A59B] hover:text-[#E8F1EC]"
                }`}
              >
                All Tasks
              </button>
              <button
                onClick={() => {
                  setFilterMode("MY_TASKS");
                  setSelectedAssignee("ALL");
                }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterMode === "MY_TASKS"
                    ? "bg-[#2DB6A8]/20 text-[#2DB6A8] font-semibold"
                    : "text-[#93A59B] hover:text-[#E8F1EC]"
                }`}
              >
                My Tasks
              </button>
            </div>
          )}

          <select
            value={selectedAssignee}
            onChange={(e) => {
              setSelectedAssignee(e.target.value);
              setFilterMode("ALL");
            }}
            className="bg-[#16201B] border border-[#2F4239] rounded-lg px-2.5 py-1 text-xs text-[#E8F1EC] font-mono focus:outline-none focus:border-[#2DB6A8]"
          >
            <option value="ALL">All Assignees</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = visibleTasks
            .filter((t) => t.status === col.status)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={col.status}
              className="surface-card p-3.5 flex flex-col min-h-[500px] border border-[#22302A] bg-[#0F1613]/80"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#22302A] mb-3">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-semibold ${col.color}`}>{col.label}</span>
                  <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-[#16201B] text-[#93A59B] border border-[#22302A]">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setActiveModalCol(col.status)}
                  className="w-5 h-5 rounded hover:bg-[#16201B] text-[#93A59B] hover:text-[#2DB6A8] flex items-center justify-center transition-colors"
                  title={`Add task to ${col.label}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Task Cards Stack */}
              <div className="space-y-2.5 flex-1">
                {colTasks.map((task) => {
                  const prevStatus = getPrevStatus(task.status);
                  const nextStatus = getNextStatus(task.status);

                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg bg-[#16201B] border border-[#2F4239] hover:border-[#2DB6A8]/50 transition-all space-y-2 group shadow-sm"
                    >
                      <div className="text-xs font-medium text-[#E8F1EC] leading-snug">{task.title}</div>

                      {task.description && (
                        <p className="text-[11px] text-[#93A59B] line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
                        <div className="flex items-center gap-1 text-[#2DB6A8]">
                          <Clock className="w-3 h-3" />
                          <span>{Number(task.estimateHours)}h</span>
                        </div>

                        {task.assignee ? (
                          <div
                            className="flex items-center gap-1 text-[#93A59B]"
                            title={`Assigned to ${task.assignee.firstName} ${task.assignee.lastName}`}
                          >
                            <div className="w-4 h-4 rounded-full bg-[#1D2A24] border border-[#2F4239] text-[9px] flex items-center justify-center font-bold text-[#34D399]">
                              {task.assignee.firstName[0]}
                            </div>
                            <span className="text-[10px] truncate max-w-[80px]">
                              {task.assignee.firstName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#5F6F66] text-[10px]">Unassigned</span>
                        )}
                      </div>

                      {/* Card Move Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#22302A] text-[10px] font-mono">
                        {prevStatus ? (
                          <button
                            onClick={() => handleMove(task.id, prevStatus)}
                            disabled={isPending}
                            className="flex items-center gap-0.5 text-[#93A59B] hover:text-[#2DB6A8] transition-colors"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            <span>Move</span>
                          </button>
                        ) : (
                          <span />
                        )}

                        {nextStatus ? (
                          <button
                            onClick={() => handleMove(task.id, nextStatus)}
                            disabled={isPending}
                            className="flex items-center gap-0.5 text-[#93A59B] hover:text-[#34D399] transition-colors ml-auto"
                          >
                            <span>Move</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 text-[#4ADE80]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {activeModalCol && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-sm font-semibold text-[#F4FAF7]">
                Add Task to {COLUMNS.find((c) => c.status === activeModalCol)?.label}
              </h3>
              <button onClick={() => setActiveModalCol(null)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Task Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Build API integration"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Description (Optional)</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Technical notes or acceptance criteria..."
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-label block mb-1">Assignee</label>
                  <select
                    name="assigneeId"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-mono-label block mb-1">Estimate (Hours)</label>
                  <input
                    type="number"
                    name="estimateHours"
                    min="0.5"
                    step="0.5"
                    defaultValue="4"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setActiveModalCol(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] text-[#93A59B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#2DB6A8] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
