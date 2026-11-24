"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ExecutiveChartsProps {
  monthlyHours: Array<{
    month: string;
    billable: number;
    nonBillable: number;
  }>;
  departmentUtilization: Array<{
    department: string;
    allocatedHours: number;
    capacityHours: number;
    utilizationPct: number;
  }>;
}

export function ExecutiveCharts({
  monthlyHours,
  departmentUtilization,
}: ExecutiveChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly Hours Trend Area Chart */}
      <div className="p-6 rounded-2xl bg-[#0F1613] border border-[#22302A] shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#F4FAF7]">
              Studio Hours Trend
            </h3>
            <p className="text-xs text-[#93A59B]">
              Billable vs non-billable tracked hours over the last 6 months
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#34D399]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#34D399]" />
              Billable
            </span>
            <span className="flex items-center gap-1.5 text-[#93A59B]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#22302A]" />
              Internal
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={monthlyHours}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="billableGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="internalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2DB6A8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2DB6A8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#16201B" />
              <XAxis
                dataKey="month"
                stroke="#93A59B"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="#93A59B" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F1613",
                  borderColor: "#22302A",
                  borderRadius: "0.75rem",
                  color: "#F4FAF7",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
                labelStyle={{ fontWeight: "bold", color: "#34D399" }}
              />
              <Area
                type="monotone"
                dataKey="billable"
                name="Billable Hours"
                stroke="#34D399"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#billableGrad)"
              />
              <Area
                type="monotone"
                dataKey="nonBillable"
                name="Internal / Non-Billable"
                stroke="#2DB6A8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#internalGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Allocation & Capacity Bar Chart */}
      <div className="p-6 rounded-2xl bg-[#0F1613] border border-[#22302A] shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#F4FAF7]">
              Department Workload
            </h3>
            <p className="text-xs text-[#93A59B]">
              Allocated task hours vs net working capacity
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#2DB6A8]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2DB6A8]" />
              Allocated
            </span>
            <span className="flex items-center gap-1.5 text-[#B5E35B]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#B5E35B]" />
              Capacity
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={departmentUtilization}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#16201B" />
              <XAxis
                dataKey="department"
                stroke="#93A59B"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="#93A59B" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F1613",
                  borderColor: "#22302A",
                  borderRadius: "0.75rem",
                  color: "#F4FAF7",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
                labelStyle={{ fontWeight: "bold", color: "#2DB6A8" }}
              />
              <Bar
                dataKey="allocatedHours"
                name="Allocated Hours"
                fill="#2DB6A8"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="capacityHours"
                name="Net Capacity"
                fill="#B5E35B"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
