"use client";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getClient } from "@/src/features/clients";
export function AppHeader(){const p=usePathname(),id=p.match(/^\/clients\/([^/]+)/)?.[1],enabled=!!id&&id!=="new";const q=useQuery({queryKey:["client",id],queryFn:()=>getClient(id!),enabled});const project=p.match(/^\/projects\/([^/]+)/)?.[1];const title=enabled?q.data?.name??"Client":project&&project!=="new"?"Project":p.startsWith("/clients")?"Clients":p.startsWith("/growth-plans")?"Growth Plans":p.startsWith("/projects")?"Projects":p.startsWith("/admin/users")?"User management":p==="/admin/audit-log"?"Account audit":p==="/admin"?"Administration":p==="/month-end"?"Month end":p==="/notifications"?"Notifications":p==="/settings"?"Settings":"Workspace";return <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur"><SidebarTrigger aria-label="Open navigation"/><div className="min-w-0"><h1 className="truncate text-sm font-medium">{title}</h1>{enabled&&<p className="truncate text-xs text-muted-foreground">{[q.data?.industry,q.data?.status].filter(Boolean).join(" ? ")}</p>}</div></header>}



