/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { JwtService } from '@nestjs/jwt';
import {
  Role,
  ThemePreference,
  User,
  UserProvisioningSource,
  UserStatus,
} from '../../generated/prisma/client';
import { PasswordService } from '../../common/security/password.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from './auth.service';

const genericAuthError = 'Invalid username or email or password.';

const configService = {
  getOrThrow: jest.fn((key: string) => `${key}-value`),
  get: jest.fn((_key: string, fallback: string) => fallback),
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Ada Lovelace',
    username: 'ada',
    email: 'ada@bigu.test',
    passwordHash: 'hashed:Password123!',
    role: Role.ADMIN,
    designation: null,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
    tokenVersion: 3,
    refreshTokenHash: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    deactivatedAt: null,
    deactivatedById: null,
    deactivationReason: null,
    suspensionReason: null,
    suspensionReviewDate: null,
    createdById: null,
    provisioningSource: UserProvisioningSource.ADMIN,
    avatarUrl: null,
    avatarPublicId: null,
    avatarResourceType: null,
    themePreference: ThemePreference.SYSTEM,
    accentColor: null,
    themeColor: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma(storedUser = makeUser()) {
  const userDelegate = {
    findUnique: jest.fn(async () => storedUser),
    update: jest.fn(async ({ data }) => makeUser({ ...storedUser, ...data })),
  };
  const accountAuditEventDelegate = {
    create: jest.fn(async () => ({})),
  };
  const prisma = {
    user: userDelegate,
    accountAuditEvent: accountAuditEventDelegate,
    $transaction: jest.fn(async (callback) =>
      callback({
        user: userDelegate,
        accountAuditEvent: accountAuditEventDelegate,
      }),
    ),
  };
  return prisma as unknown as jest.Mocked<PrismaService>;
}

function makeService(storedUser = makeUser()) {
  const prisma = makePrisma(storedUser);
  const jwtService = {
    signAsync: jest.fn(async (_payload, options) =>
      options.secret.includes('REFRESH') ? 'refresh-token' : 'access-token',
    ),
    verifyAsync: jest.fn(async () => ({
      sub: storedUser.id,
      tokenType: 'refresh',
      tokenVersion: storedUser.tokenVersion,
    })),
  } as unknown as jest.Mocked<JwtService>;
  const passwords = {
    hash: jest.fn(async (value: string) => `hashed:${value}`),
    verify: jest.fn(
      async (hash: string, value: string) => hash === `hashed:${value}`,
    ),
    validate: jest.fn(),
  } as unknown as jest.Mocked<PasswordService>;

  return {
    service: new AuthService(
      prisma,
      jwtService,
      configService as never,
      passwords,
    ),
    prisma,
    jwtService,
    passwords,
    storedUser,
  };
}

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs in with a normalized username and stores only a hashed refresh token', async () => {
    const { service, prisma, passwords } = makeService();

    const result = await service.login({
      identifier: ' ADA ',
      password: 'Password123!',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'ada' },
    });
    expect(passwords.verify).toHaveBeenCalledWith(
      'hashed:Password123!',
      'Password123!',
    );
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: 'user-1' },
      data: { refreshTokenHash: 'hashed:refresh-token' },
    });
    expect(result).toMatchObject({
      user: {
        id: 'user-1',
        username: 'ada',
        status: UserStatus.ACTIVE,
        isActive: true,
        tokenVersion: 3,
      },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    });
  });

  it('logs in with a normalized email', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.login({
        identifier: ' ADA@BIGU.TEST ',
        password: 'Password123!',
      }),
    ).resolves.toMatchObject({ user: { email: 'ada@bigu.test' } });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@bigu.test' },
    });
  });

  it('uses the same generic error for unknown users and incorrect passwords', async () => {
    const { service, prisma, passwords } = makeService();
    prisma.user.findUnique = jest.fn(async () => null) as never;

    await expect(
      service.login({ identifier: 'unknown', password: 'Password123!' }),
    ).rejects.toThrow(genericAuthError);

    prisma.user.findUnique = jest.fn(async () => makeUser()) as never;
    passwords.verify = jest.fn(async () => false) as never;
    await expect(
      service.login({ identifier: 'ada', password: 'wrong' }),
    ).rejects.toThrow(genericAuthError);
  });

  it('rejects suspended and deactivated users after password verification', async () => {
    await expect(
      makeService(makeUser({ status: UserStatus.SUSPENDED })).service.login({
        identifier: 'ada',
        password: 'Password123!',
      }),
    ).rejects.toThrow('temporarily suspended');

    await expect(
      makeService(makeUser({ status: UserStatus.DEACTIVATED })).service.login({
        identifier: 'ada',
        password: 'Password123!',
      }),
    ).rejects.toThrow('disabled');
  });

  it('rotates refresh tokens and rejects stale token versions', async () => {
    const user = makeUser({ refreshTokenHash: 'hashed:old-refresh-token' });
    const { service, prisma, jwtService } = makeService(user);

    await service.refresh('old-refresh-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { refreshTokenHash: 'hashed:refresh-token' },
    });

    jwtService.verifyAsync = jest.fn(async () => ({
      sub: 'user-1',
      tokenType: 'refresh',
      tokenVersion: 2,
    })) as never;
    await expect(service.refresh('old-refresh-token')).rejects.toThrow(
      'Invalid refresh token.',
    );
  });

  it('changes an initial password, clears the flag, and revokes old sessions', async () => {
    const { service, prisma, passwords } = makeService(
      makeUser({ mustChangePassword: true }),
    );

    await service.changeInitialPassword('user-1', {
      currentPassword: 'Password123!',
      newPassword: 'BetterPassword123!',
      confirmPassword: 'BetterPassword123!',
    });

    expect(passwords.validate).toHaveBeenCalledWith(
      'BetterPassword123!',
      expect.objectContaining({ id: 'user-1' }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordHash: 'hashed:BetterPassword123!',
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
        refreshTokenHash: null,
      }),
    });
  });

  it('revokes refresh tokens and increments token version on logout', async () => {
    const { service, prisma } = makeService();

    await service.logout('user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
  });
});
