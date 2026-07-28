import { Role, UserStatus } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { SpreadsheetsService } from './spreadsheets.service';

describe('SpreadsheetsService', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    role: Role.ADMIN,
    designation: null,
    status: UserStatus.ACTIVE,
    isActive: true,
    mustChangePassword: false,
    tokenVersion: 1,
  };

  function createService() {
    const project = {
      id: 'project-1',
      title: 'Launch Plan',
      projectType: 'SEO_MANAGEMENT',
      growthObjective: 'Increase qualified leads',
      platforms: ['Google'],
      startDate: null,
      endDate: null,
      status: 'ACTIVE',
      updatedAt: new Date('2026-07-28T00:00:00.000Z'),
      client: { name: 'Acme' },
      assignedUser: { name: 'JoJo' },
      changeRequests: [],
      files: [],
      researchBrief: null,
      researchCompetitors: [],
      researchReferences: [],
      researchFindings: [],
      marketingStrategy: null,
    };
    const prisma = {
      project: {
        findFirst: jest.fn(async () => ({ id: project.id })),
        findUniqueOrThrow: jest.fn(async () => project),
      },
    };
    const provider = { isConfigured: jest.fn(() => false) };
    const service = new SpreadsheetsService(
      prisma as never,
      provider as never,
    );
    return { service, prisma };
  }

  it('exports a project workbook buffer', async () => {
    const { service, prisma } = createService();

    const exported = await service.exportProject('project-1', user);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      select: { id: true },
    });
    expect(exported.fileName).toBe('Launch-Plan-BigU-export.xlsx');
    expect(exported.buffer).toBeInstanceOf(Buffer);
    expect(exported.buffer.byteLength).toBeGreaterThan(0);
    expect(exported.buffer.subarray(0, 2).toString()).toBe('PK');
  });
});