import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/src/lib/api-client";
import { archiveProject, getActiveAssignees, getProjects, restoreProject, updateProject, updateProjectStatus } from "../projects.api";

vi.mock("@/src/lib/api-client", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

describe("projects API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds practical list filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getProjects({ search: " launch ", status: "ARCHIVED", clientId: "client-1", assignedUserId: "user-1", projectType: "SEO_MANAGEMENT", month: 8, year: 2026 });
    expect(apiClient.get).toHaveBeenCalledWith("/projects?clientId=client-1&status=ARCHIVED&search=launch&assignedUserId=user-1&projectType=SEO_MANAGEMENT&month=8&year=2026");
  });

  it("calls edit and lifecycle endpoints", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: "project-1" } });
    await updateProject("project-1", { title: "Updated" });
    await updateProjectStatus("project-1", "COMPLETED");
    await archiveProject("project-1");
    await restoreProject("project-1");
    await getActiveAssignees();
    expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-1", { title: "Updated" });
    expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-1/status", { status: "COMPLETED" });
    expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-1/archive");
    expect(apiClient.patch).toHaveBeenCalledWith("/projects/project-1/restore");
    expect(apiClient.get).toHaveBeenCalledWith("/users/active-assignees");
  });
});
