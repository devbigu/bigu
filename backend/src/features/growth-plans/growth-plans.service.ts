import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MarketingStrategyStatus,
  Prisma,
  ProjectStatus,
  ResearchFindingStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  ListGrowthPlansQueryDto,
  PortfolioStrategyStatus,
} from './dto/list-growth-plans-query.dto';

@Injectable()
export class GrowthPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListGrowthPlansQueryDto = {}) {
    const projects = await this.prisma.project.findMany({
      where: baseWhere(query),
      select: projectSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

    const data = projects
      .map((project) => mapListItem(project))
      .filter((item) => matchesDerivedFilters(item, query));

    return { summary: summarize(data), data };
  }

  async detail(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: detailSelect,
    });
    if (!project) throw new NotFoundException('Growth plan not found.');

    const listItem = mapListItem(project);
    const archived =
      project.status === ProjectStatus.ARCHIVED ||
      project.client.status === 'ARCHIVED';

    return {
      ...listItem,
      project: {
        id: project.id,
        title: project.title,
        projectType: project.projectType,
        growthObjective: project.growthObjective,
        platforms: project.platforms,
        month: project.month,
        year: project.year,
        status: project.status,
        updatedAt: project.updatedAt,
      },
      strategy: project.marketingStrategy
        ? mapCompleteStrategy(project.marketingStrategy)
        : null,
      research: {
        ...listItem.research,
        competitors: project.researchCompetitors.map((item) => ({
          id: item.id,
          name: item.name,
          platformCount: item.platforms.length,
        })),
        references: project.researchReferences.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          platform: item.platform,
          url: item.url,
          tags: item.tags,
          updatedAt: item.updatedAt,
        })),
        approvedFindings: project.researchFindings
          .filter((item) => item.status === ResearchFindingStatus.APPROVED)
          .map((item) => ({
            id: item.id,
            category: item.category,
            title: item.title,
            proposedValue: item.proposedValue,
            explanation: item.explanation,
            evidence: item.evidence,
            confidence: item.confidence,
            reviewedAt: item.reviewedAt,
          })),
        reviewSummary: {
          pendingFindingCount: listItem.research.pendingFindingCount,
          rejectedFindingCount: project.researchFindings.filter(
            (item) => item.status === ResearchFindingStatus.REJECTED,
          ).length,
        },
      },
      export: {
        available: Boolean(project.marketingStrategy),
        excelUrl: `/api/projects/${encodeURIComponent(project.id)}/spreadsheet/export`,
      },
      actions: {
        canGenerate:
          !archived &&
          listItem.research.approvedFindingCount > 0 &&
          listItem.strategyStatus !== 'APPROVED',
        canEdit: !archived && listItem.strategyStatus === 'DRAFT',
        canApprove: !archived && listItem.strategyStatus === 'DRAFT',
        canExport: Boolean(project.marketingStrategy),
        canSync: !archived && Boolean(project.spreadsheetWorksheet),
        isReadOnly: archived,
      },
      links: {
        project: `/projects/${project.id}`,
        research: `/projects/${project.id}/research`,
        editStrategy: `/projects/${project.id}/research`,
        worksheet: listItem.spreadsheet.worksheetUrl,
      },
    };
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

