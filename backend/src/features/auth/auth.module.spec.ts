import { JwtService } from '@nestjs/jwt';
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import { Test, TestingModule } from '@nestjs/testing';
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import { PasswordService } from '../../common/security/password.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import { AuthController } from './auth.controller';
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import { AuthModule } from './auth.module';
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import { AuthService } from './auth.service';
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));
import { JwtStrategy } from './strategies/jwt.strategy';
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthModule', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('compiles and resolves auth wiring providers', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: jest.fn(),
        },
      })
      .compile();

    expect(moduleRef.get(AuthController)).toBeInstanceOf(AuthController);
    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
    expect(moduleRef.get(JwtStrategy)).toBeInstanceOf(JwtStrategy);
    expect(moduleRef.get(JwtService)).toBeInstanceOf(JwtService);
    expect(moduleRef.get(PasswordService)).toBeInstanceOf(PasswordService);
  });
});
