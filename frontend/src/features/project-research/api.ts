import { apiClient } from "@/src/lib/api-client";

export type ResearchFindingStatus = "PENDING" | "APPROVED" | "REJECTED";
export type StrategyStatus = "DRAFT" | "APPROVED";

export type ResearchBrief = {
  id?: string;
  businessGoal?: string | null;
  researchGoal?: string | null;
  targetMarket?: string | null;
  geographicFocus?: string | null;
  audienceNotes?: string | null;
  knownCompetitors?: string[];
  platforms?: string[];
  constraints?: string | null;
  additionalContext?: string | null;
};

export type Competitor = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  linkedinUrl?: string | null;
  platforms: string[];
  contentPillars: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  notes?: string | null;
};

export type ResearchReference = {
  id: string;
  title: string;
  url?: string | null;
  type: string;
  platform?: string | null;
  description?: string | null;
  tags: string[];
};

export type Observation = {
  id: string;
  category: string;
  title: string;
  content: string;
  sourceReferenceId?: string | null;
  sourceCompetitorId?: string | null;
};

export type Finding = {
  id: string;
  category: string;
  title: string;
  proposedValue: Record<string, unknown>;
  explanation?: string | null;
  evidence?: Array<{ type: string; id: string }>;
  confidence?: number | null;
  status: ResearchFindingStatus;
};

export type MarketingStrategy = {
  id?: string;
  businessObjective?: string | null;
  audienceSegments?: unknown[] | null;
  platformPriorities?: unknown[] | null;
  contentPillars?: unknown[] | null;
  recommendedFormats?: unknown[] | null;
  postingFrequency?: unknown;
  brandVoiceGuidance?: string | null;
  engagementStrategy?: string | null;
  campaignIdeas?: unknown[] | null;
  hashtagGroups?: unknown[] | null;
  keywordGroups?: unknown[] | null;
  callsToAction?: unknown[] | null;
  kpis?: unknown[] | null;
  risks?: unknown[] | null;
  assumptions?: unknown[] | null;
  status?: StrategyStatus;
};

export type ResearchWorkspace = {
  project: { id: string; title: string; status: string; projectType: string | null; platforms: string[]; updatedAt: string };
  client: { id: string; name: string; status: string };
  brief: ResearchBrief | null;
  competitors: Competitor[];
  references: ResearchReference[];
  observations: Observation[];
  pendingFindings: Finding[];
  approvedFindings: Finding[];
  rejectedFindingCount: number;
  strategy: MarketingStrategy | null;
  spreadsheetSyncState: { status: string; requestedAt: string; completedAt: string | null; errorCode: string | null } | null;
  researchStatus: string;
  readOnly: boolean;
};

const path = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/research`;

export async function getResearchWorkspace(projectId: string) {
  return (await apiClient.get<ResearchWorkspace>(path(projectId))).data;
}

export async function saveResearchBrief(projectId: string, input: ResearchBrief) {
  return (await apiClient.put(`${path(projectId)}/brief`, input)).data;
}

export async function createCompetitor(projectId: string, input: Partial<Competitor> & { name: string }) {
  return (await apiClient.post(`${path(projectId)}/competitors`, input)).data;
}

export async function createReference(projectId: string, input: Partial<ResearchReference> & { title: string }) {
  return (await apiClient.post(`${path(projectId)}/references`, input)).data;
}

export async function createObservation(projectId: string, input: Partial<Observation> & { title: string; content: string }) {
  return (await apiClient.post(`${path(projectId)}/observations`, input)).data;
}

export async function analyzeResearch(projectId: string, input: { categories?: string[]; focusInstructions?: string }) {
  return (await apiClient.post(`${path(projectId)}/analyze`, input)).data;
}

export async function reviewFinding(projectId: string, findingId: string, input: Record<string, unknown>) {
  return (await apiClient.patch(`${path(projectId)}/findings/${encodeURIComponent(findingId)}`, input)).data;
}

export async function generateStrategy(projectId: string) {
  return (await apiClient.post(`${path(projectId)}/strategy/generate`)).data;
}

export async function saveStrategy(projectId: string, input: MarketingStrategy) {
  return (await apiClient.patch(`${path(projectId)}/strategy`, input)).data;
}

export async function approveStrategy(projectId: string) {
  return (await apiClient.post(`${path(projectId)}/strategy/approve`)).data;
}