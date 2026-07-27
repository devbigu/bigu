"use client";

import { ChevronRight, FileText, Folder, FolderOpen, Plus, RotateCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Client } from "@/src/features/clients";
import type { Project, ProjectStatus } from "@/src/features/projects";

export type ClientProjectTreeProps = {
  clients: Client[];
  projects: Project[];
  pathname: string;
  search?: string;
  isLoading?: boolean;
  projectsLoading?: boolean;
  error?: unknown;
  projectsError?: unknown;
  onRetry?: () => void;
  onRetryProjects?: () => void;
  onNavigate?: () => void;
  compact?: boolean;
};

const statusStyle: Record<ProjectStatus, string> = {
  DRAFT: "border-border text-muted-foreground",
  ACTIVE: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  COMPLETED: "border-blue-500/30 text-blue-700 dark:text-blue-400",
  ARCHIVED: "border-border text-muted-foreground",
};

function TreeSkeleton() {
  return (
    <div aria-label="Loading clients and projects" className="space-y-2 p-1">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex h-8 items-center gap-2 px-2">
          <Skeleton className="size-4" /><Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function ProjectRow({
  project,
  active,
  onNavigate,
  compact,
}: {
  project: Project;
  active: boolean;
  onNavigate?: () => void;
  compact: boolean;
}) {
  const date = project.month && project.year
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(
        new Date(project.year, project.month - 1),
      )
    : null;
  return (
    <li className="relative min-w-0 before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-border">
      <Link href={`/projects/${project.id}`} onClick={onNavigate}
        aria-current={active ? "page" : undefined} title={project.title}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-md px-2 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
          compact ? "h-7 max-md:h-10" : "h-8 max-md:h-10",
          active && "bg-muted font-medium ring-1 ring-border",
        )}>
        <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{project.title}</span>
        {date && <span className="hidden shrink-0 text-[10px] text-muted-foreground xl:inline">{date}</span>}
        <span className={cn("shrink-0 rounded border px-1 py-0.5 text-[9px] leading-none", statusStyle[project.status])}>
          {project.status}
        </span>
      </Link>
    </li>
  );
}

export function ClientProjectTree({
  clients,
  projects,
  pathname,
  search = "",
  isLoading,
  projectsLoading,
  error,
  projectsError,
  onRetry,
  onRetryProjects,
  onNavigate,
  compact = true,
}: ClientProjectTreeProps) {
  const activeClientId = pathname.match(/^\/clients\/([^/]+)/)?.[1];
  const activeProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const query = search.trim().toLocaleLowerCase();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () =>
      clients.flatMap((client) => {
        const all = projects.filter((project) => project.clientId === client.id);
        if (!query) return [{ client, projects: all, searchExpanded: false }];
        const clientMatch = `${client.name} ${client.industry ?? ""}`.toLocaleLowerCase().includes(query);
        const matches = all.filter((project) => project.title.toLocaleLowerCase().includes(query));
        return !clientMatch && !matches.length
          ? []
          : [{ client, projects: clientMatch ? all : matches, searchExpanded: matches.length > 0 }];
      }),
    [clients, projects, query],
  );

  if (isLoading) return <TreeSkeleton />;
  if (error) {
    return <div className="p-4 text-center text-xs text-muted-foreground">
      <p>Could not load clients.</p>
      <Button size="xs" variant="ghost" onClick={onRetry}><RotateCw />Retry</Button>
    </div>;
  }
  if (!clients.length) {
    return <div className="p-5 text-center text-xs text-muted-foreground">
      <Folder className="mx-auto mb-2 size-5" />
      <p className="font-medium text-foreground">No clients yet</p>
      <p className="mt-1">Create your first client to begin.</p>
      <Button nativeButton={false} className="mt-3" size="xs" variant="outline"
        render={<Link href="/clients/new" onClick={onNavigate} />}>
        <Plus />Create client
      </Button>
    </div>;
  }
  if (!visible.length) {
    return <p className="p-5 text-center text-xs text-muted-foreground">No clients or projects found</p>;
  }

  return (
    <ul aria-label="Clients and projects" className="min-w-0 space-y-0.5">
      {visible.map(({ client, projects: children, searchExpanded }) => {
        const open = searchExpanded || expanded.has(client.id) || activeProject?.clientId === client.id;
        const treeId = `client-projects-${client.id}`;
        const toggle = () => setExpanded((current) => {
          const next = new Set(current);
          if (next.has(client.id)) next.delete(client.id);
          else next.add(client.id);
          return next;
        });
        return (
          <li key={client.id} className="min-w-0">
            <div className={cn(
              "flex min-w-0 items-center rounded-md transition-colors hover:bg-muted motion-reduce:transition-none",
              compact ? "h-8 max-md:h-10" : "h-9 max-md:h-10",
              activeClientId === client.id && "bg-muted font-medium ring-1 ring-border",
            )}>
              <button type="button" aria-expanded={open} aria-controls={treeId}
                aria-label={`${open ? "Collapse" : "Expand"} ${client.name}`} onClick={toggle}
                className="grid size-8 shrink-0 place-items-center rounded-md outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring max-md:size-10">
                <ChevronRight className={cn(
                  "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                  open && "rotate-90",
                )} />
              </button>
              {open
                ? <FolderOpen aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                : <Folder aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              <Link href={`/clients/${client.id}`} onClick={onNavigate}
                aria-current={activeClientId === client.id ? "page" : undefined}
                title={client.name}
                className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0 flex-1 truncate text-sm">{client.name}</span>
                {!projectsLoading && !projectsError && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{children.length}</span>
                )}
              </Link>
            </div>
            <div className={cn(
              "grid transition-[grid-template-rows] duration-250 ease-in-out motion-reduce:transition-none",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}>
              <div className="overflow-hidden">
                <div id={treeId} className="ml-7 border-l pb-1 pl-3 pt-1">
                  {projectsLoading ? (
                    <div aria-label={`Loading projects for ${client.name}`} className="space-y-1">
                      <Skeleton className="h-7 w-36" /><Skeleton className="h-7 w-28" />
                    </div>
                  ) : projectsError ? (
                    <div className="py-2 text-xs text-muted-foreground">
                      Could not load projects
                      <Button size="xs" variant="ghost" onClick={onRetryProjects}><RotateCw />Retry</Button>
                    </div>
                  ) : (
                    <>
                      {!children.length && <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet</p>}
                      {!!children.length && (
                        <ul className="relative space-y-0.5">
                          {children.map((project) => (
                            <ProjectRow key={project.id} project={project}
                              active={activeProjectId === project.id}
                              onNavigate={onNavigate} compact={compact} />
                          ))}
                        </ul>
                      )}
                      <Link className="mt-1 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        href={`/projects/new?clientId=${client.id}`} onClick={onNavigate}>
                        <Plus className="size-3" />Create project
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
