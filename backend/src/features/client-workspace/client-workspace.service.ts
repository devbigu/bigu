import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type {
  Client,
  ContextChangeRequest,
  Conversation,
  Message,
} from '../../generated/prisma/client';
import {
  AiProviderError,
  AiService,
  CLIENT_FIELDS,
  type AnalyseClientMessageResult,
  type ClientField,
} from '../../infrastructure/integrations/ai.service';
import {
  StorageProviderError,
  StorageService,
} from '../../infrastructure/integrations/storage.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { ClientContextService } from './client-context.service';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';
import type {
  ClientMessageStreamEvent,
  StreamMessage,
  StreamProposal,
} from './types/stream-event.types';

type PreparedStream = {
  client: Client;
  conversation: Conversation;
  userMessage: Message;
  assistantMessage: Message;
  content: string;
};

@Injectable()
export class ClientWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly context: ClientContextService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly spreadsheets: SpreadsheetsService,
  ) {}

  private async client(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client not found.');
    return client;
  }

  private async conversation(clientId: string, userId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { clientId, projectId: null, isPrimary: true },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: { clientId, createdById: userId, isPrimary: true },
    });
  }

  async workspace(clientId: string, userId: string) {
    const client = await this.client(clientId);
    const conversation = await this.conversation(clientId, userId);
    const [messages, changeRequests, instructions, files] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.contextChangeRequest.findMany({
        where: { clientId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.clientInstruction.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clientFile.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      client,
      conversation,
      messages,
      changeRequests,
      instructions,
      files,
    };
  }

  async send(clientId: string, content: string, userId: string) {
    const client = await this.assertCanMessage(clientId);
    const conversation = await this.conversation(clientId, userId);
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
        await this.context.build(clientId, content),
      );
      const saved = await this.persistNewAssistantResult(
        client,
        conversation,
        result,
      );
      return {
        userMessage,
        assistantMessage: saved.assistant,
        proposedChanges: saved.changes,
        proposedInstructions: result.proposedInstructions,
        metadata: result.metadata,
      };
    } catch (error) {
      const code =
        error instanceof AiProviderError ? error.category : 'generation_failed';
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'ASSISTANT',
          content: '',
          status: 'FAILED',
          errorCode: code,
        },
      });
      throw new ServiceUnavailableException(
        'BigU could not generate a response right now. Your message was saved. Please try again.',
      );
    }
  }

  async prepareStream(
    clientId: string,
    content: string,
    userId: string,
  ): Promise<PreparedStream> {
    const client = await this.assertCanMessage(clientId);
    const conversation = await this.conversation(clientId, userId);
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'USER',
        content,
        status: 'COMPLETED',
        createdById: userId,
      },
    });
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        content: '',
        status: 'STREAMING',
      },
    });
    return { client, conversation, userMessage, assistantMessage, content };
  }

  async *streamPreparedMessage(
    prepared: PreparedStream,
    signal: AbortSignal,
  ): AsyncIterable<ClientMessageStreamEvent> {
    yield {
      type: 'message.created',
      message: toStreamMessage(prepared.userMessage),
    };
    yield {
      type: 'assistant.started',
      messageId: prepared.assistantMessage.id,
    };

    let visibleText = '';
    try {
      let completed: AnalyseClientMessageResult | undefined;
      const context = await this.context.build(
        prepared.client.id,
        prepared.content,
      );
      for await (const chunk of this.ai.streamClientMessage(context, {
        signal,
      })) {
        if (chunk.type === 'text-delta') {
          visibleText += chunk.delta;
          yield {
            type: 'assistant.delta',
            messageId: prepared.assistantMessage.id,
            delta: chunk.delta,
          };
        } else {
          completed = chunk.result;
        }
      }
      if (!completed) throw new AiProviderError('invalid_response', false);

      const saved = await this.persistStreamResult(
        prepared,
        completed,
        visibleText,
      );
      for (const proposal of saved.changes) {
        yield {
          type: 'proposal.created',
          proposal: toStreamProposal(proposal),
        };
      }
      yield {
        type: 'assistant.completed',
        message: toStreamMessage(saved.assistant),
      };
    } catch (error: unknown) {
      const cancelled =
        signal.aborted ||
        (error instanceof AiProviderError && error.category === 'cancelled');
      const errorCode =
        error instanceof AiProviderError ? error.category : 'generation_failed';
      await this.prisma.message.update({
        where: { id: prepared.assistantMessage.id },
        data: {
          content: visibleText,
          status: cancelled ? 'CANCELLED' : 'FAILED',
          errorCode,
        },
      });
      yield {
        type: 'assistant.failed',
        messageId: prepared.assistantMessage.id,
        code: cancelled ? 'AI_RESPONSE_CANCELLED' : 'AI_RESPONSE_FAILED',
        message: cancelled
          ? 'Response stopped.'
          : 'BigU could not complete the response. Please try again.',
        partialContent: visibleText,
        status: cancelled ? 'CANCELLED' : 'FAILED',
      };
    }
  }

  async review(
    clientId: string,
    id: string,
    dto: ReviewChangeRequestDto,
    userId: string,
  ) {
    await this.client(clientId);
    const request = await this.prisma.contextChangeRequest.findFirst({
      where: { id, clientId },
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
        where: { id },
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
    const result = await this.prisma.$transaction(async (transaction) => {
      const client = await transaction.client.update({
        where: { id: clientId },
        data: { [field]: value.trim() },
      });
      const updated = await transaction.contextChangeRequest.update({
        where: { id },
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
      await this.spreadsheets.queueClientSync(
        clientId,
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
    clientId: string,
    title: string,
    content: string,
    userId: string,
  ) {
    await this.client(clientId);
    return this.prisma.clientInstruction.create({
      data: { clientId, title, content, createdById: userId },
    });
  }

  async archiveInstruction(clientId: string, id: string) {
    const instruction = await this.prisma.clientInstruction.findFirst({
      where: { id, clientId },
    });
    if (!instruction) throw new NotFoundException('Instruction not found.');
    return this.prisma.clientInstruction.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async files(clientId: string) {
    await this.client(clientId);
    return this.prisma.clientFile.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(clientId: string, file: Express.Multer.File, userId: string) {
    await this.client(clientId);
    if (!file) throw new BadRequestException('A file is required.');
    const max = this.config.get<number>('CLIENT_FILE_MAX_BYTES', 10_485_760);
    if (file.size > max) {
      throw new BadRequestException(
        'File exceeds the configured maximum size.',
      );
    }
    this.validateClientFile(file);
    const conversation = await this.conversation(clientId, userId);
    const safeName = sanitizeFilename(file.originalname);
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';

    let uploaded;
    try {
      uploaded = await this.storage.upload({
        buffer: file.buffer,
        originalName: safeName,
        mimeType: file.mimetype,
        folder: this.storage.clientFileFolder(clientId, conversation.id),
        resourceType,
      });
    } catch (error: unknown) {
      if (error instanceof StorageProviderError) {
        throw new ServiceUnavailableException(
          'The file could not be uploaded. Please try again.',
        );
      }
      throw error;
    }

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
    try {
      return await this.prisma.clientFile.create({
        data: {
          clientId,
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
    } catch (error: unknown) {
      await this.storage
        .delete(uploaded.publicId, resourceType)
        .catch(() => undefined);
      throw error;
    }
  }

  async fileStatus(
    clientId: string,
    id: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const file = await this.prisma.clientFile.findFirst({
      where: { id, clientId },
    });
    if (!file) throw new NotFoundException('File not found.');
    if (status === 'APPROVED' && !file.extractedText) {
      throw new BadRequestException(
        'This file has no extracted text available for approval.',
      );
    }
    if (status === 'REJECTED' && file.storagePublicId) {
      try {
        await this.storage.delete(
          file.storagePublicId,
          file.storageResourceType === 'image' ? 'image' : 'raw',
        );
      } catch (error: unknown) {
        if (error instanceof StorageProviderError) {
          throw new ServiceUnavailableException(
            'The file could not be removed. Please try again.',
          );
        }
        throw error;
      }
    }
    return this.prisma.clientFile.update({
      where: { id },
      data: { processingStatus: status },
    });
  }

  private async assertCanMessage(clientId: string) {
    const client = await this.client(clientId);
    if (client.status === 'ARCHIVED') {
      throw new ConflictException(
        'Archived clients cannot receive new messages.',
      );
    }
    return client;
  }

  private persistNewAssistantResult(
    client: Client,
    conversation: Conversation,
    result: AnalyseClientMessageResult,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const assistant = await transaction.message.create({
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
      const changes = await this.createChanges(
        transaction,
        client,
        conversation.id,
        assistant.id,
        result,
      );
      return { assistant, changes };
    });
  }

  private persistStreamResult(
    prepared: PreparedStream,
    result: AnalyseClientMessageResult,
    visibleText: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const assistant = await transaction.message.update({
        where: { id: prepared.assistantMessage.id },
        data: {
          content: visibleText,
          status: 'COMPLETED',
          provider: result.metadata.provider,
          model: result.metadata.model,
          promptVersion: result.metadata.promptVersion,
          usedFallback: result.metadata.usedFallback,
          errorCode: null,
        },
      });
      const changes = await this.createChanges(
        transaction,
        prepared.client,
        prepared.conversation.id,
        assistant.id,
        result,
      );
      return { assistant, changes };
    });
  }

  private createChanges(
    transaction: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    client: Client,
    conversationId: string,
    assistantId: string,
    result: AnalyseClientMessageResult,
  ) {
    return Promise.all(
      result.proposedChanges.map((change) =>
        transaction.contextChangeRequest.create({
          data: {
            clientId: client.id,
            conversationId,
            sourceMessageId: assistantId,
            fieldName: change.field,
            oldValue: String(client[change.field] ?? ''),
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
  }

  private validateClientFile(file: Express.Multer.File) {
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
    if (
      !allowed[file.mimetype]?.includes(extension) ||
      !hasExpectedSignature(file)
    ) {
      throw new BadRequestException('Unsupported or invalid file type.');
    }
  }
}

function hasExpectedSignature(file: Express.Multer.File) {
  if (file.mimetype === 'image/jpeg') {
    return file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (file.mimetype === 'image/png') {
    return file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (file.mimetype === 'image/webp') {
    return (
      file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      file.buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (file.mimetype === 'audio/mpeg') {
    return (
      file.buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
      file.buffer[0] === 0xff
    );
  }
  if (file.mimetype === 'audio/wav') {
    return (
      file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      file.buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    );
  }
  if (file.mimetype === 'audio/ogg') {
    return file.buffer.subarray(0, 4).toString('ascii') === 'OggS';
  }
  if (file.mimetype === 'audio/webm') {
    return file.buffer
      .subarray(0, 4)
      .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  if (file.mimetype === 'audio/mp4' || file.mimetype === 'video/mp4') {
    return file.buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (file.mimetype === 'application/pdf') {
    return file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (
    file.mimetype ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return file.buffer.subarray(0, 2).toString('ascii') === 'PK';
  }
  return !file.buffer.includes(0);
}

function sanitizeFilename(name: string) {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 240);
  return sanitized || `${randomUUID()}.upload`;
}

function toStreamMessage(message: Message): StreamMessage {
  return {
    id: message.id,
    senderType: message.senderType,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt,
  };
}

function toStreamProposal(proposal: ContextChangeRequest): StreamProposal {
  return {
    id: proposal.id,
    fieldName: proposal.fieldName,
    oldValue: proposal.oldValue,
    proposedValue: proposal.proposedValue,
    explanation: proposal.explanation,
    confidence: proposal.confidence,
    status: proposal.status,
  };
}
