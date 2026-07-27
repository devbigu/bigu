import { Injectable } from '@nestjs/common';
import type {
  AiMessage,
  AiProviderName,
  StructuredRequest,
  TranscriptionRequest,
  VisionRequest,
} from './ai-provider.interface';
import { AiProviderRouter } from './ai-provider-router.service';

export type OrchestratedTextChunk = {
  provider: AiProviderName;
  delta: string;
};

@Injectable()
export class AiOrchestrator {
  constructor(private readonly providers: AiProviderRouter) {}

  streamProjectAnswer(
    messages: AiMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<OrchestratedTextChunk> {
    return this.providers.streamText(
      { messages, modelPurpose: 'PRIMARY', temperature: 0.3 },
      signal,
    );
  }

  streamFastTask(messages: AiMessage[], signal?: AbortSignal) {
    return this.providers.streamText(
      {
        messages,
        modelPurpose: 'FAST',
        temperature: 0.2,
        maxOutputTokens: 1_024,
      },
      signal,
    );
  }

  runSafetyCheck(messages: AiMessage[], signal?: AbortSignal) {
    return this.providers.streamText(
      {
        messages,
        modelPurpose: 'SAFETY',
        temperature: 0,
        maxOutputTokens: 512,
      },
      signal,
    );
  }

  analyzeVision(request: VisionRequest, signal?: AbortSignal) {
    return this.providers.analyzeVision(request, signal);
  }

  transcribeAudio(request: TranscriptionRequest, signal?: AbortSignal) {
    return this.providers.transcribeAudio(request, signal);
  }
  extractProjectActions(request: StructuredRequest, signal?: AbortSignal) {
    return this.providers.generateStructured(request, signal);
  }
}
