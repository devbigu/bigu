import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiMessage, AiProviderName } from '../ai/ai-provider.interface';
import { AiProviderRouter } from '../ai/ai-provider-router.service';

export const CLIENT_FIELDS = [
  'name',
  'industry',
  'description',
  'targetAudience',
  'brandVoice',
  'websiteUrl',
  'instagramUrl',
  'facebookUrl',
  'businessObjectives',
] as const;
export type ClientField = (typeof CLIENT_FIELDS)[number];
export type AnalyseClientMessageInput = {
  client: Record<string, unknown>;
  instructions: { title: string; content: string }[];
  approvedFiles: { name: string; extractedText: string }[];
  recentMessages: { role: 'user' | 'assistant'; content: string }[];
  currentMessage: string;
};
export type AnalyseClientMessageResult = {
  assistantMessage: string;
  proposedChanges: {
    field: ClientField;
    proposedValue: string;
    explanation?: string;
    confidence?: number;
  }[];
  proposedInstructions: {
    title: string;
    content: string;
    explanation?: string;
  }[];
  metadata: {
    provider: string;
    model: string;
    promptVersion: string;
    usedFallback: boolean;
  };
};
export type StreamChunk =
  | { type: 'text-delta'; delta: string }
  | { type: 'completed'; result: AnalyseClientMessageResult };

export class AiProviderError extends Error {
  constructor(
    public readonly category: string,
    public readonly retryable: boolean,
  ) {
    super('AI provider request failed.');
  }
}

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly providers: AiProviderRouter,
  ) {}

  async analyseClientMessage(
    input: AnalyseClientMessageInput,
  ): Promise<AnalyseClientMessageResult> {
    let completed: AnalyseClientMessageResult | undefined;
    for await (const chunk of this.streamClientMessage(input)) {
      if (chunk.type === 'completed') completed = chunk.result;
    }
    if (!completed) throw new AiProviderError('invalid_response', false);
    return completed;
  }

  async *streamClientMessage(
    input: AnalyseClientMessageInput,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<StreamChunk> {
    let visibleText = '';
    let visibleProvider: AiProviderName | undefined;
    try {
      for await (const chunk of this.providers.streamText(
        {
          messages: buildAnswerMessages(input),
          modelPurpose: 'PRIMARY',
          temperature: 0.3,
          maxOutputTokens: 4_096,
        },
        options?.signal,
      )) {
        visibleProvider = chunk.provider;
        visibleText += chunk.delta;
        yield { type: 'text-delta', delta: chunk.delta };
      }
      if (!visibleText.trim() || !visibleProvider)
        throw new AiProviderError('invalid_response', false);

      const extracted = await this.providers.generateStructured(
        {
          messages: buildExtractionMessages(input, visibleText),
          schemaName: 'client_workspace_actions',
          jsonSchema: RESULT_SCHEMA,
        },
        options?.signal,
      );
      const result = validateResult(extracted.value);
      result.assistantMessage = visibleText;
      result.metadata = {
        provider: visibleProvider,
        model: this.modelFor(visibleProvider, 'PRIMARY'),
        promptVersion: 'client-workspace-v2',
        usedFallback:
          visibleProvider !==
          this.config.get<AiProviderName>('AI_PRIMARY_PROVIDER', 'groq'),
      };
      yield { type: 'completed', result };
    } catch (error) {
      if (options?.signal?.aborted)
        throw new AiProviderError('cancelled', false);
      if (error instanceof AiProviderError) throw error;
      const status = readStatus(error);
      throw new AiProviderError(
        status === 429 || (status !== undefined && status >= 500)
          ? 'provider_unavailable'
          : 'provider_rejected',
        status === 429 || (status !== undefined && status >= 500),
      );
    }
  }

  async analyzeImage(imageUrl: string, filename: string, signal?: AbortSignal) {
    return this.providers.analyzeVision(
      {
        imageUrl,
        prompt: `Analyze the project image ${filename}. Extract visible text, dates, deliverables, venues, brand details, and other useful factual context. Do not invent missing information.`,
        maxOutputTokens: 2_048,
      },
      signal,
    );
  }

  async transcribeAudio(
    file: Buffer,
    filename: string,
    mimeType: string,
    signal?: AbortSignal,
  ) {
    return this.providers.transcribeAudio({ file, filename, mimeType }, signal);
  }
  private modelFor(provider: AiProviderName, purpose: 'PRIMARY' | 'FAST') {
    if (provider === 'gemini')
      return this.config.get<string>('GEMINI_MODEL', 'gemini-3.5-flash');
    return this.config.get<string>(
      purpose === 'PRIMARY' ? 'GROQ_PRIMARY_MODEL' : 'GROQ_FAST_MODEL',
      purpose === 'PRIMARY' ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b',
    );
  }
}

