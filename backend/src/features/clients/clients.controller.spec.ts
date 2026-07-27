import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

describe('ClientsController', () => {
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
  };
  const controller = new ClientsController(
    service as unknown as ClientsService,
  );

  it('protects every client route with JWT authentication', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ClientsController)).toContain(
      JwtAuthGuard,
    );
  });

  it('uses user.id as createdBy and delegates all actions', async () => {
    await controller.create(
      { name: 'Acme' },
      {
        id: 'user-1',
        name: 'User',
        username: 'user',
        email: 'u@example.com',
        role: 'STAFF',
        designation: null,
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
        tokenVersion: 1,
      },
    );
    expect(service.create).toHaveBeenCalledWith({ name: 'Acme' }, 'user-1');
    await controller.findAll({});
    await controller.findOne('1');
    await controller.update('1', { name: 'New' });
    await controller.archive('1');
    await controller.restore('1');
    expect(service.findAll).toHaveBeenCalled();
    expect(service.findOne).toHaveBeenCalledWith('1');
    expect(service.update).toHaveBeenCalled();
    expect(service.archive).toHaveBeenCalledWith('1');
    expect(service.restore).toHaveBeenCalledWith('1');
  });
});
