import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Groq, toFile } from 'groq-sdk';
import {
  AiProvider,
  StreamTextRequest,
  StructuredRequest,
  TranscriptionRequest,
  VisionRequest,
} from '../ai-provider.interface';

@Injectable()
export class GroqAiProvider implements AiProvider {
  readonly name = 'groq' as const;
  private readonly client: Groq | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    this.client = apiKey
      ? new Groq({
          apiKey,
          baseURL:
            this.config.get<string>('GROQ_BASE_URL') ?? 'https://api.groq.com',
          timeout: this.config.get<number>('GROQ_REQUEST_TIMEOUT_MS') ?? 45_000,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async *streamText(
    request: StreamTextRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const client = this.requireClient();
    const stream = await client.chat.completions.create(
      {
        model: this.resolveModel(request.modelPurpose),
        messages: request.messages,
        stream: true,
        temperature: request.temperature ?? 0.3,
        max_completion_tokens: request.maxOutputTokens ?? 4_096,
        reasoning_effort:
          request.modelPurpose === 'VISION' ? undefined : 'medium',
        reasoning_format:
          request.modelPurpose === 'VISION' ? undefined : 'hidden',
      },
      { signal },
    );
    let emittedText = false;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        emittedText = true;
        yield delta;
      }
    }
    if (!emittedText) {
      throw Object.assign(new Error('GROQ_EMPTY_STREAM_RESPONSE'), {
        status: 503,
      });
    }
  }

  async generateStructured(
    request: StructuredRequest,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.requireClient().chat.completions.create(
      {
        model:
          this.config.get<string>('GROQ_FAST_MODEL') ?? 'openai/gpt-oss-20b',
        messages: request.messages,
        stream: false,
        reasoning_effort: 'medium',
        reasoning_format: 'hidden',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: request.schemaName,
            strict: true,
            schema: request.jsonSchema,
          },
        },
      },
      { signal },
    );
    const content = result.choices[0]?.message?.content;
    if (!content) throw new Error('GROQ_EMPTY_STRUCTURED_RESPONSE');
    return JSON.parse(content) as unknown;
  }

  async analyzeVision(
    request: VisionRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const result = await this.requireClient().chat.completions.create(
      {
        model: this.resolveModel('VISION'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: request.prompt },
              { type: 'image_url', image_url: { url: request.imageUrl } },
            ],
          },
        ],
        stream: false,
        temperature: 0.2,
        max_completion_tokens: request.maxOutputTokens ?? 2_048,
      },
      { signal },
    );
    const content = result.choices[0]?.message?.content;
    if (!content) throw new Error('GROQ_EMPTY_VISION_RESPONSE');
    return content;
  }

  async transcribeAudio(
    request: TranscriptionRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    const file = await toFile(request.file, request.filename, {
      type: request.mimeType,
    });
    const result = await this.requireClient().audio.transcriptions.create(
      {
        file,
        model:
          this.config.get<string>('GROQ_TRANSCRIPTION_MODEL') ??
          'whisper-large-v3-turbo',
        language: request.language,
        response_format: 'json',
        temperature: 0,
      },
      { signal },
    );
    if (!result.text) throw new Error('GROQ_EMPTY_TRANSCRIPTION');
    return result.text;
  }

  private requireClient(): Groq {
    if (!this.client) throw new Error('GROQ_NOT_CONFIGURED');
    return this.client;
  }

  private resolveModel(purpose: StreamTextRequest['modelPurpose']): string {
    switch (purpose) {
      case 'VISION':
        return (
          this.config.get<string>('GROQ_VISION_MODEL') ?? 'qwen/qwen3.6-27b'
        );
      case 'FAST':
        return (
          this.config.get<string>('GROQ_FAST_MODEL') ?? 'openai/gpt-oss-20b'
        );
      case 'SAFETY':
        return (
          this.config.get<string>('GROQ_SAFETY_MODEL') ??
          'openai/gpt-oss-safeguard-20b'
        );
      case 'PRIMARY':
      default:
        return (
          this.config.get<string>('GROQ_PRIMARY_MODEL') ?? 'openai/gpt-oss-120b'
        );
    }
  }
}