function buildAnswerMessages(input: AnalyseClientMessageInput): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are BigU client workspace assistant. Use only supplied approved context. Answer concisely in clean Markdown with short sections, bullets, numbered steps, and compact tables when they improve comparison. Do not emit HTML or <br> tags. Never claim to have saved or changed data, never reveal hidden reasoning, and describe proposed updates as requiring human approval.',
    },
    { role: 'user', content: JSON.stringify(input) },
  ];
}

function buildExtractionMessages(
  input: AnalyseClientMessageInput,
  assistantMessage: string,
): AiMessage[] {
  return [
    {
      role: 'system',
      content:
        'Extract strict client context and reusable instruction proposals from the conversation. Models only propose; backend validation and human approval execute. Return empty arrays when nothing should be recorded.',
    },
    { role: 'user', content: JSON.stringify({ input, assistantMessage }) },
  ];
}

const nullableString = { type: ['string', 'null'] };
const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assistantMessage', 'proposedChanges', 'proposedInstructions'],
  properties: {
    assistantMessage: { type: 'string' },
    proposedChanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'proposedValue', 'explanation', 'confidence'],
        properties: {
          field: { type: 'string', enum: CLIENT_FIELDS },
          proposedValue: { type: 'string' },
          explanation: nullableString,
          confidence: { type: ['number', 'null'] },
        },
      },
    },
    proposedInstructions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'content', 'explanation'],
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          explanation: nullableString,
        },
      },
    },
  },
};

function validateResult(value: unknown): AnalyseClientMessageResult {
  if (!value || typeof value !== 'object')
    throw new AiProviderError('invalid_response', false);
  const result = value as Record<string, unknown>;
  if (
    typeof result.assistantMessage !== 'string' ||
    !Array.isArray(result.proposedChanges) ||
    !Array.isArray(result.proposedInstructions)
  ) {
    throw new AiProviderError('invalid_response', false);
  }
  const proposedChanges = result.proposedChanges.map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new AiProviderError('invalid_response', false);
    const change = entry as Record<string, unknown>;
    if (
      !CLIENT_FIELDS.includes(change.field as ClientField) ||
      typeof change.proposedValue !== 'string'
    )
      throw new AiProviderError('invalid_response', false);
    return {
      field: change.field as ClientField,
      proposedValue: change.proposedValue,
      explanation:
        typeof change.explanation === 'string' ? change.explanation : undefined,
      confidence:
        typeof change.confidence === 'number' ? change.confidence : undefined,
    };
  });
  const proposedInstructions = result.proposedInstructions.map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new AiProviderError('invalid_response', false);
    const instruction = entry as Record<string, unknown>;
    if (
      typeof instruction.title !== 'string' ||
      typeof instruction.content !== 'string'
    )
      throw new AiProviderError('invalid_response', false);
    return {
      title: instruction.title,
      content: instruction.content,
      explanation:
        typeof instruction.explanation === 'string'
          ? instruction.explanation
          : undefined,
    };
  });
  return {
    assistantMessage: result.assistantMessage,
    proposedChanges,
    proposedInstructions,
    metadata: {
      provider: '',
      model: '',
      promptVersion: '',
      usedFallback: false,
    },
  };
}

function readStatus(error: unknown): number | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
    ? error.status
    : undefined;
}
