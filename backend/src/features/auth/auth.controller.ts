import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  ACCESS_COOKIE_NAME,
  AuthService,
  REFRESH_COOKIE_NAME,
} from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangeInitialPasswordDto } from './dto/change-initial-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Sign in with username or email' })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(response, result.tokens);
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Refresh the current cookie session' })
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.readCookie(request, REFRESH_COOKIE_NAME);
    const result = await this.authService.refresh(refreshToken);
    this.setAuthCookies(response, result.tokens);
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Get the authenticated user' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @ApiOperation({
    summary: 'Replace an administrator-issued temporary password',
  })
  @UseGuards(JwtAuthGuard)
  @Post('change-initial-password')
  async changeInitialPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeInitialPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changeInitialPassword(user.id, dto);
    this.setAuthCookies(response, result.tokens);
    return { user: result.user };
  }

  @ApiOperation({ summary: 'End the current cookie session' })
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const accessTokenUser = request.user as AuthenticatedUser | undefined;
    const refreshToken = this.readCookie(request, REFRESH_COOKIE_NAME);
    await this.authService.logout(accessTokenUser?.id, refreshToken);
    this.clearAuthCookies(response);
    return { success: true };
  }

  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const secure = this.configService.get<string>('NODE_ENV') === 'production';
    const commonOptions = {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
      ...commonOptions,
      maxAge: 15 * 60 * 1000,
    });
    response.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...commonOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(response: Response) {
    const secure = this.configService.get<string>('NODE_ENV') === 'production';
    const commonOptions = {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
    };

    response.clearCookie(ACCESS_COOKIE_NAME, commonOptions);
    response.clearCookie(REFRESH_COOKIE_NAME, commonOptions);
  }

  private readCookie(request: Request, cookieName: string): string | undefined {
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    return cookies?.[cookieName];
  }
}
