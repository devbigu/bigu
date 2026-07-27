import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProjectStatus } from '../../generated/prisma/client';
import { AiOrchestrator } from '../../infrastructure/ai/ai-orchestrator.service';
import { AiService } from '../../infrastructure/integrations/ai.service';
import { StorageService } from '../../infrastructure/integrations/storage.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SpreadsheetsService } from '../spreadsheets/spreadsheets.service';
import { ProjectWorkspaceService } from './project-workspace.service';
import { SopPolicyService } from './sop-policy.service';

function makeProject(status: ProjectStatus) {
  return {
    id: 'project-1',
    title: 'Launch Plan',
    clientId: 'client-1',
    status,
    projectType: 'SOCIAL_MEDIA_MANAGEMENT',
    growthObjective: null,
    platforms: [],
    startDate: null,
    endDate: null,
    month: null,
    year: null,
    contentTarget: null,
    assignedUser: null,
    client: { id: 'client-1', name: 'Acme', status: 'ACTIVE' },
  };
}

describe('ProjectWorkspaceService archive guards', () => {
  let service: ProjectWorkspaceService;
  let prisma: {
    project: { findUnique: jest.Mock };
    message: { create: jest.Mock };
  };
  let storage: { upload: jest.Mock };

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(async () => makeProject(ProjectStatus.ARCHIVED)),
      },
      message: { create: jest.fn() },
    };
    storage = { upload: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectWorkspaceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: {} },
        { provide: AiOrchestrator, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, fallback?: unknown) => fallback),
          },
        },
        { provide: SopPolicyService, useValue: {} },
        { provide: SpreadsheetsService, useValue: {} },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(ProjectWorkspaceService);
  });

  it('blocks new chat messages for archived projects before creating messages', async () => {
    await expect(service.send('project-1', 'hello', 'user-1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('blocks file uploads for archived projects before provider upload', async () => {
    const file = {
      originalname: 'brief.txt',
      mimetype: 'text/plain',
      size: 12,
      buffer: Buffer.from('hello'),
    } as Express.Multer.File;

    await expect(service.upload('project-1', file, 'user-1')).rejects.toThrow(
      ConflictException,
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
