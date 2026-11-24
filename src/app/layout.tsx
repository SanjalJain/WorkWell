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

        {/* Global Navigation Header */}
        <AppNav role={currentRole} />

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
