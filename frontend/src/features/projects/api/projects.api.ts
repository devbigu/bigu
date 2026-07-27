import { apiClient } from "@/src/lib/api-client";
import type {
  CreateProjectInput,
  Project,
  ProjectAssignee,
  ProjectListFilters,
  ProjectStatus,
  UpdateProjectInput,
} from "../types";

export async function getProjects(filters: ProjectListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.status) params.set("status", filters.status);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
  if (filters.projectType) params.set("projectType", filters.projectType);
  if (filters.month) params.set("month", String(filters.month));
  if (filters.year) params.set("year", String(filters.year));
  return (
    await apiClient.get<Project[]>(
      "/projects" + (params.size ? "?" + params.toString() : ""),
    )
  ).data;
}

export async function getProject(projectId: string) {
  return (
    await apiClient.get<Project>(`/projects/${encodeURIComponent(projectId)}`)
  ).data;
}

export async function createProject(input: CreateProjectInput) {
  return (await apiClient.post<Project>("/projects", input)).data;
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  return (
    await apiClient.patch<Project>(`/projects/${encodeURIComponent(projectId)}`, input)
  ).data;
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  return (
    await apiClient.patch<Project>(`/projects/${encodeURIComponent(projectId)}/status`, { status })
  ).data;
}

export async function archiveProject(projectId: string) {
  return (
    await apiClient.patch<Project>(`/projects/${encodeURIComponent(projectId)}/archive`)
  ).data;
}

export async function restoreProject(projectId: string) {
  return (
    await apiClient.patch<Project>(`/projects/${encodeURIComponent(projectId)}/restore`)
  ).data;
}

export async function getActiveAssignees() {
  return (await apiClient.get<ProjectAssignee[]>("/users/active-assignees")).data;
}
