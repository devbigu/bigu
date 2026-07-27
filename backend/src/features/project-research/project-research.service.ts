import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  MarketingStrategyStatus,
  Prisma,
  ProjectStatus,
  ResearchFindingCategory,
} from '../../generated/prisma/client';
import type { AiMessage } from '../../infrastructure/ai/ai-provider.interface';
import { AiOrchestrator } from '../../infrastructure/ai/ai-orchestrator.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { SopPolicyService } from '../projects/sop-policy.service';
import type {
  AnalyzeResearchDto,
  CompetitorDto,
  ObservationDto,
  ReferenceDto,
  ReviewFindingDto,
  StrategyDto,
  UpsertResearchBriefDto,
} from './dto/project-research.dto';

const findingSchema = z.object({
  category: z.nativeEnum(ResearchFindingCategory),
  title: z.string().trim().min(3).max(200),
  proposedValue: z.record(z.string(), z.unknown()),
  explanation: z.string().trim().max(4000).nullable().optional(),
  evidence: z
    .array(
      z.object({
        type: z.string().trim().max(80),
        id: z.string().trim().max(160),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const analysisSchema = z.object({
  summary: z.string().trim().max(4000).optional(),
  findings: z.array(findingSchema).min(1).max(12),
});

const strategySchema = z.object({
  businessObjective: z.string().trim().max(4000).nullable().optional(),
  audienceSegments: z.array(z.unknown()).default([]),
  platformPriorities: z.array(z.unknown()).default([]),
  contentPillars: z.array(z.unknown()).default([]),
  recommendedFormats: z.array(z.unknown()).default([]),
  postingFrequency: z.unknown().nullable().optional(),
  brandVoiceGuidance: z.string().trim().max(4000).nullable().optional(),
  engagementStrategy: z.string().trim().max(4000).nullable().optional(),
  campaignIdeas: z.array(z.unknown()).default([]),
  hashtagGroups: z.array(z.unknown()).default([]),
  keywordGroups: z.array(z.unknown()).default([]),
  callsToAction: z.array(z.unknown()).default([]),
  kpis: z.array(z.unknown()).default([]),
  risks: z.array(z.unknown()).default([]),
  assumptions: z.array(z.unknown()).default([]),
});

@Injectable()
export class ProjectResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiOrchestrator,
    private readonly config: ConfigService,
    private readonly spreadsheets: SpreadsheetsService,
    private readonly sopPolicies: SopPolicyService,
  ) {}

  async workspace(projectId: string) {
    const project = await this.project(projectId);
    const [
      brief,
      competitors,
      references,
      observations,
      pendingFindings,
      approvedFindings,
      rejectedCount,
      strategy,
      syncJob,
    ] = await Promise.all([
      this.prisma.projectResearchBrief.findUnique({ where: { projectId } }),
      this.prisma.projectCompetitor.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.projectReference.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.researchObservation.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.researchFinding.findMany({
        where: { projectId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.researchFinding.findMany({
        where: { projectId, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        take: 25,
      }),
      this.prisma.researchFinding.count({
        where: { projectId, status: 'REJECTED' },
      }),
      this.prisma.projectMarketingStrategy.findUnique({ where: { projectId } }),
      this.prisma.spreadsheetSyncJob.findFirst({
        where: { projectId },
        orderBy: { requestedAt: 'desc' },
        select: {
          status: true,
          requestedAt: true,
          completedAt: true,
          errorCode: true,
        },
      }),
    ]);
    return {
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        projectType: project.projectType,
        platforms: project.platforms,
        updatedAt: project.updatedAt,
      },
      client: project.client,
      brief,
      competitors,
      references,
      observations,
      pendingFindings,
      approvedFindings,
      rejectedFindingCount: rejectedCount,
      strategy,
      spreadsheetSyncState: syncJob,
      researchStatus: deriveResearchStatus({
        brief,
        competitors,
        pendingFindings,
        approvedFindings,
        strategy,
      }),
      readOnly:
        project.status === ProjectStatus.ARCHIVED ||
        project.client.status === 'ARCHIVED',
    };
  }

  async upsertBrief(
    projectId: string,
    dto: UpsertResearchBriefDto,
    userId: string,
  ) {
    await this.assertMutable(projectId);
    const data = cleanBrief(dto);
    return this.prisma.projectResearchBrief.upsert({
      where: { projectId },
      create: { ...data, projectId, createdById: userId, updatedById: userId },
      update: { ...data, updatedById: userId },
    });
  }

  async createCompetitor(
    projectId: string,
    dto: CompetitorDto,
    userId: string,
  ) {
    await this.assertMutable(projectId);
    return this.prisma.projectCompetitor.create({
      data: {
        ...cleanCompetitor(dto),
        name: dto.name.trim(),
        projectId,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  async updateCompetitor(
    projectId: string,
    competitorId: string,
    dto: Partial<CompetitorDto>,
    userId: string,
  ) {
    await this.assertMutable(projectId);
    await this.requireCompetitor(projectId, competitorId);
    return this.prisma.projectCompetitor.update({
      where: { id: competitorId },
      data: { ...cleanCompetitor(dto), updatedById: userId },
    });
  }

  async deleteCompetitor(projectId: string, competitorId: string) {
    await this.assertMutable(projectId);
    await this.requireCompetitor(projectId, competitorId);
    const approved = await this.prisma.researchFinding
      .count({
        where: {
          projectId,
          status: 'APPROVED',
          evidence: {
            path: ['$[*].id'],
            array_contains: competitorId,
          },
        },
      })
      .catch(() => 0);
    if (approved > 0)
      throw new ConflictException(
        'Approved research depends on this competitor.',
      );
    return this.prisma.projectCompetitor.delete({
      where: { id: competitorId },
    });
  }

  async createReference(projectId: string, dto: ReferenceDto, userId: string) {
    await this.assertMutable(projectId);
    await this.assertReferenceLinks(projectId, dto);
    return this.prisma.projectReference.create({
      data: {
        ...cleanReference(dto),
        title: dto.title.trim(),
        projectId,
        createdById: userId,
      },
    });
  }

  async updateReference(
    projectId: string,
    referenceId: string,
    dto: Partial<ReferenceDto>,
  ) {
    await this.assertMutable(projectId);
    await this.requireReference(projectId, referenceId);
    await this.assertReferenceLinks(projectId, dto);
    return this.prisma.projectReference.update({
      where: { id: referenceId },
      data: cleanReference(dto),
    });
  }

  async deleteReference(projectId: string, referenceId: string) {
    await this.assertMutable(projectId);
    await this.requireReference(projectId, referenceId);
    const approved = await this.prisma.researchFinding
      .count({
        where: {
          projectId,
          status: 'APPROVED',
          evidence: {
            path: ['$[*].id'],
            array_contains: referenceId,
          },
        },
      })
      .catch(() => 0);
    if (approved > 0)
      throw new ConflictException(
        'Approved research depends on this reference.',
      );
    return this.prisma.projectReference.delete({ where: { id: referenceId } });
  }

  async createObservation(
    projectId: string,
    dto: ObservationDto,
    userId: string,
  ) {
    await this.assertMutable(projectId);
    await this.assertObservationLinks(projectId, dto);
    return this.prisma.researchObservation.create({
      data: {
        ...cleanObservation(dto),
        title: dto.title.trim(),
        content: dto.content.trim(),
        projectId,
        createdById: userId,
      },
    });
  }

  async updateObservation(
    projectId: string,
    observationId: string,
    dto: Partial<ObservationDto>,
  ) {
    await this.assertMutable(projectId);
    await this.requireObservation(projectId, observationId);
    await this.assertObservationLinks(projectId, dto);
    return this.prisma.researchObservation.update({
      where: { id: observationId },
      data: cleanObservation(dto),
    });
  }

  async deleteObservation(projectId: string, observationId: string) {
    await this.assertMutable(projectId);
    await this.requireObservation(projectId, observationId);
    return this.prisma.researchObservation.delete({
      where: { id: observationId },
    });
  }

  async analyze(projectId: string, dto: AnalyzeResearchDto) {
    await this.assertMutable(projectId);
    const context = await this.buildResearchInputContext(projectId, dto);
    try {
      const result = await this.ai.extractProjectActions({
        messages: buildAnalysisMessages(context),
        schemaName: 'project_research_analysis',
        jsonSchema: ANALYSIS_JSON_SCHEMA,
      });
      const provider = String(result.provider);
      const parsed = analysisSchema.parse(result.value);
      await this.assertEvidence(
        projectId,
        parsed.findings.flatMap((item) => item.evidence),
      );
      const findings = await Promise.all(
        parsed.findings.map((finding) =>
          this.prisma.researchFinding.create({
            data: {
              projectId,
              category: finding.category,
              title: finding.title,
              proposedValue: finding.proposedValue as Prisma.InputJsonValue,
              explanation: finding.explanation ?? null,
              evidence: finding.evidence,
              confidence: finding.confidence ?? null,
              status: 'PENDING',
              sourceType: 'AI',
              provider,
              model: this.modelName(provider),
              promptVersion: 'research-analysis-v1',
            },
          }),
        ),
      );
      return { summary: parsed.summary ?? '', findings };
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof BadRequestException)
        throw new BadRequestException('AI returned invalid research findings.');
      throw new ServiceUnavailableException(
        'Research analysis could not be generated right now.',
      );
    }
  }

  async reviewFinding(
    projectId: string,
    findingId: string,
    dto: ReviewFindingDto,
    userId: string,
  ) {
    await this.assertMutable(projectId);
    const finding = await this.prisma.researchFinding.findFirst({
      where: { id: findingId, projectId },
    });
    if (!finding) throw new NotFoundException('Research finding not found.');
    if (finding.status !== 'PENDING')
      throw new ConflictException(
        'Research finding has already been reviewed.',
      );
    if (dto.evidence)
      await this.assertEvidence(
        projectId,
        dto.evidence as Array<{ type: string; id: string }>,
      );
    if (dto.action === 'REJECT') {
      return this.prisma.researchFinding.update({
        where: { id: findingId },
        data: {
          status: 'REJECTED',
          reviewedById: userId,
          reviewedAt: new Date(),
          rejectionReason: dto.rejectionReason ?? null,
        },
      });
    }
    const data: Prisma.ResearchFindingUpdateInput = {
      status: 'APPROVED',
      reviewedBy: { connect: { id: userId } },
      reviewedAt: new Date(),
    };
    if (dto.action === 'EDIT_AND_APPROVE') {
      if (dto.category) data.category = dto.category;
      if (dto.title) data.title = dto.title.trim();
      if (dto.proposedValue)
        data.proposedValue = dto.proposedValue as Prisma.InputJsonValue;
      if (dto.explanation !== undefined)
        data.explanation = dto.explanation?.trim() ?? null;
      if (dto.evidence) data.evidence = dto.evidence as Prisma.InputJsonValue;
      if (dto.confidence !== undefined) data.confidence = dto.confidence;
    }
    const updated = await this.prisma.researchFinding.update({
      where: { id: findingId },
      data,
    });
    await this.spreadsheets.queueProjectSync(
      projectId,
      'RESEARCH_FINDING_APPROVED',
      findingId,
      userId,
    );
    return updated;
  }

  async generateStrategy(projectId: string, userId: string) {
    await this.assertMutable(projectId);
    const context = await this.approvedResearchContext(projectId);
    if (context.approvedFindings.length === 0)
      throw new BadRequestException(
        'Approve at least one finding before generating a strategy.',
      );
    try {
      const result = await this.ai.extractProjectActions({
        messages: buildStrategyMessages(context),
        schemaName: 'project_marketing_strategy',
        jsonSchema: STRATEGY_JSON_SCHEMA,
      });
      const parsed = strategySchema.parse(result.value);
      return this.saveStrategy(projectId, parsed as StrategyDto, userId, {
        generated: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new BadRequestException('AI returned an invalid strategy draft.');
      throw new ServiceUnavailableException(
        'Marketing strategy could not be generated right now.',
      );
    }
  }

  async saveStrategy(
    projectId: string,
    dto: StrategyDto,
    userId: string,
    options?: { generated?: boolean },
  ) {
    await this.assertMutable(projectId);
    const data = strategyData(dto);
    return this.prisma.projectMarketingStrategy.upsert({
      where: { projectId },
      create: {
        ...data,
        projectId,
        createdById: userId,
        updatedById: userId,
        status: MarketingStrategyStatus.DRAFT,
        generatedFromApprovedResearchAt: options?.generated
          ? new Date()
          : undefined,
      },
      update: {
        ...data,
        updatedById: userId,
        status: MarketingStrategyStatus.DRAFT,
        approvedById: null,
        approvedAt: null,
        generatedFromApprovedResearchAt: options?.generated
          ? new Date()
          : undefined,
      },
    });
  }

  async approveStrategy(projectId: string, userId: string) {
    await this.assertMutable(projectId);
    const strategy = await this.prisma.projectMarketingStrategy.findUnique({
      where: { projectId },
    });
    if (!strategy)
      throw new NotFoundException('Marketing strategy draft not found.');
    const updated = await this.prisma.projectMarketingStrategy.update({
      where: { projectId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        updatedById: userId,
      },
    });
    await this.spreadsheets.queueProjectSync(
      projectId,
      'MARKETING_STRATEGY_APPROVED',
      updated.id,
      userId,
    );
    return updated;
  }

  async approvedResearchContext(projectId: string) {
    const project = await this.project(projectId);
    const [approvedFindings, approvedStrategy, references] = await Promise.all([
      this.prisma.researchFinding.findMany({
        where: { projectId, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        take: 20,
      }),
      this.prisma.projectMarketingStrategy.findUnique({ where: { projectId } }),
      this.prisma.projectReference.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          url: true,
          type: true,
          platform: true,
          tags: true,
          updatedAt: true,
        },
      }),
    ]);
    const strategy =
      approvedStrategy?.status === 'APPROVED' ? approvedStrategy : null;
    return {
      project: {
        id: project.id,
        title: project.title,
        projectType: project.projectType,
        platforms: project.platforms,
      },
      client: {
        id: project.client.id,
        name: project.client.name,
        industry: project.client.industry,
      },
      approvedFindings,
      approvedStrategy: strategy,
      trustedReferences: references,
      researchFreshnessTimestamp: maxDate([
        ...approvedFindings.map((item) => item.reviewedAt ?? item.updatedAt),
        strategy?.approvedAt ?? null,
      ]),
    };
  }

  private async project(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  private async assertMutable(projectId: string) {
    const project = await this.project(projectId);
    if (
      project.status === ProjectStatus.ARCHIVED ||
      project.client.status === 'ARCHIVED'
    )
      throw new ConflictException('Archived projects are read-only.');
    return project;
  }

  private async requireCompetitor(projectId: string, id: string) {
    const item = await this.prisma.projectCompetitor.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Competitor not found.');
  }

  private async requireReference(projectId: string, id: string) {
    const item = await this.prisma.projectReference.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Reference not found.');
  }

  private async requireObservation(projectId: string, id: string) {
    const item = await this.prisma.researchObservation.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Observation not found.');
  }

  private async assertReferenceLinks(
    projectId: string,
    dto: Partial<ReferenceDto>,
  ) {
    if (!dto.projectFileId) return;
    const file = await this.prisma.clientFile.findFirst({
      where: { id: dto.projectFileId, projectId },
      select: { id: true },
    });
    if (!file)
      throw new BadRequestException(
        'Project file reference does not belong to this project.',
      );
  }

  private async assertObservationLinks(
    projectId: string,
    dto: Partial<ObservationDto>,
  ) {
    if (dto.sourceReferenceId)
      await this.requireReference(projectId, dto.sourceReferenceId);
    if (dto.sourceCompetitorId)
      await this.requireCompetitor(projectId, dto.sourceCompetitorId);
  }

  private async buildResearchInputContext(
    projectId: string,
    dto: AnalyzeResearchDto,
  ) {
    const project = await this.project(projectId);
    const sop = await this.sopPolicies.loadProjectContext(projectId);
    const selectedCompetitorIds = dto.selectedCompetitorIds ?? [];
    const selectedReferenceIds = dto.selectedReferenceIds ?? [];
    const selectedObservationIds = dto.selectedObservationIds ?? [];
    const [
      brief,
      competitors,
      references,
      observations,
      approvedFindings,
      strategy,
    ] = await Promise.all([
      this.prisma.projectResearchBrief.findUnique({ where: { projectId } }),
      this.prisma.projectCompetitor.findMany({
        where: selectedCompetitorIds.length
          ? { projectId, id: { in: selectedCompetitorIds } }
          : { projectId },
        take: 20,
      }),
      this.prisma.projectReference.findMany({
        where: selectedReferenceIds.length
          ? { projectId, id: { in: selectedReferenceIds } }
          : { projectId },
        take: 20,
      }),
      this.prisma.researchObservation.findMany({
        where: selectedObservationIds.length
          ? { projectId, id: { in: selectedObservationIds } }
          : { projectId },
        take: 30,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.researchFinding.findMany({
        where: { projectId, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        take: 20,
      }),
      this.prisma.projectMarketingStrategy.findUnique({ where: { projectId } }),
    ]);
    assertSelected(
      'competitor',
      selectedCompetitorIds,
      competitors.map((item) => item.id),
    );
    assertSelected(
      'reference',
      selectedReferenceIds,
      references.map((item) => item.id),
    );
    assertSelected(
      'observation',
      selectedObservationIds,
      observations.map((item) => item.id),
    );
    return {
      project,
      client: project.client,
      sopPolicy: sop.policy,
      sopState: sop.state,
      brief,
      competitors,
      references,
      observations,
      approvedFindings,
      currentStrategy: strategy,
      requestedCategories: dto.categories,
      focusInstructions: dto.focusInstructions,
    };
  }

  private async assertEvidence(
    projectId: string,
    evidence: Array<{ type: string; id: string }>,
  ) {
    const idsByType = new Map<string, string[]>();
    for (const item of evidence) {
      if (
        !['COMPETITOR', 'REFERENCE', 'OBSERVATION', 'FINDING'].includes(
          item.type,
        )
      )
        continue;
      idsByType.set(item.type, [...(idsByType.get(item.type) ?? []), item.id]);
    }
    const checks = await Promise.all([
      idsByType.get('COMPETITOR')?.length
        ? this.prisma.projectCompetitor.count({
            where: { projectId, id: { in: idsByType.get('COMPETITOR') } },
          })
        : 0,
      idsByType.get('REFERENCE')?.length
        ? this.prisma.projectReference.count({
            where: { projectId, id: { in: idsByType.get('REFERENCE') } },
          })
        : 0,
      idsByType.get('OBSERVATION')?.length
        ? this.prisma.researchObservation.count({
            where: { projectId, id: { in: idsByType.get('OBSERVATION') } },
          })
        : 0,
      idsByType.get('FINDING')?.length
        ? this.prisma.researchFinding.count({
            where: { projectId, id: { in: idsByType.get('FINDING') } },
          })
        : 0,
    ]);
    const expected = ['COMPETITOR', 'REFERENCE', 'OBSERVATION', 'FINDING'].map(
      (type) => idsByType.get(type)?.length ?? 0,
    );
    if (checks.some((count, index) => count !== expected[index]))
      throw new BadRequestException(
        'AI evidence references must belong to this project.',
      );
  }

  private modelName(provider: string) {
    return provider === 'groq'
      ? this.config.get<string>('GROQ_FAST_MODEL')
      : this.config.get<string>('GEMINI_MODEL');
  }
}

function cleanBrief(dto: UpsertResearchBriefDto) {
  return {
    ...dto,
    knownCompetitors: cleanStringArray(dto.knownCompetitors),
    platforms: cleanStringArray(dto.platforms),
  };
}

function cleanCompetitor(dto: Partial<CompetitorDto>) {
  return compact({
    ...dto,
    otherUrls: cleanStringArray(dto.otherUrls),
    platforms: cleanStringArray(dto.platforms),
    contentPillars: cleanStringArray(dto.contentPillars),
    commonCallsToAction: cleanStringArray(dto.commonCallsToAction),
    strengths: cleanStringArray(dto.strengths),
    weaknesses: cleanStringArray(dto.weaknesses),
    opportunities: cleanStringArray(dto.opportunities),
  });
}

function cleanReference(dto: Partial<ReferenceDto>) {
  return compact({ ...dto, tags: cleanStringArray(dto.tags) });
}

function cleanObservation(dto: Partial<ObservationDto>) {
  return compact(dto);
}

function strategyData(dto: StrategyDto) {
  return compact({
    businessObjective: dto.businessObjective,
    audienceSegments: jsonOrNull(dto.audienceSegments),
    platformPriorities: jsonOrNull(dto.platformPriorities),
    contentPillars: jsonOrNull(dto.contentPillars),
    recommendedFormats: jsonOrNull(dto.recommendedFormats),
    postingFrequency: jsonOrNull(dto.postingFrequency),
    brandVoiceGuidance: dto.brandVoiceGuidance,
    engagementStrategy: dto.engagementStrategy,
    campaignIdeas: jsonOrNull(dto.campaignIdeas),
    hashtagGroups: jsonOrNull(dto.hashtagGroups),
    keywordGroups: jsonOrNull(dto.keywordGroups),
    callsToAction: jsonOrNull(dto.callsToAction),
    kpis: jsonOrNull(dto.kpis),
    risks: jsonOrNull(dto.risks),
    assumptions: jsonOrNull(dto.assumptions),
  });
}

function cleanStringArray(value?: string[]) {
  return value?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value === null
    ? (Prisma.JsonNull as unknown as Prisma.InputJsonValue)
    : value;
}

function assertSelected(label: string, selected: string[], found: string[]) {
  if (selected.length && selected.some((id) => !found.includes(id)))
    throw new BadRequestException(
      `Selected ${label} does not belong to this project.`,
    );
}

function deriveResearchStatus(input: {
  brief: unknown;
  competitors: unknown[];
  pendingFindings: unknown[];
  approvedFindings: unknown[];
  strategy: { status: string } | null;
}) {
  if (input.strategy?.status === 'APPROVED') return 'Strategy approved';
  if (input.strategy) return 'Strategy draft';
  if (input.pendingFindings.length) return 'Findings awaiting review';
  if (input.brief || input.competitors.length || input.approvedFindings.length)
    return 'Research in progress';
  return 'Not started';
}

function maxDate(values: Array<Date | null>) {
  const times = values
    .filter((value): value is Date => Boolean(value))
    .map((value) => value.getTime());
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

function buildAnalysisMessages(context: unknown): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        'Analyze only the supplied BigU project research context. Return structured pending findings for human review. Do not claim anything is approved. Do not invent IDs.',
    },
    { role: 'user', content: JSON.stringify(context) },
  ];
}

function buildStrategyMessages(context: unknown): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        'Create an editable social media strategy using only approved research findings and approved project/client context. Return JSON only.',
    },
    { role: 'user', content: JSON.stringify(context) },
  ];
}

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'category',
          'title',
          'proposedValue',
          'explanation',
          'evidence',
          'confidence',
        ],
        properties: {
          category: { type: 'string' },
          title: { type: 'string' },
          proposedValue: { type: 'object' },
          explanation: { type: ['string', 'null'] },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'id'],
              properties: { type: { type: 'string' }, id: { type: 'string' } },
            },
          },
          confidence: { type: ['number', 'null'] },
        },
      },
    },
  },
} as const;

const STRATEGY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'businessObjective',
    'audienceSegments',
    'platformPriorities',
    'contentPillars',
    'recommendedFormats',
    'postingFrequency',
    'brandVoiceGuidance',
    'engagementStrategy',
    'campaignIdeas',
    'hashtagGroups',
    'keywordGroups',
    'callsToAction',
    'kpis',
    'risks',
    'assumptions',
  ],
  properties: Object.fromEntries(
    [
      'businessObjective',
      'audienceSegments',
      'platformPriorities',
      'contentPillars',
      'recommendedFormats',
      'postingFrequency',
      'brandVoiceGuidance',
      'engagementStrategy',
      'campaignIdeas',
      'hashtagGroups',
      'keywordGroups',
      'callsToAction',
      'kpis',
      'risks',
      'assumptions',
    ].map((key) => [key, { type: ['string', 'array', 'object', 'null'] }]),
  ),
} as const;
