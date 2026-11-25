import type { Metadata } from "next";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { RoleSwitcher } from "@/components/common/RoleSwitcher";
import { AppNav } from "@/components/common/AppNav";
import { Role } from "@prisma/client";
export const metadata: Metadata = {
  title: "workWell — Modular People, Work & Performance",
  description: "Enterprise modular monolith for HR, agency work operations, and performance management.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  const currentRole = user?.role ?? Role.OWNER;
  const currentName = user?.name ?? "Demo User";
  const currentEmail = user?.email ?? "owner@brightwave.io";

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080D0B] text-[#E8F1EC] selection:bg-[#34D399]/20 selection:text-[#34D399]">
        {/* Persistent Dev Role Switcher */}
        <RoleSwitcher
          currentRole={currentRole}
          currentName={currentName}
          currentEmail={currentEmail}
        />

        <div className="flex flex-col md:flex-row min-h-[calc(100vh-45px)]">
          {/* Responsive Left Sidebar / Mobile Nav */}
          <AppNav role={currentRole} />

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
