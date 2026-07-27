import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider,
  AiProviderName,
  StreamTextRequest,
  StructuredRequest,
  TranscriptionRequest,
  VisionRequest,
} from './ai-provider.interface';
import { GroqAiProvider } from './providers/groq-ai.provider';
import { GeminiAiProvider } from './providers/gemini-ai.provider';

@Injectable()
export class AiProviderRouter {
  private readonly logger = new Logger(AiProviderRouter.name);

  private readonly providers: Map<AiProviderName, AiProvider>;

  constructor(
    private readonly config: ConfigService,
    groq: GroqAiProvider,
    gemini: GeminiAiProvider,
  ) {
    this.providers = new Map<AiProviderName, AiProvider>([
      ['groq', groq],
      ['gemini', gemini],
    ]);
  }

  async *streamText(
    request: StreamTextRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<{
    provider: AiProviderName;
    delta: string;
  }> {
    const orderedProviders = this.getProviderOrder();
    let emittedAnyText = false;
    let finalError: unknown;

    for (const provider of orderedProviders) {
      try {
        for await (const delta of provider.streamText(request, signal)) {
          emittedAnyText = true;

          yield {
            provider: provider.name,
            delta,
          };
        }

        return;
      } catch (error) {
        finalError = error;
        const retryable = this.isRetryable(error);

        this.logger.warn({
          provider: provider.name,
          operation: 'stream-text',
          retryable,
          emittedAnyText,
          error: this.summarizeError(error),
        });

        /*
         * Never switch providers after visible text has started.
         * It could repeat or contradict the partial response.
         */
        if (emittedAnyText || !retryable) {
          throw error;
        }
      }
    }

    throw finalError ?? new Error('NO_AI_PROVIDER_AVAILABLE');
  }

  async generateStructured(
    request: StructuredRequest,
    signal?: AbortSignal,
  ): Promise<{
    provider: AiProviderName;
    value: unknown;
  }> {
    let finalError: unknown;

    for (const provider of this.getProviderOrder()) {
      try {
        const value = await provider.generateStructured(request, signal);

        return {
          provider: provider.name,
          value,
        };
      } catch (error) {
        finalError = error;

        if (!this.isRetryable(error)) {
          throw error;
        }
      }
    }

    throw finalError ?? new Error('NO_AI_PROVIDER_AVAILABLE');
  }

  async analyzeVision(
    request: VisionRequest,
    signal?: AbortSignal,
  ): Promise<{ provider: AiProviderName; text: string }> {
    let finalError: unknown;
    for (const provider of this.getProviderOrder().filter(
      (item) => item.analyzeVision,
    )) {
      try {
        return {
          provider: provider.name,
          text: await provider.analyzeVision!(request, signal),
        };
      } catch (error) {
        finalError = error;
        if (!this.isRetryable(error)) throw error;
      }
    }
    throw finalError ?? new Error('NO_VISION_PROVIDER_AVAILABLE');
  }

  async transcribeAudio(
    request: TranscriptionRequest,
    signal?: AbortSignal,
  ): Promise<{ provider: AiProviderName; text: string }> {
    const provider = this.getProviderOrder().find(
      (item) => item.transcribeAudio,
    );
    if (!provider?.transcribeAudio)
      throw new Error('NO_TRANSCRIPTION_PROVIDER_AVAILABLE');
    return {
      provider: provider.name,
      text: await provider.transcribeAudio(request, signal),
    };
  }
  private getProviderOrder(): AiProvider[] {
    const primary =
      this.config.get<AiProviderName>('AI_PRIMARY_PROVIDER') ?? 'groq';

    const fallbackNames = (
      this.config.get<string>('AI_FALLBACK_PROVIDERS') ?? 'gemini'
    )
      .split(',')
      .map((value) => value.trim())
      .filter(
        (value): value is AiProviderName =>
          value === 'groq' || value === 'gemini',
      );

    const names = [primary, ...fallbackNames];

    return [...new Set(names)]
      .map((name) => this.providers.get(name))
      .filter((provider): provider is AiProvider =>
        Boolean(provider?.isConfigured()),
      );
  }

  private isRetryable(error: unknown): boolean {
    const status = this.readStatus(error);

    return (
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      this.isTokenLimitFallback(error) ||
      this.isTimeoutOrNetworkError(error)
    );
  }

  private readStatus(error: unknown): number | undefined {
    const record = this.asRecord(error);
    if (!record) return undefined;

    if (typeof record.status === 'number') return record.status;
    if (typeof record.statusCode === 'number') return record.statusCode;

    const response = this.asRecord(record.response);
    if (typeof response?.status === 'number') return response.status;

    return undefined;
  }

  private isTokenLimitFallback(error: unknown): boolean {
    return (
      this.readStatus(error) === 413 &&
      /rate_limit_exceeded|tokens per minute|request too large/i.test(
        this.errorMessage(error),
      )
    );
  }

  private isTimeoutOrNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return [
      'AbortError',
      'TimeoutError',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
    ].some(
      (value) => error.name.includes(value) || error.message.includes(value),
    );
  }

  private summarizeError(error: unknown): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    const status = this.readStatus(error);
    if (status !== undefined) summary.status = status;

    if (error instanceof Error) {
      summary.name = error.name;
      summary.message = this.sanitizeMessage(error.message);
    }

    const record = this.asRecord(error);
    if (!record) return summary;

    for (const key of ['code', 'type', 'param', 'request_id'] as const) {
      if (typeof record[key] === 'string') summary[key] = record[key];
    }

    const nestedError = this.asRecord(record.error);
    if (nestedError) {
      for (const key of ['code', 'type', 'param', 'message'] as const) {
        if (typeof nestedError[key] === 'string') {
          summary['error_' + key] =
            key === 'message'
              ? this.sanitizeMessage(nestedError[key])
              : nestedError[key];
        }
      }
    }

    return summary;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : '';
  }

  private sanitizeMessage(value: unknown): string {
    return String(value)
      .replace(/organization [^]+/g, 'organization [redacted]')
      .replace(/org_[a-z0-9]+/gi, 'org_[redacted]')
      .slice(0, 500);
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  }
}
