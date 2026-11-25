"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, X, ChevronLeft, ChevronRight, Loader2, AlertCircle, Edit3 } from "lucide-react";
import { createEmployeeAction, updateEmployeeAction } from "@/app/actions/hr-actions";

interface AddEmployeeModalProps {
  departments: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; firstName: string; lastName: string; jobTitle: string }>;
}

export function AddEmployeeModal({ departments, managers }: AddEmployeeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createEmployeeAction(formData);
      if (res.success) {
        setIsOpen(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#34D399] hover:bg-[#34D399]/90 text-[#04130C] text-xs font-semibold shadow-[0_0_15px_rgba(52,211,153,0.2)] transition-all"
      >
        <UserPlus className="w-4 h-4" />
        <span>Add Employee</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#0F1613] border border-[#22302A] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#22302A]">
              <div>
                <h3 className="font-serif-display text-2xl text-[#F4FAF7]">
                  Onboard <span className="italic text-[#34D399]">team member</span>
                </h3>
                <p className="text-xs text-[#93A59B] mt-0.5">
                  Create an employee profile, credentials, and initial compensation.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-[#E25C5C]/10 border border-[#E25C5C]/30 flex items-center gap-2 text-xs text-[#E25C5C]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    placeholder="e.g. Jane"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    placeholder="e.g. Doe"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="jane.doe@brightwave.studio"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    required
                    placeholder="e.g. Senior Product Designer"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Department
                  </label>
                  <select
                    name="departmentId"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  >
                    <option value="">None / General</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Reporting Manager
                  </label>
                  <select
                    name="managerId"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  >
                    <option value="">None (Executive / Independent)</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.jobTitle})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    System Role *
                  </label>
                  <select
                    name="role"
                    defaultValue="EMPLOYEE"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  >
                    <option value="EMPLOYEE">EMPLOYEE (Standard Staff)</option>
                    <option value="MANAGER">MANAGER (Approver / Team Lead)</option>
                    <option value="HR">HR (People & Comp Access)</option>
                    <option value="OWNER">OWNER (Full Admin Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#16201B]/50 border border-[#22302A]">
                <div className="text-[11px] font-mono text-[#34D399] uppercase tracking-wider mb-2.5">
                  Compensation & Billability
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#93A59B] mb-1">Internal Hourly Cost ($/hr)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="hourlyCost"
                      placeholder="65.00"
                      className="w-full bg-[#0F1613] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#93A59B] mb-1">Standard Billable Rate ($/hr)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="billableRate"
                      placeholder="150.00"
                      className="w-full bg-[#0F1613] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-xs text-[#93A59B] hover:text-[#E8F1EC] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#34D399] hover:bg-[#34D399]/90 disabled:opacity-50 text-[#04130C] text-xs font-semibold shadow-[0_0_15px_rgba(52,211,153,0.2)] transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Profile...</span>
                    </>
                  ) : (
                    <span>Create Employee</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

interface DirectoryPaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  search?: string;
  departmentId?: string;
}

export function DirectoryPagination({
  currentPage,
  totalPages,
  totalRecords,
  search,
  departmentId,
}: DirectoryPaginationProps) {
  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (departmentId) params.set("departmentId", departmentId);
    params.set("page", page.toString());
    return `/directory?${params.toString()}`;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-xs text-[#93A59B] font-mono">
        Showing page <span className="text-[#E8F1EC] font-semibold">{currentPage}</span> of{" "}
        <span className="text-[#E8F1EC] font-semibold">{totalPages}</span> ({totalRecords} members total)
      </div>

      <div className="flex items-center gap-1.5">
        {currentPage > 1 ? (
          <Link
            href={createPageUrl(currentPage - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] text-xs font-medium transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </Link>
        ) : (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16201B]/40 text-[#5F6F66] border border-[#22302A] text-xs font-medium cursor-not-allowed">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </span>
        )}

        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p) => {
            const isCurrent = p === currentPage;
            return (
              <Link
                key={p}
                href={createPageUrl(p)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono transition-colors ${
                  isCurrent
                    ? "bg-[#34D399] text-[#04130C] font-bold shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                    : "bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] border border-[#2F4239]"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>

        {currentPage < totalPages ? (
          <Link
            href={createPageUrl(currentPage + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] text-xs font-medium transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#16201B]/40 text-[#5F6F66] border border-[#22302A] text-xs font-medium cursor-not-allowed">
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

interface EditEmployeeModalProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    status: string;
    department?: { id: string; name: string } | null;
    manager?: { id: string; name: string; jobTitle: string } | null;
  };
  departments: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; firstName: string; lastName: string; jobTitle: string }>;
}

export function EditEmployeeModal({ employee, departments, managers }: EditEmployeeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateEmployeeAction(employee.id, formData);
      if (res.success) {
        setIsOpen(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update employee");
    } finally {
      setLoading(false);
    }
  };

  // Filter out the employee themselves from candidate managers to avoid self-selection
  const candidateManagers = managers.filter((m) => m.id !== employee.id);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] text-xs font-medium transition-all"
      >
        <Edit3 className="w-3.5 h-3.5 text-[#34D399]" />
        <span>Edit Profile</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0F1613] border border-[#22302A] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#22302A]">
              <div>
                <h3 className="font-serif-display text-2xl text-[#F4FAF7]">
                  Edit <span className="italic text-[#34D399]">profile</span>
                </h3>
                <p className="text-xs text-[#93A59B] mt-0.5">
                  Update employee organizational and reporting metadata.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-[#E25C5C]/10 border border-[#E25C5C]/30 flex items-center gap-2 text-xs text-[#E25C5C]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    defaultValue={employee.firstName}
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    defaultValue={employee.lastName}
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                  Job Title
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  defaultValue={employee.jobTitle}
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Department
                  </label>
                  <select
                    name="departmentId"
                    defaultValue={employee.department?.id || ""}
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  >
                    <option value="">None / General</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                    Reporting Manager
                  </label>
                  <select
                    name="managerId"
                    defaultValue={employee.manager?.id || ""}
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  >
                    <option value="">None (Top-Level Executive)</option>
                    {candidateManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.jobTitle})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#93A59B] mb-1.5">
                  Employment Status
                </label>
                <select
                  name="status"
                  defaultValue={employee.status}
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-xs text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="TERMINATED">TERMINATED</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-xs text-[#93A59B] hover:text-[#E8F1EC] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#34D399] hover:bg-[#34D399]/90 disabled:opacity-50 text-[#04130C] text-xs font-semibold transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
