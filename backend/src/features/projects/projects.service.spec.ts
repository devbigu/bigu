import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ClientStatus,
  ProjectStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { ProjectsService } from './projects.service';
import { SopPolicyService } from './sop-policy.service';
import { SopConfigurationError } from './sop-policy.types';

const dto = {
  clientId: '11111111-1111-4111-8111-111111111111',
  title: 'Launch Plan',
  projectType: 'SOCIAL_MEDIA_MANAGEMENT' as const,
  growthObjective: 'Grow reach',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
};

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    ...dto,
    assignedUserId: 'user-1',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-31T00:00:00.000Z'),
    status: ProjectStatus.DRAFT,
    sopVersionId: 'sop-1',
    conversation: { id: 'conversation-1' },
    files: [{ id: 'file-1' }],
    sopState: { id: 'sop-state-1' },
    spreadsheetWorksheet: { id: 'worksheet-1' },
    client: { id: dto.clientId, status: ClientStatus.ACTIVE },
    assignedUser: {
      id: 'user-1',
      name: 'Ada',
      username: 'ada',
      email: 'ada@bigu.test',
    },
    ...overrides,
  };
}

function makeModule() {
  const transactionProject = {
    create: jest.fn(async ({ data }) => project(data)),
    findUniqueOrThrow: jest.fn(async () => project()),
  };
  const transaction = { project: transactionProject };
  const prisma = {
    client: {
      findUnique: jest.fn(async () => ({
        id: dto.clientId,
        status: ClientStatus.ACTIVE,
      })),
    },
    user: {
      findUnique: jest.fn(async () => ({
        id: 'user-1',
        status: UserStatus.ACTIVE,
      })),
    },
    project: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => project()),
      update: jest.fn(async ({ data }) => project(data)),
    },
    $transaction: jest.fn(async (callback) => callback(transaction)),
  } as unknown as jest.Mocked<PrismaService>;
  const spreadsheets = {
    queueProjectProvision: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<SpreadsheetsService>;
  const sopPolicies = {
    attachLatest: jest.fn(async () => ({ id: 'sop-1' })),
  } as unknown as jest.Mocked<SopPolicyService>;

  return { prisma, spreadsheets, sopPolicies, transactionProject };
}

