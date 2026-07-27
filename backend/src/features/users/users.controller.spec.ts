import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const service = {
    getMe: jest.fn(),
    updateMe: jest.fn(),
    updateTheme: jest.fn(),
    updateAppearance: jest.fn(),
    uploadAvatar: jest.fn(),
    removeAvatar: jest.fn(),
  };
  const controller = new UsersController(service as unknown as UsersService);
  const authenticated = {
    id: 'authenticated-user',
    name: 'User',
    username: 'user',
    email: 'user@example.com',
    role: 'STAFF' as const,
    designation: null,
    status: 'ACTIVE' as const,
    isActive: true,
    mustChangePassword: false,
    tokenVersion: 1,
  };

  it('protects every profile route with the JWT guard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      UsersController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('derives the profile id from the authenticated user', async () => {
    await controller.updateMe(authenticated, { name: 'Updated' });
    expect(service.updateMe).toHaveBeenCalledWith(authenticated.id, {
      name: 'Updated',
    });
  });

  it('derives the appearance owner from the authenticated request', async () => {
    await controller.updateAppearance(authenticated, {
      accentColor: '#2563EB',
    });
    expect(service.updateAppearance).toHaveBeenCalledWith(authenticated.id, {
      accentColor: '#2563EB',
    });
  });
});
