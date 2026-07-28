import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GrowthPlansService } from './growth-plans.service';

const user = { id: 'user-1', name: 'Ada Manager', email: 'ada@bigu.test' };
const otherUser = { id: 'user-2', name: 'Grace Staff', email: 'grace@bigu.test' };
const clientA = { id: 'client-a', name: 'Acme Foods', status: 'ACTIVE' };
const clientB = { id: 'client-b', name: 'Beta Retail', status: 'ACTIVE' };
const now = new Date('2026-07-28T10:00:00.000Z');

function strategy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'strategy-1',
    businessObjective: 'Increase qualified leads',
    audienceSegments: ['owners'],
    platformPriorities: ['Instagram', 'LinkedIn'],
    contentPillars: ['Education'],
    recommendedFormats: ['Reels'],
    postingFrequency: ['3 weekly'],
    brandVoiceGuidance: 'Clear and useful',
    engagementStrategy: 'Reply quickly',
    campaignIdeas: ['Launch series'],
    hashtagGroups: ['#growth'],
    keywordGroups: ['marketing'],
    callsToAction: ['Book a consult'],
    kpis: ['Leads'],
    risks: ['Low creative supply'],
    assumptions: ['Budget approved'],
    status: 'DRAFT',
    generatedFromApprovedResearchAt: now,
    createdBy: user,
    updatedBy: user,
    approvedBy: null,
    approvedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-a',
    title: 'August Growth Plan',
    projectType: 'SOCIAL_MEDIA_MANAGEMENT',
    growthObjective: 'Grow awareness',
    platforms: ['Instagram'],
    month: 8,
    year: 2026,
    status: ProjectStatus.ACTIVE,
    updatedAt: now,
    client: clientA,
    assignedUser: user,
    marketingStrategy: null,
    researchBrief: null,
    researchFindings: [],
    spreadsheetWorksheet: null,
    researchCompetitors: [],
    researchReferences: [],
    ...overrides,
  };
}

const approvedFinding = {
  id: 'finding-approved',
  status: 'APPROVED',
  category: 'AUDIENCE',
  title: 'Approved audience',
  proposedValue: { segment: 'owners' },
  explanation: 'From approved research',
  evidence: [{ type: 'REFERENCE', id: 'ref-1' }],
  confidence: 0.8,
  reviewedAt: now,
  updatedAt: now,
};
const pendingFinding = { ...approvedFinding, id: 'finding-pending', status: 'PENDING', title: 'Pending idea' };
const rejectedFinding = { ...approvedFinding, id: 'finding-rejected', status: 'REJECTED', title: 'Rejected idea' };

function makeService(records = [
  project(),
  project({ id: 'project-b', title: 'Draft Plan', client: clientB, assignedUser: otherUser, marketingStrategy: strategy(), researchBrief: { id: 'brief-1', updatedAt: now }, researchFindings: [approvedFinding, pendingFinding] }),
  project({ id: 'project-c', title: 'Approved Plan', marketingStrategy: strategy({ id: 'strategy-approved', status: 'APPROVED', approvedBy: user, approvedAt: now }), researchFindings: [approvedFinding] }),
  project({ id: 'project-d', title: 'Archived Plan', status: ProjectStatus.ARCHIVED, marketingStrategy: strategy({ id: 'strategy-archived', status: 'APPROVED' }), researchFindings: [approvedFinding] }),
]) {
  const prisma = {
    project: {
      findMany: jest.fn(async ({ where }) => applyWhere(records, where)),
      findUnique: jest.fn(async ({ where }) => records.find((item) => item.id === where.id) ?? null),
    },
  } as unknown as jest.Mocked<PrismaService>;
  return { service: new GrowthPlansService(prisma), prisma };
}

