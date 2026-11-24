import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getOrgChart, OrgChartNode } from "@/modules/people/service";
import { ArrowLeft, Network, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

function TreeNode({ node }: { node: OrgChartNode }) {
  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div className="surface-card p-4 w-64 hover:border-[#34D399]/50 transition-all text-center relative group">
        <div className="w-10 h-10 rounded-full bg-[#1D2A24] border border-[#2F4239] text-[#34D399] font-mono font-bold flex items-center justify-center mx-auto text-sm shadow-[0_0_10px_rgba(52,211,153,0.15)]">
          {node.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div className="mt-2 font-medium text-sm text-[#E8F1EC]">{node.name}</div>
        <div className="text-[11px] text-[#93A59B]">{node.jobTitle}</div>
        {node.departmentName && (
          <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-mono bg-[#1D2A24] text-[#34D399] border border-[#2F4239]">
            {node.departmentName}
          </span>
        )}
        <div className="mt-2 pt-2 border-t border-[#22302A]">
          <Link
            href={`/directory/${node.id}`}
            className="text-[11px] font-mono text-[#34D399] hover:underline"
          >
            View Profile →
          </Link>
        </div>
      </div>

      {/* Children Branches */}
      {node.reports.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical line connecting parent to branch bar */}
          <div className="w-px h-6 bg-[#2F4239]" />

          {/* Branch container */}
          <div className="flex items-start gap-8 relative pt-4">
            {node.reports.length > 1 && (
              <div
                className="absolute top-0 h-px bg-[#2F4239]"
                style={{
                  left: "calc(50% / " + node.reports.length + ")",
                  right: "calc(50% / " + node.reports.length + ")",
                }}
              />
            )}
            {node.reports.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center">
                {/* Connector tick to horizontal bar */}
                <div className="w-px h-4 bg-[#2F4239] -mt-4 mb-0" />
                <TreeNode node={child} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function OrgChartPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const roots = await getOrgChart(user);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/directory"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#93A59B] hover:text-[#34D399] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Directory</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Reporting <span className="italic text-[#34D399]">hierarchy</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Visual organizational structure with cycle-validated reporting lines.
          </p>
        </div>
      </div>

      {/* Org Tree Canvas */}
      <div className="surface-card p-8 overflow-x-auto min-h-[500px] flex justify-center">
        <div className="flex flex-col items-center gap-12">
          {roots.map((root) => (
            <TreeNode key={root.id} node={root} />
          ))}
        </div>
      </div>
    </div>
  );
}
