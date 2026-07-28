import { apiClient } from "@/src/lib/api-client";

export type GrowthPlanStrategyStatus = "NOT_STARTED" | "DRAFT" | "APPROVED";
export type GrowthPlanResearchStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "APPROVED";

export type GrowthPlanFilters = {
  search?: string;
  clientId?: string;
  projectId?: string;
  strategyStatus?: GrowthPlanStrategyStatus;
  projectStatus?: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED" | "ALL";
  projectType?: string;
  assignedUserId?: string;
  platform?: string;
  month?: number;
  year?: number;
  researchStatus?: GrowthPlanResearchStatus;
};

export type GrowthPlanSummary = {
  totalProjects: number;
  notStarted: number;
  draft: number;
  approved: number;
  pendingResearchReview: number;
  archived: number;
};

export type GrowthPlanListItem = {
  projectId: string;
  projectTitle: string;
  projectType: string | null;
  projectStatus: string;
  strategyStatus: GrowthPlanStrategyStatus;
  researchStatus: GrowthPlanResearchStatus;
  client: { id: string; name: string; status: string };
  assignedUser: { id: string; name: string; email: string } | null;
  strategy: {
    id: string;
    status: "DRAFT" | "APPROVED";
    businessObjective: string | null;
    platformPriorities: unknown[];
    contentPillars: unknown[];
    kpis: unknown[];
    updatedAt: string;
    approvedAt: string | null;
    approvedBy: { id: string; name: string; email: string } | null;
    author: { id: string; name: string; email: string };
  } | null;
  research: { briefExists: boolean; approvedFindingCount: number; pendingFindingCount: number };
  spreadsheet: { configured: boolean; worksheetStatus: string | null; lastSyncedAt: string | null; worksheetUrl: string | null };
  lastUpdated: string;
  isReadOnly: boolean;
};

export type GrowthPlanDetail = GrowthPlanListItem & {
  project: {
    id: string;
    title: string;
    projectType: string | null;
    growthObjective: string | null;
    platforms: string[];
    month: number | null;
    year: number | null;
    status: string;
    updatedAt: string;
  };
  strategy: (NonNullable<GrowthPlanListItem["strategy"]> & Record<string, unknown>) | null;
  research: GrowthPlanListItem["research"] & {
    competitors: Array<{ id: string; name: string; platformCount: number }>;
    references: Array<{ id: string; title: string; type: string; platform: string | null; url: string | null; tags: string[]; updatedAt: string }>;
    approvedFindings: Array<{ id: string; category: string; title: string; proposedValue: unknown; explanation: string | null; evidence: unknown; confidence: number | null; reviewedAt: string | null }>;
    reviewSummary: { pendingFindingCount: number; rejectedFindingCount: number };
  };
  export: { available: boolean; excelUrl: string };
  actions: { canGenerate: boolean; canEdit: boolean; canApprove: boolean; canExport: boolean; canSync: boolean; isReadOnly: boolean };
  links: { project: string; research: string; editStrategy: string; worksheet: string | null };
};

export type GrowthPlansResponse = { summary: GrowthPlanSummary; data: GrowthPlanListItem[] };

export async function getGrowthPlans(filters: GrowthPlanFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return (await apiClient.get<GrowthPlansResponse>(`/growth-plans${params.size ? `?${params}` : ""}`)).data;
}

export async function getGrowthPlan(projectId: string) {
  return (await apiClient.get<GrowthPlanDetail>(`/growth-plans/${encodeURIComponent(projectId)}`)).data;
}
