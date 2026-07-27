"use client";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/src/features/auth";
import { AdminGuard } from "@/src/features/admin/views";
import { AppSidebar } from "@/src/components/layout/app-sidebar";
import { AppHeader } from "@/src/components/layout/app-header";
import { UserThemeSync } from "@/src/components/theme/user-theme-sync";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return children;
  return (
    <AuthGuard>
      <AdminGuard>
        <UserThemeSync />
        <SidebarProvider style={{ "--sidebar-width": "17.5rem" } as React.CSSProperties}>
          <AppSidebar />
          <SidebarInset className="min-h-svh min-w-0 overflow-x-hidden">
            <AppHeader />
            <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-8">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </AdminGuard>
    </AuthGuard>
  );
}
