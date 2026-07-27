import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThemePreference } from '../../generated/prisma/client';
import {
  StorageProviderError,
  StorageService,
} from '../../infrastructure/integrations/storage.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UsersService } from './users.service';

const user = {
  id: 'user-1',
  name: 'Aditya',
  username: 'aditya',
  email: 'aditya@example.com',
  passwordHash: 'secret',
  role: 'STAFF' as const,
  refreshTokenHash: 'refresh-secret',
  isActive: true,
  avatarUrl: null,
  avatarPublicId: null,
  avatarResourceType: null,
  themePreference: ThemePreference.SYSTEM,
  accentColor: null,
  themeColor: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const uploaded = {
  publicId: 'bigu/profile-photos/new-id',
  secureUrl: 'https://res.cloudinary.com/test/image/upload/new-id.jpg',
  resourceType: 'image',
  format: 'jpg',
  bytes: 100,
};

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
    profileFolder: jest.fn(() => 'bigu/profile-photos'),
  };
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage.upload.mockResolvedValue(uploaded);
    storage.delete.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 5_242_880) },
        },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('returns only the safe authenticated profile', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    const result = await service.getMe(user.id);
    expect(result).toMatchObject({ id: user.id, email: user.email });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('refreshTokenHash');
    expect(result).not.toHaveProperty('avatarPublicId');
  });

  it('updates allowed fields for the supplied authenticated id', async () => {
    prisma.user.update.mockResolvedValue({ ...user, name: 'New Name' });
    await expect(
      service.updateMe(user.id, { name: 'New Name' }),
    ).resolves.toMatchObject({ name: 'New Name' });
  });

  it('maps duplicate usernames to a safe conflict', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.updateMe(user.id, { username: 'taken' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['image/jpeg', 'photo.jpg', Buffer.from([0xff, 0xd8, 0xff])],
    [
      'image/png',
      'photo.png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ['image/webp', 'photo.webp', Buffer.from('RIFFxxxxWEBP')],
  ])(
    'uploads valid %s avatars to the configured profile folder',
    async (mimetype, originalname, buffer) => {
      prisma.user.findUnique.mockResolvedValue({
        avatarUrl: null,
        avatarPublicId: null,
        avatarResourceType: null,
      });
      prisma.user.update.mockResolvedValue({
        ...user,
        avatarUrl: uploaded.secureUrl,
        avatarPublicId: uploaded.publicId,
        avatarResourceType: 'image',
      });
      await service.uploadAvatar(user.id, {
        mimetype,
        originalname,
        buffer,
        size: buffer.length,
      } as Express.Multer.File);
      expect(storage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'bigu/profile-photos',
          resourceType: 'image',
          transformation: 'profile-square',
        }),
      );
    },
  );

  it('rejects unsupported avatar data before upload', async () => {
    const file = {
      mimetype: 'image/gif',
      originalname: 'photo.gif',
      buffer: Buffer.from('GIF89a'),
      size: 6,
    } as Express.Multer.File;
    await expect(service.uploadAvatar(user.id, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('deletes the previous Cloudinary avatar only after replacement succeeds', async () => {
    prisma.user.findUnique.mockResolvedValue({
      avatarUrl: 'https://res.cloudinary.com/old.jpg',
      avatarPublicId: 'bigu/profile-photos/old-id',
      avatarResourceType: 'image',
    });
    prisma.user.update.mockResolvedValue({
      ...user,
      avatarUrl: uploaded.secureUrl,
    });
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);
    await service.uploadAvatar(user.id, {
      mimetype: 'image/jpeg',
      originalname: 'photo.jpg',
      buffer,
      size: buffer.length,
    } as Express.Multer.File);
    expect(storage.delete).toHaveBeenCalledWith(
      'bigu/profile-photos/old-id',
      'image',
    );
    expect(prisma.user.update.mock.invocationCallOrder[0]).toBeLessThan(
      storage.delete.mock.invocationCallOrder[0],
    );
  });

  it('maps provider upload failures to a safe error', async () => {
    prisma.user.findUnique.mockResolvedValue({
      avatarUrl: null,
      avatarPublicId: null,
      avatarResourceType: null,
    });
    storage.upload.mockRejectedValue(new StorageProviderError('upload', 500));
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);
    await expect(
      service.uploadAvatar(user.id, {
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        buffer,
        size: buffer.length,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('updates the saved theme preference', async () => {
    prisma.user.update.mockResolvedValue({
      ...user,
      themePreference: ThemePreference.DARK,
    });
    await expect(
      service.updateTheme(user.id, ThemePreference.DARK),
    ).resolves.toMatchObject({ themePreference: ThemePreference.DARK });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { themePreference: ThemePreference.DARK },
    });
  });

  it('updates only the normalized accent color for the authenticated user', async () => {
    prisma.user.update.mockResolvedValue({
      ...user,
      accentColor: '#2563EB',
    });
    await expect(
      service.updateAppearance(user.id, { accentColor: '#2563eb' }),
    ).resolves.toMatchObject({
      accentColor: '#2563EB',
      themePreference: ThemePreference.SYSTEM,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { accentColor: '#2563EB' },
    });
  });
  it('updates or resets the theme surface color without changing the accent', async () => {
    prisma.user.update.mockResolvedValue({ ...user, themeColor: '#0D9488' });
    await service.updateAppearance(user.id, { themeColor: '#0d9488' });
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: user.id },
      data: { themeColor: '#0D9488' },
    });

    prisma.user.update.mockResolvedValue(user);
    await service.updateAppearance(user.id, { themeColor: null });
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: user.id },
      data: { themeColor: null },
    });
  });
  it('rejects oversized avatars before accessing storage', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);
    await expect(
      service.uploadAvatar(user.id, {
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        buffer,
        size: 5_242_881,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('clears and deletes an existing avatar by public id', async () => {
    prisma.user.findUnique.mockResolvedValue({
      avatarUrl: 'https://res.cloudinary.com/old.jpg',
      avatarPublicId: 'bigu/profile-photos/old-id',
      avatarResourceType: 'image',
    });
    prisma.user.update.mockResolvedValue(user);
    await service.removeAvatar(user.id);
    expect(storage.delete).toHaveBeenCalledWith(
      'bigu/profile-photos/old-id',
      'image',
    );
  });
});