const strategySelect = {
  id: true,
  businessObjective: true,
  audienceSegments: true,
  platformPriorities: true,
  contentPillars: true,
  recommendedFormats: true,
  postingFrequency: true,
  brandVoiceGuidance: true,
  engagementStrategy: true,
  campaignIdeas: true,
  hashtagGroups: true,
  keywordGroups: true,
  callsToAction: true,
  kpis: true,
  risks: true,
  assumptions: true,
  status: true,
  generatedFromApprovedResearchAt: true,
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
  approvedBy: { select: userSelect },
  approvedAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectMarketingStrategySelect;

const projectSelect = {
  id: true,
  title: true,
  projectType: true,
  growthObjective: true,
  platforms: true,
  month: true,
  year: true,
  status: true,
  updatedAt: true,
  client: { select: { id: true, name: true, status: true } },
  assignedUser: { select: userSelect },
  marketingStrategy: { select: strategySelect },
  researchBrief: { select: { id: true, updatedAt: true } },
  researchFindings: {
    select: {
      id: true,
      status: true,
      category: true,
      title: true,
      proposedValue: true,
      explanation: true,
      evidence: true,
      confidence: true,
      reviewedAt: true,
      updatedAt: true,
    },
  },
  spreadsheetWorksheet: {
    select: {
      id: true,
      status: true,
      externalWorksheetId: true,
      lastSyncedAt: true,
      workbook: { select: { externalUrl: true, status: true } },
      syncJobs: {
        orderBy: { requestedAt: 'desc' },
        take: 1,
        select: { status: true, requestedAt: true, completedAt: true },
      },
    },
  },
} satisfies Prisma.ProjectSelect;

const detailSelect = {
  ...projectSelect,
  researchCompetitors: {
    select: { id: true, name: true, platforms: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  },
  researchReferences: {
    select: {
      id: true,
      title: true,
      type: true,
      platform: true,
      url: true,
      tags: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  },
} satisfies Prisma.ProjectSelect;

type ProjectListRecord = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;
type ProjectDetailRecord = Prisma.ProjectGetPayload<{ select: typeof detailSelect }>;
type ProjectRecord = ProjectListRecord | ProjectDetailRecord;
type GrowthPlanListItem = ReturnType<typeof mapListItem>;

function baseWhere(query: ListGrowthPlansQueryDto): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};
  if (query.clientId) where.clientId = query.clientId;
  if (query.projectId) where.id = query.projectId;
  if (query.projectType) where.projectType = query.projectType;
  if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
  if (query.month !== undefined) where.month = query.month;
  if (query.year !== undefined) where.year = query.year;
  if (query.projectStatus && query.projectStatus !== 'ALL') {
    where.status = query.projectStatus;
  } else if (!query.projectStatus) {
    where.status = { not: ProjectStatus.ARCHIVED };
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { growthObjective: { contains: search, mode: 'insensitive' } },
      { client: { name: { contains: search, mode: 'insensitive' } } },
      { assignedUser: { name: { contains: search, mode: 'insensitive' } } },
      {
        marketingStrategy: {
          is: { businessObjective: { contains: search, mode: 'insensitive' } },
        },
      },
    ];
  }
  if (query.strategyStatus === 'DRAFT') {
    where.marketingStrategy = { is: { status: MarketingStrategyStatus.DRAFT } };
  } else if (query.strategyStatus === 'APPROVED') {
    where.marketingStrategy = {
      is: { status: MarketingStrategyStatus.APPROVED },
    };
  } else if (query.strategyStatus === 'NOT_STARTED') {
    where.marketingStrategy = { is: null };
  }
  return where;
}

function mapListItem(project: ProjectRecord) {
  const strategyStatus = deriveStrategyStatus(project.marketingStrategy);
  const approvedFindingCount = project.researchFindings.filter(
    (item) => item.status === ResearchFindingStatus.APPROVED,
  ).length;
  const pendingFindingCount = project.researchFindings.filter(
    (item) => item.status === ResearchFindingStatus.PENDING,
  ).length;
  const researchStatus = deriveResearchStatus({
    strategyStatus,
    briefExists: Boolean(project.researchBrief),
    approvedFindingCount,
    pendingFindingCount,
  });
  const worksheet = project.spreadsheetWorksheet;
  return {
    projectId: project.id,
    projectTitle: project.title,
    projectType: project.projectType,
    projectStatus: project.status,
    strategyStatus,
    researchStatus,
    client: project.client,
    assignedUser: project.assignedUser,
    strategy: project.marketingStrategy
      ? {
          id: project.marketingStrategy.id,
          status: project.marketingStrategy.status,
          businessObjective: project.marketingStrategy.businessObjective,
          platformPriorities: arrayValue(
            project.marketingStrategy.platformPriorities,
          ),
          contentPillars: arrayValue(project.marketingStrategy.contentPillars),
          kpis: arrayValue(project.marketingStrategy.kpis),
          updatedAt: project.marketingStrategy.updatedAt,
          approvedAt: project.marketingStrategy.approvedAt,
          approvedBy: project.marketingStrategy.approvedBy,
          author: project.marketingStrategy.createdBy,
        }
      : null,
    research: {
      briefExists: Boolean(project.researchBrief),
      approvedFindingCount,
      pendingFindingCount,
    },
    spreadsheet: {
      configured: Boolean(worksheet),
      worksheetStatus: worksheet?.syncJobs[0]?.status ?? worksheet?.status ?? null,
      lastSyncedAt: worksheet?.lastSyncedAt ?? null,
      worksheetUrl: worksheet
        ? worksheetUrl(
            worksheet.workbook.externalUrl,
            worksheet.externalWorksheetId,
          )
        : null,
    },
    lastUpdated: latestDate([
      project.marketingStrategy?.updatedAt ?? null,
      worksheet?.lastSyncedAt ?? null,
      project.updatedAt,
    ]),
    isReadOnly:
      project.status === ProjectStatus.ARCHIVED ||
      project.client.status === 'ARCHIVED',
  };
}

