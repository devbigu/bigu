"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getClients } from "@/src/features/clients";
import {
  createProject,
  getActiveAssignees,
  updateProject,
} from "../api";
import { projectSchema, type ProjectFormValues } from "../schemas/project.schema";
import type { Project } from "../types";

type ProjectFormProps = {
  initialClientId?: string;
  project?: Project;
  mode?: "create" | "edit";
};

const projectTypeLabels: Record<string, string> = {
  SOCIAL_MEDIA_MANAGEMENT: "Social media management",
  SEO_MANAGEMENT: "SEO management",
  WEBSITE_DEVELOPMENT: "Website development",
  SOFTWARE_DEVELOPMENT: "Software development",
};

function errorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return "Something went wrong. Please try again.";
  const data = error.response?.data as { message?: string | string[] } | undefined;
  return Array.isArray(data?.message)
    ? data.message.join(" ")
    : data?.message || "The project could not be saved.";
}

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");
const numberInput = (value?: number | null) => (value === null || value === undefined ? "" : String(value));

function payload(values: ProjectFormValues) {
  return {
    title: values.title.trim(),
    growthObjective: values.growthObjective.trim() || undefined,
    platforms: values.platforms
      .split(",")
      .map((platform) => platform.trim())
      .filter(Boolean),
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined,
    month: values.month ? Number(values.month) : undefined,
    year: values.year ? Number(values.year) : undefined,
    assignedUserId: values.assignedUserId || undefined,
    contentTarget: values.contentTarget ? Number(values.contentTarget) : undefined,
  };
}

export function ProjectForm({ initialClientId = "", project, mode = "create" }: ProjectFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = mode === "edit";
  const archived = project?.status === "ARCHIVED";
  const clientsQuery = useQuery({
    queryKey: ["clients", { status: "ACTIVE" }],
    queryFn: () => getClients({ status: "ACTIVE" }),
    enabled: !editing,
  });
  const assigneesQuery = useQuery({
    queryKey: ["active-assignees"],
    queryFn: getActiveAssignees,
  });
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      clientId: project?.clientId ?? initialClientId,
      title: project?.title ?? "",
      projectType: project?.projectType ?? undefined,
      growthObjective: project?.growthObjective ?? "",
      platforms: project?.platforms.join(", ") ?? "",
      startDate: toDateInput(project?.startDate),
      endDate: toDateInput(project?.endDate),
      month: numberInput(project?.month),
      year: numberInput(project?.year),
      assignedUserId: project?.assignedUserId ?? "",
      contentTarget: numberInput(project?.contentTarget),
      status: project?.status === "COMPLETED" ? "COMPLETED" : project?.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
    },
  });
  const selectedClientId = useWatch({ control: form.control, name: "clientId" });
  const initialClientInvalid =
    !editing &&
    !!initialClientId &&
    clientsQuery.isSuccess &&
    !clientsQuery.data.some((client) => client.id === initialClientId);

  const mutation = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      if (editing && project) return updateProject(project.id, payload(values));
      return createProject({
        clientId: values.clientId,
        projectType: values.projectType,
        status: values.status,
        ...payload(values),
      });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project", saved.id] }),
        queryClient.invalidateQueries({ queryKey: ["project-workspace", saved.id] }),
      ]);
      queryClient.setQueryData(["project", saved.id], saved);
      toast.success(editing ? "Project updated" : "Project created");
      router.push(`/projects/${saved.id}`);
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="clientId">Client *</Label>
              {editing ? (
                <Input id="clientId" value={project?.client?.name ?? project?.clientId ?? ""} disabled />
              ) : (
                <Controller
                  name="clientId"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="clientId" aria-invalid={!!form.formState.errors.clientId}>
                        <SelectValue placeholder={clientsQuery.isLoading ? "Loading clients..." : "Choose a client"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsQuery.data?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
              {form.formState.errors.clientId && <p className="text-sm text-destructive" role="alert">{form.formState.errors.clientId.message}</p>}
              {initialClientInvalid && <p className="text-sm text-destructive" role="alert">This client does not exist or is archived. Choose an active client.</p>}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="title">Project title *</Label>
              <Input id="title" disabled={archived} {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
              {form.formState.errors.title && <p className="text-sm text-destructive" role="alert">{form.formState.errors.title.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="projectType">Project type *</Label>
              {editing ? (
                <Input id="projectType" value={project?.projectType ? projectTypeLabels[project.projectType] : "Not set"} disabled />
              ) : (
                <Controller
                  name="projectType"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="projectType" aria-invalid={!!form.formState.errors.projectType}><SelectValue placeholder="Choose a governed project type" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(projectTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
              {form.formState.errors.projectType && <p className="text-sm text-destructive" role="alert">{form.formState.errors.projectType.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="platforms">Platforms</Label>
              <Input id="platforms" placeholder="Instagram, LinkedIn, YouTube" disabled={archived} {...form.register("platforms")} />
              <p className="text-xs text-muted-foreground">Separate platforms with commas.</p>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="growthObjective">Growth objective</Label>
              <Textarea id="growthObjective" rows={4} disabled={archived} {...form.register("growthObjective")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" disabled={archived} {...form.register("startDate")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" disabled={archived} {...form.register("endDate")} aria-invalid={!!form.formState.errors.endDate} />
              {form.formState.errors.endDate && <p className="text-sm text-destructive" role="alert">{form.formState.errors.endDate.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="month">Month</Label>
              <Input id="month" type="number" min={1} max={12} placeholder="8" disabled={archived} {...form.register("month")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="year">Year</Label>
              <Input id="year" type="number" min={2000} max={2200} placeholder="2026" disabled={archived} {...form.register("year")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assignedUserId">Assigned user</Label>
              <Controller
                name="assignedUserId"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={archived || assigneesQuery.isLoading}>
                    <SelectTrigger id="assignedUserId"><SelectValue placeholder={assigneesQuery.isLoading ? "Loading assignees..." : "Unassigned"} /></SelectTrigger>
                    <SelectContent>
                      {assigneesQuery.data?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contentTarget">Content target</Label>
              <Input id="contentTarget" type="number" min={0} placeholder="30" disabled={archived} {...form.register("contentTarget")} />
            </div>

            {!editing && (
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="status">Status</Label>
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          {archived && <p className="text-sm text-muted-foreground">Archived projects are read-only. Restore this project before editing.</p>}
          {clientsQuery.isError && <p className="text-sm text-destructive" role="alert">Active clients could not be loaded.</p>}
          {assigneesQuery.isError && <p className="text-sm text-destructive" role="alert">Active assignees could not be loaded.</p>}
          {mutation.isError && <p className="text-sm text-destructive" role="alert">{errorMessage(mutation.error)}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending || archived || initialClientInvalid || !selectedClientId || clientsQuery.isLoading}>
              {mutation.isPending ? "Saving..." : editing ? "Save project" : "Create project"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
