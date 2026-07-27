/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    getOrThrow: jest.fn(() => 'test-access-secret'),
  } as unknown as ConfigService;

  const activeUser = {
    id: 'user-1',
    name: 'Aditya',
    username: 'aditya',
    email: 'adityaxsetia@gmail.com',
    role: Role.ADMIN,
    designation: null,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
    tokenVersion: 4,
  };

  function makeStrategy(user: object | null = activeUser) {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => user),
      },
    } as unknown as PrismaService;

    return {
      strategy: new JwtStrategy(configService, prisma),
      prisma,
    };
  }

  it('returns a safe authenticated user including status and token version', async () => {
    const { strategy, prisma } = makeStrategy();

    await expect(
      strategy.validate({
        sub: 'user-1',
        username: 'aditya',
        email: 'adityaxsetia@gmail.com',
        role: Role.ADMIN,
        tokenVersion: 4,
      }),
    ).resolves.toEqual({
      ...activeUser,
      isActive: true,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        designation: true,
        status: true,
        mustChangePassword: true,
        tokenVersion: true,
      },
    });
  });

  it('rejects missing, non-active, and stale-token users', async () => {
    const payload = {
      sub: 'user-1',
      username: 'aditya',
      email: 'adityaxsetia@gmail.com',
      role: Role.ADMIN,
      tokenVersion: 4,
    };

    await expect(makeStrategy(null).strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      makeStrategy({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      }).strategy.validate(payload),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      makeStrategy(activeUser).strategy.validate({
        ...payload,
        tokenVersion: 3,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
