"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Archive, Edit, ExternalLink, Plus, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import { getClients } from "@/src/features/clients";
import { archiveProject, getActiveAssignees, getProjects, restoreProject } from "@/src/features/projects/api";
import type { Project, ProjectListFilters, ProjectStatus, ProjectType } from "@/src/features/projects/types";

const statusLabels: Record<ProjectStatus | "ALL", string> = { DRAFT: "Draft", ACTIVE: "Active", COMPLETED: "Completed", ARCHIVED: "Archived", ALL: "All" };
const projectTypeLabels: Record<ProjectType, string> = {
  SOCIAL_MEDIA_MANAGEMENT: "Social media",
  SEO_MANAGEMENT: "SEO",
  WEBSITE_DEVELOPMENT: "Website",
  SOFTWARE_DEVELOPMENT: "Software",
};
const projectTypes = Object.keys(projectTypeLabels) as ProjectType[];

function statusVariant(status: ProjectStatus) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "ARCHIVED") return "secondary" as const;
  return "outline" as const;
}

function dateRange(project: Project) {
  const start = project.startDate?.slice(0, 10);
  const end = project.endDate?.slice(0, 10);
  if (start && end) return `${start} to ${end}`;
  return start || end || "Dates not set";
}

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [clientId, setClientId] = useState("ALL");
  const [projectType, setProjectType] = useState<ProjectType | "ALL">("ALL");
  const [assignedUserId, setAssignedUserId] = useState("ALL");
  const queryClient = useQueryClient();
  const filters = useMemo<ProjectListFilters>(() => ({
    search: search || undefined,
    status,
    clientId: clientId === "ALL" ? undefined : clientId,
    projectType: projectType === "ALL" ? undefined : projectType,
    assignedUserId: assignedUserId === "ALL" ? undefined : assignedUserId,
  }), [assignedUserId, clientId, projectType, search, status]);
  const query = useQuery({ queryKey: ["projects", filters], queryFn: () => getProjects(filters) });
  const clientsQuery = useQuery({ queryKey: ["clients", { status: "ACTIVE" }], queryFn: () => getClients({ status: "ACTIVE" }) });
  const assigneesQuery = useQuery({ queryKey: ["active-assignees"], queryFn: getActiveAssignees });
  const action = useMutation({
    mutationFn: ({ id, restore }: { id: string; restore: boolean }) => restore ? restoreProject(id) : archiveProject(id),
    onSuccess: async (project, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["project-workspace", project.id] }),
      ]);
      toast.success(variables.restore ? "Project restored" : "Project archived");
    },
    onError: (_, variables) => toast.error(variables.restore ? "Could not restore project" : "Could not archive project"),
  });
  const clearFilters = () => { setSearch(""); setStatus("ALL"); setClientId("ALL"); setProjectType("ALL"); setAssignedUserId("ALL"); };
  const hasFilters = Boolean(search || status !== "ALL" || clientId !== "ALL" || projectType !== "ALL" || assignedUserId !== "ALL");

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-3xl font-semibold">Projects</h1><p className="mt-1 text-muted-foreground">Create, assign, archive, and restore internal project work.</p></div>
      <Button nativeButton={false} render={<Link href="/projects/new" />}><Plus />Create project</Button>
    </header>

    <section className="grid gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(150px,1fr))_auto]">
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects" aria-label="Search projects" /></div>
      <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus | "ALL")}><SelectTrigger aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      <Select value={clientId} onValueChange={(value) => setClientId(value ?? "ALL")}><SelectTrigger aria-label="Client filter"><SelectValue placeholder="Client" /></SelectTrigger><SelectContent><SelectItem value="ALL">All clients</SelectItem>{clientsQuery.data?.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select>
      <Select value={projectType} onValueChange={(value) => setProjectType(value as ProjectType | "ALL")}><SelectTrigger aria-label="Project type filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All types</SelectItem>{projectTypes.map((type) => <SelectItem key={type} value={type}>{projectTypeLabels[type]}</SelectItem>)}</SelectContent></Select>
      <Select value={assignedUserId} onValueChange={(value) => setAssignedUserId(value ?? "ALL")}><SelectTrigger aria-label="Assignee filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All assignees</SelectItem>{assigneesQuery.data?.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}><X />Clear</Button>
    </section>

    {query.isLoading && <BrandLoader fullScreen label="Loading projects..." />}
    {query.isError && <Card><CardContent className="py-10 text-center"><p>Projects could not be loaded.</p><Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Retry</Button></CardContent></Card>}
    {query.data?.length === 0 && <Card><CardContent className="py-12 text-center"><p className="font-medium">{hasFilters ? "No projects match these filters" : "No projects yet"}</p><p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Clear filters or change the search." : "Create a project to start the workflow."}</p></CardContent></Card>}

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {query.data?.map((project) => <Card key={project.id} className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg"><Link className="hover:underline" href={`/projects/${project.id}`}>{project.title}</Link></CardTitle><CardDescription>{project.client?.name ?? "Client unavailable"}</CardDescription></div><Badge variant={statusVariant(project.status)}>{statusLabels[project.status]}</Badge></div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5"><Badge variant="outline">{project.projectType ? projectTypeLabels[project.projectType] : "No type"}</Badge>{project.spreadsheetWorksheet && <Badge variant="outline">Worksheet {project.spreadsheetWorksheet.status.toLowerCase()}</Badge>}</div>
          <p><span className="text-muted-foreground">Assignee:</span> {project.assignedUser?.name ?? "Unassigned"}</p>
          <p><span className="text-muted-foreground">Platforms:</span> {project.platforms.length ? project.platforms.join(", ") : "Not set"}</p>
          <p><span className="text-muted-foreground">Dates:</span> {dateRange(project)}</p>
          <p className="text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/projects/${project.id}`} />}><ExternalLink />Open</Button>
          <Button nativeButton={false} variant="outline" size="sm" disabled={project.status === "ARCHIVED"} render={<Link href={`/projects/${project.id}/edit`} />}><Edit />Edit</Button>
          {project.status === "ARCHIVED" ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: project.id, restore: true })}><RotateCcw />Restore</Button> : <AlertDialog><AlertDialogTrigger render={<Button size="sm" variant="destructive" disabled={action.isPending} />}><Archive />Archive</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive {project.title}?</AlertDialogTitle><AlertDialogDescription>Project history, files, messages, worksheet mapping, and sync history will be preserved.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => action.mutate({ id: project.id, restore: false })}>Archive</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
        </CardFooter>
      </Card>)}
    </section>
  </main>;
}
