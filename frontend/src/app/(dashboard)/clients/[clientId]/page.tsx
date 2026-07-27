"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandLoader } from "@/src/components/ui/brand-loader";
import { getClient } from "@/src/features/clients";
import { getProjects, type Project, type ProjectStatus } from "@/src/features/projects";
import { ClientSpreadsheetCard } from "@/src/features/spreadsheets/components/spreadsheet-status-card";

function projectPeriod(project: Project) {
  if (project.month && project.year) {
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
      new Date(project.year, project.month - 1),
    );
  }
  if (project.startDate) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(project.startDate),
    );
  }
  return null;
}

export default function ClientOverviewPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const filters = { clientId, search: search || undefined, status };
  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", filters],
    queryFn: () => getProjects(filters),
    enabled: Boolean(clientId),
  });

  if (clientQuery.isLoading) return <BrandLoader fullScreen label="Loading client projects..." />;
  if (clientQuery.isError || !clientQuery.data) {
    return (
      <main className="grid min-h-[70vh] place-items-center p-6">
        <Card><CardContent className="p-8 text-center">
          <p>Client could not be loaded.</p>
          <Button className="mt-4" onClick={() => clientQuery.refetch()}>Try again</Button>
        </CardContent></Card>
      </main>
    );
  }

  const client = clientQuery.data;
  const createHref = `/projects/new?clientId=${client.id}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{client.name}</h1>
            <Badge variant={client.status === "ACTIVE" ? "default" : "secondary"}>
              {client.status === "ACTIVE" ? "Active" : "Archived"}
            </Badge>
          </div>
          <p className="text-muted-foreground">{client.industry || "Industry not specified"}</p>
          {client.description && (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{client.description}</p>
          )}
        </div>
        {client.status === "ACTIVE" && (
          <Button nativeButton={false} render={<Link href={createHref} />}><Plus />New project</Button>
        )}
      </header>

      <ClientSpreadsheetCard clientId={clientId} />

      <section className="space-y-5" aria-labelledby="projects-heading">
        <div>
          <h2 id="projects-heading" className="text-xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Select a project to open its chat, files, context, and history.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects..." aria-label="Search projects" />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus | "ALL")}>
            <SelectTrigger aria-label="Project status filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {projectsQuery.isLoading && <BrandLoader label="Loading projects..." />}
        {projectsQuery.isError && (
          <Card><CardContent className="py-10 text-center">
            <p>Projects could not be loaded.</p>
            <Button className="mt-4" variant="outline" onClick={() => projectsQuery.refetch()}>Try again</Button>
          </CardContent></Card>
        )}
        {projectsQuery.data?.length === 0 && (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center">
            <FolderKanban className="mb-4 size-9 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              {search || status !== "ALL" ? "No projects match these filters" : "No projects yet"}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {search || status !== "ALL"
                ? "Try a different search term or project status."
                : "Create a project to start planning, uploading context, and chatting with BigU."}
            </p>
            {!search && status === "ALL" && client.status === "ACTIVE" && (
              <Button className="mt-5" nativeButton={false} render={<Link href={createHref} />}>
                <Plus />Create project
              </Button>
            )}
          </CardContent></Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {projectsQuery.data?.map((project) => {
            const period = projectPeriod(project);
            return (
              <Card key={project.id} className="relative transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>
                        <Link className="after:absolute after:inset-0 hover:underline" href={`/projects/${project.id}`}>
                          {project.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {[project.projectType, period].filter(Boolean).join(" / ") || "Project workspace"}
                      </CardDescription>
                    </div>
                    <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
                      {project.status.toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {project.growthObjective || "No growth objective added yet."}
                  </p>
                  {project.platforms.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {project.platforms.map((platform) => (
                        <Badge key={platform} variant="outline">{platform}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
