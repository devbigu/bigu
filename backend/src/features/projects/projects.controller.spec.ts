import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStatus, Role, UserStatus } from '../../generated/prisma/client';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    archive: jest.Mock;
    restore: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: service }],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates projects for the authenticated user', async () => {
    const dto = {
      clientId: '11111111-1111-4111-8111-111111111111',
      title: 'Launch Plan',
      projectType: 'SOCIAL_MEDIA_MANAGEMENT' as const,
    };
    service.create.mockResolvedValue({ id: 'project-1' });

    await expect(
      controller.create(dto, {
        id: 'user-1',
        name: 'Ada',
        username: 'ada',
        email: 'ada@bigu.test',
        role: Role.STAFF,
        designation: null,
        status: UserStatus.ACTIVE,
        isActive: true,
        mustChangePassword: false,
        tokenVersion: 0,
      }),
    ).resolves.toEqual({ id: 'project-1' });
    expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('updates projects through the service', async () => {
    const dto = { title: 'Updated Plan' };
    service.update.mockResolvedValue({ id: 'project-1', ...dto });

    await expect(controller.update('project-1', dto)).resolves.toEqual({
      id: 'project-1',
      ...dto,
    });
    expect(service.update).toHaveBeenCalledWith('project-1', dto);
  });

  it('changes status, archives, and restores through lifecycle routes', async () => {
    service.updateStatus.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.ACTIVE,
    });
    service.archive.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.ARCHIVED,
    });
    service.restore.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.ACTIVE,
    });

    await expect(
      controller.updateStatus('project-1', { status: ProjectStatus.ACTIVE }),
    ).resolves.toMatchObject({ status: ProjectStatus.ACTIVE });
    await expect(controller.archive('project-1')).resolves.toMatchObject({
      status: ProjectStatus.ARCHIVED,
    });
    await expect(controller.restore('project-1')).resolves.toMatchObject({
      status: ProjectStatus.ACTIVE,
    });
    expect(service.updateStatus).toHaveBeenCalledWith(
      'project-1',
      ProjectStatus.ACTIVE,
    );
    expect(service.archive).toHaveBeenCalledWith('project-1');
    expect(service.restore).toHaveBeenCalledWith('project-1');
  });

  it('propagates update service errors', async () => {
    service.update.mockRejectedValue(
      new NotFoundException('Project not found.'),
    );

    await expect(
      controller.update('missing', { title: 'Nope' }),
    ).rejects.toThrow(NotFoundException);
  });
});
