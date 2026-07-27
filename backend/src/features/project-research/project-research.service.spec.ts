/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectStatus } from '../../generated/prisma/client';
import { AiOrchestrator } from '../../infrastructure/ai/ai-orchestrator.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { SopPolicyService } from '../projects/sop-policy.service';
import { ProjectResearchService } from './project-research.service';

function project(status: ProjectStatus = ProjectStatus.ACTIVE) {
  return {
    id: 'project-1',
    title: 'Launch Plan',
    projectType: 'SOCIAL_MEDIA_MANAGEMENT',
    platforms: ['Instagram'],
    status,
    updatedAt: new Date('2026-07-26T00:00:00Z'),
    client: {
      id: 'client-1',
      name: 'Acme',
      status: 'ACTIVE',
      industry: 'Food',
    },
  };
}

describe('ProjectResearchService', () => {
  let service: ProjectResearchService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let ai: { extractProjectActions: jest.Mock };
  let spreadsheets: { queueProjectSync: jest.Mock };

  beforeEach(() => {
    prisma = {
      project: { findUnique: jest.fn(async () => project()) },
      projectResearchBrief: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(),
      },
      projectCompetitor: {
        findMany: jest.fn(async () => [{ id: 'competitor-1', name: 'Rival' }]),
        count: jest.fn(async () => 1),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(async () => ({ id: 'competitor-1' })),
      },
      projectReference: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(async () => ({ id: 'reference-1' })),
      },
      researchObservation: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(async () => ({ id: 'observation-1' })),
      },
      researchFinding: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        create: jest.fn(async (input) => ({
          id: 'finding-created',
          ...input.data,
        })),
        findFirst: jest.fn(async () => ({
          id: 'finding-1',
          projectId: 'project-1',
          status: 'PENDING',
        })),
        update: jest.fn(async (input) => ({
          id: input.where.id,
          ...input.data,
        })),
      },
      projectMarketingStrategy: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async (input) => ({
          id: 'strategy-1',
          ...input.create,
        })),
        update: jest.fn(),
      },
      spreadsheetSyncJob: { findFirst: jest.fn(async () => null) },
      clientFile: { findFirst: jest.fn(async () => ({ id: 'file-1' })) },
    };
    ai = { extractProjectActions: jest.fn() };
    spreadsheets = {
      queueProjectSync: jest.fn(async () => ({ job: { id: 'job-1' } })),
    };
    service = new ProjectResearchService(
      prisma as unknown as PrismaService,
      ai as unknown as AiOrchestrator,
      {
        get: jest.fn((key: string) =>
          key === 'GEMINI_MODEL' ? 'gemini-test' : 'groq-test',
        ),
      } as unknown as ConfigService,
      spreadsheets as unknown as SpreadsheetsService,
      {
        loadProjectContext: jest.fn(async () => ({
          policy: { sopName: 'Social' },
          state: {},
        })),
      } as unknown as SopPolicyService,
    );
  });

  it('blocks mutations for archived projects before writing research', async () => {
    prisma.project.findUnique.mockResolvedValueOnce(
      project(ProjectStatus.ARCHIVED),
    );
    await expect(
      service.createCompetitor('project-1', { name: 'Rival' }, 'user-1'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.projectCompetitor.create).not.toHaveBeenCalled();
  });

  it('creates AI findings as pending and validates evidence against the project', async () => {
    ai.extractProjectActions.mockResolvedValue({
      provider: 'gemini',
      value: {
        summary: 'Summary',
        findings: [
          {
            category: 'COMPETITOR',
            title: 'Rivals use reels',
            proposedValue: { observation: 'Reels are common' },
            explanation: 'Based on supplied competitor notes',
            evidence: [{ type: 'COMPETITOR', id: 'competitor-1' }],
            confidence: 0.8,
          },
        ],
      },
    });
    const result = await service.analyze('project-1', {
      selectedCompetitorIds: ['competitor-1'],
    });
    expect(result.findings[0]).toMatchObject({
      status: 'PENDING',
      provider: 'gemini',
    });
    expect(prisma.researchFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-1',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('approves a pending finding and queues one idempotent project sync', async () => {
    await service.reviewFinding(
      'project-1',
      'finding-1',
      { action: 'APPROVE' },
      'reviewer-1',
    );
    expect(prisma.researchFinding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'finding-1' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
    expect(spreadsheets.queueProjectSync).toHaveBeenCalledWith(
      'project-1',
      'RESEARCH_FINDING_APPROVED',
      'finding-1',
      'reviewer-1',
    );
  });

  it('generates strategy from approved findings only', async () => {
    prisma.researchFinding.findMany.mockResolvedValueOnce([
      {
        id: 'approved-1',
        status: 'APPROVED',
        title: 'Approved',
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    ai.extractProjectActions.mockResolvedValue({
      provider: 'groq',
      value: {
        businessObjective: 'Grow awareness',
        audienceSegments: ['owners'],
        platformPriorities: ['Instagram'],
        contentPillars: ['Education'],
        recommendedFormats: ['Reels'],
        postingFrequency: ['3 weekly'],
        brandVoiceGuidance: 'Helpful',
        engagementStrategy: 'Reply daily',
        campaignIdeas: ['Launch'],
        hashtagGroups: ['#bigu'],
        keywordGroups: ['growth'],
        callsToAction: ['Book'],
        kpis: ['Reach'],
        risks: ['Budget'],
        assumptions: ['Manual data'],
      },
    });
    await service.generateStrategy('project-1', 'user-1');
    expect(prisma.researchFinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-1', status: 'APPROVED' },
      }),
    );
    expect(prisma.projectMarketingStrategy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: 'DRAFT',
          createdById: 'user-1',
        }),
      }),
    );
  });
});
