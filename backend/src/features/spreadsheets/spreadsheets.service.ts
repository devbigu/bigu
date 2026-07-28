import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  SpreadsheetSyncOperation,
  SpreadsheetSyncStatus,
} from '../../generated/prisma/client';
import {
  neutralizeSpreadsheetValue,
  SPREADSHEET_PROVIDER,
  SpreadsheetProviderNotConfiguredError,
} from '../../infrastructure/integrations/spreadsheet-provider.interface';
import type { SpreadsheetProvider } from '../../infrastructure/integrations/spreadsheet-provider.interface';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  buildClientOverviewLayout,
  buildProjectLayout,
  buildSyncLogLayout,
} from './spreadsheet-layout';
import type { SpreadsheetRowDescriptor } from './spreadsheet-layout';

@Injectable()
export class SpreadsheetsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SPREADSHEET_PROVIDER)
    private readonly provider: SpreadsheetProvider,
  ) {}

  async queueProjectProvision(projectId: string, requestedById: string) {
    return this.queueProjectSync(
      projectId,
      'PROJECT_CREATED',
      projectId,
      requestedById,
      SpreadsheetSyncOperation.PROVISION,
    );
  }

  async queueProjectSync(
    projectId: string,
    sourceType: string,
    sourceId: string,
    requestedById?: string,
    operation: SpreadsheetSyncOperation = SpreadsheetSyncOperation.SYNC_PROJECT,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        clientId: true,
        updatedAt: true,
        client: { select: { id: true, name: true, createdById: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');

    return this.prisma.$transaction(async (transaction) => {
      const workbook = await transaction.spreadsheetWorkbook.upsert({
        where: { activeClientKey: project.clientId },
        create: {
          clientId: project.clientId,
          provider: 'GOOGLE_SHEETS',
          workbookName: workbookName(project.client.name),
          activeClientKey: project.clientId,
          createdById: requestedById ?? project.client.createdById,
        },
        update: { workbookName: workbookName(project.client.name) },
      });

      let worksheet = await transaction.projectWorksheet.findUnique({
        where: { projectId },
      });
      if (!worksheet) {
        const siblings = await transaction.projectWorksheet.findMany({
          where: { workbookId: workbook.id },
          select: { worksheetName: true, worksheetIndex: true },
        });
        worksheet = await transaction.projectWorksheet.create({
          data: {
            workbookId: workbook.id,
            projectId,
            worksheetName: safeWorksheetName(
              project.title,
              siblings.map((item) => item.worksheetName),
            ),
            worksheetIndex:
              Math.max(1, ...siblings.map((item) => item.worksheetIndex)) + 1,
          },
        });
      }

      const idempotencyKey = [operation, projectId, sourceType, sourceId].join(
        ':',
      );
      const job = await transaction.spreadsheetSyncJob.upsert({
        where: { idempotencyKey },
        create: {
          clientId: project.clientId,
          projectId,
          workbookId: workbook.id,
          worksheetId: worksheet.id,
          sourceType,
          sourceId,
          operation,
          idempotencyKey,
        },
        update: {},
      });
      return { workbook, worksheet, job };
    });
  }

  async queueClientSync(
    clientId: string,
    sourceType: string,
    sourceId: string,
    requestedById?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, createdById: true },
    });
    if (!client) throw new NotFoundException('Client not found.');
    return this.prisma.$transaction(async (transaction) => {
      const workbook = await transaction.spreadsheetWorkbook.upsert({
        where: { activeClientKey: client.id },
        create: {
          clientId,
          provider: 'GOOGLE_SHEETS',
          workbookName: workbookName(client.name),
          activeClientKey: client.id,
          createdById: requestedById ?? client.createdById,
        },
        update: { workbookName: workbookName(client.name) },
      });
      const idempotencyKey = [
        SpreadsheetSyncOperation.SYNC_CLIENT,
        clientId,
        sourceType,
        sourceId,
      ].join(':');
      const job = await transaction.spreadsheetSyncJob.upsert({
        where: { idempotencyKey },
        create: {
          clientId,
          workbookId: workbook.id,
          sourceType,
          sourceId,
          operation: SpreadsheetSyncOperation.SYNC_CLIENT,
          idempotencyKey,
        },
        update: {},
      });
      return { workbook, job };
    });
  }

  async getClientSpreadsheet(clientId: string, user: AuthenticatedUser) {
    await this.assertClientAccess(clientId, user);
    const workbook = await this.prisma.spreadsheetWorkbook.findFirst({
      where: { clientId, activeClientKey: clientId },
      include: {
        worksheets: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                projectType: true,
                status: true,
              },
            },
          },
          orderBy: { worksheetIndex: 'asc' },
        },
        syncJobs: { orderBy: { requestedAt: 'desc' }, take: 1 },
      },
    });
    if (!workbook) {
      return {
        state: 'NOT_CONFIGURED',
        providerConfigured: this.provider.isConfigured(),
        workbook: null,
        projects: [],
      };
    }
    return {
      state: syncState(
        workbook,
        workbook.syncJobs[0],
        this.provider.isConfigured(),
      ),
      providerConfigured: this.provider.isConfigured(),
      workbook: {
        id: workbook.id,
        name: workbook.workbookName,
        externalUrl: workbook.externalUrl,
        status: workbook.status,
        lastSyncedAt: workbook.lastSyncedAt,
        worksheetCount: workbook.worksheets.length,
      },
      projects: workbook.worksheets.map((worksheet) => ({
        projectId: worksheet.project.id,
        projectName: worksheet.project.title,
        projectType: worksheet.project.projectType,
        projectStatus: worksheet.project.status,
        worksheetName: worksheet.worksheetName,
        worksheetStatus: worksheet.status,
        worksheetUrl: worksheetUrl(
          workbook.externalUrl,
          worksheet.externalWorksheetId,
        ),
        lastSyncedAt: worksheet.lastSyncedAt,
      })),
    };
  }

  async getProjectSpreadsheet(projectId: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user);
    const worksheet = await this.prisma.projectWorksheet.findUnique({
      where: { projectId },
      include: {
        project: { select: { id: true, title: true } },
        workbook: true,
        syncJobs: { orderBy: { requestedAt: 'desc' }, take: 1 },
      },
    });
    if (!worksheet) {
      return {
        state: 'NOT_CONFIGURED',
        providerConfigured: this.provider.isConfigured(),
        workbook: null,
        worksheet: null,
      };
    }
    return {
      state: syncState(
        worksheet,
        worksheet.syncJobs[0],
        this.provider.isConfigured(),
      ),
      providerConfigured: this.provider.isConfigured(),
      workbook: {
        id: worksheet.workbook.id,
        name: worksheet.workbook.workbookName,
        externalUrl: worksheet.workbook.externalUrl,
        status: worksheet.workbook.status,
      },
      worksheet: {
        id: worksheet.id,
        name: worksheet.worksheetName,
        externalUrl: worksheetUrl(
          worksheet.workbook.externalUrl,
          worksheet.externalWorksheetId,
        ),
        status: worksheet.status,
        lastSyncedAt: worksheet.lastSyncedAt,
      },
    };
  }

  async createClientSpreadsheet(clientId: string, user: AuthenticatedUser) {
    await this.assertClientAccess(clientId, user);
    return this.queueClientSync(
      clientId,
      'MANUAL_CREATE',
      crypto.randomUUID(),
      user.id,
    );
  }

  async requestClientSync(clientId: string, user: AuthenticatedUser) {
    await this.assertClientAccess(clientId, user);
    const clientJob = await this.queueClientSync(
      clientId,
      'MANUAL_SYNC',
      crypto.randomUUID(),
      user.id,
    );
    const projects = await this.prisma.project.findMany({
      where: { clientId, status: { not: 'ARCHIVED' } },
      select: { id: true },
    });
    await Promise.all(
      projects.map((project) =>
        this.queueProjectSync(
          project.id,
          'MANUAL_CLIENT_SYNC',
          crypto.randomUUID(),
          user.id,
        ),
      ),
    );
    return clientJob;
  }

  async requestProjectSync(projectId: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user);
    return this.queueProjectSync(
      projectId,
      'MANUAL_SYNC',
      crypto.randomUUID(),
      user.id,
    );
  }

  async projectSyncJobs(projectId: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user);
    return this.prisma.spreadsheetSyncJob.findMany({
      where: { projectId },
      orderBy: { requestedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        operation: true,
        status: true,
        attempts: true,
        errorCode: true,
        errorMessage: true,
        requestedAt: true,
        startedAt: true,
        completedAt: true,
      },
    });
  }

  async exportProject(projectId: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(projectId, user);
    const project = await this.projectData(projectId);
    const layout = buildProjectLayout(project);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BigU';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet(
      safeWorksheetName(project.title, []),
      {
        views: [{ state: 'frozen', ySplit: 1 }],
      },
    );
    worksheet.columns = Array.from({ length: 12 }, (_, index) => ({
      width: index === 1 ? 34 : 22,
    }));
    worksheet.addRows(
      layout.values.map((row) => row.map(neutralizeSpreadsheetValue)),
    );
    worksheet.getRow(3).hidden = true;
    worksheet.eachRow((row) => {
      const firstValue = row.getCell(1).value;
      const first =
        typeof firstValue === 'string' || typeof firstValue === 'number'
          ? String(firstValue)
          : '';
      if (
        first === first.toUpperCase() &&
        [
          'PROJECT SUMMARY',
          'APPROVED PROJECT CONTEXT',
          'SOP PROGRESS',
          'TASKS',
          'FILES AND EVIDENCE',
          'APPROVALS',
          'REPORTS',
          'RESEARCH SUMMARY',
          'COMPETITOR ANALYSIS',
          'APPROVED FINDINGS',
          'MARKETING STRATEGY',
          'APPROVED REFERENCES',
          'RESEARCH SYNC METADATA',
          'PROJECT UPDATE LOG',
        ].includes(first)
      ) {
        row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF24415A' },
        };
      }
    });
    const bytes = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(bytes),
      fileName: `${safeFileName(project.title)}-BigU-export.xlsx`,
    };
  }

  async processPendingJobs(limit = 5) {
    const pending = await this.prisma.spreadsheetSyncJob.findMany({
      where: { status: SpreadsheetSyncStatus.PENDING },
      orderBy: { requestedAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    for (const candidate of pending) {
      const claim = await this.prisma.spreadsheetSyncJob.updateMany({
        where: { id: candidate.id, status: SpreadsheetSyncStatus.PENDING },
        data: {
          status: SpreadsheetSyncStatus.PROCESSING,
          startedAt: new Date(),
          attempts: { increment: 1 },
          errorCode: null,
          errorMessage: null,
        },
      });
      if (claim.count === 1) await this.executeJob(candidate.id);
    }
  }

  async recoverStaleJobs() {
    await this.prisma.spreadsheetSyncJob.updateMany({
      where: {
        status: SpreadsheetSyncStatus.PROCESSING,
        startedAt: { lt: new Date(Date.now() - 10 * 60_000) },
      },
      data: { status: SpreadsheetSyncStatus.PENDING, startedAt: null },
    });
  }

  private async executeJob(jobId: string) {
    const job = await this.prisma.spreadsheetSyncJob.findUnique({
      where: { id: jobId },
      include: { workbook: true, worksheet: true },
    });
    if (!job) return;
    try {
      if (!this.provider.isConfigured()) {
        throw new SpreadsheetProviderNotConfiguredError();
      }
      let workbook = job.workbook;
      if (!workbook.externalWorkbookId) {
        const reference = await this.provider.createClientWorkbook({
          workbookName: workbook.workbookName,
        });
        workbook = await this.prisma.spreadsheetWorkbook.update({
          where: { id: workbook.id },
          data: {
            externalWorkbookId: reference.externalWorkbookId,
            workbookName: reference.workbookName,
            externalUrl: reference.externalUrl,
            overviewWorksheetId: reference.overviewWorksheetId,
            syncLogWorksheetId: reference.syncLogWorksheetId,
            status: 'ACTIVE',
          },
        });
      }
      if (
        !workbook.externalWorkbookId ||
        !workbook.overviewWorksheetId ||
        !workbook.syncLogWorksheetId
      ) {
        throw new Error('Workbook provisioning is incomplete.');
      }

      let worksheet = job.worksheet;
      let projectLayout:
        Awaited<ReturnType<typeof buildProjectLayout>> | undefined;
      if (job.projectId) {
        worksheet =
          worksheet ??
          (await this.prisma.projectWorksheet.findUnique({
            where: { projectId: job.projectId },
          }));
        if (!worksheet)
          throw new Error('Project worksheet mapping is missing.');
        const project = await this.projectData(job.projectId);
        const siblingNames = await this.prisma.projectWorksheet.findMany({
          where: { workbookId: workbook.id, id: { not: worksheet.id } },
          select: { worksheetName: true },
        });
        const desiredName = safeWorksheetName(
          project.title,
          siblingNames.map((item) => item.worksheetName),
        );
        if (!worksheet.externalWorksheetId) {
          const reference = await this.provider.createProjectWorksheet({
            externalWorkbookId: workbook.externalWorkbookId,
            worksheetName: desiredName,
            worksheetIndex: worksheet.worksheetIndex,
          });
          worksheet = await this.prisma.projectWorksheet.update({
            where: { id: worksheet.id },
            data: {
              externalWorksheetId: reference.externalWorksheetId,
              worksheetName: reference.worksheetName,
              worksheetIndex: reference.worksheetIndex,
              status: 'ACTIVE',
            },
          });
        } else if (worksheet.worksheetName !== desiredName) {
          await this.provider.renameWorksheet({
            externalWorkbookId: workbook.externalWorkbookId,
            externalWorksheetId: worksheet.externalWorksheetId,
            worksheetName: desiredName,
          });
          worksheet = await this.prisma.projectWorksheet.update({
            where: { id: worksheet.id },
            data: { worksheetName: desiredName },
          });
        }
        projectLayout = buildProjectLayout(project);
      }

      const synchronizedAt = new Date();
      const client = await this.clientOverviewData(job.clientId);
      const overviewLayout = buildClientOverviewLayout(client, synchronizedAt);
      const jobs = await this.prisma.spreadsheetSyncJob.findMany({
        where: { clientId: job.clientId },
        orderBy: { requestedAt: 'desc' },
        take: 100,
      });
      const syncLog = buildSyncLogLayout(
        jobs.map((item) =>
          item.id === job.id
            ? { ...item, status: 'SYNCED', completedAt: synchronizedAt }
            : item,
        ),
      );
      const clearRanges = ["'Client Overview'!A1:K1000", "'Sync Log'!A1:K1000"];
      const updates = [
        { range: "'Client Overview'!A1", values: overviewLayout.values },
        { range: "'Sync Log'!A1", values: syncLog },
      ];
      const hiddenRows = [
        {
          externalWorksheetId: workbook.overviewWorksheetId,
          startIndex: 2,
          endIndex: 3,
        },
      ];
      if (worksheet?.externalWorksheetId && projectLayout) {
        const sheet = quoteSheetName(worksheet.worksheetName);
        clearRanges.push(`${sheet}!A1:K10000`);
        updates.push({ range: `${sheet}!A1`, values: projectLayout.values });
        hiddenRows.push({
          externalWorksheetId: worksheet.externalWorksheetId,
          startIndex: 2,
          endIndex: 3,
        });
      }
      await this.provider.upsertRows({
        externalWorkbookId: workbook.externalWorkbookId,
        clearRanges,
        updates,
        hiddenRows,
      });

      await this.prisma.$transaction(async (transaction) => {
        await transaction.spreadsheetSyncJob.update({
          where: { id: job.id },
          data: {
            status: SpreadsheetSyncStatus.SYNCED,
            completedAt: synchronizedAt,
            errorCode: null,
            errorMessage: null,
          },
        });
        await transaction.spreadsheetWorkbook.update({
          where: { id: workbook.id },
          data: { status: 'ACTIVE', lastSyncedAt: synchronizedAt },
        });
        if (worksheet && projectLayout) {
          await transaction.projectWorksheet.update({
            where: { id: worksheet.id },
            data: { status: 'ACTIVE', lastSyncedAt: synchronizedAt },
          });
          await this.saveRowMappings(
            transaction,
            worksheet.id,
            projectLayout.mappings,
            synchronizedAt,
          );
        }
      });
    } catch (error) {
      const current = await this.prisma.spreadsheetSyncJob.findUnique({
        where: { id: job.id },
        select: { attempts: true },
      });
      const terminal =
        error instanceof SpreadsheetProviderNotConfiguredError ||
        (current?.attempts ?? 0) >= 3;
      const errorCode = spreadsheetErrorCode(error);
      await this.prisma.spreadsheetSyncJob.update({
        where: { id: job.id },
        data: {
          status: terminal
            ? SpreadsheetSyncStatus.FAILED
            : SpreadsheetSyncStatus.PENDING,
          completedAt: terminal ? new Date() : null,
          startedAt: terminal ? job.startedAt : null,
          errorCode,
          errorMessage: safeErrorMessage(error),
        },
      });
      if (terminal && !job.workbook.externalWorkbookId) {
        await this.prisma.spreadsheetWorkbook.update({
          where: { id: job.workbookId },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  private async saveRowMappings(
    transaction: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    worksheetId: string,
    mappings: SpreadsheetRowDescriptor[],
    synchronizedAt: Date,
  ) {
    for (const mapping of mappings) {
      await transaction.spreadsheetRowMapping.upsert({
        where: {
          worksheetId_entityType_entityId: {
            worksheetId,
            entityType: mapping.entityType,
            entityId: mapping.entityId,
          },
        },
        create: {
          worksheetId,
          ...mapping,
          lastSyncedAt: synchronizedAt,
        },
        update: {
          section: mapping.section,
          rowIdentifier: mapping.rowIdentifier,
          lastSyncedAt: synchronizedAt,
        },
      });
    }
  }

  private projectData(projectId: string) {
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        client: { select: { name: true } },
        assignedUser: { select: { name: true } },
        changeRequests: {
          include: { reviewedBy: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        files: {
          include: { uploadedBy: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        researchBrief: true,
        researchCompetitors: { orderBy: { createdAt: 'asc' } },
        researchReferences: { orderBy: { createdAt: 'asc' } },
        researchFindings: {
          where: { status: 'APPROVED' },
          orderBy: { reviewedAt: 'desc' },
        },
        marketingStrategy: true,
      },
    });
  }

  private clientOverviewData(clientId: string) {
    return this.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      include: {
        projects: {
          include: { spreadsheetWorksheet: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
  }

  private async assertClientAccess(clientId: string, user: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where:
        user.role === 'ADMIN'
          ? { id: clientId }
          : {
              id: clientId,
              OR: [
                { createdById: user.id },
                { projects: { some: { assignedUserId: user.id } } },
              ],
            },
      select: { id: true },
    });
    if (!client)
      throw new ForbiddenException('Client spreadsheet access denied.');
  }

  private async assertProjectAccess(
    projectId: string,
    user: AuthenticatedUser,
  ) {
    const project = await this.prisma.project.findFirst({
      where:
        user.role === 'ADMIN'
          ? { id: projectId }
          : {
              id: projectId,
              OR: [
                { assignedUserId: user.id },
                { client: { createdById: user.id } },
              ],
            },
      select: { id: true },
    });
    if (!project) {
      throw new ForbiddenException('Project spreadsheet access denied.');
    }
  }
}

function workbookName(clientName: string) {
  return `${clientName.trim()} — BigU Workspace`.slice(0, 200);
}

export function safeWorksheetName(title: string, existingNames: string[]) {
  const cleaned =
    Array.from(title)
      .map((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 ||
          codePoint === 127 ||
          '[]:*?/\\'.includes(character)
          ? ' '
          : character;
      })
      .join('')
      .replace(/^'+|'+$/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Project';
  const normalized = new Set(
    existingNames.map((name) => name.toLocaleLowerCase()),
  );
  let candidate = cleaned.slice(0, 31).trim();
  if (!normalized.has(candidate.toLocaleLowerCase())) return candidate;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const marker = ` (${suffix})`;
    candidate = `${cleaned.slice(0, 31 - marker.length).trim()}${marker}`;
    if (!normalized.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('A unique worksheet name could not be generated.');
}

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function worksheetUrl(
  workbookUrl: string | null,
  externalWorksheetId: string | null,
) {
  if (!workbookUrl || !externalWorksheetId) return null;
  return `${workbookUrl.split('#')[0]}#gid=${encodeURIComponent(externalWorksheetId)}`;
}

function syncState(
  resource: { status: string; lastSyncedAt?: Date | null },
  job:
    | {
        status: string;
      }
    | undefined,
  providerConfigured: boolean,
) {
  if (!providerConfigured) return 'NOT_CONFIGURED';
  if (job?.status === 'FAILED' || resource.status === 'FAILED') return 'FAILED';
  if (job?.status === 'PROCESSING') return 'SYNCING';
  if (job?.status === 'PENDING') return 'PENDING';
  if (resource.status === 'CREATING') return 'CREATING';
  return resource.lastSyncedAt ? 'SYNCED' : 'PENDING';
}

function safeFileName(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9 _.-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'project'
  );
}

function spreadsheetErrorCode(error: unknown) {
  const name = error instanceof Error ? error.name : 'SpreadsheetError';
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase()
    .slice(0, 120);
}

function safeErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Spreadsheet sync failed.')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 1000);
}
