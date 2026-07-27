export type AiProviderName = 'groq' | 'gemini';
export type AiModelPurpose = 'PRIMARY' | 'FAST' | 'VISION' | 'SAFETY';

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StreamTextRequest = {
  messages: AiMessage[];
  modelPurpose: AiModelPurpose;
  temperature?: number;
  maxOutputTokens?: number;
};

export type StructuredRequest = {
  messages: AiMessage[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
};

export type VisionRequest = {
  prompt: string;
  imageUrl: string;
  maxOutputTokens?: number;
};

export type TranscriptionRequest = {
  file: Buffer;
  filename: string;
  mimeType: string;
  language?: string;
};

export interface AiProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  streamText(
    request: StreamTextRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<string>;
  generateStructured(
    request: StructuredRequest,
    signal?: AbortSignal,
  ): Promise<unknown>;
  analyzeVision?(request: VisionRequest, signal?: AbortSignal): Promise<string>;
  transcribeAudio?(
    request: TranscriptionRequest,
    signal?: AbortSignal,
  ): Promise<string>;
}
