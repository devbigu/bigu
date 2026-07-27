import { Module } from '@nestjs/common';
import { AiOrchestrator } from './ai-orchestrator.service';
import { AiProviderRouter } from './ai-provider-router.service';
import { GeminiAiProvider } from './providers/gemini-ai.provider';
import { GroqAiProvider } from './providers/groq-ai.provider';

@Module({
  providers: [
    GroqAiProvider,
    GeminiAiProvider,
    AiProviderRouter,
    AiOrchestrator,
  ],
  exports: [AiProviderRouter, AiOrchestrator],
})
export class AiModule {}
