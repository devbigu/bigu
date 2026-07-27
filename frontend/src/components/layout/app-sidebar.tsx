"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, CalendarCheck, LayoutDashboard, Plus, Search, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getClients } from "@/src/features/clients";
import { getProjects } from "@/src/features/projects";
import { AccountMenu } from "./account-menu";
import { useCurrentUser } from "@/src/features/auth/hooks/use-current-user";
import { ClientProjectTree } from "./client-project-tree";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/month-end", label: "Month end", icon: CalendarCheck },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const { setOpenMobile } = useSidebar();
  const { data: currentUser } = useCurrentUser();
  const close = () => setOpenMobile(false);
  const clientsQuery = useQuery({
    queryKey: ["clients", { status: "ACTIVE" }],
    queryFn: () => getClients({ status: "ACTIVE" }),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", { status: "NON_ARCHIVED" }],
    queryFn: () => getProjects(),
  });
  const clients = useMemo(
    () => [...(clientsQuery.data ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [clientsQuery.data],
  );
  const projects = useMemo(
    () =>
      [...(projectsQuery.data ?? [])]
        .filter((project) => project.status !== "ARCHIVED")
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [projectsQuery.data],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b p-3">
        <div className="flex h-9 items-center justify-between overflow-hidden">
          <Link href="/dashboard" onClick={close} className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground text-background">B</span>
            <span className="text-lg group-data-[collapsible=icon]:hidden">BigU</span>
          </Link>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
        <div className="grid grid-cols-2 gap-2 group-data-[collapsible=icon]:hidden">
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/clients/new" onClick={close} />}><Plus />New client</Button>
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/projects/new" onClick={close} />}><Plus />New project</Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input aria-label="Search clients and projects" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients and projects" className="pl-8" />
          </div>
          <div className="rounded-lg border bg-background p-1">
            <ClientProjectTree clients={clients} projects={projects} pathname={pathname} search={search} isLoading={clientsQuery.isLoading} projectsLoading={projectsQuery.isLoading} error={clientsQuery.error} projectsError={projectsQuery.error} onRetry={() => clientsQuery.refetch()} onRetryProjects={() => projectsQuery.refetch()} onNavigate={close} />
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        {currentUser?.role === "ADMIN" ? (
          <>
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">Administration</p>
            <SidebarMenu className="mb-1">
              {[
                { href: "/admin", label: "Admin overview", icon: ShieldCheck },
                { href: "/admin/users", label: "User management", icon: Users },
                { href: "/admin/audit-log", label: "Account audit", icon: Activity },
              ].map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton render={<Link href={href} onClick={close} />} isActive={href === "/admin" ? pathname === href : pathname.startsWith(href)} tooltip={label}>
                    <Icon /><span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </>
        ) : null}
        <SidebarMenu>
          {nav.map(({ href, label, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton render={<Link href={href} onClick={close} />} isActive={pathname === href} tooltip={label}>
                <Icon /><span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="mt-1 border-t pt-1"><AccountMenu onNavigate={close} /></div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}


