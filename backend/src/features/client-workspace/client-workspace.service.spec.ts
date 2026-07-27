import {
  AiProviderError,
  AiService,
} from '../../infrastructure/integrations/ai.service';
import { StorageService } from '../../infrastructure/integrations/storage.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { ClientContextService } from './client-context.service';
import { ClientWorkspaceService } from './client-workspace.service';

const client = {
  id: 'client-1',
  name: 'Client',
  industry: null,
  description: null,
  targetAudience: null,
  brandVoice: null,
  websiteUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  businessObjectives: null,
  status: 'ACTIVE' as const,
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const conversation = {
  id: 'conversation-1',
  clientId: client.id,
  projectId: null,
  title: 'Client workspace',
  isPrimary: true,
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const userMessage = {
  id: 'message-user',
  conversationId: conversation.id,
  senderType: 'USER' as const,
  content: 'Hello',
  status: 'COMPLETED' as const,
  createdById: 'user-1',
  provider: null,
  model: null,
  promptVersion: null,
  usedFallback: null,
  errorCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const assistantMessage = {
  ...userMessage,
  id: 'message-assistant',
  senderType: 'ASSISTANT' as const,
  content: '',
  status: 'STREAMING' as const,
  createdById: null,
};
const result = {
  assistantMessage: 'Hello there',
  proposedChanges: [
    {
      field: 'brandVoice' as const,
      proposedValue: 'Warm',
      explanation: 'Requested by the user',
    },
  ],
  proposedInstructions: [],
  metadata: {
    provider: 'google-gemini',
    model: 'test-model',
    promptVersion: 'client-workspace-v1',
    usedFallback: false,
  },
};

describe('ClientWorkspaceService streaming', () => {
  const transaction = {
    message: { create: jest.fn(), update: jest.fn() },
    contextChangeRequest: { create: jest.fn() },
    client: { update: jest.fn() },
  };
  const prisma = {
    client: { findUnique: jest.fn() },
    conversation: { findFirst: jest.fn(), create: jest.fn() },
    message: { create: jest.fn(), update: jest.fn() },
    contextChangeRequest: { findFirst: jest.fn(), update: jest.fn() },
    clientInstruction: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    clientFile: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((callback: (value: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };
  const ai = {
    streamClientMessage: jest.fn(),
    analyseClientMessage: jest.fn(),
  };
  const context = { build: jest.fn() };
  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
    clientFileFolder: jest.fn(
      () => 'bigu/client-files/client-1/conversation-1',
    ),
  };
  const spreadsheets = {
    queueClientSync: jest.fn(async () => undefined),
  };
  const config = { get: jest.fn((_key: string, fallback: number) => fallback) };
  let service: ClientWorkspaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.client.findUnique.mockResolvedValue(client);
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.message.create
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantMessage);
    context.build.mockResolvedValue({ currentMessage: 'Hello' });
    transaction.message.update.mockResolvedValue({
      ...assistantMessage,
      content: 'Hello there',
      status: 'COMPLETED',
    });
    transaction.contextChangeRequest.create.mockResolvedValue({
      id: 'proposal-1',
      clientId: client.id,
      conversationId: conversation.id,
      sourceMessageId: assistantMessage.id,
      fieldName: 'brandVoice',
      oldValue: null,
      proposedValue: 'Warm',
      explanation: 'Requested by the user',
      confidence: null,
      status: 'PENDING',
      proposedByProvider: 'google-gemini',
      proposedByModel: 'test-model',
      promptVersion: 'client-workspace-v1',
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.message.update.mockResolvedValue({
      ...assistantMessage,
      status: 'FAILED',
    });
    service = new ClientWorkspaceService(
      prisma as unknown as PrismaService,
      ai as unknown as AiService,
      context as unknown as ClientContextService,
      config as never,
      storage as unknown as StorageService,
      spreadsheets as unknown as SpreadsheetsService,
    );
  });

  it('persists the user message before creating the streaming assistant record', async () => {
    await service.prepareStream(client.id, 'Hello', 'user-1');
    expect(prisma.message.create).toHaveBeenNthCalledWith(1, {
      data: {
        conversationId: conversation.id,
        senderType: 'USER',
        content: 'Hello',
        status: 'COMPLETED',
        createdById: 'user-1',
      },
    });
    expect(prisma.message.create).toHaveBeenNthCalledWith(2, {
      data: {
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        content: '',
        status: 'STREAMING',
      },
    });
  });

  it('emits ordered text, persists the final response, then emits validated proposals and completion', async () => {
    ai.streamClientMessage.mockReturnValue(
      streamFrom([
        { type: 'text-delta' as const, delta: 'Hello ' },
        { type: 'text-delta' as const, delta: 'there' },
        { type: 'completed' as const, result },
      ]),
    );
    const prepared = await service.prepareStream(client.id, 'Hello', 'user-1');
    const events = [];
    for await (const event of service.streamPreparedMessage(
      prepared,
      new AbortController().signal,
    )) {
      events.push(event);
    }
    expect(events.map((event) => event.type)).toEqual([
      'message.created',
      'assistant.started',
      'assistant.delta',
      'assistant.delta',
      'proposal.created',
      'assistant.completed',
    ]);
    expect(transaction.message.update).toHaveBeenCalledWith({
      where: { id: assistantMessage.id },
      data: {
        content: 'Hello there',
        status: 'COMPLETED',
        provider: 'google-gemini',
        model: 'test-model',
        promptVersion: 'client-workspace-v1',
        usedFallback: false,
        errorCode: null,
      },
    });
    expect(JSON.stringify(events)).not.toContain('promptVersion');
  });

  it('keeps partial output and marks the assistant failed after an interrupted provider stream', async () => {
    ai.streamClientMessage.mockReturnValue(
      streamFrom([
        { type: 'text-delta' as const, delta: 'Partial' },
        new AiProviderError('provider_unavailable', true),
      ]),
    );
    const prepared = await service.prepareStream(client.id, 'Hello', 'user-1');
    const events = [];
    for await (const event of service.streamPreparedMessage(
      prepared,
      new AbortController().signal,
    )) {
      events.push(event);
    }
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: assistantMessage.id },
      data: {
        content: 'Partial',
        status: 'FAILED',
        errorCode: 'provider_unavailable',
      },
    });
    expect(events.at(-1)).toMatchObject({
      type: 'assistant.failed',
      partialContent: 'Partial',
      status: 'FAILED',
    });
  });

  it('marks a caller-aborted response as cancelled without creating proposals', async () => {
    ai.streamClientMessage.mockReturnValue(
      streamFrom([new AiProviderError('cancelled', false)]),
    );
    const prepared = await service.prepareStream(client.id, 'Hello', 'user-1');
    const controller = new AbortController();
    controller.abort();
    const events = [];
    for await (const event of service.streamPreparedMessage(
      prepared,
      controller.signal,
    )) {
      events.push(event);
    }
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: assistantMessage.id },
      data: { content: '', status: 'CANCELLED', errorCode: 'cancelled' },
    });
    expect(transaction.contextChangeRequest.create).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({
      type: 'assistant.failed',
      status: 'CANCELLED',
    });
  });
});

type TestStreamChunk =
  | { type: 'text-delta'; delta: string }
  | { type: 'completed'; result: typeof result };

async function* streamFrom(items: (TestStreamChunk | Error)[]) {
  for (const item of items) {
    await Promise.resolve();
    if (item instanceof Error) throw item;
    yield item;
  }
}
