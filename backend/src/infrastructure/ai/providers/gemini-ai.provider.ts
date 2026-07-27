import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  AiProvider,
  StreamTextRequest,
  StructuredRequest,
  VisionRequest,
} from '../ai-provider.interface';

@Injectable()
export class GeminiAiProvider implements AiProvider {
  readonly name = 'gemini' as const;

  private readonly client: GoogleGenAI | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');

    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async *streamText(
    request: StreamTextRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    if (!this.client) {
      throw new Error('GEMINI_NOT_CONFIGURED');
    }

    const response = await this.client.models.generateContentStream({
      model: this.config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash',

      contents: request.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: `[${message.role}]\n${message.content}` }],
      })),

      config: {
        abortSignal: signal,
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxOutputTokens ?? 4_096,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  async analyzeVision(
    request: VisionRequest,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!this.client) throw new Error('GEMINI_NOT_CONFIGURED');
    const image = await fetch(request.imageUrl, { signal });
    if (!image.ok)
      throw Object.assign(new Error('GEMINI_IMAGE_FETCH_FAILED'), {
        status: image.status,
      });
    const mimeType =
      image.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    const data = Buffer.from(await image.arrayBuffer()).toString('base64');
    const response = await this.client.models.generateContent({
      model: this.config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: request.prompt }, { inlineData: { mimeType, data } }],
        },
      ],
      config: {
        abortSignal: signal,
        temperature: 0.2,
        maxOutputTokens: request.maxOutputTokens ?? 2_048,
      },
    });
    if (!response.text) throw new Error('GEMINI_EMPTY_VISION_RESPONSE');
    return response.text;
  }
  async generateStructured(
    request: StructuredRequest,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error('GEMINI_NOT_CONFIGURED');
    }

    const response = await this.client.models.generateContent({
      model: this.config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash',

      contents: request.messages
        .map((message) => `[${message.role}]\n${message.content}`)
        .join('\n\n'),

      config: {
        abortSignal: signal,
        responseMimeType: 'application/json',
        responseJsonSchema: request.jsonSchema,
      },
    });

    if (!response.text) {
      throw new Error('GEMINI_EMPTY_STRUCTURED_RESPONSE');
    }

    return JSON.parse(response.text) as unknown;
  }
}
