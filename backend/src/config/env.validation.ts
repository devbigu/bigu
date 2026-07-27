type Environment = Record<string, string | undefined>;

const requiredVariables = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_FOLDER',
] as const;

export type AppEnvironment = {
  NODE_ENV: string;
  PORT: number;
  FRONTEND_URL: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  USER_AVATAR_MAX_BYTES: number;
  CLIENT_FILE_MAX_BYTES: number;
  AI_REQUEST_TIMEOUT_MS: number;
  AI_PRIMARY_PROVIDER: string;
  AI_FALLBACK_PROVIDERS: string;
  GROQ_API_KEY?: string;
  GROQ_BASE_URL: string;
  GROQ_PRIMARY_MODEL: string;
  GROQ_FAST_MODEL: string;
  GROQ_VISION_MODEL: string;
  GROQ_TRANSCRIPTION_MODEL: string;
  GROQ_SAFETY_MODEL: string;
  GROQ_REQUEST_TIMEOUT_MS: number;
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_FALLBACK?: string;
  GEMINI_MODEL: string;
  BACKEND_PUBLIC_URL: string;
  STORAGE_PROVIDER: 'cloudinary';
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_FOLDER: string;
  GOOGLE_SHEETS_ACCESS_TOKEN?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};

export function validateEnv(config: Environment): AppEnvironment {
  const missing = requiredVariables.filter((key) => !config[key]);
  if (
    !config.GROQ_API_KEY &&
    !config.GEMINI_API_KEY &&
    !config.GEMINI_API_KEY_FALLBACK
  ) {
    throw new Error(
      'Missing usable AI configuration: at least one configured text AI provider is required.',
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
    );
  }

  const port = positiveInteger(config.PORT ?? '4000', 'PORT');
  if (port > 65535) {
    throw new Error('PORT must be a valid TCP port number.');
  }
  const avatarMaxBytes = positiveInteger(
    config.USER_AVATAR_MAX_BYTES ?? '5242880',
    'USER_AVATAR_MAX_BYTES',
  );
  const clientFileMaxBytes = positiveInteger(
    config.CLIENT_FILE_MAX_BYTES ?? '10485760',
    'CLIENT_FILE_MAX_BYTES',
  );
  const aiRequestTimeoutMs = positiveInteger(
    config.AI_REQUEST_TIMEOUT_MS ?? '30000',
    'AI_REQUEST_TIMEOUT_MS',
  );
  if (
    config.STORAGE_PROVIDER !== undefined &&
    config.STORAGE_PROVIDER !== 'cloudinary'
  ) {
    throw new Error('STORAGE_PROVIDER must be cloudinary.');
  }
  const cloudinaryFolder = config.CLOUDINARY_FOLDER as string;
  if (
    cloudinaryFolder.includes('..') ||
    !/^[a-zA-Z0-9/_-]+$/.test(cloudinaryFolder)
  ) {
    throw new Error('CLOUDINARY_FOLDER must be a safe Cloudinary folder path.');
  }

  return {
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: port,
    FRONTEND_URL: config.FRONTEND_URL ?? 'http://localhost:3000',
    DATABASE_URL: config.DATABASE_URL as string,
    JWT_ACCESS_SECRET: config.JWT_ACCESS_SECRET as string,
    JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET as string,
    JWT_ACCESS_EXPIRES_IN: config.JWT_ACCESS_EXPIRES_IN ?? '15m',
    JWT_REFRESH_EXPIRES_IN: config.JWT_REFRESH_EXPIRES_IN ?? '7d',
    USER_AVATAR_MAX_BYTES: avatarMaxBytes,
    CLIENT_FILE_MAX_BYTES: clientFileMaxBytes,
    AI_REQUEST_TIMEOUT_MS: aiRequestTimeoutMs,
    AI_PRIMARY_PROVIDER: config.AI_PRIMARY_PROVIDER ?? 'groq',
    AI_FALLBACK_PROVIDERS: config.AI_FALLBACK_PROVIDERS ?? 'gemini',
    GROQ_API_KEY: config.GROQ_API_KEY,
    GROQ_BASE_URL: config.GROQ_BASE_URL ?? 'https://api.groq.com',
    GROQ_PRIMARY_MODEL: config.GROQ_PRIMARY_MODEL ?? 'openai/gpt-oss-120b',
    GROQ_FAST_MODEL: config.GROQ_FAST_MODEL ?? 'openai/gpt-oss-20b',
    GROQ_VISION_MODEL: config.GROQ_VISION_MODEL ?? 'qwen/qwen3.6-27b',
    GROQ_TRANSCRIPTION_MODEL:
      config.GROQ_TRANSCRIPTION_MODEL ?? 'whisper-large-v3-turbo',
    GROQ_SAFETY_MODEL:
      config.GROQ_SAFETY_MODEL ?? 'openai/gpt-oss-safeguard-20b',
    GROQ_REQUEST_TIMEOUT_MS: positiveInteger(
      config.GROQ_REQUEST_TIMEOUT_MS ?? '45000',
      'GROQ_REQUEST_TIMEOUT_MS',
    ),
    GEMINI_API_KEY: config.GEMINI_API_KEY,
    GEMINI_API_KEY_FALLBACK: config.GEMINI_API_KEY_FALLBACK,
    GEMINI_MODEL: config.GEMINI_MODEL ?? 'gemini-3.5-flash',
    BACKEND_PUBLIC_URL: config.BACKEND_PUBLIC_URL ?? `http://localhost:${port}`,
    STORAGE_PROVIDER: 'cloudinary',
    CLOUDINARY_CLOUD_NAME: config.CLOUDINARY_CLOUD_NAME as string,
    CLOUDINARY_API_KEY: config.CLOUDINARY_API_KEY as string,
    CLOUDINARY_API_SECRET: config.CLOUDINARY_API_SECRET as string,
    CLOUDINARY_FOLDER: cloudinaryFolder,
    GOOGLE_SHEETS_ACCESS_TOKEN: config.GOOGLE_SHEETS_ACCESS_TOKEN,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
      config.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  };
}

function positiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (name === 'PORT') {
      throw new Error('PORT must be a valid TCP port number.');
    }
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}
