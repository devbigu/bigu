import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GrowthPlansPage from "@/src/app/(dashboard)/growth-plans/page";
import GrowthPlanDetailPage from "@/src/app/(dashboard)/growth-plans/[projectId]/page";
import * as api from "@/src/features/growth-plans/api";
import * as clientsApi from "@/src/features/clients";
import * as projectsApi from "@/src/features/projects";

vi.mock("next/navigation", () => ({ useParams: () => ({ projectId: "project-approved" }) }));

const item: api.GrowthPlanListItem = {
  projectId: "project-draft",
  projectTitle: "August Growth Plan",
  projectType: "SOCIAL_MEDIA_MANAGEMENT",
  projectStatus: "ACTIVE",
  strategyStatus: "DRAFT",
  researchStatus: "PENDING_REVIEW",
  client: { id: "client-1", name: "Acme Foods", status: "ACTIVE" },
  assignedUser: { id: "user-1", name: "Ada Manager", email: "ada@bigu.test" },
  strategy: { id: "strategy-1", status: "DRAFT", businessObjective: "Grow leads", platformPriorities: ["Instagram"], contentPillars: ["Education"], kpis: ["Leads"], updatedAt: "2026-07-28T00:00:00.000Z", approvedAt: null, approvedBy: null, author: { id: "user-1", name: "Ada Manager", email: "ada@bigu.test" } },
  research: { briefExists: true, approvedFindingCount: 2, pendingFindingCount: 1 },
  spreadsheet: { configured: true, worksheetStatus: "SYNCED", lastSyncedAt: "2026-07-28T00:00:00.000Z", worksheetUrl: "https://sheet.test/#gid=1" },
  lastUpdated: "2026-07-28T00:00:00.000Z",
  isReadOnly: false,
};
const notStarted = { ...item, projectId: "project-new", projectTitle: "No Strategy Plan", strategyStatus: "NOT_STARTED" as const, strategy: null, research: { briefExists: false, approvedFindingCount: 0, pendingFindingCount: 0 }, spreadsheet: { configured: false, worksheetStatus: null, lastSyncedAt: null, worksheetUrl: null } };
const approved = { ...item, projectId: "project-approved", projectTitle: "Approved Plan", strategyStatus: "APPROVED" as const, strategy: { ...item.strategy!, id: "strategy-approved", status: "APPROVED" as const, approvedAt: "2026-07-28T00:00:00.000Z", approvedBy: { id: "user-2", name: "Grace", email: "grace@bigu.test" } }, research: { briefExists: true, approvedFindingCount: 3, pendingFindingCount: 0 }, isReadOnly: true, projectStatus: "ARCHIVED" };

function response(data = [item, notStarted, approved]) {
  return { summary: { totalProjects: data.length, notStarted: data.filter((plan) => plan.strategyStatus === "NOT_STARTED").length, draft: data.filter((plan) => plan.strategyStatus === "DRAFT").length, approved: data.filter((plan) => plan.strategyStatus === "APPROVED").length, pendingResearchReview: data.filter((plan) => plan.research.pendingFindingCount > 0).length, archived: data.filter((plan) => plan.projectStatus === "ARCHIVED").length }, data };
}
function renderWithClient(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(api, "getGrowthPlans").mockResolvedValue(response());
  vi.spyOn(api, "getGrowthPlan").mockResolvedValue({
    ...approved,
    project: { id: "project-approved", title: "Approved Plan", projectType: "SOCIAL_MEDIA_MANAGEMENT", growthObjective: "Grow leads", platforms: ["Instagram"], month: 8, year: 2026, status: "ARCHIVED", updatedAt: "2026-07-28T00:00:00.000Z" },
    strategy: { ...approved.strategy!, businessObjective: "Grow leads", audienceSegments: ["Owners"], recommendedFormats: ["Reels"], postingFrequency: ["3 weekly"], brandVoiceGuidance: "Clear", engagementStrategy: "Reply fast", campaignIdeas: ["Launch"], hashtagGroups: ["#growth"], keywordGroups: ["marketing"], callsToAction: ["Book now"], risks: ["Capacity"], assumptions: ["Budget"] },
    research: { ...approved.research, competitors: [], references: [], approvedFindings: [{ id: "finding-1", category: "AUDIENCE", title: "Owners respond to proof", proposedValue: { segment: "owners" }, explanation: "Approved only", evidence: [], confidence: 0.8, reviewedAt: "2026-07-28T00:00:00.000Z" }], reviewSummary: { pendingFindingCount: 1, rejectedFindingCount: 1 } },
    export: { available: true, excelUrl: "/api/projects/project-approved/spreadsheet/export" },
    actions: { canGenerate: false, canEdit: false, canApprove: false, canExport: true, canSync: false, isReadOnly: true },
    links: { project: "/projects/project-approved", research: "/projects/project-approved/research", editStrategy: "/projects/project-approved/research", worksheet: "https://sheet.test/#gid=1" },
  });
  vi.spyOn(clientsApi, "getClients").mockResolvedValue([{ id: "client-1", name: "Acme Foods", industry: null, description: null, status: "ACTIVE", createdAt: "", updatedAt: "" } as any]);
  vi.spyOn(projectsApi, "getActiveAssignees").mockResolvedValue([{ id: "user-1", name: "Ada Manager", username: "ada", email: "ada@bigu.test" }]);
});

describe("Growth Plans", () => {
  it("loads summary, list statuses, and actions", async () => {
    renderWithClient(<GrowthPlansPage />);
    expect(await screen.findByRole("heading", { name: "Growth Plans" })).toBeInTheDocument();
    expect(screen.getByText("Draft strategies")).toBeInTheDocument();
    expect(screen.getByText("August Growth Plan")).toBeInTheDocument();
    expect(screen.getByText("No Strategy Plan")).toBeInTheDocument();
    expect(screen.getAllByText("Not started").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /research/i })).toHaveAttribute("href", "/projects/project-draft/research");
  });

  it("updates filters, clears filters, and shows no-results state", async () => {
    vi.mocked(api.getGrowthPlans).mockResolvedValueOnce(response()).mockResolvedValueOnce(response([item])).mockResolvedValueOnce(response([]));
    renderWithClient(<GrowthPlansPage />);
    await screen.findByText("August Growth Plan");
    await userEvent.selectOptions(screen.getByLabelText("Strategy status"), "DRAFT");
    await waitFor(() => expect(api.getGrowthPlans).toHaveBeenLastCalledWith(expect.objectContaining({ strategyStatus: "DRAFT" })));
    await userEvent.type(screen.getByLabelText("Search growth plans"), "missing");
    await waitFor(() => expect(screen.getByText("No matching growth plans")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    await waitFor(() => expect(api.getGrowthPlans).toHaveBeenLastCalledWith({}));
  });

  it("renders API error with retry", async () => {
    vi.mocked(api.getGrowthPlans).mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(response());
    renderWithClient(<GrowthPlansPage />);
    expect(await screen.findByText("Growth plans could not be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("August Growth Plan")).toBeInTheDocument();
  });

  it("renders structured detail without raw JSON and archive actions are read-only", async () => {
    renderWithClient(<GrowthPlanDetailPage />);
    expect(await screen.findByRole("heading", { name: "Approved Plan" })).toBeInTheDocument();
    expect(screen.getByText("Read-only archive")).toBeInTheDocument();
    expect(screen.getByText("Audience segments")).toBeInTheDocument();
    expect(screen.getByText("Owners")).toBeInTheDocument();
    expect(screen.queryByText(/\{"segment"/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit draft/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /excel/i })).toHaveAttribute("href", "/api/projects/project-approved/spreadsheet/export");
  });
});