function mapCompleteStrategy(strategy: NonNullable<ProjectRecord['marketingStrategy']>) {
  return {
    id: strategy.id,
    status: strategy.status,
    businessObjective: strategy.businessObjective,
    audienceSegments: structuredValue(strategy.audienceSegments),
    platformPriorities: structuredValue(strategy.platformPriorities),
    contentPillars: structuredValue(strategy.contentPillars),
    recommendedFormats: structuredValue(strategy.recommendedFormats),
    postingFrequency: structuredValue(strategy.postingFrequency),
    brandVoiceGuidance: strategy.brandVoiceGuidance,
    engagementStrategy: strategy.engagementStrategy,
    campaignIdeas: structuredValue(strategy.campaignIdeas),
    hashtagGroups: structuredValue(strategy.hashtagGroups),
    keywordGroups: structuredValue(strategy.keywordGroups),
    callsToAction: structuredValue(strategy.callsToAction),
    kpis: structuredValue(strategy.kpis),
    risks: structuredValue(strategy.risks),
    assumptions: structuredValue(strategy.assumptions),
    generatedFromApprovedResearchAt: strategy.generatedFromApprovedResearchAt,
    author: strategy.createdBy,
    updatedBy: strategy.updatedBy,
    approvedBy: strategy.approvedBy,
    approvedAt: strategy.approvedAt,
    updatedAt: strategy.updatedAt,
  };
}

function matchesDerivedFilters(item: GrowthPlanListItem, query: ListGrowthPlansQueryDto) {
  if (query.researchStatus && item.researchStatus !== query.researchStatus) {
    return false;
  }
  if (query.platform) {
    const wanted = query.platform.toLowerCase();
    const platforms = [
      ...(item.strategy?.platformPriorities ?? []),
      ...(item.strategy?.contentPillars ?? []),
    ].map((value) => String(value).toLowerCase());
    if (!platforms.some((value) => value.includes(wanted))) return false;
  }
  return true;
}

function summarize(items: GrowthPlanListItem[]) {
  return items.reduce(
    (summary, item) => {
      summary.totalProjects += 1;
      if (item.strategyStatus === 'NOT_STARTED') summary.notStarted += 1;
      if (item.strategyStatus === 'DRAFT') summary.draft += 1;
      if (item.strategyStatus === 'APPROVED') summary.approved += 1;
      if (item.research.pendingFindingCount > 0) summary.pendingResearchReview += 1;
      if (item.projectStatus === ProjectStatus.ARCHIVED) summary.archived += 1;
      return summary;
    },
    {
      totalProjects: 0,
      notStarted: 0,
      draft: 0,
      approved: 0,
      pendingResearchReview: 0,
      archived: 0,
    },
  );
}

function deriveStrategyStatus(
  strategy: ProjectRecord['marketingStrategy'],
): PortfolioStrategyStatus {
  if (!strategy) return 'NOT_STARTED';
  return strategy.status;
}

function deriveResearchStatus(input: {
  strategyStatus: PortfolioStrategyStatus;
  briefExists: boolean;
  approvedFindingCount: number;
  pendingFindingCount: number;
}) {
  if (input.strategyStatus === 'APPROVED') return 'APPROVED';
  if (input.pendingFindingCount > 0) return 'PENDING_REVIEW';
  if (input.briefExists || input.approvedFindingCount > 0) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function structuredValue(value: Prisma.JsonValue | null) {
  if (value === null) return [];
  return value;
}

function arrayValue(value: Prisma.JsonValue | null) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function latestDate(values: Array<Date | null>) {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

function worksheetUrl(externalUrl: string | null, worksheetId: string | null) {
  if (!externalUrl) return null;
  if (!worksheetId) return externalUrl;
  const separator = externalUrl.includes('#') ? '&' : '#';
  return `${externalUrl}${separator}gid=${encodeURIComponent(worksheetId)}`;
}
