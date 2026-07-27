import type { ConfigService } from '@nestjs/config';
import type { AiProvider, StreamTextRequest } from './ai-provider.interface';
import { AiProviderRouter } from './ai-provider-router.service';
import type { GeminiAiProvider } from './providers/gemini-ai.provider';
import type { GroqAiProvider } from './providers/groq-ai.provider';

function provider(
  name: 'groq' | 'gemini',
  stream: () => AsyncGenerator<string>,
): AiProvider {
  return {
    name,
    isConfigured: () => true,
    streamText: stream,
    generateStructured: async () => ({ provider: name }),
  };
}
function request(): StreamTextRequest {
  return {
    messages: [{ role: 'user', content: 'hi' }],
    modelPurpose: 'PRIMARY',
  };
}
function router(groq: AiProvider, gemini: AiProvider) {
  const config = {
    get: (key: string) =>
      key === 'AI_PRIMARY_PROVIDER'
        ? 'groq'
        : key === 'AI_FALLBACK_PROVIDERS'
          ? 'gemini'
          : undefined,
  } as ConfigService;
  return new AiProviderRouter(
    config,
    groq as GroqAiProvider,
    gemini as GeminiAiProvider,
  );
}

describe('AiProviderRouter', () => {
  it('selects Groq as primary', async () => {
    const target = router(
      provider('groq', async function* () {
        yield 'groq';
      }),
      provider('gemini', async function* () {
        yield 'gemini';
      }),
    );
    const chunks: Array<{ provider: string; delta: string }> = [];
    for await (const chunk of target.streamText(request())) chunks.push(chunk);
    expect(chunks).toEqual([{ provider: 'groq', delta: 'groq' }]);
  });

  it('falls back to Gemini on a transient pre-output failure', async () => {
    const error = Object.assign(new Error('unavailable'), { status: 503 });
    const target = router(
      provider('groq', async function* () {
        throw error;
      }),
      provider('gemini', async function* () {
        yield 'fallback';
      }),
    );
    const chunks: Array<{ provider: string; delta: string }> = [];
    for await (const chunk of target.streamText(request())) chunks.push(chunk);
    expect(chunks).toEqual([{ provider: 'gemini', delta: 'fallback' }]);
  });

  it('never switches provider after visible output', async () => {
    const error = Object.assign(new Error('unavailable'), { status: 503 });
    const target = router(
      provider('groq', async function* () {
        yield 'partial';
        throw error;
      }),
      provider('gemini', async function* () {
        yield 'wrong';
      }),
    );
    const chunks: Array<{ provider: string; delta: string }> = [];
    await expect(async () => {
      for await (const chunk of target.streamText(request()))
        chunks.push(chunk);
    }).rejects.toThrow('unavailable');
    expect(chunks).toEqual([{ provider: 'groq', delta: 'partial' }]);
  });

  it('falls back to Gemini on a pre-output Groq token-limit rejection', async () => {
    const error = Object.assign(
      new Error(
        '413 {"error":{"message":"Request too large on tokens per minute","type":"tokens","code":"rate_limit_exceeded"}}',
      ),
      { status: 413 },
    );
    const target = router(
      provider('groq', async function* () {
        throw error;
      }),
      provider('gemini', async function* () {
        yield 'fallback';
      }),
    );
    const chunks: Array<{ provider: string; delta: string }> = [];
    for await (const chunk of target.streamText(request())) chunks.push(chunk);
    expect(chunks).toEqual([{ provider: 'gemini', delta: 'fallback' }]);
  });
  it('does not hide authentication failures with fallback', async () => {
    const error = Object.assign(new Error('invalid key'), { status: 401 });
    const target = router(
      provider('groq', async function* () {
        throw error;
      }),
      provider('gemini', async function* () {
        yield 'wrong';
      }),
    );
    await expect(async () => {
      for await (const _chunk of target.streamText(request())) {
        /* consume */
      }
    }).rejects.toThrow('invalid key');
  });
});
