import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import {
  ThemePreference,
  UserStatus,
  type User,
} from '../../generated/prisma/client';
import {
  StorageProviderError,
  StorageService,
} from '../../infrastructure/integrations/storage.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAppearanceDto } from './dto/update-appearance.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User account was not found.');
    return this.toPublicProfile(user);
  }

  activeAssignees() {
    return this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: { id: true, name: true, username: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const data: { name?: string; username?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.username !== undefined) data.username = dto.username.toLowerCase();
    try {
      return this.toPublicProfile(
        await this.prisma.user.update({ where: { id: userId }, data }),
      );
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('That username is already in use.');
      }
      throw error;
    }
  }

  async updateTheme(userId: string, themePreference: ThemePreference) {
    return this.toPublicProfile(
      await this.prisma.user.update({
        where: { id: userId },
        data: { themePreference },
      }),
    );
  }

  async updateAppearance(userId: string, dto: UpdateAppearanceDto) {
    const data: { accentColor?: string; themeColor?: string | null } = {};
    if (dto.accentColor !== undefined) {
      data.accentColor = dto.accentColor.toUpperCase();
    }
    if (dto.themeColor !== undefined) {
      data.themeColor = dto.themeColor?.toUpperCase() ?? null;
    }
    return this.toPublicProfile(
      await this.prisma.user.update({
        where: { id: userId },
        data,
      }),
    );
  }
  async uploadAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose an image to upload.');
    const max = this.config.get<number>('USER_AVATAR_MAX_BYTES', 5_242_880);
    if (file.size > max) {
      throw new BadRequestException('Avatar must be no larger than 5 MB.');
    }
    this.validateAvatar(file);
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarUrl: true,
        avatarPublicId: true,
        avatarResourceType: true,
      },
    });
    if (!current) throw new NotFoundException('User account was not found.');

    let uploaded;
    try {
      uploaded = await this.storage.upload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: this.storage.profileFolder(),
        resourceType: 'image',
        transformation: 'profile-square',
      });
    } catch (error: unknown) {
      if (error instanceof StorageProviderError) {
        throw new ServiceUnavailableException(
          'The profile image could not be uploaded. Please try again.',
        );
      }
      throw error;
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: uploaded.secureUrl,
          avatarPublicId: uploaded.publicId,
          avatarResourceType: uploaded.resourceType,
        },
      });
      if (current.avatarPublicId) {
        await this.storage
          .delete(
            current.avatarPublicId,
            current.avatarResourceType === 'raw' ? 'raw' : 'image',
          )
          .catch(() => undefined);
      }
      return this.toPublicProfile(user);
    } catch (error: unknown) {
      await this.storage
        .delete(uploaded.publicId, 'image')
        .catch(() => undefined);
      throw error;
    }
  }

  async removeAvatar(userId: string) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarUrl: true,
        avatarPublicId: true,
        avatarResourceType: true,
      },
    });
    if (!current) throw new NotFoundException('User account was not found.');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarPublicId: null,
        avatarResourceType: null,
      },
    });
    if (current.avatarPublicId) {
      await this.storage
        .delete(
          current.avatarPublicId,
          current.avatarResourceType === 'raw' ? 'raw' : 'image',
        )
        .catch(() => undefined);
    }
    return this.toPublicProfile(user);
  }

  private validateAvatar(file: Express.Multer.File) {
    const extension = extname(file.originalname).toLowerCase();
    const jpeg =
      file.mimetype === 'image/jpeg' &&
      ['.jpg', '.jpeg'].includes(extension) &&
      file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png =
      file.mimetype === 'image/png' &&
      extension === '.png' &&
      file.buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp =
      file.mimetype === 'image/webp' &&
      extension === '.webp' &&
      file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!jpeg && !png && !webp) {
      throw new BadRequestException(
        'Avatar must be a valid JPG, PNG, or WebP image.',
      );
    }
  }

  private toPublicProfile(user: User) {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.status === UserStatus.ACTIVE,
      avatarUrl: user.avatarUrl,
      themePreference: user.themePreference,
      accentColor: user.accentColor,
      themeColor: user.themeColor,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
