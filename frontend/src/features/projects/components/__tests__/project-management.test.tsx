import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/src/app/(dashboard)/projects/page";
import EditProjectPage from "@/src/app/(dashboard)/projects/[projectId]/edit/page";
import ProjectWorkspacePage from "@/src/app/(dashboard)/projects/[projectId]/page";
import * as projectsApi from "@/src/features/projects/api";
import * as clientsApi from "@/src/features/clients";
import * as workspaceApi from "@/src/features/project-workspace/api";
import * as projectResearchApi from "@/src/features/project-research/api";
import type { Project } from "@/src/features/projects/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "project-1" }),
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const project: Project = {
  id: "project-1",
  clientId: "client-1",
  client: { id: "client-1", name: "Acme Foods", industry: null, description: null, status: "ACTIVE" },
  title: "Launch Plan",
  projectType: "SOCIAL_MEDIA_MANAGEMENT",
  growthObjective: "Grow reach",
  platforms: ["Instagram", "LinkedIn"],
  startDate: "2026-08-01T00:00:00.000Z",
  endDate: "2026-08-31T00:00:00.000Z",
  month: 8,
  year: 2026,
  assignedUserId: "user-1",
  assignedUser: { id: "user-1", name: "Ada", username: "ada", email: "ada@bigu.test" },
  contentTarget: 20,
  status: "ACTIVE",
  spreadsheetWorksheet: { id: "worksheet-1", status: "READY", externalWorksheetId: "sheet-1" },
  createdAt: "2026-07-26T00:00:00.000Z",
  updatedAt: "2026-07-26T01:00:00.000Z",
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(clientsApi, "getClients").mockResolvedValue([project.client! as unknown as clientsApi.Client]);
  vi.spyOn(projectsApi, "getActiveAssignees").mockResolvedValue([project.assignedUser!]);
  vi.spyOn(projectsApi, "getProjects").mockResolvedValue([project]);
  vi.spyOn(projectsApi, "archiveProject").mockResolvedValue({ ...project, status: "ARCHIVED" });
  vi.spyOn(projectsApi, "restoreProject").mockResolvedValue(project);
  vi.spyOn(projectsApi, "getProject").mockResolvedValue(project);
  vi.spyOn(projectsApi, "updateProject").mockResolvedValue({ ...project, title: "Updated Plan" });
  vi.spyOn(projectsApi, "updateProjectStatus").mockResolvedValue({ ...project, status: "COMPLETED" });
  vi.spyOn(projectResearchApi, "getResearchWorkspace").mockResolvedValue({
    project: { id: project.id, title: project.title, status: project.status, projectType: project.projectType, platforms: project.platforms, updatedAt: project.updatedAt },
    client: project.client!,
    brief: null,
    competitors: [],
    references: [],
    observations: [],
    pendingFindings: [],
    approvedFindings: [],
    rejectedFindingCount: 0,
    strategy: null,
    spreadsheetSyncState: null,
    researchStatus: "Not started",
    readOnly: false,
  } as projectResearchApi.ResearchWorkspace);
  vi.spyOn(workspaceApi, "getProjectWorkspace").mockResolvedValue({
    project,
    client: project.client!,
    conversation: { id: "conversation-1" },
    messages: [{ id: "message-1", senderType: "USER", content: "Existing history", status: "COMPLETED", createdAt: "2026-07-26T00:00:00.000Z" }],
    changeRequests: [],
    instructions: [],
    files: [{ id: "file-1", originalName: "brief.txt", mimeType: "text/plain", sizeBytes: 10, processingStatus: "READY_FOR_REVIEW" }],
  } as unknown as workspaceApi.ProjectWorkspace);
});

describe("project management UI", () => {
  it("loads projects, displays records, and sends search filters", async () => {
    renderWithClient(<ProjectsPage />);
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(await screen.findByText("Launch Plan")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search projects"), "launch");
    await waitFor(() => expect(projectsApi.getProjects).toHaveBeenLastCalledWith(expect.objectContaining({ search: "launch" })));
  });

  it("shows empty, error retry, and restore states", async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValueOnce([]);
    renderWithClient(<ProjectsPage />);
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();

    cleanup();
    vi.mocked(projectsApi.getProjects).mockRejectedValueOnce(new Error("down"));
    renderWithClient(<ProjectsPage />);
    expect(await screen.findByText("Projects could not be loaded.")).toBeInTheDocument();

    cleanup();
    vi.mocked(projectsApi.getProjects).mockResolvedValueOnce([{ ...project, status: "ARCHIVED" }]);
    renderWithClient(<ProjectsPage />);
    expect(await screen.findByRole("button", { name: /restore/i })).toBeInTheDocument();
  });

  it("loads edit values and submits editable fields", async () => {
    renderWithClient(<EditProjectPage />);
    const title = await screen.findByLabelText("Project title *");
    await userEvent.clear(title);
    await userEvent.type(title, "Updated Plan");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() => expect(projectsApi.updateProject).toHaveBeenCalledWith("project-1", expect.objectContaining({ title: "Updated Plan", assignedUserId: "user-1" })));
  });

  it("shows actual project title and disables message and upload controls when archived", async () => {
    vi.mocked(workspaceApi.getProjectWorkspace).mockResolvedValueOnce({
      project: { ...project, status: "ARCHIVED" },
      client: project.client!,
      conversation: { id: "conversation-1" },
      messages: [{ id: "message-1", senderType: "USER", content: "Existing history", status: "COMPLETED", createdAt: "2026-07-26T00:00:00.000Z" }],
      changeRequests: [],
      instructions: [],
      files: [{ id: "file-1", originalName: "brief.txt", mimeType: "text/plain", sizeBytes: 10, processingStatus: "READY_FOR_REVIEW" }],
    } as unknown as workspaceApi.ProjectWorkspace);
    renderWithClient(<ProjectWorkspacePage />);
    expect(await screen.findByRole("heading", { name: "Launch Plan" })).toBeInTheDocument();
    expect(screen.getByText(/archived and read-only/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.getByLabelText("Attach file")).toBeDisabled();
    expect(screen.getByText("Existing history")).toBeInTheDocument();
  });
});
