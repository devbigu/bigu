import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { UserStatus } from '../../../generated/prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const ACCESS_COOKIE_NAME = 'bigu_access_token';

type JwtPayload = {
  sub: string;
  email: string;
  username: string;
  role: AuthenticatedUser['role'];
  tokenVersion: number;
};

function extractAccessToken(request: Request): string | null {
  const cookies = request.cookies as
    Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_COOKIE_NAME] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractAccessToken]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    if (
      user?.status !== UserStatus.ACTIVE ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('Authentication is required.');
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      designation: user.designation,
      status: user.status,
      isActive: true,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    };
  }
}
