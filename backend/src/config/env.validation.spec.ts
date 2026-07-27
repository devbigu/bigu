import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/bigu',
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    GEMINI_API_KEY: 'test-key',
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-api-key',
    CLOUDINARY_API_SECRET: 'test-api-secret',
    CLOUDINARY_FOLDER: 'bigu-test',
  };

  it('applies defaults for optional variables', () => {
    expect(validateEnv(validEnv)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      FRONTEND_URL: 'http://localhost:3000',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-3.5-flash',
    });
  });

  it('preserves explicit Gemini configuration for ConfigService', () => {
    expect(
      validateEnv({
        ...validEnv,
        GEMINI_API_KEY_FALLBACK: 'fallback-key',
        GEMINI_MODEL: 'gemini-custom-model',
      }),
    ).toMatchObject({
      GEMINI_API_KEY: 'test-key',
      GEMINI_API_KEY_FALLBACK: 'fallback-key',
      GEMINI_MODEL: 'gemini-custom-model',
    });
  });
  it('reports missing required variables clearly', () => {
    expect(() =>
      validateEnv({
        JWT_ACCESS_SECRET: 'access-secret',
        GEMINI_API_KEY: 'test-key',
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'test-api-key',
        CLOUDINARY_API_SECRET: 'test-api-secret',
        CLOUDINARY_FOLDER: 'bigu-test',
      }),
    ).toThrow(
      'Missing required environment variables: DATABASE_URL, JWT_REFRESH_SECRET',
    );
  });

  it('rejects invalid ports', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'nope' })).toThrow(
      'PORT must be a valid TCP port number.',
    );
  });
});