function applyWhere(records: any[], where: any = {}) {
  return records.filter((item) => {
    if (where.id && item.id !== where.id) return false;
    if (where.clientId && item.client.id !== where.clientId) return false;
    if (where.projectType && item.projectType !== where.projectType) return false;
    if (where.assignedUserId && item.assignedUser?.id !== where.assignedUserId) return false;
    if (where.month !== undefined && item.month !== where.month) return false;
    if (where.year !== undefined && item.year !== where.year) return false;
    if (where.status?.not && item.status === where.status.not) return false;
    if (typeof where.status === 'string' && item.status !== where.status) return false;
    if (where.marketingStrategy?.is === null && item.marketingStrategy) return false;
    if (where.marketingStrategy?.is?.status && item.marketingStrategy?.status !== where.marketingStrategy.is.status) return false;
    if (where.OR) {
      const search = where.OR[0].title.contains.toLowerCase();
      const haystack = [item.title, item.growthObjective, item.client.name, item.assignedUser?.name, item.marketingStrategy?.businessObjective].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

describe('GrowthPlansService', () => {
  it('lists projects with derived strategy statuses and excludes archived by default', async () => {
    const { service } = makeService();
    const result = await service.list({});
    expect(result.data.map((item) => item.projectId)).toEqual(['project-a', 'project-b', 'project-c']);
    expect(result.data[0].strategyStatus).toBe('NOT_STARTED');
    expect(result.data[1].strategyStatus).toBe('DRAFT');
    expect(result.data[2].strategyStatus).toBe('APPROVED');
    expect(result.summary).toMatchObject({ totalProjects: 3, notStarted: 1, draft: 1, approved: 1, pendingResearchReview: 1, archived: 0 });
  });

  it('supports archived, all, direct, and combined filters', async () => {
    const { service } = makeService();
    await expect(service.list({ projectStatus: ProjectStatus.ARCHIVED })).resolves.toMatchObject({ summary: { archived: 1 } });
    await expect(service.list({ projectStatus: 'ALL' })).resolves.toMatchObject({ summary: { totalProjects: 4, archived: 1 } });
    await expect(service.list({ strategyStatus: 'NOT_STARTED' })).resolves.toMatchObject({ summary: { notStarted: 1, totalProjects: 1 } });
    await expect(service.list({ strategyStatus: 'DRAFT', clientId: 'client-b', assignedUserId: 'user-2', projectType: 'SOCIAL_MEDIA_MANAGEMENT', month: 8, year: 2026, platform: 'insta' })).resolves.toMatchObject({ summary: { draft: 1, totalProjects: 1 } });
  });

  it('searches project title, client name, employee name, and objective', async () => {
    const { service } = makeService();
    await expect(service.list({ search: 'Draft' })).resolves.toMatchObject({ data: [expect.objectContaining({ projectId: 'project-b' })] });
    await expect(service.list({ search: 'Beta' })).resolves.toMatchObject({ data: [expect.objectContaining({ client: expect.objectContaining({ id: 'client-b' }) })] });
    await expect(service.list({ search: 'Grace' })).resolves.toMatchObject({ data: [expect.objectContaining({ assignedUser: expect.objectContaining({ id: 'user-2' }) })] });
    await expect(service.list({ search: 'qualified leads' })).resolves.toMatchObject({ data: [expect.objectContaining({ projectId: 'project-b' })] });
  });

  it('returns safe empty results', async () => {
    const { service } = makeService([]);
    await expect(service.list({ search: 'missing' })).resolves.toEqual({ summary: { totalProjects: 0, notStarted: 0, draft: 0, approved: 0, pendingResearchReview: 0, archived: 0 }, data: [] });
  });

  it('returns complete detail with trusted approved findings only', async () => {
    const { service } = makeService([
      project({
        id: 'project-c',
        marketingStrategy: strategy({ id: 'strategy-approved', status: 'APPROVED', approvedBy: user, approvedAt: now }),
        researchFindings: [approvedFinding, pendingFinding, rejectedFinding],
        researchCompetitors: [{ id: 'competitor-1', name: 'Other Brand', platforms: ['Instagram'], updatedAt: now }],
        researchReferences: [{ id: 'ref-1', title: 'Trusted post', type: 'ARTICLE', platform: 'Instagram', url: 'https://example.test', tags: ['trusted'], updatedAt: now }],
      }),
      project({ id: 'project-other', title: 'Other project', researchFindings: [{ ...approvedFinding, id: 'other-finding' }] }),
    ]);
    const detail = await service.detail('project-c');
    expect(detail.strategyStatus).toBe('APPROVED');
    expect(detail.research.approvedFindings).toHaveLength(1);
    expect(detail.research.approvedFindings[0].id).toBe('finding-approved');
    expect(JSON.stringify(detail)).not.toContain('other-finding');
    expect(detail.research.reviewSummary).toEqual({ pendingFindingCount: 1, rejectedFindingCount: 1 });
  });

  it('returns safe empty strategy state and read-only action flags', async () => {
    const { service } = makeService([project({ id: 'project-archived', status: ProjectStatus.ARCHIVED, researchFindings: [approvedFinding] })]);
    const detail = await service.detail('project-archived');
    expect(detail.strategy).toBeNull();
    expect(detail.actions).toMatchObject({ canGenerate: false, canEdit: false, canApprove: false, isReadOnly: true });
  });

  it('throws not found for missing detail', async () => {
    const { service } = makeService([]);
    await expect(service.detail('missing')).rejects.toThrow(NotFoundException);
  });
});

