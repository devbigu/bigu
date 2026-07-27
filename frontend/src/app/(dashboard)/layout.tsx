"use client";

import { AuthGuard } from "@/src/features/auth";
import { AppSidebar } from "@/src/components/layout/app-sidebar";
import { AppHeader } from "@/src/components/layout/app-header";
import { UserThemeSync } from "@/src/components/theme/user-theme-sync";
import { AccentColorSync } from "@/src/components/theme/accent-color-sync";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGuard>
      <UserThemeSync />
      <AccentColorSync />
      <SidebarProvider style={{ "--sidebar-width": "17.5rem" } as React.CSSProperties}>
        <AppSidebar />
        <SidebarInset className="min-h-svh min-w-0 overflow-x-hidden">
          <AppHeader />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
