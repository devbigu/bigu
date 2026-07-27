import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectResearchPage from "@/src/app/(dashboard)/projects/[projectId]/research/page";
import * as api from "@/src/features/project-research/api";

vi.mock("next/navigation", () => ({ useParams: () => ({ projectId: "project-1" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const workspace: api.ResearchWorkspace = {
  project: { id: "project-1", title: "Launch Plan", status: "ACTIVE", projectType: "SOCIAL_MEDIA_MANAGEMENT", platforms: ["Instagram"], updatedAt: "2026-07-26T00:00:00.000Z" },
  client: { id: "client-1", name: "Acme", status: "ACTIVE" },
  brief: null,
  competitors: [],
  references: [],
  observations: [],
  pendingFindings: [{ id: "finding-1", category: "COMPETITOR", title: "Video gap", proposedValue: { recommendation: "Use reels" }, explanation: "Based on notes", evidence: [], confidence: 0.8, status: "PENDING" }],
  approvedFindings: [],
  rejectedFindingCount: 1,
  strategy: null,
  spreadsheetSyncState: null,
  researchStatus: "Findings awaiting review",
  readOnly: false,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProjectResearchPage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(api, "getResearchWorkspace").mockResolvedValue(workspace);
  vi.spyOn(api, "saveResearchBrief").mockResolvedValue({});
  vi.spyOn(api, "createCompetitor").mockResolvedValue({});
  vi.spyOn(api, "createReference").mockResolvedValue({});
  vi.spyOn(api, "createObservation").mockResolvedValue({});
  vi.spyOn(api, "analyzeResearch").mockResolvedValue({});
  vi.spyOn(api, "reviewFinding").mockResolvedValue({});
  vi.spyOn(api, "generateStrategy").mockResolvedValue({ businessObjective: "Grow awareness", contentPillars: ["Education"] });
  vi.spyOn(api, "saveStrategy").mockResolvedValue({});
  vi.spyOn(api, "approveStrategy").mockResolvedValue({});
});

describe("ProjectResearchPage", () => {
  it("loads the workspace and saves a research brief", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Marketing Research" })).toBeInTheDocument();
    await userEvent.type(screen.getByText("Business goal").parentElement!.querySelector("textarea")!, "Grow qualified leads");
    await userEvent.click(screen.getByRole("button", { name: /save brief/i }));
    await waitFor(() => expect(api.saveResearchBrief).toHaveBeenCalledWith("project-1", expect.objectContaining({ businessGoal: "Grow qualified leads" })));
  });

  it("adds a competitor and displays API errors safely for bad references", async () => {
    vi.mocked(api.createReference).mockRejectedValueOnce({ response: { data: { message: "url must be a URL address" } } });
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Competitors" }));
    await userEvent.type(screen.getByLabelText("Competitor name"), "Rival Co");
    await userEvent.click(screen.getByRole("button", { name: /add competitor/i }));
    await waitFor(() => expect(api.createCompetitor).toHaveBeenCalledWith("project-1", expect.objectContaining({ name: "Rival Co" })));
    await userEvent.click(screen.getByRole("tab", { name: "References" }));
    await userEvent.type(screen.getByLabelText("Reference title"), "Post");
    await userEvent.type(screen.getByLabelText("Reference URL"), "not-a-url");
    await userEvent.click(screen.getByRole("button", { name: /add reference/i }));
    await waitFor(() => expect(api.createReference).toHaveBeenCalled());
  });

  it("reviews findings and keeps archived projects read-only", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Findings" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(api.reviewFinding).toHaveBeenCalledWith("project-1", "finding-1", { action: "APPROVE" }));

    cleanup();
    vi.mocked(api.getResearchWorkspace).mockResolvedValueOnce({ ...workspace, readOnly: true, project: { ...workspace.project, status: "ARCHIVED" } });
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Findings" }));
    expect(screen.getByRole("button", { name: /generate findings/i })).toBeDisabled();
  });
});