describe('ProjectsService', () => {
  let service: ProjectsService;
  let deps: ReturnType<typeof makeModule>;

  beforeEach(async () => {
    deps = makeModule();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: deps.prisma },
        { provide: SpreadsheetsService, useValue: deps.spreadsheets },
        { provide: SopPolicyService, useValue: deps.sopPolicies },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('creates a project for an active client, attaches SOP, and queues worksheet provisioning', async () => {
    await expect(service.create(dto, 'user-1')).resolves.toMatchObject({
      id: 'project-1',
      clientId: dto.clientId,
      assignedUserId: 'user-1',
    });

    expect(deps.transactionProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: dto.clientId,
        title: 'Launch Plan',
        assignedUserId: 'user-1',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-31T00:00:00.000Z'),
      }),
    });
    expect(deps.sopPolicies.attachLatest).toHaveBeenCalledWith(
      expect.any(Object),
      'project-1',
      dto.projectType,
    );
    expect(deps.spreadsheets.queueProjectProvision).toHaveBeenCalledWith(
      'project-1',
      'user-1',
    );
  });

  it('rejects missing and archived clients', async () => {
    deps.prisma.client.findUnique = jest.fn(async () => null) as never;
    await expect(service.create(dto, 'user-1')).rejects.toThrow(
      NotFoundException,
    );

    deps.prisma.client.findUnique = jest.fn(async () => ({
      id: dto.clientId,
      status: ClientStatus.ARCHIVED,
    })) as never;
    await expect(service.create(dto, 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects inactive assignees and invalid date ranges', async () => {
    deps.prisma.user.findUnique = jest.fn(async () => ({
      id: 'user-1',
      status: UserStatus.SUSPENDED,
    })) as never;
    await expect(service.create(dto, 'user-1')).rejects.toThrow(
      NotFoundException,
    );

    deps.prisma.user.findUnique = jest.fn(async () => ({
      id: 'user-1',
      status: UserStatus.ACTIVE,
    })) as never;
    await expect(
      service.create(
        { ...dto, startDate: '2026-09-01', endDate: '2026-08-01' },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('maps SOP configuration failures to service unavailable and does not queue provisioning', async () => {
    deps.sopPolicies.attachLatest = jest.fn(async () => {
      throw new SopConfigurationError('No published SOP.');
    }) as never;

    await expect(service.create(dto, 'user-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(deps.spreadsheets.queueProjectProvision).not.toHaveBeenCalled();
  });

  it('lists active projects by default and includes explicit filters', async () => {
    await service.findAll({});
    expect(deps.prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: ProjectStatus.ARCHIVED } },
      }),
    );

    await service.findAll({
      clientId: dto.clientId,
      status: ProjectStatus.ACTIVE,
      search: 'launch',
      assignedUserId: 'user-1',
      projectType: 'SOCIAL_MEDIA_MANAGEMENT',
      month: 8,
      year: 2026,
    });
    expect(deps.prisma.project.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: dto.clientId,
          assignedUserId: 'user-1',
          projectType: 'SOCIAL_MEDIA_MANAGEMENT',
          month: 8,
          year: 2026,
          status: ProjectStatus.ACTIVE,
          OR: expect.any(Array),
        }),
      }),
    );

    await service.findAll({ status: ProjectStatus.ARCHIVED });
    expect(deps.prisma.project.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: ProjectStatus.ARCHIVED } }),
    );

    await service.findAll({ status: 'ALL' });
    expect(deps.prisma.project.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('throws not found for a missing project detail', async () => {
    deps.prisma.project.findUnique = jest.fn(async () => null) as never;

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates only explicit editable project fields', async () => {
    await expect(
      service.update('project-1', {
        title: 'Updated Plan',
        growthObjective: 'Improve retention',
        platforms: ['linkedin'],
        startDate: '2026-08-02',
        endDate: '2026-08-30',
        month: 8,
        year: 2026,
        assignedUserId: 'user-2',
        contentTarget: 18,
      }),
    ).resolves.toMatchObject({
      title: 'Updated Plan',
      assignedUserId: 'user-2',
    });

    expect(deps.prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: 'user-2' },
      select: { id: true, status: true },
    });
    expect(deps.prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        title: 'Updated Plan',
        growthObjective: 'Improve retention',
        platforms: ['linkedin'],
        startDate: new Date('2026-08-02T00:00:00.000Z'),
        endDate: new Date('2026-08-30T00:00:00.000Z'),
        month: 8,
        year: 2026,
        assignedUserId: 'user-2',
        contentTarget: 18,
      },
      include: expect.any(Object),
    });
  });

  it('preserves omitted project fields during partial updates', async () => {
    await service.update('project-1', { title: 'Only Title' });

    expect(deps.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: 'Only Title' },
      }),
    );
  });

  it('rejects missing and inactive update assignees', async () => {
    deps.prisma.user.findUnique = jest.fn(async () => null) as never;
    await expect(
      service.update('project-1', {
        assignedUserId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow(NotFoundException);

    deps.prisma.user.findUnique = jest.fn(async () => ({
      id: 'user-2',
      status: UserStatus.SUSPENDED,
    })) as never;
    await expect(
      service.update('project-1', {
        assignedUserId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects invalid update date ranges using current and supplied dates', async () => {
    await expect(
      service.update('project-1', { startDate: '2026-09-01' }),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.update('project-1', { endDate: '2026-07-01' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws not found for missing project updates', async () => {
    deps.prisma.project.findUnique = jest.fn(async () => null) as never;

    await expect(service.update('missing', { title: 'Nope' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('enforces valid status transitions', async () => {
    deps.prisma.project.findUnique = jest.fn(async () => ({
      id: 'project-1',
      status: ProjectStatus.DRAFT,
    })) as never;

    await expect(
      service.updateStatus('project-1', ProjectStatus.ACTIVE),
    ).resolves.toMatchObject({ status: ProjectStatus.ACTIVE });
    expect(deps.prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: ProjectStatus.ACTIVE },
      include: expect.any(Object),
    });
  });

  it('rejects invalid status transitions', async () => {
    deps.prisma.project.findUnique = jest.fn(async () => ({
      id: 'project-1',
      status: ProjectStatus.DRAFT,
    })) as never;

    await expect(
      service.updateStatus('project-1', ProjectStatus.COMPLETED),
    ).rejects.toThrow(ConflictException);
  });

  it('archives and restores without creating related records', async () => {
    deps.prisma.project.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'project-1', status: ProjectStatus.ACTIVE })
      .mockResolvedValueOnce({
        id: 'project-1',
        status: ProjectStatus.ARCHIVED,
        conversation: { id: 'conversation-1' },
        sopState: { id: 'sop-state-1' },
        spreadsheetWorksheet: { id: 'worksheet-1' },
        spreadsheetSyncJobs: [{ id: 'sync-1' }],
      }) as never;

    await service.archive('project-1');
    await service.restore('project-1');

    expect(deps.prisma.project.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'project-1' },
      data: { status: ProjectStatus.ARCHIVED },
      include: expect.any(Object),
    });
    expect(deps.prisma.project.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'project-1' },
      data: { status: ProjectStatus.ACTIVE },
      include: expect.any(Object),
    });
    expect(deps.spreadsheets.queueProjectProvision).not.toHaveBeenCalled();
  });

  it('does not send relationship fields in the update payload', async () => {
    await service.update('project-1', { title: 'Relationship Safe' });

    const call = (deps.prisma.project.update as jest.Mock).mock.calls[0][0];
    expect(call.data).not.toHaveProperty('clientId');
    expect(call.data).not.toHaveProperty('sopVersionId');
    expect(call.data).not.toHaveProperty('conversation');
    expect(call.data).not.toHaveProperty('files');
    expect(call.data).not.toHaveProperty('sopState');
    expect(call.data).not.toHaveProperty('spreadsheetWorksheet');
    expect(deps.spreadsheets.queueProjectProvision).not.toHaveBeenCalled();
  });
});
