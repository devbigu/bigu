import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import {
  AccountAuditAction,
  User,
  UserStatus,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { accountAuditData } from '../../common/audit/account-audit';
import { PasswordService } from '../../common/security/password.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ChangeInitialPasswordDto } from './dto/change-initial-password.dto';
import { LoginDto } from './dto/login.dto';

export const ACCESS_COOKIE_NAME = 'bigu_access_token';
export const REFRESH_COOKIE_NAME = 'bigu_refresh_token';

const GENERIC_LOGIN_ERROR = 'Invalid username or email or password.';

export type RequestMetadata = {
  ipAddress?: string;
  userAgentSummary?: string;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type AuthResult = {
  user: AuthenticatedUser;
  tokens: TokenPair;
};

type RefreshPayload = {
  sub: string;
  tokenType: 'refresh';
  tokenVersion: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwords: PasswordService,
  ) {}

  async login(
    dto: LoginDto,
    metadata: RequestMetadata = {},
  ): Promise<AuthResult> {
    const identifier = dto.identifier.trim();
    const isEmailIdentifier = identifier.includes('@');
    const where = isEmailIdentifier
      ? { email: this.normalizeEmail(identifier) }
      : { username: this.normalizeUsername(identifier) };
    const user = await this.prisma.user.findUnique({ where });
    if (!user) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const passwordMatches = await this.passwords.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) {
      await this.prisma.accountAuditEvent
        .create({
          data: accountAuditData({
            targetUserId: user.id,
            action: AccountAuditAction.LOGIN_FAILED,
            ...metadata,
          }),
        })
        .catch(() => undefined);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        user.status === UserStatus.DEACTIVATED
          ? 'Your access to BigU has been disabled. Contact your administrator.'
          : 'Your access to BigU is temporarily suspended. Contact your administrator.',
      );
    }

    const loggedInUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor: updated,
          targetUserId: updated.id,
          action: AccountAuditAction.LOGIN_SUCCEEDED,
          ...metadata,
        }),
      });
      return updated;
    });
    return this.issueAndStoreTokens(loggedInUser);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !user.refreshTokenHash ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    const tokenMatches = await this.passwords.verify(
      user.refreshTokenHash,
      refreshToken,
    );
    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    return this.issueAndStoreTokens(user);
  }

  async changeInitialPassword(
    userId: string,
    dto: ChangeInitialPasswordDto,
    metadata: RequestMetadata = {},
  ): Promise<AuthResult> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password confirmation does not match.',
      );
    }
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!current || current.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Authentication is required.');
    }
    if (!current.mustChangePassword) {
      throw new ConflictException(
        'An initial password change is not required for this account.',
      );
    }
    const currentMatches = await this.passwords.verify(
      current.passwordHash,
      dto.currentPassword,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    this.passwords.validate(dto.newPassword, current);
    const passwordHash = await this.passwords.hash(dto.newPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
          refreshTokenHash: null,
        },
      });
      await tx.accountAuditEvent.create({
        data: accountAuditData({
          actor: result,
          targetUserId: userId,
          action: AccountAuditAction.INITIAL_PASSWORD_CHANGED,
          newValue: { mustChangePassword: false },
          ...metadata,
        }),
      });
      return result;
    });
    return this.issueAndStoreTokens(updated);
  }

  async logout(
    userId?: string,
    refreshToken?: string,
  ): Promise<{ success: true }> {
    const resolvedUserId =
      userId ?? (await this.getUserIdFromRefreshToken(refreshToken));
    if (resolvedUserId) {
      await this.prisma.user
        .update({
          where: { id: resolvedUserId },
          data: {
            refreshTokenHash: null,
            tokenVersion: { increment: 1 },
          },
        })
        .catch(() => undefined);
    }
    return { success: true };
  }

  toSafeUser(
    user: Pick<
      User,
      | 'id'
      | 'name'
      | 'username'
      | 'email'
      | 'role'
      | 'designation'
      | 'status'
      | 'mustChangePassword'
      | 'tokenVersion'
    >,
  ): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      designation: user.designation,
      status: user.status,
      isActive: user.status === UserStatus.ACTIVE,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    };
  }

  private async issueAndStoreTokens(user: User): Promise<AuthResult> {
    const safeUser = this.toSafeUser(user);
    const tokens = await this.signTokens(safeUser);
    const refreshTokenHash = String(
      await this.passwords.hash(tokens.refreshToken),
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });
    return { user: safeUser, tokens };
  }

  private async getUserIdFromRefreshToken(
    refreshToken: string | undefined,
  ): Promise<string | undefined> {
    if (!refreshToken) return undefined;
    try {
      const payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
      return payload.tokenType === 'refresh' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }

  private async signTokens(user: AuthenticatedUser): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ) as JwtSignOptions['expiresIn'],
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        tokenType: 'refresh',
        tokenVersion: user.tokenVersion,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as JwtSignOptions['expiresIn'],
      },
    );
    return { accessToken, refreshToken };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }
}
