/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatus } from '../../generated/prisma/client';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function makeResponse() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

function makeRequest(cookies: Record<string, string> = {}) {
  return { cookies } as unknown as Request;
}

describe('AuthController', () => {
  let controller: AuthController;
  let nodeEnv = 'test';
  const safeUser = {
    id: 'user-1',
    name: 'Aditya',
    username: 'aditya',
    email: 'adityaxsetia@gmail.com',
    role: 'ADMIN' as const,
    designation: null,
    status: UserStatus.ACTIVE,
    isActive: true,
    mustChangePassword: false,
    tokenVersion: 1,
  };
  const authService = {
    login: jest.fn(),
    refresh: jest.fn(),
    changeInitialPassword: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    nodeEnv = 'test';
    const authResult = {
      user: safeUser,
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    };
    authService.login.mockResolvedValue(authResult);
    authService.refresh.mockResolvedValue(authResult);
    authService.changeInitialPassword.mockResolvedValue(authResult);
    authService.logout.mockResolvedValue({ success: true });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'NODE_ENV' ? nodeEnv : undefined,
            ),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('passes identifier login payload to AuthService and sets auth cookies', async () => {
    const response = makeResponse();
    const dto = { identifier: 'aditya', password: 'Password123!' };

    await expect(controller.login(dto, response)).resolves.toEqual({
      user: safeUser,
    });
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_COOKIE_NAME,
      'access-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });

  it('sets cross-site compatible secure cookies in production', async () => {
    nodeEnv = 'production';
    const response = makeResponse();
    const dto = { identifier: 'aditya', password: 'Password123!' };

    await controller.login(dto, response);

    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_COOKIE_NAME,
      'access-token',
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
  });
  it('refreshes from the refresh cookie', async () => {
    const response = makeResponse();

    await expect(
      controller.refresh(
        makeRequest({ [REFRESH_COOKIE_NAME]: 'refresh-token' }),
        response,
      ),
    ).resolves.toEqual({ user: safeUser });
    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
  });

  it('changes an initial password for the authenticated user', async () => {
    const response = makeResponse();
    const dto = {
      currentPassword: 'Password123!',
      newPassword: 'BetterPassword123!',
      confirmPassword: 'BetterPassword123!',
    };

    await expect(
      controller.changeInitialPassword(safeUser, dto, response),
    ).resolves.toEqual({ user: safeUser });
    expect(authService.changeInitialPassword).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
  });

  it('logs out with the refresh cookie fallback and clears cookies', async () => {
    const response = makeResponse();

    await expect(
      controller.logout(
        makeRequest({ [REFRESH_COOKIE_NAME]: 'refresh-token' }),
        response,
      ),
    ).resolves.toEqual({ success: true });
    expect(authService.logout).toHaveBeenCalledWith(undefined, 'refresh-token');
    expect(response.clearCookie).toHaveBeenCalledWith(
      ACCESS_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });

  it('uses JwtAuthGuard to protect /auth/me and initial password changes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, controller.me)).toEqual([
      JwtAuthGuard,
    ]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, controller.changeInitialPassword),
    ).toEqual([JwtAuthGuard]);
  });
});
