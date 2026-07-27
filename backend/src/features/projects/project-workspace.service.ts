import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AiOrchestrator } from '../../infrastructure/ai/ai-orchestrator.service';
import type { AiMessage } from '../../infrastructure/ai/ai-provider.interface';
import {
  AiProviderError,
  AiService,
  CLIENT_FIELDS,
  ClientField,
} from '../../infrastructure/integrations/ai.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../infrastructure/integrations/storage.service';
import { ReviewChangeRequestDto } from '../client-workspace/dto/review-change-request.dto';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { SopPolicyService } from './sop-policy.service';
import { SopConfigurationError } from './sop-policy.types';

@Injectable()
export class ProjectWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly orchestrator: AiOrchestrator,
    private readonly config: ConfigService,
    private readonly sopPolicies: SopPolicyService,
    private readonly spreadsheets: SpreadsheetsService,
    private readonly storage: StorageService,
  ) {}

  private async project(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        assignedUser: {
          select: { id: true, name: true, username: true, email: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  private async conversation(projectId: string, userId: string) {
    const project = await this.project(projectId);
    return this.prisma.conversation.upsert({
      where: { projectId },
      create: {
        projectId,
        clientId: project.clientId,
        createdById: userId,
        title: project.title,
        isPrimary: true,
      },
      update: { title: project.title },
    });
  }

  async workspace(projectId: string, userId: string) {
    const project = await this.project(projectId);
    const conversation = await this.conversation(projectId, userId);
    const [messages, changeRequests, instructions, files] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.contextChangeRequest.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.clientInstruction.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clientFile.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      project,
      client: project.client,
      conversation,
      messages,
      changeRequests,
      instructions,
      files,
    };
  }

  async send(projectId: string, content: string, userId: string) {
    const project = await this.project(projectId);
    if (project.status === 'ARCHIVED' || project.client.status === 'ARCHIVED') {
      throw new ConflictException(
        'Archived projects cannot receive new messages.',
      );
    }
    const conversation = await this.conversation(projectId, userId);
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'USER',
        content,
        status: 'COMPLETED',
        createdById: userId,
      },
    });

    try {
      const result = await this.ai.analyseClientMessage(
        await this.buildContext(projectId, content),
      );
      const saved = await this.prisma.$transaction(async (tx) => {
        const assistant = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'ASSISTANT',
            content: result.assistantMessage,
            status: 'COMPLETED',
            provider: result.metadata.provider,
            model: result.metadata.model,
            promptVersion: result.metadata.promptVersion,
            usedFallback: result.metadata.usedFallback,
          },
        });
        const changes = await Promise.all(
          result.proposedChanges.map((change) =>
            tx.contextChangeRequest.create({
              data: {
                clientId: project.clientId,
                projectId,
                conversationId: conversation.id,
                sourceMessageId: assistant.id,
                fieldName: change.field,
                oldValue: String(project.client[change.field] ?? ''),
                proposedValue: change.proposedValue,
                explanation: change.explanation,
                confidence: change.confidence,
                proposedByProvider: result.metadata.provider,
                proposedByModel: result.metadata.model,
                promptVersion: result.metadata.promptVersion,
              },
            }),
          ),
        );
        return { assistant, changes };
      });
      return {
        userMessage,
        assistantMessage: saved.assistant,
        proposedChanges: saved.changes,
        proposedInstructions: result.proposedInstructions,
        metadata: result.metadata,
      };
    } catch (error) {
      const code =
        error instanceof AiProviderError
          ? error.category
          : error instanceof SopConfigurationError
            ? error.code
            : 'generation_failed';
      const failureMessage =
        error instanceof SopConfigurationError
          ? `BigU cannot generate a safe response because this project's SOP configuration is invalid: ${error.message}`
          : 'BigU could not generate a response right now. Your message was saved. Please try again.';
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'ASSISTANT',
          content: failureMessage,
          status: 'FAILED',
          errorCode: code,
        },
      });
      throw new ServiceUnavailableException(failureMessage);
    }
  }

  async *sendProjectMessage(
    projectId: string,
    content: string,
    userId: string,
    signal: AbortSignal,
  ): AsyncGenerator<Record<string, unknown>> {
    const project = await this.project(projectId);
    if (project.status === 'ARCHIVED' || project.client.status === 'ARCHIVED') {
      throw new ConflictException(
        'Archived projects cannot receive new messages.',
      );
    }
    const conversation = await this.conversation(projectId, userId);
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'USER',
        content,
        status: 'COMPLETED',
        createdById: userId,
      },
    });
    const assistant = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        content: '',
        status: 'STREAMING',
      },
    });
    yield { type: 'message.created', message: userMessage };
    yield { type: 'assistant.started', messageId: assistant.id };

    let finalText = '';
    let provider: string | null = null;
    try {
      const context = await this.buildContext(projectId, content);
      const messages = buildProjectMessages(context);
      for await (const chunk of this.orchestrator.streamProjectAnswer(
        messages,
        signal,
      )) {
        finalText += chunk.delta;
        provider = chunk.provider;
        yield {
          type: 'assistant.delta',
          messageId: assistant.id,
          delta: chunk.delta,
        };
      }
      if (!finalText.trim()) throw new Error('AI_EMPTY_RESPONSE');
      const completed = await this.prisma.message.update({
        where: { id: assistant.id },
        data: {
          content: finalText,
          status: 'COMPLETED',
          provider,
          model:
            provider === 'groq'
              ? this.config.get('GROQ_PRIMARY_MODEL')
              : this.config.get('GEMINI_MODEL'),
          promptVersion: 'project-stream-v1',
          usedFallback:
            provider !== this.config.get('AI_PRIMARY_PROVIDER', 'groq'),
        },
      });

      // Extraction is deliberately sequential: it cannot delay or mutate the visible answer.
      const extracted = await this.orchestrator.extractProjectActions(
        {
          messages: buildExtractionMessages(context, content, finalText),
          schemaName: 'project_actions',
          jsonSchema: PROJECT_ACTION_JSON_SCHEMA,
        },
        signal,
      );
      const actions = projectActionSchema.parse(extracted.value);
      for (const change of actions.contextProposals) {
        if (!CLIENT_FIELDS.includes(change.key as ClientField)) continue;
        const proposal = await this.prisma.contextChangeRequest.create({
          data: {
            clientId: project.clientId,
            projectId,
            conversationId: conversation.id,
            sourceMessageId: assistant.id,
            fieldName: change.key,
            oldValue: String(project.client[change.key as ClientField] ?? ''),
            proposedValue: change.proposedValue,
            explanation: change.explanation,
            confidence: change.confidence,
            proposedByProvider: extracted.provider,
            proposedByModel:
              extracted.provider === 'groq'
                ? this.config.get('GROQ_FAST_MODEL')
                : this.config.get('GEMINI_MODEL'),
            promptVersion: 'project-extraction-v1',
          },
        });
        yield { type: 'proposal.created', proposal };
      }
      yield { type: 'assistant.completed', message: completed };
    } catch {
      const cancelled = signal.aborted;
      await this.prisma.message.update({
        where: { id: assistant.id },
        data: {
          content: finalText,
          status: cancelled ? 'CANCELLED' : 'FAILED',
          errorCode: cancelled ? 'cancelled' : 'generation_failed',
        },
      });
      yield {
        type: cancelled ? 'assistant.cancelled' : 'assistant.failed',
        messageId: assistant.id,
        partialContent: finalText,
        message: cancelled
          ? 'Response stopped.'
          : 'BigU could not complete the response.',
        status: cancelled ? 'CANCELLED' : 'FAILED',
      };
    }
  }
  async review(
    projectId: string,
    requestId: string,
    dto: ReviewChangeRequestDto,
    userId: string,
  ) {
    const project = await this.project(projectId);
    const request = await this.prisma.contextChangeRequest.findFirst({
      where: { id: requestId, projectId },
    });
    if (!request) throw new NotFoundException('Change request not found.');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Change request has already been reviewed.');
    }
    if (!CLIENT_FIELDS.includes(request.fieldName as ClientField)) {
      throw new BadRequestException('Unsupported client field.');
    }
    if (dto.action === 'REJECT') {
      return this.prisma.contextChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });
    }

    const value =
      dto.action === 'EDIT_AND_APPROVE'
        ? dto.proposedValue
        : request.proposedValue;
    if (!value?.trim()) {
      throw new BadRequestException('Approved value cannot be empty.');
    }
    const field = request.fieldName as ClientField;
    const result = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id: project.clientId },
        data: { [field]: value.trim() },
      });
      const updated = await tx.contextChangeRequest.update({
        where: { id: requestId },
        data: {
          proposedValue: value.trim(),
          status: 'APPROVED',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });
      return { request: updated, client };
    });
    if (dto.syncSpreadsheet !== false) {
      await this.spreadsheets.queueProjectSync(
        projectId,
        'CONTEXT_CHANGE',
        request.id,
        userId,
      );
    }
    return {
      ...result,
      spreadsheetSync: dto.syncSpreadsheet === false ? 'SKIPPED' : 'PENDING',
    };
  }

  async instruction(
    projectId: string,
    title: string,
    content: string,
    userId: string,
  ) {
    const project = await this.project(projectId);
    if (project.status === 'ARCHIVED' || project.client.status === 'ARCHIVED') {
      throw new ConflictException(
        'Archived projects cannot receive new instructions.',
      );
    }
    return this.prisma.clientInstruction.create({
      data: {
        clientId: project.clientId,
        projectId,
        title,
        content,
        createdById: userId,
      },
    });
  }

  async archiveInstruction(projectId: string, instructionId: string) {
    const instruction = await this.prisma.clientInstruction.findFirst({
      where: { id: instructionId, projectId },
    });
    if (!instruction) throw new NotFoundException('Instruction not found.');
    return this.prisma.clientInstruction.update({
      where: { id: instructionId },
      data: { status: 'ARCHIVED' },
    });
  }

  async files(projectId: string) {
    await this.project(projectId);
    return this.prisma.clientFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(projectId: string, file: Express.Multer.File, userId: string) {
    const project = await this.project(projectId);
    if (project.status === 'ARCHIVED' || project.client.status === 'ARCHIVED') {
      throw new ConflictException(
        'Archived projects cannot receive new files.',
      );
    }
    if (!file) throw new BadRequestException('A file is required.');
    const max = this.config.get<number>('CLIENT_FILE_MAX_BYTES', 10_485_760);
    if (file.size > max)
      throw new BadRequestException(
        'File exceeds the configured maximum size.',
      );
    const allowed: Record<string, string[]> = {
      'application/pdf': ['pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['docx'],
      'text/plain': ['txt'],
      'text/csv': ['csv'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'audio/mpeg': ['mp3'],
      'audio/mp4': ['m4a'],
      'audio/wav': ['wav'],
      'audio/ogg': ['ogg'],
      'audio/webm': ['webm'],
      'video/mp4': ['mp4'],
    };
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!allowed[file.mimetype]?.includes(extension))
      throw new BadRequestException('Unsupported file type.');

    const conversation = await this.conversation(projectId, userId);
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 240);
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
    const uploaded = await this.storage.upload({
      buffer: file.buffer,
      originalName: safeName,
      mimeType: file.mimetype,
      folder: this.storage.clientFileFolder(project.clientId, conversation.id),
      resourceType,
    });
    try {
      let extractedText: string | null = null;
      if (['text/plain', 'text/csv'].includes(file.mimetype)) {
        extractedText = file.buffer.toString('utf8').slice(0, 100_000);
      } else if (file.mimetype.startsWith('image/')) {
        extractedText = (
          await this.ai.analyzeImage(uploaded.secureUrl, safeName)
        ).text.slice(0, 100_000);
      } else if (
        file.mimetype.startsWith('audio/') ||
        file.mimetype === 'video/mp4'
      ) {
        extractedText = (
          await this.ai.transcribeAudio(file.buffer, safeName, file.mimetype)
        ).text.slice(0, 100_000);
      }
      return await this.prisma.clientFile.create({
        data: {
          clientId: project.clientId,
          projectId,
          conversationId: conversation.id,
          originalName: safeName,
          storedName: uploaded.publicId,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageProvider: 'cloudinary',
          storagePublicId: uploaded.publicId,
          storageResourceType: uploaded.resourceType,
          storageUrl: uploaded.secureUrl,
          processingStatus: 'READY_FOR_REVIEW',
          extractedText,
          uploadedById: userId,
        },
      });
    } catch (error) {
      await this.storage
        .delete(uploaded.publicId, resourceType)
        .catch(() => undefined);
      throw error;
    }
  }
  async fileStatus(
    projectId: string,
    fileId: string,
    status: 'APPROVED' | 'REJECTED',
    userId: string,
  ) {
    const file = await this.prisma.clientFile.findFirst({
      where: { id: fileId, projectId },
    });
    if (!file) throw new NotFoundException('File not found.');
    if (status === 'REJECTED' && file.storagePublicId) {
      await this.storage.delete(
        file.storagePublicId,
        file.storageResourceType === 'image' ? 'image' : 'raw',
      );
    }
    if (status === 'APPROVED' && !file.extractedText) {
      throw new BadRequestException(
        'This file has no extracted text available for approval.',
      );
    }
    const updated = await this.prisma.clientFile.update({
      where: { id: fileId },
      data: { processingStatus: status },
    });
    if (status === 'APPROVED') {
      await this.spreadsheets.queueProjectSync(
        projectId,
        'PROJECT_FILE',
        fileId,
        userId,
      );
    }
    return updated;
  }

  private async buildContext(projectId: string, currentMessage: string) {
    const project = await this.project(projectId);
    const [
      sop,
      instructions,
      files,
      messages,
      approvedFindings,
      strategy,
      trustedReferences,
    ] = await Promise.all([
      this.sopPolicies.loadProjectContext(projectId),
      this.prisma.clientInstruction.findMany({
        where: { projectId, status: 'ACTIVE' },
        select: { title: true, content: true },
      }),
      this.prisma.clientFile.findMany({
        where: { projectId, processingStatus: 'APPROVED' },
        select: { originalName: true, extractedText: true },
        take: 3,
      }),
      this.prisma.message.findMany({
        where: { conversation: { projectId } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { senderType: true, content: true },
      }),
      this.prisma.researchFinding.findMany({
        where: { projectId, status: 'APPROVED' },
        orderBy: { reviewedAt: 'desc' },
        take: 8,
        select: {
          category: true,
          title: true,
          proposedValue: true,
          explanation: true,
          evidence: true,
          confidence: true,
          reviewedAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.projectMarketingStrategy.findUnique({ where: { projectId } }),
      this.prisma.projectReference.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          url: true,
          type: true,
          platform: true,
          tags: true,
        },
      }),
    ]);
    return {
      projectAndClientIdentity: {
        projectId: project.id,
        projectTitle: project.title,
        projectType: project.projectType,
        clientId: project.client.id,
        clientName: project.client.name,
      },
      sopPolicy: sop.policy,
      sopState: sop.state,
      client: {
        id: project.client.id,
        name: project.client.name,
        industry: project.client.industry,
        description: project.client.description,
        targetAudience: project.client.targetAudience,
        brandVoice: project.client.brandVoice,
        websiteUrl: project.client.websiteUrl,
        instagramUrl: project.client.instagramUrl,
        facebookUrl: project.client.facebookUrl,
        businessObjectives: project.client.businessObjectives,
        project: {
          id: project.id,
          title: project.title,
          projectType: project.projectType,
          growthObjective: project.growthObjective,
          platforms: project.platforms,
          startDate: project.startDate,
          endDate: project.endDate,
          month: project.month,
          year: project.year,
          contentTarget: project.contentTarget,
          status: project.status,
        },
      },
      instructions,
      approvedFiles: files.map((file) => ({
        name: file.originalName,
        extractedText: (file.extractedText ?? '').slice(0, 4000),
      })),
      tasksDeadlinesAndAssignments: {
        startDate: project.startDate,
        endDate: project.endDate,
        assignedUser: project.assignedUser,
      },
      recentMessages: messages
        .reverse()
        .filter((message) => message.senderType !== 'SYSTEM')
        .map((message) => ({
          role:
            message.senderType === 'USER'
              ? ('user' as const)
              : ('assistant' as const),
          content: message.content.slice(0, 1200),
        })),
      spreadsheetSynchronizationState: null,
      approvedReportsAndLearnings: {
        approvedResearchFindings: approvedFindings,
        approvedStrategy: strategy?.status === 'APPROVED' ? strategy : null,
        trustedReferences,
        researchFreshnessTimestamp: researchFreshnessTimestamp(
          approvedFindings,
          strategy?.status === 'APPROVED' ? strategy.approvedAt : null,
        ),
      },
      currentMessage,
    };
  }
}

const projectActionSchema = z.object({
  contextProposals: z.array(
    z.object({
      category: z.string(),
      key: z.string(),
      proposedValue: z.string().min(1),
      explanation: z.string().nullable(),
      confidence: z.number().min(0).max(1).nullable(),
    }),
  ),
  taskProposals: z.array(
    z.object({
      title: z.string(),
      description: z.string().nullable(),
      dueDate: z.string().nullable(),
    }),
  ),
  sopActionProposals: z.array(
    z.object({
      action: z.string(),
      targetId: z.string(),
      explanation: z.string(),
    }),
  ),
  spreadsheetUpdates: z.array(
    z.object({
      entityType: z.string(),
      entityId: z.string(),
      operation: z.string(),
    }),
  ),
});

const PROJECT_ACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'contextProposals',
    'taskProposals',
    'sopActionProposals',
    'spreadsheetUpdates',
  ],
  properties: {
    contextProposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'category',
          'key',
          'proposedValue',
          'explanation',
          'confidence',
        ],
        properties: {
          category: { type: 'string' },
          key: { type: 'string' },
          proposedValue: { type: 'string' },
          explanation: { type: ['string', 'null'] },
          confidence: { type: ['number', 'null'] },
        },
      },
    },
    taskProposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'dueDate'],
        properties: {
          title: { type: 'string' },
          description: { type: ['string', 'null'] },
          dueDate: { type: ['string', 'null'] },
        },
      },
    },
    sopActionProposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'targetId', 'explanation'],
        properties: {
          action: { type: 'string' },
          targetId: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
    },
    spreadsheetUpdates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['entityType', 'entityId', 'operation'],
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          operation: { type: 'string' },
        },
      },
    },
  },
} as const;

function buildProjectMessages(context: unknown): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are BigU project assistant. Use only the supplied project and SOP context. Never claim to have changed records. Write in clean Markdown with short sections, bullets, numbered steps, and compact tables when they improve comparison. Do not emit HTML or <br> tags. Start with a direct answer, then organize details under clear headings. Clearly describe any suggested change for human approval.',
    },
    { role: 'user', content: JSON.stringify(context) },
  ];
}

function buildExtractionMessages(
  context: unknown,
  userMessage: string,
  assistantResponse: string,
): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        'Extract proposals only. Never execute changes. Return empty arrays when there is no explicit, actionable proposal.',
    },
    {
      role: 'user',
      content: JSON.stringify({ context, userMessage, assistantResponse }),
    },
  ];
}

function researchFreshnessTimestamp(
  findings: Array<{ reviewedAt: Date | null; updatedAt: Date }>,
  strategyApprovedAt?: Date | null,
) {
  const times = [
    ...findings.map((finding) =>
      (finding.reviewedAt ?? finding.updatedAt).getTime(),
    ),
    strategyApprovedAt?.getTime() ?? 0,
  ].filter((value) => value > 0);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
