"use client";

import { useState, useTransition } from "react";
import {
  createClientAction,
  createProjectAction,
  updateProjectStatusAction,
  addProjectMemberAction,
} from "@/app/actions/work-actions";
import { ProjectType, ProjectStatus } from "@prisma/client";
import { Plus, X, FolderPlus, UserPlus, Building2 } from "lucide-react";

interface CreateProjectModalProps {
  clients: { id: string; name: string }[];
  leads: { id: string; name: string }[];
}

export function CreateProjectModal({ clients, leads }: CreateProjectModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createProjectAction(formData);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to create project");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2DB6A8] hover:bg-[#2DB6A8]/90 text-[#04130C] text-xs font-semibold transition-all shadow-[0_0_12px_rgba(45,182,168,0.2)]"
      >
        <Plus className="w-4 h-4" />
        <span>Create Project</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-5 border border-[#2F4239] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Create New Project</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#F0646E]/10 border border-[#F0646E]/30 text-xs text-[#F0646E]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Project Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. NextGen Web Platform"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Client</label>
                <select
                  name="clientId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-label block mb-1">Project Lead</label>
                  <select
                    name="leadId"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                  >
                    <option value="">None (Unassigned)</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-mono-label block mb-1">Contract Type</label>
                  <select
                    name="type"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                  >
                    <option value={ProjectType.TIME_AND_MATERIALS}>Time & Materials</option>
                    <option value={ProjectType.FIXED}>Fixed Price</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Initial Budget ($ USD)</label>
                <input
                  type="number"
                  name="budget"
                  min="0"
                  step="500"
                  defaultValue="25000"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] text-[#93A59B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#2DB6A8] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

interface AddMemberModalProps {
  projectId: string;
  employees: { id: string; name: string; jobTitle: string }[];
}

export function AddProjectMemberModal({ projectId, employees }: AddMemberModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.append("projectId", projectId);

    startTransition(async () => {
      try {
        await addProjectMemberAction(formData);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to add member");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] text-xs font-medium transition-all"
      >
        <UserPlus className="w-3.5 h-3.5 text-[#2DB6A8]" />
        <span>Add Member</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Assign Team Member</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-[#F0646E]/10 border border-[#F0646E]/30 text-xs text-[#F0646E]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Employee</label>
                <select
                  name="employeeId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.jobTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Role Title</label>
                <input
                  type="text"
                  name="role"
                  defaultValue="Fullstack Developer"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Allocation Percentage (%)</label>
                <input
                  type="number"
                  name="allocationPct"
                  min="10"
                  max="100"
                  defaultValue="100"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] text-[#93A59B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#2DB6A8] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Assigning..." : "Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function CreateClientModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createClientAction(formData);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to create client");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] text-xs font-semibold transition-all"
      >
        <Building2 className="w-3.5 h-3.5 text-[#2DB6A8]" />
        <span>New Client</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Register Client Organization</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-[#F0646E]/10 border border-[#F0646E]/30 text-xs text-[#F0646E]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Company / Organization Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Acme Corporation"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Billing Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="billing@acmecorp.com"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Billing Address</label>
                <textarea
                  name="billingAddress"
                  rows={2}
                  placeholder="Street, City, Postal Code, Country"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] text-[#93A59B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#2DB6A8] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Registering..." : "Register Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function ProjectStatusSelector({
  projectId,
  currentStatus,
}: {
  projectId: string;
  currentStatus: ProjectStatus;
}) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ProjectStatus;
    startTransition(async () => {
      await updateProjectStatusAction(projectId, newStatus);
    });
  };

  return (
    <div className="relative inline-block">
      <select
        value={currentStatus}
        disabled={isPending}
        onChange={handleStatusChange}
        className={`px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider font-semibold border cursor-pointer focus:outline-none transition-all disabled:opacity-50 ${
          currentStatus === ProjectStatus.ACTIVE
            ? "bg-[#2DB6A8]/15 text-[#2DB6A8] border-[#2DB6A8]/30"
            : currentStatus === ProjectStatus.COMPLETED
            ? "bg-[#4ADE80]/15 text-[#4ADE80] border-[#4ADE80]/30"
            : currentStatus === ProjectStatus.PLANNING
            ? "bg-[#F2B84B]/15 text-[#F2B84B] border-[#F2B84B]/30"
            : "bg-[#16201B] text-[#93A59B] border-[#22302A]"
        }`}
      >
        <option value={ProjectStatus.PLANNING} className="bg-[#16201B] text-[#F2B84B]">
          Planning
        </option>
        <option value={ProjectStatus.ACTIVE} className="bg-[#16201B] text-[#2DB6A8]">
          Active
        </option>
        <option value={ProjectStatus.COMPLETED} className="bg-[#16201B] text-[#4ADE80]">
          Completed
        </option>
        <option value={ProjectStatus.ARCHIVED} className="bg-[#16201B] text-[#93A59B]">
          Archived
        </option>
      </select>
    </div>
  );
}
